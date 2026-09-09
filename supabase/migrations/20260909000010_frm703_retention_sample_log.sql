-- FRM-703 Retention Sample Log. Seeded draft. The one new record D-15 adds.
--
-- WHY IT IS THE ONLY NEW FORM. FSQM-014 names existing records for all three inspections the site
-- performs - FRM-301 at receiving, the batch sheet in process, FRM-701 at release. The retention
-- sample is the one thing the site does that nothing records at all, so this is the single record
-- the deliverable creates rather than a fourth place to write down what is already written.
--
-- THE DRAFT IS THE SHELF. This is the design decision the whole form turns on. A retention sample
-- is taken on one day and disposed of months later, which does not fit a record that is filled and
-- submitted in one sitting. So Section 1 is completed when the sample is taken and the entry is
-- LEFT AS A DRAFT, and Section 2 is completed and the entry SUBMITTED when the sample leaves the
-- shelf. The consequence is worth the whole feature: the list of drafts on this form IS the list of
-- samples physically in the building, sortable by Discard due, and a submitted entry is a sample
-- that is gone. Nothing had to be built to get that - allowMultipleDrafts (the default) plus the
-- draft/submitted lifecycle already there.
--
-- THAT IS ALSO WHY THE DISPOSAL DATE HAS NO defaultToday. A date field's default is computed when
-- the ENTRY IS CREATED, not when the field is reached. On date_taken that is exactly right - the
-- record is created at the moment the sample is taken. On disposal_date it would pre-fill the take
-- date and be wrong by the length of the retention period, and a wrong date that is already in the
-- box is worse than an empty one. The Today shortcut beside every date input covers it at disposal
-- time. A guard below refuses any Section 2 date that carries the flag.
--
-- THE PRINTED DATE IS TEXT, NOT A DATE, AND THAT IS DELIBERATE. A finished pack examined on
-- 2026-09-09 reads "Best By: July 2027" - a month and a year, no day. A date input cannot hold
-- that, so it would force the filler to pick a day and the record would then assert a printed fact
-- nobody printed. The field takes the code verbatim; FSQM-014 Part 6 supplies the convention that
-- makes it computable (a month-coded pack counts from the last day of that month), and discard_due
-- stays a real date so the draft list can be sorted by what is due.
--
-- REQUIRED FIELDS ARE ENFORCED AT SUBMIT, WHICH IS THE DISPOSAL MOMENT. That falls out of the same
-- lifecycle for free: a draft saves anything, so Section 1 can be filled in a hurry at the shelf,
-- and the form insists on a complete record only when the entry is closed out.
--
-- DISPOSITION INCLUDES TWO OPTIONS NOBODY LIKES WRITING DOWN, on purpose. Lost or unaccounted for
-- is there because a sample that cannot be found is a real outcome, and an auditor asking where the
-- sample for a lot went is far better answered by a record than by a shrug. Record raised in error
-- is there because the form is not deletable, so a duplicate or mistaken entry needs an honest exit
-- that is not deletion.
--
-- NOT DELETABLE, like FRM-701. The log is the evidence that the practice exists; a log entries can
-- be removed from proves nothing.
--
-- Seeded DRAFT alongside FSQM-014, which is also draft. The guard below requires FSQM-014's Part 6
-- to already carry the thirty-day rule, because this form states that rule on its own face.

begin;

