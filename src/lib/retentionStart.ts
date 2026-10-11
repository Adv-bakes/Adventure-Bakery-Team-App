// What a Retention Sample Log entry (FRM-703) can be started with when it is opened for a lot from
// the Today page's Release steps - so the person logging the sample checks answers against the
// pack on the shelf instead of typing them (owner's request, 2026-10-10).
//
// Every answer here comes from a record, and each is still read against the pack:
//  - bar code digits: the product's recorded number (its label review, else its formula sheet);
//  - customer: the product's last release, else its specification, else its approved label;
//  - best-by date: what the FIRST-PACK PHOTO read off the pack and found correct, word for word;
//    with no such photo, the month the pack must print (bake date + shelf life). FSQM-014 anchors
//    the retention period to the date printed on the pack, so the read is preferred to the sum;
//  - discard due: the form's own rule applied to that date (thirty days, from the last day of the
//    month where the pack is coded to a month - FSQM-014 Part 6). Not a second rule written here.
//
// Nothing here throws for a missing source: an answer that cannot be looked up is left blank.

import { fetchResponse, loadReleaseRecords } from "@/lib/formResponses";
import { loadProductBarcode } from "@/lib/formReport";
import { bestByFromPackNotes, expectedBestBy, monthLabel } from "@/lib/firstPackCheck";
import { deriveDateValue, valueFields, type FormSchema } from "@/lib/formSchema";
import { releaseFill } from "@/lib/releaseAssist";

export interface RetentionLot { id: string; product: string; lotCode: string; bakeDate: string }

export async function retentionDefaults(lot: RetentionLot, schema: FormSchema | null): Promise<Record<string, string>> {
  const out: Record<string, string> = { product_name: lot.product, lot_code: lot.lotCode };
  if (lot.bakeDate) out.date_produced = lot.bakeDate;

  const [code, records, lotRecord] = await Promise.all([
    loadProductBarcode(lot.product),
    loadReleaseRecords().then(r => r.records).catch(() => null),
    fetchResponse(lot.id).catch(() => null),
  ]);
  if (code.barcode) out.upc = code.barcode;
  const customer = records ? releaseFill(records, lot.product, "", null).fields.customer : undefined;
  if (customer) out.customer = String(customer);

  const read = bestByFromPackNotes((lotRecord?.attachments ?? []).map(a => a.note ?? ""));
  const expected = expectedBestBy(lot.bakeDate);
  const printed = read || (expected ? monthLabel(expected) : "");
  if (printed) {
    out.printed_date = printed;
    const due = (schema ? valueFields(schema) : []).find(f => f.id === "discard_due") as { derive?: Parameters<typeof deriveDateValue>[0] } | undefined;
    const discard = due?.derive ? deriveDateValue(due.derive, printed) : undefined;
    if (discard) out.discard_due = discard;
  }

  // Only answers the form actually has.
  const ids = new Set((schema ? valueFields(schema) : []).map(f => f.id));
  return Object.fromEntries(Object.entries(out).filter(([k]) => ids.size === 0 || ids.has(k)));
}

/** The defaults that would fill a BLANK answer of an entry already started. Empty when there is nothing to add. */
export function blanksFilled(data: Record<string, any> | null | undefined, defaults: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(defaults).filter(([k]) => String(data?.[k] ?? "").trim() === ""));
}
