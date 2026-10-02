// Lot trace + recall workspace, pure half (no imports, so scripts/test-lot-trace.mjs can bundle it).
//
// WHY THIS EXISTS. A recall touches eight forms and the person running it is under stress. Every one
// of those forms already carries the lot codes; nothing joined them. Given a supplier lot ("soybean
// oil, lot X") or one of our own lot codes, this finds every finished lot involved, what went into
// it and its receipt (FRM-520 -> FRM-301), who collected it (FRM-801), its retention sample
// (FRM-703), release (FRM-701) and holds (FRM-702), and the customers' contacts (FRM-011) - so the
// records are pulled, not hunted for (FSQM-023, FSQM-021).
//
// THE FAILURE THIS MUST NOT HAVE is a trace that comes back quietly empty. So: lots are compared
// normalised (case, spaces and dashes ignored); a record with the same code under a different
// product name is shown as "check this", never dropped; drafts are included and flagged; and
// checkTraceMapping reports a form whose field ids have moved instead of letting it read as
// "nothing found". What the records cannot say is listed in `gaps`, computed here, not by a model.

// ---------- The one mapping of forms -> field ids ----------

export interface TraceFormSpec {
  form: string;
  fields: string[];
  grids: Record<string, string[]>;
}

/** Every source form the trace reads, and the answer keys it reads from each. */
export const TRACE_FORMS = {
  lots:       { form: "FRM-520", fields: ["product", "lot_code", "bake_date", "units_packed", "film_lot"], grids: { ingredients: ["ingredient", "brand", "supplier_lot"] } },
  receipts:   { form: "FRM-301", fields: [], grids: { receiving_log: ["supplier_name", "brand_manufacturer", "material_description", "lot_batch_number", "qty_received"] } },
  dispatches: { form: "FRM-801", fields: ["dispatch_date", "customer"], grids: { loaded: ["product", "lot_code", "quantity"] } },
  retention:  { form: "FRM-703", fields: ["product_name", "lot_code", "customer", "units_retained", "storage_location", "disposition"], grids: {} },
  releases:   { form: "FRM-701", fields: ["product_name", "lot_code", "quantity_released", "customer", "decision"], grids: {} },
  holds:      { form: "FRM-702", fields: ["hold_tag_number", "material_name_description", "supplier_name", "supplier_lot_batch_number", "total_quantity_placed_on_hold", "detailed_description_of_issue", "final_disposition_decision"], grids: {} },
  contacts:   { form: "FRM-011", fields: ["reviewed_on"], grids: { contacts: ["group", "name", "phone", "email", "when"] } },
} as const satisfies Record<string, TraceFormSpec>;

export type TraceKind = keyof typeof TRACE_FORMS;

/** The recall record the trace fills, and the answer keys it writes. */
export const RECALL_FORM = "FRM-012";
export const RECALL_TYPES = { mock: "Mock recall test", withdrawal: "Withdrawal", recall: "Recall" } as const;
export const RECALL_TRIGGERS = { material: "An ingredient or packaging lot", lot: "One of our lots" } as const;
const RECALL_TARGET: TraceFormSpec = {
  form: RECALL_FORM,
  fields: ["record_type", "started", "trigger", "material", "material_lot", "material_supplier", "brand_owner", "product", "lot_codes",
    "hold_ref", "decision", "decided_at", "completed", "contacts_checked", "gaps", "capa_no", "recovered", "closed_by"],
  grids: {
    trace_back: ["finished_lot", "ingredient", "supplier", "supplier_lot", "received", "found", "source"],
    trace_forward: ["finished_lot", "product", "customer", "quantity", "collected", "source"],
    reconciliation: ["finished_lot", "product", "packed", "collected", "on_site", "retained", "disposed", "unaccounted", "source"],
    notifications: ["who"],
  },
};
export const CUSTOMER_GROUP = "Customer (brand owner)";
const ESSENTIAL_GROUPS = ["SQF", "Authority"];

// ---------- Records ----------

