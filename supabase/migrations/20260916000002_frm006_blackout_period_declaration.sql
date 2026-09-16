-- D-05 Blackout Period Declaration - FRM-006, seeded as a draft.
--
-- SQF 2.1.1.8: senior site management designates defined blackout periods that prevent an
-- unannounced RE-certification audit occurring out of season or when the site is not operating for
-- legitimate business reasons, and submits the list of dates with their justification to the
-- certification body at least one month before the sixty-day unannounced window opens. The gap
-- assessment graded it Minor: no blackout periods had been defined.
--
-- THE PLAN CALLED THIS "A LETTER TO THE CERTIFICATION BODY". IT CANNOT BE ONE YET. No certification
-- body is engaged and no certificate is held - nothing in 139 documents names a CB, an audit date
-- or a certificate number, and every reference frames SQF as something the site is pursuing. 2.1.1.8
-- governs the unannounced RE-certification audit, so today there is no addressee and no sixty-day
-- window to count back from. What CAN be done, and is what the clause is actually about, is the
-- designation: senior site management deciding the dates and recording the justification. This form
-- is that record, and its PDF is what goes to the certification body once there is one.
--
-- THE SITE'S ANSWER, FROM GABRIELA (2026-09-16): production is AS-NEEDED, ramping toward full time
-- over the first year. The site does not operate Fridays and often not Mondays - realistically it
-- produces and cleans TUESDAY THROUGH THURSDAY. It closes the WEEK OF THANKSGIVING and BETWEEN
-- CHRISTMAS AND NEW YEAR, and observes the NATIONAL HOLIDAY CALENDAR.
--
-- THOSE ARE TWO DIFFERENT THINGS AND THE FORM KEEPS THEM APART, WHICH IS THE ONE DESIGN DECISION
-- HERE. A blackout period is a defined calendar DATE RANGE; the Tue-Thu pattern is an OPERATING
-- SCHEDULE. Declaring roughly a hundred non-operating weekdays a year as blackout would misstate
-- what the clause asks for and invites a certification body to refuse the declaration outright. But
-- the underlying risk is exactly what 2.1.1.8 protects against - an unannounced auditor arriving on
-- a day nobody is producing - so the pattern is recorded in Section 2 as pattern, and the dates in
-- Section 3 as blackout. The certification body gets both, and the claim stays honest.
--
-- FRM-006 IS FREE. It is not in the database and appears nowhere in the remediation workbook, which
-- reserves FRM-001/002/003/004/005/007/008. Allocated from the workbook, not from the migrations.
-- FRM-008 stays dead - it was drafted and deleted before issue under D-18 - and is not reused.
--
-- SHAPE COPIED FROM FRM-005 SQF PRACTITIONER DESIGNATION RECORD, the closest analogue: a short,
-- periodically re-affirmed management declaration with a senior-management signature, in the
-- FRM-0xx management block. Like FRM-005 its content carries ONLY form_schema - no structured body.
--
-- IT RESOLVES A LATENT INCONSISTENCY RATHER THAN CREATING ONE. 2.1.1.8 makes the designation SENIOR
-- SITE MANAGEMENT's act, while FSQM-003 assigns "communication with certification bodies and
-- regulatory agencies" to the SQF PRACTITIONER. Section 4 is signed by senior management; Section 5
-- records whoever transmits it. Both documents stay true and FSQM-003 needs no revision.
--
-- WHAT THIS DOES NOT DO. It does not close 2.1.1.8. The clause has two limbs and this closes the
-- first only when a real entry is FILLED AND SUBMITTED by senior site management - a blank form is
-- not a record. The second limb, submission to the certification body, waits on there being one.
-- D-05 stays WIP.
--
-- Seeded as a DRAFT for review in the portal before a separate issue migration activates it.

begin;

do $guard$
begin
  if exists (select 1 from public.sop_documents where sop_number = 'FRM-006') then
    raise exception 'FRM-006 already exists; this migration seeds it.';
  end if;
  if not exists (select 1 from public.sop_documents where sop_number = 'FRM-005') then
    raise exception 'FRM-005 is missing - this form copies its shape and block. Re-derive.';
  end if;
