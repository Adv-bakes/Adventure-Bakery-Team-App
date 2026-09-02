-- FRM-007 - Corrective & Preventive Action (CAPA) Report. D-07.
--
-- The record FSQM-009 runs on, and the thing 2.5.3.2 asks for: "records of all investigation, root
-- cause analysis, and resolution of non-conformities, their corrections, and the implementation of
-- preventative actions shall be maintained". One entry per CAPA, from any source.
--
-- NUMBER. FRM-007 is the first clean number in the 000-099 Food Safety System block, which
-- DOCUMENT_REGISTER.md already assigns to "HACCP plan, recall, complaints, internal audit, mgmt
-- review, doc control, CAPA". 001, 002 and 004 are live; 003 became REP-003. FRM-005 and FRM-006
-- exist ONLY as legacy_sop_number values on renumbered rows, so reusing either would collide with a
-- number that is still searchable in the register. Confirmed against the live register 2026-09-02.
--
-- CATEGORY IS "Module 2", matching FRM-001, FRM-002 and FRM-205 - 2.5.3 is a System Elements clause,
-- not a Module 11 one.
--
-- WHY EIGHT SECTIONS AND NOT ONE "ACTION TAKEN" BOX. The single most common way a CAPA form fails
-- an audit is by conflating correction, corrective action and preventive action into one field:
-- the instance gets fixed, the cause does not, and the finding repeats. Sections 3, 5 and 6 are
-- deliberately separate, in that order, and Section 7 exists because 2.5.3.1 requires actions to be
-- determined, implemented AND VERIFIED - a limb most sites drop.
--
-- SECTION 3 COMES BEFORE SECTION 4 ON PURPOSE. Containment is not part of the investigation and
-- must not wait for it. The released-product question in Section 2 is `required` so an entry cannot
-- be submitted without someone having answered it, and its help text says plainly that a Yes or an
-- Unknown invokes the recall procedure immediately.
--
-- FIVE WHYS IS A FIXED-ROW GRID, NOT A TEXTAREA. A textarea records the conclusion; the grid
-- records the reasoning, which is what makes a root cause auditable rather than asserted. The rows
-- carry rows.mode = "fixed" explicitly - the FRM-903 foot bath grid shipped without it and would
-- have rendered as a dynamic grid with no label column and no rows, a defect buildZodSchema passed
-- and only the print generator caught.
--
-- deletable IS FALSE. A closed CAPA is a food safety record. FSQM-009 Part 4 says an unnecessary
-- CAPA is closed with that reason recorded, never deleted, and the form enforces it.
--
-- THE SCHEMA WAS RUN THROUGH THE REAL APP MODULES BEFORE BEING WRITTEN HERE, not eyeballed:
-- buildZodSchema (an empty entry fails submit with 13 required-field issues; a filled one
-- passes), emptyValues, listFields, valueFields, flattenForReport, and instanceTitle on BOTH an
-- empty draft and a filled entry - a title template of pure field tokens renders as "()" on a draft
-- nobody has typed into yet, so the template leads with literal text.
--
-- Inserted as status='draft'; approved and activated with FSQM-009. Guarded on non-existence.

begin;

