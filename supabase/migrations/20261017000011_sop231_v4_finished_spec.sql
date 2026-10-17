-- SOP-2.3.1 New Product and Specification Process, v3 -> v4: finished product specifications
-- (SQF 2.3.2.9) are stated, and 2.3.2.9 is cited.
--
-- Owner's request, 2026-10-17, from the FSMS Index: 2.3.2.9 showed "No program". FRM-704 holds
-- everything the clause lists, but the only program words were "Issue finalized specification".
-- That step now names FRM-704 and a short paragraph under it states the rule. Nothing else changes.
--
-- Approved by GJM, effective 2026-10-17.
--
-- Safe to run twice: at v4 as intended nothing is updated. Any other shape stops the migration.

do $$
declare
  d record;
  n int;
  proc_old constant jsonb := $j$["Summary", "• Receive concept or request (internal or customer).", "• Evaluate feasibility (ingredients, allergens, process compatibility, equipment capacity).", "• Develop prototype formula and test batch.", "• Review formula with QA for ingredient compliance and label accuracy.", "• Obtain customer or internal approval before scale-up.", "• Conduct production trial and evaluate results.", "• Issue finalized specification and batch sheet.", "• Maintain documentation in controlled format (revision history, product code, etc.).", "• Any change to a product, a recipe or a process is assessed and approved under FSQM-007 Change Management Program, on FRM-015, before it is made. The assessment covers the manufacturing process, not only the recipe, and whether the food safety plan has to be revised and validated first.", "Label Control - All labels must be reviewed and approved by QA prior to release. Verification includes:", "• Ingredient declaration accuracy.", "• Allergen and “may contain” statements.", "• Net weight, nutrition facts, and claims (e.g., gluten-free, vegan).", "Regulatory formatting (FDA CFR 21 §101). Labels may be reviewed by a third party or client regulatory team when required. The QA Lead maintains a controlled label file with the current approved version.", "Shelf-Life Determination - Shelf life is recommended based on ingredient stability, process, and packaging type.", "Formal testing is optional and may be conducted by a third-party lab or by the client.", "• Documentation must include:", "• Date of validation (or basis of recommendation).", "• Product code and formula reference.", "• Reviewer/approver (Owner or QA)."]$j$;
  proc_new constant jsonb := $j$["Summary", "• Receive concept or request (internal or customer).", "• Evaluate feasibility (ingredients, allergens, process compatibility, equipment capacity).", "• Develop prototype formula and test batch.", "• Review formula with QA for ingredient compliance and label accuracy.", "• Obtain customer or internal approval before scale-up.", "• Conduct production trial and evaluate results.", "• Issue the finished product specification on FRM-704 Finished Product Specification, and the batch sheet.", "> Every product made at the site has a current FRM-704 entry before it is first released. It states the product's microbiological and chemical limits, and its labelling and packaging requirements, and is approved by the SQF Practitioner for the site and by the customer. It is reviewed by its next-review date and whenever the product, its label or its packaging changes. Staff find it under FRM-704 in the SOPs Library.", "• Maintain documentation in controlled format (revision history, product code, etc.).", "• Any change to a product, a recipe or a process is assessed and approved under FSQM-007 Change Management Program, on FRM-015, before it is made. The assessment covers the manufacturing process, not only the recipe, and whether the food safety plan has to be revised and validated first.", "Label Control - All labels must be reviewed and approved by QA prior to release. Verification includes:", "• Ingredient declaration accuracy.", "• Allergen and “may contain” statements.", "• Net weight, nutrition facts, and claims (e.g., gluten-free, vegan).", "Regulatory formatting (FDA CFR 21 §101). Labels may be reviewed by a third party or client regulatory team when required. The QA Lead maintains a controlled label file with the current approved version.", "Shelf-Life Determination - Shelf life is recommended based on ingredient stability, process, and packaging type.", "Formal testing is optional and may be conducted by a third-party lab or by the client.", "• Documentation must include:", "• Date of validation (or basis of recommendation).", "• Product code and formula reference.", "• Reviewer/approver (Owner or QA)."]$j$;
  his_old constant jsonb := $j$"v2 - 2026-10-05 - The step \"Any changes follow the Management of Change Procedure\" pointed at a procedure that did not exist. It now names FSQM-007 Change Management Program and FRM-015, issued the same day under D-04. The scope no longer names a brand as an example of an internal item. Nothing else in this procedure is changed by this revision.\n\nv3 - 2026-10-17 - Records rewritten for SQF 2.3.1.6, which is now cited: they are kept for every product made at the site, new or existing, and each kind the clause names - product design, formulation, label compliance, process flow, shelf-life trials and approvals - is tied to the form that holds it. Form references carry their numbers. Nothing else in this procedure is changed by this revision."$j$;
  his_new constant jsonb := $j$"v2 - 2026-10-05 - The step \"Any changes follow the Management of Change Procedure\" pointed at a procedure that did not exist. It now names FSQM-007 Change Management Program and FRM-015, issued the same day under D-04. The scope no longer names a brand as an example of an internal item. Nothing else in this procedure is changed by this revision.\n\nv3 - 2026-10-17 - Records rewritten for SQF 2.3.1.6, which is now cited: they are kept for every product made at the site, new or existing, and each kind the clause names - product design, formulation, label compliance, process flow, shelf-life trials and approvals - is tied to the form that holds it. Form references carry their numbers. Nothing else in this procedure is changed by this revision.\n\nv4 - 2026-10-17 - For SQF 2.3.2.9, which is now cited: the step that issued \"the finalized specification\" now names FRM-704 Finished Product Specification and states what the clause asks of it - one current entry for every product before first release, its microbiological and chemical limits and its labelling and packaging requirements, approval by the site and by the customer, review, and where staff find it. Nothing else in this procedure is changed by this revision."$j$;
begin
  select count(*) into n from public.sop_documents where sop_number = 'SOP-2.3.1' and status = 'active';
  if n <> 1 then raise exception 'SOP-2.3.1: expected one active document, found %', n; end if;
  select * into d from public.sop_documents where sop_number = 'SOP-2.3.1' and status = 'active';

  if d.revision = 'v4' and d.content->'procedure' = proc_new and d.content->'revision_history' = his_new
     and d.sqf_reference = '2.3.1.1, 2.3.1.2, 2.3.2.5, 2.3.2.3, 2.6.1.1, 2.3.1.3, 2.2.3.1, 2.2.3.3, 2.3.1.6, 2.3.2.9' then
    raise notice 'SOP-2.3.1: already at v4 as intended, left alone';
    return;
  end if;
  if d.revision <> 'v3' or d.content->'procedure' is distinct from proc_old
     or d.content->'revision_history' is distinct from his_old or d.sqf_reference is distinct from '2.3.1.1, 2.3.1.2, 2.3.2.5, 2.3.2.3, 2.6.1.1, 2.3.1.3, 2.2.3.1, 2.2.3.3, 2.3.1.6' then
    raise exception 'SOP-2.3.1 is not the document this migration was written against (rev %)', d.revision;
  end if;

  update public.sop_documents
     set content = content || jsonb_build_object('procedure', proc_new, 'revision_history', his_new),
         revision = 'v4', effective_date = date '2026-10-17', approved_by = 'GJM',
         sqf_reference = '2.3.1.1, 2.3.1.2, 2.3.2.5, 2.3.2.3, 2.6.1.1, 2.3.1.3, 2.2.3.1, 2.2.3.3, 2.3.1.6, 2.3.2.9'
   where id = d.id;
end $$;
