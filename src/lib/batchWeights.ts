// The weights of one ingredient line, one per batch, in ONE cell of the lot record (FRM-520 v3,
// owner 2026-10-23): "B1: 17.49; B2: 17.5; B6: 17.48". Before v3 the record had three fixed
// columns (Batch 1 / 2 / 3 weighed), so a lot could not have more than three batches; the live test
// on 2026-10-19 made six.
//
// THE FORMAT HAS A TWIN IN SQL: public.write_mix_entry merges one batch's weight into the cell under
// the row lock (two tablets weighing the same ingredient for different batches). Change the format
// here and there together; scripts/test-batch-weights.mjs pins it.
//
// No imports, so the test script can bundle it.

/** The FRM-520 v3 column. */
export const WEIGHED_BATCHES = "weighed_batches";
/** The FRM-520 columns before v3: batch 1, 2 and 3. FRM-530 still has the first one only. */
export const LEGACY_WEIGHED = ["actual_qty", "actual_qty_2", "actual_qty_3"] as const;

const ENTRY = /^b?\s*(\d+)\s*[:=)]?\s*(\d+(?:\.\d+)?)$/i;

/**
 * The weights in a cell, by batch. `ok` is false when something in the cell is not "B<n>: <number>" -
 * typed by hand on the record - and then the screens do not write into it (they would lose it).
 * Entries are separated by ";" or a new line, never "," (a decimal comma typed by hand).
 */
export function parseBatchWeights(cell: unknown): { weights: Map<number, string>; ok: boolean } {
  const weights = new Map<number, string>();
  const text = cell == null ? "" : String(cell).trim();
  if (!text) return { weights, ok: true };
  let ok = true;
  for (const part of text.split(/\s*[;\n]\s*/)) {
    if (!part) continue;
    const m = ENTRY.exec(part.trim());
    if (!m || Number(m[1]) < 1) { ok = false; continue; }
    weights.set(Number(m[1]), m[2]);
  }
  return { weights, ok };
}

/** The cell's canonical text: batches in order, "B1: 17.49; B2: 17.5". */
export function formatBatchWeights(weights: Map<number, string>): string {
  return [...weights.entries()].filter(([, w]) => w !== "").sort((a, b) => a[0] - b[0]).map(([b, w]) => `B${b}: ${w}`).join("; ");
}

/** A weight as the cell writes it: the number's own text, as JSON (and so the SQL twin) writes it. */
export const weightText = (w: number) => String(w);

/**
 * The cell with one batch's weight set ("" takes it off). Null when the cell holds something it
 * cannot read - nothing is written then.
 */
export function setBatchWeight(cell: unknown, batch: number, weight: number | ""): string | null {
  if (!Number.isInteger(batch) || batch < 1) return null;
  const { weights, ok } = parseBatchWeights(cell);
  if (!ok) return null;
  if (weight === "") weights.delete(batch);
  else weights.set(batch, weightText(weight));
  return formatBatchWeights(weights);
}

/**
 * Every weight on a line, by batch: the v3 cell, else the three columns of an earlier record
 * (submitted lots stay on the revision they were made on).
 */
export function rowBatchWeights(row: Record<string, unknown> | null | undefined): Map<number, string> {
  const r = row ?? {};
  if (String(r[WEIGHED_BATCHES] ?? "").trim() !== "") return parseBatchWeights(r[WEIGHED_BATCHES]).weights;
  const out = new Map<number, string>();
  LEGACY_WEIGHED.forEach((k, i) => {
    const v = r[k] == null ? "" : String(r[k]).trim();
    if (v !== "") out.set(i + 1, v);
  });
  return out;
}
