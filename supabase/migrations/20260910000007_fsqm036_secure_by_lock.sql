-- FSQM-036 Part 6 and FRM-801 Section 4: a lock, not a seal.
--
-- WHAT WAS WRONG, AND IT WAS AN OVER-READING OF THE CLAUSE. 11.6.5.3 says vehicles "shall be secured
-- from tampering using seals or other agreed-upon and acceptable devices or systems". I read that as
-- requiring something TAMPER-EVIDENT, which is not what it says. It asks for the vehicle to be
-- SECURED, and a lock is a device that secures it; a seal secures nothing at all - it evidences,
-- afterwards, that somebody opened the load. The clause contemplates both.
--
-- AND A SEAL DOES NOT FIT THIS SITE. Every despatch is a collection, and a collecting vehicle is
-- commonly on a multi-drop route: a seal applied at this dock has to be cut at the next stop.
-- Requiring one would have written a rule that cannot be followed - the same defect as the absolute
-- pre-operational separation rule removed from FSQM-004 two days ago, and the owner spotted this one
-- as well. Twice in a week is a pattern worth naming: a control heavier than the clause requires is
-- not caution, it is a rule waiting to be ignored.
--
-- WHAT REPLACES IT is one line of practice and one tick: the compartment is closed and secured before
-- the vehicle leaves - locked where there is a lock, latched and confirmed where there is not - and a
-- seal only where a customer or carrier asks for one. The seal field stays on the form for that case
-- and is not required.
--
-- THE REASONING IS WRITTEN INTO THE PART, because the defence of a light control is the argument
-- behind it. SQF is risk-based; ambient shelf-stable product collected locally in small quantities is
-- not a tampering target, and an auditor's objection is never to a proportionate control but to one
-- nobody can explain. The Part also records what would change the judgement - the food defence threat
-- assessment, which has not been done - so the choice is revisitable rather than settled by silence.
--
-- The Part does NOT claim the product's own packaging satisfies 11.6.5.3. That clause is about the
-- vehicle. The vacuum pack is recorded as a further barrier and as part of why the vehicle-level
-- control need not be heavy, which is a different and honest claim.
--
-- Both documents are DRAFT and FRM-801 has no entries.

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
        and l.line like '%a tamper-evident retail pack does not meet it%')              as stale_prose,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-801' and f->>'id' = 'security_method')                  as stale_field,
    (select count(*) from public.sop_document_responses rr
       join public.sop_documents dd on dd.id = rr.document_id
      where dd.sop_number = 'FRM-801')                                                  as entries,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-036'
        and l.line like '%across an outdoor concrete area%')                             as crossing_applied
  into r;

  if r.s36 is distinct from 'draft' or r.s801 is distinct from 'draft' then
    raise exception 'Expected both draft; found FSQM-036=%, FRM-801=%.', r.s36, r.s801;
  end if;
  -- 000006 must have landed first: this rewrites the Part that follows the one it corrected.
  if r.crossing_applied <> 1 then
    raise exception 'Apply 20260910000006 first; the outdoor-crossing correction is not present.';
  end if;
  if r.stale_prose <> 1 or r.stale_field <> 1 then
    raise exception 'The text this replaces is not present (prose=%, field=%).',
      r.stale_prose, r.stale_field;
  end if;
  if r.entries <> 0 then
    raise exception 'FRM-801 has % entries; the schema cannot be replaced wholesale.', r.entries;
  end if;
end $$;

