// Who holds each FSQM-004 position, and who covers it (owner's request, 2026-10-17).
//
// FSQM-004 describes positions and names nobody, so it is not reissued every time somebody changes
// duties. The people are kept here instead: a list of current holders (position_holders, edited on
// the team member page) and, for the two SQF Practitioner positions, the designation in force on
// FRM-005 - the designation is that record's job, so it is never typed a second time here.
//
// The cover rules are FSQM-004's, copied into POSITIONS. `checkPositionsAgainstFsqm004` compares
// them with the document's own wording and the page says so when they no longer match.
//
// Pure, no imports: tested by scripts/test-positions.mjs.

export type PositionKey =
  | "senior_site_management"
  | "sqf_practitioner_primary"
  | "sqf_practitioner_substitute"
  | "production_supervisor"
  | "production_operator"
  | "receiving"
  | "administration"
  | "maintenance";

/** One step of a cover: holders of a position, the other holders of the same one, or a contractor. */
export type CoverStep =
  | { kind: "position"; key: PositionKey }
  | { kind: "same" }
  | { kind: "contracted"; label: string };

export interface PositionDef {
  key: PositionKey;
  name: string;
  /** Set for the practitioner positions: holders come from FRM-005, not from the list. */
  fromDesignation?: "primary" | "substitute";
  /** Key personnel under 2.1.1.3 have a named cover. Empty = FSQM-004 names none. */
  cover: CoverStep[];
  /** A limit FSQM-004 puts on the cover, shown beside it. */
  coverNote?: string;
  /** FSQM-004's own words for the cover, used to notice the document changing. */
  coverText?: string;
}

export const POSITIONS: PositionDef[] = [
  {
    key: "senior_site_management", name: "Senior Site Management",
    cover: [{ kind: "position", key: "sqf_practitioner_primary" }],
    coverNote: "Day-to-day decisions only. Designating the SQF Practitioner and approving controlled documents are not delegated.",
    coverText: "Covered by the SQF Practitioner for day-to-day decisions only",
  },
  {
    key: "sqf_practitioner_primary", name: "SQF Practitioner (primary)", fromDesignation: "primary",
    cover: [{ kind: "position", key: "sqf_practitioner_substitute" }],
    coverText: "Covered by the substitute SQF Practitioner",
  },
  {
    key: "sqf_practitioner_substitute", name: "SQF Practitioner (substitute)", fromDesignation: "substitute",
    cover: [],
  },
  {
    key: "production_supervisor", name: "Production Supervisor",
    cover: [{ kind: "position", key: "senior_site_management" }],
    coverText: "Covered by Senior Site Management",
  },
  {
    key: "production_operator", name: "Production Operator and Floor Operator",
    cover: [{ kind: "same" }, { kind: "position", key: "production_supervisor" }],
    coverText: "Covered by the other operator, or by the Production Supervisor",
  },
  {
    key: "receiving", name: "Receiving / Goods-In",
    cover: [{ kind: "position", key: "production_supervisor" }],
    coverText: "Covered by the Production Supervisor",
  },
  { key: "administration", name: "Administration", cover: [] },
  {
    key: "maintenance", name: "Maintenance",
    cover: [{ kind: "contracted", label: "The contracted provider (Contract Services Register)" }],
    coverText: "Covered by the contracted provider",
  },
];

/** The positions a person is given on the team member page (the practitioners come from FRM-005). */
export const ASSIGNABLE_POSITIONS = POSITIONS.filter((p) => !p.fromDesignation);

export const positionName = (key: string): string =>
  POSITIONS.find((p) => p.key === key)?.name ?? key;

export interface Person { id: string | null; name: string }

/** The designation in force: the newest SUBMITTED FRM-005 entry. Drafts designate nobody. */
export interface Designation {
  primary: string;
  substitute: string;
  effectiveDate: string | null;
  responseId: string;
}

export function designationFrom(
  entries: { id: string; status: string; submitted_at: string | null; data: Record<string, unknown> | null }[],
): Designation | null {
  const submitted = entries
    .filter((e) => e.status === "submitted")
    .sort((a, b) => String(b.submitted_at ?? "").localeCompare(String(a.submitted_at ?? "")));
  const e = submitted[0];
  if (!e) return null;
  const d = e.data ?? {};
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    primary: text(d.primary_name),
    substitute: text(d.substitute_name),
    effectiveDate: text(d.effective_date) || null,
    responseId: e.id,
  };
}

const fold = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** A designated name, linked to the team member of that name when there is exactly one. */
function personByName(name: string, team: Person[]): Person | null {
  if (!name) return null;
  const hits = team.filter((p) => fold(p.name) === fold(name));
  return hits.length === 1 ? hits[0] : { id: null, name };
}

/** Who steps in when one holder is away. */
export interface HolderCover {
  holder: Person;
  /** Who would step in; empty when nobody can (or when a contractor does). */
  people: Person[];
  /** How: "Also holds this position", "Production Supervisor", "Passed up to Senior Site Management", ... */
  via: string;
  /** The contractor named, for maintenance. */
  contracted?: string;
  /** Why the named cover could not be used, when the rule had to pass upward. */
  problem?: string;
}

