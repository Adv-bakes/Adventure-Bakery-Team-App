-- FSQM-020 Product Release Program. Seeded draft. Closes SQF 2.4.7, which is MANDATORY.
--
-- WHY IT EXISTS. FSQM-018 named a "Positive Release Procedure" as the authority for the final
-- disposition of reworked material, and no document of that name existed anywhere in the register -
-- a Compass Blending reference that survived the scan. The citation was removed on 2026-09-02 when
-- FSQM-018 gained a release step of its own, but the gap underneath it was real: the site had no
-- documented method for releasing finished product at all.
--
-- IT IS A PRODUCT RELEASE PROGRAM, NOT A POSITIVE RELEASE PROCEDURE, and the difference is the
-- reason to read this. 2.4.7 has three limbs: release by authorised personnel after documented
-- checks (2.4.7.1), confirmation that labels comply with food law (2.4.7.2), and positive release
-- where testing gates it plus off-site storage (2.4.7.3). A document written to the name FSQM-018
-- used would have closed the third limb and left the Mandatory element open.
--
-- IT WRITES DOWN WHAT THE SITE ALREADY DOES. Confirmed 2026-09-03: before a batch ships, the batch
-- sheet is reviewed, the label is checked, and the packaging and the product itself are looked at.
-- That is most of what Quality Code 2.4.7.1 lists. The program adds only what the clause requires
-- on top - a named authority, a record, and the off-site storage rule - because a control nobody
-- performs is a finding waiting to be made, and long generic drafts do not survive contact with
-- the floor.
--
-- NO POSITIVE RELEASE ON TESTING, STATED RATHER THAN LEFT SILENT. No finished product goes to a lab
-- before shipment and none is held pending a result. 2.4.7.3 applies only where such testing gates
-- release, so Part 5 says the practice is not used - and says what has to happen before that
-- changes, a gluten result for certified Gluten Free product being the likely first since the site
-- is GFCO certified. A document implying a gate it does not operate is worse than one with none.
--
-- OFF-SITE STORAGE IS THE LIMB THAT DOES APPLY. Product goes both from our dock and into
-- customer-owned or third-party storage as tolling stock. Stock outside the site's physical control
-- could be drawn down before it was released, and the site would have released nothing. Part 8
-- requires release BEFORE transfer, a written instruction that only released stock may be drawn,
-- and an annual confirmation that it is followed.
--
-- LABEL COMPLIANCE IS REFERENCED, NOT REPEATED. Labels are approved under SOP-2.3.2.3 on FRM-601,
-- the approved version sits on REP-602, changes track on REP-603. Restating that here would create
-- a second copy to drift - which is exactly how FSQM-018 and FSQM-019 came to name different
-- authorities for rework.
--
-- SEEDED DRAFT, with three items in the Revision History. The third is a prerequisite rather than a
-- question: Part 8's written instruction to off-site storage locations does not yet exist and the
-- locations are not named, so that Part is unperformable until they have it. Do not issue this
-- document until it does.
--
-- Every form and program it references is asserted to exist and be active below.

begin;

