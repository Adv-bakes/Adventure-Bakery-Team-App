// The FSMS Index (D-08, SQF 2.2.1.1): every clause of the SQF Food Safety Code: Food Manufacturing
// against the site documents that cite it. Pure - the page supplies the documents.
//
// Nothing is authored. A document says which clauses it answers in its own sqf_reference, so the
// index is current the moment a document is issued, and a hand-kept matrix cannot fall behind it.
// It is a map of what each document CLAIMS to cover, not proof that it does; the internal audit
// (FSQM-038) is what tests the claim.

import { SQF_FOOD_CLAUSES, sqfFoodPdfHref } from "./sqfFoodClauses";

export interface IndexDoc {
  id: string;
  sop_number: string | null;
  title: string;
  type: string;
  status: string;
  sqf_reference: string | null;
}

/** Section titles are not in the generated clause map, which starts at the three-level headings. */
export const SECTION_TITLES: Record<string, string> = {
  "2.1": "Management Commitment",
  "2.2": "Document Control and Records",
  "2.3": "Specifications, Formulations, Realization, and Supplier Approval",
  "2.4": "Food Safety System",
  "2.5": "SQF System Verification",
  "2.6": "Product Traceability and Crisis Management",
  "2.7": "Food Defense and Food Fraud",
  "2.8": "Allergen Management",
  "2.9": "Training",
  "11.1": "Site Location and Premises",
  "11.2": "Site Operations",
  "11.3": "Personnel Hygiene and Welfare",
  "11.4": "Personnel Processing Practices",
  "11.5": "Water, Ice, and Air Supply",
  "11.6": "Receipt, Storage, and Transport",
  "11.7": "Separation of Functions",
  "11.8": "Waste Disposal",
};

