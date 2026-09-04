-- FRM-701 Finished Product Release Record. Seeded draft. The record SQF 2.4.7.1 requires.
--
-- "Records of all product releases shall be maintained" is the limb of 2.4.7.1 that a program alone
-- cannot satisfy. FSQM-020 says a release is a decision; this is where the decision is written down,
-- one record per batch or lot.
--
-- FRM-701 SITS BESIDE FRM-702 ON PURPOSE. The 700 block is "QC / Testing / Hold & Release": 701 is
-- the release record, 702 the hold record, and a batch that fails a check here crosses from one to
-- the other. The Decision field names that path in its own option text rather than leaving a filler
-- to work out what "not released" means operationally.
--
-- THE EIGHT CHECKS ARE FSQM-020 PART 4, verbatim and in order, as a fixed grid with a pass_fail
-- column. The build refuses if the counts diverge, so the form and the program cannot drift into
-- listing different checks - the failure mode that put different rework authorities in FSQM-018 and
-- FSQM-019. Each row carries a title line and an explanatory line, which FixedRowLabel renders as
-- bold title over italic description; a filler reading it on a tablet gets the check and the reason
-- without opening the program.
--
-- N/A IS A LEGITIMATE ANSWER and the form says so, because a checklist that only offers pass or fail
-- gets a false pass the first time a check genuinely does not apply. A single Fail means the batch is
-- not released; that is stated in the instructions rather than enforced by validation, because the
-- decision belongs to the SQF Practitioner and a form that silently blocked submission would just be
-- filled in differently.
--
-- SECTION 3 SEPARATES TWO LABEL QUESTIONS that are easy to conflate. The Section 2 check confirms the
-- label applied is the approved one. Section 3 confirms the approved one is LAWFUL, which 2.4.7.2
-- requires at first release and at every label change - a different question, asked less often.
--
-- SECTION 4 IS BLANK FOR MOST ENTRIES, deliberately. It applies only to off-site storage transfers
-- and says so in its own instructions, rather than being hidden by conditional logic the schema does
-- not support.
--
-- NOT DELETABLE. A product release record is the evidence that release happened; deleting one would
-- remove the only proof for that lot. settings.deletable is false, and the build refuses otherwise.
--
-- Seeded draft alongside FSQM-020, which must be issued first or in the same transaction as this -
-- a form whose instructions cite a Part of an unissued program is not yet a controlled record.

begin;

do $$
declare
  n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FRM-701';
  if n <> 0 then
    raise exception 'FRM-701 already exists.';
  end if;
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-020';
  if n <> 1 then
    raise exception 'FSQM-020 does not exist - seed the program first (20260903000001).';
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FRM-701',
  'Finished Product Release Record',
  'form',
  'Module 2',
  'draft',
  'New',
  '2.4.7.1, 2.4.7.2, 2.4.7.3',
  true,
  jsonb_build_object('form_schema', $j701${"settings": {"attachmentsEnabled": true, "allowMultipleDrafts": true, "deletable": false, "instanceTitleTemplate": "Release {lot_code} — {product_name}"}, "sections": [{"id": "identification", "title": "1. Batch identification", "fields": [{"id": "release_info", "type": "info", "label": "Before you start", "text": "One record per batch or lot released. Nothing ships, is collected, or is transferred into off-site storage until this record is complete and signed — not afterwards.\n\nOnly the SQF Practitioner may release finished product (FSQM-020 Part 2). If any check below fails, do not release: place the batch on Hold under FSQM-018 and record it on FRM-702."}, {"id": "product_name", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true}, {"id": "lot_code", "type": "text", "label": "Lot / batch code", "width": "half", "required": true, "showInList": true, "help": "Exactly as coded on the pack."}, {"id": "batch_sheet_ref", "type": "text", "label": "Batch sheet reference", "width": "third"}, {"id": "date_produced", "type": "date", "label": "Date produced", "width": "third"}, {"id": "line_or_area", "type": "text", "label": "Line / area", "width": "third"}, {"id": "quantity_released", "type": "text", "label": "Quantity released", "width": "third", "help": "Cases, units or weight — state which."}, {"id": "customer", "type": "text", "label": "Customer", "width": "third", "showInList": true}, {"id": "destination", "type": "select", "label": "Destination", "width": "third", "required": true, "options": ["Shipped from our dock", "Collected by the customer", "Transferred to customer-owned or third-party storage"], "help": "The last option requires Section 4 to be completed as well."}]}, {"id": "release_checks", "title": "2. Release checks", "fields": [{"id": "checks_info", "type": "info", "label": "How to use this table", "text": "Every row must be answered. N/A is a legitimate answer where a check genuinely does not apply to this product — say why in the note. A single Fail means the batch is not released."}, {"id": "checks", "type": "grid", "label": "Checks required before release (FSQM-020 Part 4)", "columns": [{"id": "result", "label": "Result", "type": "pass_fail", "width": 1, "required": true}, {"id": "note", "label": "Note / evidence", "type": "text", "width": 3}], "rows": {"mode": "fixed", "labelHeader": "Check", "labels": ["Batch sheet complete and signed\nFormula, process steps and process controls followed as specified.", "Line pre-operation and sanitation release recorded\nOn FRM-903, for the line that produced this batch.", "No hold applies\nNeither the batch nor any ingredient in it is on Hold under FSQM-018, and no hold tag applies.", "Label is the approved label\nVerified against REP-602. Allergen statement and any Gluten Free claim correct for what was actually run.", "Pack, seal and package integrity correct\nAs specified for this product and customer.", "Date and lot code present, legible and correct", "Appearance and sensory standard met\nA unit taken from the batch and examined.", "Quantity and pack configuration match the customer's agreed specification"]}}]}, {"id": "label_verification", "title": "3. Label verification", "fields": [{"id": "label_info", "type": "info", "label": "What this section is for", "text": "The check in Section 2 confirms the label applied is the approved one. This section confirms the approved one is lawful — required before a product's first release and again at every label change (FSQM-020 Part 6). For a repeat run of an unchanged label, record the approved label reference and tick the confirmation."}, {"id": "approved_label_ref", "type": "text", "label": "Approved label reference", "width": "half", "help": "As held on REP-602 Approved Label Register."}, {"id": "label_version", "type": "text", "label": "Label version / revision", "width": "half"}, {"id": "first_release_or_change", "type": "checkbox", "label": "This is a first release or the label has changed since the last release", "width": "full"}, {"id": "legal_compliance_confirmed", "type": "checkbox", "label": "Label compliance with applicable food law confirmed (country of manufacture, and of sale where known)", "width": "full"}, {"id": "bulk_unlabeled", "type": "checkbox", "label": "Product is supplied in bulk or unlabeled — safe-use information provided to the customer with the consignment", "width": "full"}]}, {"id": "offsite_storage", "title": "4. Transfer to off-site storage", "fields": [{"id": "offsite_info", "type": "info", "label": "Only where the destination is off-site storage", "text": "Release happens before transfer, never after arrival. Stock held outside our control could otherwise be drawn down before it was released. Leave this section blank for product shipped from our dock or collected by the customer."}, {"id": "storage_location", "type": "text", "label": "Storage location", "width": "half"}, {"id": "requirement_communicated", "type": "checkbox", "label": "This location holds our written instruction that only released product may be drawn from the stock", "width": "full"}, {"id": "instruction_date", "type": "date", "label": "Date that instruction was last issued or reconfirmed", "width": "third"}]}, {"id": "decision", "title": "5. Release decision", "fields": [{"id": "decision", "type": "select", "label": "Decision", "width": "half", "required": true, "showInList": true, "options": ["RELEASED — may be shipped, collected or transferred", "NOT RELEASED — placed on Hold under FSQM-018"]}, {"id": "hold_tag_number", "type": "text", "label": "Hold tag number, if not released", "width": "half", "help": "The tag raised on FRM-702. Leave blank when the batch is released."}, {"id": "release_notes", "type": "textarea", "label": "Notes", "rows": 3, "width": "full", "help": "Anything a reader would need to understand this decision later. Required in substance where a check was answered N/A or Fail."}, {"id": "released_by", "type": "signature", "label": "Released by (SQF Practitioner)", "width": "half", "required": true, "statement": "I have completed the checks above and release this batch on the evidence recorded here."}, {"id": "release_date", "type": "date", "label": "Date of release", "width": "half", "required": true, "showInList": true, "defaultToday": true}]}]}$j701$::jsonb)
);

