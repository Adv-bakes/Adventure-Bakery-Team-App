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

check("collect from a schema, once each, sorted",
  T.collectDocRefs({ sections: [{ description: "FSQM-025", fields: [
    { label: "x (FRM-007)", help: "FRM-007 again", rows: { labels: ["Deliveries checked on FRM-301", "TRN-011 done"] } },
    { n: 3, b: true, z: null }] }] }),
  ["FRM-007", "FRM-301", "FSQM-025", "TRN-011"]);
check("collect from nothing", T.collectDocRefs(null), []);

rmSync(out, { recursive: true, force: true });
console.log(failures ? `${failures} of ${cases} failed` : `all ${cases} passed`);
process.exit(failures ? 1 : 0);