do $$
declare
  n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FRM-703';
  if n <> 0 then
    raise exception 'FRM-703 already exists.';
  end if;
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-014';
  if n <> 1 then
    raise exception 'FSQM-014 does not exist - seed the program first (20260909000001).';
  end if;
  -- This form prints the retention rule in its own instructions. If Part 6 does not yet say it,
  -- the two would ship disagreeing, which is the failure FSQM-018 and FSQM-019 already produced.
  select count(*) into n from public.sop_documents
   where sop_number = 'FSQM-014'
     and (content->'procedure')::text like '%thirty days after the best-by or expiration date printed on its pack%';
  if n <> 1 then
    raise exception 'FSQM-014 Part 6 does not carry the thirty-day rule; apply 20260909000009 first.';
  end if;
  select count(*) into n from public.sop_documents
   where sop_number = 'FRM-701' and status = 'active';
  if n <> 1 then
    raise exception 'FRM-701 is not active; this form cross-references its release record.';
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FRM-703',
  'Retention Sample Log',
  'form',
  'Module 2',
  'draft',
  'New',
  '2.4.4.5',
  true,
  jsonb_build_object('form_schema', $j703${"schemaVersion": 1, "settings": {"attachmentsEnabled": true, "allowMultipleDrafts": true, "deletable": false, "instanceTitleTemplate": "Retention {lot_code} — {product_name}"}, "sections": [{"id": "sample_taken", "title": "1. Sample taken", "fields": [{"id": "how_this_works", "type": "info", "label": "How this record works", "text": "One record per retention sample.\n\nComplete this section when the sample is taken and SAVE IT AS A DRAFT. The entry stays a draft for as long as the sample is physically on the shelf, so the list of drafts on this form is the list of samples the site is holding, and it can be sorted by Discard due to see what is now due. Complete Section 2 and submit the entry when the sample leaves the shelf.\n\nWHAT IS RETAINED — one sealed unit of finished product from each production batch, in the pack it shipped in, held under the product's normal storage conditions, identified as a retention sample and kept separate from saleable stock so that it cannot be picked and shipped.\n\nHOW LONG — until thirty days after the best-by or expiration date printed on the pack, then discarded; unless a customer agreement requires longer for that customer's product, in which case the longer period applies. Where the pack is coded with a month and year only, count the thirty days from the LAST day of that month.\n\nRetention samples are not required of this site by any customer or by any regulation. The site keeps them anyway, and FSQM-014 Part 6 states the basis."}, {"id": "product_name", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true}, {"id": "lot_code", "type": "text", "label": "Lot / batch code", "width": "half", "required": true, "showInList": true, "help": "Exactly as coded on the pack — the same code as this batch's FRM-701 release record."}, {"id": "customer", "type": "text", "label": "Customer", "width": "third"}, {"id": "date_produced", "type": "date", "label": "Date produced", "width": "third"}, {"id": "date_taken", "type": "date", "label": "Date sample taken", "width": "third", "required": true, "defaultToday": true}, {"id": "pack_description", "type": "text", "label": "Pack retained", "width": "half", "help": "The pack and count as retained, e.g. one 12-count case."}, {"id": "units_retained", "type": "number", "label": "Units retained", "width": "half", "min": 1, "defaultValue": 1, "help": "One sealed unit per batch unless a customer agreement requires more."}, {"id": "printed_date", "type": "text", "label": "Best-by or expiration date printed on the pack", "width": "half", "required": true, "help": "Copy it EXACTLY as printed, off the pack being retained — if the pack says only a month and year, write that. Do not convert it to a day."}, {"id": "discard_due", "type": "date", "label": "Discard due", "width": "half", "required": true, "showInList": true, "help": "Thirty days after the printed date (FSQM-014 Part 6). Where the pack is coded to a month only, count from the last day of that month. Later where a customer agreement requires it."}, {"id": "longer_period_required", "type": "text", "label": "Customer agreement requiring a longer period", "width": "full", "help": "Name the customer and the period where one applies. Leave blank where the standard period is used."}, {"id": "storage_location", "type": "text", "label": "Storage location", "width": "half", "required": true, "showInList": true, "help": "Where the sample is held. It must be identified as a retention sample and separated from saleable stock."}, {"id": "taken_by", "type": "signature", "label": "Sample taken by", "width": "half", "required": true, "statement": "I took this sample from the batch recorded above and placed it in the location recorded here."}]}, {"id": "disposal", "title": "2. Disposal", "fields": [{"id": "disposal_info", "type": "info", "label": "Complete this section when the sample leaves the shelf", "text": "A sample leaves the shelf at the end of its retention period, or earlier if it is needed for a complaint or an investigation. Record what happened to it here, then SUBMIT the entry.\n\nDo not submit while the sample is still being held — a submitted entry reads as a sample that is gone.\n\nIf a sample cannot be found, say so. A missing sample recorded honestly is something the site can act on; a missing sample with no record is something nobody can explain."}, {"id": "disposition", "type": "select", "label": "What happened to the sample", "width": "half", "required": true, "options": ["Discarded at the end of the retention period", "Used for a complaint or an investigation", "Sent to the customer on request", "Discarded before the end of the retention period", "Lost or unaccounted for", "Record raised in error — no sample was taken"]}, {"id": "disposal_date", "type": "date", "label": "Date", "width": "half", "required": true, "help": "The date the sample actually left the shelf."}, {"id": "complaint_or_capa_ref", "type": "text", "label": "Complaint / CAPA reference", "width": "third", "help": "Where the sample was used for an investigation — the FRM-002 complaint number or the FRM-007 CAPA number."}, {"id": "disposal_reason", "type": "textarea", "label": "Reason / notes", "rows": 3, "width": "full", "help": "Required in substance for anything other than discard at the end of the retention period."}, {"id": "disposed_by", "type": "signature", "label": "Disposed by", "width": "half", "required": true, "statement": "I disposed of this sample as recorded above."}]}]}$j703$::jsonb)
);

do $$
declare
  r record;