do $$
declare
  r record;
begin
  select status, revision, type, category,
    jsonb_array_length(content->'form_schema'->'sections')                            as sections,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f)                        as fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'type' = 'grid')                                                      as grids,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'type' = 'grid' and f->'rows'->>'mode' is null)                       as grids_no_mode,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f,
                          jsonb_array_elements_text(f->'rows'->'labels') l
      where f->>'id' = 'checks')                                                      as check_rows,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where (f->>'showInList')::boolean)                                              as list_fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f ? 'width' and f->>'width' not in ('full','half','third'))               as bad_widths,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'type' = 'signature')                                                 as signatures,
    (content->'form_schema'->'settings'->>'deletable')                                as deletable,
    (content->'form_schema'->'settings'->>'instanceTitleTemplate')                    as tmpl
  into r
  from public.sop_documents where sop_number = 'FRM-701';

  if r.status <> 'draft' or r.revision <> 'New' or r.type <> 'form' or r.category <> 'Module 2' then
    raise exception 'FRM-701 seeded wrong: % / % / % / %.', r.status, r.revision, r.type, r.category;
  end if;
  if r.sections <> 5 or r.fields <> 26 or r.grids <> 1 then
    raise exception 'FRM-701 wrong shape: % sections, % fields, % grids (expected 5 / 26 / 1).',
      r.sections, r.fields, r.grids;
  end if;
  if r.grids_no_mode <> 0 then
    raise exception '% grids have no rows.mode - a fixed grid without it renders dynamic.', r.grids_no_mode;
  end if;
  if r.check_rows <> 8 then
    raise exception 'The release checklist has % rows; FSQM-020 Part 4 lists 8.', r.check_rows;
  end if;
  if r.list_fields <> 5 then
    raise exception '% fields are flagged showInList, expected 5.', r.list_fields;
  end if;
  if r.bad_widths <> 0 then
    raise exception '% fields carry a width FormRenderer does not accept.', r.bad_widths;
  end if;
  if r.signatures <> 1 then
    raise exception 'Expected exactly one signature field, found %.', r.signatures;
  end if;
  if r.deletable is distinct from 'false' then
    raise exception 'FRM-701 is deletable - a product release record must not be.';
  end if;
  if r.tmpl is null or left(r.tmpl, 1) = '{' then
    raise exception 'instanceTitleTemplate is %, which renders as "()" on an empty draft.',
      coalesce(r.tmpl, 'unset');
  end if;
end $$;

commit;
