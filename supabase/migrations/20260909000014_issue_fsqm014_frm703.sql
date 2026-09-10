-- Issue FSQM-014 Product Sampling, Inspection and Analysis Program and FRM-703 Retention Sample
-- Log. Active, approved GJM, effective 2026-09-09. Closes D-15 (SQF Food Manufacturing Ed 9, 2.4.4).
--
-- BOTH IN ONE TRANSACTION. Part 6 requires every retained sample to be logged on FRM-703, and
-- FRM-703 prints Part 6's rule on its own face. Activating the program while its record was still
-- draft would create the exact defect this wave exists to close - an active controlled document
-- requiring a record that is not in force. Either both issue or neither does. (Same reasoning as
-- 20260904000005 for FSQM-020/FRM-701 and 20260908000007 for SOP-401/FRM-401.)
--
-- WHAT ISSUING ADOPTS, AND WHAT IT DOES NOT. The two OPEN BEFORE ISSUE items are decided, not
-- deleted, and the decisions are written into the revision history under SETTLED AT ISSUE:
--
--   1. 2.4.4.1 wants inspection "to agreed specifications" and the site holds none. The program is
--      issued on Part 5's explicitly stated criteria so the inspection is performable today. THE
--      SPECIFICATION LIMB IS NOT CLOSED BY THIS DOCUMENT - it is owned by D-09. Issuing was
--      preferred to holding because the alternative is operating with NO documented inspection
--      programme at all while a deliverable that has not started is built, and because Part 5
--      discloses the workaround rather than concealing it.
--   2. The 2.4.4.5 Minor was scored with no evidence recorded, and nothing requires this site to
--      hold retention samples at all. That query stands with RDR, but it was never a condition of
--      issue: the practice now has a basis, a storage condition, a period and a record either way.
--
-- ZERO ENTRIES IS A GUARD, not an assumption. A draft entry made while testing would become part
-- of the controlled record the moment the form goes active. The owner cleared his test entry on
-- 2026-09-09; this refuses if one is present.
--
-- REVISION STAYS AT New on both - a first issue, not a revision, so nothing is superseded and
-- nothing archived (as FSQM-009/018/020 and SOP-401/FRM-401). Only status, approved_by,
-- effective_date and FSQM-014's revision_history are written; the guard hashes the rest of both
-- rows so the procedure, the form schema and every other section are provably untouched.
--
-- Carriage returns are stripped at the end for the reason 20260909000013 gives: this migration's
-- settled block is multi-line, and on a CRLF checkout that would write \r into an ACTIVE document.

begin;

