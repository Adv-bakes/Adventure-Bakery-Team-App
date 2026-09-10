# FSQM-004 — Organizational Structure and Responsibilities (D-01, draft)

| | |
|---|---|
| **Document No.** | FSQM-004 |
| **Title** | Organizational Structure and Responsibilities |
| **Type** | fsqm |
| **Deliverable** | D-01 (Wave 1) |
| **Clause** | SQF Food Safety Code: Food Manufacturing, Edition 9 — **2.1.1.3** |
| **Status** | Seeded DRAFT by `20260910000001`. Three items open before issue. |

Drawn **by position, never by person**. A document that names an individual has to be reissued when
that individual changes, and 2.1.1.3 asks for personnel to be identified by their responsibilities
in the structure — not for a staff list. Holders are shown in this working draft only so the
coverage argument can be checked; the issued document carries the boxes without the names.

---

## 1. What the clause actually asks for

2.1.1.3 is one sentence doing four jobs:

| | Requirement | Closed by |
|---|---|---|
| i | The reporting structure shall **identify and describe site personnel with specific responsibilities** | Part 3 |
| ii | **Identify a backup for the absence of key personnel** | Part 5 — and **D-02** for the SQF Practitioner |
| iii | **Job descriptions for the key personnel shall be documented** | Part 4 |
| iv | Departments and operations are **appropriately staffed and organizationally aligned** | Part 2 and §6.1 |

> ⚠️ **The workbook's clause mapping is wrong.** It maps D-01 to "2.1.1.3, .4" and D-02 to
> "2.1.1.5". In the Food Manufacturing edition **2.1.1.4** is *"designate a primary and substitute
> SQF practitioner"* and **2.1.1.5** is that practitioner's *competency*. Both are D-02's artifact.
> D-01 is **2.1.1.3** alone.

---

## 2. What the documents in force actually require

Measured, not assumed. **35 active controlled documents** carry a Responsibility section, and roles
are named in procedure steps as well. The four apparently unheld roles were then checked line by
line.

| Role | Evidence | Decision | Consequence |
|---|---|---|---|
| **Supervisor** | **58 lines across 22 documents** | **The post exists** — *Production Supervisor* | ✅ **No sweep needed.** Every line is correct as written. |
| **QA** | 25 lines, 10 documents | Shorthand for the **SQF Practitioner** | 🔧 Normalise — Part 7 |
| **Quality Leader** | 5 lines, 2 documents | Same — **SQF Practitioner** | 🔧 Normalise — Part 7 |
| **Maintenance** | 14 documents | **Simple tasks by Senior Site Management; chronic or specialist work contracted** | §4.6 + a D-10 register row |

The Supervisor answer is the important one. Measuring only Responsibility sections had shown four
documents and suggested a layer that did not exist; the full count showed **58 lines**, and the work
assigned is load-bearing — *trains and signs off operators, takes the machine out of service on a
fault, signs the pre-use release*. A supervisory sign-off is what stands between an untrained
operator and a machine. **The narrower count would have justified deleting it.**

---

## 3. Reporting structure — by position

```
                     Senior Site Management
                     (Managing Partner)  .................. Gabriela
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
  SQF Practitioner      Production Supervisor    Administration
  ── primary ......... Diana         │  .......... Gabriela
  ── substitute ....... Gabriela     │
        │                Production Operator ............. Diana
        │                Floor Operator .................. Christina
        │                      │
        │                Receiving / Goods-In
        │
   Maintenance — simple tasks by Senior Site Management (Gabriela);
                 chronic or specialist work contracted (D-10 register)
```

**Three people hold eight posts.** Two chains have to stay honest, and after the 2026-09-10
correction they resolve differently:

- **Training sign-off — resolves.** The equipment SOPs say *"do not operate unless the Supervisor has
  trained and signed you off."* Diana (Supervisor) signs off Christina; **Senior Site Management
  signs off Diana**, because she cannot sign off herself. Evidenceable end to end.
- **Maintenance and release — resolves, and is now stronger.** Gabriela performs simple maintenance;
  Diana releases the equipment back to production. The person who works on the machine is not the
  person who releases it.
- **Pre-operational release — ⚠️ COLLIDES. See §5.1.** Diana is now both the operator who performs
  sanitation and the SQF Practitioner who signs the release.

---

