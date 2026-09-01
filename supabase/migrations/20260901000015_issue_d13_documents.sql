-- Issue the D-13 document set and the food safety policy, and archive the document superseded.
--
-- ACTIVATES:  FSQM-012  Good Manufacturing Practices Program
--             FSQM-013  Module 11 Applicability & Exemption Analysis
--             FSQM-022  Food Safety Monitoring Program            (rev v2)
--             FRM-913   GMP / Food Safety Inspection Record
--             FSQM-002  Food Safety and Quality Policy            (rev v2, EN + ES)
-- ARCHIVES:   SOP-11.3  Personnel Hygiene & Visitor Policy        (superseded by FSQM-012)
--
-- ONE TRANSACTION, because they are interlocked and any partial application leaves the quality
-- system in a state nobody intended:
--
--   - FSQM-012 supersedes SOP-11.3. Archiving SOP-11.3 without activating FSQM-012 would leave the
--     site with NO active personnel hygiene document at all - worse than either end state. This is
--     the sequencing trap called out in 20260901000001, held open ever since, and closed here.
--   - FSQM-022 requires findings to be recorded on FRM-913. An active program whose record is a
--     draft form is a softer version of the Form-0010 defect that put FSQM-022 on the board.
--   - FSQM-012 and FSQM-013 reference each other; FSQM-013 exists to say what FSQM-012 does not
--     claim. Issuing one without the other publishes half an argument.
--
-- FSQM-002 IS ISSUED HERE TOO. The owner approved it in both English and Spanish on 2026-09-01,
-- which was the last thing holding it: the policy carries both language versions in one document,
-- because 2.1.1.1 (vi) asks for the policy to be displayed AND understood, and a single sheet
-- cannot be posted half complete. It already carried approver GJM and effective date 2026-08-31
-- from 20260831000004, so ONLY THE STATUS CHANGES - re-dating an approved policy to today would
-- misstate when it was approved. Its Spanish text was checked for encoding damage before issue (no
-- mojibake, accents intact); this project corrupted Spanish characters in prod once, and the check
-- is cheap.
--
-- "OPEN BEFORE ACTIVATION" IS RENAMED, NOT DELETED. FSQM-012 and FSQM-013 each carry a list under
-- that heading. An ACTIVE controlled document saying "open before activation" is self-contradictory,
-- and an auditor reading it would reasonably ask whether the document should have been issued. But
-- the items are real, and deleting them to tidy the wording would be worse than the contradiction:
-- it would remove the site's own record of what it still owes. The heading becomes "OPEN ACTIONS AT
-- ISSUE" and the items stay verbatim - asserted below, so a rename cannot quietly eat them. Three
-- remain across the two documents:
--
--   FSQM-012  confirm the 1:160 foot bath dilution against the Sani-512 product label, and add the
--             label and SDS to the chemical file (the 1:512 figure was label-checked, this was not)
--   FSQM-012  buy high-range quat test strips - the 0-400 ppm strips saturate at 1:160 and would
--             read high on a failed bath
--   FSQM-013  confirm how WASH-DOWN hoses are stored; only the compressed air lines are ceiling drops
--
-- None of the three blocks issue. The strips matter operationally, but FRM-903 has carried the foot
-- bath check since 20260901000008, so that dependency exists whether or not this migration runs.
--
-- *** ONE REFERENCE WILL STILL POINT FROM AN ACTIVE DOCUMENT TO A DRAFT ONE. *** After this runs,
-- FSQM-012 is active and names SOP-204 Allergen Cleaning Procedure (draft, Rev C), to which its
-- Parts 4 and 8 route allergen changeover. It is deliberately NOT bundled here: approving it is a
-- separate judgement about a document this wave did not write or review.
--
-- WORTH BEING PRECISE ABOUT WHY IT STILL MATTERS, because the intuitive reasoning runs the wrong
-- way round. Allergen control is not driven by whether the site makes an "allergen-free" claim; it
-- is driven by UNDECLARED CROSS-CONTACT. A product whose label omits an allergen that reached it
-- from shared equipment is a recall, and no claim need ever have been made for that to be true. The
-- exposure therefore depends on whether products with different allergen profiles share the mixer,
-- the depositors, the kettle or the molds - not on marketing. SQF treats it the same way: 2.8
-- allergen management is not conditional on a claim, TRN-003 and TRN-004 are active allergen
-- training for production staff, and FRM-903 already carries an allergen changeover line.
-- Reviewing SOP-204 is the right call; the reason is cross-contact between products.
--
-- Revisions do NOT change on issue. FSQM-012, FSQM-013 and FRM-913 stay at "New" - the house
-- pattern for a first issue, matching FRM-004 - FSQM-022 stays at v2, and FSQM-002 stays at v2.
-- Issuing a document is not revising it. The four D-13 documents take effective date 2026-09-01 and
-- approver GJM; FSQM-002 keeps the dates it was approved with.
--
-- The sop_document_history trigger fires only for documents that are ALREADY published, so it
-- snapshots SOP-11.3 (active -> archived) and none of the drafts becoming active. That is correct:
-- there is no prior published state of a draft to preserve.
--
-- Guarded on every precondition: the five are draft at the expected revisions, FSQM-002 already
-- carries its approver, SOP-11.3 is active, and FRM-913 still has its 34-row checklist.

