// Tests for src/lib/today.ts - the Today page's pure half. The rules that matter: the production
// gate opens only on a SUBMITTED FRM-903 for the day; a lot's stage is derived from the records
// (release decision, dispatch row, FRM-520 status) and a hold is read from FRM-702 even though
// that form has no field for our lot; nothing here comes back quietly wrong on a renamed field.
//
//   node scripts/test-today.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "today-"));
const file = join(out, "today.mjs");
execFileSync("npx", ["esbuild", "src/lib/today.ts", "--bundle", "--format=esm", `--outfile=${file}`],
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

let n = 0;
const entry = (data, status = "submitted", at = "2026-10-08T12:00:00Z") =>
  ({ id: `e${++n}`, docId: "d", status, createdAt: at, submittedAt: status === "submitted" ? at : null, createdBy: "u1", submittedBy: status === "submitted" ? "u1" : null, data });
const TODAY = "2026-10-08";

// ---- mapping check ----
check("mapping: all present", T.checkTodayMapping({
  "FRM-903": ["inspection_date", "shift", "area_line", "released_by"],
  "FRM-520": ["product", "lot_code", "bake_date", "pack_date", "units_packed", "racked_count", "not_packed", "code_check", "batches", "rework", "pack_weight_1", "pack_weight_2", "pack_weight_3", "ingredients"],
  "FRM-701": ["product_name", "lot_code", "decision", "release_date", "customer"],
  "FRM-801": ["dispatch_date", "customer", "loaded"],
  "FRM-702": ["hold_tag_number", "material_name_description", "supplier_lot_batch_number", "final_disposition_decision"],
  "FRM-301": ["receiving_log"],
  "FRM-507": ["production_date", "monitored_by", "oven_loads"],
  "FRM-606": ["production_date", "product", "lot_code", "monitored_by", "seal_checks"],
  "FRM-703": ["product_name", "lot_code", "taken_by", "discard_due"],
}), []);
check("mapping: renamed and missing", T.checkTodayMapping({ "FRM-903": ["inspection_date"] }).slice(0, 2),
  ['FRM-903 no longer has "shift"', 'FRM-903 no longer has "area_line"']);
check("mapping: form missing", T.checkTodayMapping({}).includes("FRM-520 was not found"), true);

// ---- localDay ----
check("localDay pads", T.localDay(new Date(2026, 0, 5)), "2026-01-05");

// ---- start the day / the gate ----
check("preop: none today", T.preopState([entry({ inspection_date: "2026-10-07" })], TODAY), { state: "none" });
const draft903 = entry({ inspection_date: TODAY }, "draft");
check("preop: draft only", T.preopState([draft903], TODAY).state, "draft");
check("gate closed on a draft", T.productionOpen(T.preopState([draft903], TODAY)), false);
const sub903 = entry({ inspection_date: TODAY, released_by: { name: "Diana" } });
check("preop: submitted beats draft", T.preopState([draft903, sub903], TODAY).entry.id, sub903.id);
check("gate open on submitted", T.productionOpen(T.preopState([draft903, sub903], TODAY)), true);
check("gate closed with nothing", T.productionOpen({ state: "none" }), false);
check("preop: yesterday's submission does not open today", T.productionOpen(T.preopState([entry({ inspection_date: "2026-10-07" })], TODAY)), false);

// ---- lots ----
const rec = () => T.emptyTodayRecords();
const lot = (product, lot_code, status = "draft", extra = {}) => entry({ product, lot_code, bake_date: "2026-10-06", ingredients: [], ...extra }, status, "2026-10-06T10:00:00Z");

{
  const r = rec();
  r.lots.push(lot("Rum Cake - Pumpkin Spice", "6279"));
  check("stage: preparing (no ingredient rows)", T.lotSummaries(r)[0].stage, "preparing");
  check("packing: nothing yet", T.lotSummaries(r)[0].packing, { checked: false, counted: false, weighed: false, done: false });
}
{
  // Packing is read from the lot record's own answers; a count of 0 is an answer.
  const p = extra => { const r = rec(); r.lots.push(lot("Rum Cake - Original", "6279", "draft", extra)); return T.lotSummaries(r)[0].packing; };
  check("packing: first pack answered only", p({ code_check: "Matches the lot code above" }), { checked: true, counted: false, weighed: false, done: false });
  check("packing: two counts are not three", p({ racked_count: 480, units_packed: "480" }), { checked: false, counted: false, weighed: false, done: false });
  check("packing: counted, zero not packed", p({ racked_count: 480, units_packed: "480", not_packed: 0 }), { checked: false, counted: true, weighed: false, done: false });
  check("packing: answered and counted, the packs not weighed yet", p({ racked_count: 480, units_packed: "480", not_packed: 0, code_check: "Did not match - held on FRM-702" }), { checked: true, counted: true, weighed: false, done: false });
  check("packing: two weights are not three", p({ pack_weight_1: 162, pack_weight_2: 163 }).weighed, false);
  check("packing: done", p({ racked_count: 480, units_packed: "480", not_packed: 0, code_check: "Matches the lot code above", pack_weight_1: 162, pack_weight_2: 163, pack_weight_3: 170 }), { checked: true, counted: true, weighed: true, done: true });
}
{
  const r = rec();
  r.lots.push(lot("Rum Cake - Original", "6279", "draft", { ingredients: [{ ingredient: "Soybean oil" }] }));
  check("stage: in progress (rows)", T.lotSummaries(r)[0].stage, "in_progress");
}
{
  const r = rec();
  r.lots.push(lot("Rum Cake - Original", "6279", "submitted"));
  check("stage: awaiting release (FRM-520 submitted, no FRM-701)", T.lotSummaries(r)[0].stage, "awaiting_release");
  r.releases.push(entry({ product_name: "Rum Cake - Original", lot_code: "6279", decision: "RELEASED — may be shipped" }, "draft"));
  check("a draft release does not release", T.lotSummaries(r)[0].stage, "awaiting_release");
  r.releases.push(entry({ product_name: "rum cake - original", lot_code: "6279", decision: "RELEASED — may be shipped" }));
  check("stage: released (submitted FRM-701, case-insensitive product)", T.lotSummaries(r)[0].stage, "released");
  r.dispatches.push(entry({ dispatch_date: "2026-10-08", customer: "Brand A", loaded: [{ product: "Rum Cake - Original", lot_code: "6279" }] }, "draft"));
  check("a draft dispatch does not ship", T.lotSummaries(r)[0].stage, "released");
  r.dispatches.push(entry({ dispatch_date: "2026-10-08", customer: "Brand A", loaded: [{ product: "Rum Cake - Original", lot_code: "6-279" }] }));
  check("stage: shipped (lot compared normalised)", T.lotSummaries(r)[0].stage, "shipped");
  check("shipped lots leave the in-progress list", T.lotsInProgress(r).length, 0);
  // A second record started for the same product and code, still a draft: it is work in hand.
  r.lots.push(lot("Rum Cake - Original", "6279", "draft", { ingredients: [{ ingredient: "Soybean oil" }] }));
  const second = T.lotSummaries(r).find(l => l.status === "draft");
  check("a draft lot record is never released or shipped by another record's release", second.stage, "in_progress");
  check("...so it stays on the page, and the shipped one stays off", T.lotsInProgress(r).map(l => l.status), ["draft"]);
  r.lots.push(lot("Rum Cake - Original", "6279", "draft"));
  check("...and with no ingredients yet it is being prepared", T.lotSummaries(r).filter(l => l.stage === "preparing").length, 1);
}
{
  const r = rec();
  r.lots.push(lot("Rum Cake - Original", "6279", "submitted"));
  r.releases.push(entry({ product_name: "Rum Cake - Original", lot_code: "6279", decision: "NOT RELEASED — placed on Hold under FSQM-018" }));
  check("stage: not released", T.lotSummaries(r)[0].stage, "not_released");
}
{
  // Two products baked the same day share a code: a release of one must not release the other.
  const r = rec();
  r.lots.push(lot("Rum Cake - Original", "6279", "submitted"));
  r.lots.push(lot("Coconut Rum Cake", "6279", "submitted"));
  r.releases.push(entry({ product_name: "Coconut Rum Cake", lot_code: "6279", decision: "RELEASED" }));
  const s = T.lotSummaries(r);
  check("same code, different product: only the released one is released",
    s.map(l => `${l.product}:${l.stage}`), ["Coconut Rum Cake:released", "Rum Cake - Original:awaiting_release"]);
}
{
  const r = rec();
  r.lots.push(lot("Rum Cake - Original", "6279"));
  r.holds.push(entry({ hold_tag_number: "H-1", material_name_description: "Rum Cake - Original lot 6279", supplier_lot_batch_number: "", final_disposition_decision: "" }, "draft"));
  check("hold read from the description", T.lotSummaries(r)[0].onHold, true);
  r.holds[0].data.final_disposition_decision = "Released";
  check("a disposed hold no longer applies", T.lotSummaries(r)[0].onHold, false);
  r.holds.push(entry({ hold_tag_number: "H-2", material_name_description: "Rum Cake - Original", supplier_lot_batch_number: "6279", final_disposition_decision: "" }));
  check("hold read from the supplier-lot field", T.lotSummaries(r)[0].onHold, true);
  r.holds.push(entry({ hold_tag_number: "H-3", material_name_description: "Soybean oil", supplier_lot_batch_number: "6279", final_disposition_decision: "" }));
  check("open holds counted", T.openHolds(r.holds).map(h => h.data.hold_tag_number).sort(), ["H-2", "H-3"]);
}
{
  const r = rec();
  r.lots.push(lot("B", "6270", "draft", { bake_date: "2026-09-27" }));
  r.lots.push(lot("A", "6279", "draft", { bake_date: "2026-10-06" }));
  check("newest bake date first", T.lotSummaries(r).map(l => l.lotCode), ["6279", "6270"]);
}

// ---- dispatches, receipts, CCP ----
{
  const d = [
    entry({ dispatch_date: "2026-10-01", customer: "Brand A", loaded: [{ product: "X", lot_code: "6270" }, { product: "X", lot_code: "6270" }, { product: "Y", lot_code: "6270" }] }),
    entry({ dispatch_date: "2026-09-17", customer: "Brand B", loaded: [] }, "draft"),
  ];
  check("last dispatch by date, lots = distinct product+code", T.lastDispatch(d), { date: "2026-10-01", customer: "Brand A", lots: 2, status: "submitted" });
  check("no dispatches", T.lastDispatch([]), null);
}
{
  const rcp = [
    entry({ receiving_log: [{ supplier_name: "Sysco", material_description: "Oil" }, { supplier_name: "Sysco", material_description: "Eggs" }, { supplier_name: "", material_description: "" }] }, "submitted", "2026-10-08T09:00:00Z"),
    entry({ receiving_log: [{ supplier_name: "RD", material_description: "Mix" }] }, "submitted", "2026-10-02T09:00:00Z"),
  ];
  check("last receipt", (({ id, docId, ...r }) => r)(T.lastReceipt(rcp)), { date: "2026-10-08", lines: 2, suppliers: ["Sysco"], status: "submitted" });
  {
    const R = (id, createdAt, status = "submitted") => ({ id, docId: "d301", status, createdAt, submittedAt: null, createdBy: null, submittedBy: null, data: { receiving_log: [{ supplier_name: "Sysco" }] } });
    const ids = (list, today) => T.recentReceipts(list, today).map(r => r.id);
    const list = [R("old", "2026-10-01T12:00:00Z"), R("yday", "2026-10-11T12:00:00Z"), R("am", "2026-10-12T12:00:00Z"), R("pm", "2026-10-12T16:00:00Z", "draft")];
    check("receipts of today and yesterday, newest first", ids(list, "2026-10-12"), ["pm", "am", "yday"]);
    check("with nothing recent, the last one is still linked", ids([R("old", "2026-10-01T12:00:00Z"), R("older", "2026-09-20T12:00:00Z")], "2026-10-12"), ["old"]);
    check("none yet", ids([], "2026-10-12"), []);
    check("a link carries the entry and its status", (({ id, docId, status }) => [id, docId, status])(T.recentReceipts(list, "2026-10-12")[0]), ["pm", "d301", "draft"]);
    check("yesterday across a month end", ids([R("a", "2026-09-30T12:00:00Z"), R("b", "2026-10-01T12:00:00Z")], "2026-10-01"), ["b", "a"]);
  }
}
{
  const r = rec();
  r.baking.push(entry({ production_date: TODAY, product: "Rum Cake", oven_loads: [{ lot_code: "6281" }, { lot_code: "" }] }, "draft"));
  r.baking.push(entry({ production_date: "2026-10-07", product: "Rum Cake", oven_loads: [{ lot_code: "6280" }] }, "draft"));
  r.sealing.push(entry({ production_date: TODAY, product: "Rum Cake", lot_code: "6281" }, "draft"));
  const c = T.ccpToday(r, TODAY);
  check("ccp today: today's baking record", c.baking.data.oven_loads.length, 2);
  check("ccp today: oven loads with a lot", T.ovenLoads(c.baking), 1);
  check("ccp today: sealing entries", c.sealing.length, 1);
  check("ccp today: none", T.ccpToday(rec(), TODAY), { baking: null, sealing: [] });

  // Baking done, read from the Last load marks (FRM-507 v3). Two flavors share the day's code.
  const PS = "Rum Cake - Pumpkin Spice", OR = "Rum Cake - Original";
  const B = "Last load of this batch", L = "Last load of this lot";
  const bake = (loads, status = "draft", extra = {}) => { const b = rec(); b.baking.push(entry({ production_date: TODAY, oven_loads: loads, ...extra }, status)); return b; };
  const open = bake([{ product: PS, lot_code: "6281" }, { product: OR, lot_code: "6281" }, { product: PS, lot_code: "6281" }]);
  check("bake state: loads counted per flavor", [T.bakeState(open, TODAY, PS, "6281"), T.bakeState(open, TODAY, OR, "6281")], [{ loads: 2, done: "open" }, { loads: 1, done: "open" }]);
  check("bake state: nothing recorded", T.bakeState(rec(), TODAY, PS, "6281"), { loads: 0, done: "open" });
  const one = bake([{ product: PS, lot_code: "6281", last_load: B }, { product: OR, lot_code: "6281" }]);
  check("bake state: one flavor finished, the other not", [T.bakeState(one, TODAY, PS, "6281").done, T.bakeState(one, TODAY, OR, "6281").done], ["batch", "open"]);
  const all = bake([{ product: PS, lot_code: "6281", last_load: B }, { product: OR, lot_code: "62-81", last_load: L }], "draft", { monitored_by: { name: "Tina P", signed_at: "x" } });
  check("bake state: the last load of the lot finishes every flavor of that code", [T.bakeState(all, TODAY, PS, "6281").done, T.bakeState(all, TODAY, OR, "6281").done], ["lot", "lot"]);
  check("bake state: another lot code is not finished by it", T.bakeState(all, TODAY, PS, "6282"), { loads: 0, done: "open" });
  const yesterday = rec(); yesterday.baking.push(entry({ production_date: "2026-10-07", oven_loads: [{ product: PS, lot_code: "6281", last_load: L }] }, "draft"));
  check("bake state: another day's record does not count", T.bakeState(yesterday, TODAY, PS, "6281"), { loads: 0, done: "open" });
  const two = rec();
  two.baking.push(entry({ production_date: TODAY, oven_loads: [{ product: PS, lot_code: "6281" }] }, "draft"));
  two.baking.push(entry({ production_date: TODAY, oven_loads: [{ product: PS, lot_code: "6281", last_load: B }] }, "submitted"));
  check("bake state: read across every record of the day", T.bakeState(two, TODAY, PS, "6281"), { loads: 2, done: "batch" });
  check("awaiting review: last of the lot and signed", T.bakingAwaitingReview(all, TODAY), { by: "Tina P" });
  check("awaiting review: not while only a batch is finished", T.bakingAwaitingReview(one, TODAY), null);
  check("awaiting review: not without the operator's signature", T.bakingAwaitingReview(bake([{ product: PS, lot_code: "6281", last_load: L }]), TODAY), null);
  // Seal checks: one record per batch, the same two marks in its Last check column.
  const SB = "Last check of this batch", SL = "Last check of this lot";
  const seal = (...entries) => { const b = rec(); for (const [product, checks, status, extra] of entries) b.sealing.push(entry({ production_date: TODAY, product, lot_code: "6281", seal_checks: checks, ...(extra ?? {}) }, status ?? "draft")); return b; };
  const sOpen = seal([PS, [{ check: "Set-up" }, { check: "In process" }, { check: "" }]], [OR, [{ check: "Set-up" }]]);
  check("seal state: checks counted per batch, blank rows not", [T.sealState(sOpen, TODAY, PS, "6281"), T.sealState(sOpen, TODAY, OR, "6281")], [{ loads: 2, done: "open" }, { loads: 1, done: "open" }]);
  const sOne = seal([PS, [{ check: "End of run", last_check: SB }]], [OR, [{ check: "Set-up" }]]);
  check("seal state: one batch finished, the other not", [T.sealState(sOne, TODAY, PS, "6281").done, T.sealState(sOne, TODAY, OR, "6281").done], ["batch", "open"]);
  const sAll = seal([PS, [{ check: "End of run", last_check: SB }]], [OR, [{ check: "At boxing", last_check: SL }], "draft", { monitored_by: { name: "Tina P" } }]);
  check("seal state: the last check of the lot finishes every batch of that code", [T.sealState(sAll, TODAY, PS, "6281").done, T.sealState(sAll, TODAY, OR, "6281").done], ["lot", "lot"]);
  check("seal state: another lot code, and no record at all", [T.sealState(sAll, TODAY, PS, "6282"), T.sealState(rec(), TODAY, PS, "6281")], [{ loads: 0, done: "open" }, { loads: 0, done: "open" }]);
  check("seal awaiting review: last of the lot and signed", T.sealingAwaitingReview(sAll, TODAY), { by: "Tina P" });
  check("seal awaiting review: not while only a batch is finished", T.sealingAwaitingReview(sOne, TODAY), null);

  check("awaiting review: not once submitted", T.bakingAwaitingReview(bake([{ product: PS, lot_code: "6281", last_load: L }], "submitted", { monitored_by: { name: "Tina P" } }), TODAY), null);
}

// ---- attention ----
check("attention counts", T.attentionCounts([
  { severity: "overdue", notification_type: "verification_due", assigned_to: null },
  { severity: "due", notification_type: "verification_due", assigned_to: null },
  { severity: "alert", notification_type: "temperature_alert", assigned_to: null },
  { severity: "info", notification_type: "signature_requested", assigned_to: "me" },
  { severity: "info", notification_type: "signature_requested", assigned_to: "someone" },
  { severity: "info", notification_type: "signature_signed", assigned_to: "me" },
], "me"), { overdue: 1, due: 1, askedOfMe: 1, alerts: 1 });

// ---- the steps before a release, in order ----
{
  const P = "Rum Cake - Pumpkin Spice", O = "Rum Cake - Original";
  const r = rec();
  r.lots.push(lot(P, "6279", "submitted"));
  const mine = () => T.lotSummaries(r).find(l => l.product === P);
  const states = () => T.releaseSteps(r, mine()).map(s => `${s.key}:${s.state}`);
  check("steps: only the lot record exists", states(), ["lot:done", "baking:none", "sealing:none", "retention:none", "release:none"]);
  // The day's baking record carries both flavors; this lot's loads are the ones that count.
  r.baking.push(entry({ production_date: "2026-10-06", oven_loads: [{ product: O, lot_code: "6279" }, { product: P, lot_code: "6279" }] }, "draft"));
  r.baking.push(entry({ production_date: "2026-10-05", oven_loads: [{ product: P, lot_code: "6278" }] }));
  r.sealing.push(entry({ production_date: "2026-10-06", product: P, lot_code: "6279" }));
  r.sealing.push(entry({ production_date: "2026-10-06", product: O, lot_code: "6279" }, "draft"));
  check("steps: the baking record is a draft, this lot's seal record is submitted", states().slice(1, 3), ["baking:open", "sealing:done"]);
  check("steps: the baking step opens that day's record", T.releaseSteps(r, mine())[1].entryId, r.baking[0].id);
  r.baking[0].status = "submitted";
  r.sealing.push(entry({ production_date: "2026-10-07", product: P, lot_code: "6279" }, "draft"));
  check("steps: a second seal record still a draft is the one to open", [states()[2], T.releaseSteps(r, mine())[2].entryId], ["sealing:open", r.sealing[2].id]);
  r.retention.push(entry({ product_name: O, lot_code: "6279" }));
  check("steps: another product's retention sample is not this lot's", states()[3], "retention:none");
  // FRM-703 stays a DRAFT while the sample is on the shelf: signed "Sample taken by" is what logs it.
  const sample = () => T.releaseSteps(r, mine())[3];
  r.retention.push(entry({ product_name: P, lot_code: "6279", taken_by: null, discard_due: "" }, "draft"));
  check("retention: started, not signed yet", [sample().state, sample().sample], ["open", { stage: "started", discardDue: "" }]);
  r.retention[1].data.taken_by = { name: "Diana Lopez", signed_at: "2026-10-10T15:00:00Z" };
  r.retention[1].data.discard_due = "2027-11-30";
  check("retention: signed draft = on the shelf, and done for the release", [sample().state, sample().sample], ["done", { stage: "on_shelf", discardDue: "2027-11-30" }]);
  r.retention.push(entry({ product_name: P, lot_code: "6279", taken_by: null }, "draft"));
  check("retention: a second record only started does not hide the one on the shelf", [sample().sample.stage, sample().entryId], ["on_shelf", r.retention[1].id]);
  r.retention.pop();
  r.releases.push(entry({ product_name: P, lot_code: "6279", decision: "" }, "draft"));
  check("steps: sample logged, release started", states(), ["lot:done", "baking:done", "sealing:open", "retention:done", "release:open"]);
  r.retention[1].status = "submitted";
  check("retention: submitted = disposed of, still done", [sample().state, sample().sample.stage], ["done", "disposed"]);
  check("steps: a load with no product named is counted for the lot", (() => {
    const q = rec(); q.lots.push(lot(P, "6279", "submitted")); q.baking.push(entry({ production_date: "2026-10-06", oven_loads: [{ lot_code: "6279" }] }));
    return T.releaseSteps(q, T.lotSummaries(q)[0])[1].state; })(), "done");
}

// ---- a finished lot's records, to open and read
{
  const r = T.emptyTodayRecords();
  const e = (kind, data, status = "submitted") => { const x = entry(data, status); x.docId = "doc-" + kind; r[kind].push(x); return x; };
  const lotE = e("lots", { product: "Rum Cake - Original", lot_code: "6285", bake_date: "2026-10-12", ingredients: [{ ingredient: "Flour" }] });
  e("baking", { production_date: "2026-10-12", oven_loads: [{ product: "Rum Cake - Original", lot_code: "6285" }] });
  e("retention", { product_name: "Rum Cake - Original", lot_code: "6285", taken_by: { signed_at: "2026-10-12T16:00:00Z" }, discard_due: "2027-11-30" }, "draft");
  const rel = e("releases", { product_name: "Rum Cake - Original", lot_code: "6285", decision: "RELEASED" });
  const lot = T.lotSummaries(r)[0];
  const lines = T.lotRecords(r, lot);
  check("the records in the order they were made, no dispatch yet", lines.map(l => [l.key, l.state]), [["lot", "done"], ["baking", "done"], ["sealing", "none"], ["retention", "done"], ["release", "done"]]);
  check("each line that has a record says which to open", [lines[0].entryId === lotE.id, lines[4].entryId === rel.id, lines[2].entryId ?? null, lines[3].sample.stage], [true, true, null, "on_shelf"]);
  const d = e("dispatches", { dispatch_date: "2026-10-13", customer: "Brand A", loaded: [{ product: "Rum Cake - Original", lot_code: "6285" }] }, "draft");
  check("a dispatch being prepared is listed as a draft", T.lotRecords(r, lot).slice(-1).map(l => [l.key, l.state, l.entryId === d.id]), [["dispatch", "open", true]]);
  e("dispatches", { dispatch_date: "2026-10-13", customer: "Brand B", loaded: [{ product: "Rum Cake - Pumpkin Spice", lot_code: "6285" }] });
  check("another product's dispatch on the same code is not this lot's", T.lotRecords(r, lot).filter(l => l.key === "dispatch").length, 1);
}

// ---- a released lot's collection: the dispatch's loaded table
{
  const lot = { product: "Rum Cake - Pumpkin Spice", lotCode: "6285" };
  check("a new dispatch starts with the lot, released", T.loadedWithLot([], lot), { rows: [{ quantity: "", product: "Rum Cake - Pumpkin Spice", lot_code: "6285", released: "pass" }], added: true });
  check("the blank seeded line is used", T.loadedWithLot([{ product: "", lot_code: "", quantity: "", released: "" }], lot).rows, [{ product: "Rum Cake - Pumpkin Spice", lot_code: "6285", quantity: "", released: "pass" }]);
  const two = T.loadedWithLot([{ product: "Rum Cake - Original", lot_code: "6285", quantity: "40 cases", released: "pass" }], lot);
  check("a second lot is added after the first", [two.added, two.rows.length, two.rows[0].quantity, two.rows[1].lot_code], [true, 2, "40 cases", "6285"]);
  check("a lot already on the table is not added twice", T.loadedWithLot(two.rows, lot).added, false);
  check("...however its code is written", T.loadedWithLot([{ product: "rum cake pumpkin spice", lot_code: " 6285 ", released: "pass" }], lot).added, false);
  const given = [{ product: "", lot_code: "" }];
  T.loadedWithLot(given, lot);
  check("the table handed in is not changed", given, [{ product: "", lot_code: "" }]);
}

console.log(`${cases - failures}/${cases} passed`);
process.exit(failures ? 1 : 0);
