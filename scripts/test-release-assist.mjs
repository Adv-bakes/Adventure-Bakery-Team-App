// Tests for src/lib/releaseAssist.ts - the release record helper (FRM-701). What it writes becomes
// part of a release record, so the rules that matter are tested here: it fills facts and evidence
// but never a Result or a pack weight, it never overwrites what a person typed, and it says what is
// missing instead of coming back blank.
//
//   node scripts/test-release-assist.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "releaseassist-"));
const file = join(out, "releaseAssist.mjs");
execFileSync("npx", ["esbuild", "src/lib/releaseAssist.ts", "--bundle", "--format=esm", `--outfile=${file}`],
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
const has = (name, text, part) => check(name, String(text ?? "").includes(part), true);

let n = 0;
const entry = (data, status = "submitted", date = "2026-10-01T12:00:00Z") => ({ id: `e${++n}`, status, date, data });
const records = () => {
  const r = T.emptyReleaseRecords();
  r.specs.push(entry({ product_name: "Rum Cake - Original", customer_brand: "Brand A", net_weight: "4 oz (113 g)" }));
  r.lots.push(entry({ product: "Rum Cake - Original", lot_code: "6273", bake_date: "2026-09-30", pack_date: "2026-10-01", units_packed: "480",
    film_lot: "SX-77412", code_check: "Matches the lot code above", ingredients: [{ supplier_lot: "OIL-1" }, { supplier_lot: "EGG 22" }] }));
  r.lots.push(entry({ product: "Rum Cake - Original", lot_code: "6266", bake_date: "2026-09-23", units_packed: "470", ingredients: [] }));
  r.lots.push(entry({ product: "Rum Cake - Original", lot_code: "6280", bake_date: "2026-10-07", ingredients: [] }, "draft"));
  r.lots.push(entry({ product: "Coconut Rum Cake", lot_code: "6273", bake_date: "2026-09-30", ingredients: [] }));
  r.releases.push({ ...entry({ product_name: "Rum Cake - Original", lot_code: "6266", customer: "Brand A", net_weight_declared: "4 oz (113 g)",
    packaging_tare: 21, net_weight_unit: "g", approved_label_ref: "LBL-001", label_version: "v3" }, "submitted", "2026-10-02T09:00:00Z"), id: "rel-old" });
  r.preops.push(entry({ inspection_date: "2026-09-30", area_line: "Production floor", shift: "1st Shift" }));
  r.labels.push(entry({ product_name: "Rum Cake - Original", label_artwork_version: "v3", controlled_label_id: "LBL-001", customer_brand: "Brand A",
    approval_evidence: "Signed approval", approval_date: "2026-08-01" }));
  r.baking.push(entry({ production_date: "2026-09-30", product: "Rum Cake - Original",
    oven_loads: [{ lot_code: "6273", within_limits: "pass" }, { lot_code: "6273", within_limits: "pass" }, { lot_code: "9999", within_limits: "fail" }] }));
  r.sealing.push(entry({ production_date: "2026-10-01", product: "Rum Cake - Original",
    seal_checks: [{ lot_code: "6273", visual: "pass", pull_test: "pass" }] }));
  return r;
};

// ---- the product list
const R = records();
check("products: one line each, newest use first", T.productOptions(R).map(p => p.value), ["Rum Cake - Original", "Coconut Rum Cake"]);
check("products: the hint says what is known", T.productOptions(R).map(p => p.hint), ["1 release on record", "made, not yet released"]);
{
  const r = T.emptyReleaseRecords();
  r.specs.push(entry({ product_name: "Rum Cake - Original" }));
  r.lots.push(entry({ product: "rum cake  original", lot_code: "1" }));
  check("products: spellings of one product collapse, the specification's is kept", T.productOptions(r).map(p => p.value), ["Rum Cake - Original"]);
}

// ---- the lot list
check("lots: only this product's, unreleased, newest bake first", T.lotOptions(R, "Rum Cake - Original", "self").map(l => l.value), ["6280", "6273"]);
has("lots: a draft lot record is flagged", T.lotOptions(R, "Rum Cake - Original", "self")[0].hint, "lot record is a draft");
has("lots: hint carries the bake date and the count", T.lotOptions(R, "Rum Cake - Original", "self")[1].hint, "baked 2026-09-30 · 480 packed");
check("lots: a lot shared by code belongs to its own product", T.lotOptions(R, "Coconut Rum Cake", "self").map(l => l.value), ["6273"]);
check("lots: nothing until a product is chosen", T.lotOptions(R, "", "self"), []);
check("lots: the entry being filled does not hide its own lot", T.lotOptions(R, "Rum Cake - Original", "rel-old").map(l => l.value), ["6280", "6273", "6266"]);

// ---- lot first
check("all unreleased lots, each with its product, newest bake first",
  T.unreleasedLots(R, "self").map(l => [l.value, l.product]),
  [["6280", "Rum Cake - Original"], ["6273", "Coconut Rum Cake"], ["6273", "Rum Cake - Original"]]);
has("the line names the product, so one code on two products can be told apart", T.unreleasedLots(R, "self")[1].hint, "Coconut Rum Cake · baked 2026-09-30");
check("a released lot is not offered", T.unreleasedLots(R, "self").some(l => l.value === "6266"), false);
check("products a lot code is recorded against", T.productsForLot(R, " 62-73 "), ["Rum Cake - Original", "Coconut Rum Cake"]);
check("a lot on one product only", T.productsForLot(R, "6280"), ["Rum Cake - Original"]);
check("an unknown lot has no product", T.productsForLot(R, "7777"), []);
check("product list for a lot: its products first and marked",
  T.productOptionsForLot(R, "6280").map(p => [p.value, p.hint]),
  [["Rum Cake - Original", "lot 6280 on FRM-520"], ["Coconut Rum Cake", "made, not yet released"]]);
check("product list for an unknown lot is the plain list", T.productOptionsForLot(R, "7777"), T.productOptions(R));

// ---- product alone
const p = T.releaseFill(R, "Rum Cake - Original", "", "self");
check("product alone: the last release's answers", p.fields,
  { customer: "Brand A", net_weight_declared: "4 oz (113 g)", packaging_tare: 21, net_weight_unit: "g", approved_label_ref: "LBL-001", label_version: "v3" });
check("product alone: no lot evidence yet", Object.keys(p.notes), ["label"]);
has("label evidence names the approval and asks for the look", p.notes.label, "label v3 approved 2026-08-01. Check it is the label on this pack.");

// ---- product and lot
const f = T.releaseFill(R, "Rum Cake - Original", "6273", "self");
check("lot: batch reference and date come from FRM-520", [f.fields.batch_sheet_ref, f.fields.date_produced], ["FRM-520 lot 6273", "2026-09-30"]);
has("batch evidence: the lot record", f.notes.batch, "FRM-520 lot 6273, baked 2026-09-30: submitted 2026-10-01.");
has("batch evidence: CCP 1 counts only this lot's loads", f.notes.batch, "FRM-507: 2 oven loads for this lot, all passed.");
has("batch evidence: CCP 2", f.notes.batch, "FRM-606: 1 sealing check for this lot, all passed.");
has("pre-op: found for the bake date", f.notes.preop, "FRM-903 2026-09-30 (Production floor): submitted.");
has("pre-op: the pack date with none is said, not skipped", f.notes.preop, "FRM-903: none found for 2026-10-01.");
has("hold: none, and it says what it looked for", f.notes.hold, "FRM-702: no hold names lot 6273 or the 3 supplier lots used in it.");
has("code evidence asks for the look", f.notes.code, "Matches the lot code above. Check a pack from this lot.");
check("quantity evidence", f.notes.quantity, "FRM-520: 480 packed.");
check("no warnings on a clean lot", f.warnings, []);

{
  // FRM-606 v2: the lot once at the top, one check to a row.
  const r2 = records();
  r2.sealing = [entry({ production_date: "2026-10-01", product: "Rum Cake - Original", lot_code: "6273",
    seal_checks: [{ check: "Set-up", visual: "pass" }, { check: "End of run", visual: "pass" }, { check: "At boxing", pull_test: "pass" }] })];
  has("FRM-606 with the lot at the top: every row of the entry counts", T.releaseFill(r2, "Rum Cake - Original", "6273", "self").notes.batch,
    "FRM-606: 3 sealing checks for this lot, all passed.");
  has("FRM-606 with the lot at the top: another lot's entry is not counted", T.releaseFill(r2, "Rum Cake - Original", "7777", "self").notes.batch,
    "FRM-606: no sealing check recorded for this lot.");
  r2.sealing[0].data.seal_checks.push({ check: "At boxing", pull_test: "fail" }, { check: "In process" });
  has("FRM-606: a failed pull test and an empty row are both said", T.releaseFill(r2, "Rum Cake - Original", "6273", "self").notes.batch,
    "FRM-606: 5 sealing checks for this lot, 1 FAILED");
}

has("a code shared by two products: the other product's oven loads are not counted",
  T.releaseFill(R, "Coconut Rum Cake", "6273", "self").notes.batch, "FRM-507: no oven load recorded for this lot. FRM-606: no sealing check recorded for this lot.");

// ---- gaps are stated
const g = T.releaseFill(R, "Rum Cake - Original", "7777", "self");
has("unknown lot: a warning", g.warnings[0], "No Production Lot Record (FRM-520) found for Rum Cake - Original lot 7777.");
check("unknown lot: no batch reference invented", [g.fields.batch_sheet_ref, g.fields.date_produced], [undefined, undefined]);
has("unknown lot: the evidence says none found", g.notes.batch, "FRM-520: no lot record found for this lot. FRM-507: no oven load recorded for this lot.");
has("unknown lot: pre-op cannot be looked up, and says so", g.notes.preop, "the production date is not known");
has("draft lot record is called a draft", T.releaseFill(R, "Rum Cake - Original", "6280", "self").notes.batch, "still a DRAFT - not complete");
has("a second release of one lot is warned about", T.releaseFill(R, "Rum Cake - Original", "6266", "self").warnings[0], "already a release record");
{
  const r = records();
  r.holds.push(entry({ hold_tag_number: "H-12", material_name_description: "Eggs", supplier_lot_batch_number: "egg-22", final_disposition_decision: "" }));
  r.holds.push(entry({ hold_tag_number: "H-9", material_name_description: "Film", supplier_lot_batch_number: "SX 77412",
    final_disposition_decision: "APPROVED FOR PRODUCTION RELEASE: Material is confirmed compliant." }));
  r.holds.push(entry({ hold_tag_number: "H-1", material_name_description: "Sugar", supplier_lot_batch_number: "ZZZ", final_disposition_decision: "" }));
  const h = T.releaseFill(r, "Rum Cake - Original", "6273", "self").notes.hold;
  has("hold on an ingredient lot is found, lot written differently", h, "FRM-702 hold H-12 on Eggs lot egg-22: OPEN, no decision yet.");
  has("a decided hold shows its decision", h, "hold H-9 on Film lot SX 77412: decided - APPROVED FOR PRODUCTION RELEASE.");
  check("a hold on an unrelated lot is not listed", h.includes("H-1 "), false);
  r.baking[0].data.oven_loads.push({ lot_code: "6273", within_limits: "fail" });
  has("a failed CCP load is shouted", T.releaseFill(r, "Rum Cake - Original", "6273", "self").notes.batch, "3 oven loads for this lot, 1 FAILED.");
}
{
  const r = T.emptyReleaseRecords();
  r.specs.push(entry({ product_name: "Walnut Loaf", customer_brand: "Brand B", net_weight: "16 oz" }));
  const first = T.releaseFill(r, "Walnut Loaf", "", "self");
  check("first release of a product: the specification gives customer and net weight, nothing invents a tare",
    first.fields, { customer: "Brand B", net_weight_declared: "16 oz" });
  has("no label approval is said", first.notes.label, "no label approval found");
}

// ---- writing it into the entry
const LABELS = ["Batch sheet complete and signed\nx", "Line pre-operation and sanitation release recorded\nx", "No hold applies\nx",
  "Label is the approved label\nx", "Pack, seal and package integrity correct\nx", "Date and lot code present, legible and correct",
  "Appearance and sensory standard met\nx", "Quantity and pack configuration match the customer's agreed specification", "Net weight\nx"];
const blank = () => ({ product_name: "Rum Cake - Original", lot_code: "6273", customer: "", batch_sheet_ref: "", date_produced: "", net_weight_declared: "",
  packaging_tare: "", net_weight_unit: "", approved_label_ref: "", label_version: "", pack_weight_1: "", pack_weight_2: "", pack_weight_3: "",
  checks: LABELS.map(() => ({ result: "", note: "" })) });

const a1 = T.applyReleaseFill(blank(), f, {}, LABELS);
check("fields are filled", [a1.values.customer, a1.values.packaging_tare, a1.values.date_produced], ["Brand A", 21, "2026-09-30"]);
check("NO result is ever answered", a1.values.checks.map(r => r.result), LABELS.map(() => ""));
check("NO pack weight is ever filled", [a1.values.pack_weight_1, a1.values.pack_weight_2, a1.values.pack_weight_3], ["", "", ""]);
check("physical checks get no note", [a1.values.checks[4].note, a1.values.checks[6].note, a1.values.checks[8].note], ["", "", ""]);
check("the six record-backed checks get a note", a1.values.checks.map(r => r.note !== ""), [true, true, true, true, false, true, false, true, false]);
check("the banner lists what changed", a1.changed.length, 14);

{
  const typed = blank();
  typed.customer = "Typed by hand";
  typed.checks[2] = { result: "pass", note: "Checked the tags myself" };
  const a = T.applyReleaseFill(typed, f, {}, LABELS);
  check("a typed field is left alone", a.values.customer, "Typed by hand");
  check("a typed note and its result are left alone", a.values.checks[2], { result: "pass", note: "Checked the tags myself" });
}
{
  // Change the lot: looked-up answers follow, a typed one stays, and a note with no new evidence is cleared.
  const v = { ...a1.values, customer: "Typed afterwards", lot_code: "7777", checks: a1.values.checks.map(r => ({ ...r })) };
  v.checks[0].result = "pass";
  const a2 = T.applyReleaseFill(v, g, a1.auto, LABELS);
  check("changing the lot clears the batch reference that no longer applies", [a2.values.batch_sheet_ref, a2.values.date_produced], ["", ""]);
  check("changing the lot rewrites looked-up evidence", a2.values.checks[0].note.startsWith("FRM-520: no lot record found"), true);
  check("a result the person tapped is never changed", a2.values.checks[0].result, "pass");
  check("evidence with nothing behind it is cleared, not left stale", [a2.values.checks[5].note, a2.values.checks[7].note], ["", ""]);
  check("what was typed after the fill is kept", a2.values.customer, "Typed afterwards");
  check("the same fill twice changes nothing", T.applyReleaseFill(a2.values, g, a2.auto, LABELS).changed, []);
}
{
  const a = T.applyReleaseFill(blank(), f, {}, ["Something else entirely", "No hold applies"]);
  check("a check row that is not on the form is skipped, the rest still land", [a.values.checks[1].note.startsWith("FRM-702"), a.values.checks[0].note], [true, ""]);
}

// ---- reopening a saved entry
{
  const saved = { ...a1.values, customer: "Typed by hand", checks: a1.values.checks.map(r => ({ ...r })) };
  saved.checks[2].note = "My own note";
  const auto = T.autoFromFill(saved, f, LABELS);
  check("cells that still match the lookup are the helper's", ["batch_sheet_ref" in auto, "checks.0.note" in auto], [true, true]);
  check("cells that were changed by hand are not", ["customer" in auto, "checks.2.note" in auto], [false, false]);
  const a = T.applyReleaseFill({ ...saved, lot_code: "7777" }, g, auto, LABELS);
  check("reopened entry, new lot: looked-up cells follow, typed ones stay",
    [a.values.batch_sheet_ref, a.values.customer, a.values.checks[2].note], ["", "Typed by hand", "My own note"]);
}

// ---- the field map
check("mapping: all present, no problems",
  T.checkReleaseMapping(Object.fromEntries(Object.values(T.RELEASE_SOURCES).map(s => [s.form, [...s.fields, ...Object.keys(s.grids)]]))), []);
check("mapping: a renamed field and a missing form are named",
  T.checkReleaseMapping({ "FRM-520": ["product", "lot_code", "bake_date", "pack_date", "units_packed", "film_lot", "code_check", "ingredients"],
    "FRM-701": T.RELEASE_SOURCES.releases.fields.slice(), "FRM-702": T.RELEASE_SOURCES.holds.fields.slice(),
    "FRM-903": ["area_line", "shift"], "FRM-601": T.RELEASE_SOURCES.labels.fields.slice(), "FRM-704": T.RELEASE_SOURCES.specs.fields.slice(),
    "FRM-507": ["production_date", "product", "oven_loads"] }),
  ['FRM-903 no longer has "inspection_date"', "FRM-606 was not found"]);

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} of ${cases} failed`); process.exit(1); }
console.log(`${cases} cases passed`);
