// "Follow this lot": one lot + product taken step by step, from mixing to release (owner's
// request, 2026-10-12). This is the pure half - which steps there are and how far each has got.
//
// THE RULE THIS FILE KEEPS, the Today page's again: every state is DERIVED from the records and
// nothing is stored for the flow. A step is done because its record says so (a Last load mark, the
// three counts, a submitted lot record), never because somebody passed through a screen.
//
// Relative imports only, so scripts/test-lot-flow.mjs can bundle it.

import {
  bakeState, releaseSteps, sealState,
  type BakeState, type LotSummary, type ReleaseStep, type TodayEntry, type TodayRecords,
} from "./today";

/** The single map of the lot record's (FRM-520) answer keys the mixing step reads. Rename a field, update this. */
export const LOT_FLOW = {
  form: "FRM-520",
  /** Filled in when a lot is started step by step: today, and the lot code that day gives. */
  bakeDate: "bake_date",
  lotCode: "lot_code",
  batches: "batches",
  grid: "ingredients",
  ingredient: "ingredient",
  brand: "brand",
  lot: "supplier_lot",
  expected: "expected_qty",
  unit: "unit",
  /** Batch 1, 2 and 3 weighed: the form has three columns, so three batches is the most. */
  weighed: ["actual_qty", "actual_qty_2", "actual_qty_3"],
  rework: "rework",
  signature: "recorded_by",
  notes: "notes",
  /**
   * A hidden key on a line of the lot record, copied from the formula sheet's "Added at": the line is
   * added at dunking (syrup, rum), not mixed. Absent = mixing, so older records read as before.
   */
  stage: "_stage",
} as const;

export const DUNKING = "dunking";

/**
 * Which record the mixing screens are walking. The lot record (FRM-520) asks how many batches (one
 * weighed column each) and the rework question; the Intermediate Batch Record (FRM-530, the syrup made
 * in the kettle) is one batch with one weighed column and no rework. Same field ids otherwise.
 */
export interface MixSpec {
  batches: boolean;
  rework: boolean;
  /** The date a record started from the formula sheet is given, with the lot code it yields. */
  dateField: string;
}
export const LOT_SPEC: MixSpec = { batches: true, rework: true, dateField: "bake_date" };
export const BATCH_SPEC: MixSpec = { batches: false, rework: false, dateField: "made_on" };

/** Is this line of the lot record added at dunking rather than mixed? */
export const isDunkLine = (r: unknown): boolean =>
  !!r && typeof r === "object" && String((r as Record<string, unknown>)[LOT_FLOW.stage] ?? "").trim().toLowerCase() === DUNKING;

export type FlowState = "done" | "open" | "none";
export type FlowStepKey = "mixing" | "baking" | "dunking" | "sealing" | "packing" | "submit" | "retention" | "bakeReview" | "sealReview" | "release";

export interface FlowStep {
  key: FlowStepKey;
  state: FlowState;
  /** Baking and seal checks: how many loads / checks are recorded for the batch. */
  count?: number;
  /** Retention and release: the release menu's own step, with the record to open. */
  release?: ReleaseStep;
}

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const day = (v: unknown) => str(v).slice(0, 10);

export interface MixProgress {
  state: FlowState;
  /** Ingredient lines on the record, and how many are complete for every batch. */
  lines: number;
  linesDone: number;
  /** 0 until "Number of batches" is answered. */
  batches: number;
}

/**
 * How far the weighing has got, from the lot record's own answers. A line is complete when it has
 * the lot on its container and - where the formula gives an expected quantity - a weight for each
 * batch. A line with no expected quantity (pan spray) needs only its lot. Mixing is done when the
 * number of batches is answered, every line is complete, and the rework question is answered.
 */
