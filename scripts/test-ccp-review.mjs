// Tests for src/lib/ccpReview.ts - reviewing and submitting the two CCP records at the release.
//
//   node scripts/test-ccp-review.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "ccpreview-"));
const file = join(out, "ccpReview.mjs");
execFileSync("npx", ["esbuild", "src/lib/ccpReview.ts", "--bundle", "--format=esm", `--outfile=${file}`, "--log-level=error"],
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

const TODAY = "2026-10-13";
const load = (product, last = "", extra = {}) => ({ time_out: "09:10", product, lot_code: "6286", oven_temp: "350", bake_time: "27", within_limits: "pass", last_load: last, initials: "DM", ...extra });
const chk = (last = "", extra = {}) => ({ time: "11:00", check: "In process", visual: "pass", last_check: last, initials: "DM", ...extra });
const op = { user_id: "u-op", name: "Diana", signed_at: "2026-10-13T15:00:00Z" };
const baking = (rows, extra = {}) => ({ production_date: TODAY, oven_loads: rows, ...extra });
const sealing = (rows, extra = {}) => ({ production_date: TODAY, product: "Rum Cake - Original", lot_code: "6286", seal_checks: rows, ...extra });

// ---- what is on the record
check("a blank seeded row is not a load", T.recordRows("baking", baking([load("A"), { time_out: "09:00", initials: "DM" }, {}])).length, 1);
check("no record, no rows", [T.recordRows("baking", null).length, T.recordRows("sealing", {}).length], [0, 0]);

// ---- finished at the oven: the whole day's record
check("one product, more loads to come", T.recordFinished("baking", baking([load("A"), load("A")])), false);
check("one product, its last load", T.recordFinished("baking", baking([load("A"), load("A", "Last load of this batch")])), true);
check("two products, one finished: the day is not", T.recordFinished("baking", baking([load("A", "Last load of this batch"), load("B")])), false);
check("two products, both finished", T.recordFinished("baking", baking([load("A", "Last load of this batch"), load("B"), load("B", "Last load of this batch")])), true);
check("last load of the lot finishes the day whatever else is on it", T.recordFinished("baking", baking([load("A"), load("B", "Last load of this lot")])), true);
check("the product's spelling does not make it two products", T.recordFinished("baking", baking([load("Rum Cake - Original"), load("rum cake original", "Last load of this batch")])), true);
check("nothing recorded is not finished", T.recordFinished("baking", baking([])), false);

// ---- finished at the sealer: one batch per record
check("checks with no last mark", T.recordFinished("sealing", sealing([chk(), chk()])), false);
check("the last check of the batch finishes the record", T.recordFinished("sealing", sealing([chk(), chk("Last check of this batch")])), true);
check("so does the last check of the lot", T.recordFinished("sealing", sealing([chk("Last check of this lot")])), true);

// ---- what stops the review
check("signed and finished: nothing", T.reviewBlocks("baking", baking([load("A", "Last load of this lot")], { monitored_by: op }), TODAY), []);
check("the operator has not signed", T.reviewBlocks("baking", baking([load("A", "Last load of this lot")]), TODAY), ["not_signed"]);
check("today's baking still open", T.reviewBlocks("baking", baking([load("A")], { monitored_by: op }), TODAY), ["not_finished"]);
check("a day that has passed is finished whether or not anybody said so", T.reviewBlocks("baking", baking([load("A")], { monitored_by: op, production_date: "2026-10-12" }), TODAY), []);
check("...but still needs the operator's signature", T.reviewBlocks("sealing", sealing([chk()], { production_date: "2026-10-12" }), TODAY), ["not_signed"]);
check("an empty record", T.reviewBlocks("sealing", sealing([]), TODAY), ["no_rows", "not_signed", "not_finished"]);
check("a record with no date is treated as today's", T.reviewBlocks("sealing", sealing([chk()], { monitored_by: op, production_date: "" }), TODAY), ["not_finished"]);

// ---- the reviewer's sign-off
const NOW = "2026-10-13T18:30:00Z";
const reviewer = { id: "u-gab", name: "Gabriela" };
{
  const v = T.withVerification("baking", baking([load("A", "Last load of this lot")], { monitored_by: op }), reviewer, NOW);
  check("the reviewer's signature", v.verified_by, { user_id: "u-gab", name: "Gabriela", signed_at: NOW });
  check("another person than the operator", v.verification_independence, "Someone other than the operator who took the readings");
  check("no load probed", v.internal_temp_status, "Not probed - probe check not yet in place");
  check("the operator's signature is not touched", v.monitored_by, op);
}
check("the operator verifying their own record is said so", T.withVerification("sealing", sealing([chk("Last check of this batch")], { monitored_by: op }), { id: "u-op", name: "Diana" }, NOW).verification_independence,
  "No second qualified person available - verified by the operator");
check("every load probed", T.withVerification("baking", baking([load("A", "", { internal_temp: "182" }), load("A", "Last load of this lot", { internal_temp: "185" })], { monitored_by: op }), reviewer, NOW).internal_temp_status,
  "Probed - a reading is recorded against every load");
check("some probed, some not: left for a person", T.withVerification("baking", baking([load("A", "", { internal_temp: "182" }), load("A", "Last load of this lot")], { monitored_by: op }), reviewer, NOW).internal_temp_status ?? "", "");
{
  const given = baking([load("A", "Last load of this lot")], { monitored_by: op, verification_independence: "No second qualified person available - verified by the operator", internal_temp_status: "Probed - a reading is recorded against every load",
    verified_by: { user_id: "u-x", name: "Earlier", signed_at: "2026-10-13T16:00:00Z" } });
  const v = T.withVerification("baking", given, reviewer, NOW);
  check("an answer or a signature already there is never replaced", [v.verification_independence, v.internal_temp_status, v.verified_by.name],
    ["No second qualified person available - verified by the operator", "Probed - a reading is recorded against every load", "Earlier"]);
  check("the record handed in is not changed", given.verified_by.name, "Earlier");
}
check("the seal check record has no probe answer", "internal_temp_status" in T.withVerification("sealing", sealing([chk("Last check of this batch")], { monitored_by: op }), reviewer, NOW), false);

// ---- the form revision it needs
const schema = options => ({ sections: [{ fields: [{ id: "production_date" }, { id: "oven_loads" }, { id: "seal_checks" }, { id: "monitored_by" }, { id: "verified_by" }, { id: "verification_independence", options }] }] });
const OPTIONS = ["Someone other than the operator who took the readings", "No second qualified person available - verified by the operator"];
check("ready on the forms as issued", [T.ccpReviewReady("baking", schema(OPTIONS)), T.ccpReviewReady("sealing", schema(OPTIONS))], [true, true]);
check("not with an option reworded, a field missing or no form", [T.ccpReviewReady("baking", schema(["Someone else", OPTIONS[1]])),
  T.ccpReviewReady("baking", { sections: [{ fields: [{ id: "oven_loads" }] }] }), T.ccpReviewReady("sealing", null)], [false, false, false]);

rmSync(out, { recursive: true, force: true });
console.log(failures ? `${failures} of ${cases} cases failed` : `all ${cases} cases passed`);
process.exit(failures ? 1 : 0);
