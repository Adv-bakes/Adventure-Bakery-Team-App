// Tests for src/lib/monthlyUpdate.ts - what the records say about each standing matter of the
// Monthly SQF Update (FRM-009) since the last update.
//
//   node scripts/test-monthly-update.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "monthlyupdate-"));
const file = join(out, "monthlyUpdate.mjs");
execFileSync("npx", ["esbuild", "src/lib/monthlyUpdate.ts", "--bundle", "--format=esm", `--outfile=${file}`, "--log-level=error"],
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
const has = (name, text, part) => check(name, String(text).includes(part), true);

let n = 0;
const entry = (data, status = "submitted", createdAt = "2026-10-01T12:00:00Z") => ({ id: `e${++n}`, status, createdAt, data });

// ---- the period
const updates = [entry({ update_date: "2026-09-17" }), entry({ update_date: "2026-10-07" }), entry({ update_date: "2026-10-09" }, "draft"), { ...entry({ update_date: "2026-10-12" }, "draft"), id: "self" }];
check("from the newest submitted update before this one", T.updatePeriod(updates, "self", "2026-10-12", "2026-10-12"), { since: "2026-10-07", until: "2026-10-12", previous: "2026-10-07" });
check("a draft update is not the last update", T.updatePeriod(updates, "self", "2026-10-12", "2026-10-12").previous, "2026-10-07");
check("an entry for an earlier month looks back from its own date", T.updatePeriod(updates, "x", "2026-10-01", "2026-10-12"), { since: "2026-09-17", until: "2026-10-01", previous: "2026-09-17" });
check("no date on the entry yet: up to today", T.updatePeriod(updates, "self", "", "2026-10-12").until, "2026-10-12");
check("no earlier update: the 31 days before", T.updatePeriod([], "self", "2026-10-12", "2026-10-12"), { since: "2026-09-11", until: "2026-10-12", previous: null });
check("the phrase says which", [T.periodPhrase({ since: "2026-10-07", until: "2026-10-12", previous: "2026-10-07" }), T.periodPhrase({ since: "2026-09-11", until: "2026-10-12", previous: null })],
  ["since the last update on 2026-10-07", "in the 31 days to 2026-10-12 (no earlier update on record)"]);

// ---- a quiet month says what was looked at, never a bare "None"
const P = { since: "2026-10-07", until: "2026-10-12", previous: "2026-10-07" };
const quiet = T.monthlyUpdateLines(T.emptyUpdateRecords(), P);
check("verification", quiet.verification, "Nothing on the verification schedule is due or overdue as of 2026-10-12.");
check("corrective actions", quiet.capa, "No corrective action is open on FRM-007 as of 2026-10-12.");
check("complaints, incidents and recalls", quiet.events, "No complaint reported on FRM-002 since the last update on 2026-10-07. No glass or brittle plastic breakage on FRM-908. Nothing put on hold on FRM-702. No withdrawal, recall or mock recall on FRM-012.");
has("audits name both forms", quiet.audits, "No internal audit recorded on FRM-010 since the last update on 2026-10-07. No GMP inspection recorded on FRM-913.");
has("...and say what no form holds", quiet.audits, "Customer, certification body and regulatory visits are not on a form");
has("changes name the form and the documents", quiet.changes, "No change assessed on FRM-015 since the last update on 2026-10-07. No controlled document issued or revised.");

// ---- a busy month
const r = T.emptyUpdateRecords();
r.reminders = [{ title: "Calibration check is overdue", severity: "overdue", dueOn: "2026-09-21" }, { title: "Monthly SQF update to senior site management is due", severity: "due", dueOn: "2026-10-07" }];
r.entries.capas = [
  entry({ capa_no: "CAPA-002", severity: "Minor", date_raised: "2026-10-08", target_close_date: "2026-11-01", closure_date: "" }, "draft"),
  entry({ capa_no: "CAPA-001", severity: "Major", date_raised: "2026-08-01", target_close_date: "2026-09-30", closure_date: "" }, "draft"),
  entry({ capa_no: "CAPA-000", severity: "Minor", date_raised: "2026-07-01", closure_date: "2026-07-20" }),
  entry({ capa_no: "", severity: "", date_raised: "", closure_date: "" }, "draft"),
];
r.entries.complaints = [
  entry({ complaint_ref_no: "C-14", date_received: "2026-10-09", classification: "Critical (food safety risk)", product_name: "Rum Cake - Original" }, "draft"),
  entry({ complaint_ref_no: "C-13", date_received: "2026-10-07", classification: "Non-Critical (quality concern)", product_name: "" }),
  entry({ complaint_ref_no: "C-12", date_received: "2026-10-01", classification: "Non-Critical (quality concern)" }),
  entry({ complaint_ref_no: "C-15", date_received: "", classification: "", product_name: "" }, "draft", "2026-10-11T09:00:00Z"),
  entry({}, "draft", "2026-10-10T09:00:00Z"),
];
r.entries.breakages = [entry({ incident_ref_no: "G-3", date_time_3: "2026-10-10T14:20", location_area: "Packing room" }, "draft")];
r.entries.holds = [entry({ hold_tag_number: "H-9", date_time_placed_on_hold: "2026-10-08T08:00", material_name_description: "Soybean oil", final_disposition_decision: "" }, "draft")];
r.entries.recalls = [entry({ record_type: "Mock recall test", started: "2026-10-11T10:00", product: "Rum Cake - Original" }, "draft")];
r.entries.audits = [entry({ audit_date: "2026-10-09", quarter: "Q4 (October to December)", capa_raised: "No non-conformances found" })];
r.entries.inspections = [
  entry({ inspection_date: "2026-10-08", inspection_type: "Routine (monthly)", items: [{ result: "pass" }, { result: "fail" }, { result: "fail", note: "fail is in the note too" }], repeat_findings: "pass" }),
  entry({ inspection_date: "2026-09-17", inspection_type: "Routine (monthly)", items: [{ result: "fail" }] }),
];
r.entries.changes = [entry({ change_type: "Equipment", raised_on: "2026-10-08", decision: "" }, "draft")];
r.documents = [{ number: "FSQM-017", revision: "v15", effective: "2026-10-12" }, { number: "FRM-011", revision: "v2", effective: "2026-10-10" },
  { number: "FRM-601", revision: "v2", effective: "2026-10-10" }, { number: "FSQM-009", revision: "New", effective: "2026-09-02" }];
const busy = T.monthlyUpdateLines(r, P);
check("overdue before due, without the trailing verb", busy.verification, "Overdue: Calibration check (due 2026-09-21). Due: Monthly SQF update to senior site management (due 2026-10-07).");
check("open actions oldest first, the late one flagged, the closed and the blank left out", busy.capa,
  "2 corrective actions open on FRM-007: CAPA-001 (Major, raised 2026-08-01, target 2026-09-30 - PAST DUE); CAPA-002 (Minor, raised 2026-10-08, target 2026-11-01).");
has("complaints of the period only, the day of the last update included", busy.events,
  "3 complaints on FRM-002 since the last update on 2026-10-07 (1 Critical, 2 other): C-13 2026-10-07, Non-Critical; C-14 2026-10-09, Rum Cake - Original, Critical (draft); C-15 2026-10-11, not yet classified (draft).");
has("a breakage", busy.events, "1 breakage on FRM-908: G-3 2026-10-10, Packing room (draft).");
has("a hold, still open", busy.events, "1 hold on FRM-702: tag H-9 2026-10-08, Soybean oil, STILL OPEN.");
has("a mock recall", busy.events, "Mock recall test started 2026-10-11, Rum Cake - Original (draft) (FRM-012).");
has("an audit with its outcome", busy.audits, "Internal audit 2026-10-09 (Q4): No non-conformances found (FRM-010).");
has("an inspection with its failed items counted, last month's left out", busy.audits, "GMP inspection 2026-10-08 (Routine (monthly)): 2 items failed (FRM-913).");
has("a change not yet decided", busy.changes, "1 change assessed on FRM-015: Equipment 2026-10-08, not yet decided (draft).");
has("documents of the period, in number order", busy.changes, "3 controlled documents issued or revised: FRM-011 v2, FRM-601 v2, FSQM-017 v15.");
{
  const many = T.emptyUpdateRecords();
  many.documents = Array.from({ length: 18 }, (_, i) => ({ number: `FRM-${100 + i}`, revision: "v2", effective: "2026-10-10" }));
  has("a long list is cut and counted", T.monthlyUpdateLines(many, P).changes, "FRM-114 v2, and 3 more.");
}

// ---- into the entry: blank cells only, the last row never
const LABELS = ["Verification activities due or overdue\nWhat the schedule shows outstanding, and why.", "Open corrective actions\nCAPAs on FRM-007", "Complaints, incidents and recalls\nAnything raised since the last update.",
  "Audit and inspection findings\nInternal, customer", "Changes affecting the SQF System\nProcess, product", "Anything needing a decision or a resource"];
const blank = { update_date: "2026-10-12", matters: [{}, {}, {}, {}, {}, {}] };
const filled = T.applyMonthlyUpdate(blank, busy, LABELS);
check("five matters filled", filled.filled, ["Verification activities due or overdue", "Open corrective actions", "Complaints, incidents and recalls", "Audit and inspection findings", "Changes affecting the SQF System"]);
check("the decision row is left for the person", filled.values.matters[5], {});
check("the entry handed in is not changed", blank.matters[0], {});
const typed = { matters: [{}, {}, { raised: "No complaints logged." }, {}, {}, { raised: "Need a second scale" }] };
const part = T.applyMonthlyUpdate(typed, busy, LABELS);
check("what was typed is kept, and said", [part.values.matters[2].raised, part.values.matters[5].raised, part.kept], ["No complaints logged.", "Need a second scale", ["Complaints, incidents and recalls"]]);
check("nothing blank, nothing changed", T.applyMonthlyUpdate(filled.values, busy, LABELS).filled, []);
check("a short table is grown, not skipped", T.applyMonthlyUpdate({ matters: [] }, quiet, LABELS).values.matters.length, 5);

// ---- the forms it reads, and the form it runs on
check("mapping: all present", T.checkUpdateMapping(Object.fromEntries(Object.values(T.UPDATE_SOURCES).map(s => [s.form, [...s.fields]]))), []);
check("mapping: a renamed field and a missing form are said", T.checkUpdateMapping({ ...Object.fromEntries(Object.values(T.UPDATE_SOURCES).map(s => [s.form, [...s.fields]])), "FRM-002": ["date_received"], "FRM-908": undefined }).slice(0, 2),
  ['FRM-002 no longer has "complaint_ref_no"', 'FRM-002 no longer has "classification"']);
const schema = { sections: [{ fields: [{ id: "matters", type: "grid", columns: [{ id: "raised" }], rows: { mode: "fixed", labels: LABELS } }] }] };
check("ready on the form as issued", T.monthlyUpdateReady(schema), true);
check("not without the column, the rows or the table", [T.monthlyUpdateReady({ sections: [{ fields: [{ id: "matters", type: "grid", columns: [{ id: "notes" }], rows: { mode: "fixed", labels: LABELS } }] }] }),
  T.monthlyUpdateReady({ sections: [{ fields: [{ id: "matters", type: "grid", columns: [{ id: "raised" }], rows: { mode: "fixed", labels: ["Other"] } }] }] }), T.monthlyUpdateReady(null)], [false, false, false]);

rmSync(out, { recursive: true, force: true });
console.log(failures ? `${failures} of ${cases} cases failed` : `all ${cases} cases passed`);
process.exit(failures ? 1 : 0);