export interface TraceEntry {
  id: string;
  docId: string;
  status: string;              // "draft" | "submitted"
  date: string | null;         // submitted_at, else created_at (ISO)
  data: Record<string, any>;   // only the mapped keys
}
export type TraceRecords = Record<TraceKind, TraceEntry[]>;

/** A link to one source entry. */
export interface RecordRef {
  form: string;
  docId: string;
  id: string;
  title: string;
  draft: boolean;
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

/** Two free-text names for the same thing: equal, or one contains the other; a blank matches anything. */
export function namesMatch(a: unknown, b: unknown): boolean {
  const x = normName(a), y = normName(b);
  if (!x || !y) return true;
  return x === y || x.includes(y) || y.includes(x);
}

/** A lot cell that says there is no lot (mains water): not a missing receipt. */
const NO_LOT = /\bno lot\b|^n\/?a$|^none$/i;
const str = (v: unknown) => (v == null ? "" : String(v).trim());
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const rowsOf = (e: TraceEntry, grid: string): Record<string, any>[] =>
  Array.isArray(e.data?.[grid]) ? e.data[grid].filter((r: any) => r && typeof r === "object") : [];
const isDraft = (e: TraceEntry) => e.status !== "submitted";

function ref(kind: TraceKind, e: TraceEntry, title: string): RecordRef {
  const form = TRACE_FORMS[kind].form;
  return { form, docId: e.docId, id: e.id, title: `${form} ${title}`.trim(), draft: isDraft(e) };
}

/** The hidden per-row pointer back to the source entry, kept on rows written into FRM-012. */
export const srcKey = (r: RecordRef) => `${r.docId}/${r.id}`;

// ---------- Quantities (free text) ----------

/** "12 cases" -> { n: 12, unit: "cases" }; null when it does not start with a number. */
export function parseQty(v: unknown): { n: number; unit: string } | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(String(v ?? ""));
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return { n, unit: normName(m[2]).replace(/s$/, "") };
}

/** Sum of free-text quantities, or null when any is unreadable or the units differ. */
export function sumQty(values: unknown[]): string | null {
  const parsed = values.map(parseQty);
  if (parsed.length === 0 || parsed.some(p => !p)) return null;
  const units = new Set(parsed.map(p => p!.unit));
  if (units.size > 1) return null;
  const total = Math.round(parsed.reduce((a, p) => a + p!.n, 0) * 1000) / 1000;
  const unit = [...units][0];
  return unit ? `${total} ${unit}` : String(total);
}

// ---------- Result ----------

export interface ReceiptLine { supplier: string; material: string; qty: string; date: string; ref: RecordRef }
export interface InputLine {
  ingredient: string;
  brand: string;
  supplierLot: string;
  /** This is the lot the trace started from. */
  trigger: boolean;
  receipts: ReceiptLine[];
  ref: RecordRef;
}
export interface DispatchLine { customer: string; product: string; quantity: string; date: string; ref: RecordRef }
export interface RetentionLine { product: string; customer: string; units: string; location: string; disposition: string; ref: RecordRef }
export interface ReleaseLine { product: string; customer: string; quantity: string; decision: string; ref: RecordRef }
export interface HoldLine { tag: string; material: string; lot: string; quantity: string; disposition: string; ref: RecordRef }

export interface LotTrace {
  lotCode: string;
  product: string;
  bakeDate: string;
  unitsPacked: string;
  /** The FRM-520 record(s) of this lot; empty when the lot has none. */
  records: RecordRef[];
  inputs: InputLine[];
  dispatches: DispatchLine[];
  retention: RetentionLine[];
  releases: ReleaseLine[];
  /** Records carrying this lot code under a product name that does not match - shown, never dropped. */
  otherProduct: RecordRef[];
}

export interface ContactRow { label: string; group: string; name: string; phone: string; email: string; when: string }
export interface CustomerContacts { customer: string; rows: ContactRow[]; matched: boolean }

export interface TraceStart {
  kind: "material" | "lot";
  /** The supplier lot (material) or our lot code (lot). */
  lot: string;
  /** Ingredient name (material) or product name (lot); optional. */
  name?: string;
}

