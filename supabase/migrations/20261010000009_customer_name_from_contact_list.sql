-- The customer name is offered from one place: the contact list (FRM-011).
--
-- Owner's decision, 2026-10-10. The Recall and Crisis Contact List is where each customer is kept
-- with a way to reach them, and in a recall the lot trace matches the customer on a dispatch record
-- against it BY NAME - so a name typed differently shows up as a customer with no contact. These
-- fields now carry `suggestFrom` reading the contact list's table: focusing the field lists the
-- contacts grouped "Customer (brand owner)" on the CURRENT list (the newest submitted entry, else
-- the newest draft), typing narrows the list, and anything can still be typed (an OFFER, not a
-- closed list). Until the contact list is filled in, the fields behave exactly as before.
--
--   FRM-002 Customer Name            FRM-012 Customer / brand owner     FRM-601 Customer / Brand
--   FRM-701 Customer                 FRM-703 Customer                   FRM-704 Customer / brand
--   FRM-801 Customer
--
-- Nothing printed on any form changes, so no revision changes. Safe to run twice: a field that
-- already reads as intended is left alone, so no second history snapshot is taken. A field in any
-- other shape stops the whole migration.

do $$
declare
  plan constant jsonb := $j$[{"form": "FRM-002", "field": "customer_name", "old": {"id": "customer_name", "type": "text", "label": "Customer Name", "showInList": true}, "new": {"id": "customer_name", "type": "text", "label": "Customer Name", "showInList": true, "suggestFrom": {"form": "FRM-011", "grid": "contacts", "field": "_label", "where": {"column": "group", "equals": "Customer (brand owner)"}, "current": true, "drafts": true}}}, {"form": "FRM-012", "field": "brand_owner", "old": {"id": "brand_owner", "type": "text", "label": "Customer / brand owner", "width": "full"}, "new": {"id": "brand_owner", "type": "text", "label": "Customer / brand owner", "width": "full", "suggestFrom": {"form": "FRM-011", "grid": "contacts", "field": "_label", "where": {"column": "group", "equals": "Customer (brand owner)"}, "current": true, "drafts": true}}}, {"form": "FRM-601", "field": "customer_brand", "old": {"id": "customer_brand", "type": "text", "label": "Customer / Brand"}, "new": {"id": "customer_brand", "type": "text", "label": "Customer / Brand", "suggestFrom": {"form": "FRM-011", "grid": "contacts", "field": "_label", "where": {"column": "group", "equals": "Customer (brand owner)"}, "current": true, "drafts": true}}}, {"form": "FRM-701", "field": "customer", "old": {"id": "customer", "type": "text", "label": "Customer", "width": "third", "showInList": true}, "new": {"id": "customer", "type": "text", "label": "Customer", "width": "third", "showInList": true, "suggestFrom": {"form": "FRM-011", "grid": "contacts", "field": "_label", "where": {"column": "group", "equals": "Customer (brand owner)"}, "current": true, "drafts": true}}}, {"form": "FRM-703", "field": "customer", "old": {"id": "customer", "type": "text", "label": "Customer", "width": "third", "scanFact": "none"}, "new": {"id": "customer", "type": "text", "label": "Customer", "width": "third", "scanFact": "none", "suggestFrom": {"form": "FRM-011", "grid": "contacts", "field": "_label", "where": {"column": "group", "equals": "Customer (brand owner)"}, "current": true, "drafts": true}}}, {"form": "FRM-704", "field": "customer_brand", "old": {"id": "customer_brand", "help": "Whose name is on the pack. Adventure Bakery for the site's own product.", "type": "text", "label": "Customer / brand", "width": "half", "required": true, "showInList": true}, "new": {"id": "customer_brand", "help": "Whose name is on the pack. Adventure Bakery for the site's own product.", "type": "text", "label": "Customer / brand", "width": "half", "required": true, "showInList": true, "suggestFrom": {"form": "FRM-011", "grid": "contacts", "field": "_label", "where": {"column": "group", "equals": "Customer (brand owner)"}, "current": true, "drafts": true}}}, {"form": "FRM-801", "field": "customer", "old": {"id": "customer", "type": "text", "label": "Customer", "width": "half", "required": true, "showInList": true}, "new": {"id": "customer", "type": "text", "label": "Customer", "width": "half", "required": true, "showInList": true, "suggestFrom": {"form": "FRM-011", "grid": "contacts", "field": "_label", "where": {"column": "group", "equals": "Customer (brand owner)"}, "current": true, "drafts": true}}}]$j$::jsonb;
  t jsonb;
  doc_id uuid;
  n_docs int;
  cur jsonb;
  n_same int;
begin
  -- The table and the group read from FRM-011 must exist there, or every list would come back quietly empty.
  if not exists (select 1 from public.sop_documents d,
                        jsonb_array_elements(d.content->'form_schema'->'sections') s,
                        jsonb_array_elements(s->'fields') f,
                        jsonb_array_elements(f->'columns') c
                  where d.sop_number = 'FRM-011' and d.status = 'active' and f->>'id' = 'contacts'
                    and (f->'rows'->>'deletable')::boolean
                    and c->>'id' = 'group' and c->'options' ? 'Customer (brand owner)') then
    raise exception 'FRM-011 no longer has the contacts table with a Customer (brand owner) group';
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
