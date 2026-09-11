// Tests for src/lib/voiceCommands.ts - the parser that turns one spoken line into a CCP record row.
//
// Run from the repo root:  node scripts/test-voice-commands.mjs
//
// The first block is the one that matters most: every command's printed example is fed back through
// the parser. The wall card and the parser come from the same registry, and this is what proves they
// still agree. The rest covers what speech recognition actually does to the words, the pass/fail rule,
// and putting a row into the real FRM-507 / FRM-606 schemas.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "voicecmd-"));

// shell:true because on Windows the bin is a .cmd shim, which spawnSync refuses to exec directly.
function bundle(src, name) {
  const file = join(out, name);
  execFileSync("npx", ["esbuild", src, "--bundle", "--format=esm", `--outfile=${file}`],
    { stdio: ["ignore", "ignore", "inherit"], shell: true });
  return import("file://" + file.replace(/\\/g, "/"));
}

const V = await bundle("src/lib/voiceCommands.ts", "voice.mjs");
const F = await bundle("src/lib/formSchema.ts", "schema.mjs");
const S507 = JSON.parse(readFileSync("sop-drafts/FRM-507-ccp1-baking-monitoring-schema.json", "utf8"));
const S606 = JSON.parse(readFileSync("sop-drafts/FRM-606-ccp2-vacuum-sealing-monitoring-schema.json", "utf8"));

let failed = 0;
let passed = 0;
function check(cond, label, detail) {
  if (cond) { passed++; return; }
  failed++;
  console.log(`  FAIL ${label}${detail !== undefined ? `\n       got: ${JSON.stringify(detail)}` : ""}`);
}

const AT = new Date(2026, 8, 11, 10, 40); // 11 Sep 2026 10:40 local
const bake = (tail, head = "Create a CCP Baking Record for Product Your Product, Lot L0911-1, ") => V.parseCommand(head + tail, AT);
const seal = (tail, head = "Create a CCP Sealing Record for Product Your Product, Lot L0911-1, ") => V.parseCommand(head + tail, AT);

// ── 1. The printed card round-trips ───────────────────────────────────────────
for (const def of V.VOICE_COMMANDS) {
  const r = V.parseCommand(V.renderExample(def), AT);
  check(r.ok, `${def.id}: its own card example parses`, r);
  check(r.ok && r.def.id === def.id, `${def.id}: the example selects its own command`);
  check(r.ok && r.fill.formNumber === def.formNumber, `${def.id}: form number`);
  check(V.renderScript(def).includes("<Lot number>"), `${def.id}: script shows placeholders`);
  check(!/rum|cake|bahama/i.test(V.renderScript(def) + V.renderExample(def)), `${def.id}: card names no product or customer`);
}
{
  const r = V.parseCommand(V.renderExample(V.VOICE_COMMANDS[0]), AT);
  check(r.ok && r.fill.entryFields.product === "Your Product", "ccp1 example: product", r.ok && r.fill.entryFields);
  check(r.ok && r.fill.row.lot_code === "L0911-1", "ccp1 example: lot", r.ok && r.fill.row);
  check(r.ok && r.fill.row.oven_temp === "350" && r.fill.row.bake_time === "27", "ccp1 example: numbers as strings", r.ok && r.fill.row);
  check(r.ok && r.fill.row.within_limits === "pass", "ccp1 example: pass");
  check(r.ok && r.fill.row.time_out === "10:40", "ccp1 example: time is when spoken", r.ok && r.fill.row);
  check(r.ok && r.fill.productionDate === "2026-09-11", "ccp1 example: production date");
  check(r.ok && !("internal_temp" in r.fill.row), "ccp1: internal temp never filled by voice");
}
{
  const r = V.parseCommand(V.renderExample(V.VOICE_COMMANDS[1]), AT);
  check(r.ok && r.fill.row.check === "Hourly" && r.fill.row.vacuum_reading === "27"
    && r.fill.row.visual === "pass" && r.fill.row.pull_test === "pass", "ccp2 example: row", r.ok && r.fill.row);
}