do $$
declare r record;
begin
  select
    (select status   from public.sop_documents where sop_number = 'FSQM-014') as s014,
    (select status   from public.sop_documents where sop_number = 'FRM-703')  as s703,
    (select revision from public.sop_documents where sop_number = 'FSQM-014') as v014,
    (select revision from public.sop_documents where sop_number = 'FRM-703')  as v703,
    (select jsonb_array_length(content->'procedure')
       from public.sop_documents where sop_number = 'FSQM-014')               as lines,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-703')                                         as fields,
    (select (content->>'revision_history') like '%OPEN BEFORE ISSUE%'
       from public.sop_documents where sop_number = 'FSQM-014')               as open_head,
    (select (content->>'revision_history') like '%DRAFT. Not approved, not in force.%'
       from public.sop_documents where sop_number = 'FSQM-014')               as draft_marker,
    -- 20260909000013 must have landed: the body must describe the practice the site confirmed.
    (select (content->'procedure')::text like '%A sealed unit of each finished product%'
       from public.sop_documents where sop_number = 'FSQM-014')               as per_product,
    (select (content->'procedure')::text like '%reserved retention shelf in the ambient warehouse%'
       from public.sop_documents where sop_number = 'FSQM-014')               as shelf,
    (select (content->'procedure')::text like '%from each production batch%'
       from public.sop_documents where sop_number = 'FSQM-014')               as stale_unit,
    (select count(*) from public.sop_document_responses rr
       join public.sop_documents dd on dd.id = rr.document_id
      where dd.sop_number = 'FRM-703')                                        as entries,
    (select count(*) from public.sop_documents
      where sop_number in ('FRM-301','FRM-701','FRM-702','FRM-903','FSQM-009',
                           'FSQM-018','FSQM-020','SOP-2.3.1','SOP-2.3.2')
        and status = 'active')                                                as refs_live
  into r;

  if r.s014 is distinct from 'draft' or r.s703 is distinct from 'draft' then
    raise exception 'Expected both draft; found FSQM-014=%, FRM-703=%.', r.s014, r.s703;
  end if;
  if r.v014 <> 'New' or r.v703 <> 'New' then
    raise exception 'Expected both at revision New; found %, %.', r.v014, r.v703;
  end if;
  if r.lines <> 36 or r.fields <> 20 then
    raise exception 'Bodies are not what 20260909000013 left: % lines, % fields.', r.lines, r.fields;
  end if;
  if not (r.per_product and r.shelf) or r.stale_unit then
    raise exception 'The confirmed practice is not in the body (per-product=%, shelf=%, stale per-batch=%). Apply 20260909000013 first.',
      r.per_product, r.shelf, r.stale_unit;
  end if;
  if not (r.open_head and r.draft_marker) then
    raise exception 'FSQM-014 does not carry the headings this migration rewrites (open=%, draft=%).',
      r.open_head, r.draft_marker;
  end if;
  -- A test entry would become part of the controlled record the moment the form goes active.
  if r.entries <> 0 then
    raise exception 'FRM-703 holds % entries. Clear them before issue, or an entry made while testing becomes a controlled record.', r.entries;
  end if;
  if r.refs_live <> 9 then
    raise exception 'Only % of the 9 documents FSQM-014 references are active.', r.refs_live;
  end if;
end $$;

