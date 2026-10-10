// Tests for src/lib/firstPackCheck.ts - the first-pack check on FRM-520 from a photo: flavor, lot
// code, best-by month (twelve months after the bake date) and the bar code against the formula sheet.
//
//   node scripts/test-first-pack.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "firstpack-"));
const file = join(out, "firstPackCheck.mjs");
execFileSync("npx", ["esbuild", "src/lib/firstPackCheck.ts", "--bundle", "--format=esm", `--outfile=${file}`],
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

// ---- the best-by month
check("the owner's example: made 10 Oct 2026 -> October 2027", T.monthLabel(T.expectedBestBy("2026-10-10")), "October 2027");
check("the last day of a month, a leap day, December", ["2026-01-31", "2028-02-29", "2026-12-01"].map(d => T.monthLabel(T.expectedBestBy(d))), ["January 2027", "February 2029", "December 2027"]);
check("no bake date, no expectation", [T.expectedBestBy(""), T.expectedBestBy("soon"), T.expectedBestBy("2026-13-01")], [null, null, null]);

const ym = t => { const r = T.parseBestBy(t); return r ? `${r.year}-${r.month}` : null; };
check("as printed on our packs", ["October 2027", "OCT 2027", "Oct. 2027", "Best By: October 2027", "BEST BY OCT 2027", "Sept 2027"].map(ym), ["2027-10", "2027-10", "2027-10", "2027-10", "2027-10", "2027-9"]);
check("with a day, and numeric", ["Oct 15, 2027", "15 Oct 2027", "10/2027", "10/15/2027", "10-15-27", "2027-10-15", "10/27"].map(ym), ["2027-10", "2027-10", "2027-10", "2027-10", "2027-10", "2027-10", "2027-10"]);
check("not a date is not read", ["", "6283", "soon", "Octember 2027", "13/2027", "October"].map(ym), [null, null, null, null, null, null]);

// ---- bar codes
check("same digits, spacing ignored", T.sameBarcode("0 12345 67890 5", "012345678905"), true);
check("a UPC against its EAN-13 form", T.sameBarcode("012345678905", "0012345678905"), true);
check("one digit out", T.sameBarcode("012345678905", "012345678906"), false);
check("a blank matches nothing", [T.sameBarcode("", ""), T.sameBarcode("", "012345678905"), T.sameBarcode("0000", "")], [false, false, false]);

// ---- the whole check
const REC = { product: "Rum Cake - Pumpkin Spice", lot: "6283", bakeDate: "2026-10-10", barcode: "850012345678" };
const states = lines => lines.map(l => `${l.point}:${l.state}`);
const good = T.checkFirstPack(REC, { product_name: "Pumpkin Spice Rum Cake", lot_code: "6283", best_by: "October 2027", barcode: "8 50012 34567 8", decodedBarcode: "850012345678" });
check("everything right", states(good), ["flavor:match", "lot:match", "best_by:match", "barcode:match"]);
check("...is a match", T.packVerdict(good), "match");

const wrong = T.checkFirstPack(REC, { product_name: "Banana Rum Cake", lot_code: "6282", best_by: "September 2027", decodedBarcode: "850012345999" });
check("everything wrong", states(wrong), ["flavor:mismatch", "lot:mismatch", "best_by:mismatch", "barcode:mismatch"]);
check("...is a mismatch", T.packVerdict(wrong), "mismatch");
check("the note says so", T.noteHasMismatch(T.packNote(wrong)), true);
check("a good note does not", [T.isPackNote(T.packNote(good)), T.noteHasMismatch(T.packNote(good))], [true, false]);

const blur = T.checkFirstPack(REC, {});
check("nothing read is unread, never a match", states(blur), ["flavor:unread", "lot:unread", "best_by:unread", "barcode:unread"]);
check("...and the answer is held back", T.packVerdict(blur), "incomplete");

check("the plain pack on a flavored day needs a look", states(T.checkFirstPack(REC, { product_name: "Rum Cake" }))[0], "flavor:check");
check("Original against a pack that just says Rum Cake", states(T.checkFirstPack({ ...REC, product: "Rum Cake - Original" }, { product_name: "RUM CAKE" }))[0], "flavor:match");
check("a flavored pack on an Original day", states(T.checkFirstPack({ ...REC, product: "Rum Cake - Original" }, { product_name: "Coconut Rum Cake" }))[0], "flavor:mismatch");
check("lot codes compare without case or spaces", states(T.checkFirstPack({ ...REC, lot: "a-6283" }, { lot_code: "A 6283" }))[1], "lot:match");
check("a date that cannot be read as one needs a look", states(T.checkFirstPack(REC, { best_by: "27283" }))[2], "best_by:check");

const digitsOnly = T.checkFirstPack(REC, { product_name: "Pumpkin Spice Rum Cake", lot_code: "6283", best_by: "OCT 2027", barcode: "850012345678" });
check("printed digits agree but the bars were not scanned", states(digitsOnly)[3], "barcode:check");
check("...so it is not yet a full match", T.packVerdict(digitsOnly), "incomplete");

const noNumber = T.checkFirstPack({ ...REC, barcode: "" }, { product_name: "Pumpkin Spice Rum Cake", lot_code: "6283", best_by: "OCT 2027", decodedBarcode: "850012345678" });
check("no number on the formula sheet: the bar code is not judged", states(noNumber)[3], "barcode:skipped");
check("...and does not hold the answer back", T.packVerdict(noNumber), "match");
check("an empty record is skipped, not failed", states(T.checkFirstPack({ product: "", lot: "", bakeDate: "" }, { product_name: "Rum Cake", lot_code: "6283", best_by: "Oct 2027" })).slice(0, 3), ["flavor:skipped", "lot:skipped", "best_by:skipped"]);

// ---- the formula sheet's number (entries newest first)
const sheets = [
  { product_name: "Rum Cake - Pumpkin Spice", barcode_number: "" },
  { product_name: "Rum Cake - Original", barcode_number: "8 50012 00001 1" },
  { product_name: "rum cake pumpkin spice", barcode_number: "850012345678" },
  { product_name: "Rum Cake - Pumpkin Spice", barcode_number: "111" },
];
check("the newest sheet of the product that states one", T.productBarcode(sheets, "Rum Cake - Pumpkin Spice"), "850012345678");
check("another product's number is never borrowed", [T.productBarcode(sheets, "Rum Cake - Coconut"), T.productBarcode(sheets, "")], ["", ""]);

// ---- the form it runs on
const schema = { sections: [{ id: "lot", fields: [{ id: "product" }, { id: "lot_code" }, { id: "bake_date" }] },
  { id: "packing", fields: [{ id: "code_check", options: ["Matches the lot code above", "Did not match - held on FRM-702"] }, { id: "code_checked_by" }] }] };
check("ready on the form as issued", T.firstPackReady(schema), true);
const renamed = JSON.parse(JSON.stringify(schema)); renamed.sections[1].fields[0].options[0] = "Matches";
check("not on a revision whose answer reads differently", [T.firstPackReady(renamed), T.firstPackReady(null)], [false, false]);

rmSync(out, { recursive: true, force: true });
console.log(failures ? `${failures} of ${cases} cases failed` : `all ${cases} cases passed`);
process.exit(failures ? 1 : 0);
