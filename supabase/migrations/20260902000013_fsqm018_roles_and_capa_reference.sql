-- FSQM-018: real roles, and corrective action deferred to FSQM-009 rather than restated.
--
-- 20260902000011 made this document print. It did not make it followable. The body named ELEVEN
-- actors - QC personnel, Quality personnel, Quality Technicians, Quality Leader, Quality
-- Management, Plant Manager, Production associate, Warehouse personnel, R&D, the Customer Services
-- and Sales Supply specialist, and "the appropriate functional area manager" - which is a Compass
-- Blending organisation chart. None of those posts exists here, so no responsibility in this
-- document was assigned to anybody, and SQF 2.4.5.1 makes responsibility a limb of the clause:
-- "The responsibility and methods outlining how to handle non-conforming product ... shall be
-- documented and implemented."
--
-- THE SIX ROLES ARE NOT NEW. SQF Practitioner, Quality Team, Management team, Production staff,
-- Admin and All staff are what FSQM-009, FSQM-012, FSQM-013 and FSQM-022 already use. No individual
-- is named, in this document or in those: a document that names a person has to be reissued when
-- the person changes. The site confirmed on 2026-09-02 that the SQF Practitioner and R&D are the
-- same person, which is what collapses the third rewrite below.
--
-- THREE STEPS DID NOT SURVIVE THE SUBSTITUTION, and that is why this is a rewrite and not a
-- find-and-replace. Each described a hand-off between two posts that turn out to be one person.
--
--   the four-party notification   became an instruction to notify oneself. It is now one sentence:
--                                 raise FRM-702, notify the SQF Practitioner and the Management
--                                 team. The four-name list is deleted.
--   "the Plant Manager AND        was one person written as two agreeing. It is the SQF
--    Quality Leader shall          Practitioner alone. A quorum of one is not a control, and
--    determine final disposition"  writing it as one invites an auditor to test a separation of
--                                 duties that does not exist.
--   R&D determines the formula,   both are the same person. Merged into one bullet that keeps what
--   R&D communicates it to the    2.4.6.1 requires - a qualified person determines the formulation,
--   Plant Manager                 the material and formulation are identified in the batch sheet
--                                 and traceable - and drops only the hand-off.
--
-- CORRECTIVE ACTION DEFERS TO FSQM-009 INSTEAD OF RESTATING IT, and the two had already diverged on
-- both things that matter. This document said root cause analyses happen "at Management discretion"
-- on four criteria; FSQM-009 Part 3 lists ten triggers and non-conforming product is one of them,
-- so as written this document permitted skipping an investigation FSQM-009 requires - and an
-- auditor holding both would fairly take the weaker rule as the site's practice. It also gave
-- verification of effectiveness to the Plant Manager and Quality Leader, where FSQM-009 gives it to
-- the Practitioner or someone independent of the action owner. Four steps become one step plus one
-- paragraph pointing at FSQM-009 and FRM-007. The four discretion criteria are deleted outright.
--
-- THE HOLD DOES NOT WAIT ON THE CAPA. FSQM-009 Part 8 cannot close a CAPA until the disposition of
-- affected product is resolved. Requiring the hold to stay open until its CAPA closes would deadlock
-- the two documents against each other, so the closing step says the hold closes on final
-- disposition and the CAPA continues separately. That sentence is the reason to read this migration
-- rather than skim it: the deadlock is invisible unless both documents are read together.
--
-- The CAPA number is written back onto FRM-702, which gained an Associated CAPA Number field in
-- 20260902000012 - that migration must run first, and the guard below does not enforce it because a
-- procedure requiring a field is not broken by the field arriving in the same push.
--
-- STILL DRAFT, STILL NO REVISION BUMP. Never issued, nothing to supersede. The remaining OPEN
-- BEFORE ISSUE items are down to two: the empty Records / Governing Reference / clause reference,
-- and the Positive Release Procedure that does not exist alongside the FSQM-019 rework overlap.
--
-- Writes procedure, responsibility, form_references and revision_history. The DO block hashes
-- everything else before and after, so purpose, scope, definitions and attachments are provably
-- untouched.

begin;

do $$
declare
  r record;
