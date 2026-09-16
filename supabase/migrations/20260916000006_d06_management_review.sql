-- D-06 Management Review Upgrade - FRM-001 to v4, and FSQM-005 written from nothing.
--
-- THE FINDING (2.1.2.1, Minor). The management review agenda lacked three of the six items the
-- clause names: changes to food safety management system documentation, food safety culture
-- performance, and the hazard and risk management system. The consultant also noted FRM-001 citing
-- FSQM-002 - the Food Safety and Quality Policy - as the organisational chart.
--
-- READING THE CURRENT FORM TURNED UP MORE OF THE SAME, AND WORSE. The consultant assessed FRM-001
-- at Rev 2; it is at v3 now. Against v3:
--
--   TWO FURTHER WRONG REFERENCES, both in Section II and both to documents that DO NOT EXIST and
--   whose numbers are reserved for something else entirely. "FSQM-026 internal audits" - FSQM-026
--   is reserved for Food Fraud (D-22); the internal audit programme is D-19 and is not written.
--   "Environmental Monitoring trends ... per FSQM-033" - FSQM-033 is reserved for Water and
--   Utilities (D-31). A third cited FSQM-002, the policy, for training needs.
--
--   THREE TARGETS ASSERTING WORK THE SITE DOES NOT DO. "> 99.9% compliance for microbiological
--   criteria" and "Environmental Monitoring trends (Listeria / Salmonella swabs)" - the site
--   performs no microbiological or environmental analysis, which was settled under D-15. And "98%
--   First Time Right in blending and packaging" - the site bakes rum cake; "blending" is inherited
--   from the prior company name. An agenda claiming a control that does not exist is WORSE at an
--   audit than one that is merely incomplete: it is a claim somebody will ask to see records for.
--
-- SO FRM-001 GOES TO v4: the three missing agenda items added, the hazard and risk system stated as
-- such rather than left implicit in a HACCP row, a verification and validation input added for
-- 2.1.2.1 (iv) now that FSQM-017 exists, every wrong reference corrected, and the three
-- unsupportable targets removed.
--
-- THE AGENDA IS ORDERED BY THE CLAUSE RATHER THAN APPENDED TO. A fixed grid row takes its label
-- from its POSITION in the schema, so inserting one normally desyncs the answers already recorded
-- against it. There is exactly one FRM-001 entry, a draft, and both of its grids hold empty row
-- objects - no answer is tied to an index, so the readable order costs nothing. Check that again if
-- this form is ever reordered when entries carry data.
--
-- FSQM-005 IS REWRITTEN, NOT PATCHED. The draft carried by that number had SIX OF ITS TEN SECTIONS
-- EMPTY - no purpose, definitions, records, form references, governing reference or revision
-- history - and twelve generic procedure lines that did not map to the six agenda items. It
-- referenced a "Flash Report" that exists nowhere in this system, and said that "besides the annual
-- management review, the Quality Leader shall review the entire SQF System at least annually",
-- which is circular. There was nothing to patch.
--
-- THE ANNUAL REVIEW AND THE MONTHLY UPDATE STAY SEPARATE - the site's decision, 2026-09-16, against
-- the consultant's suggestion that the annual review could be dropped if everything is reviewed
-- monthly. That is true on its face and was declined deliberately: it commits the site to twelve
-- full management review records a year, each covering all six items, and turns a quiet month into
-- a hole in the evidence. 2.1.2.1 and 2.1.2.2 ask for different things at different depths.
--
-- AND THE MONTHLY UPDATE HAS NO RECORD TODAY. 2.1.2.2 was assessed Compliant on the strength of the
-- old draft's Flash Report sentence, and that report does not exist. FSQM-005 Part 3 states what
-- the minutes must contain so the record can start being kept, and says plainly that until it is,
-- that limb is not evidenced. It is not this migration's job to fix, but it is its job not to hide.
--
-- FRM-001 is ACTIVE and goes straight to v4 - it is a live form. FSQM-005 stays DRAFT for review,
-- with its own issue migration to follow.

begin;

