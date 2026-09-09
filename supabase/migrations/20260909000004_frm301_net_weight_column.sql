-- FRM-301 Receiving Log: record the net weight printed on the pack, filled by the label scan.
--
-- WHY A TEXT COLUMN AND NOT A NUMBER. The weight arrives from the label as one string - "5 lb",
-- "16 oz" - and coerceToColumn() strips every non-numeric character before writing to a `number`
-- column. So a number column would store 5 for "5 lb" AND 16 for "16 oz", silently, with the unit
-- gone. On a receiving record that is the worst kind of wrong: plausible, and invisible. A text
-- column stores exactly what the pack says, which is also exactly what an auditor asked to see the
-- receiving record wants to read. It cannot be summed by the app; a human reads it, and that is the
-- trade the owner chose on 2026-09-09.
--
-- IT IS THE PACK'S NET WEIGHT, NOT THE DELIVERY'S. That is the only weight a camera can read,
-- because it is the only one printed on the label. The total received is this multiplied by Qty
-- Received, and is deliberately not a column: a number the receiver would have to compute by hand
-- every time is a number that will be wrong.
--
-- scanFact IS PINNED rather than left to the keyword matcher. "Net Weight (per pack)" would resolve
-- to net_weight today - the net-weight pattern is tested before the pack-size one - but that is
-- pattern ORDER deciding a compliance field, which is the same fragility the Approved Supplier
-- column was pinned to escape in 20260909000002.
--
-- THE INSERT SHIFTS COLUMN INDICES 7..12 UP BY ONE. Properties travel with their column object, so
-- the scanFact pinned on approved_supplier_coa_log_coc and the defaultTo values on time_of_arrival
-- and receiver_initals all survive - they simply live at new indices (11 and 12). Any LATER
-- index-addressed migration must re-read the array; the after-guard below asserts the new positions
-- so the shift is recorded rather than assumed.

begin;

do $$
declare
  r record;
  existing jsonb;
