// The Today page's pure half (WORKFLOW_ARCHITECTURE.md, Phase 1): what the records say about the
// production day, read through one map of form numbers to field ids. Relative imports only, so
// scripts/test-today.mjs can bundle it.
//
// THE RULE THIS FILE KEEPS: every state here is DERIVED from the records and nothing is stored for
// a stage. A lot is "awaiting release" because its FRM-520 is submitted and no FRM-701 releases
// it, not because somebody ticked a box. The owner's decision of 2026-10-08: no production record
// opens until the day's FRM-903 is SUBMITTED, with no override - productionOpen() is that rule.

import { normLot, sameProduct } from "./releaseAssist";

/** Same shape as RELEASE_SOURCES: a form and the answer keys read from it. */
export interface TodaySourceSpec { form: string; fields: readonly string[]; grids: Record<string, readonly string[]> }

/** The single map of form numbers to the answer keys the Today page reads. Rename a field, update this. */
export const TODAY_FORMS = {
  preops:     { form: "FRM-903", fields: ["inspection_date", "shift", "area_line", "released_by"], grids: {} },
  lots:       { form: "FRM-520", fields: ["product", "lot_code", "bake_date", "pack_date", "units_packed", "racked_count", "not_packed", "code_check"], grids: { ingredients: ["ingredient"] } },
  releases:   { form: "FRM-701", fields: ["product_name", "lot_code", "decision", "release_date"], grids: {} },
  dispatches: { form: "FRM-801", fields: ["dispatch_date", "customer"], grids: { loaded: ["product", "lot_code"] } },
  holds:      { form: "FRM-702", fields: ["hold_tag_number", "material_name_description", "supplier_lot_batch_number", "final_disposition_decision"], grids: {} },
  receipts:   { form: "FRM-301", fields: [], grids: { receiving_log: ["supplier_name", "material_description"] } },
  baking:     { form: "FRM-507", fields: ["production_date", "monitored_by"], grids: { oven_loads: ["lot_code"] } },
  sealing:    { form: "FRM-606", fields: ["production_date", "product", "lot_code", "monitored_by"], grids: { seal_checks: ["check"] } },
} as const satisfies Record<string, TodaySourceSpec>;

export type TodayKind = keyof typeof TODAY_FORMS;

export interface TodayEntry {
  id: string;
  docId: string;
  status: string;                // "draft" | "submitted"
  createdAt: string;
  submittedAt: string | null;
  createdBy: string | null;
  submittedBy: string | null;
  data: Record<string, any>;     // only the mapped keys
}
export type TodayRecords = Record<TodayKind, TodayEntry[]>;

export function emptyTodayRecords(): TodayRecords {
  return Object.fromEntries(Object.keys(TODAY_FORMS).map(k => [k, []])) as unknown as TodayRecords;
}

/** Field ids this file reads that a live schema no longer has. Shown on the page, never silent. */
export function checkTodayMapping(fieldIdsByForm: Record<string, string[] | undefined>): string[] {
  const problems: string[] = [];
  for (const spec of Object.values(TODAY_FORMS) as TodaySourceSpec[]) {
    const ids = fieldIdsByForm[spec.form];
    if (!ids) { problems.push(`${spec.form} was not found`); continue; }
    for (const k of [...spec.fields, ...Object.keys(spec.grids)]) {
      if (!ids.includes(k)) problems.push(`${spec.form} no longer has "${k}"`);
    }
  }
  return [...new Set(problems)];
}

// ---------- Helpers ----------

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const day = (v: unknown) => str(v).slice(0, 10);
const isSubmitted = (e: TodayEntry) => e.status === "submitted";
const rowsOf = (e: TodayEntry, grid: string): Record<string, any>[] =>
  Array.isArray(e.data?.[grid]) ? e.data[grid].filter((r: any) => r && typeof r === "object") : [];
