# FSQM-004 — Organizational Structure and Responsibilities (D-01, draft)

| | |
|---|---|
| **Document No.** | FSQM-004 |
| **Title** | Organizational Structure and Responsibilities |
| **Type** | fsqm |
| **Deliverable** | D-01 (Wave 1) |
| **Clause** | SQF Food Safety Code: Food Manufacturing, Edition 9 — **2.1.1.3** |
| **Status** | DRAFT — not written to the database. One question outstanding (Part 6). |

Drawn **by position, never by person**. A document that names an individual has to be reissued when
that individual changes, and 2.1.1.3 asks for personnel to be identified by their responsibilities
in the structure — not for a staff list.

---

## 1. What the clause actually asks for

2.1.1.3 is one sentence doing four jobs:

| | Requirement | Closed by |
|---|---|---|
| i | The reporting structure shall **identify and describe site personnel with specific responsibilities** | Part 3 of this document |
| ii | **Identify a backup for the absence of key personnel** | Part 5 — and **D-02** for the SQF Practitioner |
| iii | **Job descriptions for the key personnel shall be documented** | Part 4 of this document |
| iv | Departments and operations are **appropriately staffed and organizationally aligned** | Part 2 — the substantive finding |

> ⚠️ **The workbook's clause mapping is wrong.** It maps D-01 to "2.1.1.3, .4" and D-02 to
> "2.1.1.5". In the Food Manufacturing edition **2.1.1.4** is *"designate a primary and substitute
> SQF practitioner"* and **2.1.1.5** is that practitioner's *competency*. Both are D-02's artifact.
> D-01 is **2.1.1.3** alone — and it cannot close limb (ii) without D-02's substitute. The two
> deliverables interlock and should finish together.

---

## 2. What the documents in force actually require

Measured, not assumed. **35 active controlled documents** carry a Responsibility section, and roles
are named in procedure steps as well. The four apparently unheld roles were then checked line by
line.

**Decisions taken 2026-09-10, and what each one means:**

| Role | Evidence | Decision | Consequence |
|---|---|---|---|
| **Supervisor** | **58 lines across 22 documents** | **The post exists** — *Production Supervisor* | ✅ **No sweep needed.** Every one of those lines is correct as written. |
| **QA** | 25 lines, 10 documents | Shorthand for the **SQF Practitioner** | 🔧 Normalise — see Part 7 |
| **Quality Leader** | 5 lines, 2 documents | Same — **SQF Practitioner** | 🔧 Normalise — see Part 7 |
| **Maintenance** | 14 documents | **Mixed**: routine in-house, specialist contracted | Position + a Contract Services Register row (D-10) |

The Supervisor answer is the important one. Measuring only the Responsibility sections had shown
four documents and suggested a layer that did not exist; the full count showed **58 lines**, and the
work assigned is real and load-bearing — *trains and signs off operators, takes the machine out of
service on a fault, signs the pre-use release*. A supervisory sign-off is what stands between an
untrained operator and a machine. Deleting it would have been a serious mistake.

---

## 3. Reporting structure — by position

```
                     Senior Site Management
                     (Managing Partner / CEO)
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
  SQF Practitioner      Production Supervisor    Administration
  ── primary                   │                 (purchasing, supplier
  ── substitute (vacant, D-02) │                  files, records)
        │                Production Operator
        │                      │
        │                Receiving / Goods-In
        │
   Maintenance — routine tasks in-house;
   specialist work contracted (D-10 register)
```

**One person holding several posts is permitted, and is not the problem.** What is not permitted is
a procedure describing a **hand-off between two posts the same person holds** — a quorum of one is
not a control, and writing it as one invites an auditor to test a separation of duties that does not
exist. Where this document confirms two posts are held by one person, any procedure step passing
work between them must be **rewritten, not relabelled**.

---

## 4. Job descriptions — key personnel

### 4.1 Senior Site Management (Managing Partner)
Owns the food safety policy and the resources behind it. Appoints the primary and substitute SQF
Practitioner. Ensures departments and operations are staffed to meet food safety objectives.
Receives notification where an inspection failure stops production or shipment.
**Records:** policy statement; management review. **Reports to:** — . **Covered by:** the SQF Practitioner for day-to-day decisions; the appointment power is not delegable.

### 4.2 SQF Practitioner — primary and substitute
Owns the SQF System: develops, implements, reviews and maintains it. Approves controlled documents
and their revisions. **Decides finished product release (FSQM-020) and signs the pre-operational
release of the line.** Owns CAPA (FSQM-009). Sets the inspection criteria and reviews the inspection
records (FSQM-014). Verifies annually that the documented programs are what the floor performs.
**Records:** FRM-701 release, FRM-007 CAPA, FRM-903 pre-op release, document approvals.
**Competency:** completed HACCP course; understands the SQF Food Safety Code: Food Manufacturing (2.1.1.5).
**Reports to:** Senior Site Management. **Covered by:** the substitute SQF Practitioner — **vacant, D-02**.