// ── 2. Numbers as speech recognition writes them ───────────────────────────────
const nums = [
  ["Temperature 350 degrees for 27 minutes. Passed.", "350", "27"],
  ["Temperature 350°F for 27 minutes", "350", "27"],
  ["temperature 3:50 for 27 minutes passed", "350", "27"],
  ["temperature three fifty for twenty seven minutes passed", "350", "27"],
  ["temperature three hundred and fifty for twenty-seven minutes", "350", "27"],
  ["temperature 350 4 27 minutes passed", "350", "27"],
  ["temperature 350 27 minutes", "350", "27"],
  ["temperature 350 for 27.5 minutes", "350", "27.5"],
  ["temperature 350 for twenty seven and a half minutes", "350", "27.5"],
  ["temperature 355 for twenty seven point five mins", "355", "27.5"],
  ["oven temperature three fifty five for thirty minutes", "355", "30"],
];
for (const [tail, t, m] of nums) {
  const r = bake(tail);
  check(r.ok && r.fill.row.oven_temp === t && r.fill.row.bake_time === m, `numbers: "${tail}"`, r.ok ? r.fill.row : r);
}

// ── 3. Lot codes and the product/lot boundary ─────────────────────────────────
const lots = [
  ["create a ccp baking record for product your product lot L zero nine one one dash one temperature 350 for 27 minutes passed", "L0911-1"],
  ["create a ccp baking record for product your product lot number 4 5 6 temperature 350 for 27 minutes", "456"],
  ["create a ccp baking record for product your product batch el 0911 hyphen 1 temperature 350 for 27 minutes", "L0911-1"],
  ["create a ccp baking record for product your product lot code bravo double seven temperature 350 for 27 minutes", "B77"],
];
for (const [line, want] of lots) {
  const r = V.parseCommand(line, AT);
  check(r.ok && r.fill.row.lot_code === want, `lot: "${line.slice(40)}"`, r.ok ? r.fill.row.lot_code : r);
}
{
  const r = V.parseCommand("Create a CCP Baking Record for Product Big Lot Loaf, Lot 77, Temperature 350 for 27 minutes", AT);
  check(r.ok && r.fill.entryFields.product === "Big Lot Loaf" && r.fill.row.lot_code === "77", "product name containing 'lot'", r.ok ? [r.fill.entryFields, r.fill.row.lot_code] : r);
  const r2 = V.parseCommand("create a ccp baking record for product sample loaf lot 12 temperature 350 for 27 minutes", AT);
  check(r2.ok && r2.fill.entryFields.product === "Sample Loaf", "lower-case product is title-cased", r2.ok && r2.fill.entryFields);
}

// ── 4. The pass/fail rule ──────────────────────────────────────────────────────
{
  const past = bake("Temperature 350 for 27 minutes. Past.");
  check(past.ok && past.fill.row.within_limits === "pass", "'past' is heard as passed");
  const none = bake("Temperature 350 for 27 minutes");
  check(none.ok && none.fill.row.within_limits === "pass", "no result word: the numbers decide");
  const low = bake("Temperature 349 for 27 minutes. Passed.");
  check(low.ok && low.fill.row.within_limits === "fail", "349°F is a fail");
  check(low.ok && low.fill.warnings.some(w => w.level === "fail" && w.section === "deviation" && /You said Passed/.test(w.text)), "spoken Passed at 349: warning names it", low.ok && low.fill.warnings);
  const short = bake("Temperature 350 for 26.5 minutes");
  check(short.ok && short.fill.row.within_limits === "fail", "26.5 minutes is a fail");
  const hot = bake("Temperature 340 for 30 minutes. Passed.");
  check(hot.ok && hot.fill.row.within_limits === "fail" && hot.fill.summary.some(s => s.label === "Oven temperature" && s.flag === "fail"), "340°F spoken Passed is a fail");
  const saidFail = bake("Temperature 350 for 27 minutes. Failed.");
  check(saidFail.ok && saidFail.fill.row.within_limits === "fail", "a spoken Failed is never upgraded to pass");
  check(saidFail.ok && saidFail.fill.warnings.some(w => w.level === "fail" && /You said Failed/.test(w.text)), "spoken Failed within limits: warning asks for a note");
  check(V.judgeBake(350, 27) && !V.judgeBake(349.9, 27) && !V.judgeBake(350, 26.9), "judgeBake boundaries");
}

