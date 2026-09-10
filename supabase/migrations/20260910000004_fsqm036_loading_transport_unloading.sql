-- FSQM-036 Loading, Transport and Unloading Program. Seeded DRAFT.
-- Closes D-35 tasks 35.1, 35.2 and most of 35.5 (SQF Food Manufacturing Ed 9, 11.6.5).
--
-- THE AMBIENT DETERMINATION IS THE POINT OF PART 3. The owner confirmed on 2026-09-10 that every
-- finished product ships ambient. That records 11.6.5.5, .6 and .7 as a
-- justified Not Applicable and removes task 35.6 from the deliverable, exactly as the plan
-- anticipated. It is written into the programme rather than filed as a loose determination, so an
-- auditor reading 11.6.5 finds it in the document that governs the subject - the same mechanism
-- FSQM-014 used to record 2.4.4.3 and .4 for want of a laboratory.
--
-- TWO THINGS THE DETERMINATION IS MADE NOT TO SAY, because both are easy to infer and wrong.
-- It does not say the site has no refrigeration: a freezer remains in service under SOP-401, and
-- refrigerated STORAGE is 11.6.2, closed by D-34. And it does not say ambient is the absence of a
-- condition - 11.6.5.1 requires practices that maintain the storage conditions of the food, so
-- ambient is a specified condition and product must still not be exposed to heat, damp or sun in
-- transit. Treating ambient as nothing-to-control is the usual way this clause is failed.
--
-- THE VACUUM SEAL IS THE TAMPER-EVIDENT BARRIER, AND THE VEHICLE SEAL IS A DIFFERENT QUESTION.
-- Product is vacuum sealed, boxed as a single serving, and closed with a clear tape disc over the
-- box opening. That is a strong position and Part 5 says so: a vacuum pack cannot be opened and
-- re-closed without equipment, and a lost vacuum is visible. But 11.6.5.3 is about securing the
-- VEHICLE from tampering, not the retail unit, and conflating the two would close the clause on
-- evidence that does not address it. Part 6 states both and leaves the vehicle question open.
--
-- EVERY DESPATCH IS A COLLECTION. FSQM-020, active since 2026-09-04, records that the site uses no
-- off-site or contract warehouse and that product is collected by a carrier the customer arranges,
-- responsibility passing on collection. The first draft of this program described three despatch
-- modes taken from the FRM-701 SEED FILE - which was amended twice afterwards and no longer has a
-- Destination field at all - and would have re-added a limb FSQM-020 deliberately removed. The guard
-- below now checks the LIVE document, which is what caught it.
--
-- THAT SHARPENS PART 4 RATHER THAN WEAKENING IT: because every load leaves in a vehicle the site does
-- not own, the vehicle check IS this site's transport control, and responsibility passing on
-- collection does not reach backwards to the moment of loading.
--
-- FRM-801 IS SEEDED BY THE SIBLING MIGRATION and is deliberately absent from the must-be-active
-- guard below: this programme may cite a record that is still draft while both are draft, which is
-- how FSQM-014 and FRM-703 were seeded on 2026-09-09.
--
-- SEEDED DRAFT with three open items. The dock description comes from the owner's account rather
-- than from an inspection, and Part 5 says so.

begin;

