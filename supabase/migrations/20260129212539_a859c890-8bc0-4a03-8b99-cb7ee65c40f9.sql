-- Drop and recreate with anon role
DROP POLICY IF EXISTS "Anyone can submit private label requests" ON public.private_label_requests;

CREATE POLICY "Anyone can submit private label requests"
ON public.private_label_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);