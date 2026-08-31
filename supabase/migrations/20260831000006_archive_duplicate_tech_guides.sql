-- Archive the four technical guides that duplicate documentation maintained in the repository.
--
-- These are engineering documentation, not controlled food-safety documents. Each is a thin wrapper
-- whose entire content is one attached PDF - no purpose, no scope, no procedure - and each PDF is a
-- snapshot of a markdown file that is still maintained in the application repository. Keeping them
-- in the document register means an auditor sees an active controlled document with no approver and
-- no revision discipline, describing software internals, which is a finding waiting to happen and
-- says nothing about food safety.
--
--   Derived Form Reports - Technical Foundation   -> FORM_REPORTS.md
--   Document Numbering & Creation Guide           -> DOCUMENT_REGISTER.md
--   Dynamic Forms Technical Guilde                -> CLAUDE.md   (also: "Guilde" is a typo)
--   Updating the SQF Code References - Runbook    -> UPDATING_SQF_CODE.md
--
-- NOTHING BECOMES UNREACHABLE. Archiving is a status, not a delete. Neither surface filters on it:
-- the SOPs Library fetches every document and offers Archived in its status filter, and the
-- Document Register selects status as a column and filters only on type. Both keep listing these,
-- badged Archived, and their PDFs still resolve to signed URLs. Hard deletion is the thing that
-- would lose the files, and that is not what this does.
--
-- ⚠️ THE YOLINK GUIDE IS DELIBERATELY LEFT ACTIVE, and the assertions below prove it. The
-- Temperature Monitoring page finds yolink_operations_guide.pdf through fetchReferenceDocuments(),
-- which defaults to status='active', so archiving it would silently drop that contextual link -
-- and it only appears when sensor data is missing or stale, which is exactly when somebody needs
-- it. It also carries seven attachments including live YoLink API links and has no repository
-- equivalent. It is operational documentation, unlike the four here.
--
-- ALSO LEFT ALONE: the Hostinger Hosting Guide and Roles, Permissions & User Administration. Both
-- sit in the same category and both already carry an approver, so they were never part of the
-- unapproved set this came out of. Archiving by category would have swept them up; this targets
-- four documents by name instead.
--
-- Each row gains a purpose explaining the archive and naming its maintained source, so the register
-- says why rather than showing a bare Archived badge that invites someone to undo it. Side effect
-- worth knowing: a purpose makes hasSopBody() true, so these gain a Download PDF button in the
-- drawer. Harmless on an archived record, and it renders the explanation.

begin;

do $$
declare
  before_active int;
  after_active int;
  n_archived int;
  bad text;
begin
  select count(*) into before_active from public.sop_documents
   where category = 'IT - Technical Operation Documentation' and status = 'active';

  update public.sop_documents d
     set status = 'archived',
         content = coalesce(d.content, '{}'::jsonb) || jsonb_build_object(
           'purpose',
           'Archived 2026-08-31. This is engineering documentation, not a controlled food-safety '
           || 'document, and it was duplicating a file that is still maintained in the Adventure '
           || 'Bakery Team App repository. The maintained source is ' || v.repo_file || '; the PDF '
           || 'attached here is a snapshot of it and will not be updated. Archived rather than '
           || 'deleted so the attachment stays reachable.')
    from (values
      ('Derived Form Reports%',                      'FORM_REPORTS.md'),
      ('Document Numbering & Creation Guide',        'DOCUMENT_REGISTER.md'),
      ('Dynamic Forms Technical Guilde',             'CLAUDE.md'),
      ('Updating the SQF Code References - Runbook', 'UPDATING_SQF_CODE.md')
    ) as v(pattern, repo_file)
   where d.title like v.pattern
     and d.category = 'IT - Technical Operation Documentation'
     and d.status = 'active';

  get diagnostics n_archived = row_count;

  select count(*) into after_active from public.sop_documents
   where category = 'IT - Technical Operation Documentation' and status = 'active';

  select string_agg(x, '; ') into bad from (
    select 'archived ' || n_archived::text || ' rows, expected 4' as x where n_archived <> 4
    union all
    select 'active IT documents went ' || before_active::text || '->' || after_active::text
           || ', expected a drop of exactly 4'
     where after_active <> before_active - 4
    union all
    -- the one a page depends on resolving
    select 'the YoLink temperature guide is no longer active - the Temperature Monitoring page '
           || 'looks it up with status=active and will silently lose its guide link'
     where not exists (
       select 1 from public.sop_documents
        where title like 'Temperature Monitor System%' and status = 'active')
    union all
    -- the two already-approved guides in the same category must be untouched
    select 'wrongly archived: ' || title from public.sop_documents
     where category = 'IT - Technical Operation Documentation'
       and (title like 'Hostinger%' or title like 'Roles, Permissions%')
       and status <> 'active'
    union all
    -- and every archived row must actually say why
    select 'archived without an explanation: ' || title from public.sop_documents
     where category = 'IT - Technical Operation Documentation' and status = 'archived'
       and coalesce(content->>'purpose', '') not like '%maintained source is%'
    union all
    -- the attachment is the whole point of keeping these; it must survive
    select 'lost the attachment on ' || title from public.sop_documents
     where category = 'IT - Technical Operation Documentation' and status = 'archived'
       and jsonb_array_length(coalesce(content->'attachments', '[]'::jsonb)) < 1
  ) t;

  if bad is not null then
    raise exception 'archiving the duplicate technical guides did not apply cleanly: %', bad;
  end if;

  raise notice 'archived % duplicate technical guides; % IT documents remain active', n_archived, after_active;
end $$;

commit;
