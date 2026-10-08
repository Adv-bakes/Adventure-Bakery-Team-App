# SQF Manufacturing Workflow Architecture

The proposal for the guided-workflow layer over the fillable forms: analysis, workflow map,
lot traceability, state model, phases and the decisions still open. Companion to
`DOCUMENT_REGISTER.md` (numbering) and `FORM_REPORTS.md` (derived reports).

Prepared 2026-10-07 from the repository, the migrations, and the session memory. No code was changed.
Where a figure comes from memory rather than the repo it says so; a live read of production needs
the owner's ok and was not run.

## Context

The site now holds about 55 fillable forms and 9 derived reports, all built on one engine
(`sop_documents.content.form_schema` + `sop_document_responses`). They are correct records, and they
are reached one at a time: SOPs Library, search a number, open the drawer, New Entry. The owner's
brief is to make the forms largely invisible by organizing them into the work the employee is
actually doing, with the full compliance record kept underneath for management and the auditor.

The answer this proposal arrives at is deliberately thin: **a guidance layer over the existing
entries, not a second system.** The forms stay the records. A small "lot" identity is added so a
production run can be followed from start to dispatch, and the "what is done, what is next, what is
blocking" questions are **derived from the records**, the way the app already derives verification
due dates, CAPA status and recall steps. Nothing that ticks a box without writing a record.

Two site facts shape every choice below. The team is three people: Gabriela (owner, admin, SQF
Practitioner, approves every document), Diana (the one production operator, `staff`) and Richard
(admin, IT). And the owner is at capacity on the remediation board, so the phases are small and each
one ships something usable on its own.

---

## 1. Current-state analysis

### 1.1 What the forms engine already does well (reuse, do not rebuild)

| Capability | Where | Reuse in the workflow |
|---|---|---|
| Fillable forms with sections, grids, pass/fail, signatures, drawn signatures | `src/lib/formSchema.ts`, `components/team/forms/` | Every stage opens an ordinary entry. The workflow never renders fields itself. |
| Entry lifecycle: draft / submitted, optimistic concurrency, reopen, attachments, revision pinning | `src/lib/formResponses.ts` | Unchanged. |
| Create-or-resume an entry, with a prefill | `createResponse(doc, prefill, {resumeAnyDraft})`; `/team/compliance/forms/:docId/start` (`FormEntryStart.tsx`) | The one way a stage starts its record. Safe to click twice. |
| "Today's entry" lookup by production date | `findTodaysDrafts` in `voiceCommandTarget.ts` | Day-level records (FRM-507, FRM-606, FRM-903) resolve to today's entry. |
| Carry-forward helpers | FRM-501 → FRM-520 (`batchSheetFill.ts`), lot → FRM-701 evidence (`releaseAssist.ts`), trace → FRM-012 (`lotTrace.ts`), copy from a previous entry, suggested cell values, derived lot code, pick-lists from another form (`optionsFrom`), team names, document links | Already the pattern: facts are filled, measurements are suggested, results are never answered. |
| Cross-form lot joins | `TRACE_FORMS`, `RELEASE_SOURCES`, `FORMULA_FORM` (three maps of form number → field ids, each with a mapping check) | The lot timeline and stage state read through the same maps. |
| Voice and hands-free CCP rows | `voiceCommands.ts`, `voiceHandsFree.ts`, the Coach orb | The Bake and Seal stages keep these as their fastest path. |
| Scheduled compliance + feed | `verification_schedule`, `verification-notifications` edge fn (2x/day), `internal_notifications`, Notifications page, sidebar badge, signature requests addressed to a person | The periodic category is already solved. Additions are rows and one or two feed types. |
| Audit trail | `sop_document_history` (published document changes), submitted/reopened stamps, append-only notification stamps | Unchanged. |
| Printable blanks, entry PDFs, CSV | `scripts/generate-form-blank.py`, `formPdf.ts`, `Records.tsx` | Unchanged. |

### 1.2 What is missing (facts, not opinions)

1. **"Lot" means three unrelated things.** The printed code is the Julian code (`julianLotCode`, year digit + day of year, derived on FRM-520 from the bake date; a lot = product + bake day per FSQM-021). The ops Batch Tracker generates `AB-YYYYMMDD-NNN`, which is never printed. Orders use `INITIALS-MMDDYY`. Nothing links any of them.
2. **The ops side and the compliance side share no key.** `production_orders`, `production_batches`, `batch_measuring_*`, `finished_goods_inventory` have no column or code path referring to `sop_document_responses`, and vice versa. The ops tables were built for the PSS / tolling client flow; the Batch Tracker and Measuring station are unused for rum cakes (3 batches, last 2026-08-20, from memory). `finished_goods_inventory` is the only shipment-shaped table and nothing in `src/` reads or writes it.
3. **The staff landing page is a legacy stub.** `ProtectedRoute` and `TeamAuth` send a `staff` user to `/team/operations-hub` (`OperationsHub.tsx`, writes `production_intake`, a table nothing else uses). `/team/dashboard` (`AdminDashboard.tsx`) is a client-account list. There is no page that answers "what do I do today".
4. **Nothing lists today's work in one place.** The Order Board calendar is the only "today" view and it is about client orders. Records.tsx is a per-form browser. The Notifications page covers only the scheduled items.
5. **Starting a form takes four actions** (sidebar → search → row → New Entry) and requires knowing the number. A notification link takes two.
6. **A failed check does nothing.** A Fail turns red; nothing opens a hold, a CAPA or a notification. The forms carry the cross-references as typed text (`Held on FRM-702`, `capa_no`, `associated_capa_number`, `hold_tag_no`) and FSQM-009 deliberately makes escalation risk-based, so this is partly by design. What is missing is the *path*: the person has to know FRM-702 exists and find it.
7. **No per-lot identity.** FRM-520 is "one entry per product per bake day" and so *is* the lot, but nothing stops a second FRM-520 for the same product and code (the 6273 test data had one submitted and one draft), and the other per-lot records (FRM-507 rows, FRM-606, FRM-701, FRM-703, FRM-801 rows) join to it by product-name and lot-code text through `normLot`/`sameProduct`. That works, and it is also why memory carries the rule "the same product name must be used on FRM-501, FRM-520 and the release record".
8. **Entries have no lot column and no index on `data`**; every cross-form loader pages a whole form client-side. Fine at this site's volume, worth knowing.
9. **Some physical steps have no record at all**: mixing, depositing, cooling/depanning, syrup making and the dip. FSQM-016 Attachment A names them (20 steps); the HACCP draft makes none of them a CCP. The stored-syrup lot is an open gap already recorded under D-14.
10. **Record counts as of today, from memory (not a live read):** FRM-507 and FRM-606 have zero entries since issue on 2026-09-11; FRM-520 has one draft (Pumpkin Spice 6279); FRM-701 has drafts including lot 6270 "Bahama Rum Cake"; FRM-913 has one submitted inspection; FRM-601 has one draft and no submitted label approval. The production records exist but are not yet in routine use, which is exactly the problem the brief describes.

