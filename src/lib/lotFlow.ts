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
} as const;

export type FlowState = "done" | "open" | "none";
export type FlowStepKey = "mixing" | "baking" | "sealing" | "packing" | "submit" | "retention" | "release";

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
export function mixProgress(data: Record<string, any> | null | undefined): MixProgress {
  const d = data ?? {};
  const rows: Record<string, unknown>[] = (Array.isArray(d[LOT_FLOW.grid]) ? d[LOT_FLOW.grid] : []).filter((r: any) => str(r?.[LOT_FLOW.ingredient]) !== "");
  const n = Number(str(d[LOT_FLOW.batches]));
  const batches = Number.isInteger(n) && n >= 1 ? Math.min(n, LOT_FLOW.weighed.length) : 0;
  const complete = (r: Record<string, unknown>) =>
    str(r[LOT_FLOW.lot]) !== "" && (str(r[LOT_FLOW.expected]) === "" || LOT_FLOW.weighed.slice(0, batches).every(k => str(r[k]) !== ""));
  const linesDone = batches ? rows.filter(complete).length : 0;
  const touched = batches > 0 || str(d[LOT_FLOW.rework]) !== ""
    || rows.some(r => str(r[LOT_FLOW.lot]) !== "" || LOT_FLOW.weighed.some(k => str(r[k]) !== ""));
  const done = rows.length > 0 && batches > 0 && linesDone === rows.length && str(d[LOT_FLOW.rework]) !== "";
  return { state: done ? "done" : touched ? "open" : "none", lines: rows.length, linesDone, batches };
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
 * The steps of one lot, in order, each with how far it has got. Retention and release are the SQF
 * Practitioner's (FSQM-020), so they are listed for admins and owners only.
 */
export function flowSteps(records: TodayRecords, lot: LotSummary, today: string, isAdmin: boolean): FlowStep[] {
  const entry = records.lots.find(e => e.id === lot.id);
  const submitted = lot.status === "submitted";
  const steps: FlowStep[] = [
    { key: "mixing", state: submitted ? "done" : mixProgress(entry?.data).state },
    ccpStep("baking", lotBakeState(records, lot, today)),
    ccpStep("sealing", lotSealState(records, lot, today)),
    { key: "packing", state: lot.packing.done || submitted ? "done" : lot.packing.checked || lot.packing.counted ? "open" : "none" },
    { key: "submit", state: submitted ? "done" : "none" },
  ];
  if (isAdmin) {
    const release = releaseSteps(records, lot);
    for (const key of ["retention", "release"] as const) {
      const r = release.find(s => s.key === key);
      if (r) steps.push({ key, state: r.state, release: r });
    }
  }
  return steps;
}

/**
 * Where the page opens: the first step that is not finished, else the last one. Once the lot
 * record is submitted the floor's work is over, so a load or a check that was never marked as the
 * last one does not pull the page back to it - it opens on what comes after the lot record.
 */
export function nextOpenStep(steps: FlowStep[]): FlowStepKey {
  const submit = steps.findIndex(s => s.key === "submit" && s.state === "done");
  const from = submit >= 0 ? steps.slice(submit + 1) : steps;
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
 * pack answered and the three counts entered), the last ingredient, the lot record submitted. Anything else stays where it is.
 */
export function advancesAfter(key: FlowStepKey, saved: { last?: "batch" | "lot"; step?: string } | undefined, stepsAfterSave: FlowStep[]): boolean {
  const now = stepsAfterSave.find(s => s.key === key)?.state;
  if (key === "baking" || key === "sealing") return !!saved?.last;
  if (key === "packing") return (saved?.step === "counted" || saved?.step === "checked") && now === "done";
  if (key === "mixing" || key === "submit") return now === "done";
  return false;
}

/** The query that brings "Back" on a full record to this lot and step. Read by FormEntry. */
export function lotBackQuery(entryId: string, step: FlowStepKey): string {
  return `from=lot&lot=${encodeURIComponent(entryId)}&step=${step}`;
}

export function lotFlowHref(entryId: string, step?: FlowStepKey): string {
  return `/team/today/lot/${encodeURIComponent(entryId)}${step ? `?step=${step}` : ""}`;
}

export const FLOW_STEP_KEYS: readonly FlowStepKey[] = ["mixing", "baking", "sealing", "packing", "submit", "retention", "release"];
export const isFlowStep = (v: unknown): v is FlowStepKey => typeof v === "string" && (FLOW_STEP_KEYS as readonly string[]).includes(v);
