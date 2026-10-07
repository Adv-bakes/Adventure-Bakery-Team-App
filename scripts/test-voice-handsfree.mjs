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

rmSync(out, { recursive: true, force: true });
console.log(failed ? `\n${failed} FAILED, ${passed} passed` : `\nALL ${passed} PASS`);
process.exit(failed ? 1 : 0);
