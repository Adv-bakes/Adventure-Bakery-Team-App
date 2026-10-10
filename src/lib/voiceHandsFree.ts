// Hands-free rows on an FRM-606 entry that is already open: "Form 606, air check passed".
//
// WHY THIS IS SEPARATE FROM THE CARD COMMAND. The card line ("Create a CCP Sealing Record for
// Product …, Lot …") finds or creates the day's record, so it has to carry the product and the lot.
// At the sealer the record is already open and the operator's hands are busy, so a check is one
// short sentence: a trigger, what was checked, and the result. Nothing else is needed, because the
// product, the date and the lot are on the record and the time and initials are filled as for any row.
//
// NOTHING IS ACTED ON WITHOUT THE TRIGGER, in the same sentence. The microphone is open on a
// production floor; "the pull test passed" said to a colleague must not write a row.
//
// THE RECORD DOES NOT CHANGE LANGUAGE (see voiceCommands.ts): a row holds the form's own English
// option and "pass" / "fail", whichever language was spoken.
//
// Pure: no Supabase, no browser APIs, relative imports only, so the node test can bundle it.

import { format } from "date-fns";
import {
  CHECK_OPTIONS, VOICE_COMMANDS, applyVoiceFill, normalizeTranscript, parseNumber,
  type ApplyResult, type CheckOption, type LastLoad, type VoiceFill, type VoiceSummaryLine, type VoiceWarning,
} from "./voiceCommands";
import type { FillContext, FormSchema } from "./formSchema";
import { LEXICONS, type VoiceLang } from "./voiceLexicon";
import { VOICE_MSG } from "./voiceMessages";

/** The form this listens for. One form for now; the pieces below are keyed on it. */
export const HANDS_FREE_FORM = "FRM-606";
const HANDS_FREE_COMMAND = "ccp2_seal";
const HANDS_FREE_GRID = "seal_checks";

export interface HandsFreeRow {
  check: CheckOption;
  visual?: "pass" | "fail";
  pull_test?: "pass" | "fail";
  vacuum_reading?: string;
}

/** Flat, like the other voice result types: the app's tsconfig is not strict. */
export interface HandsFreeHeard {
  kind: "row" | "undo" | "unclear";
  /** Present when kind is "row". */
  row?: HandsFreeRow;
  transcript: string;
  lang: VoiceLang;
}

interface HandsFreeWords {
  /** Words the recogniser writes for "form". */
  form: string[];
  /** Each number word's digits, so "six oh six" and "seiscientos seis" both read as 606. */
  digits: Record<string, string>;
  air: string[][];
  boxing: string[][];
  undo: string[][];
}

const WORDS: Record<VoiceLang, HandsFreeWords> = {
  en: {
    // "for" / "four" / "4": the recogniser hears "form 606" as "for 606", and writes that as "4606".
    form: ["form", "from", "forum", "forms", "farm", "for", "four", "4"],
    digits: { six: "6", oh: "0", o: "0", zero: "0", sixty: "60", "6": "6", "0": "0", "06": "06", "60": "60", "600": "600", "606": "606" },
    air: [["air", "check"], ["air", "test"], ["seal", "check"], ["air"], ["visual"]],
    boxing: [["boxing", "check"], ["box", "check"]],
    undo: [["undo"], ["cancel", "that"], ["cancel"], ["delete", "last"], ["remove", "last"], ["scratch", "that"]],
  },
  es: {
    form: ["formulario", "forma", "formato", "form"],
    digits: {
      seis: "6", cero: "0", sesenta: "60", seiscientos: "600", "6": "6", "0": "0", "06": "06", "60": "60", "600": "600", "606": "606",
    },
    air: [["revision", "de", "aire"], ["prueba", "de", "aire"], ["chequeo", "de", "aire"], ["aire"], ["visual"]],
    boxing: [["revision", "de", "empaque"], ["revision", "al", "empacar"], ["chequeo", "de", "empaque"]],
    undo: [["deshacer"], ["borrar"], ["cancelar"], ["anular"], ["undo"]],
  },
};

/**
 * What the recogniser writes for the words on the card, put back to the card's spelling before parsing.
 * Found on the tablet, 2026-10-07: Chrome writes "air check" as ONE word, "aircheck", so the trigger was
 * heard and the check was not. The same is allowed for the other two-word checks, and for the near
 * misses a recogniser makes of "air" ("hair check", "heir check", "error check").
 */
