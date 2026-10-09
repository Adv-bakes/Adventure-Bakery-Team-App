// Start a production lot record from the product's formula (settings.batchSheet; FRM-520).
//
// The formula is the master: what the product is supposed to contain. The lot record is what went
// in on one bake day. Before this the two were unrelated, and the formula lived in whichever
// earlier lot record somebody happened to copy from.
//
// THE FORMULA HAS TWO POSSIBLE HOMES, and settings.batchSheet.source says which one a form reads:
//   - "FRM-501"  the Formula Sheet & Batch Data entries. The owner's choice for now (2026-10-06).
//   - absent     the sales-side batch sheets (the batch_sheets table), to be looked at later.
// Both are turned into the same FormulaSource, so the fill itself does not know which it came from.
//
// What comes across is the STANDARD, never a measurement: the product, one line per ingredient with
// its brand, and the expected quantity per batch. The lot on the container and the weighed
// quantities are left blank - they are facts about today that no formula holds. The entry also
// records which formula version it was started from, so a formula change shows in the lot history.
//
// No imports, so scripts/test-batch-sheet-fill.mjs can bundle it.

/** settings.batchSheet on a form: where the formula comes from and which of its fields it fills. */
export interface BatchSheetSettings {
  /** A form number whose entries hold the formula (see FORMULA_FORM). Absent = the batch sheets. */
  source?: string;
  productField: string;
  grid: string;
  columns: { ingredient: string; brand?: string; expected?: string; unit?: string };
  /** A text field that records which formula (and version) the entry was started from. */
  sourceField?: string;
}

export interface ExpectedLine {
  ingredient: string;
  brand: string;
  /** Blank when the formula gives the ingredient no quantity. */
  expected: number | "";
  unit: string;
}

