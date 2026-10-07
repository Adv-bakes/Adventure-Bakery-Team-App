-- A signature asked for from a person NAMED ON THE RECORD, signed from their own log-in.
--
-- Owner's request, 2026-10-07: on FRM-952 the assessor fills the record in and the person who was
-- trained has to acknowledge it. Until now that line could only be ticked by whoever had the entry
-- open - so it was stamped with the assessor's name - because a staff member cannot change another
-- person's draft, and the existing signature request (20260916000005) only goes to an admin for a
-- "verified by" line.
--
-- A signature field can now carry `signedBy` (see SignatureField.signedBy). Three functions:
--   request_signature_on(entry, field, person, note)  - the filler (or an admin) asks a team member;
--   sign_response_field(entry, field)                 - the person asked signs. It writes that ONE
--                                                       answer (and the date field the schema names)
--                                                       and nothing else, so the signer cannot alter
--                                                       what they are putting their name to;
--   withdraw_signature_request_on(entry, field, why)  - close the request (one line, or all of an
--                                                       entry's when field is null).
-- RLS on sop_document_responses is NOT widened: a policy cannot see the old row, so it could not
-- stop a signer changing the answers. The requests are internal_notifications rows of the existing
-- type 'signature_requested', keyed 'signature:<entry>:<field>' so they never collide with the
-- verifier request ('signature:<entry>'), and like it they are resolved, never dismissed.
--
-- When the person signs, WHOEVER ASKED is told: a 'signature_signed' notification addressed to them,
-- with a link to the record. It is news, so unlike the request it can be cleared. To know who asked,
-- internal_notifications gains `requested_by` (null on every existing row and every other type).
--
-- FRM-952's "Employee acknowledgment" gets signedBy. Nothing a person reads on the form changes, so
-- its revision, approval and date are untouched. ONE UPDATE to the document.

begin;

alter table public.internal_notifications
  add column if not exists requested_by uuid references auth.users(id) on delete set null;
comment on column public.internal_notifications.requested_by is
  'Who asked - set on a signature request for a named person, so they can be told when it is signed.';

-- ------------------------------------------------------------------ helper: the field, if it qualifies
create or replace function public.requested_signature_field(_doc uuid, _field_id text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select f
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') s,
         jsonb_array_elements(s->'fields') f
   where d.id = _doc and f->>'id' = _field_id and f->>'type' = 'signature' and f ? 'signedBy'
   limit 1;
$$;
revoke all on function public.requested_signature_field(uuid, text) from public;
grant execute on function public.requested_signature_field(uuid, text) to authenticated;

-- ------------------------------------------------------------------ ask
create or replace function public.request_signature_on(
  _response_id uuid, _field_id text, _assigned_to uuid, _note text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_key     text := 'signature:' || _response_id::text || ':' || _field_id;
  v_doc     uuid; v_status text; v_number text; v_creator uuid; v_data jsonb;
  v_field   jsonb; v_asker text;
  v_note    text := nullif(btrim(coalesce(_note, '')), '');
  v_id      uuid;
begin
  if not public.is_staff_or_admin(auth.uid()) then
    raise exception 'Not permitted to request a signature.' using errcode = '42501';
  end if;
  select r.document_id, r.status, r.form_number, r.created_by, r.data
    into v_doc, v_status, v_number, v_creator, v_data
    from public.sop_document_responses r where r.id = _response_id;
  if v_doc is null then raise exception 'That entry no longer exists.'; end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft can be sent for signature; this entry is already submitted.';
  end if;
  -- The people who may change the draft are the people who may ask for it to be signed.
  if v_creator is distinct from auth.uid()
     and not (public.has_role(auth.uid(), 'admin') or public.is_owner(auth.uid())) then
    raise exception 'Only the person who filled this entry in, or an admin, can ask for it to be signed.' using errcode = '42501';
  end if;
  v_field := public.requested_signature_field(v_doc, _field_id);
  if v_field is null then raise exception 'That line is not one a named person signs.'; end if;
  if coalesce(v_data->_field_id->>'name', '') <> '' then raise exception 'That line is already signed.'; end if;
  -- They have to log in to sign, so: a team role and portal access.
  if not public.is_staff_or_admin(_assigned_to)
     or not exists (select 1 from public.profiles p where p.id = _assigned_to and p.access_granted is true) then
    raise exception 'That person cannot sign in to the Team Portal, so cannot be asked.';
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), 'A team member') into v_asker
    from public.profiles p where p.id = auth.uid();
  v_asker := coalesce(v_asker, 'A team member');

  insert into public.internal_notifications
    (notification_type, reference_table, reference_id, title, message, dedupe_key,
     assigned_to, requested_by, responsible_position, severity, links)
  values
    ('signature_requested', 'sop_document_responses', _response_id,
     coalesce(v_number, 'A form') || ' needs your signature',
     v_asker || ' has asked you to sign "' || coalesce(v_field->>'label', 'this line') || '" on this record.'
       || coalesce(E'\n\n"' || v_note || '"', ''),
     v_key, _assigned_to, auth.uid(), null, 'info',
     jsonb_build_array(jsonb_build_object(
       'label', 'Open and sign ' || coalesce(v_number, 'the entry'),
       'href',  '/team/compliance/forms/' || v_doc::text || '/entries/' || _response_id::text || '?from=notifications')))
  on conflict (dedupe_key) do update
     set title = excluded.title, message = excluded.message, assigned_to = excluded.assigned_to,
         requested_by = excluded.requested_by,
         links = excluded.links, created_at = now(),
         -- Re-asking reopens it. resolved_at never carries a name, so nothing about a person's act
         -- is lost; dismissed_* is untouched because this type is never dismissed.
         resolved_at = null, resolved_reason = null
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.request_signature_on(uuid, text, uuid, text) from public;
grant execute on function public.request_signature_on(uuid, text, uuid, text) to authenticated;

-- ------------------------------------------------------------------ sign
create or replace function public.sign_response_field(_response_id uuid, _field_id text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_key   text := 'signature:' || _response_id::text || ':' || _field_id;
  v_doc   uuid; v_status text; v_data jsonb; v_field jsonb; v_name text; v_date_field text;
  v_asker uuid; v_number text;
begin
  -- The request is the authority: only the person it is addressed to, and only while it is open.
  if not exists (select 1 from public.internal_notifications n
                  where n.dedupe_key = v_key and n.notification_type = 'signature_requested'
                    and n.resolved_at is null and n.assigned_to = auth.uid()) then
    raise exception 'You have not been asked to sign this line, or the request was withdrawn.' using errcode = '42501';
  end if;
  select r.document_id, r.status, r.data, r.form_number into v_doc, v_status, v_data, v_number
    from public.sop_document_responses r where r.id = _response_id for update;
  if v_doc is null then raise exception 'That entry no longer exists.'; end if;
  if v_status <> 'draft' then raise exception 'This entry is already submitted.'; end if;
  v_field := public.requested_signature_field(v_doc, _field_id);
  if v_field is null then raise exception 'That line is not one a named person signs.'; end if;
  if coalesce(v_data->_field_id->>'name', '') <> '' then raise exception 'That line is already signed.'; end if;

  select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.email), '')) into v_name
    from public.profiles p where p.id = auth.uid();
  if v_name is null then raise exception 'Your profile has no name to sign with.'; end if;

  v_data := jsonb_set(coalesce(v_data, '{}'::jsonb), array[_field_id], jsonb_build_object(
              'user_id', auth.uid(), 'name', v_name,
              'signed_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  -- The date beside the line, when the schema names one and it is a date field of this form.
  v_date_field := v_field->'signedBy'->>'dateField';
  if v_date_field is not null and exists (
       select 1 from public.sop_documents d,
              jsonb_array_elements(d.content->'form_schema'->'sections') s,
              jsonb_array_elements(s->'fields') f
        where d.id = v_doc and f->>'id' = v_date_field and f->>'type' = 'date') then
    v_data := jsonb_set(v_data, array[v_date_field],
                to_jsonb(to_char(now() at time zone 'America/New_York', 'YYYY-MM-DD')));
  end if;

  update public.sop_document_responses set data = v_data where id = _response_id;
  update public.internal_notifications
     set resolved_at = now(), resolved_reason = 'Signed'
   where dedupe_key = v_key and resolved_at is null
  returning requested_by into v_asker;

  -- Tell whoever asked. The key carries the moment, so a line signed again after a reopen is a
  -- new item and never touches one somebody already cleared.
  if v_asker is not null and v_asker <> auth.uid() then
    insert into public.internal_notifications
      (notification_type, reference_table, reference_id, title, message, dedupe_key,
       assigned_to, responsible_position, severity, links)
    values
      ('signature_signed', 'sop_document_responses', _response_id,
       v_name || ' signed ' || coalesce(v_number, 'the record'),
       v_name || ' has signed "' || coalesce(v_field->>'label', 'the line') || '". The record is still a draft until it is submitted.',
       'signed:' || _response_id::text || ':' || _field_id || ':' || extract(epoch from clock_timestamp())::text,
       v_asker, null, 'info',
       jsonb_build_array(jsonb_build_object(
         'label', 'Open ' || coalesce(v_number, 'the record'),
         'href',  '/team/compliance/forms/' || v_doc::text || '/entries/' || _response_id::text || '?from=notifications')));
  end if;
end $$;
revoke all on function public.sign_response_field(uuid, text) from public;
grant execute on function public.sign_response_field(uuid, text) to authenticated;

-- ------------------------------------------------------------------ withdraw
create or replace function public.withdraw_signature_request_on(
  _response_id uuid, _field_id text default null, _reason text default 'Withdrawn'
) returns integer
language plpgsql security definer set search_path = public
as $$
declare v_n integer;
begin
  if not public.is_staff_or_admin(auth.uid()) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  update public.internal_notifications
     set resolved_at = now(), resolved_reason = coalesce(nullif(btrim(_reason), ''), 'Withdrawn')
   where notification_type = 'signature_requested' and resolved_at is null
     and case when _field_id is null
              then left(dedupe_key, length('signature:' || _response_id::text || ':')) = 'signature:' || _response_id::text || ':'
              else dedupe_key = 'signature:' || _response_id::text || ':' || _field_id end;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.withdraw_signature_request_on(uuid, text, text) from public;
grant execute on function public.withdraw_signature_request_on(uuid, text, text) to authenticated;

-- ------------------------------------------------------------------ FRM-952
do $guard$
declare f jsonb;
begin
  select content->'form_schema'->'sections'->3->'fields' into f
    from public.sop_documents where sop_number = 'FRM-952' and status = 'active' and revision = 'New';
  if f is null or f->3->>'id' <> 'employee_acknowledgment_signature' or f->3->>'type' <> 'signature'
     or f->4->>'id' <> 'employee_acknowledgment_date' or f->4->>'type' <> 'date' or f->3 ? 'signedBy' then
    raise exception 'FRM-952 sign-off fields are not where this migration expects them.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(content, '{form_schema,sections,3,fields,3,signedBy}',
                   '{"nameField": "employee_name", "dateField": "employee_acknowledgment_date"}'::jsonb)
 where sop_number = 'FRM-952' and status = 'active' and revision = 'New';

do $verify$
declare d record; n int;
begin
  select status, revision, approved_by, effective_date, id into d from public.sop_documents where sop_number = 'FRM-952';
  if d.status <> 'active' or d.revision <> 'New' or d.approved_by <> 'GJM' or d.effective_date <> date '2026-06-27' then
    raise exception 'FRM-952 revision, approval or date changed.';
  end if;
  if public.requested_signature_field(d.id, 'employee_acknowledgment_signature')->'signedBy'->>'dateField' <> 'employee_acknowledgment_date'
     or public.requested_signature_field(d.id, 'verified_by_assessor_signature') is not null then
    raise exception 'signedBy was not set as intended.';
  end if;
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prosecdef
     and p.proname in ('request_signature_on', 'sign_response_field', 'withdraw_signature_request_on', 'requested_signature_field');
  if n <> 4 then raise exception 'expected four SECURITY DEFINER functions, found %.', n; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'internal_notifications' and cmd = 'UPDATE') then
    raise exception 'internal_notifications has an UPDATE policy; the stamps are no longer tamper-proof.';
  end if;
end $verify$;

commit;
