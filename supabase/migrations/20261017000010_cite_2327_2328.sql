-- Two clauses whose rule is already stated in an issued program now cited by it (owner, 2026-10-17,
-- from the FSMS Index, where both showed "No program"):
--   2.3.2.7 labels accurate, legal and approved: SOP-2.3.2.3 Label Control (and FRM-601, its record);
--   2.3.2.8 contract service descriptions: SOP-2.3.4 Vendor Approval v4, whose procedure already sends
--           contract service providers to FRM-206 "as SQF 2.3.2.8 requires".
-- sqf_reference only: no wording change, no revision, no history snapshot. Safe to run twice.

do $$
declare
  r record;
  cur text;
begin
  for r in select * from (values
      ('SOP-2.3.2.3', '2.3.2.3, 2.3.2.5, 2.6.1.1, 2.8.1.1, 2.8.1.8, 2.7.1.1, 2.4.7.1', '2.3.2.7'),
      ('FRM-601',     '2.3.2.3, 2.6.1.1, 2.3.1.6',                                     '2.3.2.7'),
      ('SOP-2.3.4',   '2.3.4',                                                          '2.3.2.8')) as v(num, ref_old, add)
  loop
    select sqf_reference into cur from public.sop_documents where sop_number = r.num and status = 'active';
    if not found then raise exception '% has no active document.', r.num; end if;
    if cur = r.ref_old || ', ' || r.add then
      raise notice '%: already cites %, left alone', r.num, r.add;
    elsif cur is distinct from r.ref_old then
      raise exception '% has an SQF reference this migration was not written against: %', r.num, cur;
    else
      update public.sop_documents set sqf_reference = r.ref_old || ', ' || r.add
       where sop_number = r.num and status = 'active';
    end if;
  end loop;
end $$;
