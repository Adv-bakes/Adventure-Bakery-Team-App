-- D-09 task 9.7: issue SOP-11.1.7 Equipment and Utensil Specification and Purchasing, and revise
-- FRM-004 Equipment Register to v2 so it holds what the procedure records.
--
-- SOP-11.1.7: active, GJM, 2026-09-21, revision New (first issue). Guarded on the md5 of its content,
-- byte-identical to the seed (20260921000004) - reviewed unchanged. Issued with its step 1 line
-- "wood is not bought for food-contact use" as drafted; SQF 11.7.3.6 would permit dedicated,
-- maintained wooden utensils, so that line is the site's choice and not the Code's requirement.
--
-- FRM-004 v2, in the same transaction so an issued form never points at a draft procedure:
--   * equipment grid gains "Food-contact materials" and "Purchase check (SOP-11.1.7)" after
--     Food contact, and help text saying what goes in the purchase check for existing equipment;
--   * a new dynamic "Utensils and small wares" grid - listed by type, with material and whether it
--     meets the specification - which is where 11.1.7.1's utensil limb is evidenced;
--   * the purpose note says the register is also SOP-11.1.7's record;
--   * sqf_reference adds 11.1.7.1.
-- Every existing field and column id is kept.
--
-- REBUILT 2026-09-21 on the live schema after the first version's md5 guard refused: at 15:14 UTC
-- FRM-004 was saved from the form builder with "entries can be deleted" switched on (settings.deletable
-- false removed). That was done in the app, deliberately, so it is kept as found - this migration does
-- not put it back. Renumbered 000005 -> 000051 to follow 20260921000050 (SOP-401), already applied.
--
-- FRM-004's entry was SUBMITTED at 15:15 under revision New, so the new columns appear on the NEXT
-- register entry, not that one. The vacuum sealer (the CCP 2 machine) is not on the submitted list;
-- it goes on the next entry with "Add equipment" - entry content, not a schema change.

begin;

do $guard$
declare st text; rev text; h text;
begin
  select status, revision, md5(content::text) into st, rev, h from public.sop_documents where sop_number = 'SOP-11.1.7';
  if (st, rev) is distinct from ('draft', 'New') then
    raise exception 'SOP-11.1.7 is %/% - expected the unissued draft.', st, rev;
  end if;
  if h <> '5b0442eeb246d98c4dfff1a5bf8e899d' then
    raise exception 'SOP-11.1.7 changed since it was reviewed (md5 %); review it again before issue.', h;
  end if;
  select status, revision, md5((content->'form_schema')::text) into st, rev, h
    from public.sop_documents where sop_number = 'FRM-004';
  if (st, rev) is distinct from ('active', 'New') then
    raise exception 'FRM-004 is %/% - expected active/New.', st, rev;
  end if;
  if h <> 'eda99b9378f936ee6dc4ae0b263e2324' then
    raise exception 'FRM-004 form_schema changed since this migration was written (md5 %).', h;
  end if;
end $guard$;

update public.sop_documents
   set status         = 'active',
       approved_by    = 'GJM',
       effective_date = date '2026-09-21'
 where sop_number = 'SOP-11.1.7';

