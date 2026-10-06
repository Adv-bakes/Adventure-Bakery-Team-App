-- Net weight check at release: FSQM-020 v2 -> v3, FRM-701 New -> v2. Approved GJM, effective 2026-10-05.
--
-- Raised while preparing FSQM-010 for issue (D-08). SQF 2.4.1.1 names net weight among the legal
-- requirements finished product must meet at delivery. Weight was checked only when batter was
-- deposited into the molds - before baking and before the syrup - so the weight of the finished pack
-- was not known. The owner's decision (2026-10-05): weigh three packs per lot at release.
--
--   FSQM-020  one release check added after the quantity check (procedure[14]); 2.4.1.1 added to its
--             SQF reference; 27 -> 28 lines.
--   FRM-701   a ninth row on the release checks grid, APPENDED so the eight existing rows keep their
--             positions (a fixed grid keys answers by position), and six fields under the grid: the
--             net weight on the label, the empty packaging weight, the unit, and three pack weights.
--             No weight is prefilled or suggested - each is a measurement.
--
-- Guarded on the md5 of each document's content as it stands in production (read 2026-10-05).

begin;

do $guard$
declare h text; rev text;
begin
  select md5(content::text), revision into h, rev from public.sop_documents where sop_number = 'FSQM-020' and status = 'active';
  if rev is distinct from 'v2' or h <> 'ece3a9893269057486f81d161dd58b43' then raise exception 'FSQM-020 is % or changed (md5 %).', rev, h; end if;
  select md5(content::text), revision into h, rev from public.sop_documents where sop_number = 'FRM-701' and status = 'active';
  if rev is distinct from 'New' or h <> '13a18a0685e60eb411136ff7263b7c3e' then raise exception 'FRM-701 is % or changed (md5 %).', rev, h; end if;
  if not exists (select 1 from public.sop_documents where sop_number = 'FSQM-030' and status = 'active') then
    raise exception 'FSQM-030 Calibration Program is not issued.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(jsonb_insert(content, '{procedure,14}', to_jsonb($t$• Three finished packs taken from the batch are weighed on a scale that is in the calibration program (FSQM-030). With the weight of the empty packaging taken off, the average of the three is at or above the net weight declared on the label. The weights are recorded on FRM-701 (SQF 2.4.1.1).$t$::text)),
                   '{revision_history}', to_jsonb((content->>'revision_history') || $t$

v3 — 2026-10-05 — Net weight check added to the release checks. Until now weight was checked only when the batter was deposited into the molds - before baking, and before the syrup - so the weight of the finished pack was not known. Three packs from each batch are now weighed at release and the weights recorded on FRM-701, which goes to v2 with the added row and fields. SQF 2.4.1.1 names net weight among the legal requirements finished product must meet when it is delivered, and that clause is added to this program's references.$t$)),
       sqf_reference = sqf_reference || ', 2.4.1.1',
       revision = 'v3', effective_date = date '2026-10-05', approved_by = 'GJM'
 where sop_number = 'FSQM-020' and status = 'active' and revision = 'v2';

do $form$
begin
  update public.sop_documents
     set content = jsonb_insert(content, '{form_schema,sections,1,fields,1,rows,labels,-1}', to_jsonb($t$Net weight
Three finished packs weighed. With the empty packaging taken off, their average is at or above the net weight on the label. Weights recorded below.$t$::text), true)
   where sop_number = 'FRM-701' and status = 'active';

  update public.sop_documents
     set content = jsonb_insert(content, '{form_schema,sections,1,fields,-1}', $j${"id": "net_weight_declared", "type": "text", "label": "Net weight on the label", "width": "third", "help": "As printed on the pack, with its unit"}$j$::jsonb, true)
   where sop_number = 'FRM-701' and status = 'active';
  update public.sop_documents
     set content = jsonb_insert(content, '{form_schema,sections,1,fields,-1}', $j${"id": "packaging_tare", "type": "number", "label": "Empty packaging weight", "width": "third", "help": "The empty pouch, baking cup and box together, in the same unit"}$j$::jsonb, true)
   where sop_number = 'FRM-701' and status = 'active';
  update public.sop_documents
     set content = jsonb_insert(content, '{form_schema,sections,1,fields,-1}', $j${"id": "net_weight_unit", "type": "select", "label": "Unit weighed in", "width": "third", "options": ["oz", "g", "lb"]}$j$::jsonb, true)
   where sop_number = 'FRM-701' and status = 'active';
  update public.sop_documents
     set content = jsonb_insert(content, '{form_schema,sections,1,fields,-1}', $j${"id": "pack_weight_1", "type": "number", "label": "Pack 1 weight", "width": "third", "help": "The whole finished pack, as weighed"}$j$::jsonb, true)
   where sop_number = 'FRM-701' and status = 'active';
  update public.sop_documents
     set content = jsonb_insert(content, '{form_schema,sections,1,fields,-1}', $j${"id": "pack_weight_2", "type": "number", "label": "Pack 2 weight", "width": "third"}$j$::jsonb, true)
   where sop_number = 'FRM-701' and status = 'active';
  update public.sop_documents
     set content = jsonb_insert(content, '{form_schema,sections,1,fields,-1}', $j${"id": "pack_weight_3", "type": "number", "label": "Pack 3 weight", "width": "third"}$j$::jsonb, true)
   where sop_number = 'FRM-701' and status = 'active';

  update public.sop_documents
     set sqf_reference = sqf_reference || ', 2.4.1.1',
         revision = 'v2', effective_date = date '2026-10-05', approved_by = 'GJM'
   where sop_number = 'FRM-701' and status = 'active' and revision = 'New';
end $form$;

do $verify$
declare p jsonb; fs jsonb; txt text; ids text;
begin
  if (select count(*) from public.sop_documents
       where (sop_number, status, revision, approved_by, effective_date, sqf_reference) in (
         ('FSQM-020', 'active', 'v3', 'GJM', date '2026-10-05', '2.4.7.1, 2.4.7.2, 2.4.7.3, 2.4.1.1'),
         ('FRM-701', 'active', 'v2', 'GJM', date '2026-10-05', '2.4.7.1, 2.4.7.2, 2.4.7.3, 2.4.1.1'))) <> 2 then
    raise exception 'FSQM-020 / FRM-701 were not both stamped.';
  end if;

  select content->'procedure', content::text into p, txt from public.sop_documents where sop_number = 'FSQM-020' and status = 'active';
  if jsonb_array_length(p) <> 28 or p->>14 not like '%Three finished packs%recorded on FRM-701 (SQF 2.4.1.1).'
     or p->>13 not like '%quantity and pack configuration%' or p->>15 not like 'The site does not use positive release%' then
    raise exception 'FSQM-020 release check not inserted where expected.';
  end if;
  if txt not like '%v3 % 2026-10-05 % Net weight check added%' then raise exception 'FSQM-020 has no v3 history line.'; end if;

  select content->'form_schema' into fs from public.sop_documents where sop_number = 'FRM-701' and status = 'active';
  if jsonb_array_length(fs->'sections'->1->'fields'->1->'rows'->'labels') <> 9
     or fs->'sections'->1->'fields'->1->'rows'->'labels'->>8 not like 'Net weight%'
     or fs->'sections'->1->'fields'->1->'rows'->'labels'->>0 not like 'Batch sheet complete and signed%'
     or fs->'sections'->1->'fields'->1->'rows'->'labels'->>7 not like 'Quantity and pack configuration%' then
    raise exception 'FRM-701 release checks grid is not the eight old rows plus net weight.';
  end if;
  select string_agg(f->>'id', ',' order by o) into ids from jsonb_array_elements(fs->'sections'->1->'fields') with ordinality x(f, o);
  if ids is distinct from 'checks_info,checks,net_weight_declared,packaging_tare,net_weight_unit,pack_weight_1,pack_weight_2,pack_weight_3' then
    raise exception 'FRM-701 section 2 fields are %', ids;
  end if;
  if (select count(*) from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f) <> 26 then
    raise exception 'FRM-701 field count is wrong.';
  end if;
  if (select count(distinct f->>'id') from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f) <> 26 then
    raise exception 'FRM-701 has a duplicate field id.';
  end if;
  if fs::text like '%"default"%' and fs::text like '%pack_weight%default%' then raise exception 'a weight must not be prefilled.'; end if;
end $verify$;

commit;
