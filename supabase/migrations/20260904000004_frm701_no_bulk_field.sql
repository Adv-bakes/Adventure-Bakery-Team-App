-- FRM-701 loses the bulk/unlabeled checkbox. The site ships none. Still draft.
--
-- Section 3 carried "Product is supplied in bulk or unlabeled - safe-use information provided to
-- the customer with the consignment". The site confirmed on 2026-09-04 that it ships no bulk or
-- unlabeled product, so that box would have been unticked on every record forever.
--
-- AN ALWAYS-BLANK FIELD IS NOT NEUTRAL. It teaches the person filling the form that some fields do
-- not need reading, and the next field they skim will be one that mattered. FSQM-020's Part 7 went
-- for the same reason in 20260904000003; this keeps the form and the program saying the same thing.
--
-- 21 fields become 20. Sections stay 4, the eight release checks, five list columns, single
-- signature and deletable=false are unchanged and asserted. FRM-701 has no entries.
--
-- Writes content->'form_schema' only; hashes the rest.

begin;

do $$
declare
  r record;
begin
  select d.status, d.revision,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f)                as fields,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'id' = 'bulk_unlabeled')                                      as bulk_field,
         (select count(*) from public.sop_document_responses x where x.document_id = d.id) as entries
    into r from public.sop_documents d where d.sop_number = 'FRM-701';

  if r is null then raise exception 'FRM-701 does not exist.'; end if;
  if r.status <> 'draft' or r.revision <> 'New' then
    raise exception 'FRM-701 is % / %, not draft / New.', r.status, r.revision;
  end if;
  if r.entries <> 0 then
    raise exception 'FRM-701 has % entries - removing a field would orphan answers.', r.entries;
  end if;
  if r.fields <> 21 then
    raise exception 'FRM-701 has % fields, expected 21.', r.fields;
  end if;
  if r.bulk_field <> 1 then
    raise exception 'FRM-701 has no bulk_unlabeled field to remove - this has run.';
  end if;
end $$;

