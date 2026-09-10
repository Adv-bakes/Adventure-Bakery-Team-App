# FSQM-004 — Organizational Structure and Responsibilities (D-01, draft)

| | |
|---|---|
| **Document No.** | FSQM-004 |
| **Title** | Organizational Structure and Responsibilities |
| **Type** | fsqm |
| **Deliverable** | D-01 (Wave 1) |
| **Clause** | SQF Food Safety Code: Food Manufacturing, Edition 9 — **2.1.1.3** |
| **Status** | DRAFT — not written to the database. Five questions below must be answered first. |

Drawn **by position, never by person**. A document that names an individual has to be reissued when
that individual changes, and 2.1.1.3 asks for personnel to be identified by their responsibilities
in the structure — not for a staff list.

---

## 1. What the clause actually asks for

2.1.1.3 is one sentence doing four jobs, and it is worth separating them because the site meets
them to very different degrees today:

| | Requirement | Where it stands |
|---|---|---|
| i | The reporting structure shall **identify and describe site personnel with specific responsibilities** for tasks within the food safety management system | No structure document exists |
| ii | **Identify a backup for the absence of key personnel** | None identified — this is also D-02 |
| iii | **Job descriptions for the key personnel shall be documented** | None documented |
| iv | Departments and operations are **appropriately staffed and organizationally aligned** to meet food safety objectives | **This is the finding underneath the finding — see Part 3** |

> ⚠️ **The workbook maps D-01 to "2.1.1.3, .4" and D-02 to "2.1.1.5". That mapping is wrong, and
> it matters.** In the Food Manufacturing edition, **2.1.1.4** is *"designate a primary and
> substitute SQF practitioner"* and **2.1.1.5** is that practitioner's *competency* (employed on
> site, HACCP course completed, understands the Code). Both are D-02's artifact, not D-01's.
> D-01 produces the reporting structure and the job descriptions, which is **2.1.1.3**.
>
> The consequence: **D-01 cannot close 2.1.1.3 on its own either.** Limb (ii) requires a backup for
> key personnel, and the key person is the SQF Practitioner, whose substitute is designated by D-02.
> The two deliverables interlock and should be finished together.

---

## 2. What the documents already in force actually require

This is the part that could not be guessed, so it was measured. **35 active controlled documents
carry a Responsibility section.** Between them they assign work to thirteen role names:

| Role named | Active documents | Holder today |
|---|---:|---|
| Maintenance | **14** | **nobody — see Q1** |
| SQF Practitioner | 11 | CEO |
| QA | **9** | **nobody — see Q2** |
| Production staff | 9 | one production employee |
| Quality Team | 6 | CEO |
| Management team | 6 | CEO |
| Admin | 5 | CEO |
| Supervisors | **4** | **nobody — see Q3** |
| All staff | 3 | everyone |
| Quality Leader | **2** | **nobody — see Q2** |
| Sales · Reception · Action owners | 1 each | CEO |

Against that, the staff directory holds **three working positions**: CEO, one Production employee,
and an IT Consultant with no portal access. The remaining profiles are read-only auditor accounts
and unprovisioned records.

**So thirteen role names resolve to three people, and four of those names resolve to nobody at
all.** That is limb (iv) of the clause — *appropriately staffed and organizationally aligned* — and
it is why this deliverable is worth more than the paperwork it looks like.

### The roles with no holder, and where they are relied on

- **Maintenance — 14 documents.** Every equipment SOP (SOP-501 to 505, 601 to 605, 905) plus
  FSQM-012, FSQM-022 and SOP-11.7.3. This is not inherited boilerplate: those SOPs were written
  here, for this site's machines, and each assigns real work to Maintenance.
- **QA — 9 documents.** FSQM-012, SOP-2.3.1, SOP-2.3.2, SOP-2.3.2.3, SOP-2.3.4, SOP-2.9,
  SOP-11.2.12, SOP-11.7.3, SOP-506. **Some of these were authored here**, so QA cannot simply be
  written off as a Compass Blending import — it has become working vocabulary.
- **Supervisors — 4 documents.** FSQM-009, FSQM-012, SOP-2.2.3, SOP-2.9. With one production
  employee there is no supervisory layer to supervise.
