// Visitor sign-in: the pure half. No imports, so scripts/test-visitors.mjs can bundle it alone.
//
// Two records are involved. FRM-906 (Visitor GMP Acknowledgement) is signed on a visitor's FIRST
// visit and stays valid for twelve months, or until FRM-906 is revised. FRM-905 (Visitor Sign-In
// Log) is written at EVERY visit and records which acknowledgement it relied on. This module
// decides who a returning visitor is, whether their acknowledgement still counts, and what the
// two entries contain. The page (VisitorSignIn.tsx) only collects answers; the server writes.

export const VISITOR_FORMS = { signIn: "FRM-905", acknowledgement: "FRM-906" } as const;

export const isVisitorForm = (sopNumber: string | null | undefined) =>
  sopNumber === VISITOR_FORMS.signIn || sopNumber === VISITOR_FORMS.acknowledgement;

export const VISITOR_SIGN_IN_PATH = "/team/compliance/visitors";
/** The same screen with no portal around it, for the entrance tablet's `kiosk` account. */
export const VISITOR_KIOSK_PATH = "/team/visitor-kiosk";

/**
 * Whether a visitor form's schema is the one the sign-in page writes (v4 onwards): the visitor's
 * drawn signature is the ONLY signature. Earlier revisions also required a host signature, which
 * a tablet with nobody from the site logged in cannot give. Until the forms are at such a revision
 * they are filled as ordinary entries, and New Entry only hands over to the page when this is true.
 */
export function isVisitorKioskSchema(schema: { sections?: Array<{ fields?: unknown[] }> } | null | undefined): boolean {
  const signatures = (schema?.sections ?? [])
    .flatMap(s => (s.fields as Array<Record<string, unknown>> | undefined) ?? [])
    .filter(f => f.type === "signature");
  return signatures.length === 1 && signatures[0].id === "visitor_signature" && signatures[0].capture === "drawn";
}

/** How long an acknowledgement stays valid. Also stated in FSQM-012 Part 6 and on FRM-906. */
export const ACK_VALID_MONTHS = 12;

// FRM-905's `entry_route` options, exactly as the schema spells them.
export const ROUTE_BRIEFED = "Briefed — FRM-906 completed and signed";
export const ROUTE_REFUSED = "Entry refused";

/** One submitted FRM-906 entry, reduced to what a lookup needs (never the signature image). */
export interface AckRecord {
  id: string;
  formRevision: string | null;
  ackDate: string;        // yyyy-MM-dd
  name: string;
  company: string;
  phone: string;
}

/** A person found by the lookup: their newest acknowledgement, whether or not it still counts. */
export interface VisitorMatch {
  name: string;
  company: string;
  ack: AckRecord;
}

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** The last four digits of a phone number, or "" when it has fewer than four. */
export function last4(phone: string | null | undefined): string {
  const d = digits(phone);
  return d.length >= 4 ? d.slice(-4) : "";
}