### 1.3 The production process the records must follow (FSQM-016 Attachment A, 20 steps, Day 1 to 3)

Receive → store → weigh from original containers → mix → pan release spray (soy) → deposit → **bake (CCP 1, step 7)** → cool on racks → depan (same day or next) → make syrup if none in stock → dip at room temperature → **vacuum seal (CCP 2, step 13)** → box, ink-jet coder prints flavor + lot + best-by → case (48) → palletize and stretch wrap → store ambient → customer's carrier collects. A lot is one product on one bake day; packing can run into the next day and the coder is set to the bake day.

---

## 2. Complete form inventory

Every FRM and REP in the repo or named by code. "DB only" means the schema was authored in the app and is not in a migration; the field ids listed for those are the ones code reads. Lot-related means the record carries the finished lot code or an ingredient lot.

### 2.1 The rum cake production records (per lot or per production day)

| Form | Purpose | User | Frequency | Workflow / stage | Lot | Compliance purpose | Depends on / feeds |
|---|---|---|---|---|---|---|---|
| FRM-501 Formula Sheet & Batch Data | Master formula per product (ingredients, % and production qty, process parameters) | R&D (Gabriela) | Per product / version | Product setup (prerequisite) | No | SOP-2.3.1 new product; formula control | Feeds FRM-520 via `settings.batchSheet` |
| FRM-520 Production Lot Record | The lot: product, bake date, derived lot code, batches, ingredient lines with supplier lot + brand + expected/weighed qty, rework, packing (pack date, racked count, units packed, not packed, film lot, first-pack code check) | Production staff | Per product per bake day | Make Rum Cakes: Prepare, Pack | **The lot** | FSQM-021 (2.6.1.1, 2.6.1.2, 2.6.2.1, 2.8.1.8) | From FRM-501; read by FRM-701 helper, lot trace |
| FRM-507 CCP 1 Baking Monitoring Record | One row per oven load: time out, lot, oven °F, minutes, pass/fail; deviation log; verifier signature | Production operator; verifier = SQF Practitioner | Per production day | Make Rum Cakes: Bake | Row-level lot | FSQM-016 / FSQM-017 CCP record (2.5.2.1) | Voice command fills rows; read by FRM-701 helper |
| FRM-606 CCP 2 Vacuum Sealing Monitoring Record (v2) | Lot once at top; rows at Set-up, In process, After adjustment, End of run, At boxing; deviation log; verifier | Production operator; verifier | Per product per sealing day | Make Rum Cakes: Seal | Yes (top-level) | CCP record | Hands-free bar; read by FRM-701 helper |
| FRM-703 Retention Sample Log | One sample taken, where stored, discard due (derived), disposal | Production / SQF Practitioner | Per retention sample | Make Rum Cakes: Retention | Yes | FSQM-014 Part 6 | Per-sample discard reminders already in the job |
| FRM-701 Finished Product Release Record (v3) | Nine checks with evidence notes, net weights, label check, decision | SQF Practitioner | Per lot | Make Rum Cakes: Release | Yes | FSQM-020, **2.4.7 (Mandatory)** | Release helper reads FRM-520/507/606/903/702/601/704 |
| FRM-801 Dispatch and Vehicle Loading Record (v2) | Customer, carrier, vehicle, loaded rows (product, lot, qty, released?), vehicle check, loading, security | Dispatcher (production staff) | Per collection | Ship | Row-level lots | FSQM-036 (11.6.5), 2.6.3.1 dispatch + destination | Should pick from released lots |
| FRM-903 Daily Sanitation, Pre-Operation & Release Record (v6) | Pre-op surfaces, equipment status per SSOP, sanitizer ppm, footbath, glass, operational GMP, corrected + released | Production staff; supervisor verifier | Per production day | Start the day (gate for production) | No (`product_run` text) | FSQM-012 GMP, SOP-901..906 | Read by FRM-701 helper (check 2) |
| FRM-909 / 910 / 911 / 912 Machine cleaning logs (mixer, Kook-E-King, Beldos, Groen) | Cleaning steps, product run, allergen change, sanitizer ppm | Production staff | Per clean (end of run / changeover) | End the day / changeover | No | SSOPs 901..904; FRM-903 equipment grid references them | |

### 2.2 Receiving and materials

| Form | Purpose | User | Frequency | Workflow | Lot | Compliance | Dependencies |
|---|---|---|---|---|---|---|---|
| FRM-301 Incoming Material Receiving & Inspection Log (v2) | Grid per delivery line: supplier, brand, material, supplier lot, qty, carrier/package pass-fail, temp, CoA, hold status; supervisory verification | Receiver | Per delivery | Receive a delivery | Ingredient lots | SOP-2.3.4, FSQM-014, FSQM-035 | Brand checked against FRM-207; read by lot trace |
| FRM-207 Material Specification Register (v3) | One entry per approved material: manufacturer, bought-from (from FRM-202), declarations, allergens, next review | SQF Practitioner | Per material; review date | Periodic (per-entry review) | No | SOP-2.3.2, 2.3.2.2 | `optionsFrom` FRM-202 |
| FRM-202 Supplier Approval | Supplier + status | SQF Practitioner | Per supplier | Periodic | No | 2.3.4 | REP-201 |
| FRM-203 / 204 / 205 Supplier questionnaire / annual performance evaluation / supplier corrective action (DB only) | | SQF Practitioner | Per supplier / annual / event | Periodic / exception | No | 2.3.4 | FRM-702 `associated_scar_number` |
| FRM-206 Contract Services Register | Contractor, licence/insurance, expiry | Admin | On change; licence expiry | Periodic | No | 2.3.3 | Pest licence expired 2026-09-30 (memory) |
| FRM-402 Chemical Register | Chemicals on site, SDS | SQF Practitioner | On change | Periodic | No | FSQM-032 | |
| FRM-401 Temperature Monitoring Review | Monthly review pre-filled from sensor data and alerts | SQF Practitioner | Monthly | Periodic | No | SOP-401 | Launched from the Temperature report |

