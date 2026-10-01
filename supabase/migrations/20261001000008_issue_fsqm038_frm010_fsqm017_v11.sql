-- D-19: issue FSQM-038 Internal Audit Program and FRM-010 Internal Audit Record; FSQM-017 v10 -> v11.
--
-- Two Minor findings close: 2.5.4.1 and 2.5.4.2. Both documents go active, GJM, 2026-10-01, revision New
-- (first issue).
--
-- THE DRAFT'S "WHO AUDITS" IS REPLACED, NOT JUST CONFIRMED. As drafted (20260930000009) the SQF
-- Practitioner and Senior Site Management each audited what the other runs. The owner's decision at
-- issue: one Internal Auditor carries out every audit - a person who takes no part in running the
-- site - and the SQF Practitioner reviews each audit as second auditor. That is more independent
-- than the cross-audit (2.5.4.2 "where practical"), and it removes a hand-off between two positions
-- that the same person can hold.
--   - The Internal Auditor's one responsibility is the Team Portal application, so the part of 2.2
--     that concerns it is audited by the SQF Practitioner instead.
--   - TRAINING IS STATED AS IT IS: the Internal Auditor holds no internal audit qualification at
--     issue and completes a recognised course BEFORE the first audit. The program says so, and says
--     no audit is carried out until then. Issuing it does not claim otherwise.
--   - CERTIFICATION AUDIT: not yet booked, target the second quarter of 2027. The first cycle is
--     brought forward so the whole Code is audited by 31 March 2027.
--
-- FRM-010 follows: the audit plan table no longer names an auditor per section, the independence
-- answer and the second signature are reworded. Field ids are unchanged, and it has no entries.
--
-- verification_schedule.internal_audit: planned -> ACTIVE, form_entry FRM-010, every quarter, owning
-- program FSQM-038, first_due_on 2026-12-01 with the existing 30 days' grace - so the Q4 2026 audit
-- is raised on 1 December and is overdue after the quarter ends.
--
-- FSQM-017 v10 -> v11: Part 6's line (procedure[60]) loses NOT YET IMPLEMENTED and names FRM-010;
-- FRM-010 is added to its form references.
--
-- Guarded on the md5 of each document's content as it stands in production (read 2026-10-01), on
-- FRM-010 having no entries, and on the schedule row still being planned.

begin;

do $guard$
declare h text; st text; rev text;
begin
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FSQM-038';
  if st is distinct from 'draft' or h <> '60e3d9216b3edc0fc1587c286cfb0e58' then raise exception 'FSQM-038 is % or changed since review (md5 %).', st, h; end if;
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FRM-010';
  if st is distinct from 'draft' or h <> 'ce8f2aff078fe2de489ff86bea5e9eea' then raise exception 'FRM-010 is % or changed since review (md5 %).', st, h; end if;
  select md5(content::text), status, revision into h, st, rev from public.sop_documents where sop_number = 'FSQM-017';
  if (st, rev) is distinct from ('active', 'v10') or h <> 'f09c395f2ce4e24bc4d76a7db3dbb635' then
    raise exception 'FSQM-017 is %/% or changed since this migration was written (md5 %).', st, rev, h;
  end if;
  if (select status from public.verification_schedule where activity_key = 'internal_audit') is distinct from 'planned' then
    raise exception 'internal_audit is not planned.';
  end if;
  if (select count(*) from public.sop_document_responses r join public.sop_documents d on d.id = r.document_id
       where d.sop_number = 'FRM-010') <> 0 then
    raise exception 'FRM-010 has entries before issue - check they are not test entries.';
  end if;
end $guard$;

