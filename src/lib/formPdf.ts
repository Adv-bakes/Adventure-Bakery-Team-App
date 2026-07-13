// Client-side PDF export for filled form entries and per-form reports.
// Reuses the pdfmake wiring, logo, and confidentiality footer from sopPdf.ts
// (which also wires pdfMake.vfs on import). On-demand, no caching.

import pdfMake from "pdfmake/build/pdfmake";
import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";
import { format } from "date-fns";
import { confidentialFooter, loadLogoDataUrl, PDF_GOLD } from "@/lib/sopPdf";
import {
  formatFieldValue,
  type FormSchema, type GridField, type GridRowValue, type InfoField, type ReportColumn,
} from "@/lib/formSchema";
import type { FormResponse } from "@/lib/formResponses";

const dash = "—";
const show = (v?: string | null) => (v && String(v).trim() ? String(v).trim() : dash);
const fmtDate = (iso: string | null | undefined, pattern = "M/d/yyyy h:mm a") => {
  if (!iso) return dash;
  try { return format(new Date(iso), pattern); } catch { return iso; }
};

const blackGrid = {
  hLineColor: () => "#000000",
  vLineColor: () => "#000000",
  hLineWidth: () => 1,
  vLineWidth: () => 1,
};

interface FormPdfDoc {
  title?: string | null;
  sop_number?: string | null;
  revision?: string | null;
  effective_date?: string | null;
  approved_by?: string | null;
}

/**
 * Render one filled entry as a paper-like PDF: SOP-style metadata header,
 * sections in schema order, grids as real tables, signatures as signed lines.
 */
