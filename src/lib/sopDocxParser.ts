import mammoth from "mammoth";
import JSZip from "jszip";

export type SopType = "sop" | "form" | "policy" | "fsqm";

// Processed SOP/FSQM docs always carry the Adventure Bakery name — the source
// hardcopies were authored under the prior company name "Compass Blending".
function rebrand(text: string): string {
  return text.replace(/compass\s+blending/gi, "Adventure Bakery");
}

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
    definitions: string;
    responsibility: string;
    procedure: string[];
    form_references: string;
    records: string;
    governing_reference: string;
    revision_history: string;
    statement?: string;
  };
  warnings: string[];
}

export const SECTION_LABELS: { key: keyof ParsedSop["content"]; pattern: RegExp; display: string }[] = [
  { key: "purpose", pattern: /^purpose\b/i, display: "Purpose" },
  { key: "scope", pattern: /^scope\b/i, display: "Scope" },
  { key: "definitions", pattern: /^definitions?\b/i, display: "Definitions" },
  { key: "responsibility", pattern: /^responsibilit(y|ies)\b/i, display: "Responsibility" },
  { key: "procedure", pattern: /^procedure\b/i, display: "Procedure" },
  { key: "form_references", pattern: /^form\s+references?\b/i, display: "Form References" },
  { key: "records", pattern: /^records?\b/i, display: "Records" },
  { key: "governing_reference", pattern: /^governing\s+reference\b/i, display: "Governing Reference" },
  { key: "revision_history", pattern: /^revision\s+history\b/i, display: "Revision History" },
];

