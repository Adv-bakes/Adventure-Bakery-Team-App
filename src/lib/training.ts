import { supabase } from "@/integrations/supabase/client";

export const TRAINING_CATEGORY_LABELS: Record<number, string> = {
  1: "Core Onboarding",
  2: "Safety & Risk Management",
  3: "Job-Specific Operations",
  4: "Response Protocols",
};

export const TRAINING_CATEGORIES = [1, 2, 3, 4] as const;

export const DEPARTMENTS = ["Production", "Sourcing", "Quality Control", "Admin", "R&D", "Sales"];

export type TrainingModule = {
  id: string;
  title: string;
  training_category: number;
  module_number: string | null;
  is_annual_refresher: boolean;
  required_departments: string[] | null;
  status: "draft" | "active" | "archived";
  category: string | null;
  sop_number: string | null;
  revision: string | null;
  effective_date: string | null;
  content: any;
  file_url: string | null;
  media_url: string | null;
  passing_score_pct: number;
  is_critical: boolean;
};

export type TrainingAssignment = {
  id: string;
  employee_id: string;
  sop_id: string;
  assigned_at: string;
  completed_at: string | null;
  signed: boolean;
  signed_at: string | null;
  due_at: string | null;
  expires_at: string | null;
  recurrence_months: number | null;
  quiz_score: number | null;
  quiz_passed_at: string | null;
  quiz_attempts: number;
};

export type QuizQuestion = {
  id: string;
  sop_id: string;
  question_number: number;
  question_text: string;
  options: string[];
  correct_option_index: number;
  hint: string | null;
  rationale: string | null;
};

export type Employee = {
  id: string;
  full_name: string;
  employee_id: string | null;
  department: string | null;
  job_title: string | null;
};

export type AssignmentStatus = "not_started" | "in_progress" | "completed" | "expired";

export function getAssignmentStatus(assignment: TrainingAssignment | undefined, today: Date = new Date()): AssignmentStatus {
  if (!assignment) return "not_started";
  if (assignment.expires_at && new Date(assignment.expires_at) < today) return "expired";
  if (assignment.completed_at) return "completed";
  return "in_progress";
}

export function computeExpiry(completedAt: string, recurrenceMonths: number | null): string | null {
  if (!recurrenceMonths) return null;
  const date = new Date(completedAt);
  date.setMonth(date.getMonth() + recurrenceMonths);
  return date.toISOString().slice(0, 10);
}

