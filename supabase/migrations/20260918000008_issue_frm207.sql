-- D-09: issue FRM-207 Material Specification Register.
--
-- active, approved GJM, effective 2026-09-18. Revision stays 'New' - the house pattern for a first
-- issue.
--
-- Issued as reviewed: guarded on the md5 of the live form_schema at the time of the owner's
-- review, so a later edit in the builder cannot be issued unseen. That version includes the
-- "Bought from" link to FRM-202 (20260918000007), which already offers Sysco, Restaurant Depot and
-- Amazon - the three approvals submitted today.
--
-- WHAT THIS DOES NOT CLOSE. 2.3.2.2 asks for specifications for all raw materials and packaging,
-- documented and current - a register OF them, not a form capable of holding them. It closes as
-- materials are entered, each with its manufacturer specification and allergen statement attached.
-- D-09 also still owes the SOP-2.3.2 extension (2.3.2.1, .4, .5, .6, .10), which is where the
-- procedure will point at FRM-207 by number. So D-09 stays WIP.
--
-- Nothing else moves with it: no verification activity (each entry carries its own next_review),
-- and no other document is revised here.

begin;

do $guard$
declare st text; rev text; h text; n int;
begin
  select status, revision, md5((content->'form_schema')::text) into st, rev, h
    from public.sop_documents where sop_number = 'FRM-207';
  if st is null then raise exception 'FRM-207 does not exist.'; end if;
  if (st, rev) is distinct from ('draft', 'New') then
    raise exception 'FRM-207 is %/% - expected the unissued draft.', st, rev;
  end if;
  if h <> 'bcad26828d316f84c0bd8d004430d01e' then
    raise exception 'FRM-207 form_schema changed since it was reviewed (md5 %); review it again before issue.', h;
  end if;
  select count(*) into n from public.sop_document_responses r join public.sop_documents d on d.id = r.document_id
   where d.sop_number = 'FRM-207';
  if n <> 0 then raise exception 'FRM-207 has % entries before issue - check they are not test entries.', n; end if;
end $guard$;

update public.sop_documents
   set status         = 'active',
       approved_by    = 'GJM',
       effective_date = date '2026-09-18'
 where sop_number = 'FRM-207';

do $verify$
declare r record;
begin
  select status, revision, approved_by, effective_date, sqf_reference, sqf_required,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f) as fields,
         (select f->'optionsFrom'->>'form' from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f where f->>'id' = 'bought_from') as linked
    into r from public.sop_documents where sop_number = 'FRM-207';
  if (r.status, r.approved_by, r.effective_date) is distinct from ('active', 'GJM', date '2026-09-18') then
    raise exception 'FRM-207 did not issue: %/%/%.', r.status, r.approved_by, r.effective_date;
  end if;
  if r.revision <> 'New' then raise exception 'a first issue stays New, got %.', r.revision; end if;
  if r.sqf_reference <> '2.3.2.2' or not r.sqf_required then raise exception 'SQF reference changed.'; end if;
  if r.fields <> 27 or r.linked <> 'FRM-202' then
    raise exception 'FRM-207 is not the reviewed form (% fields, Bought from linked to %).', r.fields, r.linked;
  end if;
  raise notice 'D-09: FRM-207 issued active/GJM/2026-09-18. It closes 2.3.2.2 as materials are entered.';
end $verify$;

commit;
