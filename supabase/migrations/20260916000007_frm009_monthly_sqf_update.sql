-- FRM-009 Monthly SQF Update Record - the record 2.1.2.2 needs, which nothing held.
--
-- FOUND ON REVIEW OF FSQM-005, BEFORE IT WAS ISSUED. The programme named FRM-001 as the annual
-- management review record, correctly, and then said the monthly update was "minuted" and the
-- minutes "retained with the management review records" - naming no form, no location and nothing
-- to prompt it. That is the same weakness as the "Flash Report" that draft replaced, one level less
-- obvious: a sentence asserting a record rather than a record.
--
-- 2.1.2.2 ASKS FOR TWO THINGS TO BE DOCUMENTED - the SQF Practitioner's monthly update to senior
-- site management, AND management's response to it. The clause was assessed Compliant at the gap
-- assessment on the strength of the old draft's sentence. It was not true then and would not have
-- become true by issuing a better-written sentence.
--
-- SO THE MONTHLY UPDATE GETS A FORM AND A PROMPT.
--   FRM-009  four short sections - the update, the matters raised, management's response, and two
--            signatures. Deliberately small: twelve records a year are only kept if each takes
--            minutes. Section 2 is a fixed six-row grid with one column, so most months are a
--            handful of short answers and several "none"s - and a row saying nothing arose is
--            evidence the question was asked.
--   schedule  a MONTHLY row, evidenced by FRM-009, responsible SQF Practitioner. It prompts itself
--            and shows overdue, rather than relying on somebody remembering.
--   FSQM-005  Part 3 rewritten to name FRM-009; Part 4's "in the minutes" corrected in both places;
--            form_references and records updated.
--
-- WHY NOT RECORD IT ON FRM-001. Considered and rejected. The verification schedule anchors the
-- ANNUAL activity on the latest SUBMITTED FRM-001 entry, so a monthly entry on the same form would
-- reset the annual clock every month and the annual review would never come due. Splitting that
-- anchor is more machinery than a second, shorter form.
--
-- BOTH SIGNATURES MATTER AND THEY ARE DIFFERENT ROLES. The practitioner's is a filler signature -
-- the update was given. Management's is a verifier signature, which only admin/owner can sign, so a
-- practitioner who is not also an admin fills the entry, saves it, and uses Request signature to
-- send it on. That is the flow the signature queue was built for.
--
-- FRM-009 IS FREE: not live, and reserved nowhere in the remediation workbook (which holds
-- FRM-001/002/003/004/005/007/008). Allocated from the workbook, not from the migrations. FRM-008
-- stays dead.
--
-- SEEDED AS A DRAFT, and the schedule row as `planned`, both to be activated by the issue migration
-- that issues FSQM-005 - the house rule being that a planned row goes live when its programme does.

begin;

do $guard$
begin
  if exists (select 1 from public.sop_documents where sop_number = 'FRM-009') then
    raise exception 'FRM-009 already exists.';
  end if;
  if not exists (select 1 from public.sop_documents
                  where sop_number = 'FSQM-005' and status = 'draft' and revision = 'New') then
    raise exception 'FSQM-005 is not the unissued draft this migration amends.';
  end if;
  if (select content->'procedure'->>15 from public.sop_documents where sop_number = 'FSQM-005')
     not like '%minuted%' then
    raise exception 'FSQM-005 procedure[15] is not the minutes line this migration replaces.';
  end if;
  if exists (select 1 from public.verification_schedule where activity_key = 'monthly_sqf_update') then
    raise exception 'The monthly_sqf_update activity already exists.';
  end if;
end $guard$;