update public.sop_documents
   set content        = jsonb_set(content, '{form_schema}', $fs${"sections": [{"id": "purpose", "title": "Purpose & Scope", "fields": [{"id": "purpose_note", "text": "The master list of every item of equipment on site (SQF 11.2.1.2). It is the source list for the preventive maintenance schedule, the calibration programme and the food-grade lubricant register — each of those covers what this register says exists, so an item missing here is an item nothing maintains.\n\nRows are seeded from the equipment SOPs (SOP-501 to SOP-605 and SOP-901 to SOP-905). Add, rename or remove rows as the plant changes; this is a living register, not a checklist.\n\nIt is also the record for SOP-11.1.7 Equipment and Utensil Specification and Purchasing (SQF 11.1.7.1): each machine's food-contact materials and the date it was checked against the specification before purchase, with its manual or specification sheet attached to this entry, and the utensils in use, listed by type.", "type": "info", "label": "Purpose & Scope"}]}, {"id": "register", "title": "Equipment Register", "fields": [{"id": "register_date", "type": "date", "label": "Register date", "width": "third", "required": true, "showInList": true, "defaultToday": true}, {"id": "compiled_by", "role": "filler", "type": "signature", "label": "Compiled by", "width": "third", "required": true, "statement": "I confirm this register lists every item of equipment on site and that the details recorded are correct as at the register date."}, {"id": "contact_note", "text": "Food contact is the column that matters most and the one to check first. “Direct” means product or a food-contact surface touches the equipment (including packaging film that touches product). It decides what the food-grade lubricant requirement (SQF 11.2.1.7) and the calibration programme have to cover, so the seeded values are a starting point to be confirmed by someone who knows the line — not an answer.", "type": "info", "label": "About the Food contact column"}, {"id": "equipment", "rows": {"mode": "fixed", "labels": ["Planetary mixer", "Cookie depositor", "Piston depositor", "Steam-jacketed kettle", "Rack oven", "Bench scale 1", "Bench scale 2", "Shrink wrapper", "Band sealer", "Coder — inkjet", "Coder — handheld", "Flow wrapper", "Pot & pan washer"], "addLabel": "Add equipment", "deletable": true, "labelHeader": "Equipment", "defaultValues": [{"status": "In service", "location": "Production", "make_model": "Hobart V-1401", "food_contact": "Direct", "pm_frequency": "As required", "operating_sop": "SOP-501", "sanitation_sop": "SOP-901"}, {"status": "In service", "location": "Production", "make_model": "Rhodes Kook-E-King Super Automatic", "food_contact": "Direct", "pm_frequency": "As required", "operating_sop": "SOP-502", "sanitation_sop": "SOP-902"}, {"status": "In service", "location": "Production", "make_model": "Beldos 275", "food_contact": "Direct", "pm_frequency": "As required", "operating_sop": "SOP-503", "sanitation_sop": "SOP-903"}, {"status": "In service", "location": "Production", "make_model": "Groen TDB (hand tilt)", "food_contact": "Direct", "pm_frequency": "As required", "operating_sop": "SOP-504", "sanitation_sop": "SOP-904"}, {"status": "In service", "location": "Production", "make_model": "Revent 724", "food_contact": "Indirect", "pm_frequency": "As required", "operating_sop": "SOP-505"}, {"notes": "Calibration scope - see SOP-506", "status": "In service", "location": "Production", "make_model": "OHAUS Defender 3000 i-DT33", "food_contact": "Indirect", "pm_frequency": "As required", "operating_sop": "SOP-506"}, {"notes": "Model not yet confirmed", "status": "In service", "location": "Production", "make_model": "“ULTRA” — model to confirm", "food_contact": "Indirect", "pm_frequency": "As required", "operating_sop": "SOP-506"}, {"notes": "Film is direct food contact (SOP-601)", "status": "In service", "location": "Packaging", "make_model": "Smipack S560NA", "food_contact": "Direct", "pm_frequency": "As required", "operating_sop": "SOP-601"}, {"notes": "Vendor/model not recorded on SOP-602", "status": "In service", "location": "Packaging", "make_model": "Tabletop continuous band sealer", "food_contact": "Direct", "pm_frequency": "As required", "operating_sop": "SOP-602"}, {"status": "In service", "location": "Packaging", "make_model": "SNEED-JET Titan", "food_contact": "Indirect", "pm_frequency": "As required", "operating_sop": "SOP-603"}, {"status": "In service", "location": "Packaging", "make_model": "TOAUTO HP-003", "food_contact": "Indirect", "pm_frequency": "As required", "operating_sop": "SOP-604"}, {"notes": "Film is direct food contact (SOP-605)", "status": "In service", "location": "Packaging", "make_model": "S350X rotary pillow packer", "food_contact": "Direct", "pm_frequency": "As required", "operating_sop": "SOP-605"}, {"notes": "Sanitizes by heat — ~190 °F final rinse", "status": "In service", "location": "Warewashing", "make_model": "Douglas Machines", "food_contact": "None", "pm_frequency": "As required", "operating_sop": "SOP-905", "sanitation_sop": "SOP-905"}]}, "type": "grid", "label": "Equipment", "columns": [{"id": "make_model", "type": "text", "label": "Make & model", "width": 2, "required": true}, {"id": "asset_no", "type": "text", "label": "Serial / asset no.", "width": 1}, {"id": "location", "type": "text", "label": "Location", "width": 1}, {"id": "food_contact", "type": "select", "label": "Food contact", "width": 1, "options": ["Direct", "Indirect", "None"], "required": true}, {"id": "contact_materials", "type": "text", "label": "Food-contact materials"}, {"id": "purchase_check", "type": "text", "label": "Purchase check (SOP-11.1.7)"}, {"id": "operating_sop", "type": "text", "label": "Operating SOP", "width": 1}, {"id": "sanitation_sop", "type": "text", "label": "Sanitation SOP", "width": 1}, {"id": "pm_frequency", "type": "select", "label": "PM frequency", "width": 1, "options": ["Daily", "Weekly", "Monthly", "Quarterly", "Six-monthly", "Annual", "As required", "Not yet set"]}, {"id": "status", "type": "select", "label": "Status", "width": 1, "options": ["In service", "Out of service", "Removed"], "required": true}, {"id": "notes", "type": "text", "label": "Notes", "width": 2}], "help": "Purchase check: the date and who checked the item against SOP-11.1.7 step 1 before it was bought. For equipment already in use when SOP-11.1.7 was issued, write the date it was checked at review, and anything that does not meet the specification in Notes."}, {"id": "utensils", "type": "grid", "label": "Utensils and small wares", "help": "Listed by type, not one row per item: scrapers, spatulas, scoops, molds, sheet pans, bowls, containers. Replacing a listed type like for like needs no new approval; a new type, or the same type in a different material, is checked against SOP-11.1.7 first.", "rows": {"mode": "dynamic", "addLabel": "Add utensil type"}, "columns": [{"id": "item", "type": "text", "label": "Utensil type", "required": true, "width": 2}, {"id": "material", "type": "text", "label": "Material", "required": true, "width": 2}, {"id": "used_for", "type": "text", "label": "Used for", "width": 2}, {"id": "meets_spec", "type": "select", "label": "Meets SOP-11.1.7", "options": ["Yes", "No - to be replaced", "Not yet checked"], "required": true}, {"id": "notes", "type": "text", "label": "Notes", "width": 2}]}], "description": "Every item of equipment on site, with the documents that govern it and its maintenance frequency (SQF 11.2.1.2). PM frequency = preventive maintenance: how often the item is scheduled for planned maintenance."}, {"id": "review", "title": "Review", "fields": [{"id": "reviewed_by", "role": "verifier", "type": "signature", "label": "Reviewed by", "width": "third", "statement": "I have reviewed this register and confirm it is complete and current."}, {"id": "review_date", "type": "date", "label": "Review date", "width": "third"}, {"id": "review_notes", "help": "Equipment added, moved, removed or taken out of service.", "type": "textarea", "label": "Changes since last review"}, {"id": "records_note", "text": "Retained per the record retention policy. Superseded versions are kept as the audit trail of what was on site and when.", "type": "info", "label": "Records"}], "description": "The register is reviewed at least annually and whenever equipment is added, moved or removed."}], "settings": {"attachmentsEnabled": true, "allowMultipleDrafts": false, "requireVerification": true, "instanceTitleTemplate": "Equipment Register — {register_date}"}, "schemaVersion": 1}$fs$::jsonb),
       sqf_reference  = '11.2.1.2, 11.1.7.1',
       revision       = 'v2',
       effective_date = date '2026-09-21',
       approved_by    = 'GJM'
 where sop_number = 'FRM-004';

