// Derived reports for "log/register" FRM forms (sop_documents.content.report_schema).
//
// A log form (e.g. FRM-003 Customer Complaint Log) has no entries of its own —
// every row is a projection of a *source* form's already-collected
// sop_document_responses (FRM-003's rows come from submitted FRM-002 Customer
// Complaint Reports). This module is the projection engine: a declarative,
// SAFE column/param definition (no arbitrary JS/SQL from the client) plus a
// client-side runner that reuses fetchResponses() and formatFieldValue().
//
// Distinct from Records.tsx / flattenForReport(), which flatten a form's OWN
// entries; here the report reprojects a *different* form's data.

import { supabase } from "@/integrations/supabase/client";
import { formatFieldValue, getFormSchema, valueFields, type FormField, type FormSchema } from "@/lib/formSchema";
import { fetchResponses, type FormResponse } from "@/lib/formResponses";

export const REPORT_SCHEMA_VERSION = 1;

// ---------- Column source definitions ----------

/** How a report column's cell is derived from a source response's flat data. */
export type ColumnSource =
  | { kind: "field"; field: string }                                   // one source field, formatted
  | { kind: "template"; template: string }                             // "{a} / {b}" token substitution
  | { kind: "map"; field: string; map: Record<string, string>; fallback?: string } // value → label lookup
  | { kind: "cases"; cases: CaseRule[]; default?: string }             // first matching rule wins
  | { kind: "const"; value: string };                                  // literal (e.g. an unmapped column)

export type CaseOp = "notEmpty" | "empty" | "equals";
export interface CaseRule { field: string; op: CaseOp; value?: string; then: string; }

export const COLUMN_SOURCE_LABELS: Record<ColumnSource["kind"], string> = {
  field: "Copy a field",
  template: "Combine fields (template)",
  map: "Map values",
  cases: "Derive by rules",
  const: "Fixed / blank",
};

export interface ReportColumnDef {
  id: string;             // stable slug (answers never key on it — safe to rename, but kept stable)
  header: string;
  source: ColumnSource;
}

// ---------- Runtime parameters ----------

export type ReportParamType = "date-range" | "text" | "select";
export interface ReportParam {
  id: string;
  label: string;
  type: ReportParamType;
  field?: string;                    // source field id (date-range / text)
  op?: "contains" | "equals";        // text
  column?: string;                   // select: a report column id whose distinct cells populate the dropdown
}

// ---------- Fixed conditions ----------
// Always-applied filters that define the report's universe (e.g. an Approved
// Supplier Register only lists rows whose supplier_status is Approved /
// Conditionally Approved). Unlike params, these are NOT user-adjustable.

export type FilterOp = "in" | "equals" | "notEquals" | "notEmpty" | "empty";
export interface ReportFilter {
  field: string;
  op: FilterOp;
  value?: string;     // equals / notEquals
  values?: string[];  // in
}

export const FILTER_OP_LABELS: Record<FilterOp, string> = {
  in: "is any of",
  equals: "equals",
  notEquals: "is not",
  notEmpty: "is not empty",
  empty: "is empty",
};

// ---------- Report schema ----------

export interface ReportSchema {
  version: number;
  sourceSopNumber: string;           // portable across envs; resolved to a doc id at runtime
  sourceStatus?: "submitted" | "all"; // default "submitted"
  defaultDateField?: string;         // source field the date-range param filters on
  columns: ReportColumnDef[];
  params: ReportParam[];
  filters?: ReportFilter[];          // fixed conditions (AND-ed); define the register's universe
  legend?: string[];                 // optional footnote lines rendered under the PDF table
}

/** Parse content.report_schema; null unless it has the minimum viable shape. */
export function getReportSchema(content: any): ReportSchema | null {
  const raw = content?.report_schema;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.columns)) return null;
  if (!raw.sourceSopNumber) return null;
  return raw as ReportSchema;
}

/** A doc "has a report" when it carries a report_schema with a source + ≥1 column. */
export function hasReportSchema(content: any): boolean {
  const schema = getReportSchema(content);
  return !!schema && schema.columns.length > 0;
}

// ---------- Resolved (renderable) columns ----------

const isBlank = (v: any) => v == null || v === "" || (Array.isArray(v) && v.length === 0);
const rawString = (v: any): string =>
  isBlank(v) ? "" : Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);

