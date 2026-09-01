-- FRM-903 - the Foot baths grid was missing rows.mode, so it would have rendered dynamic.
--
-- A DEFECT IN 20260901000008, found while generating the printable blank. The grid was authored
-- with rows = {labelHeader, deletable, labels} and no `mode`. Every other fixed grid in this form
-- carries "mode": "fixed", and GridFieldInput.tsx decides what to render with exactly that:
--
--     const fixed = field.rows.mode === "fixed";
--
-- With `mode` absent the comparison is false, so the app would have treated it as a DYNAMIC grid:
-- no leading "Foot bath" label column, neither configured row rendered, one blank row for the
-- filler to type into. The two baths this program distinguishes - the production entrance and the
-- walkthrough to inventory and packaging - would not have appeared, and the daily check would have
-- been recorded against nothing in particular.
--
-- WHY THE SCHEMA CHECKS DID NOT CATCH IT. The schema was validated through the app's own
-- buildZodSchema, emptyValues and valueFields, and passed - because a dynamic grid is a perfectly
-- valid grid. Those helpers verify a schema is WELL-FORMED, not that it is the shape that was
-- intended, and a missing optional-looking key reads as a deliberate choice rather than an
-- omission. What surfaced it was generate-form-blank.py, which reads rows["mode"] unconditionally
-- and raised a KeyError. The print path was stricter than the app.
--
-- THE SAME EXERCISE FOUND A SECOND PROBLEM, ON PAPER. The high-range-strip warning lived in the
-- grid's LABEL, and the blank-form generator never prints a grid label - only its column headers.
-- On the printed sheet the warning simply vanished, leaving a table headed "Foot bath | Reading
-- (ppm) | At strength?" under a section called "Detergent & Sanitizer Verification", with nothing
-- to tell the person holding the strip that the 200 ppm one cannot read this bath. The warning
-- moves into an `info` field ahead of the grid, which renders on BOTH surfaces - the app already
-- uses info fields this way on FRM-907 - and the grid label shortens to "Foot baths - Sani-512 at
-- 1:160". A warning that only exists on the screen is no use to somebody filling in paper.
--
-- addLabel matches the sibling grids ("Add item", "Add equipment", "Add check").
--
-- No revision bump. FRM-903 v6 was issued hours ago with this grid intended as fixed and this
-- warning intended to be visible; this corrects the row to what v6 was meant to say rather than
-- issuing a v7 for a key nobody has filled a form against. The single existing entry predates v6
-- and resolves against its own revision snapshot either way.
--
-- The schema below is DERIVED from the live row, not retyped, so the only differences are the three
-- above. It is written with jsonb_set on the form_schema key alone, keeping content->'attachments'
-- out of the write path.

begin;

do $$
declare
  st   text;
  rev  text;
  mode text;
  note boolean;
begin
  select status, revision,
         content->'form_schema'->'sections'->3->'fields'->8->'rows'->>'mode',
         content::text like '%footbath_note%'
    into st, rev, mode, note
    from public.sop_documents where sop_number = 'FRM-903';

  if st is distinct from 'active' or rev is distinct from 'v6' then
    raise exception 'FRM-903 is % at revision % - expected an active v6. Run 20260901000008 first, or re-derive.', st, rev;
  end if;
  if mode is not null then
    raise exception 'FRM-903 footbath_check already has rows.mode = % - this fix has been applied.', mode;
  end if;
  if note then
    raise exception 'FRM-903 already carries a footbath_note field.';
  end if;