// ── 5. What was not heard ──────────────────────────────────────────────────────
{
  const noLot = V.parseCommand("Create a CCP Baking Record for Product Your Product, Temperature 350 for 27 minutes", AT);
  check(!noLot.ok && noLot.reason === "missing" && noLot.missing.join() === "lot" && /Lot number/.test(noLot.message), "missing lot is named", noLot);
  const noMin = bake("Temperature 350");
  check(!noMin.ok && noMin.missing.includes("minutes") && /Bake time/.test(noMin.message), "missing bake time is named", noMin);
  const many = V.parseCommand("Create a CCP Baking Record for Product Your Product", AT);
  check(!many.ok && many.missing.length === 3 && / and /.test(many.message), "several missing pieces listed", many);
  const nonsense = V.parseCommand("what time is lunch", AT);
  check(!nonsense.ok && nonsense.reason === "no_command", "nonsense is no_command", nonsense);
  const tooCold = bake("Temperature 35 for 27 minutes");
  check(!tooCold.ok && tooCold.reason === "bad_value" && /35/.test(tooCold.message), "35°F is an unbelievable reading, not a fail", tooCold);
  const making = V.parseCommand("create a ccp making record for product your product lot 12 temperature 350 for 27 minutes", AT);
  check(making.ok && making.def.id === "ccp1_bake", "'making record' still matches baking by its keywords", making);
}

// ── 6. Alternatives ────────────────────────────────────────────────────────────
{
  const r = V.parseAlternatives(["create a ccp baking record for product your", V.renderExample(V.VOICE_COMMANDS[0])], AT);
  check(r.ok, "a later alternative that parses wins", r);
  const best = V.parseAlternatives(["hello there", "create a ccp baking record for product your product lot L1 temperature 350"], AT);
  check(!best.ok && best.reason === "missing" && best.def?.id === "ccp1_bake", "best partial is reported, not no_command", best);
}

// ── 7. CCP 2 phrasing ──────────────────────────────────────────────────────────
{
  const setup = seal("set-up, Vacuum twenty seven point five inches, Visual passed, pool test passed");
  check(setup.ok && setup.fill.row.check === "Set-up" && setup.fill.row.vacuum_reading === "27.5" && setup.fill.row.pull_test === "pass", "set-up / 27.5 / pool test", setup.ok ? setup.fill.row : setup);
  const adj = seal("after adjustment, Vacuum 26 inches, Visual passed, Pull test passed");
  check(adj.ok && adj.fill.row.check === "After a change or adjustment", "after adjustment", adj.ok ? adj.fill.row : adj);
  const end = seal("end of the run, Vacuum 26 inches, Visual passed, Pull test passed");
  check(end.ok && end.fill.row.check === "End of run", "end of the run", end.ok ? end.fill.row : end);
  const noCheck = seal("Vacuum 26 inches, Visual passed, Pull test passed");
  check(noCheck.ok && !("check" in noCheck.fill.row) && noCheck.fill.warnings.some(w => /check type/.test(w.text)), "no check type: left blank with a warning", noCheck.ok ? noCheck.fill : noCheck);
  const high = seal("Hourly, Vacuum 31 inches, Visual passed, Pull test passed");
  check(high.ok && high.fill.warnings.some(w => /misheard/.test(w.text)), "31 in. Hg is flagged", high.ok && high.fill.warnings);
  const visFail = seal("Hourly, Vacuum 27 inches, Visual failed, Pull test passed");
  check(visFail.ok && visFail.fill.row.visual === "fail" && visFail.fill.warnings.some(w => w.level === "fail" && w.section === "deviation" && /^The visual check failed/.test(w.text)), "visual fail sends to Section 3", visFail.ok && visFail.fill.warnings);
  const noPull = seal("Hourly, Vacuum 27 inches, Visual passed");
  check(!noPull.ok && noPull.missing.includes("pull") && /Pull test/.test(noPull.message), "missing pull test is named", noPull);
  const vacGauge = seal("Hourly, Vacuum 27 in. Hg, Visual passed, Pull test passed");
  check(vacGauge.ok && vacGauge.fill.row.vacuum_reading === "27", "'in. Hg' is inches", vacGauge.ok ? vacGauge.fill.row : vacGauge);
}

