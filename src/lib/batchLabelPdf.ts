// The container labels of a batch made on site (FRM-530) as a 4 x 6 in PDF, one page per container,
// opened ready to print (owner, 2026-10-14). What goes on each page is decided in batchLabel.ts.

import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { LabelPage } from "./batchLabel";

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).vfs ?? (pdfFonts as any).default?.pdfMake?.vfs;

/** 4 x 6 inches, portrait, in points. */
const PAGE = { width: 288, height: 432 };

function page(p: LabelPage, first: boolean): Content {
  return {
    ...(first ? {} : { pageBreak: "before" as const }),
    stack: [
      { text: "ADVENTURE BAKERY · MADE ON SITE", fontSize: 8, bold: true, color: "#555555", characterSpacing: 0.5 },
      { text: p.product.toUpperCase(), fontSize: 22, bold: true, margin: [0, 6, 0, 0] },
      { text: `LOT ${p.lotCode}`, fontSize: 40, bold: true, margin: [0, 2, 0, 4] },
      {
        columns: [
          { stack: [{ text: "MADE", fontSize: 8, color: "#555555" }, { text: p.madeOn || "—", fontSize: 15 }] },
          { stack: [{ text: "USE BY", fontSize: 8, color: "#555555" }, { text: p.useBy || "—", fontSize: 15, bold: true }] },
        ],
      },
      ...(p.quantity ? [{ text: [{ text: "QUANTITY  ", fontSize: 8, color: "#555555" }, { text: p.quantity, fontSize: 18, bold: true }], margin: [0, 8, 0, 0] } as Content] : []),
      { text: `Container ${p.container} of ${p.of}`, fontSize: 13, margin: [0, 4, 0, 8] },
      { qr: p.qr, fit: 190, alignment: "center", eccLevel: "M", margin: [0, 4, 0, 0] },
      { text: `FRM-530 Intermediate Batch Record${p.madeBy ? ` · made by ${p.madeBy}` : ""}`, fontSize: 7, color: "#555555", alignment: "center", margin: [0, 8, 0, 0] },
      { text: "Keep sealed. Use within its use-by date (FSQM-016).", fontSize: 7, color: "#555555", alignment: "center" },
    ],
  };
}

/**
 * Open the labels ready to print. `win` is a window opened in the tap itself (a browser blocks one
 * opened later); without it the PDF is downloaded instead.
 */
export async function printBatchLabels(pages: LabelPage[], win: Window | null): Promise<void> {
  const doc: TDocumentDefinitions = {
    pageSize: PAGE,
    pageMargins: [18, 18, 18, 18],
    info: { title: `Labels - ${pages[0]?.product ?? ""} lot ${pages[0]?.lotCode ?? ""}` },
    content: pages.map((p, i) => page(p, i === 0)),
    defaultStyle: { fontSize: 10 },
  };
  const pdf = pdfMake.createPdf(doc);
  if (win) await pdf.print(win);
  else await pdf.download(`labels-${pages[0]?.lotCode ?? "batch"}.pdf`);
}
