# Document Numbering Convention & Register

The runbook for numbering controlled documents (SOPs, forms, manuals, policies) in the Adventure
Bakery quality system. The live register lives at **`/team/compliance/register`**.

## Why we changed

The prior scheme (`FRM-046-1`) baked two unrelated things into one string: an arbitrary sequence
number (`046`, whose logic nobody could recall) and a revision (`-1`). Baking the revision into the
ID means the identifier *changes when only the content changes*, which breaks traceability. The new
convention fixes both.

## The rule

```
<TYPE>-<NNN>
```

- **TYPE** — the document-type prefix. Also drives `detectType()` on Word import.
  | Prefix | Type | Meaning |
  |--------|------|---------|
  | `SOP`  | sop  | Standard Operating Procedure |
  | `FRM`  | form | Form / log / record template |
  | `FSQM` | fsqm | Food Safety Quality Manual |
  | `POL`  | policy | Policy statement |
- **NNN** — a 3-digit number whose **hundreds block = the process stage** (see table). Increment
  within a block (301, 302, 303 …).
- The identifier is **stable for the life of the document**. The **revision lives in the `revision`
  field**, never in the ID. `FRM-301` stays `FRM-301` at rev 1, 2, 3 …
- A form and its parent SOP **share the stage block** (e.g. `SOP-301` receiving procedure ↔
  `FRM-301` receiving log), so the register self-organizes.
- SQF clause numbers are **not** part of the form/manual ID (SQF renumbers between code editions).
  Cross-refer to SQF via the separate `sqf_reference` field — it renders as live clause chips.

### Exception: SOPs are numbered by SQF clause (on purpose)

Standard Operating Procedures use a **second, deliberate scheme**: the number is the SQF clause the
procedure implements — `SOP-2.3.1` (New Product & Specification), `SOP-11.7.3` (Glass & Brittle
Plastic), etc. This is kept intentionally so an auditor can jump from a clause straight to the SOP
that satisfies it. The trade-off (clause numbers shift between SQF editions) is accepted for SOPs.

The flip side of that trade-off: a wrong number points the auditor at a clause that doesn't exist.
Glass & Brittle Plastic was `SOP-11.7.5` until 2026-07-15, but glass sits at **11.7.3** in Edition 9
(11.7.4 is Detection of Foreign Objects; there is no 11.7.5) — renumbered to `SOP-11.7.3` in
migration `20260715000001…`, prior id preserved in `legacy_sop_number`. When adding or renumbering a
clause-scheme SOP, verify the clause actually exists in `src/lib/sqfFoodClauses.ts` /
`src/lib/sqfClauses.ts` first, and keep it consistent with the row's own `sqf_reference`.
Tooling recognizes this scheme: `parseClauseNumber()` in `docNumber.ts` validates it (no format
warning), and the Document Register lists these SOPs under **"SOPs (numbered by SQF clause)"** rather
than by process stage. **Forms, manuals (FSQM), and policies use the stage-block scheme above.**

## Stage blocks

Ordered by a product/material's physical path through the facility (low number = early in the flow).

| Block | Stage | Typical documents |
|-------|-------|-------------------|
| 000–099 | Food Safety System | HACCP plan, recall, complaints, internal audit, mgmt review, doc control, CAPA |
| 100–199 | Sales / New Product Development | PRF, PSS, NDA, product briefs |
| 200–299 | Sourcing & Supplier Approval | Approved supplier list, supplier questionnaire, CoA review |
| 300–399 | Receiving & Incoming Inspection | Incoming material receiving & inspection log, receiving rejection |
| 400–499 | Storage & Inventory | Warehouse, tolling inventory count, FIFO, allergen segregation |
| 500–599 | Production & Batching | Batch weigh-up, in-process checks, metal detection |
| 600–699 | Packaging & Labeling | Label verification, packaging inspection |
| 700–799 | QC / Testing / Hold & Release | Finished-goods hold, positive release, lab testing |
| 800–899 | Shipping / Distribution / Traceability | Load-out check, mock recall, trace exercise |
| 900–949 | Sanitation & GMP | Sanitation verification, pest control, maintenance |
| 950–999 | HR / Training / Admin / Records | Training sign-off, competency, document retention |

The canonical map is code, not prose: **`src/lib/docNumber.ts` → `DOC_STAGES`**. Change it there and
the UI badges, validation, and register all follow.

## Assigning the next number

1. Decide the stage from what the document *does in the process* (not who owns it).
2. Take the next free number in that block (the register groups by stage, so gaps are visible).
3. Enter it as `TYPE-NNN` in the SOP # / SOP-Form Number field. The input shows the derived stage
   and warns if the format strays (e.g. a stray `-N` revision suffix).
4. Put the revision in the **Revision** field — never in the number.

## Legacy numbers & the crosswalk

When a pre-convention document is renumbered, its old ID is saved to
`sop_documents.legacy_sop_number` (migration `20260708000001_sop_documents_legacy_number.sql`) so it
stays findable. Renumbering of existing live rows is done as a reviewed data migration:

1. Read live `sop_documents` (`id, sop_number, title, category, sqf_reference`).
2. Propose an old→new crosswalk, assigning each a stage block.
3. Review with the quality owner.
4. Apply id-keyed `UPDATE`s: `legacy_sop_number = <old>`, `sop_number = <new canonical>`,
   `revision = <extracted -N>`.

Until a document is renumbered it appears under **"Unassigned"** in the register — that group is the
worklist of stragglers.