begin
  select status, revision, type, category, sqf_reference, sqf_required,
    jsonb_array_length(content->'form_schema'->'sections')                            as sections,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f)                        as fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where (f->>'showInList')::boolean)                                              as list_fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'type' = 'signature')                                                 as signatures,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f ? 'width' and f->>'width' not in ('full','half','third'))               as bad_widths,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'type' = 'grid' and f->'rows'->>'mode' is null)                       as grids_no_mode,
    -- The trap this form exists to avoid: a Section 2 date pre-filled at entry creation would
    -- carry the take date into the disposal field, months wrong and already in the box.
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where s->>'id' = 'disposal' and (f->>'defaultToday')::boolean)                  as disposal_defaults,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'id' = 'date_taken' and (f->>'defaultToday')::boolean)                as take_default,
    -- printed_date is TEXT and must stay text. The packs are coded to the month ("Best By: July
    -- 2027"), and a date input would force the filler to invent a day and then record the
    -- invention as a printed fact. Part 6 carries the last-day-of-month convention instead.
    (select f->>'type' from jsonb_array_elements(content->'form_schema'->'sections') s,
                            jsonb_array_elements(s->'fields') f
      where f->>'id' = 'printed_date')                                                as printed_type,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f,
                          jsonb_array_elements_text(f->'options') o
      where f->>'id' = 'disposition')                                                 as dispositions,
    (content->'form_schema'->'settings'->>'deletable')                                as deletable,
    (content->'form_schema'->'settings'->>'allowMultipleDrafts')                      as multi_drafts,
    (content->'form_schema'->'settings'->>'instanceTitleTemplate')                    as tmpl,
    (content->'form_schema')::text like '%thirty days after the best-by or expiration date printed on the pack%'
                                                                                      as states_period,
    (content->'form_schema')::text like '%separated from saleable stock%'             as states_separation
  into r
  from public.sop_documents where sop_number = 'FRM-703';

  if r.status <> 'draft' or r.revision <> 'New' or r.type <> 'form' or r.category <> 'Module 2' then
    raise exception 'FRM-703 seeded wrong: % / % / % / %.', r.status, r.revision, r.type, r.category;
  end if;
  if not r.sqf_required or r.sqf_reference is distinct from '2.4.4.5' then
    raise exception 'FRM-703 SQF metadata wrong: required=%, ref=%.', r.sqf_required, r.sqf_reference;
  end if;
  if r.sections <> 2 or r.fields <> 19 then
    raise exception 'FRM-703 wrong shape: % sections, % fields (expected 2 / 19).', r.sections, r.fields;
  end if;
  if r.grids_no_mode <> 0 then
    raise exception '% grids have no rows.mode - a fixed grid without it renders dynamic.', r.grids_no_mode;
  end if;
  if r.list_fields <> 4 then
    raise exception '% fields are flagged showInList, expected 4.', r.list_fields;
  end if;
  if r.signatures <> 2 then
    raise exception 'Expected two signature fields (taken / disposed), found %.', r.signatures;
  end if;
  if r.bad_widths <> 0 then
    raise exception '% fields carry a width FormRenderer does not accept.', r.bad_widths;
  end if;
  if r.disposal_defaults <> 0 then
    raise exception '% Section 2 date fields carry defaultToday; that pre-fills the take date as the disposal date.',
      r.disposal_defaults;
  end if;
  if r.take_default <> 1 then
    raise exception 'date_taken lost its defaultToday; the record is created the day the sample is taken.';
  end if;
  if r.printed_type is distinct from 'text' then
    raise exception 'printed_date is %, expected text. The packs are coded to the month, so a date input would make the filler invent a day.',
      coalesce(r.printed_type, 'missing');
  end if;
  if r.dispositions <> 6 then
    raise exception 'Disposition offers % options, expected 6 (including lost and raised-in-error).',
      r.dispositions;
  end if;
  if r.deletable is distinct from 'false' then
    raise exception 'FRM-703 is deletable - the log is the evidence the practice exists.';
  end if;
  -- Many samples are open at once, so a form that resumed one draft would be unusable.
  if r.multi_drafts is distinct from 'true' then
    raise exception 'allowMultipleDrafts is %; a draft per held sample is the whole design.',
      coalesce(r.multi_drafts, 'unset');
  end if;
  if r.tmpl is null or left(r.tmpl, 1) = '{' then
    raise exception 'instanceTitleTemplate is %, which renders as an empty title on a new draft.',
      coalesce(r.tmpl, 'unset');
  end if;
  if not (r.states_period and r.states_separation) then
    raise exception 'The form does not print the rule it enforces (period=%, separation=%).',
      r.states_period, r.states_separation;
  end if;
end $$;

commit;
