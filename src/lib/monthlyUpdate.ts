// The Monthly SQF Update Record (FRM-009, FSQM-005 Part 3): what the site's own records say about
// each standing matter since the last update, written into "What was raised" so the SQF
// Practitioner starts from the facts instead of opening eight forms to collect them (owner's
// request, 2026-10-12).
//
// THE RULES THIS FILE KEEPS, the same as the release helper's:
//  - It writes what the RECORDS show, as evidence, into BLANK cells only. Anything typed is left
//    alone, and the row "Anything needing a decision or a resource" is never filled - that one is
//    a judgement, not a lookup.
//  - It never comes back quietly empty. The form says "answer every row, including with none";
//    so a matter with nothing behind it reads "No complaint reported on FRM-002 since 2026-10-07",
//    which names what was looked at. A bare "None" would not say whether anybody looked.
//  - The period runs from the PREVIOUS update's date (the newest submitted FRM-009 before this
//    one) to this update's date, both days included - a day counted twice is better than a day
//    missed. With no earlier update it is the 31 days before, and the line says so.
//  - Unfinished records are read and flagged "(draft)": a complaint somebody has started to write
//    up has still been raised.
//
// Pure: no imports, so scripts/test-monthly-update.mjs can bundle it. The loader is
// loadMonthlyUpdateRecords in monthlyUpdateLoad.ts.

export const UPDATE_FORM = "FRM-009";
export const UPDATE_TARGET = { grid: "matters", column: "raised", date: "update_date" } as const;

/** The standing matters this can speak to, found by how their row label begins. */
export const UPDATE_ROWS = {
  verification: "Verification activities due or overdue",
  capa: "Open corrective actions",
  events: "Complaints, incidents and recalls",
  audits: "Audit and inspection findings",
  changes: "Changes affecting the SQF System",
} as const;
export type UpdateRow = keyof typeof UPDATE_ROWS;

/** The single map of form numbers to the answer keys read. Rename a field on one of these forms, update this. */
export const UPDATE_SOURCES = {
  updates:     { form: "FRM-009", fields: ["update_date"] },
  capas:       { form: "FRM-007", fields: ["capa_no", "severity", "date_raised", "target_close_date", "closure_date", "source", "capa_owner", "is_repeat", "repeat_of", "verification_due", "verification_result", "verification_date"] },
  complaints:  { form: "FRM-002", fields: ["complaint_ref_no", "date_received", "classification", "product_name"] },
  breakages:   { form: "FRM-908", fields: ["incident_ref_no", "date_time_3", "location_area"] },
  holds:       { form: "FRM-702", fields: ["hold_tag_number", "date_time_placed_on_hold", "material_name_description", "final_disposition_decision"] },
  recalls:     { form: "FRM-012", fields: ["record_type", "started", "product"] },
  audits:      { form: "FRM-010", fields: ["audit_date", "quarter", "capa_raised"] },
  inspections: { form: "FRM-913", fields: ["inspection_date", "inspection_type"] },
  changes:     { form: "FRM-015", fields: ["change_type", "raised_on", "decision"] },
} as const;
export type UpdateKind = keyof typeof UPDATE_SOURCES;

export interface UpdateEntry { id: string; status: string; createdAt: string; data: Record<string, any> }
export interface UpdateRecords {
  entries: Record<UpdateKind, UpdateEntry[]>;
  /** The schedule's open reminders, as the notification feed holds them now. */
  reminders: { title: string; severity: string; dueOn: string | null }[];
  /** Every issued controlled document, for "issued or revised since". */
  documents: { number: string; revision: string; effective: string }[];
}

export function emptyUpdateRecords(): UpdateRecords {
  return {
    entries: Object.fromEntries(Object.keys(UPDATE_SOURCES).map(k => [k, []])) as unknown as Record<UpdateKind, UpdateEntry[]>,
    reminders: [], documents: [],
  };
}

