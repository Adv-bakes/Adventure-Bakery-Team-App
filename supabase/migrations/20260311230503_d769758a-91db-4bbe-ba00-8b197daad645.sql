
-- Add versioning columns to concepts
ALTER TABLE public.concepts 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS parent_concept_id bigint REFERENCES public.concepts(id),
  ADD COLUMN IF NOT EXISTS revision_number text;

-- Staff can insert concepts for clients
CREATE POLICY "Staff can insert concepts for clients"
  ON public.concepts FOR INSERT TO authenticated
  WITH CHECK (is_staff_or_admin(auth.uid()));

-- Staff can update all concepts
CREATE POLICY "Staff can update all concepts"
  ON public.concepts FOR UPDATE TO authenticated
  USING (is_staff_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()));

-- Staff can insert products for clients
CREATE POLICY "Staff can insert products for clients"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (is_staff_or_admin(auth.uid()));

-- Staff can update all products
CREATE POLICY "Staff can update all products"
  ON public.products FOR UPDATE TO authenticated
  USING (is_staff_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()));

-- Staff can insert formulas for clients
CREATE POLICY "Staff can insert formulas for clients"
  ON public.formulas FOR INSERT TO authenticated
  WITH CHECK (is_staff_or_admin(auth.uid()));

-- Staff can update all formulas
CREATE POLICY "Staff can update all formulas"
  ON public.formulas FOR UPDATE TO authenticated
  USING (is_staff_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()));

-- Staff can insert packaging for clients
CREATE POLICY "Staff can insert packaging for clients"
  ON public.packaging FOR INSERT TO authenticated
  WITH CHECK (is_staff_or_admin(auth.uid()));

-- Staff can update all packaging
CREATE POLICY "Staff can update all packaging"
  ON public.packaging FOR UPDATE TO authenticated
  USING (is_staff_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()));
