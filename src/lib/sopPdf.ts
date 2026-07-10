import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { SECTION_LABELS, groupProcedureSteps, parseInlineMarks } from "@/lib/sopDocxParser";

// Converts plain text with **bold**/*italic* marks into a pdfmake text-run array.
const inline = (s: string) => ({
  text: parseInlineMarks(s).map(seg => ({ text: seg.text, bold: seg.bold, italics: seg.italic })),
});

// Wire up the bundled Roboto fonts (the import shape varies by build).
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).vfs ?? (pdfFonts as any).default?.pdfMake?.vfs;

// Trade-secret / confidentiality disclaimer — reproduced verbatim from the SOP template footer.
// Exported for reuse by other pdfmake documents (form entries, reports).
export const DISCLAIMER =
  "This document contains Confidential Commercial Information which constitutes TRADE SECRETS and is exempt from disclosure under the Freedom of Information Act pursuant to 5 USC (b) (4) and may not be disclosed without prior written approval from Adventure Bakery, LLC.";

export const PDF_GOLD = "#C89B3C";
const GOLD = PDF_GOLD;

/** Standard per-page footer (company · Confidential · page #  + disclaimer). */
export const confidentialFooter = (currentPage: number): Content => ({
  margin: [54, 8, 54, 0],
  stack: [
    {
      columns: [
        { text: "Adventure Bakery, LLC", fontSize: 9, alignment: "left" },
        { text: "Confidential", italics: true, fontSize: 9, alignment: "center" },
        { text: String(currentPage), fontSize: 9, alignment: "right" },
      ],
    },
    { text: DISCLAIMER, fontSize: 6.5, alignment: "center", color: "#444444", margin: [0, 2, 0, 0] },
  ],
});

// Minimal shape of a sop_documents row needed to render the PDF.
export interface SopPdfRow {
  title?: string | null;
  sop_number?: string | null;
  revision?: string | null;
  effective_date?: string | null;
  approved_by?: string | null;
  sqf_reference?: string | null;
  status?: string | null;
  content?: any;
}

let logoDataUrl: string | null = null;

export async function loadLogoDataUrl(): Promise<string | null> {
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

const dash = "—";
const show = (v?: string | null) => (v && String(v).trim() ? String(v).trim() : dash);

export async function generateSopPdf(row: SopPdfRow): Promise<void> {
  const logo = await loadLogoDataUrl();
  const content = row.content ?? {};

  const body: Content[] = [];

  // Logo above the header table.
  if (logo) {
    body.push({ image: logo, width: 150, margin: [0, 0, 0, 8] });
  }

  // 3-row metadata header table (mirrors the SOP template).
  body.push({
    table: {
      widths: ["18%", "*", "22%", "20%"],
      body: [
        [
          { text: "Adventure Bakery, LLC", bold: true, colSpan: 2 },
          {},
          { text: "Revision Num.", bold: true, alignment: "center" },
          { text: show(row.revision), alignment: "center" },
        ],
        [
          { text: "SOP Title", bold: true },
          { text: show(row.title), bold: true },
          { text: "Approval", bold: true, alignment: "center" },
          { text: show(row.approved_by), alignment: "center" },
        ],
        [
          { text: "SOP No.", bold: true },
          { text: show(row.sop_number) },
          { text: "Eff. Date:", bold: true, alignment: "center" },
          { text: show(row.effective_date), alignment: "center" },
        ],
      ],
    },
    layout: {
      hLineColor: () => "#000000",
      vLineColor: () => "#000000",
      hLineWidth: () => 1,
      vLineWidth: () => 1,
    },
    margin: [0, 0, 0, 12],
  });

  // Clause reference + linked form, near the top (as in the sample).
  if (row.sqf_reference && row.sqf_reference.trim()) {
    body.push({
      text: [
        { text: "Clause Reference: ", bold: true },
        `${row.sqf_reference.trim()} (SQF Code, Edition 9)`,
      ],
      margin: [0, 0, 0, 2],
    });
  }
  if (typeof content.form_references === "string" && content.form_references.trim()) {
    body.push({
      text: [{ text: "Linked Form: ", bold: true }, content.form_references.trim()],
      margin: [0, 0, 0, 8],
    });
  }

  // Body sections, in canonical order, skipping empties.
  for (const { key, display } of SECTION_LABELS) {
    if (key === "procedure") {
      const steps = Array.isArray(content.procedure) ? content.procedure.filter(Boolean) : [];
      if (!steps.length) continue;
      body.push({ text: `${display}:`, bold: true, color: GOLD, margin: [0, 8, 0, 2] });
      // Group bullet lines under their numbered step so sub-bullets don't get their own number.
      const groups = groupProcedureSteps(steps as string[]);
      // A leading bullet block (no numbered step above it) renders as a plain bullet list.
      const lead = groups[0]?.text === "" ? groups[0] : null;
      const numbered = lead ? groups.slice(1) : groups;
      if (lead && lead.bullets.length > 0) {
        body.push({ ul: lead.bullets.map(inline), margin: [0, 0, 0, 4] });
      }
      if (numbered.length > 0) {
        body.push({
          ol: numbered.map(g =>
            g.bullets.length > 0
              ? { stack: [inline(g.text), { ul: g.bullets.map(inline), margin: [0, 2, 0, 0] }] }
              : inline(g.text),
          ),
          margin: [0, 0, 0, 4],
        });
      }
      continue;
    }
    // form_references already rendered above as "Linked Form".
    if (key === "form_references") continue;
    const val = content[key];
    if (typeof val !== "string" || !val.trim()) continue;
    body.push({ text: `${display}:`, bold: true, color: GOLD, margin: [0, 8, 0, 2] });
    // Preserve line breaks (e.g. responsibility/records bullet lines).
    body.push({ text: val.trim(), margin: [0, 0, 0, 4] });
  }

  // Closing metadata line.
  body.push({
    text: [
      { text: "Revision: ", bold: true }, `${show(row.revision)}    `,
      { text: "Status: ", bold: true }, `${show(row.status)}    `,
      { text: "Approved By: ", bold: true }, show(row.approved_by),
    ],
    margin: [0, 14, 0, 0],
    fontSize: 9,
  });

  const docDefinition: TDocumentDefinitions = {
    pageSize: "LETTER",
    pageMargins: [54, 40, 54, 70],
    defaultStyle: { fontSize: 10, lineHeight: 1.2 },
    content: body,
    footer: confidentialFooter,
  };

  const fileName = `${row.sop_number ? `SOP-${row.sop_number} ` : ""}${row.title ?? "SOP"}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
  pdfMake.createPdf(docDefinition).download(fileName);
}
