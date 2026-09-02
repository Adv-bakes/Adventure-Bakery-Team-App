-- FSQM-018: repair the scanned body so it prints. Presentation only, no requirement changes.
--
-- WHAT THE PDF ACTUALLY SHOWED. The document was imported from a scanned hardcopy and stored as
-- 41 lines that still carried the source document's own numbering - "2.1 Upon identification...",
-- "15.1.1 Certified Gluten Free products...". The renderer then numbered them a second time. Worse
-- than the doubling, groupProcedureSteps() stripped "2." off the front of "2.1" and left "1"
-- behind, so a correctly numbered clause printed as a different, plausible-looking one and the
-- document appeared to restart its numbering four times. That regex is fixed in the same change
-- (src/lib/sopDocxParser.ts); FSQM-018 is the only document of the 38 with multi-level numbering,
-- so it is the only one that was ever affected.
--
-- THE NUMBERS COME OUT OF THE DATA, not just out of the renderer. Storing a step's number in the
-- step is what created the problem, and no other document here does it. The rendered list owns the
-- numbering now. Nothing in the body cites a step number except one cross-reference, which pointed
-- at the SOURCE document's numbering and never resolved here at all - see the Revision History.
--
-- FLATTENED TO THE TWO LEVELS THAT EXIST. The source ran three deep (2, 2.1, 2.1.1). The renderer
-- has a numbered step and, under it, list items and prose. The hold triggers were promoted to
-- steps; the rework rules became bullets under the rework decision. Reading order is unchanged.
--
-- OCR DAMAGE REPAIRED. Three steps had been split across a scan page break and are rejoined. Two
-- steps had been merged into one line carrying a stray "n" ("n 6.4 ... 6.5 ...") and are two steps
-- again. The running header "NON-CONFORMING PRODUCT" appeared twice mid-body as though it were a
-- step and is removed. The four Root Cause Analysis criteria were unmarked and printed as four
-- numbered steps; they are a list and are marked as one.
--
-- TWO RECONSTRUCTIONS AND ONE WORDING FIX are recorded in the Revision History rather than made
-- silently: an illegible GFCO address, a cross-reference to numbering that no longer exists, and
-- step 1's "shall dispose of the product inspected/tested", which read as an instruction to throw
-- away everything inspected. Each says what it was and asks for confirmation before issue.
--
-- THE HOLD RECORD IS NAMED. Linked Form read "Form-0021 Quality Hold Report", a Compass Blending
-- number that does not exist in this register, and three steps called that record a "Hold Action
-- Report". Both now name FRM-702 Non-Conforming Material Hold & Tagging Record, which is active
-- with zero entries. This is not a find-and-replace on a similar-sounding title: FRM-702's three
-- sections ARE the three moments this procedure describes. Section 1 raises the hold and carries
-- hold_tag_number, material_status_tag and storage_location_segregated - the "issue a report" and
-- "label with a tag" steps. Section 3 Final Disposition & Release Authorization carries the
-- decision, its justification, a verification check and an authorising signature - the "revise the
-- report" step. The steps now say which section they complete. The one place the mapping is
-- imperfect - FRM-702 Section 1 is written around supplier-received material, while this procedure
-- also covers WIP and finished product - is recorded in the Revision History as a question about
-- the form, because those fields are not required and an internal hold records fine without them.
--
-- WHAT THIS DOES NOT DO. It does not answer the remaining content questions - the Compass Blending
-- roles, the reference FSQM-009 should now carry, the empty Records and clause reference, the
-- overlap with FSQM-019. Those are decisions about what the document should say, not about what it
-- already says, and they are written into the Revision History as OPEN BEFORE ISSUE. FSQM-018 stays
-- `draft`; FRM-702 is the operative hold record either way, which is why naming it changes nothing
-- about what anyone does today.
--
-- NO REVISION BUMP. The document has never been issued, so there is nothing to supersede. The
-- guard fails loudly if it has been activated since this was written, because then it would need
-- one. Only procedure, responsibility, form_references and revision_history are written; the DO
-- block hashes everything else before and after, so purpose, scope, definitions and attachments
-- are provably untouched.

begin;

do $$
declare
  r record;
