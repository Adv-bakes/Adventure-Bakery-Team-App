-- D-13 tasks 13.4 and 13.5, together: FRM-913 is created and FSQM-022 is rewritten to
-- reference it, in ONE transaction.
--
-- THEY SHIP TOGETHER BECAUSE 13.4 CANNOT HONESTLY CLOSE WITHOUT 13.5. FSQM-022 revision 1 required
-- findings to be recorded on "Form-0010 Food Safety Inspection", a form that was never built. That
-- broken reference IS the gap assessment's finding against this document. Amending the procedure to
-- point at a form 13.5 had not yet produced would have reproduced the same defect with a fresher
-- number on it, so the form is created in the same transaction that starts referencing it.
--
-- FRM-913'S 34 CHECKLIST ROWS ARE GENERATED, NOT TYPED. Module 11 is 175 clauses - unusable as 175
-- checklist rows, and a paraphrase of them would drift from the code the first time SQF renumbers.
-- The rows are built from src/lib/sqfFoodClauses.ts, one per Module 11 SUBSECTION, each carrying the
-- real SQF heading and the clause range it covers (e.g. "11.2.5 Cleaning and Sanitation
-- (11.2.5.1-.9)"). That is what makes one completed inspection the evidence for the roughly eighty
-- Module 11 clauses the gap assessment marks "must be assessed through onsite observation": an
-- auditor can read a row and find the clauses behind it.
--
-- The eight section names were anchored to the clause text in the code PDF, not guessed. An earlier
-- guess had 11.8 as "Laboratory Testing Facilities"; it is Waste Disposal.
--
-- N/A IS A QUESTION, NOT AN ESCAPE HATCH. Every row is Pass, Fail or N/A, a blank is not a Pass, and
-- N/A requires a written reason - because 2.4.2.1 permits exempting a Module 11 requirement only on
-- a documented risk analysis, and those N/A rows with their reasons are what task 13.6 builds that
-- analysis from. The form collects the input rather than leaving somebody to reconstruct it later.
--
-- WHAT ELSE WAS WRONG WITH FSQM-022. Revision 1 listed ten inspection topics - storage practices,
-- sanitation, utensils, equipment, structures, grounds, pest, allergen, chemical, food security.
-- All real, none of them Module 11, and an inspection built on them leaves the rest of the module
-- unexamined. Four body sections (Definitions, Records, Governing Reference, Revision History) were
-- empty. And a "REFERENCED DOCUMENTS" list was mashed into the end of Responsibility, left over from
-- the Word import; it moves to Governing Reference.
--
-- BOTH STAY DRAFT. FSQM-022 issues with the other FSQM documents under INT-7. FRM-913 is seeded
-- draft so the two are approved together - issuing a program whose record is still unapproved would
-- be a softer version of the problem this fixes.
--
-- FRM-913, not FRM-904. 904 is unoccupied but was historically the GMP Daily Operation Check, and
-- reusing a retired number in a register an auditor reads is how two records end up with one id.
--
-- Guarded: asserts FSQM-022 is the draft revision 1 still carrying the Form-0010 reference, and that
-- FRM-913 does not already exist.

begin;

do $$
declare
  st  text;
  rev text;
  f10 boolean;
begin
  select status, revision, content::text like '%Form-0010%'
    into st, rev, f10
    from public.sop_documents where sop_number = 'FSQM-022';

  if st is null then
    raise exception 'FSQM-022 does not exist.';
  end if;
  if st <> 'draft' or rev is distinct from '1' then
    raise exception 'FSQM-022 is % at revision % - this migration rewrites the draft revision 1. Re-derive against the current row.', st, rev;
  end if;
  if not f10 then
    raise exception 'FSQM-022 no longer references Form-0010 - it has already been amended.';
  end if;
  if exists (select 1 from public.sop_documents where sop_number = 'FRM-913') then
    raise exception 'FRM-913 already exists.';
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FRM-913',
  'GMP / Food Safety Inspection Record',
  'form',
  'Module 11',
  'draft',
  'New',
  '2.4.2.1, 2.4.2.2, 2.5.4.3, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8',
  true,
  jsonb_build_object('form_schema', $j913$
{
  "sections": [
    {
      "id": "details",
      "title": "Inspection",
      "fields": [
        {
          "id": "inspection_date",
          "type": "date",
          "label": "Date",
          "width": "third",
          "required": true,
          "showInList": true,
          "defaultToday": true
        },
        {
          "id": "inspection_type",
          "type": "select",
          "label": "Type",
          "width": "third",
          "options": [
            "Routine (monthly)",
            "Follow-up",
            "Pre-audit",
            "Other"
          ],
          "required": true,
          "showInList": true
        },
        {
          "id": "areas_covered",
          "type": "text",
          "label": "Areas covered",
          "width": "third",
          "showInList": true
        },
        {
          "id": "inspectors",
          "type": "text",
          "label": "Inspection team",
          "help": "Quality Team members present, and any hourly employee accompanying the inspection",
          "width": "full"
        }
      ]
    },
    {
      "id": "how_to",
      "title": "How to use this form",
      "fields": [
        {
          "id": "how_to_note",
          "type": "info",
          "label": "How to use this form",
          "text": "One row per SQF Module 11 subsection, with the clause range it covers. Walk the site and mark each row Pass, Fail, or N/A.\n\nPass — observed and conforming. Fail — record what was seen in Finding, and the correction, who owns it and by when in Corrective action. N/A — the subsection does not apply to this site; say WHY in the Finding column, because 2.4.2.1 permits exempting a Module 11 requirement only on a written risk analysis, and these N/A rows with their reasons are what that analysis is built from.\n\nA blank row is not the same as a Pass. Every row is answered before the inspection is signed off."
        }
      ]
    },
    {
      "id": "sec_11_1",
      "title": "11.1 Site Location and Premises",
      "fields": [
        {
          "id": "check_11_1",
          "type": "grid",
          "label": "11.1 Site Location and Premises",
          "columns": [
            {
              "id": "conforms",
              "type": "pass_fail",
              "label": "Conforms",
              "width": 1,
              "required": true
            },
            {
              "id": "finding",
              "type": "text",
              "label": "Finding / observation",
              "width": 3
            },
            {
              "id": "action",
              "type": "text",
              "label": "Corrective action, owner & due date",
              "width": 3
            }
          ],
          "rows": {
            "mode": "fixed",
            "labels": [
              "11.1.1 Premises Location and Approval  (11.1.1.1)",
              "11.1.2 Building Materials  (11.1.2.1–.9)",
              "11.1.3 Lighting and Light Fittings  (11.1.3.1–.3)",
              "11.1.4 Inspection/Quality Control Area  (11.1.4.1)",
              "11.1.5 Dust, Insect, and Pest Proofing  (11.1.5.1–.3)",
              "11.1.6 Ventilation  (11.1.6.1–.4)",
              "11.1.7 Equipment and Utensils  (11.1.7.1–.9)",
              "11.1.8 Grounds and Roadways  (11.1.8.1–.3)"
            ],
            "addLabel": "Add item",
            "deletable": true,
            "labelHeader": "Module 11 subsection"
          }
        }
      ]
    },
    {
      "id": "sec_11_2",
      "title": "11.2 Site Operation",
      "fields": [
        {
          "id": "check_11_2",
          "type": "grid",
          "label": "11.2 Site Operation",
          "columns": [
            {
              "id": "conforms",
              "type": "pass_fail",
              "label": "Conforms",
              "width": 1,
              "required": true
            },
            {
              "id": "finding",
              "type": "text",
              "label": "Finding / observation",
              "width": 3
            },
            {
              "id": "action",
              "type": "text",
              "label": "Corrective action, owner & due date",
              "width": 3
            }
          ],
          "rows": {
            "mode": "fixed",
            "labels": [
              "11.2.1 Repairs and Maintenance  (11.2.1.1–.8)",
              "11.2.2 Maintenance Staff and Contractors  (11.2.2.1–.3)",
              "11.2.3 Calibration  (11.2.3.1–.6)",
              "11.2.4 Pest Prevention  (11.2.4.1–.6)",
              "11.2.5 Cleaning and Sanitation  (11.2.5.1–.9)"
            ],
            "addLabel": "Add item",
            "deletable": true,
            "labelHeader": "Module 11 subsection"
          }
        }
      ]
    },
    {
      "id": "sec_11_3",
      "title": "11.3 Personnel Hygiene and Welfare",
      "fields": [
        {
          "id": "check_11_3",
          "type": "grid",
          "label": "11.3 Personnel Hygiene and Welfare",
          "columns": [
            {
              "id": "conforms",
              "type": "pass_fail",
              "label": "Conforms",
              "width": 1,
              "required": true
            },
            {
              "id": "finding",
              "type": "text",
              "label": "Finding / observation",
              "width": 3
            },
            {
              "id": "action",
              "type": "text",
              "label": "Corrective action, owner & due date",
              "width": 3
            }
          ],
          "rows": {
            "mode": "fixed",
            "labels": [
              "11.3.1 Personnel Welfare  (11.3.1.1–.2)",
              "11.3.2 Handwashing  (11.3.2.1–.6)",
              "11.3.3 Clothing and Personal Effects  (11.3.3.1–.8)",
              "11.3.4 Visitors  (11.3.4.1–.4)",
              "11.3.5 Staff Amenities (change rooms, toilets, break rooms)  (11.3.5.1–.10)"
            ],
            "addLabel": "Add item",
            "deletable": true,
            "labelHeader": "Module 11 subsection"
          }
        }
      ]
    },
    {
      "id": "sec_11_4",
      "title": "11.4 Personnel Processing Practices",
      "fields": [
        {
          "id": "check_11_4",
          "type": "grid",
          "label": "11.4 Personnel Processing Practices",
          "columns": [
            {
              "id": "conforms",
              "type": "pass_fail",
              "label": "Conforms",
              "width": 1,
              "required": true
            },
            {
              "id": "finding",
              "type": "text",
              "label": "Finding / observation",
              "width": 3
            },
            {
              "id": "action",
              "type": "text",
              "label": "Corrective action, owner & due date",
              "width": 3
            }
          ],
          "rows": {
            "mode": "fixed",
            "labels": [
              "11.4.1 Staff Engaged in Food Handling and Processing Operations  (11.4.1.1–.4)"
            ],
            "addLabel": "Add item",
            "deletable": true,
            "labelHeader": "Module 11 subsection"
          }
        }
      ]
    },
    {
      "id": "sec_11_5",
      "title": "11.5 Water, Ice, and Air Supply",
      "fields": [
        {
          "id": "check_11_5",
          "type": "grid",
          "label": "11.5 Water, Ice, and Air Supply",
          "columns": [
            {
              "id": "conforms",
              "type": "pass_fail",
              "label": "Conforms",
              "width": 1,
              "required": true
            },
            {
              "id": "finding",
              "type": "text",
              "label": "Finding / observation",
              "width": 3
            },
            {
              "id": "action",
              "type": "text",
              "label": "Corrective action, owner & due date",
              "width": 3
            }
          ],
          "rows": {
            "mode": "fixed",
            "labels": [
              "11.5.1 Water Supply  (11.5.1.1–.6)",
              "11.5.2 Water Treatment  (11.5.2.1–.3)",
              "11.5.3 Water Quality  (11.5.3.1–.3)",
              "11.5.4 Ice Supply  (11.5.4.1–.3)",
              "11.5.5 Air and Other Gases  (11.5.5.1–.2)"
            ],
            "addLabel": "Add item",
            "deletable": true,
            "labelHeader": "Module 11 subsection"
          }
        }
      ]
    },
    {
      "id": "sec_11_6",
      "title": "11.6 Receipt, Storage, and Transport",
      "fields": [
        {
          "id": "check_11_6",
          "type": "grid",
          "label": "11.6 Receipt, Storage, and Transport",
          "columns": [
            {
              "id": "conforms",
              "type": "pass_fail",
              "label": "Conforms",
              "width": 1,
              "required": true
            },
            {
              "id": "finding",
              "type": "text",
              "label": "Finding / observation",
              "width": 3
            },
            {
              "id": "action",
              "type": "text",
              "label": "Corrective action, owner & due date",
              "width": 3
            }
          ],
          "rows": {
            "mode": "fixed",
            "labels": [
              "11.6.1 Receipt, Storage, and Handling of Goods  (11.6.1.1–.6)",
              "11.6.2 Cold Storage, Freezing, and Chilling of Foods  (11.6.2.1–.4)",
              "11.6.3 Storage of Dry Ingredients, Packaging, and Shelf Stable Packaged Goods  (11.6.3.1–.2)",
              "11.6.4 Storage of Hazardous Chemicals and Toxic Substances  (11.6.4.1–.7)",
              "11.6.5 Loading, Transport, and Unloading Practices  (11.6.5.1–.8)"
            ],
            "addLabel": "Add item",
            "deletable": true,
            "labelHeader": "Module 11 subsection"
          }
        }
      ]
    },
    {
      "id": "sec_11_7",
      "title": "11.7 Separation of Functions",
      "fields": [
        {
          "id": "check_11_7",
          "type": "grid",
          "label": "11.7 Separation of Functions",
          "columns": [
            {
              "id": "conforms",
              "type": "pass_fail",
              "label": "Conforms",
              "width": 1,
              "required": true
            },
            {
              "id": "finding",
              "type": "text",
              "label": "Finding / observation",
              "width": 3
            },
            {
              "id": "action",
              "type": "text",
              "label": "Corrective action, owner & due date",
              "width": 3
            }
          ],
          "rows": {
            "mode": "fixed",
            "labels": [
              "11.7.1 High-Risk Processes  (11.7.1.1–.5)",
              "11.7.2 Thawing of Food  (11.7.2.1–.3)",
              "11.7.3 Control of Foreign Matter Contamination  (11.7.3.1–.9)",
              "11.7.4 Detection of Foreign Objects  (11.7.4.1–.5)"
            ],
            "addLabel": "Add item",
            "deletable": true,
            "labelHeader": "Module 11 subsection"
          }
        }
      ]
    },
    {
      "id": "sec_11_8",
      "title": "11.8 Waste Disposal",
      "fields": [
        {
          "id": "check_11_8",
          "type": "grid",
          "label": "11.8 Waste Disposal",
          "columns": [
            {
              "id": "conforms",
              "type": "pass_fail",
              "label": "Conforms",
              "width": 1,
              "required": true
            },
            {
              "id": "finding",
              "type": "text",
              "label": "Finding / observation",
              "width": 3
            },
            {
              "id": "action",
              "type": "text",
              "label": "Corrective action, owner & due date",
              "width": 3
            }
          ],
          "rows": {
            "mode": "fixed",
            "labels": [
              "11.8.1 Waste Disposal  (11.8.1.1–.10)"
            ],
            "addLabel": "Add item",
            "deletable": true,
            "labelHeader": "Module 11 subsection"
          }
        }
      ]
    },
    {
      "id": "summary",
      "title": "Findings & Sign-Off",
      "fields": [
        {
          "id": "findings_count",
          "type": "number",
          "label": "Number of findings raised",
          "width": "third",
          "showInList": true
        },
        {
          "id": "na_count",
          "type": "number",
          "label": "Rows marked N/A",
          "width": "third",
          "help": "These feed the Module 11 exemption analysis required by 2.4.2.1"
        },
        {
          "id": "repeat_findings",
          "type": "pass_fail",
          "label": "Any repeat findings from last inspection?",
          "width": "third"
        },
        {
          "id": "summary_notes",
          "type": "textarea",
          "label": "Summary, trends and anything referred to Maintenance",
          "width": "full"
        },
        {
          "id": "all_assigned",
          "type": "pass_fail",
          "label": "Every finding has a corrective action, an owner and a due date",
          "required": true,
          "width": "half"
        },
        {
          "id": "inspector_sig",
          "type": "signature",
          "label": "Inspection led by",
          "width": "half"
        },
        {
          "id": "management_sig",
          "type": "signature",
          "label": "Reviewed at management review",
          "width": "half"
        },
        {
          "id": "review_date",
          "type": "date",
          "label": "Management review date",
          "width": "half"
        }
      ]
    }
  ],
  "settings": {
    "attachmentsEnabled": true,
    "allowMultipleDrafts": true,
    "requireVerification": false,
    "instanceTitleTemplate": "{inspection_date} — GMP / Food Safety Inspection"
  }
}
$j913$::jsonb)
);

