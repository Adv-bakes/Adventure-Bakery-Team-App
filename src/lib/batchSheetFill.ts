// Start a production lot record from the product's batch sheet (settings.batchSheet; FRM-520).
//
// The batch sheet is the master formula: what the product is supposed to contain. The lot record is
// what went in on one bake day. Before this the two were unrelated, and the formula lived in
// whichever earlier lot record somebody happened to copy from.
//
// What comes across is the STANDARD, never a measurement: the product, one line per ingredient with
// its brand, and the expected quantity per batch (the ingredient's share of the sheet's standard
// batch size). The lot on the container and the weighed quantities are left blank - they are facts
// about today that no batch sheet holds. The entry also records which batch sheet version it was
// started from, so a formula change shows in the lot history.
//
// No imports, so scripts/test-batch-sheet-fill.mjs can bundle it.

/** settings.batchSheet on a form: which of its fields the batch sheet fills. */
export interface BatchSheetSettings {
  productField: string;
  grid: string;
  columns: { ingredient: string; brand?: string; expected?: string; unit?: string };
  /** A text field that records which batch sheet (and version) the entry was started from. */
  sourceField?: string;
}

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

export const batchSheetProduct = (sheet: BatchSheetRow): string =>
  String(sheet.data_json?.header?.product_name ?? "").trim();

/** How the entry names its source, e.g. "Batch sheet v2" or "Batch sheet v1 (draft)". */
export function batchSheetLabel(sheet: BatchSheetRow): string {
  const approved = sheet.status === "approved" || sheet.status === "final";
  return `Batch sheet v${sheet.version}${approved ? "" : ` (${sheet.status || "draft"})`}`;
}

export interface ExpectedLine {
  ingredient: string;
  brand: string;
  /** Blank when the sheet gives the ingredient no share, or has no batch size. */
  expected: number | "";
  unit: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * One line per named ingredient, in the sheet's order. Expected quantity is the ingredient's
 * percentage of the standard batch - the same stored percentages the material estimate reads, so
 * the two cannot disagree. An ingredient with no percentage (a processing aid that is not weighed)
 * still gets its line, because its lot has to be recorded.
 */
export function expectedLines(sheet: BatchSheetRow): ExpectedLine[] {
  const size = batchSizeOf(sheet);
  const rows: any[] = Array.isArray(sheet.data_json?.recipe?.ingredients) ? sheet.data_json.recipe.ingredients : [];
  return rows
    .filter(r => String(r?.name ?? "").trim())
    .map(r => {
      const pct = Number(r.percentage);
      const has = size != null && Number.isFinite(pct) && pct > 0;
      return {
        ingredient: String(r.name).trim(),
        brand: String(r.vendor_1 ?? "").trim(),
        expected: has ? round2((pct / 100) * size!.qty) : "",
        unit: has ? size!.unit : "",
      };
    });
}

export interface BatchSheetFillResult {
  values: Record<string, any>;
  lines: number;
  warnings: string[];
}

/**
 * Fill `current` from the batch sheet. `gridColumns` are the ids of every column of the target
 * grid, so each new row carries all of them, blank - the lot and the weighed quantities included.
 * The grid is REPLACED: the lines of a lot record are the formula's, and a half-merged list would
 * be worse than either. The caller keeps the previous values for Undo.
 */
export function batchSheetFill(
  cfg: BatchSheetSettings,
  gridColumns: string[],
  current: Record<string, any>,
  sheet: BatchSheetRow,
): BatchSheetFillResult {
  const values = { ...current };
  const warnings: string[] = [];
  const lines = expectedLines(sheet);
  const product = batchSheetProduct(sheet);

  if (product) values[cfg.productField] = product;
  else warnings.push("The batch sheet has no product name.");

  if (lines.length === 0) {
    warnings.push("The batch sheet has no ingredients, so the table was left as it was.");
  } else {
    values[cfg.grid] = lines.map(l => {
      const row: Record<string, any> = {};
      for (const id of gridColumns) row[id] = "";
      row[cfg.columns.ingredient] = l.ingredient;
      if (cfg.columns.brand) row[cfg.columns.brand] = l.brand;
      if (cfg.columns.expected) row[cfg.columns.expected] = l.expected;
      if (cfg.columns.unit) row[cfg.columns.unit] = l.unit;
      return row;
    });
    if (!batchSizeOf(sheet)) {
      warnings.push("The batch sheet has no standard batch size, so the expected quantities are blank. Enter it on the batch sheet.");
    } else {
      const missing = lines.filter(l => l.expected === "").map(l => l.ingredient);
      if (missing.length) warnings.push(`No expected quantity on the batch sheet for: ${missing.join(", ")}.`);
    }
  }

  if (cfg.sourceField) values[cfg.sourceField] = batchSheetLabel(sheet);
  return { values, lines: lines.length, warnings };
}
