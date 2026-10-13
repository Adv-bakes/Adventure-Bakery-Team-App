// The label scan of the mixing step ("Follow this lot"): a photo of an ingredient's container,
// read for its LOT CODE only. The ingredient and the brand on the lot record come from the
// formula sheet and are never written over by a photo; what the label says it is comes back as
// text, so the person can see they have the right container in hand.
//
// The photo is uploaded only so the reader can fetch it, and is always removed afterwards - the
// lot lands in a box the person reads and saves, as with a grid row's scan.

import {
  extractPackageLabel, getResponseAttachmentUrl, removeResponseAttachment, uploadResponseAttachment,
} from "./formResponses";

export interface MixScanResult {
  /** The variable-applied lot code, as printed; blank when none could be read. */
  lot: string;
  /** Other numbers on the pack that could be the lot - offered, never filled in. */
  alternates: string[];
  /** What the label says the product is ("All Purpose Flour · King Arthur"); blank when unread. */
  reads: string;
}

/** The pure half: the reader's answer as the mixing screen uses it. */
export function mixScanResult(result: { facts?: Record<string, string | undefined>; alternates?: { lot_code?: string[] } }): MixScanResult {
  const text = (v: unknown) => String(v ?? "").trim();
  const lot = text(result.facts?.lot_code);
  const seen = new Set<string>([lot.toLowerCase()]);
  const alternates: string[] = [];
  for (const a of result.alternates?.lot_code ?? []) {
    const t = text(a);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    alternates.push(t);
  }
  const reads = [text(result.facts?.product_name), text(result.facts?.brand)].filter(Boolean).join(" · ");
  return { lot, alternates, reads };
}

export async function scanIngredientLot(responseId: string, file: File): Promise<MixScanResult> {
  let path: string | null = null;
  try {
    path = (await uploadResponseAttachment(responseId, file)).path;
    const url = await getResponseAttachmentUrl(path);
    return mixScanResult(await extractPackageLabel([url], ["lot_code", "product_name", "brand"], "ingredient"));
  } finally {
    // Best-effort: an orphaned photo is harmless, a failed scan over a stray file would not be.
    if (path) await removeResponseAttachment(path).catch(() => { /* orphan */ });
  }
}
