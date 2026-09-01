-- FRM-901 revision B -> v2, to match the house numbering.
--
-- 20260901000008 bumped FRM-901 from 'A' to 'B', continuing the letter scheme the form happened to
-- have been issued under. Every other form in the system uses v-numbers - FRM-903 is at v6, FRM-907
-- at v2, the SSOPs at v2/v3 - and FRM-901 was the only letter left. The owner asked for it to match.
--
-- The number is a relabel, not a re-issue: 'A' was the first issue, so the revision that followed it
-- is v2 whichever alphabet you write it in. The content, effective date and approver are untouched,
-- so the document itself does not change - only what the revision is called.
--
-- Note this produces two history snapshots for one edit, A -> B in 20260901000008 and B -> v2 here.
-- That is honest rather than tidy: the row genuinely held 'B' for the time between the two
-- migrations, and rewriting 20260901000008 to pretend otherwise would put the migration file and
-- the database's own audit trail into disagreement. The snapshot cost is one row.
--
-- Guarded on the revision this migration expects, so re-running it or applying it to a row somebody
-- has since re-revised raises instead of silently relabelling.

begin;

do $$
declare
  rev text;
  st  text;
begin
  select revision, status into rev, st
    from public.sop_documents where sop_number = 'FRM-901';

  if rev is null then
    raise exception 'FRM-901 does not exist.';
  end if;
  if st <> 'active' then
    raise exception 'FRM-901 is % - expected an active controlled form.', st;
  end if;
  if rev <> 'B' then
    raise exception 'FRM-901 is at revision % - this migration relabels B to v2. Run 20260901000008 first, or re-derive if the form has been revised since.', rev;
  end if;
end $$;

update public.sop_documents
   set revision = 'v2'
 where sop_number = 'FRM-901'
   and status = 'active'
   and revision = 'B';

do $$
declare
  r record;
begin
  select revision, effective_date, approved_by,
         jsonb_array_length(content->'form_schema'->'sections'->0->'fields'->0->'rows') as sched_rows,
         jsonb_array_length(content->'attachments')                                     as attachments
    into r
    from public.sop_documents where sop_number = 'FRM-901';

  if r.revision <> 'v2' then
    raise exception 'FRM-901 revision is %, expected v2.', r.revision;
  end if;
  -- the relabel must not have disturbed anything else
  if r.effective_date <> date '2026-09-01' or r.approved_by is distinct from 'GJM' then
    raise exception 'FRM-901 metadata changed unexpectedly: effective %, approved %.',
      r.effective_date, r.approved_by;
  end if;
  if r.sched_rows <> 10 or r.attachments is null then
    raise exception 'FRM-901 content disturbed: schedule rows %, attachments %.',
      r.sched_rows, r.attachments;
  end if;
end $$;

commit;
