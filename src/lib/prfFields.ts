/**
 * Single source of truth for how a `prf_submissions` row is presented.
 *
 * Both the on-screen PRF Review drawer and the exported PDF build their content
 * from `buildPrfSections()`, so the two can no longer drift — previously each
 * hard-coded its own list and both showed only 27 of the table's 59 columns.
 *
 * `prf_submissions` declares **no foreign keys**, so related rows (lead, owner,
 * concept) cannot be embedded via PostgREST's `select("*, sales_leads(...)")`
 * syntax — that requires a real FK. Callers fetch them separately and pass them
 * in as `PrfRelated`.
 */

/** A `prf_submissions` row. Fetched with `select("*")`, so it is wide and loose. */
export type PrfRow = Record<string, any>;

/** Related rows, looked up by the PRF's logical (non-FK) id columns. */
export interface PrfRelated {
  /** `sales_leads` row matching `prf.lead_id`. */
  lead?: Record<string, any> | null;
  /** `profiles` row matching `prf.owner_user_id`. */
  owner?: Record<string, any> | null;
  /** `concepts` row matching `prf.concept_id`. */
  concept?: Record<string, any> | null;
}

export interface PrfFieldRow {
  label: string;
  value: string;
  /** Long free text — rendered as a block rather than a table row. */
  block?: boolean;
  /** Opaque identifier (uuid etc.) — de-emphasised in the UI. */
  mono?: boolean;
}

export interface PrfSection {
  heading: string;
  rows: PrfFieldRow[];
}

/** The original PRF document uploaded with the deal, stored in `data_json`. */
export interface PrfAttachment {
  name: string;
  path: string;
  size?: number;
  type?: string;
  uploaded_at?: string;
}

const isEmpty = (v: unknown): boolean =>
  v === null ||
  v === undefined ||
  v === "" ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0);

/** Render any scalar/array/object value as display text. Empty -> null (row dropped). */
export function text(v: unknown): string | null {
  if (isEmpty(v)) return null;
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(", ") || null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") {
    // Readable "key: value" lines beat a raw JSON dump in a report.
    return Object.entries(v as Record<string, unknown>)
      .filter(([, val]) => !isEmpty(val))
      .map(([k, val]) => `${humanize(k)}: ${Array.isArray(val) ? val.join(", ") : String(val)}`)
      .join("\n") || null;
  }
  return String(v).trim() || null;
}

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Booleans only — keeps `false` visible (meaningful) instead of dropping it. */
export function yesNo(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return v ? "Yes" : "No";
}

/** `"4"` + `"oz"` -> `"4 oz"`. */
export function withUnit(value: unknown, unit: unknown): string | null {
  const v = text(value);
  if (!v) return null;
  const u = text(unit);
  return u ? `${v} ${u}` : v;
}

/** `5 x 5 x 4 in`. Renders whatever subset of the three axes is present. */
export function dimensions(l: unknown, w: unknown, h: unknown, unit: unknown): string | null {
  const parts = [l, w, h].map((p) => text(p));
  if (parts.every((p) => !p)) return null;
  const body = parts.map((p) => p ?? "?").join(" × ");
  const u = text(unit);
  return u ? `${body} ${u}` : body;
}

/**
 * Resolve a select-with-"Other" pair. The form stores the literal choice in the
 * base column and the typed-in answer in the `_other` companion — so a report
 * showing only the base renders the useless placeholder "Other (text)" instead
 * of the real answer ("2oz hangable unit").
 */
export function resolveOther(base: unknown, other: unknown): string | null {
  const b = text(base);
  const o = text(other);
  if (!b) return o;
  if (!o) return b;
  return /other/i.test(b) ? o : `${b} — ${o}`;
}