export interface TraceResult {
  start: TraceStart;
  lots: LotTrace[];
  /** Material start only: the receipts of the lot itself. */
  materialReceipts: ReceiptLine[];
  holds: HoldLine[];
  customers: CustomerContacts[];
  essential: ContactRow[];
  contactList: (RecordRef & { reviewedOn: string }) | null;
  gaps: string[];
}

// ---------- The trace ----------

function receiptIndex(records: TraceRecords): Map<string, ReceiptLine[]> {
  const idx = new Map<string, ReceiptLine[]>();
  for (const e of records.receipts) {
    for (const r of rowsOf(e, "receiving_log")) {
      const key = normLot(r.lot_batch_number);
      if (!key) continue;
      const line: ReceiptLine = {
        supplier: str(r.supplier_name) || str(r.brand_manufacturer),
        material: str(r.material_description),
        qty: str(r.qty_received),
        date: day(e.date),
        ref: ref("receipts", e, `received ${day(e.date)}`),
      };
      idx.set(key, [...(idx.get(key) ?? []), line]);
    }
  }
  return idx;
}

function lotTitle(e: TraceEntry): string {
  return [str(e.data.lot_code), str(e.data.product)].filter(Boolean).join(" - ");
}

function buildLot(records: TraceRecords, receipts: Map<string, ReceiptLine[]>, code: string, product: string,
  entries: TraceEntry[], triggerLot: string): LotTrace {
  const key = normLot(code);
  const inputs: InputLine[] = [];
  for (const e of entries) {
    const r520 = ref("lots", e, lotTitle(e));
    for (const row of rowsOf(e, "ingredients")) {
      const lot = str(row.supplier_lot);
      if (!str(row.ingredient) && !lot) continue;
      inputs.push({
        ingredient: str(row.ingredient), brand: str(row.brand), supplierLot: lot,
        trigger: !!triggerLot && normLot(lot) === triggerLot,
        receipts: lot ? receipts.get(normLot(lot)) ?? [] : [],
        ref: r520,
      });
    }
    const film = str(e.data.film_lot);
    if (film) {
      inputs.push({
        ingredient: "Film / bag", brand: "", supplierLot: film,
        trigger: !!triggerLot && normLot(film) === triggerLot,
        receipts: receipts.get(normLot(film)) ?? [], ref: r520,
      });
    }
  }

  const lot: LotTrace = {
    lotCode: code, product,
    bakeDate: str(entries[0]?.data.bake_date),
    unitsPacked: entries.map(e => str(e.data.units_packed)).filter(Boolean).join(" + "),
    records: entries.map(e => ref("lots", e, lotTitle(e))),
    inputs, dispatches: [], retention: [], releases: [], otherProduct: [],
  };

  for (const e of records.dispatches) {
    for (const row of rowsOf(e, "loaded")) {
      if (normLot(row.lot_code) !== key) continue;
      const r = ref("dispatches", e, `${str(e.data.dispatch_date) || day(e.date)} - ${str(e.data.customer)}`);
      if (namesMatch(row.product, product)) {
        lot.dispatches.push({ customer: str(e.data.customer), product: str(row.product), quantity: str(row.quantity),
          date: str(e.data.dispatch_date) || day(e.date), ref: r });
      } else lot.otherProduct.push({ ...r, title: `${r.title} (${str(row.product)})` });
    }
  }
  for (const e of records.retention) {
    if (normLot(e.data.lot_code) !== key) continue;
    const r = ref("retention", e, `${str(e.data.lot_code)} - ${str(e.data.product_name)}`);
    if (namesMatch(e.data.product_name, product)) {
      lot.retention.push({ product: str(e.data.product_name), customer: str(e.data.customer), units: str(e.data.units_retained),
        location: str(e.data.storage_location), disposition: str(e.data.disposition), ref: r });
    } else lot.otherProduct.push(r);
  }
  for (const e of records.releases) {
    if (normLot(e.data.lot_code) !== key) continue;
    const r = ref("releases", e, `${str(e.data.lot_code)} - ${str(e.data.product_name)}`);
    if (namesMatch(e.data.product_name, product)) {
      lot.releases.push({ product: str(e.data.product_name), customer: str(e.data.customer),
        quantity: str(e.data.quantity_released), decision: str(e.data.decision), ref: r });
    } else lot.otherProduct.push(r);
  }
  return lot;
}

