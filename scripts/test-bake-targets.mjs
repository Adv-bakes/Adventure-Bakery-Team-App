// Tests for src/lib/bakeTargets.ts - the oven temperature and bake time a product's formula sheet
// states (FRM-501, Process Parameters), offered as suggestions where a bake reading is typed.
//
//   node scripts/test-bake-targets.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "baketargets-"));
const file = join(out, "bakeTargets.mjs");
execFileSync("npx", ["esbuild", "src/lib/bakeTargets.ts", "--bundle", "--format=esm", `--outfile=${file}`],
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

// FRM-501's Process Parameters rows, as the form prints them.
const LABELS = ["Mixing time", "Mixing speed", "Batter / Dough temperature", "Process / Bake temperature", "Process / Bake time",
  "Cooling / Set parameters", "Final moisture / Water activity (Aw)", "pH", "Net / Piece weight", "Yield (actual vs theoretical)"];
const sheet = (product, temp, time, extra = {}) => {
  const rows = LABELS.map(() => ({ notes: "", target_spec: "", benchtop_actual: "", production_actual: "" }));
  rows[2].target_spec = "68"; rows[3].target_spec = temp; rows[4].target_spec = time; rows[0].target_spec = "4";
  return { product_name: product, process_parameters_grid: rows, ...extra };
};

// ---- one written target
check("a bare number", [T.readTarget("350", "temp"), T.readTarget("27", "minutes")], [350, 27]);
check("with its unit", [T.readTarget("350°F", "temp"), T.readTarget(" 350 F ", "temp"), T.readTarget("350 degrees F", "temp"), T.readTarget("27 min", "minutes"), T.readTarget("27 minutes", "minutes"), T.readTarget("27.5 min.", "minutes")], [350, 350, 350, 27, 27, 27.5]);
check("a range, a guess or two figures is not read", [T.readTarget("350-360", "temp"), T.readTarget("about 350", "temp"), T.readTarget("350 / 325", "temp"), T.readTarget("25 to 30", "minutes"), T.readTarget("27 min at 350", "minutes")].map(v => v ?? null), [null, null, null, null, null]);
check("blank or missing", [T.readTarget("", "temp"), T.readTarget(null, "minutes"), T.readTarget(undefined, "temp")].map(v => v ?? null), [null, null, null]);
check("outside a sensible range", [T.readTarget("35", "temp"), T.readTarget("999", "temp"), T.readTarget("0", "minutes"), T.readTarget("900", "minutes")].map(v => v ?? null), [null, null, null, null]);
check("a time unit on a temperature, and the reverse, is not read", [T.readTarget("350 min", "temp"), T.readTarget("27 F", "minutes")].map(v => v ?? null), [null, null]);

// ---- from the sheets
const PS = sheet("Rum Cake - Pumpkin Spice", "350", "27");
check("the product's sheet", T.bakeTargets(LABELS, [PS], "Rum Cake - Pumpkin Spice"), { temp: 350, minutes: 27 });
check("the name is compared loosely", T.bakeTargets(LABELS, [PS], "rum cake – pumpkin spice"), { temp: 350, minutes: 27 });
check("the dough temperature row is not the bake temperature", T.bakeTargets(LABELS, [sheet("X", "", "")], "X"), {});
check("another product's sheet is not used", T.bakeTargets(LABELS, [PS], "Rum Cake - Original"), {});
check("a sheet with nothing written suggests nothing", T.bakeTargets(LABELS, [sheet("Rum Cake - Original", "", "")], "Rum Cake - Original"), {});
check("one figure written, one not", T.bakeTargets(LABELS, [sheet("X", "350°F", "25-30 min")], "X"), { temp: 350 });
check("the newest sheet wins, and an older one fills what it leaves blank",
  T.bakeTargets(LABELS, [sheet("X", "360", ""), sheet("X", "350", "27")], "X"), { temp: 360, minutes: 27 });
check("rows are found by their label, wherever they sit",
  T.bakeTargets(["Process / Bake time", "Process / Bake temperature"], [{ product_name: "X", process_parameters_grid: [{ target_spec: "27" }, { target_spec: "350" }] }], "X"), { temp: 350, minutes: 27 });
check("a form without those rows, or an entry without the table", [T.bakeTargets(["Mixing time"], [PS], "Rum Cake - Pumpkin Spice"), T.bakeTargets(LABELS, [{ product_name: "X" }], "X"), T.bakeTargets(null, [], "X")], [{}, {}, {}]);
check("the map names the form it reads", T.BAKE_TARGET_SOURCE, { form: "FRM-501", productField: "product_name", grid: "process_parameters_grid", column: "target_spec" });

rmSync(out, { recursive: true, force: true });
if (failures) {
  console.error(`\n${failures} of ${cases} cases failed`);
  process.exit(1);
}
console.log(`bake targets: ${cases} checks passed`);
