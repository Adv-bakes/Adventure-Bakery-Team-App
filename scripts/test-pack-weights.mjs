// Tests for src/lib/packWeights.ts - the net-weight check weighed at packing (FRM-520 v2).
//
//   node scripts/test-pack-weights.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "packweights-"));
const file = join(out, "packWeights.mjs");
execFileSync("npx", ["esbuild", "src/lib/packWeights.ts", "--bundle", "--format=esm", `--outfile=${file}`, "--log-level=error"],
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

const v = (a, b, c, extra = {}) => ({ net_weight_declared: "4 oz (113g)", packaging_tare: 21, net_weight_unit: "g", pack_weight_1: a, pack_weight_2: b, pack_weight_3: c, ...extra });

// ---- the sum, said at once
check("the owner's packs: 162, 163, 170 g with 21 g of packaging", T.packWeights(v(162, 163, 170)),
  { state: "ok", net: { average: 144, declared: 113, unit: "g", ok: true }, text: "Average net weight 144 g, at or above the 113 g on the label." });
const low = T.packWeights(v(130, 131, 132));
check("a short weight is said, with what to do", [low.state, low.net.average, low.text],
  ["below", 110, "Average net weight 110 g is BELOW the 113 g on the label. Stop packing, hold the lot on FRM-702 and tell the SQF Practitioner."]);
check("exactly the label weight passes", T.packWeights(v(134, 134, 134)).state, "ok");
check("nothing is worked out until every figure is there", [T.packWeights(v(162, 163, "")).state, T.packWeights(v(162, 163, 170, { packaging_tare: "" })).state, T.packWeights(v(162, 163, 170, { net_weight_unit: "" })).state, T.packWeights({}).state],
  ["incomplete", "incomplete", "incomplete", "incomplete"]);
check("a label weight that cannot be read is said, not guessed", [T.packWeights(v(162, 163, 170, { net_weight_declared: "about 4 ounces or so" })).state, T.packWeights(v(162, 163, 0)).state], ["unreadable", "unreadable"]);
check("numbers typed as text are read", T.packWeights(v("162", "163", "170", { packaging_tare: "21" })).state, "ok");

// ---- on the record
check("weighed: all three", [T.packsWeighed(v(162, 163, 170)), T.packsWeighed(v(162, 163, "")), T.packsWeighed({}), T.packsWeighed(null)], [true, false, false, false]);

// ---- the form revision it needs, and the migration that adds it
const packing = ids => ({ sections: [{ id: "lot", fields: [] }, { id: "packing", fields: ids.map(id => ({ id })) }] });
const ALL = ["net_weight_declared", "packaging_tare", "net_weight_unit", "pack_weight_1", "pack_weight_2", "pack_weight_3"];
check("ready on the form's v2", T.packWeightsReady(packing(["pack_date", ...ALL, "packing_notes"])), true);
check("not on the revision before, nor with a field missing, nor with no form", [T.packWeightsReady(packing(["pack_date", "packing_notes"])), T.packWeightsReady(packing(ALL.slice(1))), T.packWeightsReady(null)], [false, false, false]);
{
  const sql = readFileSync("supabase/migrations/20261012000005_pack_weights_at_packing.sql", "utf8");
  const section = JSON.parse(/\$a2\$(.*?)\$a2\$/s.exec(sql)[1]);
  check("the migration's Packing section is ready", T.packWeightsReady({ sections: [section] }), true);
  const byId = Object.fromEntries(section.fields.map(f => [f.id, f]));
  check("...with every figure required", ALL.map(id => byId[id].required), ALL.map(() => true));
  check("...and Notes still last", section.fields[section.fields.length - 1].id, "packing_notes");
}

rmSync(out, { recursive: true, force: true });
console.log(failures ? `${failures} of ${cases} cases failed` : `all ${cases} cases passed`);
process.exit(failures ? 1 : 0);