function holdsFor(records: TraceRecords, lotKeys: string[]): HoldLine[] {
  const keys = lotKeys.filter(k => k.length >= 3);
  const out: HoldLine[] = [];
  for (const e of records.holds) {
    const own = normLot(e.data.supplier_lot_batch_number);
    const text = normLot(`${str(e.data.material_name_description)} ${str(e.data.detailed_description_of_issue)}`);
    if (!keys.some(k => own === k || (k.length >= 4 && text.includes(k)))) continue;
    out.push({
      tag: str(e.data.hold_tag_number), material: str(e.data.material_name_description),
      lot: str(e.data.supplier_lot_batch_number), quantity: str(e.data.total_quantity_placed_on_hold),
      disposition: str(e.data.final_disposition_decision),
      ref: ref("holds", e, `hold ${str(e.data.hold_tag_number) || day(e.date)}`),
    });
  }
  return out;
}

/** The newest submitted contact list, else the newest draft (flagged). */
function latestContacts(records: TraceRecords): TraceEntry | null {
  const byDate = (a: TraceEntry, b: TraceEntry) => String(b.date ?? "").localeCompare(String(a.date ?? ""));
  const submitted = records.contacts.filter(e => !isDraft(e)).sort(byDate);
  return submitted[0] ?? [...records.contacts].sort(byDate)[0] ?? null;
}

function contactRows(e: TraceEntry | null): ContactRow[] {
  if (!e) return [];
  return rowsOf(e, "contacts").map(r => ({
    label: str(r._label), group: str(r.group), name: str(r.name), phone: str(r.phone), email: str(r.email), when: str(r.when),
  }));
}

