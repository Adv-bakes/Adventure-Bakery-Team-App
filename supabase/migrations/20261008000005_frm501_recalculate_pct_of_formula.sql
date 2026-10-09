-- FRM-501 Formula Sheet & Batch Data: a "Recalculate" link on the % of Formula column.
--
-- Owner's request, 2026-10-08. The % of Formula column is typed by hand, so it goes stale as soon
-- as a quantity is changed or a line is added. The column now carries `shareOf`, which puts a
-- "Recalculate" link in its header: tapped, it works every row's percentage out again from
-- Production Qty as it stands. Nothing is calculated until it is tapped, the cells can still be
-- typed in, and nothing printed on the form changes, so the revision stays as it is.
--
-- Safe to run twice: a column that already carries the setting is left alone and nothing is
-- updated, so no second history snapshot is taken.

do $$
declare
  doc_id uuid;
  n_docs int;
  n_cols int;
  n_before int;
  n_after int;
  already boolean;
  setting constant jsonb := '{"shareOf": {"column": "production_qty", "nameColumn": "ingredient"}}'::jsonb;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-501' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-501: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-501' and status = 'active';

  select count(*),
         count(*) filter (where c->>'id' in ('pct_of_formula', 'production_qty', 'ingredient')),
         coalesce(bool_or(c->>'id' = 'pct_of_formula' and c->'shareOf' = setting->'shareOf'), false)
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
                                             select jsonb_agg(case when c->>'id' = 'pct_of_formula' then c || setting else c end order by co)
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

  select count(*), count(*) filter (where c->>'id' = 'pct_of_formula' and c->'shareOf' = setting->'shareOf')
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
    raise exception 'FRM-501: pct_of_formula does not carry shareOf after the update';
  end if;
end $$;
