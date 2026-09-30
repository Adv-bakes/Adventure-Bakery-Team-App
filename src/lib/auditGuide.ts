// Pure helpers for the internal-audit guide (SelectField.auditGuide, FRM-010): what the
// SQF Food Manufacturing Code asks in a section, and which of the site's documents answer it.
// The document list is NOT authored anywhere: it is read live from each document's
// sqf_reference, so a newly issued program appears in the guide without anyone updating it.

import { SQF_FOOD_CLAUSES, sqfFoodPdfHref } from "./sqfFoodClauses";
import type { GridRowValue } from "./formSchema";

/** "11.5 Water, ice and air" -> "11.5"; undefined when the option is not a section. */
export function sectionOfOption(option: string): string | undefined {
  return /^(\d+\.\d+)(?=\s|$)/.exec(option.trim())?.[1];
}

function compareIds(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export interface SubSection {
  id: string;          // "11.5.1"
  title: string;       // "Water Supply"
  href: string;        // the Food Manufacturing Code PDF at its page
  clauseCount: number; // numbered requirements under it
}

/** The Code's sub-sections of a section ("11.5" -> 11.5.1 ... 11.5.5), in order. */
export function subSectionsOf(section: string): SubSection[] {
  const keys = Object.keys(SQF_FOOD_CLAUSES);
  const depth = section.split(".").length + 1;
  return keys
    .filter(k => k.startsWith(section + ".") && k.split(".").length === depth)
    .sort(compareIds)
    .map(id => ({
      id,
      title: SQF_FOOD_CLAUSES[id].text.trim(),
      href: sqfFoodPdfHref(SQF_FOOD_CLAUSES[id].page),
      clauseCount: keys.filter(k => k.startsWith(id + ".") && k.split(".").length === depth + 1).length,
    }));
}

export interface GuideDoc {
  id: string;
  sop_number: string;
  title: string;
  status: string;
  sqf_reference: string | null;
}

export type GuideDocGroup = "programs" | "records" | "training";

/** Forms and reports are records to sample; TRN modules are training; the rest are programs and procedures. */
export function guideDocGroup(sopNumber: string): GuideDocGroup {
  const prefix = sopNumber.trim().toUpperCase().split("-")[0];
  if (prefix === "FRM" || prefix === "REP") return "records";
  if (prefix === "TRN") return "training";
  return "programs";
}

/** Whether a comma-delimited SQF reference touches a section: "2.8.1.8" is in 2.8, "2.10" is not. */
export function referencesSection(reference: string | null | undefined, section: string): boolean {
  return (reference ?? "")
    .split(",")
    .map(t => t.trim())
    .some(t => t === section || t.startsWith(section + "."));
}

/** The documents whose SQF reference falls in a section, in document-number order. */
export function docsForSection(docs: GuideDoc[], section: string): GuideDoc[] {
  return docs
    .filter(d => referencesSection(d.sqf_reference, section))
    .sort((a, b) => a.sop_number.localeCompare(b.sop_number, undefined, { numeric: true }));
}

/** The clause cell written for a sub-section: "11.5.1 Water Supply". */
export function findingClauseLabel(sub: SubSection): string {
  return `${sub.id} ${sub.title}`;
}

/** Whether a findings row already covers a sub-section ("11.5.1", "11.5.1 Water Supply", "11.5.1.3 ..."). */
function rowCovers(row: GridRowValue, clauseColumn: string, subId: string): boolean {
  const cell = String(row?.[clauseColumn] ?? "").trim();
  return cell === subId || cell.startsWith(subId + " ") || cell.startsWith(subId + ".");
}

/**
 * Findings rows with a line added for every sub-section not already in the table. A blank
 * row (nothing typed in any cell) is reused rather than left above the new ones - the
 * grid seeds one on a new entry. Returns the rows unchanged, and added = 0, when every
 * sub-section is already there.
 */
export function appendFindingRows(
  rows: GridRowValue[] | undefined,
  subs: SubSection[],
  clauseColumn: string,
): { rows: GridRowValue[]; added: number } {
  const current = Array.isArray(rows) ? rows : [];
  const missing = subs.filter(s => !current.some(r => rowCovers(r, clauseColumn, s.id)));
  if (missing.length === 0) return { rows: current, added: 0 };
  const isBlank = (r: GridRowValue) => Object.values(r ?? {}).every(v => v === "" || v == null);
  const kept = current.filter(r => !isBlank(r));
  return {
    rows: [...kept, ...missing.map(s => ({ [clauseColumn]: findingClauseLabel(s) }))],
    added: missing.length,
  };
}
