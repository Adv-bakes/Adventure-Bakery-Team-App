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

import {
  CHECK_OPTIONS, VOICE_COMMANDS, applyVoiceFill, normalizeTranscript, parseNumber,
  type ApplyResult, type CheckOption, type VoiceFill,
} from "./voiceCommands";
import type { FillContext, FormSchema } from "./formSchema";
import { LEXICONS, type VoiceLang } from "./voiceLexicon";

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