export function compareClauseNumbers(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/**
 * The clause numbers in a comma-delimited sqf_reference, and the tokens that are not one.
 *
 * A shorthand token (".2", ".3") continues the clause before it - "2.4.8.1, .2, .3" is how the
 * remediation plan writes 2.4.8.1, 2.4.8.2 and 2.4.8.3, and some documents carry it. Anything else
 * that is not a number ("N/A") is returned as unreadable rather than dropped silently.
 */
export function parseSqfReferences(reference: string | null | undefined): { clauses: string[]; unreadable: string[] } {
  const clauses: string[] = [];
  const unreadable: string[] = [];
  let last: string | null = null;
  for (const raw of (reference ?? "").split(",")) {
    const t = raw.trim();
    if (!t) continue;
    if (/^\d+(\.\d+)*$/.test(t)) {
      clauses.push(t);
      last = t;
    } else if (/^\.\d+$/.test(t) && last && last.includes(".")) {
      const full = last.slice(0, last.lastIndexOf(".")) + t;
      clauses.push(full);
      last = full;
    } else {
      unreadable.push(t);
    }
  }
  return { clauses: [...new Set(clauses)], unreadable };
}

export type DocRole = "program" | "record" | "training";

/** Forms and reports are records; training modules are training; everything else states a rule. */
export function docRole(doc: Pick<IndexDoc, "sop_number" | "type">): DocRole {
  const prefix = (doc.sop_number ?? "").trim().toUpperCase().split("-")[0];
  if (doc.type === "training" || prefix === "TRN") return "training";
  if (doc.type === "form" || doc.type === "report" || prefix === "FRM" || prefix === "REP") return "record";
  return "program";
}

/**
 * issued     - an active program, procedure or policy cites the clause
 * draft      - a program cites it, but none of them is issued yet
 * no_program - only records or training cite it; nothing states the rule
 * none       - no document cites it
 */
export type ClauseState = "issued" | "draft" | "no_program" | "none";

export const STATE_LABEL: Record<ClauseState, string> = {
  issued: "Issued",
  draft: "Draft only",
  no_program: "No program",
  none: "Nothing cites it",
};

export interface IndexedDoc extends IndexDoc {
  role: DocRole;
  /** True when the document cites this clause itself, false when it cites a broader section. */
  exact: boolean;
}

export interface IndexClause {
  id: string;
  text: string;
  href: string;
  docs: IndexedDoc[];
  state: ClauseState;
}

export interface IndexSubSection { id: string; title: string; clauses: IndexClause[] }
export interface IndexSection { id: string; title: string; subSections: IndexSubSection[]; counts: Record<ClauseState, number> }

export interface FsmsIndex {
  sections: IndexSection[];
  counts: Record<ClauseState, number>;
  total: number;
  /** References that match no clause of the Code: a typo, a clause of another edition, or "N/A". */
  unmatched: { doc: IndexDoc; token: string }[];
}

const ROLE_ORDER: Record<DocRole, number> = { program: 0, record: 1, training: 2 };
const emptyCounts = (): Record<ClauseState, number> => ({ issued: 0, draft: 0, no_program: 0, none: 0 });

function stateOf(docs: IndexedDoc[]): ClauseState {
  if (docs.length === 0) return "none";
  const programs = docs.filter((d) => d.role === "program");
  if (programs.length === 0) return "no_program";
  return programs.some((d) => d.status === "active") ? "issued" : "draft";
}

/**
 * Builds the index from active and draft documents. A document covers a clause when it cites the
 * clause itself or a section containing it ("11.3" covers 11.3.1.1); a finer reference does not
 * reach back up. Numbered requirements are four levels deep in both parts of the Code.
 */
export function buildFsmsIndex(allDocs: IndexDoc[]): FsmsIndex {
  const docs = allDocs.filter((d) => d.status === "active" || d.status === "draft");
  const keys = Object.keys(SQF_FOOD_CLAUSES);
  const known = (t: string) => !!SQF_FOOD_CLAUSES[t] || keys.some((k) => k.startsWith(t + "."));

  const cited: { doc: IndexDoc; clause: string }[] = [];
  const unmatched: FsmsIndex["unmatched"] = [];
  for (const doc of docs) {
    const { clauses, unreadable } = parseSqfReferences(doc.sqf_reference);
    for (const token of unreadable) unmatched.push({ doc, token });
    for (const clause of clauses) {
      if (known(clause)) cited.push({ doc, clause });
      else unmatched.push({ doc, token: clause });
    }
  }

  const counts = emptyCounts();
  const sections = new Map<string, IndexSection>();
  const subs = new Map<string, IndexSubSection>();

  for (const id of keys.filter((k) => k.split(".").length === 4).sort(compareClauseNumbers)) {
    const parts = id.split(".");
    const sectionId = parts.slice(0, 2).join(".");
    const subId = parts.slice(0, 3).join(".");

    const byDoc = new Map<string, IndexedDoc>();
    for (const { doc, clause } of cited) {
      if (clause !== id && !id.startsWith(clause + ".")) continue;
      const exact = clause === id;
      const seen = byDoc.get(doc.id);
      if (!seen) byDoc.set(doc.id, { ...doc, role: docRole(doc), exact });
      else if (exact) seen.exact = true;
    }
    const clauseDocs = [...byDoc.values()].sort((a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role]
      || (a.sop_number ?? "").localeCompare(b.sop_number ?? "", undefined, { numeric: true }));
    const state = stateOf(clauseDocs);

    let section = sections.get(sectionId);
    if (!section) {
      section = { id: sectionId, title: SECTION_TITLES[sectionId] ?? "", subSections: [], counts: emptyCounts() };
      sections.set(sectionId, section);
    }
    let sub = subs.get(subId);
    if (!sub) {
      sub = { id: subId, title: SQF_FOOD_CLAUSES[subId]?.text.trim() ?? "", clauses: [] };
      subs.set(subId, sub);
      section.subSections.push(sub);
    }
    sub.clauses.push({
      id, text: SQF_FOOD_CLAUSES[id].text.trim(), href: sqfFoodPdfHref(SQF_FOOD_CLAUSES[id].page),
      docs: clauseDocs, state,
    });
    section.counts[state]++;
    counts[state]++;
  }

  return {
    sections: [...sections.values()],
    counts,
    total: counts.issued + counts.draft + counts.no_program + counts.none,
    unmatched,
  };
}

/** The index as rows for a CSV: one line per clause, documents joined in one cell. */
export function fsmsIndexRows(index: FsmsIndex): string[][] {
  const rows: string[][] = [["Clause", "Section", "Requirement", "Status", "Programs", "Records", "Training"]];
  const list = (docs: IndexedDoc[], role: DocRole) =>
    docs.filter((d) => d.role === role)
      .map((d) => `${d.sop_number ?? d.title}${d.status === "draft" ? " (draft)" : ""}`).join("; ");
  for (const s of index.sections) {
    for (const sub of s.subSections) {
      for (const c of sub.clauses) {
        rows.push([c.id, `${sub.id} ${sub.title}`.trim(), c.text, STATE_LABEL[c.state],
          list(c.docs, "program"), list(c.docs, "record"), list(c.docs, "training")]);
      }
    }
  }
  return rows;
}
