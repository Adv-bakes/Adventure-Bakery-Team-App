// Word lists for the voice-command parser, one per spoken language.
//
// WHY SEPARATE LEXICONS, NEVER ONE MERGED LIST. Words collide across the two languages, and a merged
// list would mis-parse both. In an English lot code "es", "el" and "en" are the letters S, L and N; in
// Spanish they are "is", "the" and "in". "once" is 11 in Spanish and nothing in English. "for" is the
// English separator that a recogniser often writes as "4", while a Spanish "4" is just 4. "de" is the
// letter D and also "of". So the language the recogniser listened in picks exactly one lexicon.
//
// English is today's behaviour moved here unchanged, plus negation: a spoken "pull test not passed"
// must never record a pass. Spanish folds accents for matching (the product name keeps them), and has
// its own numbers, letter names, pass/fail words and negation - "no pasó" contains "pasó".
//
// JavaScript's \b only knows ASCII letters, so the Spanish rewrites use Unicode lookarounds instead;
// /\bpasó\b/ would never match.
//
// Pure, relative imports only: scripts/test-voice-commands.mjs bundles it.

export type VoiceLang = "en" | "es";
export const VOICE_LANGS: VoiceLang[] = ["en", "es"];

/**
 * The recogniser locale per language. es-US rather than es-MX: it is trained on US Spanish speakers,
 * who mix in English product names and words like "batch" and "setup", and it writes decimals with a
 * dot like the gauges on the floor. A one-constant change if the tablet does better with es-MX.
 */
export const RECOGNIZER_LANG: Record<VoiceLang, string> = { en: "en-US", es: "es-US" };

export interface Token { n: string; r: string }
export interface NumberSpec { range: [number, number]; hundredsShorthand?: boolean }

