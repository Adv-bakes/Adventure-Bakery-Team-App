# Derived Form Reports

The runbook for **derived reports** — presenting a "log/register" FRM form as a live report built from
another form's already-collected entries. The surface is the **Report** tab in the SOPs Library form
drawer (`/team/compliance/sops` → open a `type='form'` doc → **Report**).

## Why we built it

Several FRM forms are **logs/registers** — e.g. **FRM-003 Customer Complaint Log**, whose rows are not
hand-entered. Each row is a projection of a completed **source** report (FRM-003's rows each come from a
submitted **FRM-002 Customer Complaint Report**). Historically the log was transcribed by hand off the
individual reports.

A derived report has **no entries of its own** — it *reprojects a different form's* `sop_document_responses`.
That makes it deliberately distinct from **`Records.tsx`** (`/team/compliance/records`), which flattens a
form's *own* entries. Records was left untouched; this is a separate, small engine.

## The concept

A log form carries a **`report_schema`** on `sop_documents.content` (merged alongside `form_schema` /
`attachments`, never clobbering them). The schema names a **source form**, a set of **columns** (each derived
from source fields by a declarative rule), and **parameters** (the run-time filters). At view time the engine
fetches the source form's responses and projects each one into the columns — **all client-side** (log-sized
datasets; no new SQL/RPC). It reuses `fetchResponses()` and `formatFieldValue()` from the forms stack.

## Data model — `content.report_schema`

```jsonc
{
  "version": 1,
  "sourceSopNumber": "FRM-002",       // portable across envs; resolved to a doc id at run time
  "sourceStatus": "submitted",         // "submitted" (default) | "all" (incl. drafts)
  "defaultDateField": "date_received", // source field the date-range param filters on
  "columns": [
    { "id": "product_lot", "header": "Product / Lot",
      "source": { "kind": "template", "template": "{product_name} / {lot_batch_code}" } },
    { "id": "class", "header": "Class. (C / NC)",
      "source": { "kind": "map", "field": "classification",
        "map": { "Critical (food safety risk)": "C", "Non-Critical (quality concern)": "NC" }, "fallback": "" } },
    { "id": "status", "header": "Status",
      "source": { "kind": "cases",
        "cases": [ { "field": "closure_date", "op": "notEmpty", "then": "Closed" },
                   { "field": "investigation_findings", "op": "notEmpty", "then": "Under Investigation" } ],
        "default": "Open" } }
  ],
  "params": [
    { "id": "date", "label": "Date received", "type": "date-range", "field": "date_received" },
    { "id": "customer", "label": "Customer", "type": "text", "field": "customer_name", "op": "contains" },
    { "id": "status", "label": "Status", "type": "select", "column": "status" }
  ],
  "filters": [                                    // fixed, always-applied — define the register's universe
    { "field": "supplier_status", "op": "in",
      "values": [ "APPROVED …", "CONDITIONALLY APPROVED …" ] }
  ],
  "legend": [ "C / NC — Critical (food safety risk) or Non-Critical (quality concern)." ]
}
```

### Column source kinds

The `source.kind` set is **declarative and safe** — no arbitrary JS/SQL ever comes off the schema.

| Kind | Renders | Config |
|------|---------|--------|
| `field` | one source field, formatted like it is on the source form | `field` |
| `template` | text with `{field_id}` tokens substituted | `template` |
| `map` | a value → label lookup (e.g. Critical → C) | `field`, `map{}`, optional `fallback` |
| `cases` | first matching rule wins (`notEmpty` / `empty` / `equals`), else `default` | `cases[]`, `default` |
| `const` | a fixed literal (or blank — for a column with no source field yet) | `value` |

### Fixed conditions (`filters[]`)

