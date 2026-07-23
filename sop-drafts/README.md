# Equipment SOP / SSOP Drafts

Working drafts of equipment procedures, held here for redline **before** they enter the quality
system. Nothing in this folder is controlled — a document is only controlled once it exists as a
`sop_documents` row with a revision and an effective date.

## Current drafts — Hobart V-1401 Planetary Mixer

| Draft | Number | Type | Purpose |
|-------|--------|------|---------|
| [SOP-501](SOP-501-hobart-v1401-mixer-operation.md) | `SOP-501` | sop | Safe operation of the mixer |
| [SOP-901](SOP-901-hobart-v1401-mixer-ssop.md) | `SOP-901` | sop | Sanitation (SSOP) — cleaning & sanitizing |
| [FRM-909](FRM-909-mixer-sanitation-log.md) | `FRM-909` | form | **Held, not adopted** — see below |

### Write to the process that's actually performed

SOP-901 was rewritten at Rev B to document the cleaning the floor actually does — machine wiped down
dry then wet, bowl scrubbed and run through the pan washer, agitators washed and sanitized in the
sink — rather than a generic full-plant sanitation program. A procedure nobody follows is worse than
no procedure: it fails an audit *and* it teaches staff that the documents are theatre. Keep new
equipment SSOPs to one page and to the real steps.

### Numbers — checked against the live register 2026-07-23

`SOP-501` and `SOP-901` are **free**; no `SOP-5xx` or `SOP-9xx` exists.

`FRM-901` was **taken** — it is the live *Master Sanitation Schedule*. The whole 900 form block is in
use (901 Master Sanitation Schedule · 902 Sanitation Verification Log · 903 GMP Pre-Operation
Inspection · 904 GMP Daily Operation Check · 905/906 Visitor · 907/908 Glass), so the draft form was
renumbered to the next free slot, **`FRM-909`**.

Note the deliberate choice **not** to use the SQF-clause SOP scheme (`SOP-11.2.5`) for these two.
That scheme allows exactly one SOP per clause; every piece of equipment in the plant needs its own
sanitation procedure, so they would all collide on `11.2.5`. Equipment procedures therefore use the
stage-block scheme, and cross-refer to SQF through the `sqf_reference` field instead. This matches
how the register already treats forms and manuals.

### Records use the existing sanitation forms

SOP-901 does **not** introduce a mixer-specific log. The register already carries the three forms it
needs, so the mixer is folded into them:

| What | Form |
|------|------|
| Cleaning frequency | `FRM-901` Master Sanitation Schedule — add the mixer as a line |
| The clean, incl. sanitizer ppm | `FRM-902` Sanitation Verification Log |
| Check before the next run | `FRM-903` GMP Pre-Operation Inspection |
| Allergen changeover | `SOP-204` Allergen Cleaning Procedure |

`FRM-909` is kept as a **held draft** in case the shared forms turn out not to fit. Adopting it means
running a per-machine log — and then one per piece of equipment. It is a decision, not a default.

### SOP-501 has an existing home — don't create a second record

`The Mixing Station` already exists in the register: active, type `sop`, category Job-Specific
Operations, **unnumbered**, and holding only the Hobart V1401 manual PDF and a mixer video link — an
empty shell around the manual. Assign it `SOP-501` and write the SOP-501 body into it. Creating a
new record would leave two active mixer documents and no way for staff to tell which governs.

## Findings that need an owner decision

These came out of writing the procedures. None is fixed by the drafts — all are decisions above the
level of a procedure, and the first two are called out in the documents themselves.

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

### 3. Two broken references in the existing `SOP-204` (spotted in passing)

Not part of this work, but found while checking the register on 2026-07-23. `SOP-204 Allergen
Cleaning Procedure` (draft) is the document SOP-901 now cross-refers to for allergen changeover, so
it is worth correcting before either goes active:

- Its Form References point to *"FRM-204 Allergen Changeover Log"* — but `FRM-204` in the live
  register is the **Annual Supplier Performance Evaluation Checklist**. The changeover log it means
  either has a different number or does not exist.
- Its Governing Reference cites **SQF 11.2.3** as "Allergen Management". In Edition 9, 11.2.3 is
  **Calibration**; allergen management is **2.8.1**. A wrong clause sends an auditor to the wrong
  page — the same class of defect as the `SOP-11.7.5` → `SOP-11.7.3` renumber.

## Source material

- Hobart **Form 13966A** Rev. 6-82 — *Instruction Manual with Replacement Parts, Model V-1401 Series
  Mixers*. The manual supplied for this machine; scanned, image-only.
- Hobart **Form 33785** Rev. B (June 2001) — *M802 & V1401 Mixers, Installation, Operation and Care*.
  Later factory revision of the same model line. Used for content that survives into the current
  build (bowl/agitator pre-use wash, agitator clearance, troubleshooting) and to establish what the
  guarded configuration looks like. **Where the two manuals differ, the 1982 manual governs**, since
  it matches the machine in the plant — the one place this matters is agitator clearance (see
  SOP-501 §Procedure).
