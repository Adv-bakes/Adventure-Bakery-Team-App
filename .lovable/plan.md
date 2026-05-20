## Scope (this revision)

Four fixes on the batch sheet editor (+ matching `%` fix on the PSS drawer).

### 1. Auto-compute Formula `%` from grams (broken on load)

`src/pages/team/operations/BatchSheetEditor.tsx`
- Run existing `recomputePercents()` inside `load()` before `setIngs`. Rows arrive from the DB with grams but blank `%`, and the helper only fires on edit today.
- Same after "Sync with PSS" reload.

`src/components/sales/PssPreviewDrawer.tsx`
- Add `recomputePssPercents(ings)` helper: `pct = grams / sum(grams) × 100`, 2 decimals, against the `weight` field.
- Call on extracted-data load, on add/remove ingredient, and inside `updateIngredient` whenever `weight` changes.
- `%` stays editable as a manual override; any weight change re-syncs it.

### 2. Process steps: add `Speed` column + drag-to-reorder

Columns: `⋮⋮ | # | Station | Action | Time | Temp | Speed | Notes | ✕`

- **Speed** — free-text input bound to `step.speed` (e.g. "low", "med", "60 rpm"). Stored in `process.steps[i].speed`. JSONB already open-shape — no edge-function change.
- **Drag handle** — leftmost cell `⋮⋮` (`GripVertical`). Native HTML5 DnD on `<tr>` (`draggable`, `onDragStart`, `onDragOver`, `onDrop`). On drop, splice from old index to new index, renumber. Dragged row gets `opacity-50`; drop target gets top-border highlight. Disabled when `isSuperseded`.

### 3. Save behavior — in-place while drafting, versioned after finalize

This is the key change to the save model.

Current behavior: every save calls `revise-batch-sheet`, which always supersedes the current row and inserts v+1. That's wrong while staff is still filling out the sheet for the first time — it creates v2, v3, v4 just from typing.

New rule, keyed off `batch_sheets.status`:

| Current status | Save action | Endpoint |
|---|---|---|
| `draft` (or null) | **In-place update** — overwrite `data_json`, no version bump | direct `supabase.from('batch_sheets').update(...)` |
| `final` / `approved` / any non-draft | **Versioned revise** — supersede + insert v+1 | existing `revise-batch-sheet` edge function |

UI implications:
- While `status === 'draft'`: Save button reads **"Save"**. Toast: "Saved" (no version number).
- Once finalized: Save button reads **"Save as new version"** (current label). Same toast as today.
- Add an explicit **"Finalize"** action button (only visible when `status === 'draft'` and not superseded) that sets `status = 'final'` and triggers reconcile. After finalize, the editor flips into versioned-save mode automatically.

`reconcile-pss-batch` still runs after both save paths (already wired inside `revise-batch-sheet`; mirror the call after the in-place draft update).

### 4. Save visibility

- Sticky header bar (`sticky top-0 z-10`) so Save stays on screen while scrolling.
- "Unsaved changes" pill next to the button when `dirty === true`.
- No autosave.

### Files touched

- `src/pages/team/operations/BatchSheetEditor.tsx` — recompute on load, Speed column, drag-reorder, dual-mode save (in-place vs versioned), Finalize button, sticky toolbar.
- `src/components/sales/PssPreviewDrawer.tsx` — auto-`%` helper.

### Out of scope

- No edge-function changes (`process.steps[].speed` is open JSONB; in-place save uses the standard table client). `revise-batch-sheet` stays as-is for the post-finalize path.
- No DB migration; uses existing `status` column.
- No autosave; no changes to xlsx exporter, packaging, vendor cells.
