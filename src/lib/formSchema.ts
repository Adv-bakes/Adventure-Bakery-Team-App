// Dynamic fillable-form schema stored at sop_documents.content.form_schema.
// Pure types + helpers only — no supabase access here (that lives in formResponses.ts).
//
// Design constraints (see DOCUMENT_REGISTER.md / plan):
// - Response data is FLAT ({ [fieldId]: value }); sections are presentation-only,
//   so re-sectioning a field in a later revision never orphans answers.
// - Field ids are stable snake_case slugs and must never be renamed after entries
//   exist — the id is the join key between a response and the schema.
// - Unknown field types must render as a placeholder, never crash (forward-compat
//   for later production-floor field types).

import { z } from "zod";
import { format } from "date-fns";

export const FORM_SCHEMA_VERSION = 1;

// ---------- Field types ----------

export type ScalarFieldType =
  | "text" | "textarea" | "number" | "date" | "time" | "datetime"
  | "checkbox" | "select" | "pass_fail" | "signature";
export type FormFieldType = ScalarFieldType | "grid" | "heading" | "info";

export interface FieldBase {
  id: string;                 // stable snake_case slug, unique across the form
  type: FormFieldType;
  label: string;
  help?: string;              // muted hint under the input
  required?: boolean;         // enforced at SUBMIT time only; drafts save anything
  width?: "full" | "half" | "third";
  showInList?: boolean;       // surface this field as its own column in the drawer's Entries list
}

export interface TextField     extends FieldBase { type: "text";     maxLength?: number; placeholder?: string; }
export interface TextareaField extends FieldBase { type: "textarea"; rows?: number; }
export interface NumberField   extends FieldBase { type: "number";   min?: number; max?: number; step?: number; unit?: string; }
export interface DateField     extends FieldBase { type: "date" | "time" | "datetime"; defaultToday?: boolean; }
export interface CheckboxField extends FieldBase { type: "checkbox"; }
export interface SelectField   extends FieldBase { type: "select";   options: string[]; multiple?: boolean; allowOther?: boolean; }
export interface PassFailField extends FieldBase {
  type: "pass_fail";
  naAllowed?: boolean;
  labels?: { pass?: string; fail?: string; na?: string };
}

// value: { user_id, name, signed_at } stamped client-side when the box is checked
export interface SignatureField extends FieldBase {
  type: "signature";
  role?: "filler" | "verifier"; // verifier: only admin/owner can sign
  statement?: string;           // e.g. "I certify the above is accurate"
}
export interface SignatureValue { user_id: string; name: string; signed_at: string; }

export interface HeadingField extends FieldBase { type: "heading"; }
export interface InfoField    extends FieldBase { type: "info"; text: string; }

export type GridColumnType = "text" | "number" | "date" | "time" | "checkbox" | "select" | "pass_fail";
export interface GridColumn {
  id: string;
  label: string;
  type: GridColumnType;
  options?: string[];   // select
  unit?: string;        // number
  required?: boolean;
  width?: number;       // relative flex weight
}
export type GridRows =
  | { mode: "dynamic"; min?: number; max?: number; addLabel?: string }
  | { mode: "fixed"; labels: string[] }; // labels render as a read-only leading column
export interface GridField extends FieldBase {
  type: "grid";
  columns: GridColumn[];
  rows: GridRows;
}
export type GridRowValue = Record<string, any>;

export type FormField =
  | TextField | TextareaField | NumberField | DateField | CheckboxField
  | SelectField | PassFailField | SignatureField | HeadingField | InfoField | GridField;

// ---------- Sections / settings / form ----------

export interface FormSection {
  id: string;
  title?: string;
  description?: string;
  fields: FormField[];
}

export interface FormSettings {
  deletable?: boolean;             // default true; false = entries can never be deleted (UI-enforced, even for admins)
  allowMultipleDrafts?: boolean;   // default true; false = "New Entry" resumes the user's existing draft
  instanceTitleTemplate?: string;  // e.g. "{date} — {supplier_name}"; tokens: {date}, {user}, {<fieldId>}
  requireVerification?: boolean;   // surface the verifier signature prominently on submitted entries
}

export interface FormSchema {
  schemaVersion: number;
  settings?: FormSettings;
  sections: FormSection[];
}

export const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: "Text", textarea: "Multi-line Text", number: "Number", date: "Date",
  time: "Time", datetime: "Date & Time", checkbox: "Checkbox", select: "Dropdown",
  pass_fail: "Pass / Fail", signature: "Signature", grid: "Table / Grid",
  heading: "Heading", info: "Instructions",
};

export const GRID_COLUMN_TYPE_LABELS: Record<GridColumnType, string> = {
  text: "Text", number: "Number", date: "Date", time: "Time",
  checkbox: "Checkbox", select: "Dropdown", pass_fail: "Pass / Fail",
};

/** Field types that carry a value (excluded: heading, info). */
export const VALUE_FIELD_TYPES: ReadonlySet<FormFieldType> = new Set([
  "text", "textarea", "number", "date", "time", "datetime",
  "checkbox", "select", "pass_fail", "signature", "grid",
]);

