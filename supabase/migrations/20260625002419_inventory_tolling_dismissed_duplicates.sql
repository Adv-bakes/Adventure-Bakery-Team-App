-- Persists "Not a duplicate" decisions from the Tolling Inventory duplicate-review tool
-- so dismissed pairs don't keep reappearing every time the dialog reopens.
CREATE TABLE public.inventory_tolling_dismissed_duplicates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  name_a text NOT NULL,
  name_b text NOT NULL,
  dismissed_by uuid,
  dismissed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_tolling_dismissed_duplicates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff/admin all inventory_tolling_dismissed_duplicates" ON public.inventory_tolling_dismissed_duplicates
  FOR ALL TO authenticated USING (is_staff_or_admin(auth.uid())) WITH CHECK (is_staff_or_admin(auth.uid()));

CREATE UNIQUE INDEX idx_tolling_dismissed_unique ON public.inventory_tolling_dismissed_duplicates(client_id, name_a, name_b);
