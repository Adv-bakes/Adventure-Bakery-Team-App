# SOP-603 — Operating the Coder / Date & Lot Printer (SNEED-JET Titan)

| | |
|---|---|
| **Document No.** | SOP-603 *(proposed — Packaging & Labeling block; SOP-601 shrink wrapper, SOP-602 band sealer)* |
| **Title** | Operating the Coder / Date & Lot Printer (SNEED-JET Titan) |
| **Type** | sop |
| **Revision** | Draft A |
| **Effective Date** | *(pending approval)* |
| **Approved By** | *(pending)* |
| **SQF Reference** | 2.6.1, 2.6.2.1 |
| **Category** | Job-Specific Operations |

*Machine: SNEED-JET Titan thermal-inkjet (TIJ) coder — prints the **best-by date, lot/batch number,
counters, barcodes and QR codes** onto packaging from an ink cartridge. 7" touchscreen; prints on a
product sensor or in automatic mode; optional encoder wheel for barcodes/QR.*

---

## Purpose

To print a **correct, legible date and lot code** (and any barcode/QR) on every pack.

**One rule drives this SOP: a wrong, missing, or unreadable code is a labeling defect.** The best-by
date and lot code are how product is date-marked and traced, so the code is **verified before the run
and checked through it.**

## Scope

Packaging staff operating the coder to mark **packaging** (the code prints on the pack, not on the
baked product).

Message-template building, encoder/print-head stitching setup, touchscreen calibration, factory
resets, and any cleaning with liquids/chemicals are **Maintenance / technical support** — not
operators.

## Responsibility

- **Operators** — load the correct message, verify the code, run, check codes through the run, and cap
  the cartridge.
- **Supervisor** — approves the **date/lot code for the run** before it starts; holds product if codes
  are wrong.
- **Maintenance / technical support (Sneed)** — service, resets, print-head/encoder setup, and any
  chemical cleaning.

## Procedure

### Before you start

- **Cables secure**, then **install the ink cartridge** — remove the cap, **don't touch the nozzles or
  contacts** — and power on.
- **Never remove the cartridge or change a setting while the printer is in "print mode"** — deactivate
  print mode first.

### 1. Load and check the code

1. From **Edit → Manage File**, **load the correct message** for this product/run.
2. Check the **date**: for a **best-by/expiration** date use the **User-Defined** date option with the
   correct **day/month/year offset** — the drop-down date fields only print **today's** date, not an
   expiration.
3. Check the **lot/batch number and counter** (start value and step) are right for the run.
4. After **any** edit, **reload the message** (Manage File → Load File) — changes don't take effect
   until the message is reloaded.

### 2. Set the print

- **Trigger:** product sensor (photo eye) or automatic mode.
- **Speed:** match the conveyor — smaller value = faster; it stretches or condenses the code.
- **Interval:** moves the code left/right to position it on the pack.
- **Barcodes / QR / data-matrix:** use the **encoder wheel** so they print square and scannable.

### 3. First-article check — verify before you run

Print a **test pack** and confirm:

- The code is **complete, legible, and correctly positioned**
- The **best-by date is correct** and the **lot/batch is correct**
- Any **barcode/QR scans**

**The Supervisor approves the code for the run.** Don't start production until the code checks out.

### 4. Run and monitor

Activate **print mode**; the coder prints as packs pass. **Check codes periodically** through the run —
legible, right date, right lot. If a code is **wrong, missing, or unreadable: stop, hold the affected
packs**, fix the cause (reload the message, adjust speed/interval, check the cartridge), re-verify, and
tell the Supervisor.

### 5. Cartridge care and shutdown

- Don't run the cartridge **dry**. When you pause or finish, **remove the cartridge and cap it** with
  the plastic clip (protects the nozzles).
- **Shut down with the "SHUT DOWN" button and follow the on-screen steps** — don't just cut power; the
  proper shutdown protects the cartridge.
- **Do not clean the printer or cartridge with any liquid or chemical without consulting technical
  support** — cap the cartridge when not in use.

## If something goes wrong

| Problem | What to do |
|---------|-----------|
| Code squished or stretched | Adjust **Speed** (larger = slower/stretched, smaller = faster/condensed). |
| Code in the wrong spot | Adjust **Interval** to move it left/right; check the photo-eye position hasn't moved. |
| Missing / partial / faint print | Check ink level, cartridge seated, nozzles not dried/capped; check the trigger/photo eye. |
| Won't print | Print mode active? Cartridge installed? Cables secure? |
| Edits not showing | **Reload the message** (Manage File → Load File). |
| Barcode/QR won't scan | Use the **encoder wheel**; check it's square and scaled correctly. |

## Form References

- Production / batch record for the run — the **approved date/lot code** for the product

## Records

The **date and lot code** printed for each run identify the product and support traceability. The
correct code is set and verified against the production/batch record for the run. Records retained per
the record retention policy.

## Governing Reference

- SQF Food Safety Code: Food Manufacturing, Edition 9 — **2.6.1** (Product Identification), **2.6.2.1**
  (Product Trace — one step forward / one step back)
- Sneed Coding Solutions — *SNEED-JET Titan Series User Guide*
- Ink cartridge manufacturer's instructions / SDS (handling; the code prints on packaging, not the
  baked product)

## Revision History

| Rev | Date | Description | Approved By |
|-----|------|-------------|-------------|
| Draft A | 2026-07-26 | Initial draft from the SNEED-JET Titan Series User Guide; one page for floor use. Written around the food-safety point — correct, legible date/lot coding (product identification + traceability): load/verify the message (User-Defined date for a real best-by; lot/counter), set speed/interval/trigger (encoder for barcodes/QR), first-article check with Supervisor approval, monitor through the run, hold packs on a bad code. Cartridge care (cap when idle, no chemical cleaning without technical support) and proper shutdown per the manual. Template/encoder/calibration/reset and chemical cleaning left to Maintenance/Sneed. No separate FRM (the approved code lives on the batch record). Vendor (Sneed-Jet) named. | — |