begin
  select status, revision, type,
         jsonb_array_length(content->'procedure')                                     as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%Hold Action Report%')                                       as legacy_name,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%Quality personnel%' or s like '%Plant Manager%')            as compass_posts,
         (content->'procedure')::text like '%FSQM-009%'                               as already_done
    into r
    from public.sop_documents where sop_number = 'FSQM-018';

  if r is null then
    raise exception 'FSQM-018 does not exist.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-018 is % - it has been issued, so a content change needs a revision bump. Stop and re-derive.',
      r.status;
  end if;
  if r.revision <> 'New' or r.type <> 'fsqm' then
    raise exception 'FSQM-018 is revision % / type %, not New / fsqm.', r.revision, r.type;
  end if;
  -- the body must be the one 20260902000011 left behind
  if r.lines <> 37 then
    raise exception 'FSQM-018 has % procedure lines, expected the 37 left by 20260902000011. Run that first.',
      r.lines;
  end if;
  if r.legacy_name <> 0 then
    raise exception 'FSQM-018 still says "Hold Action Report" - 20260902000011 has not run.';
  end if;
  if r.already_done then
    raise exception 'FSQM-018 already references FSQM-009 - this migration has run, or the body has moved on.';
  end if;
  if r.compass_posts = 0 then
    raise exception 'FSQM-018 no longer names the Compass posts this migration replaces.';
  end if;
end $$;

