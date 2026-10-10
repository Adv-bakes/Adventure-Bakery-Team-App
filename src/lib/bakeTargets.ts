// The oven temperature and bake time a product's formula sheet states (FRM-501, Process
// Parameters, the Target / Spec column), offered as SUGGESTIONS where a bake reading is typed.
//
// A suggestion is never a default: the box stays empty until the operator takes the figure on
// purpose (the owner's rule for anything measured - a prefilled reading gets accepted without
// being read off the oven). And a figure is never guessed out of text: "350" and "350°F" are
// read, "350-360" or "about 350" are not, and then nothing is suggested.
//
// Pure: no imports, so it can be tested in Node. The loader is loadBakeTargets in formReport.ts.

export interface BakeTargets {
  /** Oven temperature, °F. */
  temp?: number;
  /** Bake time, minutes. */
  minutes?: number;
}

/** The rows of FRM-501's Process Parameters table and the column read. Rename one, update this. */
export const BAKE_TARGET_SOURCE = { form: "FRM-501", productField: "product_name", grid: "process_parameters_grid", column: "target_spec" } as const;

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sameName = (a: unknown, b: unknown) => norm(a) !== "" && norm(a).replace(/s$/, "") === norm(b).replace(/s$/, "");

/** One written target as a number, or undefined when it is not plainly one figure in a sensible range. */
export function readTarget(text: unknown, kind: "temp" | "minutes"): number | undefined {
  const s = String(text ?? "").trim();
  const m = kind === "temp"
    ? /^(\d{2,3}(?:\.\d+)?)\s*(?:[°º]\s*f|f|deg(?:rees)?(?:\s*f(?:ahrenheit)?)?)?\.?$/i.exec(s)
    : /^(\d{1,3}(?:\.\d+)?)\s*(?:min(?:ute)?s?)?\.?$/i.exec(s);
  if (!m) return undefined;
  const v = Number(m[1]);
  const [lo, hi] = kind === "temp" ? [100, 700] : [1, 240];
  return v >= lo && v <= hi ? v : undefined;
}

/**
 * The targets for `product`. `labels` are the table's printed row labels (the rows of an entry sit
 * in the same order); `entries` the formula sheets' answers, NEWEST FIRST, drafts included since
 * formula sheets are kept as drafts. Each figure comes from the newest sheet of the product that
 * states it, so a sheet that leaves one blank does not hide an earlier one.
 */
export function bakeTargets(labels: unknown[], entries: Record<string, any>[], product: string): BakeTargets {
  const rowOf = (...words: string[]) => (Array.isArray(labels) ? labels : []).findIndex(l => words.every(w => norm(l).split(" ").includes(w)));
  const tempRow = rowOf("bake", "temperature");
  const timeRow = rowOf("bake", "time");
  const out: BakeTargets = {};
  for (const data of entries) {
    if (!sameName(data?.[BAKE_TARGET_SOURCE.productField], product)) continue;
    const rows = Array.isArray(data?.[BAKE_TARGET_SOURCE.grid]) ? data[BAKE_TARGET_SOURCE.grid] : [];
    if (out.temp === undefined && tempRow >= 0) out.temp = readTarget(rows[tempRow]?.[BAKE_TARGET_SOURCE.column], "temp");
    if (out.minutes === undefined && timeRow >= 0) out.minutes = readTarget(rows[timeRow]?.[BAKE_TARGET_SOURCE.column], "minutes");
    if (out.temp !== undefined && out.minutes !== undefined) break;
  }
  return out;
}
