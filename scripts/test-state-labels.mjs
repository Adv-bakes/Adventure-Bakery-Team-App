// Tests for entryStateLabel in src/lib/formSchema.ts - the words a form uses for its entries' states.
//
//   node scripts/test-state-labels.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "statelabels-"));
const file = join(out, "formSchema.mjs");
execFileSync("npx", ["esbuild", "src/lib/formSchema.ts", "--bundle", "--format=esm", "--platform=node", `--outfile=${file}`, "--log-level=error"],
  { stdio: ["ignore", "ignore", "inherit"], shell: true });
const T = await import("file://" + file.replace(/\\/g, "/"));

let failures = 0, cases = 0;
function check(name, actual, expected) {
  cases++;
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  failures++;
  console.error(`FAIL ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
}

const FRM703 = { sections: [], settings: { stateLabels: {
  draft: "Being logged", signed: { field: "taken_by", label: "On the shelf", untilField: "discard_due" },
  submitted: "Disposed", save: "Save", submit: "Record disposal" } } };

check("no labels: the stored status", [T.entryStateLabel({ sections: [] }, "draft", {}), T.entryStateLabel(null, "submitted", {})], ["draft", "submitted"]);
check("a draft not yet signed", T.entryStateLabel(FRM703, "draft", { taken_by: null }), "Being logged");
check("signed: on the shelf until its discard date", T.entryStateLabel(FRM703, "draft", { taken_by: { name: "Richard Mercer", signed_at: "2026-10-15T14:00:00Z" }, discard_due: "2027-11-30" }), "On the shelf until 2027-11-30");
check("signed with no discard date yet", T.entryStateLabel(FRM703, "draft", { taken_by: { name: "R", signed_at: "x" } }), "On the shelf");
check("an empty signature is not signed", T.entryStateLabel(FRM703, "draft", { taken_by: { name: "", signed_at: "" } }), "Being logged");
check("submitted", T.entryStateLabel(FRM703, "submitted", { taken_by: { name: "R", signed_at: "x" } }), "Disposed");

rmSync(out, { recursive: true, force: true });
console.log(failures ? `${failures} of ${cases} cases failed` : `all ${cases} cases passed`);
process.exit(failures ? 1 : 0);
