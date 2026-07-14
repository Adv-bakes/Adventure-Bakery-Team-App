import type { SopType } from "@/lib/sopDocxParser";

/**
 * Document numbering convention (see DOCUMENT_REGISTER.md / CLAUDE.md).
 *
 * An identifier is `<TYPE>-<NNN>` where:
 *   - TYPE is the document-type prefix that also drives `detectType()` in sopDocxParser
 *     (FRM = form, SOP = procedure, FSQM = Food Safety Quality Manual, POL = policy,
 *     TRN = training module).
 *   - NNN is a 3-digit number whose HUNDREDS BLOCK marks the process stage the document
 *     belongs to (receiving = 300s, production = 500s, …). Within a block, increment.
 *
 * The identifier is STABLE for the life of the document — the revision is tracked in the
 * separate `revision` field, never baked into the number (the old `FRM-046-1` style did the
 * latter, which is the inconsistency this convention fixes).
 */

export type DocStage = {
  /** Lowest number in the stage (inclusive). */
  rangeStart: number;
  /** Highest number in the stage (inclusive). */
  rangeEnd: number;
  /** Stable machine key. */
  key: string;
  /** Human label shown in the register + badges. */
  label: string;
};

// Ordered by process flow. 900s is split so Sanitation/GMP and HR/Admin read as distinct
// stages even though they share the leading digit.
export const DOC_STAGES: DocStage[] = [
  { rangeStart: 0, rangeEnd: 99, key: "food-safety-system", label: "Food Safety System" },
  { rangeStart: 100, rangeEnd: 199, key: "sales-npd", label: "Sales / New Product Development" },
  { rangeStart: 200, rangeEnd: 299, key: "sourcing", label: "Sourcing & Supplier Approval" },
  { rangeStart: 300, rangeEnd: 399, key: "receiving", label: "Receiving & Incoming Inspection" },
  { rangeStart: 400, rangeEnd: 499, key: "storage", label: "Storage & Inventory" },
  { rangeStart: 500, rangeEnd: 599, key: "production", label: "Production & Batching" },
  { rangeStart: 600, rangeEnd: 699, key: "packaging", label: "Packaging & Labeling" },
  { rangeStart: 700, rangeEnd: 799, key: "qc", label: "QC / Testing / Hold & Release" },
  { rangeStart: 800, rangeEnd: 899, key: "shipping", label: "Shipping / Distribution / Traceability" },
  { rangeStart: 900, rangeEnd: 949, key: "sanitation", label: "Sanitation & GMP" },
  { rangeStart: 950, rangeEnd: 999, key: "hr-admin", label: "HR / Training / Admin / Records" },
];

// The numbering scheme covers one type beyond the parser's SopType: `training`
// modules (TRN). It's a valid sop_documents.type but isn't produced by the Word
// parser, so it lives here rather than in SopType.
export type DocNumberType = SopType | "training";

// Prefix ↔ type. Kept in sync with detectType() in sopDocxParser.ts. `policy` has no
// established prefix in the source hardcopies, so POL is introduced here for new policies;
// TRN numbers training modules (typically in the 950–999 HR/Training block).
const PREFIX_TO_TYPE: Record<string, DocNumberType> = {
  FSQM: "fsqm",
  FRM: "form",
  SOP: "sop",
  POL: "policy",
  TRN: "training",
};

const TYPE_TO_PREFIX: Record<DocNumberType, string> = {
  fsqm: "FSQM",
  form: "FRM",
  sop: "SOP",
  policy: "POL",
  training: "TRN",
};

export type ParsedDocNumber = {
  /** Document type inferred from the prefix. */
  type: DocNumberType;
  /** The stage-block number (e.g. 301). */
  number: number;
  /** The revision suffix if the raw string carried a legacy `-N` (e.g. "1" from FRM-046-1). */
  legacyRevision: string | null;
  /** Canonical form, e.g. "FRM-301". */
  canonical: string;
  /** The original input, trimmed. */
  raw: string;
};