update public.sop_documents
   set content = $q038$
{
 "scope": "The whole SQF System - the System Elements (2.1 to 2.9) and the Good Manufacturing Practices of Module 11 (11.1 to 11.8) of the SQF Food Safety Code: Food Manufacturing, Edition 9. The internal audit does not replace the GMP inspections of the site and equipment (FRM-913 under FSQM-012), the CCP record reviews or the other activities on the verification schedule in FSQM-017. It checks that those are being done and that they work.",
 "purpose": "This program states how Adventure Bakery audits its own SQF System: what is audited and when, who audits it, how the evidence is recorded, and how what is found gets corrected and reported. Every applicable requirement of the SQF Food Safety Code: Food Manufacturing is audited at least once a year.",
 "records": "• FRM-010 entries, one per quarterly audit, with the evidence for every sub-section audited\n• FRM-007 CAPAs raised from internal audits\n• The Internal Auditor's course certificate, and the second auditor's training on FRM-952",
 "procedure": [
  "The audit plan",
  "• Every applicable requirement of the SQF Food Safety Code: Food Manufacturing is audited in every calendar year. The work is spread over four quarterly audits, so each one is a manageable piece of work for a small team (SQF 2.5.4.1):",
  "◦ Q1 (January to March): 2.1 Management commitment, 2.2 Document control and records, 2.3 Specifications and supplier approval, 2.9 Training, 11.8 Waste disposal.",
  "◦ Q2 (April to June): 2.4 Food safety system, 2.8 Allergen management, 11.3 Personnel hygiene and welfare, 11.4 Personnel processing practices.",
  "◦ Q3 (July to September): 2.5 SQF System verification, 2.6 Traceability, withdrawal, recall and crisis, 2.7 Food defense and food fraud, 11.1 Site location and premises, 11.2 Site operation - maintenance, calibration, pest prevention, cleaning.",
  "◦ Q4 (October to December): 11.5 Water, ice and air, 11.6 Receipt, storage and transport, 11.7 Separation of functions and foreign matter.",
  "• A quarter's audit can be done in one sitting or over several days within the quarter.",
  "• A quarter that is missed is audited in the next quarter together with that quarter's own sections, and the reason is written on FRM-010. No section goes unaudited for more than twelve months.",
  "• A section can be moved to another quarter - for example, to audit a program soon after it is issued - with Senior Site Management's approval written on FRM-010, as long as every section is still audited in the calendar year.",
  "• A section is audited again early when something suggests it is not working: repeated complaints, a CCP deviation, a failed trace test, or a finding at a certification or regulatory audit.",
  "• First cycle. The site is working toward its first certification audit in the second quarter of 2027; the date is not yet booked. So that the whole Code has been audited before it, the first cycle is brought forward: the Q4 sections are audited in the fourth quarter of 2026, and every other section by 31 March 2027. The quarterly plan above applies from April 2027. If the certification audit is booked for an earlier date, the remaining sections are brought forward again so that none is unaudited when it takes place.",
  "Who audits",
  "• Every section is audited by the Internal Auditor: a person appointed by Senior Site Management who takes no part in the day-to-day running of the site - not in production, sanitation, purchasing, receiving or dispatch - and so is independent of the functions audited (SQF 2.5.4.2).",
  "• The Internal Auditor's one responsibility at the site is the Team Portal application, in which the SQF System's documents and records are held. Where an audit question is about that application itself - how documents and records are stored, controlled and retained, within 2.2 - the SQF Practitioner audits that part and the Internal Auditor reviews it, and FRM-010 says so. Nobody signs off their own work as compliant unseen.",
  "• The SQF Practitioner is the second auditor. They review every audit - the evidence recorded and the result given for each sub-section - before signing FRM-010. If the Internal Auditor cannot carry out an audit, the SQF Practitioner does, and FRM-010 lists which of the audited work is their own.",
  "• Training (SQF 2.5.4.2). The Internal Auditor completes a recognised internal auditor course before carrying out the first audit, and the certificate is kept with the training records. The Internal Auditor then trains the SQF Practitioner as second auditor before they review or carry out an audit, and that training is recorded on FRM-952.",
  "Carrying out an audit",
  "• The auditor opens an FRM-010 entry for the quarter and lists the sections to be audited. They take the clauses from the SQF checklist - the clause-by-clause System Elements and Module 11 tabs of the site's SQF gap assessment workbook - so that every requirement in those sections is covered (SQF 2.5.4.1 i).",
  "• Before starting, the auditor reads the findings from the last audit of those sections and the CAPAs that closed them, and checks during the audit that those actions have held.",
  "• For each sub-section - for example 2.4.3 Food Safety Plan - the auditor reads the requirement and what the site's documents say, then checks what actually happens: the records, the work on the floor, and the answers of the person who does it.",
  "• Each sub-section is one line on FRM-010, with the result and the objective evidence seen: which record (form number and date or lot), which document, what was observed, who was asked. A line marked Compliant with no evidence is not an audit result (SQF 2.5.4.1 ii).",
  "• A non-conformance gets its own line against the exact clause, with the evidence that shows it. Minor: a gap that is not likely to lead to unsafe food. Major: a gap that is likely to, or a requirement that is not being done at all.",
  "• A requirement that does not apply to the site is marked Not applicable with the reason - for example 11.5.4, no ice is used (FSQM-013).",
  "• If the auditor finds product at risk, it is dealt with at once - held under FSQM-018 - and not left for the report.",
  "Corrective and preventive action",
  "• Every non-conformance is raised on FRM-007 with the source 'Internal audit' within five working days of the audit, and the FRM-007 number is written on its FRM-010 line (SQF 2.5.4.1 iii, 2.5.4.4).",
  "• The CAPA is handled under FSQM-009: cause, correction, preventive action, owner, due date and a check that it worked. A major non-conformance is corrected within 14 days and a minor one within 30 days, the periods a certification audit allows. Where the full action takes longer, a temporary control is put in place and the plan is written on FRM-007.",
  "• Where a correction changes a document or the way the site makes safe food, the affected parts of the SQF System are reviewed as FSQM-009 requires (SQF 2.5.4.4).",
  "• The next audit of that section checks that the action has held.",
  "Reporting the results",
  "• The Internal Auditor signs FRM-010 and gives the results to the SQF Practitioner within five working days of the audit. The SQF Practitioner reviews the evidence and the results, and signs the entry to confirm the review and that site management has received the results and the CAPAs raised (SQF 2.5.4.1 iv).",
  "• The results are told to the staff responsible for carrying out and verifying each corrective action, and FRM-010 records who was told and when (SQF 2.5.4.1 iv).",
  "• The year's audit results are an input to the annual management review on FRM-001 under FSQM-005.",
  "Records",
  "• FRM-010 entries, the FRM-007 CAPAs raised from them, the Internal Auditor's course certificate and the second auditor's training on FRM-952 are kept for at least two years, as SOP-2.2.3 requires (SQF 2.5.4.4)."
 ],
 "definitions": "Internal audit: a planned check, by the site's own people, that the site does what its SQF System documents say and that this meets the Code.\nSQF checklist: every clause of the Code, listed one by one. The site uses the System Elements and Module 11 tabs of its SQF gap assessment workbook.\nObjective evidence: what the auditor actually saw - a record, a document, the work on the floor, or the answer of the person doing it.\nNon-conformance: a requirement the site does not meet. Minor - not likely to lead to unsafe food. Major - likely to lead to unsafe food, or a requirement not being done at all.\nIndependent: the auditor does not carry out, day to day, the work being audited.",
 "responsibility": "Senior Site Management - approves this program; appoints the Internal Auditor; receives every audit's results; makes sure the corrective actions are resourced.\nInternal Auditor - carries out every audit, records the evidence on FRM-010 and signs it; takes no part in the day-to-day running of the site; trains the SQF Practitioner as second auditor.\nSQF Practitioner - owns this program and keeps the audit plan on schedule; as second auditor, reviews every audit and signs FRM-010; audits the part of 2.2 that concerns the Team Portal application; makes sure every non-conformance is raised on FRM-007 and closed.\nAction owners - carry out the corrective and preventive actions assigned to them on FRM-007.\nAll staff - answer the auditor's questions and show them the records and the work.",
 "form_references": "FRM-010 - Internal Audit Record\nFRM-007 - Corrective & Preventive Action (CAPA) Report\nFRM-952 - Training Competency Verification Record\nFRM-001 - Management Review",
 "revision_history": "New - 2026-09-30 - DRAFT under D-19, for the two Minor findings against 2.5.4.1 and 2.5.4.2 ('Adventure Bakery has not developed or implemented an Internal Audit Program').\n\nDECISIONS (2026-09-30): the audit is spread over the year, by quarter, rather than done in one sitting; findings are recorded in the Team Portal on FRM-010, one line per sub-section with its evidence, and non-conformances go to FRM-007.\n\nISSUED 2026-10-01. The three items the draft listed to confirm are settled, and one of them changes the draft. (1) WHO AUDITS. The draft had the SQF Practitioner and Senior Site Management each audit what the other runs. It is replaced: every section is audited by one Internal Auditor who takes no part in running the site, and the SQF Practitioner reviews each audit as second auditor. That is more independent than the cross-audit, not less. The Internal Auditor's one responsibility is the Team Portal application, so the part of 2.2 that concerns it is audited by the SQF Practitioner instead. (2) TRAINING. The Internal Auditor holds no internal audit qualification at issue and completes a recognised internal auditor course BEFORE the first audit; no audit is carried out until then. The Internal Auditor then trains the second auditor, recorded on FRM-952. (3) CERTIFICATION AUDIT. Not yet booked; the site is working toward the second quarter of 2027, so the first cycle is brought forward to cover the whole Code by 31 March 2027.\n\nThe 'internal_audit' row on the verification schedule (FSQM-017 Part 6) is active from issue against FRM-010, every quarter. The first quarterly audit is Q4 2026 (11.5, 11.6, 11.7), first raised on 1 December 2026.",
 "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 - 2.5.4.1 and 2.5.4.2 (Internal Audits), 2.5.4.4 (records and CAPA from internal audits).\n\nFSQM-009 CAPA Program - corrective and preventive action.\nFSQM-017 Validation and Verification Program - the verification schedule.\nFSQM-012 GMP Program and FRM-913 - the regular GMP inspections (2.5.4.3).\nFSQM-005 Management Review.\nFSQM-004 Organizational Structure and Responsibilities - the site positions named here. The Internal Auditor is appointed under this program and is not a site position.\nSOP-2.2.3 Document and Record Control Program - retention."
}
$q038$::jsonb,
       status = 'active', approved_by = 'GJM', effective_date = date '2026-10-01'
 where sop_number = 'FSQM-038' and status = 'draft';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', $q010$
{
 "sections": [
  {
   "id": "audit",
   "title": "1. The audit",
   "fields": [
    {
     "id": "how_this_works",
     "text": "One entry per quarterly audit. Tick the sections being audited: each opens a guide to the Code's sub-sections and the site documents and records that cover them - open a document to read what it says, then check the records and the floor. Write one line per sub-section with the evidence you saw (\"Add to findings\" puts the lines in for you). A non-conformance gets its own line against the exact clause and goes on FRM-007.",
     "type": "info",
     "label": "How to fill this in"
    },
    {
     "id": "audit_plan",
     "rows": [
      [
       "Q1 (January to March)",
       "2.1 Management commitment; 2.2 Document control and records; 2.3 Specifications and supplier approval; 2.9 Training; 11.8 Waste disposal"
      ],
      [
       "Q2 (April to June)",
       "2.4 Food safety system; 2.8 Allergen management; 11.3 Personnel hygiene and welfare; 11.4 Personnel processing practices"
      ],
      [
       "Q3 (July to September)",
       "2.5 SQF System verification; 2.6 Traceability, withdrawal, recall and crisis; 2.7 Food defense and food fraud; 11.1 Site location and premises; 11.2 Site operation - maintenance, calibration, pest prevention, cleaning"
      ],
      [
       "Q4 (October to December)",
       "11.5 Water, ice and air; 11.6 Receipt, storage and transport; 11.7 Separation of functions and foreign matter"
      ],
      [
       "First cycle",
       "Q4 2026: the Q4 sections. By 31 March 2027: every other section, so the whole Code is audited before the first certification audit."
      ],
      [
       "Who audits",
       "The Internal Auditor audits every section. The SQF Practitioner audits the part of 2.2 that concerns the Team Portal application, and reviews every audit as second auditor."
      ]
     ],
     "type": "reference_table",
     "label": "Audit plan (FSQM-038)",
     "columns": [
      "Quarter",
      "Sections"
     ]
    },
    {
     "id": "audit_year",
     "type": "text",
     "label": "Year",
     "width": "third",
     "required": true,
     "showInList": true
    },
    {
     "id": "quarter",
     "type": "select",
     "label": "Quarter",
     "width": "third",
     "options": [
      "Q1 (January to March)",
      "Q2 (April to June)",
      "Q3 (July to September)",
      "Q4 (October to December)"
     ],
     "required": true,
     "showInList": true
    },
    {
     "id": "audit_date",
     "help": "The first day, if it ran over several days",
     "type": "date",
     "label": "Audit date",
     "width": "third",
     "required": true,
     "showInList": true
    },
    {
     "id": "sections",
     "help": "Tick a section to see what the Code asks in it, the site documents and records that cover it, and to add its sub-sections to Findings.",
     "type": "select",
     "label": "Sections audited",
     "options": [
      "2.1 Management commitment",
      "2.2 Document control and records",
      "2.3 Specifications and supplier approval",
      "2.9 Training",
      "11.8 Waste disposal",
      "2.4 Food safety system",
      "2.8 Allergen management",
      "11.3 Personnel hygiene and welfare",
      "11.4 Personnel processing practices",
      "2.5 SQF System verification",
      "2.6 Traceability, withdrawal, recall and crisis",
      "2.7 Food defense and food fraud",
      "11.1 Site location and premises",
      "11.2 Site operation - maintenance, calibration, pest prevention, cleaning",
      "11.5 Water, ice and air",
      "11.6 Receipt, storage and transport",
      "11.7 Separation of functions and foreign matter"
     ],
     "multiple": true,
     "required": true,
     "auditGuide": {
      "clauseColumn": "clause",
      "findingsGrid": "findings"
     }
    },
    {
     "id": "plan_change",
     "help": "Only if this audit is not the plan above: which sections were moved or carried over from a missed quarter, and why. Moving a section needs Senior Site Management's approval.",
     "type": "textarea",
     "label": "Sections moved or carried over"
    },
    {
     "id": "independence",
     "type": "select",
     "label": "Independence",
     "options": [
      "The auditor takes no part in the audited work",
      "Part of this audit concerned the auditor's own work - listed below, audited by the other auditor"
     ],
     "required": true
    },
    {
     "id": "independence_note",
     "type": "textarea",
     "label": "Audited work the auditor did themselves"
    }
   ]
  },
  {
   "id": "findings_section",
   "title": "2. Findings",
   "fields": [
    {
     "id": "findings",
     "help": "One line per sub-section audited. Evidence = the record (form and date or lot), document, observation or person asked. Not applicable needs the reason. Open a line to use \"Draft from records\": it summarises the last twelve months of the forms that cover the clause - check it, then add what you saw on the floor.",
     "rows": {
      "min": 1,
      "mode": "dynamic",
      "addLabel": "Add sub-section"
     },
     "type": "grid",
     "label": "Findings",
     "columns": [
      {
       "id": "clause",
       "type": "text",
       "label": "Clause",
       "width": 1,
       "required": true,
       "scanFact": "none"
      },
      {
       "id": "result",
       "type": "select",
       "label": "Result",
       "width": 1.3,
       "options": [
        "Compliant",
        "Minor non-conformance",
        "Major non-conformance",
        "Not applicable"
       ],
       "required": true
      },
      {
       "id": "evidence",
       "type": "text",
       "label": "Objective evidence seen",
       "width": 3.5,
       "aiDraft": "audit_evidence",
       "required": true,
       "scanFact": "none"
      },
      {
       "id": "capa_no",
       "type": "text",
       "label": "FRM-007 no.",
       "width": 1,
       "scanFact": "none"
      }
     ],
     "required": true,
     "rowDialog": true
    }
   ]
  },
  {
   "id": "follow_up",
   "title": "3. Results and follow-up",
   "fields": [
    {
     "id": "summary",
     "type": "textarea",
     "label": "Summary of the results",
     "required": true
    },
    {
     "id": "capa_raised",
     "type": "select",
     "label": "Corrective action",
     "options": [
      "No non-conformances found",
      "Every non-conformance is raised on FRM-007 - numbers in the table"
     ],
     "required": true
    },
    {
     "id": "communicated_to",
     "help": "Who was told - the staff who will carry out and verify each action - and when",
     "type": "textarea",
     "label": "Results told to",
     "required": true
    }
   ]
  },
  {
   "id": "sign",
   "title": "4. Sign-off",
   "fields": [
    {
     "id": "auditor",
     "role": "filler",
     "type": "signature",
     "label": "Auditor",
     "required": true,
     "statement": "I audited the sections above. The results and the evidence recorded are what I found."
    },
    {
     "id": "received_by",
     "role": "verifier",
     "type": "signature",
     "label": "Reviewed by the second auditor (SQF Practitioner)",
     "required": true,
     "statement": "I have reviewed the evidence and the results of this audit, and site management has received the results and the corrective actions raised from them."
    }
   ]
  }
 ],
 "settings": {
  "attachmentsEnabled": true,
  "allowMultipleDrafts": true,
  "requireVerification": true,
  "instanceTitleTemplate": "{audit_year} {quarter} internal audit"
 },
 "schemaVersion": 1
}
$q010$::jsonb),
       status = 'active', approved_by = 'GJM', effective_date = date '2026-10-01'
 where sop_number = 'FRM-010' and status = 'draft';