### 2.3 Product setup (per product, not per lot)

| Form | Purpose | User | Frequency | Workflow | Lot | Compliance |
|---|---|---|---|---|---|---|
| FRM-601 Label Review & Approval (DB only) | Label artwork approval per product/version | SQF Practitioner | Per label version | Product setup (prerequisite); REP-602/603 derive from it | No | SOP-2.3.2.3, 2.8.1.9 |
| FRM-704 Finished Product Specification | One per product: formula ref, label ref, coding, shelf life, net weight, customer approval | SQF Practitioner | Per product | Product setup | No | 2.3.2 / 2.4.4 |
| FRM-502 First Production Run Report (DB only) | New-product first run | R&D | Per new product | Product setup | No | 2.3.1 |
| FRM-004 Equipment Register (v2) | 13 machines, food contact, SOPs, PM frequency | Admin | On change | Periodic | No | SOP-11.1.7, 11.2.1.2 |

### 2.4 Exception and food-safety-system records

| Form | Purpose | User | Frequency | Workflow | Lot | Compliance |
|---|---|---|---|---|---|---|
| FRM-702 Non-Conforming Material Hold & Tagging (v2, DB only) | Hold tag, material, supplier lot, qty, issue, disposition, CAPA / SCAR refs | SQF Practitioner / whoever finds it | Event | Something went wrong | Supplier lot field (no our-lot field) | FSQM-018, 2.4.5 / 2.4.6 |
| FRM-007 CAPA Report | Source, severity, lots affected, hold tag, 5 whys, actions, verification, closure | SQF Practitioner | Event, risk-based (FSQM-009 Part 3) | Something went wrong | `lots_affected` text | FSQM-009, 2.5.3 |
| FRM-002 Customer Complaint Report (DB only) | Complaint, product, lot, classification, CAPA ref | Admin / SQF Practitioner | Event | Exception (external trigger) | `lot_batch_code` | REP-003 |
| FRM-012 Withdrawal, Recall & Mock Recall Record | Trace back/forward, reconciliation, notifications; RecallWorkspace | SQF Practitioner | Event + annual mock | Recall (existing workspace) | `lot_codes` | FSQM-023, 2.6.3 |
| FRM-011 Recall & Crisis Contact List | Contacts, reviewed annually | Admin | Annual | Periodic | No | FSQM-023 |
| FRM-013 Crisis Management Review & Test | | Senior management | Annual | Periodic | No | FSQM-024 |
| FRM-014 Food Defense & Fraud Review & Test (draft) | | | Annual when issued | Periodic | No | FSQM-025/026 |
| FRM-015 Change Assessment Record | Change control | SQF Practitioner | Event | Exception (planned change) | No | FSQM-007 |
| FRM-908 Glass / brittle plastic breakage incident (DB only) | `car_ref` | Finder | Event | Something went wrong | No | SOP-11.7.3 |
| FRM-010 Internal Audit Record | Audit guide, findings, AI evidence draft | Internal auditor (Richard) | Quarterly | Periodic | No | FSQM-038 |
| FRM-001 Management Review | | Senior management | Annual | Periodic | No | FSQM-005 |
| FRM-005 SQF Practitioner Designation | | Owner | On change | Periodic | No | FSQM-003 |
| FRM-006 Blackout Period Declaration | `covers_until` period | Senior management | Annual (covers-until) | Periodic | No | D-05 |
| FRM-009 Monthly SQF Update Record | Regulatory / SQF news | SQF Practitioner | Monthly | Periodic | No | FSQM-011 |

### 2.5 Sanitation, GMP, maintenance, visitors, HR

| Form | Purpose | User | Frequency | Workflow | Lot | Compliance |
|---|---|---|---|---|---|---|
| FRM-913 GMP / Food Safety Inspection (v3) | Module 11 walk, eight grids, CAPA no. column | SQF Practitioner | Monthly | Periodic | No | FSQM-022; evidence for ~80 observation clauses |
| FRM-901 Master Sanitation Schedule completion (v2) | Periodic cleaning tasks done | Production staff | Per periodic task | Periodic | No | SSOPs |
| FRM-902 Sanitation Verification Log | Swab results | SQF Practitioner | Weekly on the schedule; swab program status to confirm | Periodic | No | 11.2.5.9 |
| FRM-907 Glass & Brittle Plastic Register | | | Monthly check | Periodic | No | SOP-11.7.3 |
| FRM-914 Pest Activity Log | | | Per visit / sighting | Periodic / event | No | FSQM-031 |
| FRM-915 Annual Water Supply Verification (draft) | | | Annual when issued | Periodic | No | FSQM-033 |
| FRM-916 Allergen Cleaning Verification (draft) | | | Yearly / 3-monthly when issued | Periodic | No | FSQM-027 |
| FRM-508 Monthly Maintenance Check; FRM-509 Maintenance & Repair | | Admin / contractor | Monthly / per job | Periodic / event | No | FSQM-029 |
| FRM-705 Calibration Directory & Check | | SQF Practitioner | Monthly | Periodic | No | FSQM-030 |
| FRM-706 Environmental Monitoring Results (draft) | | | Every 4 months when issued | Periodic | No | FSQM-015 |
| FRM-905 / 906 Visitor Sign-In / GMP Acknowledgement | Written by the kiosk | Visitor | Per visit / 12 months | Visitor kiosk (exists) | No | FSQM-012 Part 6 |
| FRM-952 Training Competency Verification; FRM-953 Training Sign-In | | Trainer | Event | HR (exists) | No | SOP-2.9 |
| FRM-101 / 102 (DB only) | Sales / NPD (PRF, PSS) | Sales | Per concept | Brand portal | No | 2.3.1 |
| REP-003, 007, 201, 602, 603, 701, 905, 951 | Derived registers over FRM-002, 007, 202, 601, 601, 702, 905, training | Read-only | Live | Management views | | |

---

## 3. Workflow categorization

| Category | Contents | Handled by |
|---|---|---|
| **Routine, per lot** | FRM-520, 507 rows, 606, 703, 701, 801 rows | **Make Rum Cakes** workflow (section 6) + **Ship** |
| **Routine, per day** | FRM-903 (open), FRM-909..912 (close / changeover) | **Start the day** gate + end-of-day prompt |
| **Routine, external trigger** | FRM-301 | **Receive a delivery** |
| **Event-driven exception** | FRM-702, FRM-007, FRM-908, FRM-002, FRM-012, FRM-015 | **Something went wrong** path, launched from the failing record |
| **Periodic** | everything in 2.2 to 2.5 with a frequency | Existing `verification_schedule` + notifications; a few rows to add |
| **Product setup** | FRM-501, 601, 704, 502 | Prerequisites checked at "Start a lot", edited where they live today |
| **Already workflow-shaped** | Visitor kiosk, recall workspace, temperature review, training | Left as they are |

