// The lots offered under "Lot on the container" on the mixing screens (owner, 2026-10-23): an offer
// of what the records say the container could be, never a closed list - anything can still be typed,
// and Scan the label still works.
//
// Two sources, in this order:
//  1. USED BEFORE - the same ingredient on earlier lot records (FRM-520). A 50 lb bag or a 35 lb jug
//     lasts more than one bake day, and the names match exactly: the formula sheet puts the same
//     ingredient name on every lot record.
//  2. RECEIVED - delivery lines of the receiving log (FRM-301) in the last months, ranked by the words
//     they share with the ingredient. Receiving types what the pack says ("SALAD OIL 100% PURE SOYBEAN
//     OIL"), the formula says "Soybean Oil (35 lb jug)", and the brand often differs too, so an exact
//     match would find almost nothing. A line sharing no word of the ingredient's name is not offered.
//
// Pure, no imports: tested by scripts/test-lot-offers.mjs.

export interface UsedLine { lot: string; ingredient: string; brand: string; date: string; entryId: string }
export interface ReceiptLine { lot: string; material: string; brand: string; supplier: string; date: string }

export interface LotOffer {
  lot: string;
  kind: "used" | "received";
  /** The day it was used or received (YYYY-MM-DD). */
  date: string;
  /** Received: what the receiving log calls it, and its brand. */
  material?: string;
  brand?: string;
}

const fold = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const lotKey = (s: unknown) => String(s ?? "").toLowerCase().replace(/[\s\-_./]+/g, "");

/** Words that say nothing about what an ingredient is. */
const NOISE = new Set([
  "the", "and", "with", "for", "from", "contains", "pure", "lb", "lbs", "oz", "kg", "jug", "bag", "bags", "gallon", "gal",
  "case", "pack", "bulk", "delivered", "classic", "based", "multi", "purpose", "container", "can", "cans", "inplt",
  "fine", "preserve", "color", "acid", "citric",
]);

/** The words of a name that identify it: lower case, no numbers, no packaging words, singular. */
export function nameWords(s: unknown): Set<string> {
  const out = new Set<string>();
  for (const w of fold(s).split(" ")) {
    if (w.length < 3 || /^\d+$/.test(w) || NOISE.has(w)) continue;
    out.add(w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  }
  return out;
}

const shared = (a: Set<string>, b: Set<string>) => [...a].filter(w => b.has(w)).length;
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * The offers for one ingredient line. `self` = the lot record being filled in, left out of "used
 * before". Received lines older than `days` before `today` are not offered.
 */
export function lotOffers(
  line: { ingredient: string; brand: string },
  used: UsedLine[],
  receipts: ReceiptLine[],
  opts: { today: string; self?: string; days?: number; maxUsed?: number; maxReceived?: number },
): LotOffer[] {
  const { today, self, days = 180, maxUsed = 5, maxReceived = 8 } = opts;
  const seen = new Set<string>();
  const out: LotOffer[] = [];

  const name = fold(line.ingredient);
  const before = used
    .filter(u => u.entryId !== self && fold(u.ingredient) === name && lotKey(u.lot) !== "")
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const u of before) {
    if (out.length >= maxUsed) break;
    const k = lotKey(u.lot);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ lot: u.lot.trim(), kind: "used", date: u.date.slice(0, 10) });
  }

  const what = nameWords(line.ingredient);
  const brand = nameWords(line.brand);
  const since = addDays(today, -days);
  const ranked = receipts
    .filter(r => lotKey(r.lot) !== "" && r.date.slice(0, 10) >= since)
    .map(r => {
      const theirs = new Set([...nameWords(r.material), ...nameWords(r.brand), ...nameWords(r.supplier)]);
      const match = shared(what, theirs);
      return { r, match, score: match * 2 + shared(brand, theirs) };
    })
    .filter(x => x.match > 0)
    .sort((a, b) => b.score - a.score || b.r.date.localeCompare(a.r.date));
  let n = 0;
  for (const { r } of ranked) {
    if (n >= maxReceived) break;
    const k = lotKey(r.lot);
    if (seen.has(k)) continue;
    seen.add(k);
    n++;
    out.push({ lot: r.lot.trim(), kind: "received", date: r.date.slice(0, 10), material: r.material.trim(), brand: (r.brand || r.supplier).trim() });
  }
  return out;
}