const SPELLINGS: Record<VoiceLang, [RegExp, string][]> = {
  en: [
    [/\b(?:air|hair|heir|error|ear|are)[\s-]*(?:check(?:s|ed)?|czech|chick|jack)\b/gi, "air check"],
    [/\bair[\s-]*tests?\b/gi, "air test"],
    [/\b(?:pull|pool|poll|full|bull)[\s-]*tests?\b/gi, "pull test"],
    [/\bbox(?:ing)?[\s-]*check(?:s|ed)?\b/gi, "boxing check"],
    [/\bset[\s-]*up\b/gi, "setup"],
  ],
  es: [
    [/\b(?:revisi[oó]n|chequeo|prueba)[\s-]*(?:de|del)[\s-]*aire\b/gi, "revisión de aire"],
    [/\bprueba[\s-]*(?:de|del)[\s-]*jal[oó]n\b/gi, "prueba de jalón"],
  ],
};

/** What "606" can come out as once its words are joined: "606", "6"+"0"+"6", "60"+"6", "600"+"6". */
const NUMBER_SPELLINGS = new Set(["606", "6006"]);
const VACUUM_RANGE: [number, number] = [0, 40];

function findSeq(n: string[], seq: string[], from = 0): number {
  outer: for (let i = from; i + seq.length <= n.length; i++) {
    for (let j = 0; j < seq.length; j++) if (n[i + j] !== seq[j]) continue outer;
    return i;
  }
  return -1;
}

/** The earliest of several phrases, longest first on a tie: [index, length]. */
function firstOf(n: string[], seqs: string[][] | undefined): [number, number] {
  let at = -1, len = 0;
  for (const seq of seqs ?? []) {
    const i = findSeq(n, seq);
    if (i >= 0 && (at < 0 || i < at || (i === at && seq.length > len))) { at = i; len = seq.length; }
  }
  return [at, len];
}

/** Index of the first token AFTER the trigger, or -1 when the trigger was not said. */
export function triggerEnd(n: string[], lang: VoiceLang): number {
  const w = WORDS[lang];
  const numberAt = (from: number): number => {
    let joined = "";
    for (let i = from; i < Math.min(n.length, from + 4); i++) {
      const d = w.digits[n[i]];
      if (d === undefined) {
        // "six hundred six" / "seiscientos y seis": a filler word inside the number.
        if (joined && (n[i] === "hundred" || n[i] === "and" || n[i] === "y")) { if (n[i] === "hundred") joined += "00"; continue; }
        return -1;
      }
      joined += d;
      if (NUMBER_SPELLINGS.has(joined)) return i + 1;
    }
    return -1;
  };
  for (let i = 0; i < n.length; i++) {
    // "form 606" written as one number (found on the tablet, 2026-10-07).
    if (n[i] === "4606") return i + 1;
    if (!w.form.includes(n[i])) continue;
    // "form number 606", "formulario número 606"
    const skip = n[i + 1] === "number" || n[i + 1] === "numero" ? 2 : 1;
    const end = numberAt(i + skip);
    if (end >= 0) return end;
  }
  // The recogniser sometimes drops "form" at the start of a sentence; a bare 606 opening it still counts.
  return n.length && numberAt(0) >= 0 ? numberAt(0) : -1;
}

