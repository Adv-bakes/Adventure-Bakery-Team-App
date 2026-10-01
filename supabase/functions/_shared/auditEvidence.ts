// Pure helpers for draft-audit-evidence (FRM-010's "Draft from records"). No Deno APIs, so
// scripts/test-audit-evidence.mjs can bundle and run them under Node.
//
// THE RULE THIS MODULE EXISTS FOR: the facts an internal auditor signs are computed here, in code -
// which records relate to a clause, how many entries each form has, the first and last date, the
// longest gap, which entries carry a failed check. The model only turns those facts into sentences.
// A model asked to count a year of entries miscounts, and a miscounted record is exactly what an
// external auditor would catch.

/** "11.2.4 Pest Prevention" -> "11.2.4"; null when the cell holds no clause number. */
export function clauseIdOf(cell: unknown): string | null {
  const m = /^\s*(\d+(?:\.\d+)+)(?=\s|$|[^\d.])/.exec(String(cell ?? ""));
  return m ? m[1] : null;
}

/** a is b, or sits under it: "11.2.4.3" under "11.2.4" - never "2.10" under "2.1". */
function within(a: string, b: string): boolean {
  return a === b || a.startsWith(b + ".");
}

/**
 * Whether a document's comma-delimited SQF reference bears on a clause, in either direction: the
 * document cites the clause or something inside it (FRM-914 cites 11.2.4.x for 11.2.4), or cites
 * a broader section containing it (a program referenced at "11.2" governs 11.2.4 too).
 */
