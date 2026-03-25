
-- Rename table Baked_Goods to products
ALTER TABLE public."Baked_Goods" RENAME TO products;

-- Rename baked_good_id columns across related tables
ALTER TABLE public.formulas RENAME COLUMN baked_good_id TO product_id;
ALTER TABLE public.costing RENAME COLUMN baked_good_id TO product_id;
ALTER TABLE public.packaging RENAME COLUMN baked_good_id TO product_id;
ALTER TABLE public.shelf_life RENAME COLUMN baked_good_id TO product_id;
ALTER TABLE public.readiness RENAME COLUMN baked_good_id TO product_id;
ALTER TABLE public.production_intake RENAME COLUMN baked_good_id TO product_id;

-- Add status column to production_intake for order tracking
ALTER TABLE public.production_intake ADD COLUMN status text NOT NULL DEFAULT 'pending';
