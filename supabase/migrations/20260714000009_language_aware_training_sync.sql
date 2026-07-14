-- Language-aware training assignment sync.
--
-- Replaces the sync functions from 20260610000001_training_modules.sql so that
-- a Spanish-preferring employee (profiles.preferred_language = 'es') is assigned
-- the Spanish variant of a module when an active translation exists, otherwise
-- English. English-preferring employees only ever get English.
--
-- Data model: EN and ES are separate sop_documents rows sharing a module_number;
-- the ES row's title ends with "(ES)". The EN row remains the single assignable
-- unit (carries training_category / required_departments); the ES row is a
-- content variant substituted at assignment time. ES rows are never
-- independently auto-assigned.
--
-- Preference changes RE-LANGUAGE not-yet-started assignments (delete the
-- wrong-language row, insert the right one) but never touch started/completed
-- training, and never create a duplicate in the other language for a module the
-- employee already started or completed.

-- ---------------------------------------------------------------------------
-- Per-employee sync (called on employee insert, department change, language
-- change, and when an ES translation is (de)activated).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_employee_training(p_employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department text;
  v_pref       text;
BEGIN
  IF NOT public.is_staff_or_admin(p_employee_id) THEN
    RETURN;
  END IF;

  SELECT department, COALESCE(preferred_language, 'en')
    INTO v_department, v_pref
  FROM public.profiles WHERE id = p_employee_id;

  -- Re-language: drop not-started assignments that are the wrong language for
  -- the current preference. Started (progress) or completed rows are preserved.
  IF v_pref = 'es' THEN
    -- Prefers ES: drop EN rows that have an active ES translation.
    DELETE FROM public.training_assignments ta
    USING public.sop_documents en
    WHERE ta.employee_id = p_employee_id
      AND ta.completed_at IS NULL
      AND ta.progress IS NULL
      AND ta.sop_id = en.id
      AND en.title NOT LIKE '%(ES)%'
      AND en.module_number IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.sop_documents es
        WHERE es.status = 'active'
          AND es.title LIKE '%(ES)%'
          AND es.module_number = en.module_number
      );
  ELSE
    -- Prefers EN: drop any ES-variant rows.
    DELETE FROM public.training_assignments ta
    USING public.sop_documents es
    WHERE ta.employee_id = p_employee_id
      AND ta.completed_at IS NULL
      AND ta.progress IS NULL
      AND ta.sop_id = es.id
      AND es.title LIKE '%(ES)%';
  END IF;

  -- Grant assignments. Iterate only EN (non-"(ES)") training modules; substitute
  -- the ES sibling when the employee prefers Spanish and one is active. Skip
  -- module families the employee already started/completed in either language.
  INSERT INTO public.training_assignments (employee_id, sop_id, recurrence_months, due_at)
  SELECT
    p_employee_id,
    COALESCE(es.id, en.id),
    CASE WHEN en.is_annual_refresher THEN 12 ELSE NULL END,
    (now() + interval '30 days')::date
  FROM public.sop_documents en
  LEFT JOIN LATERAL (
    SELECT e.id
    FROM public.sop_documents e
    WHERE v_pref = 'es'
      AND e.status = 'active'
      AND e.title LIKE '%(ES)%'
      AND en.module_number IS NOT NULL
      AND e.module_number = en.module_number
    LIMIT 1
  ) es ON true
  WHERE en.training_category IS NOT NULL
    AND en.status = 'active'
    AND en.title NOT LIKE '%(ES)%'
    AND (en.required_departments IS NULL OR v_department = ANY(en.required_departments))
    AND NOT EXISTS (
      SELECT 1
      FROM public.training_assignments ta2
      JOIN public.sop_documents sd2 ON sd2.id = ta2.sop_id
      WHERE ta2.employee_id = p_employee_id
        AND (ta2.completed_at IS NOT NULL OR ta2.progress IS NOT NULL)
        AND sd2.module_number = en.module_number
    )
  ON CONFLICT (employee_id, sop_id) DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------------
-- Per-module sync across all staff (called when an EN module's
-- category/requirements/status change). Applies the same language substitution.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_module_training(p_sop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_es boolean;
BEGIN
  SELECT (title LIKE '%(ES)%') INTO v_is_es
  FROM public.sop_documents WHERE id = p_sop_id;

  -- ES variants are resolved via their EN sibling, never assigned directly.
  IF v_is_es IS NOT FALSE THEN
    RETURN;
  END IF;

  INSERT INTO public.training_assignments (employee_id, sop_id, recurrence_months, due_at)
  SELECT
    p.id,
    COALESCE(es.id, en.id),
    CASE WHEN en.is_annual_refresher THEN 12 ELSE NULL END,
    (now() + interval '30 days')::date
  FROM public.sop_documents en
  JOIN public.profiles p ON true
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role IN ('staff', 'admin', 'owner')
  LEFT JOIN LATERAL (
    SELECT e.id
    FROM public.sop_documents e
    WHERE p.preferred_language = 'es'
      AND e.status = 'active'
      AND e.title LIKE '%(ES)%'
      AND en.module_number IS NOT NULL
      AND e.module_number = en.module_number
    LIMIT 1
  ) es ON true
  WHERE en.id = p_sop_id
    AND en.training_category IS NOT NULL
    AND en.status = 'active'
    AND (en.required_departments IS NULL OR p.department = ANY(en.required_departments))
    AND NOT EXISTS (
      SELECT 1
      FROM public.training_assignments ta2
      JOIN public.sop_documents sd2 ON sd2.id = ta2.sop_id
      WHERE ta2.employee_id = p.id
        AND (ta2.completed_at IS NOT NULL OR ta2.progress IS NOT NULL)
        AND sd2.module_number = en.module_number
    )
  ON CONFLICT (employee_id, sop_id) DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------------
-- Profile trigger: re-sync when department OR preferred_language changes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sync_training_on_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.preferred_language IS DISTINCT FROM OLD.preferred_language THEN
    PERFORM public.sync_employee_training(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_training_on_profile_change ON public.profiles;
CREATE TRIGGER sync_training_on_profile_change
  AFTER INSERT OR UPDATE OF department, preferred_language ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_training_on_profile_change();

-- ---------------------------------------------------------------------------
-- Module trigger: EN module changes → targeted sync_module_training; ES variant
-- (de)activation → re-language only Spanish-preferring staff (not-started rows).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sync_training_on_module_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
BEGIN
  IF NEW.status = 'active' AND NEW.title LIKE '%(ES)%' AND NEW.module_number IS NOT NULL THEN
    FOR v_emp IN
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role IN ('staff', 'admin', 'owner')
        AND p.preferred_language = 'es'
    LOOP
      PERFORM public.sync_employee_training(v_emp);
    END LOOP;
  ELSIF NEW.training_category IS NOT NULL AND NEW.status = 'active' THEN
    PERFORM public.sync_module_training(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_training_on_module_change ON public.sop_documents;
CREATE TRIGGER sync_training_on_module_change
  AFTER INSERT OR UPDATE OF training_category, required_departments, status, title, module_number ON public.sop_documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_training_on_module_change();
