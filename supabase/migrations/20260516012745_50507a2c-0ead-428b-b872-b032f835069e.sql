-- Document review tracking
ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS review_notes jsonb,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

CREATE INDEX IF NOT EXISTS idx_client_docs_review
  ON public.client_documents (review_status, document_type);

-- Existing rows: treat them as approved so they don't flood the inbox
UPDATE public.client_documents
SET review_status = 'approved'
WHERE review_status IS NULL OR review_status = 'pending';

-- Link PRF to the concept it spawned
ALTER TABLE public.prf_submissions ADD COLUMN IF NOT EXISTS concept_id bigint;
CREATE INDEX IF NOT EXISTS idx_prf_concept ON public.prf_submissions (concept_id);

-- Batch sheets, derived from PSS, internal-only
CREATE TABLE IF NOT EXISTS public.batch_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pss_document_id text UNIQUE,
  concept_id bigint,
  lead_id uuid,
  client_user_id uuid,
  status text NOT NULL DEFAULT 'draft',
  data_json jsonb,
  generated_from text DEFAULT 'pss',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.batch_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff/admin all batch_sheets" ON public.batch_sheets;
CREATE POLICY "Staff/admin all batch_sheets" ON public.batch_sheets
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_batch_sheets_touch ON public.batch_sheets;
CREATE TRIGGER trg_batch_sheets_touch BEFORE UPDATE ON public.batch_sheets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();