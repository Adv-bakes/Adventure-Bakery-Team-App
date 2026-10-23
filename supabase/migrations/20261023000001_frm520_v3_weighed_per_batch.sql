-- FRM-520 Production Lot Record, v2 -> v3: any number of batches.
--
-- Owner's live test at the bakery, 2026-10-19: the rum cake was mixed in SIX batches, and full
-- production may need more. FRM-520 had three fixed columns (Batch 1 / 2 / 3 weighed), so a lot could
-- not record more than three. The three columns become ONE text column, "Weighed per batch", holding
-- every batch's weight of that ingredient: "B1: 17.49; B2: 17.5; B6: 17.48" (owner's choice,
-- 2026-10-23). The mixing screens write it one batch at a time (write_mix_entry, next migration);
-- it can also be typed. "Number of batches" keeps no upper limit.
--
-- The two FRM-520 entries still drafts (open lots) are converted in the same transaction: their three
-- weight cells are folded into the new cell and they are moved to v3, so they keep working on the
-- mixing screens. Submitted lot records stay on the revision they were made on and are shown with
-- that revision's form, as always.
--
-- Approved by GJM, effective 2026-10-23.
--
-- Safe to run twice: at v3 as intended the form is left alone, and only v2 drafts are converted.

do $$
declare
  d record;
  n int;
  cols jsonb;
  cols_new jsonb;
  new_col constant jsonb := '{"id": "weighed_batches", "type": "text", "label": "Weighed per batch", "width": 3, "scanFact": "none"}';
  old_ids constant text := 'ingredient,brand,supplier_lot,expected_qty,unit,actual_qty,actual_qty_2,actual_qty_3,notes';
  new_ids constant text := 'ingredient,brand,supplier_lot,expected_qty,unit,weighed_batches,notes';
  help_old constant text := 'How many batches were mixed. Each batch is weighed and written in its own column below.';
  help_new constant text := 'How many batches were mixed - any number. Each ingredient''s weight for every batch is written in its "Weighed per batch" cell below, as B1: 17.49; B2: 17.50.';
  clear_old constant jsonb := '["supplier_lot", "actual_qty", "actual_qty_2", "actual_qty_3", "notes"]';
  clear_new constant jsonb := '["supplier_lot", "weighed_batches", "notes"]';
  hist_add constant text := E'\n\nv3 - 2026-10-23 - Any number of batches.\n\nThe lot was mixed in six batches at the live test on 2026-10-19, and the record had a column for three. The three columns "Batch 1 / 2 / 3 weighed" are replaced by one, "Weighed per batch", which holds every batch''s weight of the ingredient (B1: 17.49; B2: 17.50; ...). "Number of batches" has no upper limit. The weights are entered ingredient by ingredient across the batches, as the floor weighs them. Nothing else on the form changes.';
begin
  select count(*) into n from public.sop_documents where sop_number = 'FRM-520' and status = 'active';
  if n <> 1 then raise exception 'FRM-520: expected one active document, found %', n; end if;
  select * into d from public.sop_documents where sop_number = 'FRM-520' and status = 'active';

  cols := d.content->'form_schema'->'sections'->1->'fields'->0->'columns';
  if d.content->'form_schema'->'sections'->1->'fields'->0->>'id' is distinct from 'ingredients'
     or d.content->'form_schema'->'sections'->0->'fields'->4->>'id' is distinct from 'batches' then
    raise exception 'FRM-520 fields are not where this migration expects them.';
  end if;

  if d.revision = 'v3'
     and (select string_agg(c->>'id', ',' order by i) from jsonb_array_elements(cols) with ordinality t(c, i)) = new_ids then
    raise notice 'FRM-520: already at v3 as intended, form left alone';
  else
    if d.revision <> 'v2'
       or (select string_agg(c->>'id', ',' order by i) from jsonb_array_elements(cols) with ordinality t(c, i)) <> old_ids
       or d.content->'form_schema'->'sections'->0->'fields'->4->>'help' is distinct from help_old
       or d.content->'form_schema'->'settings'->'copyFrom'->'clear'->'ingredients' is distinct from clear_old then
      raise exception 'FRM-520 is not the document this migration was written against (rev %).', d.revision;
    end if;

    -- The first weight column becomes the new one; the other two go.
    select jsonb_agg(case when c->>'id' = 'actual_qty' then new_col else c end order by i) into cols_new
      from jsonb_array_elements(cols) with ordinality t(c, i)
     where c->>'id' not in ('actual_qty_2', 'actual_qty_3');

    update public.sop_documents
       set content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(content,
                       '{form_schema,sections,1,fields,0,columns}', cols_new),
                       '{form_schema,sections,0,fields,4,help}', to_jsonb(help_new)),
                       '{form_schema,settings,copyFrom,clear,ingredients}', clear_new),
                       '{revision_history}', to_jsonb(coalesce(content->>'revision_history', '') || hist_add)),
           revision = 'v3', effective_date = date '2026-10-23', approved_by = 'GJM'
     where id = d.id;
  end if;

  -- Open lots: fold their three weight cells into the new one and move them to v3.
  update public.sop_document_responses r
     set data = jsonb_set(r.data, '{ingredients}', (
           select coalesce(jsonb_agg(
             case when jsonb_typeof(row_) <> 'object' then row_
                  else (row_ - 'actual_qty' - 'actual_qty_2' - 'actual_qty_3')
                       || jsonb_build_object('weighed_batches', coalesce((
                            select string_agg('B' || b || ': ' || w, '; ' order by b)
                              from (values (1, btrim(coalesce(row_->>'actual_qty', ''))),
                                           (2, btrim(coalesce(row_->>'actual_qty_2', ''))),
                                           (3, btrim(coalesce(row_->>'actual_qty_3', '')))) v(b, w)
                             where w <> ''), ''))
             end order by i), '[]'::jsonb)
             from jsonb_array_elements(coalesce(r.data->'ingredients', '[]'::jsonb)) with ordinality t(row_, i))),
         form_revision = 'v3'
   where r.document_id = d.id and r.status = 'draft' and r.form_revision = 'v2';

  if exists (select 1 from public.sop_document_responses where document_id = d.id and status = 'draft' and form_revision <> 'v3') then
    raise exception 'An FRM-520 draft is on a revision other than v2 or v3; look at it before converting.';
  end if;
end $$;
