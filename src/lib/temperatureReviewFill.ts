// FRM-401 Temperature Monitoring Review - the pure half of "fill from the temperature logs".
//
// Split out of temperatureReview.ts (which keeps the supabase reads and date-fns) so that
// scripts/test-temperature-review.mjs can bundle this file alone. No imports, on purpose.
//
// What is filled, and the rule it follows (the release helper's rule): objective figures into
// blank cells only. Each unit's Min/Max/Avg, the month's alert log, and - since 2026-10-12, when
// the walk-in freezer was switched off - each unit's STATE for the month and the "placed in or
// out of service" row that SOP-401 Part 7 asks the review to carry. Everything that is a
// judgement (held its limit, the action was appropriate, the return conditions were met) stays
// the reviewer's.

export type SummaryRow = {
  name: string; count: number; min: number | null; max: number | null; avg: number | null; humidity: number | null;
};

/** One temperature_limits row, as much of it as the fill needs. */
export type UnitState = {
  name: string;
  kind: "storage" | "ambient" | string;
  in_service: boolean;
  /** When the unit last changed state (temperature_limits.in_service_changed_at), ISO. */
  changed_at: string | null;
  /** Why (temperature_limits.in_service_reason, from migration 20261012000003). */
  reason?: string | null;
};

export const STATE_IN_SERVICE = "In service";
export const STATE_OUT_OF_SERVICE = "Out of service";
export const STATE_NOT_STORAGE = "Not a storage unit";
export const STATE_CHANGED = "Changed during the month";

export const CHANGE_OUT = "Placed out of service";
export const CHANGE_IN = "Returned to service";

/** "YYYY-MM-DD" of an ISO timestamp, in the LOCAL calendar - the review is a calendar month. */
function localDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Did the unit change state within the month (both ends included)? */
export function changedInMonth(u: UnitState, start: string, end: string): boolean {
  if (!u.changed_at) return false;
  const day = localDate(u.changed_at);
  return !!day && day >= start && day <= end;
}

/**
 * The "State this month" answer for a unit. A change inside the month wins: that is the one
 * state the reviewer must look at, and the service_changes row below says what happened.
 */
export function unitStateForMonth(u: UnitState, start: string, end: string): string {
  if (u.kind !== "storage") return STATE_NOT_STORAGE;
  if (changedInMonth(u, start, end)) return STATE_CHANGED;
  return u.in_service ? STATE_IN_SERVICE : STATE_OUT_OF_SERVICE;
}

/**
 * The rows of "Units placed in or out of service this month (SOP-401 Part 7)". One per storage
 * unit whose last state change fell in the month. temperature_limits keeps only the LAST change,
 * so a unit switched off and on again within one month shows the later change only - the
 * reviewer adds the earlier one by hand, and the alert log will show the gap either way.
 * Return conditions and "food first placed" are never filled: they are the reviewer's attestation.
 */
export function serviceChangesInMonth(units: UnitState[], start: string, end: string): Record<string, any>[] {
  return units
    .filter(u => u.kind === "storage" && changedInMonth(u, start, end))
    .sort((a, b) => String(a.changed_at).localeCompare(String(b.changed_at)))
    .map(u => ({
      unit: u.name,
      change: u.in_service ? CHANGE_IN : CHANGE_OUT,
      changed_on: localDate(u.changed_at as string),
      reason: u.reason?.trim() || "",
    }));
}

export type Frm401FillOptions = {
  /** The units' current state; without it the state column and service_changes are left as they are. */
  units?: UnitState[];
  /** The month's first and last day, "YYYY-MM-DD" (month-to-date for the current month). */
  start?: string;
  end?: string;
};

// Builds the complete prefill for a NEW FRM-401 response from the month's
// per-unit summary: the objective figures a reviewer would otherwise copy by
// hand - month, date, and each unit's Min/Max/Avg F. Everything that is a
// judgement or needs off-system evidence (held-limit pass/fail, logging gaps,
// the alert log's appropriateness, findings, signature) is left blank.
// Unit rows are read from the form's own grid definition so they stay in sync
// with the schema, matched to a summary row by unit name (== equipment_name).
export function deriveFrm401Prefill(
  schema: any,
  summary: SummaryRow[],
  alertRows: Record<string, any>[],
  monthLabel: string,
  todayStr: string,
  opts: Frm401FillOptions = {},
): Record<string, any> {
  const fmt1 = (n: number | null) => (n == null ? "" : n.toFixed(1));
  const byName = new Map(summary.map((s) => [s.name, s]));
  const unitByName = new Map((opts.units ?? []).map((u) => [u.name, u]));
  const haveRange = !!(opts.units && opts.start && opts.end);

  let grid: any = null;
  for (const sec of schema?.sections ?? []) {
    for (const f of sec.fields ?? []) if (f.id === "unit_summary") grid = f;
  }

  const prefill: Record<string, any> = { review_month: monthLabel, review_date: todayStr };
  if (grid?.rows?.mode === "fixed") {
    const { labels = [], defaultValues, deletable } = grid.rows;
    prefill.unit_summary = labels.map((label: string, i: number) => {
      const row: Record<string, any> = {
        ...(deletable ? { _label: label } : {}),
        ...(defaultValues?.[i] ?? {}),
      };
      const u = unitByName.get(label);
      const state = haveRange && u ? unitStateForMonth(u, opts.start as string, opts.end as string) : null;
      if (state) row.state = state;
      const s = byName.get(label);
      // A unit out of service for the whole month: the form says to leave its temperatures
      // blank and say so in the state column. Readings still arrive (the sensor runs on its
      // own battery), but they are a switched-off box's air, not a monitored temperature.
      if (s && s.count && state !== STATE_OUT_OF_SERVICE) {
        row.min_f = fmt1(s.min);
        row.max_f = fmt1(s.max);
        row.avg_f = fmt1(s.avg);
      }
      return row;
    });
  }

  // Alerts raised this month, one grid row each (the objective columns only -
  // whether the response was adequate stays the reviewer's call). A month with
  // no alerts gets the single "No alerts raised" row the form asks for, so a
  // quiet month reads differently from an unreviewed one.
  prefill.alert_log = alertRows.length ? alertRows : [{ kind: "No alerts raised" }];

  if (haveRange) {
    const changes = serviceChangesInMonth(opts.units as UnitState[], opts.start as string, opts.end as string);
    if (changes.length) prefill.service_changes = changes;
  }
  return prefill;
}

