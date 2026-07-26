# FRM-901 — Master Sanitation Schedule (daily confirmation, fillable)

| | |
|---|---|
| **Document No.** | FRM-901 |
| **Title** | Master Sanitation Schedule |
| **Type** | form (fillable) — added to the existing active record |
| **Category** | Module 11 (Sanitation & GMP) |
| **Record** | `df81e3da-134d-462b-87a0-4a2b3282747f` |

The app version of the Master Sanitation Schedule, built as a **fillable form** so it can be filled
**once per production day** instead of the paper form's row-per-machine-per-day grid. One entry
covers the whole day: for each machine, the filler confirms it was **verified clean & sanitized** per
its SSOP, or marks **Not used today**.

Schema: [`FRM-901-form-schema.json`](FRM-901-form-schema.json).

## Why one record per day

The hardcopy form has a wide grid — a column per machine, a row per day, 24 rows to a page. In the
app that maps cleanly to **one response per day**: the equipment list is the register (rows), the
day's status is the entry. Machines not run that day are marked "Not used today" rather than left
ambiguous. This is the design the owner asked for: *"a confirmation that conveys that the applicable
equipment for today's production has been verified as clean and sanitized."*

## Fields

**Entry** — Production date (defaults to today) · Product / batch run.

**Equipment — Cleaned & Sanitized** — a register grid, one row per machine:

| Column | |
|---|---|
| Equipment | editable label; seeded with the five documented machines + each one's SSOP / log |
| Status | dropdown — **Clean & sanitized** / **Not used today** |
| Notes | free text |

Seeded rows:

1. Hobart V-1401 Mixer — SOP-901 / FRM-909
2. Kook-E-King Depositor — SOP-902 / FRM-910
3. Beldos 275 Depositor — SOP-903 / FRM-911
4. Smipack S560NA Shrink Wrapper — SOP-601
5. Groen TDB Kettle — SOP-904 / FRM-912

Rows are **deletable** and the filler can **Add equipment** — so as more machines get documented,
the list grows without a schema change.

**Confirmation** — **Verified by** (typed signature): *"I confirm the equipment used in today's
production was verified clean and sanitized per its SSOP, and recorded on its cleaning log."*

## Settings

- `deletable: false` — entries are compliance records, not deletable from the UI
- `allowMultipleDrafts: true` — each production day is its own entry
- `attachmentsEnabled: true` — photos/files can be attached to a day's entry
- Instance title: `{log_date} — Daily sanitation confirmation`

## Notes

- The per-machine clean is still recorded on that machine's own log (FRM-909/910/911/912); FRM-901 is
  the **daily roll-up confirmation**, not a replacement for the equipment logs. The Status dropdown
  here attests the equipment log was completed for anything run that day.
- The existing Word/PDF attachments on the record are left in place as the printable version; the
  fillable schema is additive.
