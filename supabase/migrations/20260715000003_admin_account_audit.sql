-- Audit trail for admin-initiated account/password actions.
--
-- Training completions, quiz scores and form signatures are all attributed to an
-- individual account, so an admin setting another user's password is a
-- non-repudiation event: it must be recorded, or "who signed this form" stops
-- being answerable during an SQF audit.
--
-- Written exclusively by the admin-user-account edge function using the
-- service-role key. The password itself is never stored here.

CREATE TABLE IF NOT EXISTS public.admin_account_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_email text,
  action text NOT NULL CHECK (action IN ('set_password', 'reset_link')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_account_actions IS
  'Append-only audit log of admin password actions. Written only by the admin-user-account edge function (service role). Never stores passwords.';

CREATE INDEX IF NOT EXISTS admin_account_actions_target_idx
  ON public.admin_account_actions (target_user_id, created_at DESC);

ALTER TABLE public.admin_account_actions ENABLE ROW LEVEL SECURITY;

-- Read: admin or owner only. Deliberately NOT is_staff_or_admin() — that helper
-- includes staff, who have no business reading the password-action history.
DROP POLICY IF EXISTS "Admins read account actions" ON public.admin_account_actions;
CREATE POLICY "Admins read account actions"
  ON public.admin_account_actions FOR SELECT TO authenticated
  USING (public.is_owner(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies by design. The service-role key bypasses RLS,
-- so the edge function can still write; every client — including an admin — is
-- denied, which makes the log append-only and untamperable from the app.
