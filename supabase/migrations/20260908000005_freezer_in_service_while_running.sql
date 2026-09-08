-- Freezer stays IN SERVICE while it is running. Aligns SOP-401 and FRM-401 with the
-- site's actual rule, settled 2026-09-08.
--
-- THE RULE CHANGED, NOT THE FACT. The seed said the walk-in freezer was out of service because
-- it holds no product since the vegan burger line was discontinued. The site's rule is that a
-- unit goes out of service when it is SWITCHED OFF, not when it happens to be empty. The
-- freezer is still running, so it stays in service and is judged against its 10 F limit.
--
-- This is the better rule and the documents were the ones that were wrong. A running unit that
-- cannot hold its temperature is worth knowing about whether or not there is product in it that
-- day, and an empty unit is the cheapest possible moment to discover it. The temperature_limits
-- row was already changed through the Limits editor at 16:43 UTC on 2026-09-08; this makes the
-- procedure and its record say the same thing, because a procedure that contradicts the
-- configuration it describes is the FSQM-018 dangling-citation problem in miniature.
--
-- BOTH DOCUMENTS IN ONE MIGRATION on purpose: a partial application would leave SOP-401 saying
-- the freezer is out of service while its own record defaults it to in service.
--
-- SOP-401 keeps its line counts exactly (53 lines: 8 Parts, 27
-- bullets, 18 prose) - this is a wording change in place, not a restructure, and the
-- guard below proves it.

begin;

-- Before-state. Both documents must still be drafts carrying the OLD wording; if either has
-- already moved on, stop rather than overwrite work this migration cannot see.
do $$
declare
  n int;
  st text;
begin
  select status into st from public.sop_documents where sop_number = 'SOP-401';
  if st is null then
    raise exception 'SOP-401 not found.';
  end if;
  if st <> 'draft' then
    raise exception 'SOP-401 is %, not draft. Amending an issued procedure needs a revision bump.', st;
  end if;

  select count(*) into n
    from public.sop_documents d, jsonb_array_elements_text(d.content -> 'procedure') t(line)
   where d.sop_number = 'SOP-401'
     and t.line like '%out of service. It holds no product and may be switched off%';
  if n <> 1 then
    raise exception 'Expected exactly 1 procedure line with the old freezer wording, found %.', n;
  end if;

  -- The freezer's OWN default, located by its position in the grid's labels rather than by a
  -- hardcoded index. NOT a substring search over the whole schema: "Out of service" also
  -- appears as a selectable OPTION in that dropdown and must stay there - the review has to be
  -- able to record a unit as out of service. An earlier version of this guard asserted the
  -- string was absent from the document entirely, which could only ever be true of a form that
  -- cannot record the state at all.
  select count(*) into n
    from public.sop_documents d,
         jsonb_array_elements(d.content -> 'form_schema' -> 'sections') s,
         jsonb_array_elements(s -> 'fields') f,
         jsonb_array_elements_text(coalesce(f -> 'rows' -> 'labels', '[]'::jsonb))
           with ordinality as lab(label, idx)
   where d.sop_number = 'FRM-401'
     and f ->> 'id' = 'unit_summary'
     and lab.label = 'Walk-In Freezer'
     and (f -> 'rows' -> 'defaultValues' -> (lab.idx::int - 1) ->> 'state') = 'Out of service';
  if n <> 1 then
    raise exception 'FRM-401 freezer default is not "Out of service" (matched % row(s)); it may already be amended.', n;
  end if;
end $$;