do $$
declare
  n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-020';
  if n <> 0 then
    raise exception 'FSQM-020 already exists.';
  end if;
  -- an active procedure must not point at documents that are missing or withdrawn
  select count(*) into n from public.sop_documents
   where sop_number in ('FRM-702','FRM-903','FRM-601','REP-602','REP-603','FSQM-018','FSQM-009',
                        'SOP-2.3.2.3','SOP-2.3.2','SOP-2.3.1')
     and status = 'active';
  if n <> 10 then
    raise exception 'Only % of the 10 documents FSQM-020 references are active.', n;
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FSQM-020',
  'Product Release Program',
  'fsqm',
  'Food Safety Quality Manual',
  'draft',
  'New',
  '2.4.7.1, 2.4.7.2, 2.4.7.3',
  true,
  $j020${"purpose": "This program defines the responsibility and the method for releasing finished product at Adventure Bakery. It is the positive product release procedure required by SQF Quality Code 2.4.7.1, and it satisfies the Product Release element of the SQF Food Safety Code: Food Manufacturing (2.4.7), which is Mandatory.", "scope": "All finished product manufactured at Adventure Bakery, however it leaves the site: shipped from our dock, collected by the customer, or transferred into customer-owned or third-party storage.\n\nIt does not cover the receipt and acceptance of incoming raw materials and packaging, which are handled under SOP-2.3.2 Raw and Packaging Materials, nor the disposition of material placed on Hold, which is handled under FSQM-018 Non-Conforming Product and Equipment and recorded on FRM-702. A batch that fails a check in this program becomes non-conforming product and passes to FSQM-018.", "definitions": "Release: the decision by the SQF Practitioner that a batch of finished product meets its specification and all applicable customer, regulatory and company requirements, and may leave the site.\n\nReleased product: product for which that decision has been made and recorded on FRM-701. Product that has been made, packed and palletised is not released product until that record exists.\n\nPositive release: withholding product from release until a required result has been received. Adventure Bakery does not operate positive release based on pathogen or chemical testing — see Part 5.", "responsibility": "SQF Practitioner — the only person who may release finished product. Carries out the release checks, records them on FRM-701 and signs the release. Confirms that a product's label complies with applicable food law before its first release and again at every label change.\nQuality Team — assembles the batch and process records the release check reads, and places on Hold any batch that fails a check.\nProduction staff — complete the batch sheet and the process records for every batch, so that there is something to check.\nAdmin — does not ship, make available for collection, or transfer to off-site storage any batch without a completed FRM-701, and issues the release requirement in writing to each off-site storage location.\nManagement team — is notified of any batch not released, and is responsible for the resources release requires.", "procedure": ["No finished product shall be shipped, made available for collection, or transferred into off-site storage until it has been released under this procedure.", "> Release is a decision, not a status that arrives by default. Product that has been made, packed and palletised is not released product until someone has checked it and said so on FRM-701.", "Release is authorised by the SQF Practitioner alone. No other role may release finished product.", "> SQF 2.4.7.1 requires release by authorised personnel. Here that is one person. Naming a second signature that does not exist would be a control in name only, and an auditor would test the separation of duties it implied.", "Product is released by batch or lot. Every release is recorded on FRM-701 Finished Product Release Record, one record per batch or lot.", "Before releasing a batch the SQF Practitioner shall confirm each of the following and record the result of each on FRM-701:", "• The batch sheet is complete and signed, and the formula, process steps and process controls were followed as specified.", "• The pre-operation and sanitation release for the line that produced the batch is recorded on FRM-903.", "• Neither the batch nor any ingredient in it is on Hold under FSQM-018, and no hold tag applies to it.", "• The label applied is the approved label for that product and that customer, verified against REP-602 Approved Label Register, and its allergen statement and any Gluten Free claim are correct for what was actually run.", "• The pack, the seal and the package integrity are correct for the specification.", "• The date and lot code are present, legible and correct.", "• A unit taken from the batch meets the product's appearance and sensory standard on examination.", "• The quantity and pack configuration match the customer's agreed specification.", "The site does not use positive release based on pathogen or chemical testing. No finished product is sent for laboratory testing before shipment, and none is held pending a result.", "> This is stated rather than left silent because SQF 2.4.7.3 applies only where such testing gates release, and a document that implies a testing gate it does not operate is worse than one that says plainly there is none.", "> If finished-product testing is ever introduced — a gluten result for certified Gluten Free product being the likely first, since the site is GFCO certified — this procedure shall be revised before that product ships, so that the hold-pending-result step exists before it is needed rather than after.", "Before a product's first release, and again whenever its label changes, the SQF Practitioner shall confirm that the label complies with the food law of the country of manufacture and, where it is known, of the country of sale.", "> The label control system does this work: labels are approved under SOP-2.3.2.3 Label Control on FRM-601, the approved version is held on REP-602 and changes are tracked on REP-603. This program does not repeat it. The release check confirms that the label actually applied is the approved one; this Part confirms that the approved one is lawful.", "Where product is supplied in bulk or unlabeled, the information a customer needs for its safe use — identity, allergens, lot code, date of manufacture, and storage and handling requirements — shall be provided to the customer with the consignment.", "Product destined for customer-owned or third-party storage shall be released before it is transferred, not after it arrives.", "• Each off-site storage location shall be told in writing that only product released by Adventure Bakery may be drawn from that stock.", "• That instruction shall be reissued whenever the storage arrangement changes, and confirmation that it is being followed shall be sought at least annually and recorded.", "> Stock held outside the site's physical control could otherwise be drawn down by the customer before it was released, and the site would have released nothing. This is the limb of SQF 2.4.7.3 that does apply here.", "If any check fails, the batch shall not be released. It shall be placed on Hold under FSQM-018 Non-Conforming Product and Equipment, recorded on FRM-702, and dispositioned there.", "> A batch that fails a release check is non-conforming product. The release record ends at \"not released\" and the hold record takes over. A CAPA is raised under FSQM-009 where its Part 3 requires one.", "Released product may then be shipped, collected or transferred. FRM-701 shall be completed and signed before that happens, not afterwards.", "Records are retained as set out in the Records section of this program."], "form_references": "FRM-701 Finished Product Release Record; FRM-702 Non-Conforming Material Hold & Tagging Record; FRM-903 Daily Sanitation, Pre-Operation & Release Record; FRM-601 Label Review & Approval Form; REP-602 Approved Label Register; batch sheets", "records": "FRM-701 Finished Product Release Record — one per batch or lot released, carrying every release check, the label verification, the release decision and the signature of the person who made it. This is the record of product release that SQF 2.4.7.1 and Quality Code 2.4.7.2 require.\nFRM-702 Non-Conforming Material Hold & Tagging Record — where a batch fails a release check and is held instead of released.\nFRM-903 Daily Sanitation, Pre-Operation & Release Record — the line release the batch was produced against.\nREP-602 Approved Label Register — the approved label the applied label is verified against.\nBatch sheets — the production record the release check reads.\nRetention: two years, or the shelf life of the product plus twelve months, whichever is longer. This is the period set by FSQM-009 Part 10, so a release, a hold arising from it and any investigation that follows are retained on the same basis.", "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.4.7 Product Release (Mandatory); 2.4.7.1 responsibility and methods; 2.4.7.2 label compliance; 2.4.7.3 positive release and off-site storage.\nSQF Quality Code, Edition 9 — 2.4.7.1 positive product release; 2.4.7.2 records of product release or disposition.\nSOP-2.3.2.3 Label Control — the approval of labels, which this program verifies against rather than repeats.\nFSQM-018 Non-Conforming Product and Equipment — where a batch that fails a release check is held and dispositioned.\nFSQM-009 Corrective and Preventive Action (CAPA) Program — where a release failure meets one of its Part 3 triggers.", "revision_history": "Rev New — written 2026-09-03 against SQF Food Safety Code: Food Manufacturing 2.4.7 Product Release, which is MANDATORY, and SQF Quality Code 2.4.7.1. DRAFT. Not approved, not in force.\n\nWHY IT EXISTS. FSQM-018 named a \"Positive Release Procedure\" as the authority for the final disposition of reworked material, and no document of that name existed anywhere in the register — a Compass Blending reference that survived the scan. That citation was removed on 2026-09-02 when FSQM-018 gained a release step of its own, but the gap underneath it was real: the site had no documented method for releasing finished product at all, against an element the Food Manufacturing code marks Mandatory.\n\nIT IS A PRODUCT RELEASE PROGRAM, NOT A POSITIVE RELEASE PROCEDURE, and the difference is deliberate. 2.4.7 has three limbs — release by authorised personnel after documented checks (2.4.7.1), confirmation that labels comply with food law (2.4.7.2), and positive release where testing gates it, plus off-site storage (2.4.7.3). A document written to the name FSQM-018 used would have closed the third limb and left the Mandatory element open.\n\nWHAT THE SITE ACTUALLY DOES, confirmed 2026-09-03. Before a batch ships, the batch sheet is reviewed, the label is checked, and the packaging and the product itself are looked at. That already covers most of what Quality Code 2.4.7.1 lists. This program writes down what is already done and adds only what the clause requires on top — a named authority, a record, and the off-site storage rule. It does not invent a control nobody performs, because a control nobody performs is a finding waiting to be made.\n\nNO POSITIVE RELEASE ON TESTING, AND THE DOCUMENT SAYS SO. No finished product is sent for laboratory testing before shipment and none is held pending a result. SQF 2.4.7.3 applies only where such testing gates release, so Part 5 states plainly that the practice is not used rather than leaving a reader to assume a gate exists. It also says what must happen before that changes: if finished-product testing is ever introduced — a gluten result for certified Gluten Free product being the likely first, since the site is GFCO certified — this procedure needs revising before that product ships, so the hold-pending-result step exists before it is needed rather than after.\n\nOFF-SITE STORAGE IS THE REAL WORK HERE. Product goes both from our own dock and into customer-owned or third-party storage as tolling stock. Stock outside the site's physical control could be drawn down by the customer before it was released, and the site would have released nothing. Part 8 therefore requires release BEFORE transfer, a written instruction to each storage location that only released stock may be drawn, and an annual confirmation that this is being followed. This is the limb of 2.4.7.3 that does apply here.\n\nLABEL COMPLIANCE IS REFERENCED, NOT REPEATED. Labels are approved under SOP-2.3.2.3 on FRM-601, the approved version is held on REP-602, and changes are tracked on REP-603. Restating that here would create a second copy to drift, which is how FSQM-018 and FSQM-019 came to name different authorities for rework. The release check confirms that the label applied is the approved one; Part 6 confirms that the approved one is lawful.\n\nONE PERSON RELEASES. 2.4.7.1 requires release by authorised personnel, and here that is the SQF Practitioner alone. Naming a second signature that does not exist would be a control in name only.\n\nOPEN BEFORE ISSUE — three things the site must settle, and the third is a prerequisite rather than a question:\n\n1. There is no documented product sampling, inspection and analysis method (SQF 2.4.4.1), and no finished product specification in the register beyond SOP-2.3.1 New Product and Specification Process. The release check reads \"the customer's agreed specification\" and \"the product's appearance and sensory standard\". Confirm where those live, because this procedure points at them and an auditor will follow the pointer.\n\n2. Part 7 requires safe-use information to travel with bulk or unlabeled product. Confirm whether the site ships any bulk or unlabeled product at all. If it does not, that Part should be removed at issue rather than describing something that never happens.\n\n3. Part 8's written instruction to off-site storage locations DOES NOT YET EXIST, and the locations are not named. Confirm which locations hold Adventure Bakery product and issue the instruction to each. That Part is unperformable until they have it, so this is a prerequisite to issue and not a question to carry."}$j020$::jsonb
);

