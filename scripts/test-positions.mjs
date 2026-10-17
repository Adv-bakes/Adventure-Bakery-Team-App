// Tests for src/lib/positions.ts - who holds each FSQM-004 position and who covers it.
//
//   node scripts/test-positions.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "positions-"));
const file = join(out, "positions.mjs");
execFileSync("npx", ["esbuild", "src/lib/positions.ts", "--bundle", "--format=esm", `--outfile=${file}`],
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

const G = { id: "g", name: "Gabriela Juncos-Mercer" };
const D = { id: "d", name: "Diana Samboni" };
const R = { id: "r", name: "Richard Mercer" };
const team = [G, D, R];
const held = [
  { user_id: "g", position: "senior_site_management" },
  { user_id: "g", position: "production_supervisor" },
  { user_id: "d", position: "production_operator" },
  { user_id: "d", position: "receiving" },
  { user_id: "r", position: "administration" },
  { user_id: "g", position: "maintenance" },
];
const row = (rows, key) => rows.find((r) => r.def.key === key);
const names = (ps) => ps.map((p) => p.name);

// ---- the designation
const entry = (id, status, submitted_at, data) => ({ id, status, submitted_at, data });
check("no FRM-005 entry, no designation", T.designationFrom([]), null);
check("a draft designates nobody", T.designationFrom([entry("a", "draft", null, { primary_name: "Gabriela Juncos-Mercer" })]), null);
check("the newest submitted entry is in force", T.designationFrom([
  entry("a", "submitted", "2026-01-01T00:00:00Z", { primary_name: "Old", substitute_name: "X" }),
  entry("b", "submitted", "2026-10-17T00:00:00Z", { primary_name: " Gabriela Juncos-Mercer ", substitute_name: "Diana Samboni", effective_date: "2026-10-17" }),
  entry("c", "draft", null, { primary_name: "Later draft" }),
]), { primary: "Gabriela Juncos-Mercer", substitute: "Diana Samboni", effectiveDate: "2026-10-17", responseId: "b" });

const cov = (rows, key, who) => {
  const c = row(rows, key).cover.byHolder.find((x) => x.holder.id === who);
  return c.contracted ? [c.contracted, c.via] : [names(c.people), c.via, ...(c.problem ? [c.problem] : [])];
};

// ---- one holder per position
const now = T.resolvePositions(held, team, null);
check("receiving is covered by the production supervisor", cov(now, "receiving", "d"), [["Gabriela Juncos-Mercer"], "Production Supervisor"]);
check("practitioners are blank until FRM-005 is submitted", names(row(now, "sqf_practitioner_primary").holders), []);
check("a vacant position has nobody to cover", row(now, "sqf_practitioner_primary").cover, { byHolder: [], vacant: true });
check("senior management has no cover without a primary practitioner", cov(now, "senior_site_management", "g"),
  [[], "No cover", "Nobody holds SQF Practitioner (primary)."]);
check("supervisor held by senior management: the cover is the same person", cov(now, "production_supervisor", "g"),
  [[], "No cover", "Senior Site Management is held by the same person, so it is not a cover."]);
check("a lone operator falls to the supervisor", cov(now, "production_operator", "d"), [["Gabriela Juncos-Mercer"], "Production Supervisor"]);
check("administration has no named cover", row(now, "administration").cover, null);
check("maintenance is covered by the contractor", cov(now, "maintenance", "g"),
  ["The contracted provider (Contract Services Register)", "Contracted"]);
check("substitute has no cover row", row(now, "sqf_practitioner_substitute").cover, null);

// ---- with a designation
const des = { primary: "Gabriela Juncos-Mercer", substitute: "Diana Samboni", effectiveDate: "2026-10-17", responseId: "b" };
const withDes = T.resolvePositions(held, team, des);
check("designated names link to team members", row(withDes, "sqf_practitioner_primary").holders, [G]);
check("primary covered by the substitute", cov(withDes, "sqf_practitioner_primary", "g"), [["Diana Samboni"], "SQF Practitioner (substitute)"]);
check("senior management is not covered by itself as practitioner", cov(withDes, "senior_site_management", "g"),
  [[], "No cover", "SQF Practitioner (primary) is held by the same person, so it is not a cover."]);
check("a designated name with no account is still shown", row(T.resolvePositions(held, team, { ...des, substitute: "Someone Else" }), "sqf_practitioner_substitute").holders,
  [{ id: null, name: "Someone Else" }]);

// ---- cover passes upward
const held2 = [
  { user_id: "g", position: "senior_site_management" },
  { user_id: "d", position: "production_supervisor" },
  { user_id: "d", position: "receiving" },
];
const up = T.resolvePositions(held2, team, null);
check("receiving held by the supervisor passes up to senior management", cov(up, "receiving", "d"),
  [["Gabriela Juncos-Mercer"], "Passed up to Senior Site Management", "Production Supervisor is held by the same person, so it is not a cover."]);
check("nobody in a position, nobody to cover", row(T.resolvePositions([], team, null), "receiving").cover, { byHolder: [], vacant: true });

// ---- shared positions (the site as entered on 2026-10-17: several people hold the same positions)
const shared = ["production_operator", "production_supervisor", "receiving"].flatMap((p) => ["d", "g", "r"].map((u) => ({ user_id: u, position: p })))
  .concat([{ user_id: "g", position: "senior_site_management" }, { user_id: "r", position: "senior_site_management" }]);
const sh = T.resolvePositions(shared, team, null);
check("co-holders cover each other, not 'no cover'", cov(sh, "receiving", "d"), [["Gabriela Juncos-Mercer", "Richard Mercer"], "Also holds this position"]);
check("operators cover each other", cov(sh, "production_operator", "g"), [["Diana Samboni", "Richard Mercer"], "Also holds this position"]);
check("two in senior management cover each other", cov(sh, "senior_site_management", "r"), [["Gabriela Juncos-Mercer"], "Also holds this position"]);
check("stands in for: names the person and the position", T.standsInFor(sh, D).map((x) => [x.def.key, names(x.for)]),
  [["production_supervisor", ["Gabriela Juncos-Mercer", "Richard Mercer"]], ["production_operator", ["Gabriela Juncos-Mercer", "Richard Mercer"]],
   ["receiving", ["Gabriela Juncos-Mercer", "Richard Mercer"]]]);
check("when away: who steps in for each position held", T.coverWhenAway(sh, D).map((x) => [x.def.key, names(x.cover.people)]),
  [["production_supervisor", ["Gabriela Juncos-Mercer", "Richard Mercer"]], ["production_operator", ["Gabriela Juncos-Mercer", "Richard Mercer"]],
   ["receiving", ["Gabriela Juncos-Mercer", "Richard Mercer"]]]);
check("positionsOf lists a person's positions", T.positionsOf(withDes, G).map((p) => p.key),
  ["senior_site_management", "sqf_practitioner_primary", "production_supervisor", "maintenance"]);

// ---- against the document
const fsqm004 = [
  "• Senior Site Management — accountable", "• SQF Practitioner, primary and substitute — owns", "• Production Supervisor — x",
  "• Production Operator and Floor Operator — make", "• Receiving / Goods-In — accepts", "• Administration — purchasing",
  "• Maintenance — simple", "Covered by the SQF Practitioner for day-to-day decisions only", "Covered by the substitute SQF Practitioner",
  "Covered by Senior Site Management.", "Covered by the other operator, or by the Production Supervisor.",
  "Covered by the Production Supervisor.", "Covered by the contracted provider.",
].join("\n");
check("matches FSQM-004 as issued", T.checkPositionsAgainstFsqm004(fsqm004), []);
check("a changed cover is noticed", T.checkPositionsAgainstFsqm004(fsqm004.replace("Covered by the Production Supervisor.", "Covered by Administration.")),
  ['FSQM-004 no longer says "Covered by the Production Supervisor".']);

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} of ${cases} failed`); process.exit(1); }
console.log(`${cases} cases passed`);
