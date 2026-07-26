-- Roll the site sanitizer (Noble Chemical Sani-512) into the mixer + depositor forms FRM-909, FRM-910,
-- FRM-911, matching what was done for the Groen kettle's FRM-912 (20260726000003).
--
-- Two changes per form's content->'form_schema':
--   1. The sink-wash grid step "...detergent, rinse, sanitizer [at label strength], drying rack" ->
--      "...detergent, rinse, Sani-512 (1:512, no-rinse), drying rack". Sani-512 food-contact mix is
--      1:512 (1 fl oz / 4 gal), no-rinse (air dry on the rack) — see the SDS the owner supplied.
--   2. The sanitizer_ppm field: label "Sanitizer strength (test strip)" -> "Sanitizer strength", and a
--      help line added ("Noble Sani-512 (quat), food-contact mix 1:512 (1 oz per 4 gal).").
--
-- Nothing else in the schemas is touched (verified: these were the only sanitizer / label-strength /
-- test-strip strings). The embedded schemas are the transformed repo drafts in sop-drafts/, which were
-- confirmed byte-identical (modulo jsonb key order) to the live prod rows before transforming.
--
-- content is MERGED (||) so any other content keys are preserved; only form_schema is replaced.
--
-- All three rows are status='active', so each UPDATE fires the sop_document_history snapshot trigger
-- (content->'form_schema' is a watched field) — an audit snapshot of the prior version, by design.
--
-- Idempotent: guarded on `form_schema still contains "(test strip)"`, so re-running is a no-op once the
-- new wording is in place (and it won't re-fire the snapshot on re-run).

begin;

update public.sop_documents
set content = content || jsonb_build_object('form_schema', $s909$
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
              "Bowl lowered and power unplugged",
              "Machine dry wiped — top, levers, down to the footers",
              "Machine wet wiped, detergent wiped off, left to air dry",
              "Drip cup clean and dry — no oil",
              "Bowl broken down, residue removed, rinsed warm, scrubbed with detergent",
              "Bowl run through the pan washer on the high-temperature cycle",
              "Paddle / whip / dough arm — detergent, rinse, Sani-512 (1:512, no-rinse), drying rack",
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
$s909$::jsonb)
where sop_number = 'FRM-909' and content->>'form_schema' like '%(test strip)%';

update public.sop_documents
set content = content || jsonb_build_object('form_schema', $s910$
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
              "Wire clear of the die, machine unplugged; guards opened",
              "Hopper, feed rollers, die and scrapers removed",
              "Cut-off wire and support fingers wiped clean in place (not removed)",
              "Head interior, die slot, cabinet and belts dry-then-damp wiped (no water on the panel)",
              "Hopper, feed rollers, die and scrapers washed in the sink — detergent, rinse, Sani-512 (1:512, no-rinse), drying rack",
              "Cut-off wire whole and accounted for — no missing pieces",
              "Reassembled: die finger-tight in a clean slot, a finger in each die slot, guards locked",
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
$s910$::jsonb)
where sop_number = 'FRM-910' and content->>'form_schema' like '%(test strip)%';

update public.sop_documents
set content = content || jsonb_build_object('form_schema', $s911$
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
              "Machine and air supply off; air line disconnected and pressure bled",
              "Depositor fully disassembled — nozzle, hopper, rotation cylinder, hopper block, product cylinder, piston",
              "All seals / O-rings removed from every part",
              "Product-contact parts and seals washed in the sink — detergent, rinse, Sani-512 (1:512, no-rinse), drying rack",
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
$s911$::jsonb)
where sop_number = 'FRM-911' and content->>'form_schema' like '%(test strip)%';

commit;
