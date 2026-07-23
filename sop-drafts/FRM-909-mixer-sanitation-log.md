# FRM-909 — Mixer Cleaning & Pre-Use Check Log

| | |
|---|---|
| **Document No.** | FRM-909 |
| **Title** | Mixer Cleaning & Pre-Use Check Log |
| **Type** | form |
| **Status** | **Draft — held, not adopted** |
| **Revision** | Draft C |
| **Effective Date** | — |
| **Approved By** | — |
| **SQF Reference** | 11.2.5.1, 11.2.5.3, 11.2.5.7 |
| **Category** | Sanitation & GMP |

---

## ⚠️ This form is not in use

**SOP-901 does not reference it.** The mixer's records were folded into the sanitation forms that
already exist:

| What | Form |
|------|------|
| Cleaning frequency | **FRM-901** Master Sanitation Schedule *(mixer listed as a line)* |
| The clean, incl. sanitizer ppm | **FRM-902** Sanitation Verification Log |
| Check before the next run | **FRM-903** GMP Pre-Operation Inspection |

This draft is kept because it may still be the better answer if the shared forms turn out not to fit —
but adopting it means running a per-machine log, and a bakery this size would then need one per piece
of equipment. **Decide before adopting; don't drift into it.**

`FRM-909` is the next free number in the 900 block (901–908 are all taken). It is reserved here and
should not be handed to anything else while this draft is open.

## What it would be

**9 fields, 3 sections** — about a minute to fill in.

| Section | Fields |
|---------|--------|
| **(top)** | Date · Product run · Allergen changeover tick |
| **Cleaning** | 8-step checklist (Done / Notes) · Sanitizer ppm · Cleaned-by signature |
| **Check Before Next Run** | Pre-use check pass/fail · Anything wrong + what was done · Released-by signature |

The 8 checklist steps are SOP-901's procedure in the order it's performed:

1. Bowl lowered and power unplugged
2. Machine dry wiped — top, levers, down to the footers
3. Machine wet wiped, detergent wiped off, left to air dry
4. Drip cup clean and dry — no oil
5. Bowl broken down, residue removed, rinsed warm, scrubbed with detergent
6. Bowl run through the pan washer on the high-temperature cycle
7. Paddle / whip / dough arm — detergent, rinse, sanitizer, drying rack
8. Allergen changeover: every food contact surface checked under good light *(changeover only)*

### Three things kept deliberately

- **Sanitizer ppm** — SQF 11.2.5.3 wants the mixed concentration verified *and recorded*.
- **A signature from someone other than the cleaner** — SQF 11.2.5.7. `released_by` is verifier-role,
  so it takes an admin/owner account.
- **The drip cup row** — the planetary sits over the open bowl, so oil there reaches product. The one
  line on this form about food safety rather than housekeeping.

## Implementation, if it is ever adopted

Schema: **[`FRM-909-form-schema.json`](FRM-909-form-schema.json)** — validated against
`src/lib/formSchema.ts`.

Either build it in the Form tab's schema builder, or set `content.form_schema` in a migration
following [`20260715000002_frm903_preop_schema.sql`](../supabase/migrations/20260715000002_frm903_preop_schema.sql).

Field ids lock once the first entry is saved, so read them first. `deletable` is `false` — sanitation
records are evidence, and a deleted one looks the same as one that never existed.

Before adopting, set the sanitizer target: the form captures a ppm reading but states no target. Add
your sanitizer's label figure so staff have something to read against.

## Revision History

| Rev | Date | Description | Approved By |
|-----|------|-------------|-------------|
| Draft A | 2026-07-23 | Initial draft — 32 fields, numbered FRM-901. | — |
| Draft B | 2026-07-23 | Cut to 9 fields to match the simplified SOP-901. | — |
| Draft C | 2026-07-23 | Renumbered FRM-901 → FRM-909 (FRM-901 is the live Master Sanitation Schedule). Held unadopted: SOP-901 now uses FRM-901/902/903. | — |
