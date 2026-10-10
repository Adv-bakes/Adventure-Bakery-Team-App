-- FRM-507 and FRM-606: "Deviations on this day" gets a resting value.
--
-- Owner's decision, 2026-10-10 (Gabriela approved): Section 3 of the two CCP records is now worked
-- out by the app from the oven loads and the seal checks, so its question is answered "None" on an
-- ordinary day. Section 3 starts collapsed and opens when it holds an answer - which that "None"
-- would be, every day. `restingValue` on the select names the option that means nothing to report,
-- and the section stays one line while the answer is that option.
--
-- Nothing printed on either form changes and the revisions stay as they are. Safe to run twice: a
-- field that already carries the value is left alone, so no second history snapshot is taken.
-- Any other shape stops the migration.

do $$
declare
  t record;
  d record;
  cur jsonb;
  n_docs int;
begin
  for t in select * from (values
      ('FRM-507', 'None - every load met the limits'),
      ('FRM-606', 'None - every check passed')) as v(form, resting)
  loop
    select count(*) into n_docs from public.sop_documents where sop_number = t.form;
    if n_docs <> 1 then
      raise exception '%: expected one document, found %', t.form, n_docs;
    end if;
    select * into d from public.sop_documents where sop_number = t.form;

    select f into cur
      from jsonb_array_elements(d.content->'form_schema'->'sections') s, jsonb_array_elements(s->'fields') f
     where f->>'id' = 'deviations_today';
    if cur is null or cur->>'type' <> 'select' or not (cur->'options') ? t.resting then
      raise exception '%: deviations_today is not the select this migration was written against', t.form;
    end if;
    if cur->>'restingValue' = t.resting then
      raise notice '%: already set, left alone', t.form;
      continue;
    end if;
    if cur ? 'restingValue' then
      raise exception '%: deviations_today already carries another resting value', t.form;
    end if;

    update public.sop_documents x
       set content = jsonb_set(x.content, '{form_schema,sections}', (
             select jsonb_agg(
                      jsonb_set(s, '{fields}', (
                        select jsonb_agg(case when f->>'id' = 'deviations_today' then f || jsonb_build_object('restingValue', t.resting) else f end order by fo)
                          from jsonb_array_elements(s->'fields') with ordinality as z(f, fo)
                      ))
                      order by so)
               from jsonb_array_elements(x.content->'form_schema'->'sections') with ordinality as y(s, so)
           ))
     where x.id = d.id;
  end loop;
end $$;