create temporary table frm701_bulk_before on commit drop as
select md5((content - 'form_schema')::text) as h
  from public.sop_documents where sop_number = 'FRM-701';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', $s701${"settings": {"attachmentsEnabled": true, "allowMultipleDrafts": true, "deletable": false, "instanceTitleTemplate": "Release {lot_code} — {product_name}"}, "sections": [{"id": "identification", "title": "1. Batch identification", "fields": [{"id": "release_info", "type": "info", "label": "Before you start", "text": "One record per batch or lot released. Nothing is made available for collection until this record is complete and signed — not afterwards. The customer's carrier will not wait, so this is done before it arrives.\n\nOnly the SQF Practitioner may release finished product (FSQM-020 Part 2). If any check below fails, do not release: place the batch on Hold under FSQM-018 and record it on FRM-702."}, {"id": "product_name", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true}, {"id": "lot_code", "type": "text", "label": "Lot / batch code", "width": "half", "required": true, "showInList": true, "help": "Exactly as coded on the pack."}, {"id": "batch_sheet_ref", "type": "text", "label": "Batch sheet reference", "width": "third"}, {"id": "date_produced", "type": "date", "label": "Date produced", "width": "third"}, {"id": "line_or_area", "type": "text", "label": "Line / area", "width": "third"}, {"id": "quantity_released", "type": "text", "label": "Quantity released", "width": "third", "help": "Cases, units or weight — state which."}, {"id": "customer", "type": "text", "label": "Customer", "width": "third", "showInList": true}]}, {"id": "release_checks", "title": "2. Release checks", "fields": [{"id": "checks_info", "type": "info", "label": "How to use this table", "text": "Every row must be answered. N/A is a legitimate answer where a check genuinely does not apply to this product — say why in the note. A single Fail means the batch is not released."}, {"id": "checks", "type": "grid", "label": "Checks required before release (FSQM-020 Part 4)", "columns": [{"id": "result", "label": "Result", "type": "pass_fail", "width": 1, "required": true}, {"id": "note", "label": "Note / evidence", "type": "text", "width": 3}], "rows": {"mode": "fixed", "labelHeader": "Check", "labels": ["Batch sheet complete and signed\nFormula, process steps and process controls followed as specified.", "Line pre-operation and sanitation release recorded\nOn FRM-903, for the line that produced this batch.", "No hold applies\nNeither the batch nor any ingredient in it is on Hold under FSQM-018, and no hold tag applies.", "Label is the approved label\nVerified against REP-602. Allergen statement and any Gluten Free claim correct for what was actually run.", "Pack, seal and package integrity correct\nAs specified for this product and customer.", "Date and lot code present, legible and correct", "Appearance and sensory standard met\nA unit taken from the batch and examined.", "Quantity and pack configuration match the customer's agreed specification"]}}]}, {"id": "label_verification", "title": "3. Label verification", "fields": [{"id": "label_info", "type": "info", "label": "What this section is for", "text": "The check in Section 2 confirms the label applied is the approved one. This section confirms the approved one is lawful — required before a product's first release and again at every label change (FSQM-020 Part 6). For a repeat run of an unchanged label, record the approved label reference and tick the confirmation."}, {"id": "approved_label_ref", "type": "text", "label": "Approved label reference", "width": "half", "help": "As held on REP-602 Approved Label Register."}, {"id": "label_version", "type": "text", "label": "Label version / revision", "width": "half"}, {"id": "first_release_or_change", "type": "checkbox", "label": "This is a first release or the label has changed since the last release", "width": "full"}, {"id": "legal_compliance_confirmed", "type": "checkbox", "label": "Label compliance with applicable food law confirmed (country of manufacture, and of sale where known)", "width": "full"}]}, {"id": "decision", "title": "5. Release decision", "fields": [{"id": "decision", "type": "select", "label": "Decision", "width": "half", "required": true, "showInList": true, "options": ["RELEASED — may be shipped, collected or transferred", "NOT RELEASED — placed on Hold under FSQM-018"]}, {"id": "hold_tag_number", "type": "text", "label": "Hold tag number, if not released", "width": "half", "help": "The tag raised on FRM-702. Leave blank when the batch is released."}, {"id": "release_notes", "type": "textarea", "label": "Notes", "rows": 3, "width": "full", "help": "Anything a reader would need to understand this decision later. Required in substance where a check was answered N/A or Fail."}, {"id": "released_by", "type": "signature", "label": "Released by (SQF Practitioner)", "width": "half", "required": true, "statement": "I have completed the checks above and release this batch on the evidence recorded here."}, {"id": "release_date", "type": "date", "label": "Date of release", "width": "half", "required": true, "showInList": true, "defaultToday": true}]}]}$s701$::jsonb)
 where sop_number = 'FRM-701' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  untouched boolean;
begin
  select status,
    jsonb_array_length(content->'form_schema'->'sections')                          as sections,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f)                      as fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'id' = 'bulk_unlabeled')                                            as bulk_field,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f,
                          jsonb_array_elements_text(f->'rows'->'labels') l
      where f->>'id' = 'checks')                                                    as check_rows,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where (f->>'showInList')::boolean)                                            as list_fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'type' = 'signature')                                               as signatures,
    (content->'form_schema'->'settings'->>'deletable')                              as deletable
  into r from public.sop_documents where sop_number = 'FRM-701';

  select b.h = md5((d.content - 'form_schema')::text) into untouched
    from public.sop_documents d, frm701_bulk_before b where d.sop_number = 'FRM-701';

  if r.fields <> 20 or r.sections <> 4 then
    raise exception 'FRM-701 is % fields / % sections, expected 20 / 4.', r.fields, r.sections;
  end if;
  if r.bulk_field <> 0 then raise exception 'bulk_unlabeled survives.'; end if;
  if r.check_rows <> 8 or r.list_fields <> 5 or r.signatures <> 1 then
    raise exception 'Form damaged: % checks, % list fields, % signatures.',
      r.check_rows, r.list_fields, r.signatures;
  end if;
  if r.deletable is distinct from 'false' then raise exception 'FRM-701 became deletable.'; end if;
  if r.status <> 'draft' then
    raise exception 'FRM-701 is now % - this migration must not issue it.', r.status;
  end if;
  if not untouched then
    raise exception 'Something outside form_schema changed. Rolled back.';
  end if;
end $$;

commit;
