// The first-pack check on the Production Lot Record (FRM-520, "Code on the pack"), from a photo.
//
// FSQM-021: the first pack is checked against the lot record before packing carries on - the
// flavor, the lot code, the best-by date, and that any bar code scans. This compares what was READ
// off a photograph of the pack with what the record and the product's formula sheet say it should
// be, one line per point.
//
// It is evidence, never the answer: the person who checked still answers "Code on the pack"
// (FSQM-021 has a trained person approve the first pack). A point that could not be read is said
// to be unread - it is never counted as a match.
//
// Pure: no imports, so it can be tested in Node. The loader for the formula sheet's bar code
// number is loadProductBarcode in formReport.ts.

/** Where the pieces live. Rename a field on either form, update this. */
export const FIRST_PACK = {
  form: "FRM-520",
  section: "packing",
  product: "product",
  lot: "lot_code",
  bakeDate: "bake_date",
  answer: "code_check",
  checkedBy: "code_checked_by",
  /** The option of `answer` that says the pack is right. */
  matches: "Matches the lot code above",
  barcodeSource: { form: "FRM-501", productField: "product_name", field: "barcode_number" },
  /** How an attachment that is a first-pack photo is recognised, and where its result is kept. */
  notePrefix: "First pack photo",
  /** Best-by = the month of manufacture plus this many months (owner, 2026-10-10). */
  shelfLifeMonths: 12,
} as const;

export type PackPoint = "flavor" | "lot" | "best_by" | "barcode";
export type PackState = "match" | "mismatch" | "check" | "unread" | "skipped";

export interface PackLine {
  point: PackPoint;
  state: PackState;
  /** One plain sentence for the screen and for the photo's note. */
  text: string;
}

export interface PackExpected {
  product: string;
  lot: string;
  /** yyyy-mm-dd, the lot's manufacturing (bake) date. */
  bakeDate: string;
  /** The formula sheet's bar code number; blank when it has none. */
  barcode?: string;
}

