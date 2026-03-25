
-- Add PSS/Batch Sheet fields to concepts table
ALTER TABLE public.concepts
  ADD COLUMN IF NOT EXISTS prepared_by text,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS product_appearance text,
  ADD COLUMN IF NOT EXISTS target_shelf_life text,
  ADD COLUMN IF NOT EXISTS baking_temp numeric,
  ADD COLUMN IF NOT EXISTS baking_temp_unit text DEFAULT 'F',
  ADD COLUMN IF NOT EXISTS baking_time_minutes numeric,
  ADD COLUMN IF NOT EXISTS processing_steps jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS nutritional_panel jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS allergen_declaration jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_specs jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS certifications_claims text[] DEFAULT '{}';

-- Add packaging hierarchy fields to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS raw_fill_weight numeric,
  ADD COLUMN IF NOT EXISTS raw_fill_weight_unit text DEFAULT 'oz',
  ADD COLUMN IF NOT EXISTS units_per_pack integer,
  ADD COLUMN IF NOT EXISTS units_per_caddy integer,
  ADD COLUMN IF NOT EXISTS units_per_shipper integer,
  ADD COLUMN IF NOT EXISTS cases_per_pallet integer,
  ADD COLUMN IF NOT EXISTS net_per_pack numeric,
  ADD COLUMN IF NOT EXISTS net_per_pack_unit text DEFAULT 'oz',
  ADD COLUMN IF NOT EXISTS net_per_case numeric,
  ADD COLUMN IF NOT EXISTS net_per_case_unit text DEFAULT 'lbs';

-- Create client_documents table for NDA, PSS, Batch Sheet uploads
CREATE TABLE public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id),
  document_type text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

-- Staff can do everything on client_documents
CREATE POLICY "Staff can manage all client documents"
  ON public.client_documents FOR ALL
  TO authenticated
  USING (is_staff_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()));

-- Users can view their own documents
CREATE POLICY "Users can view their own documents"
  ON public.client_documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "Users can insert their own documents"
  ON public.client_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
