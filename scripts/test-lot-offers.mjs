// Tests for src/lib/lotOffers.ts - the lots offered under "Lot on the container" while mixing.
// The receipts below are the real receiving log lines of 2026-09 / 2026-10, names as typed.
//
//   node scripts/test-lot-offers.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "lotoffers-"));
const file = join(out, "lotOffers.mjs");
execFileSync("npx", ["esbuild", "src/lib/lotOffers.ts", "--bundle", "--format=esm", `--outfile=${file}`, "--log-level=error"],
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

const rc = (material, brand, lot, date, supplier = "") => ({ material, brand, lot, date, supplier });
const RECEIPTS = [
  rc("CREME CAKE BASE INPLT 20104", "Pillsbury", "2216 MR 02041 1524", "2026-10-19"),
  rc("SALAD OIL 100% PURE SOYBEAN OIL", "SUPERCHEF", "16:16 LINE B", "2026-10-19"),
  rc("PAN SPRAY Oil Based MULTI-PURPOSE", "CHEF'S QUALITY", "2179624420 L6 16:35", "2026-10-19"),
  rc("PURE CANE FINE GRANULATED SUGAR", "Imperial Sugar", "CL M26189 B UMK 22:25", "2026-10-19"),
  rc("Liquid Whole Eggs", "JAMES FARM", "61620 277-6", "2026-10-19"),
  rc("Liquid Whole Eggs With Citric Acid to Preserve Color Pasteurized Homogenized", "JAMES FARM", "G1620 265-6", "2026-10-19"),
  rc("HI-R BAKED ALL-PURPOSE FLOUR", "Gold Medal", "05AUG6 KC 7 16:05", "2026-10-12"),
  rc("Rum delivered in bulk", "Lugo's Craft Spirits", "005", "2026-10-08"),
  rc("SOYBEAN OIL 100% PURE", "CHEF'S QUALITY", "082526 E001", "2026-09-21"),
  rc("Liquid whole egg.", "", "6215N", "2026-09-17", "Sysco"),
  rc("CREME CAKE BASE", "", "10MAY6 MR 0047 1 11418", "2026-03-01", "Pillsbury"),
];
const TODAY = "2026-10-23";
const lots = offers => offers.map(o => `${o.kind}:${o.lot}`);
const offer = (ingredient, brand, used = []) => L.lotOffers({ ingredient, brand }, used, RECEIPTS, { today: TODAY, self: "me" });

// ---- the words of a name
check("packaging words, numbers and plurals", [...L.nameWords("Liquid Eggs (30 lb jug)")], ["liquid", "egg"]);
check("as typed at receiving", [...L.nameWords("SALAD OIL 100% PURE SOYBEAN OIL")], ["salad", "oil", "soybean"]);

// ---- received, ranked by shared words
check("soybean oil finds both soybean oil deliveries, then the oil spray", lots(offer("Soybean Oil (35 lb jug)", "Sysco Classic")),
  ["received:16:16 LINE B", "received:082526 E001", "received:2179624420 L6 16:35"]);
check("eggs find the egg deliveries, the Sysco one first for a Sysco formula line", lots(offer("Liquid Eggs (30 lb jug)", "Sysco")),
  ["received:6215N", "received:61620 277-6", "received:G1620 265-6"]);
check("cake mix finds the creme cake base still within six months", lots(offer("Pillsbury Creme Cake Mix (50 lb bag)", "Pillsbury")),
  ["received:2216 MR 02041 1524"]);
check("pan release finds the pan spray first", lots(offer("Pan release spray (contains soy)", "Vegalene"))[0], "received:2179624420 L6 16:35");
check("rum", lots(offer("Rum", "Lugo's Craft Spirits, LLC")), ["received:005"]);
check("water was never received", lots(offer("Water", "")), []);
check("a received offer says what and from whom", offer("Rum", "")[0], { lot: "005", kind: "received", date: "2026-10-08", material: "Rum delivered in bulk", brand: "Lugo's Craft Spirits" });
check("the supplier stands in for a missing brand", offer("Liquid Eggs (30 lb jug)", "Sysco")[0].brand, "Sysco");

// ---- used before, first
const used = [
  { lot: "61620 277-6", ingredient: "Liquid Eggs (30 lb jug)", brand: "Sysco", date: "2026-10-20", entryId: "a" },
  { lot: "OLD-1", ingredient: "Liquid Eggs (30 lb jug)", brand: "Sysco", date: "2026-10-01", entryId: "b" },
  { lot: "THIS-ONE", ingredient: "Liquid Eggs (30 lb jug)", brand: "Sysco", date: "2026-10-23", entryId: "me" },
  { lot: "X", ingredient: "Flour", brand: "", date: "2026-10-22", entryId: "c" },
  { lot: "", ingredient: "Liquid Eggs (30 lb jug)", brand: "Sysco", date: "2026-10-22", entryId: "d" },
];
check("used before comes first, newest first; this record and blanks left out; a lot is offered once",
  lots(offer("Liquid Eggs (30 lb jug)", "Sysco", used)),
  ["used:61620 277-6", "used:OLD-1", "received:6215N", "received:G1620 265-6"]);
check("used before is the same ingredient by name only", lots(offer("Flour", "", used)), ["used:X", "received:05AUG6 KC 7 16:05"]);
check("a lot written differently is the same lot, offered once", lots(L.lotOffers({ ingredient: "Rum", brand: "" },
  [{ lot: "0-05", ingredient: "rum", brand: "", date: "2026-10-20", entryId: "a" }], RECEIPTS, { today: TODAY })), ["used:0-05"]);
check("the number offered is capped", L.lotOffers({ ingredient: "Oil", brand: "" }, [], RECEIPTS, { today: TODAY, maxReceived: 2 }).length, 2);

rmSync(out, { recursive: true, force: true });
console.log(failures ? `${failures} of ${cases} cases failed` : `all ${cases} cases passed`);
process.exit(failures ? 1 : 0);
