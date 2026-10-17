-- FSQM-003 cites 2.1.1.4 (owner, 2026-10-17).
--
-- FSQM-003 already states the rule 2.1.1.4 asks for: "The primary and substitute SQF Practitioner
-- are designated by Senior Site Management, and the designation is recorded on FRM-005". Its SQF
-- reference was blank, so the FSMS Index showed 2.1.1.4 as "No program" (only FRM-005 and training
-- cited it). FSQM-004 leaves 2.1.1.4 and 2.1.1.5 to be recorded separately on purpose.
--
-- 2.1.1.5 is NOT added: FSQM-003 does not state the practitioner's five requirements yet. That
-- waits for a revision of FSQM-003.
--
-- No wording changes, so no revision. sqf_reference is not a watched field, so no history snapshot.
-- Safe to run twice.

do $$
declare
  d record;
  n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-003' and status = 'active';
  if n <> 1 then raise exception 'FSQM-003: expected one active document, found %', n; end if;
  select * into d from public.sop_documents where sop_number = 'FSQM-003' and status = 'active';
  if d.content::text not like '%designated by Senior Site Management, and the designation is recorded on FRM-005%' then
    raise exception 'FSQM-003 no longer states how the SQF Practitioner is designated';
  end if;
  if d.sqf_reference = '2.1.1.4' then
    raise notice 'FSQM-003: already cites 2.1.1.4, left alone';
  elsif d.sqf_reference is not null then
    raise exception 'FSQM-003 has an SQF reference this migration was not written against: %', d.sqf_reference;
  else
    update public.sop_documents set sqf_reference = '2.1.1.4' where id = d.id;
  end if;
end $$;
