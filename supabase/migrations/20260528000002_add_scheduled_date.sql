ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS scheduled_date date;
