-- FRM-901, FRM-903, FRM-907 - the three form lines FSQM-012's open item 3 asks for.
--
-- FSQM-012 states a foot bath control and a brittle-item control. Neither is evidenced until the
-- forms carry them: a daily check with nowhere to record it is not a record, and a brittle fixture
-- nobody inspects is not on a register. This adds the three lines and nothing else.
--
--   FRM-903 (daily record)      - a Foot baths grid in section 3, two rows, one per bath.
--   FRM-901 (master schedule)   - the monthly strip-down, on the printed schedule and in the
--                                 task picker so it can actually be recorded as done.
--   FRM-907 (glass & brittle)   - the ceramic handwash basin at the production entrance.
--
-- WHY THE FOOT BATH CHECK IS ITS OWN GRID AND NOT EXTRA FIELDS IN SECTION 3. Section 3 already
-- verifies the food-contact sanitizer at 1:512 / 200 ppm. The foot baths run the SAME PRODUCT at
-- 1:160. Two strengths sharing one block of fields is how a checker writes the food-contact
-- reading in the foot bath row; a separate, explicitly labelled grid is how they do not. The label
-- carries the warning where the person holding the strip will see it, rather than in a procedure
-- they read once - the 0-400 ppm strip saturates at 1:160 and reads high on a bath that has failed.
--
-- TWO ROWS, NOT ONE FREE-TEXT FIELD. There are two baths in different places and they foul at
-- different rates; one field would average them into a number that describes neither.
--
-- FRM-907 GAINS A MATERIAL OPTION, NOT JUST A ROW. The Material select offered Glass and Plastic
-- only, so the basin could not have been recorded correctly even if somebody had added the row.
-- Ceramic is now a third option. Risk 1 matches every other fixture on the register, including the
-- light bulbs over the processing room.
--
-- FRM-901's schedule row names the frequency AND points at FRM-903 for the daily check, so the two
-- documents cannot drift into disagreeing about how often the baths are seen.
--
-- SCHEMAS ARE DERIVED FROM THE LIVE ROWS, NOT RETYPED. Each new form_schema was built by reading
-- the current one out of the database and appending to it, so the only differences are the ones
-- above. And each is written with jsonb_set on the 'form_schema' key alone - content->'attachments'
-- is never in the write path, which is how the FRM-903 corruption in form-schema-migration-stale-tab
-- happened. The assertions check the attachment count survived.
--
-- REVISIONS BUMP AND EFFECTIVE DATES ARE STAMPED. These are ACTIVE controlled forms; a changed form
-- with an unchanged revision is precisely the document-control drift INT-14's report looks for.
-- FRM-901 A->B, FRM-903 v5->v6, FRM-907 New->v2, all effective 2026-09-01. The sop_document_history
-- trigger snapshots each prior row, so existing entries still resolve against the schema they were
-- filled under.
--
-- GUARDED: every change asserts the current shape first (row counts, option lists, absence of the
-- thing being added), so a form edited in the drawer since raises instead of being overwritten.

begin;

do $$
declare
  r record;
begin
  select
    (select revision from public.sop_documents where sop_number = 'FRM-901') as rev901,
    (select revision from public.sop_documents where sop_number = 'FRM-903') as rev903,
    (select revision from public.sop_documents where sop_number = 'FRM-907') as rev907,
    (select count(*) from public.sop_documents
      where sop_number in ('FRM-901','FRM-903','FRM-907') and status = 'active') as active_n,
    (select jsonb_array_length(content->'form_schema'->'sections'->0->'fields'->0->'rows')
       from public.sop_documents where sop_number = 'FRM-901') as sched_rows,
    (select content::text like '%footbath_check%'
       from public.sop_documents where sop_number = 'FRM-903') as has_footbath,
    (select content::text like '%Ceramic%'
       from public.sop_documents where sop_number = 'FRM-907') as has_ceramic
  into r;

  if r.active_n <> 3 then
    raise exception 'Expected FRM-901, FRM-903 and FRM-907 all active; found %.', r.active_n;
  end if;
  if r.rev901 <> 'A' or r.rev903 <> 'v5' or r.rev907 <> 'New' then
    raise exception 'Forms are not at the revisions this migration was written against (FRM-901=%, FRM-903=%, FRM-907=%; expected A / v5 / New). Re-derive before applying.',
      r.rev901, r.rev903, r.rev907;
  end if;
  if r.sched_rows <> 9 then
    raise exception 'FRM-901 cleaning schedule has % rows, expected 9 - it has been edited.', r.sched_rows;
  end if;
  if r.has_footbath then
    raise exception 'FRM-903 already carries a footbath_check field.';
  end if;
  if r.has_ceramic then
    raise exception 'FRM-907 already mentions Ceramic.';
  end if;
