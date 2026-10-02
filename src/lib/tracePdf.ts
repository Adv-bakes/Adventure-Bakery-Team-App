// Lot trace report as a PDF (pdfmake, client-side, on demand) - the trace as it stood at the moment
// it was run, for the recall file or to hand to a customer or an auditor. Every record named is a
// live link back to the entry. The trace itself is lotTrace.ts; this only lays it out.

import pdfMake from "pdfmake/build/pdfmake";
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { format } from "date-fns";
import { appOrigin, confidentialFooter, loadLogoDataUrl, PDF_GOLD } from "@/lib/sopPdf";
import type { ContactRow, LotTrace, RecordRef, TraceResult } from "@/lib/lotTrace";

const GRID = { hLineColor: () => "#999999", vLineColor: () => "#999999", hLineWidth: () => 0.5, vLineWidth: () => 0.5 };
const dash = "-";

function recordLink(r: RecordRef): Content {
  return {
    text: [
      { text: r.title, link: `${appOrigin()}/team/compliance/forms/${r.docId}/entries/${r.id}`, color: PDF_GOLD, decoration: "underline" },
      ...(r.draft ? [{ text: "  DRAFT - not submitted", color: "#B45309", bold: true }] : []),
    ],
  };
}
const head = (labels: string[]): TableCell[] => labels.map(text => ({ text, bold: true, fillColor: "#F3EBD8" }));
const h2 = (text: string): Content => ({ text, bold: true, fontSize: 10, margin: [0, 8, 0, 3] });
const note = (text: string): Content => ({ text, italics: true, color: "#B45309", fontSize: 8.5 });

function contactLine(c: ContactRow): Content {
  return { text: [{ text: c.label, bold: true }, [c.name, c.phone, c.email].filter(Boolean).map(x => `   ${x}`).join("") || "   no phone or email on the list"], margin: [0, 0, 0, 1] };
}

function lotBlock(lot: LotTrace): Content[] {
  const out: Content[] = [];
  out.push({
    text: [
      { text: `Lot ${lot.lotCode}${lot.product ? ` - ${lot.product}` : ""}`, bold: true, fontSize: 11.5 },
      { text: [lot.bakeDate && `   baked ${lot.bakeDate}`, lot.unitsPacked && `   packed ${lot.unitsPacked}`].filter(Boolean).join(""), color: "#555555" },
    ],
    margin: [0, 12, 0, 2],
  });
  for (const r of lot.records) out.push(recordLink(r));

  out.push(h2("What went in - one step back"));
  if (lot.inputs.length === 0) out.push(note("No Production Lot Record (FRM-520), so the supplier lots are not known."));
  else out.push({
    table: {
      headerRows: 1, widths: ["30%", "22%", "*"],
      body: [
        head(["Ingredient", "Supplier lot", "Received (FRM-301)"]),
        ...lot.inputs.map((i): TableCell[] => [
          { text: [i.ingredient, i.brand ? ` (${i.brand})` : "", i.trigger ? "  - the lot traced" : ""], bold: i.trigger },
          i.supplierLot || { text: "none recorded", color: "#B45309" },
          i.receipts.length
            ? { stack: i.receipts.map(r => ({ stack: [`${r.date}${r.supplier ? ` - ${r.supplier}` : ""}${r.qty ? `, qty ${r.qty}` : ""}`, recordLink(r.ref)] })) }
            : i.supplierLot ? { text: "no receipt found", color: "#B45309" } : dash,
        ]),
      ],
    },
    layout: GRID,
  });

  out.push(h2("Where it went - one step forward"));
  if (lot.dispatches.length === 0) out.push(note("No dispatch recorded on FRM-801."));
  else out.push({
    table: {
      headerRows: 1, widths: ["*", "18%", "16%", "34%"],
      body: [head(["Customer", "Quantity", "Collected", "Record"]),
        ...lot.dispatches.map((d): TableCell[] => [d.customer || dash, d.quantity || dash, d.date || dash, recordLink(d.ref)])],
    },
    layout: GRID,
  });

  out.push(h2("Retention sample (FRM-703) and release (FRM-701)"));
  if (lot.retention.length === 0) out.push(note("No retention sample recorded."));
  for (const r of lot.retention) out.push({ text: [`Retained: ${r.units || "?"} unit(s)${r.location ? ` at ${r.location}` : ""}${r.disposition ? ` - ${r.disposition}` : ""}   `, recordLink(r.ref) as any] });
  if (lot.releases.length === 0) out.push({ text: "No release record.", color: "#555555" });
  for (const r of lot.releases) out.push({ text: [`Release: ${r.decision || "?"}${r.quantity ? `, ${r.quantity}` : ""}   `, recordLink(r.ref) as any] });

  if (lot.otherProduct.length) {
    out.push(h2("Same lot code, different product name - check these"));
    for (const r of lot.otherProduct) out.push(recordLink(r));
  }
  return out;
}

