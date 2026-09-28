-- Issue FSQM-039 Facility Layout and Product Flow, after the floor walk.
--
-- Owner, 2026-09-28: "A walk has been performed... Confirmed as drawn", walked by the SQF Practitioner today.
-- The walk was the only stated gate - FSQM-039's own revision history says the zone boundaries were
-- derived from the architectural plan and that "the drawing issues on that confirmation".
--
-- active, GJM, 2026-09-28, revision New. sqf_reference stays NULL and sqf_required stays false on purpose:
-- this drawing closes no clause and is not the 2.4.3.6 flow diagram (its governing reference says so).
--
-- Guarded on the md5 of the content EXCLUDING attachments (the four files were verified current
-- 2026-09-18) plus a check that the three sheets are still attached.
--
-- NOT HERE: FSQM-015 and FSQM-016 reference this drawing and stay drafts; the same walk also covered
-- FSQM-016's Attachment A confirmation block and the D-16 sample-point zone lines, which are their own
-- deliverables.

begin;

do $guard$
declare h text; st text; rev text; n int;
begin
  select md5((content - 'attachments')::text), status, revision,
         (select count(*) from jsonb_array_elements(coalesce(content->'attachments', '[]')) a
           where lower(a->>'name') like '%.pdf')
    into h, st, rev, n from public.sop_documents where sop_number = 'FSQM-039';
  if (st, rev) is distinct from ('draft', 'New') or h <> 'e3134483caeae8187127449c64311cf4' then
    raise exception 'FSQM-039 is %/% or changed since review (md5 %).', st, rev, h;
  end if;
  if n <> 3 then raise exception 'FSQM-039 has % PDF sheets - expected the three rotation sheets.', n; end if;
end $guard$;

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-09-28',
       content = content || jsonb_build_object('revision_history', (content->>'revision_history') || $t$

ISSUED 2026-09-28 - FLOOR WALK PERFORMED. The SQF Practitioner walked the production floor on 2026-09-28 and confirmed the hygiene zone boundaries as drawn, including where the lines fall on the west wall between the cooling racks, the mixers and the ovens. That confirmation was the one thing this drawing waited on, and it issues on it: active, approved GJM, effective 2026-09-28, Rev New, all three sheets and the draw.io master at the same revision.

THE ZONING RESTS ON THE CHANGEOVER CLEAN, WHICH HAS NO RECORD YET. The dunk bay is low risk on Day 1 and high care on Day 2, separated by the changeover clean rather than by a wall. Changeover (2.6.1.2, D-17) is not yet documented or recorded. Issuing this drawing makes that dependency an active assertion; it is stated here rather than left to be found.

sqf_reference stays null and sqf_required stays false: no clause requires a facility layout drawing, and this document still is not the 2.4.3.6 flow diagram.$t$)
 where sop_number = 'FSQM-039';

do $verify$
declare r record;
begin
  select status, approved_by, effective_date, revision, sqf_reference, sqf_required,
         (select count(*) from jsonb_array_elements(content->'attachments') a) att,
         jsonb_array_length(content->'procedure') n
    into r from public.sop_documents where sop_number = 'FSQM-039';
  if (r.status, r.approved_by, r.effective_date, r.revision) is distinct from ('active', 'GJM', date '2026-09-28', 'New') then
    raise exception 'FSQM-039 did not issue: %/%/%/%', r.status, r.approved_by, r.effective_date, r.revision;
  end if;
  if r.sqf_reference is not null or r.sqf_required then
    raise exception 'FSQM-039 must stay unmapped to a clause.';
  end if;
  if r.att <> 4 or r.n <> 30 then
    raise exception 'FSQM-039 attachments or procedure changed (% files, % lines).', r.att, r.n;
  end if;
  if (select content->>'revision_history' from public.sop_documents where sop_number = 'FSQM-039')
       not like '%FLOOR WALK PERFORMED%' then
    raise exception 'FSQM-039 revision history did not record the walk.';
  end if;
end $verify$;

commit;
