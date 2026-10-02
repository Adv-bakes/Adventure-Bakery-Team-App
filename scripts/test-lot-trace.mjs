// Tests for src/lib/lotTrace.ts - the lot trace behind the Traceability page and FRM-012's recall
// workspace. A trace that silently misses a lot is the failure a recall cannot afford, so these
// cover the ways records fail to line up: spelling of a lot code, two products sharing a code, a
// draft nobody submitted, a receipt that was never logged, quantities that cannot be added, and a
// form whose field ids have moved.
//
//   node scripts/test-lot-trace.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "lottrace-"));
const file = join(out, "lotTrace.mjs");
execFileSync("npx", ["esbuild", "src/lib/lotTrace.ts", "--bundle", "--format=esm", `--outfile=${file}`],
  { stdio: ["ignore", "ignore", "inherit"], shell: true });
const T = await import("file://" + file.replace(/\\/g, "/"));

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) return;
  failures++;
  console.error(`FAIL  ${name}\n        expected ${e}\n        actual   ${a}`);
}
const ok = (name, cond) => { if (!cond) { failures++; console.error(`FAIL  ${name}`); } };

let n = 0;
const entry = (data, status = "submitted", date = "2026-09-30T15:00:00Z") => ({ id: `e${++n}`, docId: "doc", status, date, data });

// ---- fixture: the soybean oil scenario ----
const records = {
  lots: [
    entry({ product: "Rum Cake Original", lot_code: "6273", bake_date: "2026-09-30", units_packed: "120 units", film_lot: "F-88",
      ingredients: [
        { ingredient: "Soybean Oil", brand: "Sysco", supplier_lot: "SO-4471 A" },
        { ingredient: "Liquid Eggs", brand: "RD", supplier_lot: "EG22" },
        { ingredient: "Pan spray", brand: "", supplier_lot: "" },
      ] }),
    entry({ product: "Coconut Rum Cake", lot_code: "6273", bake_date: "2026-09-30", units_packed: "60 units", film_lot: "",
      ingredients: [{ ingredient: "Soybean Oil", supplier_lot: "so4471a" }, { ingredient: "Coconut flavor", supplier_lot: "CF1" }] }),
    entry({ product: "Rum Cake Original", lot_code: "6280", bake_date: "2026-10-07", units_packed: "100 units",
      ingredients: [{ ingredient: "Soybean Oil", supplier_lot: "SO-9999" }] }, "draft"),
  ],
  receipts: [
    entry({ receiving_log: [
      { supplier_name: "Sysco", material_description: "Soybean oil 35 lb", lot_batch_number: "SO-4471A", qty_received: 4 },
      { supplier_name: "RD", material_description: "Liquid eggs", lot_batch_number: "EG22", qty_received: 2 },
    ] }, "submitted", "2026-09-20T12:00:00Z"),
  ],
  dispatches: [
    entry({ dispatch_date: "2026-10-01", customer: "Island Treats LLC", loaded: [
      { product: "Rum Cake Original", lot_code: "6273", quantity: "80 units" },
      { product: "Coconut Rum Cake", lot_code: "6273", quantity: "60 units" },
    ] }),
    entry({ dispatch_date: "2026-10-02", customer: "Gift Co", loaded: [{ product: "Rum cake original", lot_code: "6273", quantity: "3 cases" }] }),
  ],
  retention: [entry({ product_name: "Rum Cake Original", lot_code: "6273", customer: "Island Treats LLC", units_retained: 1, storage_location: "Shelf A", disposition: "" })],
  releases: [entry({ product_name: "Rum Cake Original", lot_code: "6273", quantity_released: "120", customer: "Island Treats LLC", decision: "Released" })],
  holds: [entry({ hold_tag_number: "H-7", material_name_description: "Soybean oil", supplier_lot_batch_number: "SO-4471A", total_quantity_placed_on_hold: "1 pail" })],
  contacts: [
    entry({ reviewed_on: "2026-09-01", contacts: [
      { _label: "SQFI", group: "SQF", email: "foodsafetycrisis@sqfi.com" },
      { _label: "FDA", group: "Authority", phone: "1" },
      { _label: "Island Treats", group: "Customer (brand owner)", name: "Ana", phone: "555" },
      { _label: "Landlord", group: "Utility / landlord" },
    ] }, "submitted", "2026-09-01T00:00:00Z"),
    entry({ reviewed_on: "2026-09-15", contacts: [] }, "draft", "2026-09-15T00:00:00Z"),
  ],
};

