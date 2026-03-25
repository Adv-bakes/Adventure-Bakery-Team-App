-- 1) Create app_role enum for role-based access
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'user');

-- 2) Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can view roles (prevent enumeration)
CREATE POLICY "Only admins can view roles"
ON public.user_roles
FOR SELECT
USING (false); -- Will use security definer function instead

-- 3) Create security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Helper function to check if user is admin or staff
CREATE OR REPLACE FUNCTION public.is_staff_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'staff')
  )
$$;

-- 4) Fix private_label_requests RLS policies
-- Drop existing permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view private label requests" ON public.private_label_requests;

-- Keep INSERT for public (anon + authenticated)
-- Policy "Anyone can submit private label requests" already exists and is correct

-- Add SELECT only for admin/staff
CREATE POLICY "Only staff can view private label requests"
ON public.private_label_requests
FOR SELECT
USING (public.is_staff_or_admin(auth.uid()));

-- Add UPDATE only for admin/staff
CREATE POLICY "Only staff can update private label requests"
ON public.private_label_requests
FOR UPDATE
USING (public.is_staff_or_admin(auth.uid()));

-- Add DELETE only for admin/staff
CREATE POLICY "Only staff can delete private label requests"
ON public.private_label_requests
FOR DELETE
USING (public.is_staff_or_admin(auth.uid()));

-- 5) Fix stage2_prf_submissions RLS policies
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can read stage2 submissions" ON public.stage2_prf_submissions;
DROP POLICY IF EXISTS "Anyone can update draft stage2 submissions" ON public.stage2_prf_submissions;

-- Keep INSERT for public
-- Policy "Anyone can submit stage2 PRF" already exists and is correct

-- Add SELECT only for admin/staff OR the submitter can see their own draft
CREATE POLICY "Staff or submitter can view stage2 submissions"
ON public.stage2_prf_submissions
FOR SELECT
USING (
  public.is_staff_or_admin(auth.uid())
  OR id::text = current_setting('app.current_submission_id', true)
);

-- UPDATE: Allow submitter to update their own draft, or staff to update any
CREATE POLICY "Submitter can update own draft or staff can update any"
ON public.stage2_prf_submissions
FOR UPDATE
USING (
  (status = 'draft' AND id::text = current_setting('app.current_submission_id', true))
  OR public.is_staff_or_admin(auth.uid())
);

-- DELETE only for admin/staff
CREATE POLICY "Only staff can delete stage2 submissions"
ON public.stage2_prf_submissions
FOR DELETE
USING (public.is_staff_or_admin(auth.uid()));