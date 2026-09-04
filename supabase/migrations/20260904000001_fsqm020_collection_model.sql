-- FSQM-020: the site does not use off-site storage. Corrected before issue, still draft.
--
-- WHAT WAS WRONG. The program was drafted 2026-09-03 on the understanding that finished product
-- went both from our own dock and into customer-owned or third-party storage as tolling stock.
-- Part 8 therefore required each storage location to be told in writing that only released product
-- may be drawn, reissued on change and confirmed annually - and that written instruction did not
-- exist, so it was recorded as a PREREQUISITE to issuing this document.
--
-- The CEO and Operations Manager confirmed on 2026-09-04 that this is not how it works. The
-- customer arranges collection with their own carrier, and responsibility for the product passes to
-- the customer once it leaves the facility. The site uses no off-site or contract warehouse.
--
-- SO PART 8 NOW SAYS SO, rather than being deleted. SQF 2.4.7.3's second limb applies only "in the
-- event that off-site or contract warehouses are used"; they are not, so it does not arise. That is
-- stated in the same form Part 5 already uses for positive release on testing, because a reader
-- should not have to work out for themselves which limbs of a clause apply to this site - and
-- because silence reads as an omission where a statement reads as a decision.
--
-- THE PREREQUISITE IS WITHDRAWN. There is nobody to issue the instruction to. That was the one open
-- item blocking issue; the two that remain - where the customer's agreed specification and the
-- sensory standard live, and whether any bulk or unlabeled product ships at all - are questions,
-- not prerequisites.
--
-- COLLECTION MAKES THE TIMING SHARPER, NOT SOFTER, and the body now says that too. Release has to
-- be complete before the carrier arrives rather than before a transfer the site controls, because
-- once product is loaded it has gone and a release recorded afterwards records nothing. Part 1's
-- trigger becomes "made available for collection, or leave the site", and Part 10 matches.
--
-- ONE THING DELIBERATELY NOT ABSORBED. "No longer the bakery's responsibility" is a fact about
-- custody and commercial risk. It is not true of traceability, or of withdrawal and recall, which
-- still reach product after it has been collected. Neither is in this program's scope and neither is
-- claimed here; the Revision History says so plainly so that a later reader does not take the
-- collection model as covering more than it does. The recall and withdrawal program does not yet
-- exist.
--
-- 28 lines become 27: Part 8's step plus two bullets and a paragraph become a step plus two
-- paragraphs. All eight remaining bullets are Part 4's release checks, which is why the FRM-701
-- migration alongside this one can assert a straight one-to-one against them.
--
-- Writes procedure, responsibility and revision_history; hashes the rest. Still draft, no revision
-- bump - never issued, nothing to supersede.

begin;

do $$
declare
  r record;
begin
  select status, revision, type,
         jsonb_array_length(content->'procedure')                                     as lines,
         (content->'procedure')::text like '%off-site storage location shall be told%' as old_part8,
         (content->'procedure')::text like '%does not use off-site or contract warehouses%'
                                                                                      as already_done,
         (content->>'revision_history') like '%prerequisite rather than a question%'   as prereq_listed
    into r
    from public.sop_documents where sop_number = 'FSQM-020';

  if r is null then
    raise exception 'FSQM-020 does not exist - run 20260903000001 first.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-020 is % - a content change to an issued document needs a revision bump.',
      r.status;
  end if;
  if r.revision <> 'New' or r.type <> 'fsqm' then
    raise exception 'FSQM-020 is revision % / type %, not New / fsqm.', r.revision, r.type;
  end if;
  if r.lines <> 28 then
    raise exception 'FSQM-020 has % procedure lines, expected the 28 seeded by 20260903000001.', r.lines;
  end if;
  if r.already_done then
    raise exception 'FSQM-020 already states that off-site storage is not used - this has run.';
  end if;
  if not r.old_part8 then
    raise exception 'FSQM-020 does not carry the off-site storage instruction this migration replaces.';
  end if;
  if not r.prereq_listed then
    raise exception 'FSQM-020 does not carry the prerequisite open item this migration withdraws.';
  end if;
end $$;