do $guard$
declare r record;
begin
  select (select status   from public.sop_documents where sop_number = 'FRM-001')  as s001,
         (select revision from public.sop_documents where sop_number = 'FRM-001')  as r001,
         (select status   from public.sop_documents where sop_number = 'FSQM-005') as s005,
         (select revision from public.sop_documents where sop_number = 'FSQM-005') as r005
    into r;

  if (r.s001, r.r001) is distinct from ('active', 'v3') then
    raise exception 'FRM-001 is %/% - expected active/v3. Re-derive the schema.', r.s001, r.r001;
  end if;
  if r.s005 is distinct from 'draft' or r.r005 is not null then
    raise exception 'FSQM-005 is %/% - expected the unissued draft.', r.s005, r.r005;
  end if;

  -- the exact defects this migration removes, so it cannot be applied to a form already fixed
  if (select content->'form_schema' from public.sop_documents where sop_number = 'FRM-001')::text
     not like '%Organizational Chart and Management Changes (Ref: FSQM-002)%' then
    raise exception 'FRM-001 does not carry the FSQM-002 org-chart label this migration corrects.';
  end if;
  if (select content->'form_schema' from public.sop_documents where sop_number = 'FRM-001')::text
     not like '%microbiological criteria%' then
    raise exception 'FRM-001 does not carry the microbiological target this migration removes.';
  end if;

  -- and an entry with answers would make reordering the fixed rows unsafe
  if exists (
    select 1 from public.sop_document_responses resp
     where resp.document_id = (select id from public.sop_documents where sop_number = 'FRM-001')
       and exists (
         select 1 from jsonb_array_elements(coalesce(resp.data->'mandatory_reviews', '[]'::jsonb)) e
          where e <> '{}'::jsonb)) then
    raise exception 'An FRM-001 entry holds answers in the mandatory-reviews grid; reordering its '
                    'fixed rows would desync them. Re-derive before applying.';
  end if;
end $guard$;

