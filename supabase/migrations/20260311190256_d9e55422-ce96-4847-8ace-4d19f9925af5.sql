
-- =============================================
-- 1. LOCK DOWN client_invitations
-- =============================================
-- Remove the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public can read invitation by token" ON public.client_invitations;

-- Create a restrictive policy: only staff/admin can read invitations
-- (The accept-invite page will use an RPC function instead)
CREATE POLICY "Only staff can view invitations"
ON public.client_invitations
FOR SELECT
TO authenticated
USING (public.is_staff_or_admin(auth.uid()));

-- =============================================
-- 2. Create RPC for token validation (used by accept-invite page)
-- =============================================
CREATE OR REPLACE FUNCTION public.validate_invitation_token(_token text)
RETURNS TABLE(email text, expired boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ci.email,
    (ci.expires_at < now() OR ci.accepted_at IS NOT NULL) AS expired
  FROM public.client_invitations ci
  WHERE ci.token = _token
  LIMIT 1;
$$;

-- =============================================
-- 3. LOCK DOWN internal_notifications
-- =============================================
-- Drop all existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can create notifications" ON public.internal_notifications;
DROP POLICY IF EXISTS "Authenticated users can view notifications" ON public.internal_notifications;
DROP POLICY IF EXISTS "Authenticated users can update notifications" ON public.internal_notifications;

-- Only staff/admin can INSERT notifications
CREATE POLICY "Only staff can create notifications"
ON public.internal_notifications
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff_or_admin(auth.uid()));

-- Only staff/admin can SELECT notifications
CREATE POLICY "Only staff can view notifications"
ON public.internal_notifications
FOR SELECT
TO authenticated
USING (public.is_staff_or_admin(auth.uid()));

-- Only staff/admin can UPDATE notifications
CREATE POLICY "Only staff can update notifications"
ON public.internal_notifications
FOR UPDATE
TO authenticated
USING (public.is_staff_or_admin(auth.uid()));

-- =============================================
-- 4. Secure manufacturing-coach: set verify_jwt = true in config.toml
-- (handled separately in code)
-- =============================================