update public.verification_schedule
   set status = 'active',
       frequency_unit = 'quarter',
       frequency_count = 1,
       evidence_kind = 'form_entry',
       evidence_document_number = 'FRM-010',
       owning_program = 'FSQM-038',
       pending_deliverable = null,
       description = 'One quarterly audit of the sections in the FSQM-038 audit plan, carried out by the Internal Auditor and reviewed by the SQF Practitioner. The whole Code is covered every year.',
       first_due_on = date '2026-12-01'
 where activity_key = 'internal_audit' and status = 'planned';

update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(content,
                   '{procedure,60}', to_jsonb($t$• Internal audit of the SQF System — Quarterly — SQF Practitioner — FRM-010$t$::text)),
                   '{form_references}', to_jsonb((content->>'form_references') || $t$; FRM-010 Internal Audit Record$t$)),
                   '{revision_history}', to_jsonb((content->>'revision_history') || $t$

v11 — 2026-10-01 — Internal audit brought into force under D-19. FSQM-038 Internal Audit Program and FRM-010 Internal Audit Record are issued, so the internal audit in Part 6 moves from NOT YET IMPLEMENTED to active: quarterly, evidenced by FRM-010. The SQF Practitioner keeps the audit plan on schedule; the audits themselves are carried out by the Internal Auditor appointed under FSQM-038. First raised 2026-12-01 for the Q4 2026 audit. Nothing else in the schedule changes.$t$)),
       revision = 'v11', effective_date = date '2026-10-01', approved_by = 'GJM'
 where sop_number = 'FSQM-017' and status = 'active' and revision = 'v10';