end $$;

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', $j901$
{
  "sections": [
    {
      "id": "schedule",
      "title": "Master Sanitation Schedule (reference)",
      "fields": [
        {
          "id": "schedule_ref",
          "rows": [
            [
              "Food contact surfaces",
              "Clean; sanitize with Sani-512 (1:512, no-rinse)",
              "Sanitation / Production",
              "Daily (production days)"
            ],
            [
              "Equipment used for production",
              "Cleaned & sanitized per each machine's SOP/SSOP; recorded on its own log",
              "Sanitation / Production",
              "Daily (production days)"
            ],
            [
              "Utensils used for production",
              "Wash, rinse, sanitize (Sani-512)",
              "Sanitation / Production",
              "Daily (production days)"
            ],
            [
              "Floors in processing room",
              "Sweep, wash",
              "Sanitation",
              "Daily (production days)"
            ],
            [
              "Floors in storage areas",
              "Sweep, wash",
              "Sanitation",
              "Daily (production days)"
            ],
            [
              "Under pallets / bottom rack spaces in storage",
              "Clear and clean",
              "Sanitation",
              "Monthly"
            ],
            [
              "Dock areas",
              "Sweep, clean",
              "Sanitation",
              "Monthly"
            ],
            [
              "Overheads",
              "Clean",
              "Sanitation",
              "Every 6 months"
            ],
            [
              "Racking in storage areas",
              "Clean",
              "Sanitation",
              "Every 6 months"
            ],
            [
              "Sanitizing foot baths (production entrance; walkthrough to inventory & packaging)",
              "Drain, strip and scrub; recharge with Sani-512 at 1:160 (4.0 fl oz per 5 gal). Verify with a HIGH-RANGE quat strip — not the 200 ppm food-contact strip.",
              "Sanitation",
              "Monthly (daily check on FRM-903)"
            ]
          ],
          "type": "reference_table",
          "label": "Cleaning schedule",
          "columns": [
            "Area / item to clean",
            "Cleaning method & chemical",
            "Responsible",
            "Frequency"
          ]
        }
      ],
      "description": "Defines the scheduled cleaning of the facility, equipment, and storage areas — what is cleaned, how, when, and who is responsible (SQF 11.2.5.1). Daily production-day cleaning is recorded on the Daily Sanitation & Pre-Operation Record (FRM-903) and each machine's SSOP log; periodic cleaning is recorded below as it is completed (SQF 11.2.5.8, 11.2.5.9)."
    },
    {
      "id": "completion",
      "title": "Periodic Cleaning — Completion Record",
      "fields": [
        {
          "id": "task_area",
          "type": "select",
          "label": "Task / area cleaned",
          "width": "half",
          "options": [
            "Under pallets / bottom rack spaces in storage",
            "Dock areas",
            "Overheads",
            "Racking in storage areas",
            "Sanitizing foot baths (strip-down & recharge)",
            "Other (note in comments)"
          ],
          "required": true,
          "allowOther": true,
          "showInList": true
        },
        {
          "id": "frequency",
          "type": "select",
          "label": "Frequency",
          "width": "third",
          "options": [
            "Monthly",
            "Every 6 months",
            "Other"
          ],
          "required": true,
          "showInList": true
        },
        {
          "id": "date_completed",
          "type": "date",
          "label": "Date completed",
          "width": "third",
          "required": true,
          "showInList": true,
          "defaultToday": true
        },
        {
          "id": "comments",
          "type": "textarea",
          "label": "Method / chemical / comments",
          "width": "full"
        },
        {
          "id": "completed_by",
          "role": "filler",
          "type": "signature",
          "label": "Completed by",
          "width": "half",
          "required": true,
          "statement": "I completed the cleaning task recorded above."
        },
        {
          "id": "verified_by",
          "role": "verifier",
          "type": "signature",
          "label": "Verified by",
          "width": "half",
          "statement": "I verified this cleaning task was completed to standard."
        }
      ],
      "description": "Record each scheduled periodic (monthly / 6-month) cleaning as it is completed, and have it verified. This forms part of the cleaning records required by SQF 11.2.5.9. One record per completed task; the Records report shows completions over time."
    }
  ],
  "settings": {
    "deletable": false,
    "attachmentsEnabled": true,
    "allowMultipleDrafts": true,
    "requireVerification": false,
    "instanceTitleTemplate": "{date_completed} — {task_area}"
  },
  "schemaVersion": 1
}
$j901$::jsonb),
       revision = 'B',
       effective_date = date '2026-09-01'
 where sop_number = 'FRM-901'
   and status = 'active'
   and revision = 'A';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', $j903$
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
          "id": "footbath_check",
          "type": "grid",
          "label": "Foot baths — Sani-512 at 1:160. Use the HIGH-RANGE quat strip; the 0-400 ppm food-contact strip saturates at this strength and will read high on a failed bath.",
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
          ],
          "rows": {
            "labelHeader": "Foot bath",
            "deletable": true,
            "labels": [
              "Production entrance (from office / break room / reception)",
              "Walkthrough — production to inventory & packaging"
            ]
          }
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
$j903$::jsonb),
       revision = 'v6',
       effective_date = date '2026-09-01'
 where sop_number = 'FRM-903'
   and status = 'active'
   and revision = 'v5';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', $j907$
{
  "sections": [
    {
      "id": "purpose_scope",
      "title": "Purpose & Scope",
      "fields": [
        {
          "id": "purpose_scope_info",
          "text": "This register lists all glass and brittle-plastic items present in food handling, processing, and storage zones at Adventure Bakery, LLC, including their location and condition (SQF 11.7.3.2). It is inspected on a regular basis to detect any change in condition or breakage (SQF 11.7.3.3).\n\nSQF references: 11.7.3.1 (foreign-matter control) · 11.7.3.2 (glass inventory with location & condition) · 11.7.3.3 (regular condition inspections) · 11.7.3.5 (breakage response).",
          "type": "info",
          "label": "Purpose & Scope"
        }
      ]
    },
    {
      "id": "risk_rating_key",
      "title": "Risk Rating Key",
      "fields": [
        {
          "id": "risk_rating_key_table",
          "rows": [
            [
              "1",
              "Slight Risk – no action required."
            ],
            [
              "2",
              "Medium Risk – action when opportunity occurs."
            ],
            [
              "3",
              "Urgent – action or removal of object required."
            ]
          ],
          "type": "reference_table",
          "label": "Risk Rating Key",
          "columns": [
            "Risk",
            "Rating"
          ]
        }
      ]
    },
    {
      "id": "glass_brittle_plastic_register",
      "title": "Glass & Brittle Plastic Register",
      "fields": [
        {
          "id": "inspection_date",
          "type": "date",
          "label": "Inspection Date",
          "width": "half"
        },
        {
          "id": "checked_by",
          "role": "filler",
          "type": "signature",
          "label": "Checked By",
          "width": "half"
        },
        {
          "id": "inspection_note",
          "text": "Record Intact (Y/N) and any change in condition at each inspection. Any \"N\" or breakage must follow the breakage response in SOP-11.7.3 (isolate, clean, inspect, and clear before resuming, and be recorded on FRM-908 – SQF 11.7.3.5).",
          "type": "info",
          "label": "Inspection Note"
        },
        {
          "id": "register",
          "rows": {
            "mode": "fixed",
            "labels": [
              "Storage Warehouse",
              "Storage Warehouse",
              "Processing Room",
              "Processing Room",
              "Processing Room",
              "Processing Room",
              "Storage Room",
              "Processing Room & Storage Warehouse",
              "Processing Room",
              "Processing Room",
              "Processing Room",
              "Cooler",
              "Freezer",
              "Processing Room"
            ],
            "deletable": true,
            "labelHeader": "Location",
            "defaultValues": [
              {
                "item": "Light bulbs (12)",
                "risk": 1,
                "material": "Glass"
              },
              {
                "item": "Flow wrap screens (2)",
                "risk": 1,
                "material": "Glass"
              },
              {
                "item": "Light bulbs (48)",
                "risk": 1,
                "material": "Glass"
              },
              {
                "item": "Pan scrubber dials",
                "risk": 1,
                "material": "Glass"
              },
              {
                "item": "Oven controls and door glass",
                "risk": 1,
                "material": "Glass"
              },
              {
                "item": "Emergency lights",
                "risk": 1,
                "material": "Glass"
              },
              {
                "item": "Emergency lights",
                "risk": 1,
                "material": "Glass"
              },
              {
                "item": "Cameras",
                "risk": 1,
                "material": "Glass"
              },
              {
                "item": "Clocks",
                "risk": 1,
                "material": "Plastic"
              },
              {
                "item": "Lids for ingredient containers (12)",
                "risk": 1,
                "material": "Plastic"
              },
              {
                "item": "Office window",
                "risk": 1,
                "material": "Glass"
              },
              {
                "item": "Light bulbs (covered)",
                "risk": 1,
                "material": "Glass"
              },
              {
                "item": "Light bulbs",
                "risk": 1,
                "material": "Glass"
              },
              {
                "item": "Handwash basin — ceramic (production entrance)",
                "material": "Ceramic",
                "risk": 1
              }
            ]
          },
          "type": "grid",
          "label": "Glass & Brittle Plastic Register",
          "columns": [
            {
              "id": "item",
              "type": "text",
              "label": "Item"
            },
            {
              "id": "material",
              "type": "select",
              "label": "Material",
              "options": [
                "Glass",
                "Plastic",
                "Ceramic"
              ]
            },
            {
              "id": "intact",
              "type": "pass_fail",
              "label": "Intact (Y/N)"
            },
            {
              "id": "risk",
              "type": "number",
              "label": "Risk"
            },
            {
              "id": "condition_comments",
              "type": "text",
              "label": "Condition / Comments"
            },
            {
              "id": "resolved_action",
              "type": "text",
              "label": "Resolved / Action"
            }
          ]
        }
      ]
    },
    {
      "id": "review",
      "title": "Review",
      "fields": [
        {
          "id": "reviewed_by",
          "role": "verifier",
          "type": "signature",
          "label": "Reviewed by",
          "width": "half"
        },
        {
          "id": "review_date",
          "type": "date",
          "label": "Date",
          "width": "half"
        },
        {
          "id": "records_maintained_note",
          "text": "Records are maintained for a minimum of 2 years (SOP-11.7.3).",
          "type": "info",
          "label": "Records Maintained Note"
        }
      ]
    }
  ],
  "settings": {},
  "schemaVersion": 1
}
$j907$::jsonb),
       revision = 'v2',
       effective_date = date '2026-09-01'
 where sop_number = 'FRM-907'
   and status = 'active'
   and revision = 'New';