// FRM-401 allows one open draft per person, so createResponse hands back an existing draft
// UNTOUCHED and the prefill never lands. That was a real bug: a draft opened from the SOPs
// Library (no month, no figures) made every "Start FRM-401 Review" click reopen it blank.
// This fills the blanks of whatever came back and never overwrites a value somebody entered.
// A draft already for a DIFFERENT month is left alone and reported, not re-pointed.
const isBlankValue = (v: unknown) => v == null || v === "";
const rowIsBlank = (r: Record<string, any> | null | undefined) =>
  !r || Object.entries(r).every(([k, v]) => k === "_label" || isBlankValue(v));

// The state column arrives pre-answered from the grid's defaultValues ("In service"), so
// "blank" cannot be the test for it. A unit row nobody has touched - every other cell still
// empty - takes the derived state; once a figure or a judgement is on the row, the state is
// the person's and is kept.
const STATE_PEERS = ["min_f", "max_f", "avg_f", "held_limit", "gaps"];
const rowUntouchedButState = (r: Record<string, any>) =>
  STATE_PEERS.every(k => isBlankValue(r[k]));

export function mergeFrm401Prefill(
  existing: Record<string, any>,
  prefill: Record<string, any>,
): { data: Record<string, any>; changed: boolean; otherMonth?: string } {
  const month = existing?.review_month;
  if (!isBlankValue(month) && month !== prefill.review_month) {
    return { data: existing, changed: false, otherMonth: String(month) };
  }
  const data: Record<string, any> = { ...existing };
  let changed = false;

  for (const key of ["review_month", "review_date"]) {
    if (isBlankValue(data[key]) && !isBlankValue(prefill[key])) { data[key] = prefill[key]; changed = true; }
  }

  if (Array.isArray(prefill.unit_summary)) {
    const rows: Record<string, any>[] = Array.isArray(data.unit_summary) ? data.unit_summary.map((r: any) => ({ ...r })) : [];
    for (const [i, p] of prefill.unit_summary.entries()) {
      // registers key rows by _label; fall back to position for a plain fixed grid
      const idx = p._label != null ? rows.findIndex(r => r?._label === p._label) : i;
      if (idx < 0 || !rows[idx]) { rows.push({ ...p }); changed = true; continue; }
      if (!isBlankValue(p.state) && rows[idx].state !== p.state
          && (isBlankValue(rows[idx].state) || rowUntouchedButState(rows[idx]))) {
        rows[idx].state = p.state; changed = true;
      }
      for (const col of ["min_f", "max_f", "avg_f"]) {
        if (isBlankValue(rows[idx][col]) && !isBlankValue(p[col])) { rows[idx][col] = p[col]; changed = true; }
      }
    }
    data.unit_summary = rows;
  }

  const alerts = data.alert_log;
  if (Array.isArray(prefill.alert_log) && (!Array.isArray(alerts) || alerts.every(rowIsBlank))) {
    data.alert_log = prefill.alert_log;
    changed = true;
  }

  // Service changes: one row per change, so a change already on the entry (same unit, same
  // date) is left as the person wrote it and a new one is appended.
  if (Array.isArray(prefill.service_changes) && prefill.service_changes.length) {
    const rows: Record<string, any>[] = Array.isArray(data.service_changes)
      ? data.service_changes.filter((r: any) => !rowIsBlank(r)).map((r: any) => ({ ...r }))
      : [];
    for (const p of prefill.service_changes) {
      const dup = rows.some(r => r.unit === p.unit && r.changed_on === p.changed_on);
      if (!dup) { rows.push({ ...p }); changed = true; }
    }
    data.service_changes = rows;
  }
  return { data, changed };
}
