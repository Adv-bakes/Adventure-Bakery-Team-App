-- FSQM-019: rework authority is the SQF Practitioner's. Stays draft. Unblocks FSQM-018.
--
-- THE LAST THING BLOCKING FSQM-018'S ISSUE. This document said "The R&D Manager needs to authorize
-- the rework process"; FSQM-018 gives that authority to the SQF Practitioner. Two documents naming
-- different authorities for the same decision is a document-control problem under SOP-2.2.3 no
-- matter which one is right, and issuing FSQM-018 over a live draft that contradicts it would have
-- created the finding rather than closed it. The site decided on 2026-09-02: the SQF Practitioner.
--
-- BOTH POSTS ARE THE SAME PERSON HERE, which is why this is a vocabulary fix and not a transfer of
-- power. "The quality department" and "Quality Department" become the Quality Team, and the R&D
-- Manager becomes the SQF Practitioner - the six roles FSQM-009, FSQM-012, FSQM-013, FSQM-018 and
-- FSQM-022 already use. Responsibility was EMPTY and now assigns duties to the three roles this
-- procedure needs.
--
-- IT DEFERS TO FSQM-018 RATHER THAN RESTATING IT. FSQM-018 carries the substantive rework rules -
-- like-into-like, the gluten-free bar, formulation, batch-sheet traceability, the biweekly review -
-- because that is where the scanned original put them. Copying them here would let the two drift,
-- which is precisely how the authority conflict arose. A closing paragraph names what lives there
-- and says it is deliberately not repeated, the same pattern FSQM-018 uses toward FSQM-009. The
-- release step now points at FSQM-018's release requirements instead of the original's vague "the
-- same procedure for release, verification and monitoring activities".
--
-- TWO OF THE FOUR STORED LINES WERE NOT STEPS. "Related Links" and "Batch Sheets Rework form" are
-- importer artifacts - a heading and the link under it, read as procedure content. They move to
-- Form References, where a linked record belongs. Four lines in, four lines out, but three of them
-- are now real steps and one is a paragraph.
--
-- STILL DRAFT. Aligning it removes the contradiction; whether this document should exist at all,
-- rather than being withdrawn in favour of FSQM-018's rework section, is a separate decision and
-- blocks nothing. Recorded in its Revision History as an open item, along with "the rework form",
-- which is named in the body and matches no numbered form in the register.
--
-- Writes procedure, responsibility, form_references and revision_history; hashes the rest.

begin;

do $$
declare
  r record;
begin
  select status, revision, type,
         jsonb_array_length(content->'procedure')                              as lines,
         (content->'procedure')::text like '%R&D Manager needs to authorize%'   as old_authority,
         coalesce(content->>'responsibility','')                               as resp,
         (select count(*) from public.sop_documents
           where sop_number in ('FSQM-018','FRM-702','REP-701'))              as refs_exist
    into r
    from public.sop_documents where sop_number = 'FSQM-019';

  if r is null then
    raise exception 'FSQM-019 does not exist.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-019 is % - a content change to an issued document needs a revision bump.', r.status;
  end if;
  if r.revision <> 'New' or r.type <> 'fsqm' then
    raise exception 'FSQM-019 is revision % / type %, not New / fsqm.', r.revision, r.type;
  end if;
  if r.lines <> 4 then
    raise exception 'FSQM-019 has % procedure lines, expected the 4 the importer left.', r.lines;
  end if;
  if not r.old_authority then
    raise exception 'FSQM-019 no longer names the R&D Manager as rework authority - this has run.';
  end if;
  if r.resp <> '' then
    raise exception 'FSQM-019 Responsibility is already populated - re-derive before overwriting it.';
  end if;
  if r.refs_exist <> 3 then
    raise exception 'Only % of FSQM-018, FRM-702 and REP-701 exist to be referenced.', r.refs_exist;
  end if;
end $$;

