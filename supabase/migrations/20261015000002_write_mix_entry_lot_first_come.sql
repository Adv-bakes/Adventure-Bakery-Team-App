-- The lot on the container, first come first served (owner, 2026-10-15).
--
-- With two people weighing one lot a batch each (20261015000001), the lot of each ingredient was
-- asked only with batch 1, so the batch 2 tablet waited on batch 1. Now whichever tablet weighs an
-- ingredient first enters its lot. To keep two tablets that type a lot at the same moment from
-- replacing each other, the screen sends a lot it was not shown as `supplier_lot_if_blank`: written
-- only while the line has no lot, otherwise left as it is (the screen then says what is there).
-- `supplier_lot` still overwrites: that is a lot the screen showed and the person changed.
--
-- Same function, one more key; everything else unchanged.

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
        if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}')::numeric not in (1, 2, 3) then
          raise exception 'The number of batches is 1, 2 or 3.';
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
      if v_key in ('actual_qty', 'actual_qty_2', 'actual_qty_3') then
        if v_row.form_number = 'FRM-530' and v_key <> 'actual_qty' then raise exception 'A batch made here has one weight.'; end if;
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
