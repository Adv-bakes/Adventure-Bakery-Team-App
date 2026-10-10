// The three counts of the Production Lot Record (FRM-520, Packing), added up by the app.
//
// FSQM-021: no pre-printed label is issued by count, so what is reconciled is the product. The
// cakes are counted when they go on the baking rack; at the end of packing that count is compared
// with the units packed plus the units not packed. All three are still counted and entered by a
// person - if one were worked out from the other two there would be nothing to compare. The app
// only does the sum and says when it does not come out, so a difference is explained in Notes
// before the record is submitted.
//
// Pure: no imports, so it can be tested in Node.

export const PACK_COUNTS = {
  form: "FRM-520",
  section: "packing",
  racked: "racked_count",
  packed: "units_packed",
  notPacked: "not_packed",
  notes: "packing_notes",
  /** The line is shown under this field (the end of the counts' row). */
  after: "film_lot",
} as const;

export type CountState = "incomplete" | "adds_up" | "short" | "over" | "unreadable";

export interface CountResult {
  state: CountState;
  /** Racked minus (packed + not packed): positive = cakes unaccounted for, negative = more than were racked. */
  diff?: number;
  /** One plain sentence for the screen. */
  text: string;
  /** True when the counts differ and Notes does not yet say why. */
  needsNote: boolean;
}

const str = (v: unknown) => (v == null ? "" : String(v).trim());

/** A whole count from a number field or from text: "480", "480 units", "1,200". Anything else is not read. */
export function readCount(v: unknown): number | null {
  const m = /^(\d{1,3}(?:,\d{3})+|\d+)\s*(?:units?|cakes?|packs?|pcs\.?|pieces?|ea\.?|each)?$/i.exec(str(v));
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function packCounts(values: Record<string, unknown>): CountResult {
  const rackedRaw = str(values[PACK_COUNTS.racked]), packedRaw = str(values[PACK_COUNTS.packed]), notRaw = str(values[PACK_COUNTS.notPacked]);
  if (!rackedRaw || !packedRaw || !notRaw) {
    return { state: "incomplete", needsNote: false, text: "Enter all three counts and the app adds them up: counted on the rack = units packed + not packed." };
  }
  const racked = readCount(rackedRaw), packed = readCount(packedRaw), notPacked = readCount(notRaw);
  if (racked == null || packed == null || notPacked == null) {
    return { state: "unreadable", needsNote: false, text: `The counts cannot be added up: "${racked == null ? rackedRaw : packed == null ? packedRaw : notRaw}" is not a plain number of units.` };
  }
  const diff = racked - (packed + notPacked);
  const sum = `${packed} packed + ${notPacked} not packed = ${packed + notPacked}`;
  if (diff === 0) return { state: "adds_up", diff, needsNote: false, text: `Adds up: ${sum}, and ${racked} were counted on the rack.` };
  const noted = str(values[PACK_COUNTS.notes]) !== "";
  const why = noted ? "The reason is in Notes." : "Recount, or say why in Notes before submitting.";
  return diff > 0
    ? { state: "short", diff, needsNote: !noted, text: `${diff} unaccounted for: ${sum}, but ${racked} were counted on the rack. ${why}` }
    : { state: "over", diff, needsNote: !noted, text: `${-diff} more than were racked: ${sum}, but only ${racked} were counted on the rack. ${why}` };
}

/** Does this revision of the form have the fields the sum reads? */
export function packCountsReady(schema: { sections?: { id?: string; fields?: { id?: string }[] }[] } | null | undefined): boolean {
  const ids = new Set(((schema?.sections ?? []).find(s => s.id === PACK_COUNTS.section)?.fields ?? []).map(f => f.id));
  return [PACK_COUNTS.racked, PACK_COUNTS.packed, PACK_COUNTS.notPacked, PACK_COUNTS.notes, PACK_COUNTS.after].every(id => ids.has(id));
}
