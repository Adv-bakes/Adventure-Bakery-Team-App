-- Reconcile FSQM-014 and FRM-703 with what the repo says they are.
--
-- WHY THIS EXISTS, AND IT IS A PROCESS FAILURE NOT A DESIGN ONE. 20260909000009 and ...000010 were
-- committed to a branch, pushed to production by the owner, and THEN edited in place - 000009 to add
-- the month-coded convention, 000010 to add the UPC field, the scan pins and the derived discard
-- date. `supabase db push` records a migration by FILENAME, so those later edits could never run.
-- Production ended up holding the first version of each while the repo files described the last:
--
--   FSQM-014   34 procedure lines, no month-coded bullet, no matching revision-history paragraph
--   FRM-703    19 fields, no UPC, no scan pins, no section scan, printed_date still a `date`,
--              discard_due with no derivation and the old help text
--
-- The deployed client reads section.scanLabel to draw the Scan pack button, so on that schema the
-- feature was invisible - which is how this was found. THE RULE FROM HERE: a migration file that has
-- been pushed to a branch the owner can apply is immutable. Changes go in a NEW file.
--
-- IT IS WRITTEN TO CONVERGE, NOT TO PATCH. Every step is a no-op when the target already holds the
-- intended value, so this is correct against production as it stands AND against a database replayed
-- from scratch, where 000009/000010 produce the final state and this changes nothing.
--
-- FRM-703 ALREADY HAS ONE ENTRY, so its form_schema is replaced under a guard that every field id
-- currently defined survives into the new one. Answers key on field ids; adding `upc` and retyping
-- `printed_date` keep every id, so no answer is orphaned. The entry itself is not touched.

begin;

-- ---------------------------------------------------------------- FSQM-014 Part 6
do $$
declare
  proc jsonb;
  hist text;
  ins_at int;
  n int;
