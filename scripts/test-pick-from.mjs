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

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} of ${cases} checks failed`); process.exit(1); }
console.log(`pick from: ${cases} checks passed`);