-- ------------------------------------------------------------------ 1. FRM-001 v4
update public.sop_documents
   set content        = jsonb_set(content, '{form_schema}', $j001${"sections": [{"id": "section_1", "title": "Management Review Record", "fields": [{"id": "meeting_date", "type": "date", "label": "Meeting Date", "width": "half", "defaultToday": true}]}, {"id": "meeting_attendance_logistics", "title": "Meeting Attendance & Logistics", "fields": [{"id": "meeting_chairperson", "type": "text", "label": "Meeting Chairperson", "width": "half"}, {"id": "recorder", "type": "text", "label": "Recorder", "width": "half"}, {"id": "attendees", "rows": {"min": 5, "mode": "dynamic"}, "type": "grid", "label": "Attendees", "columns": [{"id": "attendee_name", "type": "text", "label": "Attendee Name"}, {"id": "title", "type": "text", "label": "Title"}]}]}, {"id": "section_i_mandatory_system_policy_regulatory_rev", "title": "Section I — Mandatory System, Policy & Regulatory Reviews", "fields": [{"id": "info_mandatory_reviews", "text": "In accordance with FSQM-005 and SQF 2.1.2.1, senior site management confirms the review of each foundational system element below, to establish continued suitability and effectiveness.\n\nEVERY ROW IS ANSWERED, INCLUDING \"NO CHANGE\". A row left blank is indistinguishable from a row nobody considered, and the clause asks for the review, not only for the changes it finds.\n\nFOOD SAFETY CULTURE PERFORMANCE has no measures set against it yet - the food safety culture plan has not been issued. Until it is, answer it with what the site actually did and observed, and say that no formal measures are in force. That is a true record; a target invented here would not be.", "type": "info", "label": "Mandatory Reviews"}, {"id": "mandatory_reviews", "rows": {"mode": "fixed", "labels": ["Food Safety and Quality Policy (Ref: FSQM-002)", "Organizational Chart and Management Changes (Ref: FSQM-004)", "Changes to Food Safety Management System Documentation\nPolicies, procedures, specifications and the food safety plan changed since the last review (2.1.2.1 i).", "Food Safety Fundamentals, Food Safety Plan and the Hazard and Risk Management System\nChanges to the HACCP plan, its hazard analysis and its critical limits, and to the prerequisite programmes supporting them (2.1.2.1 v).", "Food Safety Culture Performance\nHow the site is performing against its food safety culture commitments, and what was done about it (2.1.2.1 ii).", "Applicable Food Legislation and Regulatory Changes (Origin/Destination)", "New Food Safety Related Scientific/Technical Information"]}, "type": "grid", "label": "Mandatory Reviews", "columns": [{"id": "ref_doc_version", "type": "text", "label": "Ref. Doc Version #"}, {"id": "status", "type": "select", "label": "Status", "options": ["Current", "Update"]}, {"id": "meeting_notes_discussion", "type": "text", "label": "Meeting Notes / Discussion"}]}]}, {"id": "section_ii_review_inputs_performance_data_findin", "title": "Section II — Review Inputs (Performance Data & Findings)", "fields": [{"id": "info_review_inputs", "text": "Document the findings and the supporting data for each input below.\n\nA TARGET SHOWN AGAINST AN INPUT IS A MEASURE SENIOR MANAGEMENT HAS SET. Where an input has none, record what was found and what was decided; do not invent a figure to fill the line.\n\nWHERE AN ACTIVITY IS NOT PERFORMED, SAY SO ON THE ROW. The site performs no microbiological or environmental analysis, so there are no such results to trend - writing \"not performed\" is the honest answer and is what an auditor can check.", "type": "info", "label": "Review Inputs Info"}, {"id": "review_inputs", "rows": {"mode": "fixed", "labels": ["Previous Management Review Action Items\nSummarize progress on prior goals, outstanding tasks, and the effectiveness of previous decisions (2.1.2.1 vi).", "Internal, External, and Regulatory Audit Results\nSummarize findings from internal audits, third-party certification audits and regulatory inspections.\nTarget: > 90% food safety audit score", "Customer Feedback and Complaints\nAnalyze trends from FRM-002 and REP-003.\nTarget: ≤ 1 quality complaint per month", "Corrective and Preventive Actions (CAPA)\nReview outstanding non-conformances and the effectiveness of corrective action under FSQM-009, recorded on FRM-007.", "Supplier and Raw Material Performance\nReview material compliance, COA verification, and supplier incidents per SOP-2.3.4.", "Training Effectiveness and Resource Adequacy\nAssess staffing, equipment and training needs. Completion and quiz results are held in the Team Portal; competency is recorded on FRM-952 and sessions on FRM-953.", "Facility and Equipment Maintenance / Sanitation\nReview Master Sanitation Schedule performance (FRM-901) and the daily sanitation, pre-operation and release records (FRM-903).", "Food Safety Incidents\nReview any recalls, withdrawals, or labeling / allergen non-conformances since the last review.", "Verification and Validation Activities\nReview the master verification schedule under FSQM-017 - what fell due, what was completed, and anything still outstanding (2.1.2.1 iv)."]}, "type": "grid", "label": "Review Inputs", "columns": [{"id": "findings_discussion", "type": "text", "label": "Findings & Discussion"}]}]}, {"id": "section_iii_review_outputs_strategic_decisions", "title": "Section III — Review Outputs & Strategic Decisions", "fields": [{"id": "decisions_continuous_improvement", "type": "textarea", "label": "Decisions Regarding Continuous Improvement\nIdentify specific opportunities for improvement of the Food Safety and Quality Management System."}, {"id": "resource_allocation_infrastructure_needs", "type": "textarea", "label": "Resource Allocation and Infrastructure Needs\nDocument approved expenditures, staffing modifications, or infrastructure shifts required to maintain the SQF system."}]}, {"id": "section_iv_action_item_tracking", "title": "Section IV — Action Item Tracking", "fields": [{"id": "action_item_tracking", "rows": {"min": 8, "mode": "dynamic"}, "type": "grid", "label": "Action Item Tracking", "columns": [{"id": "action_required", "type": "text", "label": "Action Required"}, {"id": "responsible_person", "type": "text", "label": "Responsible Person"}, {"id": "target_date", "type": "date", "label": "Target Date"}, {"id": "completed", "type": "checkbox", "label": "Completed"}]}]}, {"id": "section_v_meeting_conclusion_final_sign_off", "title": "Section V — Meeting Conclusion & Final Sign-off", "fields": [{"id": "next_scheduled_management_review_date", "type": "date", "label": "Next Scheduled Management Review Date"}, {"id": "sqf_practitioner_signature", "role": "verifier", "type": "signature", "label": "SQF Practitioner"}, {"id": "senior_site_management_signature", "role": "verifier", "type": "signature", "label": "Senior Site Management"}]}], "settings": {}, "schemaVersion": 1}$j001$::jsonb),
       revision       = 'v4',
       effective_date = date '2026-09-16',
       approved_by    = 'GJM',
       sqf_reference  = '2.1.2.1'
 where sop_number = 'FRM-001';