// ── 8. Putting the row into the real schemas ───────────────────────────────────
{
  const fill = V.parseCommand(V.renderExample(V.VOICE_COMMANDS[0]), AT).fill;
  // A brand-new entry: one seeded row, stamped by the person who created it, at creation time.
  const fresh = { ...F.emptyValues(S507, { userInitials: "CR" }), production_date: "2026-09-11", product: "" };
  fresh.oven_loads[0].time_out = "07:05";
  const a = V.applyVoiceFill(S507, fresh, fill, { userInitials: "TP" });
  check(a.ok && a.rowIndex === 0 && !a.appended, "fills the seeded row instead of appending", a);
  check(a.ok && a.values.oven_loads.length === 1, "still one row");
  check(a.ok && a.values.oven_loads[0].time_out === "10:40", "the seeded row's creation time is overwritten", a.ok && a.values.oven_loads[0]);
  check(a.ok && a.values.oven_loads[0].initials === "TP", "initials are the person speaking", a.ok && a.values.oven_loads[0]);
  check(a.ok && a.values.product === "Your Product", "blank product is set");

  const b = V.applyVoiceFill(S507, a.values, fill, { userInitials: "TP" });
  check(b.ok && b.appended && b.rowIndex === 1 && b.values.oven_loads.length === 2, "a second line appends row 2", b);

  const same = V.applyVoiceFill(S507, { ...a.values, product: "YOUR PRODUCTS" }, fill, { userInitials: "TP" });
  check(same.ok && same.values.product === "YOUR PRODUCTS" && !same.warnings.some(w => /This record is for/.test(w.text)), "same product spelled differently: kept, no warning", same.ok && same.warnings);
  const other = V.applyVoiceFill(S507, { ...a.values, product: "Other Loaf" }, fill, { userInitials: "TP" });
  check(other.ok && other.values.product === "Other Loaf" && other.warnings.some(w => /This record is for "Other Loaf"/.test(w.text)), "different product: kept, with a warning", other.ok && other.warnings);
  const yesterday = V.applyVoiceFill(S507, { ...a.values, production_date: "2026-09-10" }, fill, { userInitials: "TP" });
  check(yesterday.ok && yesterday.values.production_date === "2026-09-10" && yesterday.warnings.some(w => /not today/.test(w.text)), "date never changed, mismatch warned");

  const noGrid = V.applyVoiceFill(S507, fresh, { ...fill, gridId: "nope" }, { userInitials: "TP" });
  check(!noGrid.ok && /no "nope" table/.test(noGrid.error), "unknown table refused", noGrid);
  const extra = V.applyVoiceFill(S507, fresh, { ...fill, row: { ...fill.row, bogus: "x" } }, { userInitials: "TP" });
  check(extra.ok && !("bogus" in extra.values.oven_loads[0]) && extra.warnings.some(w => /"bogus"/.test(w.text)), "unknown column dropped with a warning");

  check(V.limitsStillMatch(S507) === true, "FRM-507's printed limits match the parser");
  const moved = JSON.parse(JSON.stringify(S507).replace("At least 350°F", "At least 360°F"));
  check(V.limitsStillMatch(moved) === false, "changed limits are detected");
  const unjudged = V.applyVoiceFill(moved, fresh, fill, { userInitials: "TP" });
  check(unjudged.ok && unjudged.values.oven_loads[0].within_limits === "" && unjudged.warnings.some(w => /limits printed on this form have changed/.test(w.text)), "changed limits: pass/fail left blank", unjudged.ok && unjudged.values.oven_loads[0]);

  const fill2 = V.parseCommand(V.renderExample(V.VOICE_COMMANDS[1]), AT).fill;
  const fresh2 = { ...F.emptyValues(S606, { userInitials: "CR" }), production_date: "2026-09-11" };
  const c = V.applyVoiceFill(S606, fresh2, fill2, { userInitials: "TP" });
  check(c.ok && c.rowIndex === 0 && c.values.seal_checks[0].check === "Hourly" && c.values.seal_checks[0].initials === "TP" && c.values.seal_checks[0].time === "10:40", "FRM-606 row lands in the seeded row", c.ok && c.values.seal_checks[0]);

  // The filled entry must pass the form's own submit validation apart from what voice never fills.
  const zod = F.buildZodSchema(S507).safeParse(a.values);
  const gridIssues = zod.success ? [] : zod.error.issues.filter(i => String(i.path[0]) === "oven_loads");
  check(gridIssues.length === 0, "the voice row satisfies the grid's required columns", gridIssues);
}

console.log(failed ? `\n${failed} FAILED, ${passed} passed` : `\nALL ${passed} PASS`);
process.exit(failed ? 1 : 0);
