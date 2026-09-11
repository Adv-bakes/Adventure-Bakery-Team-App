// Voice commands that fill a CCP monitoring record from one spoken line.
//
// WHY THIS EXISTS. An unrecorded CCP check is, to an auditor, a check that did not happen - and
// the operators already push back on the number of forms. So the operator taps the Manufacturing
// Coach mic and reads a line off a printed card on the wall: "Create a CCP Baking Record for Product
// X, Lot Y, Temperature 350 for 27 minutes. Passed." The right form opens with the row filled in.
//
// THE SAME REGISTRY DRIVES THE PARSER AND THE PRINTED CARD. A card that says one thing while the
// parser listens for another is the failure that would make the operators give up on it, so
// `script` below is the only source of both, and scripts/test-voice-commands.mjs parses every
// card's example back through the parser.
//
// DETERMINISTIC, NOT AI. The wording is fixed by the card, so a small grammar is enough, costs
// nothing per use, works the same every time, and can be tested. What speech recognition actually
// does to the words - "3:50" for "three fifty", "past" for "passed", lot codes spelled letter by
// letter - is handled here explicitly.
//
// THIS MODULE NEVER DECIDES WHAT GETS SAVED. It proposes a row. FormEntry puts it in the form
// unsaved, and the operator checks it and taps Save Draft. Lot codes in particular get misheard.
//
// Pure: no Supabase, and only a relative import, so the node test can bundle it.
//
// Result types are flat objects with optional fields rather than `ok: true | false` unions: the
// app's tsconfig is not strict, and discriminated-union narrowing does not survive that.

import { format } from "date-fns";
import {
  newGridRow,
  type FillContext, type FormField, type FormSchema, type GridField,
} from "./formSchema";

export const VOICE_REGISTRY_VERSION = 1;

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
}

export interface VoiceSummaryLine {
  label: string;
  value: string;
  flag?: "check" | "pass" | "fail";
}

export interface VoiceFill {
  commandId: VoiceCommandId;
  formNumber: string;
  title: string;
  gridId: string;
  /** yyyy-MM-dd on the device, the same rule as a date field's defaultToday. */
  productionDate: string;
  entryFields: { product: string };
  /** Grid cells as the form stores them: numbers as strings, pass_fail as "pass" | "fail". */
  row: Record<string, string>;
  warnings: VoiceWarning[];
  summary: VoiceSummaryLine[];
}

export type Slots = Record<string, unknown>;

export interface VoiceCommandDef {
  id: VoiceCommandId;
  formNumber: string;
  title: string;
  cardHeading: string;
  gridId: string;
  script: ScriptPart[];
  tips: string[];
  /** Slot id -> the label used in "I didn't hear the ..." messages. */
  slotLabels: Record<string, string>;
  triggers: string[][];
  distinctive: string[];
  extract(tokens: Token[]): Extracted;
  build(slots: Slots, spokenAt: Date): VoiceFill;
  /** When the form's printed limits no longer match what build() judges against. */
  limitsCheck?: { matches(schema: FormSchema): boolean; clearColumns: string[]; message: string };
}

export interface Token { n: string; r: string }

export interface Extracted {
  slots: Slots;
  missing: string[];
  bad?: { slot: string; heard: string; range: [number, number] };
}

export interface VoiceParse {
  ok: boolean;
  transcript: string;
  def?: VoiceCommandDef;
  /** Present when ok. */
  fill?: VoiceFill;
  /** Present when not ok. */
  reason?: "no_command" | "missing" | "bad_value";
  missing?: string[];
  message?: string;
}

// ─── Normalisation ───────────────────────────────────────────────────────────

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/°\s*f\b/gi, " degrees "],
  [/°/g, " degrees "],
  [/\bdegrees?\s+fahrenheit\b/gi, " degrees "],
  [/\bfahrenheit\b/gi, " degrees "],
  [/\binches\s+of\s+mercury\b/gi, " inches "],
  [/\bin\.?\s*hg\b/gi, " inches "],
  [/\bhg\b/gi, " inches "],
  [/\binch\b/gi, " inches "],
  [/\b(mins?|minute)\b/gi, " minutes "],
  [/\bset[\s-]?up\b/gi, " setup "],
  [/\b(c\s*c\s*p|see\s+see\s+pee|cc\s+p|c\s+cp)\b/gi, " ccp "],
  [/\bccp\s*(1|one|won)\b/gi, " ccp 1 "],
  [/\bccp\s*(2|two|to|too)\b/gi, " ccp 2 "],
  [/\b(dash|hyphen)\b/gi, " - "],
];

