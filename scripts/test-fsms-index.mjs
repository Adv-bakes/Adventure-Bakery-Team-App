// Tests for src/lib/fsmsIndex.ts - the clause-to-document index (D-08). The index is what an
// auditor is shown as "the document that controls this clause", so a clause wrongly shown as
// covered is worse than one wrongly shown as a gap.
//
//   node scripts/test-fsms-index.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "fsmsindex-"));
const file = join(out, "fsmsIndex.mjs");
execFileSync("npx", ["esbuild", "src/lib/fsmsIndex.ts", "--bundle", "--format=esm", `--outfile=${file}`],
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

// ---- references
check("plain list", T.parseSqfReferences("2.1.1.2, 11.3"), { clauses: ["2.1.1.2", "11.3"], unreadable: [] });
check("shorthand continues the clause before it", T.parseSqfReferences("2.4.8.1, .2, .3, 11.7.1.2"),
  { clauses: ["2.4.8.1", "2.4.8.2", "2.4.8.3", "11.7.1.2"], unreadable: [] });
check("shorthand with nothing before it is unreadable", T.parseSqfReferences(".2"), { clauses: [], unreadable: [".2"] });
check("N/A is unreadable, not dropped", T.parseSqfReferences("N/A"), { clauses: [], unreadable: ["N/A"] });
check("empty", T.parseSqfReferences(null), { clauses: [], unreadable: [] });
check("duplicates collapse", T.parseSqfReferences("2.5.1.1, 2.5.1.1").clauses, ["2.5.1.1"]);

// ---- roles
check("FSQM is a program", T.docRole({ sop_number: "FSQM-017", type: "fsqm" }), "program");
check("SOP is a program", T.docRole({ sop_number: "SOP-2.3.1", type: "sop" }), "program");
check("FRM is a record", T.docRole({ sop_number: "FRM-913", type: "form" }), "record");
check("REP is a record", T.docRole({ sop_number: "REP-003", type: "report" }), "record");
check("TRN is training", T.docRole({ sop_number: "TRN-003", type: "training" }), "training");
check("unnumbered training is training", T.docRole({ sop_number: null, type: "training" }), "training");

// ---- the index
const doc = (id, sop_number, type, status, sqf_reference) => ({ id, sop_number, title: sop_number ?? id, type, status, sqf_reference });
const docs = [
  doc("a", "FSQM-005", "fsqm", "active", "2.1.2.1, 2.1.2.2"),
  doc("b", "FRM-001", "form", "active", "2.1.2.1"),
  doc("c", "FSQM-006", "fsqm", "draft", "2.1.1.2"),
  doc("d", "FRM-913", "form", "active", "11.3"),
  doc("e", "TRN-002", "training", "active", "11.3"),
  doc("f", "FSQM-012", "fsqm", "active", "11.3.1.1"),
  doc("g", "FSQM-099", "fsqm", "archived", "2.1.1.1"),
  doc("h", "FSQM-098", "fsqm", "active", "2.1.2.5, N/A"),
];
const index = T.buildFsmsIndex(docs);
const clause = (id) => index.sections.flatMap((s) => s.subSections).flatMap((s) => s.clauses).find((c) => c.id === id);

check("active program -> issued", clause("2.1.2.1").state, "issued");
check("programs before records", clause("2.1.2.1").docs.map((d) => d.sop_number), ["FSQM-005", "FRM-001"]);
check("draft program only -> draft", clause("2.1.1.2").state, "draft");
check("an archived document does not count", clause("2.1.1.1").state, "none");
check("record and training only -> no program", clause("11.3.2.1").state, "no_program");
check("a section reference covers the clauses under it", clause("11.3.2.1").docs.map((d) => d.sop_number), ["FRM-913", "TRN-002"]);
check("broad references are marked as not exact", clause("11.3.2.1").docs.map((d) => d.exact), [false, false]);
check("exact program plus broad record", clause("11.3.1.1").docs.map((d) => [d.sop_number, d.exact]),
  [["FSQM-012", true], ["FRM-913", false], ["TRN-002", false]]);
check("a finer reference does not cover a sibling", clause("11.3.1.2").state, "no_program");
check("references that match no clause are listed", index.unmatched.map((u) => [u.doc.sop_number, u.token]),
  [["FSQM-098", "N/A"], ["FSQM-098", "2.1.2.5"]]);
check("every clause is counted once",
  index.counts.issued + index.counts.draft + index.counts.no_program + index.counts.none, index.total);
check("section counts add up to the total",
  index.sections.reduce((n, s) => n + Object.values(s.counts).reduce((a, b) => a + b, 0), 0), index.total);
check("seventeen sections, each titled", [index.sections.length, index.sections.every((s) => s.title.length > 0)], [17, true]);
check("sections in Code order", index.sections.map((s) => s.id).slice(0, 3).concat(index.sections.at(-1).id), ["2.1", "2.2", "2.3", "11.8"]);
check("sub-sections carry the Code's title", index.sections[0].subSections[0].title.length > 0, true);

const rows = T.fsmsIndexRows(index);
check("csv has a header and one row per clause", rows.length, index.total + 1);
check("csv marks drafts", rows.find((r) => r[0] === "2.1.1.2")[4], "FSQM-006 (draft)");

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} of ${cases} failed`); process.exit(1); }
console.log(`${cases} cases passed`);
