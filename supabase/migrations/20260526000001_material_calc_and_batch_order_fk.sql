
-- Module 1: Material Calculation result column
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS material_calc_json jsonb;

-- Module 2 prep: link production_batches to a production_order + batch_sheet
ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_sheet_id uuid REFERENCES public.batch_sheets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS production_batches_order_id_idx ON public.production_batches(order_id);
