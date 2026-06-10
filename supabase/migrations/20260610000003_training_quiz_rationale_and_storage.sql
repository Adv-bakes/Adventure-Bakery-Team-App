ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS rationale text;

-- Storage bucket for training content (slide images, etc.) — private, staff-only
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-content', 'training-content', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff can read training content files" ON storage.objects;
CREATE POLICY "Staff can read training content files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'training-content' AND public.is_staff_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Staff can write training content files" ON storage.objects;
CREATE POLICY "Staff can write training content files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'training-content' AND public.is_staff_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Staff can update training content files" ON storage.objects;
CREATE POLICY "Staff can update training content files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'training-content' AND public.is_staff_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Staff can delete training content files" ON storage.objects;
CREATE POLICY "Staff can delete training content files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'training-content' AND public.is_staff_or_admin(auth.uid()));