do $$
begin
  if exists (select 1 from public.sop_documents where sop_number = 'FRM-007') then
    raise exception 'FRM-007 already exists.';
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FRM-007',
  'Corrective & Preventive Action (CAPA) Report',
  'form',
  'Module 2',
  'draft',
  'New',
  '2.1.3.3, 2.5.3.1, 2.5.3.2, 2.5.4.4, 2.6.3.3',
  true,
  jsonb_build_object('form_schema', $j007$
{
  "settings": {
    "attachmentsEnabled": true,
    "allowMultipleDrafts": true,
    "requireVerification": true,
    "deletable": false,
    "instanceTitleTemplate": "Corrective action {capa_no} — {source}"
  },
  "sections": [
    {
      "id": "identification",
      "title": "1. Identification",
      "fields": [
        {
          "id": "threshold_info",
          "type": "info",
          "label": "When to open a CAPA",
          "text": "FSQM-009 Part 3. A CAPA is opened for: product already released or requiring hold, rework, downgrade or destruction; any critical-limit or CCP deviation; a critical complaint or one alleging illness, injury, foreign material or an undeclared allergen; any repeat within twelve months; any audit, certification body or regulatory finding; any inspection finding not corrected on the spot; any withdrawal or recall including a test; a presumptive positive or adverse environmental trend; a glass or brittle plastic breakage where product or a food-contact surface was exposed; or anything the SQF Practitioner judges to warrant one.\n\nA routine non-conformance corrected on the spot is recorded on the form that found it and does not open a CAPA. When in doubt, open one."
        },
        {
          "id": "capa_no",
          "type": "text",
          "label": "CAPA No.",
          "width": "third",
          "required": true,
          "showInList": true,
          "placeholder": "CAPA-2026-001",
          "help": "Year and next sequential number in that year. Numbers are never reused."
        },
        {
          "id": "date_raised",
          "type": "date",
          "label": "Date raised",
          "width": "third",
          "required": true,
          "showInList": true,
          "defaultToday": true
        },
        {
          "id": "raised_by",
          "type": "text",
          "label": "Raised by",
          "width": "third",
          "required": true
        },
        {
          "id": "source",
          "type": "select",
          "label": "Source",
          "width": "half",
          "options": [
            "Customer or consumer complaint",
            "Supplier non-conformance",
            "Non-conforming material or product",
            "Non-conforming equipment",
            "Critical limit / CCP deviation",
            "Internal audit",
            "External audit or regulatory inspection",
            "GMP or pre-operational inspection",
            "Environmental monitoring",
            "Glass or brittle plastic breakage",
            "Withdrawal or recall",
            "Other"
          ],
          "required": true,
          "showInList": true
        },
        {
          "id": "source_ref",
          "type": "text",
          "label": "Source record reference",
          "width": "half",
          "help": "The complaint no., SCAR no., hold tag no., inspection date or audit reference. Write this CAPA number back onto that record."
        },
        {
          "id": "severity",
          "type": "select",
          "label": "Severity",
          "width": "third",
          "options": [
            "Critical",
            "Major",
            "Minor"
          ],
          "required": true,
          "showInList": true
        },
        {
          "id": "capa_owner",
          "type": "text",
          "label": "CAPA owner",
          "width": "third",
          "required": true,
          "help": "The one person accountable for this CAPA reaching closure."
        },
        {
          "id": "target_close_date",
          "type": "date",
          "label": "Target closure date",
          "width": "third",
          "required": true
        },
        {
          "id": "is_repeat",
          "type": "checkbox",
          "width": "half",
          "label": "This is a repeat of an earlier non-conformance"
        },
        {
          "id": "repeat_of",
          "type": "text",
          "label": "Earlier CAPA no., if a repeat",
          "width": "half",
          "help": "A repeat means the earlier correction was never followed by a corrective action. Say so in the investigation."
        }
      ]
    },
    {
      "id": "what_happened",
      "title": "2. What happened",
      "fields": [
        {
          "id": "description",
          "type": "textarea",
          "label": "What was observed",
          "rows": 4,
          "width": "full",
          "required": true,
          "help": "What was seen, not what is assumed to have caused it."
        },
        {
          "id": "detected_when",
          "type": "datetime",
          "label": "Detected on",
          "width": "third"
        },
        {
          "id": "detected_where",
          "type": "text",
          "label": "Where / which line or area",
          "width": "third"
        },
        {
          "id": "detected_how",
          "type": "text",
          "label": "How it was detected",
          "width": "third"
        },
        {
          "id": "product_affected",
          "type": "text",
          "label": "Product affected",
          "width": "half"
        },
        {
          "id": "lots_affected",
          "type": "text",
          "label": "Lot / batch codes affected",
          "width": "half"
        },
        {
          "id": "qty_affected",
          "type": "text",
          "label": "Quantity affected",
          "width": "third"
        },
        {
          "id": "released_product",
          "type": "pass_fail",
          "width": "full",
          "required": true,
          "naAllowed": true,
          "label": "Product already released may be affected",
          "labels": {
            "pass": "Yes",
            "fail": "No",
            "na": "Unknown"
          },
          "help": "If Yes or Unknown, invoke the recall and withdrawal procedure now. It does not wait for this investigation to finish (FSQM-009 Part 4)."
        }
      ]
    },
    {
      "id": "containment",
      "title": "3. Immediate correction and containment",
      "fields": [
        {
          "id": "containment_info",
          "type": "info",
          "label": "Containment comes first",
          "text": "Before anything is analysed, make the product safe. Hold and tag affected material on FRM-702, stop the process where it is still running, and isolate the area or equipment. Record it here before starting the investigation."
        },
        {
          "id": "correction_taken",
          "type": "textarea",
          "label": "Correction taken (what was done now)",
          "rows": 3,
          "width": "full",
          "required": true
        },
        {
          "id": "product_held",
          "type": "pass_fail",
          "width": "half",
          "naAllowed": true,
          "label": "Affected product held / tagged on FRM-702",
          "labels": {
            "pass": "Yes",
            "fail": "No",
            "na": "N/A"
          }
        },
        {
          "id": "hold_tag_no",
          "type": "text",
          "label": "Hold tag no., if held",
          "width": "half"
        },
        {
          "id": "recall_invoked",
          "type": "pass_fail",
          "width": "half",
          "naAllowed": true,
          "label": "Recall / withdrawal procedure invoked",
          "labels": {
            "pass": "Yes",
            "fail": "No",
            "na": "N/A"
          }
        },
        {
          "id": "contained_by",
          "type": "text",
          "label": "Contained by",
          "width": "third"
        },
        {
          "id": "contained_at",
          "type": "datetime",
          "label": "Date / time contained",
          "width": "third"
        }
      ]
    },
    {
      "id": "investigation",
      "title": "4. Investigation and root cause",
      "fields": [
        {
          "id": "investigation_info",
          "type": "info",
          "label": "Getting to a real root cause",
          "text": "\"Operator error\" and \"training issue\" are not root causes — they are where an investigation stopped. If an operator made an error, ask why the process let that error reach product undetected.\n\nAnswer both questions: why the control failed, and why it was not detected sooner. The second is usually where the real corrective action lies."
        },
        {
          "id": "five_whys",
          "type": "grid",
          "label": "Five Whys",
          "columns": [
            {
              "id": "because",
              "label": "Because…",
              "type": "text",
              "width": 6
            }
          ],
          "rows": {
            "mode": "fixed",
            "labelHeader": "Step",
            "labels": [
              "Why 1",
              "Why 2",
              "Why 3",
              "Why 4",
              "Why 5"
            ]
          },
          "help": "Not every chain runs to five. Stop when you reach a cause the site can act on."
        },
        {
          "id": "other_method",
          "type": "textarea",
          "width": "full",
          "rows": 2,
          "label": "Other analysis used, if five whys was not adequate",
          "help": "A recurring failure, or one with several contributing causes, needs a cause-and-effect (fishbone) analysis. Attach it to this entry."
        },
        {
          "id": "root_cause",
          "type": "textarea",
          "label": "Root cause",
          "rows": 3,
          "width": "full",
          "required": true
        },
        {
          "id": "why_not_detected",
          "type": "textarea",
          "rows": 2,
          "width": "full",
          "label": "Why was it not detected sooner"
        },
        {
          "id": "investigated_by",
          "type": "text",
          "label": "Investigated by",
          "width": "half",
          "required": true,
          "help": "A person knowledgeable about the incident and, where practical, not the person whose work is under examination."
        },
        {
          "id": "investigation_date",
          "type": "date",
          "label": "Investigation completed",
          "width": "half"
        }
      ]
    },
    {
      "id": "corrective",
      "title": "5. Corrective action",
      "fields": [
        {
          "id": "corrective_info",
          "type": "info",
          "label": "Written against the cause",
          "text": "Corrective action is what is done so this does not happen again. It addresses the root cause above, not the symptom. Every action carries a named owner and a due date — an action without both is not an action."
        },
        {
          "id": "corrective_actions",
          "type": "grid",
          "label": "Corrective actions",
          "columns": [
            {
              "id": "action",
              "label": "Action",
              "type": "text",
              "required": true,
              "width": 5
            },
            {
              "id": "owner",
              "label": "Owner",
              "type": "text",
              "required": true,
              "width": 2
            },
            {
              "id": "due_date",
              "label": "Due",
              "type": "date",
              "required": true,
              "width": 2
            },
            {
              "id": "completed_date",
              "label": "Completed",
              "type": "date",
              "width": 2
            }
          ],
          "rows": {
            "mode": "dynamic",
            "min": 1,
            "addLabel": "Add corrective action"
          }
        }
      ]
    },
    {
      "id": "preventive",
      "title": "6. Preventive action",
      "fields": [
        {
          "id": "preventive_info",
          "type": "info",
          "label": "Where else could this happen",
          "text": "Preventive action asks where the same cause could produce a non-conformance that has not occurred yet — another line, another product, another shift, another supplier, another machine with the same failure mode. Where the answer is nowhere, record that as the answer."
        },
        {
          "id": "preventive_actions",
          "type": "grid",
          "label": "Preventive actions",
          "columns": [
            {
              "id": "action",
              "label": "Action",
              "type": "text",
              "width": 5
            },
            {
              "id": "owner",
              "label": "Owner",
              "type": "text",
              "width": 2
            },
            {
              "id": "due_date",
              "label": "Due",
              "type": "date",
              "width": 2
            },
            {
              "id": "completed_date",
              "label": "Completed",
              "type": "date",
              "width": 2
            }
          ],
          "rows": {
            "mode": "dynamic",
            "addLabel": "Add preventive action"
          }
        },
        {
          "id": "documents_updated",
          "type": "textarea",
          "rows": 2,
          "width": "full",
          "label": "Documents, programs or specifications changed",
          "help": "Name the document and the revision it moved to. The change is made under document control."
        },
        {
          "id": "training_required",
          "type": "textarea",
          "rows": 2,
          "width": "full",
          "label": "Training required, and who received it",
          "help": "Name the module. Assign it in the Team Portal."
        },
        {
          "id": "sqf_system_review",
          "type": "pass_fail",
          "width": "full",
          "naAllowed": true,
          "label": "This change affects the site's ability to deliver safe food, so the applicable aspects of the SQF System were reviewed (2.5.4.4)",
          "labels": {
            "pass": "Reviewed",
            "fail": "Not reviewed",
            "na": "Does not affect it"
          }
        }
      ]
    },
    {
      "id": "verification",
      "title": "7. Verification of effectiveness",
      "fields": [
        {
          "id": "verification_info",
          "type": "info",
          "label": "Doing the work is not verifying it",
          "text": "2.5.3.1 requires actions to be determined, implemented AND verified. A CAPA is not closed because the work was done; it is closed because someone checked that it worked.\n\nSet the method and the date when the action is agreed, not after it is finished. The date must be at least one full cycle of whatever failed — verifying a monthly check after one week proves nothing."
        },
        {
          "id": "verification_method",
          "type": "textarea",
          "rows": 2,
          "width": "full",
          "required": true,
          "label": "How effectiveness will be verified",
          "help": "Re-inspect at the next GMP inspection; review the next N records or batches; re-test; re-audit the clause; watch the complaint category for a quarter."
        },
        {
          "id": "verification_due",
          "type": "date",
          "label": "Verification due",
          "width": "half",
          "required": true
        },
        {
          "id": "verification_result",
          "type": "select",
          "label": "Result",
          "width": "half",
          "options": [
            "Effective — no further action",
            "Not effective — reopen the investigation"
          ]
        },
        {
          "id": "verification_findings",
          "type": "textarea",
          "rows": 3,
          "width": "full",
          "label": "What the verification found",
          "help": "If not effective, the CAPA is not closed. Either the root cause was wrong or the action was insufficient — the investigation resumes at Section 4 and this record of the failed verification stays."
        },
        {
          "id": "verified_by",
          "type": "signature",
          "label": "Verified by",
          "width": "half",
          "role": "verifier",
          "statement": "I have checked that the actions above were effective, by the method stated."
        },
        {
          "id": "verification_date",
          "type": "date",
          "label": "Date verified",
          "width": "half"
        }
      ]
    },
    {
      "id": "closure",
      "title": "8. Closure",
      "fields": [
        {
          "id": "closure_info",
          "type": "info",
          "label": "A CAPA closes only when all of these hold",
          "text": "The correction is done and recorded; the root cause is documented; every corrective and preventive action is complete; effectiveness has been verified and signed; any affected document, program or record has been updated; and the disposition of any affected product is resolved."
        },
        {
          "id": "all_actions_complete",
          "type": "pass_fail",
          "width": "half",
          "label": "All corrective and preventive actions complete"
        },
        {
          "id": "disposition_resolved",
          "type": "pass_fail",
          "width": "half",
          "naAllowed": true,
          "label": "Disposition of affected product resolved",
          "labels": {
            "pass": "Yes",
            "fail": "No",
            "na": "No product affected"
          }
        },
        {
          "id": "closure_summary",
          "type": "textarea",
          "rows": 3,
          "width": "full",
          "label": "Closure summary",
          "help": "Where a CAPA is closed because it was unnecessary, that reason is recorded here. CAPAs are never deleted."
        },
        {
          "id": "closed_by",
          "type": "signature",
          "label": "Closed by (SQF Practitioner)",
          "width": "half",
          "role": "verifier",
          "statement": "I confirm this corrective action is complete, verified and closed."
        },
        {
          "id": "closure_date",
          "type": "date",
          "label": "Closure date",
          "width": "half"
        },
        {
          "id": "retention_note",
          "type": "info",
          "label": "Retention",
          "text": "Retained a minimum of two years, or the shelf life of the affected product plus twelve months, whichever is longer. A CAPA relating to a withdrawal or recall is retained permanently (FSQM-009 Part 10)."
        }
      ]
    }
  ]
}
$j007$::jsonb, 'attachments', '[]'::jsonb)
);

