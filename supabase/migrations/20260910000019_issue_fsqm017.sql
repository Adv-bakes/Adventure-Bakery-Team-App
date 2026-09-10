-- D-18 - issue FSQM-017 Validation and Verification Program. Active, GJM, effective 2026-09-10.
--
-- WHAT GOES INTO FORCE. 2.5.2.1 and 2.5.2.2, both Mandatory, from today. Twelve verification
-- activities become scheduled commitments with a named responsible position, and the twice-daily
-- job starts prompting against a document rather than against a table nobody had approved.
--
-- WHAT DOES NOT, AND THE DOCUMENT SAYS SO. 2.5.1.1 is met in part. Limb iii is Part 4. Limb i
-- rests on inspection and record review because the site performs no analysis of any kind, and
-- limb ii has nothing to bite on because there is no food safety plan and no CCPs. Both are
-- written into Parts 2 and 3 and both are now recorded as standing limitations rather than open
-- actions - an open action implies somebody is failing to do something, and nobody is: the
-- deliverables that close them have not been built. THE WORKBOOK SHOULD RECORD D-18 AS CLOSING
-- 2.5.2.1 AND 2.5.2.2 IN FORCE AND 2.5.1.1 IN PART. Recording a full closure would be closing a
-- Mandatory clause on evidence that does not exist.
--
-- THE FREQUENCIES WERE ISSUED WITHOUT A SEPARATE CONFIRMATION PASS, and the revision history says
-- so in terms. They were seeded as proposals; issuing adopts them. That is a legitimate decision -
-- a schedule the site can correct beats no schedule - but a reader is entitled to know the
-- cadences were adopted rather than each derived from a risk assessment, and the annual review is
-- the occasion that revisits them.
--
-- THE ANNUAL PROGRAMME REVIEW GETS AN ANCHOR. It is evidenced by a revision of this document, and
-- issuing is not a review. Without first_due_on the activity would read as never recorded and
-- would be raised from the day the programme went live, which is both wrong and the fastest way to
-- teach people that the feed cries wolf.

begin;

do $$
declare r record;
begin
  select
    (select status from public.sop_documents where sop_number = 'FSQM-017')            as st,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-017'
        and (approved_by is not null or effective_date is not null))                   as stamped,
    (select jsonb_array_length(content->'procedure') from public.sop_documents
      where sop_number = 'FSQM-017')                                                   as lines,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-017'
        and content->>'revision_history' like '%OPEN BEFORE ISSUE%')                   as open_block,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-017'
        and content->>'revision_history' like '%DRAFT. Not approved, not in force.%')  as draft_stamp,
    (select count(*) from public.sop_documents where sop_number = 'FRM-008')           as frm008,
    (select count(*) from public.verification_schedule where status = 'active')        as active
  into r;

  if r.st is distinct from 'draft' then
    raise exception 'FSQM-017 is %, expected draft.', r.st;
  end if;
  if r.stamped <> 0 then
    raise exception 'FSQM-017 already carries an approval or effective date.';
  end if;
  -- 48 written lines plus the 20 schedule rows spliced in by 20260910000018.
  if r.lines <> 68 then
    raise exception 'FSQM-017 is % lines, expected 68; apply 20260910000018 first.', r.lines;
  end if;
  if r.open_block <> 1 or r.draft_stamp <> 1 then
    raise exception 'The draft markers are not present (open=%, draft=%).', r.open_block, r.draft_stamp;
  end if;
  -- Issuing a programme that still points at a deleted form would be issuing a broken reference.
  if r.frm008 <> 0 then
    raise exception 'FRM-008 still exists; 20260910000018 has not been applied.';
  end if;
  if r.active < 1 then
    raise exception 'the schedule has no active activities; the programme would go live with nothing to do.';
  end if;
end $$;

-- The annual review of this programme is evidenced by revising it, and issuing is not a review.
update public.verification_schedule
   set first_due_on = date '2027-09-10'
 where activity_key = 'program_review'
   and first_due_on is null;

