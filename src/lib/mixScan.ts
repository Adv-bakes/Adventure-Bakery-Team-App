// The label scan of the mixing step ("Follow this lot"): a photo of an ingredient's container,
// read for its LOT CODE only. The ingredient and the brand on the lot record come from the
// formula sheet and are never written over by a photo; what the label says it is comes back as
// text, so the person can see they have the right container in hand.
//
// The photo is sent to the reader as a picture and never stored (2026-10-15: it used to be uploaded
// so the reader could fetch it by link, which was slow and unreliable) - the lot lands in a box the
// person reads and saves, as with a grid row's scan.

import { extractPackageLabel } from "./formResponses";
import { photoDataUrl } from "./photoData";
import { decodeQr } from "./barcodeDecode";
import { parseLabelPayload } from "./batchLabel";

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

/**
 * One of our own container labels (a batch made on site, FRM-530) carries a QR code with the lot:
 * when the photo shows one, the lot is taken from it exactly and the photo is not sent to be read.
 */
async function ourLabel(file: File): Promise<MixScanResult | null> {
  const read = parseLabelPayload(await decodeQr(file));
  return read ? { lot: read.lotCode, alternates: [], reads: `${read.product} · lot ${read.lotCode} (our label's code)` } : null;
}

export async function scanIngredientLot(_responseId: string, file: File): Promise<MixScanResult> {
  const ours = await ourLabel(file);
  if (ours) return ours;
  return mixScanResult(await extractPackageLabel([await photoDataUrl(file)], ["lot_code", "product_name", "brand"], "ingredient"));
}
