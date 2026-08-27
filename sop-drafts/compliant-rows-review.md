# Review of the "Compliant" rows — SQF Ed 9 gap assessment

**Date:** 2026-08-26 · **Reviewed:** all 41 rows scored Compliant (29 System Elements, 12 Module 11)
· **Method:** every cited document read out of the live system and tested against the clause text.

## Why this review exists

Clause **11.2.5.1** was scored Compliant on the evidence *"Adventure Bakery has written several
Cleaning SOPs that cover the equipment that is used to process food at the site."* On 2026-08-25 the
molds — the most product-intimate surface in the plant — turned out to have no documented cleaning
method at all. The score was not wrong about the documents existing. It was wrong about what they
covered.

That is a pattern, not an incident: **a document was named, and the clause was closed without
testing the document against it.** This review applies that test to every Compliant row.

## Result

**23 of the 41 rows do not hold up as scored.** A further 3 are conditional on work already
scheduled. 15 hold up.

A Compliant score generates no task, so none of these gaps were visible anywhere in the remediation
plan.

---

## A. Scored Compliant on a document that is still a draft — 9 rows

| Clause | Document | Status |
|---|---|---|
| 2.1.1.1 | FSQM-002 Food Safety & Quality Policy | draft |
| 2.1.2.2 | FSQM-005 Management Review | draft, revision `-` |
| 2.2.2.1, 2.2.3.2, 2.2.3.3 | FSQM-008 Document & Record Control | draft, revision `-` |
| 2.4.5.1 | FSQM-018 Non-Conforming Product & Equipment | draft |
| 2.4.6.1, 2.8.1.10 | FSQM-019 Rework | draft |
| 2.8.1.4 | SOP-204 Allergen Cleaning | draft |

**All eight FSQM documents are `draft`** while every SOP and FRM in the system is `active`, so the
site does draw the distinction — these have simply never been approved and issued. An unapproved
draft is not an implemented document, which is what every one of these clauses asks for.

Two of them carry **no revision number at all** (`-`), and one of those two is **FSQM-008, the
document-control procedure itself**. The document that defines revision control has no revision.

## B. The recorded evidence states the gap, and the row was scored Compliant anyway — 3 rows

| Clause | The evidence, verbatim |
|---|---|
| **2.3.4.6** | *"Adventure Bakery has **not done** a complete evaluation of the suppliers to determine whether audits need to be performed."* |
| **2.4.3.15** | *"Verification procedures have all the required elements, **although some of the CCPs are not appropriate**."* |
| **2.4.3.17** | *"…the Food Safety Plan **has not been developed** following the applicable US regulatory requirements… Adventure Bakery **might** fall under the rule exemption."* |

Add **2.1.1.1**, whose evidence claims compliance with *"2.1.1. i-iv"* of a clause that has six parts.
Parts v and vi are the signature, the display, and the communication in languages understood by
staff. Reading FSQM-002: **no signature block, no display provision, no language provision.**

These four are scoring errors on the face of the file and should go back to the consultant rather
than be silently re-scored here.

## C. One evidence paragraph pasted across nine clauses, covering five it does not address — 5 rows

Nine `11.7.3.x` rows carry a **byte-identical** evidence paragraph naming SOP-11.7.3 (Glass & Brittle
Plastic Control), FRM-903, FRM-907 and FRM-908. SOP-11.7.3 is 2,062 characters and covers glass,
hard/brittle plastic and ceramic — nothing else.

| Clause | Requires | Covered? |
|---|---|---|
| 11.7.3.2 | Glass inventory with location and condition | ✅ FRM-907 |
| 11.7.3.3 | Regular inspection against the register | ✅ monthly, FRM-907 |
| 11.7.3.4 | Dial covers / MIG thermometers checked each shift | ✅ FRM-903 §4 |
| 11.7.3.5 | Breakage isolation, clean, clear before restart | ✅ FRM-908 |
| **11.7.3.1** | Foreign matter prevention **generally**, communicated to all staff | ⚠️ glass only — a subset |
| **11.7.3.6** | Wooden pallets dedicated, clean, inspected | ❌ **nothing** |
| **11.7.3.7** | Loose metal removed or tightly fixed | ❌ **nothing site-wide** |
| **11.7.3.8** | Knives controlled; **snap-off blades prohibited** | ❌ **nothing** |
| **11.7.3.9** | Gaskets, impellers, wear items inspected on a frequency | ❌ **nothing** |

