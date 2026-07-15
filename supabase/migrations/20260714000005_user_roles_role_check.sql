-- Widen the user_roles role CHECK constraint to the current role model.
--
-- The live constraint only allowed ('admin','manager','staff','customer') — it
-- predates the RBAC the app actually runs on. As a result 'owner', 'auditor',
-- and 'user' rows were rejected at insert time, which silently broke:
--   * is_owner() / owner-only routes (no owner row could ever exist),
--   * the read-only SQF auditor role (no auditor row could be created),
--   * granting the brand 'user' role via user_roles.
-- This is schema drift (the same class of issue as the client_invitations
-- defaults). Replace the constraint with the full set; the legacy values are
-- retained so any pre-existing rows stay valid.

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role = ANY (ARRAY[
    'owner'::text, 'admin'::text, 'staff'::text, 'auditor'::text, 'user'::text,
    -- legacy values kept for back-compat with any historical rows
    'manager'::text, 'customer'::text
  ]));
