-- FRM-501 Formula Sheet & Batch Data: an entry for Rum Cake - Original, as a draft.
--
-- The owner's decision (2026-10-06): FRM-501 is the source for a product's formula for now; the
-- sales-side batch sheets are to be looked at later. The rum cake had no FRM-501 entry.
--
-- The formulation is the prep sheet's: one 92.50 lb batch, all in lb (owner confirmed lb the same
-- day), with each line's share of the batch. It is the same formula as the batch sheet created by
-- 20261006000002 and uses the same product name as the Production Lot Record (FRM-520), because
-- the lot trace matches records by product name.
--
-- Left blank on purpose: the lot numbers (they belong to a day, not a formula), Baker's %, the
-- benchtop quantities, the allergens (they come off each material's specification, FRM-207), the
-- process parameters, the Flavor quantity (0.00 on the prep sheet) and both signatures.
--
-- Created under Richard Mercer's account, who asked for it. Safe to run twice: the id is fixed and
-- an existing row is left alone.

do $mig$
declare
  doc_id uuid; rev text; fs jsonb; n int; pct numeric;
  entry_id constant uuid := '7c2d9e41-3b65-4f0a-8d17-5a1e60c2f501';
  payload constant jsonb := $rc${"product_name": "Rum Cake - Original", "formula_version": "v1", "trial_prototype_no": "", "date": "2026-10-06", "developed_by": "", "linked_product_request_no": "", "benchtop_batch_size": "", "scaled_production_batch_size": "92.50 lb", "allergens_in_formula": "", "prototype_formulation_grid": [{"ingredient": "Soybean Oil (35 lb jug)", "supplier": "Sysco Classic", "lot_batch_no": "", "bakers_pct": "", "pct_of_formula": 18.91, "benchtop_qty_g": "", "production_qty": "17.49 lb", "allergens": "", "notes": ""}, {"ingredient": "Liquid Eggs (30 lb jug)", "supplier": "Sysco", "lot_batch_no": "", "bakers_pct": "", "pct_of_formula": 14.58, "benchtop_qty_g": "", "production_qty": "13.49 lb", "allergens": "", "notes": ""}, {"ingredient": "Butter emulsion - Flayco (gallon)", "supplier": "Flayco", "lot_batch_no": "", "bakers_pct": "", "pct_of_formula": 3.24, "benchtop_qty_g": "", "production_qty": "3.00 lb", "allergens": "", "notes": ""}, {"ingredient": "Water", "supplier": "", "lot_batch_no": "", "bakers_pct": "", "pct_of_formula": 8.64, "benchtop_qty_g": "", "production_qty": "7.99 lb", "allergens": "", "notes": "City water - not purchased"}, {"ingredient": "Pillsbury Creme Cake Mix (50 lb bag)", "supplier": "Pillsbury", "lot_batch_no": "", "bakers_pct": "", "pct_of_formula": 54.02, "benchtop_qty_g": "", "production_qty": "49.97 lb", "allergens": "", "notes": ""}, {"ingredient": "Baking powder", "supplier": "Clabber Girl", "lot_batch_no": "", "bakers_pct": "", "pct_of_formula": 0.27, "benchtop_qty_g": "", "production_qty": "0.25 lb", "allergens": "", "notes": ""}, {"ingredient": "Egg Shade", "supplier": "Flayco", "lot_batch_no": "", "bakers_pct": "", "pct_of_formula": 0.34, "benchtop_qty_g": "", "production_qty": "0.31 lb", "allergens": "", "notes": ""}, {"ingredient": "Flavor", "supplier": "Flayco", "lot_batch_no": "", "bakers_pct": "", "pct_of_formula": "", "benchtop_qty_g": "", "production_qty": "", "allergens": "", "notes": "Quantity not recorded on the prep sheet (0.00 lb) - enter it"}, {"ingredient": "Pan release spray (contains soy)", "supplier": "Vegalene", "lot_batch_no": "", "bakers_pct": "", "pct_of_formula": "", "benchtop_qty_g": "", "production_qty": "", "allergens": "", "notes": "Processing aid, not weighed"}], "process_parameters_grid": [{"notes": "", "target_spec": "", "benchtop_actual": "", "production_actual": ""}, {"notes": "", "target_spec": "", "benchtop_actual": "", "production_actual": ""}, {"notes": "", "target_spec": "", "benchtop_actual": "", "production_actual": ""}, {"notes": "", "target_spec": "", "benchtop_actual": "", "production_actual": ""}, {"notes": "", "target_spec": "", "benchtop_actual": "", "production_actual": ""}, {"notes": "", "target_spec": "", "benchtop_actual": "", "production_actual": ""}, {"notes": "", "target_spec": "", "benchtop_actual": "", "production_actual": ""}, {"notes": "", "target_spec": "", "benchtop_actual": "", "production_actual": ""}, {"notes": "", "target_spec": "", "benchtop_actual": "", "production_actual": ""}, {"notes": "", "target_spec": "", "benchtop_actual": "", "production_actual": ""}], "trial_sample_data_evaluation_area": "Formula in production, entered from the Rum Cake Original prep sheet (one 92.50 lb batch, all quantities in lb). Customer: Bahama Rum Cakes. This is not a new product trial: the benchtop columns, the process parameters and the sign-off are left for R&D to complete.", "facility_trial_conducted": false, "trial_results_meet_spec": false, "shelf_life_trial_initiated": false, "developed_by_rd": null, "developed_by_rd_date": "", "approved_by_quality_leader": null, "approved_by_quality_leader_date": ""}$rc$::jsonb;
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