### 4.3 Production Supervisor
Trains operators on each machine and signs them off; no one operates a machine without that
sign-off. Takes a machine out of service on a fault and releases it back. Coordinates test runs and
monitors first-batch results. Ensures staff on shift comply with GMP and acts on non-compliance
immediately. Ensures assigned training is completed and competency verified.
**Records:** operator sign-off; equipment out-of-service; FRM-909/910/911/912 pre-use releases.
**Reports to:** Senior Site Management. **Covered by:** the SQF Practitioner.

### 4.4 Production Operator
Makes the batch to the batch sheet and records the in-process inspection on it. Confirms the pack,
seal, date and lot code as the run proceeds. Performs sanitation and completes FRM-903.
**Does not release the line — that signature is the SQF Practitioner's** (see 4.2), so the work and
its verification are not the same hand.
**Records:** batch sheet; FRM-903 sanitation. **Reports to:** Production Supervisor.
**Covered by:** the Production Supervisor.

### 4.5 Receiving / Goods-In
Inspects every delivery of raw material and packaging before it is accepted into stock, against
FRM-301 — identity, quantity, pack integrity, lot code and date, pest and damage evidence, vehicle
condition. Rejects or places on Hold under FSQM-018 what fails. Takes and logs retention samples on
FRM-703.
**Records:** FRM-301; FRM-702 hold; FRM-703 retention. **Reports to:** Production Supervisor.
**Covered by:** the Production Operator.

### 4.6 Maintenance
Planned and reactive maintenance of production and food-contact equipment. Uses food-grade
lubricants where contact is possible. Returns equipment to production only after it is cleaned and
released.
**Split, per the decision above:** routine tasks — greasing, belt and seal changes, guard checks,
scheduled servicing named in the equipment SOPs — are performed **in-house**. Specialist work —
refrigeration, gas, electrical, calibration and anything requiring a licensed trade — is
**contracted**, and each provider is listed on the **Contract Services Register (D-10)**.
**Records:** maintenance log; post-maintenance release. **Reports to:** Senior Site Management.
**Covered by:** the contracted provider for anything the in-house holder cannot complete.

> The in-house/contracted boundary above is **drafted, not confirmed**. It is written so the line
> falls where a licence or specialist tooling is required, which is the usual place for it. Move it
> if that is not where it actually sits.

---

## 5. Coverage in absence (limb ii)

| Position | Covered by |
|---|---|
| Senior Site Management | SQF Practitioner, day-to-day only |
| **SQF Practitioner** | **Substitute SQF Practitioner — VACANT. This is D-02 and it is the one gap that keeps 2.1.1.3 open.** |
| Production Supervisor | SQF Practitioner |
| Production Operator | Production Supervisor |
| Receiving / Goods-In | Production Operator |
| Maintenance | Contracted provider |

---

## 6. The one question left

**Who holds the Production Supervisor post, and is anyone else working on site who is not in the
staff directory?**

The directory shows three working positions — CEO, one Production employee, an IT Consultant with no
portal access — and the rest are auditor accounts or unprovisioned records. A Production Supervisor
post that is real must be held by someone, and 2.1.1.3 is about the site rather than about who has a
portal login. Part-time, seasonal and family workers all count.

If the Supervisor and the Operator are the **same person**, that is allowed — but then §4.4's
"does not release the line" becomes the only thing keeping the sign-off honest, and SOP-501/502/503
etc. that say *"do not operate unless the Supervisor has trained and signed you off"* need rereading
to check they do not have someone signing off their own training.

---

## 7. Follow-on work this creates (not part of D-01)

1. **Normalise QA and Quality Leader to SQF Practitioner** — 30 lines across 12 **active**
   documents, so each is an amendment to a controlled document with a revision bump and a history
   entry. Compound forms need judgement, not find/replace: *QA Technician*, *QA/QC Lead*,
   *QA/Production Manager*, and FSQM-012's *"SQF Practitioner / QA"* which simply de-duplicates.
   **`FRM-702`'s Section 2 instruction still reads "To be filled out by QA / Quality Leader"** and is
   already on record as needing this fix.
2. **Add the maintenance providers to the Contract Services Register (D-10)** once the boundary in
   §4.6 is confirmed.
3. **Finish D-02 in the same pass**, so limb (ii) closes alongside (i) and (iii).
