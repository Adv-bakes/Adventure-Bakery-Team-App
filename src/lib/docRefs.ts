/**
 * Document numbers written in text ("Chemicals locked away (FSQM-032)") become links to that
 * document. Pure half: finding the numbers and choosing which document a number means.
 * No imports, so a test can bundle it.
 */

/** FRM-905, FSQM-025, REP-007, TRN-002A, SOP-401, SOP-2.3.4, SSOP-902. */
const DOC_REF = /\b(?:FSQM|FRM|REP|TRN|POL|SSOP|SOP)-\d+(?:\.\d+)*[A-Z]?\b/g;

export type DocRefPart = string | { ref: string };

/** `text` cut into plain runs and document numbers, in order. */
export function splitDocRefs(text: string): DocRefPart[] {
  const parts: DocRefPart[] = [];
  let pos = 0;
  for (const m of text.matchAll(DOC_REF)) {
    const at = m.index ?? 0;
    if (at > pos) parts.push(text.slice(pos, at));
    parts.push({ ref: m[0] });
    pos = at + m[0].length;
  }
  if (pos < text.length) parts.push(text.slice(pos));
  return parts;
}

/** Each document number in `text`, once, in the order first mentioned. */
export function docRefsIn(text: string): string[] {
  return [...new Set([...text.matchAll(DOC_REF)].map(m => m[0]))];
}

export interface DocIndexRow { id: string; sop_number: string | null; title: string | null; status: string }
export interface DocIndexEntry { id: string; title: string; draft: boolean }
export type DocIndex = Record<string, DocIndexEntry>;

/**
 * One document per number. A number can have several rows: an issued document and a draft, or a
 * training module and its Spanish variant (same number, title ending "(ES)"). The issued one
 * wins over a draft, and the English one over the Spanish variant.
 */
export function buildDocIndex(rows: DocIndexRow[]): DocIndex {
  const rank = (r: DocIndexRow) => (r.status === "active" ? 0 : 2) + (/\(ES\)\s*$/.test(r.title ?? "") ? 1 : 0);
  const best: Record<string, DocIndexRow> = {};
  for (const r of rows) {
    const n = r.sop_number?.trim();
    if (!n || (r.status !== "active" && r.status !== "draft")) continue;
    if (!best[n] || rank(r) < rank(best[n])) best[n] = r;
  }
  const out: DocIndex = {};
  for (const [n, r] of Object.entries(best)) out[n] = { id: r.id, title: (r.title ?? "").trim() || n, draft: r.status !== "active" };
  return out;
}