export function mixProgress(data: Record<string, any> | null | undefined, spec: MixSpec = LOT_SPEC): MixProgress {
  const d = data ?? {};
  // The dunking lines (syrup, rum) are not mixed: the Dunking step asks for them.
  const rows: Record<string, unknown>[] = (Array.isArray(d[LOT_FLOW.grid]) ? d[LOT_FLOW.grid] : [])
    .filter((r: any) => str(r?.[LOT_FLOW.ingredient]) !== "" && !isDunkLine(r));
  const n = Number(str(d[LOT_FLOW.batches]));
  const batches = !spec.batches ? 1 : Number.isInteger(n) && n >= 1 ? Math.min(n, LOT_FLOW.weighed.length) : 0;
  const complete = (r: Record<string, unknown>) =>
    str(r[LOT_FLOW.lot]) !== "" && (str(r[LOT_FLOW.expected]) === "" || LOT_FLOW.weighed.slice(0, batches).every(k => str(r[k]) !== ""));
  const linesDone = batches ? rows.filter(complete).length : 0;
  const touched = (spec.batches && batches > 0) || (spec.rework && str(d[LOT_FLOW.rework]) !== "")
    || rows.some(r => str(r[LOT_FLOW.lot]) !== "" || LOT_FLOW.weighed.some(k => str(r[k]) !== ""));
  const done = rows.length > 0 && batches > 0 && linesDone === rows.length && (!spec.rework || str(d[LOT_FLOW.rework]) !== "");
  return { state: done ? "done" : touched ? "open" : "none", lines: rows.length, linesDone, batches };
}

// ---------- Mixing, one screen at a time ----------

/** One screen of the mixing step: the number of batches, one ingredient of one batch, or the rework question. */
export type MixScreen =
  | { kind: "batches" }
  | {
      kind: "line";
      /** 1, 2 or 3. */
      batch: number;
      /** The line's position in the record's table - blank lines included, so it addresses the row. */
      index: number;
      ingredient: string;
      brand: string;
      unit: string;
      /** The formula's quantity per batch, as text; blank when the formula gives none. */
      expected: string;
      /** The lot on the container is asked with the first batch only. */
      asksLot: boolean;
      /**
       * The weight has to be entered: the formula gives this line a quantity. Without one (pan
       * spray, or a line the formula sheet has no figure for) a weight can be entered, and need not be.
       */
      needsWeight: boolean;
      lot: string;
      weight: string;
      /** Which ingredient of this batch this is, and of how many. */
      position: number;
      of: number;
    }
  | { kind: "rework" };

const gridRows = (d: Record<string, any>): Record<string, unknown>[] => (Array.isArray(d[LOT_FLOW.grid]) ? d[LOT_FLOW.grid] : []);

/**
 * The screens, in order: how many batches, then batch by batch each named ingredient, then the
 * rework question. Until the number of batches is answered there is nothing to walk through, so
 * that is the only screen. Batches 2 and 3 ask the weight only, so a line the formula gives no
 * quantity is asked again only if it was weighed with the first batch.
 *
 * `only` = the one batch this tablet is weighing (owner, 2026-10-15: two people can weigh one lot
 * at once, a batch each). Its lines are the only ones walked; the batches screen (where the choice
 * is made) and the rework question stay. Null or out of range = every batch, in order.
 */
export function mixScreens(data: Record<string, any> | null | undefined, spec: MixSpec = LOT_SPEC, only: number | null = null): MixScreen[] {
  const d = data ?? {};
  const batches = mixProgress(d, spec).batches;
  const out: MixScreen[] = spec.batches ? [{ kind: "batches" }] : [];
  if (!batches) return out;
  const named = gridRows(d).map((r, index) => ({ r, index })).filter(x => str(x.r?.[LOT_FLOW.ingredient]) !== "" && !isDunkLine(x.r));
  for (let b = 1; b <= batches; b++) {
    if (only != null && only >= 1 && only <= batches && b !== only) continue;
    const here = named.filter(x => b === 1 || str(x.r[LOT_FLOW.expected]) !== "" || str(x.r[LOT_FLOW.weighed[0]]) !== "");
    here.forEach((x, i) => out.push({
      kind: "line", batch: b, index: x.index,
      ingredient: str(x.r[LOT_FLOW.ingredient]), brand: str(x.r[LOT_FLOW.brand]), unit: str(x.r[LOT_FLOW.unit]),
      expected: str(x.r[LOT_FLOW.expected]),
      asksLot: b === 1, needsWeight: str(x.r[LOT_FLOW.expected]) !== "",
      lot: str(x.r[LOT_FLOW.lot]), weight: str(x.r[LOT_FLOW.weighed[b - 1]]),
      position: i + 1, of: here.length,
    }));
  }
  if (spec.rework) out.push({ kind: "rework" });
  return out;
}

