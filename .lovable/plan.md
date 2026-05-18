## Goal

From the client folder, one click on an uploaded or wizard-submitted PSS creates a Batch Sheet v1. Any later change to that PSS — or any staff edit of the batch sheet itself — produces a new version with a timestamp. All versions are kept and viewable.

## Where this lives

Everything is inside the **client folder** (`/team/sales/clients/:id`) — the existing Documents tab and the per-project view that opens from there. No separate "PRF workspace" concept; that was my mistake.

- **Documents tab** (`SalesClientFolder.tsx` → Documents & NDA) lists every PSS on the client, regardless of source:
  - uploaded by sales (PDF / XLSX in `client_documents`)
  - wizard-submitted by the prospect (`pss_submissions`)
- Each PSS row gets a primary action:
  - **"Create batch sheet"** when none exists for that PSS
  - **"Open batch sheet v{n}"** when one already exists
- The same action also appears on the per-project view (`SalesProjectWorkspace.tsx`) for the PSS attached to that project.

## PSS sources (all supported)

1. **Sales-uploaded PDF / XLSX** — the common case today. Parsed via the existing `parse-batch-sheet` pipeline, extended to accept PSS-shaped files. AI extraction (Lovable AI Gateway) fills the recipe / process / packaging fields from PDF text or XLSX cells.
2. **Wizard-submitted PSS** — already structured JSON, uses the current `generate-batch-sheet-from-pss` path.

Both paths land in the same `batch_sheets` row shape so the editor and export work identically.

## Versioning rules

`batch_sheets` already has `version`, `superseded_by_version`, `superseded_at`, `updated_at`, `last_edited_by` — we'll use them properly.

A **new version** is created automatically whenever:

1. **Staff saves an edit** in the batch sheet editor — today it silently overwrites; change it to insert a new row with `version = prev + 1` and mark the previous row superseded.
2. **The source PSS is modified** — when a wizard PSS is re-submitted or a sales-uploaded PSS is replaced, regenerate the batch sheet as v{n+1}, carrying forward staff-entered vendor data and notes. The previous version is preserved and marked superseded.
3. **Staff clicks "Regenerate from PSS"** in the editor — same behavior as #2, manual trigger.

Every version stores `updated_at` (the change date) and `last_edited_by` (who did it, or `system` for PSS-triggered regenerations).

## Editor changes

In `BatchSheetEditor.tsx`:

- Save now calls a new edge function `revise-batch-sheet` that atomically inserts the new version + supersedes the old one (instead of `update()`).
- Header shows `v{n} · last changed {date} by {name}`.
- Add a **Version history** dropdown listing all versions for this PSS with date, author, and source (`pss_regenerated`, `staff_edit`, `initial`). Selecting an older version opens it read-only with a "Restore as v{n+1}" button.

## Client folder timeline

Each new version writes a `client_activity` entry (`batch_sheet_created`, `batch_sheet_revised`, or `batch_sheet_regenerated_from_pss`) so the client folder shows the full history.

## Technical notes

- New edge function `revise-batch-sheet` — handles staff-edit revisions (atomic supersede + insert).
- Extend `generate-batch-sheet-from-pss`:
  - Accept either a `pss_submission_id` (wizard) or a `client_document_id` (uploaded file).
  - For uploaded PDFs/XLSX, route through an extraction step (reuse `parse-batch-sheet` logic + Lovable AI for PDF text).
  - If an active batch sheet already exists for that source, create a new version instead of upserting.
- No schema migration needed — all columns exist. We may add a `source_change` text column to `batch_sheets` to label why each version was created (`initial | staff_edit | pss_change`), which is a tiny additive migration.

## Out of scope

- Operations Hub pipeline wiring.
- Costing-engine changes beyond what the XLSX export already does.
