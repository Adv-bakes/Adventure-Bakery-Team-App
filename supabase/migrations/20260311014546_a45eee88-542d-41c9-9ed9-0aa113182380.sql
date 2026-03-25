
-- 1. Create client_invitations table
CREATE TABLE public.client_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

-- Admin/Staff can manage invitations
CREATE POLICY "Staff can manage invitations"
  ON public.client_invitations
  FOR ALL
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));

-- Anyone can read by token (for accept-invite page)
CREATE POLICY "Public can read invitation by token"
  ON public.client_invitations
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2. Add access_granted column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS access_granted boolean NOT NULL DEFAULT false;

-- 3. Create has_client_access function
CREATE OR REPLACE FUNCTION public.has_client_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT access_granted FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

-- 4. Staff/Admin can SELECT all profiles
CREATE POLICY "Staff can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- 5. Staff/Admin can UPDATE all profiles (for grant/revoke access)
CREATE POLICY "Staff can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));

-- 6. Staff/Admin can read all products
CREATE POLICY "Staff can view all products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- 7. Staff/Admin can read all ingredients
CREATE POLICY "Staff can view all ingredients"
  ON public.ingredients
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- 8. Staff/Admin can read all formulas
CREATE POLICY "Staff can view all formulas"
  ON public.formulas
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- 9. Staff/Admin can read all concepts
CREATE POLICY "Staff can view all concepts"
  ON public.concepts
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- 10. Staff/Admin can read all shelf_life
CREATE POLICY "Staff can view all shelf_life"
  ON public.shelf_life
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- 11. Staff/Admin can read all costing
CREATE POLICY "Staff can view all costing"
  ON public.costing
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- 12. Staff/Admin can read all packaging
CREATE POLICY "Staff can view all packaging"
  ON public.packaging
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- 13. Staff/Admin can read all readiness
CREATE POLICY "Staff can view all readiness"
  ON public.readiness
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- 14. Admin can INSERT user_roles (for invitation flow)
CREATE POLICY "Admin can insert user roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