do $$
declare n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-036';
  if n <> 0 then
    raise exception 'FSQM-036 already exists.';
  end if;
  select count(*) into n from public.sop_documents
   where sop_number in ('FRM-301','FRM-701','FSQM-018','FSQM-020','SOP-401')
     and status = 'active';
  if n <> 5 then
    raise exception 'Only % of the 5 documents FSQM-036 references are active.', n;
  end if;
  -- Part 1 restates FSQM-020's collection model. If that document ever stops saying it, Part 1 is
  -- describing a despatch arrangement the site does not operate - the defect this workstream exists
  -- to remove. Checking the LIVE document is also what caught the first draft describing three modes.
  select count(*) into n from public.sop_documents
   where sop_number = 'FSQM-020' and status = 'active'
     and (content->'procedure')::text like '%collected from the site by a carrier the customer arranges%'
     and (content->'procedure')::text like '%does not use off-site or contract warehouses%';
  if n <> 1 then
    raise exception 'FSQM-020 no longer records the collection model Part 1 restates; re-read Part 1.';
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FSQM-036',
  'Loading, Transport and Unloading Program',
  'fsqm',
  'Food Safety Quality Manual',
  'draft',
  'New',
  '11.6.5.1, 11.6.5.2, 11.6.5.3, 11.6.5.4, 11.6.5.8',
  true,
  $j036${"purpose": "This program states how finished product is loaded, transported and unloaded so that its storage conditions are maintained, cross-contamination is prevented and its exposure is minimised. It records which of the requirements of 11.6.5 apply to this site and which do not, and why. It satisfies the Loading, Transport and Unloading element of the SQF Food Safety Code: Food Manufacturing, Edition 9 (11.6.5).", "scope": "Every despatch of finished product from the site, all of which leave by collection, and the unloading of incoming material at receipt.\n\nIt does not cover the release decision that must precede any despatch, which is FSQM-020 Product Release Program; the incoming inspection itself, which is recorded on FRM-301; the temperature-controlled storage of product on site, which is SOP-401; or the disposition of anything found unfit, which is FSQM-018.", "definitions": "Despatch: one vehicle-load leaving the site. A despatch may carry several batches; it is one despatch.\n\nCollection: the only way finished product leaves this site. A carrier the customer arranges collects from the site, and responsibility for the product passes to the customer on collection.\n\nAmbient: the storage condition of a product that requires no chilling or freezing. It is a specified condition and not the absence of one - product held ambient must still be protected from heat, damp, direct sun and contamination.\n\nVehicle check: the examination of a collecting vehicle before it is loaded, to establish that it is fit to carry food.", "responsibility": "SQF Practitioner — owns this program. Decides release under FSQM-020 before any despatch, and may stop a despatch. Reviews the despatch records.\nProduction Supervisor — ensures the vehicle check is performed before loading and that a vehicle that fails it is not loaded.\nProduction staff — carry out the vehicle check and the loading, and complete FRM-801.\nAdmin — arranges carriage and gives the carrier or the collecting customer the site's loading requirements.\nSenior Site Management — provides the resources loading and despatch require, and is notified where a despatch is stopped.", "procedure": ["Finished product leaves this site by collection, and by no other route. A carrier the customer arranges collects from the site, and responsibility for the product passes to the customer on collection.", "> This is the model FSQM-020 records. The site operates no delivery fleet, engages no carriers of its own, and uses no off-site or contract warehouse. Stating it here rather than leaving it implied is what makes the rest of this program readable: several requirements of 11.6.5 concern a journey this site does not make.", "> What the site controls is the vehicle and the loading; what it does not control is the journey after collection. That is not a gap to be apologised for. 11.6.5.2 governs vehicles used to transport food FROM the site, which is precisely the collecting vehicle, so the check in Part 4 is not an edge case for an unusual despatch. It is the whole of this site's transport control, applied to every load that leaves.", "• Before a collection, the customer or the carrier shall be told the product's storage requirement, which is ambient, and the condition the vehicle must be in to be loaded.", "> Telling them in advance is the difference between a standard and an argument on the dock, and it is the site's only opportunity to influence a journey it does not control.", "No despatch shall leave the site before the product on it has been released under FSQM-020.", "> FSQM-020 already forbids product being made available for collection before release, and repeating it here is deliberate: loading is the moment at which an unreleased pallet is most easily taken, and once the vehicle has gone a release recorded afterwards records nothing.", "Every finished product made by this site ships ambient. No product is carried under chilled or frozen conditions, for any customer.", "> Confirmed by the owner on 2026-09-10. Three requirements of 11.6.5 govern refrigerated transport and on this determination they do not arise, and are recorded Not Applicable: 11.6.5.5, that refrigerated units maintain the product at its required temperature; 11.6.5.6, that the unit is operational at all times and checked; and 11.6.5.7, that the vehicle's refrigeration temperature is checked on arrival before the doors are opened.", "> This determination says nothing about refrigeration on the site. A freezer remains in service under SOP-401, and the storage of product under temperature control is governed by 11.6.2 rather than by this program. What is determined here is narrow and is only about carriage: nothing leaves this site under temperature control.", "> Ambient is a specified condition, not the absence of one. 11.6.5.1 requires practices that maintain the storage conditions of the food, and product carried ambient must still be protected from heat, damp, direct sun and contamination. Treating ambient as nothing to control is the usual way this requirement is failed, and Parts 5 and 6 exist because of it.", "> What would reverse this: if any product requiring chilled or frozen carriage is introduced, whether a new product, a reformulation, or a customer requiring temperature-controlled delivery of an existing one, this program shall be revised and the controls of 11.6.5.5 to .7 implemented BEFORE that product first ships. The revision comes first. A control that arrives after the event it exists to control is not a control.", "No vehicle shall be loaded until it has been checked and found fit to carry food, and the check shall be recorded on FRM-801.", "• The load space shall be clean, dry and free of odour, free of pest activity and of residue from a previous load, and sound enough to keep weather out.", "• Where the previous load is known to have been a non-food material, the vehicle shall not be loaded.", "• A vehicle that fails the check shall not be loaded. The refusal and its reason shall be recorded, and the collection shall not proceed until a fit vehicle is provided.", "> The vehicle belongs to the customer or to a carrier the customer arranges, and it is checked anyway. 11.6.5.2 does not distinguish by who owns the vehicle, and the reason is plain once stated: if a vehicle arrives dirty or carrying an odour it is this site's product that would be affected, and this site's control that failed. Responsibility passing on collection does not reach backwards to the moment of loading.", "Product shall be transferred from the building into the vehicle without being exposed to weather or contamination, and the load shall be secured so that packaging is not damaged.", "• Product does not cross open ground between the building and the vehicle, so it is not exposed to weather while it is being loaded.", "• Product shall not be placed directly on the ground or on an unclean surface at any point.", "• The load shall be stacked and restrained so that packaging is not crushed, punctured or abraded.", "> The loading arrangement recorded above is as described by the site rather than as inspected, and confirming it on the floor is an open item of this program. If any part of the transfer is in fact open to weather, this Part is wrong and shall be corrected before issue.", "The product's own barrier is the vacuum seal, and the security of the vehicle is a separate matter.", "> Finished product is vacuum sealed, boxed as a single serving, and closed with a clear tape disc over the box opening. The vacuum seal is the barrier that matters: it cannot be opened and re-closed without equipment, and a lost vacuum is visible to anyone handling the pack. The box and its tape are presentation and closure.", "> That is not what 11.6.5.3 asks for. The requirement is that the VEHICLE be secured from tampering, using seals or another agreed method, and a tamper-evident retail pack does not meet it. Recording the pack's integrity as though it satisfied 11.6.5.3 would close the requirement on evidence that does not address it, so the two are stated separately and the vehicle question is carried as an open item.", "• Where a seal or other agreed method is used, its identifier shall be recorded on FRM-801 against the despatch.", "Incoming loads shall be unloaded promptly and without unnecessary exposure, and the vehicle and the material shall be inspected at receipt as required by FRM-301.", "> FRM-301 already records the condition of the delivering vehicle at receipt, so this program does not create a second route for the same check. Anything found unfit is held under FSQM-018.", "Records are retained as set out in the Records section of this program.", "The SQF Practitioner shall review this program at least annually, and whenever the products shipped, the collection arrangements or the loading area change.", "> The determination in Part 3 is the part most likely to go stale, because it will be a new product or a new customer requirement that reverses it, and neither of those announces itself to this document."], "form_references": "FRM-801 Despatch and Vehicle Loading Record; FRM-701 Finished Product Release Record; FRM-301 Incoming Material Receiving & Inspection Log; FRM-702 Non-Conforming Material Hold & Tagging Record", "records": "FRM-801 Despatch and Vehicle Loading Record — one record per vehicle-load: the vehicle check, the loading confirmation, any seal identifier, the collecting carrier and the batches loaded.\nFRM-701 Finished Product Release Record — the release that must precede every collection.\nFRM-301 Incoming Material Receiving & Inspection Log — the vehicle and material inspection at receipt.\nFRM-702 Non-Conforming Material Hold & Tagging Record — where a load or a delivery is refused or held.\nThere are no refrigerated transport records, because no product is carried under temperature control — see Part 3.\nRetention: two years, or the shelf life of the product plus twelve months, whichever is longer, on the same basis as FSQM-009 Part 10.", "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.6.5 Loading, Transport, and Unloading. 11.6.5.1 documented practices maintaining storage conditions and preventing cross-contamination; 11.6.5.2 vehicles fit to carry food; 11.6.5.3 vehicles secured from tampering; 11.6.5.4 loading docks designed to protect product; 11.6.5.8 unloading practices minimising exposure.\n11.6.5.5, 11.6.5.6 and 11.6.5.7 govern refrigerated transport. No product of this site is carried under temperature control, and all three are recorded Not Applicable on that basis — see Part 3.\n11.6.5.1 also reaches the transport itself. Every despatch from this site is a collection and responsibility passes to the customer at that point, so the practices this site can document and implement are those of loading, of the condition of the vehicle it loads, and of what it tells the carrier beforehand. That limb is met by Parts 1, 4, 5 and 6 rather than by controls over a journey the site does not make.\n11.6.2 Temperature-Controlled Storage, and SOP-401 — the storage of product under temperature control, which this program does not cover and does not contradict.\nFSQM-020 Product Release Program — the release that must precede every collection, and the document that records the collection model.\nFSQM-018 Non-Conforming Product and Equipment — where a refused load or delivery is held.", "revision_history": "Rev New — written 2026-09-10 against SQF Food Safety Code: Food Manufacturing, Edition 9, 11.6.5 Loading, Transport, and Unloading. DRAFT. Not approved, not in force.\n\nWHY IT EXISTS. The gap assessment scored eight findings across 11.6.5 and no controlled document covered loading, transport or unloading at all. Before this, nothing in the document set cited 11.6.5.\n\nTHE AMBIENT DETERMINATION. The owner confirmed on 2026-09-10 that every finished product ships ambient, which records 11.6.5.5, .6 and .7 Not Applicable and removes task 35.6 from the deliverable. It is written into Part 3 rather than filed separately, so that a reader looking for 11.6.5 finds the determination in the document that governs the subject — the mechanism FSQM-014 used for 2.4.4.3 and .4.\n\nPart 3 is written to prevent two wrong inferences. It does not say the site has no refrigeration: a freezer remains in service under SOP-401 and refrigerated storage is 11.6.2, which D-34 closed. And it does not say ambient is the absence of a condition: 11.6.5.1 requires the storage conditions of the food to be maintained, so product carried ambient must still be protected from heat, damp and sun. The reversal trigger is stated in the same terms FSQM-014 Part 2 uses for introducing analysis — the programme is revised before the first such product ships, not after.\n\nTHE VACUUM SEAL AND THE VEHICLE SEAL ARE DIFFERENT QUESTIONS. Product is vacuum sealed, boxed as a single serving and closed with a clear tape disc. The vacuum pack is a genuine tamper-evident barrier and Part 6 says so. But 11.6.5.3 is about securing the VEHICLE, and recording the pack's integrity as though it satisfied the requirement would close it on evidence that does not address it. The two are stated separately and the vehicle question is open.\n\nEVERY DESPATCH IS A COLLECTION, AND THE FIRST DRAFT GOT THAT WRONG. It described three despatch modes taken from the FRM-701 seed file. FRM-701 was amended twice after seeding and no longer carries a Destination field at all, and FSQM-020 - active since 2026-09-04 - records that the site uses no off-site or contract warehouse and that finished product is collected by a carrier the customer arranges, responsibility passing on collection. Describing a mode the site does not operate would have re-added a limb FSQM-020 deliberately removed. Corrected before seeding, and caught by a guard that checked the live document rather than trusting the file it had been seeded from.\n\nThe correction sharpens Part 4 rather than weakening it. Because every load leaves in a vehicle the site does not own, the vehicle check is not an edge case for an unusual despatch - it is the whole of this site's transport control. 11.6.5.2 governs vehicles transporting food FROM the site without regard to who owns them, and responsibility passing on collection does not reach backwards to the moment of loading.\n\nOPEN BEFORE ISSUE — three things the site must settle:\n\n1. THE VEHICLE SECURITY QUESTION IS UNANSWERED. 11.6.5.3 requires vehicles to be secured from tampering by seals or another agreed method. It is not known whether seals are used today, whether any customer specifies one, or what method would be agreed for a customer collection where the vehicle leaves immediately. This is task 35.4, and the plan makes it depend on D-22 Food Defense so that the threat assessment informs the choice — but if seals are simply adopted as good practice the decision can be made now and fed to D-22 instead. Until it is settled, Part 6 states the requirement and the site does not meet it.\n\n2. THE LOADING ARRANGEMENT IN PART 5 IS RECORDED FROM THE SITE'S ACCOUNT, not from an inspection: product does not cross open ground between the building and the vehicle. Task 35.5 asks for the written practice plus any physical fixes such as a dock seal or weather protection, and that needs somebody to look at the loading area. If any part of the transfer is open to weather, Part 5 is wrong.\n\n3. WHETHER THE COLLECTING VEHICLE IS CHECKED TODAY is not known, and since every despatch is a collection this is the whole question rather than an edge of it. Part 4 states the rule and the rule is right either way — but if the practice today is that a collecting vehicle is loaded without a check, then issuing this program creates a requirement the floor is not yet meeting, and the gap should be closed by instruction rather than discovered at an audit."}$j036$::jsonb
);