begin
  select content->'procedure', content->>'revision_history' into proc, hist
    from public.sop_documents where sop_number = 'FSQM-014';
  if proc is null then
    raise exception 'FSQM-014 does not exist.';
  end if;

  select count(*) into n from jsonb_array_elements_text(proc) s
   where s like '%coded with a month and year only%';
  if n > 1 then
    raise exception 'FSQM-014 already carries % month-convention bullets.', n;
  end if;

  if n = 0 then
    -- Located by text, with the index derived in the same breath rather than assumed.
    select x.ord into ins_at from jsonb_array_elements_text(proc) with ordinality x(line, ord)
     where x.line like '%thirty days after the best-by or expiration date printed on its pack%';
    if ins_at is null then
      raise exception 'The thirty-day bullet is missing; Part 6 is not the text this expects.';
    end if;
    update public.sop_documents
       set content = jsonb_set(content, '{procedure}',
             jsonb_insert(content->'procedure', array[(ins_at - 1)::text],
                          to_jsonb($mb$• Where the pack is coded with a month and year only, the thirty days shall run from the last day of that month.$mb$::text), true))
     where sop_number = 'FSQM-014' and status = 'draft';
  end if;

  if position($anchor$THE THIRTY DAYS IS THE SITE'S OWN MARGIN$anchor$ in hist) = 0 then
    raise exception 'The revision-history anchor is missing; refusing to guess where the paragraph goes.';
  end if;
  if position('THE PACKS ARE CODED TO THE MONTH' in hist) = 0 then
    update public.sop_documents
       set content = jsonb_set(content, '{revision_history}',
             to_jsonb(replace(content->>'revision_history',
                              $anchor$THE THIRTY DAYS IS THE SITE'S OWN MARGIN$anchor$,
                              $hp$THE PACKS ARE CODED TO THE MONTH, NOT TO THE DAY. A finished pack examined on 2026-09-09 reads "Best By: July 2027" — a month and a year, with no day in it. Thirty days after that is ambiguous by up to a month, so Part 6 states the convention: the period runs from the LAST day of the coded month. That is the reading that keeps the sample longer, which is the right direction to be wrong in on a safety record. It also decides how FRM-703 records the date — as text, exactly as printed, rather than as a calendar date for which the filler would have to invent a day and then record the invention as a printed fact. A record of the pack should say what the pack says.

THE THIRTY DAYS IS THE SITE'S OWN MARGIN$hp$)))
     where sop_number = 'FSQM-014' and status = 'draft';
  end if;
end $$;

do $$
declare r record;
begin
  select status, revision,
         jsonb_array_length(content->'procedure')                                     as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%coded with a month and year only%')                         as month_bullet,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '• %')                                                        as bullets,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '> %')                                                        as prose,
         (content->>'revision_history') like '%THE PACKS ARE CODED TO THE MONTH%'     as hist_month,
         (content->>'revision_history') like '%RETENTION PERIOD%SETTLED%'             as hist_settled
    into r from public.sop_documents where sop_number = 'FSQM-014';

  if r.lines <> 35 or r.month_bullet <> 1 or r.bullets <> 12 or r.prose <> 14 then
    raise exception 'FSQM-014 wrong after reconcile: % lines, % month bullets, % bullets, % prose.',
      r.lines, r.month_bullet, r.bullets, r.prose;
  end if;
  if not (r.hist_month and r.hist_settled) then
    raise exception 'Revision history wrong: month=%, settled=%.', r.hist_month, r.hist_settled;
  end if;
  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-014 metadata moved (%/%).', r.status, r.revision;
  end if;
end $$;

-- ---------------------------------------------------------------- FRM-703 form_schema
do $$
declare
  target jsonb := $j703${"schemaVersion": 1, "settings": {"attachmentsEnabled": true, "allowMultipleDrafts": true, "deletable": false, "instanceTitleTemplate": "Retention {lot_code} — {product_name}"}, "sections": [{"id": "sample_taken", "title": "1. Sample taken", "fields": [{"id": "how_this_works", "type": "info", "label": "How this record works", "text": "One record per retention sample.\n\nComplete this section when the sample is taken and SAVE IT AS A DRAFT. The entry stays a draft for as long as the sample is physically on the shelf, so the list of drafts on this form is the list of samples the site is holding, and it can be sorted by Discard due to see what is now due. Complete Section 2 and submit the entry when the sample leaves the shelf.\n\nWHAT IS RETAINED — one sealed unit of finished product from each production batch, in the pack it shipped in, held under the product's normal storage conditions, identified as a retention sample and kept separate from saleable stock so that it cannot be picked and shipped.\n\nHOW LONG — until thirty days after the best-by or expiration date printed on the pack, then discarded; unless a customer agreement requires longer for that customer's product, in which case the longer period applies. Where the pack is coded with a month and year only, count the thirty days from the LAST day of that month.\n\nRetention samples are not required of this site by any customer or by any regulation. The site keeps them anyway, and FSQM-014 Part 6 states the basis."}, {"id": "product_name", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true, "scanFact": "product_name"}, {"id": "lot_code", "type": "text", "label": "Lot / batch code", "width": "half", "required": true, "showInList": true, "help": "Exactly as coded on the pack — the same code as this batch's FRM-701 release record.", "scanFact": "lot_code"}, {"id": "upc", "type": "text", "label": "UPC / barcode digits", "width": "third", "scanFact": "barcode", "help": "The digits printed under the barcode. Self-checking — a UPC carries a check digit, so a misread is detectable in a way a lot code never is."}, {"id": "customer", "type": "text", "label": "Customer", "width": "third", "scanFact": "none"}, {"id": "date_produced", "type": "date", "label": "Date produced", "width": "third"}, {"id": "date_taken", "type": "date", "label": "Date sample taken", "width": "third", "required": true, "defaultToday": true}, {"id": "pack_description", "type": "text", "label": "Pack retained", "width": "third", "help": "The pack and count as retained, e.g. one 12-count case.", "scanFact": "none"}, {"id": "units_retained", "type": "number", "label": "Units retained", "width": "third", "min": 1, "defaultValue": 1, "help": "One sealed unit per batch unless a customer agreement requires more."}, {"id": "printed_date", "type": "text", "label": "Best-by or expiration date printed on the pack", "width": "half", "required": true, "help": "Copy it EXACTLY as printed, off the pack being retained — if the pack says only a month and year, write that. Do not convert it to a day.", "scanFact": "best_by"}, {"id": "discard_due", "type": "date", "label": "Discard due", "width": "half", "required": true, "showInList": true, "help": "Filled from the printed date — thirty days, counting from the last day of the month where the pack is coded to a month only (FSQM-014 Part 6). It updates if you correct the printed date. Change it by hand only where a customer agreement requires a longer period, and name that agreement in the next field.", "derive": {"fromField": "printed_date", "addDays": 30, "monthOnly": "last", "label": "Due"}}, {"id": "longer_period_required", "type": "text", "label": "Customer agreement requiring a longer period", "width": "full", "help": "Name the customer and the period where one applies. Leave blank where the standard period is used."}, {"id": "storage_location", "type": "text", "label": "Storage location", "width": "half", "required": true, "showInList": true, "help": "Where the sample is held. It must be identified as a retention sample and separated from saleable stock."}, {"id": "taken_by", "type": "signature", "label": "Sample taken by", "width": "half", "required": true, "statement": "I took this sample from the batch recorded above and placed it in the location recorded here."}], "scanLabel": true, "scanMode": "finished_goods"}, {"id": "disposal", "title": "2. Disposal", "fields": [{"id": "disposal_info", "type": "info", "label": "Complete this section when the sample leaves the shelf", "text": "A sample leaves the shelf at the end of its retention period, or earlier if it is needed for a complaint or an investigation. Record what happened to it here, then SUBMIT the entry.\n\nDo not submit while the sample is still being held — a submitted entry reads as a sample that is gone.\n\nIf a sample cannot be found, say so. A missing sample recorded honestly is something the site can act on; a missing sample with no record is something nobody can explain."}, {"id": "disposition", "type": "select", "label": "What happened to the sample", "width": "half", "required": true, "options": ["Discarded at the end of the retention period", "Used for a complaint or an investigation", "Sent to the customer on request", "Discarded before the end of the retention period", "Lost or unaccounted for", "Record raised in error — no sample was taken"]}, {"id": "disposal_date", "type": "date", "label": "Date", "width": "half", "required": true, "help": "The date the sample actually left the shelf."}, {"id": "complaint_or_capa_ref", "type": "text", "label": "Complaint / CAPA reference", "width": "third", "help": "Where the sample was used for an investigation — the FRM-002 complaint number or the FRM-007 CAPA number."}, {"id": "disposal_reason", "type": "textarea", "label": "Reason / notes", "rows": 3, "width": "full", "help": "Required in substance for anything other than discard at the end of the retention period."}, {"id": "disposed_by", "type": "signature", "label": "Disposed by", "width": "half", "required": true, "statement": "I disposed of this sample as recorded above."}]}]}$j703$::jsonb;
  doc record;
  orphaned int;
begin
  select id, status, revision into doc from public.sop_documents where sop_number = 'FRM-703';
  if doc.id is null then
    raise exception 'FRM-703 does not exist.';
  end if;
  if doc.status is distinct from 'draft' or doc.revision is distinct from 'New' then
    raise exception 'FRM-703 is %/% , expected draft/New. An issued form is not replaced this way.',
      doc.status, doc.revision;
  end if;

  -- Answers key on field ids. Every id the current schema defines must survive, or an existing
  -- entry's answer becomes an orphan in the "Unmapped answers" block.
  select count(*) into orphaned
    from (select f->>'id' as id
            from public.sop_documents d,
                 jsonb_array_elements(d.content->'form_schema'->'sections') s,
                 jsonb_array_elements(s->'fields') f
           where d.sop_number = 'FRM-703') cur
   where cur.id not in (select nf->>'id'
                          from jsonb_array_elements(target->'sections') ns,
                               jsonb_array_elements(ns->'fields') nf);
  if orphaned <> 0 then
    raise exception '% field ids would disappear, orphaning answers on the existing entry.', orphaned;
  end if;

  update public.sop_documents
     set content = jsonb_set(content, '{form_schema}', target)
   where sop_number = 'FRM-703' and status = 'draft';
end $$;

do $$
declare r record;
begin
  select (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f)                    as fields,
         (content->'form_schema'->'sections'->0->>'scanLabel')                         as scan_on,
         (content->'form_schema'->'sections'->0->>'scanMode')                          as scan_mode,
         (select string_agg(f->>'id' || '=' || (f->>'scanFact'), ',' order by f->>'id')
            from jsonb_array_elements(content->'form_schema'->'sections') s,
                 jsonb_array_elements(s->'fields') f where f ? 'scanFact')             as pins,
         (select f->>'type' from jsonb_array_elements(content->'form_schema'->'sections') s,
                                 jsonb_array_elements(s->'fields') f
           where f->>'id' = 'printed_date')                                            as printed_type,
         (select f->'derive' from jsonb_array_elements(content->'form_schema'->'sections') s,
                                  jsonb_array_elements(s->'fields') f
           where f->>'id' = 'discard_due')                                             as derive,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'id' = 'discard_due'
             and f->>'help' like 'Filled from the printed date%')                      as new_help,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where (f->>'showInList')::boolean)                                          as list_fields,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'signature')                                             as signatures,
         (content->'form_schema'->'settings'->>'deletable')                            as deletable,
         (content->'form_schema'->'settings'->>'allowMultipleDrafts')                  as multi
    into r from public.sop_documents where sop_number = 'FRM-703';

  if r.fields <> 20 then
    raise exception 'FRM-703 has % fields, expected 20.', r.fields;
  end if;
  if r.scan_on is distinct from 'true' or r.scan_mode is distinct from 'finished_goods' then
    raise exception 'Section 1 scan is %/% , expected true/finished_goods.',
      coalesce(r.scan_on, 'unset'), coalesce(r.scan_mode, 'unset');
  end if;
  if r.pins is distinct from 'customer=none,lot_code=lot_code,pack_description=none,printed_date=best_by,product_name=product_name,upc=barcode' then
    raise exception 'Scan pins are wrong: %.', coalesce(r.pins, 'none');
  end if;
  -- The packs are coded to the month, so a native date input cannot hold what is printed.
  if r.printed_type is distinct from 'text' then
    raise exception 'printed_date is %, expected text.', coalesce(r.printed_type, 'missing');
  end if;
  if r.derive is null
     or r.derive->>'fromField' is distinct from 'printed_date'
     or (r.derive->>'addDays')::int is distinct from 30
     or r.derive->>'monthOnly' is distinct from 'last' then
    raise exception 'discard_due does not derive 30 days from month end: %.',
      coalesce(r.derive::text, 'unset');
  end if;
  if r.new_help <> 1 then
    raise exception 'discard_due still tells the filler to compute the date themselves.';
  end if;
  if r.list_fields <> 4 or r.signatures <> 2 then
    raise exception 'Shape moved: % list fields, % signatures.', r.list_fields, r.signatures;
  end if;
  if r.deletable is distinct from 'false' or r.multi is distinct from 'true' then
    raise exception 'Settings moved: deletable=%, multipleDrafts=%.', r.deletable, r.multi;
  end if;
end $$;

commit;