export async function generateFormResponsePdf(
  doc: FormPdfDoc,
  schema: FormSchema,
  response: FormResponse,
  fillerName?: string,
): Promise<void> {
  const logo = await loadLogoDataUrl();
  const data = response.data ?? {};
  const body: Content[] = [];

  if (logo) body.push({ image: logo, width: 150, margin: [0, 0, 0, 8] });

  // Metadata header table (mirrors the paper form / SOP template).
  body.push({
    table: {
      widths: ["18%", "*", "22%", "20%"],
      body: [
        [
          { text: "Adventure Bakery, LLC", bold: true, colSpan: 2 }, {},
          { text: "Revision Num.", bold: true, alignment: "center" },
          { text: show(response.form_revision ?? doc.revision), alignment: "center" },
        ],
        [
          { text: "Form Title", bold: true },
          { text: show(doc.title), bold: true },
          { text: "Filled By", bold: true, alignment: "center" },
          { text: show(fillerName), alignment: "center" },
        ],
        [
          { text: "Form No.", bold: true },
          { text: show(response.form_number ?? doc.sop_number) },
          { text: response.status === "submitted" ? "Submitted:" : "Status:", bold: true, alignment: "center" },
          {
            text: response.status === "submitted" ? fmtDate(response.submitted_at) : "DRAFT",
            alignment: "center",
            ...(response.status !== "submitted" ? { bold: true, color: "#B45309" } : {}),
          },
        ],
      ],
    },
    layout: blackGrid,
    margin: [0, 0, 0, 12],
  });

  for (const section of schema.sections) {
    if (section.title) {
      body.push({ text: section.title, bold: true, color: PDF_GOLD, fontSize: 11, margin: [0, 8, 0, 4] });
    }
    for (const field of section.fields) {
      switch (field.type) {
        case "heading":
          body.push({ text: field.label, bold: true, margin: [0, 6, 0, 2] });
          break;
        case "info":
          body.push({ text: (field as InfoField).text || field.label, fontSize: 8.5, italics: true, color: "#555555", margin: [0, 0, 0, 4] });
          break;
        case "grid": {
          const grid = field as GridField;
          const rows: GridRowValue[] = Array.isArray(data[grid.id]) ? data[grid.id] : [];
          const fixed = grid.rows.mode === "fixed";
          const fixedLabels = fixed ? (grid.rows as { labels: string[] }).labels : [];
          const header: TableCell[] = [
            ...(fixed ? [{ text: "", fillColor: "#F5F1E6" }] : []),
            ...grid.columns.map(c => ({
              text: c.unit ? `${c.label} (${c.unit})` : c.label,
              bold: true, fontSize: 8.5, fillColor: "#F5F1E6",
            })),
          ];
          // Fixed grids can have extra rows appended beyond fixedLabels (a
          // filler-added item not on the paper register) — iterate by the
          // larger of the two counts so those aren't silently dropped, using
          // the row's own "_label" for the ones past the schema-defined list.
          const rowCount = fixed ? Math.max(fixedLabels.length, rows.length) : rows.length;
          const dataRows: TableCell[][] = Array.from({ length: rowCount }, (_, i) => {
            const row = rows[i] ?? {};
            const label = fixed ? (fixedLabels[i] ?? (row as any)._label ?? "") : String(i);
            return [
              ...(fixed ? [{ text: label, bold: true, fontSize: 8.5, fillColor: "#FBF8F1" } as TableCell] : []),
              ...grid.columns.map(c => ({ text: formatFieldValue(c as any, row[c.id]) || " ", fontSize: 8.5 } as TableCell)),
            ];
          });
          body.push({ text: field.label, bold: true, margin: [0, 4, 0, 2] });
          body.push({
            table: {
              headerRows: 1,
              widths: [
                ...(fixed ? ["auto"] : []),
                ...grid.columns.map(c => (c.width ? `${c.width}*` : "*")),
              ],
              body: [header, ...(dataRows.length ? dataRows : [[
                ...(fixed ? [{ text: " " } as TableCell] : []),
                ...grid.columns.map(() => ({ text: " " } as TableCell)),
              ]])],
            },
            layout: blackGrid,
            margin: [0, 0, 0, 6],
          });
          break;
        }
        case "signature": {
          const value = formatFieldValue(field, data[field.id]);
          body.push({
            text: [
              { text: `${field.label}: `, bold: true },
              value ? { text: `Signed — ${value}` } : { text: "(not signed)", italics: true, color: "#777777" },
            ],
            margin: [0, 4, 0, 4],
          });
          break;
        }
        default: {
          const value = formatFieldValue(field, data[field.id]);
          body.push({
            text: [{ text: `${field.label}: `, bold: true }, value || dash],
            margin: [0, 0, 0, 3],
          });
        }
      }
    }
  }

  // Closing audit line.
  body.push({
    text: [
      { text: "Created: ", bold: true }, `${fmtDate(response.created_at)}    `,
      { text: "Status: ", bold: true }, `${response.status}    `,
      ...(response.submitted_at ? [{ text: "Submitted: ", bold: true } as any, fmtDate(response.submitted_at)] : []),
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

  const fileName = `${show(response.form_number ?? doc.sop_number)} ${doc.title ?? "Form"} ${fmtDate(response.created_at, "yyyy-MM-dd")}.pdf`
    .replace(/[\\/:*?"<>|]/g, "-");
  pdfMake.createPdf(docDefinition).download(fileName);
}

/** Max data columns in the report PDF; wider forms point to the CSV export. */
const MAX_REPORT_COLUMNS = 10;

/**
 * Landscape per-form report: one row per entry, one column per (flattened)
 * schema field, clamped to MAX_REPORT_COLUMNS.
 */
export async function generateFormReportPdf(
  doc: FormPdfDoc,
  columns: ReportColumn[],
  entries: Array<{ response: FormResponse; fillerName: string }>,
  range: { from: string; to: string },
): Promise<void> {
  const logo = await loadLogoDataUrl();
  const clamped = columns.slice(0, MAX_REPORT_COLUMNS);
  const truncated = columns.length > clamped.length;

  const header: TableCell[] = [
    { text: "Entry Date", bold: true, fontSize: 8, fillColor: "#F5F1E6" },
    { text: "Filled By", bold: true, fontSize: 8, fillColor: "#F5F1E6" },
    { text: "Status", bold: true, fontSize: 8, fillColor: "#F5F1E6" },
    ...clamped.map(c => ({ text: c.header, bold: true, fontSize: 8, fillColor: "#F5F1E6" })),
  ];
  const rows: TableCell[][] = entries.map(({ response, fillerName }) => [
    { text: fmtDate(response.submitted_at ?? response.created_at, "M/d/yyyy"), fontSize: 8 },
    { text: fillerName || dash, fontSize: 8 },
    { text: response.status, fontSize: 8 },
    ...clamped.map(c => ({ text: c.cell(response.data ?? {}) || dash, fontSize: 8 })),
  ]);

  const body: Content[] = [];
  if (logo) body.push({ image: logo, width: 130, margin: [0, 0, 0, 6] });
  body.push({ text: `${show(doc.sop_number)} — ${show(doc.title)}`, bold: true, fontSize: 13, margin: [0, 0, 0, 2] });
  body.push({
    text: `Form entries report · ${range.from} to ${range.to} · ${entries.length} entr${entries.length === 1 ? "y" : "ies"} · generated ${format(new Date(), "M/d/yyyy h:mm a")}`,
    fontSize: 8.5, color: "#555555", margin: [0, 0, 0, 8],
  });
  if (truncated) {
    body.push({
      text: `Showing the first ${clamped.length} of ${columns.length} fields — export the CSV for the full detail. Not shown: ${columns.slice(clamped.length).map(c => c.header).join(", ")}.`,
      fontSize: 8, italics: true, color: "#B45309", margin: [0, 0, 0, 4],
    });
  }
  body.push({
    table: {
      headerRows: 1,
      widths: ["auto", "auto", "auto", ...clamped.map(() => "*")],
      body: [header, ...(rows.length ? rows : [header.map(() => ({ text: dash, fontSize: 8 } as TableCell))])],
    },
    layout: {
      hLineColor: () => "#999999",
      vLineColor: () => "#999999",
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
    },
  });

  const docDefinition: TDocumentDefinitions = {
    pageSize: "LETTER",
    pageOrientation: "landscape",
    pageMargins: [40, 36, 40, 70],
    defaultStyle: { fontSize: 9, lineHeight: 1.15 },
    content: body,
    footer: confidentialFooter,
  };

  const fileName = `${show(doc.sop_number)} report ${range.from} to ${range.to}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
  pdfMake.createPdf(docDefinition).download(fileName);
}

/**
 * Derived-log register PDF (e.g. FRM-003 Customer Complaint Log rendered from
 * FRM-002 responses): a paper-like register whose header uses the LOG doc's
 * metadata, one table row per projected source entry, an optional legend, and
 * the standard confidential footer. Rows arrive already projected (string
 * cells) so this stays decoupled from the report engine.
 */
export async function generateDerivedReportPdf(
  logDoc: FormPdfDoc,
  headers: string[],
  rows: string[][],
  meta: { rangeLabel?: string; count: number; sourceLabel?: string; legend?: string[] },
): Promise<void> {
  const logo = await loadLogoDataUrl();
  const clampCount = Math.min(headers.length, MAX_REPORT_COLUMNS);
  const clampedHeaders = headers.slice(0, clampCount);
  const truncated = headers.length > clampCount;

  const body: Content[] = [];
  if (logo) body.push({ image: logo, width: 130, margin: [0, 0, 0, 6] });

  // Metadata header table (mirrors the paper register template).
  body.push({
    table: {
      widths: ["18%", "*", "20%", "20%"],
      body: [
        [
          { text: "Adventure Bakery, LLC", bold: true, colSpan: 2 }, {},
          { text: "Revision Num.", bold: true, alignment: "center" },
          { text: show(logDoc.revision), alignment: "center" },
        ],
        [
          { text: "Log Title", bold: true },
          { text: show(logDoc.title), bold: true },
          { text: "Doc No.", bold: true, alignment: "center" },
          { text: show(logDoc.sop_number), alignment: "center" },
        ],
        [
          { text: "Derived From", bold: true },
          { text: show(meta.sourceLabel) },
          { text: "Effective Date", bold: true, alignment: "center" },
          { text: show(logDoc.effective_date), alignment: "center" },
        ],
      ],
    },
    layout: blackGrid,
    margin: [0, 0, 0, 8],
  });

  body.push({
    text: `${meta.rangeLabel ? `${meta.rangeLabel} · ` : ""}${meta.count} entr${meta.count === 1 ? "y" : "ies"} · generated ${format(new Date(), "M/d/yyyy h:mm a")}`,
    fontSize: 8.5, color: "#555555", margin: [0, 0, 0, 8],
  });
  if (truncated) {
    body.push({
      text: `Showing the first ${clampCount} of ${headers.length} columns — export the CSV for the full detail. Not shown: ${headers.slice(clampCount).join(", ")}.`,
      fontSize: 8, italics: true, color: "#B45309", margin: [0, 0, 0, 4],
    });
  }

  const headerRow: TableCell[] = clampedHeaders.map(h => ({ text: h, bold: true, fontSize: 8, fillColor: "#F5F1E6" }));
  const dataRows: TableCell[][] = rows.map(r =>
    r.slice(0, clampCount).map(c => ({ text: c || dash, fontSize: 8 } as TableCell)),
  );
  body.push({
    table: {
      headerRows: 1,
      widths: clampedHeaders.map(() => "*"),
      body: [headerRow, ...(dataRows.length ? dataRows : [clampedHeaders.map(() => ({ text: dash, fontSize: 8 } as TableCell))])],
    },
    layout: {
      hLineColor: () => "#999999",
      vLineColor: () => "#999999",
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
    },
  });

  if (meta.legend && meta.legend.length) {
    body.push({ text: "Legend", bold: true, fontSize: 9, margin: [0, 10, 0, 2] });
    for (const line of meta.legend) {
      body.push({ text: line, fontSize: 8, color: "#555555", margin: [0, 0, 0, 1] });
    }
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: "LETTER",
    pageOrientation: "landscape",
    pageMargins: [40, 36, 40, 70],
    defaultStyle: { fontSize: 9, lineHeight: 1.15 },
    content: body,
    footer: confidentialFooter,
  };

  const fileName = `${show(logDoc.sop_number)} ${logDoc.title ?? "log"}${meta.rangeLabel ? ` ${meta.rangeLabel}` : ""}.pdf`
    .replace(/[\\/:*?"<>|]/g, "-");
  pdfMake.createPdf(docDefinition).download(fileName);
}
