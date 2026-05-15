-- Phase 0: Owner role + sales pipeline columns

-- 1. Add 'owner' as a valid role (column is text, no enum to alter)
-- Promote any existing admin user to owner if there's exactly one
-- We won't auto-promote here — must be done manually per security policy.

-- 2. Sales pipeline stage on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sales_stage text DEFAULT 'Lead In',
  ADD COLUMN IF NOT EXISTS sales_stage_updated_at timestamptz DEFAULT now();

-- 3. Update has_role to recognize 'owner' as implicit admin (owner ⊇ admin ⊇ staff for visibility)
-- Add convenience function
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'owner'
  );
$$;

-- 4. Treat owner as staff/admin for existing RLS gates
CREATE OR REPLACE FUNCTION public.is_staff_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'staff', 'owner')
  );
$$;