begin
  select status, revision, type,
         jsonb_array_length(content->'procedure')                                     as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s ~ '^\s*\d+(\.\d+)*[.)]?\s')                                      as numbered,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s = 'NON-CONFORMING PRODUCT')                                        as headers,
         -- the specific damage: a number the old stripper would have mangled into a different one
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s ~ '^\s*\d+\.\d')                                                   as multilevel,
         content->>'form_references'                                                  as form_ref,
         content ? 'attachments'                                                      as has_attachments
    into r
    from public.sop_documents where sop_number = 'FSQM-018';

  if r is null then
    raise exception 'FSQM-018 does not exist.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-018 is % - it has been issued, so a content change needs a revision bump. Stop and re-derive.',
      r.status;
  end if;
  if r.revision <> 'New' then
    raise exception 'FSQM-018 is at revision %, not New. Re-derive against the current body.', r.revision;
  end if;
  if r.type <> 'fsqm' then
    raise exception 'FSQM-018 is type %, not fsqm.', r.type;
  end if;
  -- the body must still be the raw importer output this was written against
  if r.lines <> 41 then
    raise exception 'FSQM-018 has % procedure lines, expected the 41 the importer left. Someone has already edited it.',
      r.lines;
  end if;
  -- 27 / 2 / 12 are COUNTED from sop-drafts/FSQM-018-imported-body.json, which is the raw
  -- importer output this migration was derived from, using this same regex. The first push of
  -- this migration failed on "numbered < 30" - a threshold estimated rather than counted,
  -- against a document that was entirely correct. That is the second time a guess in a guard
  -- has rejected a good document (20260902000001 failed on a LIKE pattern whose case was
  -- wrong), so the snapshot is committed and the numbers are exact.
  if r.numbered <> 27 or r.headers <> 2 or r.multilevel <> 12 then
    raise exception 'FSQM-018 does not look like the un-repaired scan: % numbered lines, % stray headers, % multi-level (expected 27 / 2 / 12).',
      r.numbered, r.headers, r.multilevel;
  end if;
  if r.form_ref is distinct from 'Form-0021 Quality Hold Report' then
    raise exception 'Linked Form reads %, not the Compass number this replaces. Someone has already changed it.',
      coalesce(r.form_ref, 'null');
  end if;
end $$;

