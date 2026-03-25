-- Add new columns to shelf_life table for detailed tracking
ALTER TABLE public.shelf_life
ADD COLUMN IF NOT EXISTS aw_test_result numeric,
ADD COLUMN IF NOT EXISTS moisture_pct numeric,
ADD COLUMN IF NOT EXISTS ph_level numeric,
ADD COLUMN IF NOT EXISTS preservation_strategy text,
ADD COLUMN IF NOT EXISTS functional_ingredients jsonb,
ADD COLUMN IF NOT EXISTS barrier_type jsonb,
ADD COLUMN IF NOT EXISTS packaging_material text;

-- Add a comment explaining the table's purpose
COMMENT ON TABLE public.shelf_life IS 'Tracks shelf life testing data with factors like water activity, pH, moisture, and packaging barriers';