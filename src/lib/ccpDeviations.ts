// Section 3 of the two CCP records ("If a limit was not met"), worked out from the checks the
// record already holds: FRM-507's oven loads and FRM-606's seal checks.
//
// WHAT IS DERIVED, AND WHAT IS NOT. Whether there were deviations ("None" / "Yes"), and one line
// in the deviations table per failed load or check, with what was out of limit. What was DONE
// about it - rebaked, held, destroyed - and the FRM-702 / FRM-007 reference are a person's to
// give: those cells are left blank and the form requires them, so a record with a failed load
// cannot be submitted until somebody says what happened to it.
//
// A PERSON'S WORDS ARE NEVER REPLACED. A line the app wrote carries two hidden keys: `_src`
// (which load or check it is for) and `_auto` (exactly what the app wrote). While the line still
// reads as written it follows its source - the wording updates if a reading is corrected, and
// the line goes if the load turns out to have passed. Once somebody has changed its wording, or
// filled in the action, it is theirs and is left alone. Lines typed by hand have no `_src` and
// are never touched.
//
// Pure and idempotent: running it twice changes nothing the second time. Relative imports only,
// so the node test can bundle it. Field ids are tied to the two forms: rename one, update the map.

import { CCP1_LIMITS } from "./voiceCommands";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown) => (str(v) !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

export interface DeviationForm {
  form: string;
  /** The table of checks the deviations are read from. */
  grid: string;
  /** The "Deviations on this day" select, and its two options exactly as the form defines them. */
  answer: string;
  none: string;
  yes: string;
  /** The deviations table, and the column a person must fill for a line to count as dealt with. */
  log: string;
  /** A row that carries a verdict at all (so "None" is only said once something was checked). */
  judged(row: Row): boolean;
  fails(row: Row): boolean;
  /** What identifies the load or check a line is for. */
  key(row: Row): string;
  /** The cells the app writes for a failed row. */
  describe(row: Row): Record<string, string>;
}

const FRM507: DeviationForm = {
  form: "FRM-507", grid: "oven_loads", answer: "deviations_today",
  none: "None - every load met the limits", yes: "Yes - each one is recorded below", log: "deviation_log",
  judged: r => str(r.within_limits) === "pass" || str(r.within_limits) === "fail",
  fails: r => str(r.within_limits) === "fail",
  key: r => [str(r.time_out), str(r.product).toLowerCase(), str(r.lot_code).toLowerCase()].join("|"),
  describe: r => {
    const temp = num(r.oven_temp), minutes = num(r.bake_time), probe = num(r.internal_temp);
    const misses: string[] = [];
    if (temp !== undefined && temp < CCP1_LIMITS.ovenMinF) misses.push(`oven temperature ${temp}°F, below the ${CCP1_LIMITS.ovenMinF}°F limit`);
    if (minutes !== undefined && minutes < CCP1_LIMITS.bakeMinMinutes) misses.push(`bake time ${minutes} min, under the ${CCP1_LIMITS.bakeMinMinutes}-minute limit`);
    if (probe !== undefined && probe < CCP1_LIMITS.internalMinF) misses.push(`internal temperature ${probe}°F, below the ${CCP1_LIMITS.internalMinF}°F limit`);
    const where = [str(r.product), str(r.time_out) && `out at ${str(r.time_out)}`].filter(Boolean).join(", ");
    const what = misses.length ? misses.join("; ") : "recorded as Fail by the operator; the readings entered are within the limits";
    return { lot_code: str(r.lot_code), what: `${where ? `${where}: ` : ""}${what}` };
  },
};

const FRM606: DeviationForm = {
  form: "FRM-606", grid: "seal_checks", answer: "deviations_today",
  none: "None - every check passed", yes: "Yes - each one is recorded below", log: "deviation_log",
  judged: r => ["pass", "fail"].includes(str(r.visual)) || ["pass", "fail"].includes(str(r.pull_test)),
  fails: r => str(r.visual) === "fail" || str(r.pull_test) === "fail",
  key: r => [str(r.time), str(r.check).toLowerCase()].join("|"),
  describe: r => {
    const failed = [str(r.visual) === "fail" ? "visual check failed" : "", str(r.pull_test) === "fail" ? "pull test failed" : ""].filter(Boolean).join("; ");
    return { time: str(r.time), what: `${str(r.check) ? `${str(r.check)}: ` : ""}${failed}` };
  },
};

/** The single map of forms whose Section 3 is derived. */
export const CCP_DEVIATION_FORMS: Record<string, DeviationForm> = { "FRM-507": FRM507, "FRM-606": FRM606 };

// Loosely typed on purpose: this file takes a form schema without importing its types.
type SchemaLike = { sections?: { fields?: any[] }[] } | null | undefined;

/**
 * The form's set-up, or null when this form has none or this REVISION of it does not match (a
 * field or an option renamed): nothing is then derived, rather than written into the wrong place.
 */
export function deviationFormFor(formNumber: string | null | undefined, schema: SchemaLike): DeviationForm | null {
  const cfg = formNumber ? CCP_DEVIATION_FORMS[formNumber] : undefined;
  if (!cfg) return null;
  const fields = (schema?.sections ?? []).flatMap(s => s.fields ?? []) as { id: string; options?: string[]; columns?: { id: string }[] }[];
  const answer = fields.find(f => f.id === cfg.answer);
  const log = fields.find(f => f.id === cfg.log);
  const grid = fields.find(f => f.id === cfg.grid);
  if (!answer?.options?.includes(cfg.none) || !answer.options.includes(cfg.yes)) return null;
  if (!grid || !log?.columns?.some(c => c.id === "what") || !log.columns.some(c => c.id === "action")) return null;
  return cfg;
}

const rowsOf = (values: Row, id: string): Row[] => (Array.isArray(values?.[id]) ? (values[id] as Row[]) : []).filter(r => r && typeof r === "object");
const parseAuto = (v: unknown): Record<string, string> => {
  try { const o = JSON.parse(String(v ?? "")); return o && typeof o === "object" ? o : {}; } catch { return {}; }
};
const hasContent = (row: Row) => Object.entries(row).some(([k, v]) => !k.startsWith("_") && str(v) !== "");

/**
 * Section 3 for these values. Returns the same `values` object and `changed: false` when it is
 * already as it should be, so a caller can run it on every change of the checks.
 */
export function deriveDeviations(cfg: DeviationForm, values: Row): { values: Row; changed: boolean } {
  const source = rowsOf(values, cfg.grid);
  // One entry per failed row. Two failed rows that would share a key are told apart by their order.
  const seenKeys = new Map<string, number>();
  const fails = source.filter(cfg.fails).map(r => {
    const base = cfg.key(r);
    const n = (seenKeys.get(base) ?? 0) + 1;
    seenKeys.set(base, n);
    return { key: n > 1 ? `${base}#${n}` : base, cells: cfg.describe(r) };
  });

  const log = rowsOf(values, cfg.log);
  const used = new Set<string>();
  let removed = false;
  const next: Row[] = [];
  for (const row of log) {
    const src = str(row._src);
    if (!src) { next.push(row); continue; }
    const auto = parseAuto(row._auto);
    const wordingTouched = Object.keys(auto).some(k => str(row[k]) !== auto[k]);
    const fail = fails.find(f => f.key === src && !used.has(f.key));
    if (fail) {
      used.add(fail.key);
      const differs = Object.keys(fail.cells).some(k => fail.cells[k] !== auto[k]);
      next.push(!wordingTouched && differs ? { ...row, ...fail.cells, _auto: JSON.stringify(fail.cells) } : row);
      continue;
    }
    // Its load no longer fails. The line goes only if nobody has added anything to it.
    const othersBlank = Object.entries(row).every(([k, v]) => k.startsWith("_") || k in auto || str(v) === "");
    if (!wordingTouched && othersBlank) removed = true;
    else next.push(row);
  }
  const fresh = fails.filter(f => !used.has(f.key));
  // A new entry is born with one empty line in the table: a first deviation takes its place rather
  // than sitting under it.
  const kept = fresh.length ? next.filter(r => str(r._src) !== "" || hasContent(r)) : next;
  next.length = 0;
  next.push(...kept, ...fresh.map(f => ({ ...f.cells, _src: f.key, _auto: JSON.stringify(f.cells) })));

  const current = str(values[cfg.answer]);
  const judged = source.filter(cfg.judged).length;
  let answer = current;
  if (fails.length) answer = cfg.yes;
  else if (next.some(hasContent)) answer = current;           // a deviation somebody wrote by hand stands
  else if (judged > 0 && (current === "" || (current === cfg.yes && removed))) answer = cfg.none;

  const logChanged = JSON.stringify(next) !== JSON.stringify(log);
  if (!logChanged && answer === current) return { values, changed: false };
  return { values: { ...values, [cfg.answer]: answer, ...(logChanged ? { [cfg.log]: next } : {}) }, changed: true };
}

/**
 * Why this record cannot be submitted as it stands: Section 3 and the checks disagree. Empty when
 * they agree. (A failed load whose line has no action is caught by the form's own required column.)
 */
export function deviationProblems(cfg: DeviationForm, values: Row): string[] {
  const fails = rowsOf(values, cfg.grid).filter(cfg.fails).length;
  const lines = rowsOf(values, cfg.log).filter(hasContent).length;
  const answer = str(values[cfg.answer]);
  const problems: string[] = [];
  if (fails > 0 && answer === cfg.none) problems.push(`Section 3 says "${cfg.none}", but ${fails} ${fails === 1 ? "row is" : "rows are"} recorded as Fail. They have to agree before this can be submitted.`);
  if (fails > lines) problems.push(`Section 3 lists ${lines} deviation${lines === 1 ? "" : "s"} for ${fails} failed row${fails === 1 ? "" : "s"}. Each failed row needs its own line.`);
  if (answer === cfg.yes && lines === 0) problems.push(`Section 3 says "${cfg.yes}", but no deviation is listed.`);
  return problems;
}