export interface Lexicon {
  lang: VoiceLang;
  normalize(raw: string): Token[];
  numberCandidates(tokens: string[], spec: NumberSpec): number[];
  /** Words between the temperature and the minutes: "for", "por". */
  separators: Set<string>;
  /** A digit the recogniser writes for the separator word: English "for" heard as "4". */
  digitSeparator: string | null;
  /** "veintisiete minutos y medio" - a half AFTER the unit. */
  halfAfterUnit: string[][];
  parseCode(tokens: Token[]): string;
  resultIn(tokens: string[]): "pass" | "fail" | undefined;
  /** How many tokens after "visual" / "pull test" to look for the result word. */
  resultWindow: number;
  /** Stop that look at the next anchor, so "visual" can never borrow the pull test's result. */
  stopResultAtNextAnchor: boolean;
  productAnchors: string[][];
  lotAnchors: string[][];
  productName(tokens: Token[]): string;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function tokenize(s: string, fold: (w: string) => string, numberWords: Set<string>): Token[] {
  const out: Token[] = [];
  for (const piece of s.split(/\s+/).filter(Boolean)) {
    if (!piece.includes("-")) { out.push({ n: fold(piece), r: piece }); continue; }
    const parts = piece.split("-");
    // twenty-seven is two number words; L0911-1 is a code whose hyphen must survive.
    if (parts.every(p => numberWords.has(fold(p)))) {
      for (const p of parts) out.push({ n: fold(p), r: p });
      continue;
    }
    parts.forEach((p, i) => {
      if (i > 0) out.push({ n: "-", r: "-" });
      if (p) out.push({ n: fold(p), r: p });
    });
  }
  return out;
}

/**
 * The last pass/fail word wins, except that a negator shortly before a PASS word turns it into a fail.
 * A negator before a FAIL word stays a fail: "No. Failed." loses its punctuation to the recogniser, so
 * "no failed" cannot safely be read as a pass.
 */
function makeResultIn(pass: Set<string>, fail: Set<string>, negators: Set<string>, gap: Set<string>, maxGap: number) {
  return (tokens: string[]): "pass" | "fail" | undefined => {
    let found: "pass" | "fail" | undefined;
    let negated = false;
    let reach = 0;
    for (const t of tokens) {
      if (negators.has(t)) { negated = true; reach = maxGap; continue; }
      if (pass.has(t)) { found = negated ? "fail" : "pass"; negated = false; continue; }
      if (fail.has(t)) { found = "fail"; negated = false; continue; }
      if (negated && gap.has(t) && reach > 0) { reach--; continue; }
      negated = false;
    }
    return found;
  };
}

// ─── English (today's rules, unchanged apart from negation) ──────────────────

const EN_REPLACEMENTS: Array<[RegExp, string]> = [
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

const EN_ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
};
const EN_TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const EN_TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const EN_NUMBER_WORDS = new Set([...Object.keys(EN_ONES), ...Object.keys(EN_TEENS), ...Object.keys(EN_TENS), "hundred"]);
const EN_NUMBER_FILLER = new Set(["degrees", "minutes", "inches", "about", "approximately", "at", "is", "of", "reading", "the", "was"]);

function enNumberCandidates(tokens: string[], spec: NumberSpec): number[] {
  const t = tokens.filter(x => !EN_NUMBER_FILLER.has(x));
  if (!t.length) return [];
  const out: number[] = [];

  let half = 0;
  const halfAt = t.findIndex((x, i) => x === "and" && t[i + 1] === "a" && t[i + 2] === "half");
  const core = halfAt >= 0 ? t.slice(0, halfAt) : t;
  if (halfAt >= 0) half = 0.5;

  if (core.length === 1 && /^\d+(\.\d+)?$/.test(core[0])) out.push(Number(core[0]) + half);
  // "3:50" - Chrome's rendering of "three fifty".
  const clock = core.length === 1 ? core[0].match(/^(\d{1,2}):(\d{2})$/) : null;
  if (clock) out.push(Number(`${clock[1]}${clock[2]}`));

  const pointAt = core.indexOf("point");
  const whole = pointAt >= 0 ? core.slice(0, pointAt) : core;
  const frac = pointAt >= 0 ? core.slice(pointAt + 1) : [];
  if (whole.length && whole.every(w => EN_NUMBER_WORDS.has(w) || w === "and")) {
    const words = whole.filter(w => w !== "and");
    let value = 0;
    for (const w of words) {
      if (w === "hundred") value = (value || 1) * 100;
      else value += EN_ONES[w] ?? EN_TEENS[w] ?? EN_TENS[w] ?? 0;
    }
    let decimal = 0;
    if (frac.length && frac.every(w => w in EN_ONES || /^\d$/.test(w))) {
      decimal = Number(`0.${frac.map(w => (w in EN_ONES ? EN_ONES[w] : w)).join("")}`);
    }
    out.push(value + decimal + half);
    // "three fifty" means 350 on an oven, not 53.
    if (spec.hundredsShorthand && words.length >= 2 && words[0] in EN_ONES && EN_ONES[words[0]] > 0
        && (words[1] in EN_TENS || words[1] in EN_TEENS) && !words.includes("hundred")) {
      const rest = words.slice(1).reduce((sum, w) => sum + (EN_TENS[w] ?? EN_TEENS[w] ?? EN_ONES[w] ?? 0), 0);
      out.push(EN_ONES[words[0]] * 100 + rest + half);
    }
  }
  return out;
}

const EN_LETTER_NAMES: Record<string, string> = {
  ay: "A", bee: "B", be: "B", see: "C", sea: "C", dee: "D", ee: "E", ef: "F", eff: "F", gee: "G",
  aitch: "H", eye: "I", jay: "J", kay: "K", el: "L", ell: "L", em: "M", en: "N", pee: "P", cue: "Q",
  queue: "Q", ar: "R", are: "R", es: "S", ess: "S", tee: "T", tea: "T", you: "U", vee: "V",
  ex: "X", why: "Y", zee: "Z", zed: "Z",
  alpha: "A", alfa: "A", bravo: "B", charlie: "C", delta: "D", echo: "E", foxtrot: "F", golf: "G",
  hotel: "H", india: "I", juliet: "J", kilo: "K", lima: "L", mike: "M", november: "N", oscar: "O",
  papa: "P", quebec: "Q", romeo: "R", sierra: "S", tango: "T", uniform: "U", victor: "V",
  whiskey: "W", xray: "X", yankee: "Y", zulu: "Z",
};
const EN_CODE_FILLER = new Set(["number", "code", "no", "is", "#", "of"]);

function enParseCode(tokens: Token[]): string {
  let out = "";
  let repeat = 1;
  for (let i = 0; i < tokens.length; i++) {
    const { n, r } = tokens[i];
    if (EN_CODE_FILLER.has(n) && out === "") continue;
    let piece: string;
    if (n === "-") piece = "-";
    else if (n === "double") { repeat = 2; continue; }
    else if (n === "triple") { repeat = 3; continue; }
    else if (n === "oh") piece = "0";
    else if (n in EN_ONES) piece = String(EN_ONES[n]);
    else if (n in EN_TEENS) piece = String(EN_TEENS[n]);
    else if (n in EN_TENS) {
      const next = tokens[i + 1]?.n;
      if (next && next in EN_ONES && EN_ONES[next] > 0) { piece = String(EN_TENS[n] + EN_ONES[next]); i++; }
      else piece = String(EN_TENS[n]);
    }
    else if (n in EN_LETTER_NAMES) piece = EN_LETTER_NAMES[n];
    else piece = r.toUpperCase();
    out += piece.repeat(repeat);
    repeat = 1;
  }
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function enProductName(tokens: Token[]): string {
  const words = tokens.map(t => t.r).filter(w => w !== "-");
  while (words.length && /^(for|the|a)$/i.test(words[0])) words.shift();
  while (words.length && /^(for|the)$/i.test(words[words.length - 1])) words.pop();
  const name = words.join(" ").trim();
  // Speech recognition returns most words lower-case; a record should not read "sample loaf".
  return name === name.toLowerCase() ? name.replace(/\b\w/g, c => c.toUpperCase()) : name;
}

export const LEX_EN: Lexicon = {
  lang: "en",
  normalize(raw) {
    let s = ` ${raw ?? ""} `;
    for (const [re, to] of EN_REPLACEMENTS) s = s.replace(re, to);
    s = s.replace(/[,!?;"“”]/g, " ");
    s = s.replace(/(?<!\d)\.|\.(?!\d)/g, " ");       // a full stop, but not a decimal point
    return tokenize(s, w => w.toLowerCase(), EN_NUMBER_WORDS);
  },
  numberCandidates: enNumberCandidates,
  separators: new Set(["for"]),
  digitSeparator: "4",
  halfAfterUnit: [],
  parseCode: enParseCode,
  resultIn: makeResultIn(
    new Set(["passed", "pass", "past", "passes", "passing"]),
    new Set(["failed", "fail", "fails", "failing", "fell"]),
    new Set(["not", "never", "didnt", "didn't"]),
    new Set(["is", "was", "it", "has", "have", "been", "did", "do", "does"]),
    2,
  ),
  resultWindow: 3,
  stopResultAtNextAnchor: false,
  productAnchors: [["product"]],
  lotAnchors: [["lot", "number"], ["lot", "code"], ["lot"], ["batch", "number"], ["batch"]],
  productName: enProductName,
};

// ─── Spanish ─────────────────────────────────────────────────────────────────

/** Lower-case and strip accents for matching, but keep ñ: "piña" and "pina" are different words. */
export function foldEs(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\u00f1/g, "\u0001")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0001/g, "\u00f1");
}

const W = (p: string) => new RegExp(`(?<![\\p{L}\\d])(?:${p})(?![\\p{L}\\d])`, "giu");

const ES_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[°º]\s*f(?!\p{L})/giu, " grados "],
  [/[°º]/gu, " grados "],
  [W("grados?\\s+(?:fahrenheit|farenheit|f)"), " grados "],
  [W("fahrenheit|farenheit"), " grados "],
  [W("pulgadas?\\s+de\\s+mercurio"), " pulgadas "],
  [W("in\\.?\\s*hg|hg|mercurio|pulg"), " pulgadas "],
  [W("mins?|minuto"), " minutos "],
  [W("set[\\s-]?up"), " setup "],
  // Without this "sellado al vacío" puts the vacuum anchor inside the trigger and loses product and lot.
  [W("(sellado|empacado|envasado|selladora)\\s+al\\s+vac[ií]o"), " $1 "],
  // PCC (punto crítico de control) and CCP are the same thing on this floor; both become one token.
  [W("p\\s*c\\s*c|pe\\s+ce\\s+ce|pe\\s+se\\s+se|c\\s*c\\s*p|ce\\s+ce\\s+pe|se\\s+se\\s+pe"), " ccp "],
  [W("ccp\\s*(?:1|uno|un)"), " ccp 1 "],
  [W("ccp\\s*(?:2|dos)"), " ccp 2 "],
  [W("gui[oó]n|gion|raya|rayita|dash"), " - "],
  // A decimal comma must survive the punctuation strip below: 27,5 -> 27.5.
  [/(\d),(\d{1,2})(?!\d)/g, "$1.$2"],
  // "tres cincuenta" can come back as "$3.50".
  [/[¿¡«»$]/g, " "],
  [/[×*]/g, " x "],
];

