-- sign_out_visitor: stamp the time out on a visitor's FRM-905 entry.
--
-- The Visitor Sign-In page writes each FRM-905 entry already SUBMITTED - the visitor's signature
-- and health declaration are on it, and a draft would leave those editable by the host for as long
-- as the visitor is on site. But the visitor leaves later, and often it is a different member of
-- staff who sees them out. RLS lets staff update only their own DRAFTS, so neither the host nor
-- anybody else can write the time out with a plain update.
--
-- This function writes that one key and nothing else: time_out, once, on a submitted FRM-905 entry
-- that does not have one. It cannot alter an answer or a signature, and it refuses a second call,
-- so the time recorded is the first one given.
--
-- Same shape as request_signature / dismiss_notification: SECURITY DEFINER, gated on
-- is_staff_or_admin(auth.uid()) inside the function.

create or replace function public.sign_out_visitor(
  _response_id uuid,
  _time_out    text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number  text;
  v_status  text;
  v_current text;
begin
  if not is_staff_or_admin(auth.uid()) then
    raise exception 'Not permitted to sign a visitor out.' using errcode = '42501';
  end if;
  if _time_out is null or _time_out !~ '^([01]\d|2[0-3]):[0-5]\d$' then
    raise exception 'Time out must be HH:MM.';
  end if;

  select r.form_number, r.status, nullif(btrim(coalesce(r.data->>'time_out', '')), '')
    into v_number, v_status, v_current
    from public.sop_document_responses r
   where r.id = _response_id
     for update;

  if v_number is null then
    raise exception 'That visitor entry no longer exists.';
  end if;
  if v_number <> 'FRM-905' then
    raise exception 'Only a Visitor Sign-In Log (FRM-905) entry can be signed out.';
  end if;
  if v_status <> 'submitted' then
    raise exception 'That entry is still a draft; record the time out on the entry itself.';
  end if;
  if v_current is not null then
    raise exception 'That visitor was already signed out at %.', v_current;
  end if;

  update public.sop_document_responses
     set data       = data || jsonb_build_object('time_out', _time_out),
         updated_by = auth.uid()
   where id = _response_id;
end $$;

comment on function public.sign_out_visitor(uuid, text) is
  'Record the time out on a submitted FRM-905 visitor entry, once. Writes only data.time_out.';

revoke all on function public.sign_out_visitor(uuid, text) from public;
grant execute on function public.sign_out_visitor(uuid, text) to authenticated;
