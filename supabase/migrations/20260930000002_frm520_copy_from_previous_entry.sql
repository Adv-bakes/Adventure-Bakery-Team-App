-- FRM-520 Production Lot Record: turn on "Copy from a previous entry" (owner, 2026-09-30).
--
-- The ingredient lines of a product's sheet repeat from bake to bake; only the lots change. The owner
-- wants to pick WHICH earlier entry to copy from a list - a Coconut Rum Cake with its own Flavco flavoring
-- must start from a Coconut Rum Cake sheet, not from whatever was entered last. The app reads
-- settings.copyFrom (copyFromEntry in src/lib/formSchema.ts): product and the ingredient grid are copied,
-- and the grid's supplier lots and notes are blanked, so a lot is never inherited from another day.
-- Lot code, dates, packing, rework and the signature are never copied.
-- Runs after 20260930000001 (the FRM-510 -> FRM-520 renumber). FRM-520 is still DRAFT.

begin;

do $guard$
declare fs jsonb;
begin
  select content->'form_schema' into fs from public.sop_documents where sop_number = 'FRM-520' and status = 'draft';
  if fs is null then
    raise exception 'FRM-520 is missing or not a draft - push 20260930000001 first.';
  end if;
  if (select count(*) from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
       where f->>'id' = 'product'
          or (f->>'id' = 'ingredients'
              and (select count(*) from jsonb_array_elements(f->'columns') c
                    where c->>'id' in ('supplier_lot', 'notes')) = 2)) <> 2 then
    raise exception 'FRM-520 does not have the product field and the ingredient grid this setting names.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(content, '{form_schema,settings,copyFrom}',
         '{"fields": ["product", "ingredients"], "clear": {"ingredients": ["supplier_lot", "notes"]}}'::jsonb)
 where sop_number = 'FRM-520' and status = 'draft';

do $verify$
begin
  if (select content->'form_schema'->'settings'->'copyFrom'->'clear'->'ingredients'
        from public.sop_documents where sop_number = 'FRM-520') <> '["supplier_lot", "notes"]'::jsonb then
    raise exception 'FRM-520 copyFrom setting was not written.';
  end if;
end $verify$;

commit;