export interface PackRead {
  product_name?: string;
  lot_code?: string;
  best_by?: string;
  /** The digits a reader printed under the bar code, as read from the picture. */
  barcode?: string;
  /** The bar code as DECODED from the picture's bars - a real scan - when the device could. */
  decodedBarcode?: string;
}

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const fold = (v: unknown) => str(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const words = (v: unknown) => fold(v).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
const normLot = (v: unknown) => str(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
const digits = (v: unknown) => str(v).replace(/\D/g, "");

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_LABEL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface YearMonth { year: number; month: number }   // month 1-12

export const monthLabel = (ym: YearMonth) => `${MONTH_LABEL[ym.month - 1]} ${ym.year}`;

/** The best-by month of a lot made on `bakeDate`: the same month, twelve months on. */
export function expectedBestBy(bakeDate: unknown): YearMonth | null {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(str(bakeDate));
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const total = Number(m[1]) * 12 + (month - 1) + FIRST_PACK.shelfLifeMonths;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

const year4 = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));
const ym = (year: number, month: number): YearMonth | null =>
  month >= 1 && month <= 12 && year >= 2020 && year <= 2099 ? { year, month } : null;

/**
 * The month and year of a best-by date as printed: "October 2027", "OCT 2027", "Oct 15, 2027",
 * "10/2027", "10/15/2027" (US order), "2027-10-15". Anything else is not read - never guessed.
 */
export function parseBestBy(text: unknown): YearMonth | null {
  const s = fold(text).replace(/best\s*(by|before|if used by)|use by|exp(ires|iry|iration)?\.?|bb\b/g, " ").replace(/[:.,]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(s);
  if (m) return ym(Number(m[1]), Number(m[2]));
  m = /^(\d{1,2})\s*[/-]\s*(?:\d{1,2}\s*[/-]\s*)?(\d{4}|\d{2})$/.exec(s);
  if (m) return ym(year4(m[2]), Number(m[1]));
  // A month by name, with an optional day on either side, and a year.
  m = /^(?:(\d{1,2})\s+)?([a-z]{3,9})(?:\s+(\d{1,2}))?\s+(\d{4})$/.exec(s) ?? /^(?:(\d{1,2})\s+)?([a-z]{3,9})()\s+(\d{2})$/.exec(s);
  if (m) {
    const word = m[2];
    const idx = MONTHS.findIndex(name => name === word || name.slice(0, 3) === word || (word === "sept" && name === "september"));
    return idx < 0 ? null : ym(year4(m[4]), idx + 1);
  }
  return null;
}

const LABEL_WORDS = /best\s*(by|before|if used by)|use by|exp(ires|iry|iration)?\.?|bb\b/g;
const ENGLISH_MONTH = (word: string) => MONTHS.some(name => name === word || name.slice(0, 3) === word) || word === "sept";

/**
 * The words of a printed best-by date that are not English: "Augusto 2027" gives ["augusto"],
 * "Octubre 2027" gives ["octubre"]. The pack is sold in English, and a date coded in Spanish was
 * once found only after the whole lot was packed (owner, 2026-10-10). Any word of the date that is
 * not an English month (or its three-letter form) counts - a misspelt month is wrong on a pack too.
 */
export function bestByNotEnglish(text: unknown): string[] {
  const s = fold(text).replace(LABEL_WORDS, " ");
  return (s.match(/[a-zñ]+/g) ?? []).filter(w => !ENGLISH_MONTH(w) && !/^(st|nd|rd|th|of)$/.test(w));
}

/**
 * Two bar code numbers for the same thing: the same digits, or a 12-digit UPC against its 13-digit
 * EAN form (a leading zero). Blank matches nothing.
 */
export function sameBarcode(a: unknown, b: unknown): boolean {
  const x = digits(a).replace(/^0+/, ""), y = digits(b).replace(/^0+/, "");
  return x !== "" && x === y;
}

/** Words that are on every pack and say nothing about the flavor. */
const PLAIN = new Set(["rum", "cake", "cakes", "the", "and", "flavor", "flavour", "original", "classic"]);

export type PackLang = "en" | "es";

/**
 * Every sentence of the check, per language. The RECORD is always English (the photo's note is
 * built from the English lines); Spanish is for the screen of an operator who reads it. A mismatch
 * always carries NOT_MATCH[lang], which is how a note is recognised as one.
 */
const NOT_MATCH = { en: "does NOT match", es: "NO coincide" } as const;
const MONTH_LABEL_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** What the pack must SAY is always the English month, in either language. */
const TEXT = {
  en: {
    flavorUnread: "Flavor: could not be read from the photo.",
    flavorNoRecord: "Flavor: the record has no product yet.",
    flavorShown: (read: string, want: string) => `the pack says "${read}", the record says "${want}"`,
    flavorMatch: (shown: string) => `Flavor matches: ${shown}.`,
    flavorWrong: (shown: string) => `Flavor ${NOT_MATCH.en}: ${shown}.`,
    flavorLook: (shown: string) => `Flavor needs a look: ${shown}.`,
    lotNoRecord: "Lot code: the record has no lot code yet.",
    lotUnread: "Lot code: could not be read from the photo.",
    lotMatch: (read: string) => `Lot code matches: ${read}.`,
    lotWrong: (read: string, want: string) => `Lot code ${NOT_MATCH.en}: the pack says ${read}, the record says ${want}.`,
    dateNoRecord: "Best-by date: the record has no bake date yet.",
    dateUnread: (want: string) => `Best-by date: could not be read from the photo. It should say ${want}.`,
    dateNotEnglish: (read: string, want: string) => `Best-by date ${NOT_MATCH.en}: the pack says "${read}", which is not in English. It should say ${want}.`,
    dateLook: (read: string, want: string) => `Best-by date needs a look: the pack says "${read}". It should say ${want}.`,
    dateMatch: (read: string) => `Best-by date matches: ${read}.`,
    dateWrong: (read: string, want: string) => `Best-by date ${NOT_MATCH.en}: the pack says "${read}". It should say ${want}.`,
    scanned: "scanned",
    notScanned: "read from the printed digits, not scanned",
    codeNoSheet: (seen: string, how: string) => `Bar code ${seen} (${how}). The formula sheet has no bar code number to compare it with.`,
    codeNothing: "Bar code: none read, and the formula sheet has no bar code number.",
    codeUnread: (want: string) => `Bar code: could not be read from the photo. It should be ${want}.`,
    codeMatch: (seen: string) => `Bar code matches the formula sheet: ${seen} (scanned).`,
    codeDigits: (seen: string) => `Bar code digits match the formula sheet: ${seen}. The bars were not scanned from the photo - scan the pack to confirm it reads.`,
    codeWrong: (seen: string, how: string, want: string) => `Bar code ${NOT_MATCH.en}: the pack says ${seen} (${how}), the formula sheet says ${want}.`,
  },
  es: {
    flavorUnread: "Sabor: no se pudo leer en la foto.",
    flavorNoRecord: "Sabor: el registro todavía no tiene producto.",
    flavorShown: (read: string, want: string) => `el empaque dice "${read}", el registro dice "${want}"`,
    flavorMatch: (shown: string) => `El sabor coincide: ${shown}.`,
    flavorWrong: (shown: string) => `El sabor ${NOT_MATCH.es}: ${shown}.`,
    flavorLook: (shown: string) => `Revise el sabor: ${shown}.`,
    lotNoRecord: "Código de lote: el registro todavía no tiene código de lote.",
    lotUnread: "Código de lote: no se pudo leer en la foto.",
    lotMatch: (read: string) => `El código de lote coincide: ${read}.`,
    lotWrong: (read: string, want: string) => `El código de lote ${NOT_MATCH.es}: el empaque dice ${read}, el registro dice ${want}.`,
    dateNoRecord: "Fecha de consumo preferente: el registro todavía no tiene fecha de horneado.",
    dateUnread: (want: string) => `Fecha de consumo preferente: no se pudo leer en la foto. Debe decir ${want}.`,
    dateNotEnglish: (read: string, want: string) => `La fecha ${NOT_MATCH.es}: el empaque dice "${read}", que no está en inglés. Debe decir ${want}.`,
    dateLook: (read: string, want: string) => `Revise la fecha: el empaque dice "${read}". Debe decir ${want}.`,
    dateMatch: (read: string) => `La fecha coincide: ${read}.`,
    dateWrong: (read: string, want: string) => `La fecha ${NOT_MATCH.es}: el empaque dice "${read}". Debe decir ${want}.`,
    scanned: "escaneado",
    notScanned: "leído de los dígitos impresos, no escaneado",
    codeNoSheet: (seen: string, how: string) => `Código de barras ${seen} (${how}). La hoja de fórmula no tiene un número con el cual compararlo.`,
    codeNothing: "Código de barras: no se leyó ninguno, y la hoja de fórmula no tiene número.",
    codeUnread: (want: string) => `Código de barras: no se pudo leer en la foto. Debe ser ${want}.`,
    codeMatch: (seen: string) => `El código de barras coincide con la hoja de fórmula: ${seen} (escaneado).`,
    codeDigits: (seen: string) => `Los dígitos del código de barras coinciden con la hoja de fórmula: ${seen}. Las barras no se escanearon en la foto: escanee el empaque para confirmar que se lee.`,
    codeWrong: (seen: string, how: string, want: string) => `El código de barras ${NOT_MATCH.es}: el empaque dice ${seen} (${how}), la hoja de fórmula dice ${want}.`,
  },
} as const;

/** The month the pack must print, with the Spanish month beside it for a Spanish reader: "August 2027 (agosto)". */
const wantMonth = (want: YearMonth, lang: PackLang) =>
  lang === "es" ? `${monthLabel(want)} (${MONTH_LABEL_ES[want.month - 1]})` : monthLabel(want);

function flavorLine(expected: string, read: string | undefined, lang: PackLang): PackLine {
  const T = TEXT[lang];
  if (!str(read)) return { point: "flavor", state: "unread", text: T.flavorUnread };
  const want = new Set(words(expected)), got = new Set(words(read));
  const extraOnPack = [...got].filter(w => !want.has(w) && !PLAIN.has(w));
  const missingOnPack = [...want].filter(w => !got.has(w) && !PLAIN.has(w));
  const shown = T.flavorShown(str(read), str(expected));
  if (!extraOnPack.length && !missingOnPack.length) return { point: "flavor", state: "match", text: T.flavorMatch(shown) };
  // A flavor word on the pack that the record does not have is the wrong pack. One the record has
  // and the photo does not show may only be out of frame, so it is looked at by eye.
  return extraOnPack.length
    ? { point: "flavor", state: "mismatch", text: T.flavorWrong(shown) }
    : { point: "flavor", state: "check", text: T.flavorLook(shown) };
}

/** One line per point of the check. Never throws; a blank on either side is said, not guessed. */
export function checkFirstPack(expected: PackExpected, read: PackRead, lang: PackLang = "en"): PackLine[] {
  const T = TEXT[lang];
  const lines: PackLine[] = [];

  lines.push(str(expected.product)
    ? flavorLine(expected.product, read.product_name, lang)
    : { point: "flavor", state: "skipped", text: T.flavorNoRecord });

  if (!normLot(expected.lot)) lines.push({ point: "lot", state: "skipped", text: T.lotNoRecord });
  else if (!normLot(read.lot_code)) lines.push({ point: "lot", state: "unread", text: T.lotUnread });
  else if (normLot(read.lot_code) === normLot(expected.lot)) lines.push({ point: "lot", state: "match", text: T.lotMatch(str(read.lot_code)) });
  else lines.push({ point: "lot", state: "mismatch", text: T.lotWrong(str(read.lot_code), str(expected.lot)) });

  const want = expectedBestBy(expected.bakeDate);
  const got = parseBestBy(read.best_by);
  const printed0 = str(read.best_by);
  if (!want) lines.push({ point: "best_by", state: "skipped", text: T.dateNoRecord });
  else if (!printed0) lines.push({ point: "best_by", state: "unread", text: T.dateUnread(wantMonth(want, lang)) });
  else if (bestByNotEnglish(read.best_by).length) lines.push({ point: "best_by", state: "mismatch", text: T.dateNotEnglish(printed0, wantMonth(want, lang)) });
  else if (!got) lines.push({ point: "best_by", state: "check", text: T.dateLook(printed0, wantMonth(want, lang)) });
  else if (got.year === want.year && got.month === want.month) lines.push({ point: "best_by", state: "match", text: T.dateMatch(printed0) });
  else lines.push({ point: "best_by", state: "mismatch", text: T.dateWrong(printed0, wantMonth(want, lang)) });

  const scanned = digits(read.decodedBarcode), printed = digits(read.barcode);
  const seen = scanned || printed;
  const how = scanned ? T.scanned : T.notScanned;
  if (!digits(expected.barcode)) {
    lines.push({ point: "barcode", state: "skipped", text: seen ? T.codeNoSheet(seen, how) : T.codeNothing });
  } else if (!seen) {
    lines.push({ point: "barcode", state: "unread", text: T.codeUnread(digits(expected.barcode)) });
  } else if (sameBarcode(seen, expected.barcode)) {
    lines.push({ point: "barcode", state: scanned ? "match" : "check", text: scanned ? T.codeMatch(seen) : T.codeDigits(seen) });
  } else {
    lines.push({ point: "barcode", state: "mismatch", text: T.codeWrong(seen, how, digits(expected.barcode)) });
  }
  return lines;
}

export type PackVerdict = "match" | "mismatch" | "incomplete";

/** All four agree, something is wrong, or something still has to be looked at by eye. */
export function packVerdict(lines: PackLine[]): PackVerdict {
  if (lines.some(l => l.state === "mismatch")) return "mismatch";
  // A bar code the formula sheet cannot judge is not a reason to hold the answer back.
  return lines.every(l => l.state === "match" || (l.point === "barcode" && l.state === "skipped")) ? "match" : "incomplete";
}

/** The note kept on the photo, so the result stays with the record. */
export function packNote(lines: PackLine[]): string {
  return `${FIRST_PACK.notePrefix} - ${lines.map(l => l.text).join(" ")}`;
}

/** Whether an attachment note is a first-pack photo's, and whether it recorded a mismatch. */
export function isPackNote(note: unknown): boolean {
  return str(note).startsWith(FIRST_PACK.notePrefix);
}
export function noteHasMismatch(note: unknown): boolean {
  return isPackNote(note) && str(note).includes(NOT_MATCH.en);
}

/** Does this revision of the form have the fields the check reads and writes? */
export function firstPackReady(schema: { sections?: { id?: string; fields?: { id?: string; options?: unknown }[] }[] } | null | undefined): boolean {
  const all = (schema?.sections ?? []).flatMap(s => s.fields ?? []);
  const has = (id: string) => all.some(f => f.id === id);
  const sec = (schema?.sections ?? []).find(s => s.id === FIRST_PACK.section);
  const answer = (sec?.fields ?? []).find(f => f.id === FIRST_PACK.answer);
  return !!answer && Array.isArray(answer.options) && (answer.options as unknown[]).includes(FIRST_PACK.matches)
    && has(FIRST_PACK.product) && has(FIRST_PACK.lot) && has(FIRST_PACK.bakeDate) && has(FIRST_PACK.checkedBy);
}

/** The newest formula sheet of the product that states a bar code number (drafts count). Entries newest first. */
export function productBarcode(entries: Record<string, unknown>[], product: unknown): string {
  const want = words(product).join(" ");
  if (!want) return "";
  for (const e of entries) {
    if (words(e?.[FIRST_PACK.barcodeSource.productField]).join(" ") !== want) continue;
    const code = digits(e?.[FIRST_PACK.barcodeSource.field]);
    if (code) return code;
  }
  return "";
}
