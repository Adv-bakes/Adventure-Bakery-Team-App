
-- production_intake: add missing columns for operations hub
ALTER TABLE public.production_intake
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS number_of_cases integer;

-- formulas: make percentage nullable (code uses percentage_formula instead)
ALTER TABLE public.formulas ALTER COLUMN percentage DROP NOT NULL;
ALTER TABLE public.formulas ALTER COLUMN percentage SET DEFAULT 0;