-- ------------------------------------------------------------------ 2. FSQM-005, rewritten
-- MERGED, not replaced. `||` overwrites the nine body sections and leaves every other top-level key
-- alone - which matters: content.attachments holds the original SOP_FSQM-0005_0001.docx this
-- document was imported from, and replacing content wholesale would orphan it in storage and drop
-- it out of the drawer's Reference Documents tab. Same reasoning as patchModuleContent.
update public.sop_documents
   set content       = content || $j005${"purpose": "To define how the SQF System is reviewed by senior site management, so that its continued suitability and effectiveness are established and recorded: the annual management review required by SQF 2.1.2.1, and the monthly update to senior site management required by SQF 2.1.2.2.", "scope": "Covers both reviews, for the whole SQF System and every site activity within its scope.\n\nThe annual management review is recorded on FRM-001 Management Review Record. The monthly update is minuted and the minutes are retained with the management review records.\n\nThis programme does not itself set the site's food safety objectives; it reviews performance against whatever objectives senior site management has set.", "definitions": "Management review (2.1.2.1) - the annual review of the whole SQF System by senior site management, against the six required agenda items. Recorded on FRM-001.\n\nMonthly update (2.1.2.2) - the SQF Practitioner's update to senior site management on matters affecting the implementation and maintenance of the SQF System, and management's response to it. A lighter, more frequent obligation, and a different one.\n\nSenior site management - the person or people accountable for the site, who own the SQF System. Where one person holds both this post and the SQF Practitioner's, they act in both and the record shows it as it is.", "responsibility": "Senior site management - convenes and chairs the annual management review, decides the outcomes and the resources, signs FRM-001, and responds to the monthly update.\nSQF Practitioner - prepares the inputs for the annual review, gives the monthly update, records both, and tracks the follow-up actions to closure.\nQuality and production staff - supply the data behind each input when asked for it.", "procedure": ["PART 1 - TWO OBLIGATIONS, KEPT SEPARATE", "• **2.1.2.1 requires an annual review** of the whole SQF System by senior site management, against six named agenda items, with the records maintained.", "• **2.1.2.2 requires a monthly update** from the SQF Practitioner to senior site management on matters affecting the SQF System, with the update and management's response documented.", "> These are kept as two things rather than collapsed into one. Collapsing them was considered and rejected: it would require every monthly meeting to cover all six agenda items in full and to be recorded as a management review - twelve complete records a year, where a quiet month becomes a gap in the evidence rather than simply a quiet month. The clause asks for one thorough annual review and twelve lighter updates, and that is what the site does.", "PART 2 - THE ANNUAL MANAGEMENT REVIEW", "Held at least once every twelve months, and again whenever a change to the process, the product range, the facility or the organisation is significant enough to affect the SQF System. It is recorded on **FRM-001**, whose agenda carries the six items 2.1.2.1 names:", "• **(i) Changes to food safety management system documentation** - policies, procedures, specifications and the food safety plan. FRM-001 Section I.", "• **(ii) Food safety culture performance.** FRM-001 Section I. No formal measures are set against this yet; until they are, it is answered with what the site did and observed, and records that no measures are in force.", "• **(iii) Food safety objectives and performance measures.** FRM-001 Section II carries the targets senior site management has set, against the input each measures.", "• **(iv) Corrective and preventive actions, and trends** in internal and external audit findings, customer complaints, and verification and validation activities. FRM-001 Section II.", "• **(v) The hazard and risk management system.** FRM-001 Section I - changes to the HACCP plan, its hazard analysis and its critical limits.", "• **(vi) Follow-up action items from previous management reviews.** FRM-001 Section II, with the actions themselves tracked in Section IV.", "> Every agenda row is answered, including where the answer is \"no change\" or \"not performed\". A blank row cannot be told apart from one nobody considered, and the clause asks for the review rather than only for what it turns up.", "PART 3 - THE MONTHLY UPDATE", "The SQF Practitioner updates senior site management at least monthly on matters affecting the implementation and maintenance of the SQF System: verification activities that have fallen due, open corrective actions, complaints, incidents, audit findings, and anything requiring a decision or a resource.", "The update and **management's response to it** are minuted. The minutes name the date, who was present, what was raised, what management decided, and any action with an owner and a date. They are retained with the management review records.", "> **Nothing records this today.** The monthly meeting is held, but no retained record of it exists, and 2.1.2.2 asks for the update and the response to be documented. The requirement is stated here so the record starts being kept; until it is, this part of the clause is not evidenced, and saying so is more useful than a programme that implies otherwise.", "PART 4 - ACTIONS, RECORDS AND FOLLOW-UP", "Every action arising from either review is recorded with a responsible person and a target date - on FRM-001 Section IV for the annual review, in the minutes for a monthly update - and is reviewed for closure at the next meeting of either kind.", "An action that reveals a non-conformity in the SQF System is raised as a corrective action under **FSQM-009** on **FRM-007**, and is not tracked only in these minutes.", "Records are retained per the record retention policy. The annual review is an activity on the master verification schedule, so it is prompted when it falls due and the reminder closes when the FRM-001 entry is submitted.", "PART 5 - WHAT THIS PROGRAMME DOES NOT CLAIM", "• It does not set the site's food safety objectives. It reviews performance against those senior site management has set, and records where none are set yet.", "• It does not create data. Where the site does not perform an activity - it carries out no microbiological or environmental analysis - the review records that it is not performed, rather than trending results that do not exist.", "• It does not replace the SQF Practitioner's day-to-day escalation of a food safety issue, which does not wait for a meeting."], "form_references": "FRM-001 - Management Review Record (the annual review)\nFRM-007 - Corrective & Preventive Action Report (where a review finds a non-conformity)\nMinutes of the monthly update to senior site management", "records": "Completed FRM-001 entries, one per annual management review, retained per the record retention policy.\nMinutes of each monthly update to senior site management, with management's response, retained with them.\nActions arising from either, tracked to closure.", "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 - 2.1.2.1 (management review at least annually, covering the six named items, with records maintained) and 2.1.2.2 (the SQF Practitioner updates senior site management at least monthly; the updates and management responses are documented).", "revision_history": "New - 2026-09-16 - First issue, under D-06 Management Review Upgrade.\n\nREPLACES A DRAFT THAT COULD NOT BE ISSUED. The document carried by this number had six of its ten sections empty - no purpose, definitions, records, form references, governing reference or revision history - and twelve generic procedure lines that did not map to 2.1.2.1's six agenda items. It referred to a \"Flash Report\" that exists nowhere in this system, and stated that \"besides the annual management review, the Quality Leader shall review the entire SQF System at least annually\", which is circular. It was rewritten rather than patched.\n\nTHE ANNUAL REVIEW AND THE MONTHLY UPDATE ARE KEPT SEPARATE. The gap assessment suggested that if every agenda item is reviewed monthly the separate annual review could be dropped. That is true on its face and was declined deliberately: it would commit the site to twelve full management review records a year, each covering all six items, where a quiet month becomes a hole in the evidence. 2.1.2.1 and 2.1.2.2 ask for different things at different depths, and the site now does both.\n\nTHE MONTHLY UPDATE HAS NO RECORD YET, and this document says so rather than implying otherwise. 2.1.2.2 was assessed Compliant on the strength of the previous draft's sentence about a Flash Report; that report does not exist. Part 3 states what the minutes must contain so the record can start being kept.\n\nFRM-001 GOES TO v4 IN THE SAME CHANGE. Three agenda items 2.1.2.1 requires were missing (documentation changes, food safety culture performance, and the hazard and risk management system stated as such); a verification and validation input was added for 2.1.2.1 (iv); the organisational chart row cited FSQM-002, the policy, instead of FSQM-004; two further references pointed at FSQM-026 and FSQM-033, numbers reserved for Food Fraud and Water & Utilities and not yet written; and three targets asserted work the site does not do - microbiological criteria, Listeria and Salmonella swabbing, and \"First Time Right in blending\". Those are removed, because an agenda claiming a control that does not exist is worse at an audit than one that is merely incomplete.\n\nStatus stays draft until reviewed."}$j005$::jsonb,
       title         = 'Management Review Program',
       revision      = 'New',
       sqf_reference = '2.1.2.1, 2.1.2.2',
       status        = 'draft'
 where sop_number = 'FSQM-005';