---

## 4. Workflow vs stage vs task classification

The test applied to every candidate: a **workflow** is something the employee can name as one piece of work with a clear start and end; a **stage** is what they naturally do next inside it; a **task** is the action; the **record** is the form entry the task produces.

| Candidate from the brief | Decision | Why |
|---|---|---|
| Daily opening / production readiness | **Stage of the day, gate for production** (not a stage of the lot) | FRM-903 is per day and serves every lot baked that day. A lot spans two or three days, so readiness is re-evaluated each day the lot is worked. |
| Ingredient receiving | **Own workflow** | External trigger (a truck), independent of any lot, one record. |
| Rum cake production | **One workflow, "Make Rum Cakes", per lot** | Lot = product + bake day. Stages are where a record is written. |
| Mixing, depositing, cooling, depanning, syrup, dipping | **Guidance inside a stage, not stages** | No record exists for them and FSQM-016 makes none a CCP. A stage that ends in "mark done" with no record is a checklist tick, which FSQM-017 Part 7 says is not evidence. Shown as the "what you do here" text under Prepare / Bake / Seal. (Owner decision 2, section 19.) |
| Finishing | Guidance under Seal | The dip is "finishing"; no record. |
| Packaging + label verification | **Stage: Pack** | FRM-520 section 3 (pack date, counts, film lot, first-pack code check). |
| Final verification + release | **Stage: Release** | FRM-701; the SQF Practitioner's stage. |
| Staging | **Not a stage** | Finished product is stored ambient in the dry room until collection; no record and no handoff. Shown as the lot's state "Released, awaiting collection". |
| Shipping / delivery | **Own workflow, "Ship"** | Trigger is the carrier; one FRM-801 covers several lots. |
| Periodic SQF compliance | **Not a workflow** | Already the schedule + feed. |
| Corrective action / exception | **A path, not a workflow** | Entered from a failing check; ends in a hold with a disposition and, when FSQM-009 says so, a CAPA. |

---

## 5. Proposed workflow map

```
                          TODAY  (the employee's home page)
   ┌────────────────┬──────────────────┬───────────────────┬──────────────────┐
   │ START THE DAY  │ MAKE RUM CAKES   │ RECEIVE           │ SHIP             │
   │ FRM-903 today  │ Start a lot      │ Receive a delivery│ Record a         │
   │ (gate)         │ Continue Lot 6270│ (FRM-301)         │ collection       │
   │                │ Continue Lot 6279│  └► hold? FRM-702 │ (FRM-801 picks   │
   │ End of day:    │                  │                   │  released lots)  │
   │ cleaning logs  │                  │                   │                  │
   └────────────────┴──────────────────┴───────────────────┴──────────────────┘
            ▲ gate                │
            └─────────────────────┘
   MAKE RUM CAKES - Lot 6270 (Rum Cake - Original, baked 2026-09-27)
     1 Prepare the batch   FRM-520 §1-2  (from FRM-501; supplier lots by label scan; weighed per batch)
     2 Bake  (CCP 1)       FRM-507 rows for this lot   (voice card still works)
         cool on racks, depan same day or next          (guidance; the lot waits here overnight)
     3 Seal  (CCP 2)       FRM-606 for this lot         (hands-free bar still works)
         syrup + dip before sealing                     (guidance)
     4 Pack                FRM-520 §3  (pack date, counts, film lot, first-pack code check)
     5 Retention sample    FRM-703
     6 Release             FRM-701  (SQF Practitioner; helper fills the evidence)
     → Released, awaiting collection → rows on an FRM-801 → Shipped (closed)

   SOMETHING WENT WRONG (from any failed check, any stage)
     record the deviation on the form you are on
       → Put it on hold (FRM-702, prefilled)  → disposition
       → Open a CAPA (FRM-007, prefilled) when an FSQM-009 Part 3 trigger applies
     a lot with an open hold cannot be released (FRM-701 check 3 shows it)

   PERIODIC (unchanged): verification_schedule → notifications → /start links
```

---

## 6. Detailed Rum Cake Production Workflow

**Start.** On Today, "Start a lot": pick the product (list from FRM-501 / FRM-704 / previous FRM-520 entries, the way the release helper builds `productOptions`), pick the bake date (default today). The lot code is derived (existing `julian_lot`). If a lot for that product + code already exists, it is **resumed, never duplicated**. Creating the lot creates its FRM-520 entry with product and bake date prefilled and runs "Start from the formula sheet" automatically when exactly one FRM-501 entry matches (else the existing picker).

**Prerequisites shown at Start** (each with its resolve button):

| Check | Source | Block or warn |
|---|---|---|
| Today's FRM-903 submitted (pre-op release signed) | FRM-903 `inspection_date` = today, status submitted | **Block** (owner decision 1) |
| The product has a formula | FRM-501 entry for the product (draft flagged "FRM-501 v1 (draft)", as now) | Warn |
| The product has an approved label | FRM-601 submitted for the product | Warn until the first approvals are submitted, then block (owner decision 4) |
| The product has a specification | FRM-704 entry | Warn |
| No open hold on the product or its materials | FRM-702 with no final disposition | Warn (block at Release) |
| No open temperature alert | `temperature_alerts` open | Warn |

**Stages and what each one does.** State is derived; the rail shows done / current / blocked / not applicable.

