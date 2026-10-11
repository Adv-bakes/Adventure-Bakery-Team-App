-- The product name is offered from one place: the formula sheets (FRM-501).
--
-- Owner's decision, 2026-10-10. The name of a product is established on its formula sheet, and the
-- same name is what ties the lot record, the CCP records, the release and the lot trace together.
-- Until now most forms had it typed. These fields now carry `suggestFrom` - the type-ahead FRM-903
-- already uses: focusing the field lists the product names on the formula sheets, typing narrows
-- the list, and anything can still be typed (an OFFER, not a closed list - a product whose formula
-- sheet is not entered yet can still be recorded). Formula sheets are kept as drafts, so drafts
-- are offered.
--
--   FRM-520 Product                FRM-601 Product Name        FRM-606 Product
--   FRM-704 Product                FRM-909 / 910 / 911 / 912 Product run
--
-- Nothing printed on any form changes, so no revision changes. Safe to run twice: a field that
-- already reads as intended is left alone, so no second history snapshot is taken. A field in any
-- other shape stops the whole migration.

do $$
declare
  plan constant jsonb := $j$[{"form": "FRM-520", "field": "product", "old": {"id": "product", "type": "text", "label": "Product", "width": "third", "required": true, "showInList": true}, "new": {"id": "product", "type": "text", "label": "Product", "width": "third", "required": true, "showInList": true, "suggestFrom": {"form": "FRM-501", "field": "product_name", "drafts": true}}}, {"form": "FRM-601", "field": "product_name", "old": {"id": "product_name", "type": "text", "label": "Product Name", "width": "half", "required": true, "showInList": true}, "new": {"id": "product_name", "type": "text", "label": "Product Name", "width": "half", "required": true, "showInList": true, "suggestFrom": {"form": "FRM-501", "field": "product_name", "drafts": true}}}, {"form": "FRM-606", "field": "product", "old": {"id": "product", "help": "The product covered by the HACCP plan.", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true}, "new": {"id": "product", "help": "The product covered by the HACCP plan.", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true, "suggestFrom": {"form": "FRM-501", "field": "product_name", "drafts": true}}}, {"form": "FRM-704", "field": "product_name", "old": {"id": "product_name", "help": "As it is named on the label, flavour included.", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true}, "new": {"id": "product_name", "help": "As it is named on the label, flavour included.", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true, "suggestFrom": {"form": "FRM-501", "field": "product_name", "drafts": true}}}, {"form": "FRM-909", "field": "product_run", "old": {"id": "product_run", "type": "text", "label": "Product run", "width": "third", "showInList": true}, "new": {"id": "product_run", "type": "text", "label": "Product run", "width": "third", "showInList": true, "suggestFrom": {"form": "FRM-501", "field": "product_name", "drafts": true}}}, {"form": "FRM-910", "field": "product_run", "old": {"id": "product_run", "type": "text", "label": "Product run", "width": "third", "showInList": true}, "new": {"id": "product_run", "type": "text", "label": "Product run", "width": "third", "showInList": true, "suggestFrom": {"form": "FRM-501", "field": "product_name", "drafts": true}}}, {"form": "FRM-911", "field": "product_run", "old": {"id": "product_run", "type": "text", "label": "Product run", "width": "third", "showInList": true}, "new": {"id": "product_run", "type": "text", "label": "Product run", "width": "third", "showInList": true, "suggestFrom": {"form": "FRM-501", "field": "product_name", "drafts": true}}}, {"form": "FRM-912", "field": "product_run", "old": {"id": "product_run", "type": "text", "label": "Product run", "width": "third", "showInList": true}, "new": {"id": "product_run", "type": "text", "label": "Product run", "width": "third", "showInList": true, "suggestFrom": {"form": "FRM-501", "field": "product_name", "drafts": true}}}]$j$::jsonb;
  t jsonb;
  doc_id uuid;
  n_docs int;
  cur jsonb;
  n_same int;
begin
  -- The field read from FRM-501 must exist there, or every list would come back quietly empty.
  if not exists (select 1 from public.sop_documents d,
                        jsonb_array_elements(d.content->'form_schema'->'sections') s,
                        jsonb_array_elements(s->'fields') f
                  where d.sop_number = 'FRM-501' and d.status = 'active' and f->>'id' = 'product_name') then
    raise exception 'FRM-501 has no product_name field';
  end if;

  for t in select * from jsonb_array_elements(plan) loop
    select count(*) into n_docs from public.sop_documents where sop_number = t->>'form' and status = 'active';
    if n_docs <> 1 then
      raise exception '%: expected one active document, found %', t->>'form', n_docs;
    end if;
    select id into doc_id from public.sop_documents where sop_number = t->>'form' and status = 'active';

    select count(*), (array_agg(f))[1] into n_same, cur
      from public.sop_documents d,
           jsonb_array_elements(d.content->'form_schema'->'sections') s,
           jsonb_array_elements(s->'fields') f
     where d.id = doc_id and f->>'id' = t->>'field';
    if n_same <> 1 then
      raise exception '%: expected one field %, found %', t->>'form', t->>'field', n_same;
    end if;

    if cur = t->'new' then
      raise notice '%: % already reads as intended, left alone', t->>'form', t->>'field';
    elsif cur = t->'old' then
      update public.sop_documents d
         set content = jsonb_set(d.content, '{form_schema,sections}', (
               select jsonb_agg(
                        jsonb_set(s, '{fields}', coalesce((
                          select jsonb_agg(case when f->>'id' = t->>'field' then t->'new' else f end order by fo)
                            from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
                        ), '[]'::jsonb))
                        order by so)
                 from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
             ))
       where d.id = doc_id;
    else
      raise exception '%: % is not the field this migration was written against', t->>'form', t->>'field';
    end if;
  end loop;
end $$;