end $$;

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', $j903b$
{
  "sections": [
    {
      "id": "details",
      "title": "Day / Shift",
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
          "id": "area_line",
          "type": "text",
          "label": "Production area / line",
          "width": "third",
          "showInList": true
        },
        {
          "id": "shift",
          "type": "select",
          "label": "Shift",
          "width": "third",
          "options": [
            "1st Shift",
            "2nd Shift",
            "3rd Shift"
          ],
          "showInList": true
        },
        {
          "id": "product_run",
          "help": "What was produced today (leave blank if no production)",
          "type": "text",
          "label": "Product / batch run",
          "width": "half"
        }
      ]
    },
    {
      "id": "preop_surfaces",
      "title": "1. Pre-Operation Cleanliness Check",
      "fields": [
        {
          "id": "surface_check",
          "rows": {
            "mode": "fixed",
            "labels": [
              "Tables",
              "Mixers",
              "Bowls",
              "Utensils",
              "Pans",
              "Racks",
              "Ovens",
              "Scales",
              "Depositors",
              "Chopper",
              "Floors",
              "Handwash stations (clean, stocked, draining)",
              "Restrooms / sanitary facilities",
              "Break room / lockers (staff amenities)"
            ],
            "addLabel": "Add item",
            "deletable": true,
            "labelHeader": "Item / Surface"
          },
          "type": "grid",
          "label": "Surface & equipment check",
          "columns": [
            {
              "id": "visibly_clean",
              "type": "pass_fail",
              "label": "Visibly clean",
              "width": 1,
              "required": true
            },
            {
              "id": "sanitized",
              "type": "pass_fail",
              "label": "Sanitized",
              "width": 1,
              "required": true
            },
            {
              "id": "corrective",
              "type": "text",
              "label": "Corrective action / comments",
              "width": 3
            }
          ]
        }
      ],
      "description": "Before production starts, following cleaning and sanitation, confirm each item is visibly clean and sanitized (SQF 11.2.5.7). The clause covers the processing areas and product contact surfaces AND the staff amenities and sanitary facilities, so all of them are listed here. Mark Pass, Fail, or N/A — N/A is the right answer for \"Sanitized\" on an area that is cleaned but not sanitized, such as a locker room. Note any corrective action taken before start-up. Add or remove items as the line changes."
    },
    {
      "id": "equipment_ssop",
      "title": "2. Production Equipment — Cleaned & Sanitized per SSOP",
      "fields": [
        {
          "id": "equipment_status",
          "rows": {
            "mode": "fixed",
            "labels": [
              "Hobart V-1401 Mixer — SOP-901 / FRM-909",
              "Kook-E-King Depositor — SOP-902 / FRM-910",
              "Beldos 275 Depositor — SOP-903 / FRM-911",
              "Smipack S560NA Shrink Wrapper — SOP-601",
              "Groen TDB Kettle — SOP-904 / FRM-912",
              "Molds — SOP-906 (recorded here)"
            ],
            "addLabel": "Add equipment",
            "deletable": true,
            "labelHeader": "Equipment"
          },
          "type": "grid",
          "label": "Equipment",
          "columns": [
            {
              "id": "status",
              "type": "select",
              "label": "Status",
              "width": 2,
              "options": [
                "Clean & sanitized",
                "Between-use care (scrape, wipe, re-grease)",
                "Not used today"
              ],
              "required": true
            },
            {
              "id": "notes",
              "type": "text",
              "label": "Notes",
              "width": 3
            }
          ]
        }
      ],
      "description": "For each machine used in today's production, confirm it was verified clean and sanitized per its SSOP and recorded on its own cleaning log, or mark \"Not used today\". Items without a separate log — the molds — are recorded here. Molds are scraped, wiped and re-greased between uses and washed weekly under SOP-906, so record which of those happened. Add or remove equipment as the line changes."
    },
    {
      "id": "sanitizer",
      "title": "3. Detergent & Sanitizer Verification",
      "fields": [
        {
          "id": "detergent_used",
          "type": "text",
          "label": "Detergent used",
          "width": "third",
          "defaultValue": "Dawn Professional"
        },
        {
          "id": "detergent_concentration",
          "help": "Per the manufacturer's instructions - Dawn Professional is 1-2 oz per 10 gallons of water",
          "type": "text",
          "label": "Detergent concentration",
          "width": "third",
          "required": true,
          "defaultValue": "1-2 oz per 10 gallons"
        },
        {
          "id": "detergent_within_target",
          "type": "pass_fail",
          "label": "Detergent within target?",
          "width": "third",
          "required": true
        },
        {
          "id": "detergent_test_method",
          "help": "How the dose was measured - pump strokes, measuring cup or proportioner. The Dawn Professional pump delivers 1 oz per full stroke.",
          "type": "text",
          "label": "Detergent test method",
          "width": "full",
          "defaultValue": "Measured dose per sink fill"
        },
        {
          "id": "sanitizer_used",
          "type": "text",
          "label": "Sanitizer used",
          "width": "third",
          "defaultValue": "Noble Sani-512"
        },
        {
          "id": "concentration_ppm",
          "type": "text",
          "label": "Concentration (PPM)",
          "width": "third",
          "required": true,
          "defaultValue": "200 ppm"
        },
        {
          "id": "sanitizer_verified",
          "type": "pass_fail",
          "label": "Within target?",
          "width": "third",
          "required": true
        },
        {
          "id": "test_method",
          "type": "text",
          "label": "Test method (e.g. test strip)",
          "width": "full",
          "defaultValue": "Test strip"
        },
        {
          "id": "footbath_note",
          "type": "info",
          "label": "Foot bath check",
          "text": "Foot baths — use the HIGH-RANGE quat strip. The baths run Sani-512 at 1:160, roughly three times the 1:512 food-contact strength. The 0-400 ppm strips used on equipment saturate at this concentration and will read high on a bath that has failed. Change the solution when the strip reads below target, when the bath is visibly soiled, or when it has been diluted by water carried in or by washdown."
        },
        {
          "id": "footbath_check",
          "rows": {
            "mode": "fixed",
            "labels": [
              "Production entrance (from office / break room / reception)",
              "Walkthrough — production to inventory & packaging"
            ],
            "addLabel": "Add foot bath",
            "deletable": true,
            "labelHeader": "Foot bath"
          },
          "type": "grid",
          "label": "Foot baths — Sani-512 at 1:160",
          "columns": [
            {
              "id": "reading",
              "type": "text",
              "label": "Reading (ppm)",
              "width": 1
            },
            {
              "id": "within_target",
              "type": "pass_fail",
              "label": "At strength?",
              "width": 1,
              "required": true
            },
            {
              "id": "condition",
              "type": "pass_fail",
              "label": "Clean & not diluted?",
              "width": 1,
              "required": true
            },
            {
              "id": "action",
              "type": "text",
              "label": "Action (none / recharged / changed)",
              "width": 2
            }
          ]
        }
      ],
      "description": "Confirm and record detergent and sanitizer concentration before use (SQF 11.2.5.3). Site chemicals: Dawn Professional detergent at 1-2 oz per 10 gallons of water; Noble Sani-512 sanitizer at the food-contact dilution of 1:512 (1 fl oz per 4 gallons, about 200 ppm quat)."
    },
    {
      "id": "glass",
      "title": "4. Glass & Brittle Plastic Check",
      "fields": [
        {
          "id": "glass_check",
          "rows": {
            "mode": "fixed",
            "labels": [
              "Processing Room",
              "Processing Room",
              "Processing Room"
            ],
            "addLabel": "Add item",
            "deletable": true,
            "labelHeader": "Location",
            "defaultValues": [
              {
                "item": "Pan scrubber dials"
              },
              {
                "item": "Oven controls and door glass"
              },
              {
                "item": "MIG thermometers"
              }
            ]
          },
          "type": "grid",
          "label": "Glass dial covers & MIG thermometers",
          "columns": [
            {
              "id": "item",
              "type": "text",
              "label": "Item",
              "width": 2
            },
            {
              "id": "undamaged",
              "type": "pass_fail",
              "label": "Undamaged",
              "width": 1,
              "required": true
            },
            {
              "id": "comments",
              "type": "text",
              "label": "Condition / comments",
              "width": 2
            },
            {
              "id": "action",
              "type": "text",
              "label": "Action taken",
              "width": 2
            }
          ]
        }
      ],
      "description": "At the start of the shift, confirm glass instrument dial covers and MIG thermometers are undamaged (SQF 11.7.3.4). Mark Pass (undamaged), Fail (damaged/broken), or N/A. Any Fail requires a Glass Breakage Incident Report (FRM-908) and follows SOP-11.7.3. Items are drawn from the Glass & Brittle Plastic Register (FRM-907)."
    },
    {
      "id": "operational_gmp",
      "title": "5. Operational GMP Check",
      "fields": [
        {
          "id": "gmp_check",
          "rows": {
            "mode": "fixed",
            "labels": [
              "Hair/beard nets worn; no exposed jewelry",
              "Clean outer garments; no eating/drinking/gum in production",
              "Handwash stations stocked (soap, towels, sanitizer)",
              "Hands washed on entry and as required",
              "Allergen controls / segregation followed",
              "Waste and floor debris controlled",
              "No condensation or drip over exposed product",
              "Pest control devices in place and intact",
              "Doors/screens to outside kept closed"
            ],
            "addLabel": "Add check",
            "deletable": true,
            "labelHeader": "Check"
          },
          "type": "grid",
          "label": "Operational GMP check",
          "columns": [
            {
              "id": "result",
              "type": "pass_fail",
              "label": "Conforms",
              "width": 1,
              "required": true
            },
            {
              "id": "comments",
              "type": "text",
              "label": "Corrective action / comments",
              "width": 3
            }
          ]
        }
      ],
      "description": "During production, confirm operational GMPs are being followed. Mark Pass, Fail, or N/A; note corrective action for any Fail (absorbs the former FRM-904 Daily Operation Check)."
    },
    {
      "id": "release",
      "title": "6. Corrective Actions & Release",
      "fields": [
        {
          "id": "all_corrected",
          "type": "pass_fail",
          "label": "All corrective actions completed before start-up",
          "width": "half",
          "required": true
        },
        {
          "id": "released_by",
          "role": "filler",
          "type": "signature",
          "label": "QA Technician (qualified inspector)",
          "width": "half",
          "required": true,
          "statement": "I inspected the area and equipment before start of production, verified the sanitizer concentration, and confirm the area is clean and released for production (or corrective action was completed as noted)."
        },
        {
          "id": "supervisor",
          "role": "verifier",
          "type": "signature",
          "label": "Production Supervisor",
          "width": "half",
          "statement": "I confirm the pre-operation inspection was completed and the area is released for production."
        }
      ],
      "description": "Production shall not begin until all non-conformances are corrected and the area is verified clean (SOP-11.2.12). A record of pre-operational hygiene inspection is maintained for a minimum of 12 months (SQF 11.2.5.9)."
    }
  ],
  "settings": {
    "attachmentsEnabled": true,
    "allowMultipleDrafts": true,
    "requireVerification": false,
    "instanceTitleTemplate": "{inspection_date} — Daily Sanitation & Pre-Op Record"
  },
  "schemaVersion": 1
}
$j903b$::jsonb)
 where sop_number = 'FRM-903'
   and status = 'active'
   and revision = 'v6';