// ---- normalising, quantities ----
check("normLot", [T.normLot("L-123 a"), T.normLot(" l123A "), T.normLot(null)], ["L123A", "L123A", ""]);
ok("namesMatch contains", T.namesMatch("Island Treats LLC", "island treats") && T.namesMatch("", "x") && !T.namesMatch("Gift Co", "Island Treats"));
check("parseQty", [T.parseQty("12 cases"), T.parseQty("120"), T.parseQty("a few")], [{ n: 12, unit: "case" }, { n: 120, unit: "" }, null]);
check("sumQty same unit", T.sumQty(["80 units", "20 unit"]), "100 unit");
check("sumQty mixed units", T.sumQty(["80 units", "3 cases"]), null);
check("sumQty unreadable", T.sumQty(["80", ""]), null);

// ---- material start: soybean oil lot, spelled differently from every record ----
const m = T.runTrace(records, { kind: "material", lot: "so 4471-a", name: "Soybean Oil" });
check("material: both products that used the lot", m.lots.map(l => `${l.lotCode} ${l.product}`), ["6273 Rum Cake Original", "6273 Coconut Rum Cake"]);
const orig = m.lots[0], coco = m.lots[1];
check("trigger row marked", orig.inputs.filter(i => i.trigger).map(i => i.ingredient), ["Soybean Oil"]);
check("receipt found across spellings", orig.inputs[0].receipts.map(r => r.supplier), ["Sysco"]);
check("film lot is an input", orig.inputs.at(-1).supplierLot, "F-88");
check("dispatches by product, not just code", orig.dispatches.map(d => `${d.customer}:${d.quantity}`), ["Island Treats LLC:80 units", "Gift Co:3 cases"]);
check("other product's dispatch stays with its lot", coco.dispatches.map(d => d.quantity), ["60 units"]);
check("retention + release found", [orig.retention.length, orig.releases.length, coco.retention.length], [1, 1, 0]);
check("material receipts", m.materialReceipts.map(r => r.date), ["2026-09-20"]);
check("a sibling product on the same code is another lot, not a mismatch", [orig.otherProduct.length, coco.otherProduct.length], [0, 0]);
check("hold on the supplier lot", m.holds.map(h => h.tag), ["H-7"]);
check("contact matched / unmatched", m.customers.map(c => [c.customer, c.matched, c.rows.length]), [["Island Treats LLC", true, 1], ["Gift Co", false, 1]]);
check("essential contacts", m.essential.map(r => r.label), ["SQFI", "FDA"]);
check("submitted contact list preferred over newer draft", m.contactList.reviewedOn, "2026-09-01");
const gap = re => m.gaps.some(g => re.test(g));
ok("gap: no supplier lot for pan spray", gap(/no supplier lot recorded for Pan spray/));
ok("gap: missing receipts are one line per lot", gap(/6273 Rum Cake Original: no FRM-301 receipt for 1 of 3 supplier lots - Film \/ bag \(F-88\)/));
check("gap: one receipt line per lot", m.gaps.filter(g => /no FRM-301 receipt/.test(g)).length, 2);
ok("gap: quantities cannot be added", gap(/cannot be added up \(80 units, 3 cases\)/));
ok("gap: coconut has no retention sample", gap(/6273 Coconut Rum Cake: no retention sample/));
ok("gap: no contact for Gift Co", gap(/No contact for Gift Co/));
ok("no draft gap when no draft is involved", !gap(/drafts/));

