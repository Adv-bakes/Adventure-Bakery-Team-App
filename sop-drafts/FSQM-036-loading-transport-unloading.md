# FSQM-036 — Loading, Transport and Unloading Program (D-35, draft)

| | |
|---|---|
| **Document No.** | FSQM-036 |
| **Title** | Loading, Transport and Unloading Program |
| **Type** | fsqm |
| **Deliverable** | D-35 (Wave 2) — tasks 35.1, 35.2, and the scoping for 35.3–35.7 |
| **Clauses** | SQF Food Manufacturing Ed 9 — **11.6.5.1 – 11.6.5.8** |
| **Status** | DRAFT — not written to the database. |

---

## 1. The ambient determination (task 35.1)

**Confirmed by the owner, 2026-09-10: every finished product this site makes ships ambient.**
Nothing leaves under temperature control, for any customer, in any despatch mode.

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
and Parts 3 to 5 exist because of it.

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

## 3. Proposed structure of the programme (task 35.2)

1. **Purpose and scope** — the three despatch modes above.
2. **The ambient determination** — Part 1, with 11.6.5.5/.6/.7 recorded Not Applicable and the reversal trigger.
3. **Before loading** — vehicle condition check: clean, dry, sound, free of odour, free of pest evidence, no prior load residue, suitable for food. Refuse and record if it fails. *(11.6.5.2)*
4. **Loading** — product protected from weather and contamination during transfer; exposure minimised; no product placed directly on the ground; load secured so packaging is not damaged. *(11.6.5.1, .4, .8)*
5. **Security** — tamper-evident seal applied where the load leaves the site's control; seal number recorded against the despatch. *(11.6.5.3)*
6. **Unloading and receipt** — incoming loads are inspected under FRM-301, which already records the vehicle's condition at receipt. This programme does not create a second route for that. *(11.6.5.8)*
7. **Records, review, training.**

---

## 4. The record question (task 35.3) — and a granularity problem worth deciding

The plan warns *"One form also serves D-11's receiving inspection. Do not build two."* Half of that is
already solved: **FRM-301 records the vehicle at receipt.** There is no despatch equivalent.

Two candidates, and they are not equally good:

**(a) Add vehicle fields to FRM-701.** Tempting — release already happens before shipment, so the
record exists at the right moment. But **FRM-701 is one record per batch, and a vehicle carries a
load.** A three-batch shipment would produce three vehicle checks of the same truck, or one filled
and two blank. The granularity is wrong.

**(b) A despatch record, one per vehicle-load**, carrying the vehicle check, the seal number, the
destination and the release records of the batches loaded. Right granularity, and it is the natural
place for the seal number that 11.6.5.3 wants.

**Recommendation: (b).** It is one new form rather than two, it does not duplicate FRM-301, and it
matches the unit of the thing being controlled — a vehicle-load. The cross-reference to FRM-701 keeps
the release decision where it belongs.

---

## 5. What still needs the floor or a decision

These are the reasons this is a draft rather than a migration:

1. **The dock (task 35.5).** *"Written practice plus any physical fixes (dock seal, weather
   protection)."* I cannot describe a loading area I have not seen. Is loading done at a dock, at a
   roller door, or in the open? Is product exposed to weather between the building and the vehicle?
2. **Seals (task 35.4).** 11.6.5.3 wants tamper-evident seals *or another agreed method*. Are seals
   used today, and does any customer specify one? This also feeds the food defence plan (D-22).
3. **Customer collection.** Is a collecting vehicle checked before loading today? (Part 2.)
4. **The despatch record.** Confirm option (b) before I build it.
5. **Training (task 35.7)** follows the record, not the other way round.

---

## 6. What today's determination actually closes

**Three of the eight clauses (11.6.5.5, .6, .7), by justified Not Applicable** — the same mechanism
FSQM-014 used for 2.4.4.3 and .4 when it recorded that the site has no laboratory. It is written into
the programme rather than filed as a loose note, so an auditor reading 11.6.5 finds the determination
in the document that governs the subject.

The remaining five (11.6.5.1, .2, .3, .4, .8) need the programme, the despatch record and the dock
practice — and those need §5 answered.
