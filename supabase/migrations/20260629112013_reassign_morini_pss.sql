-- One-time repair: the "PSS FORM Retail Bahama Burger 3oz" upload was stuck
-- unlinked (lead_id null) after the previous migration intentionally left
-- ambiguous user_id matches alone rather than guess. Bahama Burger Original
-- Retail is Morini Brands' approved product, so point this doc at Morini's
-- sales_leads row by name match (scoped tight via the shared collision id
-- + filename so this can't touch any other row).
UPDATE public.client_documents cd
SET lead_id = sl.id
FROM public.sales_leads sl
WHERE cd.lead_id IS NULL
  AND cd.user_id = '0ec912f6-3b8a-4d40-ac4b-dd86e398eb84'
  AND cd.file_name ILIKE '%bahama burger%'
  AND sl.company_name = 'Morini Brands';
