-- FRM-801 v2: require Customer, Product and Lot / batch code.
--
-- WHY. 2.6.3.1 requires records of "finished product dispatch AND DESTINATION". As issued, FRM-801
-- required the vehicle registration but not the customer, the product or the lot code - so a valid
-- submitted record could say which truck came, that it was checked, that the load was secured and who
-- signed, and never say what was on it or who received it. In a recall the question is where lot X
-- went, and FRM-801 is the only record that joins a lot to a load to a customer: FRM-701 is per batch
-- and carries no vehicle, and FRM-301 is receiving.
--
-- WHAT IS NOT CHANGED, AND ON PURPOSE: the "loaded" grid itself stays optional, so a record can still
-- be submitted with no rows in it. That is not an oversight. A vehicle that FAILS the check is refused
-- and nothing is loaded, and that refusal is exactly what Section 2 exists to record - requiring at
-- least one loaded row would make the refusal record impossible to submit. gridZod only enforces a
-- column's `required` on rows the filler actually started (rowStarted in formSchema.ts), so a refusal
-- record with an empty grid still validates while a load that lists a product must also carry its lot.
--
-- REVISION, NOT EDIT. FRM-801 went active earlier today. Changing a published form's schema is a
-- revision under document control, so it goes to v2 under the same approval and effective date, and
-- the sop_document_history trigger snapshots the New row on the way past. It has no entries, so no
-- response's pinned form_revision is affected and nothing lands in "Unmapped answers"; the guard
-- refuses to run if that has stopped being true.

begin;

create temporary table _f801 on commit drop as
select d.id,
       d.content->'form_schema' as schema_before,
       (select string_agg(f->>'id' || '|' || coalesce(f->>'label','') || '|' || coalesce(f->>'type',''), ',')
          from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality s(sec, so),
               jsonb_array_elements(s.sec->'fields') with ordinality ff(f, fo))            as shape_before,
       (select string_agg(c->>'id' || '|' || coalesce(c->>'label',''), ',')
          from jsonb_array_elements(d.content->'form_schema'->'sections') s(sec),
               jsonb_array_elements(s.sec->'fields') ff(f),
               jsonb_array_elements(ff.f->'columns') cc(c))                                as cols_before,
       (select count(*)
          from jsonb_array_elements(d.content->'form_schema'->'sections') s(sec),
               jsonb_array_elements(s.sec->'fields') ff(f)
         where (ff.f->>'required')::boolean)                                               as req_fields_before,
       (select count(*)
          from jsonb_array_elements(d.content->'form_schema'->'sections') s(sec),
               jsonb_array_elements(s.sec->'fields') ff(f),
               jsonb_array_elements(ff.f->'columns') cc(c)
         where (cc.c->>'required')::boolean)                                               as req_cols_before
  from public.sop_documents d
 where d.sop_number = 'FRM-801';

do $$
declare r record;
begin
  select
    (select status from public.sop_documents where sop_number = 'FRM-801')   as st,
    (select revision from public.sop_documents where sop_number = 'FRM-801') as rev,
    (select count(*) from public.sop_document_responses rr
       join public.sop_documents dd on dd.id = rr.document_id
      where dd.sop_number = 'FRM-801')                                       as entries,
    (select count(*) from _f801 b,
            jsonb_array_elements(b.schema_before->'sections') s(sec),
            jsonb_array_elements(s.sec->'fields') ff(f)
      where ff.f->>'id' = 'customer' and coalesce((ff.f->>'required')::boolean, false)) as cust_req,
    (select count(*) from _f801 b,
            jsonb_array_elements(b.schema_before->'sections') s(sec),
            jsonb_array_elements(s.sec->'fields') ff(f),
            jsonb_array_elements(ff.f->'columns') cc(c)
      where ff.f->>'id' = 'loaded' and cc.c->>'id' in ('product', 'lot_code')
        and coalesce((cc.c->>'required')::boolean, false))                   as col_req,
    (select count(*) from _f801 b,
            jsonb_array_elements(b.schema_before->'sections') s(sec),
            jsonb_array_elements(s.sec->'fields') ff(f))                     as fields
  into r;

  if r.st is distinct from 'active' then
    raise exception 'FRM-801 is %, expected active.', r.st;
  end if;
  if r.rev is distinct from 'New' then
    raise exception 'FRM-801 is revision %, expected New.', r.rev;
  end if;
  -- A response pins form_revision at creation; with none, no answer can be stranded.
  if r.entries <> 0 then
    raise exception 'FRM-801 has % entries; tightening required is a change to a form in use.', r.entries;
  end if;
  if r.fields <> 22 then
    raise exception 'FRM-801 has % fields, expected 22.', r.fields;
  end if;
  if r.cust_req <> 0 or r.col_req <> 0 then
    raise exception 'Already required (customer=%, columns=%).', r.cust_req, r.col_req;
  end if;
end $$;

