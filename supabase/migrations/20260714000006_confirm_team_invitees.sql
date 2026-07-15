-- Auto-confirm team-invited users' email on invite acceptance.
--
-- The project requires email confirmation, but invited team members often use
-- internal addresses that can't receive the confirmation mail — so they set a
-- password via the accept-invite link, then can't sign in ("Email not
-- confirmed"). The admin's invitation IS the identity verification here, so we
-- confirm the email as part of accepting a TEAM invite. Public/brand self-serve
-- signups are unaffected (they never call this function).

-- 1. Re-create accept_team_invitation (latest body from 20260714000004) with an
--    added auth.users email-confirmation step.
CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token text, _user_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role text;
  v_department text;
  v_email text;
BEGIN
  SELECT role, department, email INTO v_role, v_department, v_email
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

  INSERT INTO public.profiles (id, department, email, access_granted)
  VALUES (_user_id, NULLIF(v_department, ''), v_email, true)
  ON CONFLICT (id) DO UPDATE
    SET department      = COALESCE(EXCLUDED.department, public.profiles.department),
        email           = COALESCE(NULLIF(TRIM(public.profiles.email), ''), EXCLUDED.email),
        access_granted  = true;

  -- The invite is the identity verification: confirm the email so the user can
  -- sign in without a confirmation mail. No-op if already confirmed.
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = _user_id;

  RETURN COALESCE(v_role, 'staff');
END;
$$;
REVOKE ALL ON FUNCTION public.accept_team_invitation(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text, uuid) TO anon, authenticated;

-- 2. Backfill: confirm users who already accepted a team invite but were left
--    unconfirmed by the old flow (e.g. auditor@adventurebakes.com).
UPDATE auth.users u
SET email_confirmed_at = now()
FROM public.client_invitations ci
WHERE ci.invite_kind = 'team'
  AND ci.accepted_at IS NOT NULL
  AND lower(ci.email) = lower(u.email)
  AND u.email_confirmed_at IS NULL;