/** The pdfmake document for a trace - separate from the download so it can be rendered in a test. */
export function buildTraceDoc(result: TraceResult, context?: { recordTitle?: string; mock?: boolean }, logo?: string | null): TDocumentDefinitions {
  const { start } = result;
  const what = `${start.kind === "material" ? "Supplier lot" : "Lot"} ${start.lot}${start.name ? ` (${start.name})` : ""}`;
  const body: Content[] = [];
  if (logo) body.push({ image: logo, width: 130, margin: [0, 0, 0, 6] });
  body.push({ text: "Lot Trace Report", fontSize: 15, bold: true });
  body.push({ text: what, fontSize: 11, margin: [0, 2, 0, 0] });
  body.push({
    text: [
      `Generated ${format(new Date(), "M/d/yyyy h:mm a")} from the Team Portal records (FRM-520, 301, 801, 703, 701, 702, 011) under FSQM-021 and FSQM-023.`,
      context?.recordTitle ? ` Run from ${context.recordTitle}.` : "",
      " A printed trace is a snapshot: the links open the live records.",
    ].join(""),
    fontSize: 8.5, color: "#555555", margin: [0, 2, 0, 6],
  });
  if (context?.mock) body.push({ text: "MOCK RECALL - a test. Do not notify customers, authorities or SQFI.", bold: true, margin: [0, 0, 0, 6] });
  body.push({
    text: result.lots.length === 0 ? "No finished lot found." : `${result.lots.length} finished lot${result.lots.length === 1 ? "" : "s"} involved.`,
    bold: true,
  });

  if (result.gaps.length) {
    body.push(h2("What the records do not show"));
    body.push({ ul: result.gaps, fontSize: 8.5, color: "#92400E" });
  }
  if (start.kind === "material" && result.materialReceipts.length) {
    body.push(h2(`Receipts of supplier lot ${start.lot} (FRM-301)`));
    for (const r of result.materialReceipts) {
      body.push({ text: [`${r.date} - ${r.material}${r.supplier ? ` from ${r.supplier}` : ""}${r.qty ? `, qty ${r.qty}` : ""}   `, recordLink(r.ref) as any] });
    }
  }
  for (const lot of result.lots) body.push(...lotBlock(lot));

  if (result.holds.length) {
    body.push(h2("Holds already on record (FRM-702)"));
    for (const h of result.holds) {
      body.push({ text: [`${h.material}${h.lot ? `, lot ${h.lot}` : ""}${h.quantity ? `, ${h.quantity}` : ""}${h.disposition ? ` - ${h.disposition}` : ""}   `, recordLink(h.ref) as any] });
    }
  }

  if (result.lots.length) {
    body.push(h2("Contacts"));
    if (result.contactList) body.push(recordLink(result.contactList));
    else body.push(note("No contact list (FRM-011) has been filled in."));
    for (const c of result.customers) {
      body.push({ text: `Customer: ${c.customer}`, bold: true, margin: [0, 4, 0, 1] });
      if (!c.matched) body.push(note(`Not found by name on the contact list${c.rows.length ? " - the customers on the list are:" : "."}`));
      for (const r of c.rows) body.push(contactLine(r));
    }
    if (result.essential.length) {
      body.push({ text: "Essential organizations (SQF 2.6.3.1 iv)", bold: true, margin: [0, 4, 0, 1] });
      for (const r of result.essential) body.push(contactLine(r));
    }
  }

  return {
    pageSize: "LETTER",
    pageMargins: [40, 36, 40, 70],
    defaultStyle: { fontSize: 9, lineHeight: 1.15 },
    content: body,
    footer: confidentialFooter,
  };
}

/** Download the trace as a PDF. `context` names the recall record it was run from, when there is one. */
export async function generateTracePdf(result: TraceResult, context?: { recordTitle?: string; mock?: boolean }): Promise<void> {
  const doc = buildTraceDoc(result, context, await loadLogoDataUrl());
  const fileName = `Lot trace ${result.start.lot} ${format(new Date(), "yyyy-MM-dd HHmm")}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
  await pdfMake.createPdf(doc).download(fileName);
}