create temporary table d35c_before on commit drop as
select 'FSQM-036'::text as sop_number,
       md5((content - 'procedure' - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'FSQM-036'
union all
select 'FRM-801', md5((content - 'form_schema')::text)
  from public.sop_documents where sop_number = 'FRM-801';

update public.sop_documents
   set content = jsonb_set(
         jsonb_set(content, '{procedure}', $p36$["Finished product leaves this site by collection, and by no other route. A carrier the customer arranges collects from the site, and responsibility for the product passes to the customer on collection.", "> This is the model FSQM-020 records. The site operates no delivery fleet, engages no carriers of its own, and uses no off-site or contract warehouse. Stating it here rather than leaving it implied is what makes the rest of this program readable: several requirements of 11.6.5 concern a journey this site does not make.", "> What the site controls is the vehicle and the loading; what it does not control is the journey after collection. That is not a gap to be apologised for. 11.6.5.2 governs vehicles used to transport food FROM the site, which is precisely the collecting vehicle, so the check in Part 4 is not an edge case for an unusual despatch. It is the whole of this site's transport control, applied to every load that leaves.", "• Before a collection, the customer or the carrier shall be told the product's storage requirement, which is ambient, and the condition the vehicle must be in to be loaded.", "> Telling them in advance is the difference between a standard and an argument on the dock, and it is the site's only opportunity to influence a journey it does not control.", "No despatch shall leave the site before the product on it has been released under FSQM-020.", "> FSQM-020 already forbids product being made available for collection before release, and repeating it here is deliberate: loading is the moment at which an unreleased pallet is most easily taken, and once the vehicle has gone a release recorded afterwards records nothing.", "Every finished product made by this site ships ambient. No product is carried under chilled or frozen conditions, for any customer.", "> Confirmed by the owner on 2026-09-10. Three requirements of 11.6.5 govern refrigerated transport and on this determination they do not arise, and are recorded Not Applicable: 11.6.5.5, that refrigerated units maintain the product at its required temperature; 11.6.5.6, that the unit is operational at all times and checked; and 11.6.5.7, that the vehicle's refrigeration temperature is checked on arrival before the doors are opened.", "> This determination says nothing about refrigeration on the site. A freezer remains in service under SOP-401, and the storage of product under temperature control is governed by 11.6.2 rather than by this program. What is determined here is narrow and is only about carriage: nothing leaves this site under temperature control.", "> Ambient is a specified condition, not the absence of one. 11.6.5.1 requires practices that maintain the storage conditions of the food, and product carried ambient must still be protected from heat, damp, direct sun and contamination. Treating ambient as nothing to control is the usual way this requirement is failed, and Parts 5 and 6 exist because of it.", "> What would reverse this: if any product requiring chilled or frozen carriage is introduced, whether a new product, a reformulation, or a customer requiring temperature-controlled delivery of an existing one, this program shall be revised and the controls of 11.6.5.5 to .7 implemented BEFORE that product first ships. The revision comes first. A control that arrives after the event it exists to control is not a control.", "No vehicle shall be loaded until it has been checked and found fit to carry food, and the check shall be recorded on FRM-801.", "• The load space shall be clean, dry and free of odour, free of pest activity and of residue from a previous load, and sound enough to keep weather out.", "• Where the previous load is known to have been a non-food material, the vehicle shall not be loaded.", "• A vehicle that fails the check shall not be loaded. The refusal and its reason shall be recorded, and the collection shall not proceed until a fit vehicle is provided.", "> The vehicle belongs to the customer or to a carrier the customer arranges, and it is checked anyway. 11.6.5.2 does not distinguish by who owns the vehicle, and the reason is plain once stated: if a vehicle arrives dirty or carrying an odour it is this site's product that would be affected, and this site's control that failed. Responsibility passing on collection does not reach backwards to the moment of loading.", "Product shall be transferred from the building into the vehicle without being exposed to weather or contamination, and the load shall be secured so that packaging is not damaged.", "• Palletised loads are moved by forklift or pallet jack from the building to the vehicle across an outdoor concrete area, and are therefore briefly exposed to the outdoor environment. There is no loading dock.", "• Pallets shall be wrapped before they leave the building.", "• Product shall not be loaded in rain, snow or driving wind unless the load is covered for the crossing.", "• The concrete loading area shall be kept clean and free of standing water, and no pallet shall be set down on wet or soiled ground.", "• The crossing shall be as direct and as brief as the equipment allows. Pallets shall not be staged outdoors to wait for a vehicle.", "• Product shall not be placed directly on the ground or on an unclean surface at any point.", "> There is no dock, so 11.6.5.4 is met by practice rather than by structure, and this Part says so plainly. An earlier draft of this program stated that product never crossed open ground. That was a misreading of what the site had described and it was wrong: bulk loads cross a concrete parking area. A document asserting that product is never exposed, read by an auditor who then watches a pallet cross a car park in the rain, would cost more credibility than the exposure itself ever could.", "> What the weather threatens here is the packaging rather than the food. Every unit is vacuum sealed inside its box before it is cased and palletised, so a brief crossing does not reach the product. Wet cartons are the real risk: they lose strength, they can support mould, and they carry soil into the vehicle and on to the customer. The rules above are aimed at the outer packaging, which is the thing actually at risk.", "• The load shall be stacked and restrained so that packaging is not crushed, punctured or abraded.", "The load compartment shall be closed and secured before the vehicle leaves the site.", "• Where the vehicle has a lock, the compartment shall be locked. Where it has a latch only, the compartment shall be latched and the driver shall confirm it is closed.", "• Where a customer or a carrier requires a seal, one shall be applied and its number recorded on FRM-801.", "• The confirmation shall be recorded on FRM-801 for every despatch.", "> 11.6.5.3 requires that vehicles be secured from tampering using seals or other agreed-upon and acceptable devices or systems. It asks for the vehicle to be SECURED, and a lock is a device that secures it. A seal secures nothing; it evidences afterwards that somebody opened the load. The clause contemplates both, and this site uses the one that fits how its product actually leaves.", "> A seal would not fit. Every despatch is a collection and a collecting vehicle is commonly on a multi-drop route, so a seal applied here has to be cut at the next stop. Requiring one would be writing a rule that cannot be followed, and a rule the site cannot follow is worse than a lighter one it can: the first thing that happens to it is that it is ignored, and the second is that everything written beside it is trusted a little less.", "> This is a risk-based choice and is recorded as one rather than left to look like an omission. The product is ambient and shelf stable, collected locally in small quantities, and is not the kind of load that attracts interference. The site does not claim that the product's own packaging satisfies this requirement, because 11.6.5.3 is about the vehicle - but a unit vacuum sealed inside a taped box on a wrapped pallet is a further barrier, and it is part of why the control at the vehicle need not be heavy.", "> What would change it: the food defence threat assessment is the document that formally tests this judgement and it has not yet been done. If it identifies a threat this Part does not answer, this Part is revised. The annual review is the other occasion on which that should be asked.", "Incoming loads shall be unloaded promptly and without unnecessary exposure, and the vehicle and the material shall be inspected at receipt as required by FRM-301.", "> FRM-301 already records the condition of the delivering vehicle at receipt, so this program does not create a second route for the same check. Anything found unfit is held under FSQM-018.", "Records are retained as set out in the Records section of this program.", "The SQF Practitioner shall review this program at least annually, and whenever the products shipped, the collection arrangements or the loading area change.", "> The determination in Part 3 is the part most likely to go stale, because it will be a new product or a new customer requirement that reverses it, and neither of those announces itself to this document."]$p36$::jsonb),
         '{revision_history}',
         to_jsonb((content->>'revision_history') || $rh$

AMENDED 2026-09-10, BEFORE ISSUE — A LOCK, NOT A SEAL. Part 6 first required a tamper-evident method and recorded the vehicle question as unanswered. That over-read the clause. 11.6.5.3 asks that vehicles be SECURED from tampering using seals or other agreed and acceptable devices or systems; a lock is such a device, while a seal secures nothing and only evidences afterwards that the load was opened.

A seal also does not fit how product leaves here. Every despatch is a collection and a collecting vehicle is commonly on a multi-drop route, so a seal applied at this dock has to be cut at the next stop. Requiring one would have been a rule that cannot be followed — the same defect as the absolute pre-operational separation rule that FSQM-004 had to have removed, and the owner identified this one too.

The Part now requires the load compartment to be closed and secured before the vehicle leaves, locked where there is a lock and latched with the driver confirming where there is not, with a seal only where a customer or carrier requires one. It is one tick on FRM-801.

The reasoning is written into the Part rather than left implicit, because the defence of a light control is the argument behind it: SQF is risk-based, and ambient shelf-stable product collected locally in small quantities is not a tampering target. The Part also records what would change the judgement — the food defence threat assessment, which has not been done — so the choice can be revisited rather than settling by silence. It does not claim the product's own packaging satisfies 11.6.5.3, which is about the vehicle; the vacuum pack is recorded as a further barrier and as part of why the vehicle-level control need not be heavy.$rh$)::jsonb)
 where sop_number = 'FSQM-036' and status = 'draft';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', $f801${"schemaVersion": 1, "settings": {"attachmentsEnabled": true, "allowMultipleDrafts": true, "deletable": false, "instanceTitleTemplate": "Despatch {despatch_date} — {vehicle_id}"}, "sections": [{"id": "despatch", "title": "1. Despatch", "fields": [{"id": "how_this_works", "type": "info", "label": "Before you start", "text": "ONE RECORD PER VEHICLE-LOAD, not per batch. If one vehicle carries three batches, that is one record listing all three.\n\nEVERY DESPATCH IS A COLLECTION. A carrier the customer arranges collects from the site, and responsibility passes to the customer at that point. The vehicle is therefore never ours — and it is checked anyway, because 11.6.5.2 covers vehicles carrying food FROM this site whoever owns them. Responsibility passing on collection does not reach backwards to the moment of loading.\n\nNothing is loaded before it has been released on FRM-701, and no vehicle is loaded before it has passed the check in Section 2. A vehicle that fails is not loaded — record the refusal and its reason, and do not proceed until a fit vehicle is provided.\n\nAll product ships AMBIENT. There are no temperature checks on this form because nothing leaves under temperature control (FSQM-036 Part 3). If that ever changes, the programme is revised before the first such load."}, {"id": "despatch_date", "type": "date", "label": "Date", "width": "third", "required": true, "defaultToday": true, "showInList": true}, {"id": "customer", "type": "text", "label": "Customer", "width": "half", "showInList": true}, {"id": "carrier", "type": "text", "label": "Collecting carrier", "width": "half", "help": "Who collected it — the carrier the customer arranged. Every despatch from this site is a collection.", "required": true, "showInList": true}, {"id": "vehicle_id", "type": "text", "label": "Vehicle registration or identifier", "width": "half", "required": true, "showInList": true}, {"id": "loaded", "type": "grid", "label": "Product loaded", "help": "One row per batch on this vehicle. The release record is FRM-701 for that batch.", "columns": [{"id": "product", "label": "Product", "type": "text", "width": 3}, {"id": "lot_code", "label": "Lot / batch code", "type": "text", "width": 2}, {"id": "quantity", "label": "Quantity", "type": "text", "width": 2}, {"id": "released", "label": "Released on FRM-701", "type": "pass_fail", "width": 1, "required": true}], "rows": {"mode": "dynamic", "min": 1, "addLabel": "Add a batch"}}]}, {"id": "vehicle_check", "title": "2. Vehicle check — before loading", "fields": [{"id": "check_info", "type": "info", "label": "How to use this table", "text": "Every row must be answered. The vehicle belongs to the customer or to a carrier they arranged, and it is checked all the same — it is this site's product that would be affected. A single Fail means the vehicle is not loaded."}, {"id": "checks", "type": "grid", "label": "Vehicle condition (11.6.5.2)", "columns": [{"id": "result", "label": "Result", "type": "pass_fail", "width": 1, "required": true}, {"id": "note", "label": "Note", "type": "text", "width": 3}], "rows": {"mode": "fixed", "labelHeader": "Check", "labels": ["Load space clean and dry\nNo dirt, spillage or standing water.", "Free of odour\nNothing that could taint product.", "Free of residue from a previous load\nAnd the previous load was not a non-food material.", "No evidence of pest activity\nDroppings, gnawing, insects, nesting.", "Sound and weatherproof\nNo holes, gaps or damaged seals that would let weather in.", "Suitable for carrying food\nNo sharp protrusions or damage that could breach packaging."]}}, {"id": "vehicle_accepted", "type": "select", "label": "Outcome", "width": "half", "required": true, "options": ["Accepted — loaded", "REFUSED — not loaded"]}, {"id": "refusal_reason", "type": "textarea", "label": "If refused, why, and what happened next", "rows": 2, "width": "full", "help": "Required where the vehicle was refused. Say what was found and what was done."}]}, {"id": "loading", "title": "3. Loading — the crossing", "fields": [{"id": "loading_info", "type": "info", "label": "The load crosses an outdoor area", "text": "Bulk loads are palletised and moved across the concrete parking area to the vehicle, so they are briefly outdoors. There is no dock. What the weather threatens is the packaging rather than the food - each unit is vacuum sealed inside its box - but wet cartons lose strength, can support mould, and carry soil into the vehicle.\n\nIf the weather is against you, cover the load for the crossing or wait. A delayed collection is recoverable; a pallet of soaked cartons is not."}, {"id": "pallets_wrapped", "type": "pass_fail", "width": "half", "required": true, "label": "Pallets wrapped before leaving the building"}, {"id": "weather_ok", "type": "pass_fail", "width": "half", "required": true, "label": "Weather suitable for the crossing, or load covered for it"}, {"id": "apron_clear", "type": "pass_fail", "width": "half", "required": true, "label": "Loading area clean and free of standing water"}, {"id": "not_on_ground", "type": "pass_fail", "width": "half", "required": true, "label": "No pallet or product set down on wet or soiled ground"}, {"id": "load_secured", "type": "pass_fail", "width": "half", "required": true, "label": "Load stacked and restrained so packaging is not crushed, punctured or abraded"}, {"id": "loading_notes", "type": "textarea", "label": "Notes", "rows": 2, "width": "full", "help": "Required where any check above is a Fail, or where the load was covered for the crossing."}]}, {"id": "security", "title": "4. Securing the load", "fields": [{"id": "security_info", "type": "info", "label": "What this section is for", "text": "11.6.5.3 asks that the vehicle be SECURED from tampering, using seals or other agreed and acceptable devices or systems. A lock is such a device. A seal is not required here and would not work: a collecting vehicle is often on a multi-drop route, so a seal applied at this dock has to be cut at the next stop.\n\nSo: close the compartment and secure it. Lock it if it has a lock; latch it and have the driver confirm it is closed if it does not. One tick.\n\nIf a particular customer or carrier asks for a seal, apply one and write its number below."}, {"id": "compartment_secured", "type": "pass_fail", "width": "half", "required": true, "label": "Load compartment closed and secured before departure"}, {"id": "seal_number", "type": "text", "width": "half", "label": "Seal number, if one was required", "help": "Only where a customer or carrier requires a seal. Otherwise leave blank."}]}, {"id": "signoff", "title": "5. Sign-off", "fields": [{"id": "despatched_by", "type": "signature", "label": "Loaded and despatched by", "width": "half", "required": true, "statement": "I checked the vehicle, loaded this despatch as recorded above, and confirm the product on it had been released."}, {"id": "verified_by", "type": "signature", "label": "Verified by (optional)", "width": "half", "role": "verifier", "statement": "I have reviewed this despatch record."}]}]}$f801$::jsonb)
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
    (select jsonb_array_length(content->'procedure')
       from public.sop_documents where sop_number = 'FSQM-036')                          as lines,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-036'
        and l.line like '%closed and secured before the vehicle leaves%')                as rule_stated,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-036' and l.line like '%a lock is a device that secures it%') as clause_read,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-036' and l.line like '%has to be cut at the next stop%')  as multidrop,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-036' and l.line like '%risk-based choice and is recorded as one%') as risk_basis,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-036' and l.line like '%does not claim that the product%')  as no_overclaim,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-036' and l.line like '%tamper-evident%')                  as stale_prose,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-801' and f->>'id' = 'compartment_secured'
        and coalesce((f->>'required')::boolean, false))                                    as tick_required,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-801' and f->>'id' = 'seal_number'
        and coalesce((f->>'required')::boolean, false))                                    as seal_required,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-801')                                                      as fields
  into r;

  if r.lines <> 40 then
    raise exception 'FSQM-036 procedure is % lines, expected 40.', r.lines;
  end if;
  if r.rule_stated <> 1 or r.clause_read <> 1 or r.multidrop <> 1 then
    raise exception 'Part 6 incomplete: rule=%, clause reading=%, multi-drop reason=%.',
      r.rule_stated, r.clause_read, r.multidrop;
  end if;
  -- A light control is defensible only if the document says why it was chosen.
  if r.risk_basis <> 1 or r.no_overclaim <> 1 then
    raise exception 'The justification is missing: risk basis=%, no-overclaim=%.',
      r.risk_basis, r.no_overclaim;
  end if;
  if r.stale_prose <> 0 then
    raise exception 'The tamper-evident over-reading survives in % line(s).', r.stale_prose;
  end if;
  if r.tick_required <> 1 then
    raise exception 'The secured-compartment confirmation is not a required field.';
  end if;
  -- A seal is for the customer who asks; requiring it would recreate the rule just removed.
  if r.seal_required <> 0 then
    raise exception 'seal_number is required; it must be optional.';
  end if;
  if r.fields <> 22 then
    raise exception 'FRM-801 has % fields, expected 22.', r.fields;
  end if;

  select count(*) into drift
    from public.sop_documents d join d35c_before b on b.sop_number = d.sop_number
   where (d.sop_number = 'FSQM-036'
          and md5((d.content - 'procedure' - 'revision_history')::text) is distinct from b.h)
      or (d.sop_number = 'FRM-801' and md5((d.content - 'form_schema')::text) is distinct from b.h);
  if drift <> 0 then
    raise exception 'A document changed beyond Part 6 and Section 4. Rolled back.';
  end if;
end $$;

commit;
