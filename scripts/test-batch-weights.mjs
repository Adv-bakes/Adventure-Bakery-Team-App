// Tests for src/lib/batchWeights.ts - the "Weighed per batch" cell of the lot record (FRM-520 v3).
// The same format is written by public.mix_set_batch_weight in SQL (migration 20261023000002); the
// cases marked SQL were run through that function against production (2026-10-23, rolled back) and
// gave these exact strings. Change one, change both.
//
//   node scripts/test-batch-weights.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "batchweights-"));
const file = join(out, "batchWeights.mjs");
execFileSync("npx", ["esbuild", "src/lib/batchWeights.ts", "--bundle", "--format=esm", `--outfile=${file}`, "--log-level=error"],
  { stdio: ["ignore", "ignore", "inherit"], shell: true });
const W = await import("file://" + file.replace(/\\/g, "/"));

let failures = 0, cases = 0;
function check(name, actual, expected) {
  cases++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) return;
  failures++;
  console.error(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`);
}
const parsed = cell => { const p = W.parseBatchWeights(cell); return [[...p.weights.entries()], p.ok]; };

// ---- the same cases as the SQL twin
check("SQL t1: the first weight", W.setBatchWeight("", 1, 17.5), "B1: 17.5");
check("SQL t2: a batch slots into order", W.setBatchWeight("B1: 17.49; B3: 17.5", 2, 17.4), "B1: 17.49; B2: 17.4; B3: 17.5");
check("SQL t3: a weight taken off", W.setBatchWeight("B1: 17.49; B2: 17.4", 2, ""), "B1: 17.49");
check("SQL t4: loose typing is read and written back tidy", W.setBatchWeight("2: 1; b10 3", 4, 0), "B2: 1; B4: 0; B10: 3");
check("SQL t5: batch 10 after batch 9, not after 1", W.setBatchWeight("B9: 1", 10, 2), "B9: 1; B10: 2");

// ---- reading
check("empty", parsed(""), [[], true]);
check("null", parsed(null), [[], true]);
check("one per line works too", parsed("B1: 1\nB2: 2"), [[[1, "1"], [2, "2"]], true]);
check("the weight keeps the digits typed", parsed("B1: 17.50"), [[[1, "17.50"]], true]);
check("something typed by hand is not readable", parsed("B1: 17.5; about 18 for batch 2")[1], false);
check("a decimal comma is not split into two batches", parsed("B1: 17,5")[1], false);
check("batch 0 is not a batch", parsed("B0: 1")[1], false);
check("a cell that cannot be read is never written", W.setBatchWeight("first 17.5", 2, 1), null);
check("nor is batch 0", W.setBatchWeight("", 0, 1), null);
check("a weight replaced", W.setBatchWeight("B1: 17.5", 1, 17.6), "B1: 17.6");
check("the last weight taken off leaves the cell empty", W.setBatchWeight("B1: 17.5", 1, ""), "");

// ---- a line's weights, whichever revision it was made on
check("the v3 cell", [...W.rowBatchWeights({ weighed_batches: "B1: 1; B6: 6" }).entries()], [[1, "1"], [6, "6"]]);
check("an earlier record's three columns", [...W.rowBatchWeights({ actual_qty: 17.5, actual_qty_2: "", actual_qty_3: 17.4 }).entries()], [[1, "17.5"], [3, "17.4"]]);
check("the cell wins when both are there", [...W.rowBatchWeights({ weighed_batches: "B2: 2", actual_qty: 1 }).entries()], [[2, "2"]]);
check("nothing recorded", W.rowBatchWeights({}).size, 0);

rmSync(out, { recursive: true, force: true });
console.log(failures ? `${failures} of ${cases} cases failed` : `all ${cases} cases passed`);
process.exit(failures ? 1 : 0);