// ---------- Reading a schema off a document ----------

/** Parse content.form_schema; returns null unless it has the minimum viable shape. */
export function getFormSchema(content: any): FormSchema | null {
  const raw = content?.form_schema;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.sections)) return null;
  return raw as FormSchema;
}

/** A doc is "fillable" when it's a form with at least one field defined. */
export function hasFormSchema(doc: { type?: string; content?: any } | null | undefined): boolean {
  if (!doc || doc.type !== "form") return false;
  const schema = getFormSchema(doc.content);
  return !!schema && schema.sections.some(s => Array.isArray(s.fields) && s.fields.length > 0);
}

/** All value-bearing fields across sections, in display order. */
export function valueFields(schema: FormSchema): FormField[] {
  return schema.sections.flatMap(s => s.fields).filter(f => VALUE_FIELD_TYPES.has(f.type));
}

/**
 * Fields flagged settings.showInList — extra columns in the drawer's Entries
 * list, admin-picked per form (e.g. "Complaint No.", "Customer"). Grids are
 * excluded even if flagged: a multi-row value has no sensible single-cell
 * rendering (formatFieldValue already returns "" for them).
 */
export function listFields(schema: FormSchema): FormField[] {
  return valueFields(schema).filter(f => f.showInList && f.type !== "grid");
}

// ---------- Ids ----------

/** Slugify a label into a stable snake_case field id, deduped against `taken`. */
export function slugifyFieldId(label: string, taken: Set<string>): string {
  let base = label
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  if (!base) base = "field";
  if (/^\d/.test(base)) base = `f_${base}`;
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}_${n++}`;
  return id;
}

// ---------- Default values ----------

const todayValue = (type: string): string => {
  const now = new Date();
  if (type === "date") return format(now, "yyyy-MM-dd");
  if (type === "time") return format(now, "HH:mm");
  return format(now, "yyyy-MM-dd'T'HH:mm");
};

function emptyFieldValue(field: FormField): any {
  switch (field.type) {
    case "checkbox": return false;
    case "select": return (field as SelectField).multiple ? [] : "";
    case "signature": return null;
    case "grid": {
      const grid = field as GridField;
      if (grid.rows.mode === "fixed") return grid.rows.labels.map(() => ({}));
      const min = grid.rows.min ?? 1;
      return Array.from({ length: Math.max(min, 1) }, () => ({}));
    }
    case "date": case "time": case "datetime":
      return (field as DateField).defaultToday ? todayValue(field.type) : "";
    default: return "";
  }
}

/** RHF defaultValues for a brand-new entry (also the shape saved on createResponse). */
export function emptyValues(schema: FormSchema): Record<string, any> {
  const values: Record<string, any> = {};
  for (const field of valueFields(schema)) values[field.id] = emptyFieldValue(field);
  return values;
}

// ---------- Submit-time validation (zod) ----------

const isBlank = (v: any) =>
  v == null || v === "" || (Array.isArray(v) && v.length === 0);

function scalarZod(field: FormField): z.ZodTypeAny {
  switch (field.type) {
    case "number": {
      const f = field as NumberField;
      let num = z.coerce.number({ invalid_type_error: `${f.label} must be a number` });
      if (f.min != null) num = num.min(f.min, `${f.label} must be ≥ ${f.min}`);
      if (f.max != null) num = num.max(f.max, `${f.label} must be ≤ ${f.max}`);
      const base = z.union([z.literal(""), num]);
      return field.required
        ? base.refine(v => v !== "", { message: `${field.label} is required` })
        : base.nullish();
    }
    case "checkbox": {
      const base = z.coerce.boolean();
      return field.required
        ? base.refine(v => v === true, { message: `${field.label} must be checked` })
        : base;
    }
    case "signature": {
      const sig = z.object({ user_id: z.string(), name: z.string(), signed_at: z.string() });
      return field.required
        ? sig.nullable().refine(v => !!v, { message: `${field.label} must be signed` })
        : sig.nullable().optional();
    }
    case "select": {
      const f = field as SelectField;
      const base: z.ZodTypeAny = f.multiple ? z.array(z.string()) : z.string();
      return field.required
        ? base.refine(v => !isBlank(v), { message: `${field.label} is required` })
        : base.optional().nullable();
    }
    case "pass_fail": {
      const base = z.string();
      return field.required
        ? base.refine(v => !isBlank(v), { message: `${field.label} is required` })
        : base.optional().nullable();
    }
    default: {
      // text / textarea / date / time / datetime
      let str = z.string();
      const maxLength = field.type === "text" ? (field as TextField).maxLength : undefined;
      if (maxLength) str = str.max(maxLength, `${field.label} is too long`);
      return field.required
        ? str.refine(v => !isBlank(v), { message: `${field.label} is required` })
        : str.optional().nullable();
    }
  }
}

function gridZod(field: GridField): z.ZodTypeAny {
  const rowStarted = (r: GridRowValue) =>
    field.columns.some(c => !isBlank(r?.[c.id]) && r?.[c.id] !== false);

  // A row whose cells are all blank is treated as intentionally empty —
  // per-column `required` only applies to rows the filler actually started.
  const row = z.record(z.any()).superRefine((r, ctx) => {
    if (!rowStarted(r)) return;
    for (const col of field.columns) {
      if (col.required && isBlank(r[col.id])) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${col.label} is required`, path: [col.id] });
      }
    }
  });

  const min = field.rows.mode === "dynamic" ? field.rows.min : undefined;
  return z.array(row).superRefine((rows, ctx) => {
    const started = rows.filter(rowStarted).length;
    if (field.required && started === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${field.label} needs at least one row` });
    } else if (min && started > 0 && started < min) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${field.label} needs at least ${min} row${min !== 1 ? "s" : ""}` });
    }
  });
}