do $$
declare
  r record;
begin
  select (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') sec,
                              jsonb_array_elements(sec->'fields') f
           where f->>'type' = 'grid')                                          as grids,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') sec,
                              jsonb_array_elements(sec->'fields') f
           where f->>'type' = 'grid' and f->'rows'->>'mode' = 'fixed')         as fixed_grids,
         content::text like '%footbath_note%'                                as note,
         content::text like '%HIGH-RANGE quat strip%'                        as warning,
         revision, jsonb_array_length(content->'attachments')                  as attachments,
         (select f->'rows'->>'mode'
            from jsonb_array_elements(content->'form_schema'->'sections') sec,
                 jsonb_array_elements(sec->'fields') f
           where f->>'id' = 'footbath_check')                                  as fb_mode,
         (select jsonb_array_length(f->'rows'->'labels')
            from jsonb_array_elements(content->'form_schema'->'sections') sec,
                 jsonb_array_elements(sec->'fields') f
           where f->>'id' = 'footbath_check')                                  as fb_labels
    into r
    from public.sop_documents where sop_number = 'FRM-903';

  if r.fb_mode is distinct from 'fixed' or r.fb_labels <> 2 then
    raise exception 'footbath_check not fixed with two rows: mode=%, labels=%.', r.fb_mode, r.fb_labels;
  end if;
  if r.grids <> 5 or r.fixed_grids <> 5 then
    raise exception 'FRM-903 has % grids of which % are fixed - expected 5 and 5.', r.grids, r.fixed_grids;
  end if;
  if not (r.note and r.warning) then
    raise exception 'The strip warning did not land: info field=%, warning text=%.', r.note, r.warning;
  end if;
  if r.revision <> 'v6' or r.attachments is null then
    raise exception 'FRM-903 metadata disturbed: revision %, attachments %.', r.revision, r.attachments;
  end if;
end $$;

commit;
