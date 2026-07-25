-- FRM-911 (Depositor Cleaning & Pre-Use Check Log — Beldos 275) — create the fillable form.
--
-- The record for SOP-903 (Beldos 275 depositor sanitation): one entry per clean — the cleaning
-- checklist, the sanitizer strength, who cleaned it, and the Supervisor's pre-use release. Same shape
-- as the mixer's FRM-909 and the KEK depositor's FRM-910; mirrors those migrations' INSERT of a
-- form_schema via jsonb_build_object.
--
-- FRM-911 is the next free number in the 900 form block (901–910 are in use; 910 is the KEK
-- depositor). The schema below is the validated draft in sop-drafts/FRM-911-form-schema.json (checked
-- against src/lib/formSchema.ts): 9 fields, unique snake_case ids, an 8-step fixed grid, filler +
-- verifier signatures. It reflects the daily disassembly this seal-based machine needs — all
-- product-contact parts and seals washed in the sink; air cylinders/body wiped only (step 5); every
-- seal inspected and worn ones replaced (step 6).
--
-- REVIEW BEFORE ACTIVATING (this migration deliberately does NOT do these):
--   * status stays 'draft'. Activating FRM-911, SOP-503 and SOP-903 together is an approval decision.
--   * `sanitizer_ppm` records a reading but sets no target — add the sanitizer's label figure (and
--     consider a min/max) before staff fill it against nothing. (Same open item as FRM-909 / FRM-910.)
--   * category is 'Module 11' so it groups with the other sanitation forms (FRM-901…910).
--   * Field ids lock once the first entry is saved — they key the response data. Read them first.
--
-- Idempotent: re-running is a no-op once an FRM-911 row exists (guarded on sop_number). It does not
-- overwrite an existing FRM-911, so hand-edits to the schema in the app won't be clobbered.

begin;

insert into public.sop_documents (sop_number, title, type, category, status, sqf_reference, content)
select
  'FRM-911',
  'Depositor Cleaning & Pre-Use Check Log (Beldos 275)',
  'form',
  'Module 11',
  'draft',
  '11.2.5.1, 11.2.5.3, 11.2.5.7',
  jsonb_build_object('form_schema', $json$
{
  "schemaVersion": 1,
  "settings": {
    "deletable": false,
    "allowMultipleDrafts": true,
    "requireVerification": true,
    "attachmentsEnabled": true,
    "instanceTitleTemplate": "{clean_date} — Beldos 275 clean"
  },
  "sections": [
    {
      "id": "entry",
      "fields": [
        {
          "id": "clean_date",
          "type": "date",
          "label": "Date",
          "required": true,
          "defaultToday": true,
          "width": "third",
          "showInList": true
        },
        {
          "id": "product_run",
          "type": "text",
          "label": "Product run",
          "width": "third",
          "showInList": true
        },
        {
          "id": "allergen_change",
          "type": "checkbox",
          "label": "Allergen changeover",
          "width": "third",
          "help": "Tick if the next product has different allergens"
        }
      ]
    },
    {
      "id": "cleaning",
      "title": "Cleaning",
      "fields": [
        {
          "id": "steps",
          "type": "grid",
          "label": "Steps",
          "columns": [
            { "id": "done", "label": "Done", "type": "pass_fail", "required": true, "width": 1 },
            { "id": "notes", "label": "Notes", "type": "text", "width": 3 }
          ],
          "rows": {
            "mode": "fixed",
            "labelHeader": "Step",
            "labels": [
              "Machine and air supply off; air line disconnected and pressure bled",
              "Depositor fully disassembled — nozzle, hopper, rotation cylinder, hopper block, product cylinder, piston",
              "All seals / O-rings removed from every part",
              "Product-contact parts and seals washed in the sink — detergent, rinse, sanitizer at label strength, drying rack",
              "Machine body and air cylinders wiped only — not submerged",
              "Every seal inspected for wear; worn or damaged seals replaced",
              "Reassembled — seals greased with food-approved grease, clamps tight, correct nozzle fitted",
              "Allergen changeover: every food contact surface checked under good light (changeover only)"
            ]
          }
        },
        {
          "id": "sanitizer_ppm",
          "type": "number",
          "label": "Sanitizer strength (test strip)",
          "unit": "ppm",
          "required": true,
          "width": "half",
          "showInList": true
        },
        {
          "id": "cleaned_by",
          "type": "signature",
          "role": "filler",
          "label": "Cleaned by",
          "required": true,
          "statement": "I cleaned the depositor as described in SOP-903.",
          "width": "half"
        }
      ]
    },
    {
      "id": "release",
      "title": "Check Before Next Run",
      "fields": [
        {
          "id": "preop_ok",
          "type": "pass_fail",
          "label": "All parts clean and dry; seals inspected and worn ones replaced (none torn or missing a piece); clamps tight; correct nozzle fitted; nothing left on the machine",
          "required": true,
          "width": "full",
          "showInList": true
        },
        {
          "id": "issue",
          "type": "textarea",
          "label": "Anything wrong, and what was done about it",
          "rows": 2,
          "width": "full",
          "help": "Leave blank if nothing. If something failed, it gets re-cleaned and re-checked."
        },
        {
          "id": "released_by",
          "type": "signature",
          "role": "verifier",
          "label": "Checked and released by",
          "statement": "I checked the depositor after cleaning and release it for production.",
          "width": "half"
        }
      ]
    }
  ]
}
$json$::jsonb)
where not exists (
  select 1 from public.sop_documents where sop_number = 'FRM-911'
);

commit;
