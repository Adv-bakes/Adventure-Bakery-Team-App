-- Add RLS policies for formulas table
ALTER TABLE public.formulas ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own formulas
CREATE POLICY "Enable read access for users based on user_id"
ON public.formulas
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own formulas
CREATE POLICY "Enable insert for authenticated users only"
ON public.formulas
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own formulas
CREATE POLICY "Enable update for users based on user_id"
ON public.formulas
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own formulas
CREATE POLICY "Enable delete for users based on user_id"
ON public.formulas
FOR DELETE
USING (auth.uid() = user_id);