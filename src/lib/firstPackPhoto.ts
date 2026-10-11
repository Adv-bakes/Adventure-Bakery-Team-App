// The first-pack check's working half: keep the photo on the lot record, read it, compare it with
// the record and the product's formula sheet, and write the result into the photo's note. Shared
// by the entry page (FRM-520, under "Code on the pack") and the Today page's Record packing button,
// so the two cannot drift apart. The rules themselves are in firstPackCheck.ts.

import {
  extractPackageLabel, getResponseAttachmentUrl, saveResponseAttachments, uploadResponseAttachment, type FormResponse,
} from "@/lib/formResponses";
import { loadProductBarcode } from "@/lib/formReport";
import { decodeBarcode } from "@/lib/barcodeDecode";
import { FIRST_PACK, checkFirstPack, packNote, type PackLang, type PackLine } from "@/lib/firstPackCheck";

export interface FirstPackPhotoResult {
  /** The record as it now is (fresh updated_at) - adopt it, or the next save is refused as stale. */
  response: FormResponse;
  /** One line per point, in `lang`; null when the photo could not be read. */
  lines: PackLine[] | null;
  /** Why it could not be read. The photo itself is on the record whenever `response` changed. */
  error?: string;
}

/**
 * `values` are the record's answers as they stand on screen (the product, lot code and bake date
 * may not be saved yet). The note on the photo is always English - it is part of the record.
 * Throws only if the photo could not be put on the record at all.
 */
export async function photographFirstPack(
  response: FormResponse,
  file: File,
  values: Record<string, unknown>,
  lang: PackLang = "en",
): Promise<FirstPackPhotoResult> {
  const uploaded = await uploadResponseAttachment(response.id, file);
  const withPhoto = await saveResponseAttachments(response.id, [...(response.attachments ?? []), { ...uploaded, note: FIRST_PACK.notePrefix }]);
  try {
    const [result, decodedBarcode, barcode] = await Promise.all([
      getResponseAttachmentUrl(uploaded.path).then(url => extractPackageLabel([url], ["product_name", "lot_code", "best_by", "barcode"], "finished_goods")),
      decodeBarcode(file),
      loadProductBarcode(String(values[FIRST_PACK.product] ?? "")),
    ]);
    const expected = {
      product: String(values[FIRST_PACK.product] ?? ""), lot: String(values[FIRST_PACK.lot] ?? ""),
      bakeDate: String(values[FIRST_PACK.bakeDate] ?? ""), barcode,
    };
    const read = { ...result.facts, decodedBarcode };
    const noted = await saveResponseAttachments(response.id, (withPhoto.attachments ?? []).map(a =>
      a.path === uploaded.path ? { ...a, note: packNote(checkFirstPack(expected, read, "en")) } : a));
    return { response: noted, lines: checkFirstPack(expected, read, lang) };
  } catch (e: any) {
    return { response: withPhoto, lines: null, error: e?.message ?? "The photo could not be read" };
  }
}
