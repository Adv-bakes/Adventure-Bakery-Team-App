// Tests for lastSensorChecks (src/lib/calibrationSummary.ts) - the one-line "last calibration
// check" of the refrigerator and freezer sensors shown on an FRM-401 review.
//
//   node scripts/test-calibration-summary.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "calsum-"));
const file = join(out, "calibrationSummary.mjs");
execFileSync("npx", ["esbuild", "src/lib/calibrationSummary.ts", "--bundle", "--format=esm", `--outfile=${file}`],
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

const row = (label, outcome, probe = "", sensor = "") =>
  ({ _label: label, outcome, reference_reading: probe, device_reading: sensor });
const FRIDGE = "Walk-in refrigerator sensor (YoLink)";
const FREEZER = "Walk-in freezer sensor (YoLink)";

// The first real entry, as submitted on 2026-10-08 under revision New.
const october = {
  id: "oct", status: "submitted", created_at: "2026-10-08T14:00:00Z", check_month: "October 2026", check_date: "2026-10-08",
  devices: [
    row("Probe thermometer (site reference)", "Not checked this month - reason recorded"),
    row(FRIDGE, "Pass", "36 F", "36.0 F"),
    row(FREEZER, "Pass", "-5 F", "-4.9 F"),
    row("Revent 724 oven - temperature display", "Pass", "352", "350"),
  ],
};

{
  const r = T.lastSensorChecks([october]);
  check("both units found", r.map(c => c.unit), ["Walk-in refrigerator", "Walk-in freezer"]);
  check("fridge line", r[0], {
    unit: "Walk-in refrigerator", outcome: "Pass", passed: true, date: "2026-10-08", month: "October 2026",
    probe: "36 F", sensor: "36.0 F", responseId: "oct", draft: false,
  });
  check("freezer readings", [r[1].probe, r[1].sensor], ["-5 F", "-4.9 F"]);
}

// A later entry where the freezer was not checked: the freezer's last check is still October.
{
  const november = {
    id: "nov", status: "draft", created_at: "2026-11-05T14:00:00Z", check_month: "November 2026", check_date: "2026-11-05",
    devices: [row(FRIDGE, "Fail - action recorded", "38", "41.5"), row(FREEZER, "Not checked this month - reason recorded")],
  };
  const r = T.lastSensorChecks([october, november]);
  check("newest entry wins for the fridge", [r[0].responseId, r[0].passed, r[0].outcome, r[0].draft], ["nov", false, "Fail - action recorded", true]);
  check("a row not checked is passed over", [r[1].responseId, r[1].date], ["oct", "2026-10-08"]);
  check("order of the entries does not matter", T.lastSensorChecks([november, october]).map(c => c.responseId), ["nov", "oct"]);
}

// Rows that are not a check.
{
  const pointer = { id: "p", status: "submitted", created_at: "2026-09-21T10:00:00Z", devices: [row(FRIDGE, "Recorded on FRM-401"), row(FREEZER, "")] };
  check("'Recorded on FRM-401' and a blank outcome are not checks", T.lastSensorChecks([pointer]), []);
  check("no entries", T.lastSensorChecks([]), []);
  check("an entry with no devices", T.lastSensorChecks([{ id: "x", status: "draft", created_at: "2026-10-01T00:00:00Z", devices: null }]), []);
}

// No check date: the day the entry was started stands in. A unit removed from the directory is simply absent.
{
  const undated = { id: "u", status: "submitted", created_at: "2026-12-02T09:30:00Z", check_month: "", check_date: "", devices: [row(FRIDGE, "Pass", "37", "37")] };
  const r = T.lastSensorChecks([undated]);
  check("falls back to the day the entry was started", [r.length, r[0].date, r[0].month], [1, "2026-12-02", ""]);
}

// The probe rows never match a unit.
check("probe rows are not sensors", T.lastSensorChecks([{ id: "pr", status: "submitted", created_at: "2026-10-08T00:00:00Z",
  devices: [row("Probe thermometer - ice point (site reference)", "Pass", "32", "32")] }]), []);

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} of ${cases} checks failed`); process.exit(1); }
console.log(`calibration summary: ${cases} checks passed`);
