-- Create weight conversion table for volume to weight conversions
CREATE TABLE IF NOT EXISTS public.weight_conversions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  ingredient_name text NOT NULL,
  unit text NOT NULL,
  grams_per_unit numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.weight_conversions ENABLE ROW LEVEL SECURITY;

-- Allow all users to read conversion data
CREATE POLICY "Anyone can read weight conversions"
ON public.weight_conversions
FOR SELECT
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_weight_conversions_ingredient ON public.weight_conversions(ingredient_name);

-- Insert common baking ingredient conversions
INSERT INTO public.weight_conversions (ingredient_name, unit, grams_per_unit) VALUES
-- Flours
('flour', 'cup', 120),
('flour', 'tbsp', 7.5),
('flour', 'tsp', 2.5),
-- Sugars
('sugar', 'cup', 200),
('sugar', 'tbsp', 12.5),
('sugar', 'tsp', 4.2),
('brown sugar', 'cup', 220),
('brown sugar', 'tbsp', 13.8),
('brown sugar', 'tsp', 4.6),
('powdered sugar', 'cup', 120),
('powdered sugar', 'tbsp', 7.5),
('powdered sugar', 'tsp', 2.5),
-- Fats
('butter', 'cup', 227),
('butter', 'tbsp', 14.2),
('butter', 'tsp', 4.7),
('oil', 'cup', 224),
('oil', 'tbsp', 14),
('oil', 'tsp', 4.7),
-- Liquids
('water', 'cup', 240),
('water', 'tbsp', 15),
('water', 'tsp', 5),
('milk', 'cup', 245),
('milk', 'tbsp', 15.3),
('milk', 'tsp', 5.1),
-- Cocoa
('cocoa powder', 'cup', 85),
('cocoa powder', 'tbsp', 5.3),
('cocoa powder', 'tsp', 1.8),
-- Salt
('salt', 'cup', 292),
('salt', 'tbsp', 18.3),
('salt', 'tsp', 6.1),
-- Baking powder/soda
('baking powder', 'cup', 192),
('baking powder', 'tbsp', 12),
('baking powder', 'tsp', 4),
('baking soda', 'cup', 220),
('baking soda', 'tbsp', 13.8),
('baking soda', 'tsp', 4.6);

-- Add trigger for updated_at
CREATE TRIGGER update_weight_conversions_updated_at
BEFORE UPDATE ON public.weight_conversions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();