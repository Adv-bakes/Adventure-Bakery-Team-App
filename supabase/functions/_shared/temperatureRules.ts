// The decision half of the D-34 temperature alerting: given one unit's limits and the tail
// of its readings, which alerts are live right now?
//
// Split out of temperature-alert/index.ts because it is the part that can be wrong in a way
// nobody notices. There is no Deno toolchain on the dev machine, so the edge function itself
// cannot be typechecked or run locally; keeping these functions free of Deno APIs, network
// calls and Supabase means they can be, and scripts/test-temperature-rules.mjs does.
//
// Nothing here does I/O. Everything that talks to the database or Resend stays in index.ts.

export type Limit = {
  id?: string;
  equipment_name: string;
  kind: string;
  in_service: boolean;
  min_f: number | null;
  max_f: number | null;
  stale_hours: number;
  notify_emails?: string[] | null;
};

export type Reading = {
  created_at: string;
  temperature_fahrenheit: number | null;
  temperature_celsius?: number | null;
  battery_level: number | null;
  low_battery_alarm: boolean | null;
};

export type AlertKind = "out_of_range" | "no_data" | "low_battery";

export type Finding = {
  kind: AlertKind;
  summary: string;      // one line; becomes the alert title and the email subject
  detail: string;       // the sentence a responder reads
  worstValue: number | null;
  triggerAt: string | null;
};

/**
 * The VPS logger writes temperature_celsius; the Fahrenheit column is filled in the
 * database. Falling back to the conversion means a row that arrived before that column was
 * populated is still judged rather than silently skipped — and silently skipping is the
 * exact failure mode this feature exists to prevent.
 */
export function degF(r: Reading): number | null {
  if (r.temperature_fahrenheit !== null && r.temperature_fahrenheit !== undefined) {
    return Number(r.temperature_fahrenheit);
  }
  if (r.temperature_celsius !== null && r.temperature_celsius !== undefined) {
    return Number(r.temperature_celsius) * 9 / 5 + 32;
  }
  return null;
}

/**
 * At the limit passes; beyond it fails. SOP-401 Part 2 states it that way, and stating it
 * in one place while implementing the other is how a 41 °F limit quietly becomes 40.9.
 */
export function outOfRange(f: number, lim: Limit): boolean {
  if (lim.max_f !== null && f > Number(lim.max_f)) return true;
  if (lim.min_f !== null && f < Number(lim.min_f)) return true;
  return false;
}

export function limitText(lim: Limit): string {
  const parts: string[] = [];
  if (lim.min_f !== null) parts.push(`at or above ${lim.min_f} °F`);
  if (lim.max_f !== null) parts.push(`at or below ${lim.max_f} °F`);
  return parts.join(" and ") || "no limit set";
}

/**
 * Which alerts are live for one unit.
 *
 * @param tail readings for this unit, NEWEST FIRST.
 * @param now  epoch ms; a parameter rather than Date.now() so the tests are not clock-bound.
 */
export function assess(lim: Limit, tail: Reading[], now: number): Finding[] {
  const found: Finding[] = [];

  if (tail.length === 0) {
    found.push({
      kind: "no_data",
      summary: `${lim.equipment_name}: no readings at all`,
      detail:
        `No temperature reading has ever been logged for ${lim.equipment_name}. ` +
        `Check that the sensor is paired and that the logger is running.`,
      worstValue: null,
      triggerAt: null,
    });
    return found;   // nothing else can be judged without a reading
  }

  const latest = tail[0];
  const staleHours = (now - new Date(latest.created_at).getTime()) / 3_600_000;

  if (staleHours > lim.stale_hours) {
    found.push({
      kind: "no_data",
      summary: `${lim.equipment_name}: no readings for ${staleHours.toFixed(1)} hours`,
      detail:
        `The last reading from ${lim.equipment_name} was ${staleHours.toFixed(1)} hours ago ` +
        `(limit ${lim.stale_hours}h). The unit is unmonitored until logging resumes: take ` +
        `manual probe readings and record them, then restore the sensor.`,
      worstValue: Number(staleHours.toFixed(2)),
      triggerAt: latest.created_at,
    });
    // A stale sensor's last reading says nothing about the unit NOW, so it is not also
    // judged against the limit — that would raise a second, misleading alert about a
    // temperature from three days ago, and send whoever responds to the wrong problem.
    return found;
  }

  // Two consecutive readings, not one: a walk-in door held open while somebody carries
  // butter out will spike a single reading, and an alert that fires on that gets muted by
  // the third week.
  const recent = (tail.slice(0, 2)
    .map(r => ({ at: r.created_at, f: degF(r) }))
    .filter(x => x.f !== null)) as { at: string; f: number }[];

  if (recent.length >= 2 && recent.every(x => outOfRange(x.f, lim))) {
    // "Worst" = furthest outside the limit it broke, which is not the same as the highest
    // reading once a unit has a min as well as a max.
    const excess = (f: number) => Math.max(
      lim.max_f !== null ? f - Number(lim.max_f) : -Infinity,
      lim.min_f !== null ? Number(lim.min_f) - f : -Infinity,
    );
    const worst = recent.reduce((w, x) => (excess(x.f) > excess(w.f) ? x : w));
    found.push({
      kind: "out_of_range",
      summary: `${lim.equipment_name}: ${worst.f.toFixed(1)} °F, outside limits`,
      detail:
        `${lim.equipment_name} read ${recent.map(x => `${x.f.toFixed(1)} °F`).join(" then ")} ` +
        `on consecutive readings. The unit must be ${limitText(lim)}. Check the unit and the ` +
        `door, take a probe reading, correct the cause, then acknowledge this alert with what ` +
        `you did. Product in doubt goes on Hold under FSQM-018.`,
      worstValue: Number(worst.f.toFixed(2)),
      triggerAt: worst.at,
    });
  }

  if (latest.low_battery_alarm === true ||
      (latest.battery_level !== null && Number(latest.battery_level) <= 1)) {
    found.push({
      kind: "low_battery",
      summary: `${lim.equipment_name}: sensor battery low`,
      detail:
        `The ${lim.equipment_name} sensor is reporting a low battery ` +
        `(level ${latest.battery_level ?? "?"} of 4). Replace it before it stops reporting.`,
      worstValue: latest.battery_level === null ? null : Number(latest.battery_level),
      triggerAt: latest.created_at,
    });
  }

  return found;
}