-- Hash everything this migration does NOT write, so the assertion afterwards can prove it.
create temporary table fsqm018_before on commit drop as
select md5((content - 'procedure' - 'responsibility' - 'form_references' - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'FSQM-018';

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       jsonb_set(content, '{procedure}', $j$["Upon completion of inspection and/or testing of raw material, work in progress, finished product samples, and equipment, Quality personnel shall determine the disposition of the product inspected or tested.", "Investigation of suspected non-conforming product can be initiated due to raw materials, intermediate materials, finished products, or equipment found to be non-compliant during receiving, storage, production, QC testing, shipping or routine food safety inspections.", "> Observation of product defect, damage or shelf life, QC result deviations, or customer complaints may lead to the disposition of a product as non-compliant.", "Upon identification of non-compliant raw material, work in progress material, finished product, or packaging material that can affect the quality, food safety or legality of a food product, the Production associate shall immediately notify Quality personnel in order to place questionable material on Hold.", "• For certified Gluten Free products, and for ingredients used in certified Gluten Free products, confirmation of a positive gluten result (>10 ppm) shall be followed by the hold, notification and segregation steps set out below, to ensure proper segregation of affected product.", "• GFCO shall be notified at testing@gluten.org.", "Upon receipt of a customer complaint, Quality personnel shall notify the Customer Services and Sales Supply specialist to request the location of all remaining inventory of the suspected lot. Quality personnel shall place suspect inventory on Hold.", "When Quality personnel is notified of suspected non-conforming material, or is working with a QC result that deviates from specifications, the questionable lot or batch shall be placed on Hold for investigation. For finished products, Product Sample Analysis records shall be reviewed for accuracy, completeness, and compliance.", "If a suspected material is found to be expired, damaged, or shows signs of contamination or infestation, Quality personnel shall place the lot on Hold upon notification.", "Quality personnel shall raise a Non-Conforming Material Hold & Tagging Record (FRM-702) immediately and communicate the incident to the following parties:", "• Plant Manager", "• Customer Services and Sales Supply specialist", "• Quality Technicians", "• Quality Leader", "Quality personnel shall also label the Hold product or equipment with a hold tag and record the tag number, the material status and the segregated storage location on FRM-702.", "Warehouse personnel shall physically segregate the Hold product or equipment into the Quarantine area immediately to prevent accidental usage or shipping.", "Customer Services and Sales Supply specialists shall complete the necessary transactions in the inventory system immediately.", "Quality personnel may determine a new sampling plan for further investigation of the product or equipment.", "Test and inspection results shall be provided to Quality Management for completion of the investigation, as applicable.", "The appropriate functional area manager shall lead the root cause analysis by reviewing the raw material records, batch sheets, lab records and any other documentation associated with the questionable lot during the investigation.", "Root Cause Analyses shall be conducted at Management discretion based on:", "• Food Safety risk", "• Product quality impact", "• Service impact", "• Cost", "Root Cause Analyses, corrective and preventive action records shall be maintained.", "The Plant Manager and Quality Leader shall determine final disposition of the product or equipment.", "Quality personnel shall complete the Final Disposition and Release Authorization section of FRM-702 and notify management of the final product or equipment disposition.", "If Management determines that the product or equipment should be disposed of, the Customer Services and Sales Supply specialist shall discard the Hold product or equipment and complete the necessary inventory transactions.", "If the Plant Manager and Quality Leader determine that the product or equipment might be safe to rework, Quality shall immediately examine and review product records and samples for food safety risks (micro, age, damage, etc.) prior to making a rework decision.", "• All finished product rework shall be performed on a \"like into like\" basis. Certified Gluten Free products that are segregated due to gluten results >10 ppm shall not be reworked into other certified Gluten Free products.", "• R&D shall determine the appropriate rework formulation with careful consideration to product specifications, functionality and potential impact on product performance.", "• R&D shall communicate the rework formula to the Plant Manager. Rework material shall be clearly identified in the batch sheet and traceable.", "• Rework quantities in the Quarantine Area shall be reviewed every two weeks at a minimum by the Customer Services and Sales Supply specialist to ensure rework inventory is maintained at a minimum level. Review shall consider manufacturing dates and product age, possible packaging damage, infestation, microbial risk and other food safety concerns. Some products may need to be retested to determine an appropriate rework formulation, if necessary.", "• Reworked material shall be inspected or analyzed as needed according to the finished product specifications. Its final disposition shall be determined as established by the Positive Release Procedure.", "The Plant Manager and Quality personnel shall implement and follow up on corrective and preventive actions derived from the non-conformances to prevent recurrence. The Plant Manager and Quality Leader shall verify effectiveness of the corrective and preventive measures.", "Hold inventory in the Quarantine warehouse shall be reviewed biweekly by Quality personnel to ensure rework materials are processed in a timely manner as permitted by product demand."]$j$::jsonb),
                       '{responsibility}', $j$"1. QC personnel are responsible for product segregation and final disposition decisions of raw materials, work in progress, finished products, and equipment suspected of non conformance with quality specifications.\n2. Warehouse personnel are responsible for proper storage of the non-conforming product or equipment.\n3. Production and Quality are responsible for root cause analysis and corrective and preventive action implementation.\n4. The Customer Services and Sales Supply specialist is responsible for completing inventory transactions of hold or scrapped materials in the inventory system."$j$::jsonb),
                     '{form_references}', $j$"FRM-702 Non-Conforming Material Hold & Tagging Record"$j$::jsonb),
                   '{revision_history}', $j$"Rev New — imported 2026-06-17 from a scanned hardcopy of the Compass Blending original through the Word importer. DRAFT. Not approved, not in force, and not yet reconciled with the programs issued around it.\n\nFORMATTING AND OCR REPAIR, 2026-09-02. Presentation only. The stored body was raw importer output and did not print: it was 41 lines carrying the source document's own numbering, which the renderer numbered a second time on top. No requirement was added, removed or reworded, with the two exceptions recorded under RECONSTRUCTIONS below. What changed:\n\n• The source numbering was removed from every step. The rendered list owns the numbering now, which is how every other document here is stored. Nothing else in the body cites a step number, so nothing was left pointing at an old one.\n\n• The document was flattened to one level. The renderer has exactly two: a numbered step, and a list item or paragraph beneath it. The source ran three deep (2, 2.1, 2.1.1), so the sub-steps of the hold triggers and of the rework rules were promoted to steps and to bullets respectively. The reading order is unchanged; only the depth is.\n\n• Three steps had been split across a scan page break and were rejoined: \"...finished product / samples, and equipment\", the gluten-free segregation step, and \"...gluten results / >10ppm shall not be reworked\".\n\n• Two steps had been merged into one line, which also carried a stray OCR character (\"n 6.4 ... 6.5 ...\"). They are two steps again — labelling the Hold product, and segregating it into Quarantine — and the stray character is gone.\n\n• The running header \"NON-CONFORMING PRODUCT\" appeared twice in the middle of the body as though it were a step. Both were removed.\n\n• The four Root Cause Analysis criteria (Food Safety risk, product quality impact, service impact, cost) were unmarked and so printed as four numbered steps. They are a list and are marked as one, matching the four notification recipients, which already were.\n\nTHE HOLD RECORD IS NAMED. Linked Form read \"Form-0021 Quality Hold Report\", a Compass Blending number that does not exist in this register, and the body called that record a \"Hold Action Report\" in three steps. Both now name FRM-702 Non-Conforming Material Hold & Tagging Record, which is active. This is not a find-and-replace on a similar-sounding title: FRM-702's three sections are the three moments this procedure describes. Section 1 Initial Hold Identification raises the hold and carries the hold tag number, the material status and the segregated storage location, which is what the \"issue a report\" and \"label with a tag\" steps do. Section 3 Final Disposition and Release Authorization carries the disposition decision, its justification, a verification check and an authorising signature, which is what the \"revise the report\" step does. The three steps now say which section they complete.\n\nOne limitation of that mapping, which is a question about the form rather than about this procedure: FRM-702 Section 1 is written around material received from a supplier — Supplier Name, P.O. Number, Supplier Lot / Batch Number. This procedure also covers work in progress and finished product, where those fields have no answer. They are not marked required, so an internal hold can be recorded today with them left blank, but the form should be reviewed against the wider scope before this document is issued.\n\nRECONSTRUCTIONS — two places where the scan was not legible and the text was repaired rather than transcribed. Both need confirming before this document is issued:\n\n1. The GFCO notification address read \"testing(4Iuten.org\", which is not an address. It is written as testing@gluten.org. Confirm against GFCO's current certification correspondence before issue.\n\n2. The cross-reference \"steps described in sections 6.3 thru 6.11\" pointed at the source document's numbering, which no longer exists anywhere in this document. It reads \"the hold, notification and segregation steps set out below\". If a specific range was meant, restore it against the paper original.\n\nOne further wording change: step 1 read \"Quality personnel shall dispose of the product inspected/tested\", which on its face directs that everything inspected be thrown away. Read in context it means a disposition decision, and it is written as \"shall determine the disposition of\". Confirm this is what the original intended.\n\nOPEN BEFORE ISSUE — content questions this pass deliberately did not answer, because they are decisions about what the document should say rather than about what it already says:\n\n1. The body assigns work to a Plant Manager, a Quality Leader, Quality Technicians, an R&D function and a Customer Services and Sales Supply specialist. Those are Compass Blending roles. They need mapping onto the roles that exist here before anyone can follow this procedure.\n\n2. Corrective and preventive action is described here in general terms. FSQM-009 Corrective and Preventive Action (CAPA) Program was issued 2026-09-02 and is now the governing procedure for investigation, root cause and verification of effectiveness, recorded on FRM-007. This document should reference it rather than restate it, and its own root-cause steps should say when a CAPA is raised.\n\n3. Records, Governing Reference and the SQF clause reference are all empty. A controlled document with no stated records and no clause reference cannot be audited against anything.\n\n4. \"Positive Release Procedure\" is named as the authority for final disposition of reworked material but is not numbered, and FSQM-019 Rework Procedure is itself an unapproved draft covering the same ground as the rework steps here. The overlap between the two needs settling before either is issued.\n\nUNTIL THIS DOCUMENT IS ISSUED it is not in force, whatever it now says. FRM-702 is active and is the record actually in use for holding and tagging non-conforming material, and FSQM-009 governs the corrective action that follows. That is the position FSQM-009's own Scope states, and naming FRM-702 here does not change it."$j$::jsonb)
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
    -- no step may carry its own number any more, in either shape
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where regexp_replace(s, '^(• |> )', '') ~ '^\s*\d+(\.\d+)*[.)]?\s')          as numbered,
    -- the OCR damage must be gone from the text, not merely renumbered
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '%NON-CONFORMING PRODUCT%' or s like '%(4Iuten%'
         or s like '%n 6.4%' or s like '%6.3 thru 6.11%'
         or s like '%Hold Action Report%')                                            as damage,
    -- the hold record is named, in exactly the three steps that were the Hold Action Report
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '%FRM-702%')                                                       as frm702_steps,
    -- and the requirements must not have gone with it
    (content->'procedure')::text like '%Quarantine area immediately to prevent accidental usage%'
                                                                                      as segregate,
    (content->'procedure')::text like '%like into like%'                              as like_into_like,
    (content->'procedure')::text like '%shall not be reworked into other certified Gluten Free products%'
                                                                                      as gf_rework,
    (content->'procedure')::text like '%Positive Release Procedure%'                  as positive_release,
    (content->'procedure')::text like '%verify effectiveness of the corrective and preventive measures%'
                                                                                      as effectiveness,
    -- the two lists must be lists
    (content->'procedure')::text like '%• Plant Manager%'                              as recipients_listed,
    (content->'procedure')::text like '%• Food Safety risk%'                           as rca_listed,
    -- the reconstructions must be recorded, not silent
    (content->>'revision_history') like '%RECONSTRUCTIONS%'                           as reconstructions,
    (content->>'revision_history') like '%OPEN BEFORE ISSUE%'                         as open_list,
    (content->>'revision_history') like '%testing@gluten.org%'                        as gfco_addr,
    (content->>'revision_history') like '%FRM-702%'                                   as frm702,
    -- the dead form reference is replaced, and the replacement is recorded rather than silent
    (content->>'form_references') = 'FRM-702 Non-Conforming Material Hold & Tagging Record'                                as form_ref_now,
    (content->>'revision_history') like '%Form-0021 Quality Hold Report%'                          as form_ref_was_noted,
    (content->>'revision_history') like '%THE HOLD RECORD IS NAMED%'                  as hold_record_note,
    status                                                                            as status
  into r
  from public.sop_documents where sop_number = 'FSQM-018';

  select b.h = md5((d.content - 'procedure' - 'responsibility' - 'revision_history')::text)
    into untouched
    from public.sop_documents d, fsqm018_before b where d.sop_number = 'FSQM-018';

  if r.lines <> 37 or r.steps <> 21
     or r.bullets <> 15 or r.prose <> 1 then
    raise exception 'FSQM-018 body wrong shape: % lines, % steps, % bullets, % prose (expected 37 / 21 / 15 / 1).',
      r.lines, r.steps, r.bullets, r.prose;
  end if;
  if r.steps + r.bullets + r.prose <> r.lines then
    raise exception 'A line has no recognised form: % steps + % bullets + % prose <> % lines.',
      r.steps, r.bullets, r.prose, r.lines;
  end if;
  if r.numbered <> 0 then
    raise exception '% procedure lines still carry their own step number - the renderer would number them twice.',
      r.numbered;
  end if;
  if r.damage <> 0 then
    raise exception '% lines still carry OCR damage or the dead record name (running header, illegible address, merged step, dead cross-reference, or "Hold Action Report").',
      r.damage;
  end if;
  if r.frm702_steps <> 3 then
    raise exception 'FRM-702 is named in % steps, expected the 3 that were the Hold Action Report.',
      r.frm702_steps;
  end if;
  if not (r.segregate and r.like_into_like and r.gf_rework and r.positive_release and r.effectiveness) then
    raise exception 'A requirement was lost: segregation=%, like-into-like=%, GF rework bar=%, positive release=%, effectiveness=%.',
      r.segregate, r.like_into_like, r.gf_rework, r.positive_release, r.effectiveness;
  end if;
  if not (r.recipients_listed and r.rca_listed) then
    raise exception 'A list did not survive as a list: Hold Action Report recipients=%, RCA criteria=%.',
      r.recipients_listed, r.rca_listed;
  end if;
  if not (r.reconstructions and r.open_list and r.gfco_addr and r.frm702) then
    raise exception 'Revision history incomplete: reconstructions=%, open list=%, GFCO address=%, FRM-702=%.',
      r.reconstructions, r.open_list, r.gfco_addr, r.frm702;
  end if;
  if not (r.form_ref_now and r.form_ref_was_noted and r.hold_record_note) then
    raise exception 'Linked Form change incomplete: reads FRM-702=%, old number recorded=%, note present=%.',
      r.form_ref_now, r.form_ref_was_noted, r.hold_record_note;
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-018 is now % - a formatting pass must not issue a document.', r.status;
  end if;
  if r.longest > 700 then
    raise exception 'The longest procedure line is % characters - a run-on has reappeared.', r.longest;
  end if;
  if not untouched then
    raise exception 'A section other than procedure/responsibility/revision_history changed. Rolled back.';
  end if;
end $$;

commit;