// ---- lot start ----
const both = T.runTrace(records, { kind: "lot", lot: "6273" });
check("lot code alone: every product with the code", both.lots.length, 2);
const one = T.runTrace(records, { kind: "lot", lot: "6273", name: "Coconut Rum Cake" });
check("lot + product: just that lot", one.lots.map(l => l.product), ["Coconut Rum Cake"]);
ok("the other product is named, not hidden", one.gaps.some(g => /also on: Rum Cake Original/.test(g)));
const draft = T.runTrace(records, { kind: "lot", lot: "6280" });
ok("draft record included and flagged", draft.lots[0].records[0].draft && draft.gaps.some(g => /drafts that were never submitted/.test(g)));
ok("never dispatched", draft.gaps.some(g => /no dispatch on FRM-801/.test(g)));
const none = T.runTrace(records, { kind: "lot", lot: "5001", name: "Old cake" });
ok("no FRM-520: still a card, and says inputs cannot be traced", none.lots.length === 1 && none.gaps.some(g => /No Production Lot Record/.test(g)));
check("unknown material", T.runTrace(records, { kind: "material", lot: "ZZZ" }).lots.length, 0);
check("blank start", T.runTrace(records, { kind: "lot", lot: " " }).lots.length, 0);

// same code, product name that does not match -> shown under otherProduct
const odd = { ...records, dispatches: [...records.dispatches, entry({ dispatch_date: "2026-10-03", customer: "X", loaded: [{ product: "Banana Bread", lot_code: "6280", quantity: "5" }] })] };
check("mismatched product kept as 'check this'", T.runTrace(odd, { kind: "lot", lot: "6280" }).lots[0].otherProduct.length, 1);

// "no lot" (mains water) is not a missing receipt
const water = { ...records, lots: [entry({ product: "W", lot_code: "7001", ingredients: [{ ingredient: "Water", supplier_lot: "City water - no lot" }] })] };
ok("water without a lot raises no receipt gap", !T.runTrace(water, { kind: "lot", lot: "7001" }).gaps.some(g => /receipt/.test(g)));

// unreadable entries are counted
const old = { ...records, lots: [...records.lots, entry({ lot_code: null, ingredients: null })] };
ok("older-layout entries reported", T.runTrace(old, { kind: "lot", lot: "6273" }).gaps.some(g => /1 FRM-520 record\(s\) could not be read/.test(g)));

// ---- start options ----
const opts = T.startOptions(records);
ok("options dedupe across spellings", opts.filter(o => o.kind === "material" && T.normLot(o.lot) === "SO4471A" && /soybean oil$/i.test(o.name)).length === 1);
ok("lot options carry the product", opts.some(o => o.kind === "lot" && o.label === "Coconut Rum Cake - lot 6273"));

// ---- filling FRM-012 ----
const fill = T.toRecordFill(m);
check("fill: header", [fill.trigger, fill.material, fill.material_lot, fill.material_supplier, fill.lot_codes, fill.product],
  ["An ingredient or packaging lot", "Soybean Oil", "so 4471-a", "Sysco", "6273", "Rum Cake Original, Coconut Rum Cake"]);
check("fill: brand owners", fill.brand_owner, "Island Treats LLC, Gift Co");
const tb = fill.trace_back.find(r => r.ingredient === "Soybean Oil" && r.finished_lot === "6273");
check("fill: trace back row", [tb.supplier, tb.received, tb.found, typeof tb._src], ["Sysco", "2026-09-20", "Found", "string"]);
ok("fill: a missing receipt is 'Not found'", fill.trace_back.some(r => r.ingredient === "Film / bag" && r.found === "Not found"));
check("fill: forward rows", fill.trace_forward.length, 3);
const rec = fill.reconciliation[0];
check("fill: reconciliation leaves the physical counts blank", [rec.packed, rec.collected, rec.on_site, rec.retained, rec.unaccounted], ["120 units", "80 units + 3 cases", "", "1", ""]);
check("fill: coconut collected sums", fill.reconciliation[1].collected, "60 unit");
check("fill: empty trace keeps one blank row", T.toRecordFill(T.runTrace(records, { kind: "material", lot: "ZZZ" })).trace_back, [{}]);