/** Same contract as formSchema's ReportColumn: header + cell(flatData) → string. */
export interface ResolvedColumn { id: string; header: string; cell: (data: Record<string, any>) => string; }

function displayValue(fieldsById: Map<string, FormField>, id: string, data: Record<string, any>): string {
  const f = fieldsById.get(id);
  const v = data?.[id];
  return f ? formatFieldValue(f, v) : rawString(v);
}

/**
 * Compile a report schema's columns into renderable cells. `sourceSchema` (the
 * source form's field defs) lets `field`/`template` values format like they do
 * on the source form; when it's missing, raw values are stringified instead.
 */
export function resolveReportColumns(schema: ReportSchema, sourceSchema: FormSchema | null): ResolvedColumn[] {
  const fieldsById = new Map<string, FormField>(
    sourceSchema ? valueFields(sourceSchema).map(f => [f.id, f]) : [],
  );
  return schema.columns.map(col => {
    const src = col.source;
    let cell: (data: Record<string, any>) => string;
    switch (src.kind) {
      case "field":
        cell = data => displayValue(fieldsById, src.field, data);
        break;
      case "template":
        cell = data =>
          src.template
            .replace(/\{([a-z0-9_]+)\}/gi, (_, id: string) => displayValue(fieldsById, id, data))
            .replace(/\s{2,}/g, " ")
            .trim();
        break;
      case "map":
        cell = data => {
          const raw = rawString(data?.[src.field]);
          if (Object.prototype.hasOwnProperty.call(src.map, raw)) return src.map[raw];
          return src.fallback ?? raw;
        };
        break;
      case "cases":
        cell = data => {
          for (const rule of src.cases) {
            const v = data?.[rule.field];
            const hit =
              rule.op === "empty" ? isBlank(v)
              : rule.op === "equals" ? rawString(v) === (rule.value ?? "")
              : !isBlank(v); // notEmpty
            if (hit) return rule.then;
          }
          return src.default ?? "";
        };
        break;
      case "const":
      default:
        cell = () => (src as { value?: string }).value ?? "";
        break;
    }
    return { id: col.id, header: col.header, cell };
  });
}

// ---------- Running the report ----------

export interface SourceFormDoc {
  id: string;
  title: string | null;
  sop_number: string | null;
  revision: string | null;
  content: any;
}

export type ParamValue = string | { from?: string; to?: string };
export type ParamValues = Record<string, ParamValue>;

export interface ReportRow { response: FormResponse; cells: string[]; }

export interface ReportBase {
  sourceDoc: SourceFormDoc | null;
  sourceSchema: FormSchema | null;
  columns: ResolvedColumn[];
  rows: ReportRow[];   // ALL rows respecting sourceStatus only (params applied separately)
}
export type ReportRunResult = ReportBase;

/** Resolve the source form (by sop_number → the fillable form doc). */
export async function fetchSourceForm(sopNumber: string): Promise<SourceFormDoc | null> {
  const { data, error } = await (supabase as any)
    .from("sop_documents")
    .select("id, title, sop_number, revision, content")
    .eq("sop_number", sopNumber)
    .eq("type", "form")
    .maybeSingle();
  if (error) throw error;
  return (data as SourceFormDoc) ?? null;
}

/** Test a fixed condition against a response's flat data. */
export function matchesFilter(f: ReportFilter, data: Record<string, any>): boolean {
  const raw = data?.[f.field];
  switch (f.op) {
    case "notEmpty": return !isBlank(raw);
    case "empty": return isBlank(raw);
    case "equals": return rawString(raw) === (f.value ?? "");
    case "notEquals": return rawString(raw) !== (f.value ?? "");
    case "in": return (f.values ?? []).includes(rawString(raw));
    default: return true;
  }
}

const inDateRange = (value: string, from?: string, to?: string): boolean => {
  if (!from && !to) return true;
  if (isBlank(value)) return false;           // a date filter excludes rows with no date
  const v = String(value).slice(0, 10);       // yyyy-mm-dd sorts lexicographically
  if (from && v < from.slice(0, 10)) return false;
  if (to && v > to.slice(0, 10)) return false;
  return true;
};

