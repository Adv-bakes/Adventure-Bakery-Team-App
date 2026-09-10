# FSQM-036 — Loading, Transport and Unloading Program (D-35, draft)

| | |
|---|---|
| **Document No.** | FSQM-036 |
| **Title** | Loading, Transport and Unloading Program |
| **Type** | fsqm |
| **Deliverable** | D-35 (Wave 2) — tasks 35.1, 35.2, and the scoping for 35.3–35.7 |
| **Clauses** | SQF Food Manufacturing Ed 9 — **11.6.5.1 – 11.6.5.8** |
| **Status** | **ISSUED active 2026-09-10, approved GJM, effective 2026-09-10.** Seeded by `…004`/`…005`, corrected by `…006`–`…009`, issued by `…010`. |

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

## 2. Scope — every dispatch is a collection

**I had this wrong in the first draft**, and the guard caught it. I described three dispatch modes
taken from the **FRM-701 seed file** — but FRM-701 was amended twice after seeding and no longer has
a Destination field at all, and **FSQM-020, active since 2026-09-04, records the actual model:**

> *"The site does not use off-site or contract warehouses. Finished product is collected from the
> site by a carrier the customer arranges, and responsibility for the product passes to the customer
> on collection."*

Describing three modes would have **re-added the off-site-storage limb FSQM-020 deliberately
removed** — the thing that document went out of its way to state does not apply here.

### 2.1 The correction sharpens the programme rather than weakening it

Because every load leaves in a vehicle the site does not own, **the vehicle check is not an edge case
for an unusual dispatch — it is the whole of this site's transport control.**

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
| 5 | **The crossing** — the load goes outdoors; wrapped, weather rules, clean apron, no staging | .1 · .4 · .8 |
| 6 | **Securing the load** — closed and secured before the vehicle leaves; locked where there is a lock | 11.6.5.3 |
| 7 | Unloading at receipt points back at FRM-301 | 11.6.5.8 |
| 8–9 | Records; annual review | — |

---

## 4. FRM-801 — one record per vehicle-load (task 35.3)

Seeded by `20260910000005`, Section 4 rewritten by `…007`. Five sections, 22 fields, two grids.

**Titled *Dispatch and Vehicle Loading Record*** — `…008` corrected 31 occurrences of the British
"despatch" across both documents, including the field ids `dispatch_date` and `dispatched_by`. **The
SQF code itself spells it "dispatch"** (2.6.1.1, 2.6.3.1), and field ids lock once a form has entries,
so FRM-801 having none made this the last free moment. The migration file `…005_frm801_despatch_record`
keeps its name: it is applied, and a filename in `schema_migrations` is immutable.

**Why not FRM-701.** Adding vehicle fields there was tempting, since release already precedes
dispatch — but **FRM-701 is one record per batch and a vehicle carries a load.** A three-batch
shipment would have produced three checks of the same truck, or one filled and two blank. It also
doesn't duplicate FRM-301, which already records the delivering vehicle at receipt.

**Two deliberate omissions, both guarded:**

- **No temperature fields.** Everything ships ambient, so a box that is always blank would imply a
  control the site doesn't operate.
- **The seal field is not required** — and after `…007` it is a plain `seal_number` text box beside a
  required **Compartment secured** tick. A required field for a control the site doesn't operate is a
  rule nobody can follow — the same defect the FSQM-004 single-person amendment removed a day earlier.
  The tick records what actually happens on every load; the seal number records the exception.

---

## 5. Securing the load — settled (task 35.4)

**A latch or a lock is sufficient, and `…007` writes that in.** I had over-read the clause. 11.6.5.3
says vehicles shall be *secured from tampering using seals or other agreed-upon and acceptable
**devices or systems***. I turned that into a requirement for something **tamper-evident**, which is
not what it says — and is the wrong way round. A lock is a device that secures the compartment; a
seal secures nothing, it only evidences afterwards that somebody opened it. The clause contemplates
both.

**A seal also does not fit this site.** Every dispatch is a collection and a collecting vehicle is
commonly on a multi-drop route, so a seal applied at this dock has to be cut at the next stop.
Requiring one would have written a rule that cannot be followed.

The rule is now: **the compartment is closed and secured before the vehicle leaves** — locked where
there is a lock, latched and confirmed by the driver where there is not — with a seal applied only
where a customer or carrier asks for one, its number recorded on FRM-801.

The reasoning sits in the Part itself, because the defence of a light control is the argument behind
it: SQF is risk-based, and ambient shelf-stable product collected locally in small quantities is not
a tampering target. The Part also records what would change the judgement — the **D-22 food defence
threat assessment**, which hasn't started — so the choice is revisitable rather than settled by
silence. That dependency no longer *blocks* D-35; it is a stated review trigger instead.

> **Third time this pattern has come up in a week** — the absolute pre-operational separation rule in
> FSQM-004, the seal here, and the "does not cross open ground" claim between them. A control heavier
> than the clause requires is not caution; it is a rule waiting to be ignored, and the owner has
> caught every one of them.

---

## 6. The three open items, answered 2026-09-10

| | Answer | Effect |
|---|---|---|
| Wrapping + adverse-weather rule | **Current practice** | Part 5 records what already happens; nothing new on the floor |
| Collecting vehicle checked today? | **No** | Part 4 is a **new** requirement from the effective date — written into the revision history rather than glossed |
| Carrier notice acceptance | **Not tracked** | Sent copy retained as correspondence; no chase-list |

**Diana and Christina have been briefed**, which discharges task 35.7.

### 6.1 The Part 1 rule had to change, and the clause does not say what I assumed

The rule read *"**Before a collection**, the customer or the carrier shall be told…"* — which is
**every** collection. For a customer collecting weekly that is a rule nobody keeps, and with
acceptance deliberately untracked there would have been no evidence either way. `…009` changes it to
**before a customer's first collection, and again when the carrier or the requirement changes**, with
the sent copy retained.

**And 11.6.5 does not require the notice at all.** I checked the clause text rather than my summary of
it: 11.6.5.1 asks for practices *"designed to maintain appropriate storage conditions and product
integrity"* and for food loaded, transported and unloaded *"under conditions suitable to prevent
cross-contamination"*. Nothing about telling a carrier anything. The notice is the site's own control,
and Part 1 now says so — claiming clause backing it doesn't have is the same error as reading
11.6.5.3 into a seal requirement, pointing the other way.

### 6.2 The vehicle check is not happening yet, and the document says so

This is the one that mattered. Part 4 becomes binding on 2026-09-10 without ever having been
practice. The revision history records that plainly, because **the gap assessment already scored
11.6.5.2 as not met** — a programme written as though the check had always happened would contradict
the finding it exists to close.

The date was not backdated. An effective date earlier than the first FRM-801 entry creates a stretch
where the programme required a check with no record, which an auditor finds by subtraction.

**Still to do:** send the carrier notice. It was drafted as advance warning and is now a notification
of something already in force — the site accepted that when the date was set, but it means the first
drivers turned away may not have heard.

---

## 7. What this closes

**Three clauses by justified Not Applicable** (11.6.5.5, .6, .7) — written into the programme rather
than filed as a loose note, the mechanism FSQM-014 used for 2.4.4.3 and .4.

The other five (.1, .2, .3, .4, .8) are **addressed in the documents but not yet in force**, because
both are still drafts. `.3` is no longer among them as an unmet requirement: after `…007` it states a
control the site can actually operate on every load, so issuing the programme puts it in force rather
than creating a gap.
