import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { buildPrfSections, dateTime, text, type PrfRelated, type PrfRow } from "./prfFields";

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).vfs ?? (pdfFonts as any).default?.pdfMake?.vfs;

const GOLD = "#C89B3C";
const dash = "—";

/**
 * A `prf_submissions` row. Deliberately the whole row (fetched with
 * `select("*")`) rather than a hand-listed subset — the previous narrow
 * interface is what silently capped the export at 27 of the table's 59
 * columns. Field selection and grouping now live in `prfFields.ts`.
 */
export type PrfPdfRow = PrfRow;

let logoDataUrl: string | null = null;

async function loadLogoDataUrl(): Promise<string | null> {
  if (logoDataUrl) return logoDataUrl;
  try {
    const res = await fetch("/sop-logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    logoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return logoDataUrl;
  } catch {
    return null;
  }
}

function buildFieldTable(rows: { label: string; value: string }[]): Content | null {
  if (!rows.length) return null;
  return {
    table: {
      widths: ["32%", "*"],
      body: rows.map(({ label, value }) => [
        { text: label, bold: true, fontSize: 9, color: "#555555" },
        { text: value, fontSize: 10 },
      ]),
    },
    layout: {
      hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 0 : 1),
      vLineWidth: () => 0,
      hLineColor: () => "#E5DCC3",
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 10],
  };
}

export async function generatePrfPdf(prf: PrfPdfRow, related: PrfRelated = {}): Promise<void> {
  const logo = await loadLogoDataUrl();
  const body: Content[] = [];

  if (logo) {
    body.push({ image: logo, width: 150, margin: [0, 0, 0, 8] });
  }

  body.push({ text: "Product Request Form", fontSize: 16, bold: true, margin: [0, 0, 0, 2] });
  body.push({
    text: prf.company_name || prf.product_name || "Untitled",
    fontSize: 12,
    color: "#555555",
    margin: [0, 0, 0, 4],
  });
  body.push({
    text: [
      { text: "Submitted: ", bold: true },
      `${dateTime(prf.submitted_at) ?? dateTime(prf.created_at) ?? dash}    `,
      { text: "Status: ", bold: true },
      text(prf.status) ?? dash,
    ],
    fontSize: 9,
    color: "#555555",
    margin: [0, 0, 0, 12],
  });

  for (const sec of buildPrfSections(prf, related)) {
    body.push({ text: sec.heading, bold: true, color: GOLD, fontSize: 11, margin: [0, 4, 0, 4] });

    // Long free text reads better as a paragraph than squeezed into a table cell.
    const blocks = sec.rows.filter((r) => r.block);
    const table = buildFieldTable(sec.rows.filter((r) => !r.block));
    if (table) body.push(table);
    for (const b of blocks) {
      body.push({ text: b.value, fontSize: 10, margin: [0, 0, 0, 10] });
    }
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: "LETTER",
    pageMargins: [54, 40, 54, 50],
    defaultStyle: { fontSize: 10, lineHeight: 1.2 },
    content: body,
    footer: (currentPage: number) => ({
      margin: [54, 8, 54, 0],
      columns: [
        { text: "Adventure Bakery, LLC", fontSize: 9, alignment: "left" },
        { text: "Confidential", italics: true, fontSize: 9, alignment: "center" },
        { text: String(currentPage), fontSize: 9, alignment: "right" },
      ],
    }),
  };

  const fileName = `PRF - ${prf.company_name || prf.product_name || prf.id}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
  pdfMake.createPdf(docDefinition).download(fileName);
}
