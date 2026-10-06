// Tests for applyLabelScanToFields (src/lib/formSchema.ts) - a pack scanned in several shots.
// A round bottle cannot be read in one photo, so each scan adds to the last. The rules: an empty
// field is filled, an answer a person gave is never replaced, and a fuller later reading may
// replace only what an earlier scan itself wrote.
//
//   node scripts/test-label-scan-merge.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "labelscan-"));
const file = join(out, "formSchema.mjs");
execFileSync("npx", ["esbuild", "src/lib/formSchema.ts", "--bundle", "--format=esm", `--outfile=${file}`],
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

// A cut-down FRM-207: identity, declarations pinned, a confirmation the scan must withdraw.
const FIELDS = [
  { id: "material_name", type: "text", label: "Material name", scanFact: "product_name" },
  { id: "brand", type: "text", label: "Brand", scanFact: "brand" },
  { id: "item_code", type: "text", label: "Item code", scanFact: "item_code" },
  { id: "ingredients", type: "textarea", label: "Ingredient statement", scanFact: "ingredients" },
  { id: "contains", type: "text", label: "Contains statement", scanFact: "contains_statement" },
  { id: "allergens", type: "select", multiple: true, label: "Allergens", scanFact: "allergens", options: ["Milk", "Egg", "Soy", "Wheat"] },
  { id: "confirmed", type: "checkbox", label: "Checked word for word", clearOnScanOf: ["ingredients", "contains"] },
];
const empty = { material_name: "", brand: "", item_code: "", ingredients: "", contains: "", allergens: [], confirmed: false };

// Drive it the way SectionLabelScan does: keep what the scans wrote.
function shoot(values, scanned, facts, extras) {
  const r = T.applyLabelScanToFields(FIELDS, values, { facts, extras }, scanned);
  for (const id of Object.keys(r.next)) if (JSON.stringify(r.next[id]) !== JSON.stringify(values[id])) scanned[id] = r.next[id];
  return r;
}

// ---------- shot 1: the front of the bottle ----------
const scanned = {};
const s1 = shoot(empty, scanned, { product_name: "Pumpkin Spice Emulsion", brand: "LorAnn" });
check("shot 1 fills what it read", s1.filled, ["Material name", "Brand"]);
check("shot 1 values", [s1.next.material_name, s1.next.brand], ["Pumpkin Spice Emulsion", "LorAnn"]);
check("shot 1 says what is still blank", s1.missing, ["Item code", "Ingredient statement", "Contains statement", "Allergens"]);
check("shot 1 nothing differing", s1.differing, []);

// ---------- shot 2: turned a quarter - start of the ingredient statement, nothing else new ----------
const s2 = shoot(s1.next, scanned, { product_name: "Pumpkin Spice Emulsion", brand: "LorAnn", ingredients: "Water, propylene glycol," });
check("shot 2 fills only the new field", s2.filled, ["Ingredient statement"]);
check("shot 2 leaves the front untouched", [s2.next.material_name, s2.next.brand], ["Pumpkin Spice Emulsion", "LorAnn"]);
check("shot 2 still blank", s2.missing, ["Item code", "Contains statement", "Allergens"]);

// ---------- shot 3: the back - the statement read whole, and the Contains line ----------
const s3 = shoot(s2.next, scanned, {
  brand: "LorAnn", ingredients: "Water, propylene glycol, natural flavor, xanthan gum.",
  contains_statement: "Contains: Milk, Soy", allergens: "Milk, Soy", item_code: "0806-0800",
});
check("shot 3 replaces the partial statement an earlier scan wrote", s3.next.ingredients, "Water, propylene glycol, natural flavor, xanthan gum.");
check("shot 3 fills the rest", s3.filled, ["Item code", "Ingredient statement", "Contains statement", "Allergens"]);
check("allergens ticked from the statement", s3.next.allergens, ["Milk", "Soy"]);
check("nothing left blank", s3.missing, []);
check("a fact missing from a later read does not empty its field", s3.next.material_name, "Pumpkin Spice Emulsion");

// ---------- a person's answer is never replaced ----------
{
  const typed = { ...s3.next, brand: "LorAnn Oils", confirmed: true };
  const r = shoot(typed, { ...scanned }, { brand: "LORANN", ingredients: s3.next.ingredients });
  check("an edited answer is kept", r.next.brand, "LorAnn Oils");
  check("the different reading is offered", r.differing, [{ id: "brand", label: "Brand", value: "LORANN" }]);
  check("nothing reported as filled", r.filled, []);
  check("an unchanged statement leaves the confirmation ticked", r.next.confirmed, true);
}
{
  // Typed before any scan, on a page that has scanned nothing: kept, even on the first shot.
  const r = shoot({ ...empty, material_name: "Our pumpkin flavor" }, {}, { product_name: "Pumpkin Spice Emulsion", brand: "LorAnn" });
  check("typed before the first scan is kept", r.next.material_name, "Our pumpkin flavor");
  check("offered as a swap", r.differing.map(d => d.id), ["material_name"]);
  check("the empty field beside it is filled", r.filled, ["Brand"]);
}

// ---------- the confirmation is withdrawn when a later shot changes what it covers ----------
{
  const confirmed = { ...s2.next, confirmed: true };
  const r = shoot(confirmed, { ...scanned, ingredients: s2.next.ingredients }, { ingredients: "Water, propylene glycol, natural flavor." });
  check("statement updated", r.next.ingredients, "Water, propylene glycol, natural flavor.");
  check("confirmation withdrawn", r.next.confirmed, false);
}

// ---------- nothing new ----------
{
  const r = shoot(s3.next, { ...scanned }, { brand: "LorAnn" });
  check("a shot that reads nothing new changes nothing", [r.filled, r.differing, JSON.stringify(r.next) === JSON.stringify(s3.next)], [[], [], true]);
}

// ---------- leftovers into a notes field are not repeated shot after shot ----------
{
  const withNotes = [...FIELDS.slice(0, 2), { id: "notes", type: "textarea", label: "Notes" }];
  const sc = {};
  const a = T.applyLabelScanToFields(withNotes, { material_name: "", brand: "", notes: "" }, { facts: { brand: "LorAnn", net_weight: "16 fl oz" } }, sc);
  check("leftover goes to notes", a.next.notes, "Net weight: 16 fl oz");
  const b = T.applyLabelScanToFields(withNotes, a.next, { facts: { brand: "LorAnn", net_weight: "16 fl oz", barcode: "023535123456" } }, sc);
  check("the second shot adds only the new line", b.next.notes.split("\n").length, 2);
  check("notes not counted as filled when nothing was added",
    T.applyLabelScanToFields(withNotes, b.next, { facts: { net_weight: "16 fl oz", barcode: "023535123456" } }, sc).filled, []);
}

// ---------- a "could not read it" warning is shown only while the field is still empty ----------
{
  const NO_CONTAINS = 'No "Contains" statement was readable, so no allergens were filled. Photograph the allergen panel, or take them from the specification sheet.';
  const W = (values, ...w) => T.relevantScanWarnings(FIELDS, values, w);
  check("shown while allergens are blank", W(s2.next, NO_CONTAINS), [NO_CONTAINS]);
  check("dropped once an earlier shot answered it", W(s3.next, NO_CONTAINS), []);
  check("still shown if only one of the two fields is answered", W({ ...s2.next, contains: "Contains: Milk" }, NO_CONTAINS), [NO_CONTAINS]);
  check("dropped when the filler typed it", W({ ...s2.next, contains: "None", allergens: ["Milk"] }, NO_CONTAINS), []);
  check("ingredient statement not visible: shown while blank", W(s1.next, "The ingredient statement is not visible in this photo.").length, 1);
  check("ingredient statement not visible: dropped once filled", W(s2.next, "The ingredient statement is not visible in this photo."), []);
  check("a fact this form has no field for is not worth a warning", W(empty, "No lot code could be found on the pack."), []);
  const MISMATCH = "The Contains statement declares Milk, but the transcribed ingredient statement does not name it. Check the ingredient statement against the pack - part of it may have been missed or misread.";
  check("a check-this warning always stays", W(s3.next, MISMATCH), [MISMATCH]);
  const COCONUT = "The statement names coconut. Whether coconut counts as a tree nut has changed in FDA guidance - decide it deliberately rather than from this scan.";
  check("coconut always stays", W(s3.next, COCONUT), [COCONUT]);
  const UNRECOGNISED = 'A "Contains" statement was read but no major allergen was recognised in it. Check it by eye.';
  check("unrecognised statement always stays", W(s3.next, UNRECOGNISED), [UNRECOGNISED]);
  check("a warning tied to no field stays", W(s3.next, "The photo does not show a packaged food product."), ["The photo does not show a packaged food product."]);
  check("a warning that is not about something missing stays", W(s3.next, "The brand is printed twice with different spellings."), ["The brand is printed twice with different spellings."]);
  check("mixed: only the answered one goes", W(s3.next, NO_CONTAINS, MISMATCH), [MISMATCH]);
}

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} of ${cases} checks failed`); process.exit(1); }
console.log(`label scan merge: ${cases} checks passed`);
