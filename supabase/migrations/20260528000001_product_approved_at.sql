ALTER TABLE public.prf_submissions
  ADD COLUMN IF NOT EXISTS product_approved_at timestamptz;
