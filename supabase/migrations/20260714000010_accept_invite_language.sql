-- Capture preferred training language at team-invite acceptance.
--
-- Adds a third argument to accept_team_invitation so the accept-invite screen
-- can record whether the new member prefers Spanish training. Written into the
-- profiles upsert next to department; the profile trigger (20260714000009) then
-- assigns the correct-language modules. Backward compatible: the arg defaults to
-- 'en', and PostgreSQL keeps the existing 2-arg signature callable.
CREATE OR REPLACE FUNCTION public.accept_team_invitation(
  _token text,
  _user_id uuid,
  _preferred_language text DEFAULT 'en'
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role text;
  v_department text;
  v_email text;
  v_lang text;
BEGIN
  v_lang := CASE WHEN _preferred_language = 'es' THEN 'es' ELSE 'en' END;

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

  INSERT INTO public.profiles (id, department, email, access_granted, preferred_language)
  VALUES (_user_id, NULLIF(v_department, ''), v_email, true, v_lang)
  ON CONFLICT (id) DO UPDATE
    SET department          = COALESCE(EXCLUDED.department, public.profiles.department),
        email               = COALESCE(NULLIF(TRIM(public.profiles.email), ''), EXCLUDED.email),
        access_granted      = true,
        preferred_language  = EXCLUDED.preferred_language;

  -- The invite is the identity verification: confirm the email so the user can
  -- sign in without a confirmation mail. No-op if already confirmed.
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = _user_id;

  RETURN COALESCE(v_role, 'staff');
END;
$$;
REVOKE ALL ON FUNCTION public.accept_team_invitation(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text, uuid, text) TO anon, authenticated;
