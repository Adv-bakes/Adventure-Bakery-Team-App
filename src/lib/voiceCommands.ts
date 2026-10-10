// Voice commands that fill a CCP monitoring record from one spoken line, in English or Spanish.
//
// WHY THIS EXISTS. An unrecorded CCP check is, to an auditor, a check that did not happen - and
// the operators already push back on the number of forms. So the operator taps the Manufacturing
// Coach mic and reads a line off a printed card on the wall: "Create a CCP Baking Record for Product
// X, Lot Y, Temperature 350 for 27 minutes. Passed." - or, in Spanish, "Registro de horneado, producto
// X, lote Y, temperatura 350 grados por 27 minutos. Aprobado." The right form opens with the row filled.
//
// ONE REGISTRY DRIVES THE PARSER AND THE PRINTED CARDS, per language. A card that says one thing while
// the parser listens for another is the failure that would make the operators give up on it, so each
// command's `text[lang].script` is the only source of both, and scripts/test-voice-commands.mjs parses
// every card's example back through the parser in every language.
//
// THE RECORD DOES NOT CHANGE LANGUAGE. Whatever was spoken, the row holds the English form's own values:
// "pass"/"fail", the FRM-606 check options, numbers as strings, codes as codes. The language only
// decides which words are listened for and which language the messages are shown in.
//
// DETERMINISTIC, NOT AI. The wording is fixed by the card, so a small grammar is enough, costs nothing
// per use, works the same every time, and can be tested. The word lists live in voiceLexicon.ts, one per
// language, never merged; every sentence shown to a person lives in voiceMessages.ts.
//
// THIS MODULE NEVER DECIDES WHAT GETS SAVED. It proposes a row. FormEntry puts it in the form unsaved,
// and the operator checks it and taps Save Draft. Lot codes in particular get misheard.
//
// Result types are flat objects with optional fields rather than `ok: true | false` unions: the app's
// tsconfig is not strict, and discriminated-union narrowing does not survive that.
//
// Pure: no Supabase, and only relative imports, so the node test can bundle it.

import { format } from "date-fns";
import {
  newGridRow,
  type FillContext, type FormField, type FormSchema, type GridField,
} from "./formSchema";
import { LEXICONS, RECOGNIZER_LANG, VOICE_LANGS, type Lexicon, type Token, type VoiceLang } from "./voiceLexicon";
import { VOICE_MSG } from "./voiceMessages";

export { RECOGNIZER_LANG, VOICE_LANGS };
export type { Token, VoiceLang };

/** Printed on every card, so a copy from before the Spanish cards can be spotted on the wall. */
export const VOICE_REGISTRY_VERSION = 3;

/** FRM-606's check column options, exactly as the form defines them. Every language maps onto these. */
export const CHECK_OPTIONS = ["Set-up", "In process", "After a change or adjustment", "End of run", "At boxing"] as const;
export type CheckOption = (typeof CHECK_OPTIONS)[number];

// ─── Types ───────────────────────────────────────────────────────────────────

export type VoiceCommandId = "ccp1_bake" | "ccp2_seal";

export type ScriptPart =
  | { text: string }
  | { slot: string; placeholder: string; example: string; optional?: boolean };

export interface VoiceWarning {
  level: "info" | "warn" | "fail";
  text: string;
  /** Form section to jump to, e.g. "deviation" for Section 3. */
  section?: string;
  code?: string;
}

export interface VoiceSummaryLine {
  key?: string;
  label: string;
  value: string;
  flag?: "check" | "pass" | "fail";
}

export interface VoiceFill {
  commandId: VoiceCommandId;
  formNumber: string;
  /** The form's own (English) title - it is the controlled document's name. */
  title: string;
  gridId: string;
  /** yyyy-MM-dd on the device, the same rule as a date field's defaultToday. */
  productionDate: string;
  /** `lot` is the day's lot code where the form asks for it once at the top (FRM-606); FRM-507 keeps it on the row. */
  entryFields: { product: string; lot?: string };
  /** Grid cells as the form stores them: numbers as strings, pass_fail as "pass" | "fail". */
  row: Record<string, string>;
  warnings: VoiceWarning[];
  summary: VoiceSummaryLine[];
  /** The language that was spoken, and the language the messages above are in. */
  lang?: VoiceLang;
  uiLang?: VoiceLang;
  /**
   * A row started from a lot's button on the Today page with no readings yet (the operator chose
   * to type them): the time, product and lot only. The entry page words its banner accordingly.
   */
  started?: boolean;
}

export type Slots = Record<string, unknown>;

/** Everything about a command that depends on the spoken language. */
export interface CommandText {
  /** "CCP Baking Record" / "Registro de horneado" */
  title: string;
  /** For "I heard …": "a CCP Baking Record" / "un registro de horneado" */
  heardAs: string;
  cardHeading: string;
  script: ScriptPart[];
  tips: string[];
  limitsText: string;
  /** Slot id -> the name used in "I didn't hear the …" messages. */
  slotNames: Record<string, string>;
  triggers: string[][];
  distinctive: string[];
  /** Where the product starts when the word "product" itself was not heard. */
  productAfter: string[][];
  anchors: {
    temp?: string[][];
    minutes?: string[];
    vacuum?: string[][];
    inches?: string[];
    visual?: string[][];
    pull?: string[][];
  };
  /** Typed as a full Record so the compiler insists every form option has phrases in every language. */
  checkPhrases?: Record<CheckOption, string[][]>;
}

export interface Extracted {
  slots: Slots;
  missing: string[];
  bad?: { slot: string; heard: string; range: [number, number] };
}

export interface VoiceCommandDef {
  id: VoiceCommandId;
  formNumber: string;
  formTitle: string;
  gridId: string;
  text: Record<VoiceLang, CommandText>;
  // English mirrors of text.en, kept for callers written before Spanish existed.
  title: string;
  cardHeading: string;
  script: ScriptPart[];
  tips: string[];
  slotLabels: Record<string, string>;
  triggers: string[][];
  distinctive: string[];
  extract(tokens: Token[], lang: VoiceLang): Extracted;
  build(slots: Slots, spokenAt: Date, uiLang: VoiceLang, spokenLang: VoiceLang): VoiceFill;
  /** When the form's printed limits no longer match what build() judges against. */
  limitsCheck?: { matches(schema: FormSchema): boolean; clearColumns: string[] };
}

export interface VoiceParse {
  ok: boolean;
  transcript: string;
  def?: VoiceCommandDef;
  /** The language the line was parsed in. */
  lang?: VoiceLang;
  /** Present when ok. */
  fill?: VoiceFill;
  /** Present when not ok. */
  reason?: "no_command" | "missing" | "bad_value";
  missing?: string[];
  message?: string;
}

type DefInput = Omit<VoiceCommandDef, "title" | "cardHeading" | "script" | "tips" | "slotLabels" | "triggers" | "distinctive">;

function defineCommand(d: DefInput): VoiceCommandDef {
  const en = d.text.en;
  return {
    ...d,
    title: en.title, cardHeading: en.cardHeading, script: en.script, tips: en.tips,
    slotLabels: en.slotNames, triggers: en.triggers, distinctive: en.distinctive,
  };
}

// ─── Language-dispatching primitives ─────────────────────────────────────────

export function normalizeTranscript(raw: string, lang: VoiceLang = "en"): Token[] {
  return LEXICONS[lang].normalize(raw);
}

/** The value inside the range, or what was heard when nothing fits, or null when no number at all. */
export function parseNumber(
  tokens: string[],
  spec: { range: [number, number]; hundredsShorthand?: boolean },
  lang: VoiceLang = "en",
): { value?: number; heard?: string } | null {
  const candidates = LEXICONS[lang].numberCandidates(tokens, spec);
  if (!candidates.length) return null;
  const fits = candidates.find(v => v >= spec.range[0] && v <= spec.range[1]);
  return fits !== undefined ? { value: fits } : { heard: String(candidates[candidates.length - 1]) };
}

