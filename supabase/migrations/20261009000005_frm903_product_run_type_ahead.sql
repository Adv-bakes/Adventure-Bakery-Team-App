-- FRM-903 Daily Sanitation, Pre-Operation & Release Record: "Product / batch run" offers the
-- products that have a formula sheet.
--
-- Owner's request, 2026-10-09. The field now carries `suggestFrom`: focusing it lists the product
-- names on the formula sheets (FRM-501), typing narrows the list, and anything can still be typed,
-- including a batch number after the product chosen. FRM-501's entries are kept as drafts, so
-- drafts are offered too.
--
-- Nothing printed on the form changes and the revision stays as it is. Safe to run twice: a field
-- that already reads as intended is left alone, so no second history snapshot is taken. Any other
-- shape stops the migration.

do $$
declare
  doc_id uuid;
  n_docs int;
  cur jsonb;
  old_field constant jsonb := '{"id": "product_run", "help": "What is being produced today (leave blank if no production)", "type": "text", "label": "Product / batch run", "width": "half"}'::jsonb;
  new_field constant jsonb := old_field || '{"suggestFrom": {"form": "FRM-501", "field": "product_name", "drafts": true}}'::jsonb;
  ids_before text;
  ids_after text;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-903' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-903: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-903' and status = 'active';

  -- The field read from FRM-501 must exist there, or the list would come back quietly empty.
  if not exists (select 1 from public.sop_documents d,
                        jsonb_array_elements(d.content->'form_schema'->'sections') s,
                        jsonb_array_elements(s->'fields') f
                  where d.sop_number = 'FRM-501' and d.status = 'active' and f->>'id' = 'product_name') then
    raise exception 'FRM-501 has no product_name field';
  end if;

  select string_agg(f->>'id', ',' order by so, fo), (array_agg(f) filter (where f->>'id' = 'product_run'))[1]
    into ids_before, cur
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so),
         jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
   where d.id = doc_id;

  if cur = new_field then
    raise notice 'FRM-903: the field already reads as intended, left alone';
  elsif cur = old_field then
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,sections}', (
             select jsonb_agg(
                      jsonb_set(s, '{fields}', coalesce((
                        select jsonb_agg(case when f->>'id' = 'product_run' then new_field else f end order by fo)
                          from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
                      ), '[]'::jsonb))
                      order by so)
               from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
           ))
     where d.id = doc_id;
  else
    raise exception 'FRM-903: Product / batch run is not the field this migration was written against';
  end if;

  select string_agg(f->>'id', ',' order by so, fo) into ids_after
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so),
         jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
   where d.id = doc_id;
  if ids_after is distinct from ids_before then
    raise exception 'FRM-903: the list of fields changed, and this migration must not change it';
  end if;
end $$;
