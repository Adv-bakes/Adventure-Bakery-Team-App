# FSQM-020 — Product Release Program

**Not the controlled copy.** The controlled copy is the `FSQM-020` row in `sop_documents`;
this file is the readable version of it. **It is generated** from the same JSON the
migration writes, by `scripts/generate-fsqm-draft.py`, so the two cannot drift. Edit the
body through a migration and re-run the script; never edit this file directly.

| | |
|---|---|
| Number | `FSQM-020` |
| Type | `fsqm (Food Safety Quality Manual)` |
| Category | Food Safety Quality Manual |
| Status | draft — not approved, not in force |
| Revision | New |
| Effective | *(draft)* |
| SQF reference | `2.4.7.1, 2.4.7.2, 2.4.7.3  (2.4.7 is **Mandatory**)` |
| Record | **FRM-701** Finished Product Release Record |
| Failure path | **FSQM-018** Non-Conforming Product and Equipment — a batch that fails a release check is held, not released |
| Label approval | **SOP-2.3.2.3** Label Control — referenced, deliberately not repeated |
| Seeded by | `20260903000001` (program) · `20260903000002` (FRM-701) |

---

## Purpose

This program defines the responsibility and the method for releasing finished product at Adventure Bakery. It is the positive product release procedure required by SQF Quality Code 2.4.7.1, and it satisfies the Product Release element of the SQF Food Safety Code: Food Manufacturing (2.4.7), which is Mandatory.

## Scope

All finished product manufactured at Adventure Bakery, however it leaves the site: shipped from our dock, collected by the customer, or transferred into customer-owned or third-party storage.

It does not cover the receipt and acceptance of incoming raw materials and packaging, which are handled under SOP-2.3.2 Raw and Packaging Materials, nor the disposition of material placed on Hold, which is handled under FSQM-018 Non-Conforming Product and Equipment and recorded on FRM-702. A batch that fails a check in this program becomes non-conforming product and passes to FSQM-018.

## Definitions

Release: the decision by the SQF Practitioner that a batch of finished product meets its specification and all applicable customer, regulatory and company requirements, and may leave the site.

Released product: product for which that decision has been made and recorded on FRM-701. Product that has been made, packed and palletised is not released product until that record exists.

Positive release: withholding product from release until a required result has been received. Adventure Bakery does not operate positive release based on pathogen or chemical testing — see Part 5.

## Responsibility

SQF Practitioner — the only person who may release finished product. Carries out the release checks, records them on FRM-701 and signs the release. Confirms that a product's label complies with applicable food law before its first release and again at every label change.
Quality Team — assembles the batch and process records the release check reads, and places on Hold any batch that fails a check.
Production staff — complete the batch sheet and the process records for every batch, so that there is something to check.
Admin — does not make any batch available for collection without a completed FRM-701, and confirms that the lot handed to the carrier is the lot released.
Management team — is notified of any batch not released, and is responsible for the resources release requires.

## Procedure

**1. No finished product shall be made available for collection, or leave the site, until it has been released under this procedure.**

  Release is a decision, not a status that arrives by default. Product that has been made, packed and palletised is not released product until someone has checked it and said so on FRM-701.

**2. Release is authorised by the SQF Practitioner alone. No other role may release finished product.**

  SQF 2.4.7.1 requires release by authorised personnel. Here that is one person. Naming a second signature that does not exist would be a control in name only, and an auditor would test the separation of duties it implied.

**3. Product is released by batch or lot. Every release is recorded on FRM-701 Finished Product Release Record, one record per batch or lot.**

**4. Before releasing a batch the SQF Practitioner shall confirm each of the following and record the result of each on FRM-701:**

  - The batch sheet is complete and signed, and the formula, process steps and process controls were followed as specified.
  - The pre-operation and sanitation release for the line that produced the batch is recorded on FRM-903.
  - Neither the batch nor any ingredient in it is on Hold under FSQM-018, and no hold tag applies to it.
  - The label applied is the approved label for that product and that customer, verified against REP-602 Approved Label Register, and its allergen statement and any Gluten Free claim are correct for what was actually run.
  - The pack, the seal and the package integrity are correct for the specification.
  - The date and lot code are present, legible and correct.
  - A unit taken from the batch meets the product's appearance and sensory standard on examination.
  - The quantity and pack configuration match the customer's agreed specification.