function parseOne(transcript: string, lang: VoiceLang): HandsFreeHeard | null {
  const lex = LEXICONS[lang];
  const w = WORDS[lang];
  let spelled = transcript;
  for (const [re, to] of SPELLINGS[lang]) spelled = spelled.replace(re, to);
  const all = normalizeTranscript(spelled, lang).map(t => t.n);
  const from = triggerEnd(all, lang);
  if (from < 0) return null;
  const n = all.slice(from);
  const text = VOICE_COMMANDS.find(d => d.id === HANDS_FREE_COMMAND)!.text[lang];
  const unclear: HandsFreeHeard = { kind: "unclear", transcript, lang };

  if (firstOf(n, w.undo)[0] >= 0) return { kind: "undo", transcript, lang };

  const [boxAt, boxLen] = firstOf(n, w.boxing);
  const [pullAt, pullLen] = firstOf(n, text.anchors.pull);
  // "boxing check" contains no air word, but the air list ends in single words that a boxing or
  // pull phrase could never be mistaken for, so the three are looked for independently.
  const [airAt, airLen] = boxAt >= 0 ? [-1, 0] : firstOf(n, w.air);
  const [vacAt] = firstOf(n, text.anchors.vacuum);

  const anchors = [boxAt, pullAt, airAt, vacAt].filter(i => i >= 0);
  const resultAfter = (at: number, len: number) => {
    const start = at + len;
    const next = anchors.filter(i => i > at);
    const end = Math.min(start + lex.resultWindow, next.length ? Math.min(...next) : n.length);
    return lex.resultIn(n.slice(start, end));
  };
  const visual = boxAt >= 0 ? resultAfter(boxAt, boxLen) : airAt >= 0 ? resultAfter(airAt, airLen) : undefined;
  const pull = pullAt >= 0 ? resultAfter(pullAt, pullLen) : undefined;
  // Something was named but its result was not heard: say so, never guess a pass.
  if ((boxAt >= 0 || airAt >= 0) && !visual) return unclear;
  if (pullAt >= 0 && !pull) return unclear;
  if (!visual && !pull) return unclear;

  let vacuum: string | undefined;
  if (vacAt >= 0) {
    const stops = [indexOfAny(n, text.anchors.inches, vacAt), ...anchors.filter(i => i > vacAt)].filter(i => i > vacAt);
    const v = parseNumber(n.slice(vacAt + 1, stops.length ? Math.min(...stops) : n.length), { range: VACUUM_RANGE }, lang);
    if (v?.value === undefined) return unclear;
    vacuum = String(v.value);
  }

  let said: CheckOption | undefined;
  let saidAt = -1;
  for (const option of CHECK_OPTIONS) {
    const [i] = firstOf(n, text.checkPhrases?.[option]);
    // "boxing check" is the check itself, not a check type said beside it.
    if (i >= 0 && !(option === "At boxing" && i === boxAt) && (saidAt < 0 || i < saidAt)) { saidAt = i; said = option; }
  }
  // A pull test is only ever done at boxing, and so is the boxing check; anything else said at the
  // sealer with no type is an in-process check.
  const check: CheckOption = boxAt >= 0 || (pull && !visual) ? "At boxing" : said ?? "In process";

  const row: HandsFreeRow = { check };
  if (visual) row.visual = visual;
  if (pull) row.pull_test = pull;
  if (vacuum !== undefined) row.vacuum_reading = vacuum;
  return { kind: "row", row, transcript, lang };
}

function indexOfAny(n: string[], words: string[] | undefined, from: number): number {
  if (!words) return -1;
  for (let i = from; i < n.length; i++) if (words.includes(n[i])) return i;
  return -1;
}

/**
 * Every alternative the recogniser offered, in the operator's language first and then the other.
 * A row or an undo wins over "unclear"; null means the trigger was never said, so nothing happens.
 */
export function parseHandsFree(alternatives: string[], preferred: VoiceLang = "en"): HandsFreeHeard | null {
  const langs: VoiceLang[] = preferred === "en" ? ["en", "es"] : ["es", "en"];
  let unclear: HandsFreeHeard | null = null;
  for (const lang of langs) {
    for (const alt of alternatives) {
      if (!alt || !alt.trim()) continue;
      const heard = parseOne(alt, lang);
      if (!heard) continue;
      if (heard.kind !== "unclear") return heard;
      unclear = unclear ?? heard;
    }
  }
  return unclear;
}

/**
 * How long to wait for the rest of a sentence after the trigger was heard on its own.
 *
 * Android Chrome ends a sentence at the first short pause, so "Form 606, air check passed" often
 * arrives as two: "form 606", then "air check passed". Answering the first at once ("I did not hear
 * what was checked") talks over the operator, and the second, having no trigger, is then ignored.
 */
export const HANDS_FREE_WAIT_MS = 6000;

/**
 * The alternatives to parse when an earlier sentence is still waiting for its other half: each new
 * alternative joined onto what was heard before, then the new ones alone. Some Android builds repeat
 * the whole sentence so far in each result ("form 606", then "form 606 air check passed"); joined,
 * that reads "form 606 form 606 air check passed", which parses the same.
 */
