// Tests for src/lib/temperatureReviewFill.ts - the FRM-401 "fill from the temperature logs"
// derivation and merge, including the service-state rules added when the walk-in freezer was
// switched off (2026-10-12).
//
//   node scripts/test-temperature-review.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "tempreview-"));
const file = join(out, "temperatureReviewFill.mjs");
execFileSync("npx", ["esbuild", "src/lib/temperatureReviewFill.ts", "--bundle", "--format=esm", `--outfile=${file}`],
  { stdio: ["ignore", "ignore", "inherit"], shell: true });
const T = await import("file://" + file.replace(/\\/g, "/"));

let failures = 0, cases = 0;
function check(name, actual, expected) {
  cases++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) return;
  failures++;
  console.error(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`);
}

// The FRM-401 v3 unit_summary grid, as issued (labels + defaultValues).
const SCHEMA = {
  sections: [{
    fields: [{
      id: "unit_summary", type: "grid",
      rows: {
        mode: "fixed", deletable: true, labelHeader: "Unit",
        labels: ["Walk-In Refrigerator", "Walk-In Freezer", "Bakery Floor"],
        defaultValues: [{ state: "In service" }, { state: "In service" }, { state: "Not a storage unit" }],
      },
    }],
  }],
};
const SUMMARY = [
  { name: "Bakery Floor", count: 700, min: 68, max: 78.2, avg: 72.11, humidity: null },
  { name: "Walk-In Freezer", count: 700, min: -4, max: 71.5, avg: 30.2, humidity: null },
  { name: "Walk-In Refrigerator", count: 700, min: 35, max: 40.9, avg: 37.44, humidity: null },
];
const OCT = { start: "2026-10-01", end: "2026-10-12" };
const FRIDGE = { name: "Walk-In Refrigerator", kind: "storage", in_service: true, changed_at: null, reason: null };
const FLOOR = { name: "Bakery Floor", kind: "ambient", in_service: true, changed_at: null, reason: null };
// Switched off at 10:30 local on 2026-10-12; stored in UTC. Local-calendar day is what counts.
const offAt = new Date(2026, 9, 12, 10, 30).toISOString();
const FREEZER_OFF = { name: "Walk-In Freezer", kind: "storage", in_service: false, changed_at: offAt,
  reason: "Switched off - holds no product since the vegan burger line was discontinued" };
const FREEZER_OFF_SEPT = { ...FREEZER_OFF, changed_at: new Date(2026, 8, 20, 9, 0).toISOString() };
const FREEZER_ON = { name: "Walk-In Freezer", kind: "storage", in_service: true, changed_at: null, reason: null };

console.log("unitStateForMonth");
check("in service all month", T.unitStateForMonth(FRIDGE, OCT.start, OCT.end), "In service");
check("ambient is never a storage unit", T.unitStateForMonth(FLOOR, OCT.start, OCT.end), "Not a storage unit");
check("switched off during the month", T.unitStateForMonth(FREEZER_OFF, OCT.start, OCT.end), "Changed during the month");
check("switched off last month: out of service all this month",
  T.unitStateForMonth(FREEZER_OFF_SEPT, OCT.start, OCT.end), "Out of service");
check("switched off last month, reviewing last month: changed",
  T.unitStateForMonth(FREEZER_OFF_SEPT, "2026-09-01", "2026-09-30"), "Changed during the month");
check("the month's last day counts (end inclusive)",
  T.unitStateForMonth({ ...FREEZER_OFF, changed_at: new Date(2026, 9, 12, 23, 59).toISOString() }, OCT.start, OCT.end),
  "Changed during the month");
check("a changed_at with no parseable date is ignored",
  T.unitStateForMonth({ ...FREEZER_OFF, changed_at: "garbage" }, OCT.start, OCT.end), "Out of service");

console.log("serviceChangesInMonth");
check("one row for the freezer, reason carried, nothing attested",
  T.serviceChangesInMonth([FRIDGE, FREEZER_OFF, FLOOR], OCT.start, OCT.end),
  [{ unit: "Walk-In Freezer", change: "Placed out of service", changed_on: "2026-10-12",
     reason: "Switched off - holds no product since the vegan burger line was discontinued" }]);
check("a return to service reads as one",
  T.serviceChangesInMonth([{ ...FREEZER_ON, changed_at: offAt, reason: "Frozen stock ordered" }], OCT.start, OCT.end),
  [{ unit: "Walk-In Freezer", change: "Returned to service", changed_on: "2026-10-12", reason: "Frozen stock ordered" }]);
check("nothing changed this month: no rows", T.serviceChangesInMonth([FRIDGE, FREEZER_OFF_SEPT, FLOOR], OCT.start, OCT.end), []);
check("an ambient sensor never changes service",
  T.serviceChangesInMonth([{ ...FLOOR, in_service: false, changed_at: offAt }], OCT.start, OCT.end), []);
check("a missing reason is an empty string, not undefined",
  T.serviceChangesInMonth([{ ...FREEZER_OFF, reason: null }], OCT.start, OCT.end)[0].reason, "");

console.log("deriveFrm401Prefill - with unit states");
const pre = T.deriveFrm401Prefill(SCHEMA, SUMMARY, [], "October 2026", "2026-10-12",
  { units: [FRIDGE, FREEZER_OFF, FLOOR], ...OCT });
check("fridge row: in service with its figures",
  pre.unit_summary[0], { _label: "Walk-In Refrigerator", state: "In service", min_f: "35.0", max_f: "40.9", avg_f: "37.4" });
check("freezer row: changed during the month, figures kept (the reviewer sees the month it ran)",
  pre.unit_summary[1], { _label: "Walk-In Freezer", state: "Changed during the month", min_f: "-4.0", max_f: "71.5", avg_f: "30.2" });
check("floor row: not a storage unit", pre.unit_summary[2].state, "Not a storage unit");
check("service_changes carried", pre.service_changes.map(r => r.change), ["Placed out of service"]);
check("quiet month still gets the single No alerts row", pre.alert_log, [{ kind: "No alerts raised" }]);

const preNov = T.deriveFrm401Prefill(SCHEMA, SUMMARY, [], "November 2026", "2026-11-30",
  { units: [FRIDGE, FREEZER_OFF, FLOOR], start: "2026-11-01", end: "2026-11-30" });
check("a unit out of service ALL month: state said, temperatures left blank as the form asks",
  preNov.unit_summary[1], { _label: "Walk-In Freezer", state: "Out of service" });
check("no service_changes key when nothing changed", "service_changes" in preNov, false);

console.log("deriveFrm401Prefill - without unit states (the limits could not be read)");
const preNoUnits = T.deriveFrm401Prefill(SCHEMA, SUMMARY, [], "October 2026", "2026-10-12");
check("state left at the grid default", preNoUnits.unit_summary[1].state, "In service");
check("figures still filled", preNoUnits.unit_summary[1].max_f, "71.5");
check("no service_changes", "service_changes" in preNoUnits, false);

console.log("mergeFrm401Prefill - state and service changes into an existing draft");
const blankDraft = {
  review_month: "", review_date: "",
  unit_summary: [
    { _label: "Walk-In Refrigerator", state: "In service" },
    { _label: "Walk-In Freezer", state: "In service" },
    { _label: "Bakery Floor", state: "Not a storage unit" },
  ],
  alert_log: [], service_changes: [],
};
const m1 = T.mergeFrm401Prefill(blankDraft, pre);
check("untouched freezer row takes the derived state (the default is not a person's answer)",
  m1.data.unit_summary[1].state, "Changed during the month");
check("service change appended", m1.data.service_changes.length, 1);
check("reported as changed", m1.changed, true);

const touchedDraft = {
  ...blankDraft,
  unit_summary: [
    { _label: "Walk-In Refrigerator", state: "In service" },
    { _label: "Walk-In Freezer", state: "In service", gaps: "None" },
    { _label: "Bakery Floor", state: "Not a storage unit" },
  ],
  service_changes: [{ unit: "Walk-In Freezer", change: "Placed out of service", changed_on: "2026-10-12", reason: "Owner switched it off" }],
};
const m2 = T.mergeFrm401Prefill(touchedDraft, pre);
check("a row with a figure or judgement keeps the person's state", m2.data.unit_summary[1].state, "In service");
check("a service change already written (same unit, same day) is not duplicated",
  m2.data.service_changes, touchedDraft.service_changes);
check("a blank existing service_changes row is dropped, not kept beside the real one",
  T.mergeFrm401Prefill({ ...blankDraft, service_changes: [{ unit: "", change: "", changed_on: "", reason: "" }] }, pre)
    .data.service_changes.length, 1);

const other = T.mergeFrm401Prefill({ ...blankDraft, review_month: "September 2026" }, pre);
check("a draft for another month is left alone", [other.changed, other.otherMonth], [false, "September 2026"]);

const m3 = T.mergeFrm401Prefill(blankDraft, preNoUnits);
check("without unit states the merge changes no state", m3.data.unit_summary[1].state, "In service");

rmSync(out, { recursive: true, force: true });
console.log(failures ? `\n${failures} of ${cases} FAILED` : `\nall ${cases} passed`);
process.exit(failures ? 1 : 0);
