-- FRM-801 Despatch and Vehicle Loading Record. Seeded DRAFT alongside FSQM-036.
-- D-35 task 35.3 (SQF Food Manufacturing Ed 9, 11.6.5.2, .3, .4, .8).
--
-- ONE RECORD PER VEHICLE-LOAD, and that is the whole design decision. The obvious alternative was
-- to add vehicle fields to FRM-701, since a release already precedes every despatch - but FRM-701
-- is one record per BATCH and a vehicle carries a LOAD. A three-batch shipment would have produced
-- three checks of the same truck, or one filled in and two left blank, and neither is a record of
-- anything. The unit of the thing being controlled is the vehicle-load, so that is the unit of the
-- record. Confirmed by the owner on 2026-09-10.
--
-- IT DOES NOT DUPLICATE FRM-301. The plan warns against building two forms for one job; the receipt
-- half is already solved, because FRM-301 records the condition of the delivering vehicle at
-- receipt. What did not exist was any despatch equivalent. This is that, and FSQM-036 Part 6 points
-- unloading back at FRM-301 rather than repeating it here.
--
-- THE SEAL FIELD IS NOT REQUIRED, DELIBERATELY. 11.6.5.3 wants the vehicle secured from tampering by
-- a seal or another agreed method, and the site has not yet decided which - that is task 35.4 and
-- FSQM-036 carries it as an open item. A required field for a control that does not exist yet would
-- be a rule nobody can follow, which is the defect the FSQM-004 single-person amendment was written
-- to remove a day earlier. The field exists so the answer has somewhere to go, and the option list
-- lets the filler record honestly that no method is in use.
--
-- NO TEMPERATURE FIELDS. Every product ships ambient (FSQM-036 Part 3), so 11.6.5.5 to .7 do not
-- arise. Adding a temperature box that is always blank would imply a control the site does not
-- operate and would be the first thing an auditor asked about.
--
-- The vehicle check is a fixed grid so the same points are examined every time and none can be
-- skipped by omission, the pattern FRM-701 uses for the release checks.

begin;

