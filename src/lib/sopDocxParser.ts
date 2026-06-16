import mammoth from "mammoth";
import JSZip from "jszip";

export type SopType = "sop" | "form" | "policy";

export interface ParsedSop {
  sop_number: string;
  title: string;
  revision: string;
  effective_date: string;
  approved_by: string;
  type: SopType;
  sqf_reference: string;
  sqf_required: boolean;
  content: {
    purpose: string;
    scope: string;
    responsibility: string;
    procedure: string[];
    form_references: string;
    records: string;
    governing_reference: string;
    statement?: string;
  };
  warnings: string[];
}

export const SECTION_LABELS: { key: keyof ParsedSop["content"]; pattern: RegExp; display: string }[] = [
  { key: "purpose", pattern: /^purpose\b/i, display: "Purpose" },
  { key: "scope", pattern: /^scope\b/i, display: "Scope" },
  { key: "responsibility", pattern: /^responsibilit(y|ies)\b/i, display: "Responsibility" },
  { key: "procedure", pattern: /^procedure\b/i, display: "Procedure" },
  { key: "form_references", pattern: /^form\s+references?\b/i, display: "Form References" },
  { key: "records", pattern: /^records?\b/i, display: "Records" },
  { key: "governing_reference", pattern: /^governing\s+reference\b/i, display: "Governing Reference" },
];

const HEADER_FIELDS: { key: keyof Pick<ParsedSop, "sop_number" | "title" | "revision" | "effective_date" | "approved_by">; pattern: RegExp; display: string }[] = [
  { key: "sop_number", pattern: /^(sop|form)\s*(no\.?|number|#)\s*:?$/i, display: "SOP/Form number" },
  { key: "title", pattern: /^(sop|form)?\s*title\s*:?$/i, display: "Title" },
  { key: "revision", pattern: /^revision(\s*(num\.?|number))?\s*:?$/i, display: "Revision" },
  { key: "effective_date", pattern: /^eff(?:ective)?\.?\s*date\s*:?$/i, display: "Effective date" },
  { key: "approved_by", pattern: /^approv(al|ed)\b(\s*(by|initials?))?\s*:?$/i, display: "Approved by" },
];

// textContent collapses <br> with no whitespace ("...times.Wear PPE..."); replace
// them with a space first so sentences stay separated.
function textOf(el: Element): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("br").forEach((br) => br.replaceWith(" "));
  return (clone.textContent || "").replace(/\s+/g, " ").trim();
}

function stripLeadingNumber(text: string): string {
  return text.replace(/^\s*(?:section\s*)?\d+[.):]?\s*/i, "").trim();
}

function detectType(sopNumber: string): SopType {
  const n = sopNumber.trim().toUpperCase();
  if (n.startsWith("FSQM")) return "policy";
  if (n.startsWith("FRM")) return "form";
  if (n.startsWith("SOP")) return "sop";
  return "sop";
}

function extractSqfCode(text: string): string {
  const match = text.match(/(\d+(?:\.\d+){1,3})/);
  return match ? match[1] : "";
}

// Header dates commonly appear as M/D/YY or M/D/YYYY — normalize to ISO (YYYY-MM-DD)
// so the value is usable both by <input type="date"> and the Postgres `date` column.
function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!match) return "";
  let [, month, day, year] = match;
  if (year.length === 2) year = (Number(year) < 50 ? "20" : "19") + year;
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// Header tables can use a merged-cell layout where each row holds multiple
// label/value pairs side by side (e.g. "Form No." | "11.3" | "Eff. Date:" | "10/28/25").
// Walk every adjacent cell pair in each row and match labels against HEADER_FIELDS.
function matchHeaderFields(rows: string[][], parsed: ParsedSop) {
  for (const cells of rows) {
    for (let i = 0; i < cells.length - 1; i++) {
      const label = cells[i];
      if (!label) continue;
      for (const field of HEADER_FIELDS) {
        if (field.pattern.test(label)) {
          const value = cells[i + 1]?.trim();
          if (value) {
            (parsed as any)[field.key] = value;
          }
        }
      }
    }
  }
}

function parseHeaderTable(table: HTMLTableElement, parsed: ParsedSop) {
  const rows = Array.from(table.querySelectorAll("tr")).map(row =>
    Array.from(row.querySelectorAll("td, th")).map(c => (c.textContent || "").trim())
  );
  matchHeaderFields(rows, parsed);
}

