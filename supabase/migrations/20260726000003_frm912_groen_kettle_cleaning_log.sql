-- FRM-912 (Kettle Cleaning & Pre-Use Check Log — Groen TDB) — create the fillable form.
--
-- The record for SOP-904 (Groen kettle sanitation): one entry per clean — the cleaning checklist, the
-- sanitizer strength, who cleaned it, and the Supervisor's pre-use release. Same shape as FRM-909/910/
-- 911; mirrors those migrations' INSERT of a form_schema via jsonb_build_object.
--
-- FRM-912 is the next free number in the 900 form block (901-911 in use; 911 is the Beldos depositor).
-- (FRM-912 was briefly drafted for the Smipack shrink wrapper, then dropped with that machine's
-- cleaning doc; never migrated, so the number is free.) The schema below is the validated draft in
-- sop-drafts/FRM-912-form-schema.json (checked against src/lib/formSchema.ts): 9 fields, unique
-- snake_case ids, a 7-step fixed grid, filler + verifier signatures. Clean-in-place kettle process;
-- sanitizer is Noble Sani-512 quat at 1:512, no-rinse (step 6 + sanitizer_ppm help text).
--
-- REVIEW BEFORE ACTIVATING (this migration deliberately does NOT do these):
--   * status stays 'draft'. Activating FRM-912, SOP-504 and SOP-904 together is an approval decision.
--   * sanitizer_ppm records the Sani-512 strength; the field carries the 1:512 food-contact mix as
--     help text. (Sani-512 likely resolves the same open item on FRM-909/910/911 if it's the house
--     sanitizer — left for confirmation.)
--   * category is 'Module 11' so it groups with the other sanitation forms (FRM-901...911).
--   * Field ids lock once the first entry is saved — they key the response data. Read them first.
--
-- Idempotent: re-running is a no-op once an FRM-912 row exists (guarded on sop_number).

begin;

insert into public.sop_documents (sop_number, title, type, category, status, sqf_reference, content)
select
  'FRM-912',
  'Kettle Cleaning & Pre-Use Check Log (Groen TDB)',
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
    "instanceTitleTemplate": "{clean_date} — Kettle clean"
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
              "Kettle switched off and power isolated; cooled enough to clean safely (cleaned while still warm)",
              "Large food residues scraped and flushed out — non-abrasive brushes only, no metal tools or steel wool",
              "Inside and outside washed with detergent at label strength; burned-on soaked, not gouged",
              "Rim, pouring lip, cover underside and any baskets/strainers washed; controls and housing wiped (no water in controls)",
              "Rinsed thoroughly with hot water and drained completely",
              "Sanitized with Noble Sani-512 at 1:512 (1 oz per 4 gal); every surface wet at least 1 min and air-dried — no-rinse",
              "Allergen changeover: every food contact surface checked under good light (changeover only)"
            ]
          }
        },
        {
          "id": "sanitizer_ppm",
          "type": "number",
          "label": "Sanitizer strength",
          "unit": "ppm",
          "required": true,
          "width": "half",
          "showInList": true,
          "help": "Noble Sani-512 (quat), food-contact mix 1:512 (1 oz per 4 gal)."
        },
        {
          "id": "cleaned_by",
          "type": "signature",
          "role": "filler",
          "label": "Cleaned by",
          "required": true,
          "statement": "I cleaned the kettle as described in SOP-904.",
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
          "label": "Kettle clean inside and out; rim, pouring lip, cover and baskets clean; no detergent residue; sanitized just before use (Sani-512, air-dried); jacket water level at the sight-glass midpoint",
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
          "statement": "I checked the kettle after cleaning and release it for production.",
          "width": "half"
        }
      ]
    }
  ]
}
$json$::jsonb)
where not exists (
  select 1 from public.sop_documents where sop_number = 'FRM-912'
);

commit;
