// Tests for src/lib/lotFlow.ts - the steps of "Follow this lot" and how far each has got, read
// from the records.
//
//   node scripts/test-lot-flow.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "lotflow-"));
const bundle = name => {
  const file = join(out, `${name}.mjs`);
  execFileSync("npx", ["esbuild", `src/lib/${name}.ts`, "--bundle", "--format=esm", `--outfile=${file}`, "--log-level=error"],
    { stdio: ["ignore", "ignore", "inherit"], shell: true });
  return import("file://" + file.replace(/\\/g, "/"));
};
const F = await bundle("lotFlow");
const T = await bundle("today");

let failures = 0, cases = 0;
function check(name, actual, expected) {
  cases++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) return;
  failures++;
  console.error(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`);
}

let n = 0;
const entry = (data, status = "draft", at = "2026-10-12T12:00:00Z") =>
  ({ id: `e${++n}`, docId: "d", status, createdAt: at, submittedAt: status === "submitted" ? at : null, createdBy: "u1", submittedBy: null, data });
const TODAY = "2026-10-12";
/** A lot record line (FRM-520 v3): its weights, batch 1 first, in the "Weighed per batch" cell. */
const row = (ingredient, expected, lot = "", ...ws) => ({ ingredient, brand: "", supplier_lot: lot, expected_qty: expected, unit: "lb",
  weighed_batches: ws.map((w, i) => (w === "" ? "" : `B${i + 1}: ${w}`)).filter(Boolean).join("; "), notes: "" });
/** A made-here batch line (FRM-530): one weight column. */
const row530 = (ingredient, expected, lot = "", w = "") => ({ ingredient, brand: "", supplier_lot: lot, expected_qty: expected, unit: "lb", actual_qty: w });

// ---- mixing, from the lot record's own answers
check("nothing entered", F.mixProgress({ ingredients: [row("Flour", 17.49), row("Sugar", 12)] }), { state: "none", lines: 2, linesDone: 0, batches: 0 });
check("no record at all", F.mixProgress(undefined).state, "none");
check("batches answered is a start", F.mixProgress({ batches: 2, ingredients: [row("Flour", 17.49)] }).state, "open");
check("a lot typed before the batches is a start", F.mixProgress({ ingredients: [row("Flour", 17.49, "L1")] }).state, "open");
check("one batch, every line weighed, rework not answered", F.mixProgress({ batches: 1, ingredients: [row("Flour", 17.49, "L1", 17.5), row("Sugar", 12, "L2", 12)] }),
  { state: "open", lines: 2, linesDone: 2, batches: 1 });
check("...and answered: done", F.mixProgress({ batches: 1, rework: "No rework used", ingredients: [row("Flour", 17.49, "L1", 17.5), row("Sugar", 12, "L2", 12)] }).state, "done");
check("two batches need two weights", F.mixProgress({ batches: 2, rework: "No rework used", ingredients: [row("Flour", 17.49, "L1", 17.5), row("Sugar", 12, "L2", 12, 12)] }),
  { state: "open", lines: 2, linesDone: 1, batches: 2 });
check("a line with no expected quantity needs only its lot", F.mixProgress({ batches: 1, rework: "No rework used", ingredients: [row("Flour", 17.49, "L1", 17.5), row("Pan spray", "", "L9")] }).state, "done");
check("...but it does need the lot", F.mixProgress({ batches: 1, rework: "No rework used", ingredients: [row("Flour", 17.49, "L1", 17.5), row("Pan spray", "")] }).linesDone, 1);
check("a blank line is not an ingredient", F.mixProgress({ batches: 1, rework: "No rework used", ingredients: [row("Flour", 17.49, "L1", 17.5), row("", "")] }).state, "done");
check("any number of batches", F.mixProgress({ batches: 20, ingredients: [row("Flour", 1)] }).batches, 20);
check("six batches need six weights", F.mixProgress({ batches: 6, rework: "No rework used", ingredients: [row("Eggs", 17.49, "L1", 1, 1, 1, 1, 1), row("Sugar", 12, "L2", 1, 1, 1, 1, 1, 1)] }),
  { state: "open", lines: 2, linesDone: 1, batches: 6 });
check("a count that is not a whole number is not answered", F.mixProgress({ batches: "two", ingredients: [row("Flour", 1)] }).batches, 0);

// ---- the steps of a lot
const records = () => T.emptyTodayRecords();
const lotEntry = (product, extra = {}, status = "draft") => entry({ product, lot_code: "6285", bake_date: TODAY, ingredients: [row("Flour", 17.49)], ...extra }, status);
const summary = (r, id) => T.lotSummaries(r).find(l => l.id === id);
const keys = steps => steps.map(s => s.key);
const states = steps => Object.fromEntries(steps.map(s => [s.key, s.state]));

{
  const r = records();
  const a = lotEntry("Rum Cake - Original");
  r.lots.push(a);
  const lot = summary(r, a.id);
  check("a worker's steps end at the lot record, the retention sample before it", keys(F.flowSteps(r, lot, TODAY, false)), ["mixing", "baking", "sealing", "packing", "retention", "submit"]);
  check("an admin's go on to the release", keys(F.flowSteps(r, lot, TODAY, true)), ["mixing", "baking", "sealing", "packing", "retention", "submit", "bakeReview", "sealReview", "release"]);
  check("a new lot: nothing started", states(F.flowSteps(r, lot, TODAY, false)), { mixing: "none", baking: "none", sealing: "none", packing: "none", retention: "none", submit: "none" });
  check("the page opens on the first step not finished", F.nextOpenStep(F.flowSteps(r, lot, TODAY, false)), "mixing");
}

{
  // Two products share the day's lot code: each is its own lot.
  const r = records();
  const a = lotEntry("Rum Cake - Original", { batches: 1, rework: "No rework used", ingredients: [row("Flour", 17.49, "L1", 17.5)] });
  const b = lotEntry("Rum Cake - Pumpkin Spice");
  r.lots.push(a, b);
  r.baking.push(entry({ production_date: TODAY, oven_loads: [
    { product: "Rum Cake - Original", lot_code: "6285", last_load: "" },
    { product: "Rum Cake - Original", lot_code: "6285", last_load: "Last load of this batch" },
    { product: "Rum Cake - Pumpkin Spice", lot_code: "6285", last_load: "" },
  ] }));
  r.sealing.push(entry({ production_date: TODAY, product: "Rum Cake - Original", lot_code: "6285", seal_checks: [{ check: "In process" }] }));
  const sa = F.flowSteps(r, summary(r, a.id), TODAY, false), sb = F.flowSteps(r, summary(r, b.id), TODAY, false);
  check("the batch that said last load is done baking, its checks are in progress", states(sa), { mixing: "done", baking: "done", sealing: "open", packing: "none", retention: "none", submit: "none" });
  check("the other product is still baking", [states(sb).baking, sb.find(s => s.key === "baking").count], ["open", 1]);
  check("loads are counted per product", sa.find(s => s.key === "baking").count, 2);
  check("it opens on the seal checks", F.nextOpenStep(sa), "sealing");

  r.baking[0].data.oven_loads[2].last_load = "Last load of this lot";
  check("last load of the lot finishes every product of that code", states(F.flowSteps(r, summary(r, b.id), TODAY, false)).baking, "done");
}

{
  // Baked yesterday, packed today: the baking still counts.
  const r = records();
  const a = entry({ product: "Rum Cake - Original", lot_code: "6284", bake_date: "2026-10-11", ingredients: [row("Flour", 1)] });
  r.lots.push(a);
  r.baking.push(entry({ production_date: "2026-10-11", oven_loads: [{ product: "Rum Cake - Original", lot_code: "6284", last_load: "Last load of this lot" }] }));
  r.sealing.push(entry({ production_date: "2026-10-11", product: "Rum Cake - Original", lot_code: "6284", seal_checks: [{ check: "At boxing", last_check: "Last check of this batch" }] }));
  const s = states(F.flowSteps(r, summary(r, a.id), TODAY, false));
  check("yesterday's baking and checks are read", [s.baking, s.sealing], ["done", "done"]);
}

{
  // Packing, the lot record, and what an admin sees after it.
  const r = records();
  const a = lotEntry("Rum Cake - Original", { code_check: "Matches the lot code above" });
  r.lots.push(a);
  check("first pack answered, counts not: in progress", states(F.flowSteps(r, summary(r, a.id), TODAY, false)).packing, "open");
  Object.assign(a.data, { racked_count: 100, units_packed: "98", not_packed: 2 });
  check("...and counted, the packs not weighed: still in progress", states(F.flowSteps(r, summary(r, a.id), TODAY, false)).packing, "open");
  Object.assign(a.data, { pack_weight_1: 162, pack_weight_2: 163, pack_weight_3: 170 });
  a.revision = "New"; delete a.data.pack_weight_3;
  check("a record on an earlier revision has no weights to wait for", [states(F.flowSteps(r, summary(r, a.id), TODAY, false, "v2")).packing, states(F.flowSteps(r, summary(r, a.id), TODAY, false, "New")).packing, states(F.flowSteps(r, summary(r, a.id), TODAY, false)).packing], ["done", "open", "open"]);
  a.revision = "v2"; a.data.pack_weight_3 = 170;
  check("...and weighed: done", states(F.flowSteps(r, summary(r, a.id), TODAY, false)).packing, "done");
  a.status = "submitted"; a.submittedAt = "2026-10-12T15:00:00Z";
  const admin = F.flowSteps(r, summary(r, a.id), TODAY, true);
  check("a submitted lot record finishes mixing, packing and the record", [states(admin).mixing, states(admin).packing, states(admin).submit], ["done", "done", "done"]);
  check("retention and release wait", [states(admin).retention, states(admin).release], ["none", "none"]);
  check("a submitted lot with no sample yet opens on the retention sample", [F.nextOpenStep(admin), F.nextOpenStep(F.flowSteps(r, summary(r, a.id), TODAY, false))], ["retention", "retention"]);
  r.retention.push(entry({ product_name: "Rum Cake - Original", lot_code: "6285", taken_by: { signed_at: "2026-10-12T16:00:00Z" } }));
  const after = F.flowSteps(r, summary(r, a.id), TODAY, true);
  check("a signed sample kept as a draft is done, with its record to open", [states(after).retention, !!after.find(s => s.key === "retention").release.entryId], ["done", true]);
  check("with the sample logged, the CCP records come next: none found is said on its step", [F.nextOpenStep(after), states(after).bakeReview, states(after).sealReview], ["bakeReview", "none", "none"]);
  const bake = entry({ production_date: TODAY, oven_loads: [{ product: "Rum Cake - Original", lot_code: "6285", last_load: "Last load of this lot" }] });
  const seal = entry({ production_date: TODAY, product: "Rum Cake - Original", lot_code: "6285", seal_checks: [{ check: "At boxing", last_check: "Last check of this batch" }] });
  r.baking.push(bake); r.sealing.push(seal);
  const waiting = F.flowSteps(r, summary(r, a.id), TODAY, true);
  check("drafts wait for their review, each with its record", [states(waiting).bakeReview, states(waiting).sealReview, waiting.find(s => s.key === "bakeReview").release.entryId === bake.id, F.nextOpenStep(waiting)], ["open", "open", true, "bakeReview"]);
  bake.status = "submitted";
  check("the baking record submitted: the seal checks are next", [states(F.flowSteps(r, summary(r, a.id), TODAY, true)).bakeReview, F.nextOpenStep(F.flowSteps(r, summary(r, a.id), TODAY, true))], ["done", "sealReview"]);
  seal.status = "submitted";
  check("everything done but the release: it opens there", F.nextOpenStep(F.flowSteps(r, summary(r, a.id), TODAY, true)), "release");
  check("a worker never sees the reviews", keys(F.flowSteps(r, summary(r, a.id), TODAY, false)).filter(k => /Review/.test(k)), []);
  check("for a worker, everything done opens on the last step", F.nextOpenStep(F.flowSteps(r, summary(r, a.id), TODAY, false)), "submit");
}

// ---- moving between steps
const five = ["mixing", "baking", "sealing", "packing", "submit"].map(key => ({ key, state: "none" }));
check("the step after", [F.stepAfter(five, "baking"), F.stepAfter(five, "submit")], ["sealing", null]);
check("the step before", [F.stepBefore(five, "baking"), F.stepBefore(five, "mixing")], ["mixing", null]);
const withState = (key, state) => five.map(s => s.key === key ? { ...s, state } : s);
check("a load with more to come stays", F.advancesAfter("baking", {}, five), false);
check("the last load of the batch moves on", F.advancesAfter("baking", { last: "batch" }, five), true);
check("the last check of the lot moves on", F.advancesAfter("sealing", { last: "lot" }, five), true);
check("the first pack alone stays", F.advancesAfter("packing", { step: "checked" }, withState("packing", "open")), false);
check("the counts with no first pack stay", F.advancesAfter("packing", { step: "counted" }, withState("packing", "open")), false);
check("the counts once packing is complete move on", F.advancesAfter("packing", { step: "counted" }, withState("packing", "done")), true);
check("...and so does the first pack answered last", F.advancesAfter("packing", { step: "checked" }, withState("packing", "done")), true);
check("...or the packs weighed last", F.advancesAfter("packing", { step: "weighed" }, withState("packing", "done")), true);
check("a photo kept on the record moves nothing", F.advancesAfter("packing", undefined, withState("packing", "done")), false);
check("the lot record submitted moves on", F.advancesAfter("submit", undefined, withState("submit", "done")), true);
check("a release step never moves by itself", F.advancesAfter("retention", undefined, five), false);
{
  const reviewing = state => [...five, { key: "bakeReview", state }, { key: "sealReview", state: "open" }, { key: "release", state: "none" }];
  check("a record verified and submitted moves on to the next review", [F.advancesAfter("bakeReview", { step: "verified" }, reviewing("done")), F.stepAfter(reviewing("done"), "bakeReview")], [true, "sealReview"]);
  check("...unless another record of the lot is still waiting", F.advancesAfter("bakeReview", { step: "verified" }, reviewing("open")), false);
}
const seven = [...five.slice(0, 4), { key: "retention", state: "done" }, five[4], { key: "release", state: "none" }];
check("the retention sample signed on the page moves on to Sign and submit", [F.advancesAfter("retention", { step: "logged" }, seven), F.stepAfter(seven, "retention"), F.stepAfter(seven, "packing")], [true, "submit", "retention"]);

// ---- mixing, one screen per ingredient, any number of batches
{
  const kinds = (d, only = null) => F.mixScreens(d, F.LOT_SPEC, only).map(s => s.kind === "ingredient" ? s.ingredient : s.kind);
  const rows = [row("Flour", 17.49), row("", ""), row("Pan spray", ""), row("Sugar", 12)];
  check("until the batches are answered there is only that screen", kinds({ ingredients: rows }), ["batches"]);
  check("one screen per ingredient, then rework", kinds({ batches: 6, ingredients: rows }), ["batches", "Flour", "Pan spray", "Sugar", "rework"]);
  const s = F.mixScreens({ batches: 6, ingredients: rows });
  check("a screen knows its row, blank lines counted", [s[1].index, s[2].index, s[3].index], [0, 2, 3]);
  check("a box for every batch", s[1].weights, ["", "", "", "", "", ""]);
  check("a line with no expected quantity need not be weighed", [s[2].needsWeight, s[1].needsWeight], [false, true]);
  check("...and is answered by its lot alone", F.mixScreenDone({}, { ...s[2], lot: "L9" }), true);
  check("position among the ingredients", [[s[1].position, s[1].of], [s[3].position, s[3].of]], [[1, 3], [3, 3]]);
  check("the expected figure and unit come from the line", [s[1].expected, s[1].unit], ["17.49", "lb"]);
  const w = F.mixScreens({ batches: 3, ingredients: [row("Eggs", 17.49, "L1", 17.5, "", 17.48)] })[1];
  check("the weights already recorded, by batch", w.weights, ["17.5", "", "17.48"]);
  check("a missing batch weight leaves the screen open", F.mixScreenDone({}, w), false);
  check("every batch weighed and the lot in: answered", F.mixScreenDone({}, { ...w, weights: ["17.5", "17.4", "17.48"] }), true);
  check("...but not without the lot", F.mixScreenDone({}, { ...w, lot: "", weights: ["1", "1", "1"] }), false);

  check("opens on the batches", F.nextMixScreen({ ingredients: rows }), 0);
  check("then the first ingredient", F.nextMixScreen({ batches: 1, ingredients: rows }), 1);
  const part = { batches: 6, ingredients: [row("Eggs", 17.49, "L1", 1, 1, 1, 1, 1, 1), row("Sugar", 12, "L2", 12, 12)] };
  check("the first ingredient not weighed for every batch", kinds(part)[F.nextMixScreen(part)], "Sugar");
  const all = { batches: 1, ingredients: [row("Flour", 17.49, "L1", 17.5)] };
  check("every line in: the rework question", kinds(all)[F.nextMixScreen(all)], "rework");
  check("all answered: stays on the last screen", F.nextMixScreen({ ...all, rework: "No rework used" }), 2);

  const v = { batches: 6, product: "Rum Cake", ingredients: [row("Flour", 17.49), row("Sugar", 12, "L2", 12)] };
  const ref = { index: 0, ingredient: "Flour", brand: "" };
  const a = F.applyMixEntry(v, ref, { lot: " L1 ", batch: 1, weight: 17.5 });
  check("a lot and a weight are written on the line", [a.ingredients[0].supplier_lot, a.ingredients[0].weighed_batches], ["L1", "B1: 17.5"]);
  check("nothing else changes", [a.ingredients[1], a.product, a.ingredients[0].expected_qty], [v.ingredients[1], "Rum Cake", 17.49]);
  check("the record handed in is not changed", v.ingredients[0].supplier_lot, "");
  const b = F.applyMixEntry(F.applyMixEntry(a, ref, { batch: 6, weight: 17.4 }), ref, { batch: 4, weight: 17.48 });
  check("any batch goes into the same cell, in batch order", b.ingredients[0].weighed_batches, "B1: 17.5; B4: 17.48; B6: 17.4");
  check("a weight taken off again", F.applyMixEntry(b, ref, { batch: 4, weight: "" }).ingredients[0].weighed_batches, "B1: 17.5; B6: 17.4");
  check("a lot alone leaves the weights", F.applyMixEntry(b, ref, { lot: "L9" }).ingredients[0].weighed_batches, b.ingredients[0].weighed_batches);
  const u = F.applyMixEntry({ ingredients: [{ ...row("Flavor", ""), unit: "" }] }, { index: 0, ingredient: "Flavor", brand: "" }, { batch: 1, weight: 4, unit: "oz" });
  check("a unit chosen with the weight is written on the line", [u.ingredients[0].weighed_batches, u.ingredients[0].unit], ["B1: 4", "oz"]);
  check("a unit not named is left as it is", F.applyMixEntry(v, ref, { batch: 1, weight: 1 }).ingredients[0].unit, "lb");
  check("a row that moved is refused", F.applyMixEntry(v, { index: 1, ingredient: "Flour", brand: "" }, { lot: "L1" }), null);
  check("a row that is gone is refused", F.applyMixEntry(v, { index: 5, ingredient: "Flour", brand: "" }, { lot: "L1" }), null);
  check("a brand that changed is refused", F.applyMixEntry(v, { ...ref, brand: "Other" }, { lot: "L1" }), null);
  check("batch 0 is refused", F.applyMixEntry(v, ref, { batch: 0, weight: 1 }), null);
  const typed = { batches: 2, ingredients: [{ ...row("Flour", 17.49, "L1"), weighed_batches: "first one 17.5" }] };
  check("a cell typed by hand is never merged into", [F.applyMixEntry(typed, ref, { batch: 2, weight: 17.4 }), F.lineWeightsReadable(typed, 0)], [null, false]);
  const legacy = { batches: 3, ingredients: [{ ingredient: "Flour", brand: "", supplier_lot: "L1", expected_qty: 17.49, unit: "lb", actual_qty: 17.5, actual_qty_2: 17.4, actual_qty_3: "" }] };
  check("an earlier record's three columns are read", F.mixScreens(legacy)[1].weights, ["17.5", "17.4", ""]);
  check("...and carried into the cell when it is written", F.applyMixEntry(legacy, ref, { batch: 3, weight: 17.6 }).ingredients[0].weighed_batches, "B1: 17.5; B2: 17.4; B3: 17.6");
  check("quick buttons for the number of batches", F.MIX_QUICK_BATCHES, [1, 2, 3, 4, 5, 6]);
  check("weights for batches past the number are counted", [F.weightsPastBatches({ batches: 2, ingredients: [row("Flour", 1, "L", 1, 1, 1)] }), F.weightsPastBatches(part)], [1, 0]);

  const col = id => ({ id });
  const schema = { sections: [{ fields: [
    { id: "batches" }, { id: "rework", options: ["No rework used", "Rework used - listed in the table with its original lot code"] },
    { id: "ingredients", columns: ["ingredient", "brand", "supplier_lot", "expected_qty", "unit", "weighed_batches", "notes"].map(col) },
  ] }] };
  check("the form as it is: nothing missing", F.checkMixMapping(schema), []);
  check("the form before v3 is named as missing its weights cell", F.checkMixMapping({ sections: [{ fields: [{ id: "batches" }, { id: "rework" },
    { id: "ingredients", columns: ["ingredient", "brand", "supplier_lot", "expected_qty", "unit", "actual_qty", "actual_qty_2", "actual_qty_3"].map(col) }] }] }),
    ["ingredients.weighed_batches"]);
  check("a renamed column is named", F.checkMixMapping({ sections: [{ fields: [{ id: "batches" }, { id: "ingredients", columns: [col("ingredient")] }] }] }).slice(0, 3),
    ["rework", "ingredients.brand", "ingredients.supplier_lot"]);
  check("the no-rework answer in the form's words", F.noReworkOption(schema), "No rework used");
  check("a form whose options changed gives none", F.noReworkOption({ sections: [{ fields: [{ id: "rework", options: ["None", "Yes"] }] }] }), "");
}

// ---- dunking: the syrup and rum lines, not mixed
{
  const dunk = (ingredient, brand, lot = "", notes = "") => ({ ...row(ingredient, ""), brand, supplier_lot: lot, notes, _stage: "dunking" });
  const rows = [row("Flour", 17.49, "L1", 17.5), dunk("Simple syrup", "Made on site"), dunk("Rum", "Bacardi")];
  const d = { batches: 1, rework: "No rework used", ingredients: rows };
  check("a dunking line is not a mixing line", F.mixProgress(d), { state: "done", lines: 1, linesDone: 1, batches: 1 });
  check("...nor a mixing screen", F.mixScreens(d).map(s => s.kind === "ingredient" ? s.ingredient : s.kind), ["batches", "Flour", "rework"]);
  check("isDunkLine reads the marker only", [F.isDunkLine(rows[1]), F.isDunkLine(rows[0]), F.isDunkLine(null), F.isDunkLine({ _stage: "Dunking" })], [true, false, false, true]);
  const s = F.dunkScreens(d);
  check("one screen per dunking line, addressed by its row", s.map(x => [x.index, x.ingredient, x.position, x.of]), [[1, "Simple syrup", 1, 2], [2, "Rum", 2, 2]]);
  check("nothing entered", [F.dunkProgress(d).state, F.nextDunkScreen(d)], ["none", 0]);
  const one = F.applyMixEntry(d, { index: 1, ingredient: "Simple syrup", brand: "Made on site" }, { lot: "S6287", amount: "2 gal" });
  check("a lot and an amount are written on the line", [one.ingredients[1].supplier_lot, one.ingredients[1].notes], ["S6287", "Amount used: 2 gal"]);
  check("...the marker is kept", one.ingredients[1]._stage, "dunking");
  check("half done: in progress, opens on the rum", [F.dunkProgress(one).state, F.nextDunkScreen(one)], ["open", 1]);
  const both = F.applyMixEntry(one, { index: 2, ingredient: "Rum", brand: "Bacardi" }, { lot: "R-77" });
  check("every line has its lot: done", F.dunkProgress(both), { state: "done", lines: 2, linesDone: 2 });
  check("the amount is read back", F.dunkScreens(both)[0].amount, "2 gal");

  // Notes keep anything else written in them.
  check("amount added beside other notes", F.withAmount("opened new jug", "1 gal"), "opened new jug; Amount used: 1 gal");
  check("amount replaced, other notes kept", F.withAmount("opened new jug; Amount used: 1 gal", "2 gal"), "opened new jug; Amount used: 2 gal");
  check("amount taken off", F.withAmount("Amount used: 1 gal", ""), "");
  check("amount read from mixed notes", F.amountOf("x; Amount used: 750 ml"), "750 ml");

  // A second lot of rum.
  const added = F.addDunkLot(both, { index: 2, ingredient: "Rum", brand: "Bacardi" });
  check("a second rum line goes at the end, blank", [added.index, added.values.ingredients[3].ingredient, added.values.ingredients[3].supplier_lot, added.values.ingredients[3]._stage],
    [3, "Rum", "", "dunking"]);
  check("...no other line moves", added.values.ingredients.slice(0, 3), both.ingredients);
  check("...and the step is open again until its lot is in", [F.dunkProgress(added.values).state, F.nextDunkScreen(added.values)], ["open", 2]);
  check("both rum lines know they have a twin", F.dunkScreens(added.values).map(x => x.twin), [false, true, true]);
  check("adding from a line that moved is refused", F.addDunkLot(both, { index: 1, ingredient: "Rum", brand: "Bacardi" }), null);
  check("a mixing line cannot be given a dunking twin", F.addDunkLot(both, { index: 0, ingredient: "Flour", brand: "" }), null);
  const back = F.removeDunkLine(added.values, { index: 3, ingredient: "Rum", brand: "Bacardi" });
  check("a blank second line can be taken back", back.ingredients.length, 3);
  check("...but not the only line of an ingredient", F.removeDunkLine(d, { index: 2, ingredient: "Rum", brand: "Bacardi" }), null);
  check("...nor a line with its lot", F.removeDunkLine(added.values, { index: 2, ingredient: "Rum", brand: "Bacardi" }), null);

  // The step on the lot page.
  const lotRec = entry({ product: "Rum Cake - Original", lot_code: "6287", bake_date: TODAY, ...both });
  const r = { lots: [lotRec], baking: [], sealing: [], preops: [], receipts: [], holds: [], releases: [], retention: [], dispatches: [] };
  const lot = T.lotSummaries(r)[0];
  check("the Dunking step sits between Baking and Seal checks", keys(F.flowSteps(r, lot, TODAY, false)).slice(0, 4), ["mixing", "baking", "dunking", "sealing"]);
  check("...and is done from the record", states(F.flowSteps(r, lot, TODAY, false)).dunking, "done");
  check("a page save that completes it moves on", F.advancesAfter("dunking", undefined, F.flowSteps(r, lot, TODAY, false)), true);
  const plain = entry({ product: "Rum Cake - Original", lot_code: "6287", bake_date: TODAY, ingredients: [row("Flour", 17.49)] });
  const r2 = { ...r, lots: [plain] };
  check("a lot with no dunking lines has no Dunking step", keys(F.flowSteps(r2, T.lotSummaries(r2)[0], TODAY, false)).includes("dunking"), false);
  check("dunking is a step the address can name", F.isFlowStep("dunking"), true);
}

// ---- a batch made on site (FRM-530): one batch, no rework
{
  const B = F.BATCH_SPEC;
  const syrup = { ingredients: [row530("Granulated sugar", 20), row530("Water", 10)] };
  check("no batches screen and no rework screen", F.mixScreens(syrup, B).map(s => s.kind === "ingredient" ? `${s.weights.length}:${s.ingredient}` : s.kind), ["1:Granulated sugar", "1:Water"]);
  check("it opens on the first ingredient", F.nextMixScreen(syrup, B), 0);
  check("nothing entered", F.mixProgress(syrup, B), { state: "none", lines: 2, linesDone: 0, batches: 1 });
  const done = { ingredients: [row530("Granulated sugar", 20, "SUG-1", 20.1), row530("Water", 10, "mains", 10)] };
  check("every line in: done, with no rework question", F.mixProgress(done, B).state, "done");
  check("...whereas the lot record would still want its batches and rework", F.mixProgress(done).state, "open");
  check("its weight goes in its one column", F.applyMixEntry(syrup, { index: 0, ingredient: "Granulated sugar", brand: "" }, { batch: 1, weight: 20.2 }, B).ingredients[0].actual_qty, 20.2);
  check("the form's mapping holds without batches, rework or a weights cell", F.checkMixMapping({ sections: [{ fields: [
    { id: "ingredients", columns: ["ingredient", "brand", "supplier_lot", "expected_qty", "unit", "actual_qty"].map(id => ({ id })) },
  ] }] }, B), []);
  check("the batch's date field", B.dateField, "made_on");
  check("the batch page's address", F.batchFlowHref("x y"), "/team/today/batch/x%20y");
  check("no lines: nowhere to open, but no error", F.nextMixScreen({}, B), 0);
}

// ---- another container of an ingredient (owner, 2026-10-23)
{
  const d = { batches: 4, rework: "No rework used", ingredients: [row("Eggs", 13.49, "L1", 13.5, 13.4), row("Sugar", 12, "S1", 12, 12, 12, 12)] };
  const eggs = { index: 0, ingredient: "Eggs", brand: "" };
  const added = F.addMixContainer(d, eggs);
  check("a new line at the end, same ingredient, lot and weights blank", [added.index, added.values.ingredients[2].ingredient, added.values.ingredients[2].supplier_lot, added.values.ingredients[2].weighed_batches, added.values.ingredients[2].expected_qty],
    [2, "Eggs", "", "", 13.49]);
  check("...no other line moves", added.values.ingredients.slice(0, 2), d.ingredients);
  const order = v => F.mixScreens(v).filter(x => x.kind === "ingredient").map(x => [x.index, x.container, x.containers]);
  check("...and it is walked straight after its ingredient", order(added.values), [[0, 1, 2], [2, 2, 2], [1, 1, 1]]);
  const v2 = F.applyMixEntry(F.applyMixEntry(F.applyMixEntry(added.values, { index: 2, ingredient: "Eggs", brand: "" }, { lot: "L2", batch: 3, weight: 13.6 }),
    { index: 2, ingredient: "Eggs", brand: "" }, { batch: 4, weight: 13.5 }), eggs, {});
  const scr = F.mixScreens(v2).filter(x => x.kind === "ingredient");
  check("batches weighed from the other container are named on each line", [scr[0].elsewhere, scr[1].elsewhere], [["", "", "L2", "L2"], ["L1", "L1", "", ""]]);
  check("...so both lines are answered", scr.slice(0, 2).map(x => F.mixScreenDone(v2, x)), [true, true]);
  check("the ingredient counts once, complete across its containers", F.mixProgress(v2), { state: "done", lines: 2, linesDone: 2, batches: 4 });
  check("the second container without its lot leaves the ingredient open",
    F.mixProgress(F.applyMixEntry(added.values, { index: 2, ingredient: "Eggs", brand: "" }, { batch: 3, weight: 13.6 })).linesDone, 1);
  check("an empty line added last can be taken back", F.removeMixLine(added.values, { index: 2, ingredient: "Eggs", brand: "" }).ingredients.length, 2);
  check("...not once it has a lot or a weight", F.removeMixLine(v2, { index: 2, ingredient: "Eggs", brand: "" }), null);
  check("...nor the only line of an ingredient", F.removeMixLine(d, { index: 1, ingredient: "Sugar", brand: "" }), null);
  check("...nor a line that is not last", F.removeMixLine({ ...added.values, ingredients: [...added.values.ingredients, row("Flour", 1)] }, { index: 2, ingredient: "Eggs", brand: "" }), null);
  check("the screen offers taking back only that line", F.mixScreens(added.values).filter(x => x.kind === "ingredient").map(x => x.removable), [false, true, false]);
  check("a tablet that chose the ingredient walks its new container too",
    F.mixScreens(added.values, F.LOT_SPEC, [eggs]).filter(x => x.kind === "ingredient").map(x => x.index), [0, 2]);
  check("a dunking line gets no mixing container", F.addMixContainer({ ingredients: [{ ...row("Rum", ""), _stage: "dunking" }] }, { index: 0, ingredient: "Rum", brand: "" }), null);
}

// ---- several people weighing one lot, split by ingredient (owner, 2026-10-23)
{
  const d = { batches: 3, rework: "", ingredients: [row("Eggs", 17.49, "L1", 17.5, 17.5, 17.5), row("Flour", 12), row("Sugar", 12, "L2", 12), row("Spray", "")] };
  const lines = F.mixLines(d);
  check("the lines that are mixed", lines.map(l => [l.index, l.ingredient]), [[0, "Eggs"], [1, "Flour"], [2, "Sugar"], [3, "Spray"]]);
  const kinds = only => F.mixScreens(d, F.LOT_SPEC, only).map(s => s.kind === "ingredient" ? s.ingredient : s.kind);
  check("this tablet's ingredients only, with the choice and rework", kinds([lines[1], lines[2]]), ["batches", "Flour", "Sugar", "rework"]);
  check("...counted among its own", F.mixScreens(d, F.LOT_SPEC, [lines[1], lines[2]]).filter(s => s.kind === "ingredient").map(s => [s.position, s.of]), [[1, 2], [2, 2]]);
  check("no choice, or an empty one: every ingredient", [kinds(null), kinds([])], [kinds(undefined), kinds(undefined)]);
  check("a chosen line that moved is not walked", kinds([{ index: 1, ingredient: "Sugar", brand: "" }]), ["batches", "rework"]);
  check("opens on its first ingredient not done", F.mixScreens(d, F.LOT_SPEC, [lines[0], lines[2]])[F.nextMixScreen(d, F.LOT_SPEC, [lines[0], lines[2]])].ingredient, "Sugar");
  check("cells: lot, a batch's weight and unit", F.mixEntryCells({ lot: " L7 ", batch: 5, weight: 4.5, unit: "oz" }), { supplier_lot: "L7", weighed_batches: { batch: 5, weight: 4.5 }, unit: "oz" });
  check("cells: a weight cleared", F.mixEntryCells({ batch: 1, weight: "" }), { weighed_batches: { batch: 1, weight: "" } });
  check("cells: no batch 0", F.mixEntryCells({ batch: 0, weight: 1 }), null);
  check("cells: a made-here batch has one weight column", [F.mixEntryCells({ batch: 1, weight: 2 }, F.BATCH_SPEC), F.mixEntryCells({ batch: 2, weight: 2 }, F.BATCH_SPEC)],
    [{ actual_qty: 2 }, null]);
  // The lot, first come first served
  const blank = { batches: 2, ingredients: [row("Flour", 17.49), row("Sugar", 12, "L2")] };
  const fref = { index: 0, ingredient: "Flour", brand: "" };
  check("cells: a lot first come", F.mixEntryCells({ lotIfBlank: " L8 " }), { supplier_lot_if_blank: "L8" });
  check("first come: written while blank", F.applyMixEntry(blank, fref, { lotIfBlank: "L8" }).ingredients[0].supplier_lot, "L8");
  const taken = { batches: 2, ingredients: [row("Flour", 17.49, "L1")] };
  const kept = F.applyMixEntry(taken, fref, { lotIfBlank: "L8", batch: 2, weight: 3 }).ingredients[0];
  check("first come: a lot already there is kept, the weight saved", [kept.supplier_lot, kept.weighed_batches], ["L1", "B2: 3"]);
  check("an edited lot still overwrites", F.applyMixEntry(taken, fref, { lot: "L9" }).ingredients[0].supplier_lot, "L9");
}

// ---- the address
check("the page", [F.lotFlowHref("abc"), F.lotFlowHref("abc", "sealing")], ["/team/today/lot/abc", "/team/today/lot/abc?step=sealing"]);
check("back from a record", F.lotBackQuery("abc", "baking"), "from=lot&lot=abc&step=baking");
check("only a real step is read from the address", [F.isFlowStep("packing"), F.isFlowStep("nonsense"), F.isFlowStep(null)], [true, false, false]);

rmSync(out, { recursive: true, force: true });
console.log(failures ? `${failures} of ${cases} cases failed` : `all ${cases} cases passed`);
process.exit(failures ? 1 : 0);
