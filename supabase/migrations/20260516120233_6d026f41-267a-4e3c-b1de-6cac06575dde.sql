-- ============================================
-- TABLE: document_templates (master NDA + PSS workbook files)
-- ============================================
CREATE TABLE public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('nda', 'pss_workbook')),
  version int NOT NULL DEFAULT 1,
  file_path text NOT NULL,
  file_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE UNIQUE INDEX document_templates_one_active_per_kind
  ON public.document_templates (kind)
  WHERE is_active = true;

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff/admin manage document_templates"
  ON public.document_templates FOR ALL
  TO authenticated
  USING (is_staff_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()));

-- ============================================
-- TABLE: pss_submissions (drafts + submitted PSS forms)
-- ============================================
CREATE TABLE public.pss_submissions (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  lead_id uuid NOT NULL,
  profile_id uuid,
  prospect_email text NOT NULL,
  draft_token text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  product_label text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pss_submissions_lead_id_idx ON public.pss_submissions (lead_id);
CREATE INDEX pss_submissions_token_idx ON public.pss_submissions (draft_token);

ALTER TABLE public.pss_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff/admin read pss_submissions"
  ON public.pss_submissions FOR SELECT
  TO authenticated
  USING (is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff/admin update pss_submissions"
  ON public.pss_submissions FOR UPDATE
  TO authenticated
  USING (is_staff_or_admin(auth.uid()));

CREATE TRIGGER pss_submissions_touch
  BEFORE UPDATE ON public.pss_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================
-- TABLE: document_send_tokens (magic link tokens for prospect email)
-- ============================================
CREATE TABLE public.document_send_tokens (
  token text PRIMARY KEY,
  lead_id uuid NOT NULL,
  prospect_email text NOT NULL,
  contact_name text,
  company_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  last_opened_at timestamptz
);

CREATE INDEX document_send_tokens_lead_id_idx ON public.document_send_tokens (lead_id);

ALTER TABLE public.document_send_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff/admin read document_send_tokens"
  ON public.document_send_tokens FOR SELECT
  TO authenticated
  USING (is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff/admin insert document_send_tokens"
  ON public.document_send_tokens FOR INSERT
  TO authenticated
  WITH CHECK (is_staff_or_admin(auth.uid()));

-- ============================================
-- STORAGE BUCKET: document-templates (private)
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-templates', 'document-templates', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff/admin read document-templates objects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'document-templates' AND is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff/admin write document-templates objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'document-templates' AND is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff/admin update document-templates objects"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'document-templates' AND is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff/admin delete document-templates objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'document-templates' AND is_staff_or_admin(auth.uid()));

-- ============================================
-- RPCs (SECURITY DEFINER, used by anon prospects with token only)
-- ============================================

-- Resolve a magic link token → minimal lead info, and stamp last_opened_at.
CREATE OR REPLACE FUNCTION public.validate_send_token(_token text)
RETURNS TABLE(
  valid boolean,
  expired boolean,
  lead_id uuid,
  prospect_email text,
  company_name text,
  contact_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.document_send_tokens%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN QUERY SELECT false, false, NULL::uuid, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT * INTO t FROM public.document_send_tokens WHERE token = _token LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::uuid, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF t.expires_at < now() THEN
    RETURN QUERY SELECT true, true, t.lead_id, t.prospect_email, t.company_name, t.contact_name;
    RETURN;
  END IF;

  UPDATE public.document_send_tokens SET last_opened_at = now() WHERE token = _token;

  RETURN QUERY SELECT true, false, t.lead_id, t.prospect_email, t.company_name, t.contact_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_send_token(text) TO anon, authenticated;

-- Create a new empty PSS draft for a given token (one per product).
-- Returns the new submission id.
CREATE OR REPLACE FUNCTION public.create_pss_draft_for_token(_token text, _product_label text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.document_send_tokens%ROWTYPE;
  new_id text;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO t FROM public.document_send_tokens WHERE token = _token LIMIT 1;
  IF NOT FOUND OR t.expires_at < now() THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.pss_submissions (lead_id, prospect_email, draft_token, status, product_label)
  VALUES (t.lead_id, t.prospect_email, _token, 'draft', _product_label)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pss_draft_for_token(text, text) TO anon, authenticated;

-- List drafts/submissions for a token (so prospect can pick which product to edit).
CREATE OR REPLACE FUNCTION public.list_pss_for_token(_token text)
RETURNS TABLE(
  id text,
  status text,
  product_label text,
  updated_at timestamptz,
  submitted_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT s.id, s.status, s.product_label, s.updated_at, s.submitted_at
  FROM public.pss_submissions s
  WHERE s.draft_token = _token
  ORDER BY s.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_pss_for_token(text) TO anon, authenticated;

-- Read a single draft (anon-safe via token match).
CREATE OR REPLACE FUNCTION public.get_pss_draft_public(_id text, _token text)
RETURNS TABLE(
  id text,
  status text,
  product_label text,
  data_json jsonb,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT s.id, s.status, s.product_label, s.data_json, s.updated_at
  FROM public.pss_submissions s
  WHERE s.id = _id AND s.draft_token = _token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pss_draft_public(text, text) TO anon, authenticated;

-- Autosave a draft.
CREATE OR REPLACE FUNCTION public.save_pss_draft_public(_id text, _token text, _data jsonb, _product_label text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rows_updated int;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN false;
  END IF;
  UPDATE public.pss_submissions
  SET data_json = _data,
      product_label = COALESCE(_product_label, product_label)
  WHERE id = _id
    AND draft_token = _token
    AND status = 'draft';
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_pss_draft_public(text, text, jsonb, text) TO anon, authenticated;

-- Submit a draft (flips status, stamps submitted_at).
CREATE OR REPLACE FUNCTION public.submit_pss_draft_public(_id text, _token text, _data jsonb, _product_label text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rows_updated int;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN false;
  END IF;
  UPDATE public.pss_submissions
  SET data_json = _data,
      product_label = COALESCE(_product_label, product_label),
      status = 'submitted',
      submitted_at = now()
  WHERE id = _id
    AND draft_token = _token
    AND status = 'draft';
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_pss_draft_public(text, text, jsonb, text) TO anon, authenticated;