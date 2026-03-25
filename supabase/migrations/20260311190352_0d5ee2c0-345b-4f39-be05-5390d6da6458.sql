
-- RPC to accept an invitation: marks it accepted and grants profile access
-- Uses SECURITY DEFINER so the newly-created user can update the invitation row
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark invitation as accepted (only if not already accepted and not expired)
  UPDATE public.client_invitations
  SET accepted_at = now()
  WHERE token = _token
    AND accepted_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Grant access on the user's profile
  UPDATE public.profiles
  SET access_granted = true
  WHERE id = _user_id;

  -- Assign 'user' role if not already assigned
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$$;
