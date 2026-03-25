-- Create ingredients table
CREATE TABLE public.ingredients (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ingredient_name text NOT NULL,
  supplier text,
  cost_per_unit numeric,
  unit_type text,
  allergens text[],
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on ingredients
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

-- RLS policies for ingredients
CREATE POLICY "Users can view their own ingredients"
ON public.ingredients FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ingredients"
ON public.ingredients FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ingredients"
ON public.ingredients FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ingredients"
ON public.ingredients FOR DELETE
USING (auth.uid() = user_id);

-- Create shelf_life table
CREATE TABLE public.shelf_life (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baked_good_id bigint REFERENCES public."Baked_Goods"(id) ON DELETE CASCADE,
  storage_condition text NOT NULL,
  shelf_life_days integer,
  test_date date,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on shelf_life
ALTER TABLE public.shelf_life ENABLE ROW LEVEL SECURITY;

-- RLS policies for shelf_life
CREATE POLICY "Users can view their own shelf life data"
ON public.shelf_life FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shelf life data"
ON public.shelf_life FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shelf life data"
ON public.shelf_life FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shelf life data"
ON public.shelf_life FOR DELETE
USING (auth.uid() = user_id);

-- Create costing table
CREATE TABLE public.costing (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baked_good_id bigint REFERENCES public."Baked_Goods"(id) ON DELETE CASCADE,
  ingredient_cost numeric,
  labor_cost numeric,
  overhead_cost numeric,
  packaging_cost numeric,
  total_cost numeric GENERATED ALWAYS AS (
    COALESCE(ingredient_cost, 0) + 
    COALESCE(labor_cost, 0) + 
    COALESCE(overhead_cost, 0) + 
    COALESCE(packaging_cost, 0)
  ) STORED,
  target_price numeric,
  margin_percentage numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on costing
ALTER TABLE public.costing ENABLE ROW LEVEL SECURITY;

-- RLS policies for costing
CREATE POLICY "Users can view their own costing data"
ON public.costing FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own costing data"
ON public.costing FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own costing data"
ON public.costing FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own costing data"
ON public.costing FOR DELETE
USING (auth.uid() = user_id);

-- Create packaging table
CREATE TABLE public.packaging (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baked_good_id bigint REFERENCES public."Baked_Goods"(id) ON DELETE CASCADE,
  package_type text,
  material text,
  dimensions text,
  labeling_status text,
  compliance_notes text,
  cost_per_unit numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on packaging
ALTER TABLE public.packaging ENABLE ROW LEVEL SECURITY;

-- RLS policies for packaging
CREATE POLICY "Users can view their own packaging data"
ON public.packaging FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own packaging data"
ON public.packaging FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own packaging data"
ON public.packaging FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own packaging data"
ON public.packaging FOR DELETE
USING (auth.uid() = user_id);

-- Create readiness table (tracks overall progress)
CREATE TABLE public.readiness (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baked_good_id bigint REFERENCES public."Baked_Goods"(id) ON DELETE CASCADE,
  concept_complete boolean DEFAULT false,
  ingredients_complete boolean DEFAULT false,
  formula_complete boolean DEFAULT false,
  shelf_life_complete boolean DEFAULT false,
  costing_complete boolean DEFAULT false,
  packaging_complete boolean DEFAULT false,
  overall_readiness_percent integer GENERATED ALWAYS AS (
    (CASE WHEN concept_complete THEN 16 ELSE 0 END +
     CASE WHEN ingredients_complete THEN 16 ELSE 0 END +
     CASE WHEN formula_complete THEN 17 ELSE 0 END +
     CASE WHEN shelf_life_complete THEN 17 ELSE 0 END +
     CASE WHEN costing_complete THEN 17 ELSE 0 END +
     CASE WHEN packaging_complete THEN 17 ELSE 0 END)
  ) STORED,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, baked_good_id)
);

-- Enable RLS on readiness
ALTER TABLE public.readiness ENABLE ROW LEVEL SECURITY;

-- RLS policies for readiness
CREATE POLICY "Users can view their own readiness data"
ON public.readiness FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own readiness data"
ON public.readiness FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own readiness data"
ON public.readiness FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own readiness data"
ON public.readiness FOR DELETE
USING (auth.uid() = user_id);

-- Create update trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at on all new tables
CREATE TRIGGER update_ingredients_updated_at
  BEFORE UPDATE ON public.ingredients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shelf_life_updated_at
  BEFORE UPDATE ON public.shelf_life
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_costing_updated_at
  BEFORE UPDATE ON public.costing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_packaging_updated_at
  BEFORE UPDATE ON public.packaging
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_readiness_updated_at
  BEFORE UPDATE ON public.readiness
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();