/** Field ids this file reads that a live schema no longer has. Shown on the page, never silent. */
export function checkUpdateMapping(fieldIdsByForm: Record<string, string[] | undefined>): string[] {
  const problems: string[] = [];
  for (const spec of Object.values(UPDATE_SOURCES)) {
    const ids = fieldIdsByForm[spec.form];
    if (!ids) { problems.push(`${spec.form} was not found`); continue; }
    for (const k of spec.fields) if (!ids.includes(k)) problems.push(`${spec.form} no longer has "${k}"`);
  }
  return [...new Set(problems)];
}

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const day = (v: unknown) => str(v).slice(0, 10);
const isDraft = (e: UpdateEntry) => e.status !== "submitted";
const draft = (e: UpdateEntry) => (isDraft(e) ? " (draft)" : "");
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
/** An entry somebody opened and left: none of the answers that identify it are there. */
const started = (e: UpdateEntry, keys: readonly string[]) => keys.some(k => str(e.data?.[k]) !== "");

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export interface UpdatePeriod {
  /** First day counted (the previous update's date, or 31 days back). */
  since: string;
  /** Last day counted (this update's date). */
  until: string;
  /** The previous update this runs from; null when there is none on record. */
  previous: string | null;
}

/**
 * The period an update covers: from the newest SUBMITTED update dated before this one, to this
 * one's own date (today while that is blank). A draft update is not "the last update".
 */
export function updatePeriod(updates: UpdateEntry[], selfId: string | null, updateDate: unknown, today: string): UpdatePeriod {
  const until = /^\d{4}-\d{2}-\d{2}$/.test(day(updateDate)) ? day(updateDate) : today;
  const previous = updates
    .filter(e => e.id !== selfId && !isDraft(e) && /^\d{4}-\d{2}-\d{2}$/.test(day(e.data?.update_date)) && day(e.data.update_date) < until)
    .map(e => day(e.data.update_date))
    .sort()
    .pop() ?? null;
  return { since: previous ?? addDays(until, -31), until, previous };
}

const within = (d: string, p: UpdatePeriod) => d !== "" && d >= p.since && d <= p.until;
/** An entry's own date, else the day it was created. */
const dated = (e: UpdateEntry, key: string) => day(e.data?.[key]) || day(e.createdAt);
const inPeriod = (list: UpdateEntry[], key: string, keys: readonly string[], p: UpdatePeriod) =>
  list.filter(e => started(e, keys) && within(dated(e, key), p)).sort((a, b) => dated(a, key).localeCompare(dated(b, key)));

/** How many answers of an entry are a recorded Fail (an inspection's failed items), tables included. */
function fails(v: unknown): number {
  if (v === "fail") return 1;
  if (Array.isArray(v)) return v.reduce<number>((n, x) => n + fails(x), 0);
  if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).reduce<number>((n, x) => n + fails(x), 0);
  return 0;
}

/** "since the last update on 2026-10-07" / "in the 31 days to 2026-10-12 (no earlier update on record)". */
export function periodPhrase(p: UpdatePeriod): string {
  return p.previous ? `since the last update on ${p.previous}` : `in the 31 days to ${p.until} (no earlier update on record)`;
}

/** A heading, then each item on its own line with a leading bullet (owner's request, 2026-10-12). */
const BULLET = "\u2022 ";
const list = (head: string, items: string[]) => [`${head}:`, ...items.map(i => BULLET + i)].join("\n");

/**
 * The monthly review of corrective actions FSQM-009 Parts 8 and 9 ask for (owner, 2026-10-16: the
 * schedule's "Review of open and overdue corrective actions" is recorded here, on FRM-009).
 * In the period - since the last update, or EVERY CAPA on record when there is none - what was
 * opened (by source and severity), what was closed (with its effectiveness result), the repeats
 * and the sources that recurred; then every CAPA still open, whenever raised, with its owner,
 * target, and verification date, flagged PAST DUE / OVERDUE. Evidence only: whether an overdue
 * action has a revised date with a reason is the reviewer's to write.
 */