create temporary table fsqm020_before on commit drop as
select md5((content - 'procedure' - 'responsibility' - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'FSQM-020';

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(
                     jsonb_set(content, '{procedure}', $j20$["No finished product shall be made available for collection, or leave the site, until it has been released under this procedure.", "> Release is a decision, not a status that arrives by default. Product that has been made, packed and palletised is not released product until someone has checked it and said so on FRM-701.", "Release is authorised by the SQF Practitioner alone. No other role may release finished product.", "> SQF 2.4.7.1 requires release by authorised personnel. Here that is one person. Naming a second signature that does not exist would be a control in name only, and an auditor would test the separation of duties it implied.", "Product is released by batch or lot. Every release is recorded on FRM-701 Finished Product Release Record, one record per batch or lot.", "Before releasing a batch the SQF Practitioner shall confirm each of the following and record the result of each on FRM-701:", "• The batch sheet is complete and signed, and the formula, process steps and process controls were followed as specified.", "• The pre-operation and sanitation release for the line that produced the batch is recorded on FRM-903.", "• Neither the batch nor any ingredient in it is on Hold under FSQM-018, and no hold tag applies to it.", "• The label applied is the approved label for that product and that customer, verified against REP-602 Approved Label Register, and its allergen statement and any Gluten Free claim are correct for what was actually run.", "• The pack, the seal and the package integrity are correct for the specification.", "• The date and lot code are present, legible and correct.", "• A unit taken from the batch meets the product's appearance and sensory standard on examination.", "• The quantity and pack configuration match the customer's agreed specification.", "The site does not use positive release based on pathogen or chemical testing. No finished product is sent for laboratory testing before shipment, and none is held pending a result.", "> This is stated rather than left silent because SQF 2.4.7.3 applies only where such testing gates release, and a document that implies a testing gate it does not operate is worse than one that says plainly there is none.", "> If finished-product testing is ever introduced — a gluten result for certified Gluten Free product being the likely first, since the site is GFCO certified — this procedure shall be revised before that product ships, so that the hold-pending-result step exists before it is needed rather than after.", "Before a product's first release, and again whenever its label changes, the SQF Practitioner shall confirm that the label complies with the food law of the country of manufacture and, where it is known, of the country of sale.", "> The label control system does this work: labels are approved under SOP-2.3.2.3 Label Control on FRM-601, the approved version is held on REP-602 and changes are tracked on REP-603. This program does not repeat it. The release check confirms that the label actually applied is the approved one; this Part confirms that the approved one is lawful.", "Where product is supplied in bulk or unlabeled, the information a customer needs for its safe use — identity, allergens, lot code, date of manufacture, and storage and handling requirements — shall be provided to the customer with the consignment.", "The site does not use off-site or contract warehouses. Finished product is collected from the site by a carrier the customer arranges, and responsibility for the product passes to the customer on collection.", "> SQF 2.4.7.3 requires release requirements to be communicated to off-site or contract warehouses and verified as being followed, where such warehouses are used. They are not used here, so that requirement does not arise. This is stated rather than left silent, for the same reason Part 5 states that positive release on testing is not used: a reader should not have to work out for themselves which limbs of a clause apply to this site.", "> What collection does change is the timing. Release has to be complete before the carrier arrives, not while it waits on the dock. Once product is loaded it has left, and a release recorded afterwards records nothing.", "If any check fails, the batch shall not be released. It shall be placed on Hold under FSQM-018 Non-Conforming Product and Equipment, recorded on FRM-702, and dispositioned there.", "> A batch that fails a release check is non-conforming product. The release record ends at \"not released\" and the hold record takes over. A CAPA is raised under FSQM-009 where its Part 3 requires one.", "Released product may then be made available for collection. FRM-701 shall be completed and signed before that happens, not afterwards.", "Records are retained as set out in the Records section of this program."]$j20$::jsonb),
                     '{responsibility}', $r20$SQF Practitioner — the only person who may release finished product. Carries out the release checks, records them on FRM-701 and signs the release. Confirms that a product's label complies with applicable food law before its first release and again at every label change.
Quality Team — assembles the batch and process records the release check reads, and places on Hold any batch that fails a check.
Production staff — complete the batch sheet and the process records for every batch, so that there is something to check.
Admin — does not make any batch available for collection without a completed FRM-701, and confirms that the lot handed to the carrier is the lot released.
Management team — is notified of any batch not released, and is responsible for the resources release requires.$r20$::jsonb),
                   '{revision_history}', $h20$Rev New — written 2026-09-03 against SQF Food Safety Code: Food Manufacturing 2.4.7 Product Release, which is MANDATORY, and SQF Quality Code 2.4.7.1. DRAFT. Not approved, not in force.

WHY IT EXISTS. FSQM-018 named a "Positive Release Procedure" as the authority for the final disposition of reworked material, and no document of that name existed anywhere in the register — a Compass Blending reference that survived the scan. That citation was removed on 2026-09-02 when FSQM-018 gained a release step of its own, but the gap underneath it was real: the site had no documented method for releasing finished product at all, against an element the Food Manufacturing code marks Mandatory.

IT IS A PRODUCT RELEASE PROGRAM, NOT A POSITIVE RELEASE PROCEDURE, and the difference is deliberate. 2.4.7 has three limbs — release by authorised personnel after documented checks (2.4.7.1), confirmation that labels comply with food law (2.4.7.2), and positive release where testing gates it, plus off-site storage (2.4.7.3). A document written to the name FSQM-018 used would have closed the third limb and left the Mandatory element open.

WHAT THE SITE ACTUALLY DOES, confirmed 2026-09-03. Before a batch ships, the batch sheet is reviewed, the label is checked, and the packaging and the product itself are looked at. That already covers most of what Quality Code 2.4.7.1 lists. This program writes down what is already done and adds only what the clause requires on top — a named authority, a record, and the off-site storage rule. It does not invent a control nobody performs, because a control nobody performs is a finding waiting to be made.

NO POSITIVE RELEASE ON TESTING, AND THE DOCUMENT SAYS SO. No finished product is sent for laboratory testing before shipment and none is held pending a result. SQF 2.4.7.3 applies only where such testing gates release, so Part 5 states plainly that the practice is not used rather than leaving a reader to assume a gate exists. It also says what must happen before that changes: if finished-product testing is ever introduced — a gluten result for certified Gluten Free product being the likely first, since the site is GFCO certified — this procedure needs revising before that product ships, so the hold-pending-result step exists before it is needed rather than after.

OFF-SITE STORAGE DOES NOT APPLY — CORRECTED 2026-09-04. This program was drafted on 2026-09-03 on the understanding that product went both from our own dock and into customer-owned or third-party storage, and Part 8 accordingly required a written instruction to each storage location, reissued on change and confirmed annually. The CEO and Operations Manager confirmed on 2026-09-04 that this is not how it works: the customer arranges collection with their own carrier, and responsibility for the product passes to the customer once it leaves the facility. The site uses no off-site or contract warehouse. Part 8 now says so, in the same form Part 5 uses for positive release on testing, and the written instruction it required — which was recorded here as a prerequisite to issue — is withdrawn as an open item because there is nobody to issue it to.

WHAT THAT DOES NOT CHANGE, and it is worth saying because "no longer our responsibility" is easy to read more widely than it holds. Collection makes the timing of release SHARPER, not softer: the record has to be complete before the carrier arrives rather than before a transfer the site controls, because once product is loaded it has gone. And the passing of responsibility at the dock is a commercial fact about custody and risk, not a food-safety one — traceability, and any withdrawal or recall, still reach product after it has been collected. Neither is in this program's scope; both belong to the recall and withdrawal program, which does not yet exist.

LABEL COMPLIANCE IS REFERENCED, NOT REPEATED. Labels are approved under SOP-2.3.2.3 on FRM-601, the approved version is held on REP-602, and changes are tracked on REP-603. Restating that here would create a second copy to drift, which is how FSQM-018 and FSQM-019 came to name different authorities for rework. The release check confirms that the label applied is the approved one; Part 6 confirms that the approved one is lawful.

ONE PERSON RELEASES. 2.4.7.1 requires release by authorised personnel, and here that is the SQF Practitioner alone. Naming a second signature that does not exist would be a control in name only.

OPEN BEFORE ISSUE — two things the site must settle. Neither blocks issue; the one item that did was Part 8's written instruction, withdrawn on 2026-09-04 when the collection model was corrected:

1. There is no documented product sampling, inspection and analysis method (SQF 2.4.4.1), and no finished product specification in the register beyond SOP-2.3.1 New Product and Specification Process. The release check reads "the customer's agreed specification" and "the product's appearance and sensory standard". Confirm where those live, because this procedure points at them and an auditor will follow the pointer.

2. Part 7 requires safe-use information to travel with bulk or unlabeled product. Confirm whether the site ships any bulk or unlabeled product at all. If it does not, that Part should be removed at issue rather than describing something that never happens.
$h20$::jsonb)
 where sop_number = 'FSQM-020' and status = 'draft' and revision = 'New';

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
    (content->'procedure')::text like '%does not use off-site or contract warehouses%' as not_used,
    (content->'procedure')::text like '%carrier the customer arranges%'               as collection,
    (content->'procedure')::text like '%before the carrier arrives%'                  as timing,
    (content->'procedure')::text like '%made available for collection, or leave the site%'
                                                                                      as trigger_fixed,
    (content->'procedure')::text like '%off-site storage location shall be told%'     as old_part8,
    (content->'procedure')::text like '%shipped, collected or transferred%'           as old_part10,
    (content->>'responsibility') like '%lot handed to the carrier is the lot released%'
                                                                                      as admin_role,
    (content->>'responsibility') like '%off-site storage location%'                   as admin_stale,
    -- the two limbs the site does not operate are both STATED, not left silent
    (content->'procedure')::text like '%does not use positive release based on pathogen or chemical testing%'
                                                                                      as no_testing,
    (content->>'revision_history') like '%CORRECTED 2026-09-04%'                      as correction_noted,
    (content->>'revision_history') like '%withdrawn as an open item%'                 as prereq_withdrawn,
    (content->>'revision_history') like '%prerequisite rather than a question%'        as prereq_stale,
    (content->>'revision_history') like '%still reach product after it has been collected%'
                                                                                      as recall_caveat,
    -- nothing earlier undone
    (content->'procedure')::text like '%authorised by the SQF Practitioner alone%'     as authority,
    (content->'procedure')::text like '%placed on Hold under FSQM-018%'                as hold_path
  into r
  from public.sop_documents where sop_number = 'FSQM-020';

  select b.h = md5((d.content - 'procedure' - 'responsibility' - 'revision_history')::text)
    into untouched
    from public.sop_documents d, fsqm020_before b where d.sop_number = 'FSQM-020';

  if r.lines <> 27 or r.steps <> 11 or r.bullets <> 8 or r.prose <> 8 then
    raise exception 'FSQM-020 body wrong shape: % / % / % / % (expected 27 / 11 / 8 / 8).',
      r.lines, r.steps, r.bullets, r.prose;
  end if;
  if r.steps + r.bullets + r.prose <> r.lines then
    raise exception 'A line has no recognised form: % + % + % <> %.',
      r.steps, r.bullets, r.prose, r.lines;
  end if;
  if not (r.not_used and r.collection and r.timing and r.trigger_fixed) then
    raise exception 'Correction incomplete: not-used=%, collection=%, timing=%, Part 1 trigger=%.',
      r.not_used, r.collection, r.timing, r.trigger_fixed;
  end if;
  if r.old_part8 or r.old_part10 or r.admin_stale then
    raise exception 'The off-site practice survives: Part 8=%, Part 10=%, Responsibility=%.',
      r.old_part8, r.old_part10, r.admin_stale;
  end if;
  if not (r.admin_role and r.no_testing) then
    raise exception 'Admin duty=%, positive-release statement=%.', r.admin_role, r.no_testing;
  end if;
  if not (r.correction_noted and r.prereq_withdrawn and r.recall_caveat) then
    raise exception 'Revision history incomplete: correction=%, prerequisite withdrawn=%, recall caveat=%.',
      r.correction_noted, r.prereq_withdrawn, r.recall_caveat;
  end if;
  if r.prereq_stale then
    raise exception 'The open list still calls an item a prerequisite - it was withdrawn.';
  end if;
  if not (r.authority and r.hold_path) then
    raise exception 'Earlier work undone: sole authority=%, hold path=%.', r.authority, r.hold_path;
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-020 is now % - this migration must not issue it.', r.status;
  end if;
  if not untouched then
    raise exception 'A section other than the three written changed. Rolled back.';
  end if;
end $$;

commit;