do $verify$
declare r record; fs jsonb;
begin
  select status, revision, approved_by, effective_date into r from public.sop_documents where sop_number = 'SOP-11.1.7';
  if (r.status, r.revision, r.approved_by, r.effective_date) is distinct from ('active', 'New', 'GJM', date '2026-09-21') then
    raise exception 'SOP-11.1.7 did not issue: %/%/%/%.', r.status, r.revision, r.approved_by, r.effective_date;
  end if;
  select status, revision, approved_by, sqf_reference, content->'form_schema' as f into r
    from public.sop_documents where sop_number = 'FRM-004';
  fs := r.f;
  if (r.status, r.revision, r.approved_by, r.sqf_reference) is distinct from ('active', 'v2', 'GJM', '11.2.1.2, 11.1.7.1') then
    raise exception 'FRM-004 not revised: %/%/%/%.', r.status, r.revision, r.approved_by, r.sqf_reference;
  end if;
  if (select count(*) from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f) <> 10 then
    raise exception 'FRM-004 should have 10 fields.';
  end if;
  if (select jsonb_array_length(f->'columns') from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
       where f->>'id' = 'equipment') <> 11
     or not exists (select 1 from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f,
                           jsonb_array_elements(f->'columns') c
                     where f->>'id' = 'equipment' and c->>'id' = 'purchase_check') then
    raise exception 'FRM-004 equipment grid is missing the purchase check.';
  end if;
  if not exists (select 1 from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
                  where f->>'id' = 'utensils' and f->>'type' = 'grid' and f->'rows'->>'mode' = 'dynamic') then
    raise exception 'FRM-004 has no utensil list.';
  end if;
  raise notice 'D-09: SOP-11.1.7 issued; FRM-004 v2 records it.';
end $verify$;

commit;
