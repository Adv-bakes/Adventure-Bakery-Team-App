-- Record GJM as the approver of the 32 active controlled documents that have none.
--
-- Every one of these is in force and in use: forms people fill on the floor, reports the site runs,
-- and the training modules employees are taking right now. They were published without the approver
-- field being filled, which is remediation task INT-14's finding - a controlled document can be set
-- active in this app with no approver recorded, and 40 of 87 were.
--
-- The owner has approved them. This records that decision; it does not make it.
--
-- WHAT IS DELIBERATELY EXCLUDED, AND WHY IT IS THE WHOLE POINT OF NOT WRITING "UPDATE ... WHERE
-- approved_by IS NULL":
--
--   THE HACCP PLAN. All eight Major non-conformances in the gap assessment are against it - the
--   plan does not follow the Codex 12 steps - and deliverable D-14 rebuilds it. Recording an
--   approval today would put a signature on a plan the site's own consultant scored as failing,
--   dated while those Majors are open, on a document that is about to be superseded. An auditor
--   reading that sequence draws a worse conclusion than from an unapproved plan. It stays
--   unapproved until D-14 lands, and the assertion below proves this migration did not touch it.
--
--   INTERNAL DOCUMENTS. The seven engineering guides stopped being controlled documents in
--   20260831000007. They do not need SQF approval and are excluded by type, not by omission.
--
--   SPANISH VARIANTS. An ES row is a content variant of its English sibling, not an independently
--   approved document; it carries no training_category and is never assigned on its own.
--
-- ONE APPROVER, ONE DATE, ONE MIGRATION. Bulk approval is visibly different from 32 considered
-- approvals, and pretending otherwise would be the dishonest part. It is recorded as what it is: a
-- single decision by the owner to adopt the documents already in use, taken on 2026-08-31. Every
-- row keeps its own revision and effective date - nothing here restates when a document took
-- effect, only who stands behind it.
--
-- approved_by is a watched field on the sop_document_history trigger, so all 32 writes leave audit
-- snapshots of their prior state.

begin;

do $$
declare
  before_unapproved int;
  after_unapproved int;
  n_approved int;
  before_other int;
  after_other int;
  haccp_approver text;
  bad text;
begin
  select count(*) into before_unapproved from public.sop_documents
   where status = 'active' and type <> 'internal' and title not like '%(ES)%'
     and coalesce(nullif(trim(approved_by), ''), null) is null;

  select count(*) into before_other from public.sop_documents
   where coalesce(nullif(trim(approved_by), ''), null) is not null and approved_by <> 'GJM';

  update public.sop_documents
     set approved_by = 'GJM'
   where status = 'active'
     and coalesce(nullif(trim(approved_by), ''), null) is null
     and title not like '%(ES)%'
     -- engineering documentation is not a controlled document
     and type <> 'internal'
     -- and the HACCP plan is excluded by name, for the reason in the header
     and coalesce(sop_number, title) not like '%HACCP PLAN%';

  get diagnostics n_approved = row_count;

  select count(*) into after_unapproved from public.sop_documents
   where status = 'active' and type <> 'internal' and title not like '%(ES)%'
     and coalesce(nullif(trim(approved_by), ''), null) is null;

  select count(*) into after_other from public.sop_documents
   where coalesce(nullif(trim(approved_by), ''), null) is not null and approved_by <> 'GJM';

  select coalesce(approved_by, '(none)') into haccp_approver
    from public.sop_documents where title like '%HACCP PLAN%' and status = 'active';

  select string_agg(x, '; ') into bad from (
    select 'approved ' || n_approved::text || ' documents, expected 32' as x where n_approved <> 32
    union all
    select 'expected exactly 1 controlled document left unapproved (the HACCP plan), found '
           || after_unapproved::text where after_unapproved <> 1
    union all
    select 'documents without an approver went ' || before_unapproved::text || '->'
           || after_unapproved::text || ', expected a drop of exactly 32'
     where after_unapproved <> before_unapproved - 32
    union all
    -- the exclusion, proven rather than trusted to the WHERE clause
    select 'the HACCP plan was approved (' || haccp_approver || ') - it must stay unapproved '
           || 'until D-14 rebuilds it' where haccp_approver <> '(none)'
    union all
    -- no Spanish variant may have been approved as though it were its own document
    select 'a Spanish variant was approved: ' || title from public.sop_documents
     where title like '%(ES)%' and approved_by = 'GJM'
    union all
    -- nothing that already carried a different approver may have been overwritten. Counted
    -- rather than named: the WHERE clause only touches null approvers, and this proves it.
    select 'documents with a non-GJM approver went ' || before_other::text || '->'
           || after_other::text || ' - an existing approver was overwritten'
     where after_other <> before_other
  ) t;

  if bad is not null then
    raise exception 'the bulk approval did not apply cleanly: %', bad;
  end if;

  raise warning 'the HACCP PLAN remains unapproved by design - it carries all 8 Major findings and '
                'is rebuilt by deliverable D-14';
  raise notice 'recorded GJM as approver on % controlled documents', n_approved;
end $$;

commit;
