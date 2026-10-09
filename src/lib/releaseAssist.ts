// Release record helper (FRM-701, FSQM-020): pick the product and the lot, and what the site's
// records already say about that lot is looked up for the person releasing it. Pure - no imports -
// so scripts/test-release-assist.mjs can bundle it. The page supplies the records.
//
// THE RULE THIS FILE EXISTS TO KEEP: it fills in FACTS and EVIDENCE, never a Result. FSQM-020 says
// the SQF Practitioner "shall confirm each" release check; a Pass the form answered by itself would
// be a confirmation nobody made. So a check's Note arrives saying what the records show, with the
// gaps stated as plainly as the finds, and the Pass / Fail tap stays with the person. The three pack
// weights are never filled in either - they are the measurement.
//
// It must also never come back quietly empty. "No FRM-903 found for 2026-09-30" is evidence; a blank
// note that could mean "all fine" or "nobody looked" is not.

/** The form this fills, and the answer keys it writes. */
export const RELEASE_FORM = "FRM-701";
export const RELEASE_TARGET = {
  product: "product_name",
  lot: "lot_code",
  checks: "checks",
  note: "note",
  fields: ["batch_sheet_ref", "date_produced", "customer", "net_weight_declared", "packaging_tare",
    "net_weight_unit", "approved_label_ref", "label_version"],
} as const;

/** `optional` keys are read when present but not required of the form: FRM-606 carried the lot on each row before its v2 and once at the top since. */
export interface ReleaseSourceSpec { form: string; fields: readonly string[]; grids: Record<string, readonly string[]>; optional?: readonly string[] }

/** The single map of form numbers to the answer keys read. Rename a field on one of these forms, update this. */
export const RELEASE_SOURCES = {
  lots:     { form: "FRM-520", fields: ["product", "lot_code", "bake_date", "pack_date", "units_packed", "film_lot", "code_check"], grids: { ingredients: ["supplier_lot"] } },
  releases: { form: "FRM-701", fields: ["product_name", "lot_code", "customer", "net_weight_declared", "packaging_tare", "net_weight_unit", "approved_label_ref", "label_version"], grids: {} },
  holds:    { form: "FRM-702", fields: ["hold_tag_number", "material_name_description", "supplier_lot_batch_number", "final_disposition_decision"], grids: {} },
  preops:   { form: "FRM-903", fields: ["inspection_date", "area_line", "shift"], grids: {} },
  labels:   { form: "FRM-601", fields: ["product_name", "label_artwork_version", "controlled_label_id", "customer_brand", "approval_evidence", "approval_date"], grids: {} },
  specs:    { form: "FRM-704", fields: ["product_name", "customer_brand", "net_weight"], grids: {} },
  // FRM-507 named the product once at the top until its v2 (2026-10-09) and on each oven load since.
  baking:   { form: "FRM-507", fields: ["production_date"], optional: ["product"], grids: { oven_loads: ["product", "lot_code", "within_limits"] } },
  sealing:  { form: "FRM-606", fields: ["production_date", "product"], optional: ["lot_code"], grids: { seal_checks: ["lot_code", "visual", "pull_test"] } },
} as const satisfies Record<string, ReleaseSourceSpec>;

export type ReleaseKind = keyof typeof RELEASE_SOURCES;

export interface ReleaseEntry {
  id: string;
  status: string;            // "draft" | "submitted"
  date: string | null;       // submitted_at, else created_at (ISO)
  data: Record<string, any>; // only the mapped keys
}
export type ReleaseRecords = Record<ReleaseKind, ReleaseEntry[]>;

export function emptyReleaseRecords(): ReleaseRecords {
  return Object.fromEntries(Object.keys(RELEASE_SOURCES).map(k => [k, []])) as unknown as ReleaseRecords;
}

