-- Add ingredient_id and supplier fields to ingredient_specs table
ALTER TABLE public.ingredient_specs
ADD COLUMN IF NOT EXISTS ingredient_id bigint REFERENCES public.ingredients(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS supplier_name text,
ADD COLUMN IF NOT EXISTS spec_details text,
ADD COLUMN IF NOT EXISTS unit_cost numeric;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_ingredient_specs_ingredient_id ON public.ingredient_specs(ingredient_id);