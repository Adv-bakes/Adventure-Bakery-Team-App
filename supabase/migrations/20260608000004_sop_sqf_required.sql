ALTER TABLE public.sop_documents
  ADD COLUMN IF NOT EXISTS sqf_required boolean NOT NULL DEFAULT false;