**5. The site does not use positive release based on pathogen or chemical testing. No finished product is sent for laboratory testing before shipment, and none is held pending a result.**

  This is stated rather than left silent because SQF 2.4.7.3 applies only where such testing gates release, and a document that implies a testing gate it does not operate is worse than one that says plainly there is none.

  If finished-product testing is ever introduced — a gluten result for certified Gluten Free product being the likely first, since the site is GFCO certified — this procedure shall be revised before that product ships, so that the hold-pending-result step exists before it is needed rather than after.

**6. Before a product's first release, and again whenever its label changes, the SQF Practitioner shall confirm that the label complies with the food law of the country of manufacture and, where it is known, of the country of sale.**

  The label control system does this work: labels are approved under SOP-2.3.2.3 Label Control on FRM-601, the approved version is held on REP-602 and changes are tracked on REP-603. This program does not repeat it. The release check confirms that the label actually applied is the approved one; this Part confirms that the approved one is lawful.

**7. Where product is supplied in bulk or unlabeled, the information a customer needs for its safe use — identity, allergens, lot code, date of manufacture, and storage and handling requirements — shall be provided to the customer with the consignment.**

**8. The site does not use off-site or contract warehouses. Finished product is collected from the site by a carrier the customer arranges, and responsibility for the product passes to the customer on collection.**

  SQF 2.4.7.3 requires release requirements to be communicated to off-site or contract warehouses and verified as being followed, where such warehouses are used. They are not used here, so that requirement does not arise. This is stated rather than left silent, for the same reason Part 5 states that positive release on testing is not used: a reader should not have to work out for themselves which limbs of a clause apply to this site.

  What collection does change is the timing. Release has to be complete before the carrier arrives, not while it waits on the dock. Once product is loaded it has left, and a release recorded afterwards records nothing.

**9. If any check fails, the batch shall not be released. It shall be placed on Hold under FSQM-018 Non-Conforming Product and Equipment, recorded on FRM-702, and dispositioned there.**

  A batch that fails a release check is non-conforming product. The release record ends at "not released" and the hold record takes over. A CAPA is raised under FSQM-009 where its Part 3 requires one.

**10. Released product may then be made available for collection. FRM-701 shall be completed and signed before that happens, not afterwards.**

**11. Records are retained as set out in the Records section of this program.**

## Form References

FRM-701 Finished Product Release Record; FRM-702 Non-Conforming Material Hold & Tagging Record; FRM-903 Daily Sanitation, Pre-Operation & Release Record; FRM-601 Label Review & Approval Form; REP-602 Approved Label Register; batch sheets

## Records

FRM-701 Finished Product Release Record — one per batch or lot released, carrying every release check, the label verification, the release decision and the signature of the person who made it. This is the record of product release that SQF 2.4.7.1 and Quality Code 2.4.7.2 require.
FRM-702 Non-Conforming Material Hold & Tagging Record — where a batch fails a release check and is held instead of released.
FRM-903 Daily Sanitation, Pre-Operation & Release Record — the line release the batch was produced against.
REP-602 Approved Label Register — the approved label the applied label is verified against.
Batch sheets — the production record the release check reads.
Retention: two years, or the shelf life of the product plus twelve months, whichever is longer. This is the period set by FSQM-009 Part 10, so a release, a hold arising from it and any investigation that follows are retained on the same basis.

## Governing Reference

SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.4.7 Product Release (Mandatory); 2.4.7.1 responsibility and methods; 2.4.7.2 label compliance; 2.4.7.3 positive release and off-site storage.
SQF Quality Code, Edition 9 — 2.4.7.1 positive product release; 2.4.7.2 records of product release or disposition.
SOP-2.3.2.3 Label Control — the approval of labels, which this program verifies against rather than repeats.
FSQM-018 Non-Conforming Product and Equipment — where a batch that fails a release check is held and dispositioned.
FSQM-009 Corrective and Preventive Action (CAPA) Program — where a release failure meets one of its Part 3 triggers.

## Revision History

Rev New — written 2026-09-03 against SQF Food Safety Code: Food Manufacturing 2.4.7 Product Release, which is MANDATORY, and SQF Quality Code 2.4.7.1. DRAFT. Not approved, not in force.