export function withPending(pending: string | null, alternatives: string[]): string[] {
  const fresh = alternatives.filter(a => a && a.trim());
  return pending ? [...fresh.map(a => `${pending} ${a}`), ...fresh] : fresh;
}

/**
 * What a button press stands for. Pressing the button already says "this is for the form", so the
 * sentence that follows needs no trigger: it is parsed as if it had been said after this one
 * (withPending). "form" and "606" are in both languages' word lists.
 */
export const HANDS_FREE_IMPLIED = "form 606";

/** The ways listening can work, chosen on the bar and remembered on the tablet. */
export type ListenMode = "always" | "button" | "voice";
export const LISTEN_MODES: ListenMode[] = ["always", "button", "voice"];

/**
 * Keys that start listening in button mode: what Bluetooth page-turner pedals and presenter
 * clickers send (they pair as a keyboard), and the media keys some headsets send as keys.
 * Volume keys are not here because a web page is never given them.
 */
export const LISTEN_KEYS = new Set([
  "PageDown", "PageUp", "ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Enter", " ",
  "MediaPlayPause", "MediaPlay", "MediaPause", "MediaTrackNext", "MediaTrackPrevious", "HeadsetHook",
]);

/**
 * Whether a key press should start listening. Never while the person is typing in the form or
 * tabbing through its buttons - the same keys mean something there - and never on auto-repeat.
 */
