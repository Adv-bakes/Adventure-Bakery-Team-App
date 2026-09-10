-- D-18 - FRM-008 Master Verification Schedule and Activity Record, seeded DRAFT.
--
-- SECTION 1 IS GENERATED FROM verification_schedule, NOT HARDCODED. The table is already the source
-- of truth - the twice-daily job reads it, and the Verification Schedule page renders it - so
-- printing a second hand-maintained copy into the form would create two things that can disagree
-- about what the site has undertaken to do, which is the whole failure this deliverable exists to
-- prevent. Building the printed table from a query means they cannot disagree at issue.
--
-- THE CONSEQUENCE IS STATED ON THE DOCUMENT rather than left for someone to discover: the printed
-- schedule is a snapshot as at this revision, the portal page is live, and a change to the schedule
-- needs a revision of this form. The annual programme review activity is the occasion that catches
-- it. That is ordinary document control, but only if it is written down.
--
-- SECTION 2 IS FOR ACTIVITIES WITH NO RECORD OF THEIR OWN - the annual limits review, a change
-- assessment. Where an activity already has a record, that record is used: filling in both would
-- create two accounts of one activity, and the info block says so in terms.
--
-- THE VERIFIED BY SIGNATURE IS A VERIFIER-ROLE SIGNATURE, which SignatureFieldInput restricts to
-- admin and owner. That is the mechanism by which this form discharges 2.5.2.1's requirement that
-- the person responsible for verifying monitoring AUTHORIZES each verified record - the limb most
-- programmes drop, because verification and its authorization read like the same thing until you
-- ask who signed.

begin;

do $$
declare n_sched int;
begin
  if exists (select 1 from public.sop_documents where sop_number = 'FRM-008') then
    raise exception 'FRM-008 already exists.';
  end if;
  if to_regclass('public.verification_schedule') is null then
    raise exception 'verification_schedule does not exist; apply 20260910000012 first.';
  end if;
  select count(*) into n_sched from public.verification_schedule where status <> 'retired';
  if n_sched = 0 then
    raise exception 'the verification schedule is empty; FRM-008 would print a blank table.';
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FRM-008',
  'Master Verification Schedule and Activity Record',
  'form',
  'Module 2',
  'draft',
  'New',
  '2.5.1.1, 2.5.2.1, 2.5.2.2',
  true,
  jsonb_build_object('form_schema', $j08${"settings": {"deletable": false, "attachmentsEnabled": true, "allowMultipleDrafts": true, "requireVerification": true, "instanceTitleTemplate": "{date_performed} — {activity}"}, "sections": [{"id": "schedule", "title": "1. The verification schedule", "fields": [{"id": "schedule_info", "type": "info", "label": "About this schedule", "text": "SECTION 1 IS THE SCHEDULE AS AT THE EFFECTIVE DATE OF THIS REVISION. It is generated from the verification schedule the site maintains in the Team Portal, so the two cannot disagree at the point this document was issued.\n\nThe live schedule is at Compliance → Verification Schedule, and that is where an activity is added, retired or re-timed. A change there needs a revision of this form; the annual review of the Validation and Verification Programme is the occasion that catches it.\n\nActivities marked NOT YET IMPLEMENTED are scheduled but are not being performed — the programme that governs them has not been issued. They raise no reminders and no entry is expected against them."}, {"id": "schedule_ref", "type": "reference_table", "label": "Master verification schedule", "help": "Every verification activity, its frequency and the position responsible (SQF 2.5.2.2).", "columns": ["Activity", "Frequency", "Responsible", "Record", "Status"], "rows": []}]}, {"id": "activity", "title": "2. Verification activity record", "fields": [{"id": "record_info", "type": "info", "label": "When to use this section", "text": "SECTION 2 IS ONE ENTRY PER VERIFICATION ACTIVITY PERFORMED, where no other record already covers it — for example the annual review of critical food safety limits, or an assessment of a change.\n\nWHERE THE ACTIVITY HAS ITS OWN RECORD, USE THAT RECORD AND NOT THIS ONE. The monthly GMP inspection is FRM-913; sanitation verification is FRM-902; the temperature review is FRM-401; the retention review is FRM-703. Filling in both would create two accounts of one activity.\n\nTHE VERIFIED BY SIGNATURE IS THE AUTHORIZATION 2.5.2.1 REQUIRES. A verification that leaves no signature is indistinguishable from one that did not happen."}, {"id": "activity", "type": "select", "label": "Activity", "width": "half", "required": true, "showInList": true, "help": "As named on the schedule above.", "options": []}, {"id": "date_performed", "type": "date", "label": "Date performed", "width": "half", "required": true, "defaultToday": true, "showInList": true}, {"id": "frequency_as_scheduled", "type": "text", "label": "Frequency as scheduled", "width": "half", "help": "Copy from the schedule above, so the record shows what was expected."}, {"id": "period_covered", "type": "text", "label": "Period covered", "width": "half", "help": "For example September 2026, or week ending 2026-09-07."}, {"id": "what_was_reviewed", "type": "textarea", "required": true, "label": "What was examined, and against what criteria", "help": "Records, areas, equipment or limits looked at, and what a satisfactory result would be."}, {"id": "result", "type": "pass_fail", "label": "Result", "width": "half", "required": true, "help": "Fail means the control was not effective or was not carried out. Finding one is a success for the verification."}, {"id": "findings", "type": "textarea", "label": "Findings", "help": "What was found. Record 'none' rather than leaving it blank."}, {"id": "nonconformity_raised", "type": "select", "width": "half", "label": "Corrective action raised under FSQM-009?", "options": ["No - nothing found", "Yes - CAPA raised", "No - corrected on the spot"]}, {"id": "capa_ref", "type": "text", "label": "FRM-007 reference", "width": "half", "help": "The CAPA number, where one was raised."}, {"id": "performed_by", "type": "signature", "role": "filler", "width": "half", "label": "Performed by", "required": true, "statement": "I carried out this verification activity as recorded above."}, {"id": "verified_by", "type": "signature", "role": "verifier", "width": "half", "label": "Verified by", "statement": "I have reviewed this record and authorize it."}]}]}$j08$::jsonb)
);