/** Is this screen answered on the record? */
export function mixScreenDone(data: Record<string, any> | null | undefined, s: MixScreen, spec: MixSpec = LOT_SPEC): boolean {
  const d = data ?? {};
  if (s.kind === "batches") return mixProgress(d, spec).batches > 0;
  if (s.kind === "rework") return str(d[LOT_FLOW.rework]) !== "";
  return (!s.asksLot || s.lot !== "") && (!s.needsWeight || s.weight !== "");
}

/** Where the mixing step opens: the first screen not yet answered, else the last one. */
export function nextMixScreen(data: Record<string, any> | null | undefined, spec: MixSpec = LOT_SPEC, only: number | null = null): number {
  const screens = mixScreens(data, spec, only);
  const i = screens.findIndex(s => !mixScreenDone(data, s, spec));
  return i >= 0 ? i : Math.max(0, screens.length - 1);
}

/** The number of batches the page offers: one per weighed column of the form. */
export const MIX_BATCH_CHOICES: readonly number[] = LOT_FLOW.weighed.map((_, i) => i + 1);

/**
 * Write one screen's answer onto the record's answers. The table's rows have no id of their own,
 * so a line is addressed by its position AND its ingredient and brand: if somebody has since
 * moved or renamed the row, nothing is written and null comes back (the page then reads the
 * record again). Only what the change names is written - a lot, a weight or a unit left out is untouched.
 */
export interface MixChange { lot?: string; batch?: number; weight?: number | ""; unit?: string }

/**
 * The cells of one line a mixing save writes - what the database function write_mix_entry is
 * sent. Null when the batch has no weighed column.
 */
export function mixEntryCells(change: MixChange): Record<string, string | number> | null {
  const cells: Record<string, string | number> = {};
  if (change.lot !== undefined) cells[LOT_FLOW.lot] = change.lot.trim();
  if (change.batch !== undefined && change.weight !== undefined) {
    const key = LOT_FLOW.weighed[change.batch - 1];
    if (!key) return null;
    cells[key] = change.weight;
  }
  if (change.unit !== undefined) cells[LOT_FLOW.unit] = change.unit;
  return cells;
}

export function applyMixEntry(
  values: Record<string, any>,
  ref: { index: number; ingredient: string; brand: string },
  change: MixChange & { amount?: string },
): Record<string, any> | null {
  const rows = gridRows(values);
  const row = rows[ref.index];
  if (!row || str(row[LOT_FLOW.ingredient]) !== ref.ingredient || str(row[LOT_FLOW.brand]) !== ref.brand) return null;
  const cells = mixEntryCells(change);
  if (!cells) return null;
  const next: Record<string, unknown> = { ...row, ...cells };
  if (change.amount !== undefined) next[LOT_FLOW.notes] = withAmount(str(row[LOT_FLOW.notes]), change.amount);
  return { ...values, [LOT_FLOW.grid]: rows.map((r, i) => (i === ref.index ? next : r)) };
}

/** Field and column ids LOT_FLOW names that the lot record form no longer has. Empty = the mixing step can write. */
export function checkMixMapping(schema: { sections?: { fields?: any[] }[] } | null | undefined, spec: MixSpec = LOT_SPEC): string[] {
  const fields = (schema?.sections ?? []).flatMap(s => s.fields ?? []);
  const byId = new Map(fields.map(f => [f.id, f]));
  const missing: string[] = [];
  const top = [...(spec.batches ? [LOT_FLOW.batches] : []), LOT_FLOW.grid, ...(spec.rework ? [LOT_FLOW.rework] : [])];
  for (const id of top) if (!byId.has(id)) missing.push(id);
  const cols = new Set<string>((byId.get(LOT_FLOW.grid)?.columns ?? []).map((c: any) => c.id));
  if (byId.has(LOT_FLOW.grid)) {
    const weighed = spec.batches ? LOT_FLOW.weighed : LOT_FLOW.weighed.slice(0, 1);
    for (const id of [LOT_FLOW.ingredient, LOT_FLOW.brand, LOT_FLOW.lot, LOT_FLOW.expected, LOT_FLOW.unit, ...weighed]) {
      if (!cols.has(id)) missing.push(`${LOT_FLOW.grid}.${id}`);
    }
  }
  return missing;
}

