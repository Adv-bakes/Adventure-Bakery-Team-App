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

// ---- today's shape: no practitioner designated
const now = T.resolvePositions(held, team, null);
check("receiving is covered by the production supervisor", [names(row(now, "receiving").cover.people), row(now, "receiving").cover.via],
  [["Gabriela Juncos-Mercer"], "Production Supervisor"]);
check("practitioners are blank until FRM-005 is submitted", names(row(now, "sqf_practitioner_primary").holders), []);
check("senior management has no cover without a primary practitioner",
  [row(now, "senior_site_management").cover.people, row(now, "senior_site_management").cover.problem],
  [[], "Nobody holds SQF Practitioner (primary)."]);
check("supervisor held by senior management: the cover is the same person, so none",
  [row(now, "production_supervisor").cover.people, row(now, "production_supervisor").cover.problem],
  [[], "Senior Site Management is held by the same person, so it is not a cover."]);
check("a lone operator falls to the supervisor", [names(row(now, "production_operator").cover.people), row(now, "production_operator").cover.via],
  [["Gabriela Juncos-Mercer"], "Production Supervisor"]);
check("administration has no named cover", row(now, "administration").cover, null);
check("maintenance is covered by the contractor", row(now, "maintenance").cover.contracted, "The contracted provider (Contract Services Register)");
check("substitute has no cover row", row(now, "sqf_practitioner_substitute").cover, null);

// ---- with a designation
const des = { primary: "Gabriela Juncos-Mercer", substitute: "Diana Samboni", effectiveDate: "2026-10-17", responseId: "b" };
const withDes = T.resolvePositions(held, team, des);
check("designated names link to team members", row(withDes, "sqf_practitioner_primary").holders, [G]);
check("primary covered by the substitute", names(row(withDes, "sqf_practitioner_primary").cover.people), ["Diana Samboni"]);
check("senior management covered by the practitioner - unless it is the same person",
  [row(withDes, "senior_site_management").cover.people, row(withDes, "senior_site_management").cover.via], [[], "No cover"]);
check("a designated name with no account is still shown", row(T.resolvePositions(held, team, { ...des, substitute: "Someone Else" }), "sqf_practitioner_substitute").holders,
  [{ id: null, name: "Someone Else" }]);

// ---- cover passes upward
const held2 = [
  { user_id: "g", position: "senior_site_management" },
  { user_id: "d", position: "production_supervisor" },
  { user_id: "d", position: "receiving" },
  { user_id: "r", position: "production_operator" },
  { user_id: "d", position: "production_operator" },
];
const up = T.resolvePositions(held2, team, null);
check("receiving held by the supervisor passes up to senior management",
  [names(up.find((r) => r.def.key === "receiving").cover.people), up.find((r) => r.def.key === "receiving").cover.via,
   up.find((r) => r.def.key === "receiving").cover.problem],
  [["Gabriela Juncos-Mercer"], "Passed up to Senior Site Management", "Production Supervisor is held by the same person, so it is not a cover."]);
check("two operators cover each other",
  [names(row(up, "production_operator").cover.people), row(up, "production_operator").cover.via], [["Diana Samboni", "Richard Mercer"], "Each other"]);
const ops = T.resolvePositions([{ user_id: "r", position: "production_operator" }, { user_id: "d", position: "production_operator" },
  { user_id: "g", position: "production_supervisor" }], team, null);
check("the other operator comes before the supervisor", row(ops, "production_operator").cover.via, "Each other");
check("nobody in a position, nobody to cover", row(T.resolvePositions([], team, null), "receiving").cover, { people: [], via: "Vacant" });
check("a vacant primary practitioner gets no cover", row(now, "sqf_practitioner_primary").cover.via, "Vacant");
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
