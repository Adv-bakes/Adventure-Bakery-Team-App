# Equipment SOP / SSOP Drafts

Working drafts of equipment procedures, held here for redline **before** they enter the quality
system. Nothing in this folder is controlled — a document is only controlled once it exists as a
`sop_documents` row with a revision and an effective date.

## Current drafts — Hobart V-1401 Planetary Mixer

| Draft | Proposed number | Type | Purpose |
|-------|-----------------|------|---------|
| [SOP-501](SOP-501-hobart-v1401-mixer-operation.md) | `SOP-501` | sop | Safe operation of the mixer |
| [SOP-901](SOP-901-hobart-v1401-mixer-ssop.md) | `SOP-901` | sop | Sanitation (SSOP) — cleaning & sanitizing |
| [FRM-901](FRM-901-mixer-sanitation-log.md) | `FRM-901` | form | Cleaning & pre-use record |

### Write to the process that's actually performed

SOP-901 and FRM-901 were rewritten at Rev B to document the cleaning the floor actually does —
machine wiped down dry then wet, bowl scrubbed and run through the pan washer, agitators washed and
sanitized in the sink — rather than a generic full-plant sanitation program. A procedure nobody
follows is worse than no procedure: it fails an audit *and* it teaches staff that the documents are
theatre. Keep new equipment SSOPs to one page and to the real steps.

### ⚠️ Numbers are proposed, not verified

They follow the stage-block scheme in [DOCUMENT_REGISTER.md](../DOCUMENT_REGISTER.md) — 500s
Production & Batching, 900s Sanitation & GMP — but **have not been checked against the live
register for collisions.** Confirm at `/team/compliance/register` (or a prod read) before these are
imported, and renumber here if taken.

Note the deliberate choice **not** to use the SQF-clause SOP scheme (`SOP-11.2.5`) for these two.
That scheme allows exactly one SOP per clause; every piece of equipment in the plant needs its own
sanitation procedure, so they would all collide on `11.2.5`. Equipment procedures therefore use the
stage-block scheme, and cross-refer to SQF through the `sqf_reference` field instead. This matches
how the register already treats forms and manuals.

## Two findings that need an owner decision

These came out of writing the procedures. Neither is fixed by the drafts — both are decisions above
the level of a procedure, and both are called out in the documents themselves.

### 1. The mixer has no bowl guard (OSHA 1910.212)

The machine is the pre-guard 1982 build (Form 13966A, ML-19668 / 19670 / 19669 / 19671). Hobart's
own later manual for the same model carries the warning that the mixer is not to be used without the
interlocked guard, and OSHA's [enforcement policy on vertical food
mixers](https://www.osha.gov/laws-regs/standardinterpretations/1999-02-26) routes these machines to
the general machine-guarding standard §1910.212(a)(1) and (a)(3)(ii) — the bakery standard 1910.263
does not cover the hazard.

The load-bearing part of that policy for us: **work practices are not accepted in lieu of machine
guarding where guarding is feasible.** A field-retrofit bowl guard with a pre-mounted interlock
micro-switch and wiring harness is sold for this exact model (Hobart `00-875820`), which makes
guarding demonstrably feasible here. SOP-501 is written to control the hazard by procedure in the
meantime, but procedure alone is not a compliant end state.

**Decision needed:** retrofit `00-875820` (installation and electrical hook-up by a qualified
technician — the kit is fitted to a machine not originally designed for it, so drilling is involved),
or replace the unit.

### 2. The specified lubricants are not food-grade (SQF 11.2.1.7)

The manual specifies Gearep #85 for the planetary, Gearep #140 for the transmission, and Havoline #10
for the bowl-lift oilers. None are H1 food-grade. The planetary sits **directly over the open bowl** —
the drip cup exists precisely because oil can weep down the agitator shaft.

SQF 11.2.1.7 requires that food contact equipment *and equipment located over food contact equipment*
be lubricated with food-grade lubricant. As specified, the planetary lubrication is a
non-conformance.

**Decision needed:** cross-reference an H1 equivalent for the planetary at minimum, via Hobart Service
or the lubricant supplier, and update the maintenance schedule and approved-chemicals list. Until
then, treat drip-cup inspection as a food safety check rather than housekeeping — SOP-901 does.

## Source material

- Hobart **Form 13966A** Rev. 6-82 — *Instruction Manual with Replacement Parts, Model V-1401 Series
  Mixers*. The manual supplied for this machine; scanned, image-only.
- Hobart **Form 33785** Rev. B (June 2001) — *M802 & V1401 Mixers, Installation, Operation and Care*.
  Later factory revision of the same model line. Used for content that survives into the current
  build (bowl/agitator pre-use wash, agitator clearance, troubleshooting) and to establish what the
  guarded configuration looks like. **Where the two manuals differ, the 1982 manual governs**, since
  it matches the machine in the plant — the one place this matters is agitator clearance (see
  SOP-501 §Procedure).