// Some SOP templates place the header table inside the page header (running header)
// rather than the document body — mammoth doesn't convert page headers to HTML, so
// we read it directly from the .docx's underlying XML (a .docx is a zip archive).
async function extractHeaderTableRowsFromDocx(arrayBuffer: ArrayBuffer): Promise<string[][] | null> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    for (const path of ["word/header1.xml", "word/header2.xml", "word/header3.xml"]) {
      const entry = zip.file(path);
      if (!entry) continue;
      const xml = await entry.async("text");
      const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
      const table = xmlDoc.getElementsByTagName("w:tbl")[0];
      if (!table) continue;
      const rows = Array.from(table.getElementsByTagName("w:tr")).map(tr =>
        Array.from(tr.getElementsByTagName("w:tc")).map(tc =>
          Array.from(tc.getElementsByTagName("w:t")).map(t => t.textContent || "").join("").trim()
        )
      );
      if (rows.length) return rows;
    }
  } catch {
    // Not a valid zip / no headers — fall through to body-table parsing.
  }
  return null;
}

function addMissingHeaderFieldWarnings(parsed: ParsedSop, warnings: string[]) {
  if (!parsed.sop_number) warnings.push("SOP/Form number not found — please enter manually.");
  if (!parsed.title) warnings.push("Title not found — please enter manually.");
  if (!parsed.revision) warnings.push("Revision not found — please enter manually.");
  if (!parsed.effective_date) warnings.push("Effective date not found — please enter manually.");
  if (!parsed.approved_by) warnings.push("Approved by not found — please enter manually.");
}

// Render a <ul>/<ol> as plain-text bullet/numbered lines, recursing into nested
// lists with indentation so the original structure survives as readable text.
function formatList(list: Element, depth = 0): string[] {
  const lines: string[] = [];
  const items = Array.from(list.children).filter(c => c.tagName === "LI");
  items.forEach((li, i) => {
    const marker = list.tagName === "OL" ? `${i + 1}.` : "•";
    const nestedLists = Array.from(li.children).filter(c => c.tagName === "UL" || c.tagName === "OL");
    const clone = li.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("ul, ol").forEach(n => n.remove());
    clone.querySelectorAll("br").forEach((br) => br.replaceWith(" "));
    const text = (clone.textContent || "").replace(/\s+/g, " ").trim();
    if (text) lines.push(`${"  ".repeat(depth)}${marker} ${text}`);
    for (const nested of nestedLists) {
      lines.push(...formatList(nested, depth + 1));
    }
  });
  return lines;
}

// Policy documents (FSQM-prefixed) are free-form statements with no
// Purpose/Scope/Responsibility/Procedure structure — capture the body as-is
// rather than checking for sections that were never going to be there.
function parsePolicyBody(blocks: HTMLElement[], parsed: ParsedSop, warnings: string[]) {
  const lines: string[] = [];
  for (const block of blocks) {
    if (block.tagName === "UL" || block.tagName === "OL") {
      lines.push(...formatList(block));
      continue;
    }
    const text = textOf(block);
    if (text) lines.push(text);
  }
  parsed.content.statement = lines.join("\n\n").trim();
  if (!parsed.content.statement) warnings.push("Policy statement not found — please enter manually.");
}