const when = (e: TodayEntry) => str(e.submittedAt ?? e.createdAt);
/** Submitted before draft, then newest first. */
const best = (a: TodayEntry, b: TodayEntry) =>
  Number(!isSubmitted(a)) - Number(!isSubmitted(b)) || when(b).localeCompare(when(a));

/** The calendar day where the device is, as yyyy-mm-dd. Records hold local dates (defaultToday). */
export function localDay(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- Start the day ----------

export type PreopState =
  | { state: "none" }
  | { state: "draft"; entry: TodayEntry }
  | { state: "submitted"; entry: TodayEntry };

/** Today's FRM-903: submitted beats draft; several drafts, the newest. */
export function preopState(preops: TodayEntry[], today: string): PreopState {
  const todays = preops.filter(e => day(e.data.inspection_date) === today).sort(best);
  if (todays.length === 0) return { state: "none" };
  const e = todays[0];
  return { state: isSubmitted(e) ? "submitted" : "draft", entry: e };
}

/** The gate: production records open only on a submitted FRM-903 for the day. No override. */
export function productionOpen(p: PreopState): boolean {
  return p.state === "submitted";
}

// ---------- Lots ----------

export type LotStage = "preparing" | "in_progress" | "awaiting_release" | "not_released" | "released" | "shipped";

export interface LotSummary {
  id: string;            // the FRM-520 entry
  docId: string;
  product: string;
  lotCode: string;
  bakeDate: string;
  status: string;        // FRM-520 draft | submitted
  stage: LotStage;
  /** An FRM-702 with no final disposition names this product and lot. */
  onHold: boolean;
  release?: TodayEntry;
  dispatch?: TodayEntry;
  /** Packing, read from the lot record: the first pack answered, and all three counts entered. */
  packing: PackingState;
}

/** Derived, like every state here: nothing is stored for "packing done". */
export interface PackingState { checked: boolean; counted: boolean; done: boolean }

export function packingState(lot: TodayEntry): PackingState {
  const checked = str(lot.data.code_check) !== "";
  const counted = [lot.data.racked_count, lot.data.units_packed, lot.data.not_packed].every(v => str(v) !== "");
  return { checked, counted, done: checked && counted };
}

function sameLot(product: unknown, lot: unknown, otherProduct: unknown, otherLot: unknown): boolean {
  return !!normLot(lot) && normLot(lot) === normLot(otherLot) && sameProduct(product, otherProduct);
}

/**
 * FRM-702 has no field for one of OUR lots (it was written for supplier material), so a hold on a
 * finished lot carries the code in the supplier-lot field or in the description. Both are read.
 */
function holdApplies(h: TodayEntry, product: string, lot: string): boolean {
  if (str(h.data.final_disposition_decision)) return false;
  const material = h.data.material_name_description;
  const lotMatch = normLot(h.data.supplier_lot_batch_number) === normLot(lot)
    || (!!normLot(lot) && normLot(material).includes(normLot(lot)));
  return sameProduct(material, product) && lotMatch;
}

/** Every FRM-520 lot with its derived stage, newest bake date first. */
export function lotSummaries(records: TodayRecords): LotSummary[] {
  const out: LotSummary[] = [];
  for (const e of records.lots) {
    const product = str(e.data.product), lotCode = str(e.data.lot_code);
    const release = records.releases
      .filter(r => sameLot(product, lotCode, r.data.product_name, r.data.lot_code))
      .sort(best)[0];
    const dispatch = records.dispatches
      .filter(d => isSubmitted(d) && rowsOf(d, "loaded").some(row => sameLot(product, lotCode, row.product, row.lot_code)))
      .sort(best)[0];
    const decision = str(release?.data.decision).toUpperCase();
    const released = !!release && isSubmitted(release) && decision.startsWith("RELEASED");
    const notReleased = !!release && isSubmitted(release) && decision.startsWith("NOT");
    let stage: LotStage;
    if (dispatch) stage = "shipped";
    else if (released) stage = "released";
    else if (notReleased) stage = "not_released";
    else if (isSubmitted(e)) stage = "awaiting_release";
    else if (rowsOf(e, "ingredients").some(r => str(r.ingredient))) stage = "in_progress";
    else stage = "preparing";
    out.push({
      id: e.id, docId: e.docId, product, lotCode, bakeDate: day(e.data.bake_date), status: e.status, stage,
      onHold: records.holds.some(h => holdApplies(h, product, lotCode)),
      release, dispatch,
      packing: packingState(e),
    });
  }
  return out.sort((a, b) => b.bakeDate.localeCompare(a.bakeDate) || a.product.localeCompare(b.product));
}

/** The lots still being worked: everything that has not shipped. */
export function lotsInProgress(records: TodayRecords): LotSummary[] {
  return lotSummaries(records).filter(l => l.stage !== "shipped");
}

// ---------- Holds, receipts, dispatches, CCP records ----------

export function openHolds(holds: TodayEntry[]): TodayEntry[] {
  return holds.filter(h => !str(h.data.final_disposition_decision)).sort(best);
}

export interface DispatchSummary { date: string; customer: string; lots: number; status: string }

export function lastDispatch(dispatches: TodayEntry[]): DispatchSummary | null {
  const e = [...dispatches].sort((a, b) => day(b.data.dispatch_date).localeCompare(day(a.data.dispatch_date)) || best(a, b))[0];
  if (!e) return null;
  const seen = new Set(rowsOf(e, "loaded").map(r => `${normLot(r.lot_code)}|${str(r.product).toLowerCase()}`).filter(k => k !== "|"));
  return { date: day(e.data.dispatch_date), customer: str(e.data.customer), lots: seen.size, status: e.status };
}

export interface ReceiptSummary { date: string; lines: number; suppliers: string[]; status: string }

/** The newest receiving log, by the day it was created (FRM-301 has no date field of its own). */
export function lastReceipt(receipts: TodayEntry[]): ReceiptSummary | null {
  const e = [...receipts].sort((a, b) => when(b).localeCompare(when(a)))[0];
  if (!e) return null;
  const rows = rowsOf(e, "receiving_log").filter(r => str(r.supplier_name) || str(r.material_description));
  return { date: day(when(e)), lines: rows.length, suppliers: [...new Set(rows.map(r => str(r.supplier_name)).filter(Boolean))], status: e.status };
}

/** Today's CCP records: the FRM-507 for the day (one per day) and the FRM-606 entries (one per lot). */
export function ccpToday(records: TodayRecords, today: string): { baking: TodayEntry | null; sealing: TodayEntry[] } {
  const baking = records.baking.filter(e => day(e.data.production_date) === today).sort(best)[0] ?? null;
  const sealing = records.sealing.filter(e => day(e.data.production_date) === today).sort(best);
  return { baking, sealing };
}

/** Oven loads recorded on an FRM-507 entry (rows with a lot code). */
export function ovenLoads(e: TodayEntry | null): number {
  return e ? rowsOf(e, "oven_loads").filter(r => str(r.lot_code)).length : 0;
}

/** FRM-507's Last load options (v3). The same two strings voiceCommands.ts writes. */
const LAST_OF_BATCH = "Last load of this batch";
const LAST_OF_LOT = "Last load of this lot";

export interface BakeState {
  /** Oven loads recorded today for this batch (product + lot code). */
  loads: number;
  /** "batch": this product's baking is finished. "lot": all the day's baking for the lot code is. */
  done: "open" | "batch" | "lot";
}

/**
 * How far the baking of one batch has got today, read from every FRM-507 dated today - whoever
 * started it, draft or submitted. Derived from the Last load marks on the oven loads and stored
 * nowhere else: a batch is done when one of its loads carries a mark, or when any load of the
 * same lot code says it was the last of the lot.
 */
export function bakeState(records: TodayRecords, today: string, product: string, lot: string): BakeState {
  let loads = 0;
  let batch = false;
  let whole = false;
  for (const e of records.baking) {
    if (day(e.data.production_date) !== today) continue;
    for (const r of rowsOf(e, "oven_loads")) {
      if (!normLot(lot) || normLot(r.lot_code) !== normLot(lot)) continue;
      if (str(r.last_load) === LAST_OF_LOT) whole = true;
      if (!sameProduct(r.product, product)) continue;
      loads++;
      if (str(r.last_load) === LAST_OF_BATCH || str(r.last_load) === LAST_OF_LOT) batch = true;
    }
  }
  return { loads, done: whole ? "lot" : batch ? "batch" : "open" };
}

/**
 * Who has signed today's baking record as the operator, once a load is marked the last of its lot:
 * the record is then finished at the oven and waiting for its reviewer. Null until both are true.
 */
export function bakingAwaitingReview(records: TodayRecords, today: string): { by: string } | null {
  for (const e of records.baking) {
    if (day(e.data.production_date) !== today || isSubmitted(e)) continue;
    if (!rowsOf(e, "oven_loads").some(r => str(r.last_load) === LAST_OF_LOT)) continue;
    const name = str(e.data.monitored_by?.name);
    if (name) return { by: name };
  }
  return null;
}

/** FRM-606's Last check options (v3). The same two strings voiceHandsFree.ts writes. */
const LAST_CHECK_OF_BATCH = "Last check of this batch";
const LAST_CHECK_OF_LOT = "Last check of this lot";

/** `loads` is the number of seal checks recorded today for the batch; `done` as for baking. */
export type SealState = BakeState;

/**
 * How far the seal checks of one batch have got today, read from every FRM-606 dated today. A
 * record is one batch's (product + lot code at the top), so the batch is done when its own record
 * carries a Last check mark, or when any record of the same lot code says "of this lot".
 */
export function sealState(records: TodayRecords, today: string, product: string, lot: string): SealState {
  let loads = 0;
  let batch = false;
  let whole = false;
  for (const e of records.sealing) {
    if (day(e.data.production_date) !== today || !normLot(lot) || normLot(e.data.lot_code) !== normLot(lot)) continue;
    const rows = rowsOf(e, "seal_checks");
    if (rows.some(r => str(r.last_check) === LAST_CHECK_OF_LOT)) whole = true;
    if (!sameProduct(e.data.product, product)) continue;
    loads += rows.filter(r => str(r.check)).length;
    if (rows.some(r => str(r.last_check) === LAST_CHECK_OF_BATCH || str(r.last_check) === LAST_CHECK_OF_LOT)) batch = true;
  }
  return { loads, done: whole ? "lot" : batch ? "batch" : "open" };
}

/** Who signed today's sealing records as the operator, once a check is marked the last of its lot. */
export function sealingAwaitingReview(records: TodayRecords, today: string): { by: string } | null {
  for (const e of records.sealing) {
    if (day(e.data.production_date) !== today || isSubmitted(e)) continue;
    if (!rowsOf(e, "seal_checks").some(r => str(r.last_check) === LAST_CHECK_OF_LOT)) continue;
    const name = str(e.data.monitored_by?.name);
    if (name) return { by: name };
  }
  return null;
}

// ---------- Attention ----------

export interface AttentionCounts { overdue: number; due: number; askedOfMe: number; alerts: number }

export function attentionCounts(
  notifications: { severity: string | null; notification_type: string; assigned_to: string | null }[],
  userId: string | null,
): AttentionCounts {
  let overdue = 0, due = 0, askedOfMe = 0, alerts = 0;
  for (const n of notifications) {
    if (n.notification_type === "signature_requested") { if (userId && n.assigned_to === userId) askedOfMe++; continue; }
    if (n.notification_type === "signature_signed") continue;
    if (n.notification_type === "temperature_alert") { alerts++; continue; }
    if (n.severity === "overdue") overdue++;
    else if (n.severity === "due") due++;
  }
  return { overdue, due, askedOfMe, alerts };
}
