-- FSQM-016 (DRAFT): the flow diagram is confirmed and signed ONCE, not every day.
--
-- Owner, 2026-10-07: "on each day of the rotation" read as if the confirmation block had to be signed
-- daily. It means one confirmation that covers all three days. When it is confirmed again is already
-- the next line (a change to the process, equipment or rotation, and the annual review).
-- One procedure line reworded. ONE UPDATE.

begin;

do $guard$
declare d record;
begin
  select status, md5(content::text) as cmd5, content->'procedure'->>22 as l into d from public.sop_documents where sop_number = 'FSQM-016';
  if d.status is distinct from 'draft' or d.cmd5 <> '856a738016765193d78dbc2df01b1ab8' then
    raise exception 'FSQM-016 is not the draft this migration expects (%).', d.cmd5;
  end if;
  if d.l <> $t$• The food safety team confirms it on the floor, on each day of the rotation, and records that by dating and signing the confirmation block on the diagram. That signed block is the confirmation SQF 2.4.3.6 requires.$t$ then raise exception 'the flow confirmation line is not where this migration expects it.'; end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(content, '{procedure,22}', to_jsonb($t$• The food safety team confirms it once, by walking the floor on all three days of the rotation so that every step is seen as it is performed, and then dates and signs the confirmation block on the diagram one time. That signed block is the confirmation SQF 2.4.3.6 requires. It is not signed daily.$t$::text))
 where sop_number = 'FSQM-016' and status = 'draft';

do $verify$
declare d record;
begin
  select status, revision, content->'procedure' as p into d from public.sop_documents where sop_number = 'FSQM-016';
  if d.status <> 'draft' or d.revision <> 'New' or jsonb_array_length(d.p) <> 146 then raise exception 'FSQM-016 changed more than one line.'; end if;
  if d.p->>22 not like '%confirms it once%' or d.p::text like '%on each day of the rotation%' then
    raise exception 'the line was not reworded.';
  end if;
end $verify$;

commit;
