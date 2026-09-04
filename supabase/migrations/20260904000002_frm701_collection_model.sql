-- FRM-701 follows FSQM-020 to the collection model: no off-site section, no destination.
--
-- Section 4 asked which off-site storage location the product was going to, whether that location
-- held our written instruction, and when it was last reissued. The site does not use off-site or
-- contract warehouses - the customer arranges collection with their own carrier - so every one of
-- those questions would have been answered blank forever, and a form with a section nobody fills is
-- a form people learn to skim.
--
-- THE DESTINATION FIELD GOES TOO, and this is the less obvious half. It was a required select of
-- three options - shipped from our dock, collected by the customer, transferred to off-site storage
-- - and two of the three do not happen. A required field with one real answer is not a control, it
-- is a keystroke. Who collects and when belongs on the dispatch paperwork; the release record
-- records the release.
--
-- RELEASE HAPPENS BEFORE THE CARRIER ARRIVES, so the carrier is often not known when this record is
-- signed. That is the substantive reason not to replace destination with a carrier field: it would
-- invite the record to be completed at handover, which is exactly what FSQM-020 Part 10 forbids. The
-- instructions at the top of the form now say the carrier will not wait.
--
-- 5 sections and 26 fields become 4 and 21. The eight release checks, the five list columns, the
-- single signature and settings.deletable=false are unchanged, and the migration asserts each.
--
-- FRM-701 has no entries - it was seeded draft yesterday - so removing fields costs nothing. The
-- guard re-checks that at apply time, because removing a field from a form with live responses
-- would orphan answers into the "Unmapped answers" block rather than deleting them.
--
-- Writes content->'form_schema' only; hashes the rest.

begin;

do $$
declare
  r record;
begin
  select d.status, d.revision, d.type,
         jsonb_array_length(d.content->'form_schema'->'sections')                      as sections,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f)                    as fields,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s
           where s->>'id' = 'offsite_storage')                                         as offsite_sec,
         (select count(*) from public.sop_document_responses x where x.document_id = d.id) as entries
    into r
    from public.sop_documents d where d.sop_number = 'FRM-701';

  if r is null then
    raise exception 'FRM-701 does not exist - run 20260903000002 first.';
  end if;
  if r.status <> 'draft' or r.revision <> 'New' then
    raise exception 'FRM-701 is % / %, not draft / New.', r.status, r.revision;
  end if;
  if r.entries <> 0 then
    raise exception 'FRM-701 has % entries. Removing a field would orphan answers - stop and re-plan.',
      r.entries;
  end if;
  if r.sections <> 5 or r.fields <> 26 then
    raise exception 'FRM-701 is % sections / % fields, not the 5 / 26 seeded by 20260903000002.',
      r.sections, r.fields;
  end if;
  if r.offsite_sec <> 1 then
    raise exception 'FRM-701 has no off-site storage section to remove - this has run.';
  end if;
end $$;

