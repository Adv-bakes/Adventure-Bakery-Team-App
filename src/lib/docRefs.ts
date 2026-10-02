/**
 * Document numbers written in a form's own text ("Chemicals locked away (FSQM-032)") become
 * links to that document. Pure half: finding the numbers. No imports, so a test can bundle it.
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

/** Every document number in any string of `value` (a form schema), each once, sorted. */
export function collectDocRefs(value: unknown): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") for (const m of v.matchAll(DOC_REF)) found.add(m[0]);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(value);
  return [...found].sort();
}