function parseBody(blocks: HTMLElement[], parsed: ParsedSop, warnings: string[]) {
  let current: keyof ParsedSop["content"] | null = null;
  const buffers: Record<string, string[]> = {};

  for (const block of blocks) {
    const isList = block.tagName === "UL" || block.tagName === "OL";

    if (isList) {
      if (current) {
        buffers[current] ||= [];
        buffers[current].push(...formatList(block));
      }
      continue;
    }

    const text = textOf(block);
    if (!text) continue;

    const headingCandidate = stripLeadingNumber(text);
    const matchedSection = SECTION_LABELS.find(s => s.pattern.test(headingCandidate));
    const looksLikeHeading = block.tagName.match(/^H[1-6]$/) || text.length < 60;

    if (matchedSection && looksLikeHeading) {
      current = matchedSection.key;
      buffers[current] ||= [];
      // Capture any trailing text on the same line after the heading label
      const remainder = headingCandidate.replace(matchedSection.pattern, "").replace(/^[:\-–\s]+/, "").trim();
      if (remainder) buffers[current].push(remainder);
      continue;
    }

    // Some exports (e.g. Apple Pages → .docx) bold the section label inline at the
    // start of a long paragraph instead of using a heading element:
    // <p><strong>Purpose:</strong> To ensure all personnel...</p>
    const leadEl = block.firstElementChild;
    const leadText = leadEl && /^(strong|b)$/i.test(leadEl.tagName) ? (leadEl.textContent || "").trim() : "";
    const inlineMatchedSection = leadText && text.startsWith(leadText)
      ? SECTION_LABELS.find(s => s.pattern.test(stripLeadingNumber(leadText)))
      : undefined;

    if (inlineMatchedSection) {
      current = inlineMatchedSection.key;
      buffers[current] ||= [];
      const remainder = text.slice(leadText.length).replace(/^[:\-–\s]+/, "").trim();
      if (remainder) buffers[current].push(remainder);
      continue;
    }

    if (current === "procedure") {
      buffers.procedure ||= [];
      buffers.procedure.push(stripLeadingNumber(text));
    } else if (current) {
      buffers[current] ||= [];
      buffers[current].push(text);
    }
  }

  for (const section of SECTION_LABELS) {
    const lines = buffers[section.key] ?? [];
    if (section.key === "procedure") {
      parsed.content.procedure = lines.filter(Boolean);
    } else {
      (parsed.content as any)[section.key] = lines.join("\n").trim();
    }
    if (!lines.length) warnings.push(`${section.display} section not found — please fill in manually.`);
  }

  if (parsed.content.governing_reference) {
    parsed.sqf_reference = extractSqfCode(parsed.content.governing_reference);
    if (!parsed.sqf_reference) warnings.push("SQF code not found in Governing Reference — please enter manually.");
  }
}

export async function parseSopDocx(file: File): Promise<ParsedSop> {
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const doc = new DOMParser().parseFromString(html, "text/html");
  const warnings: string[] = [];

  const parsed: ParsedSop = {
    sop_number: "",
    title: "",
    revision: "",
    effective_date: "",
    approved_by: "",
    type: "sop",
    sqf_reference: "",
    sqf_required: false,
    content: {
      purpose: "",
      scope: "",
      responsibility: "",
      procedure: [],
      form_references: "",
      records: "",
      governing_reference: "",
    },
    warnings: [],
  };

  // Try the page-header XML first (many SOP templates put the header table
  // in the running header rather than the document body, which mammoth skips).
  const xmlHeaderRows = await extractHeaderTableRowsFromDocx(arrayBuffer);
  if (xmlHeaderRows) {
    matchHeaderFields(xmlHeaderRows, parsed);
  }

  const headerTable = doc.querySelector("table");
  if (headerTable && !xmlHeaderRows) {
    parseHeaderTable(headerTable as HTMLTableElement, parsed);
  }
  if (!xmlHeaderRows && !headerTable) {
    warnings.push("No header table found in document.");
  }

  if (parsed.effective_date) {
    const iso = normalizeDate(parsed.effective_date);
    if (iso) {
      parsed.effective_date = iso;
    } else {
      warnings.push(`Effective date "${parsed.effective_date}" is in an unrecognized format — please re-enter it.`);
      parsed.effective_date = "";
    }
  }

  addMissingHeaderFieldWarnings(parsed, warnings);

  // Detect type from the document number before parsing the body, since policy
  // documents (FSQM-prefixed) are free-form and need different body handling.
  parsed.type = detectType(parsed.sop_number);

  // Walk body blocks that come after the header table (if the header lives in the body).
  // Only take top-level lists (not nested <li> sub-lists, which formatList() recurses into).
  const allBlocks = Array.from(doc.body.querySelectorAll("p, h1, h2, h3, h4, ul, ol")).filter(
    (b) => !b.parentElement?.closest("li")
  ) as HTMLElement[];
  const blocksAfterHeader = headerTable && !xmlHeaderRows
    ? allBlocks.filter(b => !!(headerTable.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING))
    : allBlocks;

  if (parsed.type === "policy") {
    parsePolicyBody(blocksAfterHeader, parsed, warnings);
  } else {
    parseBody(blocksAfterHeader, parsed, warnings);
  }

  parsed.warnings = warnings;
  return parsed;
}
