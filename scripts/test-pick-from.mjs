// Tests for src/lib/pickFrom.ts - a grid cell picked from another form's register that fills the
// cells beside it (FRM-501's Ingredient, from the Material Specification Register FRM-207).
//
//   node scripts/test-pick-from.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "pickfrom-"));
const file = join(out, "pickFrom.mjs");
execFileSync("npx", ["esbuild", "src/lib/pickFrom.ts", "--bundle", "--format=esm", `--outfile=${file}`],
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

// What FRM-501's Ingredient column is set to.
const SPEC = { field: "material_name", fill: { supplier: "manufacturer", allergens: "allergens_contains" }, hintField: "manufacturer" };

// FRM-207 entries as they are in the register, newest first.
const ROWS = [
  { material_name: "Vegetable Oil", manufacturer: "Great Value", allergens_contains: ["Soy"] },
  { material_name: "CREME CAKE BASE", manufacturer: "Pillsbury", allergens_contains: ["Milk", "Egg", "Wheat", "Soy"] },
  { material_name: "Granulated Sugar", manufacturer: "Great Value", allergens_contains: ["None of the major allergens"] },
  { material_name: "Rum", manufacturer: "Lugo's Craft Spirits, LLC" },
  { material_name: "vegetable oil", manufacturer: "An older entry", allergens_contains: ["Soy", "Wheat"] },
  { material_name: "  ", manufacturer: "Nameless" },
];
const options = T.pickOptionsFromRows(SPEC, ROWS);

check("one option per name, sorted", options.map(o => o.value), ["CREME CAKE BASE", "Granulated Sugar", "Rum", "Vegetable Oil"]);
check("the first entry given wins a repeated name", options.find(o => o.value === "Vegetable Oil").fills, { supplier: "Great Value", allergens: "Soy" });
check("a ticked list is joined", options.find(o => o.value === "CREME CAKE BASE").fills.allergens, "Milk, Egg, Wheat, Soy");
check("a source with nothing is an empty fill", options.find(o => o.value === "Rum").fills, { supplier: "Lugo's Craft Spirits, LLC", allergens: "" });
check("the hint is the manufacturer", options.find(o => o.value === "Rum").hint, "Lugo's Craft Spirits, LLC");
check("no fill map, no fills", T.pickOptionsFromRows({ field: "material_name" }, ROWS)[0], { value: "CREME CAKE BASE", fills: {}, hint: "" });

const oil = T.matchPick(options, " vegetable OIL ");
const cake = T.matchPick(options, "CREME CAKE BASE");
const rum = T.matchPick(options, "Rum");
check("match ignores case and outer spaces", oil?.value, "Vegetable Oil");
check("a partly typed name is not a match", T.matchPick(options, "Vegetable"), null);
check("an empty cell is not a match", T.matchPick(options, ""), null);

// First pick into an empty row fills both cells.
check("empty row is filled", T.pickFills(oil, null, { supplier: "", allergens: "" }), { supplier: "Great Value", allergens: "Soy" });
// A typed answer is kept.
check("a typed supplier is kept", T.pickFills(oil, null, { supplier: "Sysco", allergens: "" }), { allergens: "Soy" });
check("both typed: nothing written", T.pickFills(oil, null, { supplier: "Sysco", allergens: "Soy, Wheat" }), {});
// Changing the pick carries its fills along.
check("changing the pick replaces what the last pick wrote",
  T.pickFills(cake, oil, { supplier: "Great Value", allergens: "Soy" }), { supplier: "Pillsbury", allergens: "Milk, Egg, Wheat, Soy" });
check("but not a cell edited since",
  T.pickFills(cake, oil, { supplier: "Walmart", allergens: "Soy" }), { allergens: "Milk, Egg, Wheat, Soy" });
// A new pick with nothing for a cell clears only what the last pick put there.
check("the last pick's allergens are cleared when the new one has none",
  T.pickFills(rum, oil, { supplier: "Great Value", allergens: "Soy" }), { supplier: "Lugo's Craft Spirits, LLC", allergens: "" });
check("a typed allergen is not cleared", T.pickFills(rum, null, { supplier: "", allergens: "Soy" }), { supplier: "Lugo's Craft Spirits, LLC" });
// Nothing to do.
check("the same pick again writes nothing", T.pickFills(oil, oil, { supplier: "Great Value", allergens: "Soy" }), {});
check("an empty cell with nothing to offer is left alone", T.pickFills(rum, null, { supplier: "x", allergens: "" }), {});

// ---------- the type-ahead of a text field fed by another form (TextField.suggestFrom) ----------
{
  const sheets = [
    { product_name: "Rum Cake - Pumpkin Spice" }, { product_name: "Rum Cake - Original" },
    { product_name: "rum cake - original" }, { product_name: "  " }, {}, { product_name: "Iker Empanada" },
  ];
  check("distinct product names, sorted", T.suggestValuesFromRows("product_name", sheets), ["Iker Empanada", "Rum Cake - Original", "Rum Cake - Pumpkin Spice"]);
  check("no entries, no list", T.suggestValuesFromRows("product_name", []), []);

  // `match`: the versions of the formula sheets of the product chosen on the form (FRM-601).
  const versions = [
    { product_name: "Rum Cake - Original", formula_version: "v2" }, { product_name: "Rum Cake - Original", formula_version: "v1" },
    { product_name: "rum cake - original ", formula_version: "V1" }, { product_name: "Rum Cake - Pumpkin Spice", formula_version: "v1" },
    { product_name: "Rum Cake - Pumpkin Spice", formula_version: "" }, { product_name: "", formula_version: "v9" },
  ];
  const of = value => T.suggestValuesFromRows("formula_version", versions, { field: "product_name", value });
  check("the chosen product's versions only", of("Rum Cake - Original"), ["v1", "v2"]);
  check("compared without case or stray spaces", of(" rum cake - ORIGINAL"), ["v1", "v2"]);
  check("another product", of("Rum Cake - Pumpkin Spice"), ["v1"]);
  check("no product chosen, nothing offered", [of(""), of(undefined), of("  ")], [[], [], []]);
  check("a product with no formula sheet", of("Rum Cake - Coconut"), []);

  // `template`: what is offered is built from the entry (FRM-704's Formula reference).
  const ref = value => T.suggestValuesFromRows("formula_version", versions, { field: "product_name", value }, "FRM-501 {formula_version}");
  check("the form number with each version", ref("Rum Cake - Original"), ["FRM-501 v1", "FRM-501 v2"]);
  check("an entry with no version offers nothing, not a bare form number", ref("Rum Cake - Pumpkin Spice"), ["FRM-501 v1"]);
  check("several answers in one line", T.suggestValuesFromRows("formula_version", versions.slice(0, 1), undefined, "{product_name} ({formula_version})"), ["Rum Cake - Original (v2)"]);
  check("a key the entry does not have is left out", T.suggestValuesFromRows("formula_version", versions.slice(0, 1), undefined, "FRM-501 {formula_version} {nothing}"), ["FRM-501 v2"]);
}

// ---------- the same list read from the rows of a table (suggestFrom.grid): customers on FRM-011 ----------
{
  const CUST = { grid: "contacts", where: { column: "group", equals: "Customer (brand owner)" }, current: true, drafts: true };
  const row = (_label, group = "Customer (brand owner)") => ({ _label, group, name: "A person", phone: "1" });
  const list = (status, ...rows) => ({ status, data: { contacts: rows } });
  const names = entries => T.suggestValuesFromRows("_label", T.gridSuggestRows(CUST, entries));
  check("only the customer rows, by the row's own name", names([list("submitted", row("SQFI", "SQF"), row("Bahama Rum Cakes"), row("Cookies R Us"), row("Landlord", "Utility / landlord"))]), ["Bahama Rum Cakes", "Cookies R Us"]);
  check("the current list is the newest SUBMITTED one, even under a newer draft", names([list("draft", row("Draft Only Co")), list("submitted", row("Bahama Rum Cakes")), list("submitted", row("Old Customer"))]), ["Bahama Rum Cakes"]);
  check("until one is submitted, the newest draft", names([list("draft", row("Bahama Rum Cakes")), list("draft", row("Older Draft Co"))]), ["Bahama Rum Cakes"]);
  check("drafts not read unless the field says so", T.gridSuggestRows({ ...CUST, drafts: false }, [list("draft", row("Bahama Rum Cakes"))]), []);
  check("without `current`, every entry's rows", T.suggestValuesFromRows("_label", T.gridSuggestRows({ ...CUST, current: false }, [list("draft", row("B Co")), list("submitted", row("A Co"))])), ["A Co", "B Co"]);
  check("no list, a list with no table, a blank name", [names([]), names([{ status: "submitted", data: {} }]), names([list("submitted", row(""), row("  "))])], [[], [], []]);
}

// ---- from a printed reference table of the same form (FRM-902's verification schedule, 2026-10-16)
{
  const TABLE = { columns: ["Area / Surface", "Method", "Frequency", "Acceptable limit / standard"], rows: [
    ["Mixer food-contact surface", "ATP swab", "Weekly", "< 10 RLU / pass"],
    ["Allergen changeover surface", "Allergen swab", "At changeover", "Negative"],
    ["", "ATP swab", "Weekly", ""],
    ["mixer FOOD-contact surface", "duplicate", "", ""],
  ] };
  const opts = T.pickOptionsFromTable(TABLE, { method: "Method", accept_limit: "acceptable limit / STANDARD", nothing: "No such column" });
  check("one option per row, first cell, in table order, blanks and repeats skipped", opts.map(o => o.value), ["Mixer food-contact surface", "Allergen changeover surface"]);
  check("fills by header, case-insensitive; an unknown header fills nothing", opts[1].fills, { method: "Allergen swab", accept_limit: "Negative" });
  check("no table, no options", T.pickOptionsFromTable(undefined, {}), []);
  const picked = T.matchPick(opts, "mixer food-contact surface");
  check("a pick fills only empty cells", T.pickFills(picked, null, { method: "", accept_limit: "< 5 RLU" }), { method: "ATP swab" });
}

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} of ${cases} checks failed`); process.exit(1); }
console.log(`pick from: ${cases} checks passed`);