## 4. Job descriptions — key personnel

### 4.1 Senior Site Management (Managing Partner)
Owns the food safety policy and the resources behind it. Appoints the primary and substitute SQF
Practitioner. Ensures departments and operations are staffed to meet food safety objectives.
Notified where an inspection failure stops production or shipment.
**Records:** policy statement; management review.
**Covered by:** the SQF Practitioner for day-to-day decisions; the appointment power is not delegable.

### 4.2 SQF Practitioner — primary and substitute
Owns the SQF System: develops, implements, reviews and maintains it. Approves controlled documents.
**Decides finished product release (FSQM-020) and signs the pre-operational release of the line.**
Owns CAPA (FSQM-009). Sets inspection criteria and reviews inspection records (FSQM-014).
**Does not sign off her own training** — where the SQF Practitioner and the Production Supervisor
are the same person, Senior Site Management signs that off (see Part 3).
Verifies annually that the documented programs are what the floor performs.
**Records:** FRM-701, FRM-007, FRM-903 release, document approvals.
**Competency (2.1.1.5):** employed by the site; a position of responsibility for the SQF System;
**completed HACCP training course**; competent to implement and maintain HACCP-based plans;
understands the SQF Food Safety Code: Food Manufacturing.
**Covered by:** the substitute SQF Practitioner.

### 4.3 Production Supervisor
Trains operators on each machine and signs them off; nobody operates a machine without that
sign-off. Takes a machine out of service on a fault and releases it back. Coordinates test runs and
monitors first-batch results. Ensures staff on shift comply with GMP and acts on non-compliance
immediately. Ensures assigned training is completed and competency verified.
**Records:** operator sign-off; equipment out-of-service; FRM-909/910/911/912 pre-use releases.
**Reports to:** Senior Site Management. **Covered by:** Senior Site Management — *not* the SQF
Practitioner, which is the same person as the Supervisor and would leave the post uncovered.

### 4.4 Production Operator / Floor Operator
Makes the batch to the batch sheet and records the in-process inspection on it. Confirms pack, seal,
date and lot code as the run proceeds. Performs sanitation and completes FRM-903.
**Does not sign the release of work they performed.** The pre-operational release is signed by
someone other than the person who performed the sanitation, so the work and its verification are
never the same hand — see §5.1.
**Records:** batch sheet; FRM-903 sanitation. **Reports to:** Production Supervisor.
**Covered by:** the other operator, or the Production Supervisor.

### 4.5 Receiving / Goods-In
Inspects every delivery of raw material and packaging before it is accepted into stock, against
FRM-301 — identity, quantity, pack integrity, lot code and date, pest and damage evidence, vehicle
condition. Rejects or places on Hold under FSQM-018 what fails. Takes and logs retention samples on
FRM-703. **Records:** FRM-301; FRM-702; FRM-703. **Covered by:** the Production Supervisor.

### 4.6 Maintenance
Planned and reactive maintenance of production and food-contact equipment. Food-grade lubricants
where contact is possible. Returns equipment to production only after it is cleaned and released.
**Simple tasks are performed by Senior Site Management** — greasing, belt and seal changes, guard
checks, and the scheduled servicing named in the equipment SOPs. **Chronic or specialist work is
contracted** — anything recurring, or requiring a licensed trade or specialist tooling — and each
provider is listed on the **Contract Services Register (D-10)**.
**Records:** maintenance log; post-maintenance release.
**Covered by:** the contracted provider.

> **This separation is worth keeping deliberately.** Maintenance sits with Senior Site Management
> while the equipment release sits with the SQF Practitioner, so the person who works on a machine is
> not the person who releases it back to production. That happened by circumstance rather than by
> design, but it is the right shape and the document should say so.

---

## 5. Coverage in absence (limb ii)

| Position | Covered by |
|---|---|
| Senior Site Management | SQF Practitioner, day-to-day only |
| SQF Practitioner (primary) | **Substitute SQF Practitioner — Senior Site Management** |
| Production Supervisor | Senior Site Management |
| Production / Floor Operator | the other operator, or the Supervisor |
| Receiving / Goods-In | Production Supervisor |
| Maintenance | the contracted provider |

### ⚠️ 5.1 Pre-operational release — the one thing that does not resolve by itself

