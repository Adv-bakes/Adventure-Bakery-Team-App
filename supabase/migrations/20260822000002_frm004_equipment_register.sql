-- FRM-004 — Equipment Register (new form).
--
-- Task 26.1 on the SQF Ed 9 remediation plan. Closes 11.2.1.2 and is the gate on D-26
-- (Preventive Maintenance Program, 11.2.1.1-.8) and D-28 (Calibration): both programmes cover
-- "the equipment", and until now nothing said what that is. FRM-903's section 2 lists five
-- machines for the daily check, which is a shift checklist, not an asset register.
--
-- Numbered FRM-004 — the Food Safety System block (0-99, DOC_STAGES in src/lib/docNumber.ts),
-- alongside FRM-001 Management Review and FRM-002/003 Complaints. An equipment register is a
-- site-wide system register rather than a process-stage record; it is not sanitation (900s) and
-- it is not tied to one stage of the flow. FRM-004 was free (FRM-001/002/003 in use, verified
-- against sop_documents 2026-08-22).
--
-- The thirteen seeded rows are transcribed from SOP-501..605 / SOP-901..905, which already name
-- every machine's make and model. This register introduces no new facts; it gathers existing
-- ones into one controlled list. Rows are `deletable` and the grid takes "Add equipment", so the
-- seed is a starting point the plant edits, not a fixed checklist.
--
-- `food_contact` is seeded but must be confirmed by someone who knows the line: it decides what
-- the food-grade lubricant requirement (11.2.1.7) and the calibration programme have to cover.
-- The form says so in an info block rather than leaving the seeded value to look authoritative.
--
-- `pm_frequency` is seeded "Not yet set" on every row on purpose — the frequencies are D-26's
-- job and a plausible-looking guess here would be worse than a visible blank.
--
-- Inserted as status='draft' per the project workflow (review in-app, then a separate activation
-- + stamp migration). Idempotent: guarded on sop_number, so re-running inserts nothing.

begin;