begin;

do $$
declare
  r record;
begin
  select
    (select status      from public.sop_documents where sop_number = 'FSQM-012') as s12,
    (select status      from public.sop_documents where sop_number = 'FSQM-013') as s13,
    (select status      from public.sop_documents where sop_number = 'FSQM-022') as s22,
    (select status      from public.sop_documents where sop_number = 'FRM-913')  as s913,
    (select status      from public.sop_documents where sop_number = 'FSQM-002') as s02,
    (select approved_by from public.sop_documents where sop_number = 'FSQM-002') as a02,
    (select status      from public.sop_documents where sop_number = 'SOP-11.3') as s113,
    (select revision    from public.sop_documents where sop_number = 'FSQM-022') as r22,
    (select coalesce(sum(jsonb_array_length(f->'rows'->'labels')), 0)
       from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') sec,
            jsonb_array_elements(sec->'fields') f
      where d.sop_number = 'FRM-913' and f->>'type' = 'grid')                    as rows913
  into r;

  if r.s12 is distinct from 'draft' or r.s13 is distinct from 'draft'
     or r.s22 is distinct from 'draft' or r.s913 is distinct from 'draft' then
    raise exception 'Expected four D-13 drafts to issue; found FSQM-012=%, FSQM-013=%, FSQM-022=%, FRM-913=%.',
      r.s12, r.s13, r.s22, r.s913;
  end if;
  if r.s02 is distinct from 'draft' then
    raise exception 'FSQM-002 is % - expected the approved draft awaiting issue.', r.s02;
  end if;
  if r.a02 is distinct from 'GJM' then
    raise exception 'FSQM-002 has approver % - a policy should already be approved before it is issued.', r.a02;
  end if;
  if r.s113 is distinct from 'active' then
    raise exception 'SOP-11.3 is % - expected active, since this migration is what archives it.', r.s113;
  end if;
  if r.r22 is distinct from 'v2' then
    raise exception 'FSQM-022 is at revision % - expected the v2 written by 20260901000012.', r.r22;
  end if;
  if r.rows913 <> 34 then
    raise exception 'FRM-913 has % checklist rows, expected 34 - do not issue an inspection form of the wrong shape.', r.rows913;
  end if;
end $$;

-- 1. Issue the four D-13 documents.
update public.sop_documents
   set status = 'active',
       effective_date = date '2026-09-01',
       approved_by = 'GJM'
 where sop_number in ('FSQM-012', 'FSQM-013', 'FSQM-022', 'FRM-913')
   and status = 'draft';

-- 1b. Issue the policy. Only the status changes: it already carries approver GJM and effective date
--     2026-08-31, and re-dating an approved policy to today would misstate when it was approved.
update public.sop_documents
   set status = 'active'
 where sop_number = 'FSQM-002'
   and status = 'draft';

-- 2. An issued document cannot say "open before activation". Rename the heading; keep the items.
update public.sop_documents
   set content = jsonb_set(content, '{revision_history}',
                   to_jsonb(replace(content->>'revision_history',
                                    'OPEN BEFORE ACTIVATION', 'OPEN ACTIONS AT ISSUE')))
 where sop_number in ('FSQM-012', 'FSQM-013')
   and content->>'revision_history' like '%OPEN BEFORE ACTIVATION%';

-- 3. Record the supersession on the document that supersedes.
update public.sop_documents
   set content = jsonb_set(content, '{revision_history}',
                   to_jsonb((content->>'revision_history') || E'\n\n' ||
                     'ISSUED 2026-09-01, approved GJM. SOP-11.3 Personnel Hygiene & Visitor Policy '
                     'is archived in the same transaction and is superseded by this program in '
                     'full. Its dress code, jewellery list, visitor requirements, twelve-month '
                     'retention and corrective-action clause are carried forward here; nothing it '
                     'stated has been dropped.'))
 where sop_number = 'FSQM-012'
   and status = 'active';