create temporary table issue014_before on commit drop as
select 'FSQM-014'::text as sop_number, md5((content - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'FSQM-014'
union all
select 'FRM-703', md5(content::text)
  from public.sop_documents where sop_number = 'FRM-703';

update public.sop_documents
   set content = jsonb_set(content, '{revision_history}',
         to_jsonb(
           regexp_replace(
             replace(content->>'revision_history',
               'DRAFT. Not approved, not in force.',
               'ISSUED 2026-09-09, approved GJM. Status active, revision New — a first issue, not a revision, so nothing is superseded and nothing archived. FRM-703 Retention Sample Log is activated in the same transaction, because Part 6 requires every retained sample to be logged on it and that form prints Part 6 rule on its own face; an active programme requiring a draft record is the finding this wave exists to close.'),
             'OPEN BEFORE ISSUE[\s\S]*$',
             $settled$SETTLED AT ISSUE — the two items this programme carried are decided. They are recorded here rather than deleted, because a reader is better served by knowing what was decided and on what basis than by a history that shows only the conclusion.

1. THE SPECIFICATION LIMB OF 2.4.4.1 IS NOT CLOSED BY THIS DOCUMENT, and issuing does not pretend otherwise. The clause requires inspection to agreed specifications; the site holds no finished product specification. This programme is issued on the basis of Part 5, which states the finished-product criteria explicitly — the release checks of FSQM-020 Part 4, the approved label, and the agreed pack and quantity configuration — so that the inspection is performable today. That limb is owned by D-09, the specification library, and when it exists Part 5 criteria move to the specification and this programme points at it instead. Issuing on this basis was preferred to holding: the alternative was operating with no documented inspection programme at all while a deliverable that has not started is built, and Part 5 discloses the workaround rather than concealing it. An auditor who reads Part 5 is told exactly what is being inspected against and why.

2. THE 2.4.4.5 MINOR STANDS AS A QUERY, NOT A CONDITION. The consultant scored it with no evidence recorded in the assessment, and no customer and no regulation requires this site to hold retention samples at all. That question is still worth putting to RDR Global Partners, but it was never a reason to withhold this programme: whether or not the finding was well founded, the retention practice now has a stated basis, a storage condition, a period and a record in FRM-703, and the site is better placed at the next audit for having them in force.

WHAT THIS PROGRAMME DOES NOT CLAIM, stated once more at issue because each is a limit an auditor is entitled to test. The site inspects; it does not analyse — no analysis of any kind is performed or commissioned, and 2.4.4.3 and 2.4.4.4 are recorded justified Not Applicable for want of a laboratory. Retention samples are not required of this site by anyone and are kept anyway. A retained sample answers for the lot it came from and no other, and because retention is organised by product rather than by batch the shelf will not hold a unit of every lot in the market. Each of those is stated in the body rather than left for a reader to infer.$settled$
           )
         )::jsonb),
       status = 'active', approved_by = 'GJM', effective_date = date '2026-09-09'
 where sop_number = 'FSQM-014' and status = 'draft' and revision = 'New';

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-09-09'
 where sop_number = 'FRM-703' and status = 'draft' and revision = 'New';

-- The settled block is multi-line, so on a CRLF checkout it would carry carriage returns into a
-- document that is now ACTIVE. Same belt-and-braces as 20260909000013.
update public.sop_documents
   set content = jsonb_set(content, '{revision_history}',
         to_jsonb(replace(content->>'revision_history', chr(13), '')))
 where sop_number = 'FSQM-014'
   and position(chr(13) in content->>'revision_history') > 0;

do $$
declare
  r record;
  bad int;
  crs int;
begin
  select
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-014','FRM-703') and status = 'active'
        and approved_by = 'GJM' and effective_date = date '2026-09-09'
        and revision = 'New')                                                 as issued,
    (select jsonb_array_length(content->'procedure')
       from public.sop_documents where sop_number = 'FSQM-014')               as lines,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-703')                                         as fields,
    (select (content->>'revision_history') like '%OPEN BEFORE ISSUE%'
       from public.sop_documents where sop_number = 'FSQM-014')               as stale_head,
    (select (content->>'revision_history') like '%DRAFT. Not approved, not in force.%'
       from public.sop_documents where sop_number = 'FSQM-014')               as stale_draft,
    (select (content->>'revision_history') like '%ISSUED 2026-09-09, approved GJM%'
       from public.sop_documents where sop_number = 'FSQM-014')               as issue_note,
    (select (content->>'revision_history') like '%SETTLED AT ISSUE%'
       from public.sop_documents where sop_number = 'FSQM-014')               as settled,
    (select (content->>'revision_history') like '%SPECIFICATION LIMB OF 2.4.4.1 IS NOT CLOSED%'
       from public.sop_documents where sop_number = 'FSQM-014')               as spec_disclosed
  into r;

  if r.issued <> 2 then
    raise exception 'Expected 2 documents issued active/GJM/2026-09-09/New, found %.', r.issued;
  end if;
  if r.stale_head or r.stale_draft then
    raise exception 'A pre-issue marker survived (OPEN BEFORE ISSUE=%, DRAFT=%).',
      r.stale_head, r.stale_draft;
  end if;
  if not (r.issue_note and r.settled and r.spec_disclosed) then
    raise exception 'The issue record did not land (note=%, settled=%, spec limb disclosed=%).',
      r.issue_note, r.settled, r.spec_disclosed;
  end if;
  -- Issuing must not have touched a word of either body.
  if r.lines <> 36 or r.fields <> 20 then
    raise exception 'A body moved during issue: % lines, % fields.', r.lines, r.fields;
  end if;
  select count(*) into bad
    from public.sop_documents d
    join issue014_before b on b.sop_number = d.sop_number
   where (d.sop_number = 'FSQM-014' and md5((d.content - 'revision_history')::text) is distinct from b.h)
      or (d.sop_number = 'FRM-703'  and md5(d.content::text) is distinct from b.h);
  if bad <> 0 then
    raise exception 'Issue changed % document(s) beyond status, approval, date and the revision history.', bad;
  end if;

  select count(*) into crs
    from public.sop_documents d, lateral jsonb_each_text(d.content) k(key, value)
   where d.sop_number in ('FSQM-014','FRM-703')
     and jsonb_typeof(d.content->k.key) = 'string'
     and position(chr(13) in k.value) > 0;
  if crs <> 0 then
    raise exception '% field(s) carry a carriage return into an active document.', crs;
  end if;
end $$;

commit;
