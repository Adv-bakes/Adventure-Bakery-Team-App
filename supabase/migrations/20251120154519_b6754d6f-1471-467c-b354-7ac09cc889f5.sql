-- Update ingredients table to support new fields
ALTER TABLE ingredients 
DROP COLUMN IF EXISTS supplier,
DROP COLUMN IF EXISTS cost_per_unit,
DROP COLUMN IF EXISTS unit_type;

ALTER TABLE ingredients
ADD COLUMN IF NOT EXISTS function_in_formula TEXT,
ADD COLUMN IF NOT EXISTS specification_notes TEXT,
ADD COLUMN IF NOT EXISTS certifications TEXT[],
ADD COLUMN IF NOT EXISTS sourceability TEXT,
ADD COLUMN IF NOT EXISTS additional_notes TEXT;

-- Update notes column to be additional_notes semantically
COMMENT ON COLUMN ingredients.notes IS 'Legacy notes field - use additional_notes for new entries';
COMMENT ON COLUMN ingredients.additional_notes IS 'Additional notes about the ingredient';