-- 4. Archive the superseded document, and say so on its own face.
update public.sop_documents
   set status = 'archived',
       content = jsonb_set(content, '{revision_history}',
                   to_jsonb(coalesce(nullif(content->>'revision_history', ''), '') ||
                     case when coalesce(content->>'revision_history', '') = '' then '' else E'\n\n' end ||
                     'ARCHIVED 2026-09-01 - SUPERSEDED BY FSQM-012, Good Manufacturing Practices '
                     'Program, which covers SQF Module 11.3 and 11.4 in full. This document '
                     'addressed about nine of those thirty-five clauses. Everything it required is '
                     'carried forward in FSQM-012; refer to that document. Retained for the record, '
                     'not for use.'))
 where sop_number = 'SOP-11.3'
   and status = 'active';

do $$
declare
  r record;
begin
  select
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-012','FSQM-013','FSQM-022','FRM-913')
        and status = 'active' and approved_by = 'GJM'
        and effective_date = date '2026-09-01')                                  as issued,
    (select status from public.sop_documents where sop_number = 'FSQM-002')      as s02,
    (select effective_date from public.sop_documents where sop_number = 'FSQM-002') as e02,
    (select status from public.sop_documents where sop_number = 'SOP-11.3')      as s113,
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-012','FSQM-013')
        and content->>'revision_history' like '%OPEN BEFORE ACTIVATION%')        as stale_heading,
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-012','FSQM-013')
        and content->>'revision_history' like '%OPEN ACTIONS AT ISSUE%')         as renamed,
    (select content->>'revision_history' like '%SUPERSEDED BY FSQM-012%'
       from public.sop_documents where sop_number = 'SOP-11.3')                  as s113_note,
    (select content->>'revision_history' like '%ISSUED 2026-09-01%'
       from public.sop_documents where sop_number = 'FSQM-012')                  as f12_note,
    -- the open items must survive the rename
    (select content->>'revision_history' like '%high-range quat test strips%'
       from public.sop_documents where sop_number = 'FSQM-012')                  as f12_items,
    (select content->>'revision_history' like '%WASH-DOWN hoses%'
       from public.sop_documents where sop_number = 'FSQM-013')                  as f13_items,
    -- bodies must be untouched
    (select jsonb_array_length(content->'procedure')
       from public.sop_documents where sop_number = 'FSQM-012')                  as f12_lines,
    (select jsonb_array_length(content->'procedure')
       from public.sop_documents where sop_number = 'FSQM-013')                  as f13_lines,
    (select length(content->>'statement')
       from public.sop_documents where sop_number = 'FSQM-002')                  as f02_len
  into r;

  if r.issued <> 4 then
    raise exception 'Only % of the four D-13 documents issued as active/GJM/2026-09-01.', r.issued;
  end if;
  if r.s02 is distinct from 'active' then
    raise exception 'FSQM-002 is % - it should have been issued.', r.s02;
  end if;
  if r.e02 is distinct from date '2026-08-31' then
    raise exception 'FSQM-002 effective date moved to % - issuing it must not re-date its approval.', r.e02;
  end if;
  if r.f02_len <> 3438 then
    raise exception 'FSQM-002 statement is now % characters, expected 3438 - issuing it must not touch its text.', r.f02_len;
  end if;
  if r.s113 is distinct from 'archived' then
    raise exception 'SOP-11.3 is % - it must be archived by this migration.', r.s113;
  end if;
  if r.stale_heading <> 0 or r.renamed <> 2 then
    raise exception 'Open-list heading wrong: % still say "open before activation", % renamed (expected 0 and 2).',
      r.stale_heading, r.renamed;
  end if;
  if not (r.f12_items and r.f13_items) then
    raise exception 'The open items were lost in the rename: FSQM-012=%, FSQM-013=%.',
      r.f12_items, r.f13_items;
  end if;
  if not (r.s113_note and r.f12_note) then
    raise exception 'Supersession not recorded: SOP-11.3 note=%, FSQM-012 note=%.',
      r.s113_note, r.f12_note;
  end if;
  if r.f12_lines <> 92 or r.f13_lines <> 33 then
    raise exception 'A body changed length: FSQM-012=% (expected 92), FSQM-013=% (expected 33).',
      r.f12_lines, r.f13_lines;
  end if;

  raise notice 'FSQM-012 is now active and still references SOP-204 (draft), which carries allergen changeover. The exposure to review is undeclared cross-contact between products sharing equipment, not whether an allergen-free claim is made.';
end $$;

commit;