/** The rework answer that needs no line of its own ("No rework used"), in the form's own words. */
export function noReworkOption(schema: { sections?: { fields?: any[] }[] } | null | undefined): string {
  const f = (schema?.sections ?? []).flatMap(s => s.fields ?? []).find(x => x.id === LOT_FLOW.rework);
  const options: unknown[] = Array.isArray(f?.options) ? f.options : [];
  const no = options.find(o => /^no\b/i.test(String(o)));
  return no == null ? "" : String(no);
}

// ---------- Dunking, one line at a time ----------

/**
 * What a dunking line holds besides its lot: the amount used, if the person gives one. A cake's share
 * of the syrup or the rum is not weighed, so it is optional free text ("1 gal"), kept in the line's
 * Notes as "Amount used: 1 gal" so it prints on the record. Anything else in Notes is kept.
 */
export const AMOUNT_PREFIX = "Amount used: ";

export function amountOf(notes: unknown): string {
  const part = str(notes).split("; ").find(p => p.startsWith(AMOUNT_PREFIX));
  return part ? part.slice(AMOUNT_PREFIX.length).trim() : "";
}

export function withAmount(notes: string, amount: string): string {
  const others = str(notes).split("; ").filter(p => p !== "" && !p.startsWith(AMOUNT_PREFIX));
  const a = amount.trim();
  return [...others, ...(a ? [AMOUNT_PREFIX + a] : [])].join("; ");
}

export interface DunkScreen {
  /** The line's position in the record's table - blank lines included, so it addresses the row. */
  index: number;
  ingredient: string;
  brand: string;
  lot: string;
  amount: string;
  /** Another line of the same ingredient is on the record (a second lot), so a blank one can go. */
  twin: boolean;
  position: number;
  of: number;
}

/** One screen per dunking line of the lot record, in the table's order. */
export function dunkScreens(data: Record<string, any> | null | undefined): DunkScreen[] {
  const rows = gridRows(data ?? {});
  const lines = rows.map((r, index) => ({ r, index })).filter(x => isDunkLine(x.r) && str(x.r[LOT_FLOW.ingredient]) !== "");
  const named = (x: { r: Record<string, unknown> }) => str(x.r[LOT_FLOW.ingredient]).toLowerCase();
  return lines.map((x, i) => ({
    index: x.index,
    ingredient: str(x.r[LOT_FLOW.ingredient]), brand: str(x.r[LOT_FLOW.brand]),
    lot: str(x.r[LOT_FLOW.lot]), amount: amountOf(x.r[LOT_FLOW.notes]),
    twin: lines.some(y => y.index !== x.index && named(y) === named(x)),
    position: i + 1, of: lines.length,
  }));
}

export interface DunkProgress { state: FlowState; lines: number; linesDone: number }

/** Dunking is done when every dunking line has the lot on its container. */
export function dunkProgress(data: Record<string, any> | null | undefined): DunkProgress {
  const s = dunkScreens(data);
  const linesDone = s.filter(x => x.lot !== "").length;
  return { state: s.length > 0 && linesDone === s.length ? "done" : linesDone > 0 ? "open" : "none", lines: s.length, linesDone };
}

/** Where the dunking step opens: the first line with no lot, else the last one. */
export function nextDunkScreen(data: Record<string, any> | null | undefined): number {
  const s = dunkScreens(data);
  const i = s.findIndex(x => x.lot === "");
  return i >= 0 ? i : Math.max(0, s.length - 1);
}

type LineRef = { index: number; ingredient: string; brand: string };
const sameRow = (row: Record<string, unknown> | undefined, ref: LineRef) =>
  !!row && str(row[LOT_FLOW.ingredient]) === ref.ingredient && str(row[LOT_FLOW.brand]) === ref.brand;

/**
 * A second lot of a dunking ingredient (a new bottle of rum part way through): a new line of the same
 * ingredient and brand at the END of the table, its lot and amount blank - "If two lots of the same
 * ingredient were used, write two lines". At the end so no other line's position changes. Null when
 * the line it copies has moved.
 */
