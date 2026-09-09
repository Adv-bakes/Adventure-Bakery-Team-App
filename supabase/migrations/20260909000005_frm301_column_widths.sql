-- FRM-301 Receiving Log: rebalance the column widths now that there are fourteen.
--
-- WHAT THIS DOES AND DOES NOT DO. `width` is a relative flex weight: each column gets
-- width/total of the table, ABOVE its own per-type minimum. It therefore redistributes space, it
-- does not create any. The grid's floor is computed from column TYPES, not widths -
-- 130px per pass_fail column, 90px per other, plus the scan and delete gutters - which for
-- fourteen columns is about 1450px. So the grid still scrolls sideways on a laptop after this,
-- and no choice of weights would change that. What this fixes is the distribution: every column
-- currently weighs 1, so Material Description and Comments get the same share as Receiver
-- Initials, and on a wide screen the free-text columns are cramped while a two-character
-- initials box is given the same room.
--
-- WEIGHTS ARE BY EXPECTED CONTENT, not by importance. Material Description (5) holds the longest
-- free text; Comments (4) holds sentences; supplier, lot and carrier (3) hold names and codes;
-- the pass_fail columns (2) are three fixed buttons that already have the larger 130px floor and
-- gain nothing from more weight; Receiver Initials (1) holds two or three characters.
--
-- Integers only, deliberately: GridColumnsEditor's Width input is min=1 step=1, so a fractional
-- weight written here could not be edited in the UI without snapping to a different value.
--
-- This runs after 20260909000004, which adds net_weight. Every one of the fourteen columns must
-- be named below - an unmapped column would silently keep weight 1 and be squeezed by everything
-- this migration widens, which is the failure worth guarding against.

begin;

do $$
declare
  r record;
begin
  select status,
         (content #>> '{form_schema,sections,0,fields,0,id}') as grid_id,
         jsonb_array_length(content #> '{form_schema,sections,0,fields,0,columns}') as cols
    into r
    from public.sop_documents where sop_number = 'FRM-301';

  if r.status is distinct from 'active' or r.grid_id is distinct from 'receiving_log' then
    raise exception 'FRM-301 is %/% , expected active/receiving_log.', r.status, r.grid_id;
  end if;
  if r.cols <> 14 then
    raise exception 'Receiving Log has % columns, expected 14 (20260909000004 must run first).', r.cols;
  end if;
end $$;

create temporary table frm301_widths_before on commit drop as
select md5((content #- '{form_schema,sections,0,fields,0,columns}')::text) as rest_h,
       (select jsonb_agg(c.col - 'width' order by c.ord)
          from jsonb_array_elements(content #> '{form_schema,sections,0,fields,0,columns}')
               with ordinality c(col, ord))                                as cols_no_width
  from public.sop_documents where sop_number = 'FRM-301';

-- Every column must be named, and the migration refuses if one is not. Written as a
-- select-from-values rather than a create-then-insert so the table name is never followed by a
-- parenthesised column list: check-migration-sql.py reads `identifier(` as a function call and
-- would report the table as an unknown function.
create temporary table frm301_widths on commit drop as
select * from (values
  ('time_of_arrival'::text,          2::int),
  ('po_number',                      2),
  ('supplier_name',                  3),
  ('material_description',           5),
  ('lot_batch_number',               3),
  ('carrier_name_seal',              3),
  ('qty_received',                   2),
  ('net_weight',                     2),
  ('carrier_cleanliness',            2),
  ('pkg_integrity_damage',           2),
  ('temp',                           2),
  ('approved_supplier_coa_log_coc',  2),
  ('receiver_initals',               1),
  ('comments_hold_status',           4)
) as w(id, width);

do $$
declare missing text;
begin
  select string_agg(c.col->>'id', ', ')
    into missing
    from public.sop_documents d,
         lateral jsonb_array_elements(d.content #> '{form_schema,sections,0,fields,0,columns}') as c(col)
    left join frm301_widths w on w.id = c.col->>'id'
   where d.sop_number = 'FRM-301' and w.id is null;
  if missing is not null then
    raise exception 'These columns have no width assigned: %. Add them before applying.', missing;
  end if;
end $$;

update public.sop_documents d
   set content = jsonb_set(
                   d.content,
                   '{form_schema,sections,0,fields,0,columns}',
                   (select jsonb_agg(jsonb_set(c.col, '{width}', to_jsonb(w.width)) order by c.ord)
                      from jsonb_array_elements(d.content #> '{form_schema,sections,0,fields,0,columns}')
                           with ordinality c(col, ord)
                      join frm301_widths w on w.id = c.col->>'id'))
 where d.sop_number = 'FRM-301' and d.status = 'active';

do $$
declare
  r record;
  drift int;
  wrong text;
begin
  select jsonb_array_length(content #> '{form_schema,sections,0,fields,0,columns}') as cols,
         (content #>> '{form_schema,sections,0,fields,0,columns,3,width}')  as desc_w,
         (content #>> '{form_schema,sections,0,fields,0,columns,12,width}') as init_w,
         (content #>> '{form_schema,sections,0,fields,0,columns,7,id}')     as c7
    into r
    from public.sop_documents where sop_number = 'FRM-301';

  if r.cols <> 14 then
    raise exception 'Column count changed to %.', r.cols;
  end if;
  if r.c7 is distinct from 'net_weight' then
    raise exception 'Column order moved: index 7 is % , expected net_weight.', r.c7;
  end if;
  -- The two ends of the range, so a silently-uniform result cannot pass.
  if r.desc_w is distinct from '5' or r.init_w is distinct from '1' then
    raise exception 'Widths did not land (description=%, initials=%).', r.desc_w, r.init_w;
  end if;

  select string_agg(c.col->>'id', ', ')
    into wrong
    from public.sop_documents d,
         lateral jsonb_array_elements(d.content #> '{form_schema,sections,0,fields,0,columns}') as c(col)
    join frm301_widths w on w.id = c.col->>'id'
   where d.sop_number = 'FRM-301' and (c.col->>'width')::int is distinct from w.width;
  if wrong is not null then
    raise exception 'These columns did not get their intended width: %.', wrong;
  end if;

  -- Nothing changed except the width key on each column.
  select count(*) into drift
    from public.sop_documents d, frm301_widths_before b
   where d.sop_number = 'FRM-301'
     and (md5((d.content #- '{form_schema,sections,0,fields,0,columns}')::text) is distinct from b.rest_h
       or (select jsonb_agg(c.col - 'width' order by c.ord)
             from jsonb_array_elements(d.content #> '{form_schema,sections,0,fields,0,columns}')
                  with ordinality c(col, ord)) is distinct from b.cols_no_width);
  if drift <> 0 then
    raise exception 'FRM-301 changed beyond the width keys. Rolled back.';
  end if;
end $$;

commit;