-- ------------------------------------------------------------------ 1. FRM-009
insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values
  ('FRM-009', 'Monthly SQF Update Record', 'form', 'Module 2', 'draft', 'New',
   $sq$2.1.2.2$sq$, true, jsonb_build_object('form_schema', $j009${"schemaVersion": 1, "settings": {"attachmentsEnabled": true, "allowMultipleDrafts": false, "requireVerification": true, "instanceTitleTemplate": "{update_date} — monthly SQF update"}, "sections": [{"id": "update", "title": "1. The update", "fields": [{"id": "how_this_works", "type": "info", "label": "How this record works", "text": "ONE ENTRY IS ONE MONTHLY UPDATE. SQF 2.1.2.2 asks the SQF Practitioner to update senior site management at least monthly on matters affecting the SQF System, and for the update AND management's response to be documented. This is that record.\n\nIT IS DELIBERATELY SHORT. Twelve of these a year only get filled in if filling one in takes minutes. Most months several rows will read \"none\", and that is a complete answer - a row saying nothing arose is evidence the question was asked.\n\nMOST OF SECTION 2 IS ALREADY ON THE NOTIFICATIONS PAGE. Verification activities that have fallen due, open alerts and outstanding items are listed there; this record is where what was said about them, and what management decided, gets written down.\n\nTHE ANNUAL REVIEW IS A DIFFERENT RECORD. The full review of the SQF System against the six items 2.1.2.1 names is recorded on FRM-001, once a year. This form does not replace it."}, {"id": "update_date", "type": "date", "label": "Date of the update", "width": "third", "required": true, "showInList": true, "defaultToday": true}, {"id": "month_covered", "type": "text", "label": "Month covered", "width": "third", "required": true, "showInList": true, "help": "For example \"September 2026\"."}, {"id": "present", "type": "text", "label": "Who was present", "width": "third", "required": true}]}, {"id": "matters", "title": "2. Matters raised (2.1.2.2)", "fields": [{"id": "matters_info", "type": "info", "label": "How to fill this in", "text": "Answer every row, including with \"none\". A blank row cannot be told apart from one nobody raised."}, {"id": "matters", "type": "grid", "label": "Matters affecting the SQF System", "required": true, "rows": {"mode": "fixed", "labelHeader": "Matter", "labels": ["Verification activities due or overdue\nWhat the schedule shows outstanding, and why.", "Open corrective actions\nCAPAs on FRM-007 still open, and anything past its due date.", "Complaints, incidents and recalls\nAnything raised since the last update.", "Audit and inspection findings\nInternal, customer, certification body or regulatory.", "Changes affecting the SQF System\nProcess, product, equipment, facility or personnel.", "Anything needing a decision or a resource"]}, "columns": [{"id": "raised", "type": "text", "label": "What was raised", "width": 3, "required": true}]}]}, {"id": "response", "title": "3. Management's response", "fields": [{"id": "response", "type": "textarea", "label": "Response and decisions", "required": true, "help": "What senior site management said about the matters above, and what was decided."}, {"id": "actions", "type": "grid", "label": "Actions arising", "help": "Leave empty where nothing was actioned.", "rows": {"mode": "dynamic", "min": 0, "addLabel": "Add an action"}, "columns": [{"id": "action", "type": "text", "label": "Action", "width": 3, "required": true}, {"id": "owner", "type": "text", "label": "Owner", "width": 1, "required": true}, {"id": "due", "type": "date", "label": "Due", "width": 1, "required": true}, {"id": "done", "type": "pass_fail", "label": "Completed", "width": 1}]}]}, {"id": "signoff", "title": "4. Sign-off", "fields": [{"id": "signoff_info", "type": "info", "label": "Who signs what", "text": "BOTH SIGNATURES ARE THE POINT OF THE RECORD. 2.1.2.2 asks for the update and the response - the SQF Practitioner signs that the update was given, senior site management signs its response to it. Where one person holds both posts, they sign both and the record shows it as it is.\n\nOnly admin/owner can sign the management line. If that is not you, fill this in, save it as a draft and use Request signature to send it to whoever signs."}, {"id": "updated_by", "type": "signature", "role": "filler", "width": "half", "required": true, "label": "SQF Practitioner - update given", "statement": "I gave the update recorded above to senior site management on the date shown."}, {"id": "management_response", "type": "signature", "role": "verifier", "width": "half", "required": true, "label": "Senior Site Management - response", "statement": "I received this update and the response and decisions recorded above are mine."}]}]}$j009$::jsonb));

