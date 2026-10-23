-- write_mix_entry for any number of batches (FRM-520 v3, previous migration).
--
-- A lot record's weights are now one cell per ingredient, "Weighed per batch": "B1: 17.49; B2: 17.5".
-- The mixing screens send ONE batch's weight as { "weighed_batches": { "batch": 4, "weight": 17.5 } },
-- and this function merges it into the cell under the row lock, so two tablets weighing the same
-- ingredient for different batches never overwrite each other. "batches" is any whole number from 1.
-- FRM-530 (a batch made here) keeps its one weight column, actual_qty.
--
-- THE CELL FORMAT HAS A TWIN in src/lib/batchWeights.ts (parseBatchWeights / setBatchWeight); change
-- both together. mix_set_batch_weight is that twin, kept as its own function so it can be checked.
--
-- A cell holding something typed by hand that is not "B<n>: <number>" is never merged into: the
-- function refuses, and the screen sends the person to the record.

create or replace function public.mix_set_batch_weight(_cell text, _batch int, _weight jsonb)
returns text
language plpgsql immutable
as $$
declare
  v_w jsonb := '{}'::jsonb;
  v_part text;
  v_m text[];
  v_out text;
begin
  if _batch is null or _batch < 1 then raise exception 'A batch is a whole number from 1.'; end if;
  if btrim(coalesce(_cell, '')) <> '' then
    foreach v_part in array regexp_split_to_array(btrim(_cell), E'\\s*[;\\n]\\s*') loop
      v_part := btrim(v_part);
      continue when v_part = '';
      v_m := regexp_match(v_part, E'^[bB]?\\s*(\\d+)\\s*[:=)]?\\s*(\\d+(?:\\.\\d+)?)$');
      if v_m is null or v_m[1]::int < 1 then
        raise exception 'The weights of this ingredient were typed on the lot record by hand and cannot be added to from here. Open the lot record.';
      end if;
      v_w := v_w || jsonb_build_object(v_m[1]::int::text, v_m[2]);
    end loop;
  end if;
  if _weight is null or (jsonb_typeof(_weight) = 'string' and _weight #>> '{}' = '') then
    v_w := v_w - _batch::text;
  elsif jsonb_typeof(_weight) = 'number' and (_weight #>> '{}')::numeric >= 0 then
    v_w := v_w || jsonb_build_object(_batch::text, _weight #>> '{}');
  else
    raise exception 'A weight is a number, and not negative.';
  end if;
  select string_agg('B' || key || ': ' || value, '; ' order by key::int) into v_out
    from jsonb_each_text(v_w) where value <> '';
  return coalesce(v_out, '');
end $$;

create or replace function public.write_mix_entry(
  _response_id uuid,
  _index int,          -- the line's position in the ingredients table; null for a top-level answer
  _ingredient text,
  _brand text,
  _set jsonb           -- the cells (or top-level answers) to write
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.sop_document_responses%rowtype;
  v_rev text;
  v_line jsonb;
  v_key text;
  v_val jsonb;
  v_n numeric;
begin
  if not public.is_staff_or_admin(auth.uid()) then
    raise exception 'Only team members can record mixing.' using errcode = '42501';
  end if;
  if _set is null or jsonb_typeof(_set) <> 'object' or _set = '{}'::jsonb then
    raise exception 'Nothing to write.';
  end if;

  select * into v_row from public.sop_document_responses where id = _response_id for update;
  if v_row.id is null then return jsonb_build_object('outcome', 'record'); end if;
  select d.revision into v_rev from public.sop_documents d where d.id = v_row.document_id;
  if v_row.status <> 'draft'
     or coalesce(v_row.form_number, '') not in ('FRM-520', 'FRM-530')
     or v_row.form_revision is distinct from v_rev then
    return jsonb_build_object('outcome', 'record');
  end if;

  if _index is null then
    -- Top-level answers of the lot record only.
    for v_key, v_val in select * from jsonb_each(_set) loop
      if v_row.form_number <> 'FRM-520' then raise exception 'Not an answer of this record: %', v_key; end if;
      if v_key = 'batches' then
        if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}')::numeric < 1
           or (v_val #>> '{}')::numeric <> trunc((v_val #>> '{}')::numeric) then
          raise exception 'The number of batches is a whole number from 1.';
        end if;
      elsif v_key = 'rework' then
        if jsonb_typeof(v_val) <> 'string' or length(v_val #>> '{}') > 500 then raise exception 'The rework answer is text.'; end if;
      else
        raise exception 'Not an answer the mixing step writes: %', v_key;
      end if;
      v_row.data := jsonb_set(coalesce(v_row.data, '{}'::jsonb), array[v_key], v_val);
    end loop;
  else
    v_line := v_row.data->'ingredients'->_index;
    if v_line is null or jsonb_typeof(v_line) <> 'object'
       or btrim(coalesce(v_line->>'ingredient', '')) <> btrim(coalesce(_ingredient, ''))
       or btrim(coalesce(v_line->>'brand', '')) <> btrim(coalesce(_brand, '')) then
      return jsonb_build_object('outcome', 'moved');
    end if;
    for v_key, v_val in select * from jsonb_each(_set) loop
      if v_key = 'weighed_batches' then
        -- One batch's weight of a lot record, merged into the line's cell.
        if v_row.form_number <> 'FRM-520' then raise exception 'A batch made here has one weight.'; end if;
        if jsonb_typeof(v_val) <> 'object' or jsonb_typeof(v_val->'batch') <> 'number' then
          raise exception 'A batch weight names its batch.';
        end if;
        v_val := to_jsonb(public.mix_set_batch_weight(v_line->>'weighed_batches', (v_val->>'batch')::int, v_val->'weight'));
      elsif v_key = 'actual_qty' then
        if v_row.form_number <> 'FRM-530' then raise exception 'A lot record''s weights are written per batch.'; end if;
        -- A weight is a number, or "" to clear a line the formula gives no quantity.
        if jsonb_typeof(v_val) = 'number' then
          v_n := (v_val #>> '{}')::numeric;
          if v_n < 0 then raise exception 'A weight cannot be negative.'; end if;
        elsif not (jsonb_typeof(v_val) = 'string' and v_val #>> '{}' = '') then
          raise exception 'A weight is a number.';
        end if;
      elsif v_key = 'supplier_lot_if_blank' then
        if jsonb_typeof(v_val) <> 'string' or length(v_val #>> '{}') > 200 then raise exception 'A lot code is text.'; end if;
        if btrim(coalesce(v_line->>'supplier_lot', '')) = '' then
          v_line := jsonb_set(v_line, array['supplier_lot'], to_jsonb(btrim(v_val #>> '{}')));
        end if;
        continue;
      elsif v_key = 'supplier_lot' then
        if jsonb_typeof(v_val) <> 'string' or length(v_val #>> '{}') > 200 then raise exception 'A lot code is text.'; end if;
        v_val := to_jsonb(btrim(v_val #>> '{}'));
      elsif v_key = 'unit' then
        if jsonb_typeof(v_val) <> 'string' or length(v_val #>> '{}') > 40 then raise exception 'A unit is text.'; end if;
      else
        raise exception 'Not a cell the mixing step writes: %', v_key;
      end if;
      v_line := jsonb_set(v_line, array[v_key], v_val);
    end loop;
    v_row.data := jsonb_set(v_row.data, array['ingredients', _index::text], v_line);
  end if;

  update public.sop_document_responses
     set data = v_row.data, updated_by = auth.uid()
   where id = _response_id
  returning * into v_row;
  return jsonb_build_object('outcome', 'saved', 'response', to_jsonb(v_row));
end $$;

revoke all on function public.write_mix_entry(uuid, int, text, text, jsonb) from public;
grant execute on function public.write_mix_entry(uuid, int, text, text, jsonb) to authenticated;
