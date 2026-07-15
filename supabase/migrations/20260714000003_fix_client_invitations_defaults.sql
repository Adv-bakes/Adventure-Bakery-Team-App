-- The live client_invitations table drifted from its original migration
-- definition (it was created by earlier tooling without the column DEFAULTs).
-- On the live DB, id/token/created_at/expires_at are nullable with NO default,
-- so any insert that relies on those defaults — create_team_invitation() AND
-- the brand-client invite in AdminPortal — produces a row with a NULL token.
-- create_team_invitation then returns NULL (its RETURNING token is null), which
-- the UI reports as "the server didn't return an invite token".
--
-- Restore the defaults. Use gen_random_uuid() (always available on Supabase)
-- rather than pgcrypto's gen_random_bytes so this is self-contained: two v4
-- UUIDs with hyphens stripped give a 64-char hex token equivalent to the original.

ALTER TABLE public.client_invitations
  ALTER COLUMN id         SET DEFAULT gen_random_uuid()::text,
  ALTER COLUMN token      SET DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

-- Remove the tokenless team-invite rows produced by the failed attempts before
-- this fix — they were never usable. (Brand-client rows are left untouched.)
DELETE FROM public.client_invitations
WHERE invite_kind = 'team' AND token IS NULL;
