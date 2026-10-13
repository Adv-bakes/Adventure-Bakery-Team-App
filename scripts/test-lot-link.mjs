// Tests for the "Lot 6286" link beside a text field (TextField.lotLink, FRM-903's Product /
// batch run): appendLotText and hasLotText in src/lib/formSchema.ts.
//
//   node scripts/test-lot-link.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "lotlink-"));
const file = join(out, "formSchema.mjs");
execFileSync("npx", ["esbuild", "src/lib/formSchema.ts", "--bundle", "--format=esm", `--outfile=${file}`],
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

check("the lot of 2026-10-13", T.julianLotCode("2026-10-13"), "6286");
check("text gets a comma and the lot", T.appendLotText("Rum Cakes", "6286"), "Rum Cakes, Lot 6286");
check("empty field gets the lot alone", T.appendLotText("", "6286"), "Lot 6286");
check("blank value", T.appendLotText(undefined, "6286"), "Lot 6286");
check("only spaces", T.appendLotText("   ", "6286"), "Lot 6286");
check("trailing space tidied", T.appendLotText("Rum Cake ", "6286"), "Rum Cake, Lot 6286");
check("trailing comma tidied", T.appendLotText("Rum Cake, ", "6286"), "Rum Cake, Lot 6286");
check("not added twice", T.appendLotText("Rum Cake, Lot 6286", "6286"), "Rum Cake, Lot 6286");
check("another lot is kept", T.appendLotText("Rum Cake, Lot 6285", "6286"), "Rum Cake, Lot 6285, Lot 6286");
check("names the lot", T.hasLotText("Rum Cake, lot 6286", "6286"), true);
check("names the lot with #", T.hasLotText("Rum Cake Lot #6286", "6286"), true);
check("a longer number is another lot", T.hasLotText("Lot 62861", "6286"), false);
check("the bare number is not the lot", T.hasLotText("Batch 6286", "6286"), false);
check("empty", T.hasLotText("", "6286"), false);

rmSync(out, { recursive: true, force: true });
console.log(failures ? `${failures} of ${cases} failed` : `All ${cases} cases passed`);
process.exit(failures ? 1 : 0);
