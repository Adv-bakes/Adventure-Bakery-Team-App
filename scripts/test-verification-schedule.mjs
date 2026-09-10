// Tests for the D-18 verification due-date logic in
// supabase/functions/_shared/verificationSchedule.ts, and for its twin src/lib/verificationSchedule.ts.
//
// WHY THIS EXISTS. Same reason as scripts/test-temperature-rules.mjs: there is no Deno toolchain on
// the dev machine, so the edge function cannot be typechecked or run locally, and the end-to-end
// proof needs a deploy plus a cron run. The rules it exercises fail quietly rather than loudly - an
// annual review that lands three days later every year, a planned activity raising an alert for a
// program that does not exist, a retention link pointing at a sample that was already discarded.
//
// AND it asserts the two copies of the module AGREE. They are deliberately duplicated (a client
// bundle must not pull in server code), which is fine for a label and dangerous for date maths: the
// schedule page would show one next-due date while the job raised notifications on another.
//
//   node scripts/test-verification-schedule.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deepStrictEqual } from "node:assert";

const out = mkdtempSync(join(tmpdir(), "verifrules-"));

// Deno-style .ts import specifiers, so bundle to plain JS rather than importing directly.
// shell:true because on Windows the bin is a .cmd shim, which spawnSync refuses to exec
// directly (EINVAL) as of Node 20.
function bundle(src, name) {
  const file = join(out, name);
  execFileSync(
    "npx", ["esbuild", src, "--bundle", "--format=esm", `--outfile=${file}`],
    { stdio: ["ignore", "ignore", "inherit"], shell: true },
  );
  return import("file://" + file.replace(/\\/g, "/"));
}

const S = await bundle("supabase/functions/_shared/verificationSchedule.ts", "shared.mjs");
const C = await bundle("src/lib/verificationSchedule.ts", "client.mjs");

const {
  addDays, addMonths, addFrequency, frequencyLabel,
  nextDue, dedupeKeyFor, rowState, assessDue, retentionLinks, formLink,
} = S;

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) return;
  failures++;
  console.error(`FAIL  ${name}\n        expected ${e}\n        actual   ${a}`);
}
function ok(name, cond) {
  if (cond) return;
  failures++;
  console.error(`FAIL  ${name}`);
}

const TODAY = "2026-09-10";

const ROW = {
  activity_key: "gmp_inspection",
  activity: "Site GMP / food safety inspection",
  frequency_unit: "month", frequency_count: 1,
  responsible_position: "SQF Practitioner",
  evidence_kind: "form_entry", evidence_document_number: "FRM-913",
  owning_program: "FSQM-022",
  lead_days: 0, grace_days: 0, first_due_on: null, status: "active",
};
const row = (over) => ({ ...ROW, ...over });

// ---------------------------------------------------------------- date arithmetic
check("addDays across a month end", addDays("2026-01-31", 1), "2026-02-01");
check("addDays backwards", addDays("2026-03-01", -1), "2026-02-28");
check("addDays across a leap day", addDays("2028-02-28", 1), "2028-02-29");

// Clamping, not rolling over. 31 Jan + 1 month must be 28 Feb, never 3 March.
check("month-end clamps to February", addMonths("2026-01-31", 1), "2026-02-28");
check("month-end clamps in a leap year", addMonths("2028-01-31", 1), "2028-02-29");
check("month-end clamps to 30 days", addMonths("2026-03-31", 1), "2026-04-30");
check("clamping does not stick", addMonths("2026-01-31", 2), "2026-03-31");
check("year across a leap day", addMonths("2028-02-29", 12), "2029-02-28");
check("month rolls the year", addMonths("2026-11-15", 3), "2027-02-15");

check("weekly", addFrequency("2026-09-10", "week", 1), "2026-09-17");
check("fortnightly", addFrequency("2026-09-10", "week", 2), "2026-09-24");
check("quarterly", addFrequency("2026-09-10", "quarter", 1), "2026-12-10");
check("annually", addFrequency("2026-09-10", "year", 1), "2027-09-10");

// An annual activity must land on its anniversary. 365-day arithmetic drifts a day per leap year,
// which is exactly how "reviewed annually" quietly stops being annual.
let d = "2026-02-15";
for (let i = 0; i < 8; i++) d = addFrequency(d, "year", 1);
check("annual holds its anniversary over 8 years", d, "2034-02-15");

check("frequencyLabel singular", frequencyLabel("year", 1), "Annually");
check("frequencyLabel plural", frequencyLabel("week", 2), "Every 2 weeks");

