-- Rum Cake - Original: first batch sheet, as a draft.
--
-- The app held batch sheets for the Bahama Burger only. The rum cake formula existed on the
-- floor prep sheet and in the FRM-520 Production Lot Record entries, not here.
--
-- Quantities are the prep sheet's, one 92.50 lb batch, all in lb. (The FRM-520 test entry
-- has "gal" on the butter emulsion and "fl oz" on the water; the prep sheet has lb for both,
-- and only lb makes the lines total 92.50.) The gram column therefore holds grams per BATCH;
-- each row's note carries the lb figure. Percentages are over the whole batch, water included,
-- and water is marked not purchased.
--
-- product.batch_size (92.5 lb) is the standard batch. The production lot record (FRM-520) reads it
-- to work out each ingredient's expected quantity per batch - see 20261006000003.
--
-- Left blank on purpose: unit weight, bake settings, packaging, process steps, and the Flavor
-- quantity (0.00 on the prep sheet). No client folder is linked - there is none for this customer.
--
-- Safe to run twice: the id is fixed and an existing row is left alone.

insert into public.batch_sheets (id, status, version, generated_from, source_change, data_json)
select '5b1f0c2e-7a34-4d19-9c6e-2f8a41d7e520'::uuid, 'draft', 1, 'manual', 'created_from_frm520', $rc${"header": {"product_name": "Rum Cake - Original", "company_name": "Bahama Rum Cakes", "customer_name": null, "product_code": null, "prepared_by": null, "approved_by": null, "date_of_issue": null, "version_number": null, "revision_number": null}, "recipe": {"locked": false, "warnings": [], "ingredients": [{"name": "Soybean Oil (35 lb jug)", "notes": null, "weight": 7933.32, "weight_g": 7933.32, "percentage": 18.91, "category": null, "vendor_1": "Sysco Classic", "vendor_2": null, "vendor_3": null, "vendor_notes": "17.49 lb per batch", "vendor_source": "staff", "weight_unit": null, "case_weight": null, "case_weight_uom": null, "non_purchased": false}, {"name": "Liquid Eggs (30 lb jug)", "notes": null, "weight": 6118.96, "weight_g": 6118.96, "percentage": 14.58, "category": null, "vendor_1": "Sysco", "vendor_2": null, "vendor_3": null, "vendor_notes": "13.49 lb per batch", "vendor_source": "staff", "weight_unit": null, "case_weight": null, "case_weight_uom": null, "non_purchased": false}, {"name": "Butter emulsion - Flayco (gallon)", "notes": null, "weight": 1360.78, "weight_g": 1360.78, "percentage": 3.24, "category": null, "vendor_1": "Flayco", "vendor_2": null, "vendor_3": null, "vendor_notes": "3.00 lb per batch", "vendor_source": "staff", "weight_unit": null, "case_weight": null, "case_weight_uom": null, "non_purchased": false}, {"name": "Water", "notes": null, "weight": 3624.2, "weight_g": 3624.2, "percentage": 8.64, "category": null, "vendor_1": null, "vendor_2": null, "vendor_3": null, "vendor_notes": "7.99 lb per batch", "vendor_source": "staff", "weight_unit": null, "case_weight": null, "case_weight_uom": null, "non_purchased": true}, {"name": "Pillsbury Creme Cake Mix (50 lb bag)", "notes": null, "weight": 22665.99, "weight_g": 22665.99, "percentage": 54.02, "category": null, "vendor_1": "Pillsbury", "vendor_2": null, "vendor_3": null, "vendor_notes": "49.97 lb per batch", "vendor_source": "staff", "weight_unit": null, "case_weight": null, "case_weight_uom": null, "non_purchased": false}, {"name": "Baking powder", "notes": null, "weight": 113.4, "weight_g": 113.4, "percentage": 0.27, "category": null, "vendor_1": "Clabber Girl", "vendor_2": null, "vendor_3": null, "vendor_notes": "0.25 lb per batch", "vendor_source": "staff", "weight_unit": null, "case_weight": null, "case_weight_uom": null, "non_purchased": false}, {"name": "Egg Shade", "notes": null, "weight": 140.61, "weight_g": 140.61, "percentage": 0.34, "category": null, "vendor_1": "Flayco", "vendor_2": null, "vendor_3": null, "vendor_notes": "0.31 lb per batch", "vendor_source": "staff", "weight_unit": null, "case_weight": null, "case_weight_uom": null, "non_purchased": false}, {"name": "Flavor", "notes": null, "weight": null, "weight_g": null, "percentage": null, "category": null, "vendor_1": "Flayco", "vendor_2": null, "vendor_3": null, "vendor_notes": "Quantity not recorded on the prep sheet (0.00 lb) - enter it", "vendor_source": "staff", "weight_unit": null, "case_weight": null, "case_weight_uom": null, "non_purchased": false}, {"name": "Pan release spray (contains soy)", "notes": null, "weight": null, "weight_g": null, "percentage": null, "category": null, "vendor_1": "Vegalene", "vendor_2": null, "vendor_3": null, "vendor_notes": "Processing aid, not weighed - contains soy", "vendor_source": "staff", "weight_unit": null, "case_weight": null, "case_weight_uom": null, "non_purchased": false}]}, "source": {"from": "FRM-520 Production Lot Record", "response_id": "0a0ede0d-5efd-4df3-a42d-4b48459414ca", "note": "Quantities are per 92.50 lb batch, from the Rum Cake Original prep sheet (all in lb)."}, "process": {"method": "", "method_text": "", "specifications": [], "pre_bake": {"steps": []}, "bake": {"temperature": null, "time_minutes": null, "internal_temp_target": null, "internal_temp_unit": null}}, "product": {"target_unit_weight_raw": null, "weight_unit": "oz", "allergens": "", "batch_size": 92.5, "batch_size_unit": "lb"}, "packaging": {"primary": {}, "secondary": {}, "shipper": {}, "palletizing": {}}, "internal_notes": "Gram figures are for one 92.50 lb batch, not one unit. Percentages are correct at any scale.", "production_notes": {}, "optional_sections": {}, "services_to_offer": {}}$rc$::jsonb
where not exists (select 1 from public.batch_sheets where id = '5b1f0c2e-7a34-4d19-9c6e-2f8a41d7e520');

do $$
declare n int; pct numeric;
begin
  select jsonb_array_length(data_json->'recipe'->'ingredients'),
         (select sum((i->>'percentage')::numeric) from jsonb_array_elements(data_json->'recipe'->'ingredients') i)
    into n, pct
    from public.batch_sheets where id = '5b1f0c2e-7a34-4d19-9c6e-2f8a41d7e520';
  if n is null then raise exception 'rum cake batch sheet was not created'; end if;
  if n <> 9 then raise exception 'rum cake batch sheet has % ingredient rows, expected 9', n; end if;
  if pct <> 100.00 then raise exception 'rum cake formula totals %, expected 100.00', pct; end if;
end $$;
