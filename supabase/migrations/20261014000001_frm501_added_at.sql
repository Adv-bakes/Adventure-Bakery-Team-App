-- FRM-501 Formula Sheet & Batch Data: an "Added at" column on the ingredient table.
--
-- Owner's request, 2026-10-14. The simple syrup and the rum are added at dunking, after the bake
-- and before sealing, and were on no formula sheet and no lot record - so a recall of either could
-- not be traced to our lots. They become ordinary lines of the formula sheet marked "Added at:
-- Dunking". A lot started from the sheet carries the mark onto its lot record (FRM-520), where the
-- step-by-step page asks for their lots at a Dunking step instead of at mixing. Blank means Mixing,
-- so every line already on a sheet is unchanged. Pecans and the pan spray stay with mixing.
--
-- The column goes after Supplier, next to the ingredient's name. The revision stays as it is:
-- every formula sheet is an open draft pinned to that revision, and a new revision would show them
-- the old layout without the column (as with the bar code field, 20261010000004). Safe to run twice:
-- a table that already has the column is left alone, so no second history snapshot is taken.

do $$
declare
  doc_id uuid;
  n_docs int;
  cur jsonb;
  col constant jsonb := '{"id": "added_at", "type": "select", "label": "Added at", "options": ["Mixing", "Dunking"], "width": 1.3, "scanFact": "none"}'::jsonb;
  ids_before text;
  ids_after text;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-501' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-501: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-501' and status = 'active';

  select string_agg(f->>'id', ',' order by so, fo), (array_agg(f) filter (where f->>'id' = 'prototype_formulation_grid'))[1]
    into ids_before, cur
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so),
         jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
   where d.id = doc_id;

  if cur is null or cur->>'type' <> 'grid'
     or not exists (select 1 from jsonb_array_elements(cur->'columns') c where c->>'id' = 'supplier') then
    raise exception 'FRM-501: the ingredient table is not the table this migration was written against';
  elsif exists (select 1 from jsonb_array_elements(cur->'columns') c where c->>'id' = 'added_at') then
    raise notice 'FRM-501: the ingredient table already has Added at, left alone';
  else
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,sections}', (
             select jsonb_agg(
                      jsonb_set(s, '{fields}', coalesce((
                        select jsonb_agg(
                                 case when f->>'id' = 'prototype_formulation_grid' then
                                   jsonb_set(f, '{columns}', (
                                     select jsonb_agg(c order by k)
                                       from (select c, (co * 2)::int as k
                                               from jsonb_array_elements(f->'columns') with ordinality as z(c, co)
                                             union all
                                             select col, (co * 2 + 1)::int
                                               from jsonb_array_elements(f->'columns') with ordinality as z(c, co)
                                              where c->>'id' = 'supplier') w))
                                 else f end
                                 order by fo)
                          from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
                      ), '[]'::jsonb))
                      order by so)
               from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
           ))
     where d.id = doc_id;
  end if;

  select string_agg(f->>'id', ',' order by so, fo) into ids_after
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so),
         jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
   where d.id = doc_id;
  if ids_after is distinct from ids_before then
    raise exception 'FRM-501: the list of fields changed, and this migration must not change it';
  end if;
end $$;
