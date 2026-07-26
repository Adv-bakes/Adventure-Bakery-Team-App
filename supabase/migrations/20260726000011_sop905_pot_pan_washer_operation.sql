-- SOP-905 (Operating the Pot & Pan Washer / Warewashing) — create the SOP row.
--
-- A hot-water sanitizing warewasher (Douglas Machines pot/pan/utensil washer): it both CLEANS
-- (~150 °F detergent wash) and SANITIZES (~190 °F hot-water final rinse). Because operating it IS a
-- clean-and-sanitize process for food-contact ware, it lives in the Sanitation block (900s) and is
-- categorized as an SSOP, grouping with SOP-901..904 (mixer/depositor/kettle SSOPs). SOP-905 = next
-- 900s number.
--
-- Vendor is named (owner confirmed "you can refer to Douglas") — unlike SOP-602 which was generic.
-- No dedicated temperature-log FRM is built yet (owner: "do not build the temperature log yet"); the
-- SOP references the wash/rinse temperature record as an unassigned FRM.
--
-- SQF refs verified against src/lib/sqfFoodClauses.ts:
--   11.2.5.1 — methods/responsibility for effective cleaning of equipment documented; incl. (vi)
--     confirming detergent/sanitizer concentrations and (vii) verifying sanitation effectiveness
--     (here, the hot-water rinse temperature is that verification).
--   11.2.5.3 — detergents/sanitizers mixed correctly per manufacturer, concentrations verified and
--     records maintained (the auto detergent feeder and any chemical sanitizer feeder).
--
-- Machine-specific points in the body: 190 °F rinse = the sanitizing step (verify + record temps
-- before washing); non-foaming/non-caustic/aluminum-safe detergent via the required auto feeder; load
-- facing the wash arms; wash->rinse->dwell cycle (3 beeps); end-of-day cleaning of the washer itself
-- (drain, filters, low-water probe, heater coils, spray jets); Er01..Er07 codes. Electrical panel is
-- HOT — operators do not open it; install/gas/electrical/pump-lube/PC-board/repairs are Maintenance.
-- Content written WITHOUT "→" arrows so the pdfmake/Roboto PDF export renders cleanly.
--
-- Body shape matches the Word importer / SopBodyEditor so it renders in the Document tab and exports
-- to PDF. status stays 'draft' (activation is a later approval decision). Draft rows do not fire the
-- sop_documents_history snapshot. Idempotent: guarded on sop_number.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-905',
  'Operating the Pot & Pan Washer (Warewashing)',
  'sop',
  'SSOP - Sanitation Standard Operating Procedure',
  'draft',
  'New',
  '11.2.5.1, 11.2.5.3',
  true,
  $json$
{
  "purpose": "To run the pot & pan washer so pots, pans, bowls, utensils, and sheet/baking pans come out clean and sanitized and safe for food use.\n\nThe ~190 °F hot-water rinse is the sanitizing step — the ware is not sanitized unless that rinse reaches temperature. So the rules below center on hitting and verifying the wash and rinse temperatures.",
  "scope": "Warewashing of food-contact items on the pot & pan washer, and the end-of-day cleaning of the washer itself.\n\nInstallation, gas/electrical work, pump lubrication, PC-board programming, spray-jet/heater/probe replacement, and repairs are Maintenance — not operators. Operators do not open the electrical panel (it is a live/hot panel).",
  "responsibility": "Operators — run the washer as written, check and record the wash/rinse temperatures, and do the end-of-day washer clean.\nSupervisor — verifies temperatures are being hit and recorded; takes the washer out of service on a fault.\nMaintenance — electrical, heaters, pump, spray jets, probe, lime/scale descale, and repairs, with power disconnected.",
  "procedure": [
    "Before you start: the washer is filled to the overflow, the door closes properly, and the filter baskets are in place. Detergent is a non-foaming, non-caustic, aluminum-safe warewash detergent and the automatic detergent feeder is on and filled (this machine must be run with an automatic detergent feeder). If a chemical sanitizer feeder is fitted, it is on, filled, and delivering at the labeled concentration. Hot surfaces and hot water: the rinse water and steam are about 190 °F, so keep hands clear during the rinse and dwell; the machine will not restart during the one-minute dwell. If anything fails, or the ware isn't coming clean, don't rely on it — tell the Supervisor.",
    "Bring it up to temperature: set or confirm the thermostats WASH about 150 °F and RINSE about 190 °F, and allow 30 to 60 minutes to heat up. Read the temperature gauges (not the knobs) — the gauge is what counts. Check and record the wash and rinse temperatures before the first load and periodically through the shift. Do not wash until both are at temperature — below 190 °F on the rinse, the ware is not being sanitized.",
    "Load: place items facing the wash arms, open end down, so water reaches every surface; weight down light plastic items with the hold-down rack. Sheet pans and baking pans go in the correct pan rack or insert (open face toward the wash hub / arms). Don't stack or nest items so they shield each other, and don't overload or block the spray jets.",
    "Run the cycle: pick short (4 min), medium (6 min), or long (8 min) for the soil level. Let it run the full wash, rinse, and dwell cycle — three beeps signal it is done. Opening the door or pressing stop aborts the cycle; a restart begins again from the wash, it does not resume.",
    "Unload and check: ware should come out clean. Anything still soiled gets rescraped and rewashed — don't return dirty ware to service. Let items air dry, and handle sanitized ware so it stays clean.",
    "End-of-day — clean the washer: turn off or disconnect power first, then (a) drain the machine and spray out the wash cabinet, directing debris into the filter baskets; (b) remove and clean the filter baskets and clean the wash-tank reservoir, flushing debris to the drain; (c) clean the low-water probe metal tip (scour off scale and residue) and, if the wash tank has electric heater coils, clean the coils; (d) put the filters back and inspect the spray jets, clearing any obstruction and reporting missing or worn jets to Maintenance; (e) wipe the outside with a stainless cleaner or mild detergent and close the drain valve. Leave it drained until the next wash.",
    "If something goes wrong: Not cleaning — check detergent level, wash temperature, water level, clogged jets, and that filters are clear. Rinse not hot enough — check the rinse thermostat/gauge (target about 190 °F) and that the heat source is engaged, and hold the ware because it isn't sanitized; if it persists, get Maintenance. Low wash pressure — filters clear and in place, jets and end-caps in place, filled to level, and check for excess foam (wrong detergent). Not rinsing — door closed, incoming water pressure, rinse valve; get Maintenance. Error codes: Er01 fill time exceeded / low water pressure, Er03 water loss or drain open, Er05 not enough water in the tank, Er06 door not closed, Er07 pump overload tripped — address the cause and reset per the panel; if it persists or shows Er04 (control board), get Maintenance. Operators do not open the electrical panel — Maintenance only, with power disconnected."
  ],
  "form_references": "Warewashing temperature record — wash/rinse temperatures per shift (a dedicated FRM to be assigned if wanted). FRM-901 Master Sanitation Schedule (the washer's own end-of-day clean).",
  "records": "Wash and rinse temperature checks are recorded per shift (the sanitizing verification for this machine). Retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.2.5.1 (documented cleaning/sanitizing method, including verifying effectiveness), 11.2.5.3 (detergent/sanitizer concentration verified and recorded).\nFDA Food Code — hot-water sanitizing warewashing: final rinse at least 180 °F at the manifold / at least 160 °F at the utensil surface.\nDouglas Machines Corp. — Pot, Pan & Utensil Washer Operation Manual.\nOSHA 29 CFR 1910.147 — Control of Hazardous Energy (power off before servicing); NEC/NFPA for electrical and installation (Maintenance).",
  "revision_history": "New — 2026-07-26 — Initial issue from the Douglas Machines pot/pan/utensil washer operation manual; one page for floor use. Written as a warewashing (clean + hot-water sanitize) process: heat to WASH about 150 °F / RINSE about 190 °F, verify and record temps (the 190 °F rinse is the sanitizing step), load facing the wash arms, run wash-rinse-dwell, then end-of-day cleaning of the washer (drain, filters, low-water probe, heater coils, jets). Electrical/gas/pump/PC-board work left to Maintenance. Temperature record noted; dedicated FRM log not yet built."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-905'
);

commit;
