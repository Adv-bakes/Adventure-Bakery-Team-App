-- D-14 task 14.10, brought forward - FRM-507 and FRM-606, the CCP monitoring records. Seeded DRAFT.
--
-- WHY THESE, AND WHY NOW. The site's HACCP plan (version 1.0, issued 23 June 2026) defines two
-- critical control points - CCP 1 Baking and CCP 2 Vacuum sealing - and requires a monitoring record
-- for each. Both are monitored on the floor; neither is recorded. That is why FSQM-017 v3 records the
-- Mandatory 2.5.2.1 as unmet for CCPs, and why 2.4.3.16 (CCP monitoring, corrective action and
-- verification records shall be maintained) has nothing to point at. D-14 orders this task late, after
-- the hazard analysis is redone. It is built first because every day without it is a day of CCP checks
-- that leave no evidence, and a form revision when the rebuild moves a limit costs almost nothing.
--
-- WHAT THE OWNER CONFIRMED ON 2026-09-11, AND WHERE EACH ANSWER LANDS:
--   * The production operator performs the monitoring. Both forms are filled by the operator, row by
--     row, as the checks are done.
--   * CCP 1: oven temperature and bake time are checked; the internal product temperature is NOT
--     probed. The plan's 180 F limit is therefore NOT silently dropped. It stays in the printed limits
--     marked NOT YET PERFORMED, the column exists but is optional, and a REQUIRED per-day answer says
--     whether it was probed. A Pass in "Within critical limits" is stated on the form to mean the oven
--     and time limits only. A record that looks complete while omitting a limit is worse than one that
--     shows the gap.
--   * CCP 2: the vacuum gauge, a visual check of every pouch, and a pull test are all performed, so
--     all three are required columns. The plan gives the vacuum level and seal width only as "per
--     equipment specification" (typical 27 in. Hg and 5 mm); the form says neither is confirmed, and
--     records the gauge reading without claiming it is within a limit nobody has set.
--   * Verification: the reviewer signs, then submits. verified_by is a REQUIRED verifier-role
--     signature, so no CCP record can be filed unreviewed - that is the 2.5.2.1 authorization. Entries
--     wait as drafts for the review, which is why allowMultipleDrafts is true: a week of production
--     days must be a week of separate entries, not one draft resumed.
--   * Scope: only the product the HACCP plan covers. No product, customer or person is named in either
--     definition; entries record the product.
--
-- FSQM-017 PART 5 IS BUILT IN. A person does not verify their own monitoring where a second qualified
-- person is available, and where one is not the record says so - a required select on each form.
--
-- DEVIATIONS follow the plan and route into the programs already in force: hold and tag on FRM-702
-- under FSQM-018, cause and action on FRM-007 under FSQM-009, nothing released on FRM-701 until the
-- disposition is recorded. The pre-guard requires all of those to be active.
--
-- NOT DONE HERE, deliberately, because both forms are drafts:
--   * verification_schedule ccp_record_review stays 'planned'. Activating it before these are issued
--     would have the job prompting a review of records nobody is yet required to keep.
--   * SOP-505 still says oven temperature and bake time go on the batch sheet. No batch sheet holds
--     either. That line is repointed at FRM-507 when FRM-507 is issued, not before.
--
-- Numbers: FRM-507 in the Production block and FRM-606 in Packaging, clear of SOP-501..506 and
-- REP-602/603 so no two live documents share a number across prefixes.

begin;