// ---------------------------------------------------------------- due state
check("not yet due is quiet",
  rowState(row({}), "2026-09-01", TODAY).state, "ok");
check("due on the day",
  rowState(row({}), "2026-08-10", TODAY).state, "due");
check("a day past with no grace is overdue",
  rowState(row({}), "2026-08-09", TODAY).state, "overdue");
check("grace holds the boundary",
  rowState(row({ grace_days: 3 }), "2026-08-08", TODAY).state, "due");
check("grace runs out",
  rowState(row({ grace_days: 3 }), "2026-08-06", TODAY).state, "overdue");
check("lead days raise it early",
  rowState(row({ lead_days: 5 }), "2026-08-14", TODAY).state, "due");
check("lead days do not raise it too early",
  rowState(row({ lead_days: 5 }), "2026-08-16", TODAY).state, "ok");
check("never done and never anchored",
  rowState(row({}), null, TODAY).state, "never");
check("first_due_on is the due date, not the base",
  nextDue(row({ first_due_on: "2026-12-01" }), null), "2026-12-01");
check("planned rows have no due date",
  rowState(row({ status: "planned" }), null, TODAY),
  { lastCompletedOn: null, nextDueOn: null, state: "planned" });

// ---------------------------------------------------------------- assessDue
const SCHEDULE = [
  row({}),                                                        // due
  row({ activity_key: "temp_review", activity: "Temperature review" }),
  row({ activity_key: "ccp_review", activity: "CCP record review",
        status: "planned", evidence_kind: "none",
        pending_deliverable: "HACCP plan" }),
  row({ activity_key: "old_thing", activity: "Retired thing", status: "retired" }),
];
const COMPLETIONS = [
  { activity_key: "gmp_inspection", completed_on: "2026-08-01" },  // overdue
  { activity_key: "temp_review", completed_on: "2026-09-05" },     // not due
];

const found = assessDue(SCHEDULE, COMPLETIONS, TODAY);
check("only the overdue active row fires", found.map((f) => f.activityKey), ["gmp_inspection"]);
check("severity", found[0].severity, "overdue");
check("dedupe key carries the due date", found[0].dedupeKey,
  "verification:gmp_inspection:2026-09-01");
ok("message names the record", found[0].message.includes("FRM-913"));
ok("message names the governing program", found[0].message.includes("FSQM-022"));

// The most important assertion in the file. Five seeded rows are `planned` because their programs
// have not been issued; raising "CCP record review is overdue" at a site with no HACCP plan would be
// the machinery contradicting the document set.
ok("a planned row never fires, even when long past due",
  assessDue([row({ activity_key: "ccp", status: "planned", first_due_on: "2020-01-01" })],
            [], TODAY).length === 0);
ok("a retired row never fires",
  assessDue([row({ activity_key: "x", status: "retired", first_due_on: "2020-01-01" })],
            [], TODAY).length === 0);

// A never-anchored activity gets ONE key, not one per day - otherwise it re-raises every morning.
const neverA = assessDue([row({ activity_key: "n" })], [], "2026-09-10")[0];
const neverB = assessDue([row({ activity_key: "n" })], [], "2026-09-11")[0];
check("never-done key is stable across days", neverA.dedupeKey, neverB.dedupeKey);
check("never-done key", neverA.dedupeKey, "verification:n:never");
ok("never-done says so", neverA.neverDone === true &&
   neverA.message.includes("No record of this activity has ever been made"));

// Two runs on the same day must produce identical keys, or the afternoon run duplicates the morning.
check("twice-daily is idempotent",
  assessDue(SCHEDULE, COMPLETIONS, TODAY).map((f) => f.dedupeKey),
  found.map((f) => f.dedupeKey));

// ---------------------------------------------------------------- retention links
const DOC = "doc-703";
const entries = [
  { id: "a", status: "draft", reopened_at: null,
    data: { discard_due: "2026-09-01", lot_code: "L1", product_name: "Rum Cake" } },
  { id: "b", status: "draft", reopened_at: null,
    data: { discard_due: "2026-09-10", lot_code: "L2", product_name: "Rum Cake" } },
  { id: "c", status: "draft", reopened_at: null,
    data: { discard_due: "2026-12-01", lot_code: "L3", product_name: "Rum Cake" } },
  { id: "d", status: "submitted", reopened_at: null,
    data: { discard_due: "2026-08-01", lot_code: "L4", product_name: "Rum Cake" } },
  // Reopened AND disposed: gone, being corrected. Linking to it sends somebody to discard a
  // sample that no longer exists.
  { id: "e", status: "draft", reopened_at: "2026-09-09T00:00:00Z",
    data: { discard_due: "2026-08-15", disposal_date: "2026-08-16", lot_code: "L5",
            product_name: "Rum Cake" } },
  // Reopened but NOT disposed - a correction to a live sample; it still counts.
  { id: "f", status: "draft", reopened_at: "2026-09-09T00:00:00Z",
    data: { discard_due: "2026-09-02", disposal_date: "", lot_code: "L6",
            product_name: "Rum Cake" } },
  { id: "g", status: "draft", reopened_at: null, data: { discard_due: "" } },
];