/** "L zero nine one one dash one" / "ele cero nueve uno uno guion uno" -> "L0911-1". */
export function parseSpokenCode(tokens: Token[], lang: VoiceLang = "en"): string {
  return LEXICONS[lang].parseCode(tokens);
}

// ─── Matching helpers ────────────────────────────────────────────────────────

function findSeq(n: string[], seq: string[], from = 0): number {
  for (let i = from; i <= n.length - seq.length; i++) {
    if (seq.every((w, k) => n[i + k] === w)) return i;
  }
  return -1;
}

/** Earliest match of any of the sequences at or after `from`: [index, length]. */
function firstOf(n: string[], seqs: string[][] | undefined, from = 0): [number, number] {
  let best: [number, number] = [-1, 0];
  for (const seq of seqs ?? []) {
    const i = findSeq(n, seq, from);
    if (i >= 0 && (best[0] < 0 || i < best[0])) best = [i, seq.length];
  }
  return best;
}

/**
 * The match that ENDS last among those starting before `before`: [index, length]. On a tie the longer
 * match wins, so "número de lote 45" anchors on the whole phrase rather than on "lote" and does not leave
 * "número de" stuck to the end of the product name.
 */
function lastOf(n: string[], seqs: string[][], before: number): [number, number] {
  let best: [number, number] = [-1, 0];
  for (const seq of seqs) {
    for (let i = 0; i < before && i <= n.length - seq.length; i++) {
      if (!seq.every((w, k) => n[i + k] === w)) continue;
      const end = i + seq.length;
      const bestEnd = best[0] + best[1];
      if (best[0] < 0 || end > bestEnd || (end === bestEnd && i < best[0])) best = [i, seq.length];
    }
  }
  return best;
}