Optional **always-applied** conditions that define which source entries the register includes — *not*
user-adjustable (that's what `params` are for). They AND together; an `in` filter ORs its values. This is
how, e.g., an **Approved Supplier Register** only ever lists suppliers whose `supplier_status` is Approved
or Conditionally Approved. Ops: `in` (`values[]`), `equals` / `notEquals` (`value`), `notEmpty`, `empty`.
Applied in `loadReportBase` (so `select`-param dropdowns only see eligible rows) and rendered in the
`buildReportSql` `WHERE` marked `-- fixed`.

### Parameter types

| Type | Behavior | Config |
|------|----------|--------|
| `date-range` | From/To on a source **date** field (defaults to `defaultDateField`) | `field` |
| `text` | case-insensitive `contains` or `equals` on a source field | `field`, `op` |
| `select` | dropdown of the distinct values a **column** produces across all rows | `column` (a column `id`) |

Parameters apply **live** (client-side) — there is no separate Run button.

## Where the code lives (canonical, not prose)

| File | Role |
|------|------|
| **`src/lib/formReport.ts`** | Engine + types. `getReportSchema`/`hasReportSchema`; `resolveReportColumns` (compiles kinds → renderable cells); `loadReportBase` (fetch source responses, respect `sourceStatus`) + pure `filterReportRows` (apply params); `runReport` (convenience); `distinctColumnValues`; `buildReportSql` (the read-only SQL equivalent). |
| `src/components/team/forms/FormReportTab.tsx` | Viewer: live params, table, CSV/PDF, **View SQL**, admin "Edit report". |
| `src/components/team/forms/ReportSchemaBuilder.tsx` | Admin authoring: source picker, per-column kind editors, params, legend, live Preview. Saves via `updateModuleContent` (**merge**). |
| `src/lib/formPdf.ts` | `generateDerivedReportPdf` — landscape register PDF (log-doc header, table, legend, footer). |
| `src/pages/team/compliance/SopsLibrary.tsx` | Wires the **Report** tab + list "Report" pill. |

## Authoring a report

1. Open the log form → **Report** tab → (admin) **Define report** / **Edit report**.
2. Pick the **source form** (dropdown of fillable `type='form'` docs; the current form is excluded). This
   stores `sourceSopNumber`, resolved to a doc id at run time — portable across dev/prod.
3. Set **Include** (`submitted` vs `all`) and the **default date field**.
4. Add **columns**: header + a source kind. Field pickers are populated from the *source form's* fields.
5. Add **parameters** (date range / text / dropdown-by-column) and optional **legend** lines.
6. **Preview** runs the projection against live data (read-only). **Save Report** merges into
   `content.report_schema`.

## The "View SQL" panel

**View SQL** in the viewer renders the **read-only SQL equivalent** of the current definition *plus the live
parameters* (`buildReportSql`). Each column kind maps to an expression over `data->>'field'`
(`field`→accessor, `template`→`||` concat, `map`/`cases`→`CASE`, `const`→literal); params become `WHERE`
clauses. It is **illustrative only** — the app still projects client-side — but it is valid SQL an auditor can
copy and run against `sop_document_responses`.

## Behavior & gotchas

- **Field ids must match the source form exactly.** A column's `field` is the join key into the source
  response `data`. Renaming a source field id (never do this after entries exist) breaks the column.
- **Column ids ≠ field ids.** Column ids live in their own namespace and are what `select` params reference
  (`param.column`). Renaming a column header re-slugs its id and cascades into any param that points at it.
- **`sourceStatus`.** Default `submitted` (finalized only). A complaint-style register often wants `all` so
  every *received* complaint appears, with the Status column conveying progress — that is a per-form call.
- **Client-side & unbounded fetch.** `loadReportBase` fetches the source responses with **no `created_at`
  bound**, because the date param filters a *data* field (e.g. `date_received`) that can differ from
  `created_at`. Fine for log-sized data; revisit with an RPC if a source form ever grows huge.
- **PDF column clamp.** `generateDerivedReportPdf` clamps to 10 columns (`MAX_REPORT_COLUMNS`) and points
  wider reports at the CSV — same rule as `generateFormReportPdf`.
- **Tab visibility.** The Report tab shows for `type='form'` docs when `isAdmin || hasReportSchema`. A
  report-only log (no `form_schema`) defaults to the Report tab.
- **Grids are not offered as column sources** (a multi-row value has no single-cell projection).

## Worked example — FRM-003 ← FRM-002

The seeded Customer Complaint Log maps as:

| FRM-003 column | Kind | Source |
|----------------|------|--------|
| Ref No. | field | `complaint_ref_no` |
| Date Received | field | `date_received` |
| Customer | field | `customer_name` |
| Product / Lot | template | `{product_name} / {lot_batch_code}` |
| Complaint Summary | field | `complaint_description_text` |
| Class. (C / NC) | map | `classification` → C / NC |
| Root Cause | field | `root_cause_sqf_2_5_3_1` |
| CAPA Ref | const | *blank* — FRM-002 has no CAPA/CAR-number field yet |
| Status | cases | `closure_date` → Closed; else `investigation_findings` → Under Investigation; else Open |
| Date Closed | field | `closure_date` |

**Known gap:** to fill **CAPA Ref**, add a `capa_ref` field to FRM-002 and switch that column from `const`
to `field`. This is the general pattern for any log column the source form doesn't yet capture.