const links = retentionLinks(entries, DOC, TODAY);
check("only due, on-shelf samples link",
  links.map((l) => l.href.split("/").pop().split("?")[0]), ["a", "f", "b"]);
// Retention links point at EXISTING records - these samples are already on the shelf - and carry
// the marker that lets the form offer a way back to the feed.
check("retention links open the existing entry",
  links[0].href, "/team/compliance/forms/doc-703/entries/a?from=notifications");
ok("label carries product, lot and due date",
  links[0].label === "Rum Cake · L1 — due 2026-09-01");

check("horizon pulls in what is due soon",
  retentionLinks(entries, DOC, TODAY, 100).map((l) => l.href.split("/").pop().split("?")[0]),
  ["a", "f", "b", "c"]);

const many = Array.from({ length: 30 }, (_, i) => ({
  id: `x${i}`, status: "draft", reopened_at: null,
  data: { discard_due: "2026-09-0" + (1 + (i % 9)), lot_code: `L${i}`, product_name: "P" },
}));
const capped = retentionLinks(many, DOC, TODAY, 0, 25);
check("cap holds", capped.length, 26);
ok("overflow points at the form", capped[25].label === "…and 5 more" &&
   capped[25].href === `/team/compliance/sops?doc=${DOC}`);

// ---------------------------------------------------------------- form links
// Every activity links to the form it is completed on, so the notification is one click from the
// work. The href points at the SOPs Library drawer, not at entry creation: a notification link has
// to be safe to click twice, and creating an entry is a write.
// It opens the ENTRY, not the library page. /start resumes an open draft before creating one,
// which is what makes a link that performs a write safe to click twice.
check("form link opens an entry, via the resume-or-create route",
  formLink("FRM-913", "abc-123", "GMP / Food Safety Inspection Record").href,
  "/team/compliance/forms/abc-123/start?from=notifications");
check("form link names the document and its title",
  formLink("FRM-913", "abc-123", "GMP / Food Safety Inspection Record").label,
  "Record on FRM-913 · GMP / Food Safety Inspection Record");
check("form link degrades without a title",
  formLink("FRM-913", "abc-123", null).label, "Record on FRM-913");
ok("form link is an internal path", formLink("FRM-008", "x", "").href.startsWith("/"));

// ---------------------------------------------------------------- the twins agree
const CASES = [];
for (const unit of ["day", "week", "month", "quarter", "year"]) {
  for (const count of [1, 2, 3]) {
    for (const from of ["2026-01-31", "2026-02-28", "2028-02-29", "2026-03-31",
                        "2026-11-15", "2026-12-31", "2026-06-30"]) {
      CASES.push([from, unit, count]);
    }
  }
}
for (const [from, unit, count] of CASES) {
  const a = S.addFrequency(from, unit, count);
  const b = C.addFrequency(from, unit, count);
  if (a !== b) {
    failures++;
    console.error(`FAIL  twins disagree on addFrequency(${from}, ${unit}, ${count}): ${a} vs ${b}`);
  }
}
try {
  deepStrictEqual(C.assessDue(SCHEDULE, COMPLETIONS, TODAY), S.assessDue(SCHEDULE, COMPLETIONS, TODAY));
  deepStrictEqual(C.retentionLinks(entries, DOC, TODAY), S.retentionLinks(entries, DOC, TODAY));
  deepStrictEqual(C.rowState(row({}), "2026-08-10", TODAY), S.rowState(row({}), "2026-08-10", TODAY));
  deepStrictEqual(C.formLink("FRM-913", "abc", "T"), S.formLink("FRM-913", "abc", "T"));
} catch (e) {
  failures++;
  console.error("FAIL  twins disagree:", e.message);
}
console.log(`twin agreement checked over ${CASES.length} frequency cases`);

rmSync(out, { recursive: true, force: true });
if (failures) {
  console.error(`\n${failures} failing case(s)`);
  process.exit(1);
}
console.log("all verification-schedule cases pass");