function indexOfAny(n: string[], words: string[] | undefined, from: number): number {
  let best = -1;
  for (const w of words ?? []) {
    const i = n.indexOf(w, from);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  return best;
}

/** The product the entry is for, compared loosely: accents, case, punctuation, a trailing plural. */
export function sameProduct(a: string, b: string): boolean {
  const norm = (s: string) => (s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().replace(/s$/, "");
  return norm(a) !== "" && norm(a) === norm(b);
}

/** Product sits between "product" (or the end of the trigger) and the last lot anchor. */
function productAndLot(n: string[], tokens: Token[], lotBefore: number, lex: Lexicon, text: CommandText) {
  const [lotAt, lotLen] = lastOf(n, lex.lotAnchors, lotBefore);
  const [prodAt, prodLen] = firstOf(n, lex.productAnchors);
  let prodStart = prodAt >= 0 ? prodAt + prodLen : -1;
  if (prodStart < 0) {
    const [afterAt, afterLen] = firstOf(n, text.productAfter);
    prodStart = afterAt >= 0 ? afterAt + afterLen : -1;
  }
  // With no lot heard, the product still ends where the next thing that WAS heard begins, so the
  // message names only the lot as missing rather than the product as well.
  const productEnd = lotAt > prodStart ? lotAt : lotBefore;
  const product = prodStart >= 0 && productEnd > prodStart ? lex.productName(tokens.slice(prodStart, productEnd)) : "";
  const lot = lotAt >= 0 ? lex.parseCode(tokens.slice(lotAt + lotLen, lotBefore)) : "";
  return { product, lot };
}

// ─── CCP 1: baking ───────────────────────────────────────────────────────────

/**
 * FRM-507 Section 1 prints these limits. The parser judges against the same numbers, and
 * `limitsCheck` refuses to judge at all if the form's printed limits ever stop matching them.
 */
export const CCP1_LIMITS = { ovenMinF: 350, bakeMinMinutes: 27, internalMinF: 180 } as const;

export function judgeBake(tempF: number, minutes: number): boolean {
  return tempF >= CCP1_LIMITS.ovenMinF && minutes >= CCP1_LIMITS.bakeMinMinutes;
}

const OVEN_RANGE: [number, number] = [100, 700];
const BAKE_RANGE: [number, number] = [1, 240];

const CCP1_TEXT: Record<VoiceLang, CommandText> = {
  en: {
    title: "CCP Baking Record",
    heardAs: "a CCP Baking Record",
    cardHeading: "CCP 1 — Oven load (FRM-507)",
    script: [
      { text: "Create a CCP Baking Record for Product " },
      { slot: "product", placeholder: "Product name", example: "Your Product" },
      { text: ", Lot " },
      { slot: "lot", placeholder: "Lot number", example: "L0911-1" },
      { text: ", Temperature " },
      { slot: "temp", placeholder: "°F", example: "350" },
      { text: " for " },
      { slot: "minutes", placeholder: "minutes", example: "27" },
      { text: " minutes. " },
      { slot: "result", placeholder: "Passed or Failed", example: "Passed", optional: true },
      { text: "." },
    ],
    tips: [
      "Read the line when the load comes out of the oven, not at the end of the shift.",
      "Say numbers plainly: \"three fifty\", \"twenty seven\".",
      "Spell the lot code a character at a time: \"L, zero, nine, one, one, dash, one\".",
      "The app decides Pass or Fail from the numbers. Check the row, then tap Save Draft.",
    ],
    limitsText: `Critical limits: oven at least ${CCP1_LIMITS.ovenMinF}°F and bake time at least ${CCP1_LIMITS.bakeMinMinutes} minutes. The app decides Pass or Fail from the numbers.`,
    slotNames: { product: "Product", lot: "Lot number", temp: "Oven temperature", minutes: "Bake time" },
    triggers: [["baking", "record"], ["bake", "record"], ["baking"], ["ccp", "1"]],
    distinctive: ["temperature", "temp", "minutes", "oven"],
    productAfter: [["record"]],
    anchors: {
      temp: [["oven", "temperature"], ["oven", "temp"], ["temperature"], ["temp"]],
      minutes: ["minutes"],
    },
  },
  es: {
    title: "Registro de horneado",
    heardAs: "un registro de horneado",
    cardHeading: "PCC 1 (CCP 1) — Hornada (FRM-507)",
    script: [
      { text: "Registro de horneado, producto " },
      { slot: "product", placeholder: "nombre del producto", example: "Su Producto" },
      { text: ", lote " },
      { slot: "lot", placeholder: "número de lote", example: "L0911-1" },
      { text: ", temperatura " },
      { slot: "temp", placeholder: "°F del horno", example: "350" },
      { text: " grados por " },
      { slot: "minutes", placeholder: "tiempo", example: "27" },
      { text: " minutos. " },
      { slot: "result", placeholder: "Aprobado o Rechazado", example: "Aprobado", optional: true },
      { text: "." },
    ],
    tips: [
      "Lea la línea cuando la hornada sale del horno, no al final del turno.",
      "Diga los números normalmente: \"trescientos cincuenta\", \"veintisiete\".",
      "Deletree el lote de uno en uno: \"ele, cero, nueve, uno, uno, guion, uno\".",
      "Diga el nombre del producto como aparece en la etiqueta.",
      "La app decide Aprobado o Rechazado con los números. Revise la fila y toque Save Draft.",
    ],
    limitsText: `Límites críticos: horno de al menos ${CCP1_LIMITS.ovenMinF} °F y tiempo de horneado de al menos ${CCP1_LIMITS.bakeMinMinutes} minutos. La app decide Aprobado o Rechazado con los números.`,
    slotNames: { product: "el producto", lot: "el número de lote", temp: "la temperatura del horno", minutes: "el tiempo de horneado" },
    triggers: [["registro", "de", "horneado"], ["registro", "de", "hornada"], ["horneado"], ["hornada"], ["horneo"], ["ccp", "1"]],
    distinctive: ["temperatura", "temp", "minutos", "horno", "grados"],
    productAfter: [["horneado"], ["hornada"], ["horneo"]],
    anchors: {
      temp: [["temperatura", "del", "horno"], ["temperatura", "de", "horno"], ["temperatura"], ["temp"]],
      minutes: ["minutos", "minutes"],
    },
  },
};

const CCP1 = defineCommand({
  id: "ccp1_bake",
  formNumber: "FRM-507",
  formTitle: "CCP 1 Baking Monitoring Record",
  gridId: "oven_loads",
  text: CCP1_TEXT,

  extract(tokens, lang) {
    const lex = LEXICONS[lang];
    const t = CCP1_TEXT[lang];
    const n = tokens.map(x => x.n);
    const missing: string[] = [];
    const [tempAt, tempLen] = firstOf(n, t.anchors.temp);
    const minutesAt = indexOfAny(n, t.anchors.minutes, tempAt >= 0 ? tempAt : 0);
    const { product, lot } = productAndLot(n, tokens, tempAt >= 0 ? tempAt : n.length, lex, t);

    let temp: number | undefined;
    let minutes: number | undefined;
    let bad: Extracted["bad"];
    if (tempAt >= 0) {
      const end = minutesAt >= 0 ? minutesAt : n.length;
      const span = n.slice(tempAt + tempLen, end);
      // The separator word between the two numbers ("for", "por"); English Chrome often writes "for" as "4".
      let split = -1;
      for (let i = span.length - 1; i >= 0; i--) if (lex.separators.has(span[i])) { split = i; break; }
      if (split < 0 && lex.digitSeparator) {
        const d = lex.digitSeparator;
        split = span.findIndex((w, i) => w === d && i > 0 && i < span.length - 1 && /^[\d:.]+$|^[a-z]+$/.test(span[i + 1])
          && lex.numberCandidates(span.slice(0, i), { range: OVEN_RANGE, hundredsShorthand: true }).length > 0);
      }
      if (split < 0) {
        const digits = span.map((w, i) => (/^\d+(\.\d+)?$|^\d{1,2}:\d{2}$/.test(w) ? i : -1)).filter(i => i >= 0);
        if (digits.length === 2) split = digits[1];
      }
      const isSeparator = (w: string) => lex.separators.has(w) || w === lex.digitSeparator;
      const tempSpan = split >= 0 ? span.slice(0, split) : span;
      const minSpan = split >= 0 ? span.slice(split + (isSeparator(span[split]) ? 1 : 0)) : [];
      const tv = parseNumber(tempSpan, { range: OVEN_RANGE, hundredsShorthand: true }, lang);
      if (tv?.value !== undefined) temp = tv.value;
      else if (tv?.heard !== undefined) bad = { slot: "temp", heard: tv.heard, range: OVEN_RANGE };
      if (minutesAt >= 0) {
        const mv = parseNumber(minSpan, { range: BAKE_RANGE }, lang);
        if (mv?.value !== undefined) {
          minutes = mv.value;
          // "veintisiete minutos y medio"
          if (lex.halfAfterUnit.some(seq => seq.every((w, k) => n[minutesAt + 1 + k] === w))) minutes += 0.5;
        }
        else if (mv?.heard !== undefined) bad = bad ?? { slot: "minutes", heard: mv.heard, range: BAKE_RANGE };
      }
    }
    if (!product) missing.push("product");
    if (!lot) missing.push("lot");
    if (temp === undefined && bad?.slot !== "temp") missing.push("temp");
    if (minutes === undefined && bad?.slot !== "minutes") missing.push("minutes");
    const result = lex.resultIn(n.slice(minutesAt >= 0 ? minutesAt : (tempAt >= 0 ? tempAt : 0)));
    return { slots: { product, lot, temp, minutes, result }, missing, bad };
  },

  build(slots, spokenAt, uiLang, spokenLang) {
    const M = VOICE_MSG[uiLang];
    const product = slots.product as string;
    const lot = slots.lot as string;
    const temp = slots.temp as number;
    const minutes = slots.minutes as number;
    const spoken = slots.result as "pass" | "fail" | undefined;
    const withinLimits = judgeBake(temp, minutes);
    // The app may turn a spoken Pass into a Fail. It never turns a spoken Fail into a Pass: the
    // operator saw something the numbers do not show.
    const verdict: "pass" | "fail" = spoken === "fail" ? "fail" : withinLimits ? "pass" : "fail";
    const warnings: VoiceWarning[] = [{ level: "info", code: "lot_check", text: M.lotCheck(lot) }];
    if (!withinLimits) {
      const misses: string[] = [];
      if (temp < CCP1_LIMITS.ovenMinF) misses.push(M.bakeTempMiss(temp, CCP1_LIMITS.ovenMinF));
      if (minutes < CCP1_LIMITS.bakeMinMinutes) misses.push(M.bakeTimeMiss(minutes, CCP1_LIMITS.bakeMinMinutes));
      warnings.push({ level: "fail", section: "deviation", code: "bake_limits_fail", text: M.bakeFail(spoken === "pass", misses) });
    } else if (spoken === "fail") {
      warnings.push({ level: "fail", section: "deviation", code: "spoken_fail", text: M.spokenFail });
    }
    return {
      commandId: "ccp1_bake",
      formNumber: "FRM-507",
      title: "CCP 1 Baking Monitoring Record",
      gridId: "oven_loads",
      productionDate: format(spokenAt, "yyyy-MM-dd"),
      entryFields: { product },
      row: {
        time_out: format(spokenAt, "HH:mm"),
        lot_code: lot,
        oven_temp: String(temp),
        bake_time: String(minutes),
        within_limits: verdict,
      },
      warnings,
      summary: [
        { key: "product", label: M.summary.product, value: product },
        { key: "lot", label: M.summary.lot, value: lot, flag: "check" },
        { key: "temp", label: M.summary.ovenTemp, value: M.summary.temp(temp), flag: temp >= CCP1_LIMITS.ovenMinF ? "pass" : "fail" },
        { key: "minutes", label: M.summary.bakeTime, value: M.summary.minutes(minutes), flag: minutes >= CCP1_LIMITS.bakeMinMinutes ? "pass" : "fail" },
        { key: "within_limits", label: M.summary.withinLimits, value: verdict === "pass" ? M.summary.pass : M.summary.fail, flag: verdict },
      ],
      lang: spokenLang,
      uiLang,
    };
  },

  limitsCheck: { matches: schema => limitsStillMatch(schema), clearColumns: ["within_limits"] },
});

/** True while FRM-507's printed limits still read 350°F and 27 minutes. */
export function limitsStillMatch(schema: FormSchema): boolean {
  const field = allFields(schema).find(f => f.id === "limits" && f.type === "reference_table") as { rows?: unknown } | undefined;
  if (!field) return false;
  const text = JSON.stringify(field.rows ?? []);
  return text.includes(`At least ${CCP1_LIMITS.ovenMinF}°F`) && text.includes(`At least ${CCP1_LIMITS.bakeMinMinutes} minutes`);
}

/** True while FRM-507 still prints 180°F for the internal temperature - asked only when a probe reading is recorded. */
export function probeLimitStillMatches(schema: FormSchema): boolean {
  const field = allFields(schema).find(f => f.id === "limits" && f.type === "reference_table") as { rows?: unknown } | undefined;
  return !!field && JSON.stringify(field.rows ?? []).includes(`At least ${CCP1_LIMITS.internalMinF}°F`);
}

// ─── CCP 1 from a lot's button on the Today page ─────────────────────────────
//
// The Today page lists each lot + product in progress, so the operator does not say them again:
// the button supplies both and only the readings are spoken - "Temperature 350, bake time 27",
// and "probe 180" when the load was probed. Same limits, same row, same rule that a spoken Fail is
// never turned into a Pass. Nothing here saves anything.

// A load just out of the oven is never under 100°F inside; the floor also keeps "one eighty" from being read as 81.
const PROBE_RANGE: [number, number] = [100, 300];

interface BakeReadingText {
  /** Longest first: on a tie at one position the first listed wins. */
  temp: string[][];
  minutes: string[][];
  probe: string[][];
  names: { temp: string; minutes: string; probe: string };
  /**
   * The closing phrase: "last load of this batch" / "... of this lot". A word of `opener` followed
   * within a few words by a word of `batch` or `lot` - loose on purpose, since the recogniser drops
   * and swaps the small words between them.
   */
  last: { opener: string[]; batch: string[]; lot: string[] };
  /** The line for the wall card and the dialog, and what the test parses back. */
  card: { heading: string; intro: string; say: string; sayWithProbe: string; examples: string[]; notes: string[] };
}

export const BAKE_READING_TEXT: Record<VoiceLang, BakeReadingText> = {
  en: {
    temp: [["oven", "temperature"], ["oven", "temp"], ["temperature"], ["temp"], ["oven"]],
    minutes: [["bake", "time"], ["baked", "time"], ["baking", "time"], ["time"], ["bake"], ["baked"]],
    probe: [["internal", "temperature"], ["internal", "temp"], ["probe"], ["internal"], ["core"]],
    names: { temp: "oven temperature", minutes: "bake time", probe: "probe reading" },
    last: { opener: ["last", "final"], batch: ["batch", "batches", "bash", "badge"], lot: ["lot", "lots"] },
    card: {
      heading: "Oven load from the Today page",
      intro: "On the Today page, tap Record bake on the lot's row, then Speak the reading. The product and the lot come from the row - say only the readings.",
      notes: [
        "Say the numbers you read at the oven. The app decides Pass or Fail from them.",
        `Critical limits: oven at least ${CCP1_LIMITS.ovenMinF}°F, bake time at least ${CCP1_LIMITS.bakeMinMinutes} minutes, and at least ${CCP1_LIMITS.internalMinF}°F inside when the load is probed.`,
        "Within the limits, check the row on the screen and tap Accept. If a limit is not met the record opens: do not release the load, follow Section 3.",
        "Say \"failed\" at the end if the load is not good for a reason the numbers do not show.",
        "On the final load, end with \"last load of this batch\" when that product is finished for the day, or \"last load of this lot\" when all the day's baking is finished - that sends the record for review.",
      ],
      say: "Temperature 350, bake time 27",
      sayWithProbe: "Temperature 350, bake time 27, probe 180",
      examples: [
        "Temperature 350, bake time 27", "Temperature 350, bake time 27, probe 180", "Temperature 350 for 27 minutes",
        "Temperature 350, bake time 27, last load of this batch", "Temperature 350, bake time 27, last load of this lot",
      ],
    },
  },
  es: {
    temp: [["temperatura", "del", "horno"], ["temperatura"], ["horno"]],
    minutes: [["tiempo", "de", "horneado"], ["tiempo", "de", "horneo"], ["tiempo"]],
    probe: [["temperatura", "interna"], ["sonda"], ["interna"], ["interno"], ["centro"]],
    names: { temp: "la temperatura del horno", minutes: "el tiempo de horneado", probe: "la lectura de la sonda" },
    last: { opener: ["ultima", "ultimo", "final"], batch: ["tanda", "bache", "batch"], lot: ["lote", "lotes"] },
    card: {
      heading: "Hornada desde la página Hoy",
      intro: "En la página Hoy, toque Registrar horneado en la fila del lote y luego Decir la lectura. El producto y el lote salen de la fila: diga solo las lecturas.",
      notes: [
        "Diga los números que leyó en el horno. La app decide Aprobado o Rechazado con ellos.",
        `Límites críticos: horno de al menos ${CCP1_LIMITS.ovenMinF} °F, tiempo de horneado de al menos ${CCP1_LIMITS.bakeMinMinutes} minutos, y al menos ${CCP1_LIMITS.internalMinF} °F por dentro cuando se mide con la sonda.`,
        "Dentro de los límites, revise la fila en la pantalla y toque Aceptar. Si no se cumple un límite se abre el registro: no libere la hornada, siga la Sección 3.",
        "Diga \"rechazado\" al final si la hornada no está bien por algo que los números no muestran.",
        "En la última hornada, termine con \"última hornada de esta tanda\" cuando ese producto ya terminó por hoy, o \"última hornada del lote\" cuando terminó todo el horneado del día: eso envía el registro a revisión.",
      ],
      say: "Temperatura 350, tiempo 27",
      sayWithProbe: "Temperatura 350, tiempo 27, sonda 180",
      examples: [
        "Temperatura 350, tiempo 27", "Temperatura 350, tiempo 27, sonda 180", "Temperatura 350 por 27 minutos",
        "Temperatura 350, tiempo 27, última hornada de esta tanda", "Temperatura 350, tiempo 27, última hornada del lote",
      ],
    },
  },
};

export interface BakeReading {
  ok: boolean;
  transcript: string;
  lang: VoiceLang;
  temp?: number;
  minutes?: number;
  /** Present only when a probe reading was said. */
  probe?: number;
  /** A result the operator said aloud. Only "fail" changes anything: a Pass is always the app's own. */
  spoken?: "pass" | "fail";
  /** The closing phrase, when it was said: this load is the last of the batch, or of the whole lot. */
  last?: LastLoad;
  /** Only the closing phrase was said, with no readings: it marks the load already recorded. */
  markOnly?: boolean;
  /** Present when not ok. */
  missing?: ("temp" | "minutes")[];
  message?: string;
}

/** Which "last load" a load is: of its batch (a product within the day's lot) or of the whole lot. */
export type LastLoad = "batch" | "lot";

/** FRM-507's Last load options (v3), exactly as the form defines them. Every language maps onto these. */
export const LAST_LOAD_VALUES: Record<LastLoad, string> = { batch: "Last load of this batch", lot: "Last load of this lot" };

/** One spoken line of readings. `lang` is the language spoken; `uiLang` the language of the message. */
export function parseBakeReading(transcript: string, lang: VoiceLang = "en", uiLang: VoiceLang = lang): BakeReading {
  const M = VOICE_MSG[uiLang];
  const lex = LEXICONS[lang];
  const t = BAKE_READING_TEXT[lang];
  const names = BAKE_READING_TEXT[uiLang].names;
  const tokens = normalizeTranscript(transcript, lang);
  const all = tokens.map(x => x.n);

  // The closing phrase is taken out first, so its words are not read as part of a number.
  let last: LastLoad | undefined;
  let n = all;
  for (let i = 0; i < all.length && !last; i++) {
    if (!t.last.opener.includes(all[i])) continue;
    for (let k = i + 1; k < Math.min(all.length, i + 6); k++) {
      const which: LastLoad | undefined = t.last.batch.includes(all[k]) ? "batch" : t.last.lot.includes(all[k]) ? "lot" : undefined;
      if (!which) continue;
      last = which;
      n = [...all.slice(0, i), ...all.slice(k + 1)];
      break;
    }
  }

  // The probe first, and its words masked: "internal temperature 180" must not be taken for the oven's.
  const [probeAt, probeLen] = firstOf(n, t.probe);
  const masked = n.map((w, i) => (probeAt >= 0 && i >= probeAt && i < probeAt + probeLen ? "\u0000" : w));
  const [tempAt, tempLen] = firstOf(masked, t.temp);
  const [minAt, minLen] = firstOf(masked, t.minutes);

  // Each reading is the words between its own name and the next name said.
  const marks = [
    { slot: "temp", at: tempAt, len: tempLen }, { slot: "minutes", at: minAt, len: minLen }, { slot: "probe", at: probeAt, len: probeLen },
  ].filter(m => m.at >= 0).sort((a, b) => a.at - b.at);
  const spans: Record<string, string[]> = {};
  marks.forEach((m, i) => { spans[m.slot] = n.slice(m.at + m.len, i + 1 < marks.length ? marks[i + 1].at : n.length); });
  // Words before the first name belong to the oven temperature when it was not named: "350, bake time 27".
  const lead = n.slice(0, marks.length ? marks[0].at : n.length);
  if (tempAt < 0) spans.temp = lead;

  // No name for the time: "350 for 27 minutes", or just the two numbers.
  if (minAt < 0 && spans.temp) {
    const span = spans.temp;
    let split = -1;
    for (let i = span.length - 1; i >= 0; i--) if (lex.separators.has(span[i])) { split = i; break; }
    if (split < 0 && lex.digitSeparator) {
      const d = lex.digitSeparator;
      split = span.findIndex((w, i) => w === d && i > 0 && i < span.length - 1
        && lex.numberCandidates(span.slice(0, i), { range: OVEN_RANGE, hundredsShorthand: true }).length > 0);
    }
    let after = split >= 0 ? split + 1 : -1;
    if (split < 0) {
      const digits = span.map((w, i) => (/^\d+(\.\d+)?$|^\d{1,2}:\d{2}$/.test(w) ? i : -1)).filter(i => i >= 0);
      if (digits.length === 2) { split = digits[1]; after = digits[1]; }
    }
    if (split >= 0) { spans.minutes = span.slice(after); spans.temp = span.slice(0, split); }
  }

  let bad: { slot: "temp" | "minutes" | "probe"; heard: string; range: [number, number] } | undefined;
  const read = (slot: "temp" | "minutes" | "probe", range: [number, number], hundreds = false): number | undefined => {
    if (!spans[slot]) return undefined;
    // A result said at the end ("... 27, failed") is not part of the number before it.
    const stop = spans[slot].findIndex(w => lex.resultIn([w]) !== undefined);
    const span = stop >= 0 ? spans[slot].slice(0, stop) : spans[slot];
    const v = parseNumber(span, { range, hundredsShorthand: hundreds }, lang);
    if (v?.value !== undefined) return v.value;
    if (v?.heard !== undefined) bad = bad ?? { slot, heard: v.heard, range };
    return undefined;
  };
  const temp = read("temp", OVEN_RANGE, true);
  const minutes = read("minutes", BAKE_RANGE);
  const probe = read("probe", PROBE_RANGE, true);
  const spoken = lex.resultIn(n);

  const base = { transcript, lang, temp, minutes, probe, spoken, last };
  if (bad) return { ...base, ok: false, message: M.badValue(bad.heard, names[bad.slot], bad.range) };
  // The closing phrase on its own: nothing to judge, it marks the load already recorded.
  if (last && temp === undefined && minutes === undefined && probe === undefined) return { ...base, ok: false, markOnly: true };
  const missing: ("temp" | "minutes")[] = [];
  if (temp === undefined) missing.push("temp");
  if (minutes === undefined) missing.push("minutes");
  if (missing.length) return { ...base, ok: false, missing, message: M.reading.missing(missing.map(m => names[m])) };
  return { ...base, ok: true };
}

/** Every alternative the recogniser offered: the first that reads whole, else the one that got furthest. */
export function parseBakeAlternatives(alternatives: string[], lang: VoiceLang = "en", uiLang: VoiceLang = lang): BakeReading {
  const results = alternatives.filter(a => a && a.trim()).map(a => parseBakeReading(a, lang, uiLang));
  if (!results.length) return parseBakeReading("", lang, uiLang);
  return results.find(r => r.ok) ?? results.find(r => r.markOnly)
    ?? [...results].sort((a, b) => (a.missing?.length ?? 0.5) - (b.missing?.length ?? 0.5))[0];
}

export interface BakeLot { product: string; lot: string }

/** The oven-load row for a lot, from readings that were spoken. The same row the card command builds. */
export function buildBakeFill(lot: BakeLot, reading: BakeReading, spokenAt: Date, uiLang: VoiceLang = "en"): VoiceFill {
  const M = VOICE_MSG[uiLang];
  const temp = reading.temp as number;
  const minutes = reading.minutes as number;
  const probe = reading.probe;
  const probeOk = probe === undefined || probe >= CCP1_LIMITS.internalMinF;
  const withinLimits = judgeBake(temp, minutes) && probeOk;
  const verdict: "pass" | "fail" = reading.spoken === "fail" ? "fail" : withinLimits ? "pass" : "fail";
  const warnings: VoiceWarning[] = [];
  if (!withinLimits) {
    const misses: string[] = [];
    if (temp < CCP1_LIMITS.ovenMinF) misses.push(M.bakeTempMiss(temp, CCP1_LIMITS.ovenMinF));
    if (minutes < CCP1_LIMITS.bakeMinMinutes) misses.push(M.bakeTimeMiss(minutes, CCP1_LIMITS.bakeMinMinutes));
    if (!probeOk) misses.push(M.bakeProbeMiss(probe as number, CCP1_LIMITS.internalMinF));
    warnings.push({ level: "fail", section: "deviation", code: "bake_limits_fail", text: M.bakeFail(reading.spoken === "pass", misses) });
  } else if (reading.spoken === "fail") {
    warnings.push({ level: "fail", section: "deviation", code: "spoken_fail", text: M.spokenFail });
  }
  const timeOut = format(spokenAt, "HH:mm");
  const row: Record<string, string> = {
    time_out: timeOut, lot_code: lot.lot, oven_temp: String(temp), bake_time: String(minutes), within_limits: verdict,
  };
  if (probe !== undefined) row.internal_temp = String(probe);
  if (reading.last) row.last_load = LAST_LOAD_VALUES[reading.last];
  const summary: VoiceSummaryLine[] = [
    { key: "time_out", label: M.summary.timeOut, value: timeOut },
    { key: "product", label: M.summary.product, value: lot.product },
    { key: "lot", label: M.summary.lot, value: lot.lot },
    { key: "temp", label: M.summary.ovenTemp, value: M.summary.temp(temp), flag: temp >= CCP1_LIMITS.ovenMinF ? "pass" : "fail" },
    { key: "minutes", label: M.summary.bakeTime, value: M.summary.minutes(minutes), flag: minutes >= CCP1_LIMITS.bakeMinMinutes ? "pass" : "fail" },
  ];
  if (probe !== undefined) summary.push({ key: "probe", label: M.summary.probe, value: M.summary.temp(probe), flag: probeOk ? "pass" : "fail" });
  summary.push({ key: "within_limits", label: M.summary.withinLimits, value: verdict === "pass" ? M.summary.pass : M.summary.fail, flag: verdict });
  if (reading.last) summary.push({ key: "last_load", label: M.summary.lastLoad, value: LAST_LOAD_VALUES[reading.last] });
  return {
    commandId: "ccp1_bake", formNumber: "FRM-507", title: "CCP 1 Baking Monitoring Record", gridId: "oven_loads",
    productionDate: format(spokenAt, "yyyy-MM-dd"), entryFields: { product: lot.product },
    row, warnings, summary, lang: reading.lang, uiLang,
  };
}

// The marks on loads already recorded. A lot is product + code, compared as everywhere else:
// the product loosely (sameProduct), the code without case, spaces or punctuation.
const sameLotCode = (a: unknown, b: unknown) => {
  const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return norm(a) !== "" && norm(a) === norm(b);
};
const ovenRows = (values: Record<string, unknown>): Record<string, unknown>[] =>
  Array.isArray(values.oven_loads) ? (values.oven_loads as Record<string, unknown>[]) : [];

/** True when this revision of FRM-507 has the Last load column (v3). Before it, nothing can be marked. */
export function hasLastLoadColumn(schema: FormSchema | null | undefined): boolean {
  const grid = schema ? allFields(schema).find(f => f.id === "oven_loads" && f.type === "grid") as GridField | undefined : undefined;
  return !!grid?.columns.some(c => c.id === "last_load");
}

/**
 * Mark the load recorded LAST for this batch (product + lot code) as its last load, or the lot's.
 * Null when the record has no load for the batch: there is nothing to put the mark on, and a mark
 * is never written on another product's row.
 */
export function markLastLoad(values: Record<string, unknown>, lot: BakeLot, which: LastLoad): { values: Record<string, unknown>; rowIndex: number; time: string } | null {
  const rows = ovenRows(values);
  let at = -1;
  rows.forEach((r, i) => { if (sameProduct(String(r?.product ?? ""), lot.product) && sameLotCode(r?.lot_code, lot.lot)) at = i; });
  if (at < 0) return null;
  const next = rows.map((r, i) => (i === at ? { ...r, last_load: LAST_LOAD_VALUES[which] } : r));
  return { values: { ...values, oven_loads: next }, rowIndex: at, time: String(rows[at]?.time_out ?? "") };
}

/**
 * "Baking not finished" for a batch: its own marks come off, and a "last load of this lot" on
 * another product's row becomes "of this batch" - the lot is no longer finished, but that
 * product still is. `changed` false means there was nothing to take back on this record.
 */
export function clearLastLoad(values: Record<string, unknown>, lot: BakeLot): { values: Record<string, unknown>; changed: boolean; lotReopened: boolean } {
  let changed = false;
  let lotReopened = false;
  const next = ovenRows(values).map(r => {
    const mark = String(r?.last_load ?? "");
    if (!mark || !sameLotCode(r?.lot_code, lot.lot)) return r;
    const mine = sameProduct(String(r?.product ?? ""), lot.product);
    if (mark === LAST_LOAD_VALUES.lot) lotReopened = true;
    if (mine) { changed = true; return { ...r, last_load: "" }; }
    if (mark === LAST_LOAD_VALUES.lot) { changed = true; return { ...r, last_load: LAST_LOAD_VALUES.batch }; }
    return r;
  });
  return { values: changed ? { ...values, oven_loads: next } : values, changed, lotReopened: changed && lotReopened };
}

/** A row for a lot with no readings yet: the operator chose to type them into the record. */
export function startedBakeFill(lot: BakeLot, at: Date, uiLang: VoiceLang = "en"): VoiceFill {
  return {
    commandId: "ccp1_bake", formNumber: "FRM-507", title: "CCP 1 Baking Monitoring Record", gridId: "oven_loads",
    productionDate: format(at, "yyyy-MM-dd"), entryFields: { product: lot.product },
    row: { time_out: format(at, "HH:mm"), lot_code: lot.lot },
    warnings: [], summary: [], uiLang, started: true,
  };
}

// ─── CCP 2: vacuum sealing ───────────────────────────────────────────────────

const VACUUM_RANGE: [number, number] = [0, 40];

const CCP2_TEXT: Record<VoiceLang, CommandText> = {
  en: {
    title: "CCP Sealing Record",
    heardAs: "a CCP Sealing Record",
    cardHeading: "CCP 2 — Sealing check (FRM-606)",
    script: [
      { text: "Create a CCP Sealing Record for Product " },
      { slot: "product", placeholder: "Product name", example: "Your Product" },
      { text: ", Lot " },
      { slot: "lot", placeholder: "Lot number", example: "L0911-1" },
      { text: ", " },
      { slot: "check", placeholder: "Set-up / In process / After adjustment / End of run / At boxing", example: "Set-up", optional: true },
      { text: ", Vacuum " },
      { slot: "vacuum", placeholder: "reading", example: "27", optional: true },
      { text: " inches, Visual " },
      { slot: "visual", placeholder: "passed or failed", example: "passed" },
      { text: "." },
    ],
    tips: [
      "Read the line at set-up, after any adjustment, and at the end of the run. Leave out the vacuum reading when the gauge was not read.",
      "At boxing, say \"At boxing, Pull test passed\" in place of the vacuum and visual. Never pull test a pouch that has just been sealed.",
      "Say the gauge reading as it shows: \"twenty seven\" or \"twenty seven point five\".",
      "Spell the lot code a character at a time: \"L, zero, nine, one, one, dash, one\".",
      "With the record open and Listening mode on, a short line is enough: \"Form 606, air check passed\".",
      "Any failed check stops the work. Check the row, then tap Save Draft.",
    ],
    limitsText: "The vacuum level and seal width are not yet confirmed for this machine, so the gauge reading is recorded but not judged. A failed visual check or pull test stops sealing.",
    slotNames: { product: "Product", lot: "Lot number", vacuum: "Vacuum reading", visual: "Visual check result", pull: "Pull test result" },
    triggers: [["sealing", "record"], ["seal", "record"], ["sealing"], ["ccp", "2"]],
    distinctive: ["vacuum", "pull", "visual", "inches"],
    productAfter: [["record"]],
    anchors: {
      vacuum: [["vacuum"]],
      inches: ["inches"],
      visual: [["visual"]],
      pull: [["pull", "test"], ["pool", "test"], ["poll", "test"], ["full", "test"], ["pull"]],
    },
    checkPhrases: {
      "Set-up": [["setup"]],
      "In process": [["in", "process"], ["in", "progress"], ["hourly"]],
      "After a change or adjustment": [["after", "a", "change", "or", "adjustment"], ["after", "adjustment"], ["after", "an", "adjustment"], ["after", "a", "change"], ["after", "change"]],
      "End of run": [["end", "of", "run"], ["end", "of", "the", "run"], ["end", "run"]],
      "At boxing": [["at", "boxing"], ["boxing"]],
    },
  },
  es: {
    title: "Registro de sellado",
    heardAs: "un registro de sellado",
    cardHeading: "PCC 2 (CCP 2) — Revisión de sellado (FRM-606)",
    script: [
      { text: "Registro de sellado, producto " },
      { slot: "product", placeholder: "nombre del producto", example: "Su Producto" },
      { text: ", lote " },
      { slot: "lot", placeholder: "número de lote", example: "L0911-1" },
      { text: ", " },
      { slot: "check", placeholder: "arranque / en proceso / después de ajuste / fin de corrida / al empacar", example: "arranque", optional: true },
      { text: ", vacío " },
      { slot: "vacuum", placeholder: "lectura", example: "27", optional: true },
      { text: " pulgadas, visual " },
      { slot: "visual", placeholder: "aprobado o rechazado", example: "aprobado" },
      { text: "." },
    ],
    tips: [
      "Lea la línea al arranque, después de cualquier ajuste y al fin de la corrida. Omita la lectura de vacío si no leyó el manómetro.",
      "Al empacar, diga \"al empacar, prueba de jalón aprobada\" en lugar del vacío y la visual. Nunca haga la prueba de jalón en una bolsa recién sellada.",
      "Con el registro abierto y el modo de escucha activado, basta una línea corta: \"Formulario 606, revisión de aire aprobada\".",
      "Diga la lectura del manómetro como aparece: \"veintisiete\" o \"veintisiete punto cinco\".",
      "Deletree el lote de uno en uno: \"ele, cero, nueve, uno, uno, guion, uno\".",
      "Diga el nombre del producto como aparece en la etiqueta.",
      "Una revisión rechazada detiene el trabajo. Revise la fila y toque Save Draft.",
    ],
    limitsText: "El nivel de vacío y el ancho del sello todavía no están confirmados para esta máquina: la lectura se registra pero no se evalúa. Una inspección visual o prueba de jalón rechazada detiene el sellado.",
    slotNames: {
      product: "el producto", lot: "el número de lote", vacuum: "la lectura de vacío",
      visual: "el resultado visual", pull: "el resultado de la prueba de jalón",
    },
    triggers: [["registro", "de", "sellado"], ["sellado"], ["sellar"], ["ccp", "2"]],
    distinctive: ["vacio", "pulgadas", "visual", "prueba", "jalon", "tiron"],
    productAfter: [["sellado"], ["sellar"]],
    anchors: {
      vacuum: [["vacio"]],
      inches: ["pulgadas", "inches"],
      visual: [["inspeccion", "visual"], ["revision", "visual"], ["prueba", "visual"], ["visual"]],
      pull: [
        ["prueba", "de", "jalon"], ["prueba", "de", "tiron"], ["prueba", "de", "halon"], ["prueba", "de", "jalar"],
        ["prueba", "de", "tirar"], ["prueba", "de", "tension"], ["pull", "test"], ["jalon"], ["tiron"],
      ],
    },
    checkPhrases: {
      "Set-up": [
        ["arranque"], ["puesta", "en", "marcha"], ["al", "inicio"], ["inicio", "de", "corrida"], ["inicio", "de", "la", "corrida"],
        ["inicio", "de", "produccion"], ["inicio", "de", "la", "produccion"], ["setup"],
      ],
      "In process": [["en", "proceso"], ["durante", "el", "proceso"], ["cada", "hora"], ["por", "hora"], ["in", "process"]],
      "After a change or adjustment": [
        ["despues", "de", "un", "ajuste"], ["despues", "de", "ajuste"], ["despues", "del", "ajuste"], ["despues", "de", "ajustar"],
        ["despues", "de", "un", "cambio"], ["despues", "del", "cambio"], ["despues", "de", "cambio"], ["tras", "un", "ajuste"],
        ["tras", "ajuste"], ["ajuste"],
      ],
      "End of run": [
        ["fin", "de", "corrida"], ["fin", "de", "la", "corrida"], ["final", "de", "corrida"], ["final", "de", "la", "corrida"],
        ["fin", "de", "produccion"], ["fin", "de", "la", "produccion"], ["final", "de", "produccion"],
        ["final", "de", "la", "produccion"], ["termino", "de", "la", "corrida"],
      ],
      "At boxing": [["al", "empacar"], ["en", "el", "empaque"], ["al", "encajar"], ["empaque"], ["at", "boxing"]],
    },
  },
};

const CCP2 = defineCommand({
  id: "ccp2_seal",
  formNumber: "FRM-606",
  formTitle: "CCP 2 Vacuum Sealing Monitoring Record",
  gridId: "seal_checks",
  text: CCP2_TEXT,

  extract(tokens, lang) {
    const lex = LEXICONS[lang];
    const t = CCP2_TEXT[lang];
    const n = tokens.map(x => x.n);
    const missing: string[] = [];
    const [vacAt] = firstOf(n, t.anchors.vacuum);
    let checkAt = -1;
    let check: CheckOption | undefined;
    for (const option of CHECK_OPTIONS) {
      const [i] = firstOf(n, t.checkPhrases?.[option]);
      if (i >= 0 && (checkAt < 0 || i < checkAt)) { checkAt = i; check = option; }
    }
    const [visAt, visLen] = firstOf(n, t.anchors.visual);
    const [pullAt, pullLen] = firstOf(n, t.anchors.pull);
    // The gauge reading and the pull test are each optional now, so the lot ends at whichever comes first.
    const lotEnd = [vacAt, checkAt, visAt, pullAt].filter(i => i >= 0).reduce((a, b) => Math.min(a, b), n.length);
    const { product, lot } = productAndLot(n, tokens, lotEnd, lex, t);

    let vacuum: number | undefined;
    let bad: Extracted["bad"];
    if (vacAt >= 0) {
      const stops = [indexOfAny(n, t.anchors.inches, vacAt), visAt > vacAt ? visAt : -1, pullAt > vacAt ? pullAt : -1].filter(i => i > vacAt);
      const end = stops.length ? Math.min(...stops) : n.length;
      const v = parseNumber(n.slice(vacAt + 1, end), { range: VACUUM_RANGE }, lang);
      if (v?.value !== undefined) vacuum = v.value;
      else if (v?.heard !== undefined) bad = { slot: "vacuum", heard: v.heard, range: VACUUM_RANGE };
    }
    const windowAfter = (at: number, len: number, other: number) => {
      const start = at + len;
      let end = start + lex.resultWindow;
      if (lex.stopResultAtNextAnchor && other > at) end = Math.min(end, other);
      return n.slice(start, end);
    };
    const visual = visAt >= 0 ? lex.resultIn(windowAfter(visAt, visLen, pullAt)) : undefined;
    const pull = pullAt >= 0 ? lex.resultIn(windowAfter(pullAt, pullLen, visAt)) : undefined;

    if (!product) missing.push("product");
    if (!lot) missing.push("lot");
    // A row carries the checks that were done: the visual at sealing, the pull test at boxing.
    // One of the two is the least a line can say. The gauge is read at set-up only.
    if (!visual && !pull) missing.push("visual");
    return { slots: { product, lot, check, vacuum, visual, pull }, missing, bad };
  },

  build(slots, spokenAt, uiLang, spokenLang) {
    const M = VOICE_MSG[uiLang];
    const product = slots.product as string;
    const lot = slots.lot as string;
    const vacuum = slots.vacuum as number | undefined;
    const visual = slots.visual as "pass" | "fail" | undefined;
    const pull = slots.pull as "pass" | "fail" | undefined;
    // A pull test is only ever done at boxing, so a line that gives one and no check type is that.
    const check = (slots.check as CheckOption | undefined) ?? (pull && !visual ? "At boxing" : undefined);
    const warnings: VoiceWarning[] = [{ level: "info", code: "lot_check", text: M.lotCheck(lot) }];
    if (vacuum !== undefined) warnings.push({ level: "info", code: "vacuum_unjudged", text: M.vacuumUnjudged });
    if (!check) warnings.push({ level: "warn", code: "pick_check", text: M.pickCheck });
    if (vacuum !== undefined && vacuum > 30) warnings.push({ level: "warn", code: "vacuum_high", text: M.vacuumHigh(vacuum) });
    if (visual === "fail" || pull === "fail") {
      warnings.push({ level: "fail", section: "deviation", code: "seal_fail", text: M.sealFail(visual === "fail", pull === "fail") });
    }
    const row: Record<string, string> = { time: format(spokenAt, "HH:mm") };
    if (vacuum !== undefined) row.vacuum_reading = String(vacuum);
    if (visual) row.visual = visual;
    if (pull) row.pull_test = pull;
    if (check) row.check = check;
    return {
      commandId: "ccp2_seal",
      formNumber: "FRM-606",
      title: "CCP 2 Vacuum Sealing Monitoring Record",
      gridId: "seal_checks",
      productionDate: format(spokenAt, "yyyy-MM-dd"),
      entryFields: { product, lot },
      row,
      warnings,
      summary: [
        { key: "product", label: M.summary.product, value: product },
        { key: "lot", label: M.summary.lot, value: lot, flag: "check" as const },
        { key: "check", label: M.summary.check, value: check ? M.summary.checkValue(check) : M.summary.pickInForm },
        ...(vacuum !== undefined ? [{ key: "vacuum", label: M.summary.vacuum, value: M.summary.inches(vacuum) }] : []),
        ...(visual ? [{ key: "visual", label: M.summary.visual, value: visual === "pass" ? M.summary.pass : M.summary.fail, flag: visual }] : []),
        ...(pull ? [{ key: "pull", label: M.summary.pull, value: pull === "pass" ? M.summary.pass : M.summary.fail, flag: pull }] : []),
      ],
      lang: spokenLang,
      uiLang,
    };
  },
});

export const VOICE_COMMANDS: VoiceCommandDef[] = [CCP1, CCP2];

// ─── Parsing ─────────────────────────────────────────────────────────────────

export function matchCommand(tokens: Token[], lang: VoiceLang = "en"): VoiceCommandDef | null {
  const n = tokens.map(t => t.n);
  const scored = VOICE_COMMANDS.map(def => {
    const t = def.text[lang];
    let score = t.triggers.some(seq => findSeq(n, seq) >= 0) ? 2 : 0;
    for (const word of t.distinctive) if (n.includes(word)) score += 1;
    return { def, score };
  }).sort((a, b) => b.score - a.score);
  if (!scored.length || scored[0].score < 2) return null;
  if (scored[1] && scored[1].score === scored[0].score) return null;
  return scored[0].def;
}

/** Parse one line. `lang` is the language it was spoken in; `uiLang` the language of the messages. */
export function parseCommand(
  transcript: string,
  spokenAt: Date = new Date(),
  lang: VoiceLang = "en",
  uiLang: VoiceLang = lang,
): VoiceParse {
  const M = VOICE_MSG[uiLang];
  const tokens = normalizeTranscript(transcript, lang);
  const def = matchCommand(tokens, lang);
  if (!def) {
    return { ok: false, reason: "no_command", transcript, lang, message: M.noCommand(VOICE_COMMANDS.map(d => d.text[uiLang].title)) };
  }
  const text = def.text[uiLang];
  const { slots, missing, bad } = def.extract(tokens, lang);
  if (bad) {
    return {
      ok: false, reason: "bad_value", def, transcript, lang, missing,
      message: M.badValue(bad.heard, text.slotNames[bad.slot] ?? bad.slot, bad.range),
    };
  }
  if (missing.length) {
    return {
      ok: false, reason: "missing", def, transcript, lang, missing,
      message: M.missing(text.heardAs, missing.map(m => text.slotNames[m] ?? m)),
    };
  }
  return { ok: true, def, fill: def.build(slots, spokenAt, uiLang, lang), transcript, lang };
}

/**
 * Try every alternative the recogniser offered. The first that parses wins; otherwise the failure
 * that got furthest, so the message names the fewest missing pieces.
 */
export function parseAlternatives(
  alternatives: string[],
  spokenAt: Date = new Date(),
  lang: VoiceLang = "en",
  uiLang: VoiceLang = lang,
): VoiceParse {
  const results = alternatives.filter(a => a && a.trim()).map(a => parseCommand(a, spokenAt, lang, uiLang));
  if (!results.length) return parseCommand("", spokenAt, lang, uiLang);
  const ok = results.find(r => r.ok);
  if (ok) return ok;
  const rank = (r: VoiceParse) => (r.ok ? 0 : r.reason === "no_command" ? 1000 : r.reason === "bad_value" ? 1 : 1 + (r.missing?.length ?? 0));
  return [...results].sort((a, b) => rank(a) - rank(b))[0];
}

/**
 * Parse in the preferred language, and only if nothing was recognised at all, try the other one. For
 * the typed box, and for someone who reads the English card with the Spanish switch on. The lexicons
 * are never merged: a line is parsed wholly in one language or wholly in the other.
 */
export function parseAnyLanguage(
  alternatives: string[],
  spokenAt: Date = new Date(),
  preferred: VoiceLang = "en",
  uiLang: VoiceLang = preferred,
): VoiceParse {
  const first = parseAlternatives(alternatives, spokenAt, preferred, uiLang);
  if (first.ok || first.reason !== "no_command") return first;
  const other: VoiceLang = preferred === "en" ? "es" : "en";
  const second = parseAlternatives(alternatives, spokenAt, other, uiLang);
  return second.ok || second.reason !== "no_command" ? second : first;
}

// ─── Applying a fill to an entry's values ────────────────────────────────────

function allFields(schema: FormSchema): FormField[] {
  return schema.sections.flatMap(s => s.fields ?? []);
}

const isBlankCell = (v: unknown) => v === undefined || v === null || v === "" || v === false;

export interface ApplyResult {
  ok: boolean;
  /** Present when not ok. */
  error?: string;
  values?: Record<string, unknown>;
  rowIndex?: number;
  appended?: boolean;
  gridLabel?: string;
  warnings?: VoiceWarning[];
}

/**
 * Put the spoken row into an entry's current values. Never saves anything.
 *
 * Fills the first row whose non-default cells are all blank - a new entry is born with one such
 * row, and leaving it empty beside an appended one would block Submit - otherwise appends. Every
 * row starts from newGridRow, so the time is the time the line was spoken (not when the draft was
 * created) and the initials are the person speaking.
 */
export function applyVoiceFill(
  schema: FormSchema,
  values: Record<string, unknown>,
  fill: VoiceFill,
  ctx: FillContext,
  uiLang: VoiceLang = "en",
): ApplyResult {
  const M = VOICE_MSG[uiLang];
  const grid = allFields(schema).find(f => f.id === fill.gridId && f.type === "grid") as GridField | undefined;
  if (!grid) return { ok: false, error: M.noTable(fill.gridId) };
  const warnings: VoiceWarning[] = [];
  const columnIds = new Set(grid.columns.map(c => c.id));
  const row: Record<string, string> = {};
  for (const [key, value] of Object.entries(fill.row)) {
    if (columnIds.has(key)) row[key] = value;
    else warnings.push({ level: "warn", code: "no_column", text: M.noColumn(key) });
  }
  // The day's lot: on the row where the form still asks for it per row (an entry filled on an
  // earlier revision), otherwise in the field at the top, below.
  const spokenLot = fill.entryFields.lot;
  if (spokenLot && columnIds.has("lot_code") && !row.lot_code) row.lot_code = spokenLot;
  // The product likewise: on the row where the table has a Product column (FRM-507 from v2, one
  // record for the day whatever is baked), otherwise in the field at the top, below.
  if (fill.entryFields.product && columnIds.has("product") && !row.product) row.product = fill.entryFields.product;

  const def = VOICE_COMMANDS.find(d => d.id === fill.commandId);
  // A row with no verdict to judge (one started by hand) has nothing to check against the form.
  const probed = fill.commandId === "ccp1_bake" && !!row.internal_temp;
  if (def?.limitsCheck && "within_limits" in row && (!def.limitsCheck.matches(schema) || (probed && !probeLimitStillMatches(schema)))) {
    for (const col of def.limitsCheck.clearColumns) if (col in row) row[col] = "";
    warnings.push({ level: "warn", code: "limits_changed", text: M.limitsChanged });
  }

  const existing = values[grid.id];
  const rows: Record<string, unknown>[] = Array.isArray(existing) ? [...(existing as Record<string, unknown>[])] : [];
  const judged = grid.columns.filter(c => !c.defaultTo);
  const target = rows.findIndex(r => judged.every(c => isBlankCell(r?.[c.id])));
  const merged: Record<string, unknown> = { ...(target >= 0 ? rows[target] : {}), ...newGridRow(grid, ctx), ...row };
  if (isBlankCell(merged.initials) && columnIds.has("initials")) {
    warnings.push({ level: "warn", code: "no_initials", text: M.noInitials });
  }
  let rowIndex: number;
  if (target >= 0) { rows[target] = merged; rowIndex = target; }
  else { rows.push(merged); rowIndex = rows.length - 1; }

  const next: Record<string, unknown> = { ...values, [grid.id]: rows };
  const hasProduct = allFields(schema).some(f => f.id === "product");
  if (hasProduct) {
    const current = String(values.product ?? "").trim();
    if (!current) next.product = fill.entryFields.product;
    else if (!sameProduct(current, fill.entryFields.product)) {
      warnings.push({ level: "warn", code: "product_mismatch", text: M.productMismatch(current, fill.entryFields.product) });
    }
  }
  if (spokenLot && allFields(schema).some(f => f.id === "lot_code")) {
    const current = String(values.lot_code ?? "").trim();
    const same = (a: string, b: string) => a.replace(/[^a-z0-9]/gi, "").toLowerCase() === b.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (!current) next.lot_code = spokenLot;
    else if (!same(current, spokenLot)) {
      warnings.push({ level: "warn", code: "lot_mismatch", text: M.lotMismatch(current, spokenLot) });
    }
  }
  const date = String(values.production_date ?? "");
  if (date && fill.productionDate && date !== fill.productionDate) {
    warnings.push({ level: "warn", code: "date_mismatch", text: M.dateMismatch(date, fill.productionDate) });
  }

  return { ok: true, values: next, rowIndex, appended: target < 0, gridLabel: grid.label, warnings };
}

// ─── The printed card ────────────────────────────────────────────────────────

/** The script with placeholders, e.g. "... Lot <Lot number>, ...". */
export function renderScript(def: VoiceCommandDef, lang: VoiceLang = "en"): string {
  return def.text[lang].script.map(p => ("text" in p ? p.text : `<${p.placeholder}>`)).join("");
}

/** The script with its example values - what the test feeds back through the parser. */
export function renderExample(def: VoiceCommandDef, lang: VoiceLang = "en"): string {
  return def.text[lang].script.map(p => ("text" in p ? p.text : p.example)).join("").replace(/\.\s*\.$/, ".");
}
