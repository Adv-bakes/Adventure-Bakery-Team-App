-- FSQM-003 Management Responsibilities and Quality Objectives, v2 -> v3: the SQF Practitioner's
-- requirements (SQF 2.1.1.5) are stated, and 2.1.1.5 is cited.
--
-- Owner's request, 2026-10-17, from the FSMS Index: 2.1.1.5 showed "No program" because no program
-- stated what the primary and substitute SQF Practitioner must be. FRM-005 already checks each of
-- the five requirements; this states the rule it checks against. Also said: primary and substitute
-- are two different people (the substitute covers the primary's absence), and either may hold
-- other positions, as FSQM-004 already allows.
--
-- One paragraph of the statement is extended; nothing else changes. FSQM-003 is a policy and keeps
-- no revision history in its content, as at v2.
--
-- Approved by GJM, effective 2026-10-17.
--
-- Safe to run twice: at v3 as intended nothing is updated. Any other shape stops the migration.

do $$
declare
  d record;
  n int;
  old_t constant text := $t$The primary and substitute SQF Practitioner are designated by Senior Site Management, and the designation is recorded on FRM-005 SQF Practitioner Designation Record. The SQF Practitioner is responsible$t$;
  new_t constant text := $t$The primary and substitute SQF Practitioner are designated by Senior Site Management, and the designation is recorded on FRM-005 SQF Practitioner Designation Record. They are two different people, because the substitute covers the primary's absence; either may also hold other positions (FSQM-004).

Each of them shall:

• Be employed by the site.

• Hold a position of responsibility related to the management of the site's SQF System.

• Have completed a HACCP training course.

• Be competent to implement and maintain HACCP-based food safety plans.

• Understand the SQF Food Safety Code: Food Manufacturing and what is needed to implement and maintain an SQF System for the site's scope of certification.

FRM-005 records how each holder meets each of these. The HACCP training certificate and the evidence of competency are kept on FRM-952 under SOP-2.9. A person who does not meet all five is not designated, and a new FRM-005 entry is made whenever either holder changes.

The SQF Practitioner is responsible$t$;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-003' and status = 'active';
  if n <> 1 then raise exception 'FSQM-003: expected one active document, found %', n; end if;
  select * into d from public.sop_documents where sop_number = 'FSQM-003' and status = 'active';

  if d.revision = 'v3' and strpos(d.content->>'statement', new_t) > 0 and d.sqf_reference = '2.1.1.4, 2.1.1.5' then
    raise notice 'FSQM-003: already at v3 as intended, left alone';
    return;
  end if;
  if d.revision <> 'v2' or d.sqf_reference is distinct from '2.1.1.4'
     or (length(d.content->>'statement') - length(replace(d.content->>'statement', old_t, ''))) <> length(old_t) then
    raise exception 'FSQM-003 is not the document this migration was written against (rev %, ref %)', d.revision, d.sqf_reference;
  end if;

  update public.sop_documents
     set content = jsonb_set(content, '{statement}', to_jsonb(replace(content->>'statement', old_t, new_t))),
         revision = 'v3', effective_date = date '2026-10-17', approved_by = 'GJM',
         sqf_reference = '2.1.1.4, 2.1.1.5'
   where id = d.id;

  if strpos((select content->>'statement' from public.sop_documents where id = d.id), chr(13)) > 0 then
    raise exception 'a carriage return was written';
  end if;
end $$;
