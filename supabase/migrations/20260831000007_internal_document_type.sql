-- Add an "internal" document type, and undo 20260831000006 with it.
--
-- 20260831000006 archived four technical guides to get them out of the controlled register. That
-- worked and was the wrong instrument. ARCHIVED MEANS "NO LONGER IN FORCE", and it is false about
-- these: they are current, accurate, and people use them. They are simply not food-safety
-- documents. Using status to say "wrong category" leaves a reader asking what superseded four
-- documents that nothing superseded.
--
-- type='internal' says the true thing - in force, not a controlled SQF document - and the register
-- filters on type rather than on a status that is lying. Consequences, all of them better:
--
--   * status returns to active, which is accurate.
--   * The missing-approver problem dissolves rather than being waved through. An internal document
--     does not need SQF approval, so these stop counting toward the 38 instead of needing one.
--   * The YoLink guide stops being an anomaly. 20260831000006 had to leave it active and alone
--     because TemperatureReport resolves yolink_operations_guide.pdf through
--     fetchReferenceDocuments(), which filters on STATUS - so archiving it would silently drop that
--     link. type='internal' with status='active' keeps the lookup working, and the guide can sit
--     with its siblings instead of being the one left behind for an implementation reason.
--
-- ALL SEVEN documents in the IT category are converted, not just the four. Hostinger Hosting Guide
-- and Roles, Permissions & User Administration are the same kind of thing and were only untouched
-- before because they already carried an approver, which is an accident of who filled a field
-- rather than a difference in kind. Their approved_by values are LEFT AS THEY ARE - harmless, and
-- deleting a record of who signed something is not this migration's business.
--
-- NOTHING IS DELETED AND NOTHING MOVES IN STORAGE. Every attachment stays where it is, and the
-- assertions check that all seven still carry one.
--
-- STILL OPEN, deliberately not in here: whether reports get a REP prefix and whether FRM-951 is
-- renumbered to match. That costs SOP-2.9 a third revision to fix three citations, which is a
-- decision rather than a cleanup.

begin;

alter table public.sop_documents
  drop constraint if exists sop_documents_type_check;

alter table public.sop_documents
  add constraint sop_documents_type_check
  check (type in ('sop', 'form', 'policy', 'training', 'fsqm', 'report', 'internal'));

-- Reclassify, and lift the archive that was standing in for a classification.
update public.sop_documents
   set type = 'internal',
       status = case when status = 'archived' then 'active' else status end
 where category = 'IT - Technical Operation Documentation';

-- Replace 20260831000006's archive note. The pointer to the maintained source is worth keeping;
-- the sentence explaining an archive that no longer exists is not.
update public.sop_documents d
   set content = coalesce(d.content, '{}'::jsonb) || jsonb_build_object(
         'purpose',
         'Internal engineering documentation, not a controlled food-safety document. The maintained '
         || 'source is ' || v.repo_file || ' in the Adventure Bakery Team App repository; the PDF '
         || 'attached here is a snapshot of it and will not be updated as that file changes.')
  from (values
    ('Derived Form Reports%',                      'FORM_REPORTS.md'),
    ('Document Numbering & Creation Guide',        'DOCUMENT_REGISTER.md'),
    ('Dynamic Forms Technical Guilde',             'CLAUDE.md'),
    ('Updating the SQF Code References - Runbook', 'UPDATING_SQF_CODE.md')
  ) as v(pattern, repo_file)
 where d.title like v.pattern
   and d.category = 'IT - Technical Operation Documentation';

do $$
declare
  bad text;
  n_internal int;
  n_active int;
begin
  select count(*) into n_internal from public.sop_documents
   where category = 'IT - Technical Operation Documentation' and type = 'internal';
  select count(*) into n_active from public.sop_documents
   where category = 'IT - Technical Operation Documentation' and status = 'active';

  select string_agg(x, '; ') into bad from (
    select 'expected 7 internal IT documents, found ' || n_internal::text as x where n_internal <> 7
    union all
    select 'expected all 7 active, found ' || n_active::text where n_active <> 7
    union all
    select 'still archived: ' || title from public.sop_documents
     where category = 'IT - Technical Operation Documentation' and status = 'archived'
    union all
    select 'still carries the stale archive note: ' || title from public.sop_documents
     where coalesce(content->>'purpose', '') like 'Archived 2026-08-31%'
    union all
    select 'lost its maintained-source note: ' || title from public.sop_documents
     where category = 'IT - Technical Operation Documentation'
       and (title like 'Derived Form Reports%' or title = 'Document Numbering & Creation Guide'
            or title = 'Dynamic Forms Technical Guilde'
            or title = 'Updating the SQF Code References - Runbook')
       and coalesce(content->>'purpose', '') not like '%maintained source is%'
    union all
    select 'lost its attachment: ' || title from public.sop_documents
     where category = 'IT - Technical Operation Documentation'
       and jsonb_array_length(coalesce(content->'attachments', '[]'::jsonb)) < 1
    union all
    select 'the YoLink temperature guide is not active - TemperatureReport will lose its guide link'
     where not exists (
       select 1 from public.sop_documents
        where title like 'Temperature Monitor System%' and status = 'active')
    union all
    select 'internal type leaked outside the IT category: ' || coalesce(sop_number, title)
      from public.sop_documents
     where type = 'internal'
       and category is distinct from 'IT - Technical Operation Documentation'
    union all
    select 'FRM-951 is no longer type=report' where not exists (
      select 1 from public.sop_documents where sop_number = 'FRM-951' and type = 'report')
    union all
    select 'FRM-952/FRM-953 are no longer forms' where exists (
      select 1 from public.sop_documents
       where sop_number in ('FRM-952','FRM-953') and status = 'active' and type <> 'form')
  ) t;

  if bad is not null then
    raise exception 'the internal document type did not apply cleanly: %', bad;
  end if;

  raise notice 'reclassified % IT documents as internal, all active', n_internal;
end $$;

commit;