export function capaReview(capas: UpdateEntry[], p: UpdatePeriod): string {
  const KEYS = ["capa_no", "date_raised", "severity"] as const;
  const real = capas.filter(e => started(e, KEYS));
  const no = (e: UpdateEntry) => str(e.data.capa_no) || "(no number)";
  const closedOn = (e: UpdateEntry) => day(e.data.closure_date);
  const isClosed = (e: UpdateEntry) => closedOn(e) !== "" || !isDraft(e);
  // With no earlier update, the review covers every CAPA on record.
  const all = !p.previous;
  const inWindow = (d: string) => (all ? d !== "" : within(d, p));
  const span = all ? "on record (no earlier update)" : `since the last update on ${p.previous}`;
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const tally = (xs: string[]) => count(xs).map(([k, n]) => `${k} ${n}`).join(", ");

  const opened = real.filter(e => inWindow(dated(e, "date_raised"))).sort((a, b) => dated(a, "date_raised").localeCompare(dated(b, "date_raised")));
  const sources = opened.map(e => str(e.data.source) || "source not recorded");
  const openedLine = opened.length === 0
    ? `No corrective action opened on FRM-007 ${span}.`
    : list(`${plural(opened.length, "corrective action")} opened ${span} (by source: ${tally(sources)}; by severity: ${tally(opened.map(e => str(e.data.severity) || "not set"))})`,
      opened.map(e => `${no(e)} raised ${dated(e, "date_raised")}, ${str(e.data.severity) || "severity not set"}, ${str(e.data.source) || "source not recorded"}${draft(e)}`));

  const closed = real.filter(e => isClosed(e) && inWindow(closedOn(e) || dated(e, "date_raised")))
    .sort((a, b) => (closedOn(a) || "").localeCompare(closedOn(b) || ""));
  const closedLine = closed.length === 0
    ? `No corrective action closed ${span}.`
    : list(`${plural(closed.length, "corrective action")} closed ${span}`, closed.map(e => {
        const result = str(e.data.verification_result).split(/\s[—–-]\s/)[0];
        const verified = day(e.data.verification_date);
        return `${no(e)} closed ${closedOn(e) || "(no closure date)"}: ${result ? `verified ${result}${verified ? ` on ${verified}` : ""}` : "NO EFFECTIVENESS RESULT RECORDED"}`;
      }));

  const repeats = opened.filter(e => e.data.is_repeat === true || str(e.data.repeat_of) !== "");
  const recurring = count(sources).filter(([k, n]) => n >= 2 && k !== "source not recorded");
  const repeatLine = repeats.length === 0 && recurring.length === 0
    ? `No repeat and no recurring source ${span}.`
    : list("Repeats and recurring sources", [
        ...repeats.map(e => `${no(e)} is a repeat${str(e.data.repeat_of) ? ` of ${str(e.data.repeat_of)}` : ""}`),
        ...recurring.map(([k, n]) => `${k}: ${n} CAPAs ${span}`),
      ]);

  const open = real.filter(e => !isClosed(e)).sort((a, b) => dated(a, "date_raised").localeCompare(dated(b, "date_raised")));
  const openLine = open.length === 0
    ? `No corrective action is open on FRM-007 as of ${p.until}.`
    : list(`${plural(open.length, "corrective action")} still open on FRM-007 (whenever raised)`, open.map(e => {
        const target = day(e.data.target_close_date);
        const vdue = day(e.data.verification_due);
        const raised = day(e.data.date_raised);
        const parts = [str(e.data.severity), str(e.data.capa_owner) ? `owner ${str(e.data.capa_owner)}` : "no owner",
          raised ? `raised ${raised}` : "", target ? `target ${target}${target < p.until ? " - PAST DUE" : ""}` : "no target date",
          vdue ? `verification due ${vdue}${vdue < p.until && !str(e.data.verification_result) ? " - OVERDUE" : ""}` : ""];
        return `${no(e)} (${parts.filter(Boolean).join(", ")})`;
      }));

  return [openLine, openedLine, closedLine, repeatLine,
    "An overdue action needs a revised date and its reason recorded on its FRM-007 - add any here."].join("\n");
}

