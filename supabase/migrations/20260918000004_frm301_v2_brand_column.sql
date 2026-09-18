-- FRM-301 v2 - separate the SUPPLIER (who it was bought from) from the BRAND on the pack.
--
-- Most material arrives through distributors - Sysco, Restaurant Depot - carrying a manufacturer's
-- brand (Pillsbury, Gold Medal). FRM-301 had one "Supplier Name" column, and the package-label scan
-- filled it with the BRAND: the keyword fallback in formSchema.ts deliberately maps a column
-- labelled "Supplier" to the brand fact. So the one submitted entry reads "Gold Medal", "PURASNOW"
-- and "Sysco" in the supplier column - two brands and one distributor. Supplier approval is of the
-- distributor, so a receipt recorded that way could never be checked against the approved supplier
-- register: Pillsbury will never be on it.
--
-- The fix is in the schema, not the code - the scan mapping is a per-column setting:
--   * supplier_name  relabelled "Supplier (bought from)" and pinned scanFact "none", so the scan
--                    leaves it for the receiver to fill with the distributor.
--   * brand_manufacturer  NEW column, pinned scanFact "brand" - where the brand now lands.
-- The keyword fallback is left alone: other grids may rely on it, and a pinned setting beats it.
--
-- WHY IT MATTERS BEYOND TIDINESS: SOP-2.3.4 v4 (the next migration) approves a distributor-supplied
-- material as a named product from a named manufacturer, and treats a different brand as a new
-- material whose allergen declaration is checked before use. That check needs the brand recorded
-- on every receipt, in its own column.
--
-- The Verify Documentation instruction is extended to say which is which, and to point the emergency
-- route at the Approved Supplier and Comments columns.
--
-- DATA SAFETY: receiving_log is a DYNAMIC grid, so rows carry their own keys and a new column is
-- simply empty on existing rows. Column ids are unchanged, so every existing answer still maps. The
-- submitted entry keeps what was recorded; submitted records are not rewritten.
--
-- Guarded on the md5 of the live form_schema, so this applies only to the exact schema it was
-- written against. Revised to v2, GJM, 2026-09-18; the history trigger snapshots New.

begin;

do $guard$
declare h text; st text; rev text;
begin
  select md5((content->'form_schema')::text), status, revision into h, st, rev
    from public.sop_documents where sop_number = 'FRM-301';
  if (st, rev) is distinct from ('active', 'New') then
    raise exception 'FRM-301 is %/% - expected active/New.', st, rev;
  end if;
  if h <> 'd485e1be7c1ffe61535dec6190529459' then
    raise exception 'FRM-301 form_schema has changed since this migration was written (md5 %).', h;
  end if;
end $guard$;