do $$
declare r record;
begin
  select
    (select count(*) from public.sop_documents where sop_number in ('FRM-507', 'FRM-606'))  as taken,
    (select count(*) from public.sop_documents where content::text ~ '(FRM-507|FRM-606)')   as cited,
    (select count(*) from public.sop_documents
      where sop_number in ('FRM-702', 'FRM-007', 'FRM-701', 'FSQM-018', 'FSQM-009', 'FSQM-017')
        and status = 'active')                                                             as routes_active
  into r;
  if r.taken <> 0 then
    raise exception 'FRM-507 or FRM-606 already exists.';
  end if;
  if r.cited <> 0 then
    raise exception '% document(s) already cite FRM-507 or FRM-606; the numbers are not free.', r.cited;
  end if;
  -- Both forms send deviations to these; they must be in force to send them to.
  if r.routes_active <> 6 then
    raise exception 'Only % of FRM-702, FRM-007, FRM-701, FSQM-018, FSQM-009, FSQM-017 are active; expected 6.', r.routes_active;
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values
  ('FRM-507', 'CCP 1 Baking Monitoring Record', 'form', 'Module 2', 'draft', 'New',
   $sq$2.4.3.12, 2.4.3.13, 2.4.3.15, 2.4.3.16, 2.5.2.1$sq$, true, jsonb_build_object('form_schema', $j507${"schemaVersion": 1, "settings": {"deletable": false, "attachmentsEnabled": true, "allowMultipleDrafts": true, "requireVerification": true, "instanceTitleTemplate": "{production_date} — CCP 1 Baking"}, "sections": [{"id": "day", "title": "1. Production day", "fields": [{"id": "how_this_works", "type": "info", "label": "Before you start", "text": "ONE RECORD PER PRODUCTION DAY, for the product covered by the site's HACCP plan. Add a row for every oven load as it comes out, and write the readings at the oven rather than at the end of the shift. A critical control point that was checked and not written down was, as far as anyone else can tell, not checked.\n\nCCP 1 IS THE KILL STEP. The bake destroys pathogens that come in with the liquid egg, Salmonella among them. The critical limits below are the HACCP plan's.\n\nIF A LIMIT IS NOT MET, the load is not released. Section 3 says what happens to it.\n\nWHEN THE DAY IS DONE, sign Section 4 and leave the entry as a draft. It is reviewed, the verification is signed, and the reviewer submits it."}, {"id": "production_date", "type": "date", "label": "Production date", "width": "third", "required": true, "showInList": true, "defaultToday": true}, {"id": "product", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true, "help": "The product covered by the HACCP plan."}, {"id": "limits", "type": "reference_table", "label": "CCP 1 critical limits (HACCP plan)", "columns": ["Critical limit", "Limit", "How it is checked", "How often"], "rows": [["Oven temperature", "At least 350°F", "The oven's temperature reading", "Every load"], ["Bake time", "At least 27 minutes", "The oven timer", "Every load"], ["Internal product temperature", "At least 180°F at the end of the bake", "Probe thermometer in the centre of one unit", "Each batch - NOT YET PERFORMED, see Section 2"]]}]}, {"id": "loads", "title": "2. Oven loads", "fields": [{"id": "oven_loads", "type": "grid", "label": "Oven loads", "required": true, "help": "One row per load, written when the load comes out of the oven. A rebake is a new row with the same lot code.", "rows": {"mode": "dynamic", "min": 1, "addLabel": "Add an oven load"}, "columns": [{"id": "time_out", "type": "time", "label": "Time out of oven", "width": 1, "required": true, "defaultTo": "now"}, {"id": "lot_code", "type": "text", "label": "Lot / batch code", "width": 2, "required": true}, {"id": "oven_temp", "type": "number", "label": "Oven temperature", "unit": "°F", "width": 1, "required": true}, {"id": "bake_time", "type": "number", "label": "Bake time", "unit": "min", "width": 1, "required": true}, {"id": "internal_temp", "type": "number", "label": "Internal temperature, if probed", "unit": "°F", "width": 1}, {"id": "within_limits", "type": "pass_fail", "label": "Within critical limits", "width": 1, "required": true}, {"id": "initials", "type": "text", "label": "Initials", "width": 1, "required": true, "defaultTo": "currentUserInitials"}, {"id": "note", "type": "text", "label": "Note", "width": 2}]}, {"id": "internal_temp_info", "type": "info", "label": "Internal product temperature - not yet performed", "text": "The HACCP plan's third limit for CCP 1 is an internal product temperature of at least 180°F at the end of the bake, probed in the centre of at least one unit per batch. That check is not performed on this site today.\n\nLeave the column blank unless a probe reading was actually taken, and never write a figure that was not measured. Until the probe check is in place, a Pass in Within critical limits means the oven temperature and bake time limits were met - it does not mean the 180°F limit was, and this record does not claim it."}, {"id": "internal_temp_status", "type": "select", "label": "Internal temperature on this day", "width": "half", "required": true, "options": ["Not probed - probe check not yet in place", "Probed - a reading is recorded against every load"]}]}, {"id": "deviation", "title": "3. If a limit was not met", "fields": [{"id": "deviation_info", "type": "info", "label": "What to do", "text": "OVEN TEMPERATURE BELOW 350°F, OR BAKE TIME UNDER 27 MINUTES: do not release the load. Return it to the oven and complete a full bake cycle, and record the rebake as a new row in Section 2 with the same lot code.\n\nIF THE LOAD CANNOT BE REBAKED, or a probed internal temperature is below 180°F after a full bake: put the product on Hold and tag it on FRM-702 under FSQM-018. The SQF Practitioner decides whether it is rebaked or destroyed.\n\nEVERY DEVIATION is investigated for its cause and recorded on FRM-007 under FSQM-009. Held product is not released on FRM-701 until its disposition is recorded."}, {"id": "deviations_today", "type": "select", "label": "Deviations on this day", "width": "half", "required": true, "options": ["None - every load met the limits", "Yes - each one is recorded below"]}, {"id": "deviation_log", "type": "grid", "label": "Deviations", "help": "Required for every deviation. Leave empty only where the answer above is None.", "rows": {"mode": "dynamic", "min": 0, "addLabel": "Add a deviation"}, "columns": [{"id": "lot_code", "type": "text", "label": "Lot / batch code", "width": 2, "required": true}, {"id": "what", "type": "text", "label": "What was out of limit", "width": 3, "required": true}, {"id": "action", "type": "select", "label": "Action taken", "width": 2, "required": true, "options": ["Rebaked - full cycle", "Held on FRM-702", "Destroyed"]}, {"id": "reference", "type": "text", "label": "FRM-702 / FRM-007 reference", "width": 2}]}]}, {"id": "signoff", "title": "4. Sign-off", "fields": [{"id": "monitored_by", "type": "signature", "role": "filler", "width": "half", "required": true, "label": "Monitored by (production operator)", "statement": "I took the readings recorded above at the time of each load, and recorded them as taken."}, {"id": "verification_independence", "type": "select", "width": "half", "required": true, "label": "Who verified this record", "help": "FSQM-017 Part 5: a person does not verify their own monitoring where a second qualified person is available. Where one is not, say so here.", "options": ["Someone other than the operator who took the readings", "No second qualified person available - verified by the operator"]}, {"id": "verified_by", "type": "signature", "role": "verifier", "width": "half", "required": true, "label": "Verified by", "statement": "I have reviewed this record against the CCP 1 critical limits, and every deviation on it has a recorded action."}]}]}$j507$::jsonb)),
  ('FRM-606', 'CCP 2 Vacuum Sealing Monitoring Record', 'form', 'Module 2', 'draft', 'New',
   $sq$2.4.3.12, 2.4.3.13, 2.4.3.15, 2.4.3.16, 2.5.2.1$sq$, true, jsonb_build_object('form_schema', $j606${"schemaVersion": 1, "settings": {"deletable": false, "attachmentsEnabled": true, "allowMultipleDrafts": true, "requireVerification": true, "instanceTitleTemplate": "{production_date} — CCP 2 Vacuum Sealing"}, "sections": [{"id": "day", "title": "1. Production day", "fields": [{"id": "how_this_works", "type": "info", "label": "Before you start", "text": "ONE RECORD PER PRODUCTION DAY, for the product covered by the site's HACCP plan. Add a row at set-up, at least every hour through the run, after any change or adjustment to the sealer, and at the end of the run. Write each row when the check is done.\n\nCCP 2 PROTECTS THE PRODUCT AFTER THE BAKE. A failed seal lets in air and microbial contamination and ends the product's shelf stability. The critical limits below are the HACCP plan's.\n\nWATCH THE GAUGE ON EVERY CYCLE AND LOOK AT EVERY POUCH. The rows record the checks; they do not replace watching. Any cycle or pouch that fails stops the run - Section 3 says what happens next.\n\nWHEN THE DAY IS DONE, sign Section 4 and leave the entry as a draft. It is reviewed, the verification is signed, and the reviewer submits it."}, {"id": "production_date", "type": "date", "label": "Production date", "width": "third", "required": true, "showInList": true, "defaultToday": true}, {"id": "product", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true, "help": "The product covered by the HACCP plan."}, {"id": "limits", "type": "reference_table", "label": "CCP 2 critical limits (HACCP plan)", "columns": ["Critical limit", "Limit", "How it is checked", "How often"], "rows": [["Vacuum level", "To the sealer's specification - NOT YET CONFIRMED for this machine (typical 27 in. Hg)", "The sealer's vacuum gauge", "Every cycle"], ["Seal integrity", "No visible leak, channel, wrinkle across the seal, or partial seal", "Visual check", "Every pouch"], ["Seal width", "To the sealer's specification - NOT YET CONFIRMED for this machine (typical 5 mm)", "Inspection of the seal", "With each pull test"], ["Seal strength", "The seal holds under a pull test", "Pull test on one pouch", "At set-up, after any change, and at least hourly"]]}]}, {"id": "checks", "title": "2. Sealing checks", "fields": [{"id": "seal_checks", "type": "grid", "label": "Sealing checks", "required": true, "help": "A row at set-up, at least hourly, after any change or adjustment, and at the end of the run.", "rows": {"mode": "dynamic", "min": 1, "addLabel": "Add a check"}, "columns": [{"id": "time", "type": "time", "label": "Time", "width": 1, "required": true, "defaultTo": "now"}, {"id": "check", "type": "select", "label": "Check", "width": 2, "required": true, "options": ["Set-up", "Hourly", "After a change or adjustment", "End of run"]}, {"id": "lot_code", "type": "text", "label": "Lot / batch code", "width": 2, "required": true}, {"id": "vacuum_reading", "type": "number", "label": "Vacuum gauge reading", "unit": "in. Hg", "width": 1, "required": true}, {"id": "visual", "type": "pass_fail", "label": "Every pouch since the last check free of seal defects", "width": 2, "required": true}, {"id": "pull_test", "type": "pass_fail", "label": "Pull test held", "width": 1, "required": true}, {"id": "seal_width", "type": "number", "label": "Seal width, if measured", "unit": "mm", "width": 1}, {"id": "initials", "type": "text", "label": "Initials", "width": 1, "required": true, "defaultTo": "currentUserInitials"}, {"id": "note", "type": "text", "label": "Note", "width": 2}]}, {"id": "spec_info", "type": "info", "label": "Two limits are not yet confirmed", "text": "The HACCP plan sets the vacuum level and the seal width to the sealer's specification, and gives only typical values (27 in. Hg and 5 mm). Neither has been confirmed for this site's machine. Until it is, write the gauge reading exactly as it shows - this record captures it but cannot show it as within a limit nobody has confirmed. A reading clearly out of line with the rest of the run is treated as a failed cycle.\n\nThe visual check and the pull test ARE judged here, against the limits above."}]}, {"id": "deviation", "title": "3. If a limit was not met", "fields": [{"id": "deviation_info", "type": "info", "label": "What to do", "text": "A FAILED CYCLE, A POUCH WITH A SEAL DEFECT, OR A FAILED PULL TEST:\n1. Stop sealing.\n2. Put on Hold, and tag on FRM-702 under FSQM-018, everything sealed since the last check that passed.\n3. Inspect the held pouches: reseal those that can be resealed, and destroy those that cannot.\n4. Inspect or adjust the sealer, then seal a pouch and pull-test it. Record that as an \"After a change or adjustment\" row before production restarts.\n5. Notify the SQF Practitioner, and record the cause and the action on FRM-007 under FSQM-009.\n\nHeld product is not released on FRM-701 until its disposition is recorded."}, {"id": "deviations_today", "type": "select", "label": "Deviations on this day", "width": "half", "required": true, "options": ["None - every check passed", "Yes - each one is recorded below"]}, {"id": "deviation_log", "type": "grid", "label": "Deviations", "help": "Required for every deviation. Leave empty only where the answer above is None.", "rows": {"mode": "dynamic", "min": 0, "addLabel": "Add a deviation"}, "columns": [{"id": "time", "type": "time", "label": "Time", "width": 1, "required": true}, {"id": "lot_code", "type": "text", "label": "Lot / batch code", "width": 2, "required": true}, {"id": "what", "type": "text", "label": "What failed", "width": 3, "required": true}, {"id": "units_held", "type": "text", "label": "Pouches held", "width": 1}, {"id": "action", "type": "select", "label": "Action taken", "width": 2, "required": true, "options": ["Resealed", "Held on FRM-702", "Destroyed"]}, {"id": "reference", "type": "text", "label": "FRM-702 / FRM-007 reference", "width": 2}]}]}, {"id": "signoff", "title": "4. Sign-off", "fields": [{"id": "monitored_by", "type": "signature", "role": "filler", "width": "half", "required": true, "label": "Monitored by (production operator)", "statement": "I performed the checks recorded above at the times shown, and recorded them as found."}, {"id": "verification_independence", "type": "select", "width": "half", "required": true, "label": "Who verified this record", "help": "FSQM-017 Part 5: a person does not verify their own monitoring where a second qualified person is available. Where one is not, say so here.", "options": ["Someone other than the operator who took the readings", "No second qualified person available - verified by the operator"]}, {"id": "verified_by", "type": "signature", "role": "verifier", "width": "half", "required": true, "label": "Verified by", "statement": "I have reviewed this record against the CCP 2 critical limits, and every deviation on it has a recorded action."}]}]}$j606$::jsonb));