/** Case, accent and spacing folded, so "José  Pérez" finds "jose perez". */
export function normalizeName(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const personKey = (r: Pick<AckRecord, "name" | "company">) =>
  `${normalizeName(r.name)}|${normalizeName(r.company)}`;

/**
 * Who a typed query could be.
 *
 * Four or more digits are a phone lookup: a record matches when one number ends with the other,
 * so a visitor who gave only "4471" is found by their full number, and one who gave the full
 * number is found by "4471". Otherwise it is a name lookup, and every typed word must begin a
 * word of the name or company. Fewer than four digits or two letters matches nobody — the list of
 * people who have visited is never shown to somebody who has not said who they are.
 *
 * The server (visitor_lookup) applies the same floor and narrows the candidates; this does the
 * exact matching on what it returns. One row per person (name + company), carrying their newest
 * acknowledgement.
 */
export function findVisitorMatches(index: AckRecord[], query: string): VisitorMatch[] {
  const q = query.trim();
  const qDigits = digits(q);
  const phoneLookup = qDigits.length >= 4 && !/[a-z]/i.test(q);
  const words = normalizeName(q).split(" ").filter(Boolean);
  if (!phoneLookup && normalizeName(q).length < 2) return [];

  const hit = (r: AckRecord) => {
    if (phoneLookup) {
      const p = digits(r.phone);
      return p.length >= 4 && (p.endsWith(qDigits) || qDigits.endsWith(p));
    }
    const hay = `${normalizeName(r.name)} ${normalizeName(r.company)}`.split(" ");
    return words.every(w => hay.some(h => h.startsWith(w)));
  };

  const newest = new Map<string, AckRecord>();
  for (const r of index) {
    if (!r.name.trim() || !hit(r)) continue;
    const key = personKey(r);
    const seen = newest.get(key);
    if (!seen || r.ackDate > seen.ackDate) newest.set(key, r);
  }
  return [...newest.values()]
    .sort((a, b) => normalizeName(a.name).localeCompare(normalizeName(b.name)))
    .slice(0, 8)
    .map(ack => ({ name: ack.name, company: ack.company, ack }));
}

/** yyyy-MM-dd plus whole months, clamped to the month's end (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsIso(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, daysInMonth);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(day)}`;
}

export type AckState =
  | { valid: true; expiresOn: string }
  | { valid: false; reason: "none" | "revised" | "expired" };

/**
 * Whether an acknowledgement lets its holder in today without re-reading the rules.
 * It must be at FRM-906's CURRENT revision (a revision changes what was acknowledged) and less
 * than twelve months old: signed 2026-10-01, it is good through 2027-09-30.
 * visitor_sign_in re-checks both on the server.
 */
export function ackState(ack: AckRecord | null | undefined, currentRevision: string | null, today: string): AckState {
  if (!ack || !/^\d{4}-\d{2}-\d{2}$/.test(ack.ackDate)) return { valid: false, reason: "none" };
  if ((ack.formRevision ?? "") !== (currentRevision ?? "")) return { valid: false, reason: "revised" };
  const expiresOn = addMonthsIso(ack.ackDate, ACK_VALID_MONTHS);
  if (today >= expiresOn || ack.ackDate > today) return { valid: false, reason: "expired" };
  return { valid: true, expiresOn };
}

/** A drawn signature value. The server stamps `witnessed_by` with the account holding the device. */
export interface DrawnSignature {
  user_id: null;
  name: string;
  signed_at: string;
  image: string;
}

export interface VisitAnswers {
  name: string;
  company: string;
  phone: string;
  purpose: string;
  /** Who the visitor is here to see — picked from the team's names. */
  host: string;
  noSymptoms: "pass" | "fail";
  woundsCovered: "pass" | "fail" | "na";
  healthNotes: string;
  signatureImage: string;
}

/**
 * Entry is refused when the visitor declares a symptom (11.3.4.3). An uncovered cut is not a
 * refusal — it is fixed at the door with a dressing, so the page holds the visitor at that
 * question until it is covered rather than recording a "fail".
 */
export const isRefused = (a: Pick<VisitAnswers, "noSymptoms">) => a.noSymptoms === "fail";

const visitorSignature = (a: VisitAnswers, at: Date): DrawnSignature => ({
  user_id: null, name: a.name.trim(), signed_at: at.toISOString(), image: a.signatureImage,
});

const pad2 = (n: number) => String(n).padStart(2, "0");
export const localDate = (at: Date) => `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`;
export const localTime = (at: Date) => `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;

/** The answers of a new FRM-906 entry (overlaid on the schema's empty values by the caller). */
export function buildAckData(a: VisitAnswers, at: Date): Record<string, unknown> {
  return {
    ack_date: localDate(at),
    visitor_name: a.name.trim(),
    company: a.company.trim(),
    phone: a.phone.trim(),
    visitor_signature: visitorSignature(a, at),
  };
}

/**
 * The answers of a new FRM-905 entry. `ack` is the acknowledgement already on file that the visit
 * relies on; pass null when one is being signed in the same sign-in (the server fills in its id)
 * or when entry is refused. A refused visit relies on none: time out equals time in, so the
 * visitor never appears as on site.
 */
export function buildSignInData(
  a: VisitAnswers, at: Date, ack: { id: string; ackDate: string } | null,
): Record<string, unknown> {
  const refused = isRefused(a);
  const time = localTime(at);
  return {
    visit_date: localDate(at),
    visitor_name: a.name.trim(),
    company: a.company.trim(),
    purpose: a.purpose,
    host: a.host.trim(),
    time_in: time,
    time_out: refused ? time : "",
    no_symptoms: a.noSymptoms,
    wounds_covered: a.woundsCovered,
    health_notes: a.healthNotes.trim(),
    ack_date: !refused && ack ? ack.ackDate : "",
    ack_response_id: !refused && ack ? ack.id : "",
    entry_route: refused ? ROUTE_REFUSED : ROUTE_BRIEFED,
    entry_notes: refused ? "Entry refused on the health declaration (SQF 11.3.4.3). The visitor did not enter." : "",
    visitor_signature: visitorSignature(a, at),
  };
}