end $guard$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values
  ('FRM-006', 'Blackout Period Declaration', 'form', 'Module 2', 'draft', 'New',
   $sq$2.1.1.8$sq$, true, jsonb_build_object('form_schema', $j006${"schemaVersion": 1, "settings": {"attachmentsEnabled": true, "allowMultipleDrafts": false, "requireVerification": true, "instanceTitleTemplate": "{period_from} to {period_to} — blackout declaration"}, "sections": [{"id": "period", "title": "1. Period covered", "fields": [{"id": "how_this_works", "type": "info", "label": "How this record works", "text": "ONE ENTRY IS ONE DECLARATION. Make a new entry for each period covered, and a new one whenever the operating pattern changes, rather than editing the entry in force. Earlier entries are the history of what was declared, and when.\n\nWHAT 2.1.1.8 ASKS FOR. Senior site management designates defined blackout periods that stop an unannounced re-certification audit landing out of season or when the site is not operating for legitimate business reasons, and the list of dates with their justification goes to the certification body at least one month before the sixty-day unannounced window opens.\n\nTWO DIFFERENT THINGS ARE RECORDED HERE AND THEY ARE NOT INTERCHANGEABLE. Section 2 is the site's normal operating pattern. Section 3 is the blackout list. Keeping them apart is deliberate - the note on Section 2 says why."}, {"id": "period_from", "type": "date", "label": "Period covered from", "width": "third", "required": true, "showInList": true}, {"id": "period_to", "type": "date", "label": "Period covered to", "width": "third", "required": true, "showInList": true}, {"id": "prepared_on", "type": "date", "label": "Prepared on", "width": "third", "required": true, "defaultToday": true}, {"id": "reason", "type": "select", "label": "Reason for this declaration", "width": "half", "required": true, "options": ["First declaration", "Annual re-affirmation - no change", "Operating pattern changed", "Blackout dates changed"]}]}, {"id": "pattern", "title": "2. Operating pattern (not a blackout list)", "fields": [{"id": "pattern_info", "type": "info", "label": "Why the weekly pattern is recorded here and not claimed as blackout", "text": "THIS SECTION IS NOT A BLACKOUT LIST. A blackout period under 2.1.1.8 is a defined calendar date range. The days of the week the site does not run are its operating pattern, not blackout: listing every non-operating weekday as a blackout date would be scores of dates a year, it would misstate what the clause asks for, and a certification body may refuse the declaration on that basis.\n\nIT IS RECORDED ALL THE SAME, BECAUSE THE RISK IS REAL. An unannounced auditor arriving on a day nobody is producing is exactly what 2.1.1.8 exists to prevent. The certification body needs the operating pattern so that an unannounced audit is planned against a day the site actually runs. Giving it both - the pattern here, the dates in Section 3 - answers the clause without overstating the blackout claim.\n\nRE-AFFIRM THIS WHEN THE PATTERN CHANGES, and at least once a year. A declaration written around an as-needed schedule stops being true as production moves to full time, and a stale operating pattern is worse than none: it tells the certification body to plan around days the site no longer keeps."}, {"id": "production_basis", "type": "select", "label": "Production basis", "width": "half", "required": true, "options": ["As-needed", "Scheduled - part week", "Scheduled - full time"]}, {"id": "operating_days", "type": "text", "label": "Days the site produces or cleans", "width": "half", "required": true, "showInList": true, "help": "For example \"Tuesday to Thursday\". These are the days an unannounced audit would find the site running."}, {"id": "pattern_notes", "type": "textarea", "label": "Notes on the pattern", "help": "Anything the certification body needs to plan around - whether the pattern is settled or changing, and when it is expected to change."}]}, {"id": "blackout", "title": "3. Blackout periods designated (2.1.1.8)", "fields": [{"id": "blackout_info", "type": "info", "label": "How to fill this in", "text": "ONE ROW PER DATE RANGE, with the business reason. A single day is a row with the same From and To date.\n\nTHE STANDING CLOSURES TO CARRY FORWARD EACH PERIOD: the week of Thanksgiving; Christmas through New Year; and the national holidays the site observes - entered as the individual dates falling inside the period covered, because the certification body needs dates rather than a rule.\n\nTHE JUSTIFICATION IS THE POINT. 2.1.1.8 permits blackout for being out of season, or not operating for legitimate business reasons. Say which applies to each range. \"Closed - no production or cleaning staff on site\" is a legitimate reason and a sufficient one; being busy is neither of the two grounds the clause names."}, {"id": "designation", "type": "select", "label": "Blackout periods designated", "width": "half", "required": true, "options": ["As listed below", "None - the site operates year-round"]}, {"id": "periods", "type": "grid", "label": "Blackout dates", "help": "One row per date range. A single day is a row with the same From and To date.", "rows": {"mode": "dynamic", "min": 3, "addLabel": "Add a blackout period"}, "columns": [{"id": "from_date", "type": "date", "label": "From", "width": 1, "required": true}, {"id": "to_date", "type": "date", "label": "To", "width": 1, "required": true}, {"id": "reason", "type": "text", "label": "Business justification", "width": 3, "required": true}]}, {"id": "justification", "type": "textarea", "label": "Statement of justification", "required": true, "help": "Why these periods, against the two grounds the clause allows - out of season, or not operating for legitimate business reasons."}]}, {"id": "approval", "title": "4. Senior site management", "fields": [{"id": "management_position", "type": "text", "label": "Position held", "width": "half", "required": true, "help": "The post in FSQM-004 this person holds."}, {"id": "designated_by", "type": "signature", "role": "verifier", "width": "half", "required": true, "label": "Designated by Senior Site Management", "statement": "As senior site management, I designate the blackout periods listed in Section 3, with the operating pattern stated in Section 2, for the period covered by this declaration."}]}, {"id": "submission", "title": "5. Submission to the certification body", "fields": [{"id": "submission_info", "type": "info", "label": "When and how this is sent", "text": "LEAVE THIS SECTION BLANK UNTIL A CERTIFICATION BODY IS APPOINTED. No certification body is engaged and no certificate is held, so there is no sixty-day unannounced window to count back from yet. The designation in Sections 2 and 3 stands on its own, and is what senior site management is accountable for.\n\nWHEN THERE IS ONE: send this declaration at least one month before the sixty-day unannounced re-certification window opens, and record here who sent it, to whom, when and how. The PDF of this submitted entry is the document to send - there is no separate letter to keep in step with it.\n\nWHO SENDS IT. Senior site management designates, and signs Section 4. FSQM-003 puts communication with certification bodies and regulatory agencies with the SQF Practitioner, so the transmission is usually theirs to make and to record here. Both documents stay true because the two acts are kept apart."}, {"id": "certification_body", "type": "text", "label": "Certification body", "width": "half"}, {"id": "submitted_on", "type": "date", "label": "Submitted on", "width": "half"}, {"id": "submitted_by", "type": "text", "label": "Submitted by", "width": "half"}, {"id": "submission_method", "type": "select", "label": "How it was sent", "width": "half", "options": ["Email", "Certification body portal", "Post", "Other"]}]}]}$j006$::jsonb));

