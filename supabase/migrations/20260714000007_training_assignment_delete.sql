-- Admin/owner can DELETE training assignments (the "unassign" control).
--
-- The auto-sync is grant-only (INSERT … ON CONFLICT DO NOTHING, never deletes),
-- and the original training_modules migration granted admins only SELECT/INSERT/
-- UPDATE on training_assignments. To let an admin remove an assignment that no
-- longer applies (dept change, mis-assignment), add a DELETE policy scoped to
-- admin/owner. Staff still cannot delete their own assignments.

CREATE POLICY "Admins delete training_assignments"
  ON public.training_assignments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()));
