-- Allow admins and owners to permanently (hard) delete SOP documents.
--
-- sop_documents previously had SELECT / INSERT / UPDATE policies but no DELETE
-- policy, so the SOPs Library "Delete Permanently" action was silently blocked
-- by RLS. has_role(uid,'admin') does not treat 'owner' as admin, so we check
-- is_owner() too to match the app's isAdmin = admin || owner.
--
-- Child rows (quiz_questions, training_assignments) are removed by their
-- ON DELETE CASCADE foreign keys; cascade deletes are not subject to the child
-- tables' RLS, so no additional policies are needed there.

DROP POLICY IF EXISTS "Admins delete sop_documents" ON public.sop_documents;

CREATE POLICY "Admins delete sop_documents"
  ON public.sop_documents
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid())
  );
