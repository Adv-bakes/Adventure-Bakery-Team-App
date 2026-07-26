-- SOP-602 (Operating the Tabletop Band Sealer) — create the SOP row.
--
-- Second PACKAGING machine (after SOP-601 the shrink wrapper), same divergence from the
-- mixer/depositor pattern: it is NOT a food-contact wet-clean machine. Operation SOP only — no
-- sanitation SSOP and no fillable clean/pre-use log. The machine must not be washed with water
-- (not water-resistant); wiping it down and keeping the sealing band clear of melted film is folded
-- into the operation SOP as a fire-safety + foreign-matter step. Per owner decision this machine is
-- deliberately NOT added to the FRM-901 Master Sanitation Schedule register.
--
-- Numbering: SOP-602 = stage-block 600s (Packaging & Labeling), the second 600s SOP. Category is
-- 'Job-Specific Operations' so it groups in the SOPs Library with the other equipment operation SOPs
-- (SOP-501/502/503/601); the process stage lives in the number, not the category.
--
-- Vendor name intentionally omitted throughout (owner runs a generic version of this equipment) — the
-- body says "tabletop continuous band sealer" and "manufacturer's instruction manual", no brand/model.
--
-- SQF refs verified against src/lib/sqfClauses.ts / sqfFoodClauses.ts:
--   2.3.2.6  — packaging in DIRECT food contact must be certified/approved for the use (letter of
--     guarantee / certificate of conformance on file). The bags/pouches this machine seals touch the
--     baked product directly, so they are a food-contact material and must be food-grade.
--   11.7.3.1 — equipment free of potential contaminants; parts not deteriorated. Melted-film scraps
--     and worn PTFE band debris are the foreign-matter hazard on the product.
--
-- Machine-specific hazards captured in the body: heated sealing blocks up to 300°C (burns, and melted
-- film on the hot band is a fire risk); moving belts / gears / pinch points; electrical (unplug before
-- servicing, not water-resistant). Shutdown order preserved (heater off → cool on fan → power/fan off)
-- to protect the belts. Belt replacement, turbocase lubrication, and temperature-controller
-- calibration are left to Maintenance.
--
-- No band-sealer record exists yet, so this INSERTs a new row. Body shape matches the Word importer /
-- SopBodyEditor (purpose, scope, responsibility, procedure[], form_references, records,
-- governing_reference, revision_history) so it renders in the Document tab and exports to PDF.
--
-- status stays 'draft'. Activating SOP-602 is an approval decision (a pre-activation item is confirming
-- the food-grade bag's certificate / letter of guarantee is on file, which the SOP requires). Draft
-- rows do not fire the sop_documents_history snapshot (trigger is WHEN old.status='active').
--
-- Idempotent: guarded on sop_number, so re-running is a no-op and won't clobber later edits.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-602',
  'Operating the Tabletop Band Sealer (Bag Sealing)',
  'sop',
  'Job-Specific Operations',
  'draft',
  'New',
  '2.3.2.6, 11.7.3.1',
  true,
  $json$
{
  "purpose": "To run the tabletop band sealer safely and produce a clean, continuous, airtight seal on packaged baked product.\n\nTwo things drive the rules below. The sealing (heating) blocks get very hot — up to 300 °C (572 °F) — so they burn, and melted film left on them is a fire risk. And the machine has moving belts, gears, and pinch points that can catch fingers, tools, hair, or loose clothing.",
  "scope": "Production / packaging staff setting up, running, and shutting down the tabletop continuous band sealer to seal poly bags/pouches of finished product.\n\nBelt replacement, gear-oil / turbocase lubrication, temperature-controller calibration, and repairs are Maintenance — not operators. Wiping the machine down and keeping the sealing band clear of melted film is part of running it; there is no separate wet-clean SOP for this equipment.",
  "responsibility": "Operators — set up and run as written; stop and report bad seals, film melted on hot parts, or faults.\nSupervisor — trains and signs off operators; takes the machine out of service on a fault.\nMaintenance — belts, lubrication, temperature settings, electrical, and repair, with the machine unplugged and cool.",
  "procedure": [
    "Before you start — training: do not operate this machine unless the Supervisor has trained and signed you off.",
    "Pre-start checks: the machine sits on a flat, stable surface, plugged into a grounded outlet, with the power cord and plug undamaged and the cord clear of the work area; the sealing band and blocks are clear of melted film or debris (a fire risk and a foreign-matter source) and the belts are not burnt, hard, brittle, or cracked; the emergency stop works and releases (turn the knob ~120° clockwise to reset); the bags/pouches are the approved food-grade packaging (they touch the baked product directly). Anything fails → don't run it; tag it and tell the Supervisor.",
    "Get yourself ready: sleeves down and secured, no dangling ties, lanyards, or jewelry, hair tied back / in a hairnet. Keep hands, tools, and hair away from the hot blocks and the moving belts.",
    "Power up: set the circuit breaker to ON (levers up); turn the Power, Heater, and Fan switches ON — the band and conveyor start moving together.",
    "Set temperature and run settings: on the controller press SET, move across the digits and set the value with the arrows, then press SET to save — PV (red) is the actual temperature, SV (green) is your target; wait until PV reaches SV (about 5–10 minutes). Temperature depends on the bag material and thickness — if unsure, start low and raise it gradually until it seals cleanly (too high crumples the bag and melts film onto the band). Set the conveyor speed for a clean seal at your pace, set the pressure knob for the thickness of the bag, and set the guide so the seal line sits where you want it on the bag.",
    "Seal a bag: lay the bag flat on the guide and let the conveyor pull it through — do not push or pull the bag (that makes a wavy, weak seal). Check the seal on the first bags and periodically: a continuous, flat, airtight seal line — no gaps, burns, wrinkles, or melted-through spots. Weak / open seal → raise the temperature a little or slow the conveyor. Crumpled seal / film sticking to the band → temperature is too high, reduce it and clear any melted film off the band once cool. A bag that doesn't seal is a reject — set it aside and re-seal or re-bag; don't send it on.",
    "Watch the band and hot parts: keep the sealing band clear of melted film — film on the hot band is a fire risk and sticks to the next bags; if film builds up, stop and clear it once cool. The bag touches the baked product directly, so band debris or film scraps are foreign matter on the product — if a fragment could have reached a baked product, segregate the affected packs and tell the Supervisor.",
    "Shut down and wipe down: turn the Heater switch OFF first and let the machine cool with the Fan still running, then turn Power and Fan OFF (shutting down in this order protects the belts). Unplug the machine. Wipe down the machine and conveyor with a cloth — do NOT wash it with water or spray it down; it is not water-resistant and water will damage it or cause a shock. Check the band and belts for burn marks, brittleness, or debris.",
    "If something goes wrong — Weak / incomplete seal: temperature too low or conveyor too fast (raise temp / slow conveyor); if it persists get Maintenance (worn sealing belt). Seal crumpled / film sticks to the band: temperature too high — reduce it and clear melted film off the band once cool. Sealing belt running off track or tearing: stop and get Maintenance (belt tension / tracking). Bag won't pass through the blocks: get Maintenance (block clearance). Emergency stop pressed: reset by turning the knob ~120° clockwise, then restart. Smoke, burning smell, or flame: E-stop, unplug at the outlet, and follow the fire procedure.",
    "Bags are a direct food-contact material: the bags/pouches this machine seals touch the baked product directly, so only approved food-grade bags may be used — packaging certified / approved for direct food contact, with the supplier's letter of guarantee or certificate of conformance on file (SQF 2.3.2.6); don't substitute an unapproved bag. Because the bag contacts the product, melted-film scraps or band debris are a foreign-matter hazard on the baked product — keep the band and blocks clear and hold / segregate product if a fragment could have reached it (SQF 11.7.3.1).",
    "Cleaning: this machine has no dedicated wet-clean SOP or record form — it is packaging equipment that must not be washed with water, and the packaging (not the machine) is the food-contact surface. Keeping the band clear of film and wiping the machine down is done as part of operation (above)."
  ],
  "form_references": "Batch / settings chart for the product (bag type, sealing temperature, conveyor speed, pressure).",
  "records": "Machine settings go on the batch / settings chart. Operator training sign-off is held in the training record. There is no dedicated cleaning record — wiping down and keeping the band clear is part of operation. All retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.3.2.6 (packaging in direct food contact certified / approved for the use), 11.7.3.1 (equipment free of potential contaminants; parts not deteriorated).\nManufacturer's continuous band sealer instruction manual (tabletop conveyor band sealer).\nOSHA 29 CFR 1910.147 — Control of Hazardous Energy (unplug before servicing).",
  "revision_history": "New — 2026-07-26 — Initial issue from the manufacturer's continuous band sealer instruction manual; one page for floor use. Operation only — belts, lubrication, and temperature calibration left to Maintenance. Heated-block burn / melted-film fire hazards and moving-belt pinch points called out; shutdown order (heater off, cool on fan, then power/fan) preserved; no water wash (wipe-down only). No separate wet-clean SOP/log; band-clearing folded into operation. Bags confirmed as direct food contact — food-grade packaging required. Vendor name intentionally omitted (generic equipment version)."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-602'
);

commit;
