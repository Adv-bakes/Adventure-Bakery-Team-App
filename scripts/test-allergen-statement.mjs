// Tests the Contains-statement -> major allergens mapping used by extract-package-label's
// "specification" mode (supabase/functions/_shared/allergenStatement.ts).
//
//   node scripts/test-allergen-statement.mjs
//
// These decide which allergen boxes FRM-207 ticks from a photographed pack, so a wrong answer here
// is a wrong allergen declaration. Add a case for every real label that surprises us.

import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "allergen-test-"));
const out = join(dir, "allergens.mjs");
await build({
  entryPoints: ["supabase/functions/_shared/allergenStatement.ts"],
  bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "error",
});
const { allergensFromContains, storageClass, MAJOR_ALLERGENS } = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`}`);
};
const names = s => allergensFromContains(s).allergens;

// The label that prompted this: Pillsbury Creme Cake Base, 50 lb.
eq("Pillsbury creme cake base", names("CONTAINS WHEAT, MILK, SOY AND EGG INGREDIENTS."), ["Milk", "Egg", "Wheat", "Soy"]);

eq("shellfish is not fish", names("Contains: shellfish (shrimp)."), ["Crustacean shellfish"]);
eq("fish by species", names("Contains: anchovy, wheat."), ["Wheat", "Fish"]);
eq("tree nut by name", names("Contains almonds and hazelnuts."), ["Tree nuts"]);
eq("peanut distinct from tree nut", names("CONTAINS PEANUTS."), ["Peanut"]);
eq("soybean / soya", names("Contains soybean. Contains soya lecithin."), ["Soy"]);
eq("eggs plural", names("Contains: Eggs, Milk"), ["Milk", "Egg"]);
eq("sesame", names("Contains sesame."), ["Sesame"]);
eq("buckwheat is not wheat (not a major allergen)", names("Contains buckwheat."), []);

eq("no statement -> nothing, with a warning", allergensFromContains("").allergens, []);
eq("no statement warns", allergensFromContains(undefined).warnings.length, 1);
eq("statement with nothing recognised warns", allergensFromContains("Contains: natural flavors").warnings.length, 1);
eq("coconut is flagged, not decided", [names("Contains: coconut"), allergensFromContains("Contains: coconut").warnings.length], [[], 2]);

eq("every canonical name is an FRM-207 option", MAJOR_ALLERGENS,
  ["Milk", "Egg", "Wheat", "Soy", "Peanut", "Tree nuts", "Sesame", "Fish", "Crustacean shellfish"]);

eq("storage: keep frozen", storageClass("KEEP FROZEN"), "Frozen");
eq("storage: refrigerate", storageClass("Keep refrigerated at or below 40°F"), "Chilled");
eq("storage: cool dry place", storageClass("Store in a cool, dry place"), "Ambient");
eq("storage: silence is not ambient", storageClass(""), undefined);
eq("storage: unrelated text", storageClass("Use Doughboy products everyday"), undefined);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