-- ------------------------------------------------------------------ verify
do $verify$
declare
  r record;
  bad text;
begin
  select (select revision from public.sop_documents where sop_number = 'FRM-001')  as r001,
         (select status   from public.sop_documents where sop_number = 'FSQM-005') as s005,
         (select revision from public.sop_documents where sop_number = 'FSQM-005') as r005,
         (select jsonb_array_length(content->'form_schema'->'sections')
            from public.sop_documents where sop_number = 'FRM-001')                as sections,
         (select jsonb_array_length(content->'procedure')
            from public.sop_documents where sop_number = 'FSQM-005')               as lines005,
         (select count(*) from jsonb_object_keys(
            (select content from public.sop_documents where sop_number = 'FSQM-005')))
                                                                                   as keys005
    into r;

  if r.r001 <> 'v4' then raise exception 'FRM-001 is % not v4.', r.r001; end if;
  if r.s005 <> 'draft' or r.r005 <> 'New' then
    raise exception 'FSQM-005 is %/% - expected draft/New.', r.s005, r.r005;
  end if;
  if r.sections <> 7 then raise exception 'FRM-001 lost a section: % of 7.', r.sections; end if;

  -- every claim the site cannot support has to be gone, and stay gone
  foreach bad in array array['FSQM-026', 'FSQM-033', 'microbiological criteria', 'Listeria',
                             'Salmonella', 'blending',
                             'Organizational Chart and Management Changes (Ref: FSQM-002)'] loop
    if (select content->'form_schema' from public.sop_documents
         where sop_number = 'FRM-001')::text like '%' || bad || '%' then
      raise exception 'FRM-001 still carries "%" after the update.', bad;
    end if;
  end loop;

  -- and the clause's six items have to be findable on the form
  if (select content->'form_schema' from public.sop_documents where sop_number = 'FRM-001')::text
       not like '%Food Safety Culture Performance%'
     or (select content->'form_schema' from public.sop_documents where sop_number = 'FRM-001')::text
       not like '%Changes to Food Safety Management System Documentation%'
     or (select content->'form_schema' from public.sop_documents where sop_number = 'FRM-001')::text
       not like '%Hazard and Risk Management System%'
     or (select content->'form_schema' from public.sop_documents where sop_number = 'FRM-001')::text
       not like '%Verification and Validation Activities%' then
    raise exception 'FRM-001 is missing one of the agenda items this migration adds.';
  end if;

  -- FSQM-005 must no longer be the empty shell, and must not carry the Flash Report
  if r.keys005 < 10 then
    raise exception 'FSQM-005 has only % content keys; it should carry all ten sections.', r.keys005;
  end if;
  -- Scoped to the PROCEDURE, not the whole document: the revision history explains that the old
  -- draft pointed at a Flash Report which never existed, and that sentence is meant to survive.
  if exists (select 1 from public.sop_documents
              where sop_number = 'FSQM-005'
                and (content->'procedure')::text ilike '%flash report%') then
    raise exception 'FSQM-005 still instructs anybody to record in the Flash Report.';
  end if;
  if not exists (select 1 from public.sop_documents
                  where sop_number = 'FSQM-005'
                    and content->'attachments' @> '[{"name": "SOP_FSQM-0005_0001.docx"}]'::jsonb) then
    raise exception 'The FSQM-005 source .docx attachment was dropped by the rewrite.';
  end if;
  if not exists (select 1 from public.sop_documents
                  where sop_number = 'FSQM-005'
                    and content->>'purpose' <> ''
                    and content->>'records' <> ''
                    and content->>'governing_reference' <> ''
                    and content->>'revision_history' <> '') then
    raise exception 'FSQM-005 still has an empty section that was empty before.';
  end if;

  raise notice 'D-06: FRM-001 v4 (7 mandatory rows, 9 inputs); FSQM-005 rewritten as a draft (% lines).',
    r.lines005;
end $verify$;

commit;
