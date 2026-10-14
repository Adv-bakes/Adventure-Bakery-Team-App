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
const row = (ingredient, expected, lot = "", w1 = "", w2 = "") => ({ ingredient, brand: "", supplier_lot: lot, expected_qty: expected, unit: "lb", actual_qty: w1, actual_qty_2: w2, actual_qty_3: "" });

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
check("more than three batches is read as three", F.mixProgress({ batches: 5, ingredients: [row("Flour", 1)] }).batches, 3);
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

// ---- mixing, one screen at a time
{
  const kinds = d => F.mixScreens(d).map(s => s.kind === "line" ? `${s.batch}:${s.ingredient}` : s.kind);
  const rows = [row("Flour", 17.49), row("", ""), row("Pan spray", ""), row("Sugar", 12)];
  check("until the batches are answered there is only that screen", kinds({ ingredients: rows }), ["batches"]);
  check("batch by batch, then rework; a line not weighed is asked once", kinds({ batches: 2, ingredients: rows }),
    ["batches", "1:Flour", "1:Pan spray", "1:Sugar", "2:Flour", "2:Sugar", "rework"]);
  const s = F.mixScreens({ batches: 2, ingredients: rows });
  check("a line knows its row, blank lines counted", [s[1].index, s[2].index, s[3].index], [0, 2, 3]);
  check("the first batch asks the lot, the second does not", [s[1].asksLot, s[4].asksLot], [true, false]);
  check("a line with no expected quantity need not be weighed", [s[2].needsWeight, s[1].needsWeight], [false, true]);
  check("...and is answered by its lot alone", F.mixScreenDone({}, { ...s[2], lot: "L9" }), true);
  check("...but weighed with the first batch, it is asked again with the second",
    kinds({ batches: 2, ingredients: [row("Flour", 17.49), row("Flavor", "", "L5", 0.4)] }), ["batches", "1:Flour", "1:Flavor", "2:Flour", "2:Flavor", "rework"]);
  check("an optional weight can be taken off again", F.applyMixEntry({ ingredients: [row("Flavor", "", "L5", 0.4)] }, { index: 0, ingredient: "Flavor", brand: "" }, { batch: 1, weight: "" }).ingredients[0].actual_qty, "");
  check("position within the batch", [[s[3].position, s[3].of], [s[5].position, s[5].of]], [[3, 3], [2, 2]]);
  check("the expected figure and unit come from the line", [s[1].expected, s[1].unit], ["17.49", "lb"]);

  check("opens on the batches", F.nextMixScreen({ ingredients: rows }), 0);
  check("then the first ingredient", F.nextMixScreen({ batches: 1, ingredients: rows }), 1);
  const part = { batches: 2, ingredients: [row("Flour", 17.49, "L1", 17.5), row("Sugar", 12, "L2")] };
  check("a lot without its weight is not answered", F.nextMixScreen(part), 2);
  const b1 = { batches: 2, ingredients: [row("Flour", 17.49, "L1", 17.5), row("Sugar", 12, "L2", 12)] };
  check("batch 1 complete: on to batch 2", kinds(b1)[F.nextMixScreen(b1)], "2:Flour");
  const all = { batches: 1, ingredients: [row("Flour", 17.49, "L1", 17.5)] };
  check("every line in: the rework question", kinds(all)[F.nextMixScreen(all)], "rework");
  check("all answered: stays on the last screen", F.nextMixScreen({ ...all, rework: "No rework used" }), 2);

  const v = { batches: 2, product: "Rum Cake", ingredients: [row("Flour", 17.49), row("Sugar", 12, "L2", 12)] };
  const ref = { index: 0, ingredient: "Flour", brand: "" };
  const a = F.applyMixEntry(v, ref, { lot: " L1 ", batch: 1, weight: 17.5 });
  check("a lot and a weight are written on the line", [a.ingredients[0].supplier_lot, a.ingredients[0].actual_qty], ["L1", 17.5]);
  check("nothing else changes", [a.ingredients[1], a.product, a.ingredients[0].expected_qty], [v.ingredients[1], "Rum Cake", 17.49]);
  check("the record handed in is not changed", v.ingredients[0].supplier_lot, "");
  const b = F.applyMixEntry(a, ref, { batch: 2, weight: 17.4 });
  check("batch 2 writes its own column and leaves the lot", [b.ingredients[0].actual_qty_2, b.ingredients[0].actual_qty, b.ingredients[0].supplier_lot], [17.4, 17.5, "L1"]);
  check("a lot alone leaves the weights", F.applyMixEntry(b, ref, { lot: "L9" }).ingredients[0].actual_qty, 17.5);
  const u = F.applyMixEntry({ ingredients: [{ ...row("Flavor", ""), unit: "" }] }, { index: 0, ingredient: "Flavor", brand: "" }, { batch: 1, weight: 4, unit: "oz" });
  check("a unit chosen with the weight is written on the line", [u.ingredients[0].actual_qty, u.ingredients[0].unit], [4, "oz"]);
  check("a unit not named is left as it is", F.applyMixEntry(v, ref, { batch: 1, weight: 1 }).ingredients[0].unit, "lb");
  check("a row that moved is refused", F.applyMixEntry(v, { index: 1, ingredient: "Flour", brand: "" }, { lot: "L1" }), null);
  check("a row that is gone is refused", F.applyMixEntry(v, { index: 5, ingredient: "Flour", brand: "" }, { lot: "L1" }), null);
  check("a brand that changed is refused", F.applyMixEntry(v, { ...ref, brand: "Other" }, { lot: "L1" }), null);
  check("a fourth batch has no column", F.applyMixEntry(v, ref, { batch: 4, weight: 1 }), null);
  check("the page offers one batch per weighed column", F.MIX_BATCH_CHOICES, [1, 2, 3]);

  const col = id => ({ id });
  const schema = { sections: [{ fields: [
    { id: "batches" }, { id: "rework", options: ["No rework used", "Rework used - listed in the table with its original lot code"] },
    { id: "ingredients", columns: ["ingredient", "brand", "supplier_lot", "expected_qty", "unit", "actual_qty", "actual_qty_2", "actual_qty_3"].map(col) },
  ] }] };
  check("the form as it is: nothing missing", F.checkMixMapping(schema), []);
  check("a renamed column is named", F.checkMixMapping({ sections: [{ fields: [{ id: "batches" }, { id: "ingredients", columns: [col("ingredient")] }] }] }).slice(0, 3),
    ["rework", "ingredients.brand", "ingredients.supplier_lot"]);
  check("the no-rework answer in the form's words", F.noReworkOption(schema), "No rework used");
  check("a form whose options changed gives none", F.noReworkOption({ sections: [{ fields: [{ id: "rework", options: ["None", "Yes"] }] }] }), "");
}

// ---- the address
check("the page", [F.lotFlowHref("abc"), F.lotFlowHref("abc", "sealing")], ["/team/today/lot/abc", "/team/today/lot/abc?step=sealing"]);
check("back from a record", F.lotBackQuery("abc", "baking"), "from=lot&lot=abc&step=baking");
check("only a real step is read from the address", [F.isFlowStep("packing"), F.isFlowStep("nonsense"), F.isFlowStep(null)], [true, false, false]);

rmSync(out, { recursive: true, force: true });
console.log(failures ? `${failures} of ${cases} cases failed` : `all ${cases} cases passed`);
process.exit(failures ? 1 : 0);
