# FSQM-015 — Environmental Monitoring Program (D-16, draft)

| | |
|---|---|
| **Document No.** | FSQM-015 |
| **Title** | Environmental Monitoring Program |
| **Type** | fsqm |
| **Deliverable** | D-16 (Wave 1) — task 16.5, and it carries 16.7 as Part 7 |
| **Clauses** | SQF Food Manufacturing Ed 9 — **2.4.8.1, .2, .3** and **11.7.1.2** |
| **Status** | **DRAFT**, seeded by `20260917000003_fsqm015_environmental_monitoring.sql`. Not approved, not in force. Three items gate issue — see §6. |

---

## 1. Why the site needs one at all

The oven is the only kill step in this process. After it, product **cools on open racks, is dipped
in rum syrup, and is loaded into the vacuum sealer** — all of it open to the room. Anything living
in that room during that window reaches the product without passing through another lethal step.
Nothing downstream of the oven kills; the seal excludes.

That is the entire argument for this program, and it is also the argument for why it looks at the
**room** rather than at the product. An organism that establishes itself in a drain, a rack castor
or the frame of the sealer reaches a small and shifting fraction of units. Testing finished product
for it is a well-documented way to keep finding nothing while the problem continues.

## 2. The zone model, and why it is not the FSQM-039 zoning

FSQM-039 divides the floor into six **hygiene areas** — NON-PRODUCTION, PACKAGING MATERIALS
STORAGE, RAW / PRE-BAKE, BAKE, COOLING, HIGH CARE. Environmental monitoring divides **sample
points** into four **zones** by proximity to exposed product:

| Zone | What it is | Examples here |
|---|---|---|
| **1** | Contacts exposed product | Cooling racks and trays, the dunk tank, utensils, the sealer's product bed, gloves handling open product |
| **2** | Non-contact, close to Zone 1 | Equipment frames and housings, control panels, rack uprights and castors, table undersides |
| **3** | Elsewhere in production | Floors, drains, walls, door handles, waste bins, pallet jacks, cleaning tools and their storage |
| **4** | Outside production | Storage, corridors, welfare areas, the office side, the routes between |

**These are orthogonal and both are needed.** The hygiene area says what is allowed to happen in a
place; the zone says what a positive found there would *mean*. A sample point is identified by both
— *"dunk tank drip tray — Zone 1, HIGH CARE"*.

> The workbook's task 16.1 says "zones 1–4 marked" on the drawing. FSQM-039 in fact drew six named
> hygiene areas, which is the right thing for a layout drawing. The 1–4 classification belongs to
> the sample point, not to the floor, and lives here.

**The dunk bay is where the two overlap and matter most.** It holds raw batter on Day 1 and
post-bake product on Day 2, and what separates those is the changeover clean and nothing else. Its
Zone 1 and Zone 2 points are the most informative surfaces in the building.

## 3. Target organisms — and the one measurement they hang on

**Proposed:** *Listeria* species in the post-lethality area; **Enterobacteriaceae** as the hygiene
indicator on food-contact and near-contact surfaces after cleaning; ambient air in high care tested
annually under 11.7.1.2.

**Why Listeria.** The dip is a wet step, inside high care, after the only kill step. Standing water,
a drain and a cooled product surface in one bay is the textbook description of where *Listeria*
establishes. Monitored at **genus** level, not waiting for *L. monocytogenes* — the genus is the
harbourage indicator and the more sensitive screen.

**Why not Salmonella on the dry side.** Considered and rejected. Flour is a known vehicle, but
everything on the raw side passes through the validated bake. A positive there would not implicate
product and would not change any control, so the testing budget would buy information the kill step
has already answered. **What reverses this:** any route by which raw-side material reaches product
*after* the oven — a rework loop, a cold-added topping, a shared utensil.

### ⚠️ 3.1 Both targets are provisional until the finished-product water activity is measured

The HACCP plan calls the product shelf-stable on the grounds of reduced water activity, but that
claim is made about the cake **as it leaves the oven — and the dip comes after it.** Dipping in rum,
water and sugar syrup adds water back. The figure that actually governs shelf stability is the aw of
the **finished, sealed, equilibrated unit**, and it is not measured and appears nowhere in the
document set.

That measurement is **D-14 task 14.14**, not this program's to make. Until it exists, this program
takes the conservative position and monitors as though growth in product were possible. If the
finished figure comes back low enough that the product cannot support growth, the emphasis here
properly shifts toward indicator organisms and away from pathogen screening — and the program says
so, so that the choice can be explained rather than merely asserted.

## 4. Sampling is pre-operational by default