do $$
declare
  r record;
begin
  select status, revision, type, sqf_required, sqf_reference,
    jsonb_array_length(content->'procedure')                                          as lines,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s not like '• %' and s not like '> %')                                    as steps,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '• %')                                                             as bullets,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '> %')                                                             as prose,
    (select coalesce(max(length(s)),0) from jsonb_array_elements_text(content->'procedure') s)
                                                                                      as longest,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where regexp_replace(s, '^(• |> )', '') ~ '^\s*\d+(\.\d+)*[.)]?\s')          as numbered,
    (content->'procedure')::text like '%does not use positive release based on pathogen or chemical testing%'
                                                                                      as no_positive_release,
    (content->'procedure')::text like '%released before it is transferred, not after it arrives%'
                                                                                      as offsite_before,
    (content->'procedure')::text like '%only product released by Adventure Bakery may be drawn%'
                                                                                      as offsite_instruction,
    (content->'procedure')::text like '%authorised by the SQF Practitioner alone%'     as single_authority,
    (content->'procedure')::text like '%FRM-701%'                                     as names_record,
    (content->'procedure')::text like '%REP-602 Approved Label Register%'             as label_register,
    (content->'procedure')::text like '%placed on Hold under FSQM-018%'               as failure_path,
    (content->>'records') like '%Retention%'                                          as retention,
    (content->>'governing_reference') like '%Mandatory%'                              as mandatory_noted,
    (content->>'revision_history') like '%OPEN BEFORE ISSUE%'                          as open_items,
    (content->>'revision_history') like '%prerequisite to issue%'                      as prerequisite,
    (select count(*) from unnest(array['SQF Practitioner','Quality Team','Production staff',
                                       'Admin','Management team']) rn
      where strpos(content->>'responsibility', rn) = 0)                               as roles_missing
  into r
  from public.sop_documents where sop_number = 'FSQM-020';

  if r.status <> 'draft' or r.revision <> 'New' or r.type <> 'fsqm' or not r.sqf_required then
    raise exception 'FSQM-020 seeded wrong: % / % / % / sqf_required=%.',
      r.status, r.revision, r.type, r.sqf_required;
  end if;
  if r.sqf_reference is distinct from '2.4.7.1, 2.4.7.2, 2.4.7.3' then
    raise exception 'sqf_reference is %, expected 2.4.7.1, 2.4.7.2, 2.4.7.3.', coalesce(r.sqf_reference,'null');
  end if;
  if r.lines <> 28 or r.steps <> 11 or r.bullets <> 10 or r.prose <> 7 then
    raise exception 'FSQM-020 body wrong shape: % / % / % / % (expected 28 / 11 / 10 / 7).',
      r.lines, r.steps, r.bullets, r.prose;
  end if;
  if r.steps + r.bullets + r.prose <> r.lines then
    raise exception 'A line has no recognised form: % + % + % <> %.',
      r.steps, r.bullets, r.prose, r.lines;
  end if;
  if r.numbered <> 0 then
    raise exception '% procedure lines carry their own step number.', r.numbered;
  end if;
  if not (r.no_positive_release and r.offsite_before and r.offsite_instruction) then
    raise exception '2.4.7.3 not covered: testing statement=%, release before transfer=%, written instruction=%.',
      r.no_positive_release, r.offsite_before, r.offsite_instruction;
  end if;
  if not (r.single_authority and r.names_record and r.label_register and r.failure_path) then
    raise exception '2.4.7.1/.2 not covered: sole authority=%, FRM-701=%, REP-602=%, failure path=%.',
      r.single_authority, r.names_record, r.label_register, r.failure_path;
  end if;
  if not (r.retention and r.mandatory_noted and r.open_items and r.prerequisite) then
    raise exception 'Sections incomplete: retention=%, Mandatory noted=%, open items=%, prerequisite flagged=%.',
      r.retention, r.mandatory_noted, r.open_items, r.prerequisite;
  end if;
  if r.roles_missing <> 0 then
    raise exception '% of the five roles have no duties in Responsibility.', r.roles_missing;
  end if;
  if r.longest > 700 then
    raise exception 'The longest procedure line is % characters.', r.longest;
  end if;
end $$;

commit;
