-- NDAs are approved on arrival.
--
-- Product decision (2026-08-17, program lead): an uploaded NDA is a signed NDA. It should not sit
-- in a `pending` review state, because that state is what renders the "·pending" chip beside the
-- NDA button in the project workspace and what holds the document in the Documents Inbox queue.
--
-- Enforced in the database rather than at each call site because five code paths insert NDA rows
-- (SalesProjectWorkspace, PssIntake, AddClientFlow x2, ClientDetail) and two of them never set
-- `review_status` at all -- they inherit the column default 'pending' from migration 20260516012745.
-- A trigger is the only place that covers all five plus anything added later.
--
-- The AI check is unaffected: `review-client-document` still runs on NDAs and still stores its
-- verdict in `review_notes`. It just no longer drives `review_status` for them.

create or replace function public.enforce_nda_auto_approval()
returns trigger
language plpgsql
as $$
begin
  if lower(coalesce(new.document_type, '')) <> 'nda' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.review_status := 'approved';
    return new;
  end if;

  -- An approved NDA must not fall back into a triage state. `review-client-document` no longer
  -- writes review_status for NDAs, but this holds the invariant regardless of the order in which
  -- the migration and the edge function get deployed. An explicit human decision from the review
  -- panel ('rejected') is not a triage state and still goes through.
  if old.review_status = 'approved'
     and new.review_status in ('pending', 'ai_passed', 'ai_flagged') then
    new.review_status := 'approved';
  end if;

  return new;
end;
$$;

drop trigger if exists client_documents_nda_auto_approve on public.client_documents;
create trigger client_documents_nda_auto_approve
  before insert or update on public.client_documents
  for each row
  execute function public.enforce_nda_auto_approval();

-- Backfill every NDA already on file.
--
-- Per the 2026-08-17 decision this moves ALL non-approved NDAs, including any that a human
-- previously rejected in the review panel. Those ids are printed below before the update so the
-- change is recoverable from the `supabase db push` output if that turns out to be too broad.
do $$
declare
  rejected_ids uuid[];
  counts       text;
begin
  select array_agg(id)
    into rejected_ids
    from public.client_documents
   where lower(coalesce(document_type, '')) = 'nda'
     and review_status = 'rejected';

  select string_agg(format('%s=%s', coalesce(review_status, 'null'), n), ', ' order by review_status)
    into counts
    from (
      select review_status, count(*) as n
        from public.client_documents
       where lower(coalesce(document_type, '')) = 'nda'
         and review_status is distinct from 'approved'
       group by review_status
    ) s;

  raise notice 'nda_auto_approve: backfilling NDAs by prior status -> %', coalesce(counts, 'none');

  if rejected_ids is not null then
    raise notice 'nda_auto_approve: these NDAs were REJECTED by a reviewer and are now approved: %',
      rejected_ids;
  end if;
end
$$;

update public.client_documents
set    review_status = 'approved'
where  lower(coalesce(document_type, '')) = 'nda'
  and  review_status is distinct from 'approved';