do $verify$
declare
  r record;
begin
  select d.status, d.type, d.revision, d.sqf_required, d.sqf_reference,
         jsonb_array_length(d.content->'form_schema'->'sections')                            as sections,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f)                          as fields,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'signature' and f->>'role' = 'verifier')                       as mgmt_sig,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where (f->>'required')::boolean
             and f->>'id' in ('period_from','period_to','prepared_on','reason','production_basis',
                              'operating_days','designation','justification',
                              'management_position','designated_by'))                        as required_core,
         (select count(*) from jsonb_object_keys(d.content))                                 as content_keys
    into r
    from public.sop_documents d where d.sop_number = 'FRM-006';

  if r.status <> 'draft' or r.type <> 'form' or r.revision <> 'New' or not r.sqf_required then
    raise exception 'FRM-006 wrong: status=%, type=%, revision=%, sqf_required=%.',
      r.status, r.type, r.revision, r.sqf_required;
  end if;
  if r.sqf_reference <> '2.1.1.8' then
    raise exception 'FRM-006 sqf_reference is % rather than 2.1.1.8.', r.sqf_reference;
  end if;
  if r.sections <> 5 then raise exception 'FRM-006 has % sections, expected 5.', r.sections; end if;
  if r.fields <> 20 then raise exception 'FRM-006 has % fields, expected 20.', r.fields; end if;
  if r.content_keys <> 1 then
    raise exception 'FRM-006 content carries % keys; it should carry form_schema alone, like FRM-005.',
      r.content_keys;
  end if;

  -- the designation must be senior management's act, and it must be unskippable
  if r.mgmt_sig <> 1 then
    raise exception 'FRM-006 should carry exactly one verifier-role signature (senior site management), has %.',
      r.mgmt_sig;
  end if;
  if r.required_core <> 10 then
    raise exception 'FRM-006 has % of 10 core fields required; the declaration must not be submittable half-empty.',
      r.required_core;
  end if;

  -- the pattern/blackout distinction is the point of the form; it must survive any later edit
  if not exists (select 1 from jsonb_array_elements(
                        (select content->'form_schema'->'sections' from public.sop_documents
                          where sop_number = 'FRM-006')) s
                  where s->>'id' = 'pattern'
                    and s::text like '%THIS SECTION IS NOT A BLACKOUT LIST%') then
    raise exception 'Section 2 has lost the statement that the operating pattern is not a blackout list.';
  end if;
  if not exists (select 1 from jsonb_array_elements(
                        (select content->'form_schema'->'sections' from public.sop_documents
                          where sop_number = 'FRM-006')) s
                  where s->>'id' = 'submission'
                    and s::text like '%LEAVE THIS SECTION BLANK UNTIL A CERTIFICATION BODY IS APPOINTED%') then
    raise exception 'Section 5 has lost the instruction to leave it blank until a CB is appointed.';
  end if;

  raise notice 'FRM-006 seeded as a draft: 5 sections, % fields, senior-management signature in place.',
    r.fields;
end $verify$;

commit;