export function relatedToClause(reference: string | null | undefined, clauseId: string): boolean {
  return (reference ?? "")
    .split(",")
    .map(t => t.trim())
    .filter(t => /^\d+(?:\.\d+)+$/.test(t))
    .some(t => within(t, clauseId) || within(clauseId, t));
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function scalarText(field: any, value: unknown): string {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return "";
  if (field?.type === "pass_fail") {
    const labels = field.labels ?? {};
    return value === "pass" ? (labels.pass ?? "Pass") : value === "fail" ? (labels.fail ?? "Fail") : value === "na" ? (labels.na ?? "N/A") : String(value);
  }
  if (field?.type === "checkbox") return value === true ? "Yes" : value === false ? "" : String(value);
  if (field?.type === "signature") return typeof value === "object" && (value as any)?.name ? `signed by ${(value as any).name}` : "";
  if (Array.isArray(value)) return value.map(v => String(v)).join(", ");
  if (typeof value === "object") return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/** Every value-bearing field of a form_schema, in order. */
function valueFields(schema: any): any[] {
  const out: any[] = [];
  for (const s of Array.isArray(schema?.sections) ? schema.sections : []) {
    for (const f of Array.isArray(s?.fields) ? s.fields : []) {
      if (f && !["heading", "info", "reference_table"].includes(f.type)) out.push(f);
    }
  }
  return out;
}

/** One entry as a single "Label: value; ..." line, grid rows as "col: val, col: val". */
export function flattenEntry(schema: any, data: Record<string, unknown> | null | undefined, max = 400): string {
  const d = data ?? {};
  const parts: string[] = [];
  for (const f of valueFields(schema)) {
    const v = d[f.id];
    if (f.type === "grid") {
      const rows = Array.isArray(v) ? v : [];
      const cols: any[] = Array.isArray(f.columns) ? f.columns : [];
      const rendered = rows
        .map((r: any) => {
          const cells = cols.map(c => {
            const t = scalarText(c, r?.[c.id]);
            return t ? `${c.label}: ${t}` : "";
          }).filter(Boolean);
          const label = typeof r?._label === "string" && r._label ? `${r._label} - ` : "";
          return cells.length ? label + cells.join(", ") : "";
        })
        .filter(Boolean);
      if (rendered.length) parts.push(`${f.label}: [${rendered.join(" | ")}]`);
    } else {
      const t = scalarText(f, v);
      if (t) parts.push(`${f.label}: ${t}`);
    }
  }
  return clip(parts.join("; "), max);
}

const FAIL_WORDS = /\b(fail(ed)?|non[- ]?conform\w*|rejected|held|on hold|not acceptable|unacceptable|deviation)\b/i;

/** Whether any answer in an entry records a failed check or a non-conforming outcome. */
export function entryHasFail(data: Record<string, unknown> | null | undefined): boolean {
  const walk = (v: unknown): boolean => {
    if (v === "fail") return true;
    // A drawn signature is base64, and "/held+" inside it is not somebody recording a hold.
    if (typeof v === "string" && v.startsWith("data:")) return false;
    if (typeof v === "string") return FAIL_WORDS.test(v) && !/\bno\b.*\b(fail|non[- ]?conform)/i.test(v);
    if (Array.isArray(v)) return v.some(walk);
    if (v && typeof v === "object") return Object.entries(v).some(([k, x]) => k !== "name" && walk(x));
    return false;
  };
  return walk(data ?? {});
}

export interface EntryLite {
  id: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  data: Record<string, unknown> | null;
}

export interface FormSummary {
  submitted: number;
  drafts: number;
  first: string | null;        // yyyy-MM-dd of the earliest submitted entry in the window
  last: string | null;
  longestGapDays: number | null; // between consecutive submitted entries, or window start/end
  withFail: string[];          // yyyy-MM-dd of submitted entries carrying a failed check
}

const day = (iso: string) => iso.slice(0, 10);
const DAY_MS = 86400000;

/**
 * The facts for one form over the window [from, to] (ISO dates). Only SUBMITTED entries count as
 * records - a draft is work somebody started - but the draft count is reported, because a pile of
 * unsubmitted drafts is itself something an auditor notices. The longest gap includes the stretch
 * from the window start to the first entry and from the last entry to the window end, so a form
 * that stopped being filled in shows it.
 */
export function summariseForm(entries: EntryLite[], from: string, to: string): FormSummary {
  const lo = Date.parse(day(from)), hi = Date.parse(day(to)) + DAY_MS - 1;
  const inWindow = (iso: string | null) => !!iso && Date.parse(iso) >= lo && Date.parse(iso) <= hi;
  const subs = entries
    .filter(e => e.status === "submitted" && inWindow(e.submitted_at))
    .sort((a, b) => Date.parse(a.submitted_at!) - Date.parse(b.submitted_at!));
  const drafts = entries.filter(e => e.status === "draft").length;
  if (subs.length === 0) return { submitted: 0, drafts, first: null, last: null, longestGapDays: null, withFail: [] };
  const times = [lo, ...subs.map(e => Date.parse(day(e.submitted_at!))), Date.parse(day(to))];
  let gap = 0;
  for (let i = 1; i < times.length; i++) gap = Math.max(gap, Math.round((times[i] - times[i - 1]) / DAY_MS));
  return {
    submitted: subs.length,
    drafts,
    first: day(subs[0].submitted_at!),
    last: day(subs[subs.length - 1].submitted_at!),
    longestGapDays: gap,
    withFail: subs.filter(e => entryHasFail(e.data)).map(e => day(e.submitted_at!)),
  };
}

/**
 * The draft, one line per numbered requirement, in the Code's order. EXHAUSTIVE BY CONSTRUCTION:
 * the model is asked for a line per requirement, but whatever it skips is written here instead -
 * "no site document or record references it" when nothing is tagged to the requirement, so a gap
 * shows as a gap rather than silently dropping out of the evidence (the first cut summarised the
 * clause as a whole and left 2.1.1.1's policy statement out entirely).
 */
export function assembleEvidence(
  window: { from: string; to: string },
  requirementIds: string[],
  modelLines: unknown,
  coverage: Record<string, string[]>,
  maxLine = 450,
): string {
  const given = new Map<string, string>();
  for (const l of Array.isArray(modelLines) ? modelLines : []) {
    const id = typeof (l as any)?.clause === "string" ? clauseIdOf((l as any).clause) : null;
    const text = typeof (l as any)?.text === "string" ? (l as any).text.replace(/\s+/g, " ").trim() : "";
    if (id && text && !given.has(id)) given.set(id, text.replace(new RegExp(`^${id.replace(/\./g, "\\.")}\\s*[:\\-]\\s*`), ""));
  }
  const lines = requirementIds.map(id => {
    const docs = coverage[id] ?? [];
    const text = given.get(id)
      ?? (docs.length
        ? `Referenced by ${docs.join(", ")} - no summary was drafted; review these directly.`
        : "No site document or record references this requirement.");
    return `${id}: ${clip(text, maxLine)}`;
  });
  return [`Records reviewed (${window.from} to ${window.to}):`, ...lines].join("\n");
}

/** The window: the twelve months up to and including `asOf` (yyyy-MM-dd). */
export function auditWindow(asOf: string): { from: string; to: string } {
  const to = /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : new Date().toISOString().slice(0, 10);
  const d = new Date(to + "T00:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  d.setUTCDate(d.getUTCDate() + 1);
  return { from: d.toISOString().slice(0, 10), to };
}
