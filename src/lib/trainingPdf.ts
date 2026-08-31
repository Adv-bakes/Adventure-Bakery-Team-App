/**
 * Printable copies of the training reports, for a certification-body audit.
 *
 * Reuses generateDerivedReportPdf() from formPdf.ts — it already renders a landscape
 * headers/rows table with the wordmark and the confidentiality footer, so there is no
 * new PDF machinery here. FormPdfDoc's fields are all optional, so a plain literal
 * satisfies it structurally.
 *
 * These are REPORTS, not a form: the effective date is the day it was generated, and
 * that is stamped on every sheet. FRM-951 keeps its number so SOP-2.9's references
 * stay valid, but nothing here is a blank anybody fills in.
 */
import { format } from "date-fns";
import { generateDerivedReportPdf } from "@/lib/formPdf";
import { DEPARTMENTS, type Employee, type TrainingAssignment, type TrainingModule } from "@/lib/training";
import {
  type RequirementRow,
  personTraining,
  statusLabel,
  exceptionLabel,
} from "@/lib/trainingMatrix";

const TICK = "X";
const SCOPE_NOTE =
  "Training is assigned BY DEPARTMENT. SQF 2.9.2.1 ii asks for competencies by DUTY - " +
  "\u201Cstaff engaged in monitoring critical control points\u201D and their named backups - and a duty " +
  "is narrower than a department: not everyone in Production monitors a CCP. Recording that " +
  "requires the job descriptions and named CCP monitors from deliverable D-01. Until those exist " +
  "this report is accurate about what is assigned and incomplete about what the Code asks.";

function today(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function docFor(title: string) {
  return {
    sop_number: "FRM-951",
    title,
    revision: "Generated report",
    effective_date: today(),
  };
}

/** Table 1 — the standing requirement. Exactly 10 columns, which is the cap in formPdf. */
export function downloadRequirementsPdf(rows: RequirementRow[]): Promise<void> {
  const headers = ["Module", "Title", "Cat", ...DEPARTMENTS, "ES"];
  const body = rows.map((r) => [
    r.module.module_number ?? r.module.sop_number ?? "-",
    r.module.title,
    String(r.module.training_category),
    ...r.marks.map((m) => (m ? TICK : "")),
    r.hasSpanish ? "Yes" : "",
  ]);
  return generateDerivedReportPdf(docFor("Training Matrix - Required Training by Department"), headers, body, {
    count: body.length,
    sourceLabel: "Adventure Bakery Team App",
    legend: [
      `${TICK} = required of everyone in that department. A module marked in every column is required of all staff.`,
      "ES = a Spanish version of the module exists, which is how SQF 2.9.2.2 is met for Spanish-preferring employees.",
      SCOPE_NOTE,
    ],
  });
}

/**
 * Table 2 — the completion record, in LONG FORM: one row per (person, module).
 *
 * Deliberately not the on-screen grid. formPdf clamps a table to 10 columns, so a
 * person-per-column grid would silently drop everyone past the eighth employee and
 * print a "see CSV" note in place of the people. Six fixed columns scale to any
 * headcount, and a list read down is the conventional shape for a training record.
 */
export function downloadCompletionPdf(
  employees: Employee[],
  modules: TrainingModule[],
  assignments: TrainingAssignment[],
  governing: Map<string, string>,
): Promise<void> {
  const headers = ["Employee", "Department", "Module", "Title", "Status", "Completed", "Expires"];
  const body: string[][] = [];
  for (const e of employees) {
    for (const row of personTraining(e, modules, assignments, governing)) {
      // "Not required" is a real and different answer from "not done", but printing a
      // row for every module nobody owes would bury the record. Out-of-scope modules
      // are omitted here and stated in the legend instead.
      if (!row.required && !row.assignment) continue;
      body.push([
        e.full_name || e.id,
        e.department ?? "-",
        row.module.module_number ?? row.module.sop_number ?? "-",
        row.module.title,
        statusLabel(row),
        row.assignment?.completed_at?.slice(0, 10) ?? "",
        row.assignment?.expires_at ?? "",
      ]);
    }
  }
  return generateDerivedReportPdf(docFor("Training Matrix - Completion Record"), headers, body, {
    rangeLabel: `status as at ${today()}`,
    count: body.length,
    sourceLabel: "Adventure Bakery Team App",
    legend: [
      "One row per employee per module they are required to hold or have been assigned.",
      "Modules outside an employee's department are omitted; see the Required Training by Department report for scope.",
      "(ES) marks training taken in Spanish.",
      SCOPE_NOTE,
    ],
  });
}

/** One person's record, for a personnel file. */
export function downloadPersonPdf(
  employee: Employee,
  modules: TrainingModule[],
  assignments: TrainingAssignment[],
  governing: Map<string, string>,
): Promise<void> {
  const headers = ["Module", "Title", "Required", "Status", "Completed", "Expires", "Exception"];
  const body = personTraining(employee, modules, assignments, governing)
    .filter((r) => r.required || r.assignment)
    .map((r) => [
      r.module.module_number ?? r.module.sop_number ?? "-",
      r.module.title,
      r.required ? "Yes" : "",
      statusLabel(r),
      r.assignment?.completed_at?.slice(0, 10) ?? "",
      r.assignment?.expires_at ?? "",
      exceptionLabel(r),
    ]);
  return generateDerivedReportPdf(
    docFor(`Training Record - ${employee.full_name || employee.id}`),
    headers,
    body,
    {
      rangeLabel: `status as at ${today()}`,
      count: body.length,
      sourceLabel: employee.department ? `Department: ${employee.department}` : "No department set",
      legend: [SCOPE_NOTE],
    },
  );
}
