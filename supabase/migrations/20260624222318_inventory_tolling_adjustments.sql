-- Audit trail for Tolling inventory adjustments (Excel imports + physical recounts)
CREATE TABLE public.inventory_tolling_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tolling_id uuid REFERENCES public.inventory_tolling(id) ON DELETE SET NULL,
  client_id uuid NOT NULL,
  ingredient_name text NOT NULL,
  previous_qty numeric NOT NULL,
  counted_qty numeric NOT NULL,
  source text NOT NULL DEFAULT 'recount' CHECK (source IN ('recount', 'excel_import')),
  note text,
  adjusted_by uuid,
  adjusted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_tolling_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff/admin all inventory_tolling_adjustments" ON public.inventory_tolling_adjustments
  FOR ALL TO authenticated USING (is_staff_or_admin(auth.uid())) WITH CHECK (is_staff_or_admin(auth.uid()));

CREATE INDEX idx_tolling_adjustments_client ON public.inventory_tolling_adjustments(client_id);
CREATE INDEX idx_tolling_adjustments_ingredient ON public.inventory_tolling_adjustments(lower(ingredient_name));