do $$
declare
  r record;
  rn text;
begin
  select status, revision, type, sqf_required, sqf_reference, category,
         (content->>'responsibility')                                                  as responsibility,
         jsonb_array_length(content->'procedure')                                      as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '• %')                                                         as bullets,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '> %')                                                         as prose,
         (content->'procedure')::text like '%Every finished product made by this site ships ambient%'
                                                                                        as determination,
         (content->'procedure')::text like '%says nothing about refrigeration on the site%' as not_no_fridge,
         (content->'procedure')::text like '%Ambient is a specified condition, not the absence of one%'
                                                                                        as ambient_is_condition,
         (content->'procedure')::text like '%BEFORE that product first ships%'          as reversal,
         (content->'procedure')::text like '%vacuum seal is the barrier that matters%'  as vacuum,
         (content->'procedure')::text like '%That is not what 11.6.5.3 asks for%'       as seal_distinction,
         (content->'procedure')::text like '%by collection, and by no other route%'     as collection_model,
         (content->'procedure')::text like '%whole of this site''s transport control%'  as check_is_control,
         (content->'procedure')::text like '%does not reach backwards to the moment of loading%'
                                                                                        as collection_rule,
         (content->'procedure')::text like '%as described by the site rather than as inspected%' as dock_caveat,
         (content->>'governing_reference') like '%recorded Not Applicable on that basis%' as gov_na,
         (content->>'revision_history') like '%OPEN BEFORE ISSUE — three things%'        as open_items
    into r
    from public.sop_documents where sop_number = 'FSQM-036';

  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-036 seeded as %/% , expected draft/New.', r.status, r.revision;
  end if;
  if r.type is distinct from 'fsqm' or r.category is distinct from 'Food Safety Quality Manual' then
    raise exception 'FSQM-036 typed %/% .', r.type, r.category;
  end if;
  -- The three Not Applicable clauses must NOT be claimed in sqf_reference; the document records
  -- them as not arising, and listing them would assert the opposite.
  if not r.sqf_required or r.sqf_reference like '%11.6.5.5%'
     or r.sqf_reference like '%11.6.5.6%' or r.sqf_reference like '%11.6.5.7%' then
    raise exception 'sqf_reference must not claim the Not Applicable clauses: %.', r.sqf_reference;
  end if;
  -- Exact, because they are computable: 9 Part headings, 8 bullets, 14 explanatory paragraphs.
  -- The first draft had 10 bullets; three listed despatch modes the site does not operate and were
  -- replaced by one rule about telling the carrier what is expected.
  if r.lines <> 31 or r.bullets <> 8 or r.prose <> 14 then
    raise exception 'Body did not land intact: % lines, % bullets, % prose (expected 31 / 8 / 14).',
      r.lines, r.bullets, r.prose;
  end if;
  if not (r.determination and r.not_no_fridge and r.ambient_is_condition and r.reversal) then
    raise exception 'Part 2 incomplete: determination=%, fridge caveat=%, ambient=%, reversal=%.',
      r.determination, r.not_no_fridge, r.ambient_is_condition, r.reversal;
  end if;
  if not (r.vacuum and r.seal_distinction) then
    raise exception 'Part 5 must state the vacuum barrier AND that it is not 11.6.5.3 (vacuum=%, distinction=%).',
      r.vacuum, r.seal_distinction;
  end if;
  if not (r.collection_model and r.check_is_control and r.collection_rule) then
    raise exception 'Collection model incomplete: model=%, check is the control=%, rule=%.',
      r.collection_model, r.check_is_control, r.collection_rule;
  end if;
  if not (r.dock_caveat and r.gov_na and r.open_items) then
    raise exception 'Missing: dock caveat=%, governing N/A=%, open items=%.',
      r.dock_caveat, r.gov_na, r.open_items;
  end if;
  foreach rn in array array['SQF Practitioner','Production Supervisor','Production staff','Admin','Senior Site Management']
  loop
    if strpos(r.responsibility, rn) = 0 then
      raise exception 'Responsibility does not define the role %.', rn;
    end if;
  end loop;
end $$;

commit;
