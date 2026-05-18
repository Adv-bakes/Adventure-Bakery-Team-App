
-- Allow multiple versions per pss_document_id, ensure only one active version
ALTER TABLE public.batch_sheets DROP CONSTRAINT IF EXISTS batch_sheets_pss_document_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS batch_sheets_active_per_pss
  ON public.batch_sheets (pss_document_id)
  WHERE superseded_at IS NULL AND pss_document_id IS NOT NULL;

ALTER TABLE public.batch_sheets
  ADD COLUMN IF NOT EXISTS source_change text;

COMMENT ON COLUMN public.batch_sheets.source_change IS 'Why this version was created: initial | staff_edit | pss_change | manual_regenerate';