/** A formula, wherever it is kept, in the one shape the fill reads. */
export interface FormulaSource {
  key: string;
  product: string;
  /** Written into the entry's source field, e.g. "FRM-501 v1 (draft)" or "Batch sheet v2". */
  label: string;
  /** Shown in the picker, e.g. "92.5 lb batch"; blank when the formula states no batch size. */
  batch: string;
  /** The customer, where the formula names one. */
  client: string;
  status: string;
  lines: ExpectedLine[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const text = (v: unknown) => String(v ?? "").trim();

// ---------- Quantities written as text ----------

/** The units a lot record's Unit column offers, by the spellings people type. */
const UNIT_SPELLINGS: Record<string, string> = {
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  oz: "oz", ounce: "oz", ounces: "oz",
  g: "g", gram: "g", grams: "g",
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg",
  gal: "gal", gallon: "gal", gallons: "gal",
  "fl oz": "fl oz", floz: "fl oz",
  each: "each", ea: "each",
};

/**
 * "17.49 lb" -> { qty: 17.49, unit: "lb" }. A bare number has no unit. Anything else - a range, two
 * numbers, a unit this does not know - is null: a quantity is never guessed out of a sentence.
 */
export function parseQty(value: unknown): { qty: number; unit: string } | null {
  const m = text(value).toLowerCase().replace(/,/g, "").match(/^(\d+(?:\.\d+)?|\.\d+)\s*([a-z][a-z .]*)?$/);
  if (!m) return null;
  const qty = Number(m[1]);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const raw = (m[2] ?? "").replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (!raw) return { qty, unit: "" };
  const unit = UNIT_SPELLINGS[raw];
  return unit ? { qty, unit } : null;
}

// ---------- "% of Formula" worked out from the quantities ----------

export type ShareResult =
  | { ok: true; rows: Record<string, any>[]; lines: number; blank: number; total: number; unit: string }
  | { ok: false; problem: string };

/**
 * Each row's share of the total of its quantity column, as a percentage to two places that adds
 * up to exactly 100.00 (the rounding difference goes to the largest line). The "Recalculate" link
 * on a column with `shareOf` - FRM-501's % of Formula, from Production Qty.
 *
 * All or nothing. A quantity that cannot be read ("1-2 lb"), or quantities in different units,
 * stops the whole recalculation with a sentence naming the row: a percentage is never worked out
 * from a guess, and a part-recalculated column would not add up. A row with no quantity (a
 * processing aid, a line not yet weighed) gets a blank percentage. `nameColumn` only words the
 * message. Values are written as numbers when `asNumber` (a number column), else as text.
 */
export function recalculateShares(
  rows: Record<string, any>[] | null | undefined,
  pctColumn: string,
  qtyColumn: string,
  opts: { nameColumn?: string; asNumber?: boolean } = {},
): ShareResult {
  const list = Array.isArray(rows) ? rows : [];
  const nameOf = (row: Record<string, any>, i: number) => text(opts.nameColumn ? row?.[opts.nameColumn] : "") || `row ${i + 1}`;
  const read: ({ qty: number; unit: string } | null)[] = [];
  let unit: string | null = null;
  for (const [i, row] of list.entries()) {
    const raw = row?.[qtyColumn];
    if (text(raw) === "" && typeof raw !== "number") { read.push(null); continue; }
    const q = parseQty(raw);
    if (!q) return { ok: false, problem: `The quantity for ${nameOf(row, i)} ("${text(raw) || raw}") cannot be read as one amount, so nothing was recalculated.` };
    if (unit === null) unit = q.unit;
    else if (q.unit !== unit) {
      return { ok: false, problem: `The quantities are not all in the same unit (${nameOf(row, i)} is in ${q.unit || "no unit"}, others in ${unit || "no unit"}), so nothing was recalculated.` };
    }
    read.push(q);
  }
  const lines = read.filter(Boolean).length;
  if (!lines) return { ok: false, problem: "No line has a quantity yet, so there is nothing to work the percentages out from." };

  // Work in hundredths of a percent so the column adds up to exactly 100.00.
  const total = read.reduce((sum, q) => sum + (q?.qty ?? 0), 0);
  const cents = read.map(q => (q ? Math.round((q.qty / total) * 10000) : null));
  const drift = 10000 - cents.reduce((sum: number, c) => sum + (c ?? 0), 0);
  if (drift !== 0) {
    let largest = -1;
    read.forEach((q, i) => { if (q && (largest < 0 || q.qty > read[largest]!.qty)) largest = i; });
    cents[largest] = (cents[largest] ?? 0) + drift;
  }
  const out = list.map((row, i) => {
    const c = cents[i];
    const value = c == null ? "" : opts.asNumber ? c / 100 : (c / 100).toFixed(2);
    return { ...row, [pctColumn]: value };
  });
  return { ok: true, rows: out, lines, blank: list.length - lines, total: Math.round(total * 1000) / 1000, unit: unit ?? "" };
}

// ---------- Source: an entry of the formula form (FRM-501) ----------

/**
 * The formula form and the field ids read from it. Tied to FRM-501's schema: renaming one of these
 * fields means changing it here, and checkFormulaMapping says so on the page instead of the list
 * coming back quietly empty.
 */
export const FORMULA_FORM = {
  number: "FRM-501",
  product: "product_name",
  version: "formula_version",
  batchSize: "scaled_production_batch_size",
  grid: "prototype_formulation_grid",
  columns: { ingredient: "ingredient", brand: "supplier", pct: "pct_of_formula", qty: "production_qty" },
} as const;

/** The part of a form entry this reads. */
export interface FormulaEntry {
  id: string;
  status: string;
  created_at: string;
  data: Record<string, any> | null;
}

/**
 * One line per named ingredient, in the entry's order. The expected quantity is the Production Qty
 * as written ("17.49 lb"); where that is blank or unreadable it is the line's % of Formula of the
 * production batch size. With neither, the line still comes across - its lot has to be recorded -
 * with no quantity.
 */
export function formulaEntrySource(entry: FormulaEntry): FormulaSource {
  const F = FORMULA_FORM;
  const d = entry.data ?? {};
  const batch = parseQty(d[F.batchSize]);
  const rows: any[] = Array.isArray(d[F.grid]) ? d[F.grid] : [];
  const lines: ExpectedLine[] = rows
    .filter(r => text(r?.[F.columns.ingredient]))
    .map(r => {
      const written = parseQty(r[F.columns.qty]);
      const pct = Number(r[F.columns.pct]);
      let expected: number | "" = "", unit = "";
      if (written) {
        expected = round2(written.qty);
        unit = written.unit || batch?.unit || "";
      } else if (batch && text(r[F.columns.pct]) && Number.isFinite(pct) && pct > 0) {
        expected = round2((pct / 100) * batch.qty);
        unit = batch.unit;
      }
      return { ingredient: text(r[F.columns.ingredient]), brand: text(r[F.columns.brand]), expected, unit };
    });
  const version = text(d[F.version]);
  const status = entry.status || "draft";
  return {
    key: entry.id,
    product: text(d[F.product]),
    label: `${F.number}${version ? ` ${version}` : ""}${status === "submitted" ? "" : ` (${status})`}`,
    batch: text(d[F.batchSize]) ? `${text(d[F.batchSize])} batch` : "",
    client: "",
    status,
    lines,
  };
}

/** Field ids FORMULA_FORM names that the live form no longer has. Empty = the mapping holds. */
export function checkFormulaMapping(schema: { sections?: { fields?: any[] }[] } | null | undefined): string[] {
  const F = FORMULA_FORM;
  const fields = (schema?.sections ?? []).flatMap(s => s.fields ?? []);
  const byId = new Map(fields.map(f => [f.id, f]));
  const missing: string[] = [];
  for (const id of [F.product, F.version, F.batchSize, F.grid]) if (!byId.has(id)) missing.push(id);
  const cols = new Set<string>((byId.get(F.grid)?.columns ?? []).map((c: any) => c.id));
  if (byId.has(F.grid)) for (const id of Object.values(F.columns)) if (!cols.has(id)) missing.push(`${F.grid}.${id}`);
  return missing;
}

// ---------- Source: a sales-side batch sheet ----------

/** The part of a batch_sheets row this reads. */
export interface BatchSheetRow {
  id: string;
  version: number;
  status: string;
  data_json: any;
}

export const BATCH_SIZE_UNITS = ["lb", "kg", "g", "oz"] as const;
export type BatchSizeUnit = (typeof BATCH_SIZE_UNITS)[number];

export interface BatchSize { qty: number; unit: BatchSizeUnit; }

/** The sheet's standard batch size, or null when none has been entered. */
export function batchSizeOf(sheet: BatchSheetRow): BatchSize | null {
  const p = sheet.data_json?.product ?? {};
  const qty = Number(p.batch_size);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const unit = (BATCH_SIZE_UNITS as readonly string[]).includes(p.batch_size_unit) ? p.batch_size_unit : "lb";
  return { qty, unit };
}

/**
 * Expected quantity is the ingredient's stored percentage of the standard batch - the same
 * percentages the material estimate reads, so the two cannot disagree. Never the gram column,
 * which is labelled per unit.
 */
export function batchSheetSource(sheet: BatchSheetRow): FormulaSource {
  const size = batchSizeOf(sheet);
  const rows: any[] = Array.isArray(sheet.data_json?.recipe?.ingredients) ? sheet.data_json.recipe.ingredients : [];
  const lines: ExpectedLine[] = rows
    .filter(r => text(r?.name))
    .map(r => {
      const pct = Number(r.percentage);
      const has = size != null && Number.isFinite(pct) && pct > 0;
      return {
        ingredient: text(r.name),
        brand: text(r.vendor_1),
        expected: has ? round2((pct / 100) * size!.qty) : "",
        unit: has ? size!.unit : "",
      };
    });
  const approved = sheet.status === "approved" || sheet.status === "final";
  return {
    key: sheet.id,
    product: text(sheet.data_json?.header?.product_name),
    label: `Batch sheet v${sheet.version}${approved ? "" : ` (${sheet.status || "draft"})`}`,
    batch: size ? `${size.qty} ${size.unit} batch` : "",
    client: text(sheet.data_json?.header?.company_name),
    status: sheet.status || "draft",
    lines,
  };
}

// ---------- The fill ----------

export interface BatchSheetFillResult {
  values: Record<string, any>;
  lines: number;
  warnings: string[];
}

/**
 * Fill `current` from a formula. `gridColumns` are the ids of every column of the target grid, so
 * each new row carries all of them, blank - the lot and the weighed quantities included. The grid
 * is REPLACED: the lines of a lot record are the formula's, and a half-merged list would be worse
 * than either. The caller keeps the previous values for Undo.
 */
export function batchSheetFill(
  cfg: BatchSheetSettings,
  gridColumns: string[],
  current: Record<string, any>,
  source: FormulaSource,
): BatchSheetFillResult {
  const values = { ...current };
  const warnings: string[] = [];

  if (source.product) values[cfg.productField] = source.product;
  else warnings.push("The formula has no product name.");

  if (source.lines.length === 0) {
    warnings.push("The formula has no ingredients, so the table was left as it was.");
  } else {
    values[cfg.grid] = source.lines.map(l => {
      const row: Record<string, any> = {};
      for (const id of gridColumns) row[id] = "";
      row[cfg.columns.ingredient] = l.ingredient;
      if (cfg.columns.brand) row[cfg.columns.brand] = l.brand;
      if (cfg.columns.expected) row[cfg.columns.expected] = l.expected;
      if (cfg.columns.unit) row[cfg.columns.unit] = l.unit;
      return row;
    });
    const missing = source.lines.filter(l => l.expected === "").map(l => l.ingredient);
    if (missing.length === source.lines.length) {
      warnings.push("The formula gives no quantities, so the expected quantities are blank. Enter the quantity per batch on the formula.");
    } else if (missing.length) {
      warnings.push(`No expected quantity on the formula for: ${missing.join(", ")}.`);
    }
    const noUnit = source.lines.filter(l => l.expected !== "" && !l.unit).map(l => l.ingredient);
    if (noUnit.length) warnings.push(`No unit on the formula for: ${noUnit.join(", ")}.`);
  }

  if (cfg.sourceField) values[cfg.sourceField] = source.label;
  return { values, lines: source.lines.length, warnings };
}
