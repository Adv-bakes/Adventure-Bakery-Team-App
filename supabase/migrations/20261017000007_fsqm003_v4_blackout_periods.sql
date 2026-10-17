-- FSQM-003 Management Responsibilities and Quality Objectives, v3 -> v4: blackout periods
-- (SQF 2.1.1.8) are stated, and 2.1.1.8 is cited.
--
-- Owner's request, 2026-10-17, from the FSMS Index: 2.1.1.8 showed "No program" because only the
-- record (FRM-006) and training cited it. The rule was written only inside FRM-006's own help text.
-- A "Blackout Periods" part is added before the objectives; nothing else changes. It keeps
-- FRM-006's distinction: operating days are a pattern, not blackout dates.
--
-- Approved by GJM, effective 2026-10-17.
--
-- Safe to run twice: at v4 as intended nothing is updated. Any other shape stops the migration.

do $$
declare
  d record;
  n int;
  anchor constant text := $t$

Food Safety and Quality Objectives
$t$;
  block constant text := $t$

Blackout Periods

Senior Site Management designates the site's blackout periods on FRM-006 Blackout Period Declaration: the defined date ranges when an unannounced re-certification audit should not take place because the site is closed or out of season for legitimate business reasons, each with its business reason. One entry covers one period. The site's normal operating days are recorded on the same entry as its operating pattern, and are not claimed as blackout dates.

The submitted declaration is sent to the certification body at least one month before the sixty-day window for the unannounced re-certification audit opens. Until a certification body is appointed, it is kept on file. A new declaration is made before the period in force ends, and whenever the operating pattern changes.$t$;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-003' and status = 'active';
  if n <> 1 then raise exception 'FSQM-003: expected one active document, found %', n; end if;
  select * into d from public.sop_documents where sop_number = 'FSQM-003' and status = 'active';

  if d.revision = 'v4' and strpos(d.content->>'statement', block) > 0 and d.sqf_reference = '2.1.1.4, 2.1.1.5, 2.1.1.8' then
    raise notice 'FSQM-003: already at v4 as intended, left alone';
    return;
  end if;
  if d.revision <> 'v3' or d.sqf_reference is distinct from '2.1.1.4, 2.1.1.5'
     or (length(d.content->>'statement') - length(replace(d.content->>'statement', anchor, ''))) <> length(anchor)
     or d.content->>'statement' ilike '%blackout%' then
    raise exception 'FSQM-003 is not the document this migration was written against (rev %, ref %)', d.revision, d.sqf_reference;
  end if;

  update public.sop_documents
     set content = jsonb_set(content, '{statement}', to_jsonb(replace(content->>'statement', anchor, block || anchor))),
         revision = 'v4', effective_date = date '2026-10-17', approved_by = 'GJM',
         sqf_reference = '2.1.1.4, 2.1.1.5, 2.1.1.8'
   where id = d.id;

  if strpos((select content->>'statement' from public.sop_documents where id = d.id), chr(13)) > 0 then
    raise exception 'a carriage return was written';
  end if;
end $$;