const ES_ONES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
};
const ES_TEENS: Record<string, number> = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29,
};
const ES_TENS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};
const ES_HUNDREDS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600,
  seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900,
};
const ES_NUMBER_WORDS = new Set([
  ...Object.keys(ES_ONES), ...Object.keys(ES_TEENS), ...Object.keys(ES_TENS), ...Object.keys(ES_HUNDREDS),
]);
const esWordValue = (w: string): number | undefined => ES_ONES[w] ?? ES_TEENS[w] ?? ES_TENS[w] ?? ES_HUNDREDS[w];
const ES_NUMBER_FILLER = new Set([
  "grados", "minutos", "pulgadas", "de", "del", "a", "las", "los", "el", "la", "es", "fue", "marca", "marcaba",
  "lectura", "unos", "unas", "como", "aprox", "aproximadamente", "degrees", "minutes", "inches", "at",
]);
const ES_HALF: string[][] = [["y", "medio"], ["y", "media"]];

function esNumberCandidates(tokens: string[], spec: NumberSpec): number[] {
  const t = tokens.filter(x => !ES_NUMBER_FILLER.has(x));
  if (!t.length) return [];
  const out: number[] = [];

  let half = 0;
  const halfAt = t.findIndex((x, i) => ES_HALF.some(seq => seq.every((w, k) => t[i + k] === w)));
  const core = halfAt >= 0 ? t.slice(0, halfAt) : t;
  if (halfAt >= 0) half = 0.5;

  if (core.length === 1 && /^\d+(\.\d+)?$/.test(core[0])) {
    out.push(Number(core[0]) + half);
    // "3.50" / "3,50" for "tres cincuenta" on the oven.
    if (spec.hundredsShorthand && /^\d\.\d\d$/.test(core[0])) out.push(Number(core[0].replace(".", "")));
  }
  const clock = core.length === 1 ? core[0].match(/^(\d{1,2}):(\d{2})$/) : null;
  if (clock) out.push(Number(`${clock[1]}${clock[2]}`));

  const pointAt = core.findIndex(w => w === "punto" || w === "coma");
  const whole = pointAt >= 0 ? core.slice(0, pointAt) : core;
  const frac = pointAt >= 0 ? core.slice(pointAt + 1) : [];
  if (whole.length && whole.every(w => ES_NUMBER_WORDS.has(w) || w === "y")) {
    const words = whole.filter(w => w !== "y");
    // Spanish hundreds are words of their own, so the value is simply the sum: trescientos cincuenta y cinco.
    const value = words.reduce((sum, w) => sum + (esWordValue(w) ?? 0), 0);
    let decimal = 0;
    if (frac.length && frac.every(w => w in ES_ONES || /^\d$/.test(w))) {
      decimal = Number(`0.${frac.map(w => (w in ES_ONES ? ES_ONES[w] : w)).join("")}`);
    }
    out.push(value + decimal + half);
    // "tres cincuenta" means 350 on an oven, not 53.
    if (spec.hundredsShorthand && words.length >= 2 && words[0] in ES_ONES && ES_ONES[words[0]] > 0
        && (words[1] in ES_TENS || words[1] in ES_TEENS) && !words.some(w => w in ES_HUNDREDS)) {
      const rest = words.slice(1).reduce((sum, w) => sum + (esWordValue(w) ?? 0), 0);
      out.push(ES_ONES[words[0]] * 100 + rest + half);
    }
  }
  return out;
}