-- Prove nothing outside the edited keys moves.
create temporary table sop401_before on commit drop as
select md5((content - 'procedure' - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'SOP-401';

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(content, '{procedure}', $p401a$["Units and their state", "> The site has three temperature sensors. Two are in storage units that are judged against a limit; the third monitors the production area and is not a storage unit.", "• Walk-In Refrigerator (sensor d88b4c010010b5da) — holds butter, liquid eggs and other refrigerated ingredients. In service.", "• Walk-In Freezer (sensor d88b4c010010b513) — in service and monitored. It currently holds no product, but it is running and holding a temperature, so it is judged against its limit. It is placed out of service when it is switched off, not when it happens to be empty.", "• Bakery Floor (sensor d88b4c010010b70a) — ambient monitoring of the production area. It is not a storage unit, no temperature limit applies to it, and it raises no alert.", "> The current state of every unit, its limit and who its alerts go to are held in the Team App under Compliance → Temperature Monitoring. That page is the controlled record of those settings; this procedure states them so that a reader on paper knows what they should be.", "> A temperature reading for each in-service unit shall be readable without entering the unit, so that a unit can be checked without opening the door.", "Limits", "• Walk-In Refrigerator: at or below 41 °F.", "• Walk-In Freezer, while in service: at or below 10 °F.", "> A reading exactly at the limit passes; a reading beyond it fails. 41 °F is the temperature at or below which time/temperature control for safety foods must be held. The refrigerator has never exceeded it in the logged history, so the limit reflects what the unit actually does rather than setting a target it will breach on an ordinary day.", "> Limits are changed only by the SQF Practitioner, in the Team App. A limit change takes effect immediately for all subsequent readings and is not applied backwards.", "Monitoring — the alert is the check", "> Each sensor reports continuously, roughly hourly, and every reading is retained. The Team App examines those readings every fifteen minutes and raises an alert in any of three cases:", "• Out of range — the two most recent readings from an in-service unit are both beyond its limit. Two readings, not one, so that a door held open while ingredients are carried out does not raise an alert.", "• No data — nothing has been logged for the unit for more than six hours.", "• Low battery — the sensor reports a low battery, which is how a unit stops being monitored.", "> This automated check is the monitoring check required by SQF 11.6.2.3, and its frequency is every fifteen minutes. There is no separate daily manual temperature round: with continuous logging and an automatic check, a once-a-day reading would add work and detect less. What the site does instead is verify monthly that the system worked — Part 6 and FRM-401.", "> An alert is sent by email to the recipients recorded against the unit and appears on the Temperature Monitoring page. An alert that nobody has responded to is re-sent every twenty-four hours until it is acknowledged.", "Responding to an out-of-range alert", "• Go to the unit. Check that the door is shut and sealing, that nothing is blocking the airflow or piled against the evaporator, and that the unit is running.", "• Take a reading with the probe thermometer and compare it to what the sensor is reporting.", "• Correct what you can — close the door, move what is blocking the airflow, restart the unit.", "• If the unit cannot be brought back within its limit, tell the SQF Practitioner immediately and move the product to another unit that can hold it.", "• Acknowledge the alert in the Team App, saying what you found and what you did.", "> The acknowledgment is the corrective action record that SQF 11.6.2.3 requires. It is written once and cannot be edited afterwards, so write what actually happened, including the time and the probe reading.", "> The SQF Practitioner decides what happens to any product that was in the unit. Product whose safety or quality is in doubt is placed on Hold under FSQM-018 Non-Conforming Product and Equipment and recorded on FRM-702; it is not released or used until that hold is dispositioned. A corrective and preventive action is raised under FSQM-009 where one of its Part 3 triggers is met — a repeat excursion on the same unit being the usual one.", "Responding to a no-data or low-battery alert", "> A sensor that has stopped reporting does not mean the unit is fine. It means nobody knows, and the unit is unmonitored until it reports again. Logging stopped three times in the first ten weeks of monitoring — once for more than three days — and nobody noticed, which is why absence of data raises an alert of its own.", "• Check that the sensor has power and replace the battery if it is low.", "• Until logging resumes, read each affected in-service unit at the start and at the end of each production day and record those readings on FRM-401.", "• If logging cannot be restored the same day, tell the SQF Practitioner.", "• Acknowledge the alert in the Team App with what was done.", "Monthly review and device accuracy", "> Once a month the SQF Practitioner reviews the previous month on FRM-401 and signs it. This is the verification activity required by SQF 2.5.2.1: the alert does the monitoring, and this confirms the monitoring worked.", "• Confirm that each in-service unit held its limit for the month, and record the minimum, maximum and average from the Temperature Monitoring page.", "• Confirm that every alert raised in the month was acknowledged, and that the action recorded was appropriate.", "• Confirm that there were no unexplained gaps in logging.", "• Compare the probe thermometer against each in-service unit's sensor, both reading the same location at the same time, and record both values.", "> The probe thermometer is the reference. If the two agree within ±2 °F, record a pass. If they differ by more, the sensor is treated as suspect: record the difference, tell the SQF Practitioner, and arrange for the sensor to be replaced or the reference re-checked before the next month's review. Readings taken while a sensor is suspect are confirmed with the probe.", "> When the site writes a single calibration program covering all its measuring devices, this accuracy check transfers into it and this Part will be revised to point there.", "Out of service, and return to service", "> A storage unit is placed out of service when it holds no food AND has been switched off. A unit that is still running stays in service and is judged against its limit whether or not there is product in it that day: it is holding a temperature, and a failure to hold it is worth knowing about before product goes back in. Placing a unit out of service is a recorded decision, not simply switching it off.", "• Only the SQF Practitioner places a unit in or out of service, in the Team App, recording the reason.", "• While a unit is out of service its readings are not judged against its limit and no alert is raised for it.", "• No food of any kind may be stored in an out-of-service unit.", "> Before a unit is returned to service and any food is placed in it, all of the following shall be true: it has been cleaned and sanitized; it has been inspected and found in good repair, with door seals intact; its sensor is reporting; and it has held at or below its limit continuously for twenty-four hours.", "• The SQF Practitioner records the return to service on FRM-401, including the twenty-four hour hold and the date food was first placed in the unit.", "Condition, capacity and drainage of the units", "> SQF 11.6.2 asks more of cold storage than a temperature. The units themselves shall be capable of holding the site's maximum expected volume at the required temperature, be constructed so that they can be cleaned and maintained, and drain their defrost and condensate water to the site's drainage system rather than onto the floor or onto stored product.", "• These are confirmed at issue of this procedure and re-inspected monthly on FRM-913 under its 11.6.2 Cold Storage line, which is where facility condition is already recorded.", "• A defect found in a unit's condition, capacity or drainage is raised as a corrective and preventive action under FSQM-009 and repaired.", "> The monthly facility inspection carries this, rather than a second inspection of its own, so that a defect in a walk-in is found and closed the same way as a defect anywhere else in the plant."]$p401a$::jsonb),
                   '{revision_history}', $r401a$"Rev New — written 2026-09-08 against SQF Food Safety Code: Food Manufacturing, Edition 9, element 11.6.2 Cold Storage. DRAFT. Not approved, not in force.\n\nWHY IT EXISTS. Three sensors have logged temperatures continuously since 2026-06-24 and the Team App has displayed them since, but no document in the register cited 11.6.2 at all. The data was being collected and nobody had written down what \"good\" meant, what to do when it wasn't, or that anyone had looked. Of the four obligations in 11.6.2.3 the sensors satisfied one — records kept.\n\nTHE ALERT IS THE CHECK, AND IT WAS BUILT FIRST. 11.6.2.3 wants a stated frequency of checks and a corrective action for readings out of specification. With three to four staff, the answer was not another daily clipboard round. The Team App now examines every in-service unit every fifteen minutes, emails whoever is on the unit's recipient list, and records what the responder did. That alerting was built and proven before this procedure was written, deliberately: FSQM-018 spent months citing a \"Positive Release Procedure\" that existed nowhere, and a procedure describing an alert that had not been built would have repeated exactly that mistake.\n\nABSENCE OF DATA IS ALERTED, WHICH IS THE REAL LESSON FROM THE FIRST TEN WEEKS. Logging stopped three times, the longest gap three days and two hours, and nobody noticed. A dead sensor reads as perfect compliance, so an alert that fired only on a bad reading would have been silent through every one of those gaps. Part 5 exists because of them.\n\nWHY THE MONTHLY REVIEW IS MONTHLY. Once the system watches continuously, the human job is no longer observation — it is verification under 2.5.2.1 that the monitoring worked. A monthly review of an alert log is defensible and is likely to actually happen; a weekly one, on top of an automated check, is work that adds nothing and gets skipped.\n\nWHY 41 °F. The refrigerator has never exceeded 41 °F in the logged history and reached exactly 41 only once. A tighter limit would ship already breached, and a limit that fails on an ordinary day teaches staff to ignore alerts.\n\nOUT OF SERVICE TURNS ON BEING SWITCHED OFF, NOT ON BEING EMPTY (site decision, 2026-09-08). The freezer has held no product since the vegan burger line was discontinued, but it is still running, so it stays in service and is judged against its limit. A running unit that fails to hold its temperature is worth knowing about whether or not there is product in it that day, and an empty unit is the cheapest possible time to discover the unit is failing. It will be placed out of service when it is actually switched off. Part 7 makes that a recorded decision with stated conditions for coming back — including holding at limit for twenty-four hours before food goes in.\n\nCONDITION AND DRAINAGE REUSE AN EXISTING RECORD. 11.6.2.1, .2 and .4 are one-time confirmations plus ongoing re-inspection, and FRM-913 already inspects facility condition monthly under an 11.6.2 Cold Storage line. Part 8 uses it rather than creating a second inspection, so a defect in a walk-in is found and closed the same way as a defect anywhere else in the plant.\n\nOPEN BEFORE ISSUE — seven things that must be done on the floor before this procedure is approved. None can be closed by writing:\n\n1. Probe the refrigerator at several points and move the sensor to the warmest part of the room, which is where 11.6.2.3 requires monitoring equipment to sit. Record where it was placed.\n\n2. Confirm that a temperature reading can be seen without entering each in-service unit, and name that display in Part 1. 11.6.2.3 requires the measurement device to be easily readable and accessible.\n\n3. Trace the defrost and condensate drain on both units to the site's drainage system and confirm it does not discharge onto the floor or onto stored product (11.6.2.4).\n\n4. Walk both units for condition, cleanability and capacity and photograph them (11.6.2.1, 11.6.2.2). Capacity means the maximum volume the site actually expects to hold, not the volume held today.\n\n5. Obtain the YoLink sensor's stated accuracy and the probe thermometer's make and accuracy. Part 6's ±2 °F tolerance is written to be reasonable but has not been checked against either device's specification; confirm it, and change it if the devices cannot support it.\n\n6. Establish the date the vegan burger line was discontinued. It is owed to the D-35 scope determination and to four shelf-life records that still read \"Frozen, 18 months\". The freezer's service state is no longer open: it was settled on 2026-09-08 — it stays in service while it is running.\n\n7. Establish what caused the three logging gaps, so that Part 5 addresses the real failure mode rather than assuming a flat battery.\n\nALSO NOTED, NOT FIXED HERE. The Temperature Monitoring page's Avg Humidity column always reads 0 because the sensors do not report humidity; and sop-drafts/scope-determination-temperature-controlled-distribution.md still describes the freezer as \"in daily use\", which is no longer true."$r401a$::jsonb)
 where sop_number = 'SOP-401';

do $$
declare
  untouched boolean;
begin
  select b.h = md5((d.content - 'procedure' - 'revision_history')::text) into untouched
    from public.sop_documents d, sop401_before b
   where d.sop_number = 'SOP-401';
  if not untouched then
    raise exception 'SOP-401: a section other than procedure/revision_history changed.';
  end if;
end $$;

-- FRM-401: the whole schema is rewritten, so the guard is on everything ELSE in content.
create temporary table frm401_before on commit drop as
select md5((content - 'form_schema')::text) as h
  from public.sop_documents where sop_number = 'FRM-401';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', $f401a${"settings": {"attachmentsEnabled": true, "allowMultipleDrafts": false, "deletable": false, "instanceTitleTemplate": "Temperature review — {review_month}"}, "sections": [{"id": "header", "title": "Month under review", "fields": [{"id": "review_intro", "type": "info", "label": "Before you start", "text": "One record per month. This is the verification that the automatic monitoring worked (SQF 2.5.2.1) — it is not the temperature record itself, which the sensors keep continuously.\n\nOpen Compliance → Temperature Monitoring, set the range to the month you are reviewing, and read the figures from the Summary by Equipment table and the alert list.\n\nOnly the SQF Practitioner signs this record (SOP-401 Part 6)."}, {"id": "review_month", "type": "text", "label": "Month reviewed", "width": "half", "required": true, "showInList": true, "help": "e.g. September 2026"}, {"id": "review_date", "type": "date", "label": "Date of review", "width": "half", "required": true, "showInList": true}]}, {"id": "limits_ref", "title": "Limits this review is judged against", "fields": [{"id": "limits_table", "type": "reference_table", "label": "Unit limits (SOP-401 Part 2)", "columns": ["Unit", "Sensor", "Limit", "Notes"], "rows": [["Walk-In Refrigerator", "d88b4c010010b5da", "At or below 41 °F", "TCS ingredients — butter, liquid eggs"], ["Walk-In Freezer", "d88b4c010010b513", "At or below 10 °F", "Only while in service. See SOP-401 Part 7"], ["Bakery Floor", "d88b4c010010b70a", "No limit", "Ambient production area, not a storage unit"]]}]}, {"id": "unit_month", "title": "The month, by unit", "fields": [{"id": "unit_summary", "type": "grid", "label": "Temperature summary", "help": "Read Min/Max/Avg from the Summary by Equipment table with the range set to this month. Leave a unit's temperatures blank if it was out of service all month, and say so in the state column.", "rows": {"mode": "fixed", "labelHeader": "Unit", "deletable": true, "labels": ["Walk-In Refrigerator", "Walk-In Freezer", "Bakery Floor"], "defaultValues": [{"state": "In service"}, {"state": "In service"}, {"state": "Not a storage unit"}]}, "columns": [{"id": "state", "type": "select", "label": "State this month", "width": 2, "required": true, "options": ["In service", "Out of service", "Not a storage unit", "Changed during the month"]}, {"id": "min_f", "type": "text", "label": "Min °F", "width": 1}, {"id": "max_f", "type": "text", "label": "Max °F", "width": 1}, {"id": "avg_f", "type": "text", "label": "Avg °F", "width": 1}, {"id": "held_limit", "type": "pass_fail", "label": "Held its limit all month", "width": 1}, {"id": "gaps", "type": "text", "label": "Gaps in logging (and why)", "width": 3, "help": "\"None\" is an answer. A gap nobody can explain is a finding — say so."}]}]}, {"id": "alerts", "title": "Alerts raised this month", "fields": [{"id": "alerts_intro", "type": "info", "label": "", "text": "List every alert the Team App raised this month, from the Temperature Alerts panel. If none were raised, add one row and write \"No alerts raised\" — a blank section does not distinguish a quiet month from an unreviewed one."}, {"id": "alert_log", "type": "grid", "label": "Alerts", "rows": {"mode": "dynamic", "addLabel": "Add alert"}, "columns": [{"id": "unit", "type": "text", "label": "Unit", "width": 2}, {"id": "kind", "type": "select", "label": "Alert", "width": 2, "options": ["Out of range", "No data", "Low battery", "No alerts raised"]}, {"id": "opened", "type": "date", "label": "Opened", "width": 2}, {"id": "worst", "type": "text", "label": "Worst reading", "width": 1}, {"id": "acknowledged", "type": "pass_fail", "label": "Acknowledged with an action", "width": 1}, {"id": "action_adequate", "type": "pass_fail", "label": "Action was appropriate", "width": 1}, {"id": "product_affected", "type": "text", "label": "Product affected — hold / CAPA reference", "width": 3, "help": "FRM-702 hold number and/or FRM-007 CAPA number, or \"none\"."}]}]}, {"id": "accuracy", "title": "Device accuracy check", "fields": [{"id": "accuracy_intro", "type": "info", "label": "", "text": "Read the probe thermometer and the unit's sensor in the same place at the same time (SOP-401 Part 6). The probe is the reference. Within ±2 °F is a pass; a larger difference means the sensor is suspect — record it, and arrange replacement or re-check before next month."}, {"id": "accuracy_grid", "type": "grid", "label": "Probe against sensor", "rows": {"mode": "fixed", "labelHeader": "Unit", "deletable": true, "labels": ["Walk-In Refrigerator", "Walk-In Freezer"]}, "columns": [{"id": "checked_on", "type": "date", "label": "Checked", "width": 2}, {"id": "sensor_f", "type": "text", "label": "Sensor °F", "width": 1}, {"id": "probe_f", "type": "text", "label": "Probe °F", "width": 1}, {"id": "difference", "type": "text", "label": "Difference °F", "width": 1}, {"id": "within_tolerance", "type": "pass_fail", "label": "Within ±2 °F", "width": 1}, {"id": "action", "type": "text", "label": "Action if outside tolerance", "width": 3}]}]}, {"id": "manual_state", "title": "Manual readings and changes of state", "fields": [{"id": "manual_readings", "type": "grid", "label": "Manual readings taken while a sensor was down (SOP-401 Part 5)", "help": "Start and end of each production day, for each affected in-service unit. Leave empty if no sensor was down this month.", "rows": {"mode": "dynamic", "addLabel": "Add reading"}, "columns": [{"id": "taken_at", "type": "datetime", "label": "Date & time", "width": 2}, {"id": "unit", "type": "text", "label": "Unit", "width": 2}, {"id": "reading_f", "type": "text", "label": "Reading °F", "width": 1}, {"id": "within_limit", "type": "pass_fail", "label": "Within limit", "width": 1}, {"id": "taken_by", "type": "text", "label": "Taken by", "width": 2}]}, {"id": "service_changes", "type": "grid", "label": "Units placed in or out of service this month (SOP-401 Part 7)", "help": "Leave empty if nothing changed. A return to service needs the 24-hour hold at limit recorded before food went in.", "rows": {"mode": "dynamic", "addLabel": "Add change of state"}, "columns": [{"id": "unit", "type": "text", "label": "Unit", "width": 2}, {"id": "change", "type": "select", "label": "Change", "width": 2, "options": ["Placed out of service", "Returned to service"]}, {"id": "changed_on", "type": "date", "label": "Date", "width": 2}, {"id": "reason", "type": "text", "label": "Reason", "width": 3}, {"id": "return_conditions", "type": "pass_fail", "label": "Return conditions met (clean, inspected, reporting, 24 h at limit)", "width": 2}, {"id": "food_placed_on", "type": "date", "label": "Food first placed in unit", "width": 2}]}]}, {"id": "conclusion", "title": "Conclusion and signature", "fields": [{"id": "facility_check", "type": "pass_fail", "label": "FRM-913's 11.6.2 Cold Storage line was completed this month (SOP-401 Part 8)", "width": "full"}, {"id": "system_effective", "type": "pass_fail", "label": "The monitoring system worked this month", "width": "full", "required": true, "help": "Alerts were raised where they should have been, reached someone, and were acted on."}, {"id": "findings", "type": "textarea", "label": "Findings, trends and anything carried forward", "width": "full", "help": "Repeat excursions on the same unit, a drifting sensor, unexplained gaps. \"Nothing to report\" is an acceptable answer and is better than a blank."}, {"id": "capa_raised", "type": "text", "label": "CAPA raised as a result of this review (FRM-007 number, or \"none\")", "width": "half"}, {"id": "reviewed_by", "type": "signature", "role": "verifier", "label": "Reviewed by (SQF Practitioner)", "width": "half", "statement": "I reviewed this month's temperature monitoring, the alerts raised and how they were closed, and the accuracy check, and I am satisfied the monitoring performed as SOP-401 requires."}]}]}$f401a$::jsonb)
 where sop_number = 'FRM-401';

