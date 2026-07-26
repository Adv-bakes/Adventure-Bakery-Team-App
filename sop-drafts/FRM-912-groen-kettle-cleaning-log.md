# FRM-912 — Kettle Cleaning & Pre-Use Check Log (Groen TDB)

| | |
|---|---|
| **Document No.** | FRM-912 *(proposed — Sanitation forms block; FRM-901–911 taken, 911 is the Beldos depositor)* |
| **Title** | Kettle Cleaning & Pre-Use Check Log (Groen TDB) |
| **Type** | form (fillable) |
| **Revision** | New |
| **SQF Reference** | 11.2.5.1, 11.2.5.3, 11.2.5.7 |
| **Category** | Sanitation & GMP |
| **Governs** | Groen TDB steam-jacketed tilting kettle |

The fillable record for **SOP-904**. One entry per clean: the cleaning checklist, the sanitizer
strength, who cleaned it, and the Supervisor's pre-use release before the next run — the same shape
as the mixer/depositor logs (FRM-909/910/911).

Schema: [`FRM-912-form-schema.json`](FRM-912-form-schema.json).

## Fields

**Entry** — Date (defaults to today) · Product run · Allergen changeover (tick if the next product's
allergens differ).

**Cleaning** — a 7-step checklist (Done + Notes per step):

1. Kettle switched off and power isolated; cooled enough to clean safely (cleaned while still warm)
2. Large food residues scraped and flushed out — non-abrasive brushes only, no metal tools or steel wool
3. Inside and outside washed with detergent at label strength; burned-on soaked, not gouged
4. Rim, pouring lip, cover underside and any baskets/strainers washed; controls and housing wiped (no water in controls)
5. Rinsed thoroughly with hot water and drained completely
6. Sanitized with Noble Sani-512 at 1:512 (1 oz per 4 gal); every surface wet at least 1 min and air-dried — no-rinse
7. Allergen changeover: every food-contact surface checked under good light *(changeover only)*

Then **Sanitizer strength (ppm)** (help text notes Sani-512's 1:512 food-contact mix) and **Cleaned
by** (typed signature).

**Check Before Next Run** — a single pass/fail release check (kettle clean inside and out; rim,
pouring lip, cover and baskets clean; no cleaner or sanitizer residue; sanitized just before use;
jacket water level at the sight-glass midpoint), a free-text box for anything wrong and what was done,
and **Checked and released by** (Supervisor verifier signature).

## Settings

- `deletable: false` — entries are compliance records, not deletable from the UI
- `requireVerification: true` — needs the release signature before it counts as complete
- `attachmentsEnabled: true` — photos/files can be attached to an entry
- Instance title: `{clean_date} — Kettle clean`

## Sanitizer

Confirmed: the site uses **Noble Chemical Sani-512** (a quaternary sanitizer). For **food-contact
surfaces** it's mixed **1:512 — 1 fl oz per 4 gallons (0.25 oz per gallon)** and is **no-rinse**: wet
the surface for at least 1 minute and let it air dry (do **not** rinse it off, and none of the
chlorine "≤30 min on stainless / rinse off" cautions apply). The `sanitizer_ppm` field records the
Sani-512 strength (food-contact mix 1:512).

*(This likely resolves the standing sanitizer-target open item on the depositor forms too — if
Sani-512 is the house sanitizer, FRM-909/910/911 can be updated to the same 1:512 quat guidance.
Left for confirmation.)*
