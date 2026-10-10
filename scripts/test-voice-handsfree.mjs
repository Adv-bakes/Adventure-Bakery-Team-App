// Tests for src/lib/voiceHandsFree.ts - "Form 606, air check passed" on an open FRM-606 entry.
//
// Run from the repo root:  node scripts/test-voice-handsfree.mjs
//
// What matters most here: nothing is recorded unless the trigger is in the sentence, a result that was
// not heard is never guessed, and Spanish and English give the same row.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "handsfree-"));
function bundle(src, name) {
  const file = join(out, name);
  execFileSync("npx", ["esbuild", src, "--bundle", "--format=esm", `--outfile=${file}`, "--log-level=error"],
    { stdio: ["ignore", "ignore", "inherit"], shell: true });
  return import("file://" + file.replace(/\\/g, "/"));
}
const H = await bundle("src/lib/voiceHandsFree.ts", "handsfree.mjs");
const F = await bundle("src/lib/formSchema.ts", "schema.mjs");
const V = await bundle("src/lib/voiceCommands.ts", "voice.mjs");
const S606 = JSON.parse(readFileSync("sop-drafts/FRM-606-ccp2-vacuum-sealing-monitoring-schema.json", "utf8"));

let failed = 0, passed = 0;
function check(cond, label, detail) {
  if (cond) { passed++; return; }
  failed++;
  console.log(`  FAIL ${label}${detail !== undefined ? `\n       got: ${JSON.stringify(detail)}` : ""}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const en = line => H.parseHandsFree([line], "en");
const es = line => H.parseHandsFree([line], "es");
const rowIs = (heard, want, label) => check(heard?.kind === "row" && same(heard.row, want), label, heard && (heard.row ?? heard.kind));

// ── 1. The lines on the card ──────────────────────────────────────────────────
rowIs(en("Form 606, air check passed"), { check: "In process", visual: "pass" }, "air check passed");
rowIs(en("Form 606, air check failed"), { check: "In process", visual: "fail" }, "air check failed");
rowIs(en("Form 606, set up, air check passed, vacuum 27"), { check: "Set-up", visual: "pass", vacuum_reading: "27" }, "set-up with the gauge");
rowIs(en("Form 606, after adjustment, air check passed"), { check: "After a change or adjustment", visual: "pass" }, "after adjustment");
rowIs(en("Form 606, end of run, air check passed"), { check: "End of run", visual: "pass" }, "end of run");
rowIs(en("Form 606, boxing check passed"), { check: "At boxing", visual: "pass" }, "boxing check");
rowIs(en("Form 606, pull test passed"), { check: "At boxing", pull_test: "pass" }, "pull test is an At boxing row");
rowIs(en("Form 606, pull test failed"), { check: "At boxing", pull_test: "fail" }, "pull test failed");
check(en("Form 606, undo")?.kind === "undo", "undo");

// ── 2. What the recogniser does to "Form 606" ─────────────────────────────────
for (const t of ["form 606", "Form six oh six", "form 6 0 6", "from 606", "form 60 6", "form six hundred six", "form number 606", "606",
  "4606", "4 606", "for 606", "four 606"]) {
  rowIs(en(`${t} air check passed`), { check: "In process", visual: "pass" }, `trigger: "${t}"`);
}
rowIs(en("okay so form 606 air check passed"), { check: "In process", visual: "pass" }, "words before the trigger are ignored");

// ── 3. No trigger, no row ─────────────────────────────────────────────────────
for (const t of ["air check passed", "the pull test passed", "form 607 air check passed", "we made 606 units and they passed", "undo", "",
  "4607 air check passed", "46060 air check passed", "we sealed 4 pouches and the air check passed"]) {
  check(en(t) === null, `ignored without the trigger: "${t}"`, en(t));
}

// ── 4. A result that was not heard is never guessed ───────────────────────────
for (const t of ["Form 606", "Form 606 air check", "Form 606 pull test", "Form 606 passed", "Form 606 air check passed vacuum ninety"]) {
  check(en(t)?.kind === "unclear", `unclear, not a row: "${t}"`, en(t));
}
rowIs(en("Form 606 air check not passed"), { check: "In process", visual: "fail" }, "negation is a fail");
rowIs(en("Form 606 pull test did not pass"), { check: "At boxing", pull_test: "fail" }, "'did not pass' is a fail");
rowIs(en("Form 606 air check past"), { check: "In process", visual: "pass" }, "'past' is heard for 'passed'");
rowIs(en("Form 606 pool test passed"), { check: "At boxing", pull_test: "pass" }, "'pool test' is heard for 'pull test'");

// ── 5. Spanish gives the same rows ────────────────────────────────────────────
const pairs = [
  ["Form 606, air check passed", "Formulario 606, revisión de aire aprobada"],
  ["Form 606, air check failed", "Formulario 606, revisión de aire rechazada"],
  ["Form 606, set up, air check passed, vacuum 27", "Formulario 606, arranque, revisión de aire aprobada, vacío 27"],
  ["Form 606, end of run, air check passed", "Formulario 606, fin de corrida, revisión de aire aprobada"],
  ["Form 606, boxing check passed", "Formulario 606, revisión de empaque aprobada"],
  ["Form 606, pull test passed", "Formulario 606, prueba de jalón aprobada"],
  ["Form 606, pull test failed", "Formulario 606, prueba de jalón rechazada"],
];
for (const [e, s] of pairs) {
  const a = en(e), b = es(s);
  check(a?.kind === "row" && b?.kind === "row" && same(a.row, b.row), `same row: "${s}"`, [a?.row ?? a?.kind, b?.row ?? b?.kind]);
}
check(es("Formulario 606, deshacer")?.kind === "undo", "Spanish undo");
check(es("forma seis cero seis revisión de aire aprobada")?.kind === "row", "Spanish trigger spelled out");
check(es("Formulario 606, revisión de aire no pasó")?.row?.visual === "fail", "Spanish negation is a fail", es("Formulario 606, revisión de aire no pasó"));
check(es("revisión de aire aprobada") === null, "Spanish: ignored without the trigger");
// Someone speaking English with the Spanish switch on, and the other way round.
check(H.parseHandsFree(["Form 606, air check passed"], "es")?.kind === "row", "English line with Spanish preferred");
check(H.parseHandsFree(["Formulario 606, prueba de jalón aprobada"], "en")?.row?.pull_test === "pass", "Spanish line with English preferred");
// The recogniser's second guess is used when its first has no trigger.
rowIs(H.parseHandsFree(["farm 6 or 6 air check passed", "form 606 air check passed"], "en"), { check: "In process", visual: "pass" }, "a later alternative is used");
rowIs(en("4606 aircheck passed"), { check: "In process", visual: "pass" }, "the tablet's '4606 aircheck passed'");
rowIs(H.parseHandsFree(H.withPending(en("4606").transcript, ["pull test passed"]), "en"), { check: "At boxing", pull_test: "pass" }, "'4606', a pause, then the check");
check(en("4606 undo")?.kind === "undo", "'4606 undo'");

// ── 5a. A sentence the tablet cut in two ──────────────────────────────────────
const cut = (first, ...rest) => {
  let heard = H.parseHandsFree(H.withPending(null, [first]), "en");
  for (const part of rest) heard = H.parseHandsFree(H.withPending(heard?.kind === "unclear" ? heard.transcript : null, [part]), "en");
  return heard;
};
check(en("Form 606")?.kind === "unclear", "the trigger alone is not an answer yet");
rowIs(cut("Form 606", "air check passed"), { check: "In process", visual: "pass" }, "trigger, pause, then the check");
rowIs(cut("Form 606", "air check", "passed"), { check: "In process", visual: "pass" }, "cut in three");
rowIs(cut("Form 606", "form 606 air check passed"), { check: "In process", visual: "pass" }, "the tablet repeats the sentence so far");
rowIs(cut("Form 606 set up", "air check passed vacuum 27"), { check: "Set-up", visual: "pass", vacuum_reading: "27" }, "the check type before the pause is kept");
rowIs(cut("Form 606", "pull test failed"), { check: "At boxing", pull_test: "fail" }, "a failed pull test after a pause");
check(cut("Form 606", "undo")?.kind === "undo", "undo after a pause");
check(H.parseHandsFree(H.withPending(null, ["air check passed"]), "en") === null, "with nothing waiting, a check with no trigger is still ignored");
check(H.HANDS_FREE_WAIT_MS >= 4000, "it waits long enough for the rest of a sentence");

// ── 5a-2. How the tablet actually wrote it (2026-10-07) ────────────────────────
rowIs(en("Form 606 aircheck passed"), { check: "In process", visual: "pass" }, "'aircheck' as one word");
rowIs(en("form 606 air-check failed"), { check: "In process", visual: "fail" }, "'air-check' hyphenated");
rowIs(en("Form 606 air checked passed"), { check: "In process", visual: "pass" }, "'air checked'");
rowIs(en("Form 606 hair check passed"), { check: "In process", visual: "pass" }, "'hair check'");
rowIs(en("Form 606 pulltest passed"), { check: "At boxing", pull_test: "pass" }, "'pulltest' as one word");
rowIs(en("Form 606 boxingcheck passed"), { check: "At boxing", visual: "pass" }, "'boxingcheck' as one word");
rowIs(en("Form 606 set-up aircheck passed vacuum 27"), { check: "Set-up", visual: "pass", vacuum_reading: "27" }, "'set-up' and 'aircheck' together");
rowIs(cut("Form 606", "aircheck passed"), { check: "In process", visual: "pass" }, "'aircheck' after a pause");
check(en("aircheck passed") === null, "'aircheck' with no trigger is still ignored");

// ── 5b. Every line printed on the wall card parses, and the two languages agree ──
for (const lang of ["en", "es"]) {
  for (const line of H.HANDS_FREE_CARD[lang].lines) {
    const heard = H.parseHandsFree([line.say], lang);
    check(heard && heard.kind !== "unclear", `card line parses (${lang}): "${line.say}"`, heard);
  }
}
check(H.HANDS_FREE_CARD.en.lines.length === H.HANDS_FREE_CARD.es.lines.length, "both cards have the same lines");
H.HANDS_FREE_CARD.en.lines.forEach((line, i) => {
  const a = H.parseHandsFree([line.say], "en"), b = H.parseHandsFree([H.HANDS_FREE_CARD.es.lines[i].say], "es");
  check(a?.kind === b?.kind && same(a?.row, b?.row), `card line ${i + 1} means the same in both languages`, [a?.row ?? a?.kind, b?.row ?? b?.kind]);
});

// ── 6. Into the real form ─────────────────────────────────────────────────────
check(H.handsFreeReady(S606), "FRM-606 v2 is ready for hands-free rows");
const oldShape = JSON.parse(JSON.stringify(S606).replace('"In process"', '"Hourly"'));
check(!H.handsFreeReady(oldShape) && !H.handsFreeReady(null), "an earlier revision is not");
const fresh = { ...F.emptyValues(S606, { userInitials: "CR" }), production_date: "2026-10-07", product: "Rum Cake", lot_code: "6280" };
check(same(H.handsFreeMissingHeader(fresh), []) && same(H.handsFreeMissingHeader({ ...fresh, lot_code: " " }), ["lot_code"]), "header check");
const one = H.applyHandsFreeRow(S606, fresh, en("Form 606, set up, air check passed, vacuum 27").row, { userInitials: "TP" });
check(one.ok && one.rowIndex === 0 && !one.appended && one.values.seal_checks.length === 1 && one.values.seal_checks[0].check === "Set-up"
  && one.values.seal_checks[0].visual === "pass" && one.values.seal_checks[0].vacuum_reading === "27" && one.values.seal_checks[0].initials === "TP"
  && /^\d\d:\d\d$/.test(one.values.seal_checks[0].time) && one.warnings.length === 0, "first row fills the seeded row, with time and initials", one.ok ? [one.values.seal_checks, one.warnings] : one.error);
const two = H.applyHandsFreeRow(S606, one.values, en("Form 606, air check passed").row, { userInitials: "TP" });
check(two.ok && two.appended && two.values.seal_checks.length === 2 && two.values.seal_checks[1].check === "In process"
  && two.values.lot_code === "6280" && two.values.product === "Rum Cake", "second row is appended; the header is untouched", two.ok ? two.values.seal_checks : two.error);
const three = H.applyHandsFreeRow(S606, two.values, en("Form 606, pull test passed").row, { userInitials: "TP" });
const zod = F.buildZodSchema(S606);
const filled = { ...three.values, deviations_today: "None - every check passed", verification_independence: "Someone other than the operator who took the readings",
  monitored_by: { user_id: "u1", name: "T P", signed_at: "2026-10-08T10:00:00Z" }, verified_by: { user_id: "u2", name: "G J", signed_at: "2026-10-08T11:00:00Z" } };
const parsed = zod.safeParse(filled);
check(three.ok && parsed.success, "a record of one-check rows submits", parsed.success ? undefined : parsed.error.issues.map(i => i.path.join(".") + ": " + i.message));
const noLot = zod.safeParse({ ...filled, lot_code: "" });
check(!noLot.success && noLot.error.issues.some(i => i.path[0] === "lot_code"), "the lot code is required once");
check(H.handsFreeFailed({ check: "At boxing", pull_test: "fail" }) && !H.handsFreeFailed({ check: "In process", visual: "pass" }), "failed rows are known");

// ── 7. The reminder ───────────────────────────────────────────────────────────
const T0 = 1_000_000_000_000, MIN = 60_000;
check(H.REMIND_EVERY_MS === 30 * MIN, "every 30 minutes");
check(!H.reminderDue(T0 + 29 * MIN, T0, null, null) && H.reminderDue(T0 + 30 * MIN, T0, null, null), "due 30 minutes after it is switched on");
check(!H.reminderDue(T0 + 40 * MIN, T0, T0 + 20 * MIN, null) && H.reminderDue(T0 + 50 * MIN, T0, T0 + 20 * MIN, null), "a recorded row restarts the 30 minutes");
check(!H.reminderDue(T0 + 59 * MIN, T0, null, T0 + 30 * MIN) && H.reminderDue(T0 + 60 * MIN, T0, null, T0 + 30 * MIN), "one reminder per interval");
check(H.nextReminderAt(T0, T0 + 5 * MIN, T0 + 2 * MIN) === T0 + 35 * MIN, "counts from the latest of the three");

// ── 7b. A button press stands for the trigger ─────────────────────────────────
{
  const pressed = (line, lang = "en") => H.parseHandsFree(H.withPending(H.HANDS_FREE_IMPLIED, [line]), lang);
  rowIs(pressed("air check passed"), { check: "In process", visual: "pass" }, "button: 'air check passed' needs no trigger");
  rowIs(pressed("aircheck failed"), { check: "In process", visual: "fail" }, "button: 'aircheck failed'");
  rowIs(pressed("pull test passed"), { check: "At boxing", pull_test: "pass" }, "button: pull test");
  rowIs(pressed("set up air check passed vacuum 27"), { check: "Set-up", visual: "pass", vacuum_reading: "27" }, "button: set-up with the gauge");
  rowIs(pressed("form 606 air check passed"), { check: "In process", visual: "pass" }, "button: saying the trigger anyway is fine");
  rowIs(pressed("revisión de aire aprobada", "es"), { check: "In process", visual: "pass" }, "button: Spanish");
  check(pressed("undo")?.kind === "undo", "button: undo");
  check(pressed("passed")?.kind === "unclear" && pressed("what time is lunch")?.kind === "unclear", "button: words that are not a check are not guessed at");
  const key = (k, tag, extra = {}) => H.isListenKey(k, { tag, ...extra }, false);
  check(key("PageDown", "BODY") && key("MediaPlayPause", "DIV") && key("ArrowRight", "BODY") && key("Enter", "BODY"), "a pedal or media key starts listening");
  check(!key("Enter", "INPUT") && !key(" ", "TEXTAREA") && !key("ArrowDown", "SELECT") && !key("PageDown", "DIV", { editable: true }), "never while typing in the form");
  check(!key("Enter", "BUTTON") && !key(" ", "A") && key("PageDown", "BUTTON"), "Enter on a focused button still presses that button");
  check(!key("a", "BODY") && !key("AudioVolumeUp", "BODY") && !H.isListenKey("PageDown", { tag: "BODY" }, true), "other keys, volume keys and auto-repeat do nothing");
  check(H.LISTEN_MODES.join() === "always,button,voice", "the three ways of listening");
}

// ── 8. Waiting quietly for a voice ────────────────────────────────────────────
{
  const feed = (gate, levels) => levels.map(l => gate.push(l));
  const quiet = n => Array(n).fill(0.003);
  let g = H.createVoiceGate();
  check(!feed(g, quiet(200)).some(Boolean), "silence never starts recognition");
  check(feed(g, [0.08, 0.09, 0.1]).filter(Boolean).length === 1, "a voice starts it, once");
  g = H.createVoiceGate(); feed(g, quiet(50));
  check(!feed(g, [0.3, 0.003, 0.003, 0.25, 0.003]).some(Boolean), "a click or a dropped pan does not");
  // A sealer running: the floor rises to it, and a voice above it still starts recognition.
  g = H.createVoiceGate();
  const sealer = Array(400).fill(0).map((_, i) => 0.04 + (i % 5) * 0.002);
  const during = feed(g, sealer);
  check(during.slice(200).filter(Boolean).length === 0, "steady machine noise stops starting it once the floor has risen", during.filter(Boolean).length);
  check(feed(g, [0.2, 0.22, 0.21]).some(Boolean), "a voice over the machine still starts it");
  // Noise that fooled it once is not allowed to again.
  g = H.createVoiceGate(); feed(g, quiet(50));
  check(feed(g, [0.03, 0.03, 0.03]).some(Boolean), "a moderate noise starts it the first time");
  g.missed();
  check(!feed(g, [0.03, 0.03, 0.03, 0.03, 0.03, 0.03]).some(Boolean), "after it was told that was not speech, the same noise does not");
  check(feed(g, [0.15, 0.15, 0.15]).some(Boolean), "something clearly louder still does");
  check(g.floor <= H.VOICE_GATE.maxFloor, "the floor is capped");
}

// ── 9. A seal check from a lot's button on the Today page ─────────────────────
{
  const LOT = { product: "Rum Cake - Original", lot: "6279" };
  const AT = new Date(2026, 9, 9, 14, 5);
  for (const lang of ["en", "es"]) {
    const card = H.SEAL_BUTTON_CARD[lang];
    check(card.lines.length === H.HANDS_FREE_CARD[lang].lines.length - 1, `button card (${lang}): every hands-free line but undo`, card.lines.map(l => l.say));
    card.lines.forEach((line, i) => {
      const a = H.parseSealButton([line.say], lang), b = H.parseHandsFree([H.HANDS_FREE_CARD[lang].lines[i].say], lang);
      check(!/606/.test(line.say) && a?.kind === "row" && same(a.row, b.row), `button card (${lang}) reads the same row without the trigger: ${line.say}`, [a, b]);
    });
  }
  check(H.parseSealButton(["what time is lunch"])?.kind === "unclear" && H.parseSealButton([""]) === null, "no check heard: nothing to accept", [H.parseSealButton(["what time is lunch"]), H.parseSealButton([""])]);

  const pass = H.sealButtonFill(LOT, H.parseSealButton(["set up air check passed vacuum 27"]).row, AT);
  check(same(pass.row, { time: "14:05", check: "Set-up", vacuum_reading: "27", visual: "pass" }) && pass.warnings.length === 0
    && same(pass.entryFields, { product: LOT.product, lot: "6279" }) && pass.productionDate === "2026-10-09", "a passed check: the row, the lot and the product from the button", pass);
  check(pass.summary.map(l => l.key).join() === "time,product,lot,check,vacuum,visual", "its summary", pass.summary);
  const fail = H.sealButtonFill(LOT, H.parseSealButton(["pull test failed"]).row, AT);
  check(fail.row.pull_test === "fail" && fail.row.check === "At boxing" && fail.warnings[0]?.section === "deviation" && /pull test failed/i.test(fail.warnings[0].text), "a failed check carries the Section 3 warning", fail);
  const es = H.sealButtonFill(LOT, H.parseSealButton(["revisión de aire aprobada"], "es").row, AT, "es");
  const en = H.sealButtonFill(LOT, H.parseSealButton(["air check passed"]).row, AT);
  check(same(es.row, en.row), "Spanish and English give the identical row", [es.row, en.row]);

  // Into the real form: a new record for the lot, then a second check on the same record.
  const fresh = { ...F.emptyValues(S606, { userInitials: "CR" }), production_date: "2026-10-09", product: LOT.product, lot_code: "6279" };
  const a = V.applyVoiceFill(S606, fresh, pass, { userInitials: "TP" });
  check(a.ok && a.rowIndex === 0 && a.values.seal_checks[0].check === "Set-up" && a.values.seal_checks[0].time === "14:05"
    && a.values.seal_checks[0].initials === "TP" && a.values.lot_code === "6279" && a.warnings.length === 0, "applied to FRM-606 with no warnings", a.ok && [a.values.seal_checks[0], a.warnings]);
  const b = V.applyVoiceFill(S606, a.values, en, { userInitials: "TP" });
  check(b.ok && b.values.seal_checks.length === 2 && b.warnings.length === 0, "a second check is a second row", b.ok && b.warnings);
  const other = V.applyVoiceFill(S606, { ...fresh, lot_code: "6280" }, pass, { userInitials: "TP" });
  check(other.ok && other.warnings.some(w => w.code === "lot_mismatch"), "another lot's record is noticed, not written to quietly", other.ok && other.warnings);
}

// ── 10. The last check of the batch, and of the lot (FRM-606 v3) ──────────────
{
  const LOT = { product: "Rum Cake - Original", lot: "6283" };
  const AT = new Date(2026, 9, 10, 14, 5);
  const B = H.SEAL_LAST_VALUES.batch, L = H.SEAL_LAST_VALUES.lot;
  const line = (text, lang = "en") => H.parseSealLine([text], lang);

  check(same(H.splitLastPhrase("air check passed last check of this batch"), { rest: "air check passed", last: "batch" }), "the closing phrase is cut out of the sentence");
  check(same(H.splitLastPhrase("air check passed"), { rest: "air check passed" }), "no phrase, the sentence as it came");
  const withBatch = ["air check passed last check of this batch", "air check passed, last check of the batch", "last check of this batch air check passed", "air check passed final check of this batch", "aircheck passed last check this batch"];
  for (const t of withBatch) { const r = line(t); check(same(r.row, { check: "In process", visual: "pass" }) && r.last === "batch" && !r.markOnly, `batch: ${t}`, r); }
  const lotLine = line("boxing check passed last check of this lot");
  check(lotLine.row?.check === "At boxing" && lotLine.last === "lot", "lot: on a boxing check", lotLine);
  const pull = line("pull test passed, last check of this lot");
  check(same(pull.row, { check: "At boxing", pull_test: "pass" }) && pull.last === "lot", "lot: on a pull test", pull);
  const setup = line("set up air check passed vacuum 27 last check of this batch");
  check(same(setup.row, { check: "Set-up", visual: "pass", vacuum_reading: "27" }) && setup.last === "batch", "the phrase does not disturb the check type or the gauge", setup);
  check(line("air check passed").last === undefined && same(line("air check passed").row, { check: "In process", visual: "pass" }), "no phrase, no mark");
  const failed = line("air check failed last check of this batch");
  check(failed.row?.visual === "fail" && failed.last === "batch", "a failed last check is still a failed check", failed);
  const esB = line("revisión de aire aprobada, última revisión de esta tanda", "es"), esL = line("prueba de jalón aprobada última revisión del lote", "es");
  check(esB.row?.visual === "pass" && esB.last === "batch" && esL.row?.pull_test === "pass" && esL.last === "lot", "Spanish closing phrases", [esB, esL]);

  const only = line("last check of this batch"), onlyLot = line("last check of this lot"), onlyEs = line("última revisión del lote", "es");
  check(only.markOnly && only.last === "batch" && !only.row && onlyLot.markOnly && onlyLot.last === "lot" && onlyEs.markOnly && onlyEs.last === "lot", "the phrase alone is a mark, not a check", [only, onlyLot, onlyEs]);
  const nothing = line("what time is lunch");
  check(!nothing.row && !nothing.markOnly && !nothing.last && nothing.transcript === "what time is lunch", "nothing understood: no row, no mark, the words kept for correcting", nothing);
  check(H.parseSealLine(["what was that", "air check passed last check of this lot"]).last === "lot", "alternatives: the one with a check wins");
  check(H.parseSealLine(["last check of this batch", "air check passed last check of this batch"]).row?.visual === "pass", "alternatives: a whole check beats a bare mark");
  check(same(H.parseSealLine([]), { transcript: "" }), "nothing said");

  const fill = H.sealButtonFill(LOT, line("air check passed last check of this batch").row, AT, "en", "batch");
  check(fill.row.last_check === B && fill.summary.some(l => l.key === "last_check" && l.value === B) && fill.warnings.length === 0, "the mark is on the row and in the summary", fill);
  check(!("last_check" in H.sealButtonFill(LOT, line("air check passed").row, AT).row), "no mark, no cell");
  check(H.sealButtonFill(LOT, esL.row, AT, "es", esL.last).row.last_check === L, "the record keeps the form's own English option whatever was spoken");

  check(H.hasLastCheckColumn(S606) && !H.hasLastCheckColumn(null), "the form on file has the Last check column");
  const noCol = JSON.parse(JSON.stringify(S606));
  const grid = noCol.sections.flatMap(s => s.fields).find(f => f.id === "seal_checks");
  grid.columns = grid.columns.filter(c => c.id !== "last_check");
  check(!H.hasLastCheckColumn(noCol), "an earlier revision has not");
  const fresh = { ...F.emptyValues(S606, { userInitials: "CR" }), production_date: "2026-10-10", product: LOT.product, lot_code: "6283" };
  const a = V.applyVoiceFill(S606, fresh, fill, { userInitials: "TP" });
  check(a.ok && a.values.seal_checks[0].last_check === B && a.warnings.length === 0, "applied to the form with no warnings", a.ok && [a.values.seal_checks[0], a.warnings]);
  const old = V.applyVoiceFill(noCol, { ...F.emptyValues(noCol, { userInitials: "CR" }), production_date: "2026-10-10", product: LOT.product, lot_code: "6283" }, fill, { userInitials: "TP" });
  check(old.ok && old.warnings.some(w => w.code === "no_column"), "on a revision without the column the mark is refused loudly", old.ok && old.warnings);

  // Marks on checks already recorded. The record is the batch's own.
  const rec = { seal_checks: [{ time: "09:00", check: "Set-up", visual: "pass" }, { time: "10:00", check: "In process", visual: "pass" }, { time: "", check: "" }] };
  const m = H.markLastCheck(rec, "batch");
  check(m.rowIndex === 1 && m.values.seal_checks.map(r => r.last_check ?? "").join("|") === `|${B}|`, "the mark goes on the last row that holds a check, not a blank one", m);
  check(rec.seal_checks.every(r => !("last_check" in r)), "the values passed in are not changed");
  check(H.markLastCheck({ seal_checks: [{ check: "" }] }, "batch") === null && H.markLastCheck({}, "lot") === null, "no check recorded: nothing to mark");
  const lotMarked = H.markLastCheck(rec, "lot").values;
  const mine = H.clearLastCheck(lotMarked, true);
  check(mine.changed && mine.hadLot && mine.values.seal_checks.every(r => !r.last_check), "reopening the batch's own record takes every mark off", mine);
  const other = H.clearLastCheck(lotMarked, false);
  check(other.changed && other.hadLot && other.values.seal_checks[1].last_check === B, "another batch's lot mark becomes a batch mark: the lot is open, that batch still done", other);
  const otherBatch = H.clearLastCheck(m.values, false);
  check(!otherBatch.changed && !otherBatch.hadLot && otherBatch.values === m.values, "another batch's own mark is left alone");
  check(!H.clearLastCheck(rec, true).changed, "nothing marked: nothing changed");

  for (const lang of ["en", "es"]) check(H.SEAL_BUTTON_CARD[lang].notes.some(n => /last check of this lot|última revisión del lote/.test(n)), `the wall card (${lang}) says how to finish`);
}

rmSync(out, { recursive: true, force: true });
console.log(failed ? `\n${failed} FAILED, ${passed} passed` : `\nALL ${passed} PASS`);
process.exit(failed ? 1 : 0);
