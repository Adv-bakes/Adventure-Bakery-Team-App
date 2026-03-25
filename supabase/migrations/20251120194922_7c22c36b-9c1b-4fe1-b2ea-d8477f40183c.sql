-- Add volume tracking columns to formulas table
ALTER TABLE public.formulas 
ADD COLUMN volume_amount numeric,
ADD COLUMN volume_unit text;