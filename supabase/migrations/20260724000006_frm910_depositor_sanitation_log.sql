-- FRM-910 (Depositor Cleaning & Pre-Use Check Log) — create the fillable form.
--
-- The record for SOP-902 (Kook-E-King depositor sanitation): one entry per clean — the cleaning
-- checklist, the sanitizer strength, who cleaned it, and the Supervisor's pre-use release. Same shape
-- as the mixer's FRM-909 (20260724000001); mirrors that migration's INSERT of a form_schema via
-- jsonb_build_object.
--
-- FRM-910 is the next free number in the 900 form block (901–909 are all in use; 909 is the mixer).
-- The schema below is the validated draft in sop-drafts/FRM-910-form-schema.json (checked against
-- src/lib/formSchema.ts): 9 fields, unique snake_case ids, an 8-step fixed grid, filler + verifier
-- signatures. It reflects the confirmed floor process — hopper/rollers/die/scrapers washed in the
-- sink; the cut-off wire and fingers wiped in place (step 3), not sink-washed.
--
-- REVIEW BEFORE ACTIVATING (this migration deliberately does NOT do these):
--   * status stays 'draft'. Activating FRM-910, SOP-502 and SOP-902 together is an approval decision.
--   * `sanitizer_ppm` records a reading but sets no target — add the sanitizer's label figure (and
--     consider a min/max) before staff fill it against nothing. (Same open item as FRM-909.)
--   * category is 'Module 11' so it groups with the other sanitation forms (FRM-901…909) in the
--     SOPs Library.
--   * Field ids lock once the first entry is saved — they key the response data. Read them first.
--
-- Idempotent: re-running is a no-op once an FRM-910 row exists (guarded on sop_number). It does not
-- overwrite an existing FRM-910, so hand-edits to the schema in the app won't be clobbered.

begin;

insert into public.sop_documents (sop_number, title, type, category, status, sqf_reference, content)
select
  'FRM-910',
  'Depositor Cleaning & Pre-Use Check Log',
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
    "instanceTitleTemplate": "{clean_date} — Depositor clean"
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
              "Wire clear of the die, machine unplugged; guards opened",
              "Hopper, feed rollers, die and scrapers removed",
              "Cut-off wire and support fingers wiped clean in place (not removed)",
              "Head interior, die slot, cabinet and belts dry-then-damp wiped (no water on the panel)",
              "Hopper, feed rollers, die and scrapers washed in the sink — detergent, rinse, sanitizer at label strength, drying rack",
              "Cut-off wire whole and accounted for — no missing pieces",
              "Reassembled: die finger-tight in a clean slot, a finger in each die slot, guards locked",
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
          "statement": "I cleaned the depositor as described in SOP-902.",
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
          "label": "Hopper, rollers, die and scrapers clean and dry; wire and fingers wiped clean and wire accounted for; guards locked; nothing left on the machine",
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
  select 1 from public.sop_documents where sop_number = 'FRM-910'
);

commit;
