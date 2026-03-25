
-- =============================================
-- 1. PROFILES: add missing columns
-- =============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_granted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS product_type text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS target_market text;

-- =============================================
-- 2. INGREDIENTS: add missing columns
-- =============================================
ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS ingredient_name text,
  ADD COLUMN IF NOT EXISTS function_in_formula text,
  ADD COLUMN IF NOT EXISTS specification_notes text,
  ADD COLUMN IF NOT EXISTS sourceability text,
  ADD COLUMN IF NOT EXISTS additional_notes text,
  ADD COLUMN IF NOT EXISTS allergens jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- =============================================
-- 3. PRODUCTS: add missing columns
-- =============================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS yield_units numeric,
  ADD COLUMN IF NOT EXISTS unit_size_oz numeric,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS concept_id bigint;

-- =============================================
-- 4. FORMULAS: add missing columns
-- =============================================
ALTER TABLE public.formulas
  ADD COLUMN IF NOT EXISTS ingredient_name text,
  ADD COLUMN IF NOT EXISTS ingredient_category text,
  ADD COLUMN IF NOT EXISTS volume_amount text,
  ADD COLUMN IF NOT EXISTS volume_unit text,
  ADD COLUMN IF NOT EXISTS weight_g numeric,
  ADD COLUMN IF NOT EXISTS percentage_formula numeric,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS concept_id bigint;

-- =============================================
-- 5. INGREDIENT_SPECS: add missing columns
-- =============================================
ALTER TABLE public.ingredient_specs
  ADD COLUMN IF NOT EXISTS spec_fields jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS base_ingredient text,
  ADD COLUMN IF NOT EXISTS formatted_name text,
  ADD COLUMN IF NOT EXISTS formula_id bigint;

-- =============================================
-- 6. CONCEPTS: change desired_claims to jsonb
-- =============================================
ALTER TABLE public.concepts
  ALTER COLUMN desired_claims TYPE jsonb USING
    CASE
      WHEN desired_claims IS NULL THEN NULL
      WHEN desired_claims ~ '^\[' THEN desired_claims::jsonb
      ELSE to_jsonb(desired_claims)
    END;

-- =============================================
-- 7. Create validate_invitation_token function
-- =============================================
CREATE OR REPLACE FUNCTION public.validate_invitation_token(_token text)
RETURNS TABLE(email text, expired boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.email::text,
    CASE
      WHEN ci.accepted_at IS NOT NULL THEN true
      WHEN ci.expires_at < now() THEN true
      ELSE false
    END AS expired
  FROM public.client_invitations ci
  WHERE ci.token = _token
  LIMIT 1;
END;
$$;

-- =============================================
-- 8. Create accept_invitation function
-- =============================================
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark invitation as accepted
  UPDATE public.client_invitations
  SET accepted_at = now()::text
  WHERE token = _token AND accepted_at IS NULL;

  -- Grant access to the user's profile
  UPDATE public.profiles
  SET access_granted = true
  WHERE id = _user_id;

  -- Ensure user has the 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT DO NOTHING;
END;
$$;
