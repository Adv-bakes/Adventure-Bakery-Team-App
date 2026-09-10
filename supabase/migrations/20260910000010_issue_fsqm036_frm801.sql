-- Issue FSQM-036 and FRM-801: active, approved GJM, effective 2026-09-10. Closes D-35.
--
-- THE EFFECTIVE DATE IS NOT DECORATION HERE. The owner confirmed on 2026-09-10 that the collecting
-- vehicle is NOT checked today, so Part 4 is a new requirement on the floor rather than a description
-- of what already happens. From this date a vehicle that fails the check is not loaded, and FRM-801
-- carries the record. Production staff were briefed before issue; the carrier notice has not gone out
-- yet, and the owner has accepted that the first collections after today may be checked before it
-- reaches everyone.
--
-- Not backdated, deliberately. An effective date earlier than the first FRM-801 entry would create a
-- documented stretch during which the program required a check that has no record - a gap an auditor
-- finds by subtraction. Today's date makes the first record and the first day of the requirement the
-- same day.
--
-- WHAT THIS CLOSES. Five clauses go into force: 11.6.5.1, .2, .3, .4 and .8. Three were already
-- recorded Not Applicable inside Part 3 on the ambient determination: .5, .6 and .7. That is the whole
-- of 11.6.5, which had no controlled document of any kind before this deliverable and carried eight
-- findings in the gap assessment.
--
-- WHAT IS NOT CLOSED BY IT. Task 35.5's question of whether a canopy over the outdoor crossing is
-- worth building is a site judgement, not a condition of the program. And the food defence threat
-- assessment (D-22) is recorded in Part 6 as the thing that would revisit the lock-rather-than-seal
-- decision - a review trigger, not an unmet requirement.
--
-- Approver is GJM, consistent with every document issued to date. FRM-801 carries no revision_history
-- section - it holds only form_schema, like the other FRM records - so only its row columns are
-- stamped.

begin;

do $$
declare r record;
begin
  select
    (select status from public.sop_documents where sop_number = 'FSQM-036')        as s36,
    (select status from public.sop_documents where sop_number = 'FRM-801')         as s801,
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-036', 'FRM-801')
        and (approved_by is not null or effective_date is not null))               as already_stamped,
    (select jsonb_array_length(content->'procedure')
       from public.sop_documents where sop_number = 'FSQM-036')                    as lines,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-036'
        and content->>'revision_history' like '%SETTLED BEFORE ISSUE%')            as settled,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-036'
        and content->>'revision_history' like '%DRAFT. Not approved, not in force.%') as draft_stamp
  into r;

  if r.s36 is distinct from 'draft' or r.s801 is distinct from 'draft' then
    raise exception 'Expected both draft; found FSQM-036=%, FRM-801=%.', r.s36, r.s801;
  end if;
  if r.already_stamped <> 0 then
    raise exception '% document(s) already carry an approval or effective date.', r.already_stamped;
  end if;
  -- 000009 must have landed: it is what makes the revision history true at the moment of issue.
  if r.lines <> 41 or r.settled <> 1 then
    raise exception 'Apply 20260910000009 first (lines=%, settled=%).', r.lines, r.settled;
  end if;
  if r.draft_stamp <> 1 then
    raise exception 'The draft stamp is not present in the revision history.';
  end if;
end $$;

update public.sop_documents
   set content = jsonb_set(content, '{revision_history}',
         to_jsonb(replace(content->>'revision_history',
           'DRAFT. Not approved, not in force.',
           'ISSUED 2026-09-10, approved GJM, effective 2026-09-10.')))
 where sop_number = 'FSQM-036';

update public.sop_documents
   set status         = 'active',
       approved_by    = 'GJM',
       effective_date = '2026-09-10',
       revision       = 'New'
 where sop_number in ('FSQM-036', 'FRM-801');

do $$
declare r record;
begin
  select
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-036', 'FRM-801')
        and status = 'active' and approved_by = 'GJM'
        and effective_date = date '2026-09-10' and revision = 'New')               as issued,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-036'
        and content->>'revision_history' like '%ISSUED 2026-09-10, approved GJM%')  as stamped,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-036'
        and content->>'revision_history' like '%Not approved, not in force%')       as stale,
    (select jsonb_array_length(content->'procedure')
       from public.sop_documents where sop_number = 'FSQM-036')                     as lines,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-801')                                               as fields
  into r;

  if r.issued <> 2 then
    raise exception 'Expected 2 documents issued; found %.', r.issued;
  end if;
  if r.stamped <> 1 or r.stale <> 0 then
    raise exception 'Revision stamp wrong (stamped=%, stale=%).', r.stamped, r.stale;
  end if;
  -- Issuing must not have disturbed the content of either document.
  if r.lines <> 41 then
    raise exception 'FSQM-036 procedure is % lines, expected 41.', r.lines;
  end if;
  if r.fields <> 22 then
    raise exception 'FRM-801 has % fields, expected 22.', r.fields;
  end if;
end $$;

commit;