do $$
declare
  untouched boolean;
begin
  select b.h = md5((d.content - 'form_schema')::text) into untouched
    from public.sop_documents d, frm401_before b
   where d.sop_number = 'FRM-401';
  if not untouched then
    raise exception 'FRM-401: content outside form_schema changed.';
  end if;
end $$;

-- After-state.
do $$
declare
  n_parts int; n_bullets int; n_prose int; n int;
  n_sections int; n_fields int;
begin
  select count(*) filter (where line not like '•%' and line not like '>%'),
         count(*) filter (where line like '•%'),
         count(*) filter (where line like '>%')
    into n_parts, n_bullets, n_prose
    from public.sop_documents d, jsonb_array_elements_text(d.content -> 'procedure') t(line)
   where d.sop_number = 'SOP-401';
  if n_parts <> 8 or n_bullets <> 27 or n_prose <> 18 then
    raise exception 'SOP-401 is now % Parts / % bullets / % prose, expected 8 / 27 / 18',
      n_parts, n_bullets, n_prose;
  end if;

  select count(*) into n
    from public.sop_documents d, jsonb_array_elements_text(d.content -> 'procedure') t(line)
   where d.sop_number = 'SOP-401' and t.line like '%out of service. It holds no product and may be switched off%';
  if n <> 0 then
    raise exception 'SOP-401 still carries the old freezer wording on % line(s).', n;
  end if;

  select count(*) into n
    from public.sop_documents d, jsonb_array_elements_text(d.content -> 'procedure') t(line)
   where d.sop_number = 'SOP-401' and t.line like '%in service and monitored%';
  if n <> 1 then
    raise exception 'Expected 1 procedure line with the new freezer wording, found %.', n;
  end if;

  -- The freezer's service state must be gone from the OPEN BEFORE ISSUE list; the burger-line
  -- date is still owed, so the list itself must survive.
  select count(*) into n from public.sop_documents
   where sop_number = 'SOP-401' and content ->> 'revision_history' like '%OPEN BEFORE ISSUE%';
  if n <> 1 then
    raise exception 'SOP-401 lost its OPEN BEFORE ISSUE list; the other items are still open.';
  end if;

  select jsonb_array_length(content -> 'form_schema' -> 'sections') into n_sections
    from public.sop_documents where sop_number = 'FRM-401';
  select count(*) into n_fields
    from public.sop_documents d,
         jsonb_array_elements(d.content -> 'form_schema' -> 'sections') s,
         jsonb_array_elements(s -> 'fields')
   where d.sop_number = 'FRM-401';
  if n_sections <> 7 or n_fields <> 16 then
    raise exception 'FRM-401 is now % sections / % fields, expected 7 / 16',
      n_sections, n_fields;
  end if;

  -- Same precise path as the before-guard: the freezer's own default must now read In service.
  -- "Out of service" remains elsewhere in the schema as a dropdown OPTION, deliberately.
  select count(*) into n
    from public.sop_documents d,
         jsonb_array_elements(d.content -> 'form_schema' -> 'sections') s,
         jsonb_array_elements(s -> 'fields') f,
         jsonb_array_elements_text(coalesce(f -> 'rows' -> 'labels', '[]'::jsonb))
           with ordinality as lab(label, idx)
   where d.sop_number = 'FRM-401'
     and f ->> 'id' = 'unit_summary'
     and lab.label = 'Walk-In Freezer'
     and (f -> 'rows' -> 'defaultValues' -> (lab.idx::int - 1) ->> 'state') = 'In service';
  if n <> 1 then
    raise exception 'FRM-401 freezer default did not become "In service" (matched % row(s)).', n;
  end if;

  -- And the option must survive, or the form can no longer record a unit going out of service.
  select count(*) into n
    from public.sop_documents d,
         jsonb_array_elements(d.content -> 'form_schema' -> 'sections') s,
         jsonb_array_elements(s -> 'fields') f,
         jsonb_array_elements(coalesce(f -> 'columns', '[]'::jsonb)) c,
         jsonb_array_elements_text(coalesce(c -> 'options', '[]'::jsonb)) o
   where d.sop_number = 'FRM-401'
     and f ->> 'id' = 'unit_summary'
     and c ->> 'id' = 'state'
     and o = 'Out of service';
  if n <> 1 then
    raise exception 'FRM-401 lost the "Out of service" option from the state dropdown.';
  end if;
end $$;

-- The live configuration this wording now describes. If somebody puts the freezer back out of
-- service before this is pushed, the documents would be wrong again in the other direction.
do $$
declare
  svc boolean;
begin
  select in_service into svc from public.temperature_limits where equipment_name = 'Walk-In Freezer';
  if svc is null then
    raise exception 'No temperature_limits row for the Walk-In Freezer.';
  end if;
  if not svc then
    raise exception 'The freezer is OUT of service in temperature_limits, but this migration rewrites SOP-401 to say it is in service. Reconcile before pushing.';
  end if;
end $$;

commit;
