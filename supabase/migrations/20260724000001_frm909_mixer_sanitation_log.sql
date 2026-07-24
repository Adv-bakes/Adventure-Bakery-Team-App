-- FRM-909 (Mixer Cleaning & Pre-Use Check Log) — create the fillable form.
--
-- Why: SOP-901 (Hobart V-1401 mixer sanitation) needs a record for the daily clean and the pre-use
-- release. The plant sanitation forms can't hold it:
--   * FRM-901 Master Sanitation Schedule and FRM-902 Sanitation Verification Log are Word-document
--     attachments — they have no form_schema and aren't fillable in the app.
--   * FRM-903 GMP Pre-Operation Inspection is fillable but scoped to the glass dial cover / MIG
--     thermometer check (SQF 11.7.3.4), not sanitation release.
-- So the mixer gets its own single fillable form. FRM-909 is the next free number in the 900 block
-- (901–908 are all in use). The mixer should also be listed on FRM-901 (Master Sanitation Schedule)
-- for its cleaning FREQUENCY — that's a Word doc the owner edits, out of scope here.
--
-- Unlike 20260715000002 (which MERGED a schema into an existing FRM-903 row), FRM-909 does not exist
-- yet, so this INSERTs the row. The schema below is the validated draft in
-- sop-drafts/FRM-909-form-schema.json (checked against src/lib/formSchema.ts).
--
-- REVIEW BEFORE ACTIVATING (this migration deliberately does NOT do these):
--   * status stays 'draft'. Activating FRM-909, SOP-501 and SOP-901 is an approval decision.
--   * `sanitizer_ppm` captures a reading but sets no target — add your sanitizer's label figure
--     (and consider a min/max) before staff fill it against nothing.
--   * category is 'Module 11' so it groups with the other sanitation forms (FRM-901…908) in the
--     SOPs Library. Change if your grouping differs.
--   * Field ids lock once the first entry is saved — they key the response data. Read them first.
--
-- Idempotent: re-running is a no-op once an FRM-909 row exists (guarded on sop_number). It does not
-- overwrite an existing FRM-909, so if you hand-edit the schema in the app, this won't clobber it.

begin;

insert into public.sop_documents (sop_number, title, type, category, status, sqf_reference, content)
select
  'FRM-909',
  'Mixer Cleaning & Pre-Use Check Log',
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
    "instanceTitleTemplate": "{clean_date} — Mixer clean"
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
              "Bowl lowered and power unplugged",
              "Machine dry wiped — top, levers, down to the footers",
              "Machine wet wiped, detergent wiped off, left to air dry",
              "Drip cup clean and dry — no oil",
              "Bowl broken down, residue removed, rinsed warm, scrubbed with detergent",
              "Bowl run through the pan washer on the high-temperature cycle",
              "Paddle / whip / dough arm — detergent, rinse, sanitizer, drying rack",
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
          "statement": "I cleaned the mixer as described in SOP-901.",
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
          "label": "Mixer, bowl and agitator clean and dry; drip cup clear; nothing left on the machine",
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
          "statement": "I checked the mixer after cleaning and release it for production.",
          "width": "half"
        }
      ]
    }
  ]
}
$json$::jsonb)
where not exists (
  select 1 from public.sop_documents where sop_number = 'FRM-909'
);

commit;