/**
 * Load the report's base rows: fetch the source form's responses (respecting
 * sourceStatus) and project them through the schema. Runtime params are NOT
 * applied here — the viewer applies them client-side via filterReportRows so
 * it can fetch once and still populate select-param dropdowns from all rows.
 *
 * We fetch without a created_at bound because the report's date param filters
 * on a *data* field (e.g. date_received), which can differ from created_at.
 */
export async function loadReportBase(schema: ReportSchema): Promise<ReportBase> {
  const sourceDoc = await fetchSourceForm(schema.sourceSopNumber);
  if (!sourceDoc) return { sourceDoc: null, sourceSchema: null, columns: [], rows: [] };

  const sourceSchema = getFormSchema(sourceDoc.content);
  const columns = resolveReportColumns(schema, sourceSchema);

  let responses = await fetchResponses(sourceDoc.id);
  if ((schema.sourceStatus ?? "submitted") === "submitted") {
    responses = responses.filter(r => r.status === "submitted");
  }
  if (schema.filters?.length) {
    responses = responses.filter(r => schema.filters!.every(f => matchesFilter(f, r.data ?? {})));
  }
  const rows = responses.map(r => ({ response: r, cells: columns.map(c => c.cell(r.data ?? {})) }));
  return { sourceDoc, sourceSchema, columns, rows };
}

/** Apply runtime params to already-projected rows (pure — client-side filter). */
export function filterReportRows(
  schema: ReportSchema,
  columns: ResolvedColumn[],
  rows: ReportRow[],
  values: ParamValues,
): ReportRow[] {
  const colIndexById = new Map(columns.map((c, i) => [c.id, i]));
  let out = rows;
  for (const param of schema.params) {
    const raw = values[param.id];
    if (param.type === "date-range") {
      const range = (typeof raw === "object" ? raw : undefined) ?? {};
      const field = param.field ?? schema.defaultDateField;
      if (field && (range.from || range.to)) {
        out = out.filter(row => inDateRange(String(row.response.data?.[field] ?? ""), range.from, range.to));
      }
    } else if (param.type === "text") {
      const needle = (typeof raw === "string" ? raw : "").trim().toLowerCase();
      if (needle && param.field) {
        out = out.filter(row => {
          const hay = rawString(row.response.data?.[param.field!]).toLowerCase();
          return param.op === "equals" ? hay === needle : hay.includes(needle);
        });
      }
    } else if (param.type === "select") {
      const want = typeof raw === "string" ? raw : "";
      const idx = param.column != null ? colIndexById.get(param.column) : undefined;
      if (want && idx != null) out = out.filter(row => row.cells[idx] === want);
    }
  }
  return out;
}

/** Convenience: base load + param filter in one call (used by the builder preview). */
export async function runReport(schema: ReportSchema, values: ParamValues = {}): Promise<ReportRunResult> {
  const base = await loadReportBase(schema);
  return { ...base, rows: filterReportRows(schema, base.columns, base.rows, values) };
}

// ---------- Equivalent read-only SQL (illustrative / audit) ----------
//
// The engine runs client-side, but the declarative schema maps 1:1 to a
// read-only SELECT over sop_document_responses (jsonb `data->>'field'`). This
// generator renders that equivalent query — reflecting the live params — for
// transparency. It is NOT executed by the app.

const sqlLit = (s: string) => `'${String(s).replace(/'/g, "''")}'`;
const sqlIdent = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
const sqlField = (field: string, alias = "d") => `${alias}.data->>${sqlLit(field)}`;