export async function fetchTrainingModules(): Promise<TrainingModule[]> {
  const { data, error } = await (supabase as any)
    .from("sop_documents")
    .select("*")
    .not("training_category", "is", null)
    .order("module_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TrainingModule[];
}

export async function fetchTrainingAssignments(employeeId?: string): Promise<TrainingAssignment[]> {
  let query = (supabase as any).from("training_assignments").select("*");
  if (employeeId) query = query.eq("employee_id", employeeId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TrainingAssignment[];
}

export async function fetchEmployees(): Promise<Employee[]> {
  const { data: roles, error: rolesError } = await (supabase as any)
    .from("user_roles")
    .select("user_id")
    .in("role", ["staff", "admin", "owner"]);
  if (rolesError) throw rolesError;

  const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
  if (ids.length === 0) return [];

  const { data: profiles, error: profilesError } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, employee_id, department, job_title")
    .in("id", ids);
  if (profilesError) throw profilesError;

  return (profiles ?? []) as Employee[];
}

export async function markAssignmentComplete(assignment: TrainingAssignment): Promise<void> {
  const completedAt = new Date().toISOString();
  const expiresAt = computeExpiry(completedAt, assignment.recurrence_months);
  const { error } = await (supabase as any)
    .from("training_assignments")
    .update({
      completed_at: completedAt,
      signed: true,
      signed_at: completedAt,
      expires_at: expiresAt,
    })
    .eq("id", assignment.id);
  if (error) throw error;
}

export async function updateModuleRequirements(sopId: string, requiredDepartments: string[] | null): Promise<void> {
  const { error } = await (supabase as any)
    .from("sop_documents")
    .update({ required_departments: requiredDepartments })
    .eq("id", sopId);
  if (error) throw error;
}

export async function fetchModuleById(id: string): Promise<TrainingModule | null> {
  const { data, error } = await (supabase as any)
    .from("sop_documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as TrainingModule | null;
}

export async function fetchAssignment(employeeId: string, sopId: string): Promise<TrainingAssignment | null> {
  const { data, error } = await (supabase as any)
    .from("training_assignments")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("sop_id", sopId)
    .maybeSingle();
  if (error) throw error;
  return data as TrainingAssignment | null;
}

export async function updateModuleQuizConfig(sopId: string, config: { passing_score_pct?: number; is_critical?: boolean }): Promise<void> {
  const { error } = await (supabase as any)
    .from("sop_documents")
    .update(config)
    .eq("id", sopId);
  if (error) throw error;
}

export async function fetchQuizQuestions(sopId: string): Promise<QuizQuestion[]> {
  const { data, error } = await (supabase as any)
    .from("quiz_questions")
    .select("*")
    .eq("sop_id", sopId)
    .order("question_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as QuizQuestion[];
}

export async function saveQuizQuestions(sopId: string, questions: Omit<QuizQuestion, "id" | "sop_id">[]): Promise<void> {
  const { error: deleteError } = await (supabase as any)
    .from("quiz_questions")
    .delete()
    .eq("sop_id", sopId);
  if (deleteError) throw deleteError;

  if (questions.length === 0) return;

  const rows = questions.map((q, idx) => ({
    sop_id: sopId,
    question_number: idx + 1,
    question_text: q.question_text,
    options: q.options,
    correct_option_index: q.correct_option_index,
    hint: q.hint,
    rationale: q.rationale,
  }));
  const { error: insertError } = await (supabase as any)
    .from("quiz_questions")
    .insert(rows);
  if (insertError) throw insertError;
}

export type QuizResult = { scorePct: number; passed: boolean };

export function scoreQuiz(questions: QuizQuestion[], answers: number[], passingScorePct: number, isCritical: boolean): QuizResult {
  const correctCount = questions.reduce((sum, q, idx) => sum + (answers[idx] === q.correct_option_index ? 1 : 0), 0);
  const scorePct = questions.length === 0 ? 100 : Math.round((correctCount / questions.length) * 100);
  const threshold = isCritical ? 100 : passingScorePct;
  return { scorePct, passed: scorePct >= threshold };
}

export async function submitQuizResult(assignment: TrainingAssignment, result: QuizResult, recurrenceMonths: number | null): Promise<void> {
  const now = new Date().toISOString();
  if (result.passed) {
    const expiresAt = computeExpiry(now, recurrenceMonths);
    const { error } = await (supabase as any)
      .from("training_assignments")
      .update({
        completed_at: now,
        signed: true,
        signed_at: now,
        expires_at: expiresAt,
        quiz_score: result.scorePct,
        quiz_passed_at: now,
        quiz_attempts: assignment.quiz_attempts + 1,
      })
      .eq("id", assignment.id);
    if (error) throw error;
  } else {
    const { error } = await (supabase as any)
      .from("training_assignments")
      .update({
        quiz_score: result.scorePct,
        quiz_attempts: assignment.quiz_attempts + 1,
      })
      .eq("id", assignment.id);
    if (error) throw error;
  }
}

export function isExpiringSoon(expiresAt: string | null, withinDays: number, today: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  const diffDays = (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= withinDays;
}

export function isOverdue(assignment: TrainingAssignment, today: Date = new Date()): boolean {
  if (assignment.completed_at) {
    return !!assignment.expires_at && new Date(assignment.expires_at) < today;
  }
  return !!assignment.due_at && new Date(assignment.due_at) < today;
}

export type ImportedQuizQuestion = {
  question_text: string;
  options: string[];
  correct_option_index: number;
  hint: string | null;
  rationale: string | null;
};

// Parses a CSV string into rows of fields, handling quoted fields with embedded
// commas, quotes (doubled), and newlines.
function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && csv[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.some(f => f.trim() !== ""));
}

// Parses a NotebookLLM-style quiz export CSV with columns:
// #, Question, Hint, Option A, Option B, ..., Correct Answer, Rationale
export function parseQuizCsv(csv: string): ImportedQuizQuestion[] {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) return [];

  const header = rows[0].map(h => h.trim().toLowerCase());
  const questionIdx = header.findIndex(h => h === "question");
  const hintIdx = header.findIndex(h => h === "hint");
  const correctIdx = header.findIndex(h => h === "correct answer");
  const rationaleIdx = header.findIndex(h => h === "rationale");
  const optionIndexes = header
    .map((h, idx) => ({ h, idx }))
    .filter(({ h }) => h.startsWith("option "))
    .map(({ idx }) => idx);

  if (questionIdx === -1 || optionIndexes.length === 0) {
    throw new Error("CSV is missing required columns (Question, Option A, ...)");
  }

  return rows.slice(1).map(cols => {
    const options = optionIndexes.map(idx => (cols[idx] ?? "").trim()).filter(o => o !== "");
    const correctRaw = correctIdx !== -1 ? (cols[correctIdx] ?? "").trim() : "";
    const letterMatch = correctRaw.match(/^([A-Za-z])/);
    let correctIndex = 0;
    if (letterMatch) {
      correctIndex = letterMatch[1].toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
    }
    if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;

    return {
      question_text: (cols[questionIdx] ?? "").trim(),
      options,
      correct_option_index: correctIndex,
      hint: hintIdx !== -1 ? (cols[hintIdx] ?? "").trim() || null : null,
      rationale: rationaleIdx !== -1 ? (cols[rationaleIdx] ?? "").trim() || null : null,
    };
  }).filter(q => q.question_text !== "" && q.options.length > 0);
}

// Uploads a slide image to the training-content bucket and returns its storage path.
export async function uploadTrainingSlide(sopId: string, file: File, slideIndex: number): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${sopId}/slide-${String(slideIndex + 1).padStart(2, "0")}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("training-content")
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  return path;
}

// Minimum viewing time (seconds) for a slide, based on its narration length.
// No narration → 20s default; otherwise medium reading speed ≈ 180 wpm with an 8s floor.
export function computeSlideDuration(narration: string | null | undefined): number {
  const words = (narration ?? "").trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 20;
  return Math.max(8, Math.ceil(words / 3));
}

// Replaces an existing slide image in place (same storage path, so content.slides stays unchanged).
export async function replaceTrainingSlide(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage
    .from("training-content")
    .upload(path, file, { upsert: true });
  if (error) throw error;
}

export async function deleteTrainingSlide(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from("training-content")
    .remove([path]);
  if (error) throw error;
}

export async function getTrainingSlideUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("training-content")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error) throw error;
  return data.signedUrl;
}

export async function updateModuleContent(sopId: string, content: any): Promise<void> {
  const { error } = await (supabase as any)
    .from("sop_documents")
    .update({ content })
    .eq("id", sopId);
  if (error) throw error;
}
