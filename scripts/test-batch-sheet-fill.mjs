// Tests for src/lib/batchSheetFill.ts - starting a production lot record (FRM-520) from the
// product's formula: an FRM-501 entry, or a sales-side batch sheet. The rules that matter: the
// expected quantities are the formula's, the lot and the weighed quantities are never filled, a
// quantity is never guessed out of text, and a formula that cannot give a quantity says so.
//
//   node scripts/test-batch-sheet-fill.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
  source: "FRM-501", productField: "product", grid: "ingredients", sourceField: "formula_source",
  columns: { ingredient: "ingredient", brand: "brand", expected: "expected_qty", unit: "unit" },
};
const COLS = ["ingredient", "brand", "supplier_lot", "expected_qty", "unit", "actual_qty", "actual_qty_2", "actual_qty_3", "notes"];
const PREP_SHEET = [17.49, 13.49, 3, 7.99, 49.97, 0.25, 0.31];

// ---------- quantities written as text ----------
check("lb", T.parseQty("17.49 lb"), { qty: 17.49, unit: "lb" });
check("no space, plural, capitals", T.parseQty("50LBS"), { qty: 50, unit: "lb" });
check("trailing dot", T.parseQty("3 lb."), { qty: 3, unit: "lb" });
check("fl oz", T.parseQty("8 fl oz"), { qty: 8, unit: "fl oz" });
check("thousands comma", T.parseQty("1,200 g"), { qty: 1200, unit: "g" });
check("bare number has no unit", T.parseQty("92.5"), { qty: 92.5, unit: "" });
check("a number is accepted as a number", T.parseQty(40), { qty: 40, unit: "" });
check("unknown unit is not guessed", T.parseQty("3 scoops"), null);
check("a range is not guessed", T.parseQty("3-4 lb"), null);
check("two quantities are not guessed", T.parseQty("3 lb 4 oz"), null);
check("zero is no quantity", T.parseQty("0 lb"), null);
check("blank", T.parseQty(""), null);

// ---------- the FRM-501 entry exactly as the migration wrote it ----------
const sql = readFileSync("supabase/migrations/20261006000004_frm501_rum_cake_original_entry.sql", "utf8");
const payload = JSON.parse(sql.match(/\$rc\$([\s\S]*?)\$rc\$/)[1]);
const entry = (data, status = "draft") => ({ id: "e1", status, created_at: "2026-10-06T12:00:00Z", data });
{
  const src = T.formulaEntrySource(entry(payload));
  check("product", src.product, "Rum Cake - Original");
  check("label names the form, the version and that it is a draft", src.label, "FRM-501 v1 (draft)");
  check("batch", src.batch, "92.50 lb batch");
  check("nine lines", src.lines.length, 9);
  check("expected per batch is the prep sheet's", src.lines.slice(0, 7).map(l => l.expected), PREP_SHEET);
  check("all lb", src.lines.slice(0, 7).every(l => l.unit === "lb"), true);
  check("supplier becomes brand", [src.lines[0].brand, src.lines[3].brand], ["Sysco Classic", ""]);
  check("flavor and pan spray keep their lines, no quantity",
    src.lines.slice(7).map(l => [l.ingredient, l.expected, l.unit]),
    [["Flavor", "", ""], ["Pan release spray (contains soy)", "", ""]]);

  const current = { product: "", lot_code: "6279", bake_date: "2026-10-06", ingredients: [{ ingredient: "old", supplier_lot: "L-1" }], recorded_by: null };
  const { values, lines, warnings } = T.batchSheetFill(CFG, COLS, current, src);
  check("lines", lines, 9);
  check("product filled", values.product, "Rum Cake - Original");
  check("source recorded", values.formula_source, "FRM-501 v1 (draft)");
  check("other fields untouched", [values.lot_code, values.bake_date, values.recorded_by], ["6279", "2026-10-06", null]);
  check("grid replaced, not merged", values.ingredients.length, 9);
  check("every row carries every column", values.ingredients.every(r => COLS.every(c => c in r)), true);
  check("the lot is never filled", values.ingredients.every(r => r.supplier_lot === ""), true);
  check("weighed quantities are never filled",
    values.ingredients.every(r => r.actual_qty === "" && r.actual_qty_2 === "" && r.actual_qty_3 === ""), true);
  check("first row", values.ingredients[0],
    { ingredient: "Soybean Oil (35 lb jug)", brand: "Sysco Classic", supplier_lot: "", expected_qty: 17.49, unit: "lb",
      actual_qty: "", actual_qty_2: "", actual_qty_3: "", notes: "" });
  check("the formula's own notes do not become lot notes", values.ingredients[3].notes, "");
  check("says which lines have no quantity", warnings,
    ["No expected quantity on the formula for: Flavor, Pan release spray (contains soy)."]);
  check("the input is not mutated", current.ingredients.length, 1);
}

