// Turns a pack's printed "Contains" statement into the US major allergens it names, and a printed
// storage instruction into a storage class. Used by extract-package-label's "specification" mode.
//
// DETERMINISTIC ON PURPOSE. The model is asked only to TRANSCRIBE the Contains line, word for word;
// which allergens that line names is decided here, by matching words. So the ticked boxes on
// FRM-207 can always be traced to text printed on the pack and shown beside them - an allergen
// can be missed if the photo cuts the line off, but it cannot be invented.
//
// Only the "Contains" statement feeds this, never the ingredient list: under FALCPA the Contains
// statement is the manufacturer's own summary of the major allergens, while reading allergens out
// of an ingredient list means deciding that "whey" is milk - a judgement, not a transcription.
// No Contains statement means no allergen answer; it never means "none".

/** Canonical names - these are FRM-207's option labels, and must stay identical to them. */
export const MAJOR_ALLERGENS = [
  "Milk", "Egg", "Wheat", "Soy", "Peanut", "Tree nuts", "Sesame", "Fish", "Crustacean shellfish",
] as const;
export type MajorAllergen = (typeof MAJOR_ALLERGENS)[number];

const PATTERNS: ReadonlyArray<[MajorAllergen, RegExp]> = [
  ["Milk", /\bmilk\b/],
  ["Egg", /\beggs?\b/],
  ["Wheat", /\bwheat\b/],
  ["Soy", /\bsoy(beans?|a)?\b/],
  ["Peanut", /\bpeanuts?\b/],
  ["Tree nuts", /\btree ?nuts?\b|\b(almonds?|hazelnuts?|filberts?|pecans?|walnuts?|cashews?|pistachios?|macadamias?|brazil ?nuts?|pine ?nuts?|chestnuts?)\b/],
  ["Sesame", /\bsesame\b/],
  // "\bfish\b" does not match inside "shellfish"; named species are how labels usually declare fish
  ["Fish", /\bfish\b|\b(anchov(y|ies)|cod|tuna|salmon|tilapia|pollock|haddock|halibut|trout|flounder|sardines?|mackerel)\b/],
  ["Crustacean shellfish", /\bshellfish\b|\bcrustaceans?\b|\b(shrimps?|prawns?|crabs?|lobsters?|crawfish|crayfish)\b/],
];

export interface ContainsReading {
  allergens: MajorAllergen[];
  warnings: string[];
}

export function allergensFromContains(statement: string | undefined | null): ContainsReading {
  const text = (statement ?? "").toLowerCase();
  if (!text.trim()) {
    return {
      allergens: [],
      warnings: ["No \"Contains\" statement was readable, so no allergens were filled. Photograph the allergen panel, or take them from the specification sheet."],
    };
  }
  const allergens = PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
  const warnings: string[] = [];
  if (/\bcoconut\b/.test(text)) {
    warnings.push("The statement names coconut. Whether coconut counts as a tree nut has changed in FDA guidance - decide it deliberately rather than from this scan.");
  }
  if (!allergens.length) {
    warnings.push("A \"Contains\" statement was read but no major allergen was recognised in it. Check it by eye.");
  }
  return { allergens, warnings };
}

/** FRM-207's storage options, by the word the option starts with. */
export type StorageClass = "Ambient" | "Chilled" | "Frozen";

/** A storage CLASS only when the pack actually says so; silence is not "ambient". */
export function storageClass(instruction: string | undefined | null): StorageClass | undefined {
  const t = (instruction ?? "").toLowerCase();
  if (!t.trim()) return undefined;
  if (/\bfrozen\b|\bfreez/.test(t)) return "Frozen";
  if (/refrigerat|keep (cold|chilled)|\bchill|below 4[01]\s*°?\s*f|0\s*-\s*4\s*°?\s*c/.test(t)) return "Chilled";
  if (/cool,? dry|dry place|room temperature|ambient|shelf.?stable/.test(t)) return "Ambient";
  return undefined;
}