Searched across every non-training document in the system. The only hits are incidental: FRM-901
schedules cleaning *under* pallets (not pallet condition); SOP-502 cites 11.7.3.7 for one machine;
SOP-605 mentions the flow wrapper's own end-seal knives; gaskets appear inside individual machine
cleaning steps. None is the site-wide control the clause asks for.

**The register cannot even hold the missing items.** FRM-907's Material column offers exactly two
options — `Glass` and `Plastic`. Wood and metal cannot be recorded on it.

## D. The site's own equipment register contradicts the score — 2 rows

**11.2.5.1** (cleaning methods documented) and **11.1.7.7** (equipment and utensils cleaned after use)
are both Compliant on *"several Cleaning SOPs."* FRM-004, built 2026-08-25, lists **8 of 13 machines
with `Cleaning SOP = None`** — and three of those are **Direct food contact**:

| Machine | Food contact | Operating SOP | Cleaning SOP |
|---|---|---|---|
| **Smipack S560NA shrink wrapper** | **Direct** | SOP-601 | **None** |
| **Tabletop band sealer** | **Direct** | SOP-602 | **None** |
| **S350X rotary pillow packer** | **Direct** | SOP-605 | **None** |
| Revent 724 oven | Indirect | SOP-505 | None |
| OHAUS Defender 3000 scale | Indirect | SOP-506 | None |
| "ULTRA" scale | Indirect | SOP-506 | None |
| SNEED-JET Titan coder | Indirect | SOP-603 | None |
| TOAUTO HP-003 coder | Indirect | SOP-604 | None |

The three Direct machines are the film-contact packaging machines — the film touches the baked
product directly. This is the same finding as the molds, on eight more assets. The consultant's own
note on 11.2.5.1 anticipated it: *"Ensure the list is complete and each equipment has a cleaning
SOP."* It was still scored Compliant.

## E. The record is narrower than the clause — 1 row

**11.2.5.7** names *"food processing areas, product contact surfaces, equipment, **staff amenities,
sanitary facilities**, and other essential areas."* FRM-903's pre-op grid has eleven rows — Tables,
Mixers, Bowls, Utensils, Pans, Racks, Ovens, Scales, Depositors, Chopper, Floors. **No amenity or
sanitary-facility row exists.** Handwash stations appear only in §5, the *operational* GMP check,
which is a different requirement at a different time.

Cheapest fix in this document: three rows on an existing grid.

## F. Active documents pointing at records that are not there — 3 rows

**SOP-2.9 Training & Recordkeeping** (active, effective 2025-04-28) carries 2.9.1.1, 2.9.1.2 and
2.9.2.1:

- It names **"FRM001 — Training Sign-In Sheet."** FRM-001 is the **Management Review Record**. The
  sign-in sheet is **FRM-953**. An active controlled document points at the wrong record.
- It names a **"Training Matrix"** with no number in Records and Responsibility. FRM-951 *is* the
  Training Matrix — a 265-character empty shell.
- **2.9.2.1 lists eight competency areas** (HACCP, CCP monitoring, hygiene, GMPs, sampling,
  environmental monitoring, allergen/defense/fraud, and SQF-critical tasks). **None appears in
  SOP-2.9.** The consultant wrote *"meets this requirement at a high level overall"* — and scored it
  Compliant.

Two more, already counted in A:

- **FSQM-019** references a **"Rework form."** No rework form exists. 2.4.6.1 ends *"Records of all
  reworking operations shall be maintained."*
