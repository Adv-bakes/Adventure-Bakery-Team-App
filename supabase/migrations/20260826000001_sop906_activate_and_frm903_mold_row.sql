-- SOP-906 activated, and FRM-903 gains the row that records it.
--
-- One migration on purpose: FRM-903 is about to reference SOP-906, so SOP-906 goes active first in
-- the same transaction. A form pointing at a draft procedure is a document-control defect, and
-- splitting these would create one for however long the second migration took to land.
--
-- Effective 2026-08-26, approved GJM. Note the date: the database's current_date reads 2026-08-27
-- because it is past midnight UTC, but the business day is the 26th. Stamping a controlled document
-- a day ahead of the day it was approved is the kind of thing that is very hard to explain later.
--
-- SOP-906's revision_history carried an "OPEN BEFORE ACTIVATION" block. That heading is rewritten
-- here rather than deleted: leaving it on an ACTIVE document would read as "we issued this knowing
-- it was not ready", and deleting it would lose three commitments that are still owed. It becomes a
-- forward plan, which is what it actually is - none of the three blocks having a written procedure,
-- and having none at all was the finding.
--
-- FRM-903 changes, all in section 2 (equipment_ssop):
--   1. A sixth grid row for the molds.
--   2. A THIRD STATUS OPTION. The column offered only "Clean & sanitized" and "Not used today".
--      Neither is true of a mold on a day it was used but not washed - which, under SOP-906's
--      weekly cycle, is most days. An operator faced with two wrong answers picks one of them, and
--      the record stops meaning anything. "Between-use care (scrape, wipe, re-grease)" is added so
--      the form can record what actually happened. The five machine rows will simply never use it.
--   3. The section description said each item is "recorded on its own cleaning log". The molds have
--      no separate log - FRM-903 is the record - so the sentence is amended rather than left to
--      contradict the row it now sits above.
--
-- FRM-903 is active: revision v3 -> v4, effective 2026-08-26, in the same statement as the content
-- edit so the history snapshot captures a coherent v3.
--
-- Guards key on the target state throughout.

begin;

-- 1. Activate SOP-906 and turn its open items into a forward plan.
update public.sop_documents
set status = 'active',
    effective_date = date '2026-08-26',
    approved_by = 'GJM',
    content = jsonb_set(content, '{revision_history}', to_jsonb($rh$New — 2026-08-26 — Initial issue, approved GJM. Closes the gap found when the pot & pan washer turned out to cover only the non-food-contact carrier pans, leaving the molds — a direct food-contact surface — with no documented cleaning method. Written as between-use care (scrape, wipe, fresh release) plus a weekly wash with out-of-schedule triggers, which is the process actually performed; the wash steps follow the sink process already described in SOP-901/902/903.

Committed at issue, to be closed and recorded as revisions to this SOP:
1. Pre-soak — confirm whether a chemical is used, at what strength, and a typical soak time. Step 6 currently says hot water only; a soak product would be named there and its SDS added to the Chemical Safety Data Sheets collection.
2. Validate the weekly wash interval — swab or test at the END of the interval rather than the start, or adopt the parent facility's validation if it holds data for the same cycle. The interval is set by practice today; validation is what makes it a control.
3. Designate the storage location for covered molds in the refrigerator, away from ingredients and finished product.$rh$::text))
where sop_number = 'SOP-906'
  and (status is distinct from 'active'
    or effective_date is distinct from date '2026-08-26'
    or approved_by is distinct from 'GJM');

-- 2. FRM-903 — the mold row, the third status option, and the corrected description.
update public.sop_documents
set content = jsonb_set(jsonb_set(jsonb_set(content,
      '{form_schema,sections,2,description}',
      to_jsonb($d$For each machine used in today's production, confirm it was verified clean and sanitized per its SSOP and recorded on its own cleaning log, or mark "Not used today". Items without a separate log — the molds — are recorded here. Molds are scraped, wiped and re-greased between uses and washed weekly under SOP-906, so record which of those happened. Add or remove equipment as the line changes.$d$::text)),
      '{form_schema,sections,2,fields,0,rows,labels}',
      $l$["Hobart V-1401 Mixer — SOP-901 / FRM-909","Kook-E-King Depositor — SOP-902 / FRM-910","Beldos 275 Depositor — SOP-903 / FRM-911","Smipack S560NA Shrink Wrapper — SOP-601","Groen TDB Kettle — SOP-904 / FRM-912","Molds — SOP-906 (recorded here)"]$l$::jsonb),
      '{form_schema,sections,2,fields,0,columns,0,options}',
      $o$["Clean & sanitized","Between-use care (scrape, wipe, re-grease)","Not used today"]$o$::jsonb),
    revision = 'v4',
    effective_date = date '2026-08-26'
where sop_number = 'FRM-903'
  and content #>> '{form_schema,sections,2,id}' = 'equipment_ssop'
  and content #>> '{form_schema,sections,2,fields,0,id}' = 'equipment_status'
  and (revision is distinct from 'v4'
    or not (content #> '{form_schema,sections,2,fields,0,rows,labels}') @> '["Molds — SOP-906 (recorded here)"]'::jsonb);

do $$
declare
  bad text;
begin
  select string_agg(x, '; ') into bad from (
    select 'SOP-906 not active' as x from public.sop_documents
      where sop_number = 'SOP-906' and status is distinct from 'active'
    union all
    select 'SOP-906 not stamped' from public.sop_documents
      where sop_number = 'SOP-906'
        and (effective_date is distinct from date '2026-08-26' or approved_by is distinct from 'GJM')
    union all
    select 'SOP-906 still says OPEN BEFORE ACTIVATION' from public.sop_documents
      where sop_number = 'SOP-906' and content->>'revision_history' like '%OPEN BEFORE ACTIVATION%'
    union all
    select 'FRM-903 mold row missing' from public.sop_documents
      where sop_number = 'FRM-903'
        and not (content #> '{form_schema,sections,2,fields,0,rows,labels}')
            @> '["Molds — SOP-906 (recorded here)"]'::jsonb
    union all
    select 'FRM-903 row count wrong' from public.sop_documents
      where sop_number = 'FRM-903'
        and jsonb_array_length(content #> '{form_schema,sections,2,fields,0,rows,labels}') <> 6
    union all
    select 'FRM-903 between-use option missing' from public.sop_documents
      where sop_number = 'FRM-903'
        and not (content #> '{form_schema,sections,2,fields,0,columns,0,options}')
            @> '["Between-use care (scrape, wipe, re-grease)"]'::jsonb
    union all
    select 'FRM-903 not v4' from public.sop_documents
      where sop_number = 'FRM-903' and revision is distinct from 'v4'
    union all
    -- the other five rows must survive unchanged: a jsonb_set of the whole labels array would
    -- silently drop them if the literal above were ever edited carelessly.
    select 'FRM-903 lost a machine row' from public.sop_documents
      where sop_number = 'FRM-903'
        and not (content #> '{form_schema,sections,2,fields,0,rows,labels}')
            @> '["Hobart V-1401 Mixer — SOP-901 / FRM-909","Groen TDB Kettle — SOP-904 / FRM-912"]'::jsonb
  ) t;

  if bad is not null then
    raise exception 'SOP-906 activation / FRM-903 mold row did not apply cleanly: %', bad;
  end if;
end $$;

commit;
