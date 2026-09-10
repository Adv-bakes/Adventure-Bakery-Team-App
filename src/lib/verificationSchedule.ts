// D-18 verification due-date maths, for the Team Portal.
//
// THIS FILE IS A TWIN of supabase/functions/_shared/verificationSchedule.ts and is IDENTICAL to it
// below this header. Do not edit one without the other.
//
// The duplication is deliberate. The edge-function copy uses Deno-style .ts import specifiers and a
// client bundle should not pull in server code, so the repo already copies rather than reaches
// across that boundary - limitText() is duplicated into src/lib/temperatureAlerts.ts for the same
// reason. But that precedent copies a LABEL and this is date arithmetic, where drift is silent and
// material: the schedule page would show one next-due date while the job raised notifications on
// another. So scripts/test-verification-schedule.mjs bundles BOTH copies and asserts they agree on
// a table of cases. If you edit this file, run that script.
//
// Nothing here does I/O, and nothing here reads the clock - `today` is always passed in.

export type FrequencyUnit = "day" | "week" | "month" | "quarter" | "year";

export type ScheduleRow = {
  id?: string;
  activity_key: string;
  activity: string;
  description?: string | null;
  frequency_unit: FrequencyUnit;
  frequency_count: number;
  responsible_position: string;
  evidence_kind: "form_entry" | "document_revision" | "none";
  evidence_document_number?: string | null;
  owning_program?: string | null;
  pending_deliverable?: string | null;
  sqf_reference?: string | null;
  lead_days: number;
  grace_days: number;
  first_due_on?: string | null;
  status: "active" | "planned" | "retired";
  sort_order?: number;
};

/** Last time an activity was actually performed, from the evidence record - never stored. */
export type Completion = { activity_key: string; completed_on: string | null };

export type DueSeverity = "due" | "overdue";

export type DueFinding = {
  activityKey: string;
  activity: string;
  dueOn: string | null;
  severity: DueSeverity;
  title: string;
  message: string;
  responsiblePosition: string;
  dedupeKey: string;
  neverDone: boolean;
};

/** What the schedule page shows per row. `state` is "planned" for a row awaiting its program. */
export type RowState = {
  lastCompletedOn: string | null;
  nextDueOn: string | null;
  state: "planned" | "retired" | "never" | "ok" | "due" | "overdue";
};

const UNIT_MONTHS: Partial<Record<FrequencyUnit, number>> = { month: 1, quarter: 3, year: 12 };

// ---------------------------------------------------------------- date arithmetic
// All of it on Date.UTC from split ISO parts. `new Date("2026-09-10")` then .getMonth() reads back
// in local time and is off by a day for anyone west of Greenwich, which is the whole hemisphere
// this bakery is in.