export function dateTime(v: unknown): string | null {
  if (isEmpty(v)) return null;
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return text(v);
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function dateOnly(v: unknown): string | null {
  if (isEmpty(v)) return null;
  const s = String(v);
  // Bare `YYYY-MM-DD` must not go through `new Date()` — that parses as UTC and
  // renders as the previous day for anyone west of Greenwich.
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (bare) {
    const d = new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3]));
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function fileSize(bytes: unknown): string | null {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Pull the uploaded original PRF document out of `data_json`, if there is one. */
export function prfAttachment(prf: PrfRow): PrfAttachment | null {
  const f = prf?.data_json?.prf_file;
  if (!f || typeof f !== "object" || !f.path) return null;
  return {
    name: f.name || "Attached file",
    path: f.path,
    size: f.size,
    type: f.type,
    uploaded_at: f.uploaded_at,
  };
}

/** Build a section, dropping empty rows; returns null if nothing survived. */
function section(heading: string, rows: [string, string | null, Partial<PrfFieldRow>?][]): PrfSection | null {
  const kept = rows
    .filter((r): r is [string, string, Partial<PrfFieldRow>?] => !!r[1])
    .map(([label, value, extra]) => ({ label, value, ...(extra ?? {}) }));
  return kept.length ? { heading, rows: kept } : null;
}

/**
 * Every column of `prf_submissions` grouped for presentation, plus the related
 * lead / owner / concept. Empty values are dropped, so a sparse PRF stays short.
 */
export function buildPrfSections(prf: PrfRow, related: PrfRelated = {}): PrfSection[] {
  const { lead, owner, concept } = related;
  const attachment = prfAttachment(prf);

  const sections: (PrfSection | null)[] = [
    section("Company & Contact", [
      ["Company", text(prf.company_name)],
      ["Company stage", text(prf.company_stage)],
      ["Founder", text(prf.founder_name)],
      ["Email", text(prf.email)],
      ["Phone", text(prf.phone)],
      ["Customer name", text(prf.customer_name)],
      ["Technical contact same as above", yesNo(prf.same_as_initial_contact)],
      ["Technical contact", text(prf.technical_contact_name)],
      ["Technical contact email", text(prf.technical_contact_email)],
      ["Technical contact phone", text(prf.technical_contact_phone)],
    ]),

    section("Product", [
      ["Product", text(prf.product_name)],
      ["Project type", text(prf.project_type)],
      ["Development approach", text(prf.development_approach)],
      ["Finished form", text(prf.finished_form)],
      ["Flavor type", text(prf.flavor_type)],
      ["Nutraceutical", yesNo(prf.is_nutraceutical)],
      ["Intended application", text(prf.intended_application)],
      ["Additional requirements", text(prf.additional_requirements)],
    ]),

    section("Unit & Primary Packaging", [
      ["Packaging readiness", text(prf.packaging_readiness)],
      ["Primary packaging", resolveOther(prf.primary_packaging_vessel, prf.primary_packaging_other)],
      ["Weight per unit", withUnit(prf.weight_per_unit, prf.weight_per_unit_unit)],
      ["Unit dimensions (L × W × H)", dimensions(prf.unit_dimension_l, prf.unit_dimension_w, prf.unit_dimension_h, prf.unit_dimension_unit)],
      ["Units per primary pack", text(prf.units_per_primary_pack)],
      ["Net weight per primary pack", withUnit(prf.net_weight_per_primary_pack, prf.net_weight_per_primary_pack_unit)],
    ]),

    section("Secondary Packaging & Case", [
      ["Secondary packaging", resolveOther(prf.secondary_packaging, prf.secondary_packaging_other)],
      ["Units per vessel", text(prf.units_per_vessel)],
      ["Master carton requirements", text(prf.master_carton_requirements)],
    ]),

    section("Labeling & Artwork", [
      ["Artwork readiness", text(prf.artwork_readiness)],
      ["Label responsibility", text(prf.label_responsibility)],
    ]),

    section("Shipping & Warehousing", [
      ["Pallets required", text(prf.pallets_required)],
      ["Shipping TBD", yesNo(prf.shipping_tbd)],
      ["Warehousing needs", text(prf.warehousing_needs)],
    ]),

    section("Commercial", [
      ["Target date", dateOnly(prf.target_date)],
      ["Price target / unit", text(prf.price_target_per_unit)],
      ["Annual volume", text(prf.annual_volume)],
      ["Order quantity", text(prf.order_quantity)],
      ["Order frequency", text(prf.order_frequency)],
    ]),

    section("Notes", [
      ["Additional project info", text(prf.additional_project_info), { block: true }],
    ]),

    section("Linked Records", [
      ["Lead — company", text(lead?.company_name)],
      ["Lead — contact", text(lead?.contact_name)],
      ["Lead — email", text(lead?.email)],
      ["Lead — phone", text(lead?.phone)],
      ["Lead archived", lead?.archived_at ? dateTime(lead.archived_at) : null],
      ["Owner", text(owner?.full_name)],
      ["Owner email", text(owner?.email)],
      ["Concept", text(concept?.product_name)],
      ["Concept status", text(concept?.status)],
      ["Attached PRF document", attachment
        ? [attachment.name, fileSize(attachment.size), attachment.uploaded_at ? `uploaded ${dateOnly(attachment.uploaded_at)}` : null]
            .filter(Boolean).join(" · ")
        : null],
    ]),

    section("Record & Workflow", [
      ["Status", text(prf.status)],
      ["Sales stage", text(prf.sales_stage)],
      ["Stage updated", dateTime(prf.sales_stage_updated_at)],
      ["Created", dateTime(prf.created_at)],
      ["Submitted", dateTime(prf.submitted_at)],
      ["Quote approved", dateTime(prf.quote_approved_at)],
      ["Product approved", dateTime(prf.product_approved_at)],
      ["Confirmation email sent", yesNo(prf.email_sent)],
      ["PRF id", text(prf.id), { mono: true }],
      ["Lead id", text(prf.lead_id), { mono: true }],
      ["Owner user id", text(prf.owner_user_id), { mono: true }],
      ["Concept id", text(prf.concept_id), { mono: true }],
      ["Stage 2 submission id", text(prf.stage2_submission_id), { mono: true }],
    ]),
  ];

  return sections.filter((s): s is PrfSection => s !== null);
}
