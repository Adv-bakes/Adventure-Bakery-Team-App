# FRM-911 — Depositor Cleaning & Pre-Use Check Log (Beldos 275)

| | |
|---|---|
| **Document No.** | FRM-911 *(proposed — Sanitation forms block; FRM-901–910 taken, 910 is the KEK depositor)* |
| **Title** | Depositor Cleaning & Pre-Use Check Log (Beldos 275) |
| **Type** | form (fillable) |
| **Revision** | New |
| **SQF Reference** | 11.2.5.1, 11.2.5.3, 11.2.5.7 |
| **Category** | Sanitation & GMP |
| **Governs** | Beldos 275-series pneumatic piston depositor |

The fillable record for **SOP-903**. One entry per clean: the cleaning checklist, the sanitizer
strength, who cleaned it, and the Supervisor's pre-use release before the next run — the same shape
as the mixer's FRM-909 and the KEK depositor's FRM-910.

Schema: [`FRM-911-form-schema.json`](FRM-911-form-schema.json).

## Fields

**Entry** — Date (defaults to today) · Product run · Allergen changeover (tick if the next product's
allergens differ).

**Cleaning** — an 8-step checklist (Done + Notes per step):

1. Machine and air supply off; air line disconnected and pressure bled
2. Depositor fully disassembled — nozzle, hopper, rotation cylinder, hopper block, product cylinder, piston
3. All seals / O-rings removed from every part
4. Product-contact parts and seals washed in the sink — detergent, rinse, sanitizer at label strength, drying rack
5. Machine body and air cylinders wiped only — not submerged
6. Every seal inspected for wear; worn or damaged seals replaced
7. Reassembled — seals greased with food-approved grease, clamps tight, correct nozzle fitted
8. Allergen changeover: every food-contact surface checked under good light *(changeover only)*

Then **Sanitizer strength (ppm)** from a test strip, and **Cleaned by** (typed signature).

**Check Before Next Run** — a single pass/fail release check (parts clean and dry, seals inspected /
worn ones replaced / none torn or missing a piece, clamps tight, correct nozzle fitted, nothing left
on the machine), a free-text box for anything wrong and what was done, and **Checked and released
by** (Supervisor verifier signature).

## Settings

- `deletable: false` — entries are compliance records, not deletable from the UI
- `requireVerification: true` — needs the release signature before it counts as complete
- `attachmentsEnabled: true` — photos/files can be attached to an entry
- Instance title: `{clean_date} — Beldos 275 clean`

## Notes before activation

- **Set a sanitizer ppm target.** The form records the strip reading; SOP-903 / FRM-911 should state
  the label-strength target for the sanitizer in use so the reading can be judged (same open item as
  FRM-909 / FRM-910).