/**
 * Field ids this file reads that a live schema no longer has ("FRM-903 no longer has inspection_date").
 * A form that is missing altogether is reported once. Shown on the page, so a renamed field reads as
 * a warning and not as "no record found".
 */
export function checkReleaseMapping(fieldIdsByForm: Record<string, string[] | undefined>): string[] {
  const problems: string[] = [];
  for (const spec of Object.values(RELEASE_SOURCES) as ReleaseSourceSpec[]) {
    const ids = fieldIdsByForm[spec.form];
    if (!ids) { problems.push(`${spec.form} was not found`); continue; }
    for (const k of [...spec.fields, ...Object.keys(spec.grids)]) {
      if (!ids.includes(k)) problems.push(`${spec.form} no longer has "${k}"`);
    }
  }
  return [...new Set(problems)];
}

// ---------- Normalising ----------

/** Lot codes compared without case, spaces or punctuation: "L-123 a" = "l123A". */
export function normLot(v: unknown): string {
  return String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Names compared without case, accents or punctuation. */
export function normName(v: unknown): string {
  return String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Two names for one product: equal, or one contains the other. A blank matches nothing here. */
export function sameProduct(a: unknown, b: unknown): boolean {
  const x = normName(a), y = normName(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const day = (v: unknown) => str(v).slice(0, 10);
const isDraft = (e: ReleaseEntry) => e.status !== "submitted";
const rowsOf = (e: ReleaseEntry, grid: string): Record<string, any>[] =>
  Array.isArray(e.data?.[grid]) ? e.data[grid].filter((r: any) => r && typeof r === "object") : [];
/** Submitted before draft, then newest first. */
const best = (a: ReleaseEntry, b: ReleaseEntry) =>
  Number(isDraft(a)) - Number(isDraft(b)) || str(b.date).localeCompare(str(a.date));
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

// ---------- The two lists ----------

export interface Suggestion { value: string; hint?: string }

/** Every product the site has released, made or specified - one line each, most recently used first. */
export function productOptions(records: ReleaseRecords): Suggestion[] {
  const seen = new Map<string, { value: string; last: string; releases: number; lots: number }>();
  const add = (name: unknown, date: string | null, kind: "release" | "lot" | "spec") => {
    const value = str(name);
    const key = normName(value);
    if (!key) return;
    const cur = seen.get(key) ?? { value, last: "", releases: 0, lots: 0 };
    if (kind === "release") cur.releases++;
    if (kind === "lot") cur.lots++;
    if (str(date) > cur.last) cur.last = str(date);
    seen.set(key, cur);
  };
  // The specification's spelling is the controlled one, so it is read first and kept.
  for (const e of records.specs) add(e.data.product_name, null, "spec");
  for (const e of records.lots) add(e.data.product, e.date, "lot");
  for (const e of records.releases) add(e.data.product_name, e.date, "release");
  return [...seen.values()]
    .sort((a, b) => b.last.localeCompare(a.last) || a.value.localeCompare(b.value))
    .map(p => ({
      value: p.value,
      hint: p.releases ? `${plural(p.releases, "release")} on record`
        : p.lots ? "made, not yet released" : "on the specification list",
    }));
}

/** Is there already a release record for this product and lot, other than the one being filled? */
function released(records: ReleaseRecords, product: string, lot: string, selfId: string | null): boolean {
  const key = normLot(lot);
  return records.releases.some(r => r.id !== selfId && normLot(r.data.lot_code) === key && sameProduct(r.data.product_name, product));
}

/**
 * The product's lots from the Production Lot Record that have no release record yet, newest first.
 * A lot is product + code: two products baked the same day share a code.
 */
export function lotOptions(records: ReleaseRecords, product: string, selfId: string | null): Suggestion[] {
  if (!normName(product)) return [];
  const byLot = new Map<string, ReleaseEntry>();
  for (const e of [...records.lots].sort(best)) {
    const key = normLot(e.data.lot_code);
    if (!key || !sameProduct(e.data.product, product) || byLot.has(key)) continue;
    if (released(records, product, key, selfId)) continue;
    byLot.set(key, e);
  }
  return [...byLot.values()]
    .sort((a, b) => day(b.data.bake_date).localeCompare(day(a.data.bake_date)))
    .map(e => ({
      value: str(e.data.lot_code),
      hint: [
        day(e.data.bake_date) && `baked ${day(e.data.bake_date)}`,
        str(e.data.units_packed) && `${str(e.data.units_packed)} packed`,
        isDraft(e) && "lot record is a draft",
      ].filter(Boolean).join(" · "),
    }));
}

// ---------- What the records say ----------

/** The release checks this can give evidence for, found by how their row label begins. */
export const CHECK_ROWS = {
  batch: "Batch sheet complete",
  preop: "Line pre-operation",
  hold: "No hold applies",
  label: "Label is the approved label",
  code: "Date and lot code",
  quantity: "Quantity and pack configuration",
} as const;
export type CheckKey = keyof typeof CHECK_ROWS;

export interface ReleaseFill {
  /** Answers for top-level fields, keyed by field id. Only keys with something to say. */
  fields: Record<string, string | number>;
  /** Evidence for a check's Note, keyed by check. */
  notes: Partial<Record<CheckKey, string>>;
  /** Things the person should know that are not an answer: no lot record, an earlier release found. */
  warnings: string[];
}

/** "FRM-507: 3 loads for this lot, all within limits" - or what is missing, said plainly. */
function ccpLine(form: string, what: string, entries: ReleaseEntry[], grid: string, product: string, lot: string, passKeys: string[]): string {
  // A lot is product + code, so a row that names another product is not this lot's. One that
  // names no product is kept: leaving it out would hide a load that may belong here.
  // The product and the lot are on the row where the form asks for them per row, otherwise they
  // are the entry's own.
  const rows = entries
    .flatMap(e => rowsOf(e, grid)
      .filter(r => {
        const named = normName(r.product) ? r.product : e.data.product;
        return !normName(named) || sameProduct(named, product);
      })
      .filter(r => normLot(str(r.lot_code) ? r.lot_code : e.data.lot_code) === normLot(lot))
      .map(r => ({ r, draft: isDraft(e) })));
  if (rows.length === 0) return `${form}: no ${what} recorded for this lot.`;
  const failed = rows.filter(({ r }) => passKeys.some(k => str(r[k]).toLowerCase() === "fail")).length;
  // A row may carry one check only (a pull test at boxing, a visual at sealing): unanswered means none at all.
  const unanswered = rows.filter(({ r }) => passKeys.every(k => !str(r[k]))).length;
  const drafts = rows.some(x => x.draft) ? " (record still a draft)" : "";
  const verdict = failed ? `${failed} FAILED` : unanswered ? `${unanswered} not yet answered` : "all passed";
  return `${form}: ${plural(rows.length, what)} for this lot, ${verdict}${drafts}.`;
}

/**
 * Everything the records can say about releasing `lot` of `product`. With no lot yet, only what
 * comes from the product's last release is returned, so picking the product alone is still useful.
 */
export function releaseFill(records: ReleaseRecords, product: string, lot: string, selfId: string | null): ReleaseFill {
  const fill: ReleaseFill = { fields: {}, notes: {}, warnings: [] };
  if (!normName(product)) return fill;
  const put = (id: string, v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) fill.fields[id] = v;
    else if (str(v)) fill.fields[id] = str(v);
  };

  // --- From the product: its last release, then its specification, then its label approval.
  const previous = records.releases
    .filter(r => r.id !== selfId && sameProduct(r.data.product_name, product))
    .sort(best)[0];
  const spec = records.specs.filter(s => sameProduct(s.data.product_name, product)).sort(best)[0];
  const labels = records.labels.filter(l => sameProduct(l.data.product_name, product)).sort(best);
  const approved = labels.find(l => !isDraft(l) && str(l.data.approval_evidence));

  put("customer", previous?.data.customer ?? spec?.data.customer_brand ?? approved?.data.customer_brand);
  put("net_weight_declared", previous?.data.net_weight_declared ?? spec?.data.net_weight);
  if (previous) {
    const tare = previous.data.packaging_tare;
    put("packaging_tare", str(tare) !== "" && Number.isFinite(Number(tare)) ? Number(tare) : undefined);
    put("net_weight_unit", previous.data.net_weight_unit);
  }
  put("approved_label_ref", previous?.data.approved_label_ref ?? approved?.data.controlled_label_id);
  put("label_version", previous?.data.label_version ?? approved?.data.label_artwork_version);

  fill.notes.label = approved
    ? `FRM-601: label ${str(approved.data.label_artwork_version) || "(no version written)"} approved${day(approved.data.approval_date) ? ` ${day(approved.data.approval_date)}` : ""}. Check it is the label on this pack.`
    : labels.length
      ? "FRM-601: a label review exists for this product but is not approved yet."
      : "FRM-601: no label approval found for this product.";

  const key = normLot(lot);
  if (!key) return fill;

  if (released(records, product, key, selfId)) {
    fill.warnings.push(`There is already a release record for ${product} lot ${str(lot)}.`);
  }

  // --- From the lot: the Production Lot Record.
  const lotRec = records.lots
    .filter(e => normLot(e.data.lot_code) === key && sameProduct(e.data.product, product))
    .sort(best)[0];
  const sameCodeOther = records.lots.filter(e => normLot(e.data.lot_code) === key && !sameProduct(e.data.product, product));

  const baked = day(lotRec?.data.bake_date);
  const packed = day(lotRec?.data.pack_date);
  const dates = [...new Set([baked, packed].filter(Boolean))];

  if (lotRec) {
    put("batch_sheet_ref", `FRM-520 lot ${str(lotRec.data.lot_code)}`);
    put("date_produced", baked);
  } else {
    fill.warnings.push(
      `No Production Lot Record (FRM-520) found for ${product} lot ${str(lot)}.`
      + (sameCodeOther.length ? ` The same code is on ${plural(sameCodeOther.length, "record")} for another product.` : ""));
  }

  fill.notes.batch = [
    lotRec
      ? `FRM-520 lot ${str(lotRec.data.lot_code)}${baked ? `, baked ${baked}` : ""}: ${isDraft(lotRec) ? "still a DRAFT - not complete" : `submitted ${day(lotRec.date)}`}.`
      : "FRM-520: no lot record found for this lot.",
    ccpLine("FRM-507", "oven load", records.baking, "oven_loads", product, lot, ["within_limits"]),
    ccpLine("FRM-606", "sealing check", records.sealing, "seal_checks", product, lot, ["visual", "pull_test"]),
  ].join(" ");

  if (dates.length === 0) {
    fill.notes.preop = "FRM-903: the production date is not known, so no pre-operation record could be looked up.";
  } else {
    fill.notes.preop = dates.map(d => {
      const found = records.preops.filter(p => day(p.data.inspection_date) === d).sort(best);
      if (found.length === 0) return `FRM-903: none found for ${d}.`;
      const where = [...new Set(found.map(p => str(p.data.area_line)).filter(Boolean))].join(", ");
      return `FRM-903 ${d}${where ? ` (${where})` : ""}: ${found.every(isDraft) ? "still a DRAFT" : "submitted"}.`;
    }).join(" ");
  }

  // Holds are matched on lot codes only: this lot, and every supplier and film lot that went into it.
  const inputs = lotRec
    ? [...rowsOf(lotRec, "ingredients").map(r => normLot(r.supplier_lot)), normLot(lotRec.data.film_lot)].filter(Boolean)
    : [];
  const codes = new Set([key, ...inputs]);
  const holds = records.holds.filter(h => codes.has(normLot(h.data.supplier_lot_batch_number)));
  fill.notes.hold = holds.length === 0
    ? `FRM-702: no hold names lot ${str(lot)}${inputs.length ? ` or the ${plural(new Set(inputs).size, "supplier lot")} used in it` : ""}.`
    : holds.map(h => {
        const tag = str(h.data.hold_tag_number) || "(no tag number)";
        const decided = str(h.data.final_disposition_decision);
        return `FRM-702 hold ${tag} on ${str(h.data.material_name_description) || "a material"} lot ${str(h.data.supplier_lot_batch_number)}: ${decided ? `decided - ${decided.split(":")[0]}` : "OPEN, no decision yet"}.`;
      }).join(" ");

  if (lotRec && str(lotRec.data.code_check)) fill.notes.code = `FRM-520, code on the pack at packing: ${str(lotRec.data.code_check)}. Check a pack from this lot.`;
  if (lotRec && str(lotRec.data.units_packed)) fill.notes.quantity = `FRM-520: ${str(lotRec.data.units_packed)} packed.`;

  return fill;
}

// ---------- Putting it into the entry ----------

export interface AssistResult {
  values: Record<string, any>;
  /** What this helper last wrote, by path ("customer", "checks.2.note"). Carried to the next call. */
  auto: Record<string, string | number>;
  /** Labels of what changed this time, for the banner. */
  changed: string[];
}

/**
 * Write a fill into the entry's values. A cell is written only if it is EMPTY, or still holds exactly
 * what this helper last put there - so choosing a different lot updates the looked-up answers, and
 * anything the person typed is left alone. A cell the helper wrote and now has nothing for is
 * cleared. Result cells and pack weights are never touched: they are not in the fill.
 */
export function applyReleaseFill(
  values: Record<string, any>,
  fill: ReleaseFill,
  lastAuto: Record<string, string | number>,
  checkLabels: string[],
  fieldLabels: Record<string, string> = {},
): AssistResult {
  const next: Record<string, any> = { ...values };
  const auto: Record<string, string | number> = {};
  const changed: string[] = [];
  const same = (a: unknown, b: unknown) => str(a) === str(b);
  const writable = (path: string, current: unknown) => str(current) === "" || (path in lastAuto && same(current, lastAuto[path]));

  for (const id of RELEASE_TARGET.fields) {
    const want = fill.fields[id];
    const current = next[id];
    if (!writable(id, current)) continue;
    if (want === undefined) {
      if (id in lastAuto && str(current) !== "") { next[id] = ""; changed.push(fieldLabels[id] ?? id); }
      continue;
    }
    auto[id] = want;
    if (!same(current, want)) { next[id] = want; changed.push(fieldLabels[id] ?? id); }
  }

  const rows: Record<string, any>[] = Array.isArray(next[RELEASE_TARGET.checks])
    ? next[RELEASE_TARGET.checks].map((r: any) => ({ ...(r ?? {}) })) : [];
  let rowsChanged = false;
  for (const [check, prefix] of Object.entries(CHECK_ROWS) as [CheckKey, string][]) {
    const i = checkLabels.findIndex(l => l.startsWith(prefix));
    if (i < 0) continue;
    while (rows.length <= i) rows.push({});
    const path = `${RELEASE_TARGET.checks}.${i}.${RELEASE_TARGET.note}`;
    const want = fill.notes[check];
    const current = rows[i][RELEASE_TARGET.note];
    if (!writable(path, current)) continue;
    if (want === undefined) {
      if (path in lastAuto && str(current) !== "") { rows[i][RELEASE_TARGET.note] = ""; rowsChanged = true; }
      continue;
    }
    auto[path] = want;
    if (!same(current, want)) {
      rows[i][RELEASE_TARGET.note] = want;
      rowsChanged = true;
      changed.push(`evidence for "${prefix}"`);
    }
  }
  if (rowsChanged) next[RELEASE_TARGET.checks] = rows;

  return { values: next, auto, changed };
}

/**
 * Which cells of an entry still hold exactly what the helper would have written for a product and
 * lot. Used when a saved entry is reopened: nothing remembers what was looked up last time, so the
 * cells that match are taken to be the helper's and may be updated; anything else was typed.
 */
export function autoFromFill(values: Record<string, any>, fill: ReleaseFill, checkLabels: string[]): Record<string, string | number> {
  const auto: Record<string, string | number> = {};
  for (const id of RELEASE_TARGET.fields) {
    const want = fill.fields[id];
    if (want !== undefined && str(values[id]) === str(want)) auto[id] = want;
  }
  const rows: Record<string, any>[] = Array.isArray(values[RELEASE_TARGET.checks]) ? values[RELEASE_TARGET.checks] : [];
  for (const [check, prefix] of Object.entries(CHECK_ROWS) as [CheckKey, string][]) {
    const i = checkLabels.findIndex(l => l.startsWith(prefix));
    const want = fill.notes[check];
    if (i < 0 || want === undefined) continue;
    if (str(rows[i]?.[RELEASE_TARGET.note]) === want) auto[`${RELEASE_TARGET.checks}.${i}.${RELEASE_TARGET.note}`] = want;
  }
  return auto;
}

// ---------- Lot first ----------

export interface LotSuggestion extends Suggestion { product: string }

/**
 * Every lot on the Production Lot Record that has no release record yet, newest bake first, each
 * with its product. The lot code is what is printed on the pack in the releaser's hand, so the form
 * starts from it. One code baked as two products is two lines: a lot is product + code.
 */
export function unreleasedLots(records: ReleaseRecords, selfId: string | null): LotSuggestion[] {
  const seen = new Map<string, ReleaseEntry>();
  for (const e of [...records.lots].sort(best)) {
    const lot = normLot(e.data.lot_code);
    const product = normName(e.data.product);
    if (!lot || !product) continue;
    const key = `${lot}|${product}`;
    if (seen.has(key) || released(records, str(e.data.product), lot, selfId)) continue;
    seen.set(key, e);
  }
  return [...seen.values()]
    .sort((a, b) => day(b.data.bake_date).localeCompare(day(a.data.bake_date)) || str(a.data.product).localeCompare(str(b.data.product)))
    .map(e => ({
      value: str(e.data.lot_code),
      product: str(e.data.product),
      hint: [
        str(e.data.product),
        day(e.data.bake_date) && `baked ${day(e.data.bake_date)}`,
        str(e.data.units_packed) && `${str(e.data.units_packed)} packed`,
        isDraft(e) && "lot record is a draft",
      ].filter(Boolean).join(" \u00b7 "),
    }));
}

/** The products a lot code is recorded against on the Production Lot Record, one spelling each. */
export function productsForLot(records: ReleaseRecords, lot: string): string[] {
  const key = normLot(lot);
  if (!key) return [];
  const seen = new Map<string, string>();
  for (const e of [...records.lots].sort(best)) {
    if (normLot(e.data.lot_code) !== key) continue;
    const name = str(e.data.product);
    if (normName(name) && !seen.has(normName(name))) seen.set(normName(name), name);
  }
  return [...seen.values()];
}

/** The product list with the products made under `lot` moved to the top and marked. */
export function productOptionsForLot(records: ReleaseRecords, lot: string): Suggestion[] {
  const made = productsForLot(records, lot);
  const all = productOptions(records);
  if (made.length === 0) return all;
  const isMade = (v: string) => made.some(m => normName(m) === normName(v));
  return [
    ...all.filter(o => isMade(o.value)).map(o => ({ value: o.value, hint: `lot ${str(lot)} on FRM-520` })),
    ...all.filter(o => !isMade(o.value)),
  ];
}
