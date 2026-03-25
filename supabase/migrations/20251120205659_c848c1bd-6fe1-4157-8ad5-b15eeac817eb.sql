-- Add new fields to concepts table for product specifications
ALTER TABLE concepts
ADD COLUMN net_weight numeric,
ADD COLUMN net_weight_unit text,
ADD COLUMN unit_length numeric,
ADD COLUMN unit_width numeric,
ADD COLUMN unit_height numeric,
ADD COLUMN shape text;