-- FRM-401 Temperature Monitoring Review. Seeded draft, fillable. The record SOP-401 keeps.
--
-- WHY MONTHLY AND NOT WEEKLY. Once the Team App watches every in-service unit every fifteen
-- minutes, the human job stops being observation and becomes verification under SQF 2.5.2.1
-- that the monitoring worked. A monthly review of an alert log is defensible and is likely
-- to actually happen; a weekly one layered on top of an automated check is work that adds
-- nothing and gets skipped - and a form nobody fills is worse than no form, because it
-- documents an intention the site is not meeting.
--
-- THIS IS NOT THE TEMPERATURE RECORD. The temperature record is the continuous per-sensor
-- log the sensors keep, which is what 11.6.2.3 asks be retained. This form is the evidence
-- that somebody read it, checked the alerts were closed properly, and compared the sensor
-- against a probe. Transcribing daily temperatures onto a form here would duplicate a record
-- that already exists in a better form.
--
-- The alert section asks for "No alerts raised" as an explicit row rather than accepting a
-- blank, because a blank section cannot distinguish a quiet month from an unreviewed one.

begin;

do $$
declare
  n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FRM-401';
  if n <> 0 then
    raise exception 'FRM-401 already exists.';
  end if;
  -- FRM-401 is the record SOP-401 names, so the procedure must be there to name it.
  select count(*) into n from public.sop_documents where sop_number = 'SOP-401';
  if n <> 1 then
    raise exception 'SOP-401 is missing; seed it before its record.';
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FRM-401',
  'Temperature Monitoring Review',
  'form',
  'Storage & Inventory',
  'draft',
  'New',
  '11.6.2.3, 2.5.2.1',
  true,
  -- ::jsonb is not optional. Without it jsonb_build_object receives TEXT and stores the
  -- whole schema as a JSON string, which renders as an empty form rather than an error.
  jsonb_build_object('form_schema', $f401${"settings": {"attachmentsEnabled": true, "allowMultipleDrafts": false, "deletable": false, "instanceTitleTemplate": "Temperature review — {review_month}"}, "sections": [{"id": "header", "title": "Month under review", "fields": [{"id": "review_intro", "type": "info", "label": "Before you start", "text": "One record per month. This is the verification that the automatic monitoring worked (SQF 2.5.2.1) — it is not the temperature record itself, which the sensors keep continuously.\n\nOpen Compliance → Temperature Monitoring, set the range to the month you are reviewing, and read the figures from the Summary by Equipment table and the alert list.\n\nOnly the SQF Practitioner signs this record (SOP-401 Part 6)."}, {"id": "review_month", "type": "text", "label": "Month reviewed", "width": "half", "required": true, "showInList": true, "help": "e.g. September 2026"}, {"id": "review_date", "type": "date", "label": "Date of review", "width": "half", "required": true, "showInList": true}]}, {"id": "limits_ref", "title": "Limits this review is judged against", "fields": [{"id": "limits_table", "type": "reference_table", "label": "Unit limits (SOP-401 Part 2)", "columns": ["Unit", "Sensor", "Limit", "Notes"], "rows": [["Walk-In Refrigerator", "d88b4c010010b5da", "At or below 41 °F", "TCS ingredients — butter, liquid eggs"], ["Walk-In Freezer", "d88b4c010010b513", "At or below 10 °F", "Only while in service. See SOP-401 Part 7"], ["Bakery Floor", "d88b4c010010b70a", "No limit", "Ambient production area, not a storage unit"]]}]}, {"id": "unit_month", "title": "The month, by unit", "fields": [{"id": "unit_summary", "type": "grid", "label": "Temperature summary", "help": "Read Min/Max/Avg from the Summary by Equipment table with the range set to this month. Leave a unit's temperatures blank if it was out of service all month, and say so in the state column.", "rows": {"mode": "fixed", "labelHeader": "Unit", "deletable": true, "labels": ["Walk-In Refrigerator", "Walk-In Freezer", "Bakery Floor"], "defaultValues": [{"state": "In service"}, {"state": "Out of service"}, {"state": "Not a storage unit"}]}, "columns": [{"id": "state", "type": "select", "label": "State this month", "width": 2, "required": true, "options": ["In service", "Out of service", "Not a storage unit", "Changed during the month"]}, {"id": "min_f", "type": "text", "label": "Min °F", "width": 1}, {"id": "max_f", "type": "text", "label": "Max °F", "width": 1}, {"id": "avg_f", "type": "text", "label": "Avg °F", "width": 1}, {"id": "held_limit", "type": "pass_fail", "label": "Held its limit all month", "width": 1}, {"id": "gaps", "type": "text", "label": "Gaps in logging (and why)", "width": 3, "help": "\"None\" is an answer. A gap nobody can explain is a finding — say so."}]}]}, {"id": "alerts", "title": "Alerts raised this month", "fields": [{"id": "alerts_intro", "type": "info", "label": "", "text": "List every alert the Team App raised this month, from the Temperature Alerts panel. If none were raised, add one row and write \"No alerts raised\" — a blank section does not distinguish a quiet month from an unreviewed one."}, {"id": "alert_log", "type": "grid", "label": "Alerts", "rows": {"mode": "dynamic", "addLabel": "Add alert"}, "columns": [{"id": "unit", "type": "text", "label": "Unit", "width": 2}, {"id": "kind", "type": "select", "label": "Alert", "width": 2, "options": ["Out of range", "No data", "Low battery", "No alerts raised"]}, {"id": "opened", "type": "date", "label": "Opened", "width": 2}, {"id": "worst", "type": "text", "label": "Worst reading", "width": 1}, {"id": "acknowledged", "type": "pass_fail", "label": "Acknowledged with an action", "width": 1}, {"id": "action_adequate", "type": "pass_fail", "label": "Action was appropriate", "width": 1}, {"id": "product_affected", "type": "text", "label": "Product affected — hold / CAPA reference", "width": 3, "help": "FRM-702 hold number and/or FRM-007 CAPA number, or \"none\"."}]}]}, {"id": "accuracy", "title": "Device accuracy check", "fields": [{"id": "accuracy_intro", "type": "info", "label": "", "text": "Read the probe thermometer and the unit's sensor in the same place at the same time (SOP-401 Part 6). The probe is the reference. Within ±2 °F is a pass; a larger difference means the sensor is suspect — record it, and arrange replacement or re-check before next month."}, {"id": "accuracy_grid", "type": "grid", "label": "Probe against sensor", "rows": {"mode": "fixed", "labelHeader": "Unit", "deletable": true, "labels": ["Walk-In Refrigerator", "Walk-In Freezer"]}, "columns": [{"id": "checked_on", "type": "date", "label": "Checked", "width": 2}, {"id": "sensor_f", "type": "text", "label": "Sensor °F", "width": 1}, {"id": "probe_f", "type": "text", "label": "Probe °F", "width": 1}, {"id": "difference", "type": "text", "label": "Difference °F", "width": 1}, {"id": "within_tolerance", "type": "pass_fail", "label": "Within ±2 °F", "width": 1}, {"id": "action", "type": "text", "label": "Action if outside tolerance", "width": 3}]}]}, {"id": "manual_state", "title": "Manual readings and changes of state", "fields": [{"id": "manual_readings", "type": "grid", "label": "Manual readings taken while a sensor was down (SOP-401 Part 5)", "help": "Start and end of each production day, for each affected in-service unit. Leave empty if no sensor was down this month.", "rows": {"mode": "dynamic", "addLabel": "Add reading"}, "columns": [{"id": "taken_at", "type": "datetime", "label": "Date & time", "width": 2}, {"id": "unit", "type": "text", "label": "Unit", "width": 2}, {"id": "reading_f", "type": "text", "label": "Reading °F", "width": 1}, {"id": "within_limit", "type": "pass_fail", "label": "Within limit", "width": 1}, {"id": "taken_by", "type": "text", "label": "Taken by", "width": 2}]}, {"id": "service_changes", "type": "grid", "label": "Units placed in or out of service this month (SOP-401 Part 7)", "help": "Leave empty if nothing changed. A return to service needs the 24-hour hold at limit recorded before food went in.", "rows": {"mode": "dynamic", "addLabel": "Add change of state"}, "columns": [{"id": "unit", "type": "text", "label": "Unit", "width": 2}, {"id": "change", "type": "select", "label": "Change", "width": 2, "options": ["Placed out of service", "Returned to service"]}, {"id": "changed_on", "type": "date", "label": "Date", "width": 2}, {"id": "reason", "type": "text", "label": "Reason", "width": 3}, {"id": "return_conditions", "type": "pass_fail", "label": "Return conditions met (clean, inspected, reporting, 24 h at limit)", "width": 2}, {"id": "food_placed_on", "type": "date", "label": "Food first placed in unit", "width": 2}]}]}, {"id": "conclusion", "title": "Conclusion and signature", "fields": [{"id": "facility_check", "type": "pass_fail", "label": "FRM-913's 11.6.2 Cold Storage line was completed this month (SOP-401 Part 8)", "width": "full"}, {"id": "system_effective", "type": "pass_fail", "label": "The monitoring system worked this month", "width": "full", "required": true, "help": "Alerts were raised where they should have been, reached someone, and were acted on."}, {"id": "findings", "type": "textarea", "label": "Findings, trends and anything carried forward", "width": "full", "help": "Repeat excursions on the same unit, a drifting sensor, unexplained gaps. \"Nothing to report\" is an acceptable answer and is better than a blank."}, {"id": "capa_raised", "type": "text", "label": "CAPA raised as a result of this review (FRM-007 number, or \"none\")", "width": "half"}, {"id": "reviewed_by", "type": "signature", "role": "verifier", "label": "Reviewed by (SQF Practitioner)", "width": "half", "statement": "I reviewed this month's temperature monitoring, the alerts raised and how they were closed, and the accuracy check, and I am satisfied the monitoring performed as SOP-401 requires."}]}]}$f401$::jsonb)
);

-- Guard: the schema must be fillable and complete. A form_schema that saved as a string, or
-- lost a section on the way in, renders as an empty form rather than an error - which is how
-- a filler discovers it, mid-shift, instead of here.
do $$
declare
  sch jsonb;
  n_sections int; n_fields int;
begin
  select content -> 'form_schema' into sch
    from public.sop_documents where sop_number = 'FRM-401';
  if sch is null or jsonb_typeof(sch) <> 'object' then
    raise exception 'FRM-401 form_schema did not save as an object.';
  end if;
  select count(*) into n_sections from jsonb_array_elements(sch -> 'sections');
  select count(*) into n_fields
    from jsonb_array_elements(sch -> 'sections') s,
         jsonb_array_elements(s -> 'fields');
  if n_sections <> 7 or n_fields <> 16 then
    raise exception 'FRM-401 saved % sections / % fields, expected 7 / 16',
      n_sections, n_fields;
  end if;
end $$;

commit;
