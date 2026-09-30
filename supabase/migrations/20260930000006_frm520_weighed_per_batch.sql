-- FRM-520: one "weighed" column per batch (owner, 2026-09-30).
--
-- 20260930000005 suggested expected-per-batch x batches in a single "all batches" actual. The owner: each
-- batch is weighed separately, so one total would hide the weighings - and the paper prep sheet already
-- records them per batch (Batch 1 / 2 / 3, each with its qty and initials). So:
--   actual_qty    -> "Batch 1 weighed" (id kept, so nothing already entered moves);
--   actual_qty_2  -> "Batch 2 weighed" (new);  actual_qty_3 -> "Batch 3 weighed" (new).
-- Each shows the expected PER-BATCH quantity as the grey, confirm-to-accept suggestion - no multiplying.
-- None is required: a one-batch day leaves 2 and 3 empty, and the pan spray has none. "Copy from a previous
-- entry" blanks all three. Number of batches stays, as a plain count. FRM-520 is still DRAFT.
-- Guarded on its md5 after 20260930000005 (attachments excluded).

begin;

do $guard$
declare h text; st text;
begin
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FRM-520';
  if st is distinct from 'draft' or h <> '9472b63def0c1f77332f45e4660de16a' then
    raise exception 'FRM-520 is % or changed since review (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents d
   set content = jsonb_set(jsonb_set(d.content, '{form_schema,sections}', (
         select jsonb_agg(
                  jsonb_set(s, '{fields}', (
                    select jsonb_agg(
                             case
                               when f->>'id' = 'ingredients' then jsonb_set(f, '{columns}', (
                                 select jsonb_agg(c order by co) from (
                                   select case when col->>'id' = 'actual_qty'
                                               then (col - 'suggestFrom') || '{"label": "Batch 1 weighed", "suggestFrom": {"column": "expected_qty"}}'::jsonb
                                               else col end as c, (ci * 10) as co
                                     from jsonb_array_elements(f->'columns') with ordinality z(col, ci)
                                   union all
                                   select '{"id": "actual_qty_2", "label": "Batch 2 weighed", "type": "number", "width": 1, "scanFact": "none", "suggestFrom": {"column": "expected_qty"}}'::jsonb,
                                          (select (ci * 10) + 1 from jsonb_array_elements(f->'columns') with ordinality z2(col, ci) where col->>'id' = 'actual_qty')
                                   union all
                                   select '{"id": "actual_qty_3", "label": "Batch 3 weighed", "type": "number", "width": 1, "scanFact": "none", "suggestFrom": {"column": "expected_qty"}}'::jsonb,
                                          (select (ci * 10) + 2 from jsonb_array_elements(f->'columns') with ordinality z3(col, ci) where col->>'id' = 'actual_qty')
                                 ) q))
                               when f->>'id' = 'batches' then f || '{"help": "How many batches were mixed. Each batch is weighed and written in its own column below."}'::jsonb
                               else f end order by fo)
                      from jsonb_array_elements(s->'fields') with ordinality x(f, fo)))
                  order by so)
           from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality y(s, so))),
         '{form_schema,settings,copyFrom,clear,ingredients}', '["supplier_lot", "actual_qty", "actual_qty_2", "actual_qty_3", "notes"]'::jsonb)
 where d.sop_number = 'FRM-520' and d.status = 'draft';

do $verify$
declare fs jsonb;
begin
  select content->'form_schema' into fs from public.sop_documents where sop_number = 'FRM-520';
  if (select string_agg(c->>'id', ',' order by ord)
        from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f,
             jsonb_array_elements(f->'columns') with ordinality w(c, ord)
       where f->>'id' = 'ingredients') <> 'ingredient,brand,supplier_lot,expected_qty,unit,actual_qty,actual_qty_2,actual_qty_3,notes' then
    raise exception 'FRM-520 ingredient columns are not in the expected order.';
  end if;
  if (select count(*) from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f,
                           jsonb_array_elements(f->'columns') c
       where f->>'id' = 'ingredients' and c->'suggestFrom' = '{"column": "expected_qty"}'::jsonb) <> 3 then
    raise exception 'FRM-520 weighed columns do not all carry the per-batch suggestion.';
  end if;
  if fs->'settings'->'copyFrom'->'clear'->'ingredients' <> '["supplier_lot", "actual_qty", "actual_qty_2", "actual_qty_3", "notes"]'::jsonb then
    raise exception 'FRM-520 copyFrom does not blank every weighed column.';
  end if;
end $verify$;

commit;