do $verify$
declare n int; v record; l text; p jsonb; fs jsonb; txt text;
begin
  select count(*) into n from public.sop_documents
   where sop_number in ('FSQM-038', 'FRM-010') and status = 'active' and approved_by = 'GJM'
     and effective_date = date '2026-10-01' and revision = 'New';
  if n <> 2 then raise exception 'FSQM-038 / FRM-010 did not both issue.'; end if;

  select content->'procedure', content::text into p, txt from public.sop_documents where sop_number = 'FSQM-038';
  if jsonb_array_length(p) <> 35 then
    raise exception 'FSQM-038 procedure is % lines, expected 35.', jsonb_array_length(p);
  end if;
  if (select count(*) from unnest(array['2.5.4.1 i', '2.5.4.1 ii', '2.5.4.1 iii', '2.5.4.1 iv', '2.5.4.2', '2.5.4.4']) c
       where p::text like '%' || c || '%') <> 6 then
    raise exception 'FSQM-038 no longer cites every limb of 2.5.4.1, 2.5.4.2 and 2.5.4.4.';
  end if;
  if txt ~* 'Diana|Gabriela|Christina|GJM|Mercer|Richard' then
    raise exception 'FSQM-038 names a person; controlled documents name positions.';
  end if;
  if txt like '%TO CONFIRM BEFORE ISSUE%' or p::text like '%whichever of the SQF Practitioner and Senior Site Management%' then
    raise exception 'FSQM-038 still carries the draft''s open items or the cross-audit.';
  end if;
  if txt not like '%completes a recognised internal auditor course before carrying out the first audit%'
     or txt not like '%ISSUED 2026-10-01%' or txt not like '%31 March 2027%' then
    raise exception 'FSQM-038 is missing the training condition, the issue stamp or the first cycle.';
  end if;
  if txt like '%' || chr(13) || '%' then raise exception 'FSQM-038 contains a carriage return.'; end if;

  select content->'form_schema' into fs from public.sop_documents where sop_number = 'FRM-010';
  if (select count(*) from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
       where f->>'id' in ('quarter', 'sections', 'findings', 'communicated_to', 'auditor', 'received_by', 'independence', 'audit_plan')) <> 8 then
    raise exception 'FRM-010 is missing a field.';
  end if;
  if (select jsonb_array_length(f->'options') from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
       where f->>'id' = 'sections') <> 17 then
    raise exception 'FRM-010 does not list all 17 Code sections.';
  end if;
  if fs::text like '%Received by Senior Site Management%' or fs::text like '%reviewed by Senior Site Management%'
     or fs::text like '%who audits them%' then
    raise exception 'FRM-010 still describes the cross-audit with Senior Site Management.';
  end if;
  if (select f->>'role' from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
       where f->>'id' = 'received_by') is distinct from 'verifier' then
    raise exception 'FRM-010 second signature is no longer a verifier signature.';
  end if;

  select * into v from public.verification_schedule where activity_key = 'internal_audit';
  if (v.status, v.frequency_unit, v.frequency_count, v.evidence_kind, v.evidence_document_number, v.owning_program)
     is distinct from ('active', 'quarter', 1, 'form_entry', 'FRM-010', 'FSQM-038')
     or v.pending_deliverable is not null or v.first_due_on <> date '2026-12-01' then
    raise exception 'internal_audit not activated correctly.';
  end if;

  select content->'procedure'->>60 into l from public.sop_documents where sop_number = 'FSQM-017' and revision = 'v11';
  if l is null or l not like '%Quarterly%FRM-010' or l like '%NOT YET IMPLEMENTED%' then
    raise exception 'FSQM-017 Part 6 internal audit line not updated: %', l;
  end if;
  if (select count(*) from public.sop_documents, jsonb_array_elements_text(content->'procedure') x
       where sop_number = 'FSQM-017' and x like '%awaiting D-19%') <> 0 then
    raise exception 'FSQM-017 still says the internal audit awaits D-19.';
  end if;
  if (select jsonb_array_length(content->'procedure') from public.sop_documents where sop_number = 'FSQM-017')
     <> 76 then
    raise exception 'FSQM-017 procedure length changed.';
  end if;
end $verify$;

commit;
