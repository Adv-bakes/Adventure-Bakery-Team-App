-- SOP-2.3.1 New Product and Specification Process, v2 -> v3: the records of SQF 2.3.1.6.
--
-- Owner's request, 2026-10-17, from the FSMS Index: 2.3.1.6 showed "No program". SOP-2.3.1's
-- Records section nearly covered it but was written for new products only, named forms without
-- numbers, and left out process flows and shelf-life trials. Records and form references are
-- rewritten; the revision history gains a v3 line; 2.3.1.6 is cited. Nothing else changes.
--
-- Approved by GJM, effective 2026-10-17.
--
-- Safe to run twice: at v3 as intended nothing is updated. Any other shape stops the migration.

do $$
declare
  d record;
  n int;
  rec_old constant jsonb := $j$"Maintain electronic or hard-copy records of:\n• Product Request or Concept Form.\n• Formula sheets and batch data.\n• Label review approval.\n• Customer or internal approval (email confirmation acceptable).\n• First production run report and QC results. All records are retained per document control policy (minimum of two years)."$j$;
  rec_new constant jsonb := $j$"Records are kept for every product made at the site, new or existing. For each product:\n• Product design: FRM-101 Product Request & Concept Form.\n• Formulation: FRM-501 Formula Sheet & Batch Data.\n• Label compliance: FRM-601 Label Review & Approval Form.\n• Process flow: the Process Parameters table on FRM-501, and the process flow diagram in the product's food safety plan (FSQM-016 for the rum cake).\n• Shelf-life trials: FRM-704 Finished Product Specification - the shelf life and how it was set - and the shelf-life trial check on FRM-501.\n• First production run and QC results: FRM-502 First Production Run Report & QC Results.\n• Approvals: FRM-102 Customer & Internal Approval Record (email confirmation acceptable), the site and customer approval on FRM-704, and the approval for commercial production on FRM-502.\nAn existing product that lacks one of these records has it completed. All records are retained under SOP-2.2.3 Document and Record Control Program (minimum of two years)."$j$;
  frm_old constant jsonb := $j$"FRM Product Request & Concept Form\nFRM Formula Sheet & Batch Data\nFRM Label Review & Approval Form\nFRM Customer & Internal Approval Record\nFRM First Production Run Report & QC Results"$j$;
  frm_new constant jsonb := $j$"FRM-101 Product Request & Concept Form\nFRM-501 Formula Sheet & Batch Data\nFRM-601 Label Review & Approval Form\nFRM-102 Customer & Internal Approval Record\nFRM-502 First Production Run Report & QC Results\nFRM-704 Finished Product Specification\nFRM-015 Change Assessment Record"$j$;
  his_old constant jsonb := $j$"v2 - 2026-10-05 - The step \"Any changes follow the Management of Change Procedure\" pointed at a procedure that did not exist. It now names FSQM-007 Change Management Program and FRM-015, issued the same day under D-04. The scope no longer names a brand as an example of an internal item. Nothing else in this procedure is changed by this revision."$j$;
  his_new constant jsonb := $j$"v2 - 2026-10-05 - The step \"Any changes follow the Management of Change Procedure\" pointed at a procedure that did not exist. It now names FSQM-007 Change Management Program and FRM-015, issued the same day under D-04. The scope no longer names a brand as an example of an internal item. Nothing else in this procedure is changed by this revision.\n\nv3 - 2026-10-17 - Records rewritten for SQF 2.3.1.6, which is now cited: they are kept for every product made at the site, new or existing, and each kind the clause names - product design, formulation, label compliance, process flow, shelf-life trials and approvals - is tied to the form that holds it. Form references carry their numbers. Nothing else in this procedure is changed by this revision."$j$;
begin
  select count(*) into n from public.sop_documents where sop_number = 'SOP-2.3.1' and status = 'active';
  if n <> 1 then raise exception 'SOP-2.3.1: expected one active document, found %', n; end if;
  select * into d from public.sop_documents where sop_number = 'SOP-2.3.1' and status = 'active';

  if d.revision = 'v3' and d.content->'records' = rec_new and d.content->'form_references' = frm_new
     and d.content->'revision_history' = his_new and d.sqf_reference = '2.3.1.1, 2.3.1.2, 2.3.2.5, 2.3.2.3, 2.6.1.1, 2.3.1.3, 2.2.3.1, 2.2.3.3, 2.3.1.6' then
    raise notice 'SOP-2.3.1: already at v3 as intended, left alone';
    return;
  end if;
  if d.revision <> 'v2' or d.content->'records' is distinct from rec_old or d.content->'form_references' is distinct from frm_old
     or d.content->'revision_history' is distinct from his_old or d.sqf_reference is distinct from '2.3.1.1, 2.3.1.2, 2.3.2.5, 2.3.2.3, 2.6.1.1, 2.3.1.3, 2.2.3.1, 2.2.3.3' then
    raise exception 'SOP-2.3.1 is not the document this migration was written against (rev %)', d.revision;
  end if;

  update public.sop_documents
     set content = content || jsonb_build_object('records', rec_new, 'form_references', frm_new, 'revision_history', his_new),
         revision = 'v3', effective_date = date '2026-10-17', approved_by = 'GJM',
         sqf_reference = '2.3.1.1, 2.3.1.2, 2.3.2.5, 2.3.2.3, 2.6.1.1, 2.3.1.3, 2.2.3.1, 2.2.3.3, 2.3.1.6'
   where id = d.id;
end $$;