do $$
declare
  r record;
begin
  select
    (select revision from public.sop_documents where sop_number = 'FRM-901') as rev901,
    (select revision from public.sop_documents where sop_number = 'FRM-903') as rev903,
    (select revision from public.sop_documents where sop_number = 'FRM-907') as rev907,
    (select jsonb_array_length(content->'form_schema'->'sections'->0->'fields'->0->'rows')
       from public.sop_documents where sop_number = 'FRM-901')                as sched_rows,
    (select content::text like '%Sanitizing foot baths (strip-down & recharge)%'
       from public.sop_documents where sop_number = 'FRM-901')                as task_option,
    (select content::text like '%footbath_check%'
       from public.sop_documents where sop_number = 'FRM-903')                as footbath,
    (select content::text like '%HIGH-RANGE quat strip%'
       from public.sop_documents where sop_number = 'FRM-903')                as strip_warning,
    (select content::text like '%Handwash basin — ceramic%'
       from public.sop_documents where sop_number = 'FRM-907')                as basin,
    (select content->'form_schema'->'sections' @> '[{"fields":[{"id":"register"}]}]'
       from public.sop_documents where sop_number = 'FRM-907')                as reg_present,
    -- attachments must be untouched: jsonb_set wrote only the form_schema key
    (select jsonb_array_length(content->'attachments')
       from public.sop_documents where sop_number = 'FRM-901')                as att901,
    (select jsonb_array_length(content->'attachments')
       from public.sop_documents where sop_number = 'FRM-903')                as att903,
    (select jsonb_array_length(content->'attachments')
       from public.sop_documents where sop_number = 'FRM-907')                as att907
  into r;

  if r.rev901 <> 'B' or r.rev903 <> 'v6' or r.rev907 <> 'v2' then
    raise exception 'Revisions did not all bump: FRM-901=%, FRM-903=%, FRM-907=% (expected B / v6 / v2).',
      r.rev901, r.rev903, r.rev907;
  end if;
  if r.sched_rows <> 10 or not r.task_option then
    raise exception 'FRM-901 not updated: schedule rows=% (expected 10), task option present=%.',
      r.sched_rows, r.task_option;
  end if;
  if not (r.footbath and r.strip_warning) then
    raise exception 'FRM-903 not updated: footbath grid=%, strip warning=%.', r.footbath, r.strip_warning;
  end if;
  if not (r.basin and r.reg_present) then
    raise exception 'FRM-907 not updated: basin row=%, register field still present=%.', r.basin, r.reg_present;
  end if;
  if r.att901 is null or r.att903 is null or r.att907 is null then
    raise exception 'An attachments list went missing: FRM-901=%, FRM-903=%, FRM-907=%.',
      r.att901, r.att903, r.att907;
  end if;
end $$;

commit;
