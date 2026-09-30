-- FRM-520: a grey, confirm-to-accept suggestion for "Actual qty weighed" (owner, 2026-09-30).
--
-- The owner wants entry sped up WITHOUT prefilling the actual, because a line worker would accept a prefilled
-- weight without checking it. So the cell stays empty and shows, in grey, expected per batch x number of
-- batches (actual is the total across all batches); the worker taps the check beside it to enter that number,
-- or types what was really weighed. Nothing is suggested until Number of batches is filled in - guessing one
-- batch would offer the wrong total. The app side is GridColumn.suggestFrom / suggestedCellValue.
-- FRM-520 is still DRAFT. Guarded on its md5 after 20260930000004 (attachments excluded).

begin;

do $guard$
declare h text; st text;
begin
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FRM-520';
  if st is distinct from 'draft' or h <> 'ab783e88486324a6e8707fe1d999f3d8' then
    raise exception 'FRM-520 is % or changed since review (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents d
   set content = jsonb_set(d.content, '{form_schema,sections}', (
         select jsonb_agg(
                  jsonb_set(s, '{fields}', (
                    select jsonb_agg(
                             case when f->>'id' = 'ingredients' then jsonb_set(f, '{columns}', (
                                    select jsonb_agg(case when c->>'id' = 'actual_qty'
                                                          then c || '{"suggestFrom": {"column": "expected_qty", "times": "batches"}}'::jsonb
                                                          else c end order by co)
                                      from jsonb_array_elements(f->'columns') with ordinality z(c, co)))
                                  else f end order by fo)
                      from jsonb_array_elements(s->'fields') with ordinality x(f, fo)))
                  order by so)
           from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality y(s, so)))
 where d.sop_number = 'FRM-520' and d.status = 'draft';

do $verify$
begin
  if (select c->'suggestFrom'
        from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
             jsonb_array_elements(s->'fields') f, jsonb_array_elements(f->'columns') c
       where d.sop_number = 'FRM-520' and f->>'id' = 'ingredients' and c->>'id' = 'actual_qty')
     is distinct from '{"column": "expected_qty", "times": "batches"}'::jsonb then
    raise exception 'FRM-520 actual_qty suggestFrom was not written.';
  end if;
end $verify$;

commit;