// ---------- FRM-501: where the quantity comes from ----------
const grid = rows => ({ product_name: "P", formula_version: "v2", scaled_production_batch_size: "200 lb", prototype_formulation_grid: rows });
{
  const src = T.formulaEntrySource(entry(grid([
    { ingredient: "Written", production_qty: "12 kg", pct_of_formula: 50 },
    { ingredient: "From percent", production_qty: "", pct_of_formula: "25" },
    { ingredient: "Unreadable falls back to percent", production_qty: "about half a bag", pct_of_formula: 10 },
    { ingredient: "Bare number takes the batch unit", production_qty: "40", pct_of_formula: "" },
    { ingredient: "Nothing", production_qty: "", pct_of_formula: "" },
    { ingredient: "   ", production_qty: "5 lb" },
    {},
  ]), "submitted"));
  check("blank and unnamed rows dropped", src.lines.length, 5);
  check("quantities", src.lines.map(l => [l.expected, l.unit]), [[12, "kg"], [50, "lb"], [20, "lb"], [40, "lb"], ["", ""]]);
  check("a submitted entry is named plainly", src.label, "FRM-501 v2");
}
{
  // No batch size: written quantities still come across, percentages cannot.
  const src = T.formulaEntrySource(entry({ product_name: "P", prototype_formulation_grid: [
    { ingredient: "A", production_qty: "5 lb" }, { ingredient: "B", pct_of_formula: 30 }, { ingredient: "C", production_qty: "7" },
  ] }));
  check("no batch size", src.lines.map(l => [l.expected, l.unit]), [[5, "lb"], ["", ""], [7, ""]]);
  check("no version in the label", src.label, "FRM-501 (draft)");
  const { warnings } = T.batchSheetFill(CFG, COLS, {}, src);
  check("warns about the missing quantity and the missing unit", warnings,
    ["No expected quantity on the formula for: B.", "No unit on the formula for: C."]);
}
{
  // The empty draft somebody opened and left.
  const src = T.formulaEntrySource(entry({ product_name: "", prototype_formulation_grid: [{}] }));
  check("empty entry: no product, no lines", [src.product, src.lines.length], ["", 0]);
  const current = { ingredients: [{ ingredient: "kept" }] };
  const { values, lines, warnings } = T.batchSheetFill(CFG, COLS, current, src);
  check("nothing filled", [lines, values.ingredients], [0, [{ ingredient: "kept" }]]);
  check("two warnings", warnings.length, 2);
}
check("null data does not throw", T.formulaEntrySource(entry(null)).lines, []);
{
  const src = T.formulaEntrySource(entry(grid([{ ingredient: "A" }, { ingredient: "B" }])));
  const { warnings } = T.batchSheetFill(CFG, COLS, {}, { ...src, lines: src.lines.map(l => ({ ...l, expected: "", unit: "" })) });
  check("no quantities at all", warnings.length === 1 && warnings[0].includes("gives no quantities"), true);
}

// ---------- the mapping check ----------
{
  const col = id => ({ id });
  const schema = { sections: [{ fields: [{ id: "product_name" }, { id: "formula_version" }, { id: "scaled_production_batch_size" }] },
    { fields: [{ id: "prototype_formulation_grid", columns: ["ingredient", "supplier", "pct_of_formula", "production_qty"].map(col) }] }] };
  check("mapping holds", T.checkFormulaMapping(schema), []);
  schema.sections[1].fields[0].columns.pop();
  schema.sections[0].fields.pop();
  check("renamed fields are named", T.checkFormulaMapping(schema), ["scaled_production_batch_size", "prototype_formulation_grid.production_qty"]);
  check("no schema", T.checkFormulaMapping(null).length, 4);
}

// ---------- the sales-side batch sheet (kept for later) ----------
const rumCake = (product = {}, status = "draft", version = 1) => ({
  id: "s1", version, status,
  data_json: {
    header: { product_name: "Rum Cake - Original", company_name: "Bahama Rum Cakes" },
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
      { name: "  ", percentage: 5 },
    ] },
  },
});
{
  const src = T.batchSheetSource(rumCake());
  check("batch sheet: same quantities as the formula sheet", src.lines.slice(0, 7).map(l => l.expected), PREP_SHEET);
  check("batch sheet: label, batch, client", [src.label, src.batch, src.client], ["Batch sheet v1 (draft)", "92.5 lb batch", "Bahama Rum Cakes"]);
  check("batch sheet: unnamed row dropped", src.lines.length, 8);
  check("approved label", T.batchSheetSource(rumCake({}, "approved", 3)).label, "Batch sheet v3");
  const none = T.batchSheetSource(rumCake({ batch_size: null }));
  check("no batch size: lines without quantities", [none.batch, none.lines.every(l => l.expected === "")], ["", true]);
}
check("zero batch size is none", T.batchSizeOf(rumCake({ batch_size: 0 })), null);
check("text batch size is read", T.batchSizeOf(rumCake({ batch_size: "40", batch_size_unit: "kg" })), { qty: 40, unit: "kg" });
check("unknown unit falls back to lb", T.batchSizeOf(rumCake({ batch_size_unit: "stone" })), { qty: 92.5, unit: "lb" });

// ---------- a form that maps fewer columns ----------
{
  const cfg = { productField: "product", grid: "ingredients", columns: { ingredient: "ingredient" } };
  const { values } = T.batchSheetFill(cfg, ["ingredient", "supplier_lot"], {}, T.batchSheetSource(rumCake()));
  check("only the ingredient column is written", values.ingredients[0], { ingredient: "Soybean Oil (35 lb jug)", supplier_lot: "" });
  check("no source field, none written", "formula_source" in values, false);
}

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} of ${cases} checks failed`); process.exit(1); }
console.log(`batch sheet fill: ${cases} checks passed`);
