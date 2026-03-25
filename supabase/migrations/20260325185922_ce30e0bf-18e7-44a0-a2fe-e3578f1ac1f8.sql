CREATE TABLE public.prf_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new',
  company_stage text NOT NULL,
  founder_name text,
  company_name text,
  email text,
  phone text,
  project_type text,
  product_name text,
  development_approach text,
  finished_form jsonb DEFAULT '[]',
  is_nutraceutical boolean DEFAULT false,
  flavor_type text,
  intended_application jsonb DEFAULT '[]',
  additional_requirements jsonb DEFAULT '[]',
  packaging_readiness text,
  primary_packaging_vessel text,
  primary_packaging_other text,
  weight_per_unit text,
  weight_per_unit_unit text,
  unit_dimension_l text,
  unit_dimension_w text,
  unit_dimension_h text,
  unit_dimension_unit text,
  units_per_primary_pack text,
  net_weight_per_primary_pack text,
  net_weight_per_primary_pack_unit text,
  secondary_packaging text,
  secondary_packaging_other text,
  units_per_vessel text,
  artwork_readiness text,
  label_responsibility text,
  master_carton_requirements text,
  pallets_required text,
  shipping_tbd boolean DEFAULT false,
  target_date text,
  price_target_per_unit text,
  annual_volume text,
  order_quantity text,
  order_frequency text,
  warehousing_needs jsonb DEFAULT '[]',
  additional_project_info text,
  stage2_submission_id uuid
);

ALTER TABLE public.prf_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit PRF" ON public.prf_submissions
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Staff can view all PRFs" ON public.prf_submissions
  FOR SELECT TO authenticated USING (is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff can update PRFs" ON public.prf_submissions
  FOR UPDATE TO authenticated USING (is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff can delete PRFs" ON public.prf_submissions
  FOR DELETE TO authenticated USING (is_staff_or_admin(auth.uid()));