/** What the records say about each matter. Every line names the form it read. */
export function monthlyUpdateLines(records: UpdateRecords, p: UpdatePeriod): Record<UpdateRow, string> {
  const E = records.entries;
  const when = periodPhrase(p);

  // --- the verification schedule, as it stands now
  const name = (t: string) => t.replace(/\s+is\s+(over)?due$/i, "");
  const overdue = records.reminders.filter(r => r.severity === "overdue");
  const due = records.reminders.filter(r => r.severity !== "overdue");
  const listed = (rs: typeof records.reminders) => rs.map(r => `${name(r.title)}${r.dueOn ? ` (due ${r.dueOn})` : ""}`);
  const verification = records.reminders.length === 0
    ? `Nothing on the verification schedule is due or overdue as of ${p.until}.`
    : [overdue.length ? list("Overdue", listed(overdue)) : "", due.length ? list("Due", listed(due)) : ""].filter(Boolean).join("\n");

  const capa = capaReview(E.capas, p);

  // --- complaints, incidents and recalls in the period
  const complaints = inPeriod(E.complaints, "date_received", ["complaint_ref_no", "date_received", "classification", "product_name"], p);
  const critical = complaints.filter(e => str(e.data.classification).startsWith("Critical")).length;
  const complaintLine = complaints.length === 0
    ? `No complaint reported on FRM-002 ${when}.`
    : list(`${plural(complaints.length, "complaint")} on FRM-002 ${when} (${critical} Critical, ${complaints.length - critical} other)`,
      complaints.map(e => `${str(e.data.complaint_ref_no) || "(no number)"} ${dated(e, "date_received")}${str(e.data.product_name) ? `, ${str(e.data.product_name)}` : ""}${str(e.data.classification) ? `, ${str(e.data.classification).split(" (")[0]}` : ", not yet classified"}${draft(e)}`));
  const breakages = inPeriod(E.breakages, "date_time_3", ["incident_ref_no", "date_time_3", "location_area"], p);
  const breakLine = breakages.length === 0
    ? "No glass or brittle plastic breakage on FRM-908."
    : list(`${plural(breakages.length, "breakage")} on FRM-908`, breakages.map(e => `${str(e.data.incident_ref_no) || "(no number)"} ${dated(e, "date_time_3")}${str(e.data.location_area) ? `, ${str(e.data.location_area)}` : ""}${draft(e)}`));
  const holds = inPeriod(E.holds, "date_time_placed_on_hold", ["hold_tag_number", "date_time_placed_on_hold", "material_name_description"], p);
  const holdLine = holds.length === 0
    ? "Nothing put on hold on FRM-702."
    : list(`${plural(holds.length, "hold")} on FRM-702`, holds.map(e => `tag ${str(e.data.hold_tag_number) || "(no number)"} ${dated(e, "date_time_placed_on_hold")}${str(e.data.material_name_description) ? `, ${str(e.data.material_name_description)}` : ""}, ${str(e.data.final_disposition_decision) ? "decided" : "STILL OPEN"}`));
  const recalls = inPeriod(E.recalls, "started", ["record_type", "started", "product"], p);
  const recallLine = recalls.length === 0
    ? "No withdrawal, recall or mock recall on FRM-012."
    : list(`${plural(recalls.length, "record")} on FRM-012`, recalls.map(e => `${str(e.data.record_type) || "Recall record"} started ${dated(e, "started")}${str(e.data.product) ? `, ${str(e.data.product)}` : ""}${draft(e)}`));
  const events = [complaintLine, breakLine, holdLine, recallLine].join("\n");

  // --- audits and inspections in the period
  const audits = inPeriod(E.audits, "audit_date", ["audit_date", "quarter"], p);
  const auditLine = audits.length === 0
    ? `No internal audit recorded on FRM-010 ${when}.`
    : list(`${plural(audits.length, "internal audit")} on FRM-010`, audits.map(e => `${dated(e, "audit_date")}${str(e.data.quarter) ? ` (${str(e.data.quarter).split(" (")[0]})` : ""}: ${str(e.data.capa_raised) || "outcome not yet recorded"}${draft(e)}`));
  const inspections = inPeriod(E.inspections, "inspection_date", ["inspection_date", "inspection_type"], p);
  const inspectionLine = inspections.length === 0
    ? "No GMP inspection recorded on FRM-913."
    : list(`${plural(inspections.length, "GMP inspection")} on FRM-913`, inspections.map(e => {
        const n = fails(e.data);
        return `${dated(e, "inspection_date")}${str(e.data.inspection_type) ? ` (${str(e.data.inspection_type)})` : ""}: ${n === 0 ? "no item failed" : `${plural(n, "item")} failed`}${draft(e)}`;
      }));
  const auditsText = [auditLine, inspectionLine, "Customer, certification body and regulatory visits are not on a form - add any here."].join("\n");

  // --- changes in the period
  const changed = inPeriod(E.changes, "raised_on", ["change_type", "raised_on"], p);
  const changeLine = changed.length === 0
    ? `No change assessed on FRM-015 ${when}.`
    : list(`${plural(changed.length, "change")} assessed on FRM-015`, changed.map(e => `${str(e.data.change_type) || "change"} ${dated(e, "raised_on")}, ${str(e.data.decision) || "not yet decided"}${draft(e)}`));
  const docs = records.documents.filter(d => within(day(d.effective), p)).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  const SHOWN = 15;
  const docLine = docs.length === 0
    ? "No controlled document issued or revised."
    : list(`${plural(docs.length, "controlled document")} issued or revised`,
      [...docs.slice(0, SHOWN).map(d => `${d.number} ${d.revision}`.trim()), ...(docs.length > SHOWN ? [`and ${docs.length - SHOWN} more`] : [])]);
  const changes = [changeLine, docLine, "Changes in food law or guidance (FSQM-011) are not on a form - add any here."].join("\n");

  return { verification, capa, events, audits: auditsText, changes };
}