export function runTrace(records: TraceRecords, start: TraceStart): TraceResult {
  const target = normLot(start.lot);
  const receipts = receiptIndex(records);
  const gaps: string[] = [];
  const lots: LotTrace[] = [];
  const result: TraceResult = { start, lots, materialReceipts: [], holds: [], customers: [], essential: [], contactList: null, gaps };
  if (!target) return result;

  // Entries filled under a layout the mapping cannot read would otherwise vanish silently.
  const unreadable = records.lots.filter(e => e.data.lot_code == null && e.data.ingredients == null).length;
  if (unreadable) gaps.push(`${unreadable} FRM-520 record(s) could not be read (older layout) and are not in this trace.`);

  // Group FRM-520 entries into lots: one lot = one product + one code.
  const groups = new Map<string, { code: string; product: string; entries: TraceEntry[] }>();
  const add = (e: TraceEntry) => {
    const k = `${normLot(e.data.lot_code)}|${normName(e.data.product)}`;
    const g = groups.get(k) ?? { code: str(e.data.lot_code), product: str(e.data.product), entries: [] };
    g.entries.push(e);
    groups.set(k, g);
  };

  if (start.kind === "material") {
    result.materialReceipts = receipts.get(target) ?? [];
    for (const e of records.lots) {
      const hit = rowsOf(e, "ingredients").some(r => normLot(r.supplier_lot) === target) || normLot(e.data.film_lot) === target;
      if (hit) add(e);
    }
    for (const g of groups.values()) lots.push(buildLot(records, receipts, g.code, g.product, g.entries, target));
    if (lots.length === 0) gaps.push(`No Production Lot Record (FRM-520) lists supplier lot ${start.lot}. Check the spelling of the lot, and any production from before FRM-520 was in use.`);
    if (result.materialReceipts.length === 0) gaps.push(`No receipt of supplier lot ${start.lot} on FRM-301.`);
    const names = new Set(lots.flatMap(l => l.inputs.filter(i => i.trigger).map(i => normName(i.ingredient))));
    if (names.size > 1) gaps.push(`Supplier lot ${start.lot} is recorded under ${names.size} different ingredient names - check they are the same material.`);
  } else {
    for (const e of records.lots) if (normLot(e.data.lot_code) === target) add(e);
    const all = [...groups.values()];
    const wanted = start.name ? all.filter(g => namesMatch(g.product, start.name)) : all;
    for (const g of wanted) lots.push(buildLot(records, receipts, g.code, g.product, g.entries, ""));
    const others = all.filter(g => !wanted.includes(g)).map(g => g.product).filter(Boolean);
    if (others.length) gaps.push(`Lot code ${start.lot} is also on: ${others.join(", ")} - a different lot, not included here.`);
    if (lots.length === 0) {
      // No FRM-520 for it: still show where the code went, and say the inputs cannot be traced.
      lots.push(buildLot(records, receipts, start.lot, start.name ?? "", [], ""));
      gaps.push(`No Production Lot Record (FRM-520) for lot ${start.lot} - the supplier lots that went into it cannot be traced from the records.`);
    }
  }

  for (const lot of lots) {
    const name = [lot.lotCode, lot.product].filter(Boolean).join(" ");
    // One line per lot, not one per ingredient: ten amber lines are read by nobody under stress.
    const lotted = lot.inputs.filter(i => i.supplierLot && !NO_LOT.test(i.supplierLot));
    const unlotted = lot.inputs.filter(i => !i.supplierLot);
    const unreceived = lotted.filter(i => i.receipts.length === 0);
    if (unlotted.length) gaps.push(`${name}: no supplier lot recorded for ${unlotted.map(i => i.ingredient).join(", ")}.`);
    if (unreceived.length) {
      gaps.push(`${name}: no FRM-301 receipt for ${unreceived.length} of ${lotted.length} supplier lots - ${unreceived.map(i => `${i.ingredient} (${i.supplierLot})`).join("; ")}.`);
    }
    if (lot.dispatches.length === 0) gaps.push(`${name}: no dispatch on FRM-801 - check whether it is all still on site.`);
    else if (lot.dispatches.length > 1 && !sumQty(lot.dispatches.map(d => d.quantity))) {
      gaps.push(`${name}: the dispatched quantities cannot be added up (${lot.dispatches.map(d => d.quantity || "blank").join(", ")}) - add them by hand.`);
    }
    if (lot.retention.length === 0) gaps.push(`${name}: no retention sample on FRM-703.`);
    if (lot.records.length > 0 && lot.releases.length === 0) gaps.push(`${name}: no release record on FRM-701.`);
    if (lot.otherProduct.length) gaps.push(`${name}: ${lot.otherProduct.length} record(s) carry this lot code under a different product name - check them.`);
  }

  result.holds = holdsFor(records, [start.kind === "material" ? target : "", ...lots.map(l => normLot(l.lotCode))].filter(Boolean));

  const drafts = new Map<string, RecordRef>();
  const note = (r: RecordRef) => { if (r.draft) drafts.set(r.id, r); };
  for (const l of lots) {
    l.records.forEach(note);
    l.inputs.forEach(i => i.receipts.forEach(x => note(x.ref)));
    [...l.dispatches, ...l.retention, ...l.releases].forEach(x => note(x.ref));
  }
  result.materialReceipts.forEach(x => note(x.ref));
  result.holds.forEach(x => note(x.ref));
  if (drafts.size) gaps.push(`${drafts.size} record(s) in this trace are drafts that were never submitted: ${[...drafts.values()].map(r => r.title).join("; ")}.`);

  // Contacts
  const list = latestContacts(records);
  const rows = contactRows(list);
  if (!list) gaps.push("No Recall and Crisis Contact List (FRM-011) has been filled in.");
  else {
    result.contactList = { ...ref("contacts", list, `contact list ${str(list.data.reviewed_on) || day(list.date)}`), reviewedOn: str(list.data.reviewed_on) };
    if (isDraft(list)) gaps.push("The contact list (FRM-011) is a draft that was never submitted.");
  }
  result.essential = rows.filter(r => ESSENTIAL_GROUPS.includes(r.group));
  const customerRows = rows.filter(r => r.group === CUSTOMER_GROUP);
  const customers = new Map<string, string>();
  for (const l of lots) for (const c of [...l.dispatches.map(d => d.customer), ...l.retention.map(r => r.customer), ...l.releases.map(r => r.customer)]) {
    if (normName(c) && !customers.has(normName(c))) customers.set(normName(c), c);
  }
  for (const customer of customers.values()) {
    const hit = customerRows.filter(r => normName(r.label) && namesMatch(r.label, customer));
    if (hit.length) result.customers.push({ customer, rows: hit, matched: true });
    else {
      result.customers.push({ customer, rows: customerRows, matched: false });
      if (list) gaps.push(`No contact for ${customer} on the contact list (FRM-011).`);
    }
  }
  return result;
}

