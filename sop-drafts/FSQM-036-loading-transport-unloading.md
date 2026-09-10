# FSQM-036 — Loading, Transport and Unloading Program (D-35, draft)

| | |
|---|---|
| **Document No.** | FSQM-036 |
| **Title** | Loading, Transport and Unloading Program |
| **Type** | fsqm |
| **Deliverable** | D-35 (Wave 2) — tasks 35.1, 35.2, and the scoping for 35.3–35.7 |
| **Clauses** | SQF Food Manufacturing Ed 9 — **11.6.5.1 – 11.6.5.8** |
| **Status** | Seeded DRAFT by `20260910000004`, with FRM-801 by `20260910000005`. Three items open before issue. |

---

## 1. The ambient determination (task 35.1)

**Confirmed by the owner, 2026-09-10: every finished product this site makes ships ambient.**
Nothing leaves under temperature control, for any customer.

Three of the eight clauses in 11.6.5 govern refrigerated transport, and on that determination they
do not arise:

| Clause | What it requires | Status |
|---|---|---|
| 11.6.5.5 | Refrigerated units shall maintain the product at the required temperature; setting recorded | **Not Applicable** |
| 11.6.5.6 | The refrigeration unit shall be operational at all times, with checks completed | **Not Applicable** |
| 11.6.5.7 | On arrival, before opening the doors, the vehicle's refrigeration temperature shall be checked | **Not Applicable** |

That also removes task **35.6** from the deliverable, exactly as the plan anticipated.

### ⚠️ 1.1 Two things this determination must not be read as saying

**It does not say the site has no refrigeration.** It has. A freezer remains in service under SOP-401
and FRM-401, and refrigerated *storage* is governed by 11.6.2 and closed by D-34. What is being
determined here is narrow: **nothing is transported under temperature control.** A reader who
concluded from this Part that there is no cold chain anywhere on site would be wrong, and an auditor
who found the freezer after reading it would be entitled to ask why the document implied otherwise.

**And it does not say ambient is the absence of a condition.** 11.6.5.1 requires practices that
*maintain the storage conditions of the food*. Ambient **is** a specified condition: product must
not be exposed to heat, damp, direct sun or contamination in transit merely because no temperature
is being held. Treating "ambient" as "nothing to control" is the usual way this clause is failed,
and Parts 5 and 6 of the programme exist because of it.

### 1.2 What would reverse it

If any product requiring chilled or frozen transport is introduced — a new product, a reformulation,
or a customer requiring temperature-controlled delivery of an existing one — **this programme shall
be revised, and the controls in 11.6.5.5 to .7 implemented, before that product first ships.** The
revision comes first, not after the first load. The same rule FSQM-014 Part 2 applies to introducing
analysis, for the same reason: a control that arrives after the event it exists to control is not a
control.

---

## 2. Scope — every despatch is a collection

**I had this wrong in the first draft**, and the guard caught it. I described three despatch modes
taken from the **FRM-701 seed file** — but FRM-701 was amended twice after seeding and no longer has
a Destination field at all, and **FSQM-020, active since 2026-09-04, records the actual model:**

> *"The site does not use off-site or contract warehouses. Finished product is collected from the
> site by a carrier the customer arranges, and responsibility for the product passes to the customer
> on collection."*

Describing three modes would have **re-added the off-site-storage limb FSQM-020 deliberately
removed** — the thing that document went out of its way to state does not apply here.

### 2.1 The correction sharpens the programme rather than weakening it

Because every load leaves in a vehicle the site does not own, **the vehicle check is not an edge case
for an unusual despatch — it is the whole of this site's transport control.**

- 11.6.5.2 governs vehicles used to transport food **from the site**, and does not distinguish by who
  owns them. **Responsibility passing on collection does not reach backwards to the moment of
  loading**: if a vehicle arrives dirty or carrying an odour, it is this site's product that suffers
  and this site's control that failed.
- The site cannot control the journey, and the programme says so plainly rather than pretending
  otherwise — the FSQM-020 pattern of stating which limbs do not arise.
- What it *can* do beyond the check is **tell the carrier the requirement in advance** — ambient, and
  the condition the vehicle must be in. That is now a rule in Part 1, and it is the site's only
  influence over a journey it does not make.

**The open question is therefore sharper than before: is the collecting vehicle checked today?**
Not as an edge case — on every load that has ever left.

---

## 3. The programme as seeded (task 35.2)

Nine Parts, in `20260910000004`:

| Part | | Clauses |
|---|---|---|
| 1 | **Collection model** — product leaves by collection only; the carrier is told the requirement in advance | 11.6.5.1 |
| 2 | Nothing leaves before release under FSQM-020 | — |
| 3 | **The ambient determination** and what would reverse it | .5 · .6 · .7 **N/A** |
| 4 | **Vehicle check before loading** — refuse and record | 11.6.5.2 |
| 5 | **Loading** — no open ground, nothing on the floor, load restrained | .1 · .4 · .8 |
| 6 | **Vacuum seal vs. vehicle seal** — stated separately | 11.6.5.3 |
| 7 | Unloading at receipt points back at FRM-301 | 11.6.5.8 |
| 8–9 | Records; annual review | — |

---

## 4. FRM-801 — one record per vehicle-load (task 35.3)

Seeded by `20260910000005`. Five sections, 19 fields, two grids.

**Why not FRM-701.** Adding vehicle fields there was tempting, since release already precedes
despatch — but **FRM-701 is one record per batch and a vehicle carries a load.** A three-batch
shipment would have produced three checks of the same truck, or one filled and two blank. It also
doesn't duplicate FRM-301, which already records the delivering vehicle at receipt.

**Two deliberate omissions, both guarded:**

- **No temperature fields.** Everything ships ambient, so a box that is always blank would imply a
  control the site doesn't operate.
- **The seal field is not required.** The site hasn't chosen a method, and a required field for a
  control that doesn't exist is a rule nobody can follow — the same defect the FSQM-004 single-person
  amendment removed a day earlier. The option list lets the filler record honestly that none was used.

---

## 5. What still needs the floor or a decision

1. **Seals (task 35.4).** 11.6.5.3 wants tamper-evident seals *or another agreed method*. Are any used
   today? A load that is collected and leaves immediately raises a fair question about what a seal
   adds. This is also the one task with a cross-deliverable dependency — the plan hangs it on **D-22
   Food Defense**, which hasn't started.
2. **The dock (task 35.5).** You've said product never crosses open ground, and Part 5 records that —
   but as your account rather than an inspection, and the Part says so. Task 35.5 also asks for any
   physical fixes, which needs someone to look.
3. **Is the collecting vehicle checked today?** Sharper than it looked: since *every* despatch is a
   collection, this isn't an edge case — it's every load that has ever left. If the answer is no,
   issuing the programme creates a requirement the floor isn't yet meeting, and that gap should be
   closed by instruction rather than discovered at an audit.
4. **Training (task 35.7)** follows the record.

---

## 6. What this closes

**Three clauses by justified Not Applicable** (11.6.5.5, .6, .7) — written into the programme rather
than filed as a loose note, the mechanism FSQM-014 used for 2.4.4.3 and .4.

The other five (.1, .2, .3, .4, .8) are **addressed in the documents but not yet in force**, because
both are drafts. `.3` in particular is stated as a requirement the site does not currently meet — the
seal question above.
