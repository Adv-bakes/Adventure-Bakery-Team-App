-- FRM-004 — the pot & pan washer is not a food-contact machine.
--
-- The Equipment Register seeded the pot & pan washer as Food contact = "Indirect", on the
-- assumption it washed food-contact ware. It does not: it handles only the carrier pans, the trays
-- the molds sit on, which have no direct food contact (established 2026-08-26 and now written into
-- SOP-905 and SOP-906). Nothing product-facing passes through the machine, so "None" is accurate.
--
-- This is not cosmetic. Food contact is the column that scopes two programmes not yet built: the
-- food-grade lubricant requirement (SQF 11.2.1.7) applies to equipment over or in contact with
-- food, and the calibration programme (D-28) reads off the same column. A machine marked Indirect
-- when it is not gets pulled into both.
--
-- TWO PLACES, NOT ONE. This is the part that is easy to get wrong: FRM-004 sets
-- allowMultipleDrafts=false, so the register is ONE living entry - and there is already an entry
-- (draft, 13 rows, created 2026-08-25) whose Douglas Machines row reads "Indirect". `defaultValues`
-- only seeds a NEW entry; changing it alone would leave the actual register saying Indirect
-- indefinitely. So both are updated:
--   1. the schema default, so any future entry starts correct;
--   2. the filed entry's data, so the register itself is correct.
--
-- Editing response data is a different category from editing a schema and is done here only because
-- the entry is a DRAFT, not a submitted record. A submitted entry would be left alone and corrected
-- through the app's reopen path instead.
--
-- ⚠️ The entry's updated_at is the optimistic-concurrency token. This UPDATE bumps it (via the
-- sop_document_responses_touch trigger), so anyone holding that entry open in the app must reload
-- before saving or they will get a stale-edit error.
--
-- Rows are located by CONTENT (make_model = 'Douglas Machines'), never by array index. FRM-004's
-- grid rows are `deletable`, so the plant can reorder or remove them; an index written today would
-- eventually address a different machine and silently change the wrong row.
--
-- Revision stays 'New'. The register has not been revised in substance - a seed value and one cell
-- were corrected before the register was ever submitted. form_schema is snapshot-watched, so the
-- schema half is captured in sop_document_history regardless.

begin;

-- 1. The schema default, for future entries.
update public.sop_documents d
set content = jsonb_set(
      d.content,
      array['form_schema', 'sections', '1', 'fields', '3', 'rows', 'defaultValues', (r.idx - 1)::text],
      r.row || '{"food_contact": "None"}'::jsonb)
from (
  select t.idx, t.row
    from public.sop_documents,
         lateral jsonb_array_elements(content #> '{form_schema,sections,1,fields,3,rows,defaultValues}')
                 with ordinality t(row, idx)
   where sop_number = 'FRM-004'
     and t.row ->> 'make_model' = 'Douglas Machines'
) r
where d.sop_number = 'FRM-004'
  and d.content #>> '{form_schema,sections,1,fields,3,id}' = 'equipment'
  and r.row ->> 'food_contact' is distinct from 'None';

-- 2. The living register entry itself.
update public.sop_document_responses resp
set data = jsonb_set(resp.data, array['equipment', (r.idx - 1)::text],
                     r.row || '{"food_contact": "None"}'::jsonb)
from (
  select resp2.id as resp_id, t.idx, t.row
    from public.sop_document_responses resp2
    join public.sop_documents d on d.id = resp2.document_id,
         lateral jsonb_array_elements(resp2.data -> 'equipment') with ordinality t(row, idx)
   where d.sop_number = 'FRM-004'
     and resp2.status = 'draft'
     and t.row ->> 'make_model' = 'Douglas Machines'
) r
where resp.id = r.resp_id
  and r.row ->> 'food_contact' is distinct from 'None';

do $$
declare
  v text;
  direct_n int;
  indirect_n int;
  none_n int;
  entry_v text;
begin
  select row ->> 'food_contact' into v
    from public.sop_documents,
         lateral jsonb_array_elements(content #> '{form_schema,sections,1,fields,3,rows,defaultValues}') row
   where sop_number = 'FRM-004' and row ->> 'make_model' = 'Douglas Machines';
  if v is distinct from 'None' then
    raise exception 'FRM-004 schema: washer food_contact is %, expected None', coalesce(v, 'null');
  end if;

  select row ->> 'food_contact' into entry_v
    from public.sop_document_responses resp
    join public.sop_documents d on d.id = resp.document_id,
         lateral jsonb_array_elements(resp.data -> 'equipment') row
   where d.sop_number = 'FRM-004' and row ->> 'make_model' = 'Douglas Machines';
  if entry_v is distinct from 'None' then
    raise exception 'FRM-004 entry: washer food_contact is %, expected None', coalesce(entry_v, 'null');
  end if;

  -- No other row may have moved. Counts read from prod before this change: 7 Direct, 6 Indirect,
  -- 0 None. Afterwards the washer is the only row that shifts, Indirect -> None.
  select count(*) filter (where row ->> 'food_contact' = 'Direct'),
         count(*) filter (where row ->> 'food_contact' = 'Indirect'),
         count(*) filter (where row ->> 'food_contact' = 'None')
    into direct_n, indirect_n, none_n
    from public.sop_documents,
         lateral jsonb_array_elements(content #> '{form_schema,sections,1,fields,3,rows,defaultValues}') row
   where sop_number = 'FRM-004';

  if (direct_n, indirect_n, none_n) is distinct from (7, 5, 1) then
    raise exception 'FRM-004: expected 7 Direct / 5 Indirect / 1 None after the change, got % / % / %',
      direct_n, indirect_n, none_n;
  end if;
end $$;

commit;
