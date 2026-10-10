// Tests for src/lib/ccpDeviations.ts - Section 3 of the two CCP records worked out from the
// record's own oven loads (FRM-507) and seal checks (FRM-606).
//
//   node scripts/test-ccp-deviations.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "ccpdev-"));
async function bundle(src, name) {
  const file = join(out, name);
  execFileSync("npx", ["esbuild", src, "--bundle", "--format=esm", `--outfile=${file}`, "--log-level=error"],
    { stdio: ["ignore", "ignore", "inherit"], shell: true });
  return import("file://" + file.replace(/\\/g, "/"));
}
const D = await bundle("src/lib/ccpDeviations.ts", "dev.mjs");
const F = await bundle("src/lib/formSchema.ts", "schema.mjs");
const S507 = JSON.parse(readFileSync("sop-drafts/FRM-507-ccp1-baking-monitoring-schema.json", "utf8"));
const S606 = JSON.parse(readFileSync("sop-drafts/FRM-606-ccp2-vacuum-sealing-monitoring-schema.json", "utf8"));

let failures = 0, cases = 0;
function check(name, actual, expected) {
  cases++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) return;
  failures++;
  console.error(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`);
}
const ok = (name, cond, detail) => check(name, !!cond || detail, true);

// ---- the set-up is tied to the real forms
const B = D.deviationFormFor("FRM-507", S507), C = D.deviationFormFor("FRM-606", S606);
ok("FRM-507 as filed is recognised", B && B.form === "FRM-507");
ok("FRM-606 as filed is recognised", C && C.form === "FRM-606");
check("another form, or none", [D.deviationFormFor("FRM-903", S507), D.deviationFormFor(null, S507), D.deviationFormFor("FRM-507", null)], [null, null, null]);
check("an option reworded on the form: nothing is derived", D.deviationFormFor("FRM-507", JSON.parse(JSON.stringify(S507).replace("None - every load met the limits", "No deviations"))), null);
const optionsOf = (schema) => schema.sections.flatMap(s => s.fields).find(f => f.id === "deviations_today");
check("the options the app writes are the form's own", [optionsOf(S507).options.includes(B.none), optionsOf(S507).options.includes(B.yes), optionsOf(S606).options.includes(C.none), optionsOf(S606).options.includes(C.yes)], [true, true, true, true]);

// ---- FRM-507
const PS = "Rum Cake - Pumpkin Spice", OR = "Rum Cake - Original";
const load = (time, product, temp, min, verdict, extra = {}) => ({ time_out: time, product, lot_code: "6283", oven_temp: String(temp), bake_time: String(min), within_limits: verdict, ...extra });
const run = (cfg, values) => D.deriveDeviations(cfg, values);

check("no loads yet: nothing is said", run(B, { oven_loads: [{ time_out: "09:00" }], deviations_today: "" }).changed, false);
const clean = run(B, { oven_loads: [load("09:00", PS, 350, 27, "pass"), load("09:40", OR, 352, 28, "pass")], deviations_today: "", deviation_log: [] });
check("every load passed: None, no lines", [clean.changed, clean.values.deviations_today, clean.values.deviation_log], [true, B.none, []]);
check("run again: nothing changes", run(B, clean.values).changed, false);
ok("the same object comes back when nothing changes", run(B, clean.values).values === clean.values);

const oneFail = run(B, { ...clean.values, oven_loads: [...clean.values.oven_loads, load("10:20", PS, 340, 20, "fail")] });
check("a failed load: Yes", oneFail.values.deviations_today, B.yes);
check("and one line saying what was out of limit", oneFail.values.deviation_log.map(r => [r.lot_code, r.what, r.action ?? "", r.reference ?? ""]),
  [["6283", "Rum Cake - Pumpkin Spice, out at 10:20: oven temperature 340°F, below the 350°F limit; bake time 20 min, under the 27-minute limit", "", ""]]);
check("idempotent with a line", run(B, oneFail.values).changed, false);
const probe = run(B, { oven_loads: [load("11:00", OR, 350, 27, "fail", { internal_temp: "170" })] });
ok("a probe below 180 is named", /internal temperature 170°F, below the 180°F limit/.test(probe.values.deviation_log[0].what), probe.values.deviation_log);
const said = run(B, { oven_loads: [load("11:00", OR, 355, 28, "fail")] });
ok("a Fail the numbers do not explain says so", /recorded as Fail by the operator/.test(said.values.deviation_log[0].what), said.values.deviation_log);

// A reading corrected: the app's wording follows while nobody has touched it.
const corrected = run(B, { ...oneFail.values, oven_loads: oneFail.values.oven_loads.map(r => (r.time_out === "10:20" ? { ...r, bake_time: "27" } : r)) });
ok("the wording follows a corrected reading", corrected.changed && /340°F/.test(corrected.values.deviation_log[0].what) && !/bake time/.test(corrected.values.deviation_log[0].what), corrected.values.deviation_log);
// A person fills in the action: the line stays theirs in every respect that matters.
const actioned = { ...oneFail.values, deviation_log: [{ ...oneFail.values.deviation_log[0], action: "Rebaked - full cycle", reference: "FRM-007 #12" }] };
check("an action typed in is left alone", run(B, actioned).changed, false);
const reworded = { ...oneFail.values, deviation_log: [{ ...oneFail.values.deviation_log[0], what: "Oven door left open during the bake" }] };
const afterReword = run(B, { ...reworded, oven_loads: reworded.oven_loads.map(r => (r.time_out === "10:20" ? { ...r, oven_temp: "330" } : r)) });
check("wording a person changed is never replaced", afterReword.values.deviation_log[0].what, "Oven door left open during the bake");

// The load turns out to have passed.
const fixedLoads = oneFail.values.oven_loads.map(r => (r.time_out === "10:20" ? { ...r, oven_temp: "350", bake_time: "27", within_limits: "pass" } : r));
const fixed = run(B, { ...oneFail.values, oven_loads: fixedLoads });
check("a load corrected to Pass: its untouched line goes and the answer returns to None", [fixed.values.deviation_log, fixed.values.deviations_today], [[], B.none]);
const fixedButActioned = run(B, { ...actioned, oven_loads: fixedLoads });
check("...but a line somebody acted on is kept, and so is Yes", [fixedButActioned.values.deviation_log.length, fixedButActioned.values.deviations_today], [1, B.yes]);

// A person's own entries.
const manual = { oven_loads: [load("09:00", PS, 350, 27, "pass")], deviations_today: B.yes, deviation_log: [{ lot_code: "6283", what: "Timer found faulty after the run", action: "Held on FRM-702" }] };
check("a deviation written by hand stands, with its Yes", run(B, manual).changed, false);
const personYes = { oven_loads: [load("09:00", PS, 350, 27, "pass")], deviations_today: B.yes, deviation_log: [] };
check("a Yes a person chose is not turned back by the app", run(B, personYes).changed, false);
const twoSame = run(B, { oven_loads: [load("10:20", PS, 340, 27, "fail"), load("10:20", PS, 345, 27, "fail")] });
check("two failed loads at the same minute are two lines", twoSame.values.deviation_log.map(r => r._src), ["10:20|rum cake - pumpkin spice|6283", "10:20|rum cake - pumpkin spice|6283#2"]);
const twoFlavors = run(B, { oven_loads: [load("10:20", PS, 340, 27, "fail"), load("10:25", OR, 350, 20, "fail"), load("10:30", OR, 350, 27, "pass")] });
check("two flavors on one record: a line each", twoFlavors.values.deviation_log.map(r => r.what.split(",")[0]), [PS, OR]);
ok("the values passed in are not changed", !("deviation_log" in { oven_loads: [] }) && oneFail.values !== clean.values && clean.values.deviation_log.length === 0);

const born = run(B, { oven_loads: [load("10:20", PS, 340, 27, "fail")], deviations_today: "", deviation_log: [{ lot_code: "", what: "", action: "", reference: "" }] });
check("the empty line a new entry is born with gives way to the first deviation", born.values.deviation_log.map(r => r.lot_code), ["6283"]);
const bornClean = run(B, { oven_loads: [load("10:20", PS, 350, 27, "pass")], deviations_today: "", deviation_log: [{ lot_code: "", what: "", action: "", reference: "" }] });
check("...and is left as it is on a clean day", [bornClean.values.deviations_today, bornClean.values.deviation_log.length], [B.none, 1]);

// ---- what stops a submit
check("agreeing record: no problem", D.deviationProblems(B, clean.values), []);
check("a failed load with its line: no problem here (the action is the form's own required column)", D.deviationProblems(B, oneFail.values), []);
ok("Fail on the loads, None in Section 3", /recorded as Fail/.test(D.deviationProblems(B, { ...oneFail.values, deviations_today: B.none, deviation_log: oneFail.values.deviation_log })[0] ?? ""));
ok("a failed load with no line", /Each failed row needs its own line/.test(D.deviationProblems(B, { ...oneFail.values, deviation_log: [] }).join(" ")));
ok("Yes with nothing listed", /no deviation is listed/.test(D.deviationProblems(B, personYes)[0] ?? ""));

// ---- FRM-606
const chk = (time, check, visual, pull, extra = {}) => ({ time, check, visual, pull_test: pull, ...extra });
const sealClean = run(C, { seal_checks: [chk("09:00", "Set-up", "pass", ""), chk("11:00", "At boxing", "", "pass")], deviations_today: "", deviation_log: [] });
check("every check passed: None", [sealClean.values.deviations_today, sealClean.values.deviation_log], [C.none, []]);
const sealFail = run(C, { ...sealClean.values, seal_checks: [...sealClean.values.seal_checks, chk("11:30", "At boxing", "fail", "fail"), chk("11:40", "In process", "fail", "")] });
check("failed checks: Yes, a line each with its time", [sealFail.values.deviations_today, sealFail.values.deviation_log.map(r => [r.time, r.what])],
  [C.yes, [["11:30", "At boxing: visual check failed; pull test failed"], ["11:40", "In process: visual check failed"]]]);
check("idempotent", run(C, sealFail.values).changed, false);
check("a row with no result yet says nothing", run(C, { seal_checks: [{ time: "09:00", check: "" }], deviations_today: "" }).changed, false);

// ---- into the real forms: the lines validate as the form's own rows, and the section stays shut on a clean day
const section3 = S507.sections.find(s => s.id === "deviation");
ok("Section 3 is collapsed on the form", section3.collapsed === true);
check("a derived None does not open the section; a deviation does",
  [F.sectionHasAnswers(section3, clean.values), F.sectionHasAnswers(section3, oneFail.values)], [false, true]);
const seal3 = S606.sections.find(s => s.id === "deviation");
check("the same on FRM-606", [F.sectionHasAnswers(seal3, sealClean.values), F.sectionHasAnswers(seal3, sealFail.values)], [false, true]);
const zod = F.buildZodSchema(S507);
const issues = (values) => { const r = zod.safeParse({ ...F.emptyValues(S507), ...values }); return r.success ? [] : r.error.issues.map(i => i.path.join(".")); };
ok("a failed load's line without an action blocks Submit on the form's own rule", issues(oneFail.values).some(p => /^deviation_log\.0\.action$/.test(p)), issues(oneFail.values));
ok("with the action given, Section 3 raises nothing", !issues(actioned).some(p => p.startsWith("deviation")), issues(actioned));

rmSync(out, { recursive: true, force: true });
if (failures) {
  console.error(`\n${failures} of ${cases} cases failed`);
  process.exit(1);
}
console.log(`ccp deviations: ${cases} checks passed`);
