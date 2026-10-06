// Tests for src/lib/batchSheetFill.ts - starting a production lot record (FRM-520) from the
// product's batch sheet. The rules that matter: the expected quantities are the sheet's, the lot
// and the weighed quantities are never filled, and a sheet that cannot give a quantity says so.
//
//   node scripts/test-batch-sheet-fill.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "batchsheetfill-"));
const file = join(out, "batchSheetFill.mjs");
execFileSync("npx", ["esbuild", "src/lib/batchSheetFill.ts", "--bundle", "--format=esm", `--outfile=${file}`],
  { stdio: ["ignore", "ignore", "inherit"], shell: true });
const T = await import("file://" + file.replace(/\\/g, "/"));

let failures = 0, cases = 0;
function check(name, actual, expected) {
  cases++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) return;
  failures++;
  console.error(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`);
}

const CFG = {
  productField: "product", grid: "ingredients", sourceField: "formula_source",
  columns: { ingredient: "ingredient", brand: "brand", expected: "expected_qty", unit: "unit" },
};
const COLS = ["ingredient", "brand", "supplier_lot", "expected_qty", "unit", "actual_qty", "actual_qty_2", "actual_qty_3", "notes"];

// The rum cake sheet as stored: percentages over a 92.50 lb batch.
const rumCake = (product = {}) => ({
  id: "s1", version: 1, status: "draft",
  data_json: {
    header: { product_name: "Rum Cake - Original" },
    product: { batch_size: 92.5, batch_size_unit: "lb", ...product },
    recipe: { ingredients: [
      { name: "Soybean Oil (35 lb jug)", percentage: 18.91, vendor_1: "Sysco Classic" },
      { name: "Liquid Eggs (30 lb jug)", percentage: 14.58, vendor_1: "Sysco" },
      { name: "Butter emulsion - Flayco (gallon)", percentage: 3.24, vendor_1: "Flayco" },
      { name: "Water", percentage: 8.64, vendor_1: null, non_purchased: true },
      { name: "Pillsbury Creme Cake Mix (50 lb bag)", percentage: 54.02, vendor_1: "Pillsbury" },
      { name: "Baking powder", percentage: 0.27, vendor_1: "Clabber Girl" },
      { name: "Egg Shade", percentage: 0.34, vendor_1: "Flayco" },
      { name: "Flavor", percentage: null, vendor_1: "Flayco" },
      { name: "Pan release spray (contains soy)", percentage: null, vendor_1: "Vegalene" },
      { name: "  ", percentage: 5 },
    ] },
  },
});

// --- expected quantities are the prep sheet's ---
{
  const lines = T.expectedLines(rumCake());
  check("unnamed rows are dropped", lines.length, 9);
  check("expected per batch matches the prep sheet",
    lines.slice(0, 7).map(l => l.expected), [17.49, 13.49, 3, 7.99, 49.97, 0.25, 0.31]);
  check("unit is the batch size unit", lines[0].unit, "lb");
  check("water keeps its line (it is weighed)", lines[3].ingredient, "Water");
  check("no percentage -> blank quantity and unit", [lines[7].expected, lines[7].unit, lines[8].expected], ["", "", ""]);
  check("brand comes from the primary vendor", [lines[0].brand, lines[3].brand], ["Sysco Classic", ""]);
}

// --- the fill ---
{
  const current = { product: "", lot_code: "6279", bake_date: "2026-10-06", ingredients: [{ ingredient: "old", supplier_lot: "L-1" }], recorded_by: null };
  const { values, lines, warnings } = T.batchSheetFill(CFG, COLS, current, rumCake());
  check("lines", lines, 9);
  check("product", values.product, "Rum Cake - Original");
  check("source records the version, and that it is a draft", values.formula_source, "Batch sheet v1 (draft)");
  check("other fields untouched", [values.lot_code, values.bake_date, values.recorded_by], ["6279", "2026-10-06", null]);
  check("grid replaced, not merged", values.ingredients.length, 9);
  check("every row carries every column", values.ingredients.every(r => COLS.every(c => c in r)), true);
  check("the lot is never filled", values.ingredients.every(r => r.supplier_lot === ""), true);
  check("weighed quantities are never filled",
    values.ingredients.every(r => r.actual_qty === "" && r.actual_qty_2 === "" && r.actual_qty_3 === ""), true);
  check("first row", values.ingredients[0],
    { ingredient: "Soybean Oil (35 lb jug)", brand: "Sysco Classic", supplier_lot: "", expected_qty: 17.49, unit: "lb",
      actual_qty: "", actual_qty_2: "", actual_qty_3: "", notes: "" });
  check("says which lines have no quantity", warnings,
    ["No expected quantity on the batch sheet for: Flavor, Pan release spray (contains soy)."]);
  check("the input is not mutated", current.ingredients.length, 1);
}

// --- an approved sheet is named plainly ---
check("approved label", T.batchSheetLabel({ ...rumCake(), status: "approved", version: 3 }), "Batch sheet v3");
check("final label", T.batchSheetLabel({ ...rumCake(), status: "final", version: 2 }), "Batch sheet v2");

// --- no batch size: lines come across, quantities blank, and it says so ---
{
  const sheet = rumCake({ batch_size: null });
  check("batchSizeOf null", T.batchSizeOf(sheet), null);
  const { values, warnings } = T.batchSheetFill(CFG, COLS, {}, sheet);
  check("lines still filled", values.ingredients.length, 9);
  check("quantities blank", values.ingredients.every(r => r.expected_qty === "" && r.unit === ""), true);
  check("warns", warnings.length === 1 && warnings[0].includes("no standard batch size"), true);
}
check("zero batch size is none", T.batchSizeOf(rumCake({ batch_size: 0 })), null);
check("text batch size is read", T.batchSizeOf(rumCake({ batch_size: "40", batch_size_unit: "kg" })), { qty: 40, unit: "kg" });
check("unknown unit falls back to lb", T.batchSizeOf(rumCake({ batch_size_unit: "stone" })), { qty: 92.5, unit: "lb" });

// --- an empty sheet leaves the table alone ---
{
  const sheet = { id: "s2", version: 1, status: "draft", data_json: { header: {}, recipe: { ingredients: [] } } };
  const current = { ingredients: [{ ingredient: "kept" }] };
  const { values, lines, warnings } = T.batchSheetFill(CFG, COLS, current, sheet);
  check("no lines", lines, 0);
  check("table kept", values.ingredients, [{ ingredient: "kept" }]);
  check("two warnings", warnings.length, 2);
}

// --- a form that maps fewer columns ---
{
  const cfg = { productField: "product", grid: "ingredients", columns: { ingredient: "ingredient" } };
  const { values } = T.batchSheetFill(cfg, ["ingredient", "supplier_lot"], {}, rumCake());
  check("only the ingredient column is written", values.ingredients[0], { ingredient: "Soybean Oil (35 lb jug)", supplier_lot: "" });
  check("no source field, none written", "formula_source" in values, false);
}

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} of ${cases} checks failed`); process.exit(1); }
console.log(`batch sheet fill: ${cases} checks passed`);