| # | Stage | Record and the action | Carried forward (filled) | Left to the person | Done when |
|---|---|---|---|---|---|
| 1 | Prepare the batch | FRM-520 §1-2, opened in FormEntry with lot context | Product, bake date, lot code, ingredient lines, brand, expected qty + unit (from FRM-501), number of batches if the formula states it | Supplier lots (label scan), weighed qty per batch (grey suggestion, tap to accept), rework | Section 1-2 required fields present (draft saved) |
| 2 | Bake (CCP 1) | Today's FRM-507 entry (resume-or-create by `production_date`), one row per oven load seeded with this lot's code | `production_date`, `product`, row `lot_code`, time out, initials | Oven °F, minutes, within limits, deviations | At least one row for this lot; a Fail opens the exception path |
|   | (cool, depan) | No record. Guidance text. The lot simply stays at "Baked" until sealing starts, possibly next day. | | | |
| 3 | Seal (CCP 2) | FRM-606 for this lot (resume-or-create by `production_date` + lot; v2 has the lot at the top) | Date, product, lot code | Rows (set-up, in process, end of run, at boxing), rejects | At least a Set-up row; a Fail opens the exception path |
| 4 | Pack | FRM-520 §3 | Pack date (today), code checked by (initials offered) | Racked count, units packed, not packed, film lot, first-pack code check | FRM-520 submitted |
| 5 | Retention sample | FRM-703 | Product, lot, date produced, customer (from FRM-704 `customer_brand`), date taken, discard due (derived) | Units, location, printed date (scan), signature | Submitted. Whether every lot needs one is owner decision 3 |
| 6 | Release | FRM-701 via the existing helper, now opened with product + lot pre-chosen | Everything the helper already fills: batch ref, date produced, customer, label ref, net weight declared, evidence notes for six checks including "held" and "FRM-903 found/not found" | Nine results, three pack weights, decision, signature | Submitted with decision RELEASED. NOT RELEASED → exception path |
|   | Awaiting collection | Derived state | | | FRM-801 submitted with a loaded row for this lot |
|   | Shipped / closed | Derived; a lot can also be closed by hand with a reason (scrapped, destroyed) | | | |

**Who does what.** Diana does 1 to 5 and the dispatch; Gabriela does 6 and signs the verifier lines on FRM-507/606 (already admin/owner only). The lot page shows "Waiting for the SQF Practitioner" at stage 6 and the Today page shows Gabriela "Lots awaiting release: 2".

**Spanish.** The operator's `preferred_language` already drives the voice panel. The lot page and Today page should carry an EN/ES switch from the start (strings in one file, as `voiceMessages.ts` does), because the operator reads it on the floor.

---

## 7. Lot 6270 traceability architecture

A lot is **product + lot code** (two products baked the same day share a code). Lot 6270 = "Rum Cake - Original, baked 2026-09-27".

**Identity.** A small table `production_lots` gives the lot a stable id (section 15). The FRM-520 entry stays the record; the table row only says the lot exists and whether a person closed it.

**Links.** Two kinds, both already how the trace works:
- *Entry-level*: per-lot records (FRM-520, 701, 703, 702 when a hold is for a lot) carry `lot_id`, set when the workflow creates them. Existing entries are matched by product + code and offered for linking.
- *Row-level*: day-level records (FRM-507 oven loads, FRM-606 rows before v2, FRM-801 loaded rows) keep the lot code in the row and join by `normLot` + `sameProduct`, exactly as `RELEASE_SOURCES` and `TRACE_FORMS` do today.

**The chain the brief asks for**, as it exists in the records:

```
Supplier (FRM-202, FRM-207 manufacturer)
  → FRM-301 receipt row (supplier, brand, material, supplier lot, qty)
    → FRM-520 ingredient row (brand, supplier lot, qty weighed)      ◄ pan spray + film lot too
      → Lot 6270 (FRM-520: product, bake date, lot code, batches, pack counts)
        ├ FRM-507 rows (oven loads, within limits)
        ├ FRM-606 (seal checks)
        ├ FRM-703 (retention sample, discard date)
        ├ FRM-702 / FRM-007 (any hold / CAPA)
        └ FRM-701 (release decision, by whom, when)
          → FRM-801 loaded row (customer, carrier, vehicle, qty, date)
```

**Lot timeline page** (`/team/production/lots/:id`, same page as the workflow, with a "History" tab for management and the auditor): one line per event with who, when and a link to the record. Built from `loadTraceRecords` / `runTrace` plus the `lot_id` join, so it uses the three mapping checks and shows "FRM-801 no longer has…" instead of a silent gap. Gaps are computed as they are in `runTrace` (no receipt for an ingredient lot, no retention sample, no release, drafts).

**Not changed.** Lot-code generation, the voice cards, the trace page, the recall workspace.

---

## 8. Workflow state model

**Decision: state is derived from the records, never stored for a stage.** The app already does this for verification due dates, CAPA status (REP-007), recall steps (`deriveRecallSteps`) and the release helper. A stored stage flag can disagree with its record; a derived one cannot. The only stored states are human decisions.

Lot states (derived unless marked):

| State | Meaning | Derived from |
|---|---|---|
| Not started | Lot exists, FRM-520 has no ingredient rows | FRM-520 data |
| In progress | Any of stages 1 to 5 under way | Presence of the records |
| Blocked today | Today's FRM-903 not submitted | FRM-903 |
| Exception | A Fail on FRM-507/606/520 code check with no hold or deviation action recorded, or an FRM-702 for the lot with no final disposition | Those records |
| Awaiting release | FRM-520 submitted (and FRM-703 if required), no FRM-701 | |
| Released | FRM-701 submitted, decision RELEASED | |
| Not released | FRM-701 decision NOT RELEASED | |
| Awaiting collection | Released, no FRM-801 row | |
| Shipped | FRM-801 submitted with a row for the lot | |
| Closed (stored) | A person closed it with a reason (all shipped; scrapped; test) | `production_lots.closed_at/by/reason` |
| Cancelled (stored) | Started by mistake, nothing recorded | same column, reason |

Stage states on the rail: done · current · blocked (with the reason and the button that resolves it) · waiting for someone else (names the position) · not applicable (e.g. no FRM-606 for a flow-wrapped product, owner decision 9).

The brief's "Awaiting Verification" is the verifier signature on FRM-507/606 and is already a signature request addressed to Gabriela; the rail shows it as "waiting for the SQF Practitioner's signature" but does not block the next stage, because the CCP record's verification is a review, not a release gate (FSQM-017 weekly review rows).

---

## 9. Exception and corrective-action model

The documents already say how exceptions work; the app just has to put the path on screen.

1. **The form that found it records it.** FRM-507 and FRM-606 each carry a deviation log with the actions FSQM-016 allows (rebake / reseal, hold on FRM-702, destroy). FRM-520's code check has "Did not match - held on FRM-702". FRM-301 has hold status per line. FRM-701 has NOT RELEASED + hold tag.
2. **When a Fail or a hold option is chosen, a panel appears on the entry** ("What happens now"): the form's own deviation section is scrolled to (the voice path already does this), then two buttons:
   - **Put it on hold (FRM-702)**: creates the hold prefilled with material / product, lot, quantity if known, description = the failed check and its value, source reference = the entry's form number + title, and `lot_id`. The hold tag number is typed (it is a physical tag).
   - **Open a CAPA (FRM-007)**: shown with FSQM-009 Part 3's triggers listed so the person can see whether one applies; prefilled with source, source_ref, lots_affected, hold_tag_no. Never created automatically; FSQM-009 is risk-based on purpose and a routine on-the-spot correction stays on the form.
