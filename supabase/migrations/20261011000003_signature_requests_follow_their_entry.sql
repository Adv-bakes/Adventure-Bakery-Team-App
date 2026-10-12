-- A signature request does not outlive the entry it asks about.
--
-- Found by the owner, 2026-10-11: a request to review and sign an FRM-507 stayed under "Asked of
-- you" after that entry had been deleted. Its link opened "Entry not found", and - because a
-- signature request deliberately cannot be dismissed, only resolved by signing or withdrawing -
-- there was no way left to close it.
--
-- Three parts:
--   1. A trigger closes every open signature request of an entry when the entry is deleted. It
--      sets resolved_at with the reason "Entry deleted" and never a person's name, the same as a
--      request that was signed or withdrawn (a stamped dismissal keeps meaning a person chose it).
--   2. clear_orphan_signature_request(notification) lets a team member close one request whose
--      entry cannot be found - and only then. A request whose entry exists is left alone, so this
--      is not a way round signing.
--   3. The requests already left behind by deleted entries are closed now.
--
-- Safe to run twice: the function and trigger are replaced, and the clean-up only touches requests
-- that are still open and whose entry is gone.

create or replace function public.close_signature_requests_of_deleted_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 'signature:<entry>' is the verifier request; 'signature:<entry>:<field>' a named person's line.
  update public.internal_notifications
     set resolved_at     = now(),
         resolved_reason = 'Entry deleted'
   where notification_type = 'signature_requested'
     and resolved_at is null
     and (dedupe_key = 'signature:' || old.id::text
          or left(dedupe_key, length('signature:' || old.id::text) + 1) = 'signature:' || old.id::text || ':');
  return old;
end $$;

comment on function public.close_signature_requests_of_deleted_entry() is
  'Trigger: closes the open signature requests of a form entry when the entry is deleted.';

drop trigger if exists sop_document_responses_close_signature_requests on public.sop_document_responses;
create trigger sop_document_responses_close_signature_requests
  after delete on public.sop_document_responses
  for each row execute function public.close_signature_requests_of_deleted_entry();

create or replace function public.clear_orphan_signature_request(_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if not is_staff_or_admin(auth.uid()) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;

  update public.internal_notifications n
     set resolved_at     = now(),
         resolved_reason = 'Entry no longer exists'
   where n.id = _notification_id
     and n.notification_type = 'signature_requested'
     and n.resolved_at is null
     and not exists (select 1 from public.sop_document_responses r
                      where r.id::text = split_part(n.dedupe_key, ':', 2));

  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

comment on function public.clear_orphan_signature_request(uuid) is
  'Close a signature request whose form entry no longer exists. Does nothing if the entry exists.';

revoke all on function public.clear_orphan_signature_request(uuid) from public;
grant execute on function public.clear_orphan_signature_request(uuid) to authenticated;

-- The requests already left behind.
update public.internal_notifications n
   set resolved_at     = now(),
       resolved_reason = 'Entry deleted'
 where n.notification_type = 'signature_requested'
   and n.resolved_at is null
   and n.dedupe_key like 'signature:%'
   and not exists (select 1 from public.sop_document_responses r
                    where r.id::text = split_part(n.dedupe_key, ':', 2));
