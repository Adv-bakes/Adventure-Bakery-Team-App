-- Self-serve TEAM invitations. Reuses the existing client_invitations table +
-- accept-invite page, but carries a team role + department to provision on
-- acceptance. Brand (client) invites are unchanged: rows default invite_kind
-- 'client' and still flow through accept_invitation().

ALTER TABLE public.client_invitations
  ADD COLUMN IF NOT EXISTS invite_kind text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS department text;

-- validate_invitation_token now also surfaces the kind/role/department so the
-- accept page can render the right portal and call the right accept RPC.
-- (DROP first — the RETURN signature changes; CREATE OR REPLACE can't widen it.)
DROP FUNCTION IF EXISTS public.validate_invitation_token(text);
CREATE FUNCTION public.validate_invitation_token(_token text)
RETURNS TABLE(email text, expired boolean, invite_kind text, role text, department text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    ci.email,
    (ci.expires_at < now() OR ci.accepted_at IS NOT NULL) AS expired,
    COALESCE(ci.invite_kind, 'client') AS invite_kind,
    ci.role,
    ci.department
  FROM public.client_invitations ci
  WHERE ci.token = _token
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.validate_invitation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(text) TO anon, authenticated;

-- Create a team invitation. Admin/owner only, with the same escalation guard as
-- the user_roles write policies: only an owner may invite an owner or admin.
-- Returns the invitation token (the caller builds the accept-invite URL).
CREATE OR REPLACE FUNCTION public.create_team_invitation(_email text, _role text, _department text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins or owners can invite team members';
  END IF;
  IF _role NOT IN ('owner', 'admin', 'staff', 'auditor', 'user') THEN
    RAISE EXCEPTION 'Invalid role: %', _role;
  END IF;
  IF _role IN ('owner', 'admin') AND NOT public.is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only an owner can invite an owner or admin';
  END IF;

  INSERT INTO public.client_invitations (email, invited_by, invite_kind, role, department)
  VALUES (lower(trim(_email)), auth.uid(), 'team', _role, NULLIF(trim(_department), ''))
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.create_team_invitation(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_team_invitation(text, text, text) TO authenticated;

-- Accept a team invitation (called by the accept-invite page right after the
-- invitee signs up). Marks it accepted, grants the invited role, and sets the
-- department — which fires the training auto-assign trigger. The role was
-- validated at creation time, so this runs as SECURITY DEFINER for the new
-- (non-admin) user. Returns the granted role, or NULL if the token is invalid.
CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token text, _user_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role text;
  v_department text;
BEGIN
  SELECT role, department INTO v_role, v_department
  FROM public.client_invitations
  WHERE token = _token
    AND invite_kind = 'team'
    AND accepted_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.client_invitations SET accepted_at = now() WHERE token = _token;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, COALESCE(v_role, 'staff'))
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.profiles
  SET department = COALESCE(v_department, department),
      access_granted = true
  WHERE id = _user_id;

  RETURN COALESCE(v_role, 'staff');
END;
$$;
REVOKE ALL ON FUNCTION public.accept_team_invitation(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text, uuid) TO anon, authenticated;
