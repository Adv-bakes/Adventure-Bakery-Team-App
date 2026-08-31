-- Renumber FRM-951 to REP-951, and repoint SOP-2.9 at the new number.
--
-- FRM means "form". The Training Matrix stopped being a form on 2026-08-31 (20260831000001) and is
-- a generated report; carrying a form prefix made it the one document in the register whose
-- identifier contradicted its own type. A REP series is introduced here, and this is the cheapest
-- moment it will ever exist: there is exactly ONE report, cited by exactly ONE other document.
--
-- REVERSING AN EARLIER DECISION, ON PURPOSE. 20260831000001 deliberately KEPT the number, on the
-- reasoning that SOP-2.9 cites it and docNumber.ts says an identifier is stable for a document's
-- life. Both still true. What changed is that a REP series now exists, and a single FRM-numbered
-- report would be a permanent anomaly rather than a stable identifier.
--
-- The NUMBER does not move, only the prefix: 951 sits in the 950-999 block, which DOC_STAGES calls
-- "HR / Training / Admin / Records" - already the right stage for a training matrix.
--
-- legacy_sop_number records FRM-951, which is what that column exists for. Anyone holding a printed
-- copy stamped FRM-951, or an auditor working from an older list, can still find this document.
--
-- NO REVISION BUMP ON THE REPORT ITSELF. Its content does not change here. Revision tracks content;
-- identity is tracked by sop_number and legacy_sop_number. Bumping would claim the report was
-- rewritten, which it was not.
--
-- SOP-2.9 DOES bump, v2 to v3, because its content genuinely changes: five citations across
-- records, form_references, responsibility and procedure steps 2 and 6. That is its third revision
-- in four days, which is worth stating plainly rather than hiding - v1 to v2 fixed four broken
-- record references and added the eight competency areas 2.9.2.1 requires, and v3 follows a
-- renumber. Every one was substantive.

begin;

do $$
declare
  before_steps int;
  after_steps int;
  before_951 text;
  bad text;
  r record;
begin
  select jsonb_array_length(content->'procedure') into before_steps
    from public.sop_documents where sop_number = 'SOP-2.9';
  select content::text into before_951
    from public.sop_documents where sop_number = 'FRM-951' and status = 'active';

  if before_951 is null then
    raise exception 'FRM-951 not found as an active document - already renumbered?';
  end if;

  update public.sop_documents
     set sop_number = 'REP-951',
         legacy_sop_number = 'FRM-951'
   where sop_number = 'FRM-951'
     and status = 'active'
     and type = 'report';

  update public.sop_documents
     set content = content
         || jsonb_build_object('records', replace(content->>'records', 'FRM-951', 'REP-951'))
         || jsonb_build_object('form_references',
              replace(content->>'form_references', 'FRM-951', 'REP-951'))
         || jsonb_build_object('responsibility',
              replace(content->>'responsibility', 'FRM-951', 'REP-951'))
         || jsonb_build_object('procedure', (
              select jsonb_agg(replace(s, 'FRM-951', 'REP-951') order by ord)
                from jsonb_array_elements_text(content->'procedure') with ordinality as t(s, ord)))
         || jsonb_build_object('revision_history',
              coalesce(content->>'revision_history', '') || chr(10)
              || 'v3 — 2026-08-31 — Training Matrix renumbered FRM-951 to REP-951 when it was '
              || 'reclassified from a form to a generated report. Citations updated in Records, '
              || 'Linked Forms, Responsibility and procedure steps 2 and 6. No other content '
              || 'changed. The former number is retained on the document as its legacy number.'),
         revision = 'v3',
         effective_date = date '2026-08-31'
   where sop_number = 'SOP-2.9' and status = 'active';

  select jsonb_array_length(content->'procedure') into after_steps
    from public.sop_documents where sop_number = 'SOP-2.9';

  select * into r from public.sop_documents where sop_number = 'REP-951' and status = 'active';

  select string_agg(x, '; ') into bad from (
    select 'REP-951 is missing or not active' as x where r.id is null
    union all
    select 'REP-951 is type ' || coalesce(r.type, 'null') || ', expected report'
     where r.type is distinct from 'report'
    union all
    select 'legacy_sop_number is ' || coalesce(r.legacy_sop_number, 'null') || ', expected FRM-951'
     where r.legacy_sop_number is distinct from 'FRM-951'
    union all
    select 'the report content changed during a renumber'
     where r.content::text is distinct from before_951
    union all
    select 'an active document still has sop_number FRM-951' where exists (
      select 1 from public.sop_documents where sop_number = 'FRM-951' and status = 'active')
    union all
    select 'SOP-2.9 still cites FRM-951 outside its revision history' from public.sop_documents
     where sop_number = 'SOP-2.9' and (content - 'revision_history')::text like '%FRM-951%'
    union all
    select 'SOP-2.9 does not cite REP-951' from public.sop_documents
     where sop_number = 'SOP-2.9' and content::text not like '%REP-951%'
    union all
    select 'SOP-2.9 is revision ' || coalesce(revision, 'null') || ', expected v3'
      from public.sop_documents where sop_number = 'SOP-2.9' and revision is distinct from 'v3'
    union all
    select 'SOP-2.9 procedure went from ' || before_steps::text || ' steps to ' || after_steps::text
     where after_steps is distinct from before_steps
    union all
    select 'another document still cites FRM-951: ' || coalesce(sop_number, title)
      from public.sop_documents
     where sop_number is distinct from 'REP-951' and status = 'active'
       and (content - 'revision_history')::text like '%FRM-951%'
    union all
    select 'FRM-952 or FRM-953 was renumbered' where not exists (
      select 1 from public.sop_documents where sop_number = 'FRM-952' and status = 'active')
       or not exists (
      select 1 from public.sop_documents where sop_number = 'FRM-953' and status = 'active')
  ) t;

  if bad is not null then
    raise exception 'the REP-951 renumber did not apply cleanly: %', bad;
  end if;

  raise notice 'FRM-951 is now REP-951 (legacy number retained); SOP-2.9 repointed at v3';
end $$;

commit;
