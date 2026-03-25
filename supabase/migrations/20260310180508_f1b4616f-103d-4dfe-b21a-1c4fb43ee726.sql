-- Drop the overly restrictive SELECT policy
DROP POLICY IF EXISTS "Only admins can view roles" ON public.user_roles;

-- Allow users to read their own role assignments
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow admins to view all roles (for admin management)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));