// ---------- Start pickers ----------

export interface StartOption { kind: "material" | "lot"; lot: string; name: string; label: string }

/** What the trace can start from, taken from the records themselves so nothing is typed exactly. */
export function startOptions(records: TraceRecords): StartOption[] {
  const seen = new Set<string>();
  const out: StartOption[] = [];
  const push = (kind: "material" | "lot", lot: unknown, name: unknown) => {
    const l = str(lot), n = str(name);
    if (!normLot(l)) return;
    const key = `${kind}|${normLot(l)}|${normName(n)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, lot: l, name: n, label: n ? `${n} - lot ${l}` : `Lot ${l}` });
  };
  for (const e of records.lots) {
    push("lot", e.data.lot_code, e.data.product);
    for (const r of rowsOf(e, "ingredients")) push("material", r.supplier_lot, r.ingredient);
    push("material", e.data.film_lot, "Film / bag");
  }
  for (const e of records.receipts) for (const r of rowsOf(e, "receiving_log")) push("material", r.lot_batch_number, r.material_description);
  for (const e of records.dispatches) for (const r of rowsOf(e, "loaded")) push("lot", r.lot_code, r.product);
  for (const e of records.retention) push("lot", e.data.lot_code, e.data.product_name);
  for (const e of records.releases) push("lot", e.data.lot_code, e.data.product_name);
  return out.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

// ---------- Filling the recall record ----------

/**
 * FRM-012 answers built from a trace. Each grid row carries a readable `source` and a hidden
 * `_src` pointer ("docId/responseId"). "On site", "disposed" and "unaccounted" are left blank on
 * purpose: they are counts of what is physically there, which no record can supply.
 */
export function toRecordFill(result: TraceResult): Record<string, any> {
  const { start, lots } = result;
  const lotName = (l: LotTrace) => l.lotCode;
  const trace_back: Record<string, any>[] = [];
  const trace_forward: Record<string, any>[] = [];
  const reconciliation: Record<string, any>[] = [];
  for (const l of lots) {
    for (const i of l.inputs) {
      const base = { finished_lot: lotName(l), ingredient: i.ingredient, supplier_lot: i.supplierLot };
      if (i.receipts.length === 0) {
        trace_back.push({ ...base, supplier: i.brand, received: "", found: "Not found", source: i.ref.title, _src: srcKey(i.ref) });
      } else for (const r of i.receipts) {
        trace_back.push({ ...base, supplier: r.supplier || i.brand, received: r.date, found: "Found",
          source: `${i.ref.title}; ${r.ref.title}`, _src: srcKey(r.ref) });
      }
    }
    for (const d of l.dispatches) {
      trace_forward.push({ finished_lot: lotName(l), product: d.product || l.product, customer: d.customer, quantity: d.quantity,
        collected: d.date, source: d.ref.title, _src: srcKey(d.ref) });
    }
    const collected = l.dispatches.length ? sumQty(l.dispatches.map(d => d.quantity)) ?? l.dispatches.map(d => d.quantity || "?").join(" + ") : "0";
    reconciliation.push({
      finished_lot: lotName(l), product: l.product, packed: l.unitsPacked, collected,
      on_site: "", retained: l.retention.map(r => r.units).filter(Boolean).join(" + "), disposed: "", unaccounted: "",
      source: [...l.records, ...l.retention.map(r => r.ref)].map(r => r.title).join("; "),
      _src: l.records[0] ? srcKey(l.records[0]) : "",
    });
  }
  const trigger = lots.flatMap(l => l.inputs).find(i => i.trigger);
  const customers = [...new Set(result.customers.map(c => c.customer))];
  const fill: Record<string, any> = {
    trigger: start.kind === "material" ? RECALL_TRIGGERS.material : RECALL_TRIGGERS.lot,
    product: [...new Set(lots.map(l => l.product).filter(Boolean))].join(", "),
    lot_codes: [...new Set(lots.map(l => l.lotCode).filter(Boolean))].join(", "),
    brand_owner: customers.join(", "),
    trace_back: trace_back.length ? trace_back : [{}],
    trace_forward: trace_forward.length ? trace_forward : [{}],
    reconciliation: reconciliation.length ? reconciliation : [{}],
  };
  if (start.kind === "material") {
    fill.material = trigger?.ingredient || start.name || "";
    fill.material_lot = start.lot;
    fill.material_supplier = result.materialReceipts[0]?.supplier || trigger?.brand || "";
  }
  return fill;
}

// ---------- Mapping check ----------

/**
 * Problems with the mapping against the LIVE form schemas: a form that is missing, or a field id,
 * grid column or option the trace relies on that the form no longer has. Shown instead of a trace,
 * because a renamed field would otherwise read as "nothing found".
 */
export function checkTraceMapping(schemas: Record<string, any>, includeRecallForm = true): string[] {
  const problems: string[] = [];
  const specs: TraceFormSpec[] = [...Object.values(TRACE_FORMS), ...(includeRecallForm ? [RECALL_TARGET] : [])];
  for (const spec of specs) {
    const schema = schemas[spec.form];
    if (!schema || !Array.isArray(schema.sections)) { problems.push(`${spec.form} was not found, or has no fillable form.`); continue; }
    const fields = new Map<string, any>();
    for (const s of schema.sections) for (const f of s?.fields ?? []) fields.set(f.id, f);
    for (const id of spec.fields) if (!fields.has(id)) problems.push(`${spec.form} no longer has the field "${id}".`);
    for (const [grid, cols] of Object.entries(spec.grids)) {
      const g = fields.get(grid);
      if (!g || g.type !== "grid") { problems.push(`${spec.form} no longer has the table "${grid}".`); continue; }
      const have = new Set((g.columns ?? []).map((c: any) => c.id));
      for (const c of cols) if (!have.has(c)) problems.push(`${spec.form} table "${grid}" no longer has the column "${c}".`);
    }
    if (spec.form === RECALL_FORM) {
      const need: [string, string[]][] = [["record_type", Object.values(RECALL_TYPES)], ["trigger", Object.values(RECALL_TRIGGERS)]];
      for (const [id, options] of need) {
        const have = fields.get(id)?.options ?? [];
        for (const o of options) if (!have.includes(o)) problems.push(`${spec.form} "${id}" no longer offers "${o}".`);
      }
    }
  }
  return problems;
}

// ---------- Recall steps (derived from the record, never stored) ----------

export interface RecallStep {
  id: string;
  label: string;
  /** What to do, and what in the record completes it. */
  detail: string;
  done: boolean;
  /** False when the step is not part of a mock recall. */
  applies: boolean;
  /** Section of FRM-012 to jump to. */
  section: string;
}

const filled = (v: unknown) => str(v) !== "";
const startedRows = (v: unknown) =>
  (Array.isArray(v) ? v : []).filter(r => r && Object.entries(r).some(([k, x]) => !k.startsWith("_") && x !== "" && x != null));

export function isMockRecall(values: Record<string, any>): boolean {
  return str(values.record_type) === RECALL_TYPES.mock;
}

/**
 * FSQM-023's steps in order, each ticked from what the record already says. There is no separate
 * checklist state: a tick that could disagree with the record would be worse than no tick.
 */
export function deriveRecallSteps(values: Record<string, any>): RecallStep[] {
  const mock = isMockRecall(values);
  const recon = startedRows(values.reconciliation);
  return [
    { id: "hold", label: "Hold what is still on site", section: "event", applies: true, done: filled(values.hold_ref),
      detail: mock ? "Find the affected product and materials still on site; write where they are, or 'Nothing on site'. Nothing is tagged in a mock recall."
                   : "Put affected product and materials still on site on hold (FRM-702). Write the hold tag number, or 'Nothing on site'." },
    { id: "trace", label: "Trace the lots", section: "back", applies: true,
      done: startedRows(values.trace_back).length > 0 && filled(values.completed),
      detail: "Run the trace, put it into the record, check it against the records, and fill in 'Trace completed'. Target: 4 hours." },
    { id: "decide", label: "Decide with the brand owner", section: "event", applies: !mock, done: filled(values.decision),
      detail: "Tell the brand owner the same day and decide together: withdrawal or recall. Record the decision and when it was made." },
    { id: "notify", label: mock ? "Check the contacts" : "Notify", section: mock ? "result" : "actual", applies: true,
      done: mock ? str(values.contacts_checked).startsWith("Checked") : startedRows(values.notifications).length > 0,
      detail: mock ? "Confirm every contact below is current. Do not contact customers - this is a test."
                   : "Site staff and the brand owner the same day; SQFI and the certification body in writing within 24 hours; FDA / FDACS as the law requires. Log each one under 'Who was told'." },
    { id: "recover", label: "Recover the product", section: "actual", applies: !mock, done: filled(values.recovered),
      detail: "Count what comes back or is held at customers against what was dispatched; hold it on FRM-702." },
    { id: "reconcile", label: "Reconcile each lot", section: "forward", applies: true,
      done: recon.length > 0 && recon.every(r => filled(r.packed) && filled(r.unaccounted)),
      detail: "For each lot: packed = collected + still on site + retained + disposed. Write 0 under 'Unaccounted for' when it balances." },
    { id: "capa", label: mock ? "Record the gaps" : "Investigate and raise the CAPA", section: "result", applies: true,
      done: mock ? filled(values.gaps) : filled(values.capa_no),
      detail: mock ? "Write what could not be traced or was slow to find, or 'None'. A miss is raised on FRM-007."
                   : "Find the root cause and raise a CAPA on FRM-007 (source 'Withdrawal or recall'). Write its number here." },
    { id: "close", label: "Close", section: "sign", applies: true, done: !!values.closed_by && typeof values.closed_by === "object",
      detail: "Senior Site Management reviews the record and signs to close it." },
  ];
}

// ---------- Clocks ----------

export const TRACE_TARGET_MS = 4 * 60 * 60 * 1000;
export const NOTICE_LIMIT_MS = 24 * 60 * 60 * 1000;

/** A datetime-local answer ("yyyy-MM-ddTHH:mm") as LOCAL time; null when unreadable. */
export function parseLocal(v: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(str(v));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface ClockState {
  state: "idle" | "running" | "over" | "met" | "missed";
  /** Time used so far, or in total once stopped. */
  elapsedMs: number;
  /** Time left; negative when over. */
  remainingMs: number;
  deadline: Date | null;
}

/** A clock from `from` with a limit; stopped by `until` when given. */
export function clockState(from: unknown, limitMs: number, now: Date, until?: unknown): ClockState {
  const start = parseLocal(from);
  if (!start) return { state: "idle", elapsedMs: 0, remainingMs: limitMs, deadline: null };
  const deadline = new Date(start.getTime() + limitMs);
  const stop = parseLocal(until);
  const elapsedMs = Math.max(0, (stop ?? now).getTime() - start.getTime());
  const remainingMs = limitMs - elapsedMs;
  const state = stop ? (remainingMs >= 0 ? "met" : "missed") : remainingMs >= 0 ? "running" : "over";
  return { state, elapsedMs, remainingMs, deadline };
}

/** 8040000 -> "2 h 14 min"; under an hour "14 min". */
export function formatDuration(ms: number): string {
  const total = Math.round(Math.abs(ms) / 60000);
  const h = Math.floor(total / 60), m = total % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}
