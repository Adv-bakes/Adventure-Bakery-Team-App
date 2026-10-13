// Reviewing and submitting the two CCP records at the release (owner's decision, 2026-10-13).
//
// FRM-507 (baking, one record per production day) and FRM-606 (seal checks, one per batch) need
// two signatures before they can be submitted: the operator's "Monitored by" and a reviewer's
// "Verified by". FSQM-017 says a record "is not submitted until the reviewer has checked it", and
// the reviewer is the SQF Practitioner - who also releases the lot, and whose first release check
// rests on these records. So the review is a step of the release: the record is shown, and one
// button signs as verifier and submits.
//
// THE RULES THIS FILE KEEPS:
//  - The verifier never signs for the operator. A record the operator has not signed is not
//    offered for verification; it says so.
//  - The baking record covers every product baked that day, so submitting it closes the day. It
//    is offered only once the day's baking is marked finished, or the day has passed. The same for
//    a batch's seal checks.
//  - "Who verified this record" follows from who signed: another person than the operator, or the
//    operator themself. The verifier is not asked to say which.
//  - What was done about a deviation is never filled in here; a deviation with no action recorded
//    stops the submit, as it does on the form.
//
// Pure: no imports, so it can be tested in Node.

export const CCP_REVIEW = {
  baking: {
    form: "FRM-507", grid: "oven_loads", last: "last_load", lastOfLot: "Last load of this lot", product: "product",
    /** Rows of the table that are a load: any of these answered. */
    content: ["oven_temp", "bake_time", "within_limits"],
    probe: "internal_temp", probeStatus: "internal_temp_status",
    probeNone: "Not probed - probe check not yet in place", probeAll: "Probed - a reading is recorded against every load",
  },
  sealing: {
    form: "FRM-606", grid: "seal_checks", last: "last_check", lastOfLot: "Last check of this lot", product: "",
    content: ["check", "visual", "pull_test", "vacuum_reading"],
    probe: "", probeStatus: "", probeNone: "", probeAll: "",
  },
  date: "production_date",
  monitored: "monitored_by",
  verified: "verified_by",
  independence: "verification_independence",
  independent: "Someone other than the operator who took the readings",
  self: "No second qualified person available - verified by the operator",
} as const;

export type CcpKind = "baking" | "sealing";
type Values = Record<string, any>;

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const fold = (v: unknown) => str(v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The loads or checks actually recorded (a blank seeded row is not one). */
export function recordRows(kind: CcpKind, values: Values | null | undefined): Values[] {
  const cfg = CCP_REVIEW[kind];
  const rows: Values[] = Array.isArray(values?.[cfg.grid]) ? values![cfg.grid] : [];
  return rows.filter(r => r && cfg.content.some(k => str(r[k]) !== ""));
}

/**
 * Is the record finished at the oven or the sealer? Baking: a load is marked the last of the lot,
 * or every product on the day's record has a load marked as its last. Seal checks (one batch per
 * record): a check is marked as the last.
 */
export function recordFinished(kind: CcpKind, values: Values | null | undefined): boolean {
  const cfg = CCP_REVIEW[kind];
  const rows = recordRows(kind, values);
  if (rows.length === 0) return false;
  if (rows.some(r => str(r[cfg.last]) === cfg.lastOfLot)) return true;
  if (kind === "sealing") return rows.some(r => str(r[cfg.last]) !== "");
  const products = new Map<string, boolean>();
  for (const r of rows) products.set(fold(r[cfg.product]), (products.get(fold(r[cfg.product])) ?? false) || str(r[cfg.last]) !== "");
  return [...products.values()].every(Boolean);
}

export type ReviewBlock = "no_rows" | "not_signed" | "not_finished";

/** What stops a record being verified now. Empty when the reviewer can go ahead. */
export function reviewBlocks(kind: CcpKind, values: Values | null | undefined, today: string): ReviewBlock[] {
  const out: ReviewBlock[] = [];
  if (recordRows(kind, values).length === 0) out.push("no_rows");
  if (!str(values?.[CCP_REVIEW.monitored]?.signed_at)) out.push("not_signed");
  // A day that has passed is finished whether or not anybody said so.
  const date = str(values?.[CCP_REVIEW.date]).slice(0, 10);
  if ((!date || date >= today) && !recordFinished(kind, values)) out.push("not_finished");
  return out;
}

/**
 * The record as the reviewer signs it: their signature on "Verified by" (never over one already
 * there), "Who verified this record" from who the two signers are, and - on the baking record -
 * "Internal temperature on this day" from the loads, where every load or no load was probed. A
 * day with some loads probed and some not is left for a person to answer on the record.
 */
export function withVerification(kind: CcpKind, values: Values, verifier: { id: string; name: string }, now: string): Values {
  const cfg = CCP_REVIEW[kind];
  const next: Values = { ...values };
  if (!str(next[CCP_REVIEW.verified]?.signed_at)) {
    next[CCP_REVIEW.verified] = { user_id: verifier.id, name: verifier.name, signed_at: now };
  }
  if (str(next[CCP_REVIEW.independence]) === "") {
    const operator = str(next[CCP_REVIEW.monitored]?.user_id);
    const reviewer = str(next[CCP_REVIEW.verified]?.user_id);
    next[CCP_REVIEW.independence] = operator && reviewer && operator !== reviewer ? CCP_REVIEW.independent : CCP_REVIEW.self;
  }
  if (cfg.probeStatus && str(next[cfg.probeStatus]) === "") {
    const rows = recordRows(kind, next);
    const probed = rows.filter(r => str(r[cfg.probe]) !== "").length;
    if (rows.length > 0 && probed === rows.length) next[cfg.probeStatus] = cfg.probeAll;
    else if (probed === 0) next[cfg.probeStatus] = cfg.probeNone;
  }
  return next;
}

/** Does this revision of the form have the sign-off this file writes? */
export function ccpReviewReady(kind: CcpKind, schema: { sections?: { fields?: { id?: string; options?: string[] }[] }[] } | null | undefined): boolean {
  const fields = (schema?.sections ?? []).flatMap(s => s.fields ?? []);
  const has = (id: string) => fields.some(f => f.id === id);
  const options = fields.find(f => f.id === CCP_REVIEW.independence)?.options ?? [];
  return has(CCP_REVIEW[kind].grid) && has(CCP_REVIEW.monitored) && has(CCP_REVIEW.verified) && has(CCP_REVIEW.date)
    && options.includes(CCP_REVIEW.independent) && options.includes(CCP_REVIEW.self);
}