/**
 * Build the submit-time validator. Draft saves must NOT run this — drafts save
 * anything. Unknown field types validate as z.any() (tolerated, round-tripped).
 */
export function buildZodSchema(schema: FormSchema): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of valueFields(schema)) {
    shape[field.id] = field.type === "grid" ? gridZod(field as GridField) : scalarZod(field);
  }
  return z.object(shape).passthrough() as z.ZodObject<Record<string, z.ZodTypeAny>>;
}

// ---------- Display formatting ----------

const PASS_FAIL_DEFAULTS = { pass: "Pass", fail: "Fail", na: "N/A" };

export function formatFieldValue(field: FormField | GridColumn, value: any): string {
  if (isBlank(value)) return "";
  switch (field.type) {
    case "checkbox": return value === true ? "Yes" : "No";
    case "pass_fail": {
      const labels = { ...PASS_FAIL_DEFAULTS, ...(field as PassFailField).labels };
      return labels[value as keyof typeof labels] ?? String(value);
    }
    case "signature": {
      const sig = value as SignatureValue;
      if (!sig?.name) return "";
      try { return `${sig.name} — ${format(new Date(sig.signed_at), "M/d/yyyy h:mm a")}`; }
      catch { return sig.name; }
    }
    case "select": return Array.isArray(value) ? value.join(", ") : String(value);
    case "number": {
      const unit = (field as NumberField | GridColumn).unit;
      return unit ? `${value} ${unit}` : String(value);
    }
    case "grid": return ""; // grids format per-column via flattenForReport
    default: return String(value);
  }
}

// ---------- Report flattening ----------

export interface ReportColumn {
  id: string;            // fieldId, or "<gridId>.<colId>" for grid columns
  header: string;
  /** Format this column's cell from a response's flat data object. */
  cell: (data: Record<string, any>) => string;
}

/**
 * One report column per scalar field; grids contribute one column per grid
 * column with the per-row values joined by " | " (row order preserved).
 */
export function flattenForReport(schema: FormSchema): ReportColumn[] {
  const columns: ReportColumn[] = [];
  for (const field of valueFields(schema)) {
    if (field.type === "grid") {
      const grid = field as GridField;
      for (const col of grid.columns) {
        columns.push({
          id: `${grid.id}.${col.id}`,
          header: `${grid.label}: ${col.label}`,
          cell: data => {
            const rows: GridRowValue[] = Array.isArray(data?.[grid.id]) ? data[grid.id] : [];
            return rows.map(r => formatFieldValue(col as any, r?.[col.id])).join(" | ");
          },
        });
      }
    } else {
      columns.push({
        id: field.id,
        header: field.label,
        cell: data => formatFieldValue(field, data?.[field.id]),
      });
    }
  }
  return columns;
}

// ---------- Instance titles ----------

/**
 * Apply settings.instanceTitleTemplate ("{date} — {supplier_name}") to a
 * response. Tokens: {date} (created date), {user} (filler name), {<fieldId>}.
 */
export function instanceTitle(
  schema: FormSchema | null,
  response: { data?: Record<string, any>; created_at: string; form_number?: string | null },
  fillerName?: string,
): string {
  const created = (() => {
    try { return format(new Date(response.created_at), "M/d/yyyy"); } catch { return response.created_at; }
  })();
  const template = schema?.settings?.instanceTitleTemplate;
  const fallback = `${response.form_number ?? "Entry"} — ${created}`;
  if (!template) return fallback;
  const fieldsById = new Map(schema ? valueFields(schema).map(f => [f.id, f]) : []);
  const title = template.replace(/\{([a-z0-9_]+)\}/gi, (_, token: string) => {
    if (token === "date") return created;
    if (token === "user") return fillerName ?? "";
    const field = fieldsById.get(token);
    const raw = response.data?.[token];
    return field ? formatFieldValue(field, raw) : (isBlank(raw) ? "" : String(raw));
  }).replace(/\s+/g, " ").trim();
  return title.replace(/^[—\-\s]+|[—\-\s]+$/g, "") || fallback;
}