-- ------------------------------------------------------------------ 2. FSQM-005 names it
update public.sop_documents
   set content = $j005${"scope": "Covers both reviews, for the whole SQF System and every site activity within its scope.\n\nThe annual management review is recorded on FRM-001 Management Review Record. The monthly update is minuted and the minutes are retained with the management review records.\n\nThis programme does not itself set the site's food safety objectives; it reviews performance against whatever objectives senior site management has set.", "purpose": "To define how the SQF System is reviewed by senior site management, so that its continued suitability and effectiveness are established and recorded: the annual management review required by SQF 2.1.2.1, and the monthly update to senior site management required by SQF 2.1.2.2.", "records": "Completed FRM-001 entries, one per annual management review, retained per the record retention policy.\nCompleted FRM-009 entries, one per month, carrying the update, management's response and any actions arising.\nActions arising from either, tracked to closure.", "procedure": ["PART 1 - TWO OBLIGATIONS, KEPT SEPARATE", "• **2.1.2.1 requires an annual review** of the whole SQF System by senior site management, against six named agenda items, with the records maintained.", "• **2.1.2.2 requires a monthly update** from the SQF Practitioner to senior site management on matters affecting the SQF System, with the update and management's response documented.", "> These are kept as two things rather than collapsed into one. Collapsing them was considered and rejected: it would require every monthly meeting to cover all six agenda items in full and to be recorded as a management review - twelve complete records a year, where a quiet month becomes a gap in the evidence rather than simply a quiet month. The clause asks for one thorough annual review and twelve lighter updates, and that is what the site does.", "PART 2 - THE ANNUAL MANAGEMENT REVIEW", "Held at least once every twelve months, and again whenever a change to the process, the product range, the facility or the organisation is significant enough to affect the SQF System. It is recorded on **FRM-001**, whose agenda carries the six items 2.1.2.1 names:", "• **(i) Changes to food safety management system documentation** - policies, procedures, specifications and the food safety plan. FRM-001 Section I.", "• **(ii) Food safety culture performance.** FRM-001 Section I. No formal measures are set against this yet; until they are, it is answered with what the site did and observed, and records that no measures are in force.", "• **(iii) Food safety objectives and performance measures.** FRM-001 Section II carries the targets senior site management has set, against the input each measures.", "• **(iv) Corrective and preventive actions, and trends** in internal and external audit findings, customer complaints, and verification and validation activities. FRM-001 Section II.", "• **(v) The hazard and risk management system.** FRM-001 Section I - changes to the HACCP plan, its hazard analysis and its critical limits.", "• **(vi) Follow-up action items from previous management reviews.** FRM-001 Section II, with the actions themselves tracked in Section IV.", "> Every agenda row is answered, including where the answer is \"no change\" or \"not performed\". A blank row cannot be told apart from one nobody considered, and the clause asks for the review rather than only for what it turns up.", "PART 3 - THE MONTHLY UPDATE", "The SQF Practitioner updates senior site management at least monthly on matters affecting the implementation and maintenance of the SQF System: verification activities that have fallen due, open corrective actions, complaints, incidents, audit findings, changes affecting the system, and anything requiring a decision or a resource.", "The update and **management's response to it** are recorded on **FRM-009 Monthly SQF Update Record**, one entry per month. The SQF Practitioner signs that the update was given and senior site management signs its response; where one person holds both posts they sign both. Actions arising are recorded on the same entry with an owner and a due date.", "> **This is a new record, and it starts from the effective date of this programme.** No retained record of the monthly update existed before it: the previous draft pointed at a \"Flash Report\" that exists nowhere in this system, so 2.1.2.2's requirement that the update and the response be documented was met on paper and not in fact. FRM-009 is deliberately short - twelve records a year are only kept if each takes minutes - and it is on the master verification schedule as a monthly activity, so it prompts itself rather than relying on somebody remembering.", "PART 4 - ACTIONS, RECORDS AND FOLLOW-UP", "Every action arising from either review is recorded with a responsible person and a target date - on FRM-001 Section IV for the annual review, on FRM-009 for a monthly update - and is reviewed for closure at the next meeting of either kind.", "An action that reveals a non-conformity in the SQF System is raised as a corrective action under **FSQM-009** on **FRM-007**, and is not tracked only on these records.", "Records are retained per the record retention policy. Both reviews are activities on the master verification schedule - the annual review evidenced by FRM-001 and the monthly update by FRM-009 - so each is prompted when it falls due, and the reminder closes when the entry is submitted.", "PART 5 - WHAT THIS PROGRAMME DOES NOT CLAIM", "• It does not set the site's food safety objectives. It reviews performance against those senior site management has set, and records where none are set yet.", "• It does not create data. Where the site does not perform an activity - it carries out no microbiological or environmental analysis - the review records that it is not performed, rather than trending results that do not exist.", "• It does not replace the SQF Practitioner's day-to-day escalation of a food safety issue, which does not wait for a meeting."], "attachments": [{"name": "SOP_FSQM-0005_0001.docx", "path": "2d9682eb-ff5b-4e74-ab9a-c5fe1a2423d9/files/SOP_FSQM-0005_0001.docx"}], "definitions": "Management review (2.1.2.1) - the annual review of the whole SQF System by senior site management, against the six required agenda items. Recorded on FRM-001.\n\nMonthly update (2.1.2.2) - the SQF Practitioner's update to senior site management on matters affecting the implementation and maintenance of the SQF System, and management's response to it. A lighter, more frequent obligation, and a different one.\n\nSenior site management - the person or people accountable for the site, who own the SQF System. Where one person holds both this post and the SQF Practitioner's, they act in both and the record shows it as it is.", "responsibility": "Senior site management - convenes and chairs the annual management review, decides the outcomes and the resources, signs FRM-001, and responds to the monthly update.\nSQF Practitioner - prepares the inputs for the annual review, gives the monthly update, records both, and tracks the follow-up actions to closure.\nQuality and production staff - supply the data behind each input when asked for it.", "form_references": "FRM-001 - Management Review Record (the annual review)\nFRM-009 - Monthly SQF Update Record (the monthly update and management's response)\nFRM-007 - Corrective & Preventive Action Report (where a review finds a non-conformity)", "revision_history": "New - 2026-09-16 - First issue, under D-06 Management Review Upgrade.\n\nREPLACES A DRAFT THAT COULD NOT BE ISSUED. The document carried by this number had six of its ten sections empty - no purpose, definitions, records, form references, governing reference or revision history - and twelve generic procedure lines that did not map to 2.1.2.1's six agenda items. It referred to a \"Flash Report\" that exists nowhere in this system, and stated that \"besides the annual management review, the Quality Leader shall review the entire SQF System at least annually\", which is circular. It was rewritten rather than patched.\n\nTHE ANNUAL REVIEW AND THE MONTHLY UPDATE ARE KEPT SEPARATE. The gap assessment suggested that if every agenda item is reviewed monthly the separate annual review could be dropped. That is true on its face and was declined deliberately: it would commit the site to twelve full management review records a year, each covering all six items, where a quiet month becomes a hole in the evidence. 2.1.2.1 and 2.1.2.2 ask for different things at different depths, and the site now does both.\n\nTHE MONTHLY UPDATE HAS NO RECORD YET, and this document says so rather than implying otherwise. 2.1.2.2 was assessed Compliant on the strength of the previous draft's sentence about a Flash Report; that report does not exist. Part 3 states what the minutes must contain so the record can start being kept.\n\nFRM-001 GOES TO v4 IN THE SAME CHANGE. Three agenda items 2.1.2.1 requires were missing (documentation changes, food safety culture performance, and the hazard and risk management system stated as such); a verification and validation input was added for 2.1.2.1 (iv); the organisational chart row cited FSQM-002, the policy, instead of FSQM-004; two further references pointed at FSQM-026 and FSQM-033, numbers reserved for Food Fraud and Water & Utilities and not yet written; and three targets asserted work the site does not do - microbiological criteria, Listeria and Salmonella swabbing, and \"First Time Right in blending\". Those are removed, because an agenda claiming a control that does not exist is worse at an audit than one that is merely incomplete.\n\nTHE MONTHLY UPDATE GAINED A RECORD BEFORE ISSUE. On review it was pointed out that this programme named FRM-001 as the annual record but left the monthly update documented \"in minutes\" with no form, no location and nothing to prompt it - which is the same weakness as the Flash Report it replaced, one level less obvious. FRM-009 Monthly SQF Update Record was written for it and put on the verification schedule as a monthly activity, so 2.1.2.2 is evidenced by a record rather than asserted by a sentence.\n\nStatus stays draft until reviewed.", "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 - 2.1.2.1 (management review at least annually, covering the six named items, with records maintained) and 2.1.2.2 (the SQF Practitioner updates senior site management at least monthly; the updates and management responses are documented)."}$j005$::jsonb
 where sop_number = 'FSQM-005';

