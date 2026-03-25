
-- profiles: add staff-specific columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

-- products: add packaging hierarchy columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS raw_fill_weight numeric,
  ADD COLUMN IF NOT EXISTS raw_fill_weight_unit text,
  ADD COLUMN IF NOT EXISTS units_per_pack integer,
  ADD COLUMN IF NOT EXISTS units_per_caddy integer,
  ADD COLUMN IF NOT EXISTS units_per_shipper integer,
  ADD COLUMN IF NOT EXISTS cases_per_pallet integer;