create temporary table fsqm018_roles_before on commit drop as
select md5((content - 'procedure' - 'responsibility' - 'form_references' - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'FSQM-018';

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       jsonb_set(content, '{procedure}', $j$["Upon completion of inspection and/or testing of raw material, work in progress, finished product samples, and equipment, the Quality Team shall determine the disposition of the product inspected or tested.", "Investigation of suspected non-conforming product can be initiated due to raw materials, intermediate materials, finished products, or equipment found to be non-compliant during receiving, storage, production, QC testing, shipping or routine food safety inspections.", "> Observation of product defect, damage or shelf life, QC result deviations, or customer complaints may lead to the disposition of a product as non-compliant.", "Upon identification of non-compliant raw material, work in progress material, finished product, or packaging material that can affect the quality, food safety or legality of a food product, any employee shall immediately notify the SQF Practitioner in order to place questionable material on Hold.", "• For certified Gluten Free products, and for ingredients used in certified Gluten Free products, confirmation of a positive gluten result (>10 ppm) shall be followed by the hold, notification and segregation steps set out below, to ensure proper segregation of affected product.", "• The SQF Practitioner shall notify GFCO at testing@gluten.org.", "Upon receipt of a customer complaint, the Quality Team shall establish with Admin the location of all remaining inventory of the suspected lot, and shall place suspect inventory on Hold.", "When the Quality Team is notified of suspected non-conforming material, or is working with a QC result that deviates from specifications, the questionable lot or batch shall be placed on Hold for investigation. For finished products, Product Sample Analysis records shall be reviewed for accuracy, completeness, and compliance.", "If a suspected material is found to be expired, damaged, or shows signs of contamination or infestation, the Quality Team shall place the lot on Hold upon notification.", "The Quality Team shall raise a Non-Conforming Material Hold & Tagging Record (FRM-702) immediately and notify the SQF Practitioner and the Management team of the incident.", "The Quality Team shall also label the Hold product or equipment with a hold tag and record the tag number, the material status and the segregated storage location on FRM-702.", "Production staff shall physically segregate the Hold product or equipment into the Quarantine area immediately to prevent accidental usage or shipping.", "Admin shall complete the necessary transactions in the inventory system immediately.", "The Quality Team may determine a new sampling plan for further investigation of the product or equipment.", "Test and inspection results shall be provided to the SQF Practitioner for completion of the investigation, as applicable.", "A Corrective and Preventive Action shall be raised under FSQM-009 Corrective and Preventive Action (CAPA) Program and recorded on FRM-007. The CAPA number shall be recorded on FRM-702 so that the hold and its investigation are traceable to each other.", "> FSQM-009 Part 3 states when a CAPA is required, and non-conforming product is one of its triggers, so that decision is not taken again here. The investigation reviews the raw material records, batch sheets, lab records and any other documentation associated with the questionable lot. Root cause, the corrective and preventive actions with their owners and due dates, verification of effectiveness, closure and record retention are all governed by FSQM-009 and recorded on FRM-007. This procedure does not restate them, so the two documents cannot give different answers.", "The SQF Practitioner shall determine the final disposition of the product or equipment.", "The Quality Team shall complete the Final Disposition and Release Authorization section of FRM-702, and the Management team shall be notified of the final disposition.", "If the disposition is disposal, Admin shall discard the held product or equipment and complete the necessary inventory transactions.", "If the SQF Practitioner determines that the product or equipment may be safe to rework, the product records and samples shall first be examined for food safety risks (micro, age, damage, etc.) before the rework decision is made.", "• All finished product rework shall be performed on a \"like into like\" basis. Certified Gluten Free products that are segregated due to gluten results >10 ppm shall not be reworked into other certified Gluten Free products.", "• The SQF Practitioner shall determine the rework formulation, with careful consideration to product specifications, functionality and potential impact on product performance. The rework material and the formulation used shall be clearly identified in the batch sheet and traceable.", "• Rework quantities in the Quarantine Area shall be reviewed every two weeks at a minimum by the Quality Team to ensure rework inventory is maintained at a minimum level. Review shall consider manufacturing dates and product age, possible packaging damage, infestation, microbial risk and other food safety concerns. Some products may need to be retested to determine an appropriate rework formulation, if necessary.", "• Reworked material shall be inspected or analyzed as needed according to the finished product specifications. Its final disposition shall be determined as established by the Positive Release Procedure.", "The hold is closed when the final disposition is complete and recorded on FRM-702. A CAPA raised from the hold remains open under FSQM-009 until its actions are verified effective; the two are tracked separately, because FSQM-009 requires the disposition of affected product to be resolved before a CAPA can be closed.", "Hold inventory in the Quarantine warehouse shall be reviewed biweekly by the Quality Team to ensure rework materials are processed in a timely manner as permitted by product demand."]$j$::jsonb),
                       '{responsibility}', $j$"SQF Practitioner — owns this procedure. Decides what is placed on Hold, determines the final disposition of held product and equipment, determines rework formulations, and confirms reworked material meets the finished product specification before release. Raises and owns any CAPA arising, under FSQM-009.\nQuality Team — places suspect material on Hold, raises and completes FRM-702, applies the hold tag, sets any additional sampling, and reviews held and rework inventory biweekly.\nAll staff — report suspected non-conforming material to the SQF Practitioner immediately. No employee is disadvantaged for raising one.\nProduction staff — segregate held product and equipment into the Quarantine area on notification, and store it so that it cannot be used or shipped.\nManagement team — is notified of every hold and of its final disposition, and is responsible for the resources needed to hold, rework or dispose of material.\nAdmin — completes the inventory transactions for held, reworked and scrapped material, discards material on a disposal disposition, and locates the remaining inventory of a suspect lot on request."$j$::jsonb),
                     '{form_references}', $j$"FRM-702 Non-Conforming Material Hold & Tagging Record; FRM-007 Corrective and Preventive Action (CAPA) Report"$j$::jsonb),
                   '{revision_history}', $j$"Rev New — imported 2026-06-17 from a scanned hardcopy of the Compass Blending original through the Word importer. DRAFT. Not approved, not in force, and not yet reconciled with the programs issued around it.\n\nFORMATTING AND OCR REPAIR, 2026-09-02. Presentation only. The stored body was raw importer output and did not print: it was 41 lines carrying the source document's own numbering, which the renderer numbered a second time on top. No requirement was added, removed or reworded in that pass, with the two exceptions recorded under RECONSTRUCTIONS below. What changed:\n\n• The source numbering was removed from every step. The rendered list owns the numbering now, which is how every other document here is stored. Nothing else in the body cites a step number, so nothing was left pointing at an old one.\n\n• The document was flattened to one level. The renderer has exactly two: a numbered step, and a list item or paragraph beneath it. The source ran three deep (2, 2.1, 2.1.1), so the sub-steps of the hold triggers and of the rework rules were promoted to steps and to bullets respectively. The reading order is unchanged; only the depth is.\n\n• Three steps had been split across a scan page break and were rejoined: \"...finished product / samples, and equipment\", the gluten-free segregation step, and \"...gluten results / >10ppm shall not be reworked\".\n\n• Two steps had been merged into one line, which also carried a stray OCR character (\"n 6.4 ... 6.5 ...\"). They are two steps again — labelling the Hold product, and segregating it into Quarantine — and the stray character is gone.\n\n• The running header \"NON-CONFORMING PRODUCT\" appeared twice in the middle of the body as though it were a step. Both were removed.\n\n• The four Root Cause Analysis criteria (Food Safety risk, product quality impact, service impact, cost) were unmarked and so printed as four numbered steps. They were marked as the list they are; they have since been removed altogether — see CORRECTIVE ACTION below.\n\nTHE HOLD RECORD IS NAMED. Linked Form read \"Form-0021 Quality Hold Report\", a Compass Blending number that does not exist in this register, and the body called that record a \"Hold Action Report\" in three steps. Both now name FRM-702 Non-Conforming Material Hold & Tagging Record, which is active. This is not a find-and-replace on a similar-sounding title: FRM-702's three sections are the three moments this procedure describes. Section 1 Initial Hold Identification raises the hold and carries the hold tag number, the material status and the segregated storage location, which is what the \"issue a report\" and \"label with a tag\" steps do. Section 3 Final Disposition and Release Authorization carries the disposition decision, its justification, a verification check and an authorising signature, which is what the \"revise the report\" step does. The three steps now say which section they complete.\n\nOne limitation of that mapping, which is a question about the form rather than about this procedure: FRM-702 Section 1 is written around material received from a supplier — Supplier Name, P.O. Number, Supplier Lot / Batch Number. This procedure also covers work in progress and finished product, where those fields have no answer. They are not marked required, so an internal hold can be recorded today with them left blank, but the form should be reviewed against the wider scope before this document is issued.\n\nROLES, 2026-09-02. This changes who does what. It is not a formatting pass.\n\nThe body named eleven actors: QC personnel, Quality personnel, Quality Technicians, Quality Leader, Quality Management, Plant Manager, Production associate, Warehouse personnel, R&D, the Customer Services and Sales Supply specialist, and \"the appropriate functional area manager\". That is a Compass Blending organisation chart. None of those posts exists here, so no responsibility in this document was assigned to anybody. They are replaced by the six roles the issued programs already use — SQF Practitioner, Quality Team, Management team, Production staff, Admin and All staff — so that FSQM-009, FSQM-012, FSQM-013, FSQM-022 and this document describe one organisation rather than two. As in those documents, no individual is named: a document that names a person has to be reissued when the person changes.\n\n• QC personnel, Quality personnel and Quality Technicians become the Quality Team.\n• Quality Leader and Quality Management become the SQF Practitioner.\n• Plant Manager, and the bare \"Management\", become the Management team.\n• The Production associate becomes All staff, matching FSQM-009, which already says any employee may raise a non-conformance and must report it immediately.\n• Warehouse personnel become Production staff. There is no separate warehouse function.\n• The Customer Services and Sales Supply specialist becomes Admin.\n• \"The appropriate functional area manager\" becomes the SQF Practitioner, which is what FSQM-009 Part 5 already says.\n• R&D becomes the SQF Practitioner. The site confirmed on 2026-09-02 that the SQF Practitioner and R&D are the same person.\n\nTHREE STEPS DID NOT SURVIVE THE SUBSTITUTION, and rewriting them is why this was not done as a find-and-replace. Each described a hand-off between two posts that turn out to be one person, and a step nobody can evidence is worse than no step at all.\n\n• Step 7 required the incident to be communicated to four named parties. After substitution that list is the SQF Practitioner and the Management team, and it read as an instruction to notify oneself. It is now one sentence — raise FRM-702, notify the SQF Practitioner and the Management team — and the four-name list is deleted.\n\n• Final disposition was given to \"the Plant Manager and Quality Leader\", written as two posts agreeing. It is the SQF Practitioner alone. A quorum of one is not a control, and writing it as though it were invites an auditor to test a separation of duties that does not exist.\n\n• The rework formulation was determined by R&D and then communicated by R&D to the Plant Manager. Both are the same person. The two steps are merged into one, which keeps what SQF 2.4.6.1 actually requires — a qualified person determines the formulation, and the material and formulation are identified in the batch sheet and traceable — and drops only the hand-off.\n\nCORRECTIVE ACTION NOW DEFERS TO FSQM-009 INSTEAD OF RESTATING IT. Four steps covered root cause analysis, when an analysis is done, records, and verification of effectiveness. FSQM-009 Corrective and Preventive Action (CAPA) Program was issued on 2026-09-02 and governs all four, and the two documents had already diverged on both of the things that matter:\n\n• This procedure said root cause analyses are conducted \"at Management discretion\" based on food safety risk, product quality impact, service impact and cost. FSQM-009 Part 3 lists ten triggers and non-conforming product is one of them. As written, this document permitted skipping an investigation that FSQM-009 requires, and an auditor holding both would fairly take the weaker rule as the site's practice. The four discretion criteria are removed; when a CAPA is raised is FSQM-009's decision, in one place.\n\n• This procedure gave verification of effectiveness to the Plant Manager and Quality Leader. FSQM-009 gives it to the SQF Practitioner, or to someone independent of the action owner. There is now one answer, in one document.\n\nThe investigation steps are replaced by a reference: a CAPA is raised under FSQM-009, recorded on FRM-007, and its number is written onto FRM-702 so the hold and the investigation are traceable to each other. FRM-702 had nowhere to hold that number — Section 2 offered only an Associated SCAR Number, which a CAPA is not — so it gains an Associated CAPA Number field in migration 20260902000012, taken now while it still has zero entries. This is the gap FRM-908's car_ref had and the fix FRM-913 received in the same wave.\n\nTHE HOLD DOES NOT WAIT ON THE CAPA. FSQM-009 Part 8 cannot close a CAPA until the disposition of affected product is resolved. Requiring the hold to stay open until its CAPA closes would deadlock the two documents against each other, so the closing step says plainly that the hold closes on final disposition and the CAPA continues separately under FSQM-009.\n\nThe body is 27 lines: 19 steps, 6 list items and 2 paragraphs.\n\nRECONSTRUCTIONS — two places where the scan was not legible and the text was repaired rather than transcribed. Both need confirming before this document is issued:\n\n1. The GFCO notification address read \"testing(4Iuten.org\", which is not an address. It is written as testing@gluten.org. Confirm against GFCO's current certification correspondence before issue.\n\n2. The cross-reference \"steps described in sections 6.3 thru 6.11\" pointed at the source document's numbering, which no longer exists anywhere in this document. It reads \"the hold, notification and segregation steps set out below\". If a specific range was meant, restore it against the paper original.\n\nOne further wording change: step 1 read \"Quality personnel shall dispose of the product inspected/tested\", which on its face directs that everything inspected be thrown away. Read in context it means a disposition decision, and it is written as \"shall determine the disposition of\". Confirm this is what the original intended.\n\nOPEN BEFORE ISSUE — content questions still unanswered, because they are decisions about what the document should say rather than about what it already says:\n\n1. Records, Governing Reference and the SQF clause reference are all empty. The clauses are not in doubt: Quality Code 2.4.5 Non-conforming Product or Equipment and 2.4.6 Product Rework; Food Manufacturing 2.4.5.1, 2.4.5.2 and 11.1.7.9, the last covering non-conforming equipment specifically, which this document's title claims. Two of those require records to be maintained, and the body requires records without saying which or for how long. Records should name FRM-702, FRM-007 and REP-701, with the retention period FSQM-009 already sets.\n\n2. \"Positive Release Procedure\" is named as the authority for the final disposition of reworked material, and it does not exist — the phrase appears in no other document. Product Release is Mandatory in the Food Manufacturing code (2.4.7), and Quality Code 2.4.7.1 requires a documented positive product release procedure, so this is a real gap rather than a renamed document; REP-701 QA Product & Material Release Log is a log, not a procedure. Separately, FSQM-019 Rework Procedure is a four-line draft while the substantive rework rules sit in this document, and the two name different authorities for authorising rework. Whether rework lives here or in FSQM-019 needs settling before either is issued.\n\nUNTIL THIS DOCUMENT IS ISSUED it is not in force, whatever it now says. FRM-702 is active and is the record actually in use for holding and tagging non-conforming material, and FSQM-009 governs the corrective action that follows. That is the position FSQM-009's own Scope states, and naming FRM-702 here does not change it."$j$::jsonb)
 where sop_number = 'FSQM-018' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  untouched boolean;