update public.sop_documents
   set content = $j022$
{
  "purpose": "To establish the Food Safety Monitoring Program — the planned inspections that verify the site's Good Manufacturing Practices and its facility and equipment maintenance comply with the SQF Food Safety Code: Food Manufacturing, FDA regulations and this site's own documented programs, and that findings are corrected and recorded.",
  "scope": "Applies to all manufacturing, packaging, storage and handling activities at the Adventure Bakery facility, and to the grounds and structures around them.\n\nCovers the two layers of verification the site operates: the daily pre-operation inspection under SOP-11.2.12, and the monthly full-site inspection against SQF Module 11 recorded on FRM-913.\n\nThe Good Manufacturing Practices this program verifies are documented in FSQM-012.",
  "definitions": "Finding — any observed departure from the code, this site's programs, or FDA requirements, whether or not it was corrected on the spot.\n\nCorrection — what is done to fix the thing observed. Corrective action — what is done so it does not happen again. 2.5.4.3 (i) asks for both, and a repeat finding is usually a correction that was never followed by a corrective action.\n\nN/A — a Module 11 subsection that does not apply to this site. It requires a written reason, because 2.4.2.1 permits exemption only on a documented risk analysis.",
  "responsibility": "Quality Team — carries out the monthly inspection, records findings on FRM-913, and raises employee-practice findings directly with the person involved.\nSQF Practitioner — owns this program, agrees corrective actions and their dates, and confirms findings are closed before the next inspection.\nMaintenance — notified of any deviation that cannot be corrected during the inspection, and responsible for correcting it by the agreed date.\nManagement team — reviews inspection results monthly and is responsible for the implementation and sustainability of this program.",
  "procedure": [
    "WHAT IS VERIFIED, AND HOW OFTEN (SQF 2.5.4.3)",
    "• **Monthly — a full site inspection** against SQF Module 11, carried out by members of the Quality Team and recorded on **FRM-913** (GMP / Food Safety Inspection Record). This is the planned inspection 2.5.4.3 requires.",
    "• **Every production day — a pre-operation inspection** under **SOP-11.2.12**, recorded on **FRM-903**. The two are not the same check and neither replaces the other: the daily confirms the line is fit to start and looks at the surfaces and equipment about to touch product; the monthly walks the whole site — grounds, structures, storage, pest control, waste — against the code.",
    "• **Additionally, whenever the site changes or is about to be judged:** after construction, a layout change or new equipment; before an external audit; and following any major finding, to confirm it stayed closed.",
    "WHAT THE MONTHLY INSPECTION COVERS",
    "• FRM-913 carries **one row for each of the 34 subsections of Module 11**, with the clause range it covers, so the inspection is traceable to the code rather than to a paraphrase of it. The eight sections are: 11.1 Site Location and Premises; 11.2 Site Operation; 11.3 Personnel Hygiene and Welfare; 11.4 Personnel Processing Practices; 11.5 Water, Ice and Air Supply; 11.6 Receipt, Storage and Transport; 11.7 Separation of Functions; 11.8 Waste Disposal.",
    "• That structure covers everything this site has always inspected — storage practices, sanitation, container and utensil usage, condition of processing equipment, interior structures, outside grounds, pest control, allergen control, chemical control and food security — and closes the gap where those ten headings left the rest of Module 11 unexamined.",
    "• Each row is marked **Pass, Fail or N/A**, and **a blank is not a Pass**. Every row is answered before the inspection is signed off.",
    "• **N/A requires a written reason on the form.** 2.4.2.1 permits exempting a Module 11 requirement only on a documented risk analysis, so the N/A rows and their reasons are the raw material for that analysis — not a way of skipping a question.",
    "• The Good Manufacturing Practices being verified are those documented in **FSQM-012** (Good Manufacturing Practices Program), which is the program Module 11.3 and 11.4 are audited against.",
    "WHO CARRIES IT OUT",
    "• Members of the **Quality Team**. Inspections may be conducted in the presence of an hourly employee for awareness purposes.",
    "• **Maintenance** is notified during the inspection of any deviation that cannot be corrected on the spot, and is responsible for correcting it by the agreed date.",
    "• The **SQF Practitioner** owns this program and confirms every finding has been closed before the next inspection.",
    "FINDINGS AND CORRECTIVE ACTION (SQF 2.5.4.3 i and ii)",
    "• Every finding is recorded on FRM-913 with what was observed, the correction or corrective action, **who owns it and by when**. A finding without an owner and a date is not an action.",
    "• **Correct on the spot where it can be corrected on the spot**, and record that too — a same-day fix is still a finding, and a form showing only unresolved items misrepresents how the site runs.",
    "• **Findings about employee practice are raised directly with the person involved** and used as a training opportunity in Food Safety training, as well as being recorded.",
    "• **Repeat findings are flagged as repeats.** A finding that recurs is telling you the correction addressed the instance and not the cause, and that distinction is what 2.5.4.3 means by corrective and preventative action.",
    "MANAGEMENT REVIEW",
    "• The management team reviews the inspection results monthly, together with procedural requirements, to confirm products continue to meet food safety and legality requirements. The reviewer signs FRM-913.",
    "RECORDS",
    "• Completed FRM-913 records, including all findings and the corrective actions taken, are retained per the record retention policy. 2.5.4.3 (ii) requires records of the inspections **and** of any corrective action — an inspection record with an empty action column against a failed row satisfies neither."
  ],
  "form_references": "FRM-913 — GMP / Food Safety Inspection Record (the monthly inspection)\nFRM-903 — Daily Sanitation, Pre-Operation & Release Record (the daily check)\nFRM-901 — Master Sanitation Schedule\nFSQM-012 — Good Manufacturing Practices Program (what is being verified)\nSOP-11.2.12 — GMP / Pre-Operation Inspection",
  "records": "Completed FRM-913 inspection records, with findings and the corrective actions taken, retained per the record retention policy.\nDaily pre-operation records on FRM-903, retained per the record retention policy.\nManagement review of inspection results is minuted with the monthly management review.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.5.4.3 (regular planned inspections of site and equipment to verify GMPs and maintenance, with corrections or corrective and preventative action, and records of both), 2.4.2.1 (Module 11 GMPs applied or exempted on a written risk analysis) and 2.4.2.2 (GMPs documented and implemented).\nSQF Food Safety Code: Food Manufacturing, Edition 9 — Module 11 in full, which is the structure of FRM-913.\nFDA 21 CFR Part 117 — Current Good Manufacturing Practice, Hazard Analysis, and Risk-Based Preventive Controls for Human Food.",
  "revision_history": "v2 — 2026-09-01 — Rewritten under D-13 task 13.4.\n\nTHE REASON THIS DOCUMENT WAS REOPENED: revision 1 required findings to be recorded on “Form-0010 Food Safety Inspection”, which had never been built. A program whose only record does not exist cannot be followed, and that broken reference was the gap assessment's finding against it. FRM-913 now exists, and this document references it.\n\nWHAT ELSE CHANGED. Revision 1 listed ten inspection topics — storage practices, sanitation, container and utensil usage, processing equipment, interior structures, outside grounds, pest control, allergen control, chemical control, food security. Those are all real, but they are not Module 11, and an inspection built on them leaves the rest of the module unexamined. The inspection is now structured by Module 11 subsection, which covers all ten and the remainder. Scope, frequency and responsibility are stated explicitly; the daily pre-operation check is distinguished from the monthly site inspection; corrections are separated from corrective actions; and Definitions, Records, Governing Reference and this Revision History, all previously empty, are filled.\n\nA drafting error is also corrected: revision 1's Responsibility section had a “REFERENCED DOCUMENTS” list mashed into the end of it, left over from the Word import. That content now sits in Governing Reference, where it belongs.\n\nSTATUS STAYS DRAFT. FSQM-022 issues with the other FSQM documents under INT-7, and FRM-913 is seeded draft so the two are approved together — issuing a program whose record is still unapproved would recreate a softer version of the problem this revision fixes.\n\nOPEN: the corrective-action half of this program has nowhere to live beyond FRM-913's own columns. D-07 (CAPA) is the object findings from any source should be raised into, and until it exists a finding closed on FRM-913 is tracked only on the form that raised it. Task 13.7, the first inspection, depends on it."
}
$j022$::jsonb,
       revision = 'v2',
       sqf_reference = '2.4.2.1, 2.4.2.2, 2.5.4.3'
 where sop_number = 'FSQM-022'
   and status = 'draft'
   and revision = '1';