export interface ResolvedCover {
  /** One line per holder of the position. Empty when the position is vacant. */
  byHolder: HolderCover[];
  /** True when nobody holds the position, so there is nobody to stand in for. */
  vacant: boolean;
}

export interface PositionRow {
  def: PositionDef;
  holders: Person[];
  /** Who covers each holder. */
  cover: ResolvedCover;
}

/** A holder with nobody sharing the position, where FSQM-004 names no cover for it. */
export const NONE_NAMED = "No cover named in FSQM-004";

const samePerson = (a: Person, b: Person) => (a.id && b.id ? a.id === b.id : fold(a.name) === fold(b.name));
const without = (a: Person[], p: Person) => a.filter((q) => !samePerson(p, q));

/**
 * Every position with its holders, and for each holder, who steps in while they are away.
 *
 * Worked out per holder, because one position is often held by several people here: first another
 * holder of the same position (they already do the work - FSQM-004's "the other operator"), then
 * the cover FSQM-004 names, then - FSQM-004's own rule - "the responsibility passes upward to
 * Senior Site Management". Nobody ever covers themselves. A vacant position has nobody to cover.
 */
export function resolvePositions(
  held: { user_id: string; position: string }[],
  team: Person[],
  designation: Designation | null,
): PositionRow[] {
  const holdersOf = (key: PositionKey): Person[] => {
    const def = POSITIONS.find((p) => p.key === key)!;
    if (def.fromDesignation) {
      const p = personByName(def.fromDesignation === "primary" ? designation?.primary ?? "" : designation?.substitute ?? "", team);
      return p ? [p] : [];
    }
    return team.filter((p) => p.id && held.some((h) => h.user_id === p.id && h.position === key))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const coverFor = (def: PositionDef, holders: Person[], h: Person): HolderCover => {
    const sharing = without(holders, h);
    if (sharing.length) return { holder: h, people: sharing, via: "Also holds this position" };
    if (def.cover.length === 0) return { holder: h, people: [], via: NONE_NAMED };
    for (const step of def.cover) {
      if (step.kind === "contracted") return { holder: h, people: [], via: "Contracted", contracted: step.label };
      if (step.kind === "same") continue; // already tried above
      const people = without(holdersOf(step.key), h);
      if (people.length) return { holder: h, people, via: positionName(step.key) };
    }
    const first = def.cover.find((s) => s.kind === "position") as { kind: "position"; key: PositionKey } | undefined;
    const named = first ? positionName(first.key) : "the named cover";
    const problem = first && holdersOf(first.key).length === 0
      ? `Nobody holds ${named}.`
      : `${named} is held by the same person, so it is not a cover.`;
    if (def.key !== "senior_site_management") {
      const up = without(holdersOf("senior_site_management"), h);
      if (up.length) return { holder: h, people: up, via: "Passed up to Senior Site Management", problem };
    }
    return { holder: h, people: [], via: "No cover", problem };
  };

  return POSITIONS.map((def) => {
    const holders = holdersOf(def.key);
    return { def, holders, cover: { byHolder: holders.map((h) => coverFor(def, holders, h)), vacant: holders.length === 0 } };
  });
}

/** The positions a person stands in for, and for whom. */
export function standsInFor(rows: PositionRow[], person: Person): { def: PositionDef; for: Person[] }[] {
  return rows
    .map((r) => ({ def: r.def, for: (r.cover?.byHolder ?? []).filter((c) => c.people.some((p) => samePerson(p, person))).map((c) => c.holder) }))
    .filter((x) => x.for.length > 0);
}

/** For each position a person holds, who steps in while they are away. */
export function coverWhenAway(rows: PositionRow[], person: Person): { def: PositionDef; cover: HolderCover | null }[] {
  return rows
    .filter((r) => r.holders.some((h) => samePerson(h, person)))
    .map((r) => ({ def: r.def, cover: r.cover?.byHolder.find((c) => samePerson(c.holder, person)) ?? null }));
}

/** Positions a person holds, the practitioner designations included. */
export function positionsOf(rows: PositionRow[], person: Person): PositionDef[] {
  return rows.filter((r) => r.holders.some((h) => samePerson(h, person))).map((r) => r.def);
}

/**
 * The cover rules above against FSQM-004's own wording. Returns one line per thing that no longer
 * matches (a position renamed, a cover changed), empty when the two agree.
 */
export function checkPositionsAgainstFsqm004(text: string): string[] {
  const t = fold(text.replace(/[—–]/g, "-"));
  const issues: string[] = [];
  for (const p of POSITIONS) {
    const base = p.fromDesignation ? "sqf practitioner" : fold(p.name);
    if (!t.includes(base)) issues.push(`FSQM-004 no longer names "${p.name}".`);
    if (p.coverText && !t.includes(fold(p.coverText))) issues.push(`FSQM-004 no longer says "${p.coverText}".`);
  }
  return issues;
}
