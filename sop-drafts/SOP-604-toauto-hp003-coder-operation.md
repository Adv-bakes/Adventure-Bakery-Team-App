# SOP-604 — Operating the Handheld Coder / Date & Lot Printer (TOAUTO HP-003)

| | |
|---|---|
| **Document No.** | SOP-604 *(proposed — Packaging & Labeling block; SOP-603 is the SNEED-JET Titan coder)* |
| **Title** | Operating the Handheld Coder / Date & Lot Printer (TOAUTO HP-003) |
| **Type** | sop |
| **Revision** | Draft A |
| **Effective Date** | *(pending approval)* |
| **Approved By** | *(pending)* |
| **SQF Reference** | 2.6.1, 2.6.2.1 |
| **Category** | Job-Specific Operations |

*Machine: TOAUTO HP-003 (SG-HP-003) handheld thermal-inkjet coder — prints **date, lot/batch, counter,
barcode and QR** onto packaging from a 70 ml ink cartridge. Battery-powered, 600 DPI, touchscreen.
Used **handheld** (roll it along the pack) **or mounted on the line** with a photo-eye.*

---

## Purpose

To print a **correct, legible date and lot code** (and any barcode/QR) on every pack.

**One rule drives this SOP: a wrong, missing, or unreadable code is a labeling defect.** The best-by
date and lot code are how product is date-marked and traced, so the code is **verified before the run
and checked through it.** (Companion to **SOP-603**, the SNEED-JET Titan coder — same job, different
machine.)

## Scope

Packaging staff operating the TOAUTO HP-003 to mark **packaging** (the code prints on the pack, not on
the baked product), handheld or line-mounted.

Message-template building, touchscreen calibration, factory reset, nozzle-voltage changes, and
firmware updates are **Maintenance / technical support** — not operators.

## Responsibility

- **Operators** — load the correct message, verify the code, run, check codes through the run, and cap
  the cartridge.
- **Supervisor** — approves the **date/lot code for the run** before it starts; holds product if codes
  are wrong.
- **Maintenance / technical support** — calibration, factory reset, nozzle/firmware, and deep service.

## Procedure

### Before you start

- **Load the ink cartridge with the printer OFF** — never insert or remove a cartridge while it's
  powered on. **Lock the cartridge** after seating it; **don't touch the nozzles**. Check the battery
  is charged.
- Power on and **confirm the Date & Time (clock) is correct** — it drives the auto-date, so a wrong
  clock prints a wrong date.

### 1. Load and check the code

1. **Open** the correct saved message (or **New** to build one) for this product/run.
2. Check the **date** field prints the **correct date/best-by** in the required format (the machine's
   clock feeds the auto-date — verify it).
3. Check the **counter** (initial value, step, digits) and any **lot/batch** text are right for the
   run.
4. **Save** the message so your settings take effect.

### 2. Choose how it prints and set it up

Pick the trigger for how you're running it:

- **Handheld:** roll the printer along the pack in a **straight line, no downward force**, holding the
  **2–5 mm** print gap — pressing down or an uneven surface causes scratches/streaks.
- **Line-mounted (photo-eye):** mount the **photo-eye 5–40 cm in front** of the printer; in **Print
  Settings** set **Sync mode = Timer**, **Start signal = Photoelectric switch**, set the **timing
  speed to the conveyor speed**, and adjust the **photoelectric delay** to position the code.
- **Manual** (press to print) or **Distance/encoder** as needed.

Set **Print Darkness** for a clear code; for **barcodes/QR** use the **encoder** so they print square
and scannable.

### 3. First-article check — verify before you run

Print a **test pack** and confirm:

- The code is **complete, legible, and correctly positioned**
- The **date/best-by is correct** and the **lot/batch is correct**
- Any **barcode/QR scans**

**The Supervisor approves the code for the run.** Don't start production until the code checks out.

### 4. Run and monitor

Run the job and **check codes periodically** — legible, right date, right lot. If a code is **wrong,
missing, or unreadable: stop, hold the affected packs**, fix the cause (see below), re-verify, and tell
the Supervisor.

### 5. Cartridge care and shutdown

- **Cap the cartridge when idle**; once opened, use it within **3–4 months**. A cartridge with **no
  water sound when shaken is empty.**
- **Clogged/faint nozzle:** print on scrap a few times, wipe the nozzle with an **alcohol** swab, or
  switch to the **other nozzle** (left/right) in the nozzle settings.
- **Turn the printer off before removing the cartridge.** **Do not run a factory Reset** (it erases all
  messages and settings) — that's Maintenance only.

## If something goes wrong

| Problem | What to do |
|---------|-----------|
| Faint / unclear print | Raise **Print Darkness**; clean the nozzle with alcohol; switch to the other nozzle. |
| Scratched / streaked / deformed print | Flatten the surface, don't press down, move in a **straight line**, hold the **2–5 mm** distance. |
| Line: hears a "drip" but nothing prints | **Photoelectric delay** is off — reduce it / move the photo-eye closer, or match the timing speed to the line. |
| Won't print | Cartridge **locked** and not empty? Powered on? **Start signal** set (photo-eye / manual)? Nozzle not clogged? |
| Edits not showing | **Save** the message (and reload it). |
| Barcode/QR won't scan | Use the **encoder**; keep it square and correctly scaled. |

## Form References

- Production / batch record for the run — the **approved date/lot code** for the product

## Records

The **date and lot code** printed for each run identify the product and support traceability. The
correct code is set and verified against the production/batch record for the run. Records retained per
the record retention policy.

## Governing Reference

- SQF Food Safety Code: Food Manufacturing, Edition 9 — **2.6.1** (Product Identification), **2.6.2.1**
  (Product Trace — one step forward / one step back)
- TOAUTO / Shenzhen Fast To Buy — *HP-003 (SG-HP-003) Handheld Inkjet Printer User's Manual*
- Ink cartridge manufacturer's instructions / SDS; isopropyl alcohol SDS (nozzle cleaning — flammable).
  The code prints on packaging, not the baked product.

## Revision History

| Rev | Date | Description | Approved By |
|-----|------|-------------|-------------|
| Draft A | 2026-07-26 | Initial draft from the TOAUTO HP-003 (SG-HP-003) Handheld Inkjet Printer User's Manual; one page for floor use. Second coder (companion to SOP-603 Titan), same food-safety point — correct, legible date/lot coding (product identification + traceability): open/verify the message, confirm the clock feeds the right date, check counter/lot, choose the trigger (handheld straight-line no-press, or line-mounted photo-eye with timer sync and delay; encoder for barcodes/QR), first-article check with Supervisor approval, monitor through the run, hold packs on a bad code. Cartridge loaded/removed only with power OFF and locked; cap when idle, use within 3–4 months; nozzle cleaning with alcohol; no factory reset (erases all) by operators. Template/calibration/reset/firmware left to Maintenance. No separate FRM (the approved code lives on the batch record). Vendor (TOAUTO) named. | — |
