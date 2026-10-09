// Tests for supabase/functions/_shared/gridRows.ts - placing the rows read from a PDF onto a
// fixed-row table by their label (extract-form-answers, document mode).
//
//   node scripts/test-grid-rows.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "gridrows-"));
const file = join(out, "gridRows.mjs");
execFileSync("npx", ["esbuild", "supabase/functions/_shared/gridRows.ts", "--bundle", "--format=esm", `--outfile=${file}`],
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

// FRM-903's equipment table as the form has it.
const EQUIPMENT = [
  "Hobart V-1401 Mixer — SOP-901 / FRM-909",
  "Kook-E-King Depositor — SOP-902 / FRM-910",
  "Beldos 275 Depositor — SOP-903 / FRM-911",
  "Smipack S560NA Shrink Wrapper — SOP-601",
  "Groen TDB Kettle — SOP-904 / FRM-912",
  "Molds — SOP-906 (recorded here)",
];
const statuses = (p) => p.rows.map(r => r?.status ?? null);

// The 2026-10-08 record, in document order, labels as printed.
{
  const read = [
    { _row: "Hobart V-1401 Mixer — SOP-901 / FRM-909", status: "Clean & sanitized" },
    { _row: "Kook-E-King Depositor — SOP-902 / FRM-910", status: "Not used today" },
    { _row: "Beldos 275 Depositor — SOP-903 / FRM-911", status: "Clean & sanitized" },
    { _row: "Smipack S560NA Shrink Wrapper — SOP-601", status: "Between-use care (scrape, wipe, re-grease)" },
    { _row: "Groen TDB Kettle — SOP-904 / FRM-912", status: "Not used today" },
    { _row: "Molds — SOP-906 (recorded here)", status: "Between-use care (scrape, wipe, re-grease)" },
  ];
  const p = T.placeRowsByLabel(EQUIPMENT, read);
  check("placed by label", [p.byLabel, p.unmatched], [true, []]);
  check("every row lands on its own label", statuses(p), read.map(r => r.status));
  // The same rows in another order (a table continued over a page break, read page 2 first).
  check("order in the document does not matter", statuses(T.placeRowsByLabel(EQUIPMENT, [...read].reverse())), read.map(r => r.status));
  // A row the model missed leaves a gap; nothing slides up into it.
  const missing = T.placeRowsByLabel(EQUIPMENT, read.filter((_, i) => i !== 1));
  check("a missed row is a gap, not a shift", statuses(missing), [read[0].status, null, read[2].status, read[3].status, read[4].status, read[5].status]);
}

// Spelling of the label: dashes, case and spacing do not matter; a label cut short still fits.
{
  const p = T.placeRowsByLabel(EQUIPMENT, [
    { _row: "kook-e-king depositor - SOP-902/FRM-910", status: "A" },
    { _row: "Molds", status: "B" },
    { _row: "Hobart V-1401 Mixer", status: "C" },
  ]);
  check("loose spelling and short labels", statuses(p), ["C", "A", null, null, null, "B"]);
  check("normLabel", T.normLabel("Kook-E-King Depositor — SOP-902 / FRM-910"), "kook e king depositor sop 902 frm 910");
}

// The pre-op table after Chopper left the form: the old record still has the row.
{
  const SURFACES = ["Tables", "Mixers", "Depositors", "Floors", "Handwash stations (clean, stocked, draining)"];
  const p = T.placeRowsByLabel(SURFACES, [
    { _row: "Tables", visibly_clean: "pass" },
    { _row: "Mixers", visibly_clean: "pass" },
    { _row: "Depositors", visibly_clean: "pass" },
    { _row: "Chopper", visibly_clean: "na" },
    { _row: "Floors", visibly_clean: "fail" },
    { _row: "Handwash stations (clean, stocked, draining)", visibly_clean: "pass" },
  ]);
  check("a row no longer on the form is reported, not placed", p.unmatched, ["Chopper"]);
  check("and the rows after it do not shift", p.rows.map(r => r?.visibly_clean ?? null), ["pass", "pass", "pass", "fail", "pass"]);
}

// Never guessed.
{
  const AMBIG = ["Depositor 1", "Depositor 2"];
  const p = T.placeRowsByLabel(AMBIG, [{ _row: "Depositor", status: "x" }]);
  check("a label that fits two rows is not placed", [statuses(p), p.unmatched], [[null, null], ["Depositor"]]);
  const twice = T.placeRowsByLabel(["Tables"], [{ _row: "Tables", s: 1 }, { _row: "tables", s: 2 }]);
  check("two rows for one label: the first is kept", twice.rows[0].s, 1);
  check("'Mixers' does not match 'Mix'", T.placeRowsByLabel(["Mixers"], [{ _row: "Mix", s: 1 }]).unmatched, ["Mix"]);
}

// No labels at all: the caller falls back to position.
{
  const p = T.placeRowsByLabel(EQUIPMENT, [{ status: "A" }, { status: "B" }]);
  check("no labels means not placed by label", [p.byLabel, p.rows.every(r => r === null)], [true, true].map((_, i) => i === 0 ? false : true));
  check("junk input", T.placeRowsByLabel(null, "nope"), { byLabel: false, rows: [], unmatched: [] });
  check("a blank label does not count", T.placeRowsByLabel(["Tables"], [{ _row: "  ", s: 1 }]).byLabel, false);
}

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} of ${cases} checks failed`); process.exit(1); }
console.log(`grid rows: ${cases} checks passed`);
