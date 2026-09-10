-- FSQM-036 Part 5 and FRM-801 Section 3: the load DOES cross an outdoor area.
--
-- WHAT WAS WRONG. Part 5 stated that product does not cross open ground between the building and the
-- vehicle, and that it is therefore not exposed to weather while being loaded. The owner had said
-- the product is not transported across open ground; that was read as meaning it is never outdoors,
-- and it is not what he meant. Bulk product is palletised and moved by forklift or pallet jack
-- across a concrete parking area. There is no loading dock. The load is briefly outdoors on every
-- bulk despatch.
--
-- WHY THIS IS A CORRECTION AND NOT A WEAKENING. 11.6.5.4 asks that the loading area protect the
-- product and 11.6.5.8 that exposure be minimised - neither requires that exposure be zero. Stating
-- the crossing and controlling it is compliant; asserting it does not happen is not, and is trivially
-- disproved by standing outside for five minutes. A document that claims product is never exposed,
-- read by an auditor who then watches a pallet cross a car park in the rain, has given away every
-- other statement it makes.
--
-- WHAT THE WEATHER ACTUALLY THREATENS is the packaging rather than the food. Every unit is vacuum
-- sealed inside its box before it is cased and palletised, so a brief crossing does not reach the
-- product. Wet cartons are the real risk: they lose strength, they can support mould, and they carry
-- soil into the vehicle and on to the customer. The new rules are aimed there - wrapped pallets, no
-- loading in adverse weather without cover, a clean apron free of standing water, a direct crossing
-- with no outdoor staging.
--
-- FRM-801's loading section asked the wrong question and is rebuilt to ask the right ones. Its old
-- field claimed the transfer happened "without crossing open ground", which is exactly the assertion
-- being withdrawn.
--
-- A NEW MIGRATION RATHER THAN AN EDIT to 000004 and 000005. Neither has been applied, but both are
-- committed on a branch the owner pulls from and pushes; editing them risks him pushing the version
-- he already has while the correction never runs. That failure happened twice this week.
--
-- Both documents are still DRAFT and FRM-801 has no entries, so the form schema is replaced whole.

begin;

do $$
declare r record;
begin
  select
    (select status from public.sop_documents where sop_number = 'FSQM-036')            as s36,
    (select status from public.sop_documents where sop_number = 'FRM-801')             as s801,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-036'
        and l.line like '%does not cross open ground%')                                 as stale_claim,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-801' and f->>'id' = 'not_exposed')                      as stale_field,
    (select count(*) from public.sop_document_responses rr
       join public.sop_documents dd on dd.id = rr.document_id
      where dd.sop_number = 'FRM-801')                                                  as entries
  into r;

  if r.s36 is distinct from 'draft' or r.s801 is distinct from 'draft' then
    raise exception 'Expected both draft; found FSQM-036=%, FRM-801=%.', r.s36, r.s801;
  end if;
  if r.stale_claim <> 1 or r.stale_field <> 1 then
    raise exception 'The text this corrects is not present (claim=%, field=%). Apply 000004 and 000005 first.',
      r.stale_claim, r.stale_field;
  end if;
  -- The schema is replaced whole, which is only safe while no answer keys on it.
  if r.entries <> 0 then
    raise exception 'FRM-801 has % entries; the schema cannot be replaced wholesale.', r.entries;
  end if;
end $$;

create temporary table d35_before on commit drop as
select 'FSQM-036'::text as sop_number,
       md5((content - 'procedure' - 'revision_history' - 'records')::text) as h
  from public.sop_documents where sop_number = 'FSQM-036'
union all
select 'FRM-801', md5((content - 'form_schema')::text)
  from public.sop_documents where sop_number = 'FRM-801';