-- Rebuild sections, preserving order at every level; touch nothing but three `required` flags.
with rebuilt as (
  select d.id,
         jsonb_agg(
           jsonb_set(s.sec, '{fields}', (
             select jsonb_agg(
                      case
                        when ff.f->>'id' = 'customer'
                          then jsonb_set(ff.f, '{required}', 'true'::jsonb)
                        when ff.f->>'id' = 'loaded'
                          then jsonb_set(ff.f, '{columns}', (
                                 select jsonb_agg(
                                          case when cc.c->>'id' in ('product', 'lot_code')
                                               then jsonb_set(cc.c, '{required}', 'true'::jsonb)
                                               else cc.c end
                                          order by cc.ord)
                                   from jsonb_array_elements(ff.f->'columns') with ordinality cc(c, ord)))
                        else ff.f
                      end
                      order by ff.ord)
               from jsonb_array_elements(s.sec->'fields') with ordinality ff(f, ord)))
           order by s.ord)                                                   as sections
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality s(sec, ord)
   where d.sop_number = 'FRM-801'
   group by d.id
)
update public.sop_documents d
   set content  = jsonb_set(d.content, '{form_schema,sections}', r.sections),
       revision = 'v2'
  from rebuilt r
 where d.id = r.id;

do $$
declare r record;
begin
  select
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s(sec),
            jsonb_array_elements(s.sec->'fields') ff(f)
      where d.sop_number = 'FRM-801' and ff.f->>'id' = 'customer'
        and (ff.f->>'required')::boolean)                                    as cust_req,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s(sec),
            jsonb_array_elements(s.sec->'fields') ff(f),
            jsonb_array_elements(ff.f->'columns') cc(c)
      where d.sop_number = 'FRM-801' and ff.f->>'id' = 'loaded'
        and cc.c->>'id' in ('product', 'lot_code') and (cc.c->>'required')::boolean) as col_req,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s(sec),
            jsonb_array_elements(s.sec->'fields') ff(f)
      where d.sop_number = 'FRM-801' and ff.f->>'id' = 'loaded'
        and coalesce((ff.f->>'required')::boolean, false))                   as grid_req,
    (select string_agg(f->>'id' || '|' || coalesce(f->>'label','') || '|' || coalesce(f->>'type',''), ',')
       from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality s(sec, so),
            jsonb_array_elements(s.sec->'fields') with ordinality ff(f, fo)
      where d.sop_number = 'FRM-801')                                        as shape_after,
    (select string_agg(c->>'id' || '|' || coalesce(c->>'label',''), ',')
       from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s(sec),
            jsonb_array_elements(s.sec->'fields') ff(f),
            jsonb_array_elements(ff.f->'columns') cc(c)
      where d.sop_number = 'FRM-801')                                        as cols_after,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s(sec),
            jsonb_array_elements(s.sec->'fields') ff(f)
      where d.sop_number = 'FRM-801' and (ff.f->>'required')::boolean)       as req_fields_after,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s(sec),
            jsonb_array_elements(s.sec->'fields') ff(f),
            jsonb_array_elements(ff.f->'columns') cc(c)
      where d.sop_number = 'FRM-801' and (cc.c->>'required')::boolean)       as req_cols_after,
    (select revision from public.sop_documents where sop_number = 'FRM-801') as rev,
    (select status from public.sop_documents where sop_number = 'FRM-801')   as st,
    (select effective_date from public.sop_documents where sop_number = 'FRM-801') as eff,
    (select shape_before from _f801)                                         as shape_before,
    (select cols_before from _f801)                                          as cols_before,
    (select req_fields_before from _f801)                                    as rfb,
    (select req_cols_before from _f801)                                      as rcb
  into r;

  if r.cust_req <> 1 or r.col_req <> 2 then
    raise exception 'Not applied (customer=%, columns=%).', r.cust_req, r.col_req;
  end if;
  -- The grid must stay optional: a refused vehicle is loaded with nothing.
  if r.grid_req <> 0 then
    raise exception 'The loaded grid became required; a refusal record could not be submitted.';
  end if;
  -- Every field and column, in order, with its label and type, is exactly as before.
  if r.shape_after is distinct from r.shape_before then
    raise exception 'The field list changed.';
  end if;
  if r.cols_after is distinct from r.cols_before then
    raise exception 'The grid columns changed.';
  end if;
  -- Exactly three flags flipped, and nothing else gained one.
  if r.req_fields_after <> r.rfb + 1 or r.req_cols_after <> r.rcb + 2 then
    raise exception 'Wrong number of required flags (fields %->%, columns %->%).',
      r.rfb, r.req_fields_after, r.rcb, r.req_cols_after;
  end if;
  if r.rev is distinct from 'v2' or r.st is distinct from 'active'
     or r.eff is distinct from date '2026-09-10' then
    raise exception 'Stamp wrong (rev=%, status=%, eff=%).', r.rev, r.st, r.eff;
  end if;
end $$;

commit;
