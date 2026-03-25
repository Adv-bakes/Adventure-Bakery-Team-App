-- Add concept_id to all workflow tables to link them to the main product concept

-- Add concept_id to Baked_Goods
ALTER TABLE public."Baked_Goods"
ADD COLUMN concept_id bigint REFERENCES public.concepts(id) ON DELETE CASCADE;

-- Add concept_id to formulas
ALTER TABLE public.formulas
ADD COLUMN concept_id bigint REFERENCES public.concepts(id) ON DELETE CASCADE;

-- Add concept_id to shelf_life
ALTER TABLE public.shelf_life
ADD COLUMN concept_id bigint REFERENCES public.concepts(id) ON DELETE CASCADE;

-- Add concept_id to costing
ALTER TABLE public.costing
ADD COLUMN concept_id bigint REFERENCES public.concepts(id) ON DELETE CASCADE;

-- Add concept_id to packaging
ALTER TABLE public.packaging
ADD COLUMN concept_id bigint REFERENCES public.concepts(id) ON DELETE CASCADE;

-- Update readiness table to use concept_id instead of baked_good_id as primary reference
ALTER TABLE public.readiness
ADD COLUMN concept_id bigint REFERENCES public.concepts(id) ON DELETE CASCADE;

-- Create indexes for better query performance
CREATE INDEX idx_baked_goods_concept_id ON public."Baked_Goods"(concept_id);
CREATE INDEX idx_formulas_concept_id ON public.formulas(concept_id);
CREATE INDEX idx_shelf_life_concept_id ON public.shelf_life(concept_id);
CREATE INDEX idx_costing_concept_id ON public.costing(concept_id);
CREATE INDEX idx_packaging_concept_id ON public.packaging(concept_id);
CREATE INDEX idx_readiness_concept_id ON public.readiness(concept_id);