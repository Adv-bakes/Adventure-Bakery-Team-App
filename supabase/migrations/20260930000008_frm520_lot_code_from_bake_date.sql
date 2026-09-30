-- FRM-520: the lot code fills itself from the bake date (owner, 2026-09-30).
--
-- The lot code is only the bake date written another way - last digit of the year + three-digit day of the
-- year (SOP-2.2.3, FSQM-021): 2026-09-30 -> 6273. Working out the day of the year by hand is where it goes
-- wrong, so the field is FILLED from Bake date (TextDerivation "julian_lot" in src/lib/formSchema.ts) and
-- follows it if the date is corrected, until someone types a different code. While Bake date is blank, the
-- field offers today's code as a one-tap link. Unlike the weighed quantities, this is not a default to be
-- confirmed: it asserts nothing about the product, and the pack is still checked against it on "Code on the
-- pack". FRM-520 is still DRAFT. Guarded on its md5 after 20260930000007 (attachments excluded).

begin;

do $guard$
declare h text; st text;
begin
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FRM-520';
  if st is distinct from 'draft' or h <> '7fb5b8f4671dd05d17be45da8c544562' then
    raise exception 'FRM-520 is % or changed since review (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents d
   set content = jsonb_set(d.content, '{form_schema,sections}', (
         select jsonb_agg(
                  jsonb_set(s, '{fields}', (
                    select jsonb_agg(
                             case when f->>'id' = 'lot_code'
                                  then f || '{"derive": {"fromField": "bake_date", "as": "julian_lot"}, "help": "Filled from the bake date: year digit + day of the year, e.g. 6272. Change it only if the pack was coded differently."}'::jsonb
                                  else f end order by fo)
                      from jsonb_array_elements(s->'fields') with ordinality x(f, fo)))
                  order by so)
           from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality y(s, so)))
 where d.sop_number = 'FRM-520' and d.status = 'draft';

do $verify$
begin
  if (select f->'derive' from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
                              jsonb_array_elements(s->'fields') f
       where d.sop_number = 'FRM-520' and f->>'id' = 'lot_code')
     is distinct from '{"fromField": "bake_date", "as": "julian_lot"}'::jsonb then
    raise exception 'FRM-520 lot_code derive was not written.';
  end if;
end $verify$;

commit;