begin
  select status,
         (content #>> '{form_schema,sections,0,fields,0,id}')            as grid_id,
         (content #>> '{form_schema,sections,0,fields,0,scanLabel}')     as scan_on,
         jsonb_array_length(content #> '{form_schema,sections,0,fields,0,columns}') as cols,
         (content #>> '{form_schema,sections,0,fields,0,columns,6,id}')  as c6
    into r
    from public.sop_documents where sop_number = 'FRM-301';

  if r.status is distinct from 'active' or r.grid_id is distinct from 'receiving_log' then
    raise exception 'FRM-301 is %/% , expected active/receiving_log.', r.status, r.grid_id;
  end if;
  -- The scan is the whole reason this column earns its place on an already-wide grid.
  if r.scan_on is distinct from 'true' then
    raise exception 'The label scan is not enabled; 20260909000002 must run first.';
  end if;

  select c into existing
    from public.sop_documents d,
         lateral jsonb_array_elements(d.content #> '{form_schema,sections,0,fields,0,columns}') c
   where d.sop_number = 'FRM-301' and c->>'id' = 'net_weight';

  if existing is not null then
    -- Already present: a clean no-op the CLI can record, unless it is a DIFFERENT column.
    if existing->>'type' is distinct from 'text'
    or existing->>'scanFact' is distinct from 'net_weight' then
      raise exception 'A net_weight column already exists with a different shape (%). Re-read first.',
        existing::text;
    end if;
    raise notice 'FRM-301 already has the net_weight column; recording this migration as a no-op.';
  else
    if r.cols <> 13 then
      raise exception 'Receiving Log has % columns, expected 13 before the insert.', r.cols;
    end if;
    if r.c6 is distinct from 'qty_received' then
      raise exception 'Column 6 is % , expected qty_received - the new column goes after it.', r.c6;
    end if;
  end if;
end $$;

create temporary table frm301_weight_before on commit drop as
select md5((content #- '{form_schema,sections,0,fields,0,columns}')::text) as rest_h,
       (content #> '{form_schema,sections,0,fields,0,columns}')            as cols
  from public.sop_documents where sop_number = 'FRM-301';

update public.sop_documents
   set content = jsonb_insert(
                   content,
                   '{form_schema,sections,0,fields,0,columns,7}',
                   jsonb_build_object(
                     'id',       'net_weight',
                     'label',    'Net Weight (per pack)',
                     'type',     'text',
                     'width',    1,
                     'scanFact', 'net_weight'),
                   false)   -- insert BEFORE index 7, i.e. directly after Qty Received
 where sop_number = 'FRM-301' and status = 'active'
   and not exists (
     select 1 from jsonb_array_elements(content #> '{form_schema,sections,0,fields,0,columns}') c
      where c->>'id' = 'net_weight');

do $$
declare
  r record;
  drift int;
begin
  select jsonb_array_length(content #> '{form_schema,sections,0,fields,0,columns}') as cols,
         (content #>> '{form_schema,sections,0,fields,0,columns,6,id}')  as c6,
         (content #>> '{form_schema,sections,0,fields,0,columns,7,id}')  as c7,
         (content #>> '{form_schema,sections,0,fields,0,columns,7,type}') as c7_type,
         (content #>> '{form_schema,sections,0,fields,0,columns,7,scanFact}') as c7_fact,
         -- the shifted columns must have carried their pinned properties with them
         (content #>> '{form_schema,sections,0,fields,0,columns,11,id}') as c11,
         (content #>> '{form_schema,sections,0,fields,0,columns,11,scanFact}') as c11_fact,
         (content #>> '{form_schema,sections,0,fields,0,columns,12,id}') as c12,
         (content #>> '{form_schema,sections,0,fields,0,columns,12,defaultTo}') as c12_default,
         (content #>> '{form_schema,sections,0,fields,0,columns,0,defaultTo}')  as c0_default,
         (content #>> '{form_schema,sections,0,fields,0,scanNotesColumnId}')    as notes_col
    into r
    from public.sop_documents where sop_number = 'FRM-301';

  if r.cols <> 14 then
    raise exception 'Receiving Log has % columns, expected 14.', r.cols;
  end if;
  if r.c6 is distinct from 'qty_received' or r.c7 is distinct from 'net_weight' then
    raise exception 'Net Weight did not land after Qty Received (6=%, 7=%).', r.c6, r.c7;
  end if;
  if r.c7_type is distinct from 'text' or r.c7_fact is distinct from 'net_weight' then
    raise exception 'Net Weight column is %/% , expected text/net_weight.', r.c7_type, r.c7_fact;
  end if;
  -- Everything pinned by 20260909000002 and 000003 must still be in force at its new index.
  if r.c11 is distinct from 'approved_supplier_coa_log_coc' or r.c11_fact is distinct from 'none' then
    raise exception 'The Approved Supplier opt-out did not survive the shift (11=%, fact=%).',
      r.c11, r.c11_fact;
  end if;
  if r.c12 is distinct from 'receiver_initals'
  or r.c12_default is distinct from 'currentUserInitials' then
    raise exception 'The Receiver Initials default did not survive the shift (12=%, default=%).',
      r.c12, r.c12_default;
  end if;
  if r.c0_default is distinct from 'now' then
    raise exception 'The Time of Arrival default is no longer set (found %).', r.c0_default;
  end if;
  if r.notes_col is distinct from 'comments_hold_status' then
    raise exception 'The scan overflow column changed to %.', r.notes_col;
  end if;

  -- Nothing outside the columns array moved, and the columns array differs only by the
  -- one inserted element.
  select count(*) into drift
    from public.sop_documents d, frm301_weight_before b
   where d.sop_number = 'FRM-301'
     and (md5((d.content #- '{form_schema,sections,0,fields,0,columns}')::text) is distinct from b.rest_h
       or (d.content #> '{form_schema,sections,0,fields,0,columns}')
          #- '{7}' is distinct from b.cols);
  if drift <> 0 then
    raise exception 'FRM-301 changed beyond inserting one column. Rolled back.';
  end if;
end $$;

commit;
