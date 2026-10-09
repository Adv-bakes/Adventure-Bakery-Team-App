-- FRM-501 Formula Sheet & Batch Data: an entry for Rum Cake - Pumpkin Spice, as a draft.
--
-- Owner's request, 2026-10-08: create the formula sheet from the Production Lot Record (FRM-520)
-- of lot 6279, baked 2026-10-06. FRM-501 is the source a lot record starts from, and Pumpkin Spice
-- had no entry, so its lot record had been started from the Original formula and corrected by hand.
--
-- The formulation is that lot record's Expected quantity per batch: one 90.56 lb batch, all in lb,
-- with each line's share of the batch. The product name is the one the lot record uses, because the
-- lot trace and the release helper match records by product name.
--
-- Left blank on purpose: the lot numbers (they belong to a day, not a formula), Baker's %, the
-- benchtop quantities, the allergens (they come off each material's specification, FRM-207), the
-- process parameters and both signatures. The baking spray is listed without a quantity: it is a
-- processing aid and is not weighed.
--
-- Created under Richard Mercer's account, who asked for it. Safe to run twice: the id is fixed and
-- an existing row is left alone.

do $mig$
declare
  doc_id uuid; rev text; fs jsonb; n int; pct numeric;
  entry_id constant uuid := '9d4f1b27-6a53-4c0e-b2f8-3e7a50c2f501';
  payload constant jsonb := $ps${"product_name":"Rum Cake - Pumpkin Spice","formula_version":"v1","date":"2026-10-08","developed_by":"Bahama Rum Cakes","linked_product_request_no":"","trial_prototype_no":"","benchtop_batch_size":"","scaled_production_batch_size":"90.56 lb","allergens_in_formula":"","prototype_formulation_grid":[{"ingredient":"Vegetable Oil","supplier":"Great Value","lot_batch_no":"","allergens":"","bakers_pct":"","benchtop_qty_g":"","pct_of_formula":19.31,"production_qty":"17.49 lb","notes":""},{"ingredient":"Liquid Eggs (30 lb jug)","supplier":"Sysco","lot_batch_no":"","allergens":"","bakers_pct":"","benchtop_qty_g":"","pct_of_formula":13.24,"production_qty":"11.99 lb","notes":""},{"ingredient":"Water","supplier":"","lot_batch_no":"","allergens":"","bakers_pct":"","benchtop_qty_g":"","pct_of_formula":8.82,"production_qty":"7.99 lb","notes":"City water - not purchased"},{"ingredient":"Pillsbury Creme Cake Mix (50 lb bag)","supplier":"Pillsbury","lot_batch_no":"","allergens":"","bakers_pct":"","benchtop_qty_g":"","pct_of_formula":55.18,"production_qty":"49.97 lb","notes":""},{"ingredient":"Double Acting Baking Powder","supplier":"Clabber Girl","lot_batch_no":"","allergens":"","bakers_pct":"","benchtop_qty_g":"","pct_of_formula":0.28,"production_qty":"0.25 lb","notes":""},{"ingredient":"Egg Shade","supplier":"Mueliss","lot_batch_no":"","allergens":"","bakers_pct":"","benchtop_qty_g":"","pct_of_formula":0.34,"production_qty":"0.31 lb","notes":""},{"ingredient":"Pumpkin spice seasoning","supplier":"McCormick","lot_batch_no":"","allergens":"","bakers_pct":"","benchtop_qty_g":"","pct_of_formula":0.62,"production_qty":"0.56 lb","notes":""},{"ingredient":"Flavor","supplier":"LorAnn","lot_batch_no":"","allergens":"","bakers_pct":"","benchtop_qty_g":"","pct_of_formula":2.21,"production_qty":"2.00 lb","notes":""},{"ingredient":"The Original No-Stick Baking Spray with Flour","supplier":"Baker's Joy","lot_batch_no":"","allergens":"","bakers_pct":"","benchtop_qty_g":"","pct_of_formula":"","production_qty":"","notes":"Processing aid, not weighed"}],"process_parameters_grid":[{"target_spec":"","benchtop_actual":"","production_actual":"","notes":""},{"target_spec":"","benchtop_actual":"","production_actual":"","notes":""},{"target_spec":"","benchtop_actual":"","production_actual":"","notes":""},{"target_spec":"","benchtop_actual":"","production_actual":"","notes":""},{"target_spec":"","benchtop_actual":"","production_actual":"","notes":""},{"target_spec":"","benchtop_actual":"","production_actual":"","notes":""},{"target_spec":"","benchtop_actual":"","production_actual":"","notes":""},{"target_spec":"","benchtop_actual":"","production_actual":"","notes":""},{"target_spec":"","benchtop_actual":"","production_actual":"","notes":""},{"target_spec":"","benchtop_actual":"","production_actual":"","notes":""}],"facility_trial_conducted":false,"trial_results_meet_spec":false,"shelf_life_trial_initiated":false,"trial_sample_data_evaluation_area":"Formula in production, entered from the Production Lot Record (FRM-520) of lot 6279, baked 2026-10-06: one 90.56 lb batch, all quantities in lb, taken from that record's Expected quantity per batch. The lot itself weighed 50 lb of cake mix against the 49.97 lb expected. Customer: Bahama Rum Cakes. This is not a new product trial: the allergens, the benchtop columns, the process parameters and the sign-off are left for R&D to complete.","developed_by_rd":null,"developed_by_rd_date":"","approved_by_quality_leader":null,"approved_by_quality_leader_date":""}$ps$::jsonb;
  missing text;
begin
  select id, revision, content->'form_schema' into doc_id, rev, fs
    from public.sop_documents where sop_number = 'FRM-501' and status = 'active';
  if doc_id is null then raise exception 'FRM-501 not found.'; end if;

  -- Every key written must be a field of the form as it stands.
  select string_agg(k, ', ') into missing
    from jsonb_object_keys(payload) k
   where not exists (select 1 from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f where f->>'id' = k);
  if missing is not null then raise exception 'FRM-501 has no field(s): %', missing; end if;
  select string_agg(k, ', ') into missing
    from jsonb_object_keys(payload->'prototype_formulation_grid'->0) k
   where not exists (select 1 from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f,
                                    jsonb_array_elements(f->'columns') c
                      where f->>'id' = 'prototype_formulation_grid' and c->>'id' = k);
  if missing is not null then raise exception 'FRM-501 formulation grid has no column(s): %', missing; end if;

  if exists (select 1 from public.sop_document_responses
              where document_id = doc_id and id <> entry_id and data->>'product_name' = 'Rum Cake - Pumpkin Spice') then
    raise exception 'FRM-501 already has an entry for Rum Cake - Pumpkin Spice.';
  end if;

  insert into public.sop_document_responses (id, document_id, form_number, form_revision, data, status, created_by)
  select entry_id, doc_id, 'FRM-501', rev, payload, 'draft', '5eea644d-d8d3-4ad3-a55a-ef391334432d'::uuid
   where not exists (select 1 from public.sop_document_responses where id = entry_id);

  select jsonb_array_length(data->'prototype_formulation_grid'),
         (select sum(nullif(i->>'pct_of_formula', '')::numeric) from jsonb_array_elements(data->'prototype_formulation_grid') i)
    into n, pct
    from public.sop_document_responses where id = entry_id;
  if n is null then raise exception 'the FRM-501 entry was not created.'; end if;
  if n <> 9 then raise exception 'the FRM-501 entry has % formulation rows, expected 9.', n; end if;
  if pct <> 100.00 then raise exception 'the formula totals %, expected 100.00.', pct; end if;
end $mig$;