// ---- mapping check ----
const fld = (id, extra = {}) => ({ id, type: "text", ...extra });
const schemaFor = spec => ({ sections: [{ fields: [
  ...spec.fields.map(id => fld(id)),
  ...Object.entries(spec.grids).map(([id, cols]) => ({ id, type: "grid", columns: cols.map(c => ({ id: c })) })),
] }] });
const schemas = Object.fromEntries(Object.values(T.TRACE_FORMS).map(s => [s.form, schemaFor(s)]));
check("mapping: clean (source forms only)", T.checkTraceMapping(schemas, false), []);
ok("mapping: FRM-012 missing is reported", T.checkTraceMapping(schemas).some(p => /FRM-012 was not found/.test(p)));
const broken = { ...schemas, "FRM-801": { sections: [{ fields: [fld("dispatch_date"), fld("customer"), { id: "loaded", type: "grid", columns: [{ id: "product" }] }] }] }, "FRM-703": undefined };
const probs = T.checkTraceMapping(broken, false);
ok("mapping: a moved column is named", probs.some(p => /FRM-801 table "loaded" no longer has the column "lot_code"/.test(p)));
ok("mapping: a missing form is named", probs.some(p => /FRM-703 was not found/.test(p)));

// ---- steps ----
const ids = (v, pred) => T.deriveRecallSteps(v).filter(pred).map(s => s.id);
check("mock: decide and recover do not apply", ids({ record_type: "Mock recall test" }, s => !s.applies), ["decide", "recover"]);
check("real: every step applies", ids({ record_type: "Recall" }, s => !s.applies), []);
check("nothing done on a blank record", ids({ record_type: "Recall", trace_back: [{}], notifications: [{}], reconciliation: [{}] }, s => s.done), []);
check("trace needs rows AND a completed time", ids({ trace_back: [{ ingredient: "x" }] }, s => s.done), []);
check("mock progress", ids({ record_type: "Mock recall test", hold_ref: "Nothing on site", trace_back: [{ ingredient: "x" }], completed: "2026-10-01T10:00",
  contacts_checked: "Checked - current", reconciliation: [{ packed: "10", unaccounted: "0" }], gaps: "None" }, s => s.done), ["hold", "trace", "notify", "reconcile", "capa"]);
check("real progress", ids({ record_type: "Recall", decision: "Recall", notifications: [{ who: "SQFI" }], recovered: "40 units", capa_no: "C-1",
  closed_by: { name: "A" }, reconciliation: [{ packed: "10", unaccounted: "" }] }, s => s.done), ["decide", "notify", "recover", "capa", "close"]);
check("a row holding only _src is not a started row", ids({ trace_back: [{ _src: "a/b" }], completed: "2026-10-01T10:00" }, s => s.done), []);

// ---- clocks ----
const at = (h, mi = 0) => new Date(2026, 9, 1, h, mi);
const c1 = T.clockState("2026-10-01T08:00", T.TRACE_TARGET_MS, at(10, 14));
check("running clock", [c1.state, T.formatDuration(c1.elapsedMs), T.formatDuration(c1.remainingMs)], ["running", "2 h 14 min", "1 h 46 min"]);
check("over", T.clockState("2026-10-01T08:00", T.TRACE_TARGET_MS, at(13)).state, "over");
check("met when stopped inside the limit", T.clockState("2026-10-01T08:00", T.TRACE_TARGET_MS, at(20), "2026-10-01T11:59").state, "met");
check("missed when stopped after it", T.clockState("2026-10-01T08:00", T.TRACE_TARGET_MS, at(20), "2026-10-01T12:01").state, "missed");
check("idle without a start", T.clockState("", T.TRACE_TARGET_MS, at(9)).state, "idle");
check("24 h deadline is local", T.clockState("2026-10-01T08:30", T.NOTICE_LIMIT_MS, at(9)).deadline.getDate(), 2);
check("formatDuration minutes", T.formatDuration(14 * 60000), "14 min");

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log("all lot-trace checks passed");