do $$
declare
  r record;
  n text;
  expect_fields int;
begin
  foreach n in array array['FRM-507', 'FRM-606'] loop
    expect_fields := case n when 'FRM-507' then 13 else 12 end;
    select
      d.status, d.type, d.revision, d.sqf_required,
      (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                            jsonb_array_elements(s->'fields') f)                                          as fields,
      (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                            jsonb_array_elements(s->'fields') f
        where f->>'type' = 'signature' and f->>'role' = 'verifier'
          and coalesce((f->>'required')::boolean, false))                                                 as req_verifier,
      (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                            jsonb_array_elements(s->'fields') f
        where f->>'type' = 'signature' and f->>'role' = 'filler'
          and coalesce((f->>'required')::boolean, false))                                                 as req_filler,
      (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                            jsonb_array_elements(s->'fields') f
        where f->>'type' = 'grid' and coalesce((f->>'required')::boolean, false))                         as req_grids,
      (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                            jsonb_array_elements(s->'fields') f
        where f->>'id' = 'verification_independence' and coalesce((f->>'required')::boolean, false))       as independence,
      d.content->'form_schema'->'settings'->>'deletable'                                                  as deletable,
      d.content->'form_schema'->'settings'->>'allowMultipleDrafts'                                        as multi,
      d.content->'form_schema'->'settings'->>'requireVerification'                                        as req_verif,
      lower(d.content::text) ~ '(diana|gabriela|samboni|juncos|christina|richard|pickett|\mrum\M|\mcake|bahamas)' as named,
      position(chr(13) in d.content::text) > 0                                                            as crs
    into r
    from public.sop_documents d
    where d.sop_number = n;

    if r.status is distinct from 'draft' or r.type is distinct from 'form' or r.revision is distinct from 'New'
       or r.sqf_required is distinct from true then
      raise exception '% row wrong (status=%, type=%, revision=%, sqf_required=%).', n, r.status, r.type, r.revision, r.sqf_required;
    end if;
    if r.fields <> expect_fields then
      raise exception '% has % fields, expected %.', n, r.fields, expect_fields;
    end if;
    -- 2.5.2.1: the person verifying authorizes the record, and the form will not submit without it.
    if r.req_verifier <> 1 or r.req_filler <> 1 then
      raise exception '% signatures wrong (required verifier=%, required operator=%).', n, r.req_verifier, r.req_filler;
    end if;
    -- A required grid is what stops a CCP record being submitted with no readings on it.
    if r.req_grids <> 1 then
      raise exception '% needs exactly one required monitoring grid; found %.', n, r.req_grids;
    end if;
    if r.independence <> 1 then
      raise exception '% is missing the required FSQM-017 Part 5 independence answer.', n;
    end if;
    if r.deletable is distinct from 'false' or r.multi is distinct from 'true' or r.req_verif is distinct from 'true' then
      raise exception '% settings wrong (deletable=%, allowMultipleDrafts=%, requireVerification=%).', n, r.deletable, r.multi, r.req_verif;
    end if;
    if r.named then
      raise exception '% definition names a person, product or customer.', n;
    end if;
    if r.crs then raise exception 'CR characters are present in %.', n; end if;
  end loop;

  -- The CCP 1 internal-temperature limit must stay visible as not performed, never quietly absent.
  if not exists (
    select 1 from public.sop_documents d,
           jsonb_array_elements(d.content->'form_schema'->'sections') s,
           jsonb_array_elements(s->'fields') f
     where d.sop_number = 'FRM-507' and f->>'id' = 'internal_temp_status'
       and coalesce((f->>'required')::boolean, false)
       and f->'options' @> '["Not probed - probe check not yet in place"]'::jsonb) then
    raise exception 'FRM-507 no longer carries the required internal-temperature answer.';
  end if;
  -- Nothing in this migration touches the schedule; the CCP review stays planned until issue.
  if (select status from public.verification_schedule where activity_key = 'ccp_record_review') is distinct from 'planned' then
    raise exception 'ccp_record_review is no longer planned; it must not be activated before these forms are issued.';
  end if;
end $$;

commit;
