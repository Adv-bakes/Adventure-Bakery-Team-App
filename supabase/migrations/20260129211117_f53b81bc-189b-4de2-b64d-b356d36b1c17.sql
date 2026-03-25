-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Anyone can submit private label requests" ON public.private_label_requests;

-- Create a proper PERMISSIVE INSERT policy for public access
CREATE POLICY "Anyone can submit private label requests"
ON public.private_label_requests
FOR INSERT
TO public
WITH CHECK (true);