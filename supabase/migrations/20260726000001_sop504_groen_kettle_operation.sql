-- SOP-504 (Operating the Groen TDB Steam-Jacketed Kettle) — create the SOP row.
--
-- Fifth equipment set, back to the full food-contact pattern: an operation SOP (SOP-504), a
-- sanitation SSOP (SOP-904, migration 20260726000002), and a fillable clean/pre-use log (FRM-912,
-- 20260726000003). Machine: Groen TDB table-top steam-jacketed tilting kettle, HAND TILT (owner
-- confirmed) — Groen/Unified Brands TDB/TDBC operator manual, P/N 148733.
--
-- Numbering: SOP-504 = stage-block 500s (Production & Batching) — SOP-501 mixer, 502 KEK, 503 Beldos,
-- so this is the next production SOP. Category 'Job-Specific Operations' groups it in the SOPs Library
-- with the other equipment operation SOPs; the process stage lives in the number.
--
-- SQF ref verified against src/lib/sqfFoodClauses.ts:
--   11.2.1.2 — equipment maintained/checked on a schedule. The kettle's SQF hook is its daily checks
--     (jacket water level, 20-30in vacuum) and the twice-monthly pressure-relief-valve test. Cooking
--     temperatures / process control for a product live on the batch sheet / food safety plan, not
--     this equipment SOP; the SOP is primarily burn/steam/electrical safety (OSHA).
--
-- No kettle record exists yet, so this INSERTs a new row. Body shape matches the Word importer /
-- SopBodyEditor so it renders in the Document tab and exports to PDF.
--
-- status stays 'draft'. Activating SOP-504/SOP-904/FRM-912 together is an approval decision. Since the
-- row is draft, this does not fire the sop_documents_history snapshot (trigger is WHEN
-- old.status='active'). Idempotent: guarded on sop_number.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-504',
  'Operating the Groen TDB Steam-Jacketed Kettle (Hand Tilt)',
  'sop',
  'Job-Specific Operations',
  'draft',
  'New',
  '11.2.1.2',
  true,
  $json$
{
  "purpose": "To cook, reheat, or hold product in the Groen kettle safely and consistently.\n\nEverything about this machine is hot. The body, the product, the cover and the steam that vents from the pressure-relief valve all burn. It is also a sealed steam jacket — it must never be run dry, and its water level and pressure are checked every day.",
  "scope": "Production staff cooking, holding, stirring, or transferring product in the kettle.\n\nCleaning is SOP-904. Jacket refilling, water treatment, greasing, pressure-relief-valve service, and electrical/repair work are Maintenance / an authorized service agent — not operators.",
  "responsibility": "Operators — run the daily checks and operate as written; stop and report faults or leaks.\nSupervisor — trains and signs off operators; takes the kettle out of service on a fault.\nMaintenance / service agent — jacket fill and water treatment, greasing, pressure-relief-valve and electrical service, with the power disconnected.",
  "procedure": [
    "Before you start — training: do not operate this kettle unless the Supervisor has trained and signed you off.",
    "Daily checks (kettle cold): jacket water level at or just above the midpoint of the sight glass (if low, it goes to Maintenance for refilling — don't run it low); pressure/vacuum gauge reads 20–30 inches of vacuum when cold (if not, there's air in the jacket — Maintenance); never heat an empty kettle (excessive steam pressure can build — put water or product in first); the pressure-relief-valve elbow points down and the floor around the kettle is clean and dry. Anything fails → don't run it; tag it and tell the Supervisor.",
    "PPE / get ready: protective oven mitt and apron for anything hot; sleeves managed; hair in a hairnet. Keep clear of the hot body, pouring lip, and the relief-valve outlet.",
    "Start and cook: turn on the power and set the thermostat to the temperature on the batch sheet (the heating light cycles on/off as it holds temperature — normal). Don't overfill — keep product 2–3 inches (5–8 cm) below the rim for stirring, boiling and safe transfer. Stir and scrape with the kettle paddle / non-metal utensils — no metal tools that scratch the stainless. Check the batch sheet's allergens against the last product cooked; if they differ, the kettle needs an allergen changeover clean under SOP-904 / SOP-204 first. If using the cover, place/remove it only by its plastic handle and lift the rear edge first to vent steam — never tilt the kettle with the cover on (it can slide off).",
    "Transfer / empty (tilting): wear the oven mitt and apron; put a deep container on a stable flat surface as close as possible; stand to the side, not in the pour path. Grip the insulated tilt handle firmly and keep hold of it the whole time — don't let go while partly tilted (it slams into the upright or fully-tilted stop and can splash hot product). Pour slowly and return the kettle upright once the transfer is complete. Don't overfill the receiving container.",
    "Shut down: turn the thermostat to OFF and switch off the power. Hand over to sanitation — SOP-904 (clean food-contact surfaces as soon as possible after use, while still warm).",
    "If something goes wrong — Won't heat, no indicator light: check the power / circuit breaker and the jacket water level; if still dead, Maintenance. Heats slowly or the relief valve pops: air in the jacket — Maintenance removes it; don't keep running it hard. Steam venting from the relief valve: stand clear (burn hazard); if it keeps popping, stop and get Maintenance. Tilt feels stiff or binds: stop — authorized service (trunnion bearing / lubrication); don't force it. Any leak or the water level dropping: stop, tag it, tell Maintenance — never run the jacket dry.",
    "Maintenance checks — who does what: Operator, daily/periodic — jacket water level (sight-glass midpoint) and vacuum gauge (20–30 inches cold) before each day; test the pressure-relief valve at least twice a month (hold the ring about 5 seconds at operating pressure — if it doesn't discharge or it leaks, stop using the kettle and call service). Maintenance / service — jacket refilling with distilled water and water treatment (pH 10.5–11.5), greasing the trunnion bearings, and all electrical work. Keep water and solutions out of the controls and electrical — never use a high-pressure hose on the kettle."
  ],
  "form_references": "Batch sheet for the product (temperature, time, batch size)\nFRM-912 — Kettle Cleaning & Pre-Use Check Log (the clean and its release before a run)\nSOP-904 — Groen TDB Kettle Sanitation",
  "records": "Cooking parameters go on the batch sheet. The clean and the pre-use release are recorded on FRM-912. Daily jacket/pressure checks and the pressure-relief-valve test are noted per the plant maintenance log. Operator training sign-off is held in the training record. All retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.2.1.2 (equipment maintained and checked on a schedule — the daily jacket water-level / vacuum checks and the pressure-relief-valve test). Cooking temperatures and process control for a given product live on the batch sheet / food safety plan, not this equipment SOP.\nUnified Brands / Groen — TDB/TDBC Steam Jacketed Kettle Operator Manual (P/N 148733).\nOSHA 29 CFR 1910.147 — Control of Hazardous Energy (disconnect power before service).",
  "revision_history": "New — 2026-07-25 — Initial issue from the Groen/Unified Brands TDB/TDBC operator manual (P/N 148733); one page for floor use, jacket-fill / water-treatment / greasing left to Maintenance. Written for the hand-tilt (TDB) unit."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-504'
);

commit;