**Making Diana the primary SQF Practitioner moved this from a problem in the absence case to a
problem in the normal case.** She is the operator who performs sanitation *and* the practitioner who
signs the pre-operational release, so by default she verifies her own work — every day, not just
when someone is away.

That is worth being blunt about, because a pre-operational release is one of the first records an
auditor pulls, and the first thing they check is whose signature is on it.

**The fix is to write the control positionally rather than personally:**

> **The pre-operational release shall be signed by someone other than the person who performed the
> sanitation.**

That is the actual control. It survives any roster, needs no revision when duties move, and with
three people on site it can always be satisfied. In practice it produces:

| Sanitation performed by | Release signed by | When |
|---|---|---|
| Christina (Floor Operator) | Diana (SQF Practitioner) | the normal pairing |
| Diana | Gabriela (substitute SQF Practitioner) | when Christina is absent |

**✅ SETTLED 2026-09-10: Christina performs the day-to-day sanitation and the FRM-903 entry; Diana
signs the release.** Two hands in the normal case, the primary practitioner doing the release where
it belongs, and the substitute used only as a substitute. The fallback pairing stands for when
Christina is absent.

---

## 6. Answers received 2026-09-10

| | Answer | Consequence |
|---|---|---|
| Supervisor | **Diana holds Supervisor *and* Operator** | Allowed; the chains in Part 3 keep it evidenceable — but see §5.1 |
| Second operator | **Christina, floor operator** | Makes §5.1's fix possible. See §6.1 |
| SQF Practitioner | **Diana primary, Gabriela substitute** *(corrected 2026-09-10)*, both to train | Closes 2.1.1.4 and limb (ii). See §6.2 and **§6.3** |
| Maintenance | **Simple tasks Gabriela; chronic work contracted** | §4.6. Gives a clean split from the equipment release |

### ⚠️ 6.1 Christina has no account and no training record
The staff directory holds ten profiles and **none matches Christina**. There are 48 training
assignments across three people; she has none. **An operator on the floor performing food-safety
tasks with no training record is a 2.9 finding waiting to be written**, and it is also limb (iv) of
this clause — *appropriately staffed*. She needs a profile and the assigned training. The invite flow
captures training language at acceptance, so it is worth setting if English is not her first language.

### ⚠️ 6.2 "SQF Practitioner training" may not be what 2.1.1.5 asks for
The clause requires the primary and substitute to have **"completed a HACCP training course"** —
specifically HACCP, not SQF Practitioner training as such. Many practitioner courses include a
recognised HACCP module and satisfy it; some do not. **Confirm before booking**: the wrong course
costs weeks and does not close 2.1.1.5.

### ✅ 6.3 Document approval moves to the SQF Practitioner — with one exception
**Settled 2026-09-10: Diana approves controlled documents** from here on. Past approvals stamped GJM
are historical and stay as they are.

**⚠️ FSQM-004 itself is the exception, and it should be approved by Senior Site Management.** 2.1.1.4
makes designating the practitioner an act of senior site management, and §4.1 already records that
the appointment power is not delegable — so a document that appoints somebody should not be approved
by the appointee. The approval block is the first place an auditor looks for that circularity. This
is open item 1 in the seeded document.

**Practical point for issue:** the approval field stores initials, and the stamp on every document to
date is `GJM`. The next approval needs Diana's initials, which are not recorded anywhere yet.

---

## 7. Follow-on work this creates (not part of D-01)

1. **Normalise QA and Quality Leader to SQF Practitioner** — 30 lines across 12 **active** documents,
   each an amendment with a revision bump. Compound forms need judgement, not find/replace:
   *QA Technician*, *QA/QC Lead*, *QA/Production Manager*, and FSQM-012's *"SQF Practitioner / QA"*
   which simply de-duplicates. **`FRM-702`'s Section 2 instruction still reads "To be filled out by
   QA / Quality Leader."**
2. **Provision Christina** and assign her training (§6.1).
3. **Add the maintenance providers to the Contract Services Register (D-10)** once §4.6 is confirmed.
4. **D-02** — designate formally and complete the HACCP course (§6.2). It closes 2.1.1.4, 2.1.1.5 and
   limb (ii) of 2.1.1.3 with them.
5. **D-14 task 14.1** becomes possible: a food safety team of three is a team.
6. **Provide Diana's initials** for the approval stamp on the first document she approves (§6.3).
