-- Label print requests: ask a named person to print a batch's container labels (owner, 2026-10-14).
--
-- The label printer is on a USB cable at one computer, not on the network, so the tablet cannot print
-- to it. From a signed batch (FRM-530) the person asks someone at that computer to print the labels;
-- the request lands in that person's notifications ("Asked of you") with a link to a print page for the
-- batch and the number of containers, and closes when they mark the labels printed. It can also be
-- cleared, as other news is - unlike a signature request, nothing is left undone on the record.
--
-- Two SECURITY DEFINER functions, as for signature requests: internal_notifications has no write
-- policy, and the person asking is stamped from auth.uid(), never taken from the client.
--   request_label_print(response, count, person, note) - a new request; an open one for the same
--     batch is closed first as "Asked again", so each ask stays on record as its own row.
--   resolve_label_print(response) - the labels were printed: every open request for the batch closes.
-- Safe to run twice: both are create or replace.

begin;

create or replace function public.request_label_print(
  _response_id uuid, _count int, _assigned_to uuid, _note text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_doc     uuid; v_status text; v_number text; v_data jsonb;
  v_asker   text;
  v_note    text := nullif(btrim(coalesce(_note, '')), '');
  v_product text; v_lot text;
  v_id      uuid;
begin
  if not public.is_staff_or_admin(auth.uid()) then
    raise exception 'Not permitted to ask for labels to be printed.' using errcode = '42501';
  end if;
  select r.document_id, r.status, r.form_number, r.data into v_doc, v_status, v_number, v_data
    from public.sop_document_responses r where r.id = _response_id;
  if v_doc is null then raise exception 'That batch record no longer exists.'; end if;
  if v_number is distinct from 'FRM-530' then raise exception 'Labels are printed for a batch made on site (FRM-530) only.'; end if;
  -- A label always matches a signed record.
  if v_status <> 'submitted' then raise exception 'The batch has to be signed before its labels are printed.'; end if;
  if _count is null or _count < 1 or _count > 20 then raise exception 'The number of labels must be from 1 to 20.'; end if;
  -- They print from their own log-in to the Team Portal, which a team role is what allows.
  -- profiles.access_granted is NOT tested: it gates the client (brand) portal only.
  if not public.is_staff_or_admin(_assigned_to) then
    raise exception 'That person has no Team Portal role, so cannot be asked.';
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), 'A team member') into v_asker
    from public.profiles p where p.id = auth.uid();
  v_asker := coalesce(v_asker, 'A team member');
  v_product := coalesce(nullif(btrim(v_data->>'product'), ''), 'a batch');
  v_lot := coalesce(nullif(btrim(v_data->>'lot_code'), ''), '?');

  -- An earlier request still open for this batch is replaced by this one.
  update public.internal_notifications
     set resolved_at = now(), resolved_reason = 'Asked again'
   where notification_type = 'label_print_requested' and reference_id = _response_id
     and resolved_at is null and dismissed_at is null;

  insert into public.internal_notifications
    (notification_type, reference_table, reference_id, title, message, dedupe_key,
     assigned_to, requested_by, responsible_position, severity, links)
  values
    ('label_print_requested', 'sop_document_responses', _response_id,
     'Print ' || _count || case when _count = 1 then ' label: ' else ' labels: ' end || v_product || ' lot ' || v_lot,
     v_asker || ' has asked you to print the container labels for this batch on the label printer.'
       || coalesce(E'\n\n"' || v_note || '"', ''),
     'labels:' || _response_id::text || ':' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text,
     _assigned_to, auth.uid(), null, 'info',
     jsonb_build_array(jsonb_build_object(
       'label', 'Print the labels',
       'href',  '/team/print/labels/' || _response_id::text || '?count=' || _count || '&from=notifications')))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.request_label_print(uuid, int, uuid, text) from public;
grant execute on function public.request_label_print(uuid, int, uuid, text) to authenticated;

create or replace function public.resolve_label_print(_response_id uuid) returns int
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if not public.is_staff_or_admin(auth.uid()) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  -- resolved_at never carries a name: it says the labels were printed, not who closed the request.
  update public.internal_notifications
     set resolved_at = now(), resolved_reason = 'Printed'
   where notification_type = 'label_print_requested' and reference_id = _response_id
     and resolved_at is null and dismissed_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.resolve_label_print(uuid) from public;
grant execute on function public.resolve_label_print(uuid) to authenticated;

do $verify$
begin
  if not (select prosecdef from pg_proc where oid = 'public.request_label_print(uuid, int, uuid, text)'::regprocedure)
     or not (select prosecdef from pg_proc where oid = 'public.resolve_label_print(uuid)'::regprocedure) then
    raise exception 'The label print functions are not SECURITY DEFINER.';
  end if;
end $verify$;

commit;
