/**
 * Training matrix derivation — the union of what each department REQUIRES and what
 * each employee has actually been ASSIGNED.
 *
 * Pure: no supabase import, so it can be exercised directly. Mirrors the split
 * between formSchema.ts (pure) and formResponses.ts (data access) already used for
 * the fillable-forms feature. Callers fetch with training.ts's fetchers and pass the
 * rows in.
 *
 * WHY THE UNION IS THE POINT. Requirement and assignment can diverge in both
 * directions, and each direction is a different defect:
 *
 *                 assigned          not assigned
 *   required      normal            GAP    - sync missed it, or the person predates
 *                                            the module, or a role change bypassed
 *                                            both sync triggers
 *   not required  EXTRA - manual    (not shown)
 *                 assign, or the
 *                 scope moved later
 *
 * EXTRA is what stale_training_report() (migration 20260827000008) returns in SQL and
 * has never had a UI. Nothing anywhere detected GAP before this file.
 */
import {
  type AssignmentStatus,
  type Employee,
  type ModuleVariant,
  type TrainingAssignment,
  type TrainingModule,
  DEPARTMENTS,
  getAssignmentStatus,
} from "@/lib/training";

export type TrainingException = "gap" | "extra" | null;

export interface PersonModuleRow {
  module: TrainingModule;
  required: boolean;
  assignment: TrainingAssignment | null;
  status: AssignmentStatus;
  exception: TrainingException;
  /** the assignment points at the Spanish variant rather than the English row */
  inSpanish: boolean;
}

export interface RequirementRow {
  module: TrainingModule;
  /** one flag per DEPARTMENTS entry, in order */
  marks: boolean[];
  /** an active Spanish variant exists for this module */
  hasSpanish: boolean;
}

export interface ExceptionRow {
  employee: Employee;
  row: PersonModuleRow;
}

const ES_SUFFIX = /\s*\(ES\)\s*$/;

export function isSpanishTitle(title: string): boolean {
  return ES_SUFFIX.test(title);
}

/**
 * The rows that can actually be required of somebody: ACTIVE and English.
 *
 * Two filters, each load-bearing:
 *
 *  - status. fetchTrainingModules() filters on training_category only, so drafts and
 *    archived modules come back too — 10 of 28 on this site. The sync functions only
 *    ever assign active modules, so counting a draft as "required" invents a gap
 *    against a module nobody has published.
 *  - language. An ES row is a content variant, not an assignable unit.
 *
 * An assignment pointing at a non-active module therefore resolves to no row here.
 * That is the MECHANICAL staleness class, which revoke_stale_training() clears
 * automatically on every module change (migration 20260827000008) — it does not need
 * a human, so it is not reported as an exception.
 */
export function assignableModules(modules: TrainingModule[]): TrainingModule[] {
  return modules.filter((m) => m.status === "active" && !isSpanishTitle(m.title));
}

/**
 * Outstanding = neither completed nor started. The same gate the database uses: work
 * that was done is evidence under 2.9.2.3 and is never a finding, however the scope
 * has moved since. Without this, every module somebody completed before a scope change
 * would be flagged in amber forever.
 */
export function isOutstanding(a: TrainingAssignment): boolean {
  return !a.completed_at && a.progress === null;
}

/**
 * A null required_departments means ALL STAFF, not "nobody" — the same predicate the
 * SQL sync uses: required_departments IS NULL OR p.department = ANY(required_departments).
 * Getting this backwards would silently empty the matrix.
 */
export function isRequiredFor(module: TrainingModule, department: string | null): boolean {
  if (module.required_departments === null) return true;
  if (!department) return false;
  return module.required_departments.includes(department);
}

/**
 * Map every Spanish variant's id to the id of the English module that governs it,
 * matched on module_number. Same rule as governing_training_module() in the database.
 * Variants with no module_number, or with no English sibling, are simply absent —
 * their assignments then resolve to nothing and surface as an exception rather than
 * being silently attributed to the wrong module.
 */
