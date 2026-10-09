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
  "FRM-520": ["product", "lot_code", "bake_date", "pack_date", "units_packed", "ingredients"],
  "FRM-701": ["product_name", "lot_code", "decision", "release_date"],
  "FRM-801": ["dispatch_date", "customer", "loaded"],
  "FRM-702": ["hold_tag_number", "material_name_description", "supplier_lot_batch_number", "final_disposition_decision"],
  "FRM-301": ["receiving_log"],
  "FRM-507": ["production_date", "oven_loads"],
  "FRM-606": ["production_date", "product", "lot_code"],
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
  check("last receipt", T.lastReceipt(rcp), { date: "2026-10-08", lines: 2, suppliers: ["Sysco"], status: "submitted" });
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

console.log(`${cases - failures}/${cases} passed`);
process.exit(failures ? 1 : 0);
