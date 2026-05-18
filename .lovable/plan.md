## Goal

Three changes to the project workspace (`/team/sales/clients/:leadId/projects/:prfId`) and Client Folder:

1. Clicking the **PSS** chip should open an in-app **preview/editor**, not download the raw file.
2. Staff can **upload a batch sheet directly** (no PSS required first).
3. **Two-way sync** between PSS and batch sheet: when one is incomplete, missing fields are filled in from the other.

---

## 1. PSS opens an editable preview

Today: `openSigned(pss)` calls `storage.createSignedUrl` on `product-spec-sheets` and opens it in a new tab — for `.xlsx` this just downloads.

Change to: open a **side drawer (PssPreviewDrawer)** that shows the structured PSS in the same field layout as the wizard, with inline edit.

Data source priority (already half-implemented in `generate-batch-sheet-from-pss`):
- If a `pss_submissions` row exists for this lead/project → use its `data_json` directly.
- Else, parse the uploaded file (`product-spec-sheets/<path>`) via a new edge function `parse-uploaded-pss` (uses `npm:xlsx` like `parse-batch-sheet`) that returns the same `PssData` shape the wizard uses. Cache the parsed result into a new `pss_parsed_cache` column or — simpler — upsert a `pss_submissions` row with `status='staff_uploaded'` so subsequent opens are instant and edits persist there.

Drawer UI:
- Reuse the existing field components from `src/components/pss/PssWizard.tsx` (Header, Product, Recipe, Process, Packaging sections) in a single-page (non-wizard) read/edit view.
- "Save" writes back to `pss_submissions.data_json`.
- Original uploaded file is still available via a small "Download original" link in the drawer header.

Also update the Client Folder (`src/pages/ClientDetail.tsx`) — the PSS row in Documents should open the same drawer instead of just showing the filename.

## 2. Upload a batch sheet directly

In `SalesProjectWorkspace.tsx`, add a third item to the **Upload Form** dropdown: "Upload Batch Sheet" (`.xlsx`). It:
- Uploads to the `batch-sheets` storage bucket.
- Calls existing `parse-batch-sheet` edge function to produce the structured `data_json`.
- Inserts/updates a `batch_sheets` row (version = next available, `source = 'staff_upload'`, `pss_document_id` nullable).
- Refreshes the workspace so "Open Batch Sheet" appears.

No PSS prerequisite — the existing gating on the Generate button stays, but the upload path bypasses it entirely.

## 3. Two-way sync between PSS and batch sheet

After either side is created/edited, run a **reconcile** step that fills missing fields on the other side. Shared field map:

```text
PSS data_json.recipe.ingredients  <->  batch_sheet data_json.recipe.ingredients
PSS data_json.header.product_name <->  batch_sheet data_json.header.product_name
PSS data_json.product.target_unit_weight / weight_unit <-> batch_sheet header weight
PSS data_json.packaging.* <-> batch_sheet data_json.packaging.*
(process steps stay proprietary — batch sheet only, never written back to PSS)
```

Implementation: a single edge function `reconcile-pss-batch` that:
- Loads latest `pss_submissions` row + latest active `batch_sheets` row for the lead/project.
- For each field in the map, if one side is empty and the other has a value, copy it over.
- Records a `reconciliation_log` entry (new lightweight table) noting what was filled and which side it came from, so staff can audit.
- Returns a summary used by the UI to show a toast like "Filled 3 ingredient rows on PSS from batch sheet".

Trigger points:
- After PSS preview drawer "Save".
- After batch sheet upload parse completes.
- After `generate-batch-sheet-from-pss` runs (already exists; just add a final call to reconcile).
- A manual **"Sync now"** button in both the PSS drawer header and the Batch Sheet editor header.

## Technical details

**New / changed files**
- `src/components/pss/PssPreviewDrawer.tsx` (new) — drawer + structured editor, reuses PssWizard section components.
- `src/pages/sales/SalesProjectWorkspace.tsx` — replace `openSigned(pss)` with drawer open; add "Upload Batch Sheet" menu item; add "Sync now" button.
- `src/pages/ClientDetail.tsx` — replace PSS row click with drawer open.
- `supabase/functions/parse-uploaded-pss/index.ts` (new) — Excel/PDF parser → PssData JSON, upserts `pss_submissions`.
- `supabase/functions/reconcile-pss-batch/index.ts` (new) — two-way field copy.
- `supabase/functions/generate-batch-sheet-from-pss/index.ts` — call reconcile at end.

**Migration**
- Add `source text default 'pss_generated'` to `batch_sheets` (values: `pss_generated`, `staff_upload`).
- Add `staff_uploaded_file_path text` to `pss_submissions` so staff-uploaded structured rows can still link back to the original file.
- Create `pss_batch_reconciliation_log` (lead_id, prf_id, pss_id, batch_sheet_id, field_path, from_side, to_side, value_json, created_at) with staff-only RLS via `is_staff_or_admin`.

**Out of scope**
- Editing the proprietary process steps from the PSS side (process remains internal-only).
- PDF-only PSS uploads beyond best-effort text extraction (Excel is the primary format).

## Open questions

1. For uploaded PSS files that are **PDF** (not .xlsx), best-effort parsing only — should we instead require staff to manually fill the structured form after upload? (Default: yes, drawer opens with empty fields prefilled from PRF; staff edits and saves.)
2. When reconcile finds a **conflict** (both sides have a value but different), should we (a) leave both alone and surface a warning, or (b) prefer batch sheet (most recent staff edit)? (Default: a — never overwrite, only fill blanks.)