3. **An open hold blocks Release** and is already written into FRM-701 check 3's evidence note by the helper. The lot shows "On hold" until the FRM-702 disposition is final; REP-701 lists releases of held material as it does now.
4. **Ordinary losses are not exceptions**: broken, off-size and oversoaked cakes are counted in FRM-520 `not_packed`, per FSQM-021 line 7. The panel does not fire for them.
5. **Notifications** (recommendation): one new feed type `hold_open`, raised by the existing job for an FRM-702 with no final disposition after N days, addressed to the SQF Practitioner position, resolved when the disposition is recorded; not dismissable (same reasoning as temperature alerts). N is owner decision 6. CAPA follow-up already exists as `capa_review` monthly.

---

## 10. Notification architecture

Keep what exists; it is already the design the brief asks for (assigned to a position, date-aware, severity escalates due → overdue, traceable with stamps, separate from production work).

Additions, all small:

| Addition | Mechanism | Notes |
|---|---|---|
| Contractor licence / insurance expiry (FRM-206) | A `verification_schedule` row with `covers_until_field` = the expiry field, 30-day lead | Same mechanism FRM-006 uses. The pest licence expired 2026-09-30 per memory, so this would have fired. |
| Material spec review due (FRM-207 `next_review`) and supplier re-evaluation (FRM-202/204) | Per-entry links, the way the job already builds FRM-703 per-sample links | Needs a small generalization of the retention-links code |
| Allergen verification (FRM-916), EMP rounds (FRM-706), water (FRM-915) | `planned` rows now, activated at issue | Owner already asked for the 4-monthly EMP row at issue |
| Hold open (section 9) | New feed type | |
| Escalation when overdue past grace | Add `escalate_to_position` to the schedule row; the job refreshes the open notification's position | Recommendation, not required by 2.5.2.2 |
| Today page "Due this week" card | Reads the same open notifications | No new data |

Not added: per-person routing (the schedule is position-based by design and the team is three people), reminders for lot stages (a lot in progress is on the Today page, which is the reminder).

---

## 11. Role-based dashboard concept

Real personas: the production operator (staff), the owner / SQF Practitioner (admin, owner), the IT admin, the auditor (read-only), the kiosk. The brief's seven roles collapse to two views plus the auditor.

**Today** (`/team/today`, replaces `/team/operations-hub` as the staff landing; added to the Home nav for everyone but the auditor and kiosk):

```
TODAY · Tuesday 7 October 2026                              [EN | ES]

START THE DAY
  ○ Daily Sanitation & Pre-Op (FRM-903)        [Start]        ← becomes ✓ with time + who
PRODUCTION
  [+ Start a lot]
  ● Lot 6279 · Rum Cake - Pumpkin Spice · baked 10/06   Stage 3 Seal · next: Set-up row   [Continue]
  ● Lot 6270 · Rum Cake - Original · baked 9/27          Awaiting release (SQF Practitioner)
RECEIVING
  [Receive a delivery]        Open holds: 0
FINISHED PRODUCT
  Awaiting release: 1 (admin/owner see [Release])      Released, awaiting collection: 0
SHIPPING
  [Record a collection]       Last: FRM-801 10/03 · Customer X · 2 lots
END OF DAY
  Cleaning logs for machines run today: Mixer ✓  Depositor ○  Kettle ○
ATTENTION (admin/owner)
  Due this week: 3 · Overdue: 1 · Signatures asked of you: 2 · Holds open: 0    [Notifications]
```

Staff see Start the day, Production, Receiving, Shipping, End of day. Admin/owner additionally see Finished product actions, Attention, and the "waiting for you" items. The auditor keeps the compliance pages and gains the read-only lot History.

The sidebar is otherwise unchanged. The SOPs Library stays the admin's document surface; Today is the floor's.

---

## 12. Employee user experience

The operator's day, as proposed:

1. Signs in on the tablet; lands on **Today**. The first card says Daily Sanitation & Pre-Op is not done. Taps Start; FRM-903 opens as now, with "Back to Today" in the sticky bar. Submits. The card turns into "✓ 07:42 Diana".
2. Taps **Start a lot**: picks "Rum Cake - Original", bake date today. Sees lot 6281 derived. Sees the prerequisites (formula found, label approval found or warning). Taps Start. FRM-520 opens with the formula's lines already in; she scans each bag for the supplier lot, weighs, taps the grey suggested weight where it matches, saves.
3. Back on the lot page the rail shows Prepare ✓, **Bake** current. Taps "Record an oven load" or reads the voice card as now; today's FRM-507 opens with the lot's row seeded. Enters °F and minutes, taps Pass or Fail. A Fail shows "What happens now" with the deviation log and the hold button.
4. Next day: Today shows "Continue Lot 6281 · Stage 3 Seal". The readiness card is for the new day. Seal, pack, retention sample each open their record with the lot already written in.
5. The lot shows "Awaiting release"; Gabriela's Today shows it under Finished product with [Release]. FRM-701 opens with the lot chosen and the evidence filled, as the helper does today.
6. The carrier arrives: **Record a collection** opens FRM-801; the loaded grid offers the released, uncollected lots as a pick-list (product + lot + units packed as a grey suggestion).

What she never does: types a lot code twice, searches for a form number, decides which form a failed check needs, or re-enters the product.

Owner's standing UX rules are kept throughout: measurements are suggested and tapped, never filled; notation is filled; blocking states are loud and red with the resolving button; lists to pick from rather than "copy the last one".

---

## 13. SQF / compliance considerations