WHY IT EXISTS. FSQM-018 named a "Positive Release Procedure" as the authority for the final disposition of reworked material, and no document of that name existed anywhere in the register — a Compass Blending reference that survived the scan. That citation was removed on 2026-09-02 when FSQM-018 gained a release step of its own, but the gap underneath it was real: the site had no documented method for releasing finished product at all, against an element the Food Manufacturing code marks Mandatory.

IT IS A PRODUCT RELEASE PROGRAM, NOT A POSITIVE RELEASE PROCEDURE, and the difference is deliberate. 2.4.7 has three limbs — release by authorised personnel after documented checks (2.4.7.1), confirmation that labels comply with food law (2.4.7.2), and positive release where testing gates it, plus off-site storage (2.4.7.3). A document written to the name FSQM-018 used would have closed the third limb and left the Mandatory element open.

WHAT THE SITE ACTUALLY DOES, confirmed 2026-09-03. Before a batch ships, the batch sheet is reviewed, the label is checked, and the packaging and the product itself are looked at. That already covers most of what Quality Code 2.4.7.1 lists. This program writes down what is already done and adds only what the clause requires on top — a named authority, a record, and the off-site storage rule. It does not invent a control nobody performs, because a control nobody performs is a finding waiting to be made.

NO POSITIVE RELEASE ON TESTING, AND THE DOCUMENT SAYS SO. No finished product is sent for laboratory testing before shipment and none is held pending a result. SQF 2.4.7.3 applies only where such testing gates release, so Part 5 states plainly that the practice is not used rather than leaving a reader to assume a gate exists. It also says what must happen before that changes: if finished-product testing is ever introduced — a gluten result for certified Gluten Free product being the likely first, since the site is GFCO certified — this procedure needs revising before that product ships, so the hold-pending-result step exists before it is needed rather than after.

OFF-SITE STORAGE DOES NOT APPLY — CORRECTED 2026-09-04. This program was drafted on 2026-09-03 on the understanding that product went both from our own dock and into customer-owned or third-party storage, and Part 8 accordingly required a written instruction to each storage location, reissued on change and confirmed annually. The CEO and Operations Manager confirmed on 2026-09-04 that this is not how it works: the customer arranges collection with their own carrier, and responsibility for the product passes to the customer once it leaves the facility. The site uses no off-site or contract warehouse. Part 8 now says so, in the same form Part 5 uses for positive release on testing, and the written instruction it required — which was recorded here as a prerequisite to issue — is withdrawn as an open item because there is nobody to issue it to.

WHAT THAT DOES NOT CHANGE, and it is worth saying because "no longer our responsibility" is easy to read more widely than it holds. Collection makes the timing of release SHARPER, not softer: the record has to be complete before the carrier arrives rather than before a transfer the site controls, because once product is loaded it has gone. And the passing of responsibility at the dock is a commercial fact about custody and risk, not a food-safety one — traceability, and any withdrawal or recall, still reach product after it has been collected. Neither is in this program's scope; both belong to the recall and withdrawal program, which does not yet exist.

LABEL COMPLIANCE IS REFERENCED, NOT REPEATED. Labels are approved under SOP-2.3.2.3 on FRM-601, the approved version is held on REP-602, and changes are tracked on REP-603. Restating that here would create a second copy to drift, which is how FSQM-018 and FSQM-019 came to name different authorities for rework. The release check confirms that the label applied is the approved one; Part 6 confirms that the approved one is lawful.

ONE PERSON RELEASES. 2.4.7.1 requires release by authorised personnel, and here that is the SQF Practitioner alone. Naming a second signature that does not exist would be a control in name only.

OPEN BEFORE ISSUE — two things the site must settle. Neither blocks issue; the one item that did was Part 8's written instruction, withdrawn on 2026-09-04 when the collection model was corrected:

1. There is no documented product sampling, inspection and analysis method (SQF 2.4.4.1), and no finished product specification in the register beyond SOP-2.3.1 New Product and Specification Process. The release check reads "the customer's agreed specification" and "the product's appearance and sensory standard". Confirm where those live, because this procedure points at them and an auditor will follow the pointer.

2. Part 7 requires safe-use information to travel with bulk or unlabeled product. Confirm whether the site ships any bulk or unlabeled product at all. If it does not, that Part should be removed at issue rather than describing something that never happens.
