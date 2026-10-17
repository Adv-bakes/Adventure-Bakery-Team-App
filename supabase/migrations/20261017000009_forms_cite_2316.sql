-- The six forms SOP-2.3.1 v3 names as the records of SQF 2.3.1.6 now cite that clause (owner,
-- 2026-10-17), so the FSMS Index lists them under Records for 2.3.1.6 and not only the SOP.
--
-- sqf_reference only: no wording changes, no revision, and it is not a watched field, so no
-- history snapshot. Each form is guarded on its reference as read on 2026-10-17. Safe to run twice.

do $$
declare
  r record;
  cur text;
begin
  for r in select * from (values
      ('FRM-101', '2.3.1.1, 2.4.1.1'),
      ('FRM-102', '2.3.2.5'),
      ('FRM-501', '2.3.1.2'),
      ('FRM-502', '2.3.1.2, 2.4.4.5'),
      ('FRM-601', '2.3.2.3, 2.6.1.1'),
      ('FRM-704', '2.3.2.9')) as v(num, ref_old)
  loop
    select sqf_reference into cur from public.sop_documents where sop_number = r.num and status = 'active';
    if not found then raise exception '% has no active document.', r.num; end if;
    if cur = r.ref_old || ', 2.3.1.6' then
      raise notice '%: already cites 2.3.1.6, left alone', r.num;
    elsif cur is distinct from r.ref_old then
      raise exception '% has an SQF reference this migration was not written against: %', r.num, cur;
    else
      update public.sop_documents set sqf_reference = r.ref_old || ', 2.3.1.6'
       where sop_number = r.num and status = 'active';
    end if;
  end loop;
end $$;