export interface UpdateFill {
  values: Record<string, any>;
  /** The matters that were filled, by their row's first line. */
  filled: string[];
  /** The matters left alone because something was already written there. */
  kept: string[];
}

/** Write the lines into the BLANK "What was raised" cells of their rows. Nothing typed is touched. */
export function applyMonthlyUpdate(values: Record<string, any>, lines: Record<UpdateRow, string>, rowLabels: string[]): UpdateFill {
  const rows: Record<string, any>[] = Array.isArray(values[UPDATE_TARGET.grid])
    ? values[UPDATE_TARGET.grid].map((r: any) => ({ ...(r ?? {}) })) : [];
  const filled: string[] = [];
  const kept: string[] = [];
  for (const [key, prefix] of Object.entries(UPDATE_ROWS) as [UpdateRow, string][]) {
    const i = rowLabels.findIndex(l => l.startsWith(prefix));
    if (i < 0) continue;
    while (rows.length <= i) rows.push({});
    const label = rowLabels[i].split("\n")[0];
    if (str(rows[i][UPDATE_TARGET.column]) !== "") { kept.push(label); continue; }
    rows[i][UPDATE_TARGET.column] = lines[key];
    filled.push(label);
  }
  return filled.length ? { values: { ...values, [UPDATE_TARGET.grid]: rows }, filled, kept } : { values, filled, kept };
}

/** Does this revision of the form have the table, the column and at least one of the rows this fills? */
export function monthlyUpdateReady(schema: { sections?: { fields?: any[] }[] } | null | undefined): boolean {
  const grid = (schema?.sections ?? []).flatMap(s => s.fields ?? []).find(f => f?.id === UPDATE_TARGET.grid && f?.type === "grid");
  const labels: string[] = grid?.rows?.mode === "fixed" && Array.isArray(grid.rows.labels) ? grid.rows.labels : [];
  return !!grid && (grid.columns ?? []).some((c: any) => c?.id === UPDATE_TARGET.column)
    && Object.values(UPDATE_ROWS).some(prefix => labels.some(l => l.startsWith(prefix)));
}