do $$
declare
  r record;
begin
  select status, type, category,
         jsonb_array_length(content->'form_schema'->'sections')                        as secs,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f)                    as fields,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'grid')                                                  as grids,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'signature')                                             as sigs,
         -- every grid must declare rows.mode; without it a fixed grid silently renders dynamic
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'grid' and not (f->'rows' ? 'mode'))                     as modeless,
         (content->'form_schema'->'settings'->>'deletable')                            as deletable,
         (content->'form_schema'->'settings'->>'instanceTitleTemplate')                as title_tpl,
         jsonb_array_length(content->'attachments')                                    as atts
    into r
    from public.sop_documents where sop_number = 'FRM-007';

  if r.status <> 'draft' or r.type <> 'form' or r.category <> 'Module 2' then
    raise exception 'FRM-007 wrong metadata: status=%, type=%, category=%.',
      r.status, r.type, r.category;
  end if;
  if r.secs <> 8 or r.fields <> 54 then
    raise exception 'FRM-007 wrong shape: % sections, % fields (expected 8 / 54).',
      r.secs, r.fields;
  end if;
  if r.grids <> 3 or r.sigs <> 2 then
    raise exception 'FRM-007 wrong controls: % grids, % signatures (expected 3 / 2).',
      r.grids, r.sigs;
  end if;
  if r.modeless <> 0 then
    raise exception '% grid(s) on FRM-007 have no rows.mode - a fixed grid without it renders dynamic.',
      r.modeless;
  end if;
  if r.deletable <> 'false' then
    raise exception 'FRM-007 entries are deletable (%). A closed CAPA is a food safety record.',
      r.deletable;
  end if;
  -- a template of pure field tokens renders as "()" on an empty draft
  if r.title_tpl is null or left(r.title_tpl, 1) = '{' then
    raise exception 'FRM-007 instanceTitleTemplate does not lead with literal text: %.', r.title_tpl;
  end if;
  if r.atts is null then
    raise exception 'FRM-007 has no attachments list.';
  end if;
end $$;

commit;