- **SOP-204** references **"FRM-204 Allergen Changeover Log."** FRM-204 is the **Annual Supplier
  Performance Evaluation Checklist**. The assessment calls this a numbering collision; it is not —
  **the allergen changeover log was never built.** There is no allergen form anywhere in the system.

SOP-204 also verifies changeover with an **ATP swab**, which does not detect allergen residue
(already known — D-23), names no cleaning chemical and no concentration, and cites its governing
reference as *"SQF Code 11.2.3 — Allergen Management."* 11.2.3 is **Calibration**.

## G. Conditional on work already scheduled — 3 rows

**2.4.3.3** (scope), **2.4.3.4** (product descriptions) and **2.4.3.5** (intended use) are Compliant
*as parts of the current HACCP plan* — the plan D-14 rebuilds to the Codex 12 steps, and which
carries all 8 Majors. They are not gaps today, but they cannot survive the rebuild unexamined.
**Re-verify after D-14, do not assume they carry over.**

---

## Rows that hold up — 15

2.1.1.6 · 2.1.3.1 · 2.3.1.1 · 2.3.1.2 · 2.3.1.6 · 2.3.2.7 · 2.3.4.1 · 2.3.4.2 · 2.4.5.2 · 2.8.1.7 ·
2.9.2.2 · 11.7.3.2 · 11.7.3.3 · 11.7.3.4 · 11.7.3.5

2.9.2.2 (training materials in languages understood) is worth calling out as genuinely well
evidenced — TRN-000 to TRN-012 exist in parallel English and Spanish, and `profiles.preferred_language`
drives assignment.

---

## What this turns into

| # | Deliverable | Closes | Size |
|---|---|---|---|
| 1 | **Cleaning methods for the 3 Direct food-contact packaging machines** (Smipack, band sealer, S350X), then the 5 Indirect | 11.2.5.1, 11.1.7.7 | Large — up to 8 SSOPs |
| 2 | **Foreign Matter Control** — extend SOP-11.7.3 beyond glass to wood, loose metal, knives/blades and wear items; add `Wood`/`Metal`/`Ceramic` to FRM-907's Material options and rows for those items | 11.7.3.1, .6, .7, .8, .9 | Medium |
| 3 | **Approve and issue the 8 FSQM drafts**; give FSQM-005 and FSQM-008 revision numbers | 2.1.1.1, 2.1.2.2, 2.2.2.1, 2.2.3.2, 2.2.3.3, 2.4.5.1, 2.4.6.1, 2.8.1.10 | Small per doc, needs an approver |
| 4 | **Rewrite SOP-204 and build the Allergen Changeover Log** — name the cleaner and its concentration, replace ATP with allergen-specific swabs, fix the governing reference, resolve the FRM-204 number | 2.8.1.4 · feeds D-23 | Medium |
| 5 | **FRM-903 pre-op scope** — add staff amenity and sanitary facility rows | 11.2.5.7 | Trivial |
| 6 | **Rework record** — build the form FSQM-019 already names | 2.4.6.1 | Small |
| 7 | **SOP-2.9 corrections** — fix the FRM-001/FRM-953 mis-reference, number the Training Matrix as FRM-951, add the eight competency areas | 2.9.1.1, 2.9.1.2, 2.9.2.1 · overlaps D-24 | Small |
| 8 | **Add FSQM-002's signature, display and language provisions** | 2.1.1.1 v–vi | Trivial |
| 9 | **Back to the consultant for re-score**, not for us to change: 2.3.4.6, 2.4.3.15, 2.4.3.17, 2.1.1.1 | — | A note |
| 10 | **Re-verify 2.4.3.3/.4/.5 after the HACCP rebuild** | — | Flag on D-14 |

**#1 and #2 are the ones an auditor finds.** #5 is fifteen minutes. #9 costs nothing and is better
raised now than defended at the audit.

## Note on method

Rows scored **NA** (8 System Elements) and **Not Applicable** (9 Module 11) were not reviewed here.
The assessment already carries one known bad NA — 2.1.3.2, scored NA over evidence describing a live
gap in complaint trending. That set is worth the same treatment and is smaller.
