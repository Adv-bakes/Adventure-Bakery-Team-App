-- Retention samples are taken PER PRODUCT, and the shelf now has a name.
--
-- D-15's last open input, answered by the owner on 2026-09-09: a sample is retained per PRODUCT,
-- not per production batch, and samples live on a reserved shelving spot in the room-temperature
-- warehouse. Part 6 was drafted saying per BATCH - inferred, and flagged in the revision history as
-- an inference, because that is the unit the rest of the system uses (FRM-701 releases a batch).
-- The inference was wrong, which is why it was flagged rather than asserted.
--
-- THE CONSEQUENCE IS WRITTEN INTO PART 6, NOT JUST INTO THE HISTORY. A retention sample can only
-- answer a question about the lot it came from. Organised by product, the shelf will not hold a unit
-- of every lot in the market whenever a product runs more than once inside the retention period. The
-- site is not required to keep retention samples at all, so that is not a deficiency against
-- 2.4.4.5 - but a document implying every lot is covered would claim a control the site does not
-- operate, which is the exact defect this programme keeps removing from other documents. A new prose
-- line states the limit and points at the batch sheet and FRM-701, which do cover every lot.
--
-- THE LOCATION IS NAMED. "A designated location" was a placeholder for an answer nobody had. Ambient
-- is the product's normal storage condition here - everything this site ships is ambient - so
-- 2.4.4.5's "typical storage conditions for the product" is satisfied by the shelf as it stands.
--
-- FRM-703 IS PATCHED AT {form_schema,sections,0,fields} ONLY, NEVER WHOLESALE. The owner removed
-- settings.deletable deliberately (see 20260909000012); replacing the whole form_schema from a repo
-- payload would silently put it back. Three fields repeat the rule and all three move: the
-- instructions block, the units help, and the storage location - which also gains the shelf as its
-- default, so the standard answer is already in the box.
--
-- Both documents are still DRAFT. This closes the last input D-15 was waiting on.

begin;

-- CARRIAGE RETURNS FIRST, BEFORE ANYTHING IS MATCHED. `db push` sends the file's own bytes, and on
-- a CRLF checkout a raw multi-line dollar-quoted string writes a carriage return into the stored
-- text. Two earlier migrations did exactly that to this document - 6 of them in Records and 2 in
-- the revision history - and the character is invisible on screen while making every exact-match
-- guard fail against it. Stripped here so the matching below compares like with like, and again at
-- the end so this migration cannot leave its own behind. .gitattributes now pins these files to LF;
-- this is the belt to that braces, because it still works if the attribute is ever lost.
update public.sop_documents
   set content = jsonb_set(
         jsonb_set(content, '{records}',
                   to_jsonb(replace(content->>'records', chr(13), ''))),
         '{revision_history}',
         to_jsonb(replace(content->>'revision_history', chr(13), '')))
 where sop_number = 'FSQM-014' and status = 'draft'
   and (position(chr(13) in content->>'records') > 0
     or position(chr(13) in content->>'revision_history') > 0);

do $$
declare
  proc jsonb;
  hist text;
  n int;
begin
  select content->'procedure', content->>'revision_history' into proc, hist
    from public.sop_documents where sop_number = 'FSQM-014';
  if proc is null then
    raise exception 'FSQM-014 does not exist.';
  end if;

  select count(*) into n from jsonb_array_elements_text(proc) s where s = $ou$• One sealed unit of finished product shall be retained from each production batch, in the pack and configuration in which that batch shipped.$ou$;
  if n <> 1 then
    raise exception 'The per-batch unit bullet is not present exactly once (found %).', n;
  end if;
  select count(*) into n from jsonb_array_elements_text(proc) s where s = $os$• Retained samples shall be held under the product's normal storage conditions, in a designated location, identified as retention samples and kept separate from saleable stock so that one cannot be picked and shipped.$os$;
  if n <> 1 then
    raise exception 'The designated-location bullet is not present exactly once (found %).', n;
  end if;
  select count(*) into n from jsonb_array_elements_text(proc) s where s like $af$• Each retained sample shall be logged on FRM-703 Retention Sample Log when it is taken$af$ || '%';
  if n <> 1 then
    raise exception 'The FRM-703 logging bullet is not present exactly once (found %).', n;
  end if;
  select count(*) into n from jsonb_array_elements_text(proc) s
   where s like '%speaks for the lot it was taken from%';
  if n <> 0 then
    raise exception 'The coverage paragraph is already present; this migration has run.';
  end if;
  if position(replace($pair$2. Retention samples — the PERIOD is settled above; confirm the UNIT and the LOCATION. Part 6 states one sealed unit per production batch, in the pack it shipped in, held in a designated location and separated from saleable stock. Per-batch was chosen rather than confirmed: it is the only unit consistent with the rest of the system, since FRM-701 releases a batch and a sample taken per product or per production day cannot answer a question about a specific lot when two lots ran the same day. Confirm that it matches what the floor actually does, and name the designated storage location, so that Part 6 and FRM-703 describe the real practice rather than a reasonable-sounding one.

3. The consultant scored 2.4.4.5 Minor$pair$, chr(13), '') in hist) = 0 then
    raise exception 'Open item 2 and the item 3 that follows it are not in the shape this replaces.';
  end if;