export function addDunkLot(values: Record<string, any>, ref: LineRef): { values: Record<string, any>; index: number } | null {
  const rows = gridRows(values);
  const row = rows[ref.index];
  if (!sameRow(row, ref) || !isDunkLine(row)) return null;
  const copy: Record<string, unknown> = {};
  for (const k of Object.keys(row)) copy[k] = "";
  copy[LOT_FLOW.ingredient] = row[LOT_FLOW.ingredient];
  copy[LOT_FLOW.brand] = row[LOT_FLOW.brand];
  copy[LOT_FLOW.expected] = row[LOT_FLOW.expected] ?? "";
  copy[LOT_FLOW.unit] = row[LOT_FLOW.unit] ?? "";
  copy[LOT_FLOW.stage] = DUNKING;
  return { values: { ...values, [LOT_FLOW.grid]: [...rows, copy] }, index: rows.length };
}

/**
 * Take back a second line added by mistake: only a dunking line with no lot and no amount, while
 * another line of the same ingredient stays. Null when that does not hold or the line has moved.
 */
export function removeDunkLine(values: Record<string, any>, ref: LineRef): Record<string, any> | null {
  const rows = gridRows(values);
  const row = rows[ref.index];
  if (!sameRow(row, ref) || !isDunkLine(row) || str(row[LOT_FLOW.lot]) !== "" || amountOf(row[LOT_FLOW.notes]) !== "") return null;
  const name = ref.ingredient.toLowerCase();
  if (!rows.some((r, i) => i !== ref.index && isDunkLine(r) && str(r[LOT_FLOW.ingredient]).toLowerCase() === name)) return null;
  return { ...values, [LOT_FLOW.grid]: rows.filter((_, i) => i !== ref.index) };
}

const RANK: Record<BakeState["done"], number> = { open: 0, batch: 1, lot: 2 };

/**
 * A batch's baking or seal checks over every production date on record, not only today's: a lot
 * baked yesterday and packed today is still "baked". The lot code belongs to one bake day, so the
 * dates never mix two lots.
 */
function overDates(entries: TodayEntry[], today: string, at: (date: string) => BakeState): BakeState {
  const dates = new Set<string>([today, ...entries.map(e => day(e.data.production_date)).filter(Boolean)]);
  let out: BakeState = { loads: 0, done: "open" };
  for (const date of dates) {
    const s = at(date);
    out = { loads: out.loads + s.loads, done: RANK[s.done] > RANK[out.done] ? s.done : out.done };
  }
  return out;
}

export function lotBakeState(records: TodayRecords, lot: LotSummary, today: string): BakeState {
  return overDates(records.baking, today, d => bakeState(records, d, lot.product, lot.lotCode));
}

export function lotSealState(records: TodayRecords, lot: LotSummary, today: string): BakeState {
  return overDates(records.sealing, today, d => sealState(records, d, lot.product, lot.lotCode));
}

const ccpStep = (key: "baking" | "sealing", s: BakeState): FlowStep =>
  ({ key, state: s.done !== "open" ? "done" : s.loads > 0 ? "open" : "none", count: s.loads });

/**
 * The steps of one lot, in order, each with how far it has got. The retention sample is taken at
 * packing by the person packing (FSQM-014 v2, 2026-10-12), so it comes before the lot record is
 * signed, for everyone. The review of the two CCP records and the release are the SQF Practitioner's
 * (FSQM-017, FSQM-020): admins and owners only.
 * `formRevision` is the lot record form's current revision, when the caller knows it.
 */
