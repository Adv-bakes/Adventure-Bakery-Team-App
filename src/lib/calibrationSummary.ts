// The last calibration check of the walk-in refrigerator and freezer sensors, read from the
// FRM-705 entries. Shown as one line per unit on an FRM-401 review (owner's request, 2026-10-08):
// the review confirms the month's calibration, and the figures it confirms are on another form.
//
// Pure: no imports, so it can be tested in Node. The loader is fetchCalibrationEntries in
// formResponses.ts.

export const CALIBRATION_FORM = "FRM-705";

/** One FRM-705 entry, as much of it as the summary reads. */
export interface CalibrationEntry {
  id: string;
  status: string;
  created_at: string;
  check_month?: string | null;
  check_date?: string | null;
  devices?: Record<string, any>[] | null;
}

export interface SensorCheck {
  unit: string;
  /** "Pass", or the Fail option as written on the record. */
  outcome: string;
  passed: boolean;
  /** yyyy-MM-dd: the date checked, else the day the entry was started. */
  date: string;
  month: string;
  probe: string;
  sensor: string;
  responseId: string;
  draft: boolean;
}

/** The units the summary looks for, by what their FRM-705 row is called. */
export const SENSOR_UNITS: { unit: string; row: RegExp }[] = [
  { unit: "Walk-in refrigerator", row: /refrigerator.*sensor/i },
  { unit: "Walk-in freezer", row: /freezer.*sensor/i },
];

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const dateOf = (e: CalibrationEntry) => text(e.check_date) || text(e.created_at).slice(0, 10);

/**
 * For each unit, the newest FRM-705 entry on which its sensor was actually checked - a row whose
 * outcome is Pass or Fail. A row marked "Not checked this month" or "Recorded on FRM-401" is not a
 * check and is passed over for an older entry. A unit never checked is left out of the result.
 * Drafts count and are flagged, because a check done this morning and not yet submitted is still
 * the last one.
 */
export function lastSensorChecks(entries: CalibrationEntry[]): SensorCheck[] {
  const newestFirst = [...entries].sort((a, b) =>
    dateOf(b).localeCompare(dateOf(a)) || text(b.created_at).localeCompare(text(a.created_at)));
  const out: SensorCheck[] = [];
  for (const { unit, row } of SENSOR_UNITS) {
    for (const e of newestFirst) {
      const r = (e.devices ?? []).find(d => row.test(text(d?._label)));
      const outcome = text(r?.outcome);
      if (!r || !/^(pass|fail)/i.test(outcome)) continue;
      out.push({
        unit,
        outcome,
        passed: /^pass/i.test(outcome),
        date: dateOf(e),
        month: text(e.check_month),
        probe: text(r.reference_reading),
        sensor: text(r.device_reading),
        responseId: e.id,
        draft: e.status !== "submitted",
      });
      break;
    }
  }
  return out;
}