function columnSql(source: ColumnSource, alias = "d"): string {
  switch (source.kind) {
    case "field":
      return sqlField(source.field, alias);
    case "const":
      return sqlLit(source.value ?? "");
    case "template": {
      const parts: string[] = [];
      let last = 0;
      const re = /\{([a-z0-9_]+)\}/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(source.template))) {
        if (m.index > last) parts.push(sqlLit(source.template.slice(last, m.index)));
        parts.push(`coalesce(${sqlField(m[1], alias)}, '')`);
        last = m.index + m[0].length;
      }
      if (last < source.template.length) parts.push(sqlLit(source.template.slice(last)));
      return parts.length ? `(${parts.join(" || ")})` : sqlLit("");
    }
    case "map": {
      const whens = Object.entries(source.map).map(([k, v]) => `when ${sqlLit(k)} then ${sqlLit(v)}`);
      const els = source.fallback != null ? sqlLit(source.fallback) : sqlField(source.field, alias);
      return `case ${sqlField(source.field, alias)} ${whens.join(" ")} else ${els} end`;
    }
    case "cases": {
      const whens = source.cases.map(r => {
        const f = sqlField(r.field, alias);
        const cond = r.op === "empty" ? `coalesce(${f}, '') = ''`
          : r.op === "equals" ? `${f} = ${sqlLit(r.value ?? "")}`
          : `coalesce(${f}, '') <> ''`;
        return `when ${cond} then ${sqlLit(r.then)}`;
      });
      return `case ${whens.join(" ")} else ${sqlLit(source.default ?? "")} end`;
    }
  }
}

/**
 * Render the read-only SQL equivalent of a report (definition + live params).
 * Illustrative only — the app fetches + projects client-side.
 */
export function buildReportSql(
  schema: ReportSchema,
  values: ParamValues = {},
  sourceDoc?: { id: string; sop_number: string | null; title: string | null } | null,
): string {
  const cols = schema.columns.length
    ? schema.columns.map(c => `  ${columnSql(c.source)} as ${sqlIdent(c.header || c.id)}`)
    : ["  d.*"];

  const where: string[] = [];
  if (sourceDoc?.id) {
    where.push(`d.document_id = ${sqlLit(sourceDoc.id)}  -- ${sourceDoc.sop_number ?? ""} ${sourceDoc.title ?? ""}`.trimEnd());
  } else {
    where.push(`d.document_id = (select id from sop_documents where sop_number = ${sqlLit(schema.sourceSopNumber)} and type = 'form')`);
  }
  if ((schema.sourceStatus ?? "submitted") === "submitted") where.push(`d.status = 'submitted'`);

  for (const f of schema.filters ?? []) {
    const field = sqlField(f.field);
    if (f.op === "notEmpty") where.push(`coalesce(${field}, '') <> ''  -- fixed`);
    else if (f.op === "empty") where.push(`coalesce(${field}, '') = ''  -- fixed`);
    else if (f.op === "equals") where.push(`${field} = ${sqlLit(f.value ?? "")}  -- fixed`);
    else if (f.op === "notEquals") where.push(`${field} is distinct from ${sqlLit(f.value ?? "")}  -- fixed`);
    else if (f.op === "in") where.push(`${field} in (${(f.values ?? []).map(sqlLit).join(", ")})  -- fixed`);
  }

  for (const param of schema.params) {
    const raw = values[param.id];
    if (param.type === "date-range") {
      const range = (typeof raw === "object" ? raw : undefined) ?? {};
      const field = param.field ?? schema.defaultDateField;
      if (field && range.from) where.push(`${sqlField(field)} >= ${sqlLit(range.from)}`);
      if (field && range.to) where.push(`${sqlField(field)} <= ${sqlLit(range.to)}`);
    } else if (param.type === "text") {
      const needle = (typeof raw === "string" ? raw : "").trim();
      if (needle && param.field) {
        where.push(param.op === "equals"
          ? `lower(${sqlField(param.field)}) = lower(${sqlLit(needle)})`
          : `${sqlField(param.field)} ilike ${sqlLit(`%${needle}%`)}`);
      }
    } else if (param.type === "select") {
      const want = typeof raw === "string" ? raw : "";
      const col = param.column ? schema.columns.find(c => c.id === param.column) : undefined;
      if (want && col) where.push(`(${columnSql(col.source)}) = ${sqlLit(want)}`);
    }
  }

  return [
    "-- Read-only equivalent (the app projects this client-side; not executed as SQL)",
    "select",
    cols.join(",\n"),
    "from sop_document_responses d",
    `where ${where.join("\n  and ")}`,
    "order by d.created_at desc;",
  ].join("\n");
}

/** Distinct non-empty cell values of a report column across rows (for select-param dropdowns). */
export function distinctColumnValues(rows: ReportRow[], columnIndex: number): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const v = row.cells[columnIndex];
    if (v && v.trim()) seen.add(v);
  }
  return Array.from(seen).sort();
}
