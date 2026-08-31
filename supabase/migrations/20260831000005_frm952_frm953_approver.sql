-- Record GJM as the approver of FRM-952 and FRM-953.
--
-- The two records SOP-2.9 points at: the Training Competency Verification Record and the Training
-- Sign-In Sheet. As with FRM-951 in 20260831000004, this records a decision the owner made rather
-- than inventing one.
--
-- Only approved_by is written. Effective dates are NOT moved to today: the date records when each
-- form entered use, which is a fact rather than something to tidy, and the approval is genuinely
-- being formalised late. Revisions are not bumped either - naming an approver completes an issue
-- rather than superseding it.
--
-- WHY THE ASSERTIONS COMPARE BEFORE AND AFTER INSTEAD OF NAMING VALUES.
--
-- The first version of this migration asserted revision = 'New' and effective_date = 2026-06-27,
-- read out of the database while it was being written. It failed on the push: FRM-953 had been
-- edited in the app minutes earlier - a form schema added, the revision moved to v2 - so a true
-- statement about the document became a failed deployment. That is the same mistake 20260831000003
-- was rewritten to fix, and its header already spells out the rule that was broken here.
--
-- The intent behind those assertions was "this migration must not disturb anything but the
-- approver". That is a statement about the MIGRATION, so it is now expressed as one: capture the
-- fields before the update, compare them after. It holds whatever the revision happens to be, and
-- it keeps working when somebody edits these forms again tomorrow.
--
-- ⚠️ THIS IS 2 OF 40. Forty of the eighty-seven active documents have no approver recorded -
-- twenty FRM forms, fourteen TRN modules, the HACCP PLAN, and five internal technical guides that
-- arguably should not be controlled documents at all. Fixing the two that came up in conversation
-- leaves thirty-eight, and remediation task INT-14 stays open for the real work: the app permits an
-- active document with no approver, so instances recur until it does not. The rest is a decision
-- per document and specifically NOT something to sweep with an UPDATE - bulk-approving forty
-- controlled documents in one statement is an act an auditor should be able to tell apart from
-- forty considered approvals.

begin;

do $$
declare
  b952 record;
  b953 record;
  a952 record;
  a953 record;
  before_unapproved int;
  after_unapproved int;
  expected_delta int;
  n_approved int;
  bad text;
begin
  select revision, effective_date, type, status, content into b952
    from public.sop_documents where sop_number = 'FRM-952' and status = 'active';
  select revision, effective_date, type, status, content into b953
    from public.sop_documents where sop_number = 'FRM-953' and status = 'active';

  if b952 is null or b953 is null then
    raise exception 'FRM-952 or FRM-953 is missing or not active - nothing to approve';
  end if;

  select count(*) into before_unapproved from public.sop_documents
   where status = 'active' and coalesce(nullif(trim(approved_by), ''), null) is null
     and title not like '%(ES)%';

  -- how many of the two actually need the change, so the delta below is right either way
  select count(*) into expected_delta from public.sop_documents
   where sop_number in ('FRM-952', 'FRM-953') and status = 'active'
     and coalesce(nullif(trim(approved_by), ''), null) is null;

  update public.sop_documents
     set approved_by = 'GJM'
   where sop_number in ('FRM-952', 'FRM-953')
     and status = 'active'
     and type = 'form'
     and approved_by is distinct from 'GJM';

  select revision, effective_date, type, status, content into a952
    from public.sop_documents where sop_number = 'FRM-952' and status = 'active';
  select revision, effective_date, type, status, content into a953
    from public.sop_documents where sop_number = 'FRM-953' and status = 'active';

  select count(*) into n_approved from public.sop_documents
   where sop_number in ('FRM-952', 'FRM-953') and status = 'active' and approved_by = 'GJM';

  select count(*) into after_unapproved from public.sop_documents
   where status = 'active' and coalesce(nullif(trim(approved_by), ''), null) is null
     and title not like '%(ES)%';

  select string_agg(x, '; ') into bad from (
    select 'expected 2 rows approved by GJM, found ' || n_approved::text as x
     where n_approved <> 2
    union all
    -- nothing but the approver may have moved, whatever the values happen to be
    select 'FRM-952 changed beyond its approver: revision '
           || coalesce(b952.revision,'null') || '->' || coalesce(a952.revision,'null')
           || ', effective ' || coalesce(b952.effective_date::text,'null') || '->'
           || coalesce(a952.effective_date::text,'null')
     where a952.revision is distinct from b952.revision
        or a952.effective_date is distinct from b952.effective_date
        or a952.type is distinct from b952.type
        or a952.content is distinct from b952.content
    union all
    select 'FRM-953 changed beyond its approver: revision '
           || coalesce(b953.revision,'null') || '->' || coalesce(a953.revision,'null')
           || ', effective ' || coalesce(b953.effective_date::text,'null') || '->'
           || coalesce(a953.effective_date::text,'null')
     where a953.revision is distinct from b953.revision
        or a953.effective_date is distinct from b953.effective_date
        or a953.type is distinct from b953.type
        or a953.content is distinct from b953.content
    union all
    -- the blast radius, as a delta rather than a hardcoded total
    select 'documents without an approver went ' || before_unapproved::text || '->'
           || after_unapproved::text || ', expected a drop of ' || expected_delta::text
     where after_unapproved <> before_unapproved - expected_delta
    union all
    -- FRM-951's approval from 20260831000004 must still stand
    select 'FRM-951 approver is now ' || coalesce(approved_by, 'null')
      from public.sop_documents
     where sop_number = 'FRM-951' and status = 'active' and approved_by is distinct from 'GJM'
  ) t;

  if bad is not null then
    raise exception 'FRM-952/FRM-953 approver did not apply cleanly: %', bad;
  end if;

  raise warning '% active documents still have no approver recorded - INT-14 remains open',
    after_unapproved;
  raise notice 'FRM-952 and FRM-953 approved by GJM (revisions left at % and %)',
    coalesce(a952.revision,'-'), coalesce(a953.revision,'-');
end $$;

commit;