**After the clean, before production**, except at points that can only be judged in use (drains, the
floor around the dunk tank, waste handling).

This is deliberate and it is the proportionate choice for a three-person site. A Zone 1 swab taken
mid-run places the running batch in question, and no laboratory turnaround is fast enough to resolve
that before the product would otherwise ship. Sampling after the clean means a positive implicates
**the clean** — a condition the site can act on — rather than a lot it would hold for days.

It is not the lenient option: *a surface that is positive after cleaning is a surface the cleaning
did not reach*, which is exactly the finding the program is for.

The rule that decides whether any of the others are worth performing: **a sample point shall not be
given a clean it would not otherwise have received because it is about to be swabbed.**

## 5. Response, and why it is written now

Part 7 sets the response before the first positive: treat a presumptive positive as a positive for
the purpose of starting work; vector-swab around the point; clean, re-swab and intensify until three
consecutive negatives; address the **cause** where a point recurs; raise a CAPA under FSQM-009
(always, for a confirmed Zone 1 *Listeria* positive); hold implicated product on FRM-702 under
FSQM-018 and refuse release under FSQM-020 until dispositioned.

> The pressure at the moment a positive arrives is to explain it away — a bad swab, a one-off, a lab
> error. A site that has not decided in advance what it will do is deciding it under exactly the
> conditions that produce the wrong answer.

A single Zone 3 positive is information, not an emergency. **The same organism at the same point
three times is a resident population**, and finding those is what the program is for.

## 6. What gates issue — three items, all cost or judgement

| # | Item | Whose call |
|---|---|---|
| **1** | **Confirm the target organism set** in §3. This decides what the program costs to run. | Senior Site Management |
| **2** | **Select a laboratory.** None is engaged. Must be ISO/IEC 17025 accredited (or equivalent) for the methods used and listed on **FRM-206 Contract Services Register** before the first sample. Its price per sample is also what makes the sample plan's frequency decidable. | Owner / SQF Practitioner |
| **3** | **Build the results log.** It does not exist. It is built, numbered and named in Part 8 and the form references before this issues. | Team Portal build (task 16.9) |

**The sample plan (task 16.6) additionally waits on the FSQM-039 zone boundaries being confirmed on
the floor.** Points placed against unconfirmed boundaries are points placed twice.

### 6.1 No results-log form number appears anywhere in this document

Deliberately. **FSQM-022 Rev 1 referenced a "Form-0010 Food Safety Inspection" that was never built,
and that dangling reference *was* the finding scored against it** (closed by D-13 task 13.4). A form
reference is written when the form exists.

### 6.2 One consequential amendment, recorded and not yet performed

**FSQM-014 Part 2 states that no external laboratory is used and no analysis is commissioned.** Read
in context that is about *raw material, packaging, work-in-progress and finished product*, and it
stays true of all four — an environmental sample is taken from the room, not from the product.

But the first environmental sample sent makes this site a user of an external laboratory, and a
reader of FSQM-014 alone would be misled. **The issue migration scopes that sentence to product
analysis in the same transaction that activates this program** — not afterwards, and not silently.

FSQM-014's own rule is adopted unchanged in Part 6: **the method comes first, then the laboratory,
then the sample.**

## 7. What this closes, and what it does not

2.4.8.1 requires the program to be documented **and implemented**.

- **Documented limb — closed by this document.**
- **Implemented limb — open.** Needs the laboratory, the sample plan and the results log.
- **2.4.8.2** — framed here (organisms in Part 4, handling of elevated results in Part 7); the
  points, counts, frequency and rotation are the sample plan, task 16.6.
- **2.4.8.3** — the trending mechanism is Part 8 (monthly on FRM-009, annually on FRM-001); it has
  nothing to trend until sampling starts.
- **11.7.1.2** — in scope and placed on the sample plan; not yet arranged.

Recording that plainly is the same choice **FSQM-017** made in recording that 2.5.1.1 closes only in
part, and **FSQM-014** made in stating that the site does not analyse. A document that implies a
testing regime the site does not operate is worse than one that says there is none, because the
first thing an auditor does is ask to see the results.

## 8. On issue

The issue migration will need to:

1. Activate FSQM-015, stamp `effective_date` and `approved_by` (GJM approves all controlled
   documents — see the org-structure decision).
2. Scope **FSQM-014 Part 2** to product analysis (§6.2).
3. Add the environmental monitoring rows to **`verification_schedule`** — while the program is
   documented but not running they belong as `status='planned'` with `pending_deliverable` naming
   D-16, which is what that status is for.
4. Name the results log in Part 8 and the form references, once it exists.