begin
  select
    jsonb_array_length(content->'procedure')                                          as lines,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s not like '• %' and s not like '> %')                                    as steps,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '• %')                                                             as bullets,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '> %')                                                             as prose,
    (select coalesce(max(length(s)), 0) from jsonb_array_elements_text(content->'procedure') s)
                                                                                      as longest,
    -- not one Compass post may survive, in the body OR in Responsibility
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '%QC personnel%' or s like '%Quality personnel%'
         or s like '%Quality Technicians%' or s like '%Quality Leader%'
         or s like '%Quality Management%' or s like '%Plant Manager%'
         or s like '%Production associate%' or s like '%Warehouse personnel%'
         or s like '%Customer Services and Sales Supply%'
         or s like '%functional area manager%' or s ~ '\mR&D\M')                      as compass_body,
    (case when (content->>'responsibility') ~ 'QC personnel|Quality personnel|Quality Technicians|Quality Leader|Quality Management|Plant Manager|Production associate|Warehouse personnel|Customer Services and Sales Supply|functional area manager|\mR&D\M'
          then 1 else 0 end)                                                          as compass_resp,
    -- and every one of the six roles must be assigned duties
    (select count(*) from unnest(array['SQF Practitioner','Quality Team','Management team',
                                       'Production staff','Admin','All staff']) as rname
      where strpos(content->>'responsibility', rname) = 0)                            as roles_missing,
    -- corrective action defers to FSQM-009 and is not restated
    (content->'procedure')::text like '%FSQM-009%'                                    as refs_program,
    (content->'procedure')::text like '%FRM-007%'                                     as refs_record,
    (content->'procedure')::text like '%at Management discretion%'                    as restates_trigger,
    (content->'procedure')::text like '%verify effectiveness of the corrective%'      as restates_verify,
    -- the deadlock sentence, which is the whole reason the two documents can coexist
    (content->'procedure')::text like '%before a CAPA can be closed%'                 as deadlock_note,
    -- requirements that had to survive
    (content->'procedure')::text like '%Quarantine area immediately to prevent accidental usage%'
                                                                                      as segregate,
    (content->'procedure')::text like '%like into like%'                              as like_into_like,
    (content->'procedure')::text like '%shall not be reworked into other certified Gluten Free products%'
                                                                                      as gf_rework,
    (content->'procedure')::text like '%clearly identified in the batch sheet and traceable%'
                                                                                      as traceable,
    (content->'procedure')::text like '%Positive Release Procedure%'                  as positive_release,
    (content->'procedure')::text like '%testing@gluten.org%'                          as gfco,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '%FRM-702%')                                                       as frm702_steps,
    -- no individual may be named
    (content::text like '%Gabriela%' or (content->'procedure')::text like '%GJM%')     as names_person,
    status                                                                            as status
  into r
  from public.sop_documents where sop_number = 'FSQM-018';

  select b.h = md5((d.content - 'procedure' - 'responsibility' - 'form_references' - 'revision_history')::text)
    into untouched
    from public.sop_documents d, fsqm018_roles_before b where d.sop_number = 'FSQM-018';

  if r.lines <> 27 or r.steps <> 19
     or r.bullets <> 6 or r.prose <> 2 then
    raise exception 'FSQM-018 body wrong shape: % lines, % steps, % bullets, % prose (expected 27 / 19 / 6 / 2).',
      r.lines, r.steps, r.bullets, r.prose;
  end if;
  if r.steps + r.bullets + r.prose <> r.lines then
    raise exception 'A line has no recognised form: % steps + % bullets + % prose <> % lines.',
      r.steps, r.bullets, r.prose, r.lines;
  end if;
  if r.compass_body <> 0 or r.compass_resp <> 0 then
    raise exception 'Compass Blending posts survive: % in the body, % in Responsibility.',
      r.compass_body, r.compass_resp;
  end if;
  if r.roles_missing <> 0 then
    raise exception '% of the six roles have no duties in Responsibility.', r.roles_missing;
  end if;
  if not (r.refs_program and r.refs_record) then
    raise exception 'The body does not defer to CAPA: FSQM-009=%, FRM-007=%.',
      r.refs_program, r.refs_record;
  end if;
  if r.restates_trigger or r.restates_verify then
    raise exception 'A CAPA rule is still restated here: discretion trigger=%, effectiveness=%.',
      r.restates_trigger, r.restates_verify;
  end if;
  if not r.deadlock_note then
    raise exception 'The closing step no longer says the hold closes independently of the CAPA - the two documents would deadlock.';
  end if;
  if not (r.segregate and r.like_into_like and r.gf_rework and r.traceable
          and r.positive_release and r.gfco) then
    raise exception 'A requirement was lost: segregation=%, like-into-like=%, GF bar=%, traceability=%, positive release=%, GFCO=%.',
      r.segregate, r.like_into_like, r.gf_rework, r.traceable, r.positive_release, r.gfco;
  end if;
  if r.frm702_steps <> 5 then
    raise exception 'FRM-702 is named in % steps, expected 5.', r.frm702_steps;
  end if;
  if r.names_person then
    raise exception 'The document names an individual. The issued programs name roles only.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-018 is now % - this migration must not issue a document.', r.status;
  end if;
  if r.longest > 700 then
    raise exception 'The longest procedure line is % characters - a run-on has appeared.', r.longest;
  end if;
  if not untouched then
    raise exception 'A section other than the four written changed. Rolled back.';
  end if;
end $$;

commit;