export function flowSteps(records: TodayRecords, lot: LotSummary, today: string, isAdmin: boolean, formRevision?: string | null): FlowStep[] {
  const entry = records.lots.find(e => e.id === lot.id);
  const submitted = lot.status === "submitted";
  // A lot record started on an earlier revision of the form has no pack weights to wait for.
  const older = formRevision != null && entry?.revision != null && entry.revision !== formRevision;
  const packed = lot.packing.done || (older && lot.packing.checked && lot.packing.counted);
  const steps: FlowStep[] = [
    { key: "mixing", state: submitted ? "done" : mixProgress(entry?.data).state },
    ccpStep("baking", lotBakeState(records, lot, today)),
    // Only for a lot whose record carries dunking lines (from a formula sheet that marks them).
    ...(dunkScreens(entry?.data).length > 0
      ? [{ key: "dunking" as const, state: submitted ? "done" as const : dunkProgress(entry?.data).state }]
      : []),
    ccpStep("sealing", lotSealState(records, lot, today)),
    { key: "packing", state: packed || submitted ? "done" : lot.packing.checked || lot.packing.counted || lot.packing.weighed ? "open" : "none" },
  ];
  const release = releaseSteps(records, lot);
  const sample = release.find(s => s.key === "retention");
  if (sample) steps.push({ key: "retention", state: sample.state, release: sample });
  steps.push({ key: "submit", state: submitted ? "done" : "none" });
  if (isAdmin) {
    // The two CCP records are reviewed, signed as verifier and submitted before the release decision
    // (FSQM-017): the reviewer is the person who releases.
    for (const [key, from] of [["bakeReview", "baking"], ["sealReview", "sealing"], ["release", "release"]] as const) {
      const r = release.find(s => s.key === from);
      if (r) steps.push({ key, state: r.state, release: r });
    }
  }
  return steps;
}

/**
 * Where the page opens: the first step that is not finished, else the last one. Once the lot
 * record is submitted the floor's work is over, so a load or a check that was never marked as the
 * last one does not pull the page back to it - it opens on what comes after the lot record, or
 * on the retention sample if that is still not on the shelf.
 */
export function nextOpenStep(steps: FlowStep[]): FlowStepKey {
  const submit = steps.findIndex(s => s.key === "submit" && s.state === "done");
  const from = submit >= 0 ? steps.filter((s, i) => i > submit || s.key === "retention") : steps;
  return (from.find(s => s.state !== "done") ?? steps[steps.length - 1]).key;
}

/** The step after this one, or null at the end. */
export function stepAfter(steps: FlowStep[], key: FlowStepKey): FlowStepKey | null {
  const i = steps.findIndex(s => s.key === key);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1].key : null;
}

export function stepBefore(steps: FlowStep[], key: FlowStepKey): FlowStepKey | null {
  const i = steps.findIndex(s => s.key === key);
  return i > 0 ? steps[i - 1].key : null;
}

/**
 * Does a save move the page on by itself? Only where the person has said the step is finished:
 * the last load / last check of the batch or the lot, the save that completes packing (the first
 * pack answered, the three counts entered, the three packs weighed), the last ingredient, the lot record submitted. Anything else stays where it is.
 */
export function advancesAfter(key: FlowStepKey, saved: { last?: "batch" | "lot"; step?: string } | undefined, stepsAfterSave: FlowStep[]): boolean {
  const now = stepsAfterSave.find(s => s.key === key)?.state;
  if (key === "baking" || key === "sealing") return !!saved?.last;
  if (key === "packing") return (saved?.step === "counted" || saved?.step === "checked" || saved?.step === "weighed") && now === "done";
  if (key === "mixing" || key === "dunking" || key === "submit") return now === "done";
  // The retention sample signed as on the shelf, from the page.
  if (key === "retention") return saved?.step === "logged" && now === "done";
  // A CCP record verified and submitted - once no other record of the lot is still waiting.
  if (key === "bakeReview" || key === "sealReview") return saved?.step === "verified" && now === "done";
  return false;
}

/** The query that brings "Back" on a full record to this lot and step. Read by FormEntry. */
export function lotBackQuery(entryId: string, step: FlowStepKey): string {
  return `from=lot&lot=${encodeURIComponent(entryId)}&step=${step}`;
}

/** The short page for a batch made on site (FRM-530, the syrup): BatchFlow.tsx. */
export function batchFlowHref(entryId: string): string {
  return `/team/today/batch/${encodeURIComponent(entryId)}`;
}

export function lotFlowHref(entryId: string, step?: FlowStepKey): string {
  return `/team/today/lot/${encodeURIComponent(entryId)}${step ? `?step=${step}` : ""}`;
}

export const FLOW_STEP_KEYS: readonly FlowStepKey[] = ["mixing", "baking", "dunking", "sealing", "packing", "retention", "submit", "bakeReview", "sealReview", "release"];
export const isFlowStep = (v: unknown): v is FlowStepKey => typeof v === "string" && (FLOW_STEP_KEYS as readonly string[]).includes(v);
