// FRM-401 Temperature Monitoring Review, filled from the temperature logs.
//
// One set of functions, two ways in: "Start FRM-401 Review" on the Temperature Monitoring page,
// and the "Fill from the temperature logs" card on an FRM-401 entry itself (an entry started from
// the SOPs Library used to open with nothing in it). Both read the same calendar month and write
// the same figures, so the two can never disagree.

import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ALERT_KIND_LABEL, formatWorstValue, type TemperatureAlert } from "@/lib/temperatureAlerts";

export const TEMPERATURE_REVIEW_FORM = "FRM-401";


export type SummaryRow = { name: string; count: number; min: number | null; max: number | null; avg: number | null; humidity: number | null };

export type TempRow = {
  id: number;
  created_at: string;
  device_id: string | null;
  equipment_name: string | null;
  temperature_celsius: number | null;
  temperature_fahrenheit: number | null;
  humidity: number | null;
  battery_level: number | null;
  low_battery_alarm: boolean | null;
};

// Build the FRM-401 (monthly temperature review) prefill from the page's own
// per-unit summary: the objective figures a reviewer would otherwise copy by
// hand — month, date, and each unit's Min/Max/Avg °F. Everything that is a
// judgement or needs off-system evidence (held-limit pass/fail, logging gaps,
// the alert log, the probe accuracy check, findings, signature) is left blank.
// Unit rows are read from the form's own grid definition so they stay in sync
// with the schema, matched to a summary row by unit name (== equipment_name).
export function deriveFrm401Prefill(
  schema: any,
  summary: SummaryRow[],
  alertRows: Record<string, any>[],
  monthLabel: string,
  todayStr: string,
): Record<string, any> {
  const fmt1 = (n: number | null) => (n == null ? "" : n.toFixed(1));
  const byName = new Map(summary.map((s) => [s.name, s]));

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
      const s = byName.get(label);
      if (s && s.count) {
        row.min_f = fmt1(s.min);
        row.max_f = fmt1(s.max);
        row.avg_f = fmt1(s.avg);
      }
      return row;
    });
  }

  // Alerts raised this month, one grid row each (the objective columns only —
  // whether the response was adequate stays the reviewer's call). A month with
  // no alerts gets the single "No alerts raised" row the form asks for, so a
  // quiet month reads differently from an unreviewed one.
  prefill.alert_log = alertRows.length ? alertRows : [{ kind: "No alerts raised" }];
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
  return { data, changed };
}

// Per-unit min/max/avg °F (+ humidity) over a set of readings. Shared by the
// on-screen Summary table and the FRM-401 derivation so the two never drift.
export function summarize(rows: TempRow[]): SummaryRow[] {
  const map = new Map<string, { count: number; min: number; max: number; sum: number; humSum: number; humCount: number }>();
  for (const r of rows) {
    const key = r.equipment_name || r.device_id || "Unknown";
    const f = r.temperature_fahrenheit;
    if (f === null) continue;
    const cur = map.get(key) ?? { count: 0, min: Infinity, max: -Infinity, sum: 0, humSum: 0, humCount: 0 };
    cur.count++;
    cur.min = Math.min(cur.min, f);
    cur.max = Math.max(cur.max, f);
    cur.sum += f;
    if (r.humidity !== null) { cur.humSum += r.humidity; cur.humCount++; }
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([name, s]) => ({
      name,
      count: s.count,
      min: s.count ? s.min : null,
      max: s.count ? s.max : null,
      avg: s.count ? s.sum / s.count : null,
      humidity: s.humCount ? s.humSum / s.humCount : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Resolve a picked "YYYY-MM" to the calendar-month range FRM-401 reviews:
// month-to-date for the current month, the full month for a past one.
export function monthRange(ym: string): { start: string; end: string; label: string; toDate: boolean } {
  const [y, m] = ym.split("-").map(Number);
  const startD = new Date(y, m - 1, 1);
  const isCurrent = ym === format(new Date(), "yyyy-MM");
  const endD = isCurrent ? new Date() : new Date(y, m, 0); // last day of that month
  return {
    start: format(startD, "yyyy-MM-dd"),
    end: format(endD, "yyyy-MM-dd"),
    label: format(startD, "MMMM yyyy"),
    toDate: isCurrent,
  };
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "September 2026" (what Month reviewed holds) -> "2026-09"; null for anything else. */
export function monthLabelToYm(label: unknown): string | null {
  const m = typeof label === "string" ? label.trim().match(/^([A-Za-z]+)\s+(\d{4})$/) : null;
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1].toLowerCase());
  return idx < 0 ? null : `${m[2]}-${String(idx + 1).padStart(2, "0")}`;
}

/** True when the entry's form has the fields the fill writes - a renamed field switches it off. */
export function temperatureReviewReady(schema: any): boolean {
  const ids = new Set<string>();
  for (const sec of schema?.sections ?? []) for (const f of sec.fields ?? []) ids.add(f.id);
  return ["review_month", "review_date", "unit_summary", "alert_log"].every(id => ids.has(id));
}

/**
 * Read one calendar month ("YYYY-MM") of readings and alerts and turn them into FRM-401 answers:
 * the month, today's date, each unit's Min/Max/Avg and one row per alert. Month-to-date for the
 * current month, the whole month for a past one. Reads only; the caller decides where it goes.
 */
export async function loadFrm401Prefill(schema: any, ym: string): Promise<{
  prefill: Record<string, any>; label: string; start: string; end: string;
}> {
  const { start, end, label } = monthRange(ym);
  const startTs = new Date(`${start}T00:00:00`).toISOString();
  const endTs = new Date(`${end}T23:59:59.999`).toISOString();

  const { data: logs, error: logErr } = await supabase
    .from("temperature_logs" as any)
    .select("id, created_at, device_id, equipment_name, temperature_celsius, temperature_fahrenheit, humidity, battery_level, low_battery_alarm")
    .gte("created_at", startTs)
    .lte("created_at", endTs)
    .order("created_at", { ascending: true })
    .limit(10000);
  if (logErr) throw logErr;
  const monthSummary = summarize((logs ?? []) as unknown as TempRow[]);

  // Alerts opened during the month, for the "Alerts raised this month" grid.
  const { data: alertData, error: alertErr } = await supabase
    .from("temperature_alerts" as any)
    .select("*")
    .gte("opened_at", startTs)
    .lte("opened_at", endTs)
    .order("opened_at", { ascending: true });
  if (alertErr) throw alertErr;
  const alertRows = ((alertData ?? []) as unknown as TemperatureAlert[]).map((a) => ({
    unit: a.equipment_name,
    kind: ALERT_KIND_LABEL[a.kind] ?? "",
    opened: a.opened_at ? a.opened_at.slice(0, 10) : "",
    worst: formatWorstValue(a),
    // The system recorded an acknowledgement, so mark it acknowledged (a
    // fact) and carry the recorded action - which usually states the product
    // disposition - into that column. Whether the action was *appropriate*
    // stays the reviewer's call (action_adequate left blank).
    acknowledged: a.acknowledged_at ? "pass" : "",
    product_affected: a.action_taken ?? "",
  }));

  const prefill = deriveFrm401Prefill(schema, monthSummary, alertRows, label, format(new Date(), "yyyy-MM-dd"));
  return { prefill, label, start, end };
}