export function buildGoverningMap(
  modules: TrainingModule[],
  variants: ModuleVariant[],
): Map<string, string> {
  const enByNumber = new Map<string, string>();
  for (const m of assignableModules(modules)) {
    if (m.module_number) enByNumber.set(m.module_number, m.id);
  }
  const map = new Map<string, string>();
  for (const v of variants) {
    if (!v.module_number) continue;
    const en = enByNumber.get(v.module_number);
    if (en) map.set(v.id, en);
  }
  return map;
}

/** Module numbers that have an active Spanish variant. */
export function spanishModuleNumbers(variants: ModuleVariant[]): Set<string> {
  return new Set(variants.map((v) => v.module_number).filter((n): n is string => !!n));
}

/** Table 1: the standing requirement, one row per assignable module. */
export function requirementMatrix(
  modules: TrainingModule[],
  variants: ModuleVariant[] = [],
): RequirementRow[] {
  const spanish = spanishModuleNumbers(variants);
  return assignableModules(modules).map((module) => ({
    module,
    marks: DEPARTMENTS.map((d) => isRequiredFor(module, d)),
    hasSpanish: !!module.module_number && spanish.has(module.module_number),
  }));
}

/**
 * Table 2: one person's full picture — every assignable module, whether their
 * department requires it, and what they have actually done.
 *
 * `assignments` may be the whole table or one employee's rows; it is filtered here
 * either way.
 */
export function personTraining(
  employee: Employee,
  modules: TrainingModule[],
  assignments: TrainingAssignment[],
  governing: Map<string, string>,
): PersonModuleRow[] {
  // Resolve each of this person's assignments onto the module that governs it, so a
  // Spanish assignment lands on its English row instead of matching nothing.
  const byModuleId = new Map<string, { assignment: TrainingAssignment; inSpanish: boolean }>();
  for (const a of assignments) {
    if (a.employee_id !== employee.id) continue;
    const governingId = governing.get(a.sop_id);
    const moduleId = governingId ?? a.sop_id;
    const existing = byModuleId.get(moduleId);
    // If somebody holds both languages of one module, the completed record wins — it
    // is the evidence. Otherwise first in wins; either way we never show two rows for
    // one module.
    if (!existing || (!existing.assignment.completed_at && a.completed_at)) {
      byModuleId.set(moduleId, { assignment: a, inSpanish: !!governingId });
    }
  }

  return assignableModules(modules).map((module) => {
    const hit = byModuleId.get(module.id) ?? null;
    const required = isRequiredFor(module, employee.department);
    const assignment = hit?.assignment ?? null;
    let exception: TrainingException = null;
    if (required && !assignment) exception = "gap";
    else if (!required && assignment && isOutstanding(assignment)) exception = "extra";
    return {
      module,
      required,
      assignment,
      status: getAssignmentStatus(assignment ?? undefined),
      exception,
      inSpanish: hit?.inSpanish ?? false,
    };
  });
}

/**
 * Every divergence across every employee. Empty is the healthy state, and the EXTRA
 * half is checkable: it is defined to match stale_training_report() exactly, so after
 * migration 20260827000011 (which emptied that report) any EXTRA row means this
 * predicate has drifted from the SQL one. A GAP is a real finding — nothing in the
 * database detects that direction.
 */
export function exceptions(
  employees: Employee[],
  modules: TrainingModule[],
  assignments: TrainingAssignment[],
  governing: Map<string, string>,
): ExceptionRow[] {
  const out: ExceptionRow[] = [];
  for (const employee of employees) {
    for (const row of personTraining(employee, modules, assignments, governing)) {
      if (row.exception) out.push({ employee, row });
    }
  }
  return out;
}

export function exceptionLabel(row: PersonModuleRow): string {
  if (row.exception === "gap") return "Required, not assigned";
  if (row.exception === "extra") return "Assigned, not required";
  return "";
}

export function statusLabel(row: PersonModuleRow): string {
  if (!row.assignment) return row.required ? "Not assigned" : "Not required";
  const base = row.status.replace("_", " ");
  return row.inSpanish ? `${base} (ES)` : base;
}
