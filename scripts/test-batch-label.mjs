// Tests for src/lib/batchLabel.ts - the container label of a batch made on site (FRM-530).
//
//   node scripts/test-batch-label.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "batchlabel-"));
const file = join(out, "batchLabel.mjs");
execFileSync("npx", ["esbuild", "src/lib/batchLabel.ts", "--bundle", "--format=esm", `--outfile=${file}`, "--log-level=error"],
  { stdio: ["ignore", "ignore", "inherit"], shell: true });
const L = await import("file://" + file.replace(/\\/g, "/"));

let failures = 0, cases = 0;
function check(name, actual, expected) {
  cases++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) return;
  failures++;
  console.error(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`);
}

// ---- the quantity on each label
check("75 lb over 2 containers", L.labelQuantity("75 lb", 2), "37.5 lb");
check("one container takes it all", L.labelQuantity("75 lb", 1), "75 lb");
check("rounded to two places", L.labelQuantity("10 gal", 3), "3.33 gal");
check("unit spellings are the lot record's", L.labelQuantity("75 lbs", 2), "37.5 lb");
check("a bare number keeps no unit", L.labelQuantity("12", 4), "3");
check("a range is not guessed", L.labelQuantity("70-75 lb", 2), null);
check("words are not guessed", L.labelQuantity("about 2 buckets", 2), null);
check("blank", L.labelQuantity("", 2), null);
check("zero is not a quantity", L.labelQuantity("0 lb", 2), null);
check("no containers", L.labelQuantity("75 lb", 0), null);

// ---- the QR code
const batch = { product: "Simple Syrup", lotCode: "6287", madeOn: "2026-10-14", useBy: "2026-11-13", quantityMade: "75 lb", madeBy: "Richard Mercer" };
const qr = L.labelPayload(batch);
check("the code says what it is, line by line", qr.split("\n"), ["ADVBAKES-LOT/1", "FRM-530", "Simple Syrup", "6287", "2026-10-14", "2026-11-13"]);
check("and reads back exactly", L.parseLabelPayload(qr), { product: "Simple Syrup", lotCode: "6287", madeOn: "2026-10-14", useBy: "2026-11-13" });
check("read back from a scanner that sends Windows line ends", L.parseLabelPayload(qr.replace(/\n/g, "\r\n")).lotCode, "6287");
check("a new line inside a name cannot shift the lot", L.parseLabelPayload(L.labelPayload({ ...batch, product: "Simple\nSyrup" })).lotCode, "6287");
check("someone else's code is not ours", L.parseLabelPayload("https://example.com/x"), null);
check("a supplier's bar code is not ours", L.parseLabelPayload("012345678905"), null);
check("ours without a lot is refused", L.parseLabelPayload("ADVBAKES-LOT/1\nFRM-530\nSimple Syrup\n"), null);

// ---- the pages
const pages = L.labelPages(batch, 2);
check("one page per container, numbered", pages.map(p => [p.container, p.of]), [[1, 2], [2, 2]]);
check("each carries its share", pages.map(p => p.quantity), ["37.5 lb", "37.5 lb"]);
check("and the same code", pages[0].qr === pages[1].qr && pages[0].qr === qr, true);
check("a quantity that cannot be read is left off", L.labelPages({ ...batch, quantityMade: "a lot" }, 2)[0].quantity, "");
check("at most twenty", L.labelPages(batch, 500).length, L.MAX_LABELS);
check("at least one", L.labelPages(batch, 0).length, 1);

// ---- from the record
check("the batch as the labels need it", L.labelBatchFrom({ product: " Simple Syrup ", lot_code: "6287", made_on: "2026-10-14", use_by: "2026-11-13", quantity_made: "75 lb", made_by: { name: "Richard Mercer", signed_at: "x" } }),
  { product: "Simple Syrup", lotCode: "6287", madeOn: "2026-10-14", useBy: "2026-11-13", quantityMade: "75 lb", madeBy: "Richard Mercer" });
check("an empty record gives blanks, not an error", L.labelBatchFrom(null).lotCode, "");

rmSync(out, { recursive: true, force: true });
console.log(failures ? `${failures} of ${cases} cases failed` : `all ${cases} cases passed`);
process.exit(failures ? 1 : 0);
