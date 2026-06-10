
-- ─── production_orders: deposit gate + order number ───────────────────────────
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS deposit_confirmed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_confirmed_by  uuid,
  ADD COLUMN IF NOT EXISTS order_number          text;

-- Auto-generate order numbers: ORD-YYYYMMDD-NNN (unique per day)
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq;

-- ─── production_batches: station card session columns ─────────────────────────
ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS mixing_session_date      date,
  ADD COLUMN IF NOT EXISTS mixing_completed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS mixing_completed_by      uuid,
  ADD COLUMN IF NOT EXISTS depositing_session_date  date,
  ADD COLUMN IF NOT EXISTS depositing_completed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS depositing_completed_by  uuid,
  ADD COLUMN IF NOT EXISTS oven_temp_out            numeric,
  ADD COLUMN IF NOT EXISTS packaging_session_date   date,
  ADD COLUMN IF NOT EXISTS packaging_completed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS packaging_completed_by   uuid,
  ADD COLUMN IF NOT EXISTS packaging_cases_total    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_loose_units    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_trips_json     jsonb   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS qc_completed             boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS qc_notes                text;

-- ─── batch_measuring_sessions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.batch_measuring_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid REFERENCES public.production_orders(id) ON DELETE CASCADE,
  batch_ids     uuid[]  NOT NULL DEFAULT '{}',
  session_date  date    NOT NULL DEFAULT CURRENT_DATE,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.batch_measuring_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff/admin all batch_measuring_sessions" ON public.batch_measuring_sessions;
CREATE POLICY "Staff/admin all batch_measuring_sessions"
  ON public.batch_measuring_sessions FOR ALL TO authenticated
  USING (is_staff_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()));

-- ─── batch_measuring_entries ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.batch_measuring_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid REFERENCES public.batch_measuring_sessions(id) ON DELETE CASCADE,
  batch_id            uuid REFERENCES public.production_batches(id) ON DELETE CASCADE,
  group_name          text,
  ingredient_name     text NOT NULL,
  ingredient_brand    text,
  ingredient_lot_code text,
  target_weight_lbs   numeric,
  actual_weight_lbs   numeric,
  measured_by         uuid,
  measured_by_name    text,
  measured_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.batch_measuring_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff/admin all batch_measuring_entries" ON public.batch_measuring_entries;
CREATE POLICY "Staff/admin all batch_measuring_entries"
  ON public.batch_measuring_entries FOR ALL TO authenticated
  USING (is_staff_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS batch_measuring_entries_session_idx  ON public.batch_measuring_entries(session_id);
CREATE INDEX IF NOT EXISTS batch_measuring_entries_batch_idx    ON public.batch_measuring_entries(batch_id);

-- ─── finished_goods_inventory ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finished_goods_inventory (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  product_name     text NOT NULL,
  lot_codes        text[] NOT NULL DEFAULT '{}',
  qty_units        integer NOT NULL DEFAULT 0,
  qty_cases        integer NOT NULL DEFAULT 0,
  received_date    date NOT NULL DEFAULT CURRENT_DATE,
  warehouse_id     uuid REFERENCES public.ab_warehouses(id) ON DELETE SET NULL,
  shipped_at       timestamptz,
  ship_carrier     text,
  tracking_number  text,
  bol_number       text,
  shipping_arranged_by  text CHECK (shipping_arranged_by IN ('client', 'ab')),
  shipping_surcharge    numeric,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finished_goods_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff/admin all finished_goods_inventory" ON public.finished_goods_inventory;
CREATE POLICY "Staff/admin all finished_goods_inventory"
  ON public.finished_goods_inventory FOR ALL TO authenticated
  USING (is_staff_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()));