const ES_LETTER_NAMES: Record<string, string> = {
  a: "A", be: "B", ce: "C", se: "C", de: "D", e: "E", efe: "F", ge: "G", hache: "H", i: "I", jota: "J",
  ka: "K", ca: "K", ele: "L", el: "L", eme: "M", ene: "N", "eñe": "Ñ", enie: "Ñ", enye: "Ñ", o: "O", pe: "P",
  cu: "Q", ere: "R", erre: "R", ese: "S", te: "T", u: "U", ve: "V", uve: "V", equis: "X", ye: "Y",
  zeta: "Z", ceta: "Z", seta: "Z",
  alfa: "A", alpha: "A", bravo: "B", charlie: "C", delta: "D", eco: "E", echo: "E", foxtrot: "F",
  golf: "G", hotel: "H", india: "I", julieta: "J", juliet: "J", kilo: "K", lima: "L", mike: "M",
  noviembre: "N", november: "N", oscar: "O", papa: "P", quebec: "Q", romeo: "R", sierra: "S",
  tango: "T", uniforme: "U", uniform: "U", victor: "V", whiskey: "W", xray: "X", yankee: "Y", zulu: "Z",
};
/** Two-word letter names, checked before single words and before "doble" as a repeat. */
const ES_LETTER_PAIRS: Array<[string[], string]> = [
  [["doble", "ve"], "W"], [["doble", "u"], "W"], [["doble", "uve"], "W"],
  [["i", "griega"], "Y"], [["i", "latina"], "I"],
  [["be", "larga"], "B"], [["be", "grande"], "B"],
  [["ve", "corta"], "V"], [["ve", "chica"], "V"], [["ve", "baja"], "V"],
];
// "de" and "el" are deliberately NOT filler: inside a code they are the letters D and L.
const ES_CODE_FILLER = new Set(["numero", "num", "no", "codigo", "es", "#", "la"]);

