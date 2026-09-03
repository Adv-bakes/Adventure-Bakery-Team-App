-- FSQM-018: close the four gaps the pre-activation vetting found. Still draft.
--
-- Activation was held back and the document was read clause by clause against both code editions,
-- and step by step against the record it writes to. What that turned up was not wording.
--
-- 1. THE PROCEDURE EXPLAINED TWO OF THE FOUR DISPOSITIONS ITS OWN RECORD OFFERS. FRM-702's Final
-- Disposition Decision is a four-option select - APPROVED FOR PRODUCTION RELEASE, RETURN TO
-- SUPPLIER, REWORK, DESTRUCTION / DISPOSAL - and only rework and disposal had steps. Release is the
-- most common outcome of a hold and the one 2.4.7.1 governs ("released by authorized personnel, and
-- only after all inspections and analyses are successfully completed and documented"), and nothing
-- stated its conditions, who removes the hold tag, or how material returns to stock. Return to
-- supplier had no step at all, though FRM-205 is active for exactly that and FRM-702 carries an
-- Associated SCAR Number field that nothing ever filled. Both steps are added; the
-- final-disposition step now names all four, so the form and the procedure cannot be read apart.
--
-- 2. THE INTENDED CLAUSE REFERENCE OVERCLAIMED 2.4.6.1, whose seven limbs were checked one by one.
-- Limb iii - reworked product processed in accordance with the site's food safety plan - was absent
-- entirely. Limb iv wants EACH BATCH inspected or analyzed before release; the text said "as
-- needed". Both are now written. Limb vi requires release of reworked product to conform to 2.4.7,
-- which is what the new release step provides. Claiming a clause only partly met is worse than
-- claiming fewer, because it tells an auditor exactly where to look.
--
-- 3. "POSITIVE RELEASE PROCEDURE" IS NO LONGER CITED, and this is the finding worth the delay. The
-- rework rules made it the authority for final disposition of reworked material and no document of
-- that name exists anywhere in the register - a Compass Blending reference that survived the
-- import. Reworked material is now released under this procedure's own release requirements,
-- recorded on FRM-702 and listed on REP-701 (which is a derived register over FRM-702 filtered to
-- the release disposition, so it populates without a manual step). An active document citing a
-- procedure that does not exist was the one thing that made issuing this a known exposure; it is
-- gone. What remains unowned - a site-wide product release procedure, positive release on pathogen
-- or chemical testing (2.4.7.3), and returned product (Quality Code 2.4.5.3) - is outside this
-- document's scope, and it no longer implies those exist.
--
-- 4. NON-CONFORMING EQUIPMENT HAD NOWHERE TO GO AND NO WAY BACK. 11.1.7.9 requires equipment to be
-- identified, tagged AND/OR segregated for repair or disposal, with records maintained. Segregation
-- into a Quarantine warehouse is written for material; a mixer cannot be carried there, which is
-- why the clause says "and/or". One step now covers tagging equipment where it stands and taking it
-- out of service; another covers repair, the SQF Practitioner's confirmation that it can produce
-- conforming product, and return to service. EQUIPMENT RECORDS GO TO FRM-004 Equipment Register,
-- not FRM-702: FRM-702's fields are Material Name, Supplier Name, P.O. Number and Supplier Lot, and
-- its four dispositions have no "repaired and returned to service", so recording a broken machine
-- there would have been a record in name only.
--
-- 5. Step 1 gave the Quality Team "determine the disposition" while the final-disposition step gave
-- it to the SQF Practitioner. Step 1 now determines whether the material or equipment conforms.
--
-- Linked Form lists all five records the procedure requires: FRM-702, FRM-007, FRM-205, FRM-004,
-- REP-701. All five are asserted active below - an active procedure requiring a record that is not
-- available is the finding this wave exists to close, and this migration adds three such
-- requirements.
--
-- STILL DRAFT, NO REVISION BUMP. Never issued, nothing to supersede. Issue is a separate migration
-- once the last open item is decided: FSQM-019 Rework Procedure is a live draft naming a different
-- rework authority (R&D Manager) than this document (SQF Practitioner), and leaving it live against
-- an active procedure is a document-control exposure under SOP-2.2.3.
--
-- Writes procedure, responsibility, form_references and revision_history. The DO block hashes
-- everything else before and after; scripts/check-migration-hashes.py verifies the key lists agree.

begin;

do $$
declare
  r record;
begin
  select status, revision, type,
         jsonb_array_length(content->'procedure')                                     as lines,
         (content->'procedure')::text like '%Positive Release Procedure%'              as dangling_ref,
         (content->'procedure')::text like '%FRM-205%'                                as already_done,
         (select count(*) from public.sop_documents
           where sop_number in ('FRM-702','FRM-007','FRM-205','FRM-004','REP-701')
             and status = 'active')                                                   as records_live
    into r
    from public.sop_documents where sop_number = 'FSQM-018';

  if r is null then
    raise exception 'FSQM-018 does not exist.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-018 is % - a content change to an issued document needs a revision bump. Stop and re-derive.',
      r.status;
  end if;
  if r.revision <> 'New' or r.type <> 'fsqm' then
    raise exception 'FSQM-018 is revision % / type %, not New / fsqm.', r.revision, r.type;
  end if;
  if r.lines <> 27 then
    raise exception 'FSQM-018 has % procedure lines, expected the 27 left by 20260902000013.', r.lines;
  end if;
  if not r.dangling_ref then
    raise exception 'FSQM-018 no longer cites the Positive Release Procedure this migration removes.';
  end if;
  if r.already_done then
    raise exception 'FSQM-018 already references FRM-205 - this migration has run.';
  end if;
  if r.records_live <> 5 then
    raise exception 'Only % of FRM-702, FRM-007, FRM-205, FRM-004 and REP-701 are active. Do not require a record that is not available.',
      r.records_live;
  end if;
end $$;

create temporary table fsqm018_disp_before on commit drop as
select md5((content - 'procedure' - 'responsibility' - 'form_references' - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'FSQM-018';

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       jsonb_set(content, '{procedure}', $j$["Upon completion of inspection and/or testing of raw material, work in progress, finished product samples, and equipment, the Quality Team shall determine whether the material or equipment conforms to specification, and shall record the result.", "Investigation of suspected non-conforming product can be initiated due to raw materials, intermediate materials, finished products, or equipment found to be non-compliant during receiving, storage, production, QC testing, shipping or routine food safety inspections.", "> Observation of product defect, damage or shelf life, QC result deviations, or customer complaints may lead to the disposition of a product as non-compliant.", "Upon identification of non-compliant raw material, work in progress material, finished product, or packaging material that can affect the quality, food safety or legality of a food product, any employee shall immediately notify the SQF Practitioner in order to place questionable material on Hold.", "• For certified Gluten Free products, and for ingredients used in certified Gluten Free products, confirmation of a positive gluten result (>10 ppm) shall be followed by the hold, notification and segregation steps set out below, to ensure proper segregation of affected product.", "• The SQF Practitioner shall notify GFCO at testing@gluten.org.", "Upon receipt of a customer complaint, the Quality Team shall establish with Admin the location of all remaining inventory of the suspected lot, and shall place suspect inventory on Hold.", "When the Quality Team is notified of suspected non-conforming material, or is working with a QC result that deviates from specifications, the questionable lot or batch shall be placed on Hold for investigation. For finished products, Product Sample Analysis records shall be reviewed for accuracy, completeness, and compliance.", "If a suspected material is found to be expired, damaged, or shows signs of contamination or infestation, the Quality Team shall place the lot on Hold upon notification.", "The Quality Team shall raise a Non-Conforming Material Hold & Tagging Record (FRM-702) immediately and notify the SQF Practitioner and the Management team of the incident.", "The Quality Team shall also label the Hold product or equipment with a hold tag and record the tag number, the material status and the segregated storage location on FRM-702.", "Production staff shall physically segregate the Hold product or equipment into the Quarantine area immediately to prevent accidental usage or shipping.", "Where non-conforming equipment cannot be moved to the Quarantine area, it shall be tagged where it stands and taken out of service. Equipment taken out of service shall not be used again until it is released under the repair step below.", "Admin shall complete the necessary transactions in the inventory system immediately.", "The Quality Team may determine a new sampling plan for further investigation of the product or equipment.", "Test and inspection results shall be provided to the SQF Practitioner for completion of the investigation, as applicable.", "A Corrective and Preventive Action shall be raised under FSQM-009 Corrective and Preventive Action (CAPA) Program and recorded on FRM-007. The CAPA number shall be recorded on FRM-702 so that the hold and its investigation are traceable to each other.", "> FSQM-009 Part 3 states when a CAPA is required, and non-conforming product is one of its triggers, so that decision is not taken again here. The investigation reviews the raw material records, batch sheets, lab records and any other documentation associated with the questionable lot. Root cause, the corrective and preventive actions with their owners and due dates, verification of effectiveness, closure and record retention are all governed by FSQM-009 and recorded on FRM-007. This procedure does not restate them, so the two documents cannot give different answers.", "The SQF Practitioner shall determine the final disposition of the product or equipment. FRM-702 records one of four outcomes: approved for production release, return to supplier, rework, or destruction and disposal.", "The Quality Team shall complete the Final Disposition and Release Authorization section of FRM-702, and the Management team shall be notified of the final disposition.", "Material shall be approved for production release only after the inspections and analyses relevant to the reason for the hold are complete, their results are acceptable and recorded, and the SQF Practitioner has authorised the release on FRM-702. The Quality Team shall then remove the hold tag, and Admin shall return the material to available stock in the inventory system. Released material is listed on REP-701 QA Product & Material Release Log.", "If the disposition is return to supplier, the Quality Team shall raise a Supplier Non-Conformance & Corrective Action Report (FRM-205) and record its number in the Associated SCAR Number field on FRM-702. Admin shall arrange the return under the approved supplier agreement terms and complete the necessary inventory transactions.", "If the disposition is destruction and disposal, Admin shall discard the held product or equipment, verify that the disposal is complete, and complete the necessary inventory transactions.", "If the SQF Practitioner determines that the product or equipment may be safe to rework, the product records and samples shall first be examined for food safety risks (micro, age, damage, etc.) before the rework decision is made.", "• All finished product rework shall be performed on a \"like into like\" basis. Certified Gluten Free products that are segregated due to gluten results >10 ppm shall not be reworked into other certified Gluten Free products.", "• The SQF Practitioner shall determine the rework formulation, with careful consideration to product specifications, functionality and potential impact on product performance. The rework material and the formulation used shall be clearly identified in the batch sheet and traceable.", "• Reworked product shall be processed in accordance with the site's food safety plan. Rework shall not be used where it would affect the safety or integrity of the finished product.", "• Rework quantities in the Quarantine Area shall be reviewed every two weeks at a minimum by the Quality Team to ensure rework inventory is maintained at a minimum level. Review shall consider manufacturing dates and product age, possible packaging damage, infestation, microbial risk and other food safety concerns. Some products may need to be retested to determine an appropriate rework formulation, if necessary.", "• Each batch of reworked material shall be inspected or analyzed against the finished product specification before release, and shall then be released under the release requirements of this procedure - recorded on FRM-702 and listed on REP-701.", "Non-conforming equipment shall not be returned to service until the repair is complete and the SQF Practitioner has confirmed that the equipment is capable of producing product that meets specification. The repair, that confirmation and the return to service shall be recorded against the equipment on FRM-004 Equipment Register, as shall the disposal of equipment that cannot be repaired.", "The hold is closed when the final disposition is complete and recorded on FRM-702. A CAPA raised from the hold remains open under FSQM-009 until its actions are verified effective; the two are tracked separately, because FSQM-009 requires the disposition of affected product to be resolved before a CAPA can be closed.", "Hold inventory in the Quarantine warehouse shall be reviewed biweekly by the Quality Team to ensure rework materials are processed in a timely manner as permitted by product demand."]$j$::jsonb),
                       '{responsibility}', $j$"SQF Practitioner — owns this procedure. Decides what is placed on Hold, determines the final disposition of held product and equipment, determines rework formulations, confirms each batch of reworked material meets the finished product specification before release, authorises the release of held material, and confirms that non-conforming equipment is capable of producing conforming product before it returns to service. Raises and owns any CAPA arising, under FSQM-009.\nQuality Team — places suspect material on Hold, raises and completes FRM-702, applies the hold tag, sets any additional sampling, and reviews held and rework inventory biweekly.\nAll staff — report suspected non-conforming material to the SQF Practitioner immediately. No employee is disadvantaged for raising one.\nProduction staff — segregate held product and equipment into the Quarantine area on notification, and store it so that it cannot be used or shipped.\nManagement team — is notified of every hold and of its final disposition, and is responsible for the resources needed to hold, rework or dispose of material.\nAdmin — completes the inventory transactions for held, reworked and scrapped material, discards material on a disposal disposition, arranges returns to suppliers under the approved supplier agreement terms, returns released material to available stock, and locates the remaining inventory of a suspect lot on request."$j$::jsonb),
                     '{form_references}', $j$"FRM-702 Non-Conforming Material Hold & Tagging Record; FRM-007 Corrective and Preventive Action (CAPA) Report; FRM-205 Supplier Non-Conformance & Corrective Action Report (SCAR); FRM-004 Equipment Register; REP-701 QA Product & Material Release Log"$j$::jsonb),
                   '{revision_history}', $j$"Rev New — imported 2026-06-17 from a scanned hardcopy of the Compass Blending original through the Word importer. DRAFT. Not approved, not in force, and not yet reconciled with the programs issued around it.\n\nFORMATTING AND OCR REPAIR, 2026-09-02. Presentation only. The stored body was raw importer output and did not print: it was 41 lines carrying the source document's own numbering, which the renderer numbered a second time on top. No requirement was added, removed or reworded in that pass, with the two exceptions recorded under RECONSTRUCTIONS below. What changed:\n\n• The source numbering was removed from every step. The rendered list owns the numbering now, which is how every other document here is stored. Nothing else in the body cites a step number, so nothing was left pointing at an old one.\n\n• The document was flattened to one level. The renderer has exactly two: a numbered step, and a list item or paragraph beneath it. The source ran three deep (2, 2.1, 2.1.1), so the sub-steps of the hold triggers and of the rework rules were promoted to steps and to bullets respectively. The reading order is unchanged; only the depth is.\n\n• Three steps had been split across a scan page break and were rejoined: \"...finished product / samples, and equipment\", the gluten-free segregation step, and \"...gluten results / >10ppm shall not be reworked\".\n\n• Two steps had been merged into one line, which also carried a stray OCR character (\"n 6.4 ... 6.5 ...\"). They are two steps again — labelling the Hold product, and segregating it into Quarantine — and the stray character is gone.\n\n• The running header \"NON-CONFORMING PRODUCT\" appeared twice in the middle of the body as though it were a step. Both were removed.\n\n• The four Root Cause Analysis criteria (Food Safety risk, product quality impact, service impact, cost) were unmarked and so printed as four numbered steps. They were marked as the list they are; they have since been removed altogether — see CORRECTIVE ACTION below.\n\nTHE HOLD RECORD IS NAMED. Linked Form read \"Form-0021 Quality Hold Report\", a Compass Blending number that does not exist in this register, and the body called that record a \"Hold Action Report\" in three steps. Both now name FRM-702 Non-Conforming Material Hold & Tagging Record, which is active. This is not a find-and-replace on a similar-sounding title: FRM-702's three sections are the three moments this procedure describes. Section 1 Initial Hold Identification raises the hold and carries the hold tag number, the material status and the segregated storage location, which is what the \"issue a report\" and \"label with a tag\" steps do. Section 3 Final Disposition and Release Authorization carries the disposition decision, its justification, a verification check and an authorising signature, which is what the \"revise the report\" step does. The three steps now say which section they complete.\n\nOne limitation of that mapping, which is a question about the form rather than about this procedure: FRM-702 Section 1 is written around material received from a supplier — Supplier Name, P.O. Number, Supplier Lot / Batch Number. This procedure also covers work in progress and finished product, where those fields have no answer. They are not marked required, so an internal hold can be recorded today with them left blank, but the form should be reviewed against the wider scope before this document is issued.\n\nROLES, 2026-09-02. This changes who does what. It is not a formatting pass.\n\nThe body named eleven actors: QC personnel, Quality personnel, Quality Technicians, Quality Leader, Quality Management, Plant Manager, Production associate, Warehouse personnel, R&D, the Customer Services and Sales Supply specialist, and \"the appropriate functional area manager\". That is a Compass Blending organisation chart. None of those posts exists here, so no responsibility in this document was assigned to anybody. They are replaced by the six roles the issued programs already use — SQF Practitioner, Quality Team, Management team, Production staff, Admin and All staff — so that FSQM-009, FSQM-012, FSQM-013, FSQM-022 and this document describe one organisation rather than two. As in those documents, no individual is named: a document that names a person has to be reissued when the person changes.\n\n• QC personnel, Quality personnel and Quality Technicians become the Quality Team.\n• Quality Leader and Quality Management become the SQF Practitioner.\n• Plant Manager, and the bare \"Management\", become the Management team.\n• The Production associate becomes All staff, matching FSQM-009, which already says any employee may raise a non-conformance and must report it immediately.\n• Warehouse personnel become Production staff. There is no separate warehouse function.\n• The Customer Services and Sales Supply specialist becomes Admin.\n• \"The appropriate functional area manager\" becomes the SQF Practitioner, which is what FSQM-009 Part 5 already says.\n• R&D becomes the SQF Practitioner. The site confirmed on 2026-09-02 that the SQF Practitioner and R&D are the same person.\n\nTHREE STEPS DID NOT SURVIVE THE SUBSTITUTION, and rewriting them is why this was not done as a find-and-replace. Each described a hand-off between two posts that turn out to be one person, and a step nobody can evidence is worse than no step at all.\n\n• Step 7 required the incident to be communicated to four named parties. After substitution that list is the SQF Practitioner and the Management team, and it read as an instruction to notify oneself. It is now one sentence — raise FRM-702, notify the SQF Practitioner and the Management team — and the four-name list is deleted.\n\n• Final disposition was given to \"the Plant Manager and Quality Leader\", written as two posts agreeing. It is the SQF Practitioner alone. A quorum of one is not a control, and writing it as though it were invites an auditor to test a separation of duties that does not exist.\n\n• The rework formulation was determined by R&D and then communicated by R&D to the Plant Manager. Both are the same person. The two steps are merged into one, which keeps what SQF 2.4.6.1 actually requires — a qualified person determines the formulation, and the material and formulation are identified in the batch sheet and traceable — and drops only the hand-off.\n\nCORRECTIVE ACTION NOW DEFERS TO FSQM-009 INSTEAD OF RESTATING IT. Four steps covered root cause analysis, when an analysis is done, records, and verification of effectiveness. FSQM-009 Corrective and Preventive Action (CAPA) Program was issued on 2026-09-02 and governs all four, and the two documents had already diverged on both of the things that matter:\n\n• This procedure said root cause analyses are conducted \"at Management discretion\" based on food safety risk, product quality impact, service impact and cost. FSQM-009 Part 3 lists ten triggers and non-conforming product is one of them. As written, this document permitted skipping an investigation that FSQM-009 requires, and an auditor holding both would fairly take the weaker rule as the site's practice. The four discretion criteria are removed; when a CAPA is raised is FSQM-009's decision, in one place.\n\n• This procedure gave verification of effectiveness to the Plant Manager and Quality Leader. FSQM-009 gives it to the SQF Practitioner, or to someone independent of the action owner. There is now one answer, in one document.\n\nThe investigation steps are replaced by a reference: a CAPA is raised under FSQM-009, recorded on FRM-007, and its number is written onto FRM-702 so the hold and the investigation are traceable to each other. FRM-702 had nowhere to hold that number — Section 2 offered only an Associated SCAR Number, which a CAPA is not — so it gains an Associated CAPA Number field in migration 20260902000012, taken now while it still has zero entries. This is the gap FRM-908's car_ref had and the fix FRM-913 received in the same wave.\n\nTHE HOLD DOES NOT WAIT ON THE CAPA. FSQM-009 Part 8 cannot close a CAPA until the disposition of affected product is resolved. Requiring the hold to stay open until its CAPA closes would deadlock the two documents against each other, so the closing step says plainly that the hold closes on final disposition and the CAPA continues separately under FSQM-009.\n\nThe body is 27 lines: 19 steps, 6 list items and 2 paragraphs.\n\nRECONSTRUCTIONS — two places where the scan was not legible and the text was repaired rather than transcribed. Both need confirming before this document is issued:\n\n1. The GFCO notification address read \"testing(4Iuten.org\", which is not an address. It is written as testing@gluten.org. Confirm against GFCO's current certification correspondence before issue.\n\n2. The cross-reference \"steps described in sections 6.3 thru 6.11\" pointed at the source document's numbering, which no longer exists anywhere in this document. It reads \"the hold, notification and segregation steps set out below\". If a specific range was meant, restore it against the paper original.\n\nOne further wording change: step 1 read \"Quality personnel shall dispose of the product inspected/tested\", which on its face directs that everything inspected be thrown away. Read in context it means a disposition decision, and it is written as \"shall determine the disposition of\". Confirm this is what the original intended.\n\nPRE-ACTIVATION VETTING, 2026-09-02. Activation was held back and the document was read clause by clause against the code, and step by step against the record it writes to. Four gaps were found and closed. Still draft.\n\n1. THE PROCEDURE EXPLAINED TWO OF THE FOUR DISPOSITIONS ITS OWN RECORD OFFERS. FRM-702's Final Disposition Decision is a four-option field — approved for production release, return to supplier, rework, destruction and disposal — and only rework and disposal had steps. Release is the most common outcome of a hold and the one SQF 2.4.7.1 governs, and nothing stated the conditions for it, who removes the hold tag, or how material returns to stock. Return to supplier had no step at all, although FRM-205 exists for it and FRM-702 carries an Associated SCAR Number field that nothing filled. Both steps are added, and the final-disposition step now names all four outcomes so the procedure and the form cannot be read apart.\n\n2. THE INTENDED CLAUSE REFERENCE OVERCLAIMED 2.4.6.1. Food Manufacturing 2.4.6.1 has seven limbs. Limb iii — reworked product processed in accordance with the site's food safety plan — was not in the document at all, and limb iv wants EACH BATCH inspected or analyzed before release where the text said \"as needed\". Both are now written. Limb vi requires release of reworked product to conform to 2.4.7, which is what the new release step provides. Claiming a clause that is only partly met is worse than claiming fewer, because it tells an auditor where to look.\n\n3. \"POSITIVE RELEASE PROCEDURE\" IS NO LONGER CITED. The rework rules made it the authority for the final disposition of reworked material, and no document of that name exists anywhere in the register — it was a Compass Blending reference that survived the import. Reworked material is now released under the release requirements of this procedure, recorded on FRM-702 and listed on REP-701. What remains unowned is a site-wide finished-product release procedure and a positive release procedure based on pathogen or chemical testing (2.4.7.3); neither is in this document's scope, and this document no longer implies they exist.\n\n4. NON-CONFORMING EQUIPMENT HAD NOWHERE TO GO AND NO WAY BACK. 11.1.7.9 requires equipment to be identified, tagged and/or segregated for repair or disposal, with records maintained. Segregation into a Quarantine warehouse is written for material; a mixer cannot be carried there, which is why the clause says \"and/or\". A step now covers tagging equipment where it stands and taking it out of service, and a second covers repair, the SQF Practitioner's confirmation that it can produce conforming product, and its return to service. Equipment records go to FRM-004 Equipment Register, not to FRM-702 — FRM-702's fields are Material Name, Supplier Name, P.O. Number and Supplier Lot, and its dispositions have no \"repaired and returned to service\", so recording a broken machine there would have been a record in name only.\n\n5. Step 1 gave the Quality Team \"determine the disposition\" while the final-disposition step gave it to the SQF Practitioner. Step 1 now determines whether the material or equipment conforms, and records the result.\n\nLinked Form now lists all five records the procedure requires: FRM-702, FRM-007, FRM-205, FRM-004 and REP-701. Body: 27 lines become 32 — 23 steps, 7 list items, 2 paragraphs.\n\nOPEN BEFORE ISSUE — content questions still unanswered, because they are decisions about what the document should say rather than about what it already says:\n\n1. Records, Governing Reference and the SQF clause reference are all empty. The clauses are not in doubt: Quality Code 2.4.5 Non-conforming Product or Equipment and 2.4.6 Product Rework; Food Manufacturing 2.4.5.1, 2.4.5.2 and 11.1.7.9, the last covering non-conforming equipment specifically, which this document's title claims. Two of those require records to be maintained, and the body requires records without saying which or for how long. Records should name FRM-702, FRM-007 and REP-701, with the retention period FSQM-009 already sets.\n\n2. FSQM-019 Rework Procedure is an unapproved four-line draft, and it names a different authority for rework than this document does: FSQM-019 says the R&D Manager authorises it, this procedure says the SQF Practitioner. The substantive rework rules are here. Leaving a live draft that contradicts an active procedure is a document-control exposure under SOP-2.2.3, so FSQM-019 should be withdrawn or archived when this document is issued, or its rework rules moved into it and this document made to defer. That decision belongs to the SQF Practitioner and is the last thing outstanding before issue.\n\n3. Not in this document's scope but adjacent and unowned: there is no site-wide product release procedure (2.4.7 Product Release is Mandatory in the Food Manufacturing code), no positive release procedure based on pathogen or chemical testing (2.4.7.3), and no returned-product procedure (Quality Code 2.4.5.3). This document releases held and reworked material only, and says so.\n\nUNTIL THIS DOCUMENT IS ISSUED it is not in force, whatever it now says. FRM-702 is active and is the record actually in use for holding and tagging non-conforming material, and FSQM-009 governs the corrective action that follows. That is the position FSQM-009's own Scope states, and naming FRM-702 here does not change it."$j$::jsonb)
 where sop_number = 'FSQM-018' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  untouched boolean;
