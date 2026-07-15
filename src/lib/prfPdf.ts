import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).vfs ?? (pdfFonts as any).default?.pdfMake?.vfs;

const GOLD = "#C89B3C";
const dash = "—";

// Minimal shape of a prf_submissions row needed to render the PDF.
export interface PrfPdfRow {
  id: string;
  company_name?: string | null;
  company_stage?: string | null;
  founder_name?: string | null;
  email?: string | null;
  phone?: string | null;
  product_name?: string | null;
  project_type?: string | null;
  development_approach?: string | null;
  finished_form?: unknown;
  flavor_type?: string | null;
  intended_application?: unknown;
  additional_requirements?: unknown;
  packaging_readiness?: string | null;
  primary_packaging_vessel?: string | null;
  weight_per_unit?: string | null;
  weight_per_unit_unit?: string | null;
  units_per_primary_pack?: string | null;
  secondary_packaging?: string | null;
  artwork_readiness?: string | null;
  label_responsibility?: string | null;
  pallets_required?: string | null;
  target_date?: string | null;
  price_target_per_unit?: string | null;
  annual_volume?: string | null;
  order_quantity?: string | null;
  order_frequency?: string | null;
  warehousing_needs?: unknown;
  additional_project_info?: string | null;
  submitted_at?: string | null;
  status?: string | null;
}

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

const show = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return dash;
  if (Array.isArray(v)) return v.length ? v.join(", ") : dash;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

interface Section {
  heading: string;
  fields: [string, unknown][];
}

function buildFieldTable(fields: [string, unknown][]): Content | null {
  const rows = fields.filter(([, v]) => !(v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)));
  if (!rows.length) return null;
  return {
    table: {
      widths: ["32%", "*"],
      body: rows.map(([label, value]) => [
        { text: label, bold: true, fontSize: 9, color: "#555555" },
        { text: show(value), fontSize: 10 },
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

export async function generatePrfPdf(prf: PrfPdfRow): Promise<void> {
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
      `${show(prf.submitted_at)}    `,
      { text: "Status: ", bold: true },
      show(prf.status),
    ],
    fontSize: 9,
    color: "#555555",
    margin: [0, 0, 0, 12],
  });

  const sections: Section[] = [
    {
      heading: "Company & Contact",
      fields: [
        ["Company", prf.company_name],
        ["Stage", prf.company_stage],
        ["Founder", prf.founder_name],
        ["Email", prf.email],
        ["Phone", prf.phone],
      ],
    },
    {
      heading: "Product",
      fields: [
        ["Product", prf.product_name],
        ["Project Type", prf.project_type],
        ["Approach", prf.development_approach],
        ["Finished Form", prf.finished_form],
        ["Flavor Type", prf.flavor_type],
        ["Application", prf.intended_application],
        ["Requirements", prf.additional_requirements],
      ],
    },
    {
      heading: "Packaging",
      fields: [
        ["Packaging Readiness", prf.packaging_readiness],
        ["Primary Packaging", prf.primary_packaging_vessel],
        ["Weight per Unit", prf.weight_per_unit && `${prf.weight_per_unit} ${prf.weight_per_unit_unit || ""}`.trim()],
        ["Units per Pack", prf.units_per_primary_pack],
        ["Secondary Packaging", prf.secondary_packaging],
        ["Artwork", prf.artwork_readiness],
        ["Label Responsibility", prf.label_responsibility],
        ["Pallets Required", prf.pallets_required],
      ],
    },
    {
      heading: "Commercial",
      fields: [
        ["Target Date", prf.target_date],
        ["Price Target / Unit", prf.price_target_per_unit],
        ["Annual Volume", prf.annual_volume],
        ["Order Quantity", prf.order_quantity],
        ["Order Frequency", prf.order_frequency],
        ["Warehousing", prf.warehousing_needs],
      ],
    },
  ];

  for (const section of sections) {
    const table = buildFieldTable(section.fields);
    if (!table) continue;
    body.push({ text: section.heading, bold: true, color: GOLD, fontSize: 11, margin: [0, 4, 0, 4] });
    body.push(table);
  }

  if (prf.additional_project_info && prf.additional_project_info.trim()) {
    body.push({ text: "Notes", bold: true, color: GOLD, fontSize: 11, margin: [0, 4, 0, 4] });
    body.push({ text: prf.additional_project_info.trim(), fontSize: 10, margin: [0, 0, 0, 10] });
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
