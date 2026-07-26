-- Correct the Groen kettle power-off wording: "shut off power at the breaker" -> "unplug".
--
-- Per the owner, the kettle is plug-connected and unplugging is sufficient before cleaning; requiring a
-- breaker shut-off was overkill. Two touch points, both on now-active docs:
--   * SOP-904 procedure step 1 (content->'procedure'->0) — the "Two rules before you start" text.
--   * FRM-912 cleaning grid step 1 ("...power isolated" -> "...unplugged") via content->'form_schema'.
--
-- SOP-904's procedure is NOT a snapshot-watched field, so that UPDATE won't create a history row.
-- FRM-912's form_schema IS watched, so its UPDATE fires a sop_document_history snapshot (audit trail).
-- (SOP-504's troubleshooting "check the circuit breaker" is a diagnostic reference — intentionally left.)
--
-- content merged with jsonb_set / || so nothing else changes. Guarded so each is idempotent.

begin;

update public.sop_documents
set content = jsonb_set(content, '{procedure,0}', to_jsonb($p$Two rules before you start: (1) turn the thermostat to OFF and unplug it before cleaning; let the kettle cool enough to work safely — but clean while still warm, not cold, so residue lifts easily. (2) Keep water and cleaning solutions out of the controls and electrical parts, and never use a high-pressure hose on the kettle; the outside is washed with warm water only.$p$::text))
where sop_number = 'SOP-904' and content#>>'{procedure,0}' like '%breaker%';

update public.sop_documents
set content = content || jsonb_build_object('form_schema', $s912$
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
            {
              "id": "done",
              "label": "Done",
              "type": "pass_fail",
              "required": true,
              "width": 1
            },
            {
              "id": "notes",
              "label": "Notes",
              "type": "text",
              "width": 3
            }
          ],
          "rows": {
            "mode": "fixed",
            "labelHeader": "Step",
            "labels": [
              "Kettle switched off and unplugged; cooled enough to clean safely (cleaned while still warm)",
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
          "help": "Noble Sani-512 (quat), food-contact mix 1:512 (1 oz per 4 gal).",
          "defaultValue": 200
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
$s912$::jsonb)
where sop_number = 'FRM-912' and content->>'form_schema' like '%power isolated%';

commit;