begin
  select status,
    jsonb_array_length(content->'procedure')                                          as lines,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s not like '• %' and s not like '> %')                                    as steps,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '• %')                                                             as bullets,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '> %')                                                             as prose,
    (select coalesce(max(length(s)), 0) from jsonb_array_elements_text(content->'procedure') s)
                                                                                      as longest,
    -- fix 1: all four dispositions are explained
    (content->'procedure')::text like '%approved for production release, return to supplier, rework, or destruction and disposal%'
                                                                                      as four_named,
    (content->'procedure')::text like '%approved for production release only after the inspections%'
                                                                                      as release_step,
    (content->'procedure')::text like '%Associated SCAR Number field on FRM-702%'     as return_step,
    (content->'procedure')::text like '%destruction and disposal, Admin shall discard%' as disposal_step,
    -- fix 2: the two uncovered limbs of 2.4.6.1
    (content->'procedure')::text like '%site''s food safety plan%'                    as limb_iii,
    (content->'procedure')::text like '%Each batch of reworked material shall be inspected%'
                                                                                      as limb_iv,
    -- and the reference to a document that does not exist is gone
    (content->'procedure')::text like '%Positive Release Procedure%'                  as dangling_ref,
    -- fix 3: equipment out of service, repair, and records to FRM-004
    (content->'procedure')::text like '%tagged where it stands and taken out of service%'
                                                                                      as out_of_service,
    (content->'procedure')::text like '%capable of producing product that meets specification%'
                                                                                      as repair_step,
    (content->'procedure')::text like '%FRM-004 Equipment Register%'                  as equip_register,
    -- fix 7
    (content->'procedure')::text like '%conforms to specification, and shall record the result%'
                                                                                      as step1_fixed,
    -- linked forms list every record the procedure now requires
    (select count(*) from unnest(array['FRM-702','FRM-007','FRM-205','FRM-004','REP-701']) fr
      where strpos(content->>'form_references', fr) = 0)                              as forms_missing,
    -- and nothing earlier was undone
    (content->'procedure')::text like '%before a CAPA can be closed%'                 as deadlock_note,
    (content->'procedure')::text like '%like into like%'                              as like_into_like,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s ~ 'QC personnel|Quality Leader|Plant Manager|Warehouse personnel|Customer Services and Sales Supply|functional area manager|\mR&D\M')
                                                                                      as compass_back,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where regexp_replace(s, '^(• |> )', '') ~ '^\s*\d+(\.\d+)*[.)]?\s')          as numbered
  into r
  from public.sop_documents where sop_number = 'FSQM-018';

  select b.h = md5((d.content - 'procedure' - 'responsibility' - 'form_references' - 'revision_history')::text)
    into untouched
    from public.sop_documents d, fsqm018_disp_before b where d.sop_number = 'FSQM-018';

  if r.lines <> 32 or r.steps <> 23
     or r.bullets <> 7 or r.prose <> 2 then
    raise exception 'FSQM-018 body wrong shape: % lines, % steps, % bullets, % prose (expected 32 / 23 / 7 / 2).',
      r.lines, r.steps, r.bullets, r.prose;
  end if;
  if r.steps + r.bullets + r.prose <> r.lines then
    raise exception 'A line has no recognised form: % + % + % <> %.', r.steps, r.bullets, r.prose, r.lines;
  end if;
  if not (r.four_named and r.release_step and r.return_step and r.disposal_step) then
    raise exception 'Dispositions incomplete: all four named=%, release=%, return to supplier=%, disposal=%.',
      r.four_named, r.release_step, r.return_step, r.disposal_step;
  end if;
  if not (r.limb_iii and r.limb_iv) then
    raise exception '2.4.6.1 still overclaimed: food safety plan=%, each batch before release=%.',
      r.limb_iii, r.limb_iv;
  end if;
  if r.dangling_ref then
    raise exception 'The document still cites a Positive Release Procedure that does not exist.';
  end if;
  if not (r.out_of_service and r.repair_step and r.equip_register) then
    raise exception '11.1.7.9 still uncovered: out of service=%, repair=%, FRM-004=%.',
      r.out_of_service, r.repair_step, r.equip_register;
  end if;
  if not r.step1_fixed then
    raise exception 'Step 1 still competes with the final-disposition step.';
  end if;
  if r.forms_missing <> 0 then
    raise exception '% of the five required records are missing from Linked Form.', r.forms_missing;
  end if;
  if not (r.deadlock_note and r.like_into_like) then
    raise exception 'Earlier work undone: deadlock sentence=%, like-into-like=%.',
      r.deadlock_note, r.like_into_like;
  end if;
  if r.compass_back <> 0 then
    raise exception '% lines reintroduced a Compass Blending post.', r.compass_back;
  end if;
  if r.numbered <> 0 then
    raise exception '% lines carry their own step number.', r.numbered;
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-018 is now % - this migration must not issue it.', r.status;
  end if;
  if r.longest > 700 then
    raise exception 'The longest procedure line is % characters - a run-on has appeared.', r.longest;
  end if;
  if not untouched then
    raise exception 'A section other than the four written changed. Rolled back.';
  end if;
end $$;

commit;
