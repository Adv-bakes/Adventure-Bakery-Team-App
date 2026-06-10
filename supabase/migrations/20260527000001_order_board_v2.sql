
-- ─── production_orders: scheduling + payment ──────────────────────────────────
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS target_completion_date  date,
  ADD COLUMN IF NOT EXISTS schedule_confirmed      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_status          text    NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue'));

-- ─── order_stage_events: full stage history with timestamps ───────────────────
CREATE TABLE IF NOT EXISTS public.order_stage_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  stage         text NOT NULL,
  entered_at    timestamptz NOT NULL DEFAULT now(),
  exited_at     timestamptz,
  completed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_stage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff/admin all order_stage_events" ON public.order_stage_events;
CREATE POLICY "Staff/admin all order_stage_events"
  ON public.order_stage_events FOR ALL TO authenticated
  USING (is_staff_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS order_stage_events_order_idx ON public.order_stage_events(order_id);
CREATE INDEX IF NOT EXISTS order_stage_events_stage_idx ON public.order_stage_events(stage);

-- ─── order_station_logs: floor execution traceability (schema only) ───────────
CREATE TABLE IF NOT EXISTS public.order_station_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  station       text NOT NULL,
  started_at    timestamptz,
  completed_at  timestamptz,
  worker_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  inputs        jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_station_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff/admin all order_station_logs" ON public.order_station_logs;
CREATE POLICY "Staff/admin all order_station_logs"
  ON public.order_station_logs FOR ALL TO authenticated
  USING (is_staff_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS order_station_logs_order_idx ON public.order_station_logs(order_id);