- **Quality Leader — 2 documents.** SOP-2.2.3, SOP-2.3.2. This one *is* on the known Compass
  Blending inheritance list.

---

## 3. Proposed structure — by position

Reporting lines, not people. Positions marked **(vacant)** are ones the documents rely on and
nobody currently fills.

```
                    Senior Site Management
                    (Managing Partner / CEO)
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
  SQF Practitioner      Production            Administration
  (primary)             Operator              (purchasing, records,
        │                                      supplier files)
  SQF Practitioner
  (substitute) (vacant — D-02)

  Supporting functions, however they are resourced:
    Maintenance  (vacant or contracted — Q1)
    Sanitation   (currently the Production Operator — Q4)
```

**One person holding several posts is permitted and is not the problem.** What is not permitted is
a procedure that describes a *hand-off between two posts the same person holds* — a quorum of one
is not a control, and writing it as one invites an auditor to test a separation of duties that does
not exist. Where this document confirms that two posts are held by one person, any procedure step
that passes work between them must be rewritten rather than relabelled.

---

## 4. Job descriptions — scope

2.1.1.3 requires job descriptions for **key personnel**: those performing key process steps in the
food safety management system. On the evidence in Part 2 that is five positions:

1. **Senior Site Management** — policy, resources, food safety culture, and the appointment of the SQF Practitioner.
2. **SQF Practitioner (primary and substitute)** — owns the SQF System; approves controlled documents; decides product release under FSQM-020; owns CAPA under FSQM-009.
3. **Production Operator** — makes the batch to the batch sheet; performs and records the in-process inspection; performs sanitation and the pre-operational check.
4. **Receiving / Goods-In** — inspects and accepts incoming material against FRM-301; rejects or holds what fails.
5. **Maintenance** — planned and reactive maintenance of food-contact equipment; food-grade lubricants; post-maintenance release of equipment back to production.

Each description will state: purpose, the food-safety tasks the position owns, the records it
completes, who it reports to, the competencies required, and **who covers it in absence** — which
is limb (ii) and cannot be written until Q1 and D-02 are answered.

I have **not** drafted the five descriptions yet. Writing "Maintenance shall…" before knowing
whether Maintenance is an employee, the CEO, or a contractor would produce a document that reads
well and describes nobody — the exact defect this programme has been removing from other documents
all week.

---

## 5. Questions that must be answered before this can be written

These are genuine blockers, not review comments. Each one changes what the document says.

**Q1 — Who performs maintenance?** Fourteen active documents assign work to Maintenance. Is it an
employee, the CEO, or an external contractor? *If it is a contractor, that also creates a row on the
Contract Services Register (D-10) and the position becomes a managed service rather than a job
description.*

**Q2 — Is "QA" a distinct post, or a synonym for the Quality Team?** Nine documents use it,
including some written here. Either it becomes a position in the structure, or it is normalised to
the site's own vocabulary and those nine documents are corrected. *"Quality Leader" (2 documents) is
Compass Blending inheritance and should go regardless.*

**Q3 — Is there a supervisory layer at all?** Four documents name Supervisors. With one production
employee there may be none, in which case those four documents should say who actually does the
thing.

**Q4 — Who owns sanitation as a position?** It is currently performed by the production employee,
but the sanitation records (FRM-903) and the pre-operational release are a distinct food-safety
responsibility. Is that the Production Operator's job description, or a separate post?

**Q5 — Are there employees not in the staff directory?** The directory shows three working
positions. If anyone else works on site — part-time, seasonal, family — they need a position on the
chart, because 2.1.1.3 is about the site, not about who has a portal login.

---

## 6. What happens after the answers

1. Write the five job descriptions, each with its coverage-in-absence provision.
2. Seed FSQM-004 as a draft migration, structured like the other FSQM programs.
3. **Sweep the vocabulary.** Whatever Q2 and Q3 decide, the documents that use a retired role name
   have to be corrected — that is a known, bounded list of eleven documents, and leaving them
   pointing at posts the structure does not contain would recreate the problem D-01 exists to fix.
4. Finish D-02 in the same pass, so limb (ii) closes with limb (i) and (iii).