do $$
declare
  r record;
  f record;
begin
  select status, revision, sqf_reference,
         jsonb_array_length(content->'procedure')                       as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s not like '• %')                              as steps,
         -- only the OPERATIVE text may not name it; revision_history quotes the removed
         -- reference on purpose, to say what was fixed and why
         ((content->'procedure')::text like '%Form-0010%'
           or content->>'form_references' like '%Form-0010%')             as dangling,
         content::text like '%FRM-913%'                                  as names_913,
         (select count(*) from unnest(array['purpose','scope','definitions','responsibility',
                                            'procedure','form_references','records',
                                            'governing_reference','revision_history']) k
           where content ? k and length(content->>k) > 0)                as filled
    into r
    from public.sop_documents where sop_number = 'FSQM-022';

  select status, type, revision,
         jsonb_array_length(content->'form_schema'->'sections')          as sections,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') sec,
                               jsonb_array_elements(sec->'fields') fl
           where fl->>'type' = 'grid')                                   as grids,
         (select coalesce(sum(jsonb_array_length(fl->'rows'->'labels')), 0)
            from jsonb_array_elements(content->'form_schema'->'sections') sec,
                 jsonb_array_elements(sec->'fields') fl
           where fl->>'type' = 'grid')                                   as rows_total,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') sec,
                               jsonb_array_elements(sec->'fields') fl
           where fl->>'type' = 'grid' and fl->'rows'->>'mode' = 'fixed') as fixed_grids
    into f
    from public.sop_documents where sop_number = 'FRM-913';

  if f.status is null then
    raise exception 'FRM-913 was not created.';
  end if;
  if f.status <> 'draft' or f.type <> 'form' or f.revision <> 'New' then
    raise exception 'FRM-913 created wrong: status=%, type=%, revision=%.', f.status, f.type, f.revision;
  end if;
  if f.grids <> 8 or f.fixed_grids <> 8 or f.rows_total <> 34 then
    raise exception 'FRM-913 checklist wrong: % grids (% fixed), % rows - expected 8 / 8 / 34.',
      f.grids, f.fixed_grids, f.rows_total;
  end if;
  if f.sections <> 11 then
    raise exception 'FRM-913 has % sections, expected 11.', f.sections;
  end if;

  if r.status <> 'draft' or r.revision <> 'v2' then
    raise exception 'FSQM-022 wrong after rewrite: status=%, revision=%.', r.status, r.revision;
  end if;
  if r.dangling then
    raise exception 'FSQM-022 still directs the reader to Form-0010 in its procedure or form references.';
  end if;
  if not r.names_913 then
    raise exception 'FSQM-022 does not reference FRM-913.';
  end if;
  if r.filled <> 9 then
    raise exception 'FSQM-022 has % of 9 body sections filled.', r.filled;
  end if;
  if r.lines <> 23 or r.steps <> 6 then
    raise exception 'FSQM-022 procedure wrong shape: % lines, % steps (expected 23 / 6).',
      r.lines, r.steps;
  end if;
end $$;

commit;
