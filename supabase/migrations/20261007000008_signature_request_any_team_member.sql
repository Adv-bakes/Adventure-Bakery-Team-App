-- request_signature_on: any team member can be asked, whatever their client-portal flag.
--
-- Found by the owner on 2026-10-07: an admin did not appear in "Who should sign it". The function
-- (and the list in the app) required profiles.access_granted, on the reasoning that the person
-- must be able to log in. That flag does not say that. It is the CLIENT portal's access switch
-- (ProtectedRoute: "For client users, check access_granted"); a team member signs in on their
-- role, and the admin in question signs in daily with the flag off. The role is the right test,
-- and it is the one the function already makes. Only that check changes; the rest is as pushed
-- in 20261007000006.

begin;

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
  -- They have to log in to the Team Portal to sign, and a team role is what lets them.
  -- profiles.access_granted is NOT tested: it gates the client (brand) portal only.
  if not public.is_staff_or_admin(_assigned_to) then
    raise exception 'That person has no Team Portal role, so cannot be asked.';
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

do $verify$
begin
  if position('access_granted' in replace(pg_get_functiondef('public.request_signature_on(uuid, text, uuid, text)'::regprocedure), 'profiles.access_granted is NOT tested', '')) > 0 then
    raise exception 'request_signature_on still tests access_granted.';
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.request_signature_on(uuid, text, uuid, text)'::regprocedure) then
    raise exception 'request_signature_on is no longer SECURITY DEFINER.';
  end if;
end $verify$;

commit;
