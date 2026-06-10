-- Quiz shell: per-module quiz questions, passing-score config, and per-assignment quiz results
-- Content (questions, options, hints) will be authored later via the admin UI / NotebookLLM exports.

ALTER TABLE public.sop_documents
  ADD COLUMN IF NOT EXISTS passing_score_pct smallint NOT NULL DEFAULT 80 CHECK (passing_score_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS is_critical boolean NOT NULL DEFAULT false;

ALTER TABLE public.training_assignments
  ADD COLUMN IF NOT EXISTS quiz_score smallint,
  ADD COLUMN IF NOT EXISTS quiz_passed_at timestamptz,
  ADD COLUMN IF NOT EXISTS quiz_attempts integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id uuid NOT NULL REFERENCES public.sop_documents(id) ON DELETE CASCADE,
  question_number integer NOT NULL,
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_option_index smallint NOT NULL,
  hint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sop_id, question_number)
);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- Staff/admin/owner can read questions for active modules (needed to take the quiz)
CREATE POLICY "Employees read quiz_questions"
  ON public.quiz_questions FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- Only admins/owners can author quiz questions
CREATE POLICY "Admins manage quiz_questions"
  ON public.quiz_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