export function isListenKey(key: string, target: { tag?: string; editable?: boolean } | null, repeat = false): boolean {
  if (repeat || !LISTEN_KEYS.has(key)) return false;
  const tag = (target?.tag ?? "").toUpperCase();
  if (target?.editable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
  // Enter and space press a focused button or link; the media keys and the pedal's page keys do not.
  if ((key === "Enter" || key === " ") && (tag === "BUTTON" || tag === "A")) return false;
  return true;
}

/** True when this revision of the form can take a hands-free row: it has the grid and the "In process" option. */
export function handsFreeReady(schema: FormSchema | null | undefined): boolean {
  if (!schema) return false;
  for (const section of schema.sections) {
    for (const field of section.fields ?? []) {
      if (field.id !== HANDS_FREE_GRID || field.type !== "grid") continue;
      const check = (field as { columns: { id: string; options?: string[] }[] }).columns.find(c => c.id === "check");
      return !!check?.options?.includes("In process") && !!check.options.includes("At boxing");
    }
  }
  return false;
}

/** The header answers a spoken row needs to land in a record that says what it is: which are still blank. */
export function handsFreeMissingHeader(values: Record<string, unknown>): ("production_date" | "product" | "lot_code")[] {
  return (["production_date", "product", "lot_code"] as const).filter(k => !String(values[k] ?? "").trim());
}

/** Put a hands-free row into the entry's values, in the seeded blank row or appended. Never saves. */
export function applyHandsFreeRow(
  schema: FormSchema,
  values: Record<string, unknown>,
  row: HandsFreeRow,
  ctx: FillContext,
  uiLang: VoiceLang = "en",
): ApplyResult {
  const cells: Record<string, string> = { check: row.check };
  if (row.visual) cells.visual = row.visual;
  if (row.pull_test) cells.pull_test = row.pull_test;
  if (row.vacuum_reading !== undefined) cells.vacuum_reading = row.vacuum_reading;
  const fill: VoiceFill = {
    commandId: HANDS_FREE_COMMAND,
    formNumber: HANDS_FREE_FORM,
    title: "",
    gridId: HANDS_FREE_GRID,
    // The record's own date and product: a hands-free row never argues with the record it is on.
    productionDate: String(values.production_date ?? ""),
    entryFields: { product: String(values.product ?? "") },
    row: cells,
    warnings: [],
    summary: [],
  };
  return applyVoiceFill(schema, values, fill, ctx, uiLang);
}

/** True when a row failed a check: the work stops and Section 3 is followed. */
export function handsFreeFailed(row: HandsFreeRow): boolean {
  return row.visual === "fail" || row.pull_test === "fail";
}

// ─── The printed card ────────────────────────────────────────────────────────

/**
 * The hands-free lines for the wall, per language. The test parses every `say` back through
 * parseHandsFree, so the card and the parser cannot drift apart - the same rule as the long card lines.
 */
export const HANDS_FREE_CARD: Record<VoiceLang, { heading: string; intro: string; lines: { say: string; does: string }[]; notes: string[] }> = {
  en: {
    heading: "CCP 2 - Hands-free checks (FRM-606)",
    intro: "Open the day's FRM-606, fill in the date, product and lot code, and switch on Listening mode. Then say:",
    lines: [
      { say: "Form 606, set up, air check passed, vacuum 27", does: "First sealing of the run, with the gauge reading" },
      { say: "Form 606, air check passed", does: "A check during the run" },
      { say: "Form 606, after adjustment, air check passed", does: "After any change to the sealer" },
      { say: "Form 606, end of run, air check passed", does: "Every pouch of the run was looked at" },
      { say: "Form 606, pull test passed", does: "At boxing: one cooled pouch from the lot" },
      { say: "Form 606, boxing check passed", does: "At boxing: every pouch was looked at again" },
      { say: "Form 606, undo", does: "Removes the last row you said" },
    ],
    notes: [
      "Say \"failed\" in place of \"passed\" when a check fails. A failed check stops the work.",
      "The tablet says back what it recorded. If it says nothing, it did not hear \"Form 606\".",
      "Never pull test a pouch that has just been sealed: the film is still warm.",
      "If it is not hearing you, tap the buttons on the form.",
    ],
  },
  es: {
    heading: "PCC 2 (CCP 2) - Revisiones a manos libres (FRM-606)",
    intro: "Abra el FRM-606 del día, llene la fecha, el producto y el código de lote, y active el modo de escucha. Luego diga:",
    lines: [
      { say: "Formulario 606, arranque, revisión de aire aprobada, vacío 27", does: "Primer sellado de la corrida, con la lectura del manómetro" },
      { say: "Formulario 606, revisión de aire aprobada", does: "Una revisión durante la corrida" },
      { say: "Formulario 606, después de un ajuste, revisión de aire aprobada", does: "Después de cualquier cambio en la selladora" },
      { say: "Formulario 606, fin de corrida, revisión de aire aprobada", does: "Se revisaron todas las bolsas de la corrida" },
      { say: "Formulario 606, prueba de jalón aprobada", does: "Al empacar: una bolsa fría del lote" },
      { say: "Formulario 606, revisión de empaque aprobada", does: "Al empacar: se revisaron otra vez todas las bolsas" },
      { say: "Formulario 606, deshacer", does: "Quita la última fila que dijo" },
    ],
    notes: [
      "Diga \"rechazada\" en lugar de \"aprobada\" cuando una revisión falle. Una revisión rechazada detiene el trabajo.",
      "La tableta repite lo que registró. Si no dice nada, no escuchó \"Formulario 606\".",
      "Nunca haga la prueba de jalón en una bolsa recién sellada: la película sigue caliente.",
      "Si no le escucha, toque los botones del formulario.",
    ],
  },
};

// ─── A seal check from a lot's button on the Today page ──────────────────────
//
// The Today page lists each lot + product in progress, and its "Record seal check" button stands
// for the trigger exactly as a headset button does: the sentence that follows is parsed as if it
// came after "Form 606". So the lines are the hands-free ones without the trigger - "air check
// passed", "pull test passed" - and the record they go to is that lot's FRM-606 for the day.

/** The sentence said after the button was tapped. Null or "unclear" means no check was heard. */
export function parseSealButton(alternatives: string[], lang: VoiceLang = "en"): HandsFreeHeard | null {
  return parseHandsFree(withPending(HANDS_FREE_IMPLIED, alternatives), lang);
}

// ---------- The last check of the batch, and of the lot (FRM-606 v3) ----------
//
// The same two marks as baking (FRM-507's Last load), in the owner's words: a BATCH is one row of
// the Today page (a product within the day's lot code), the LOT is the day's lot code. FRM-606 is
// one record per batch, so "last check of this batch" finishes that record's checks and "last
// check of this lot" finishes every record of the lot code for the day.

/** FRM-606's Last check options, exactly as the form defines them. Every language maps onto these. */
export const SEAL_LAST_VALUES: Record<LastLoad, string> = { batch: "Last check of this batch", lot: "Last check of this lot" };

/** The words of the closing phrase per language: an opener, then within a few words "batch" or "lot". */
const LAST_WORDS: Record<VoiceLang, { opener: string[]; batch: string[]; lot: string[] }> = {
  en: { opener: ["last", "final"], batch: ["batch", "batches", "bash", "badge"], lot: ["lot", "lots"] },
  es: { opener: ["ultima", "ultimo", "final"], batch: ["tanda", "bache", "batch"], lot: ["lote", "lotes"] },
};

const foldWord = (w: string) => w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

/** A sentence with its closing phrase taken out, and which one it was. No phrase: the sentence as it came. */
export function splitLastPhrase(sentence: string, lang: VoiceLang = "en"): { rest: string; last?: LastLoad } {
  const words = String(sentence ?? "").split(/\s+/).filter(Boolean);
  const n = words.map(foldWord);
  const W = LAST_WORDS[lang];
  for (let i = 0; i < n.length; i++) {
    if (!W.opener.includes(n[i])) continue;
    for (let k = i + 1; k < Math.min(n.length, i + 6); k++) {
      const which: LastLoad | undefined = W.batch.includes(n[k]) ? "batch" : W.lot.includes(n[k]) ? "lot" : undefined;
      if (which) return { rest: [...words.slice(0, i), ...words.slice(k + 1)].join(" "), last: which };
    }
  }
  return { rest: words.join(" ") };
}

export interface SealLine {
  /** The check that was heard, when one was. */
  row?: HandsFreeRow;
  last?: LastLoad;
  /** Only the closing phrase was said: it marks the check already recorded. */
  markOnly?: boolean;
  transcript: string;
}

/**
 * The sentence said after the seal-check button: a check, optionally closed with "last check of
 * this batch / lot", or the closing phrase on its own. The first alternative that gives a check
 * wins; failing that, a bare phrase; failing that, nothing was understood (no row, no mark).
 */
export function parseSealLine(alternatives: string[], lang: VoiceLang = "en"): SealLine {
  const lines = alternatives.filter(a => a && a.trim());
  const transcript = lines[0] ?? "";
  let bare: SealLine | null = null;
  for (const line of lines) {
    const { rest, last } = splitLastPhrase(line, lang);
    const heard = rest.trim() ? parseSealButton([rest], lang) : null;
    if (heard?.kind === "row" && heard.row) return { row: heard.row, last, transcript: line };
    if (last && !rest.trim() && !bare) bare = { last, markOnly: true, transcript: line };
  }
  return bare ?? { transcript };
}

/** True when this revision of FRM-606 has the Last check column (v3). */
export function hasLastCheckColumn(schema: FormSchema | null | undefined): boolean {
  for (const section of schema?.sections ?? []) {
    for (const field of section.fields ?? []) {
      if (field.id === HANDS_FREE_GRID && field.type === "grid") {
        return (field as { columns: { id: string }[] }).columns.some(c => c.id === "last_check");
      }
    }
  }
  return false;
}

const sealRows = (values: Record<string, unknown>): Record<string, unknown>[] =>
  Array.isArray(values[HANDS_FREE_GRID]) ? (values[HANDS_FREE_GRID] as Record<string, unknown>[]) : [];

/**
 * Mark the check recorded LAST on a batch's record as its last check, or the lot's. The record is
 * the batch's own, so any row with a check on it counts. Null when no check is recorded yet.
 */
export function markLastCheck(values: Record<string, unknown>, which: LastLoad): { values: Record<string, unknown>; rowIndex: number } | null {
  const rows = sealRows(values);
  let at = -1;
  rows.forEach((r, i) => { if (String(r?.check ?? "").trim()) at = i; });
  if (at < 0) return null;
  const next = rows.map((r, i) => (i === at ? { ...r, last_check: SEAL_LAST_VALUES[which] } : r));
  return { values: { ...values, [HANDS_FREE_GRID]: next }, rowIndex: at };
}

/**
 * "Checks not finished". On the batch's OWN record (`mine`) every mark comes off; on another
 * batch's record of the same lot a "last check of this lot" becomes "of this batch" - the lot is
 * no longer finished, but that batch still is. `hadLot` says a lot mark was found on this record.
 */
export function clearLastCheck(values: Record<string, unknown>, mine: boolean): { values: Record<string, unknown>; changed: boolean; hadLot: boolean } {
  let changed = false;
  let hadLot = false;
  const next = sealRows(values).map(r => {
    const mark = String(r?.last_check ?? "");
    if (!mark) return r;
    if (mark === SEAL_LAST_VALUES.lot) hadLot = true;
    if (mine) { changed = true; return { ...r, last_check: "" }; }
    if (mark === SEAL_LAST_VALUES.lot) { changed = true; return { ...r, last_check: SEAL_LAST_VALUES.batch }; }
    return r;
  });
  return { values: changed ? { ...values, [HANDS_FREE_GRID]: next } : values, changed, hadLot };
}

/** The seal-check row for a lot, as the entry page and the Today page both apply it. */
export function sealButtonFill(lot: { product: string; lot: string }, row: HandsFreeRow, at: Date, uiLang: VoiceLang = "en", last?: LastLoad): VoiceFill {
  const M = VOICE_MSG[uiLang];
  const time = format(at, "HH:mm");
  const cells: Record<string, string> = { time, check: row.check };
  if (row.vacuum_reading !== undefined) cells.vacuum_reading = row.vacuum_reading;
  if (row.visual) cells.visual = row.visual;
  if (row.pull_test) cells.pull_test = row.pull_test;
  if (last) cells.last_check = SEAL_LAST_VALUES[last];
  const warnings: VoiceWarning[] = [];
  if (handsFreeFailed(row)) {
    warnings.push({ level: "fail", section: "deviation", code: "seal_fail", text: M.sealFail(row.visual === "fail", row.pull_test === "fail") });
  }
  const verdict = (v: "pass" | "fail") => (v === "pass" ? M.summary.pass : M.summary.fail);
  const summary: VoiceSummaryLine[] = [
    { key: "time", label: M.summary.time, value: time },
    { key: "product", label: M.summary.product, value: lot.product },
    { key: "lot", label: M.summary.lot, value: lot.lot },
    { key: "check", label: M.summary.check, value: M.summary.checkValue(row.check) },
  ];
  if (row.vacuum_reading !== undefined) summary.push({ key: "vacuum", label: M.summary.vacuum, value: M.summary.inches(Number(row.vacuum_reading)) });
  if (row.visual) summary.push({ key: "visual", label: M.summary.visual, value: verdict(row.visual), flag: row.visual });
  if (row.pull_test) summary.push({ key: "pull", label: M.summary.pull, value: verdict(row.pull_test), flag: row.pull_test });
  if (last) summary.push({ key: "last_check", label: M.summary.lastCheck, value: SEAL_LAST_VALUES[last] });
  return {
    commandId: HANDS_FREE_COMMAND, formNumber: HANDS_FREE_FORM, title: "CCP 2 Vacuum Sealing Monitoring Record", gridId: HANDS_FREE_GRID,
    productionDate: format(at, "yyyy-MM-dd"), entryFields: { product: lot.product, lot: lot.lot },
    row: cells, warnings, summary, uiLang,
  };
}

/**
 * The wall card for the button: the hands-free lines without their trigger (and without undo,
 * which the button has no use for - a row is accepted before it is saved). Derived, so the two
 * cards cannot say different things.
 */
export const SEAL_BUTTON_CARD: Record<VoiceLang, { heading: string; intro: string; lines: { say: string; does: string }[]; notes: string[] }> = {
  en: {
    heading: "Seal check from the Today page",
    intro: "On the Today page, tap Record seal check on the lot's row, then Speak the check. The product and the lot come from the row - say only the check.",
    lines: [],
    notes: [
      "Say \"failed\" in place of \"passed\" when a check fails. The record then opens: stop, and follow Section 3.",
      "On the final check, end with \"last check of this batch\" when that product's checks are finished for the day, or \"last check of this lot\" when all the day's checks are finished - that sends the records for review.",
      "When a check passes, look at the row on the screen and tap Accept.",
      "Never pull test a pouch that has just been sealed: the film is still warm.",
    ],
  },
  es: {
    heading: "Revisión de sellado desde la página Hoy",
    intro: "En la página Hoy, toque Registrar sellado en la fila del lote y luego Decir la revisión. El producto y el lote salen de la fila: diga solo la revisión.",
    lines: [],
    notes: [
      "Diga \"rechazada\" en lugar de \"aprobada\" cuando una revisión falle. Entonces se abre el registro: deténgase y siga la Sección 3.",
      "En la última revisión, termine con \"última revisión de esta tanda\" cuando ese producto ya terminó por hoy, o \"última revisión del lote\" cuando terminaron todas las revisiones del día: eso envía los registros a revisión.",
      "Cuando una revisión se aprueba, revise la fila en la pantalla y toque Aceptar.",
      "Nunca haga la prueba de jalón en una bolsa recién sellada: la película sigue caliente.",
    ],
  },
};
for (const lang of ["en", "es"] as VoiceLang[]) {
  SEAL_BUTTON_CARD[lang].lines = HANDS_FREE_CARD[lang].lines
    .map(line => ({ say: line.say.replace(/^[^,]*,\s*/, ""), does: line.does }))
    .filter(line => parseSealButton([line.say], lang)?.kind === "row")
    .map(line => ({ say: line.say.charAt(0).toUpperCase() + line.say.slice(1), does: line.does }));
}

// ─── The reminder ────────────────────────────────────────────────────────────

export const REMIND_EVERY_MS = 30 * 60 * 1000;

/**
 * When the next reminder is due. It counts from the latest of: when reminders were switched on,
 * the last row recorded (by voice, button or typing), and the last reminder given - so it never
 * sounds just after a check was entered, and never twice for one interval.
 */
export function nextReminderAt(startedAt: number, lastRowAt: number | null, lastRemindedAt: number | null): number {
  return Math.max(startedAt, lastRowAt ?? 0, lastRemindedAt ?? 0) + REMIND_EVERY_MS;
}

export function reminderDue(now: number, startedAt: number, lastRowAt: number | null, lastRemindedAt: number | null): boolean {
  return now >= nextReminderAt(startedAt, lastRowAt, lastRemindedAt);
}

// ─── Waiting quietly for a voice ─────────────────────────────────────────────

/**
 * Decides, from the microphone level alone, when somebody has started to speak.
 *
 * WHY. Android plays its own tone every time speech recognition starts or stops, and a page cannot
 * silence it. Kept running through silence, recognition gives up every few seconds and has to be
 * restarted, so the tone repeats all shift. Watching the level makes no sound; recognition is then
 * started only when there is a voice, and the tones come once around each thing that is said.
 *
 * The level is the RMS of the signal, 0 to 1. The threshold rides on the room: `floor` follows the
 * quiet frames, so a sealer running in the background raises it and a voice still stands out above
 * it. A burst has to last `needFrames` frames to count, which a click or a dropped pan does not.
 * `missed()` is called when a start turned out to be noise (recognition heard no words): the floor
 * is lifted to that level, so the same noise does not start it again.
 */
export interface VoiceGate {
  /** Feed one level reading. True on the frame speech is judged to have started. */
  push(level: number): boolean;
  /** The last start was not speech. */
  missed(): void;
  reset(): void;
  readonly floor: number;
}

export const VOICE_GATE = { frameMs: 50, needFrames: 3, ratio: 3, minLevel: 0.012, maxFloor: 0.25 } as const;

export function createVoiceGate(): VoiceGate {
  let floor = 0.004;
  let run = 0;
  let peak = 0;
  let lastStartLevel = 0;
  return {
    push(level) {
      const threshold = Math.max(floor * VOICE_GATE.ratio, VOICE_GATE.minLevel);
      if (level > threshold) {
        // A sound that simply goes on (a machine switched on) is the room, not a voice: the floor
        // creeps up to it over a few seconds. Speech comes in bursts and barely moves it.
        floor = Math.min(floor * 0.995 + level * 0.005, VOICE_GATE.maxFloor);
        run += 1;
        peak = Math.max(peak, level);
        if (run >= VOICE_GATE.needFrames) {
          lastStartLevel = peak;
          run = 0;
          peak = 0;
          return true;
        }
        return false;
      }
      run = 0;
      peak = 0;
      floor = Math.min(floor * 0.95 + level * 0.05, VOICE_GATE.maxFloor);
      return false;
    },
    missed() {
      // Just under the level that fooled it, so only something louder starts it next time.
      if (lastStartLevel > 0) floor = Math.min(Math.max(floor, lastStartLevel / VOICE_GATE.ratio), VOICE_GATE.maxFloor);
    },
    reset() { run = 0; peak = 0; },
    get floor() { return floor; },
  };
}

