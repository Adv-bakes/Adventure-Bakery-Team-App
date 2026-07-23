# FRM-901 — Mixer Cleaning & Pre-Use Check Log

| | |
|---|---|
| **Document No.** | FRM-901 *(proposed — verify against register)* |
| **Title** | Mixer Cleaning & Pre-Use Check Log |
| **Type** | form |
| **Revision** | Draft B |
| **Effective Date** | *(pending approval)* |
| **Approved By** | *(pending)* |
| **SQF Reference** | 11.2.5.1, 11.2.5.3, 11.2.5.7 |
| **Category** | Sanitation & GMP |
| **Parent procedure** | [SOP-901](SOP-901-hobart-v1401-mixer-ssop.md) |

---

## Purpose

The record that shows SOP-901 actually gets done. One entry per clean.

It's also the release: **the mixer isn't ready for production until the Supervisor signs it.**

## What's on it

**9 fields, 3 sections** — fits on one screen, about a minute to fill in.

| Section | Fields |
|---------|--------|
| **(top)** | Date · Product run · Allergen changeover tick |
| **Cleaning** | 8-step checklist (Done / Notes) · Sanitizer ppm · Cleaned-by signature |
| **Check Before Next Run** | Pre-use check pass/fail · Anything wrong + what was done · Released-by signature |

The 8 checklist steps are SOP-901's procedure, in the order it's performed:

1. Bowl lowered and power unplugged
2. Machine dry wiped — top, levers, down to the footers
3. Machine wet wiped, detergent wiped off, left to air dry
4. Drip cup clean and dry — no oil
5. Bowl broken down, residue removed, rinsed warm, scrubbed with detergent
6. Bowl run through the pan washer on the high-temperature cycle
7. Paddle / whip / dough arm — detergent, rinse, sanitizer, drying rack
8. Allergen changeover: every food contact surface checked under good light *(changeover only)*

### Three things kept deliberately

Everything else got cut. These stayed because an auditor asks for each one by name:

- **Sanitizer ppm** — SQF 11.2.5.3 wants the mixed concentration verified *and recorded*. It's one
  number off a test strip.
- **A signature from someone other than the cleaner** — SQF 11.2.5.7. The `released_by` field is
  verifier-role, so it takes an admin/owner account.
- **The drip cup row** — the planetary sits over the open bowl, so oil there reaches product. It's the
  one line on this form that's about food safety rather than housekeeping.

Entries list shows Date · Product · Sanitizer ppm · Pre-use check, so you can see a month of cleaning
at a glance without opening anything.

## Implementation

Schema: **[`FRM-901-form-schema.json`](FRM-901-form-schema.json)** — validated against
`src/lib/formSchema.ts`.

Either build it in the Form tab's schema builder, or set `content.form_schema` in a migration
following [`20260715000002_frm903_preop_schema.sql`](../supabase/migrations/20260715000002_frm903_preop_schema.sql).

Field ids lock once the first entry is saved, so give them a read first.

`deletable` is `false` — sanitation records are evidence, and a deleted one looks the same as one that
never existed.

## Open items

1. **`FRM-901` is proposed, not verified** — check the live register for a collision (FRM-903/907/908
   are already in the 900 block).
2. **Sanitizer target** — the form captures a ppm reading but states no target. Add your sanitizer's
   label figure so staff have something to read against.

## Revision History

| Rev | Date | Description | Approved By |
|-----|------|-------------|-------------|
| Draft A | 2026-07-23 | Initial draft — 32 fields. | — |
| Draft B | 2026-07-23 | Cut to 9 fields to match the simplified SOP-901. | — |