create temporary table frm701_before on commit drop as
select md5((content - 'form_schema')::text) as h
  from public.sop_documents where sop_number = 'FRM-701';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', $j701${"settings": {"attachmentsEnabled": true, "allowMultipleDrafts": true, "deletable": false, "instanceTitleTemplate": "Release {lot_code} — {product_name}"}, "sections": [{"id": "identification", "title": "1. Batch identification", "fields": [{"id": "release_info", "type": "info", "label": "Before you start", "text": "One record per batch or lot released. Nothing is made available for collection until this record is complete and signed — not afterwards. The customer's carrier will not wait, so this is done before it arrives.\n\nOnly the SQF Practitioner may release finished product (FSQM-020 Part 2). If any check below fails, do not release: place the batch on Hold under FSQM-018 and record it on FRM-702."}, {"id": "product_name", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true}, {"id": "lot_code", "type": "text", "label": "Lot / batch code", "width": "half", "required": true, "showInList": true, "help": "Exactly as coded on the pack."}, {"id": "batch_sheet_ref", "type": "text", "label": "Batch sheet reference", "width": "third"}, {"id": "date_produced", "type": "date", "label": "Date produced", "width": "third"}, {"id": "line_or_area", "type": "text", "label": "Line / area", "width": "third"}, {"id": "quantity_released", "type": "text", "label": "Quantity released", "width": "third", "help": "Cases, units or weight — state which."}, {"id": "customer", "type": "text", "label": "Customer", "width": "third", "showInList": true}]}, {"id": "release_checks", "title": "2. Release checks", "fields": [{"id": "checks_info", "type": "info", "label": "How to use this table", "text": "Every row must be answered. N/A is a legitimate answer where a check genuinely does not apply to this product — say why in the note. A single Fail means the batch is not released."}, {"id": "checks", "type": "grid", "label": "Checks required before release (FSQM-020 Part 4)", "columns": [{"id": "result", "label": "Result", "type": "pass_fail", "width": 1, "required": true}, {"id": "note", "label": "Note / evidence", "type": "text", "width": 3}], "rows": {"mode": "fixed", "labelHeader": "Check", "labels": ["Batch sheet complete and signed\nFormula, process steps and process controls followed as specified.", "Line pre-operation and sanitation release recorded\nOn FRM-903, for the line that produced this batch.", "No hold applies\nNeither the batch nor any ingredient in it is on Hold under FSQM-018, and no hold tag applies.", "Label is the approved label\nVerified against REP-602. Allergen statement and any Gluten Free claim correct for what was actually run.", "Pack, seal and package integrity correct\nAs specified for this product and customer.", "Date and lot code present, legible and correct", "Appearance and sensory standard met\nA unit taken from the batch and examined.", "Quantity and pack configuration match the customer's agreed specification"]}}]}, {"id": "label_verification", "title": "3. Label verification", "fields": [{"id": "label_info", "type": "info", "label": "What this section is for", "text": "The check in Section 2 confirms the label applied is the approved one. This section confirms the approved one is lawful — required before a product's first release and again at every label change (FSQM-020 Part 6). For a repeat run of an unchanged label, record the approved label reference and tick the confirmation."}, {"id": "approved_label_ref", "type": "text", "label": "Approved label reference", "width": "half", "help": "As held on REP-602 Approved Label Register."}, {"id": "label_version", "type": "text", "label": "Label version / revision", "width": "half"}, {"id": "first_release_or_change", "type": "checkbox", "label": "This is a first release or the label has changed since the last release", "width": "full"}, {"id": "legal_compliance_confirmed", "type": "checkbox", "label": "Label compliance with applicable food law confirmed (country of manufacture, and of sale where known)", "width": "full"}, {"id": "bulk_unlabeled", "type": "checkbox", "label": "Product is supplied in bulk or unlabeled — safe-use information provided to the customer with the consignment", "width": "full"}]}, {"id": "decision", "title": "5. Release decision", "fields": [{"id": "decision", "type": "select", "label": "Decision", "width": "half", "required": true, "showInList": true, "options": ["RELEASED — may be shipped, collected or transferred", "NOT RELEASED — placed on Hold under FSQM-018"]}, {"id": "hold_tag_number", "type": "text", "label": "Hold tag number, if not released", "width": "half", "help": "The tag raised on FRM-702. Leave blank when the batch is released."}, {"id": "release_notes", "type": "textarea", "label": "Notes", "rows": 3, "width": "full", "help": "Anything a reader would need to understand this decision later. Required in substance where a check was answered N/A or Fail."}, {"id": "released_by", "type": "signature", "label": "Released by (SQF Practitioner)", "width": "half", "required": true, "statement": "I have completed the checks above and release this batch on the evidence recorded here."}, {"id": "release_date", "type": "date", "label": "Date of release", "width": "half", "required": true, "showInList": true, "defaultToday": true}]}]}$j701$::jsonb)
 where sop_number = 'FRM-701' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  untouched boolean;
begin
  select status,
    jsonb_array_length(content->'form_schema'->'sections')                             as sections,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f)                         as fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'id' in ('destination','storage_location','requirement_communicated',
                         'instruction_date','offsite_info'))                           as removed_left,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s
      where s->>'id' = 'offsite_storage')                                              as offsite_sec,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f,
                          jsonb_array_elements_text(f->'rows'->'labels') l
      where f->>'id' = 'checks')                                                       as check_rows,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where (f->>'showInList')::boolean)                                               as list_fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'type' = 'signature')                                                  as signatures,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f ? 'width' and f->>'width' not in ('full','half','third'))                as bad_widths,
    (content->'form_schema'->'settings'->>'deletable')                                 as deletable,
    (content->'form_schema')::text like '%carrier will not wait%'                      as instructions,
    (content->'form_schema')::text like '%off-site storage%'                           as offsite_text
  into r
  from public.sop_documents where sop_number = 'FRM-701';

  select b.h = md5((d.content - 'form_schema')::text) into untouched
    from public.sop_documents d, frm701_before b where d.sop_number = 'FRM-701';

  if r.sections <> 4 or r.fields <> 21 then
    raise exception 'FRM-701 is % sections / % fields, expected 4 / 21.',
      r.sections, r.fields;
  end if;
  if r.removed_left <> 0 or r.offsite_sec <> 0 or r.offsite_text then
    raise exception 'Off-site content survives: % fields, % sections, text=%.',
      r.removed_left, r.offsite_sec, r.offsite_text;
  end if;
  if r.check_rows <> 8 then
    raise exception 'The release checklist has % rows, expected 8 - it must match FSQM-020 Part 4.',
      r.check_rows;
  end if;
  if r.list_fields <> 5 or r.signatures <> 1 or r.bad_widths <> 0 then
    raise exception 'Form damaged: % list fields, % signatures, % bad widths.',
      r.list_fields, r.signatures, r.bad_widths;
  end if;
  if r.deletable is distinct from 'false' then
    raise exception 'FRM-701 became deletable.';
  end if;
  if not r.instructions then
    raise exception 'The instruction text was not updated for collection.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FRM-701 is now % - this migration must not issue it.', r.status;
  end if;
  if not untouched then
    raise exception 'Something outside form_schema changed on FRM-701. Rolled back.';
  end if;
end $$;

commit;
