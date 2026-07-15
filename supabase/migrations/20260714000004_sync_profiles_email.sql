-- Identify people in the Team Directory / member detail.
--
-- profiles.email and full_name are populated only when a user edits their own
-- profile: handle_new_user() inserts just the id, so an admin-created or invited
-- user shows in the directory as "(no name)" with nothing to identify them. The
-- real identity (the login email) lives in auth.users, which the client can't
-- read. Sync it down into profiles.email so the directory always has a stable
-- identifier — kept current on signup, on invite-accept, and backfilled here.

-- 1. On signup: carry the auth email (and any provided name) onto the profile.
--    ON CONFLICT keeps a user-edited email/name if the row already exists.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'full_name',
                         new.raw_user_meta_data->>'name', '')), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET email     = COALESCE(public.profiles.email, EXCLUDED.email),
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);
  RETURN new;
END;
$$;

-- 2a. Backfill MISSING profile rows. An invited/admin-created user can end up
--     with a role but no profiles row (the accept flow only UPDATEd, which
--     no-ops when the row is absent), making them invisible in the directory.
--     Create a row for every auth user that lacks one, seeded with their email.
INSERT INTO public.profiles (id, email, full_name)
SELECT u.id,
       u.email,
       NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'full_name',
                            u.raw_user_meta_data->>'name', '')), '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2b. Backfill email onto existing rows that never captured it.
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id
  AND (p.email IS NULL OR TRIM(p.email) = '')
  AND u.email IS NOT NULL;

-- 3. When a team invite is accepted, also stamp the invited email onto the
--    profile (accept_team_invitation already knows it). Re-create the function
--    with the added email write; everything else matches 20260714000002.
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

  -- Upsert (not bare UPDATE): the signup trigger normally creates the profile
  -- row, but guard against the row being absent so the member never ends up
  -- role-only / invisible in the directory.
  INSERT INTO public.profiles (id, department, email, access_granted)
  VALUES (_user_id, NULLIF(v_department, ''), v_email, true)
  ON CONFLICT (id) DO UPDATE
    SET department      = COALESCE(EXCLUDED.department, public.profiles.department),
        email           = COALESCE(NULLIF(TRIM(public.profiles.email), ''), EXCLUDED.email),
        access_granted  = true;

  RETURN COALESCE(v_role, 'staff');
END;
$$;
REVOKE ALL ON FUNCTION public.accept_team_invitation(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text, uuid) TO anon, authenticated;