-- ------------------------------------------------------------------ 3. the monthly activity
insert into public.verification_schedule
  (activity_key, activity, description, frequency_unit, frequency_count, responsible_position,
   evidence_kind, evidence_document_number, owning_program, pending_deliverable,
   sqf_reference, lead_days, grace_days, first_due_on, status, sort_order)
values
  ('monthly_sqf_update',
   'Monthly SQF update to senior site management',
   'The SQF Practitioner updates senior site management on matters affecting the SQF System, and '
   'management responds. Both are recorded on FRM-009. Required monthly by SQF 2.1.2.2, and '
   'distinct from the annual management review on FRM-001.',
   'month', 1,
   'SQF Practitioner',
   'form_entry', 'FRM-009', 'FSQM-005',
   'D-06 Management Review Upgrade - FSQM-005 and FRM-009 are still drafts',
   '2.1.2.2',
   0, 7, null,
   'planned', 112);

-- ------------------------------------------------------------------ verify
do $verify$
declare r record;
begin
  select (select status from public.sop_documents where sop_number = 'FRM-009')      as s009,
         (select jsonb_array_length(content->'form_schema'->'sections')
            from public.sop_documents where sop_number = 'FRM-009')                  as sections,
         (select count(*) from jsonb_array_elements(
            (select content->'form_schema'->'sections' from public.sop_documents
              where sop_number = 'FRM-009')) s, jsonb_array_elements(s->'fields') f) as fields,
         (select count(*) from jsonb_array_elements(
            (select content->'form_schema'->'sections' from public.sop_documents
              where sop_number = 'FRM-009')) s, jsonb_array_elements(s->'fields') f
           where f->>'type' = 'signature')                                           as sigs,
         (select status from public.verification_schedule
           where activity_key = 'monthly_sqf_update')                                as vs
    into r;

  if r.s009 <> 'draft' then raise exception 'FRM-009 is % not draft.', r.s009; end if;
  if r.sections <> 4 then raise exception 'FRM-009 has % sections, expected 4.', r.sections; end if;
  if r.fields <> 11 then
    raise exception 'FRM-009 has % fields, expected 11.', r.fields;
  end if;
  -- one filler and one verifier: the clause asks for the update AND the response
  if r.sigs <> 2 then raise exception 'FRM-009 should carry two signatures, has %.', r.sigs; end if;
  if not exists (select 1 from jsonb_array_elements(
                   (select content->'form_schema'->'sections' from public.sop_documents
                     where sop_number = 'FRM-009')) s, jsonb_array_elements(s->'fields') f
                  where f->>'type' = 'signature' and f->>'role' = 'verifier') then
    raise exception 'FRM-009 has no verifier signature for management''s response.';
  end if;
  if r.vs <> 'planned' then raise exception 'The schedule row is % not planned.', r.vs; end if;

  -- FSQM-005 must now name the form, and must no longer send anyone to unnamed minutes
  if (select (content->'procedure')::text from public.sop_documents where sop_number = 'FSQM-005')
     not like '%FRM-009 Monthly SQF Update Record%' then
    raise exception 'FSQM-005 does not name FRM-009.';
  end if;
  if (select (content->'procedure')::text from public.sop_documents where sop_number = 'FSQM-005')
     like '%in the minutes for a monthly update%' then
    raise exception 'FSQM-005 Part 4 still sends monthly actions to unnamed minutes.';
  end if;
  if (select content->>'form_references' from public.sop_documents where sop_number = 'FSQM-005')
     not like '%FRM-009%' then
    raise exception 'FSQM-005 form_references does not list FRM-009.';
  end if;

  raise notice 'FRM-009 seeded (4 sections, % fields); FSQM-005 names it; monthly activity planned.',
    r.fields;
end $verify$;

commit;
