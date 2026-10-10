// Tests for src/lib/packCounts.ts - the three packing counts of FRM-520 added up by the app:
// counted on the rack = units packed + not packed (FSQM-021).
//
//   node scripts/test-pack-counts.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "packcounts-"));
const file = join(out, "packCounts.mjs");
execFileSync("npx", ["esbuild", "src/lib/packCounts.ts", "--bundle", "--format=esm", `--outfile=${file}`],
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

const run = (racked_count, units_packed, not_packed, packing_notes = "") => T.packCounts({ racked_count, units_packed, not_packed, packing_notes });
const brief = r => [r.state, r.diff ?? null, r.needsNote];

check("a plain count, as a number or as text", [T.readCount(480), T.readCount("480"), T.readCount(" 480 units "), T.readCount("1,200"), T.readCount("12 cakes"), T.readCount(0)], [480, 480, 480, 1200, 12, 0]);
check("anything else is not read", [T.readCount("40 cases"), T.readCount("about 480"), T.readCount("480 + 12"), T.readCount("4.5"), T.readCount(""), T.readCount("-3")], [null, null, null, null, null, null]);

check("adds up", brief(run(486, "480", 6)), ["adds_up", 0, false]);
check("adds up with nothing rejected", brief(run(480, "480 units", 0)), ["adds_up", 0, false]);
check("the sentence shows the sum", run(486, "480", 6).text, "Adds up: 480 packed + 6 not packed = 486, and 486 were counted on the rack.");

check("three unaccounted for", brief(run(489, "480", 6)), ["short", 3, true]);
check("...explained in Notes", brief(run(489, "480", 6, "Three eaten at the tasting.")), ["short", 3, false]);
check("the sentence says how many and what to do", run(489, "480", 6).text, "3 unaccounted for: 480 packed + 6 not packed = 486, but 489 were counted on the rack. Recount, or say why in Notes before submitting.");
check("more packed than were racked", brief(run(480, "484", 0)), ["over", -4, true]);
check("a note of spaces is not a reason", run(489, "480", 6, "   ").needsNote, true);

check("a count still missing asks for nothing", [brief(run("", "480", 6)), brief(run(486, "", 6)), brief(run(486, "480", ""))], [["incomplete", null, false], ["incomplete", null, false], ["incomplete", null, false]]);
check("zero not packed is an answer, not a blank", brief(run(480, "480", 0)), ["adds_up", 0, false]);
check("cases cannot be added to cakes, and nothing is guessed", brief(run(480, "40 cases", 0)), ["unreadable", null, false]);
check("...and it says which count", run(480, "40 cases", 0).text.includes('"40 cases"'), true);

const schema = { sections: [{ id: "packing", fields: ["pack_date", "racked_count", "units_packed", "not_packed", "film_lot", "code_check", "code_checked_by", "packing_notes"].map(id => ({ id })) }] };
check("ready on the form as issued", T.packCountsReady(schema), true);
check("not on a revision without the rack count", [T.packCountsReady({ sections: [{ id: "packing", fields: [{ id: "units_packed" }] }] }), T.packCountsReady(null)], [false, false]);

rmSync(out, { recursive: true, force: true });
console.log(failures ? `${failures} of ${cases} cases failed` : `all ${cases} cases passed`);
process.exit(failures ? 1 : 0);
