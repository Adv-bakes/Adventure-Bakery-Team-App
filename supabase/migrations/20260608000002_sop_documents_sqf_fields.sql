ALTER TABLE public.sop_documents
  ADD COLUMN sqf_required boolean NOT NULL DEFAULT false,
  ADD COLUMN sqf_section text;
