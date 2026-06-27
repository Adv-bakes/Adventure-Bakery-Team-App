-- Materials are split into Ingredients / Packaging Materials / Finished Goods so the
-- Tolling Inventory tab can group them into separate sections instead of one flat list.
ALTER TABLE public.inventory_tolling
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'ingredient'
  CHECK (category IN ('ingredient', 'packaging', 'finished_good'));

-- One-time keyword backfill for rows imported before this column existed.
-- Packaging signals checked first since labels/boxes named after a flavor
-- (e.g. "Labels, Retail Branded -Sausage") are packaging, not the finished food itself.
UPDATE public.inventory_tolling
SET category = 'packaging'
WHERE category = 'ingredient' AND (
  ingredient_name ILIKE '%box%' OR ingredient_name ILIKE '%label%' OR ingredient_name ILIKE '%bag%' OR
  ingredient_name ILIKE '%tray%' OR ingredient_name ILIKE '%seal%' OR ingredient_name ILIKE '%wax paper%' OR
  ingredient_name ILIKE '%corrugate%' OR ingredient_name ILIKE '%sleeve%' OR ingredient_name ILIKE '%poly%' OR
  ingredient_name ILIKE '%packaging%'
);

UPDATE public.inventory_tolling
SET category = 'finished_good'
WHERE category = 'ingredient' AND (
  ingredient_name ILIKE '%patt%' OR ingredient_name ILIKE '%meatball%' OR
  ingredient_name ILIKE '%suasage%' OR ingredient_name ILIKE '%sausage%' OR ingredient_name ILIKE '%finished%'
);
