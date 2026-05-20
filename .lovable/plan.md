## What's wrong

1. **Secondary "Primaries / secondary" and "Units / secondary" feel redundant.** When `units_per_primary` is known, units/secondary = primaries × units/primary, so two editable fields just confuse the operator. Same redundancy exists in the Shipper tier (Secondaries / case vs Units / case).
2. **Formula grid clips % and grams cells.** The table has 10 columns (#, Ingredient, %, g, Preblend, Vendor 1, 2, 3, Notes, ✕) in a card that only has ~1100px of usable width. Numeric inputs collapse to ~60px wide and the unit gets cut off.
3. **Processing specifications still renders as one giant textarea.** The "Method / procedure (free text — paste here)" textarea dominates the block; the mix-step table is below it and visually secondary. PSS uses only a numbered step list — batch sheet should mirror that.
4. **Packaging from PSS does not carry over to existing batch sheets.** First-time generation reads `exPack.primary/secondary/shipper`, but `reconcile-pss-batch` (the "Sync with PSS" button) has an outdated `FIELD_MAP` that only knows about a handful of legacy keys. New PSS fields (vessel_type, primaries_per_secondary, units_per_secondary, all shipper fields, bake internal temp) are never copied to a batch sheet that was created before those fields existed.

## Plan

### A. Packaging — remove redundant fields (PSS + batch sheet)

Both `PssPreviewDrawer.tsx` and `BatchSheetEditor.tsx`:

- **Secondary tier** keeps a single editable count: `Primaries / secondary`. Drop the `Units / secondary` input and show it as a read-only computed label underneath: `= {primaries} × {units_per_primary} units`. Keep writing the computed number to `packaging.secondary.units_per_secondary` on save so the Sourcing Bot and reconcile field map still see it.
- **Shipper tier** keeps `Secondaries / case` editable. Drop `Units / case` input; show as computed label `= {secondaries} × {units_per_secondary} units`. Persist computed value to `packaging.shipper.units_per_case`.
- Keep `Cases / pallet` editable on the shipper tier.

### B. Formula grid — readable numbers, no clipping (`BatchSheetEditor.tsx`)

- Restructure the table:
  - Default columns: `# | Ingredient | % Formula | Grams / unit | Preblend | Vendor | Notes | ✕`.
  - Collapse Vendor 1/2/3 into a single `Vendor` cell that opens a small popover (or inline "+ alt vendor" link) for vendors 2 and 3. The most common case is one vendor — three columns wasted horizontal space.
- Set explicit minimum widths so numerics don't clip:
  - `%` column: `min-w-[88px]`, right-aligned, `tabular-nums`, input padded so the value never overlaps the spinner.
  - `Grams / unit` column: `min-w-[100px]`, right-aligned, `tabular-nums`. Show unit suffix (`g`) inside the cell as a static badge, not inside the input.
- Wrap the table in `overflow-x-auto` with `min-w-[960px]` on the inner table so it scrolls horizontally on narrow viewports instead of squeezing.
- Slightly larger font on numeric cells (`text-sm` instead of `text-xs`) and tighter horizontal padding on text cells to free up space.

### C. Processing specifications — step list only (`BatchSheetEditor.tsx`)

- **Remove** the "Method / procedure (free text — paste here)" textarea entirely. The block now opens directly with the numbered step table, matching PSS Section 9.
- Keep `process.method_text` in the JSON for back-compat (don't blank it on save — leave whatever's there untouched), but no UI exposes it.
- Step table columns mirror PSS exactly: `# | Station | Action / Description | Time (min) | Temp | Notes | ✕`. Drop the kettle/mixer/melt/speed columns from the default view — those were over-specific and made each row 11 columns wide. If a row needs that detail it goes in `Notes`.
- "+ Add step" stays at the top right of the section. Numbering auto-renumbers.
- Bake block (temp / time / internal temp target / unit) stays below the step table unchanged.

### D. Sync packaging from PSS into existing batch sheets (`reconcile-pss-batch/index.ts`)

Expand `FIELD_MAP` so the "Sync with PSS" button actually copies the new fields:

```
packaging.primary.vessel_type
packaging.primary.vessel
packaging.primary.units_per_pack
packaging.primary.net_weight_per_pack
packaging.primary.weight_unit
packaging.secondary.type
packaging.secondary.primaries_per_secondary
packaging.secondary.units_per_secondary
packaging.shipper.case_type
packaging.shipper.secondaries_per_case
packaging.shipper.units_per_case
packaging.shipper.cases_per_pallet
bake.internal_temp_target
bake.internal_temp_unit
```

Reconcile rule stays the same: only fills blanks, never overwrites a value the team has typed. This is what makes the user's current batch sheet (generated before these PSS fields existed) finally show the packaging they entered after clicking "Sync with PSS".

### E. Out of scope

- No DB migration. All changes live in component JSX and the existing JSONB shapes.
- No change to xlsx exporter or Sourcing Bot — they keep reading `units_per_secondary` / `units_per_case` (still written, just computed).
- Process-step "seed once" rule from the prior pass stays as-is.

### Files touched

- `src/pages/team/operations/BatchSheetEditor.tsx` — formula grid widths, vendor collapse, remove method textarea, simplify step table, computed secondary/shipper units.
- `src/components/sales/PssPreviewDrawer.tsx` — same secondary/shipper computed-units treatment for consistency.
- `supabase/functions/reconcile-pss-batch/index.ts` — expand `FIELD_MAP`.
