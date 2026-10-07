// Tests for src/lib/docRefs.ts - finding document numbers in a form's text so they can be shown
// as links. A missed number is only a missing link; a false match would link the wrong words.
//
//   node scripts/test-doc-refs.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "docrefs-"));
const file = join(out, "docRefs.mjs");
execFileSync("npx", ["esbuild", "src/lib/docRefs.ts", "--bundle", "--format=esm", `--outfile=${file}`],
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
const refs = text => T.splitDocRefs(text).filter(p => typeof p !== "string").map(p => p.ref);

check("number in brackets", T.splitDocRefs("Chemicals locked away (FSQM-032)"),
  ["Chemicals locked away (", { ref: "FSQM-032" }, ")"]);
check("two numbers", refs("Printed packaging kept inside; waste defaced (FSQM-037), see FRM-905"), ["FSQM-037", "FRM-905"]);
check("clause-numbered SOP", refs("as SOP-2.3.4 requires."), ["SOP-2.3.4"]);
check("trailing full stop is not part of the number", T.splitDocRefs("See SOP-11.7.3."), ["See ", { ref: "SOP-11.7.3" }, "."]);
check("training module with a letter", refs("TRN-002A and TRN-011 completed"), ["TRN-002A", "TRN-011"]);
check("SSOP is not read as SOP", refs("SSOP-902"), ["SSOP-902"]);
check("no number", T.splitDocRefs("Cameras working and recording"), ["Cameras working and recording"]);
check("empty", T.splitDocRefs(""), []);
check("lower case and bare words are left alone", refs("the frm-301 form, FRM 301, FRM-, REFRM-301"), []);
check("text is preserved exactly", T.splitDocRefs("a FRM-301 b").map(p => typeof p === "string" ? p : p.ref).join(""), "a FRM-301 b");

check("refs in text, once each, in order", T.docRefsIn("FRM-909, FRM-910 then FRM-909 and SOP-2.3.4."), ["FRM-909", "FRM-910", "SOP-2.3.4"]);
check("refs in nothing", T.docRefsIn(""), []);

const idx = T.buildDocIndex([
  { id: "a", sop_number: "FRM-909", title: "Mixer Cleaning & Pre-Use Check Log", status: "active" },
  { id: "b", sop_number: "FSQM-027", title: "Allergen Management Program", status: "draft" },
  { id: "c", sop_number: "FSQM-027", title: "Old one", status: "archived" },
  { id: "d", sop_number: "TRN-003", title: "Allergens Part 1 (ES)", status: "active" },
  { id: "e", sop_number: "TRN-003", title: "Allergens Part 1", status: "active" },
  { id: "f", sop_number: "FRM-012", title: "Draft copy", status: "draft" },
  { id: "g", sop_number: "FRM-012", title: "Recall Record", status: "active" },
  { id: "h", sop_number: null, title: "No number", status: "active" },
  { id: "i", sop_number: "FRM-001", title: null, status: "active" },
]);
check("index: title and id", idx["FRM-909"], { id: "a", title: "Mixer Cleaning & Pre-Use Check Log", draft: false });
check("index: a draft is flagged, an archived row ignored", idx["FSQM-027"], { id: "b", title: "Allergen Management Program", draft: true });
check("index: English module wins over its Spanish variant", idx["TRN-003"].id, "e");
check("index: issued wins over a draft with the same number", idx["FRM-012"].id, "g");
check("index: no number, no entry; no title falls back to the number", [Object.keys(idx).length, idx["FRM-001"].title], [5, "FRM-001"]);

check("pick: issued TRN and SOP only, in number order, one per number",
  T.docPickOptions(T.buildDocIndex([
    { id: "1", sop_number: "TRN-010", title: "Food Defense", status: "active" },
    { id: "2", sop_number: "TRN-003", title: "Allergens Part 1 (ES)", status: "active" },
    { id: "3", sop_number: "TRN-003", title: "Allergens Part 1", status: "active" },
    { id: "4", sop_number: "SOP-2.9", title: "Training & Recordkeeping", status: "active" },
    { id: "5", sop_number: "SOP-204", title: "Unissued", status: "draft" },
    { id: "6", sop_number: "FRM-953", title: "Training Sign-In Sheet", status: "active" },
    { id: "7", sop_number: "SOP-11.7.3", title: null, status: "active" },
  ]), ["trn", "SOP"]),
  ["SOP-2.9 Training & Recordkeeping", "SOP-11.7.3", "TRN-003 Allergens Part 1", "TRN-010 Food Defense"]);
check("pick: no prefixes, nothing offered", T.docPickOptions(idx, []), []);

rmSync(out, { recursive: true, force: true });
console.log(failures ? `${failures} of ${cases} failed` : `all ${cases} passed`);
process.exit(failures ? 1 : 0);
