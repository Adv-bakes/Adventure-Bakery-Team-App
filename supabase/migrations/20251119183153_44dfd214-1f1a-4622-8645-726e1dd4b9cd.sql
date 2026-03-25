-- Add new fields to concepts table for enhanced product specification

-- Product Identity fields
ALTER TABLE concepts
ADD COLUMN product_code text,
ADD COLUMN version_number text,
ADD COLUMN date_of_issue date,
ADD COLUMN last_review_date date,
ADD COLUMN next_review_date date,
ADD COLUMN product_description text,

-- Market & Positioning fields
ADD COLUMN intended_use text,
ADD COLUMN dietary_category jsonb DEFAULT '[]'::jsonb,

-- Product Image fields
ADD COLUMN product_image_path text,
ADD COLUMN product_image_name text,
ADD COLUMN product_image_uploaded_at timestamp with time zone;

-- Add comment for clarity
COMMENT ON COLUMN concepts.dietary_category IS 'Array of dietary categories (e.g., vegan, gluten-free, keto)';
COMMENT ON COLUMN concepts.desired_claims IS 'Regulatory/Marketing claims for the product';