end $$;

create temporary table fsqm014_pp_before on commit drop as
select md5((content - 'procedure' - 'revision_history')::text) as rest_h,
       (select jsonb_agg(x.line order by x.ord)
          from jsonb_array_elements(content->'procedure') with ordinality x(line, ord)
         where (x.line #>> '{}') not in ($ou$• One sealed unit of finished product shall be retained from each production batch, in the pack and configuration in which that batch shipped.$ou$, $os$• Retained samples shall be held under the product's normal storage conditions, in a designated location, identified as retention samples and kept separate from saleable stock so that one cannot be picked and shipped.$os$)) as other_lines,
       (content->>'revision_history')                          as history
  from public.sop_documents where sop_number = 'FSQM-014';

-- Two bullets rewritten in place; the coverage paragraph inserted after the logging bullet.
update public.sop_documents d
   set content = jsonb_set(d.content, '{procedure}', (
         select jsonb_agg(v order by ord, sub)
           from (
             select case when (x.line #>> '{}') = $ou$• One sealed unit of finished product shall be retained from each production batch, in the pack and configuration in which that batch shipped.$ou$ then to_jsonb($nu$• A sealed unit of each finished product shall be retained, in the pack and configuration in which it shipped.$nu$::text)
                         when (x.line #>> '{}') = $os$• Retained samples shall be held under the product's normal storage conditions, in a designated location, identified as retention samples and kept separate from saleable stock so that one cannot be picked and shipped.$os$ then to_jsonb($ns$• Retained samples shall be held on the reserved retention shelf in the ambient warehouse, which is the product's normal storage condition, identified as retention samples and kept separate from saleable stock so that one cannot be picked and shipped.$ns$::text)
                         else x.line end as v,
                    x.ord as ord, 0 as sub
               from jsonb_array_elements(d.content->'procedure') with ordinality x(line, ord)
             union all
             select to_jsonb($cv$> A retained sample speaks for the lot it was taken from and for no other. Retention here is organised by product rather than by batch, so where a product runs more than once inside the retention period the shelf will not hold a unit of every lot that is in the market. That limit is stated here rather than discovered during a complaint: the sample shows what a product was as made, packed, coded and labelled, and it is the batch sheet and FRM-701 that answer what happened on a particular run.$cv$::text), x.ord, 1
               from jsonb_array_elements(d.content->'procedure') with ordinality x(line, ord)
              where (x.line #>> '{}') like $af$• Each retained sample shall be logged on FRM-703 Retention Sample Log when it is taken$af$ || '%'
           ) merged))
 where d.sop_number = 'FSQM-014' and d.status = 'draft';

-- Item 2 is removed and item 3 renumbered in ONE replace, so there is never a moment where two
-- items claim the same number. Matching the pair together also means a partial match cannot half-
-- apply it: either both move or the after-guard fails.
update public.sop_documents
   set content = jsonb_set(content, '{revision_history}',
         to_jsonb(
           replace(
             replace(content->>'revision_history',
               'OPEN BEFORE ISSUE — three things the site must settle:',
               $st$RETENTION UNIT AND LOCATION — SETTLED 2026-09-09, and the unit is NOT what this document first assumed. Part 6 was drafted stating one sealed unit per PRODUCTION BATCH, inferred rather than confirmed because that is the unit the rest of the system uses — FRM-701 releases a batch. The owner confirmed the actual practice: a sample is retained PER PRODUCT, and samples are stored on a reserved shelving spot in the room-temperature warehouse. Part 6 now says both, and names the shelf rather than referring to "a designated location".

THE DIFFERENCE IS NOT COSMETIC AND IS RECORDED IN PART 6 ITSELF. A retention sample can only answer a question about the lot it came from. Organised by product, the shelf will not hold a unit of every lot in the market whenever a product runs more than once inside the retention period, so a complaint about an older lot may find no matching sample. The site is not required to hold retention samples at all, so this is not a deficiency against 2.4.4.5 — but a document that implied every lot was covered would be claiming a control the site does not operate, which is the defect this whole programme keeps removing. Part 6 states the limit and points at the records that do cover every lot.

Ambient storage is the product's normal storage condition — everything this site ships is ambient — so 2.4.4.5's "stored according to the typical storage conditions for the product" is met by the shelf as it stands, and is now evidenced rather than asserted.

OPEN BEFORE ISSUE — two things the site must settle:$st$),
             replace($pair$2. Retention samples — the PERIOD is settled above; confirm the UNIT and the LOCATION. Part 6 states one sealed unit per production batch, in the pack it shipped in, held in a designated location and separated from saleable stock. Per-batch was chosen rather than confirmed: it is the only unit consistent with the rest of the system, since FRM-701 releases a batch and a sample taken per product or per production day cannot answer a question about a specific lot when two lots ran the same day. Confirm that it matches what the floor actually does, and name the designated storage location, so that Part 6 and FRM-703 describe the real practice rather than a reasonable-sounding one.

3. The consultant scored 2.4.4.5 Minor$pair$, chr(13), ''),
             $ni$2. The consultant scored 2.4.4.5 Minor$ni$)
         )::jsonb)
 where sop_number = 'FSQM-014' and status = 'draft';

do $$
declare
  r record;
  drift int;
begin
  select status, revision,
         jsonb_array_length(content->'procedure')                                     as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%A sealed unit of each finished product%')                   as unit_rule,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%from each production batch%')                               as old_unit,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%reserved retention shelf in the ambient warehouse%')         as shelf,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%in a designated location%')                                 as placeholder,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%speaks for the lot it was taken from%')                      as coverage,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '• %')                                                        as bullets,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '> %')                                                        as prose,
         (content->>'revision_history') like '%RETENTION UNIT AND LOCATION — SETTLED 2026-09-09%' as settled,
         (content->>'revision_history') like '%OPEN BEFORE ISSUE — two things the site must settle:%' as heading,
         (content->>'revision_history') like '%2. The consultant scored 2.4.4.5 Minor%'  as item2,
         (content->>'revision_history') like '%3. %'                                     as leftover3,
         (content->>'revision_history') like '%confirm the UNIT and the LOCATION%'        as old_item
    into r from public.sop_documents where sop_number = 'FSQM-014';

  if r.lines <> 36 then
    raise exception 'Procedure is % lines, expected 36 (35 plus the coverage paragraph).', r.lines;
  end if;
  if r.unit_rule <> 1 or r.old_unit <> 0 then
    raise exception 'Unit rule wrong: per-product=%, per-batch still present=%.', r.unit_rule, r.old_unit;
  end if;
  if r.shelf <> 1 or r.placeholder <> 0 then
    raise exception 'Location wrong: shelf named=%, placeholder still present=%.', r.shelf, r.placeholder;
  end if;
  if r.coverage <> 1 then
    raise exception 'The coverage limit was not stated (found %).', r.coverage;
  end if;
  if r.bullets <> 12 or r.prose <> 15 then
    raise exception 'Line forms wrong: % bullets, % prose (expected 12 / 15).', r.bullets, r.prose;
  end if;
  if not (r.settled and r.heading and r.item2) or r.old_item or r.leftover3 then
    raise exception 'History wrong: settled=%, heading=%, item2=%, old item=%, leftover 3=%.',
      r.settled, r.heading, r.item2, r.old_item, r.leftover3;
  end if;
  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-014 metadata moved (%/%).', r.status, r.revision;
  end if;

  select count(*) into drift
    from public.sop_documents d, fsqm014_pp_before b
   where d.sop_number = 'FSQM-014'
     and (md5((d.content - 'procedure' - 'revision_history')::text) is distinct from b.rest_h
       or (select jsonb_agg(x.line order by x.ord)
             from jsonb_array_elements(d.content->'procedure') with ordinality x(line, ord)
            where (x.line #>> '{}') not in ($nu$• A sealed unit of each finished product shall be retained, in the pack and configuration in which it shipped.$nu$, $ns$• Retained samples shall be held on the reserved retention shelf in the ambient warehouse, which is the product's normal storage condition, identified as retention samples and kept separate from saleable stock so that one cannot be picked and shipped.$ns$, $cv$> A retained sample speaks for the lot it was taken from and for no other. Retention here is organised by product rather than by batch, so where a product runs more than once inside the retention period the shelf will not hold a unit of every lot that is in the market. That limit is stated here rather than discovered during a complaint: the sample shows what a product was as made, packed, coded and labelled, and it is the batch sheet and FRM-701 that answer what happened on a particular run.$cv$))
          is distinct from b.other_lines
       or length(d.content->>'revision_history') <= length(b.history));
  if drift <> 0 then
    raise exception 'FSQM-014 changed beyond Part 6 and its revision history. Rolled back.';
  end if;
end $$;

-- This migration's own settled block is multi-line, so it may have arrived CRLF. Clean up after
-- ourselves rather than leaving the next exact-match guard to trip over it.
update public.sop_documents
   set content = jsonb_set(
         jsonb_set(content, '{records}',
                   to_jsonb(replace(content->>'records', chr(13), ''))),
         '{revision_history}',
         to_jsonb(replace(content->>'revision_history', chr(13), '')))
 where sop_number = 'FSQM-014' and status = 'draft';

do $$
declare crs int;
begin
  select count(*) into crs
    from public.sop_documents d, lateral jsonb_each_text(d.content) k(key, value)
   where d.sop_number = 'FSQM-014'
     and jsonb_typeof(d.content->k.key) = 'string'
     and position(chr(13) in k.value) > 0;
  if crs <> 0 then
    raise exception '% FSQM-014 fields still contain a carriage return.', crs;
  end if;
end $$;

-- ---------------------------------------------------------------- FRM-703 section 1
do $$
declare r record;
begin
  update public.sop_documents
     set content = jsonb_set(content, '{form_schema,sections,0,fields}',
           $f703$[{"id": "how_this_works", "type": "info", "label": "How this record works", "text": "One record per retention sample.\n\nComplete this section when the sample is taken and SAVE IT AS A DRAFT. The entry stays a draft for as long as the sample is physically on the shelf, so the list of drafts on this form is the list of samples the site is holding, and it can be sorted by Discard due to see what is now due. Complete Section 2 and submit the entry when the sample leaves the shelf.\n\nWHAT IS RETAINED — a sealed unit of each finished product, in the pack it shipped in, held on the reserved retention shelf in the ambient warehouse, identified as a retention sample and kept separate from saleable stock so that it cannot be picked and shipped. Record the lot it came from: a sample speaks for its own lot and no other.\n\nHOW LONG — until thirty days after the best-by or expiration date printed on the pack, then discarded; unless a customer agreement requires longer for that customer's product, in which case the longer period applies. Where the pack is coded with a month and year only, count the thirty days from the LAST day of that month.\n\nRetention samples are not required of this site by any customer or by any regulation. The site keeps them anyway, and FSQM-014 Part 6 states the basis."}, {"id": "product_name", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true, "scanFact": "product_name"}, {"id": "lot_code", "type": "text", "label": "Lot / batch code", "width": "half", "required": true, "showInList": true, "help": "Exactly as coded on the pack — the same code as this batch's FRM-701 release record.", "scanFact": "lot_code"}, {"id": "upc", "type": "text", "label": "UPC / barcode digits", "width": "third", "scanFact": "barcode", "help": "The digits printed under the barcode. Self-checking — a UPC carries a check digit, so a misread is detectable in a way a lot code never is."}, {"id": "customer", "type": "text", "label": "Customer", "width": "third", "scanFact": "none"}, {"id": "date_produced", "type": "date", "label": "Date produced", "width": "third"}, {"id": "date_taken", "type": "date", "label": "Date sample taken", "width": "third", "required": true, "defaultToday": true}, {"id": "pack_description", "type": "text", "label": "Pack retained", "width": "third", "help": "The pack and count as retained, e.g. one 12-count case.", "scanFact": "none"}, {"id": "units_retained", "type": "number", "label": "Units retained", "width": "third", "min": 1, "defaultValue": 1, "help": "One sealed unit unless a customer agreement requires more."}, {"id": "printed_date", "type": "text", "label": "Best-by or expiration date printed on the pack", "width": "half", "required": true, "help": "Copy it EXACTLY as printed, off the pack being retained — if the pack says only a month and year, write that. Do not convert it to a day.", "scanFact": "best_by"}, {"id": "discard_due", "type": "date", "label": "Discard due", "width": "half", "required": true, "showInList": true, "help": "Filled from the printed date — thirty days, counting from the last day of the month where the pack is coded to a month only (FSQM-014 Part 6). It updates if you correct the printed date. Change it by hand only where a customer agreement requires a longer period, and name that agreement in the next field.", "derive": {"fromField": "printed_date", "addDays": 30, "monthOnly": "last", "label": "Due"}}, {"id": "longer_period_required", "type": "text", "label": "Customer agreement requiring a longer period", "width": "full", "help": "Name the customer and the period where one applies. Leave blank where the standard period is used."}, {"id": "storage_location", "type": "text", "label": "Storage location", "width": "half", "required": true, "showInList": true, "help": "The standard location is the reserved retention shelf in the ambient warehouse. Change it only if this sample is held somewhere else. It must be identified as a retention sample and kept separate from saleable stock.", "defaultValue": "Reserved retention shelf, ambient warehouse"}, {"id": "taken_by", "type": "signature", "label": "Sample taken by", "width": "half", "required": true, "statement": "I took this sample from the batch recorded above and placed it in the location recorded here."}]$f703$::jsonb)
   where sop_number = 'FRM-703' and status = 'draft';

  select (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f)                   as fields,
         (content->'form_schema'->'settings' ? 'deletable')                           as deletable_back,
         (content->'form_schema'->'sections'->0->>'scanLabel')                        as scan_on,
         (select f->>'defaultValue' from jsonb_array_elements(content->'form_schema'->'sections') s,
                                         jsonb_array_elements(s->'fields') f
           where f->>'id' = 'storage_location')                                       as shelf_default,
         (content->'form_schema')::text like '%reserved retention shelf in the ambient warehouse%' as shelf_text,
         (content->'form_schema')::text like '%from each production batch%'           as old_unit,
         (select f->'derive' from jsonb_array_elements(content->'form_schema'->'sections') s,
                                  jsonb_array_elements(s->'fields') f
           where f->>'id' = 'discard_due')                                            as derive
    into r from public.sop_documents where sop_number = 'FRM-703';

  if r.fields <> 20 then
    raise exception 'FRM-703 has % fields, expected 20.', r.fields;
  end if;
  -- The owner removed this deliberately; a wholesale replace would have restored it.
  if r.deletable_back then
    raise exception 'settings.deletable came back; the patch was not confined to the fields array.';
  end if;
  if r.shelf_default is distinct from 'Reserved retention shelf, ambient warehouse' then
    raise exception 'Storage location default is %.', coalesce(r.shelf_default, 'unset');
  end if;
  if not r.shelf_text or r.old_unit then
    raise exception 'Form text wrong: shelf named=%, per-batch wording still present=%.',
      r.shelf_text, r.old_unit;
  end if;
  if r.scan_on is distinct from 'true' or r.derive is null then
    raise exception 'The fields patch dropped the scan or the derivation (scan=%, derive=%).',
      coalesce(r.scan_on, 'unset'), coalesce(r.derive::text, 'unset');
  end if;
end $$;

commit;
