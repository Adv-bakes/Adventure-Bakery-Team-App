-- Training curriculum structure: category/module numbering + annual refresher flag
ALTER TABLE public.sop_documents
  ADD COLUMN IF NOT EXISTS training_category smallint CHECK (training_category BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS module_number text,
  ADD COLUMN IF NOT EXISTS is_annual_refresher boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS required_departments text[];

-- Training assignment due/expiry tracking
ALTER TABLE public.training_assignments
  ADD COLUMN IF NOT EXISTS due_at date,
  ADD COLUMN IF NOT EXISTS expires_at date,
  ADD COLUMN IF NOT EXISTS recurrence_months integer;

-- One assignment per employee per module, so auto-sync can upsert safely
ALTER TABLE public.training_assignments
  ADD CONSTRAINT training_assignments_employee_sop_unique UNIQUE (employee_id, sop_id);

-- Seed the 4-category SQF Fundamentals training curriculum
-- required_departments NULL = required for all staff; otherwise limited to listed departments
INSERT INTO public.sop_documents (title, type, category, status, training_category, module_number, is_annual_refresher, required_departments) VALUES
  ('Food Safety & Quality Commitment', 'sop', 'Core Onboarding', 'active', 1, '1.1', false, NULL),
  ('Personnel Hygiene & Visitor Policy', 'sop', 'Core Onboarding', 'active', 1, '1.2', true, NULL),
  ('Good Manufacturing Practices (GMPs)', 'sop', 'Core Onboarding', 'active', 1, '1.3', false, NULL),
  ('Allergen Management in Shared Spaces', 'sop', 'Core Onboarding', 'active', 1, '1.4', true, NULL),

  ('Food Defense & Site Security', 'sop', 'Safety & Risk Management', 'active', 2, '2.1', true, NULL),
  ('Food Fraud Awareness', 'sop', 'Safety & Risk Management', 'active', 2, '2.2', false, NULL),
  ('Physical Contaminant Control', 'sop', 'Safety & Risk Management', 'active', 2, '2.3', false, NULL),
  ('Recordkeeping & Document Control', 'sop', 'Safety & Risk Management', 'active', 2, '2.4', false, NULL),

  ('The Mixing Station', 'sop', 'Job-Specific Operations', 'active', 3, '3.1', false, ARRAY['Production']),
  ('The Weighing Station', 'sop', 'Job-Specific Operations', 'active', 3, '3.2', false, ARRAY['Production']),
  ('Kook-E-King Depositor', 'sop', 'Job-Specific Operations', 'active', 3, '3.3', false, ARRAY['Production']),
  ('Kill-Step Monitoring (Ovens)', 'sop', 'Job-Specific Operations', 'active', 3, '3.4', false, ARRAY['Production']),
  ('Finished Product Testing', 'sop', 'Job-Specific Operations', 'active', 3, '3.5', false, ARRAY['Production', 'Quality Control']),
  ('Vegan Meat Alternative Processing', 'sop', 'Job-Specific Operations', 'active', 3, '3.6', false, ARRAY['Production']),

  ('Traceability & Recall', 'sop', 'Response Protocols', 'active', 4, '4.1', true, NULL),
  ('Complaint Handling & Non-Conformance', 'sop', 'Response Protocols', 'active', 4, '4.2', false, NULL),
  ('Crisis Management', 'sop', 'Response Protocols', 'active', 4, '4.3', false, NULL);

-- Admins can read/manage all assignments (Training Compliance dashboard + assigning modules)
CREATE POLICY "Admins read all training_assignments"
  ON public.training_assignments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Admins insert training_assignments for anyone"
  ON public.training_assignments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- Employees can update their own assignment to mark complete/sign
CREATE POLICY "Employees update own training_assignments"
  ON public.training_assignments FOR UPDATE TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- Admins can update any assignment
CREATE POLICY "Admins update training_assignments"
  ON public.training_assignments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- ===========================================================================
-- Automatic training assignment based on module requirements + employee
-- department. No manual "assign" step: every staff/admin/owner gets an
-- assignment for every active module where required_departments is NULL
-- (everyone) or contains their department.
-- ===========================================================================

-- Sync assignments for one employee (call when their department changes)
CREATE OR REPLACE FUNCTION public.sync_employee_training(p_employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department text;
BEGIN
  IF NOT public.is_staff_or_admin(p_employee_id) THEN
    RETURN;
  END IF;

  SELECT department INTO v_department FROM public.profiles WHERE id = p_employee_id;

  INSERT INTO public.training_assignments (employee_id, sop_id, recurrence_months, due_at)
  SELECT
    p_employee_id,
    sd.id,
    CASE WHEN sd.is_annual_refresher THEN 12 ELSE NULL END,
    (now() + interval '30 days')::date
  FROM public.sop_documents sd
  WHERE sd.training_category IS NOT NULL
    AND sd.status = 'active'
    AND (sd.required_departments IS NULL OR v_department = ANY(sd.required_departments))
  ON CONFLICT (employee_id, sop_id) DO NOTHING;
END;
$$;

-- Sync assignments for one module across all employees (call when requirements change)
CREATE OR REPLACE FUNCTION public.sync_module_training(p_sop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.training_assignments (employee_id, sop_id, recurrence_months, due_at)
  SELECT
    p.id,
    sd.id,
    CASE WHEN sd.is_annual_refresher THEN 12 ELSE NULL END,
    (now() + interval '30 days')::date
  FROM public.sop_documents sd
  JOIN public.profiles p ON true
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role IN ('staff', 'admin', 'owner')
  WHERE sd.id = p_sop_id
    AND sd.training_category IS NOT NULL
    AND sd.status = 'active'
    AND (sd.required_departments IS NULL OR p.department = ANY(sd.required_departments))
  ON CONFLICT (employee_id, sop_id) DO NOTHING;
END;
$$;

-- Trigger: when an employee's department changes, sync their assignments
CREATE OR REPLACE FUNCTION public.trg_sync_training_on_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.department IS DISTINCT FROM OLD.department THEN
    PERFORM public.sync_employee_training(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_training_on_profile_change ON public.profiles;
CREATE TRIGGER sync_training_on_profile_change
  AFTER INSERT OR UPDATE OF department ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_training_on_profile_change();

-- Trigger: when a module's category/requirements/status change, sync all employees
CREATE OR REPLACE FUNCTION public.trg_sync_training_on_module_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.training_category IS NOT NULL AND NEW.status = 'active' THEN
    PERFORM public.sync_module_training(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_training_on_module_change ON public.sop_documents;
CREATE TRIGGER sync_training_on_module_change
  AFTER INSERT OR UPDATE OF training_category, required_departments, status ON public.sop_documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_training_on_module_change();

-- Backfill: sync existing employees against the seeded modules
DO $$
DECLARE
  v_employee_id uuid;
BEGIN
  FOR v_employee_id IN
    SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('staff', 'admin', 'owner')
  LOOP
    PERFORM public.sync_employee_training(v_employee_id);
  END LOOP;
END;
$$;