/**
 * Tolerantly parse a document number. Accepts `FRM-301`, `FRM301`, `frm 301`, and the legacy
 * `FRM-046-1` (returning `legacyRevision: "1"`). Returns null when there's no recognizable
 * `<prefix><number>` — callers treat that as "unassigned".
 */
export function parseDocNumber(input: string | null | undefined): ParsedDocNumber | null {
  if (!input) return null;
  const raw = input.trim();
  // <prefix> <sep> <number> [ <sep> <legacy revision> ]
  const m = raw.match(/^([A-Za-z]{2,5})[\s\-_]*?(\d{1,4})(?:[\s\-_]+(\d+))?\s*$/);
  if (!m) return null;
  const prefix = m[1].toUpperCase();
  const type = PREFIX_TO_TYPE[prefix];
  if (!type) return null;
  const number = Number(m[2]);
  const legacyRevision = m[3] ?? null;
  return { type, number, legacyRevision, canonical: formatDocNumber(type, number), raw };
}

/** Canonical identifier for a type + number, zero-padded to 3 digits (e.g. "FRM-301"). */
export function formatDocNumber(type: DocNumberType, number: number): string {
  return `${TYPE_TO_PREFIX[type]}-${String(number).padStart(3, "0")}`;
}

/**
 * SOPs deliberately use a *second* scheme: the number is the SQF clause the procedure
 * implements (e.g. "SOP-2.3.1", "SOP-11.7.5"). This is intentional (kept per the quality
 * owner's call), so such numbers are valid — just not stage-block numbers. Returns the
 * prefix + dotted clause, or null.
 */
export function parseClauseNumber(
  input: string | null | undefined,
): { type: DocNumberType; clause: string; raw: string } | null {
  if (!input) return null;
  const raw = input.trim();
  const m = raw.match(/^([A-Za-z]{2,5})[\s\-_]+(\d+(?:\.\d+)+)\s*$/);
  if (!m) return null;
  const type = PREFIX_TO_TYPE[m[1].toUpperCase()];
  if (!type) return null;
  return { type, clause: m[2], raw };
}

/** Segment-wise numeric compare of dotted clause ids ("11.3.1" vs "11.3.10"). */
export function compareClauseIds(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** The DOC_STAGES entry a raw number falls into, or null if out of range (>999 / negative). */
export function stageForNumber(number: number | null | undefined): DocStage | null {
  if (number == null || Number.isNaN(number)) return null;
  return DOC_STAGES.find((s) => number >= s.rangeStart && number <= s.rangeEnd) ?? null;
}

/**
 * Convenience: the stage for a raw `sop_number` string. Training modules (TRN) are
 * organized by training category, not the process-stage blocks, so they have no stage.
 */
export function stageForSopNumber(sopNumber: string | null | undefined): DocStage | null {
  const parsed = parseDocNumber(sopNumber);
  if (!parsed || parsed.type === "training") return null;
  return stageForNumber(parsed.number);
}

/**
 * Advisory validation for the number inputs. Returns a human-readable issue message, or null
 * when the value is a clean canonical identifier. Non-blocking by design — scanned imports and
 * legacy numbers must still save; we just nudge toward the convention.
 */
export function docNumberIssue(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  // SQF-clause-numbered SOPs (e.g. SOP-2.3.1) are a deliberate second scheme — don't nag.
  if (parseClauseNumber(raw)) return null;
  const parsed = parseDocNumber(raw);
  if (!parsed) {
    return "Unrecognized format — use a TYPE-NNN identifier like FRM-301 or SOP-500.";
  }
  if (parsed.legacyRevision != null) {
    return `Looks like a revision suffix ("-${parsed.legacyRevision}"). Drop it from the ID and put the revision in the Revision field — the identifier should stay ${parsed.canonical} across revisions.`;
  }
  if (parsed.raw.toUpperCase() !== parsed.canonical) {
    return `Non-standard spacing/padding — the canonical form is ${parsed.canonical}.`;
  }
  return null;
}

/** True when the value is already a clean canonical identifier. */
export function isValidDocNumber(input: string | null | undefined): boolean {
  return docNumberIssue(input) === null && !!(input ?? "").trim();
}
