-- Formula versioning
ALTER TABLE public.formulas
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by_version int;

CREATE INDEX IF NOT EXISTS idx_formulas_concept_active
  ON public.formulas (concept_id)
  WHERE superseded_at IS NULL;

-- Client read of current formula version (owner of the concept)
DROP POLICY IF EXISTS "Concept owners read current formulas" ON public.formulas;
CREATE POLICY "Concept owners read current formulas"
  ON public.formulas
  FOR SELECT
  TO authenticated
  USING (
    superseded_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.concepts c
      WHERE c.id = formulas.concept_id
        AND c.user_id = (auth.uid())::text
    )
  );

-- Proprietary internal processes (staff-only)
CREATE TABLE IF NOT EXISTS public.processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id bigint,
  product_id uuid,
  version int NOT NULL DEFAULT 1,
  step_number int NOT NULL,
  action text,
  ingredients_added jsonb DEFAULT '[]'::jsonb,
  mix_time_min numeric,
  mix_speed text,
  time_minutes numeric,
  temperature numeric,
  temp_unit text,
  is_critical_control_point boolean DEFAULT false,
  proprietary_notes text,
  superseded_at timestamptz,
  superseded_by_version int,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processes_concept_active
  ON public.processes (concept_id, step_number)
  WHERE superseded_at IS NULL;

ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff/admin all processes" ON public.processes;
CREATE POLICY "Staff/admin all processes"
  ON public.processes
  FOR ALL
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));

DROP TRIGGER IF EXISTS processes_touch_updated_at ON public.processes;
CREATE TRIGGER processes_touch_updated_at
  BEFORE UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();