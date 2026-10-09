// A grid cell that can be picked from another form's register, and fills the cells beside it
// (GridColumn.pickFrom). First use: FRM-501's Ingredient, picked from the Material Specification
// Register (FRM-207), which fills Supplier and Allergen(s) from that material's entry.
//
// Pure: no imports, so it can be tested in Node. The loader is loadPickOptions in formReport.ts.

/** One thing that can be picked: the value for the cell, and what it fills in the same row. */
export interface PickOption {
  value: string;
  /** Column id -> the text that column is filled with. A source with nothing to offer is "". */
  fills: Record<string, string>;
  /** Shown beside the value in the list, so two materials with one name can be told apart. */
  hint: string;
}

const text = (v: unknown): string =>
  v == null ? "" : Array.isArray(v) ? v.map(x => String(x ?? "").trim()).filter(Boolean).join(", ") : String(v).trim();

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The pick-list from the source form's entries (already narrowed to the submitted ones that pass
 * the column's filters). One option per distinct value, case-insensitively; the FIRST entry given
 * wins, so pass the newest first. An entry with no value is not an option.
 */
export function pickOptionsFromRows(
  spec: { field: string; fill?: Record<string, string>; hintField?: string },
  rows: Record<string, any>[],
): PickOption[] {
  const out: PickOption[] = [];
  for (const data of rows) {
    const value = text(data?.[spec.field]);
    if (!value || out.some(o => same(o.value, value))) continue;
    const fills: Record<string, string> = {};
    for (const [column, source] of Object.entries(spec.fill ?? {})) fills[column] = text(data?.[source]);
    out.push({ value, fills, hint: spec.hintField ? text(data?.[spec.hintField]) : "" });
  }
  return out.sort((a, b) => a.value.localeCompare(b.value));
}

/** The option whose value is exactly what is in the cell (case and outer spaces ignored). */
export function matchPick(options: PickOption[], value: unknown): PickOption | null {
  const v = text(value);
  return v ? options.find(o => same(o.value, v)) ?? null : null;
}

/**
 * What picking `picked` writes into the row's other cells. A cell is written only if it is empty
 * or still holds exactly what the previous pick in this cell (`last`) wrote - so an answer somebody
 * typed is never replaced, while changing the pick from one material to another carries the
 * supplier and the allergens along instead of leaving the first material's behind. A cell the new
 * pick has nothing for is cleared only in that second case. Returns just the cells that change.
 */
export function pickFills(
  picked: PickOption,
  last: PickOption | null,
  current: Record<string, unknown>,
): Record<string, string> {
  const writes: Record<string, string> = {};
  for (const [column, next] of Object.entries(picked.fills)) {
    const now = text(current[column]);
    const fromLast = last ? last.fills[column] : undefined;
    const ours = fromLast !== undefined && fromLast !== "" && now === fromLast;
    if (now === next) continue;
    if (now === "" ? next !== "" : ours) writes[column] = next;
  }
  return writes;
}

/**
 * The type-ahead list of a text field fed by another form (TextField.suggestFrom): the distinct
 * values of `field`, case-insensitively, sorted. `rows` are the entries' answers, already narrowed
 * to the ones that count (submitted, or drafts too where the field says so). An entry with no
 * value offers nothing.
 */
export function suggestValuesFromRows(field: string, rows: Record<string, any>[]): string[] {
  const out: string[] = [];
  for (const data of rows) {
    const value = text(data?.[field]);
    if (value && !out.some(v => same(v, value))) out.push(value);
  }
  return out.sort((a, b) => a.localeCompare(b));
}
