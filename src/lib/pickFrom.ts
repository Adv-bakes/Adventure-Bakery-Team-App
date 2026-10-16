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

/**
 * The pick-list from a printed reference table of the same form (GridColumn.pickFromTable): one
 * option per row, its value the row's FIRST cell, and `fill` mapping a grid column id to the table
 * column (by header, case-insensitively) that fills it. A row with an empty first cell is skipped;
 * a header the table does not have fills nothing.
 */
export function pickOptionsFromTable(
  table: { columns: string[]; rows: string[][] } | undefined,
  fill: Record<string, string> = {},
): PickOption[] {
  if (!table) return [];
  const col = (header: string) => table.columns.findIndex(c => same(c, header));
  const out: PickOption[] = [];
  for (const row of table.rows ?? []) {
    const value = text(row?.[0]);
    if (!value || out.some(o => same(o.value, value))) continue;
    const fills: Record<string, string> = {};
    for (const [column, header] of Object.entries(fill)) {
      const i = col(header);
      if (i >= 0) fills[column] = text(row?.[i]);
    }
    out.push({ value, fills, hint: "" });
  }
  return out;
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
 *
 * With `match`, only the entries whose `match.field` is `match.value` are read (compared like the
 * values themselves: without case or stray spaces); a blank `match.value` offers nothing.
 */
export function suggestValuesFromRows(
  field: string,
  rows: Record<string, any>[],
  match?: { field: string; value: unknown },
  /** "FRM-501 {formula_version}": what is offered, with each {key} taken from the entry. */
  template?: string,
): string[] {
  const out: string[] = [];
  if (match && !text(match.value)) return out;
  for (const data of rows) {
    if (match && !same(text(data?.[match.field]), text(match.value))) continue;
    const own = text(data?.[field]);
    const value = own && template ? text(template.replace(/[{]([a-z0-9_]+)[}]/gi, (_, key) => text(data?.[key]))) : own;
    if (value && !out.some(v => same(v, value))) out.push(value);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * `suggestFrom.grid`: the rows of a table inside the source form, flattened so the list is built
 * from them exactly as it is from top-level answers. `entries` are newest first. With `current`,
 * only the register's current entry is read: the newest submitted one, else the newest draft
 * (when drafts are read at all). `where` keeps the rows whose column equals the value given.
 */
export function gridSuggestRows(
  spec: { grid: string; drafts?: boolean; current?: boolean; where?: { column: string; equals: string } },
  entries: { status?: string; data?: Record<string, any> | null }[],
): Record<string, any>[] {
  const usable = entries.filter(e => spec.drafts || e.status === "submitted");
  const read = spec.current ? [usable.find(e => e.status === "submitted") ?? usable[0]].filter(Boolean) : usable;
  const rows: Record<string, any>[] = [];
  for (const e of read) {
    const grid = e!.data?.[spec.grid];
    if (!Array.isArray(grid)) continue;
    for (const row of grid) {
      if (!row || typeof row !== "object") continue;
      if (spec.where && text(row[spec.where.column]) !== spec.where.equals) continue;
      rows.push(row);
    }
  }
  return rows;
}
