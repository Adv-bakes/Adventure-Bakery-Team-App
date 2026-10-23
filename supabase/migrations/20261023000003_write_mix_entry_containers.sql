-- write_mix_entry: another container of an ingredient (owner, 2026-10-23).
--
-- When a container runs out part way through the batches, the next one has its own lot, and the
-- record must say which batches came from which. The mixing screen's "Another container" adds a line
-- of the same ingredient and brand at the END of the table (so no other line moves under another
-- tablet), lot and weights blank: { "add_container": true } on the line it copies. A line added by
-- mistake is taken back with { "remove_line": true }: only the last line of the table, still empty
-- (no lot, weight or notes), while another line of the ingredient stays - the same rule as
-- removeMixLine in src/lib/lotFlow.ts. Both work for any team member, as the other mixing answers do,
-- because RLS lets staff update only a draft they created.
--
-- Same function as 20261023000002 otherwise.

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
  v_new jsonb;
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
    -- Another container of this ingredient: a new line of the same ingredient at the END of the table
    -- (no other line moves), lot and weights blank. Or take such a line back: only the last line,
    -- still empty, while another line of the ingredient stays.
    if _set ? 'add_container' or _set ? 'remove_line' then
      if (select count(*) from jsonb_object_keys(_set)) <> 1 then raise exception 'One change at a time.'; end if;
      if _set ? 'add_container' then
        if coalesce(v_line->>'_stage', '') = 'dunking' then raise exception 'Not a mixing line.'; end if;
        select coalesce(jsonb_object_agg(k, to_jsonb(''::text)), '{}'::jsonb) into v_new from jsonb_object_keys(v_line) k;
        v_new := v_new || jsonb_build_object(
          'ingredient', v_line->'ingredient', 'brand', coalesce(v_line->'brand', '""'::jsonb),
          'expected_qty', coalesce(v_line->'expected_qty', '""'::jsonb), 'unit', coalesce(v_line->'unit', '""'::jsonb));
        v_row.data := jsonb_set(v_row.data, '{ingredients}', (v_row.data->'ingredients') || jsonb_build_array(v_new));
      else
        if _index <> jsonb_array_length(v_row.data->'ingredients') - 1
           or coalesce(v_line->>'_stage', '') = 'dunking'
           or btrim(coalesce(v_line->>'supplier_lot', '')) <> '' or btrim(coalesce(v_line->>'notes', '')) <> ''
           or btrim(coalesce(v_line->>'weighed_batches', '')) <> '' or btrim(coalesce(v_line->>'actual_qty', '')) <> '' then
          raise exception 'Only an empty line added last can be taken back.';
        end if;
        if not exists (
          select 1 from jsonb_array_elements(v_row.data->'ingredients') with ordinality t(x, i)
           where i - 1 <> _index and coalesce(x->>'_stage', '') <> 'dunking'
             and lower(btrim(coalesce(x->>'ingredient', ''))) = lower(btrim(coalesce(v_line->>'ingredient', '')))
             and lower(btrim(coalesce(x->>'brand', ''))) = lower(btrim(coalesce(v_line->>'brand', '')))) then
          raise exception 'The only line of an ingredient cannot be taken back.';
        end if;
        v_row.data := v_row.data #- array['ingredients', _index::text];
      end if;
      update public.sop_document_responses
         set data = v_row.data, updated_by = auth.uid()
       where id = _response_id
      returning * into v_row;
      return jsonb_build_object('outcome', 'saved', 'response', to_jsonb(v_row));
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