update public.sop_documents
   set content        = jsonb_set(content, '{form_schema}', $fs${"sections": [{"id": "receiving_log_section", "title": "Receiving Log", "fields": [{"id": "receiving_log", "rows": {"min": 1, "mode": "dynamic"}, "type": "grid", "label": "Receiving Log", "columns": [{"id": "time_of_arrival", "type": "time", "label": "Time of Arrival", "width": 2, "defaultTo": "now"}, {"id": "po_number", "type": "text", "label": "PO Number", "width": 2}, {"id": "supplier_name", "type": "text", "label": "Supplier (bought from)", "width": 3, "scanFact": "none"}, {"id": "brand_manufacturer", "type": "text", "label": "Brand / Manufacturer", "width": 3, "scanFact": "brand"}, {"id": "material_description", "type": "text", "label": "Material Description", "width": 5}, {"id": "lot_batch_number", "type": "text", "label": "Lot/Batch Number", "width": 3}, {"id": "carrier_name_seal", "type": "text", "label": "Carrier Name & Seal #", "width": 3}, {"id": "qty_received", "type": "number", "label": "Qty Received", "width": 2}, {"id": "net_weight", "type": "text", "label": "Net Weight (per pack)", "width": 2, "scanFact": "net_weight"}, {"id": "carrier_cleanliness", "type": "pass_fail", "label": "Carrier Cleanliness (P/F)", "width": 2}, {"id": "pkg_integrity_damage", "type": "pass_fail", "label": "Pkg Integrity & Damage (P/F)", "width": 2}, {"id": "temp", "type": "number", "unit": "°F", "label": "Temp", "width": 2}, {"id": "approved_supplier_coa_log_coc", "type": "pass_fail", "label": "Approved Supplier & COA/LOG/COC (Y/N)", "width": 2, "scanFact": "none"}, {"id": "receiver_initals", "type": "text", "label": "Receiver Initials", "width": 1, "defaultTo": "currentUserInitials"}, {"id": "comments_hold_status", "type": "text", "label": "Comments / Hold Status", "width": 4}], "scanLabel": true, "scanNotesColumnId": "comments_hold_status"}]}, {"id": "standard_receiving_instructions_section", "title": "Standard Receiving Instructions", "fields": [{"id": "verify_documentation_info", "text": "Match all incoming delivery notes against the original Purchase Order (PO). Confirm the supplier is currently listed on the facility's Approved Supplier List. If a supplier is not verified on the list, notify the Quality Leader for review and authorization prior to acceptance. The Supplier is who the material was bought from — for example Sysco or Restaurant Depot — not the brand on the pack, which goes in Brand / Manufacturer. The brand must match the brand approved for that material; a different brand is a substitution, and its allergen declaration is checked against the specification before use (SOP-2.3.4). A supplier that is not approved is accepted only in an emergency: mark Approved Supplier N and record EMERGENCY – NON-APPROVED SUPPLIER, who authorised it and the inspection result in Comments (SOP-2.3.4).", "type": "info", "label": "Verify Documentation"}, {"id": "inspection_criteria_info", "text": "— Carrier Hygiene: Inspect the transport vehicle for hygiene; ensure it is free from off-odors, dirt, and any evidence of pest infestation.\n— Packaging Integrity: Inspect containers and pallets for damage, including leaks, punctures, or tattered bags.\n— Documentation Review: Verify that a Certificate of Analysis (COA), Letter of Guarantee (LOG), or Certificate of Conformance (COC) is present and matches the specific lot numbers delivered.\n— Temperature Control: For refrigerated ingredients (liquid eggs and butter), verify that they are received at ≤ 40°F. These materials must be moved to refrigerated storage immediately after receipt to minimize pathogen growth to levels that render subsequent bake steps ineffective.", "type": "info", "label": "Inspection Criteria"}, {"id": "non_conformance_info", "text": "Immediately SEGREGATE any material that is damaged, expired, or out of specification. Tag the lot as “HOLD – DO NOT USE” and notify QA Management immediately for final disposition.", "type": "info", "label": "Non-Conformance"}]}, {"id": "supervisory_verification_section", "title": "Supervisory Verification", "fields": [{"id": "verified_by_name", "type": "text", "label": "Verified By (SQF Practitioner / Designee)", "width": "full"}, {"id": "verified_by_signature", "role": "verifier", "type": "signature", "label": "Signature", "width": "half"}, {"id": "verification_date", "type": "date", "label": "Date", "width": "half"}, {"id": "verification_note", "text": "Verification must be completed within 7 working days per SQF requirements. The verifier shall check for record completeness and compliance with Critical Limits (Temperature).", "type": "info", "label": "Note"}]}], "settings": {}, "schemaVersion": 1}$fs$::jsonb),
       revision       = 'v2',
       effective_date = date '2026-09-18',
       approved_by    = 'GJM'
 where sop_number = 'FRM-301';

do $verify$
declare cols jsonb; n int; ids text[];
begin
  select f->'columns' into cols
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') s,
         jsonb_array_elements(s->'fields') f
   where d.sop_number = 'FRM-301' and f->>'id' = 'receiving_log';
  select array_agg(c->>'id' order by ord) into ids
    from jsonb_array_elements(cols) with ordinality t(c, ord);
  if ids[3] <> 'supplier_name' or ids[4] <> 'brand_manufacturer' or array_length(ids, 1) <> 15 then
    raise exception 'receiving_log columns wrong: %', ids;
  end if;
  if (select c->>'scanFact' from jsonb_array_elements(cols) c where c->>'id' = 'supplier_name') <> 'none'
     or (select c->>'scanFact' from jsonb_array_elements(cols) c where c->>'id' = 'brand_manufacturer') <> 'brand' then
    raise exception 'scan mapping not pinned.';
  end if;
  -- every pre-existing column id survives, so no answer is orphaned
  if not ids @> array['time_of_arrival','po_number','supplier_name','material_description','lot_batch_number',
                      'carrier_name_seal','qty_received','net_weight','carrier_cleanliness','pkg_integrity_damage',
                      'temp','approved_supplier_coa_log_coc','receiver_initals','comments_hold_status'] then
    raise exception 'an existing column id was lost.';
  end if;
  if (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
       where d.sop_number = 'FRM-301' and f->>'id' = 'verify_documentation_info'
         and f->>'text' like '%Brand / Manufacturer%' and f->>'text' like '%EMERGENCY%') <> 1 then
    raise exception 'Verify Documentation instruction not updated.';
  end if;
  if (select revision from public.sop_documents where sop_number = 'FRM-301') <> 'v2' then
    raise exception 'FRM-301 not revised to v2.';
  end if;
  raise notice 'FRM-301 v2: Supplier (bought from) and Brand / Manufacturer are separate columns.';
end $verify$;

commit;
