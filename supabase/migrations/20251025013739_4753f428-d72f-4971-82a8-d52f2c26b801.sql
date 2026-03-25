-- Create ingredient_specs table for storing detailed ingredient specifications
CREATE TABLE IF NOT EXISTS public.ingredient_specs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  formula_id BIGINT NULL,
  concept_id BIGINT NULL,
  base_ingredient TEXT NOT NULL,
  spec_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  formatted_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ingredient_specs ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own ingredient specs"
ON public.ingredient_specs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ingredient specs"
ON public.ingredient_specs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ingredient specs"
ON public.ingredient_specs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ingredient specs"
ON public.ingredient_specs
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_ingredient_specs_updated_at
BEFORE UPDATE ON public.ingredient_specs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();