update public.sop_documents
   set content = jsonb_set(content, '{revision_history}',
         to_jsonb(
           replace(
             left(content->>'revision_history',
                  position('OPEN BEFORE ISSUE' in content->>'revision_history') - 1),
             'DRAFT. Not approved, not in force.',
             'ISSUED 2026-09-10, approved GJM (Senior Site Management), effective 2026-09-10.')
        || $s17$

SETTLED AT ISSUE — 2026-09-10:

1. WHO APPROVES. Senior Site Management, GJM. This program appoints verification responsibilities across every position including the SQF Practitioner's own, so approval by the role it assigns work to would have been the appointee approving their own appointment - the same reasoning FSQM-004 records.

2. THE FREQUENCIES IN PART 6 ARE THE SITE'S, FROM THIS DATE. They were seeded as proposals to give the schedule a working shape and were issued without a separate confirmation pass, which is recorded here rather than glossed: a reader should know that the cadences were adopted by issuing the document rather than derived one by one from a risk assessment. They are amended by revising this program, the schedule page is where the change is made, and the annual review in Part 10 is the occasion that re-examines them. A frequency that turns out to be wrong is a revision, not a non-conformance.

3. THE ANALYTICAL LIMB OF 2.5.1.1 i IS NOT MET, AND THIS PROGRAM DOES NOT CLAIM IT. Confirming that Good Manufacturing Practices achieve their result normally rests on measurement, and this site performs no analysis at all - no laboratory, no external laboratory, no reliance on supplier certificates of analysis. Part 2 says so and rests the confirmation on inspection and record review. The environmental monitoring program for ready-to-eat product is the deliverable that changes it, and Part 2 is revised when that is issued. This is a standing limitation of the program as issued, not an open action.

4. PART 3 HAS NOTHING TO BITE ON YET, for the same kind of reason. The critical limits it governs are those a food safety plan establishes, and the site has no HACCP plan under document control and no critical control points defined. The rule stands; the activity is carried on the schedule as not yet implemented; and the two limits that ARE real today are named in Part 3 together with the statement that neither is a CCP.

WHAT THIS CLOSES. 2.5.2.1 and 2.5.2.2 are in force from this date. 2.5.1.1 is met in part - limb iii by Part 4, limbs i and ii as far as a site with no analysis and no food safety plan can meet them, with both gaps stated on the document. Recording that as a full closure would be closing a Mandatory clause on evidence that does not exist.$s17$))
 where sop_number = 'FSQM-017';

update public.sop_documents
   set status         = 'active',
       approved_by    = 'GJM',
       effective_date = '2026-09-10',
       revision       = 'New'
 where sop_number = 'FSQM-017';

do $$
declare r record;
begin
  select
    (select status from public.sop_documents where sop_number = 'FSQM-017')            as st,
    (select approved_by from public.sop_documents where sop_number = 'FSQM-017')       as appr,
    (select effective_date from public.sop_documents where sop_number = 'FSQM-017')    as eff,
    (select revision from public.sop_documents where sop_number = 'FSQM-017')          as rev,
    (select jsonb_array_length(content->'procedure') from public.sop_documents
      where sop_number = 'FSQM-017')                                                   as lines,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-017'
        and content->>'revision_history' like '%ISSUED 2026-09-10, approved GJM%')     as issued_stamp,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-017'
        and content->>'revision_history' like '%SETTLED AT ISSUE%')                    as settled,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-017'
        and content->>'revision_history' like '%OPEN BEFORE ISSUE%')                   as stale_open,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-017'
        and content->>'revision_history' like '%Not approved, not in force%')          as stale_draft,
    -- The two admissions must survive issue. If either is ever edited out the programme starts
    -- claiming a Mandatory clause it does not meet.
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-017'
        and content->>'revision_history' like '%THE ANALYTICAL LIMB OF 2.5.1.1 i IS NOT MET%')  as limb_i,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-017'
        and content->>'revision_history' like '%PART 3 HAS NOTHING TO BITE ON YET%')    as limb_ii,
    (select first_due_on from public.verification_schedule
      where activity_key = 'program_review')                                           as review_due,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-017' and position(chr(13) in content::text) > 0)        as crs
  into r;

  if r.st is distinct from 'active' or r.appr is distinct from 'GJM'
     or r.eff is distinct from date '2026-09-10' or r.rev is distinct from 'New' then
    raise exception 'Stamp wrong (status=%, approver=%, eff=%, rev=%).', r.st, r.appr, r.eff, r.rev;
  end if;
  -- Issuing must not disturb the programme itself, schedule rows included.
  if r.lines <> 68 then
    raise exception 'FSQM-017 is % lines after issue, expected 68.', r.lines;
  end if;
  if r.issued_stamp <> 1 or r.settled <> 1 then
    raise exception 'Issue stamp wrong (issued=%, settled=%).', r.issued_stamp, r.settled;
  end if;
  if r.stale_open <> 0 or r.stale_draft <> 0 then
    raise exception 'Draft markers survived issue (open=%, draft=%).', r.stale_open, r.stale_draft;
  end if;
  if r.limb_i <> 1 or r.limb_ii <> 1 then
    raise exception 'The 2.5.1.1 limitations were lost (i=%, ii=%).', r.limb_i, r.limb_ii;
  end if;
  if r.review_due is distinct from date '2027-09-10' then
    raise exception 'the annual review anchor is %, expected 2027-09-10.', r.review_due;
  end if;
  if r.crs <> 0 then raise exception 'CR characters are present in FSQM-017.'; end if;
end $$;

commit;