function esParseCode(tokens: Token[]): string {
  let out = "";
  let repeat = 1;
  const at = (i: number) => tokens[i]?.n;
  for (let i = 0; i < tokens.length; i++) {
    const { n, r } = tokens[i];
    if (ES_CODE_FILLER.has(n) && out === "") continue;
    if (n === "y") continue;                             // "and"; the letter Y is "ye" or "i griega"
    let piece: string | undefined;
    const pair = ES_LETTER_PAIRS.find(([seq]) => seq.every((w, k) => at(i + k) === w));
    if (pair) { piece = pair[1]; i += pair[0].length - 1; }
    else if (n === "-") piece = "-";
    else if (n === "doble") { repeat = 2; continue; }
    else if (n === "triple") { repeat = 3; continue; }
    else if (n in ES_ONES) piece = String(ES_ONES[n]);
    else if (n in ES_TEENS) piece = String(ES_TEENS[n]);
    else if (n in ES_TENS) {
      let v = ES_TENS[n];
      if (at(i + 1) === "y" && at(i + 2) in ES_ONES && ES_ONES[at(i + 2)] > 0) { v += ES_ONES[at(i + 2)]; i += 2; }
      else if (at(i + 1) in ES_ONES && ES_ONES[at(i + 1)] > 0) { v += ES_ONES[at(i + 1)]; i += 1; }
      piece = String(v);
    }
    else if (n in ES_HUNDREDS) {
      let v = ES_HUNDREDS[n];
      const next = at(i + 1);
      if (next in ES_TENS) {
        v += ES_TENS[next]; i += 1;
        if (at(i + 1) === "y" && at(i + 2) in ES_ONES && ES_ONES[at(i + 2)] > 0) { v += ES_ONES[at(i + 2)]; i += 2; }
      }
      else if (next in ES_TEENS) { v += ES_TEENS[next]; i += 1; }
      else if (next in ES_ONES && ES_ONES[next] > 0) { v += ES_ONES[next]; i += 1; }
      piece = String(v);
    }
    else if (n in ES_LETTER_NAMES) piece = ES_LETTER_NAMES[n];
    else piece = r.toUpperCase();
    out += piece.repeat(repeat);
    repeat = 1;
  }
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

const ES_PRODUCT_LEAD = new Set(["para", "el", "la", "los", "las", "de", "del", "un", "una"]);
const ES_PRODUCT_TAIL = new Set(["para", "de", "del", "el", "la", "con", "y", "numero", "codigo"]);
const ES_TITLE_LOWER = new Set(["de", "del", "la", "las", "los", "y", "con", "al", "en"]);

function esProductName(tokens: Token[]): string {
  const words = tokens.map(t => t.r).filter(w => w !== "-");
  while (words.length && ES_PRODUCT_LEAD.has(foldEs(words[0]))) words.shift();
  while (words.length && ES_PRODUCT_TAIL.has(foldEs(words[words.length - 1]))) words.pop();
  const name = words.join(" ").trim();
  if (name !== name.toLowerCase()) return name;
  return name.split(" ")
    .map((w, i) => (i > 0 && ES_TITLE_LOWER.has(foldEs(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export const LEX_ES: Lexicon = {
  lang: "es",
  normalize(raw) {
    let s = ` ${raw ?? ""} `;
    for (const [re, to] of ES_REPLACEMENTS) s = s.replace(re, to);
    s = s.replace(/[,!?;"“”]/g, " ");
    s = s.replace(/(?<!\d)\.|\.(?!\d)/g, " ");
    return tokenize(s, foldEs, ES_NUMBER_WORDS);
  },
  numberCandidates: esNumberCandidates,
  separators: new Set(["por", "durante", "x", "for"]),
  digitSeparator: null,
  halfAfterUnit: ES_HALF,
  parseCode: esParseCode,
  resultIn: makeResultIn(
    new Set([
      "aprobado", "aprobada", "aprobados", "aprobadas", "aprobo", "paso", "pasa", "pasaron", "bien", "bueno",
      "buena", "correcto", "correcta", "conforme", "cumple", "ok", "okay", "okey", "passed", "pass", "past",
    ]),
    new Set([
      "rechazado", "rechazada", "rechazados", "rechazadas", "rechazo", "reprobado", "reprobada", "reprobo",
      "fallo", "fallido", "fallida", "falla", "fallas", "fallaron", "mal", "malo", "mala", "failed", "fail",
    ]),
    new Set(["no", "nunca", "tampoco"]),
    new Set(["se", "lo", "la", "le", "esta", "fue", "salio", "quedo", "es", "estuvo", "ha", "han"]),
    2,
  ),
  resultWindow: 4,
  stopResultAtNextAnchor: true,
  productAnchors: [["producto"], ["productos"]],
  lotAnchors: [
    ["numero", "de", "lote"], ["codigo", "de", "lote"], ["lote", "numero"], ["lote", "codigo"], ["lote"],
    ["numero", "de", "tanda"], ["tanda"], ["batch"], ["lot"],
  ],
  productName: esProductName,
};

export const LEXICONS: Record<VoiceLang, Lexicon> = { en: LEX_EN, es: LEX_ES };
