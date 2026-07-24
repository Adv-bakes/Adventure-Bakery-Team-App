# FRM-909 — Mixer Cleaning & Pre-Use Check Log

| | |
|---|---|
| **Document No.** | FRM-909 |
| **Title** | Mixer Cleaning & Pre-Use Check Log |
| **Type** | form |
| **Status** | **Draft** *(pending approval to activate)* |
| **Revision** | Draft D |
| **Effective Date** | *(pending approval)* |
| **Approved By** | *(pending)* |
| **SQF Reference** | 11.2.5.1, 11.2.5.3, 11.2.5.7 |
| **Category** | Sanitation & GMP |
| **Parent procedure** | [SOP-901](SOP-901-hobart-v1401-mixer-ssop.md) |

---

## This is the mixer's sanitation record

SOP-901 records the clean **and** its pre-use release on this one form. It's used rather than the
existing plant forms because none of them could take the record:

| Form | Why not |
|------|---------|
| FRM-901 Master Sanitation Schedule | A Word-document attachment — not fillable in the app |
| FRM-902 Sanitation Verification Log | Same — a Word-document attachment |
| FRM-903 GMP Pre-Operation Inspection | Fillable, but scoped to the glass dial cover / MIG thermometer check (SQF 11.7.3.4), not sanitation release |

The mixer should still be listed on the **FRM-901 Master Sanitation Schedule** for its cleaning
*frequency* — that's a plant-wide schedule and belongs there — but the per-clean record and the
release live here.

`FRM-909` is the next free number in the 900 block (901–908 are all taken).

**Status stays `draft`.** Activating it (and SOP-501/SOP-901 with it) is an approval decision, not
something the migration does.

## What it is

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

## Implementation

Schema: **[`FRM-909-form-schema.json`](FRM-909-form-schema.json)** — validated against
`src/lib/formSchema.ts`.

Seeded by migration
[`20260724000001_frm909_mixer_sanitation_log.sql`](../supabase/migrations/20260724000001_frm909_mixer_sanitation_log.sql),
which **inserts** the `sop_documents` row (FRM-909 doesn't exist yet) as `status='draft'` with the
schema on `content.form_schema`. Modelled on
[`20260715000002_frm903_preop_schema.sql`](../supabase/migrations/20260715000002_frm903_preop_schema.sql),
which merged a schema into an existing row.

Field ids lock once the first entry is saved, so read them first. `deletable` is `false` — sanitation
records are evidence, and a deleted one looks the same as one that never existed.

Before **activating**, set the sanitizer target: the form captures a ppm reading but states no target.
Add your sanitizer's label figure so staff have something to read against.

## Revision History

| Rev | Date | Description | Approved By |
|-----|------|-------------|-------------|
| Draft A | 2026-07-23 | Initial draft — 32 fields, numbered FRM-901. | — |
| Draft B | 2026-07-23 | Cut to 9 fields to match the simplified SOP-901. | — |
| Draft C | 2026-07-23 | Renumbered FRM-901 → FRM-909 (FRM-901 is the live Master Sanitation Schedule). Held unadopted: SOP-901 then used FRM-901/902/903. | — |
| Draft D | 2026-07-24 | Adopted as the mixer's sanitation record — FRM-901/902 are Word attachments (not fillable) and FRM-903 is a glass check, so none could hold it. SOP-901 references it again. Insert migration written; status stays draft pending approval. | — |