do $$
declare n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FRM-801';
  if n <> 0 then
    raise exception 'FRM-801 already exists.';
  end if;
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-036';
  if n <> 1 then
    raise exception 'FSQM-036 does not exist - seed the program first (20260910000004).';
  end if;
  -- This form prints the ambient determination on its own face; the program must already say it.
  select count(*) into n from public.sop_documents
   where sop_number = 'FSQM-036'
     and (content->'procedure')::text like '%Every finished product made by this site ships ambient%';
  if n <> 1 then
    raise exception 'FSQM-036 does not carry the ambient determination; apply 20260910000004 first.';
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FRM-801',
  'Despatch and Vehicle Loading Record',
  'form',
  'Module 11',
  'draft',
  'New',
  '11.6.5.2, 11.6.5.3, 11.6.5.4, 11.6.5.8',
  true,
  jsonb_build_object('form_schema', $j801${"schemaVersion": 1, "settings": {"attachmentsEnabled": true, "allowMultipleDrafts": true, "deletable": false, "instanceTitleTemplate": "Despatch {despatch_date} — {vehicle_id}"}, "sections": [{"id": "despatch", "title": "1. Despatch", "fields": [{"id": "how_this_works", "type": "info", "label": "Before you start", "text": "ONE RECORD PER VEHICLE-LOAD, not per batch. If one vehicle carries three batches, that is one record listing all three.\n\nEVERY DESPATCH IS A COLLECTION. A carrier the customer arranges collects from the site, and responsibility passes to the customer at that point. The vehicle is therefore never ours — and it is checked anyway, because 11.6.5.2 covers vehicles carrying food FROM this site whoever owns them. Responsibility passing on collection does not reach backwards to the moment of loading.\n\nNothing is loaded before it has been released on FRM-701, and no vehicle is loaded before it has passed the check in Section 2. A vehicle that fails is not loaded — record the refusal and its reason, and do not proceed until a fit vehicle is provided.\n\nAll product ships AMBIENT. There are no temperature checks on this form because nothing leaves under temperature control (FSQM-036 Part 3). If that ever changes, the programme is revised before the first such load."}, {"id": "despatch_date", "type": "date", "label": "Date", "width": "third", "required": true, "defaultToday": true, "showInList": true}, {"id": "customer", "type": "text", "label": "Customer", "width": "half", "showInList": true}, {"id": "carrier", "type": "text", "label": "Collecting carrier", "width": "half", "help": "Who collected it — the carrier the customer arranged. Every despatch from this site is a collection.", "required": true, "showInList": true}, {"id": "vehicle_id", "type": "text", "label": "Vehicle registration or identifier", "width": "half", "required": true, "showInList": true}, {"id": "loaded", "type": "grid", "label": "Product loaded", "help": "One row per batch on this vehicle. The release record is FRM-701 for that batch.", "columns": [{"id": "product", "label": "Product", "type": "text", "width": 3}, {"id": "lot_code", "label": "Lot / batch code", "type": "text", "width": 2}, {"id": "quantity", "label": "Quantity", "type": "text", "width": 2}, {"id": "released", "label": "Released on FRM-701", "type": "pass_fail", "width": 1, "required": true}], "rows": {"mode": "dynamic", "min": 1, "addLabel": "Add a batch"}}]}, {"id": "vehicle_check", "title": "2. Vehicle check — before loading", "fields": [{"id": "check_info", "type": "info", "label": "How to use this table", "text": "Every row must be answered. The vehicle belongs to the customer or to a carrier they arranged, and it is checked all the same — it is this site's product that would be affected. A single Fail means the vehicle is not loaded."}, {"id": "checks", "type": "grid", "label": "Vehicle condition (11.6.5.2)", "columns": [{"id": "result", "label": "Result", "type": "pass_fail", "width": 1, "required": true}, {"id": "note", "label": "Note", "type": "text", "width": 3}], "rows": {"mode": "fixed", "labelHeader": "Check", "labels": ["Load space clean and dry\nNo dirt, spillage or standing water.", "Free of odour\nNothing that could taint product.", "Free of residue from a previous load\nAnd the previous load was not a non-food material.", "No evidence of pest activity\nDroppings, gnawing, insects, nesting.", "Sound and weatherproof\nNo holes, gaps or damaged seals that would let weather in.", "Suitable for carrying food\nNo sharp protrusions or damage that could breach packaging."]}}, {"id": "vehicle_accepted", "type": "select", "label": "Outcome", "width": "half", "required": true, "options": ["Accepted — loaded", "REFUSED — not loaded"]}, {"id": "refusal_reason", "type": "textarea", "label": "If refused, why, and what happened next", "rows": 2, "width": "full", "help": "Required where the vehicle was refused. Say what was found and what was done."}]}, {"id": "loading", "title": "3. Loading", "fields": [{"id": "not_exposed", "type": "pass_fail", "label": "Product transferred without crossing open ground and without exposure to weather", "width": "half", "required": true}, {"id": "not_on_ground", "type": "pass_fail", "label": "No product placed directly on the ground or on an unclean surface", "width": "half", "required": true}, {"id": "load_secured", "type": "pass_fail", "label": "Load stacked and restrained so packaging is not crushed, punctured or abraded", "width": "half", "required": true}, {"id": "loading_notes", "type": "textarea", "label": "Notes", "rows": 2, "width": "full"}]}, {"id": "security", "title": "4. Security of the load", "fields": [{"id": "security_info", "type": "info", "label": "What this section is for", "text": "11.6.5.3 asks that the VEHICLE be secured from tampering, by a seal or another agreed method. That is a separate question from the product's own packaging: the vacuum seal inside each box is a genuine tamper-evident barrier, but it is not vehicle security and does not answer this requirement.\n\nThe site has not yet settled which method it uses, and a load that is collected and leaves immediately raises the question of what a seal would add. Record honestly what was done — including that no method was applied — so the record shows the real position rather than an assumed one."}, {"id": "security_method", "type": "select", "label": "Method applied", "width": "half", "options": ["Tamper-evident seal applied", "Other agreed method — describe below", "None applied"], "help": "Not yet mandatory: the site's method is still to be decided (FSQM-036 open item 1)."}, {"id": "seal_number", "type": "text", "label": "Seal number or method reference", "width": "half", "help": "Where a seal was applied, its identifier."}]}, {"id": "signoff", "title": "5. Sign-off", "fields": [{"id": "despatched_by", "type": "signature", "label": "Loaded and despatched by", "width": "half", "required": true, "statement": "I checked the vehicle, loaded this despatch as recorded above, and confirm the product on it had been released."}, {"id": "verified_by", "type": "signature", "label": "Verified by (optional)", "width": "half", "role": "verifier", "statement": "I have reviewed this despatch record."}]}]}$j801$::jsonb)
);

