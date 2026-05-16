
# Align PSS extraction with Batch Sheet fields (domain-aware)

The PSS AI extracts only 4 fields today (`company`, `product`, `ingredients[name,%]`, `process_steps[string]`). The batch sheet needs much richer, production-aware data. This plan defines a single canonical schema shared by the AI extractor and the batch-sheet generator, encodes the production rules you just described, and keeps the recipe immutable.

## Domain rules to encode

1. **Weight-first**: the whole sheet starts from **weighed ingredients per batch**. Each ingredient row carries `weight + weight_unit` as the source of truth; `percentage` is **derived**.
2. **% = (ingredient weight ÷ total batch weight) × 100**, rounded to **2 decimals minimum**. The generator always recomputes %; if the PSS provided both, mismatches are recorded as warnings (PSS weight wins).
3. **Recipe sum check**: Σ(weights) = declared batch weight; Σ(%) = 100.00 ± 0.05. Mismatches surface as `recipe.warnings`.
4. **Recipe is immutable in the batch-sheet UI** — every other field on the batch sheet is editable by the AB team, **but ingredient names and weights are locked**. Changing the formula requires a new formula revision (separate flow, out of scope here). The generator stamps `recipe.locked = true` and the UI hides edit controls on that table only.
5. **Process is ordered and grouped**: each step references which ingredients enter at that step, mix time/speed, and station. Union of `ingredients_added` across steps must equal the recipe's ingredient list (warn on missing/extra).
6. **Process taxonomy** the batch sheet must accommodate:
   - Method: `no-bake` | `melt (jacketed kettle)` | `loose-batter (batter depositor / Unifiller-style)` | `dough-extruder + wire-cut` | `round former` | `press with die` | `manual`
   - Each forming method carries **target raw deposit weight** and expected **bake-off weight loss %** → **target baked weight**
   - Pre-bake **dough temperature**, **bake time**, **bake temperature** (with unit)
   - Optional **post-bake freeze** before packaging
7. **Packaging station** (separate from process): method/machine, **lot-code printing on retail unit + shipper case**, then **palletizing** (cases/pallet, pallet pattern).
8. **Blanks are kept, not dropped**: every section above appears on the batch sheet even if the PSS is silent — empty fields render as TBD and add to `services_to_offer`.
9. **Confidential formula auto-create**: if no `formulas` rows exist for this lead/concept, the generator inserts one row per recipe ingredient into `formulas`. That table already has staff-only RLS — never exposed to the brand portal. Stored `formula_id` is referenced from `data_json.source`.

## Canonical `batch_sheets.data_json` shape

```text
{
  header: {
    company_name, customer_name, product_name, product_code,
    version_number, revision_number,
    prepared_by, approved_by, date_of_issue
  },
  product: {
    target_unit_weight_raw, target_unit_weight_baked, weight_unit,
    expected_bake_loss_pct,
    unit_dimensions { l, w, h, unit },
    shape, appearance, intended_use, target_shelf_life
  },
  recipe: {
    locked: true,                       // ← UI hides edit controls
    total_batch_weight, weight_unit,
    ingredients: [
      { name, weight, weight_unit, percentage, category, notes }
        // percentage = round((weight / total_batch_weight) * 100, 2)
    ],
    warnings: string[]
  },
  process: {
    method,                             // taxonomy above
    pre_bake: {
      steps: [
        { order, station, action, ingredients_added: string[],
          mix_time_min, mix_speed, temperature, temp_unit, notes }
      ],
      dough_temp_target, dough_temp_unit
    },
    forming: { machine, target_deposit_weight_raw, weight_unit, die_or_wire, notes },
    bake: { time_minutes, temperature, temp_unit, expected_loss_pct },
    post_bake: { freeze_required, freeze_temp, freeze_time, notes },
    coverage_check: { all_recipe_ingredients_used, missing: string[], extra: string[] }
  },
  packaging: {
    primary: { vessel, units_per_pack, net_weight_per_pack, weight_unit, machine, lot_code_printed },
    secondary: { type, units_per_case, machine, lot_code_printed },
    palletizing: { cases_per_pallet, pattern, notes }
  },
  optional_sections: { nutritional_panel, allergens, shelf_life },
  services_to_offer: string[],
  source: { pss_document_id, prf_id, concept_id, formula_id, generated_at, ai_provider, ai_model }
}
```

## Changes

### A. AI extraction (`review-client-document`)
Expand the PSS prompt to return the full shape above (everything nullable). Key instructions to the model:
- For every ingredient, return **both `weight` and `percentage`** when present; never invent one from the other (the generator computes that).
- Capture `total_batch_weight` if stated.
- Tag every process step with `station`, `ingredients_added[]`, `mix_time_min`, `mix_speed`, `temperature`.
- Classify `process.method` from the taxonomy; null if unclear.
- Capture bake temp/time, dough temp target, post-bake freeze if mentioned.
- Capture packaging machine, lot-code-print mentions, cases/pallet.

### B. Generator (`generate-batch-sheet-from-pss`) becomes a merger + calculator
Field-merge precedence: **PSS → PRF → existing concept → null**. Then normalize:

1. **Recipe normalization (weight-first)**: if `total_batch_weight` known, recompute every `percentage = round((weight/total)*100, 2)`; if total missing but all weights present, set total = Σ weights. Where PSS supplied a percentage that differs from computed, push to `recipe.warnings`. Set `recipe.locked = true`.
2. **Process coverage check**: diff `recipe.ingredients[].name` against `pre_bake.steps[].ingredients_added` → `process.coverage_check`.
3. **Forming defaults**: if `expected_bake_loss_pct` and `target_unit_weight_raw` known, compute `target_unit_weight_baked = raw * (1 - loss/100)`.
4. **Services list**: every null required-ish field (packaging, bake specs, palletizing, nutritionals, allergens, shelf life) → `services_to_offer`.
5. **Confidential formula auto-create**: if no `formulas` rows exist for this `concept_id` (create a draft concept linked to the lead if needed), insert one row per recipe ingredient. Stamp `formula_id`/`concept_id` into `data_json.source` and `batch_sheets.concept_id`.
6. Continue to upsert on `pss_document_id` (overwrite on redraft).

### C. Review-panel UX (`DocumentReviewPanel`)
Add a "Will populate batch sheet" preview under PSS reviews:
- Recipe: `12 ingredients · Σ = 99.97% ⚠ · locked` (warning chip when not 100 ± 0.05)
- Process: `method: dough-extruder · 6 steps · coverage ✓`
- Packaging: `TBD → offered as service`
- Confidentiality note: "A confidential staff-only formula will be created on approval. The recipe will be locked on the batch sheet."

### D. Batch-sheet UI lock (forward-looking marker only)
The batch sheet doesn't have an edit UI yet, but we set `recipe.locked = true` and document the rule so whoever builds that editor next reads weights as read-only. **Out of scope this loop**: actually building the editor.

## Out of scope
- Editable batch-sheet UI (just stamping `locked` for now)
- Process-tab ↔ batch_sheet two-way sync
- Real digital PSS form
- Formula-revision workflow

## Files touched
- `supabase/functions/review-client-document/index.ts` — expanded extraction prompt.
- `supabase/functions/generate-batch-sheet-from-pss/index.ts` — merger + % calculator + coverage check + confidential formula auto-create + `recipe.locked`.
- `src/components/sales/DocumentReviewPanel.tsx` — "Will populate" preview + lock/confidentiality note.
