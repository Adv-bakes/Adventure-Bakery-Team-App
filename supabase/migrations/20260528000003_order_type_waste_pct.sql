ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'jit',
  ADD COLUMN IF NOT EXISTS waste_pct numeric NOT NULL DEFAULT 10;