function parts(iso: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`not a yyyy-MM-dd date: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function iso(y: number, mo: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, mo: number): number {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

export function addDays(from: string, days: number): string {
  const [y, mo, d] = parts(from);
  const t = new Date(Date.UTC(y, mo - 1, d + days));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function addMonths(from: string, months: number): string {
  const [y, mo, d] = parts(from);
  const zero = (y * 12 + (mo - 1)) + months;
  const ty = Math.floor(zero / 12);
  const tm = (zero % 12) + 1;
  // Clamp rather than roll over: 31 Jan + 1 month is 28 Feb, not 3 March. An annual review that
  // rolls forward a few days every year eventually stops being annual.
  return iso(ty, tm, Math.min(d, daysInMonth(ty, tm)));
}

export function addFrequency(from: string, unit: FrequencyUnit, count: number): string {
  if (!Number.isInteger(count) || count < 1) throw new Error(`bad frequency_count: ${count}`);
  if (unit === "day") return addDays(from, count);
  if (unit === "week") return addDays(from, count * 7);
  const months = UNIT_MONTHS[unit];
  if (!months) throw new Error(`bad frequency_unit: ${unit}`);
  return addMonths(from, months * count);
}

export function frequencyLabel(unit: FrequencyUnit, count: number): string {
  if (count === 1) {
    return { day: "Daily", week: "Weekly", month: "Monthly",
             quarter: "Quarterly", year: "Annually" }[unit];
  }
  const plural = { day: "days", week: "weeks", month: "months",
                   quarter: "quarters", year: "years" }[unit];
  return `Every ${count} ${plural}`;
}

// ---------------------------------------------------------------- due dates

/**
 * When is this activity next due?
 *
 * Anchored on the last time it was actually recorded. Where it has never been recorded, the row's
 * first_due_on IS the due date rather than the base to add a period to - otherwise a schedule
 * seeded today would go quiet for a year before its first annual activity was ever asked for.
 * Returns null when there is no anchor at all, which is a real state and not an error: the
 * activity has never been done and nobody has said when it should first happen.
 */
export function nextDue(row: ScheduleRow, lastCompletedOn: string | null): string | null {
  if (lastCompletedOn) return addFrequency(lastCompletedOn, row.frequency_unit, row.frequency_count);
  return row.first_due_on ?? null;
}

export function dedupeKeyFor(activityKey: string, dueOn: string | null): string {
  // A never-anchored activity gets ONE key rather than one per day. Keying it on today's date
  // would raise a fresh notification every morning and re-raise it the moment somebody cleared
  // the last one, which is how a feed teaches people to ignore it.
  return `verification:${activityKey}:${dueOn ?? "never"}`;
}

/** The per-row view the schedule page renders. Pure; safe to call for any status. */
export function rowState(row: ScheduleRow, lastCompletedOn: string | null, today: string): RowState {
  if (row.status === "planned") return { lastCompletedOn, nextDueOn: null, state: "planned" };
  if (row.status === "retired") return { lastCompletedOn, nextDueOn: null, state: "retired" };
  const due = nextDue(row, lastCompletedOn);
  if (!due) return { lastCompletedOn, nextDueOn: null, state: "never" };
  if (today > addDays(due, row.grace_days)) return { lastCompletedOn, nextDueOn: due, state: "overdue" };
  if (today >= addDays(due, -row.lead_days)) return { lastCompletedOn, nextDueOn: due, state: "due" };
  return { lastCompletedOn, nextDueOn: due, state: "ok" };
}

/**
 * Which activities should raise a notification today.
 *
 * A row that is not `active` produces NOTHING. That is the single most important line here: five of
 * the seeded rows are `planned`, waiting on programs that have not been issued (calibration, water,
 * compressed air, CCP record review), and raising "CCP record review is overdue" at a site with no
 * HACCP plan would be the machinery asserting something the document set explicitly denies.
 */
export function assessDue(
  rows: ScheduleRow[],
  completions: Completion[],
  today: string,
): DueFinding[] {
  const last = new Map(completions.map((c) => [c.activity_key, c.completed_on]));
  const out: DueFinding[] = [];

  for (const row of rows) {
    if (row.status !== "active") continue;

    const lastCompletedOn = last.get(row.activity_key) ?? null;
    const st = rowState(row, lastCompletedOn, today);
    if (st.state !== "due" && st.state !== "overdue" && st.state !== "never") continue;

    const neverDone = st.state === "never";
    const severity: DueSeverity = st.state === "overdue" ? "overdue" : "due";
    const freq = frequencyLabel(row.frequency_unit, row.frequency_count);
    const where = row.evidence_kind === "frm008"
      ? "Record it on FRM-008."
      : row.evidence_document_number
        ? `Record it on ${row.evidence_document_number}.`
        : "";

    const bits: string[] = [`${freq}.`];
    if (neverDone) {
      bits.push("No record of this activity has ever been made.");
    } else if (lastCompletedOn) {
      bits.push(`Last recorded ${lastCompletedOn}; due ${st.nextDueOn}.`);
    } else {
      bits.push(`Due ${st.nextDueOn}.`);
    }
    if (where) bits.push(where);
    if (row.owning_program) bits.push(`Governed by ${row.owning_program}.`);

    out.push({
      activityKey: row.activity_key,
      activity: row.activity,
      dueOn: st.nextDueOn,
      severity,
      neverDone,
      title: `${row.activity} is ${severity === "overdue" ? "overdue" : "due"}`,
      message: bits.join(" "),
      responsiblePosition: row.responsible_position,
      dedupeKey: dedupeKeyFor(row.activity_key, st.nextDueOn),
    });
  }
  return out;
}

// ---------------------------------------------------------------- FRM-703 retention links

/**
 * Opens a document rather than a record. Used where an activity is evidenced by the document
 * itself being revised - the annual review of a programme, which is how every programme in this
 * document set evidences its own review - so there is no entry to start.
 */
export function documentLink(
  documentNumber: string,
  documentId: string,
  documentTitle?: string | null,
): NotificationLink {
  const title = (documentTitle ?? "").trim();
  return {
    label: `Open ${documentNumber}${title ? ` · ${title}` : ""}`,
    href: `/team/compliance/sops?doc=${documentId}`,
  };
}

/** Marks a link as arriving from the feed, so the form can offer the way back. */
export const FROM_NOTIFICATIONS = "from=notifications";

/**
 * The link that takes somebody from "this is due" straight into the record that discharges it.
 *
 * It opens the ENTRY, not the library page the form lives on — one click to the work rather than
 * three. The /start route resumes the caller's newest open draft when there is one and only creates
 * when there is not, which is what keeps a link that performs a write safe to click twice.
 */
export function formLink(
  documentNumber: string,
  documentId: string,
  documentTitle?: string | null,
): NotificationLink {
  const title = (documentTitle ?? "").trim();
  return {
    label: `Record on ${documentNumber}${title ? ` · ${title}` : ""}`,
    href: `/team/compliance/forms/${documentId}/start?${FROM_NOTIFICATIONS}`,
  };
}

export type RetentionEntry = {
  id: string;
  status: string;
  reopened_at: string | null;
  data: Record<string, unknown>;
};

export type NotificationLink = { label: string; href: string };

/**
 * The retention-sample review is one scheduled activity, but the owner asked for a link straight to
 * each sample so it can be pulled up and closed out. So the activity raises ONE notification whose
 * body carries N links.
 *
 * "The draft is the shelf" (FRM-703, migration 20260909000010) with one exception that matters here:
 * an admin can reopen a submitted entry to correct it, so a draft that already carries a
 * disposal_date is a sample that is GONE and being tidied, not one sitting on the shelf. Linking to
 * it would send somebody to discard a sample that no longer exists.
 *
 * Dates are compared as ISO strings, never cast. That is lexicographically correct for yyyy-MM-dd,
 * it matches buildReportSql() in src/lib/formReport.ts, and it sidesteps the empty string that every
 * unfilled date key holds.
 */
export function retentionLinks(
  entries: RetentionEntry[],
  documentId: string,
  today: string,
  horizonDays = 0,
  cap = 25,
): NotificationLink[] {
  const horizon = addDays(today, horizonDays);
  const due = entries.filter((e) => {
    if (e.status !== "draft") return false;
    const disposed = String(e.data?.disposal_date ?? "") !== "";
    if (e.reopened_at !== null && disposed) return false;
    const d = String(e.data?.discard_due ?? "");
    return d !== "" && d <= horizon;
  });

  due.sort((a, b) => String(a.data.discard_due).localeCompare(String(b.data.discard_due)));

  const links = due.slice(0, cap).map((e) => {
    const lot = String(e.data?.lot_code ?? "").trim();
    const product = String(e.data?.product_name ?? "").trim() || "Retention sample";
    const dueOn = String(e.data?.discard_due ?? "");
    const label = `${product}${lot ? ` · ${lot}` : ""} — due ${dueOn}`;
    return {
      label,
      href: `/team/compliance/forms/${documentId}/entries/${e.id}?${FROM_NOTIFICATIONS}`,
    };
  });

  if (due.length > cap) {
    links.push({
      label: `…and ${due.length - cap} more`,
      href: `/team/compliance/sops?doc=${documentId}`,
    });  // the overflow is a browse, not a task, so it goes to the form's entries list
  }
  return links;
}