do $$
declare r record;
begin
  select status, revision, type, category, sqf_reference, sqf_required,
    jsonb_array_length(content->'form_schema'->'sections')                             as sections,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f)                         as fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'type' = 'grid')                                                       as grids,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'type' = 'grid' and f->'rows'->>'mode' is null)                        as grids_no_mode,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f,
                          jsonb_array_elements_text(f->'rows'->'labels') l
      where f->>'id' = 'checks')                                                       as check_rows,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where (f->>'showInList')::boolean)                                               as list_fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f ? 'width' and f->>'width' not in ('full','half','third'))                as bad_widths,
    (select coalesce((f->>'required')::boolean, false)
       from jsonb_array_elements(content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f where f->>'id' = 'security_method')    as seal_required,
    (content->'form_schema')::text like '%EVERY DESPATCH IS A COLLECTION%'             as collection_model,
    (content->'form_schema')::text ilike '%destination%'                               as stale_destination,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where (f->>'id') ilike '%temp%' or (f->>'label') ilike '%temp%')                as temp_fields,
    (content->'form_schema')::text like '%whoever owns them%'                          as collection_rule,
    (content->'form_schema')::text like '%it is not vehicle security%'                 as seal_distinction,
    (content->'form_schema'->'settings'->>'deletable')                                 as deletable
  into r
  from public.sop_documents where sop_number = 'FRM-801';

  if r.status <> 'draft' or r.revision <> 'New' or r.type <> 'form' then
    raise exception 'FRM-801 seeded wrong: % / % / %.', r.status, r.revision, r.type;
  end if;
  if not r.sqf_required or r.sqf_reference like '%11.6.5.5%' or r.sqf_reference like '%11.6.5.7%' then
    raise exception 'sqf_reference must not claim the refrigerated-transport clauses: %.', r.sqf_reference;
  end if;
  if r.sections <> 5 or r.grids <> 2 then
    raise exception 'FRM-801 wrong shape: % sections, % grids (expected 5 / 2).', r.sections, r.grids;
  end if;
  if r.grids_no_mode <> 0 then
    raise exception '% grids have no rows.mode - a fixed grid without it renders dynamic.', r.grids_no_mode;
  end if;
  if r.check_rows <> 6 then
    raise exception 'The vehicle check has % rows, expected 6.', r.check_rows;
  end if;
  if r.bad_widths <> 0 then
    raise exception '% fields carry a width FormRenderer does not accept.', r.bad_widths;
  end if;
  -- A required field for a control the site has not adopted would be a rule nobody can follow.
  if r.seal_required then
    raise exception 'security_method is required, but the site has not yet decided its method (task 35.4).';
  end if;
  -- Every product ships ambient, so a temperature BOX would imply a control that does not exist.
  -- The word itself is fine and appears in the instructions explaining why there is no such box;
  -- an earlier version of this guard matched the whole schema text and caught its own explanation.
  if r.temp_fields <> 0 then
    raise exception 'FRM-801 carries % temperature field(s). All product ships ambient - see FSQM-036 Part 3.',
      r.temp_fields;
  end if;
  if not (r.collection_rule and r.seal_distinction and r.collection_model) then
    raise exception 'Missing: any-owner rule=%, vacuum-is-not-vehicle-security=%, collection model=%.',
      r.collection_rule, r.seal_distinction, r.collection_model;
  end if;
  -- FRM-701 has no Destination field and the site has one despatch mode; a dropdown offering others
  -- would invite a filler to record a mode the site does not operate.
  if r.stale_destination then
    raise exception 'FRM-801 still carries a destination field; every despatch is a collection.';
  end if;
  if r.list_fields <> 4 then
    raise exception '% fields flagged showInList, expected 4.', r.list_fields;
  end if;
  if r.deletable is distinct from 'false' then
    raise exception 'FRM-801 is deletable - a despatch record is the evidence the load was checked.';
  end if;
end $$;

commit;