update public.sop_documents
   set content = jsonb_set(
         jsonb_set(
           jsonb_set(content, '{procedure}', $p36$["Finished product leaves this site by collection, and by no other route. A carrier the customer arranges collects from the site, and responsibility for the product passes to the customer on collection.", "> This is the model FSQM-020 records. The site operates no delivery fleet, engages no carriers of its own, and uses no off-site or contract warehouse. Stating it here rather than leaving it implied is what makes the rest of this program readable: several requirements of 11.6.5 concern a journey this site does not make.", "> What the site controls is the vehicle and the loading; what it does not control is the journey after collection. That is not a gap to be apologised for. 11.6.5.2 governs vehicles used to transport food FROM the site, which is precisely the collecting vehicle, so the check in Part 4 is not an edge case for an unusual despatch. It is the whole of this site's transport control, applied to every load that leaves.", "• Before a collection, the customer or the carrier shall be told the product's storage requirement, which is ambient, and the condition the vehicle must be in to be loaded.", "> Telling them in advance is the difference between a standard and an argument on the dock, and it is the site's only opportunity to influence a journey it does not control.", "No despatch shall leave the site before the product on it has been released under FSQM-020.", "> FSQM-020 already forbids product being made available for collection before release, and repeating it here is deliberate: loading is the moment at which an unreleased pallet is most easily taken, and once the vehicle has gone a release recorded afterwards records nothing.", "Every finished product made by this site ships ambient. No product is carried under chilled or frozen conditions, for any customer.", "> Confirmed by the owner on 2026-09-10. Three requirements of 11.6.5 govern refrigerated transport and on this determination they do not arise, and are recorded Not Applicable: 11.6.5.5, that refrigerated units maintain the product at its required temperature; 11.6.5.6, that the unit is operational at all times and checked; and 11.6.5.7, that the vehicle's refrigeration temperature is checked on arrival before the doors are opened.", "> This determination says nothing about refrigeration on the site. A freezer remains in service under SOP-401, and the storage of product under temperature control is governed by 11.6.2 rather than by this program. What is determined here is narrow and is only about carriage: nothing leaves this site under temperature control.", "> Ambient is a specified condition, not the absence of one. 11.6.5.1 requires practices that maintain the storage conditions of the food, and product carried ambient must still be protected from heat, damp, direct sun and contamination. Treating ambient as nothing to control is the usual way this requirement is failed, and Parts 5 and 6 exist because of it.", "> What would reverse this: if any product requiring chilled or frozen carriage is introduced, whether a new product, a reformulation, or a customer requiring temperature-controlled delivery of an existing one, this program shall be revised and the controls of 11.6.5.5 to .7 implemented BEFORE that product first ships. The revision comes first. A control that arrives after the event it exists to control is not a control.", "No vehicle shall be loaded until it has been checked and found fit to carry food, and the check shall be recorded on FRM-801.", "• The load space shall be clean, dry and free of odour, free of pest activity and of residue from a previous load, and sound enough to keep weather out.", "• Where the previous load is known to have been a non-food material, the vehicle shall not be loaded.", "• A vehicle that fails the check shall not be loaded. The refusal and its reason shall be recorded, and the collection shall not proceed until a fit vehicle is provided.", "> The vehicle belongs to the customer or to a carrier the customer arranges, and it is checked anyway. 11.6.5.2 does not distinguish by who owns the vehicle, and the reason is plain once stated: if a vehicle arrives dirty or carrying an odour it is this site's product that would be affected, and this site's control that failed. Responsibility passing on collection does not reach backwards to the moment of loading.", "Product shall be transferred from the building into the vehicle without being exposed to weather or contamination, and the load shall be secured so that packaging is not damaged.", "• Palletised loads are moved by forklift or pallet jack from the building to the vehicle across an outdoor concrete area, and are therefore briefly exposed to the outdoor environment. There is no loading dock.", "• Pallets shall be wrapped before they leave the building.", "• Product shall not be loaded in rain, snow or driving wind unless the load is covered for the crossing.", "• The concrete loading area shall be kept clean and free of standing water, and no pallet shall be set down on wet or soiled ground.", "• The crossing shall be as direct and as brief as the equipment allows. Pallets shall not be staged outdoors to wait for a vehicle.", "• Product shall not be placed directly on the ground or on an unclean surface at any point.", "> There is no dock, so 11.6.5.4 is met by practice rather than by structure, and this Part says so plainly. An earlier draft of this program stated that product never crossed open ground. That was a misreading of what the site had described and it was wrong: bulk loads cross a concrete parking area. A document asserting that product is never exposed, read by an auditor who then watches a pallet cross a car park in the rain, would cost more credibility than the exposure itself ever could.", "> What the weather threatens here is the packaging rather than the food. Every unit is vacuum sealed inside its box before it is cased and palletised, so a brief crossing does not reach the product. Wet cartons are the real risk: they lose strength, they can support mould, and they carry soil into the vehicle and on to the customer. The rules above are aimed at the outer packaging, which is the thing actually at risk.", "• The load shall be stacked and restrained so that packaging is not crushed, punctured or abraded.", "The product's own barrier is the vacuum seal, and the security of the vehicle is a separate matter.", "> Finished product is vacuum sealed, boxed as a single serving, and closed with a clear tape disc over the box opening. The vacuum seal is the barrier that matters: it cannot be opened and re-closed without equipment, and a lost vacuum is visible to anyone handling the pack. The box and its tape are presentation and closure.", "> That is not what 11.6.5.3 asks for. The requirement is that the VEHICLE be secured from tampering, using seals or another agreed method, and a tamper-evident retail pack does not meet it. Recording the pack's integrity as though it satisfied 11.6.5.3 would close the requirement on evidence that does not address it, so the two are stated separately and the vehicle question is carried as an open item.", "• Where a seal or other agreed method is used, its identifier shall be recorded on FRM-801 against the despatch.", "Incoming loads shall be unloaded promptly and without unnecessary exposure, and the vehicle and the material shall be inspected at receipt as required by FRM-301.", "> FRM-301 already records the condition of the delivering vehicle at receipt, so this program does not create a second route for the same check. Anything found unfit is held under FSQM-018.", "Records are retained as set out in the Records section of this program.", "The SQF Practitioner shall review this program at least annually, and whenever the products shipped, the collection arrangements or the loading area change.", "> The determination in Part 3 is the part most likely to go stale, because it will be a new product or a new customer requirement that reverses it, and neither of those announces itself to this document."]$p36$::jsonb),
           '{revision_history}', to_jsonb($rh36$Rev New — written 2026-09-10 against SQF Food Safety Code: Food Manufacturing, Edition 9, 11.6.5 Loading, Transport, and Unloading. DRAFT. Not approved, not in force.

WHY IT EXISTS. The gap assessment scored eight findings across 11.6.5 and no controlled document covered loading, transport or unloading at all. Before this, nothing in the document set cited 11.6.5.

THE AMBIENT DETERMINATION. The owner confirmed on 2026-09-10 that every finished product ships ambient, which records 11.6.5.5, .6 and .7 Not Applicable and removes task 35.6 from the deliverable. It is written into Part 3 rather than filed separately, so that a reader looking for 11.6.5 finds the determination in the document that governs the subject — the mechanism FSQM-014 used for 2.4.4.3 and .4.

Part 3 is written to prevent two wrong inferences. It does not say the site has no refrigeration: a freezer remains in service under SOP-401 and refrigerated storage is 11.6.2, which D-34 closed. And it does not say ambient is the absence of a condition: 11.6.5.1 requires the storage conditions of the food to be maintained, so product carried ambient must still be protected from heat, damp and sun. The reversal trigger is stated in the same terms FSQM-014 Part 2 uses for introducing analysis — the programme is revised before the first such product ships, not after.

THE VACUUM SEAL AND THE VEHICLE SEAL ARE DIFFERENT QUESTIONS. Product is vacuum sealed, boxed as a single serving and closed with a clear tape disc. The vacuum pack is a genuine tamper-evident barrier and Part 6 says so. But 11.6.5.3 is about securing the VEHICLE, and recording the pack's integrity as though it satisfied the requirement would close it on evidence that does not address it. The two are stated separately and the vehicle question is open.

EVERY DESPATCH IS A COLLECTION, AND THE FIRST DRAFT GOT THAT WRONG. It described three despatch modes taken from the FRM-701 seed file. FRM-701 was amended twice after seeding and no longer carries a Destination field at all, and FSQM-020 - active since 2026-09-04 - records that the site uses no off-site or contract warehouse and that finished product is collected by a carrier the customer arranges, responsibility passing on collection. Describing a mode the site does not operate would have re-added a limb FSQM-020 deliberately removed. Corrected before seeding, and caught by a guard that checked the live document rather than trusting the file it had been seeded from.

The correction sharpens Part 4 rather than weakening it. Because every load leaves in a vehicle the site does not own, the vehicle check is not an edge case for an unusual despatch - it is the whole of this site's transport control. 11.6.5.2 governs vehicles transporting food FROM the site without regard to who owns them, and responsibility passing on collection does not reach backwards to the moment of loading.

OPEN BEFORE ISSUE — three things the site must settle:

1. THE VEHICLE SECURITY QUESTION IS UNANSWERED. 11.6.5.3 requires vehicles to be secured from tampering by seals or another agreed method. It is not known whether seals are used today, whether any customer specifies one, or what method would be agreed for a customer collection where the vehicle leaves immediately. This is task 35.4, and the plan makes it depend on D-22 Food Defense so that the threat assessment informs the choice — but if seals are simply adopted as good practice the decision can be made now and fed to D-22 instead. Until it is settled, Part 6 states the requirement and the site does not meet it.

2. THE LOAD DOES CROSS AN OUTDOOR AREA, and the first draft of Part 5 said it did not. The owner clarified on 2026-09-10 that bulk product is palletised and moved by forklift or pallet jack across a concrete parking area, so it is briefly exposed to the outdoor environment; there is no loading dock. Part 5 was corrected to say so and to state the controls that make it acceptable - wrapped pallets, no loading in adverse weather without cover, a clean apron free of standing water, a direct crossing with no outdoor staging. 11.6.5.4 asks that the loading area protect the product, and here it is met by practice rather than by structure.

WHAT REMAINS OPEN ON THIS POINT: whether wrapping and the adverse-weather rule are current practice or are introduced by this program. If they are new, the floor needs telling before the effective date, exactly as the vehicle check does - see item 3. Task 35.5 also asks whether any physical fix is worth making, such as a canopy over the crossing, and that is a judgement for the site rather than for this document.

3. WHETHER THE COLLECTING VEHICLE IS CHECKED TODAY is not known, and since every despatch is a collection this is the whole question rather than an edge of it. Part 4 states the rule and the rule is right either way — but if the practice today is that a collecting vehicle is loaded without a check, then issuing this program creates a requirement the floor is not yet meeting, and the gap should be closed by instruction rather than discovered at an audit.

AMENDED 2026-09-10, BEFORE ISSUE — PART 5 ASSERTED SOMETHING THAT IS NOT TRUE. It said product does not cross open ground between the building and the vehicle. The owner had said the product is not transported across open ground and that was read as meaning it is never outdoors; in fact bulk loads are palletised and crossed over a concrete parking area by forklift or pallet jack. The claim was corrected before this document was ever applied.

It is recorded rather than quietly fixed because the correction is instructive. The strongest thing a programme can do is describe what actually happens; the weakest is to describe what would be convenient. An auditor who reads that product is never exposed, and then watches a pallet cross a car park in the rain, has been given a reason to doubt every other statement in the document. Stating the exposure and controlling it is the stronger position, and it is also the true one.$rh36$::text)),
         '{records}', to_jsonb($rc36$FRM-801 Despatch and Vehicle Loading Record — one record per vehicle-load: the vehicle check, the loading and weather confirmations, any seal identifier, the collecting carrier and the batches loaded.
FRM-701 Finished Product Release Record — the release that must precede every collection.
FRM-301 Incoming Material Receiving & Inspection Log — the vehicle and material inspection at receipt.
FRM-702 Non-Conforming Material Hold & Tagging Record — where a load or a delivery is refused or held.
There are no refrigerated transport records, because no product is carried under temperature control — see Part 3.
Retention: two years, or the shelf life of the product plus twelve months, whichever is longer, on the same basis as FSQM-009 Part 10.$rc36$::text))
 where sop_number = 'FSQM-036' and status = 'draft';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', $f801${"schemaVersion": 1, "settings": {"attachmentsEnabled": true, "allowMultipleDrafts": true, "deletable": false, "instanceTitleTemplate": "Despatch {despatch_date} — {vehicle_id}"}, "sections": [{"id": "despatch", "title": "1. Despatch", "fields": [{"id": "how_this_works", "type": "info", "label": "Before you start", "text": "ONE RECORD PER VEHICLE-LOAD, not per batch. If one vehicle carries three batches, that is one record listing all three.\n\nEVERY DESPATCH IS A COLLECTION. A carrier the customer arranges collects from the site, and responsibility passes to the customer at that point. The vehicle is therefore never ours — and it is checked anyway, because 11.6.5.2 covers vehicles carrying food FROM this site whoever owns them. Responsibility passing on collection does not reach backwards to the moment of loading.\n\nNothing is loaded before it has been released on FRM-701, and no vehicle is loaded before it has passed the check in Section 2. A vehicle that fails is not loaded — record the refusal and its reason, and do not proceed until a fit vehicle is provided.\n\nAll product ships AMBIENT. There are no temperature checks on this form because nothing leaves under temperature control (FSQM-036 Part 3). If that ever changes, the programme is revised before the first such load."}, {"id": "despatch_date", "type": "date", "label": "Date", "width": "third", "required": true, "defaultToday": true, "showInList": true}, {"id": "customer", "type": "text", "label": "Customer", "width": "half", "showInList": true}, {"id": "carrier", "type": "text", "label": "Collecting carrier", "width": "half", "help": "Who collected it — the carrier the customer arranged. Every despatch from this site is a collection.", "required": true, "showInList": true}, {"id": "vehicle_id", "type": "text", "label": "Vehicle registration or identifier", "width": "half", "required": true, "showInList": true}, {"id": "loaded", "type": "grid", "label": "Product loaded", "help": "One row per batch on this vehicle. The release record is FRM-701 for that batch.", "columns": [{"id": "product", "label": "Product", "type": "text", "width": 3}, {"id": "lot_code", "label": "Lot / batch code", "type": "text", "width": 2}, {"id": "quantity", "label": "Quantity", "type": "text", "width": 2}, {"id": "released", "label": "Released on FRM-701", "type": "pass_fail", "width": 1, "required": true}], "rows": {"mode": "dynamic", "min": 1, "addLabel": "Add a batch"}}]}, {"id": "vehicle_check", "title": "2. Vehicle check — before loading", "fields": [{"id": "check_info", "type": "info", "label": "How to use this table", "text": "Every row must be answered. The vehicle belongs to the customer or to a carrier they arranged, and it is checked all the same — it is this site's product that would be affected. A single Fail means the vehicle is not loaded."}, {"id": "checks", "type": "grid", "label": "Vehicle condition (11.6.5.2)", "columns": [{"id": "result", "label": "Result", "type": "pass_fail", "width": 1, "required": true}, {"id": "note", "label": "Note", "type": "text", "width": 3}], "rows": {"mode": "fixed", "labelHeader": "Check", "labels": ["Load space clean and dry\nNo dirt, spillage or standing water.", "Free of odour\nNothing that could taint product.", "Free of residue from a previous load\nAnd the previous load was not a non-food material.", "No evidence of pest activity\nDroppings, gnawing, insects, nesting.", "Sound and weatherproof\nNo holes, gaps or damaged seals that would let weather in.", "Suitable for carrying food\nNo sharp protrusions or damage that could breach packaging."]}}, {"id": "vehicle_accepted", "type": "select", "label": "Outcome", "width": "half", "required": true, "options": ["Accepted — loaded", "REFUSED — not loaded"]}, {"id": "refusal_reason", "type": "textarea", "label": "If refused, why, and what happened next", "rows": 2, "width": "full", "help": "Required where the vehicle was refused. Say what was found and what was done."}]}, {"id": "loading", "title": "3. Loading — the crossing", "fields": [{"id": "loading_info", "type": "info", "label": "The load crosses an outdoor area", "text": "Bulk loads are palletised and moved across the concrete parking area to the vehicle, so they are briefly outdoors. There is no dock. What the weather threatens is the packaging rather than the food - each unit is vacuum sealed inside its box - but wet cartons lose strength, can support mould, and carry soil into the vehicle.\n\nIf the weather is against you, cover the load for the crossing or wait. A delayed collection is recoverable; a pallet of soaked cartons is not."}, {"id": "pallets_wrapped", "type": "pass_fail", "width": "half", "required": true, "label": "Pallets wrapped before leaving the building"}, {"id": "weather_ok", "type": "pass_fail", "width": "half", "required": true, "label": "Weather suitable for the crossing, or load covered for it"}, {"id": "apron_clear", "type": "pass_fail", "width": "half", "required": true, "label": "Loading area clean and free of standing water"}, {"id": "not_on_ground", "type": "pass_fail", "width": "half", "required": true, "label": "No pallet or product set down on wet or soiled ground"}, {"id": "load_secured", "type": "pass_fail", "width": "half", "required": true, "label": "Load stacked and restrained so packaging is not crushed, punctured or abraded"}, {"id": "loading_notes", "type": "textarea", "label": "Notes", "rows": 2, "width": "full", "help": "Required where any check above is a Fail, or where the load was covered for the crossing."}]}, {"id": "security", "title": "4. Security of the load", "fields": [{"id": "security_info", "type": "info", "label": "What this section is for", "text": "11.6.5.3 asks that the VEHICLE be secured from tampering, by a seal or another agreed method. That is a separate question from the product's own packaging: the vacuum seal inside each box is a genuine tamper-evident barrier, but it is not vehicle security and does not answer this requirement.\n\nThe site has not yet settled which method it uses, and a load that is collected and leaves immediately raises the question of what a seal would add. Record honestly what was done — including that no method was applied — so the record shows the real position rather than an assumed one."}, {"id": "security_method", "type": "select", "label": "Method applied", "width": "half", "options": ["Tamper-evident seal applied", "Other agreed method — describe below", "None applied"], "help": "Not yet mandatory: the site's method is still to be decided (FSQM-036 open item 1)."}, {"id": "seal_number", "type": "text", "label": "Seal number or method reference", "width": "half", "help": "Where a seal was applied, its identifier."}]}, {"id": "signoff", "title": "5. Sign-off", "fields": [{"id": "despatched_by", "type": "signature", "label": "Loaded and despatched by", "width": "half", "required": true, "statement": "I checked the vehicle, loaded this despatch as recorded above, and confirm the product on it had been released."}, {"id": "verified_by", "type": "signature", "label": "Verified by (optional)", "width": "half", "role": "verifier", "statement": "I have reviewed this despatch record."}]}]}$f801$::jsonb)
 where sop_number = 'FRM-801' and status = 'draft';

