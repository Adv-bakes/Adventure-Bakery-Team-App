-- SOP-604 (Operating the Handheld Coder / Date & Lot Printer — TOAUTO HP-003) — create the SOP row.
--
-- Second date/lot CODER (companion to SOP-603 the SNEED-JET Titan). Owner chose a separate
-- model-specific SOP over one generic coder SOP, because the two machines' interfaces differ and
-- operators need steps that match the machine in front of them. Fourth Packaging (600s) SOP; category
-- 'Job-Specific Operations'; SQF 2.6.1 / 2.6.2.1 (same identification+traceability hooks as SOP-603 —
-- a date/lot coder has no mechanical/thermal hazard; the food-safety point is CODING ACCURACY).
--
-- Machine: TOAUTO HP-003 (SG-HP-003) handheld thermal-inkjet printer (70 ml cartridge, battery, 600
-- DPI, touchscreen). Used handheld (roll along the pack, straight line, no down-force, 2-5 mm gap) or
-- line-mounted with a photo-eye (Timer sync, timing speed matched to conveyor, photoelectric delay).
-- Manual-specific rules captured: load/remove the cartridge only with power OFF and lock it; the
-- internal clock drives the auto-date (confirm it); cap the cartridge when idle / use within 3-4
-- months; clean a clogged nozzle with alcohol or switch left/right nozzle; NO operator factory reset
-- (erases all). Template/calibration/reset/firmware = Maintenance. No separate FRM (approved code lives
-- on the batch record). Vendor (TOAUTO) named. Content written WITHOUT "→" arrows for a clean PDF.
--
-- SQF refs verified against src/lib/sqfFoodClauses.ts: 2.6.1 (Product Identification), 2.6.2.1 (Product
-- Trace). Body shape matches the Word importer / SopBodyEditor. status stays 'draft'. Draft rows do not
-- fire the sop_documents_history snapshot. Idempotent: guarded on sop_number.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-604',
  'Operating the Handheld Coder / Date & Lot Printer (TOAUTO HP-003)',
  'sop',
  'Job-Specific Operations',
  'draft',
  'New',
  '2.6.1, 2.6.2.1',
  true,
  $json$
{
  "purpose": "To print a correct, legible date and lot code (and any barcode/QR) on every pack.\n\nOne rule drives this SOP: a wrong, missing, or unreadable code is a labeling defect. The best-by date and lot code are how product is date-marked and traced, so the code is verified before the run and checked through it. (Companion to SOP-603, the SNEED-JET Titan coder — same job, different machine.)",
  "scope": "Packaging staff operating the TOAUTO HP-003 to mark packaging (the code prints on the pack, not on the baked product), handheld or line-mounted.\n\nMessage-template building, touchscreen calibration, factory reset, nozzle-voltage changes, and firmware updates are Maintenance / technical support — not operators.",
  "responsibility": "Operators — load the correct message, verify the code, run, check codes through the run, and cap the cartridge.\nSupervisor — approves the date/lot code for the run before it starts; holds product if codes are wrong.\nMaintenance / technical support — calibration, factory reset, nozzle/firmware, and deep service.",
  "procedure": [
    "Before you start: load the ink cartridge with the printer OFF — never insert or remove a cartridge while it is powered on. Lock the cartridge after seating it; don't touch the nozzles. Check the battery is charged. Power on and confirm the Date & Time (clock) is correct — it drives the auto-date, so a wrong clock prints a wrong date.",
    "Load and check the code: Open the correct saved message (or New to build one) for this product/run. Check the date field prints the correct date/best-by in the required format (the machine's clock feeds the auto-date — verify it). Check the counter (initial value, step, digits) and any lot/batch text are right for the run. Save the message so your settings take effect.",
    "Choose how it prints and set it up: Handheld — roll the printer along the pack in a straight line, no downward force, holding the 2-5 mm print gap (pressing down or an uneven surface causes scratches/streaks). Line-mounted (photo-eye) — mount the photo-eye 5-40 cm in front of the printer, and in Print Settings set Sync mode = Timer, Start signal = Photoelectric switch, set the timing speed to the conveyor speed, and adjust the photoelectric delay to position the code. Manual (press to print) or Distance/encoder as needed. Set Print Darkness for a clear code; for barcodes/QR use the encoder so they print square and scannable.",
    "First-article check — verify before you run: print a test pack and confirm the code is complete, legible, and correctly positioned; the date/best-by is correct and the lot/batch is correct; and any barcode/QR scans. The Supervisor approves the code for the run. Don't start production until the code checks out.",
    "Run and monitor: run the job and check codes periodically — legible, right date, right lot. If a code is wrong, missing, or unreadable: stop, hold the affected packs, fix the cause (raise darkness, clean or switch the nozzle, adjust the photo-eye/delay), re-verify, and tell the Supervisor.",
    "Cartridge care and shutdown: cap the cartridge when idle; once opened, use it within 3-4 months (a cartridge with no water sound when shaken is empty). Clogged/faint nozzle — print on scrap a few times, wipe the nozzle with an alcohol swab, or switch to the other nozzle (left/right) in the nozzle settings. Turn the printer off before removing the cartridge. Do not run a factory Reset (it erases all messages and settings) — that is Maintenance only.",
    "If something goes wrong: Faint / unclear print — raise Print Darkness, clean the nozzle with alcohol, switch to the other nozzle. Scratched / streaked / deformed print — flatten the surface, don't press down, move in a straight line, hold the 2-5 mm distance. Line: hears a drip but nothing prints — the photoelectric delay is off, reduce it / move the photo-eye closer, or match the timing speed to the line. Won't print — is the cartridge locked and not empty, is it powered on, is the Start signal set (photo-eye / manual), is the nozzle clogged. Edits not showing — Save the message (and reload it). Barcode/QR won't scan — use the encoder and keep it square and correctly scaled."
  ],
  "form_references": "Production / batch record for the run — the approved date/lot code for the product.",
  "records": "The date and lot code printed for each run identify the product and support traceability. The correct code is set and verified against the production/batch record for the run. Records retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.6.1 (Product Identification), 2.6.2.1 (Product Trace — one step forward / one step back).\nTOAUTO / Shenzhen Fast To Buy — HP-003 (SG-HP-003) Handheld Inkjet Printer User's Manual.\nInk cartridge manufacturer's instructions / SDS; isopropyl alcohol SDS (nozzle cleaning — flammable). The code prints on packaging, not the baked product.",
  "revision_history": "New — 2026-07-26 — Initial issue from the TOAUTO HP-003 (SG-HP-003) Handheld Inkjet Printer User's Manual; one page for floor use. Second coder (companion to SOP-603 Titan), same food-safety point — correct, legible date/lot coding (product identification + traceability): open/verify the message, confirm the clock feeds the right date, check counter/lot, choose the trigger (handheld straight-line no-press, or line-mounted photo-eye with timer sync and delay; encoder for barcodes/QR), first-article check with Supervisor approval, monitor through the run, hold packs on a bad code. Cartridge loaded/removed only with power OFF and locked; cap when idle, use within 3-4 months; nozzle cleaning with alcohol; no factory reset (erases all) by operators. Template/calibration/reset/firmware left to Maintenance. No separate FRM (the approved code lives on the batch record). Vendor (TOAUTO) named."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-604'
);

commit;
