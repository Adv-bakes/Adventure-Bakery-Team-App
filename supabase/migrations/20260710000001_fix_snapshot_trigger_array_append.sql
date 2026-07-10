-- Fixes "malformed array literal" errors when saving an active form's
-- content.form_schema (e.g. FRM-002). The original snapshot_sop_document()
-- built changed_fields with `changed || 'form_schema'` etc. — text[] || text
-- is ambiguous in Postgres between "append element" (array_append) and
-- "concatenate two arrays" (array_cat); when it resolves to array_cat, the
-- bare string literal gets parsed as array-literal syntax ('{...}') and
-- fails since it isn't wrapped that way. array_append() is unambiguous.
CREATE OR REPLACE FUNCTION public.snapshot_sop_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed text[] := '{}';
BEGIN
  IF OLD.revision       IS DISTINCT FROM NEW.revision       THEN changed := array_append(changed, 'revision'); END IF;
  IF OLD.sop_number     IS DISTINCT FROM NEW.sop_number     THEN changed := array_append(changed, 'sop_number'); END IF;
  IF OLD.title          IS DISTINCT FROM NEW.title          THEN changed := array_append(changed, 'title'); END IF;
  IF OLD.effective_date IS DISTINCT FROM NEW.effective_date THEN changed := array_append(changed, 'effective_date'); END IF;
  IF OLD.approved_by    IS DISTINCT FROM NEW.approved_by    THEN changed := array_append(changed, 'approved_by'); END IF;
  IF OLD.status         IS DISTINCT FROM NEW.status         THEN changed := array_append(changed, 'status'); END IF;
  IF (OLD.content -> 'form_schema') IS DISTINCT FROM (NEW.content -> 'form_schema')
                                                            THEN changed := array_append(changed, 'form_schema'); END IF;

  IF array_length(changed, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.sop_document_history (document_id, revision, changed_fields, snapshot, changed_by)
  VALUES (OLD.id, OLD.revision, changed, to_jsonb(OLD), auth.uid());
  RETURN NEW;
END;
$$;