update public.sop_documents
   set content = jsonb_set(content, '{revision_history}',
         to_jsonb(replace(content->>'revision_history', chr(13), '')))
 where sop_number = 'FSQM-036' and position(chr(13) in content->>'revision_history') > 0;

do $$
declare
  r record;
  drift int;
begin
  select
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-036' and l.line like '%does not cross open ground%')   as stale_claim,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-036'
        and l.line like '%across an outdoor concrete area%')                            as crossing_stated,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-036' and l.line like '%Pallets shall be wrapped%')      as wrapped,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-036' and l.line like '%shall not be loaded in rain%')   as weather_rule,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-036' and l.line like '%threatens here is the packaging%') as packaging_point,
    (select jsonb_array_length(content->'procedure')
       from public.sop_documents where sop_number = 'FSQM-036')                          as lines,
    (select (content->>'revision_history') like '%PART 5 ASSERTED SOMETHING THAT IS NOT TRUE%'
       from public.sop_documents where sop_number = 'FSQM-036')                          as amendment_noted,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-801' and f->>'id' = 'not_exposed')                       as stale_field,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-801')                                                    as fields,
    (select (content->'form_schema')::text like '%cover the load for the crossing or wait%'
       from public.sop_documents where sop_number = 'FRM-801')                           as form_guidance
  into r;

  if r.stale_claim <> 0 or r.stale_field <> 0 then
    raise exception 'The withdrawn claim survives (procedure=%, form field=%).', r.stale_claim, r.stale_field;
  end if;
  if r.crossing_stated <> 1 or r.wrapped <> 1 or r.weather_rule <> 1 or r.packaging_point <> 1 then
    raise exception 'Part 5 incomplete: crossing=%, wrapping=%, weather=%, packaging point=%.',
      r.crossing_stated, r.wrapped, r.weather_rule, r.packaging_point;
  end if;
  if r.lines <> 36 then
    raise exception 'FSQM-036 procedure is % lines, expected 36.', r.lines;
  end if;
  if not r.amendment_noted then
    raise exception 'The correction is not recorded in the revision history.';
  end if;
  if r.fields <> 22 then
    raise exception 'FRM-801 has % fields, expected 22.', r.fields;
  end if;
  if not r.form_guidance then
    raise exception 'FRM-801 does not tell the filler what to do when the weather is against them.';
  end if;

  -- Nothing outside the corrected sections may move.
  select count(*) into drift
    from public.sop_documents d join d35_before b on b.sop_number = d.sop_number
   where (d.sop_number = 'FSQM-036'
          and md5((d.content - 'procedure' - 'revision_history' - 'records')::text) is distinct from b.h)
      or (d.sop_number = 'FRM-801' and md5((d.content - 'form_schema')::text) is distinct from b.h);
  if drift <> 0 then
    raise exception 'A document changed beyond the corrected sections. Rolled back.';
  end if;
end $$;

commit;
