# FRM-910 — Depositor Cleaning & Pre-Use Check Log

| | |
|---|---|
| **Document No.** | FRM-910 *(proposed — Sanitation forms block; FRM-901–909 taken, 909 is the mixer)* |
| **Title** | Depositor Cleaning & Pre-Use Check Log |
| **Type** | form (fillable) |
| **Revision** | New |
| **SQF Reference** | 11.2.5.1, 11.2.5.3, 11.2.5.7 |
| **Category** | Sanitation & GMP |
| **Governs** | Rhodes Kook-E-King® Super Automatic cookie depositor (after serial 07SA-2002) |

The fillable record for **SOP-902**. One entry per clean: the cleaning checklist, the sanitizer
strength, who cleaned it, and the Supervisor's pre-use release before the next run — the same shape
as the mixer's **FRM-909**.

Schema: [`FRM-910-form-schema.json`](FRM-910-form-schema.json).

## Fields

**Entry** — Date (defaults to today) · Product run · Allergen changeover (tick if the next product's
allergens differ).

**Cleaning** — an 8-step checklist (Done + Notes per step):

1. Wire clear of the die, machine unplugged; guards opened
2. Hopper, feed rollers, die and scrapers removed
3. Cut-off wire and support fingers wiped clean in place (not removed)
4. Head interior, die slot, cabinet and belts dry-then-damp wiped (no water on the panel)
5. Hopper, feed rollers, die and scrapers washed in the sink — detergent, rinse, Sani-512 (1:512, no-rinse), drying rack
6. Cut-off wire whole and accounted for — no missing pieces
7. Reassembled: die finger-tight in a clean slot, a finger in each die slot, guards locked
8. Allergen changeover: every food-contact surface checked under good light *(changeover only)*

Then **Sanitizer strength (ppm)** (Sani-512, food-contact mix 1:512), and **Cleaned by** (typed signature).

**Check Before Next Run** — a single pass/fail release check (parts clean and dry, wire whole and
accounted for, guards locked, nothing left on the machine), a free-text box for anything wrong and
what was done, and **Checked and released by** (Supervisor verifier signature).

## Settings

- `deletable: false` — entries are compliance records, not deletable from the UI
- `requireVerification: true` — needs the release signature before it counts as complete
- `attachmentsEnabled: true` — photos/files can be attached to an entry
- Instance title: `{clean_date} — Depositor clean`

## Notes before activation

- **Set a sanitizer ppm target.** The form records the strip reading; SOP-902 / FRM-910 should state
  the label-strength target for the sanitizer in use so the reading can be judged (same open item as
  FRM-909).
