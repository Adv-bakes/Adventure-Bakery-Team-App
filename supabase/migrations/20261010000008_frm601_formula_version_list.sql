-- FRM-601 Label Review & Approval Form: Linked Formula Version offers the chosen product's versions.
--
-- Owner's request, 2026-10-10. Once a Product Name is entered, the Linked Formula Version field
-- lists the Formula Version of that product's formula sheets (FRM-501) as a type-ahead
-- (`suggestFrom` with `match`). An offer, not a closed list: a version can still be typed. With no
-- product entered nothing is offered. Formula sheets are kept as drafts, so drafts are read.
--
-- Nothing printed on the form changes, so the revision stays at v2. Safe to run twice: a field
-- that already reads as intended is left alone, so no second history snapshot is taken. Any other
-- shape stops the migration.

do $$
declare
  doc_id uuid;
  n_docs int;
  n_src int;
  cur jsonb;
  old_field constant jsonb := $j1${"id": "linked_formula_version", "type": "text", "label": "Linked Formula Version", "width": "third"}$j1$::jsonb;
  new_field constant jsonb := $j2${"id": "linked_formula_version", "type": "text", "label": "Linked Formula Version", "width": "third", "suggestFrom": {"form": "FRM-501", "field": "formula_version", "drafts": true, "match": {"field": "product_name", "to": "product_name"}}}$j2$::jsonb;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-601' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-601: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-601' and status = 'active';

  -- Both fields read from FRM-501 must exist there, and the product field here, or the list would be quietly empty.
  select count(*) into n_src
    from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s, jsonb_array_elements(s->'fields') f
   where (d.sop_number = 'FRM-501' and d.status = 'active' and f->>'id' in ('product_name', 'formula_version'))
      or (d.id = doc_id and f->>'id' = 'product_name');
  if n_src <> 3 then
    raise exception 'FRM-501 / FRM-601: expected the three fields this reads, found %', n_src;
  end if;

  select f into cur
    from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s, jsonb_array_elements(s->'fields') f
   where d.id = doc_id and f->>'id' = 'linked_formula_version';

  if cur = new_field then
    raise notice 'FRM-601: the field already reads as intended, left alone';
    return;
  end if;
  if cur is distinct from old_field then
    raise exception 'FRM-601: Linked Formula Version is not the field this migration was written against';
  end if;

  update public.sop_documents d
     set content = jsonb_set(d.content, '{form_schema,sections}', (
           select jsonb_agg(
                    jsonb_set(s, '{fields}', (
                      select jsonb_agg(case when f->>'id' = 'linked_formula_version' then new_field else f end order by fo)
                        from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
                    ))
                    order by so)
             from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
         ))
   where d.id = doc_id;
end $$;
