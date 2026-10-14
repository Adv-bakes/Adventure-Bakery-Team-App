// The container label for a batch made on site (FRM-530, the syrup) - owner, 2026-10-14.
//
// Pure half: what goes on each label, how the quantity made is shared between the containers, and
// the QR code that lets the Dunking step read the lot exactly from a photo instead of by AI.
//
// Relative imports only, so scripts/test-batch-label.mjs can bundle it.

import { parseQty } from "./batchSheetFill";

export interface LabelBatch {
  product: string;
  lotCode: string;
  madeOn: string;
  useBy: string;
  /** "Quantity made" as written on the record ("75 lb"). */
  quantityMade: string;
  madeBy: string;
}

export interface LabelPage {
  product: string;
  lotCode: string;
  madeOn: string;
  useBy: string;
  /** This container's share, e.g. "37.5 lb"; blank when the quantity made cannot be read. */
  quantity: string;
  container: number;
  of: number;
  madeBy: string;
  /** What the QR code holds (labelPayload). */
  qr: string;
}

/** The most labels printed at once - a batch is one kettle, not a production run. */
export const MAX_LABELS = 20;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Each container's share of the quantity made: 75 lb over 2 containers is "37.5 lb". Null when the
 * quantity cannot be read as one figure and a unit (a range, "about 2 buckets", blank) - a quantity
 * is never guessed, and the label then leaves it off.
 */
export function labelQuantity(quantityMade: string, count: number): string | null {
  const q = parseQty(quantityMade);
  if (!q || !(q.qty > 0) || !Number.isInteger(count) || count < 1) return null;
  const each = round2(q.qty / count);
  return q.unit ? `${each} ${q.unit}` : String(each);
}

/** Marks the QR code as one of ours, and which version of its content. */
export const LABEL_QR_PREFIX = "ADVBAKES-LOT/1";

/**
 * What the QR code holds: a short, line-based text, so any scanner app shows it readably, and our
 * own scan reads the lot from it exactly. Example:
 *   ADVBAKES-LOT/1
 *   FRM-530
 *   Simple Syrup
 *   6287
 *   2026-10-14
 *   2026-11-13
 */
export function labelPayload(b: Pick<LabelBatch, "product" | "lotCode" | "madeOn" | "useBy">): string {
  const clean = (v: string) => String(v ?? "").replace(/[\r\n]+/g, " ").trim();
  return [LABEL_QR_PREFIX, "FRM-530", clean(b.product), clean(b.lotCode), clean(b.madeOn), clean(b.useBy)].join("\n");
}

export interface LabelRead { product: string; lotCode: string; madeOn: string; useBy: string }

/** Read one of our QR codes back; null for anything else (a supplier's code, another app's). */
export function parseLabelPayload(text: string): LabelRead | null {
  const lines = String(text ?? "").replace(/\r/g, "").split("\n").map(l => l.trim());
  if (lines[0] !== LABEL_QR_PREFIX || lines.length < 4) return null;
  const [, , product = "", lotCode = "", madeOn = "", useBy = ""] = lines;
  if (!lotCode) return null;
  return { product, lotCode, madeOn, useBy };
}

/** One page per container, numbered, each carrying its share of the quantity. */
export function labelPages(b: LabelBatch, count: number): LabelPage[] {
  const n = Math.max(1, Math.min(MAX_LABELS, Math.floor(count) || 1));
  const quantity = labelQuantity(b.quantityMade, n) ?? "";
  const qr = labelPayload(b);
  return Array.from({ length: n }, (_, i) => ({
    product: b.product, lotCode: b.lotCode, madeOn: b.madeOn, useBy: b.useBy, quantity,
    container: i + 1, of: n, madeBy: b.madeBy, qr,
  }));
}
