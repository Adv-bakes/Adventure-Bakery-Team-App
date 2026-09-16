-- Signature requests: the person who filled a form asks a named person to review and sign it.
--
-- WHY THIS IS REQUESTED AND NOT DERIVED. The first cut of this feature computed the queue from the
-- schema and the entry - any draft with an unsigned verifier line was "awaiting signature". Run
-- against live data it produced TWELVE items, the oldest from 15 July, and almost none of them were
-- anybody waiting on anything: they were half-finished drafts. A queue that is mostly noise is a
-- queue people stop opening, so the trigger is now an explicit act by the person who filled the
-- form in, and it carries a note saying what they are asking for.
--
-- THE NOTIFICATION IS TARGETED, WHICH internal_notifications HAS NOT BEEN UNTIL NOW. Every existing
-- row is team-wide and labelled with a responsible POSITION - that is deliberate, and 2.5.2.2 is
-- why. A signature request is different in kind: it is addressed to a person, because only that
-- person can discharge it. Hence `assigned_to`, nullable, so every existing notification and every
-- future team-wide one behaves exactly as it does today.
--
-- A SIGNATURE REQUEST CANNOT BE DISMISSED, only resolved. Dismissal exists so a human can clear a
-- prompt and be stamped for it; here the only ways out are signing it or the requester withdrawing
-- it, and neither is a dismissal. That also removes the one awkward case in the upsert below: a
-- re-request reopens the row by clearing resolved_at, and resolved_at carries no person's name, so
-- clearing it erases nothing about anybody's act. dismissed_by/at are never written for this type
-- and are never cleared by it.
--
-- TWO RPCs BECAUSE THE TABLE HAS NO UPDATE POLICY AT ALL - that is D-18's design, so the people a
-- dismissal stamp describes cannot edit it. Creating is a plain INSERT the existing staff/admin
-- policy already allows, but it has to upsert on the unique dedupe_key, and closing is an UPDATE.
-- Both are SECURITY DEFINER and gated on is_staff_or_admin, the same shape as
-- dismiss_notification() and acknowledge_temperature_alert().

begin;

alter table public.internal_notifications
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;

comment on column public.internal_notifications.assigned_to is
  'The person this notification is addressed to, when it is addressed to a person at all. NULL '
  'means team-wide, which is what every scheduled verification and temperature notification is. '
  'The feed shows a row when assigned_to is null or is the reader.';

create index if not exists internal_notifications_assigned_open_idx
  on public.internal_notifications (assigned_to)
  where dismissed_at is null and resolved_at is null;

-- ------------------------------------------------------------------ request
create or replace function public.request_signature(
  _response_id  uuid,
  _assigned_to  uuid,
  _note         text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key      text := 'signature:' || _response_id::text;
  v_doc      uuid;
  v_status   text;
  v_number   text;
  v_asker    text;
  v_note     text := nullif(btrim(coalesce(_note, '')), '');
  v_title    text;
  v_message  text;
  v_id       uuid;
begin
  if not is_staff_or_admin(auth.uid()) then
    raise exception 'Not permitted to request a signature.' using errcode = '42501';
  end if;

  select r.document_id, r.status, r.form_number
    into v_doc, v_status, v_number
    from public.sop_document_responses r
   where r.id = _response_id;

  if v_doc is null then
    raise exception 'That entry no longer exists.';
  end if;
  -- A submitted entry is finished. Asking for a signature on one would be asking somebody to
  -- reopen a filed record, which is an admin act with its own trail, not a signature request.
  if v_status <> 'draft' then
    raise exception 'Only a draft can be sent for signature; this entry is already submitted.';
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), 'A team member')
    into v_asker from public.profiles p where p.id = auth.uid();
  v_asker := coalesce(v_asker, 'A team member');

  v_title   := coalesce(v_number, 'A form') || ' needs your signature';
  v_message := v_asker || ' has asked you to review and sign this entry.'
               || coalesce(E'\n\n"' || v_note || '"', '');

  insert into public.internal_notifications
    (notification_type, reference_table, reference_id, title, message, dedupe_key,
     assigned_to, responsible_position, severity, links)
  values
    ('signature_requested', 'sop_document_responses', _response_id, v_title, v_message, v_key,
     _assigned_to, null, 'info',
     jsonb_build_array(jsonb_build_object(
       'label', 'Open and sign ' || coalesce(v_number, 'the entry'),
       'href',  '/team/compliance/forms/' || v_doc::text
                || '/entries/' || _response_id::text || '?from=notifications')))
  on conflict (dedupe_key) do update
     set title           = excluded.title,
         message         = excluded.message,
         assigned_to     = excluded.assigned_to,
         links           = excluded.links,
         created_at      = now(),
         -- Re-asking reopens it. resolved_at is never stamped with a name, so nothing about a
         -- person's act is lost here. dismissed_* is deliberately untouched: this type is not
         -- dismissable, so it is always null, and the upsert must never be a way to clear one.
         resolved_at     = null,
         resolved_reason = null
  returning id into v_id;

  return v_id;
end $$;

comment on function public.request_signature(uuid, uuid, text) is
  'Ask a named person to review and sign a draft entry. Upserts one open notification per entry; '
  're-asking refreshes the note and reopens it.';

revoke all on function public.request_signature(uuid, uuid, text) from public;
grant execute on function public.request_signature(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------------ resolve
create or replace function public.resolve_signature_request(
  _response_id uuid,
  _reason      text default 'Signed'
) returns integer
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

  -- resolved_at, never dismissed_at, and never a name: a stamped dismissal has to keep meaning
  -- that a person chose to clear something. This is the request being satisfied or withdrawn.
  update public.internal_notifications
     set resolved_at     = now(),
         resolved_reason = coalesce(nullif(btrim(_reason), ''), 'Signed')
   where dedupe_key  = 'signature:' || _response_id::text
     and resolved_at is null;

  get diagnostics v_n = row_count;
  return v_n;
end $$;

comment on function public.resolve_signature_request(uuid, text) is
  'Close the open signature request for an entry - because it was signed, or withdrawn.';

revoke all on function public.resolve_signature_request(uuid, text) from public;
grant execute on function public.resolve_signature_request(uuid, text) to authenticated;

-- ------------------------------------------------------------------ verify
do $verify$
declare n int;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'internal_notifications'
                    and column_name = 'assigned_to') then
    raise exception 'assigned_to did not land.';
  end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('request_signature', 'resolve_signature_request')
     and p.prosecdef;
  if n <> 2 then
    raise exception 'Expected both RPCs to exist and be SECURITY DEFINER, found %.', n;
  end if;

  -- The table must still have no UPDATE policy: these functions exist precisely because clients
  -- cannot write to this table directly, and a policy appearing later would undo that.
  if exists (select 1 from pg_policies
              where tablename = 'internal_notifications' and cmd in ('UPDATE', 'ALL')) then
    raise exception 'internal_notifications has gained an UPDATE policy; the stamps are no longer tamper-proof.';
  end if;

  raise notice 'Signature requests: assigned_to added, request_signature and resolve_signature_request created.';
end $verify$;

commit;