insert into public.sop_documents (sop_number, title, type, category, status, revision, sqf_reference, content)
select
  'FRM-004',
  'Equipment Register',
  'form',
  'Module 11',
  'draft',
  'New',
  '11.2.1.2',
  jsonb_build_object('form_schema', $json$
{
  "schemaVersion": 1,
  "settings": {
    "deletable": false,
    "allowMultipleDrafts": false,
    "requireVerification": true,
    "attachmentsEnabled": true,
    "instanceTitleTemplate": "Equipment Register — {register_date}"
  },
  "sections": [
    {
      "id": "purpose",
      "title": "Purpose & Scope",
      "fields": [
        {
          "id": "purpose_note",
          "type": "info",
          "label": "Purpose & Scope",
          "text": "The master list of every item of equipment on site (SQF 11.2.1.2). It is the source list for the preventive maintenance schedule, the calibration programme and the food-grade lubricant register — each of those covers what this register says exists, so an item missing here is an item nothing maintains.\n\nRows are seeded from the equipment SOPs (SOP-501 to SOP-605 and SOP-901 to SOP-905). Add, rename or remove rows as the plant changes; this is a living register, not a checklist."
        }
      ]
    },
    {
      "id": "register",
      "title": "Equipment Register",
      "description": "Every item of equipment on site, with the documents that govern it and its maintenance frequency (SQF 11.2.1.2).",
      "fields": [
        {
          "id": "register_date",
          "type": "date",
          "label": "Register date",
          "width": "third",
          "required": true,
          "defaultToday": true,
          "showInList": true
        },
        {
          "id": "compiled_by",
          "type": "signature",
          "role": "filler",
          "label": "Compiled by",
          "width": "third",
          "required": true,
          "statement": "I confirm this register lists every item of equipment on site and that the details recorded are correct as at the register date."
        },
        {
          "id": "contact_note",
          "type": "info",
          "label": "About the Food contact column",
          "text": "Food contact is the column that matters most and the one to check first. “Direct” means product or a food-contact surface touches the equipment (including packaging film that touches product). It decides what the food-grade lubricant requirement (SQF 11.2.1.7) and the calibration programme have to cover, so the seeded values are a starting point to be confirmed by someone who knows the line — not an answer."
        },
        {
          "id": "equipment",
          "type": "grid",
          "label": "Equipment",
          "rows": {
            "mode": "fixed",
            "deletable": true,
            "labelHeader": "Equipment",
            "addLabel": "Add equipment",
            "labels": [
              "Planetary mixer",
              "Cookie depositor",
              "Piston depositor",
              "Steam-jacketed kettle",
              "Rack oven",
              "Bench scale 1",
              "Bench scale 2",
              "Shrink wrapper",
              "Band sealer",
              "Coder — inkjet",
              "Coder — handheld",
              "Flow wrapper",
              "Pot & pan washer"
            ],
            "defaultValues": [
              {
                "make_model": "Hobart V-1401",
                "location": "Production",
                "food_contact": "Direct",
                "operating_sop": "SOP-501",
                "pm_frequency": "Not yet set",
                "status": "In service",
                "sanitation_sop": "SOP-901"
              },
              {
                "make_model": "Rhodes Kook-E-King Super Automatic",
                "location": "Production",
                "food_contact": "Direct",
                "operating_sop": "SOP-502",
                "pm_frequency": "Not yet set",
                "status": "In service",
                "sanitation_sop": "SOP-902"
              },
              {
                "make_model": "Beldos 275",
                "location": "Production",
                "food_contact": "Direct",
                "operating_sop": "SOP-503",
                "pm_frequency": "Not yet set",
                "status": "In service",
                "sanitation_sop": "SOP-903"
              },
              {
                "make_model": "Groen TDB (hand tilt)",
                "location": "Production",
                "food_contact": "Direct",
                "operating_sop": "SOP-504",
                "pm_frequency": "Not yet set",
                "status": "In service",
                "sanitation_sop": "SOP-904"
              },
              {
                "make_model": "Revent 724",
                "location": "Production",
                "food_contact": "Indirect",
                "operating_sop": "SOP-505",
                "pm_frequency": "Not yet set",
                "status": "In service"
              },
              {
                "make_model": "OHAUS Defender 3000 i-DT33",
                "location": "Production",
                "food_contact": "Indirect",
                "operating_sop": "SOP-506",
                "pm_frequency": "Not yet set",
                "status": "In service",
                "notes": "Calibration scope - see SOP-506"
              },
              {
                "make_model": "“ULTRA” — model to confirm",
                "location": "Production",
                "food_contact": "Indirect",
                "operating_sop": "SOP-506",
                "pm_frequency": "Not yet set",
                "status": "In service",
                "notes": "Model not yet confirmed"
              },
              {
                "make_model": "Smipack S560NA",
                "location": "Packaging",
                "food_contact": "Direct",
                "operating_sop": "SOP-601",
                "pm_frequency": "Not yet set",
                "status": "In service",
                "notes": "Film is direct food contact (SOP-601)"
              },
              {
                "make_model": "Tabletop continuous band sealer",
                "location": "Packaging",
                "food_contact": "Direct",
                "operating_sop": "SOP-602",
                "pm_frequency": "Not yet set",
                "status": "In service",
                "notes": "Vendor/model not recorded on SOP-602"
              },
              {
                "make_model": "SNEED-JET Titan",
                "location": "Packaging",
                "food_contact": "Indirect",
                "operating_sop": "SOP-603",
                "pm_frequency": "Not yet set",
                "status": "In service"
              },
              {
                "make_model": "TOAUTO HP-003",
                "location": "Packaging",
                "food_contact": "Indirect",
                "operating_sop": "SOP-604",
                "pm_frequency": "Not yet set",
                "status": "In service"
              },
              {
                "make_model": "S350X rotary pillow packer",
                "location": "Packaging",
                "food_contact": "Direct",
                "operating_sop": "SOP-605",
                "pm_frequency": "Not yet set",
                "status": "In service",
                "notes": "Film is direct food contact (SOP-605)"
              },
              {
                "make_model": "Douglas Machines",
                "location": "Warewashing",
                "food_contact": "Indirect",
                "operating_sop": "SOP-905",
                "pm_frequency": "Not yet set",
                "status": "In service",
                "sanitation_sop": "SOP-905",
                "notes": "Sanitizes by heat — ~190 °F final rinse"
              }
            ]
          },
          "columns": [
            {
              "id": "make_model",
              "type": "text",
              "label": "Make & model",
              "width": 2,
              "required": true
            },
            {
              "id": "asset_no",
              "type": "text",
              "label": "Serial / asset no.",
              "width": 1
            },
            {
              "id": "location",
              "type": "text",
              "label": "Location",
              "width": 1
            },
            {
              "id": "food_contact",
              "type": "select",
              "label": "Food contact",
              "width": 1,
              "options": [
                "Direct",
                "Indirect",
                "None"
              ],
              "required": true
            },
            {
              "id": "operating_sop",
              "type": "text",
              "label": "Operating SOP",
              "width": 1
            },
            {
              "id": "sanitation_sop",
              "type": "text",
              "label": "Sanitation SOP",
              "width": 1
            },
            {
              "id": "pm_frequency",
              "type": "select",
              "label": "PM frequency",
              "width": 1,
              "options": [
                "Daily",
                "Weekly",
                "Monthly",
                "Quarterly",
                "Six-monthly",
                "Annual",
                "As required",
                "Not yet set"
              ]
            },
            {
              "id": "status",
              "type": "select",
              "label": "Status",
              "width": 1,
              "options": [
                "In service",
                "Out of service",
                "Removed"
              ],
              "required": true
            },
            {
              "id": "notes",
              "type": "text",
              "label": "Notes",
              "width": 2
            }
          ]
        }
      ]
    },
    {
      "id": "review",
      "title": "Review",
      "description": "The register is reviewed at least annually and whenever equipment is added, moved or removed.",
      "fields": [
        {
          "id": "reviewed_by",
          "type": "signature",
          "role": "verifier",
          "label": "Reviewed by",
          "width": "third",
          "statement": "I have reviewed this register and confirm it is complete and current."
        },
        {
          "id": "review_date",
          "type": "date",
          "label": "Review date",
          "width": "third"
        },
        {
          "id": "review_notes",
          "type": "textarea",
          "label": "Changes since last review",
          "help": "Equipment added, moved, removed or taken out of service."
        },
        {
          "id": "records_note",
          "type": "info",
          "label": "Records",
          "text": "Retained per the record retention policy. Superseded versions are kept as the audit trail of what was on site and when."
        }
      ]
    }
  ]
}
$json$::jsonb)
where not exists (
  select 1 from public.sop_documents where sop_number = 'FRM-004'
);

commit;
