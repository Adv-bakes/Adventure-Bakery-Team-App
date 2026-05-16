## Batch Sheet — staff workspace + Excel export

Right now `generate-batch-sheet-from-pss` writes a `batch_sheets` row on every PSS submit, but staff have no way to **see, edit, or export** it. This plan builds that — and only that. Costing/sourcing automation stays out of scope (downstream Replit engine).

### 1. Database (one small migration)

Extend `batch_sheets.data_json.recipe.ingredients[]` to carry the columns the Replit costing engine reads:

```
{ name, weight_g, percentage, case_weight, case_weight_uom,
  vendor_1, vendor_2, vendor_3, vendor_notes }
```

Add columns on `batch_sheets` for workflow:
- `version` int default 1
- `superseded_at` timestamptz null
- `superseded_by_version` int null
- `last_edited_by` uuid null
- `xlsx_path` text null  (Storage path of the last exported file)

Add a private Storage bucket **`batch-sheets`** (staff-only) with RLS: only `is_staff_or_admin()` can SELECT/INSERT/UPDATE/DELETE. Confirms the "never visible to client" rule.

No client-facing RLS on `batch_sheets` — current staff/admin-only policy stays.

### 2. Generator updates (`generate-batch-sheet-from-pss`)

When building `recipe.ingredients`:
- Leave `case_weight` **null** (staff fills manually — formula deferred per your note).
- For each ingredient name, look up the **most recent prior batch sheet for this `client_user_id`** (or, if none, the most recent across all clients with the same normalized ingredient name) and copy `vendor_1/2/3` forward. Mark `vendor_source: "prior_sheet"` so the UI can show a subtle hint.
- Never overwrite vendors that already exist on the current sheet (re-runs are non-destructive for staff-entered vendor data).

### 3. In-app Batch Sheet workspace (staff only)

Route: `/team/operations/batch-sheets` (list) and `/team/operations/batch-sheets/:id` (editor).

**List view** — table of `batch_sheets`: product name, client, status (draft / in_review / approved / superseded), version, updated_at, link to edit, link to Excel export.

**Editor view** — single page, three sections:

1. **Header + product** — read-only summary card (company, product, version, source PSS link, finished form from PRF).
2. **Recipe grid** — editable table mirroring the Replit columns:
   ```
   A #  | B Ingredient | C %Formula | D Weight(g) | E Case Weight | F UoM
   G Vendor 1 | H Notes | I Vendor 2 | J Notes | K Vendor 3 | L Notes
   ```
   - %Formula and Weight(g) are **locked** (come from PSS, change only via new PSS version).
   - Case Weight, UoM, and the 3 vendor columns are **editable**; cells flagged as "pre-filled from prior sheet" show a tiny "prior" chip until staff confirms or overwrites.
   - Add-row / delete-row only for ingredients staff want to add that aren't in the recipe (e.g. processing aids).
3. **Process & packaging** — collapsed read-only panels showing the proprietary `processes` rows and packaging spec, with a "Open proprietary process editor" link (separate screen — future).

Save behavior: autosave to `batch_sheets.data_json` on blur with optimistic UI; bumps `last_edited_by`. Status toggle: `draft → in_review → approved`. Approving freezes the row and creates a new version row on next PSS edit (mirrors formula versioning).

### 4. Excel export

One new edge function: `export-batch-sheet-xlsx`.
- Input: `batch_sheet_id`.
- Auth: staff/admin only.
- Generates an `.xlsx` matching Replit's column map (B/C/E/G/I/K) using a Deno-compatible xlsx lib (`xlsx` from `https://esm.sh/xlsx`). Header rows match the existing Replit template so the downstream parser keeps working without changes.
- Uploads to `batch-sheets/{batch_sheet_id}/v{version}-{timestamp}.xlsx`, stores `xlsx_path`, returns a signed URL.
- Editor's "Download Excel" button calls it and triggers a browser download.

### 5. Notifications + audit

- Existing `internal_notifications` insert ("batch_sheet_drafted") stays.
- Add "batch_sheet_approved" notification on approval.
- Append `client_activity` rows: `batch_sheet_edited`, `batch_sheet_approved`, `batch_sheet_exported` (keyed by `client_id` for the staff audit log — clients still never see this data).

### 6. Out of scope

- Proprietary process editor UI (separate future task — table exists, just no UI).
- Vendor master / quote DB / shipping-threshold logic (downstream Replit engine).
- Client visibility — explicitly **none**, confirmed.
- Auto-computing Case Weight (deferred until you've defined the formula; cell stays manual).

### Files

- New migration: `batch_sheets` columns + `batch-sheets` storage bucket + RLS.
- Edit: `supabase/functions/generate-batch-sheet-from-pss/index.ts` (vendor carry-forward, case_weight nulling).
- New edge function: `supabase/functions/export-batch-sheet-xlsx/index.ts`.
- New pages: `src/pages/team/operations/BatchSheets.tsx`, `BatchSheetEditor.tsx`.
- Sidebar entry under Operations Hub.
