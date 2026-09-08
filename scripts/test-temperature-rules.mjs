// Tests for the D-34 alert decision logic in supabase/functions/_shared/temperatureRules.ts.
//
// WHY THIS EXISTS. There is no Deno toolchain on the dev machine, so the edge function
// cannot be typechecked or run locally, and the plan's end-to-end proof (drop the limit to
// 30 °F and wait for an email) can only be done against production. That is the right final
// check but a slow first one, and the rules it exercises are exactly the kind that fail
// quietly: an off-by-one on "at the limit passes", or a stale sensor's three-day-old reading
// being judged as if it were current.
//
//   node scripts/test-temperature-rules.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The module is TypeScript with a .ts import specifier (Deno style), so it is bundled to
// plain JS first rather than being imported directly.
const out = mkdtempSync(join(tmpdir(), "temprules-"));
const bundle = join(out, "rules.mjs");
// shell:true because on Windows the bin is a .cmd shim, which spawnSync refuses to exec
// directly (EINVAL) as of Node 20.
execFileSync(
  "npx", ["esbuild", "supabase/functions/_shared/temperatureRules.ts",
          "--bundle", "--format=esm", `--outfile=${bundle}`],
  { stdio: ["ignore", "ignore", "inherit"], shell: true },
);
const { assess, degF, outOfRange } = await import("file://" + bundle.replace(/\\/g, "/"));

const NOW = Date.parse("2026-09-08T12:00:00Z");
const hoursAgo = h => new Date(NOW - h * 3_600_000).toISOString();

const FRIDGE = {
  equipment_name: "Walk-In Refrigerator",
  kind: "storage", in_service: true,
  min_f: null, max_f: 41, stale_hours: 6,
};
const FREEZER = { ...FRIDGE, equipment_name: "Walk-In Freezer", max_f: 10 };

const reading = (h, f, extra = {}) => ({
  created_at: hoursAgo(h),
  temperature_fahrenheit: f,
  battery_level: 4,
  low_battery_alarm: false,
  ...extra,
});

let failed = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok    ${name}`); return; }
  failed++;
  console.log(`  FAIL  ${name}\n          expected ${e}\n          actual   ${a}`);
}
const kinds = fs => fs.map(f => f.kind).sort();

console.log("degF");
check("uses the Fahrenheit column when present",
  degF({ temperature_fahrenheit: 38.5, temperature_celsius: 0 }), 38.5);
check("falls back to converting celsius",
  degF({ temperature_fahrenheit: null, temperature_celsius: 100 }), 212);
check("null when neither is present",
  degF({ temperature_fahrenheit: null, temperature_celsius: null }), null);

console.log("outOfRange — at the limit passes, beyond it fails");
check("exactly at max passes", outOfRange(41, FRIDGE), false);
check("a tenth over max fails", outOfRange(41.1, FRIDGE), true);
check("well under max passes", outOfRange(35, FRIDGE), false);
check("under a min fails", outOfRange(-20, { ...FREEZER, min_f: -10 }), true);

console.log("assess — normal operation");
check("in range, fresh, good battery: nothing",
  kinds(assess(FRIDGE, [reading(0.5, 38), reading(1.5, 39)], NOW)), []);
check("exactly at the limit twice: nothing",
  kinds(assess(FRIDGE, [reading(0.5, 41), reading(1.5, 41)], NOW)), []);

console.log("assess — out of range needs TWO consecutive readings");
check("one bad reading after a good one: no alert (door held open)",
  kinds(assess(FRIDGE, [reading(0.5, 46), reading(1.5, 38)], NOW)), []);
check("two consecutive bad readings: alert",
  kinds(assess(FRIDGE, [reading(0.5, 46), reading(1.5, 44)], NOW)), ["out_of_range"]);
check("worst value is the reading furthest outside the limit",
  assess(FRIDGE, [reading(0.5, 44), reading(1.5, 46)], NOW)[0].worstValue, 46);
check("a single reading in the tail cannot raise out_of_range",
  kinds(assess(FRIDGE, [reading(0.5, 55)], NOW)), []);

console.log("assess — no data, the failure that went unnoticed three times");
check("nothing logged at all",
  kinds(assess(FRIDGE, [], NOW)), ["no_data"]);
check("last reading older than stale_hours",
  kinds(assess(FRIDGE, [reading(9, 38), reading(10, 38)], NOW)), ["no_data"]);
check("just inside stale_hours is fine",
  kinds(assess(FRIDGE, [reading(5.9, 38), reading(6.9, 38)], NOW)), []);
check("stale hours are reported to two decimals",
  assess(FRIDGE, [reading(74, 38)], NOW)[0].worstValue, 74);
check("a STALE sensor is not also judged out of range — its reading is three days old",
  kinds(assess(FRIDGE, [reading(74, 60), reading(75, 60)], NOW)), ["no_data"]);
check("a stale sensor does not raise low_battery either",
  kinds(assess(FRIDGE, [reading(74, 38, { battery_level: 1 })], NOW)), ["no_data"]);

console.log("assess — battery");
check("low_battery_alarm true",
  kinds(assess(FRIDGE, [reading(0.5, 38, { low_battery_alarm: true }), reading(1.5, 38)], NOW)),
  ["low_battery"]);
check("battery level 1 of 4",
  kinds(assess(FRIDGE, [reading(0.5, 38, { battery_level: 1 }), reading(1.5, 38)], NOW)),
  ["low_battery"]);
check("battery level 2 is not low",
  kinds(assess(FRIDGE, [reading(0.5, 38, { battery_level: 2 }), reading(1.5, 38)], NOW)), []);
check("warm AND flat battery raises both",
  kinds(assess(FRIDGE, [reading(0.5, 50, { battery_level: 1 }), reading(1.5, 50)], NOW)),
  ["low_battery", "out_of_range"]);

console.log("assess — freezer, whose limit is different and whose readings run negative");
check("-6 °F against a 10 °F max passes",
  kinds(assess(FREEZER, [reading(0.5, -6), reading(1.5, -3)], NOW)), []);
check("+12.9 °F twice against a 10 °F max fails",
  kinds(assess(FREEZER, [reading(0.5, 12.9), reading(1.5, 11)], NOW)), ["out_of_range"]);

rmSync(out, { recursive: true, force: true });
console.log(failed ? `\n${failed} test(s) FAILED` : "\nall tests passed");
process.exit(failed ? 1 : 0);