const HEADER_FIELDS: { key: keyof Pick<ParsedSop, "sop_number" | "title" | "revision" | "effective_date" | "approved_by">; pattern: RegExp; display: string }[] = [
  { key: "sop_number", pattern: /^(sop|form)\s*(no\.?|number|#)\s*:?$/i, display: "SOP/Form number" },
  { key: "title", pattern: /^(sop|form)?\s*title\s*:?$/i, display: "Title" },
  { key: "revision", pattern: /^revision(\s*(num\.?|no\.?|number))?\s*:?$/i, display: "Revision" },
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
  if (n.startsWith("FSQM")) return "fsqm";
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
// An inline form of each header pattern that captures the value following the label
// in the same cell/line (e.g. a scanned "Effective Date: 11/15/2019" cell where the
// label and value weren't split into separate cells). The value is always the LAST
// capture group, since several HEADER_FIELDS patterns carry their own label sub-groups.
function inlineHeaderPattern(field: { pattern: RegExp }): RegExp {
  return new RegExp(field.pattern.source.replace(/\$$/, "") + "\\s*[:\\-–]?\\s*(.+)$", "i");
}

function inlineHeaderValue(text: string, field: { pattern: RegExp }): string | undefined {
  const m = text.match(inlineHeaderPattern(field));
  return m?.[m.length - 1]?.trim() || undefined;
}

function matchHeaderFields(rows: string[][], parsed: ParsedSop) {
  for (const cells of rows) {
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!cell) continue;
      for (const field of HEADER_FIELDS) {
        if ((parsed as any)[field.key]) continue; // first match wins
        // Adjacent-cell layout: label in this cell, value in the next.
        if (field.pattern.test(cell)) {
          const value = cells[i + 1]?.trim();
          if (value) { (parsed as any)[field.key] = value; continue; }
        }
        // Merged-cell layout: "Label: value" within this single cell.
        const inline = inlineHeaderValue(cell, field);
        if (inline) (parsed as any)[field.key] = inline;
      }
    }
  }
}

// Fallback for scanned docs whose header metadata leaks into the first body
// paragraphs rather than a clean table. Fills only fields still empty.
function scanInlineMetadata(lines: string[], parsed: ParsedSop) {
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    for (const field of HEADER_FIELDS) {
      if ((parsed as any)[field.key]) continue;
      const inline = inlineHeaderValue(line, field);
      if (inline) (parsed as any)[field.key] = inline;
    }
    if (!parsed.sop_number) {
      const num = line.match(/\bFSQM\s*-?\s*(\d+)\b/i);
      if (num) parsed.sop_number = `FSQM-${num[1]}`;
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

// Scan/hardcopy artifacts that leak into the body: page numbers, the
// confidentiality footer boilerplate, running-header metadata lines (the doc number,
// "Effective Date:"/"Revision No.:"), and stray single-letter tokens (OCR noise).
function isNoiseLine(text: string): boolean {
  return (
    /^page\s+\d+\s+of\s+\d+\.?$/i.test(text) ||
    /property of .*confidential|unauthorized use or copying/i.test(text) ||
    /^(?:fsqm|sop|frm)\s*-?\s*\d+$/i.test(text) ||
    /^(?:effective\s+date|revision\s+no\.?)\s*:/i.test(text) ||
    /^[a-z]$/i.test(text)
  );
}

// A single-item ordered list is how mammoth renders a numbered section heading
// (Word "1. PURPOSE" → <ol><li>PURPOSE</li></ol>) — distinguish those from real
// multi-item procedure/bullet lists so the heading is recognized, not swallowed.
function listSectionHeading(block: HTMLElement): typeof SECTION_LABELS[number] | undefined {
  const items = Array.from(block.children).filter(c => c.tagName === "LI");
  if (items.length > 1) return undefined;
  const text = textOf(block);
  if (text.length >= 60) return undefined;
  return SECTION_LABELS.find(s => s.pattern.test(stripLeadingNumber(text)));
}

// A running header/footer sometimes gets concatenated onto the front of a real
// body paragraph during scanning (e.g. "NON-CONFORMING PRODUCTFSQM 018Effective
// Date…Page 3 of 3…prohibited.6.13 Quality personnel…"). Strip that leading run up
// to and including the confidentiality sentence, keeping the real content after it.
function stripRunningHeader(text: string): string {
  const stripped = text.replace(
    /^.*?(?:unauthorized use or copying is prohibited\.|page\s+\d+\s+of\s+\d+\.?)\s*/i,
    "",
  );
  // Only treat it as a leading-noise strip when a running-header signature was present.
  return /effective date|revision no\.?|page\s+\d+\s+of\s+\d+/i.test(text) && stripped !== text
    ? stripped.trim()
    : text;
}

function parseBody(blocks: HTMLElement[], parsed: ParsedSop, warnings: string[]) {
  let current: keyof ParsedSop["content"] | null = null;
  const buffers: Record<string, string[]> = {};

  for (const block of blocks) {
    const isList = block.tagName === "UL" || block.tagName === "OL";

    if (isList) {
      const heading = listSectionHeading(block);
      if (heading) {
        current = heading.key;
        buffers[current] ||= [];
        const remainder = stripLeadingNumber(textOf(block)).replace(heading.pattern, "").replace(/^[:\-–\s]+/, "").trim();
        if (remainder) buffers[current].push(remainder);
      } else if (current) {
        buffers[current] ||= [];
        buffers[current].push(...formatList(block));
      }
      continue;
    }

    const rawText = textOf(block);
    if (!rawText) continue;
    if (isNoiseLine(rawText)) continue;
    const text = stripRunningHeader(rawText);
    if (!text || isNoiseLine(text)) continue;
    // The page running-header also leaks the title as a standalone line mid-body.
    if (parsed.title && text === parsed.title) continue;

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
      if (lines.length) parsed.content.procedure = lines.filter(Boolean);
    } else if (lines.length) {
      (parsed.content as any)[section.key] = lines.join("\n").trim();
    }
    // Don't warn/overwrite when a value was already filled from another path
    // (e.g. revision_history sourced from the trailing table).
    const existing = section.key === "procedure" ? parsed.content.procedure.length : (parsed.content as any)[section.key];
    if (!lines.length && !existing) warnings.push(`${section.display} section not found — please fill in manually.`);
  }

  if (parsed.content.governing_reference) {
    parsed.sqf_reference = extractSqfCode(parsed.content.governing_reference);
    if (!parsed.sqf_reference) warnings.push("SQF code not found in Governing Reference — please enter manually.");
  }
}

// Revision history is commonly a trailing table (Rev # | Description | Date | Approved by)
// rather than paragraphs. Render its rows to text for content.revision_history, and use the
// "Approved by" column to fill the document's approved_by when the header didn't supply one.
function extractRevisionHistoryTable(doc: Document, parsed: ParsedSop) {
  const tables = Array.from(doc.querySelectorAll("table"));
  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll("tr")).map(tr =>
      Array.from(tr.querySelectorAll("td, th")).map(c => (c.textContent || "").replace(/\s+/g, " ").trim())
    );
    if (!rows.length) continue;
    const header = rows[0];
    const looksLikeRevTable = header.some(c => /rev\.?\s*#?|revision/i.test(c)) && header.some(c => /approv/i.test(c));
    if (!looksLikeRevTable) continue;

    const dataRows = rows.slice(1).filter(r => r.some(c => c));
    if (!parsed.content.revision_history) {
      parsed.content.revision_history = dataRows.map(r => r.filter(Boolean).join(" | ")).join("\n").trim();
    }
    if (!parsed.approved_by) {
      const col = header.findIndex(c => /approv/i.test(c));
      const name = col >= 0 ? dataRows.find(r => r[col]?.trim())?.[col]?.trim() : "";
      if (name) parsed.approved_by = name;
    }
    return;
  }
}

// Title rarely carries a label in scanned headers; derive it from a clean all-caps
// line (header cell or first body paragraph), stripping any appended running-header run.
function guessTitle(lines: string[]): string {
  for (const raw of lines) {
    const line = stripRunningHeader(raw).replace(/effective date.*$/i, "").trim();
    if (line.length < 4 || line.length > 90) continue;
    if (/\bFSQM\b|^revision|^page\s+\d/i.test(line)) continue;
    if (SECTION_LABELS.some(s => s.pattern.test(stripLeadingNumber(line)))) continue;
    const letters = line.replace(/[^a-z]/gi, "");
    if (letters.length >= 4 && letters === letters.toUpperCase()) return line;
  }
  return "";
}

// Recursively rebrand every string in the parsed result (header fields + body),
// so "Compass Blending" → "Adventure Bakery" regardless of extraction path.
function rebrandParsed(parsed: ParsedSop) {
  parsed.sop_number = rebrand(parsed.sop_number);
  parsed.title = rebrand(parsed.title);
  parsed.approved_by = rebrand(parsed.approved_by);
  const c = parsed.content;
  for (const key of Object.keys(c) as (keyof ParsedSop["content"])[]) {
    const val = (c as any)[key];
    if (typeof val === "string") (c as any)[key] = rebrand(val);
    else if (Array.isArray(val)) (c as any)[key] = val.map((v: string) => rebrand(v));
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
      definitions: "",
      responsibility: "",
      procedure: [],
      form_references: "",
      records: "",
      governing_reference: "",
      revision_history: "",
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

  // Scanned hardcopies often leak the header metadata into the first body
  // paragraphs instead of clean table cells — recover anything still missing.
  const headerLines = Array.from(doc.body.querySelectorAll("p, h1, h2, h3, h4"))
    .slice(0, 8)
    .map(el => (el.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  scanInlineMetadata(headerLines, parsed);
  if (!parsed.title) parsed.title = guessTitle(headerLines);
  extractRevisionHistoryTable(doc, parsed);

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

  // Detect type from the document number before parsing the body. Only `policy`
  // documents are free-form; `fsqm` (and sop/form) parse into structured sections.
  parsed.type = detectType(parsed.sop_number);

  // Walk body blocks that come after the header table (if the header lives in the body).
  // Only take top-level lists (not nested <li> sub-lists, which formatList() recurses into).
  const allBlocks = Array.from(doc.body.querySelectorAll("p, h1, h2, h3, h4, ul, ol")).filter(
    (b) => !b.parentElement?.closest("li")
  ) as HTMLElement[];
  // Only skip blocks before the header table when it actually sits at the top. Scanned
  // hardcopies repeat the header as a running table *mid-body*; if the first section
  // heading precedes the first table, that table is a running header, not the masthead —
  // filtering on it would drop every section above it, so parse all blocks instead.
  const firstSectionIdx = allBlocks.findIndex(
    (b) => SECTION_LABELS.some(s => s.pattern.test(stripLeadingNumber(textOf(b)))),
  );
  const headerAtTop = headerTable && firstSectionIdx >= 0
    ? !!(headerTable.compareDocumentPosition(allBlocks[firstSectionIdx]) & Node.DOCUMENT_POSITION_FOLLOWING)
    : true;
  const blocksAfterHeader = headerTable && !xmlHeaderRows && headerAtTop
    ? allBlocks.filter(b => !!(headerTable.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING))
    : allBlocks;

  if (parsed.type === "policy") {
    parsePolicyBody(blocksAfterHeader, parsed, warnings);
  } else {
    parseBody(blocksAfterHeader, parsed, warnings);
  }

  rebrandParsed(parsed);
  parsed.warnings = warnings;
  return parsed;
}