- **No record is removed or merged.** Every stage writes the same `sop_document_responses` row it writes today, under the same form number and revision, with the same signatures. The auditor's view (Records, Entries tab, PDFs, FSMS Index, Verification Schedule) is unchanged.
- **A tick is never evidence.** Stage state is derived from records; there is no "mark stage done" without a record. This is the rule FSQM-017 Part 7 already states for notifications.
- **Prefill fills facts and notation; results and measurements stay with the person** (FSQM-020 "shall confirm each"; the owner's rule for weights).
- **Verifier signatures stay admin/owner only** and RLS is not widened (CLAUDE.md "Signature requests").
- **Form schema changes are document revisions** approved by GJM. Phase 1 to 3 need none. Phase 4 recommends FRM-702 v3 (section 15). Anything else that turns out to need a field is raised as a revision, not patched.
- **Which clauses this touches, factually:** 2.6.1 / 2.6.2 (identification and traceability: the lot link is the chain FSQM-021 describes), 2.4.7 (release, mandatory: the release stage is FRM-701 unchanged), 2.5.2.1 (CCP records: FRM-507/606 unchanged), 2.5.2.2 (schedule: unchanged), 2.4.5 / 2.4.6 (holds and corrective action: FRM-702 / FRM-007 unchanged, reached sooner). Everything else in this proposal is usability and is **labelled recommendation** where it goes beyond the documents.
- **Closing a lot by hand** (section 8) is a workflow convenience, not a food-safety decision; the reason is stored with who and when so it can be read later.

---

## 14. Identified gaps

Facts first, recommendations marked (R).

| Gap | Kind | Proposal |
|---|---|---|
| No lot identity; duplicate FRM-520 for one lot possible | Data | `production_lots` + unique (product, lot code); Start resumes |
| Per-lot records join by product-name text | Data | `lot_id` on per-lot entries; row-level text join kept for day-level forms |
| Staff landing is a dead page | UI | Today page replaces it |
| No "what next" anywhere | UI | Lot page rail |
| Failed check has no path | UI | Exception panel with prefilled FRM-702 / FRM-007 |
| FRM-702 has supplier-lot fields but no product / our-lot field; its Section 2 still says "QA / Quality Leader" | Form | (R) FRM-702 v3: add product + our lot code, fix the role wording; GJM approval |
| FRM-507 lot per row while FRM-606 v2 has lot once | Form | (R) FRM-507 v2 "lot once", already suggested in memory; not required for the workflow (rows seeded with the lot either way) |
| FRM-801 loaded rows typed from memory | UI | Pick-list of released lots (`optionsFrom`-style, computed) |
| FRM-703 customer / date produced typed | UI | Prefill from FRM-704 / FRM-520 |
| Mixing, depositing, cooling, syrup, dip have no record | Process | Guidance only unless the owner wants records (decision 2); syrup lot is an existing D-14 item |
| Contractor licence expiry not scheduled | Schedule | covers-until row (section 10) |
| Material spec / supplier review dates not scheduled | Schedule | Per-entry links (section 10) |
| Hold with no disposition is invisible | Notification | (R) `hold_open` feed type |
| `releaseAssist` still lists `seal_checks.lot_code` (removed in FRM-606 v2); the field is optional so no error, but the mapping should be cleaned | Code | One-line fix in Phase 3 |
| Ops Batch Tracker / Measuring / Order Board unrelated to rum cake lots | Scope | Leave as the client-order flow; do not wire into the lot (decision 8) |
| Biscotti (other customer's product) is flow-wrapped: CCP 2 vacuum does not apply, label is the film roll | Process | Stage list must be per product (decision 9) |
| No submitted FRM-601 label approval exists | Record | A prerequisite that would block everything if hard today; warn first (decision 4) |
| Missing data relationships the brief lists that are **not** gaps here | | Equipment (FRM-004 register + FRM-903 equipment grid suffice; no equipment table needed), operators (signatures + created_by), approvals (signatures + submitted_by) |

---

## 15. Recommended data-model changes (the minimum)

1. **`public.production_lots`** (new, one migration):
   `id uuid pk`, `product text not null`, `lot_code text not null`, `bake_date date not null`,
   `frm520_response_id uuid unique references sop_document_responses(id)`,
   `created_by/created_at`, `closed_at`, `closed_by`, `closed_reason text`,
   unique index on `(lower(product), normalised lot_code)`.
   RLS: select `is_compliance_viewer`; insert/update `is_staff_or_admin`; no delete (close instead).
   Only human decisions are stored; every stage state is derived.
2. **`sop_document_responses.lot_id uuid null references production_lots(id)`** + index. Set by the workflow when it creates FRM-520/701/703/702 entries (`createResponse` gains `opts.lotId`). Backfill for existing entries by product + code, reviewed, as a data migration.
3. **`verification_schedule`**: new rows (section 10) and, as a recommendation, `escalate_to_position`.
4. **`internal_notifications.notification_type`** new value `hold_open` + `FEED_TYPES` entry (recommendation).
5. **Form revisions, under document control, if accepted:** FRM-702 v3 (product + our lot + role wording), FRM-507 v2 (lot once).
6. **Nothing else.** No workflow-instance table, no stage table, no task table, no equipment table, no changes to `production_orders` / `production_batches`, no change to the lot-code logic. `finished_goods_inventory`, `production_intake`, `order_station_logs` stay dormant; retiring them is a separate clean-up.

---

## 16. Recommended UI changes

| Change | Where | Builds on |
|---|---|---|
| **Today page** `/team/today` | new `src/pages/team/Today.tsx` | `findTodaysDrafts` pattern, `fetchOpenNotifications`, `loadReleaseRecords`-style loaders, `/forms/:docId/start` |
| Staff landing → Today | `TeamAuth.tsx` `LANDING_BY_ROLE`, `ProtectedRoute.tsx` fallback, nav Home section | |
| **Lot page** `/team/production/lots/:id` with stage rail + History tab | new `src/pages/team/production/LotPage.tsx`; pure half `src/lib/lotWorkflow.ts` (stage derivation, prerequisites, no imports, tested like `lotTrace.ts`) | `TRACE_FORMS`, `RELEASE_SOURCES`, `runTrace` |
| **Start a lot** dialog | `components/team/production/StartLotDialog.tsx` | `productOptions`, `julianLotCode`, `createResponse(doc, prefill, {lotId})`, `batchSheetFill` |
| Lot context in FormEntry | `FormEntry.tsx`: `?from=lot:<id>` back link (same shape as `from=notifications`), a one-line lot banner, pass `lot_id` on create | existing `from` handling |
| Day-level entry resolver | generalise `findTodaysDrafts` into `formResponses.ts` (`findEntryForDay(docId, dateField, date, extra?)`) and seed a lot row for FRM-507 | `applyVoiceFill`'s row-seeding |
| Exception panel | `components/team/forms/ExceptionPanel.tsx`, mounted by FormEntry when a `pass_fail` in a lot-scoped form reads fail or a hold option is chosen; prefilled FRM-702 / FRM-007 via `createResponse` | `PassFailInput`, voice `seal_fail` scroll |
| Released-lots pick-list on FRM-801 | `FormRenderer` `suggest` prop (as the release helper does) | `useReleaseAssist` pattern |
| Awaiting-release list for the SQF Practitioner | Today page card | `unreleasedLots` in `releaseAssist.ts` |
| EN/ES strings for Today and the lot page | `src/lib/workflowMessages.ts` | `voiceMessages.ts` pattern |
| Retire `OperationsHub` route | later clean-up | |

---

## 17. Implementation phases

Each phase ships alone, needs the owner's push for its migration (if any), and is tried on the tablet before the next starts. Estimates are working days of build, not calendar.

| Phase | Delivers | Migration | Size |
|---|---|---|---|
| **1. Today page + Start the day** | `/team/today` as staff landing: FRM-903 card with state, Receive / Record a collection buttons, lots in progress listed from FRM-520 drafts (derived, no lot table yet), admin Attention card, EN/ES | none | 2 to 3 |
| **2. Lot identity + Start a lot + lot page** | `production_lots`, `lot_id`, Start dialog with prerequisites, lot page rail with derived stages for Prepare / Pack / Release (the stages whose records are per-lot), History tab | 1 | 3 to 4 |
| **3. Carry-forward into every stage** | Bake and Seal stages resolve today's FRM-507/606 and seed the lot; FRM-703 and FRM-701 prefilled and linked; FormEntry lot context and back links; released-lots pick-list on FRM-801; `releaseAssist` mapping clean-up | none | 3 |
| **4. Exceptions** | Exception panel; prefilled FRM-702 / FRM-007; hold blocks Release; `hold_open` notification; (if approved) FRM-702 v3 | 1 to 2 | 2 to 3 |
| **5. Periodic additions** | Schedule rows (contractor expiry, spec reviews), per-entry links, optional escalation | 1 | 1 |
| **6. Refinements** | End-of-day cleaning-log prompts, lot close/cancel UI polish, auditor History access, retire OperationsHub, decide the ops Order Board's future | 0 to 1 | 1 to 2 |

Order rationale: Phase 1 is pure UI over existing records and removes the dead landing page on day one. Phase 2 is the only structural change and is small. Phase 3 is where "never type the lot twice" lands. Exceptions come after the happy path is in daily use, so the panel is designed against real deviations rather than imagined ones. The brief's "workflow foundation" phase does not exist as a separate piece of infrastructure because state is derived.

**Verification plan per phase.** Pure modules get a `scripts/test-*.mjs` (esbuild bundle, `check()` helper, as the thirteen existing ones). Pages cannot be signed into from the preview, so each phase ends with: migration dry-run through the Management API (`begin; … rollback;`), owner pushes, verify rows against the migration payload, then the owner tries it on the tablet with a real lot. Phase 2's acceptance test: start lot 6281 for Rum Cake - Original, see the rail, open Prepare, see the formula lines, save, see Prepare ✓. Phase 3's: an FRM-507 row seeded with 6281 via the lot page and another via the voice card both appear under Bake.

---

## 18. Risks and concerns

- **Derived state depends on field ids.** A renamed field silently empties a stage. Mitigation: `lotWorkflow.ts` declares its map and runs a mapping check like `checkTraceMapping`, shown on the page as "FRM-520 no longer has …". Any form revision touching a mapped id updates the map in the same PR.
- **Gates can become friction for one person doing everything.** Keep exactly one hard gate (FRM-903) unless the owner wants more; everything else warns with a button.
- **A rail that looks like a checklist invites ticking.** There is no tick without a record, and the rail says which record.
- **Day-level forms hold several lots.** FRM-507 rows for two products on one day live in one entry. The Bake stage shows only this lot's rows; the entry is still one record per day. FRM-606 v2 is one entry per product per day, so two products mean two entries, which the resolver must key on product too.
- **Untestable from the preview.** Everything is verified on the tablet by the owner; phases are small for that reason (memory: untestable changes ship opt-in). The Today landing can ship behind a one-line flag so the old landing is one revert away.
- **Document revisions take approval time.** None are needed before Phase 4.
- **Test data.** Earlier test lots were deleted by hand; the lot table should carry `closed_reason = 'test'` so practice runs can be hidden, and `_test_batch` rows stay skipped.
- **Owner capacity.** Six phases is a lot of review. Phases 1 to 3 are the proposal; 4 to 6 wait until the first real lots have gone through.
- **Biscotti.** If the stage list is not product-aware, the operator sees a Seal stage that does not apply. Decision 9 settles it before Phase 2.

---

## 19. Items requiring clarification or business-owner decisions

1. **Readiness gate.** Should "today's FRM-903 submitted" **block** starting or continuing production records for the day, or warn? If block: can an admin override with a reason? (Proposal: block, no override.)
2. **Unrecorded steps.** Mixing, depositing, cooling/depanning, syrup, dipping: guidance text only (proposal), or does the owner want records for any of them? A syrup record would also answer the D-14 stored-syrup lot gap.
3. **Retention sample.** Is an FRM-703 sample taken for every lot, so the stage is required before release, or only some lots?
4. **Label approval.** No FRM-601 approval is submitted yet. Warn at Start until the per-flavor reviews are filed, then block? Or never block?
5. **How a lot ends.** Closed automatically when every packed unit is on an FRM-801? Closed by hand? Can a lot be cancelled or scrapped, and who may do it?
6. **Hold notifications.** Raise a notification to the SQF Practitioner for an FRM-702 with no disposition, and after how many days?
7. **FRM-702 v3.** Add product + our lot code fields and fix the "QA / Quality Leader" wording (needs GJM approval)? Without it a finished-lot hold writes our code into the supplier-lot field.
8. **Ops Order Board, Batch Tracker, Measuring station.** Leave untouched as the client-order flow (proposal), or retire the unused Batch Tracker / Measuring / `production_intake` pages now?
9. **Products other than rum cake.** The biscotti is flow-wrapped (no CCP 2 record, label is the film roll). Should the stage list vary by product (proposal: yes, a per-product stage profile read from FRM-704 or a small setting), and are there other products?
10. **Live counts.** May I read production (read-only) to confirm the entry counts and the unused ops tables before Phase 1? The proposal's figures are from memory as of today.
11. **Where the proposal lives.** Copy this document into the repo as `WORKFLOW_ARCHITECTURE.md` beside `DOCUMENT_REGISTER.md` and `FORM_REPORTS.md` so it is versioned with the code? (Proposal: yes, on Phase 1's branch.)

---

## Next steps

The proposal was reviewed and accepted on 2026-10-07. No production code is written until the decisions above are answered. In order: file the proposal in the repo; get answers to decisions 1, 4, 5, 9 and 10 (the ones Phase 1 and 2 depend on); build Phase 1 on a branch; owner tries it on the tablet; then Phase 2.
