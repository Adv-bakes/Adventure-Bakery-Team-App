-- Removes the recall test data put in by insert.sql, and any FRM-012 record started from it
-- (recognised by a TEST product or a TEST- supplier lot). NOT a migration - run by hand.

begin;

delete from public.sop_document_responses r
 using public.sop_documents d
 where d.id = r.document_id and d.sop_number = 'FRM-012'
   and (r.data->>'product' ilike 'TEST %' or r.data->>'material_lot' ilike 'TEST-%' or r.data->>'material_lot' ilike 'test so%');

delete from public.sop_document_responses where data->>'_test_batch' = 'RECALL-TEST';

do $verify$
begin
  if exists (select 1 from public.sop_document_responses where data->>'_test_batch' = 'RECALL-TEST') then
    raise exception 'Test rows remain.';
  end if;
end $verify$;

commit;