-- Print the schedule, and offer the same activities as the record's options. Both from the table,
-- ordered the way the portal orders them, so the paper and the screen read alike.
with sched as (
  select
    jsonb_agg(jsonb_build_array(
      activity,
      case when frequency_count = 1 then
         case frequency_unit
           when 'day' then 'Daily' when 'week' then 'Weekly' when 'month' then 'Monthly'
           when 'quarter' then 'Quarterly' when 'year' then 'Annually' end
       else 'Every ' || frequency_count || ' ' || frequency_unit || 's' end,
      responsible_position,
      case when evidence_kind = 'none' then '—'
           else coalesce(evidence_document_number, 'FRM-008') end,
      case status
        when 'active'  then 'In force'
        when 'planned' then 'NOT YET IMPLEMENTED — awaiting ' || pending_deliverable
        else status end
    ) order by sort_order) as rows,
    jsonb_agg(activity order by sort_order) filter (where status = 'active') as options
  from public.verification_schedule
  where status <> 'retired'
)
update public.sop_documents d
   set content = jsonb_set(
                   jsonb_set(d.content, '{form_schema,sections,0,fields,1,rows}', sched.rows),
                   '{form_schema,sections,1,fields,1,options}', sched.options)
  from sched
 where d.sop_number = 'FRM-008';

do $$
declare r record;
begin
  select
    (select count(*) from public.verification_schedule where status <> 'retired')        as n_sched,
    (select count(*) from public.verification_schedule where status = 'active')          as n_active,
    (select jsonb_array_length(content->'form_schema'->'sections'->0->'fields'->1->'rows')
       from public.sop_documents where sop_number = 'FRM-008')                           as n_printed,
    (select jsonb_array_length(content->'form_schema'->'sections'->1->'fields'->1->'options')
       from public.sop_documents where sop_number = 'FRM-008')                           as n_options,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-008')                                                    as fields,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-008' and f->>'type' = 'signature' and f->>'role' = 'verifier') as verifier,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections'->0->'fields'->1->'rows') rw
      where d.sop_number = 'FRM-008' and rw->>4 like 'NOT YET IMPLEMENTED%')              as printed_planned,
    (select status from public.sop_documents where sop_number = 'FRM-008')               as st,
    (select count(*) from public.sop_documents
      where sop_number = 'FRM-008' and position(chr(13) in content::text) > 0)           as crs
  into r;

  -- The document and the machinery must print the same schedule. This is the guard the whole
  -- generate-from-the-table approach exists to make possible.
  if r.n_printed is null or r.n_printed <> r.n_sched then
    raise exception 'FRM-008 prints % activities but the schedule holds %.', r.n_printed, r.n_sched;
  end if;
  if r.n_options is null or r.n_options <> r.n_active then
    raise exception 'FRM-008 offers % activities to record against but % are in force.',
      r.n_options, r.n_active;
  end if;
  -- A planned activity that printed as though it were in force would be the document claiming a
  -- control the site does not operate.
  if r.printed_planned <> r.n_sched - r.n_active then
    raise exception '% rows print as not-yet-implemented, expected %.',
      r.printed_planned, r.n_sched - r.n_active;
  end if;
  if r.fields <> 14 then
    raise exception 'FRM-008 has % fields, expected 14.', r.fields;
  end if;
  -- 2.5.2.1's authorization limb depends on this one field being a verifier-role signature.
  if r.verifier <> 1 then
    raise exception 'FRM-008 has % verifier signatures, expected 1.', r.verifier;
  end if;
  if r.st is distinct from 'draft' then
    raise exception 'FRM-008 should be draft; found %.', r.st;
  end if;
  if r.crs <> 0 then raise exception 'CR characters are present in FRM-008.'; end if;
end $$;

commit;