/** Lower-cased tokens for matching, each paired with the spelling that was heard. */
export function normalizeTranscript(raw: string): Token[] {
  let s = ` ${raw ?? ""} `;
  for (const [re, to] of REPLACEMENTS) s = s.replace(re, to);
  s = s.replace(/[,!?;"“”]/g, " ");
  s = s.replace(/(?<!\d)\.|\.(?!\d)/g, " ");       // a full stop, but not a decimal point
  const out: Token[] = [];
  for (const piece of s.split(/\s+/).filter(Boolean)) {
    if (!piece.includes("-")) { out.push({ n: piece.toLowerCase(), r: piece }); continue; }
    const parts = piece.split("-");
    // twenty-seven is two number words; L0911-1 is a code whose hyphen must survive.
    if (parts.every(p => NUMBER_WORDS.has(p.toLowerCase()))) {
      for (const p of parts) out.push({ n: p.toLowerCase(), r: p });
      continue;
    }
    parts.forEach((p, i) => {
      if (i > 0) out.push({ n: "-", r: "-" });
      if (p) out.push({ n: p.toLowerCase(), r: p });
    });
  }
  return out;
}

// ─── Numbers ─────────────────────────────────────────────────────────────────

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
};
const TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const NUMBER_WORDS = new Set([...Object.keys(ONES), ...Object.keys(TEENS), ...Object.keys(TENS), "hundred"]);
const NUMBER_FILLER = new Set(["degrees", "minutes", "inches", "about", "approximately", "at", "is", "of", "reading", "the", "was"]);

interface NumberSpec { range: [number, number]; hundredsShorthand?: boolean }

/** Every plausible value a span of words or digits could mean. */
function numberCandidates(tokens: string[], spec: NumberSpec): number[] {
  const t = tokens.filter(x => !NUMBER_FILLER.has(x));
  if (!t.length) return [];
  const out: number[] = [];

  let half = 0;
  const halfAt = t.findIndex((x, i) => x === "and" && t[i + 1] === "a" && t[i + 2] === "half");
  const core = halfAt >= 0 ? t.slice(0, halfAt) : t;
  if (halfAt >= 0) half = 0.5;

  // Digits: "350", "27.5".
  if (core.length === 1 && /^\d+(\.\d+)?$/.test(core[0])) out.push(Number(core[0]) + half);
  // "3:50" - Chrome's rendering of "three fifty".
  const clock = core.length === 1 ? core[0].match(/^(\d{1,2}):(\d{2})$/) : null;
  if (clock) out.push(Number(`${clock[1]}${clock[2]}`));

  // Words, with "point" for decimals.
  const pointAt = core.indexOf("point");
  const whole = pointAt >= 0 ? core.slice(0, pointAt) : core;
  const frac = pointAt >= 0 ? core.slice(pointAt + 1) : [];
  if (whole.length && whole.every(w => NUMBER_WORDS.has(w) || w === "and")) {
    const words = whole.filter(w => w !== "and");
    let value = 0;
    for (const w of words) {
      if (w === "hundred") value = (value || 1) * 100;
      else value += ONES[w] ?? TEENS[w] ?? TENS[w] ?? 0;
    }
    let decimal = 0;
    if (frac.length && frac.every(w => w in ONES || /^\d$/.test(w))) {
      decimal = Number(`0.${frac.map(w => (w in ONES ? ONES[w] : w)).join("")}`);
    }
    out.push(value + decimal + half);
    // "three fifty" means 350 on an oven, not 53.
    if (spec.hundredsShorthand && words.length >= 2 && words[0] in ONES && ONES[words[0]] > 0
        && (words[1] in TENS || words[1] in TEENS) && !words.includes("hundred")) {
      const rest = words.slice(1).reduce((sum, w) => sum + (TENS[w] ?? TEENS[w] ?? ONES[w] ?? 0), 0);
      out.push(ONES[words[0]] * 100 + rest + half);
    }
  }
  return out;
}

/** The value inside the range, or what was heard when nothing fits, or null when no number at all. */
export function parseNumber(tokens: string[], spec: NumberSpec): { value?: number; heard?: string } | null {
  const candidates = numberCandidates(tokens, spec);
  if (!candidates.length) return null;
  const fits = candidates.find(v => v >= spec.range[0] && v <= spec.range[1]);
  return fits !== undefined ? { value: fits } : { heard: String(candidates[candidates.length - 1]) };
}

// ─── Lot codes ───────────────────────────────────────────────────────────────

const LETTER_NAMES: Record<string, string> = {
  ay: "A", bee: "B", be: "B", see: "C", sea: "C", dee: "D", ee: "E", ef: "F", eff: "F", gee: "G",
  aitch: "H", eye: "I", jay: "J", kay: "K", el: "L", ell: "L", em: "M", en: "N", pee: "P", cue: "Q",
  queue: "Q", ar: "R", are: "R", es: "S", ess: "S", tee: "T", tea: "T", you: "U", vee: "V",
  ex: "X", why: "Y", zee: "Z", zed: "Z",
  alpha: "A", alfa: "A", bravo: "B", charlie: "C", delta: "D", echo: "E", foxtrot: "F", golf: "G",
  hotel: "H", india: "I", juliet: "J", kilo: "K", lima: "L", mike: "M", november: "N", oscar: "O",
  papa: "P", quebec: "Q", romeo: "R", sierra: "S", tango: "T", uniform: "U", victor: "V",
  whiskey: "W", xray: "X", yankee: "Y", zulu: "Z",
};
const CODE_FILLER = new Set(["number", "code", "no", "is", "#", "of"]);

/** "L zero nine one one dash one" -> "L0911-1". */
export function parseSpokenCode(tokens: Token[]): string {
  let out = "";
  let repeat = 1;
  for (let i = 0; i < tokens.length; i++) {
    const { n, r } = tokens[i];
    if (CODE_FILLER.has(n) && out === "") continue;
    let piece: string;
    if (n === "-") piece = "-";
    else if (n === "double") { repeat = 2; continue; }
    else if (n === "triple") { repeat = 3; continue; }
    else if (n === "oh") piece = "0";
    else if (n in ONES) piece = String(ONES[n]);
    else if (n in TEENS) piece = String(TEENS[n]);
    else if (n in TENS) {
      const next = tokens[i + 1]?.n;
      if (next && next in ONES && ONES[next] > 0) { piece = String(TENS[n] + ONES[next]); i++; }
      else piece = String(TENS[n]);
    }
    else if (n in LETTER_NAMES) piece = LETTER_NAMES[n];
    else piece = r.toUpperCase();
    out += piece.repeat(repeat);
    repeat = 1;
  }
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

// ─── Pass / fail words ───────────────────────────────────────────────────────

const PASS_WORDS = new Set(["passed", "pass", "past", "passes", "passing"]);
const FAIL_WORDS = new Set(["failed", "fail", "fails", "failing", "fell"]);

function resultIn(tokens: string[]): "pass" | "fail" | undefined {
  let found: "pass" | "fail" | undefined;
  for (const t of tokens) {
    if (PASS_WORDS.has(t)) found = "pass";
    else if (FAIL_WORDS.has(t)) found = "fail";
  }
  return found;
}

// ─── Matching helpers ────────────────────────────────────────────────────────

function findSeq(n: string[], seq: string[], from = 0): number {
  for (let i = from; i <= n.length - seq.length; i++) {
    if (seq.every((w, k) => n[i + k] === w)) return i;
  }
  return -1;
}

/** Earliest match of any of the sequences at or after `from`: [index, length]. */
function firstOf(n: string[], seqs: string[][], from = 0): [number, number] {
  let best: [number, number] = [-1, 0];
  for (const seq of seqs) {
    const i = findSeq(n, seq, from);
    if (i >= 0 && (best[0] < 0 || i < best[0])) best = [i, seq.length];
  }
  return best;
}

/** Last match of any of the sequences that STARTS before `before`: [index, length]. */
function lastOf(n: string[], seqs: string[][], before: number): [number, number] {
  let best: [number, number] = [-1, 0];
  for (const seq of seqs) {
    for (let i = 0; i < before && i <= n.length - seq.length; i++) {
      if (seq.every((w, k) => n[i + k] === w) && i > best[0]) best = [i, seq.length];
    }
  }
  return best;
}

function productName(tokens: Token[]): string {
  const words = tokens.map(t => t.r).filter(w => w !== "-");
  while (words.length && /^(for|the|a)$/i.test(words[0])) words.shift();
  while (words.length && /^(for|the)$/i.test(words[words.length - 1])) words.pop();
  const name = words.join(" ").trim();
  // Speech recognition returns most words lower-case; a record should not read "sample loaf".
  return name === name.toLowerCase() ? name.replace(/\b\w/g, c => c.toUpperCase()) : name;
}

/** The product the entry is for, compared loosely: case, punctuation, a trailing plural. */
export function sameProduct(a: string, b: string): boolean {
  const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().replace(/s$/, "");
  return norm(a) !== "" && norm(a) === norm(b);
}

const PRODUCT_ANCHOR = [["product"]];
const LOT_ANCHORS = [["lot", "number"], ["lot", "code"], ["lot"], ["batch", "number"], ["batch"]];

/** Product sits between "product" (or the end of the trigger) and the last lot anchor. */
function productAndLot(n: string[], tokens: Token[], lotBefore: number) {
  const [lotAt, lotLen] = lastOf(n, LOT_ANCHORS, lotBefore);
  const [prodAt] = firstOf(n, PRODUCT_ANCHOR);
  let prodStart = prodAt >= 0 ? prodAt + 1 : -1;
  if (prodStart < 0) {
    const rec = n.indexOf("record");
    prodStart = rec >= 0 ? rec + 1 : -1;
  }
  // With no lot heard, the product still ends where the next thing that WAS heard begins, so the
  // message names only the lot as missing rather than the product as well.
  const productEnd = lotAt > prodStart ? lotAt : lotBefore;
  const product = prodStart >= 0 && productEnd > prodStart ? productName(tokens.slice(prodStart, productEnd)) : "";
  const lot = lotAt >= 0 ? parseSpokenCode(tokens.slice(lotAt + lotLen, lotBefore)) : "";
  return { product, lot };
}

// ─── CCP 1: baking ───────────────────────────────────────────────────────────

/**
 * FRM-507 Section 1 prints these limits. The parser judges against the same numbers, and
 * `limitsCheck` refuses to judge at all if the form's printed limits ever stop matching them.
 */
export const CCP1_LIMITS = { ovenMinF: 350, bakeMinMinutes: 27 } as const;

export function judgeBake(tempF: number, minutes: number): boolean {
  return tempF >= CCP1_LIMITS.ovenMinF && minutes >= CCP1_LIMITS.bakeMinMinutes;
}

const TEMP_ANCHORS = [["oven", "temperature"], ["oven", "temp"], ["temperature"], ["temp"]];
const OVEN_RANGE: [number, number] = [100, 700];
const BAKE_RANGE: [number, number] = [1, 240];

const CCP1: VoiceCommandDef = {
  id: "ccp1_bake",
  formNumber: "FRM-507",
  title: "CCP Baking Record",
  cardHeading: "CCP 1 — Oven load (FRM-507)",
  gridId: "oven_loads",
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
  slotLabels: { product: "Product", lot: "Lot number", temp: "Oven temperature", minutes: "Bake time" },
  triggers: [["baking", "record"], ["bake", "record"], ["baking"], ["ccp", "1"]],
  distinctive: ["temperature", "temp", "minutes", "oven"],

  extract(tokens) {
    const n = tokens.map(t => t.n);
    const missing: string[] = [];
    const [tempAt, tempLen] = firstOf(n, TEMP_ANCHORS);
    const minutesAt = n.indexOf("minutes", tempAt >= 0 ? tempAt : 0);
    const { product, lot } = productAndLot(n, tokens, tempAt >= 0 ? tempAt : n.length);

    let temp: number | undefined;
    let minutes: number | undefined;
    let bad: Extracted["bad"];
    if (tempAt >= 0) {
      const end = minutesAt >= 0 ? minutesAt : n.length;
      const span = n.slice(tempAt + tempLen, end);
      // "for" separates the two numbers; Chrome often writes it as "4".
      let split = span.lastIndexOf("for");
      if (split < 0) {
        split = span.findIndex((w, i) => w === "4" && i > 0 && i < span.length - 1 && /^[\d:.]+$|^[a-z]+$/.test(span[i + 1])
          && numberCandidates(span.slice(0, i), { range: OVEN_RANGE, hundredsShorthand: true }).length > 0);
      }
      if (split < 0) {
        const digits = span.map((w, i) => (/^\d+(\.\d+)?$|^\d{1,2}:\d{2}$/.test(w) ? i : -1)).filter(i => i >= 0);
        if (digits.length === 2) split = digits[1];
      }
      const tempSpan = split >= 0 ? span.slice(0, split) : span;
      const minSpan = split >= 0 ? span.slice(split + (span[split] === "for" || span[split] === "4" ? 1 : 0)) : [];
      const t = parseNumber(tempSpan, { range: OVEN_RANGE, hundredsShorthand: true });
      if (t?.value !== undefined) temp = t.value;
      else if (t?.heard !== undefined) bad = { slot: "temp", heard: t.heard, range: OVEN_RANGE };
      if (minutesAt >= 0) {
        const m = parseNumber(minSpan, { range: BAKE_RANGE });
        if (m?.value !== undefined) minutes = m.value;
        else if (m?.heard !== undefined) bad = bad ?? { slot: "minutes", heard: m.heard, range: BAKE_RANGE };
      }
    }
    if (!product) missing.push("product");
    if (!lot) missing.push("lot");
    if (temp === undefined && bad?.slot !== "temp") missing.push("temp");
    if (minutes === undefined && bad?.slot !== "minutes") missing.push("minutes");
    const result = resultIn(n.slice(minutesAt >= 0 ? minutesAt : (tempAt >= 0 ? tempAt : 0)));
    return { slots: { product, lot, temp, minutes, result }, missing, bad };
  },

  build(slots, spokenAt) {
    const product = slots.product as string;
    const lot = slots.lot as string;
    const temp = slots.temp as number;
    const minutes = slots.minutes as number;
    const spoken = slots.result as "pass" | "fail" | undefined;
    const withinLimits = judgeBake(temp, minutes);
    // The app may turn a spoken Pass into a Fail. It never turns a spoken Fail into a Pass: the
    // operator saw something the numbers do not show.
    const verdict: "pass" | "fail" = spoken === "fail" ? "fail" : withinLimits ? "pass" : "fail";
    const warnings: VoiceWarning[] = [
      { level: "info", text: `Check the lot code "${lot}" against the label before saving.` },
    ];
    if (!withinLimits) {
      const misses: string[] = [];
      if (temp < CCP1_LIMITS.ovenMinF) misses.push(`oven temperature ${temp}°F is below the ${CCP1_LIMITS.ovenMinF}°F limit`);
      if (minutes < CCP1_LIMITS.bakeMinMinutes) misses.push(`bake time ${minutes} minutes is under the ${CCP1_LIMITS.bakeMinMinutes}-minute limit`);
      const said = spoken === "pass" ? "You said Passed, but the " : "The ";
      warnings.push({
        level: "fail",
        section: "deviation",
        text: `${said}${misses.join(" and ")}. Recorded as FAIL. Do not release this load - follow Section 3.`,
      });
    } else if (spoken === "fail") {
      warnings.push({
        level: "fail",
        section: "deviation",
        text: "You said Failed. The readings are within the limits, but the row is recorded as FAIL as you said. Add a note saying why, and follow Section 3.",
      });
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
        { label: "Product", value: product },
        { label: "Lot", value: lot, flag: "check" },
        { label: "Oven temperature", value: `${temp}°F`, flag: temp >= CCP1_LIMITS.ovenMinF ? "pass" : "fail" },
        { label: "Bake time", value: `${minutes} min`, flag: minutes >= CCP1_LIMITS.bakeMinMinutes ? "pass" : "fail" },
        { label: "Within critical limits", value: verdict === "pass" ? "PASS" : "FAIL", flag: verdict },
      ],
    };
  },

  limitsCheck: {
    matches: schema => limitsStillMatch(schema),
    clearColumns: ["within_limits"],
    message: "The critical limits printed on this form have changed, so the app has not judged Pass or Fail. Judge this row against the form's limits yourself.",
  },
};

/** True while FRM-507's printed limits still read 350°F and 27 minutes. */
export function limitsStillMatch(schema: FormSchema): boolean {
  const field = allFields(schema).find(f => f.id === "limits" && f.type === "reference_table") as { rows?: unknown } | undefined;
  if (!field) return false;
  const text = JSON.stringify(field.rows ?? []);
  return text.includes(`At least ${CCP1_LIMITS.ovenMinF}°F`) && text.includes(`At least ${CCP1_LIMITS.bakeMinMinutes} minutes`);
}

// ─── CCP 2: vacuum sealing ───────────────────────────────────────────────────

const CHECK_PHRASES: Array<{ value: string; phrases: string[][] }> = [
  { value: "Set-up", phrases: [["setup"]] },
  { value: "Hourly", phrases: [["hourly"], ["hourly", "check"]] },
  { value: "After a change or adjustment", phrases: [["after", "a", "change", "or", "adjustment"], ["after", "adjustment"], ["after", "an", "adjustment"], ["after", "a", "change"], ["after", "change"]] },
  { value: "End of run", phrases: [["end", "of", "run"], ["end", "of", "the", "run"], ["end", "run"]] },
];
const VACUUM_RANGE: [number, number] = [0, 40];
const PULL_ANCHORS = [["pull", "test"], ["pool", "test"], ["poll", "test"], ["full", "test"], ["pull"]];

const CCP2: VoiceCommandDef = {
  id: "ccp2_seal",
  formNumber: "FRM-606",
  title: "CCP Sealing Record",
  cardHeading: "CCP 2 — Sealing check (FRM-606)",
  gridId: "seal_checks",
  script: [
    { text: "Create a CCP Sealing Record for Product " },
    { slot: "product", placeholder: "Product name", example: "Your Product" },
    { text: ", Lot " },
    { slot: "lot", placeholder: "Lot number", example: "L0911-1" },
    { text: ", " },
    { slot: "check", placeholder: "Set-up / Hourly / After adjustment / End of run", example: "Hourly", optional: true },
    { text: ", Vacuum " },
    { slot: "vacuum", placeholder: "reading", example: "27" },
    { text: " inches, Visual " },
    { slot: "visual", placeholder: "passed or failed", example: "passed" },
    { text: ", Pull test " },
    { slot: "pull", placeholder: "passed or failed", example: "passed" },
    { text: "." },
  ],
  tips: [
    "Read the line at set-up, every hour, after any adjustment, and at the end of the run.",
    "Say the gauge reading as it shows: \"twenty seven\" or \"twenty seven point five\".",
    "Spell the lot code a character at a time: \"L, zero, nine, one, one, dash, one\".",
    "Any failed check stops sealing. Check the row, then tap Save Draft.",
  ],
  slotLabels: { product: "Product", lot: "Lot number", vacuum: "Vacuum reading", visual: "Visual check result", pull: "Pull test result" },
  triggers: [["sealing", "record"], ["seal", "record"], ["sealing"], ["ccp", "2"]],
  distinctive: ["vacuum", "pull", "visual", "inches"],

  extract(tokens) {
    const n = tokens.map(t => t.n);
    const missing: string[] = [];
    const [vacAt] = firstOf(n, [["vacuum"]]);
    let checkAt = -1;
    let check: string | undefined;
    for (const c of CHECK_PHRASES) {
      const [i] = firstOf(n, c.phrases);
      if (i >= 0 && (checkAt < 0 || i < checkAt)) { checkAt = i; check = c.value; }
    }
    const lotEnd = [vacAt, checkAt].filter(i => i >= 0).reduce((a, b) => Math.min(a, b), n.length);
    const { product, lot } = productAndLot(n, tokens, lotEnd);

    const [visAt] = firstOf(n, [["visual"]]);
    const [pullAt, pullLen] = firstOf(n, PULL_ANCHORS);
    let vacuum: number | undefined;
    let bad: Extracted["bad"];
    if (vacAt >= 0) {
      const stops = [n.indexOf("inches", vacAt), visAt > vacAt ? visAt : -1, pullAt > vacAt ? pullAt : -1].filter(i => i > vacAt);
      const end = stops.length ? Math.min(...stops) : n.length;
      const v = parseNumber(n.slice(vacAt + 1, end), { range: VACUUM_RANGE });
      if (v?.value !== undefined) vacuum = v.value;
      else if (v?.heard !== undefined) bad = { slot: "vacuum", heard: v.heard, range: VACUUM_RANGE };
    }
    const visual = visAt >= 0 ? resultIn(n.slice(visAt + 1, visAt + 4)) : undefined;
    const pull = pullAt >= 0 ? resultIn(n.slice(pullAt + pullLen, pullAt + pullLen + 3)) : undefined;

    if (!product) missing.push("product");
    if (!lot) missing.push("lot");
    if (vacuum === undefined && !bad) missing.push("vacuum");
    if (!visual) missing.push("visual");
    if (!pull) missing.push("pull");
    return { slots: { product, lot, check, vacuum, visual, pull }, missing, bad };
  },

  build(slots, spokenAt) {
    const product = slots.product as string;
    const lot = slots.lot as string;
    const check = slots.check as string | undefined;
    const vacuum = slots.vacuum as number;
    const visual = slots.visual as "pass" | "fail";
    const pull = slots.pull as "pass" | "fail";
    const warnings: VoiceWarning[] = [
      { level: "info", text: `Check the lot code "${lot}" against the label before saving.` },
      { level: "info", text: "The vacuum limit is not yet confirmed for this machine, so the reading is recorded but not judged." },
    ];
    if (!check) {
      warnings.push({ level: "warn", text: "Pick the check type in the row: Set-up, Hourly, After a change or adjustment, or End of run." });
    }
    if (vacuum > 30) {
      warnings.push({ level: "warn", text: `A vacuum reading of ${vacuum} in. Hg is higher than a sealer can pull. Was it misheard? Check the gauge.` });
    }
    const failed = [visual === "fail" ? "the visual check" : "", pull === "fail" ? "the pull test" : ""].filter(Boolean);
    if (failed.length) {
      warnings.push({
        level: "fail",
        section: "deviation",
        text: `${failed.join(" and ")} failed. Stop sealing, hold everything sealed since the last check that passed, and follow Section 3.`.replace(/^t/, "T"),
      });
    }
    const row: Record<string, string> = {
      time: format(spokenAt, "HH:mm"),
      lot_code: lot,
      vacuum_reading: String(vacuum),
      visual,
      pull_test: pull,
    };
    if (check) row.check = check;
    return {
      commandId: "ccp2_seal",
      formNumber: "FRM-606",
      title: "CCP 2 Vacuum Sealing Monitoring Record",
      gridId: "seal_checks",
      productionDate: format(spokenAt, "yyyy-MM-dd"),
      entryFields: { product },
      row,
      warnings,
      summary: [
        { label: "Product", value: product },
        { label: "Lot", value: lot, flag: "check" },
        { label: "Check", value: check ?? "— pick in the form" },
        { label: "Vacuum gauge", value: `${vacuum} in. Hg` },
        { label: "Visual", value: visual === "pass" ? "PASS" : "FAIL", flag: visual },
        { label: "Pull test", value: pull === "pass" ? "PASS" : "FAIL", flag: pull },
      ],
    };
  },
};

export const VOICE_COMMANDS: VoiceCommandDef[] = [CCP1, CCP2];

// ─── Parsing ─────────────────────────────────────────────────────────────────

export function matchCommand(tokens: Token[]): VoiceCommandDef | null {
  const n = tokens.map(t => t.n);
  const scored = VOICE_COMMANDS.map(def => {
    let score = def.triggers.some(seq => findSeq(n, seq) >= 0) ? 2 : 0;
    for (const word of def.distinctive) if (n.includes(word)) score += 1;
    return { def, score };
  }).sort((a, b) => b.score - a.score);
  if (!scored.length || scored[0].score < 2) return null;
  if (scored[1] && scored[1].score === scored[0].score) return null;
  return scored[0].def;
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function parseCommand(transcript: string, spokenAt: Date = new Date()): VoiceParse {
  const tokens = normalizeTranscript(transcript);
  const def = matchCommand(tokens);
  if (!def) {
    const starts = VOICE_COMMANDS.map(d => `"Create a ${d.title}"`).join(" or ");
    return { ok: false, reason: "no_command", transcript, message: `I didn't hear a command. Start with ${starts}.` };
  }
  const { slots, missing, bad } = def.extract(tokens);
  if (bad) {
    const label = def.slotLabels[bad.slot] ?? bad.slot;
    return {
      ok: false, reason: "bad_value", def, transcript, missing,
      message: `I heard ${bad.heard} for the ${label.toLowerCase()}, which is outside ${bad.range[0]}–${bad.range[1]}. Say the line again.`,
    };
  }
  if (missing.length) {
    const labels = missing.map(m => def.slotLabels[m] ?? m);
    return {
      ok: false, reason: "missing", def, transcript, missing,
      message: `I heard a ${def.title} but not the ${joinLabels(labels)}. Say the whole line again, or tap "Say the rest".`,
    };
  }
  return { ok: true, def, fill: def.build(slots, spokenAt), transcript };
}

/**
 * Try every alternative the recogniser offered. The first that parses wins; otherwise the failure
 * that got furthest, so the message names the fewest missing pieces.
 */
export function parseAlternatives(alternatives: string[], spokenAt: Date = new Date()): VoiceParse {
  const results = alternatives.filter(a => a && a.trim()).map(a => parseCommand(a, spokenAt));
  if (!results.length) return parseCommand("", spokenAt);
  const ok = results.find(r => r.ok);
  if (ok) return ok;
  const rank = (r: VoiceParse) => (r.ok ? 0 : r.reason === "no_command" ? 1000 : r.reason === "bad_value" ? 1 : 1 + (r.missing?.length ?? 0));
  return [...results].sort((a, b) => rank(a) - rank(b))[0];
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
): ApplyResult {
  const grid = allFields(schema).find(f => f.id === fill.gridId && f.type === "grid") as GridField | undefined;
  if (!grid) {
    return { ok: false, error: `This entry has no "${fill.gridId}" table, so the spoken reading could not be added. It may have been filled on an older revision of the form.` };
  }
  const warnings: VoiceWarning[] = [];
  const columnIds = new Set(grid.columns.map(c => c.id));
  const row: Record<string, string> = {};
  for (const [key, value] of Object.entries(fill.row)) {
    if (columnIds.has(key)) row[key] = value;
    else warnings.push({ level: "warn", text: `This form has no "${key}" column, so that part of the line was not recorded.` });
  }

  const def = VOICE_COMMANDS.find(d => d.id === fill.commandId);
  if (def?.limitsCheck && !def.limitsCheck.matches(schema)) {
    for (const col of def.limitsCheck.clearColumns) if (col in row) row[col] = "";
    warnings.push({ level: "warn", text: def.limitsCheck.message });
  }

  const existing = values[grid.id];
  const rows: Record<string, unknown>[] = Array.isArray(existing) ? [...(existing as Record<string, unknown>[])] : [];
  const judged = grid.columns.filter(c => !c.defaultTo);
  const target = rows.findIndex(r => judged.every(c => isBlankCell(r?.[c.id])));
  const merged: Record<string, unknown> = { ...(target >= 0 ? rows[target] : {}), ...newGridRow(grid, ctx), ...row };
  if (isBlankCell(merged.initials) && columnIds.has("initials")) {
    warnings.push({ level: "warn", text: "Your initials could not be filled in - add them to the row." });
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
      warnings.push({ level: "warn", text: `This record is for "${current}", but you said "${fill.entryFields.product}". The row was added here - check it is the right record.` });
    }
  }
  const date = String(values.production_date ?? "");
  if (date && date !== fill.productionDate) {
    warnings.push({ level: "warn", text: `This record is dated ${date}, not today (${fill.productionDate}). Check it is the right record.` });
  }

  return { ok: true, values: next, rowIndex, appended: target < 0, gridLabel: grid.label, warnings };
}

// ─── The printed card ────────────────────────────────────────────────────────

/** The script with placeholders, e.g. "... Lot <Lot number>, ...". */
export function renderScript(def: VoiceCommandDef): string {
  return def.script.map(p => ("text" in p ? p.text : `<${p.placeholder}>`)).join("");
}

/** The script with its example values - what the test feeds back through the parser. */
export function renderExample(def: VoiceCommandDef): string {
  return def.script.map(p => ("text" in p ? p.text : p.example)).join("").replace(/\.\s*\.$/, ".");
}
