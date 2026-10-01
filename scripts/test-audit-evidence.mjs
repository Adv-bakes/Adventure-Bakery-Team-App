// Tests for supabase/functions/_shared/auditEvidence.ts - the facts behind FRM-010's
// "Draft from records". The model only writes up what these functions compute, so a wrong
// count or a wrongly related form here would be signed into an audit record as evidence.
//
//   node scripts/test-audit-evidence.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "auditevidence-"));
const file = join(out, "shared.mjs");
execFileSync("npx", ["esbuild", "supabase/functions/_shared/auditEvidence.ts", "--bundle", "--format=esm", `--outfile=${file}`],
  { stdio: ["ignore", "ignore", "inherit"], shell: true });
const { clauseIdOf, relatedToClause, flattenEntry, entryHasFail, summariseForm, auditWindow, assembleEvidence } =
  await import("file://" + file.replace(/\\/g, "/"));

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) return;
  failures++;
  console.error(`FAIL  ${name}\n        expected ${e}\n        actual   ${a}`);
}

// clauseIdOf
check("clause with title", clauseIdOf("11.2.4 Pest Prevention"), "11.2.4");
check("bare clause", clauseIdOf(" 2.5.4.1 "), "2.5.4.1");
check("no clause", clauseIdOf("Pest control"), null);
check("section only", clauseIdOf("11.5"), "11.5");
check("empty", clauseIdOf(undefined), null);

// relatedToClause - both directions, never a numeric-prefix false match
check("doc cites finer clause", relatedToClause("11.2.4.1, 11.2.4.3", "11.2.4"), true);
check("doc cites the clause", relatedToClause("11.2.4", "11.2.4"), true);
check("doc cites broader section", relatedToClause("11.2", "11.2.4"), true);
check("2.10 is not 2.1", relatedToClause("2.10.1", "2.1"), false);
check("2.1 section does not govern 2.10 clause", relatedToClause("2.1", "2.10.1"), false);
check("11.1 not 11.10", relatedToClause("11.10", "11.1.7"), false);
check("sibling not related", relatedToClause("11.2.5.1", "11.2.4"), false);
check("junk tokens ignored", relatedToClause("SQF, none", "11.2"), false);
check("null reference", relatedToClause(null, "11.2"), false);

// flattenEntry
const schema = { sections: [
  { fields: [
    { id: "note", type: "info", label: "Info" },
    { id: "date", type: "date", label: "Date" },
    { id: "ok", type: "pass_fail", label: "Check" },
    { id: "sig", type: "signature", label: "Signed" },
    { id: "grid", type: "grid", label: "Stations", columns: [{ id: "st", label: "Station", type: "text" }, { id: "act", label: "Activity", type: "pass_fail" }] },
  ] },
] };
check("flatten", flattenEntry(schema, {
  date: "2026-09-01", ok: "fail", sig: { name: "A. Person", user_id: "x", signed_at: "t" },
  grid: [{ st: "EXT-1", act: "pass" }, { st: "", act: "" }, { _label: "Door", st: "EXT-2", act: "fail" }],
}), "Date: 2026-09-01; Check: Fail; Signed: signed by A. Person; Stations: [Station: EXT-1, Activity: Pass | Door - Station: EXT-2, Activity: Fail]");
check("flatten caps length", flattenEntry(schema, { date: "x".repeat(900) }, 50).length, 50);
check("flatten empty", flattenEntry(schema, null), "");

// entryHasFail
check("pass_fail fail", entryHasFail({ g: [{ a: "fail" }] }), true);
check("held on FRM-702", entryHasFail({ c: "Did not match - held on FRM-702" }), true);
check("no non-conformances", entryHasFail({ c: "No non-conformances found" }), false);
check("all pass", entryHasFail({ a: "pass", b: "Matches the lot code above" }), false);
check("signature name ignored", entryHasFail({ s: { name: "Held Smith" } }), false);
check("drawn signature image ignored", entryHasFail({ s: { name: "A Visitor", image: "data:image/png;base64,AAAA/held+AAAA" } }), false);

// summariseForm
const e = (status, submitted_at, data = {}) => ({ id: submitted_at ?? "d", status, submitted_at, created_at: submitted_at ?? "2026-09-01T00:00:00Z", data });
const s = summariseForm([
  e("submitted", "2026-03-01T10:00:00Z"),
  e("submitted", "2026-01-10T10:00:00Z", { x: "fail" }),
  e("submitted", "2025-06-01T10:00:00Z"),          // before the window
  e("draft", null),
  e("draft", null),
], "2025-10-01", "2026-09-30");
check("submitted in window", s.submitted, 2);
check("drafts counted", s.drafts, 2);
check("first/last", [s.first, s.last], ["2026-01-10", "2026-03-01"]);
check("longest gap runs to window end", s.longestGapDays, 213);
check("fail dates", s.withFail, ["2026-01-10"]);
check("empty form", summariseForm([], "2025-10-01", "2026-09-30"), { submitted: 0, drafts: 0, first: null, last: null, longestGapDays: null, withFail: [] });

// auditWindow
check("window", auditWindow("2026-09-30"), { from: "2025-10-01", to: "2026-09-30" });
check("leap window", auditWindow("2028-02-29"), { from: "2027-03-02", to: "2028-02-29" });

// assembleEvidence - one line per requirement, in order, whatever the model returns
const W = { from: "2025-10-01", to: "2026-09-30" };
const ids = ["2.1.1.1", "2.1.1.2", "2.1.1.3"];
const cov = { "2.1.1.1": ["FSQM-002"], "2.1.1.2": [], "2.1.1.3": ["FSQM-004"] };
const ev = assembleEvidence(W, ids, [
  { clause: "2.1.1.3", text: "FSQM-004 sets out the structure." },
  { clause: "2.1.1.1", text: "2.1.1.1: FSQM-002 is the  policy statement." },
  { clause: "9.9.9", text: "invented" },
], cov);
check("assemble: header + every requirement in Code order", ev.split("\n"), [
  "Records reviewed (2025-10-01 to 2026-09-30):",
  "2.1.1.1: FSQM-002 is the policy statement.",
  "2.1.1.2: No site document or record references this requirement.",
  "2.1.1.3: FSQM-004 sets out the structure.",
]);
check("assemble: skipped but referenced requirement is flagged, not dropped",
  assembleEvidence(W, ["2.1.1.1"], [], cov).split("\n")[1],
  "2.1.1.1: Referenced by FSQM-002 - no summary was drafted; review these directly.");
check("assemble: non-array model output", assembleEvidence(W, ["2.1.1.2"], null, cov).split("\n").length, 2);

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log("all audit-evidence checks passed");