create temporary table fsqm019_before on commit drop as
select md5((content - 'procedure' - 'responsibility' - 'form_references' - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'FSQM-019';

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       jsonb_set(content, '{procedure}', $j$["Rework is performed under the supervision of the Quality Team. The SQF Practitioner authorises the rework process, and authorises it only where product quality, safety and legality are not compromised — allergen status and ingredient declarations in particular.", "The Quality Team shall record all rework by providing instructions on the batch sheet and/or the rework form. Every batch sheet for reworked product shall be marked \"REWORK\" so that the rework remains traceable.", "Reworked product is released under the release requirements of FSQM-018 Non-Conforming Product and Equipment: inspected or analyzed against the finished product specification before release, authorised by the SQF Practitioner on FRM-702, and listed on REP-701.", "> The detailed rework rules — like-into-like, the bar on reworking certified Gluten Free product segregated for a positive gluten result, the formulation, batch-sheet traceability, and the biweekly review of rework quantities held in the Quarantine area — are set out in FSQM-018 and are not restated here, so the two documents cannot give different answers."]$j$::jsonb),
                       '{responsibility}', $j$"SQF Practitioner — authorises every rework, and only where product quality, safety and legality are not compromised. Authorises the release of reworked product under FSQM-018.\nQuality Team — supervises rework, records it on the batch sheet, and marks the batch sheet \"REWORK\" so the rework remains traceable.\nProduction staff — perform rework only against an authorised instruction on the batch sheet."$j$::jsonb),
                     '{form_references}', $j$"Batch sheets (marked \"REWORK\"); FRM-702 Non-Conforming Material Hold & Tagging Record; REP-701 QA Product & Material Release Log"$j$::jsonb),
                   '{revision_history}', $j$"Rev New — imported 2026-06-17 from a scanned Compass Blending hardcopy through the Word importer. DRAFT. Not approved, not in force.\n\nREWORK AUTHORITY, 2026-09-02. The site decided that rework authority is the SQF Practitioner's. This document said \"The R&D Manager needs to authorize the rework process\", while FSQM-018 Non-Conforming Product and Equipment gives it to the SQF Practitioner. Two documents naming different authorities for the same decision is a document-control problem under SOP-2.2.3 regardless of which is right, and it was the last item blocking FSQM-018's issue. This document now says the SQF Practitioner, and both are the same person here in any case — see the role vocabulary note below.\n\nROLES. \"The quality department\" and \"Quality Department\" become the Quality Team, and the R&D Manager becomes the SQF Practitioner: the six roles FSQM-009, FSQM-012, FSQM-013, FSQM-018 and FSQM-022 use. Responsibility was empty and now assigns duties to the three roles this procedure actually needs. No individual is named — a document that names a person has to be reissued when the person changes.\n\nIT DEFERS TO FSQM-018 RATHER THAN RESTATING IT. FSQM-018 carries the substantive rework rules, because that is where the scanned original put them. Restating them here would let the two drift, which is exactly what the authority conflict was. A closing paragraph names what lives there and says it is deliberately not repeated. The release step likewise points at FSQM-018's release requirements instead of the original's vague \"the same procedure for release, verification and monitoring activities\".\n\nIMPORTER ARTIFACTS REMOVED. Two of the four stored procedure lines were not steps: a \"Related Links\" heading and \"Batch Sheets Rework form\" underneath it, which the importer read as procedure content. Both are now expressed in Form References, where a linked record belongs.\n\nOPEN BEFORE ISSUE:\n\n1. \"The rework form\" is named in the body and has no document number. No FRM in the register is a rework form, so either the batch sheet is the only record — in which case that phrase should go — or a form exists on paper and needs numbering. The body keeps the inherited wording rather than inventing either answer.\n\n2. This document is thin: four steps, no Records, no Governing Reference, no clause reference. It is aligned but not complete, and it is a candidate for withdrawal in favour of FSQM-018's rework section rather than issue. Aligning it removed the contradiction; deciding whether it should exist at all is separate and does not block anything."$j$::jsonb)
 where sop_number = 'FSQM-019' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  untouched boolean;
begin
  select status,
    jsonb_array_length(content->'procedure')                                   as lines,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s not like '• %' and s not like '> %')                             as steps,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '> %')                                                      as prose,
    (content->'procedure')::text like '%The SQF Practitioner authorises the rework process%'
                                                                               as new_authority,
    (content->'procedure')::text like '%R&D%'                                  as rd_left,
    (content->'procedure')::text like '%uality Department%'                    as dept_left,
    (content->'procedure')::text like '%Related Links%'                        as artifact_left,
    (content->'procedure')::text like '%are not restated here%'                as defers,
    (content->'procedure')::text like '%so that the rework remains traceable%' as rework_mark,
    (content->'procedure')::text like '%allergen status and ingredient declarations%'
                                                                               as allergen,
    (content->>'form_references') like '%FRM-702%'                             as formrefs,
    (select count(*) from unnest(array['SQF Practitioner','Quality Team','Production staff']) rn
      where strpos(content->>'responsibility', rn) = 0)                        as roles_missing
  into r
  from public.sop_documents where sop_number = 'FSQM-019';

  select b.h = md5((d.content - 'procedure' - 'responsibility' - 'form_references' - 'revision_history')::text)
    into untouched
    from public.sop_documents d, fsqm019_before b where d.sop_number = 'FSQM-019';

  if r.lines <> 4 or r.steps <> 3 or r.prose <> 1 then
    raise exception 'FSQM-019 body wrong shape: % lines, % steps, % prose (expected 4 / 3 / 1).',
      r.lines, r.steps, r.prose;
  end if;
  if not r.new_authority then
    raise exception 'FSQM-019 does not give rework authority to the SQF Practitioner.';
  end if;
  if r.rd_left or r.dept_left or r.artifact_left then
    raise exception 'Old vocabulary or importer artifact survives: R&D=%, Quality Department=%, Related Links=%.',
      r.rd_left, r.dept_left, r.artifact_left;
  end if;
  if not (r.defers and r.rework_mark and r.allergen and r.formrefs) then
    raise exception 'FSQM-019 incomplete: defers to FSQM-018=%, REWORK marking=%, allergen wording=%, form refs=%.',
      r.defers, r.rework_mark, r.allergen, r.formrefs;
  end if;
  if r.roles_missing <> 0 then
    raise exception '% of the three roles have no duties in Responsibility.', r.roles_missing;
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-019 is now % - this migration must not issue it.', r.status;
  end if;
  if not untouched then
    raise exception 'A section other than the four written changed on FSQM-019. Rolled back.';
  end if;
end $$;

commit;
