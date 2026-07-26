-- SOP-603 (Operating the Coder / Date & Lot Printer — SNEED-JET Titan) — create the SOP row.
--
-- Third PACKAGING machine (after SOP-601 shrink wrapper, SOP-602 band sealer). A thermal-inkjet (TIJ)
-- coder that prints best-by date, lot/batch number, counters, barcodes and QR codes onto packaging.
-- SOP-603 = next 600s number; category 'Job-Specific Operations' matches SOP-601/602 (process stage
-- lives in the number, not the category).
--
-- Unlike the other packaging machines this one has no mechanical/thermal hazard — the food-safety point
-- is CODING ACCURACY: a wrong/missing/unreadable best-by or lot code is a labeling defect. The SOP is
-- built around load-and-verify the code, first-article check + Supervisor approval, monitor through the
-- run, hold packs on a bad code. The code prints on packaging, not the baked product (indirect).
--
-- SQF refs verified against src/lib/sqfFoodClauses.ts:
--   2.6.1   — Product Identification (mandatory): the code identifies the product/lot.
--   2.6.2.1 — Product Trace (mandatory): the date/lot code is the traceability mechanism (one step
--             forward / one step back).
--
-- Notable manual gotcha captured: the date drop-downs print only TODAY's date; a real best-by requires
-- the User-Defined date option with a day/month/year offset. Also: reload the message after any edit
-- (changes don't take effect until reloaded); never remove the cartridge or change settings in print
-- mode; cap the cartridge when idle; proper "SHUT DOWN" button; no chemical cleaning without Sneed
-- technical support. Template/encoder/calibration/reset and chemical cleaning are Maintenance/Sneed.
-- No separate FRM (the approved code lives on the batch/production record). Vendor (Sneed-Jet) named.
-- Content written WITHOUT "→" arrows so the pdfmake/Roboto PDF renders cleanly.
--
-- Body shape matches the Word importer / SopBodyEditor. status stays 'draft' (activation is a later
-- approval decision). Draft rows do not fire the sop_documents_history snapshot. Idempotent: guarded
-- on sop_number.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-603',
  'Operating the Coder / Date & Lot Printer (SNEED-JET Titan)',
  'sop',
  'Job-Specific Operations',
  'draft',
  'New',
  '2.6.1, 2.6.2.1',
  true,
  $json$
{
  "purpose": "To print a correct, legible date and lot code (and any barcode/QR) on every pack.\n\nOne rule drives this SOP: a wrong, missing, or unreadable code is a labeling defect. The best-by date and lot code are how product is date-marked and traced, so the code is verified before the run and checked through it.",
  "scope": "Packaging staff operating the coder to mark packaging (the code prints on the pack, not on the baked product).\n\nMessage-template building, encoder/print-head stitching setup, touchscreen calibration, factory resets, and any cleaning with liquids/chemicals are Maintenance / technical support — not operators.",
  "responsibility": "Operators — load the correct message, verify the code, run, check codes through the run, and cap the cartridge.\nSupervisor — approves the date/lot code for the run before it starts; holds product if codes are wrong.\nMaintenance / technical support (Sneed) — service, resets, print-head/encoder setup, and any chemical cleaning.",
  "procedure": [
    "Before you start: cables secure, then install the ink cartridge — remove the cap, don't touch the nozzles or contacts — and power on. Never remove the cartridge or change a setting while the printer is in print mode; deactivate print mode first.",
    "Load and check the code: from Edit then Manage File, load the correct message for this product/run. Check the date — for a best-by/expiration date use the User-Defined date option with the correct day/month/year offset, because the drop-down date fields only print today's date, not an expiration. Check the lot/batch number and counter (start value and step) are right for the run. After any edit, reload the message (Manage File then Load File) — changes don't take effect until the message is reloaded.",
    "Set the print: choose the trigger (product sensor / photo eye, or automatic mode); set Speed to match the conveyor (smaller value = faster; it stretches or condenses the code); set Interval to move the code left/right to position it on the pack. For barcodes, QR, or data-matrix codes use the encoder wheel so they print square and scannable.",
    "First-article check — verify before you run: print a test pack and confirm the code is complete, legible, and correctly positioned; the best-by date is correct and the lot/batch is correct; and any barcode/QR scans. The Supervisor approves the code for the run. Don't start production until the code checks out.",
    "Run and monitor: activate print mode; the coder prints as packs pass. Check codes periodically through the run — legible, right date, right lot. If a code is wrong, missing, or unreadable: stop, hold the affected packs, fix the cause (reload the message, adjust speed/interval, check the cartridge), re-verify, and tell the Supervisor.",
    "Cartridge care and shutdown: don't run the cartridge dry; when you pause or finish, remove the cartridge and cap it with the plastic clip (protects the nozzles). Shut down with the SHUT DOWN button and follow the on-screen steps — don't just cut power; the proper shutdown protects the cartridge. Do not clean the printer or cartridge with any liquid or chemical without consulting technical support; cap the cartridge when not in use.",
    "If something goes wrong: Code squished or stretched — adjust Speed (larger = slower/stretched, smaller = faster/condensed). Code in the wrong spot — adjust Interval to move it left/right and check the photo-eye hasn't moved. Missing/partial/faint print — check ink level, cartridge seated, nozzles not dried, and the trigger/photo eye. Won't print — is print mode active, the cartridge installed, the cables secure. Edits not showing — reload the message (Manage File then Load File). Barcode/QR won't scan — use the encoder wheel and check it is square and scaled correctly."
  ],
  "form_references": "Production / batch record for the run — the approved date/lot code for the product.",
  "records": "The date and lot code printed for each run identify the product and support traceability. The correct code is set and verified against the production/batch record for the run. Records retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.6.1 (Product Identification), 2.6.2.1 (Product Trace — one step forward / one step back).\nSneed Coding Solutions — SNEED-JET Titan Series User Guide.\nInk cartridge manufacturer's instructions / SDS (handling; the code prints on packaging, not the baked product).",
  "revision_history": "New — 2026-07-26 — Initial issue from the SNEED-JET Titan Series User Guide; one page for floor use. Written around the food-safety point — correct, legible date/lot coding (product identification + traceability): load/verify the message (User-Defined date for a real best-by; lot/counter), set speed/interval/trigger (encoder for barcodes/QR), first-article check with Supervisor approval, monitor through the run, hold packs on a bad code. Cartridge care (cap when idle, no chemical cleaning without technical support) and proper shutdown per the manual. Template/encoder/calibration/reset and chemical cleaning left to Maintenance/Sneed. No separate FRM (the approved code lives on the batch record). Vendor (Sneed-Jet) named."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-603'
);

commit;
