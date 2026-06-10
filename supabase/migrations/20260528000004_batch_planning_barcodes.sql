
-- ─── Batch planning fields on production_orders ───────────────────────────────
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS batch_count    integer,
  ADD COLUMN IF NOT EXISTS batch_size_lbs numeric;

-- ─── Relax production_batches constraints for planned (pre-run) batches ────────
-- lot_code is assigned day-of on the station card, not at planning time
ALTER TABLE public.production_batches ALTER COLUMN lot_code DROP NOT NULL;

-- Remove the 110 lbs upper limit — batch size varies by product
ALTER TABLE public.production_batches
  DROP CONSTRAINT IF EXISTS production_batches_target_batch_size_lbs_check;
ALTER TABLE public.production_batches
  ADD CONSTRAINT production_batches_batch_size_positive
  CHECK (target_batch_size_lbs > 0);

-- ─── batch_measuring_sessions: add batch_sheet_id so multi-product orders ──────
-- can have separate measuring sessions per product
ALTER TABLE public.batch_measuring_sessions
  ADD COLUMN IF NOT EXISTS batch_sheet_id uuid REFERENCES public.batch_sheets(id) ON DELETE SET NULL;

-- ─── ingredient_barcodes: barcode → brand + ingredient name lookup ─────────────
CREATE TABLE IF NOT EXISTS public.ingredient_barcodes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode         text        UNIQUE NOT NULL,
  brand_name      text        NOT NULL DEFAULT '',
  ingredient_name text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ingredient_barcodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff/admin all ingredient_barcodes" ON public.ingredient_barcodes;
CREATE POLICY "Staff/admin all ingredient_barcodes"
  ON public.ingredient_barcodes FOR ALL TO authenticated
  USING (is_staff_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS ingredient_barcodes_barcode_idx ON public.ingredient_barcodes(barcode);
