-- FRM-501 Formula Sheet & Batch Data: the Ingredient can be picked from the material register.
--
-- Owner's request, 2026-10-09. The Ingredient column now carries `pickFrom`: it offers the materials
-- in the Material Specification Register (FRM-207) as a list, and picking one fills that row's
-- Supplier (the manufacturer / brand on the material's entry) and Allergen(s) (the allergens ticked
-- on it). It is optional - an ingredient can still be typed, and then nothing is filled - and a
-- cell somebody has already filled in is never replaced.
--
-- Offered: SUBMITTED FRM-207 entries that are not Discontinued and whose category is an
-- ingredient, an additive / flavouring or a processing aid (not packaging or chemicals).
--
-- Nothing printed on the form changes, so the revision stays as it is. Safe to run twice: a column
-- that already carries the setting is left alone, so no second history snapshot is taken.

do $$
declare
  doc_id uuid;
  n_docs int;
  n_cols int;
  n_before int;
  n_after int;
  n_src int;
  already boolean;
  setting constant jsonb := $j${"pickFrom":{"form":"FRM-207","field":"material_name","hintField":"manufacturer","fill":{"supplier":"manufacturer","allergens":"allergens_contains"},"filters":[{"field":"status","op":"notEquals","value":"Discontinued"},{"field":"category","op":"in","values":["Ingredient","Additive / flavouring","Processing aid"]}]}}$j$::jsonb;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-501' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-501: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-501' and status = 'active';

  -- The fields read from FRM-207 must exist there, or the list would come back quietly empty.
  select count(*) into n_src
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') s,
         jsonb_array_elements(s->'fields') f
   where d.sop_number = 'FRM-207' and d.status = 'active'
     and f->>'id' in ('material_name', 'manufacturer', 'allergens_contains', 'status', 'category');
  if n_src <> 5 then
    raise exception 'FRM-207: expected the five fields this reads, found %', n_src;
  end if;

  select count(*),
         count(*) filter (where c->>'id' in ('ingredient', 'supplier', 'allergens')),
         coalesce(bool_or(c->>'id' = 'ingredient' and c->'pickFrom' = setting->'pickFrom'), false)
    into n_before, n_cols, already
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') s,
         jsonb_array_elements(s->'fields') f,
         jsonb_array_elements(f->'columns') c
   where d.id = doc_id and f->>'id' = 'prototype_formulation_grid';
  if n_cols <> 3 then
    raise exception 'FRM-501: the formulation grid does not have the three columns this needs (found %)', n_cols;
  end if;

  if not already then
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,sections}', (
             select jsonb_agg(
                      jsonb_set(s, '{fields}', coalesce((
                        select jsonb_agg(
                                 case when f->>'id' = 'prototype_formulation_grid'
                                      then jsonb_set(f, '{columns}', (
                                             select jsonb_agg(case when c->>'id' = 'ingredient' then c || setting else c end order by co)
                                               from jsonb_array_elements(f->'columns') with ordinality as z(c, co)))
                                      else f end
                                 order by fo)
                          from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
                      ), '[]'::jsonb))
                      order by so)
               from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
           ))
     where d.id = doc_id;
  end if;

  select count(*), count(*) filter (where c->>'id' = 'ingredient' and c->'pickFrom' = setting->'pickFrom')
    into n_after, n_cols
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') s,
         jsonb_array_elements(s->'fields') f,
         jsonb_array_elements(f->'columns') c
   where d.id = doc_id and f->>'id' = 'prototype_formulation_grid';
  if n_after <> n_before then
    raise exception 'FRM-501: column count changed from % to %', n_before, n_after;
  end if;
  if n_cols <> 1 then
    raise exception 'FRM-501: ingredient does not carry pickFrom after the update';
  end if;
end $$;
