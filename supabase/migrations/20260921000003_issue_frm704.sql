-- D-09: issue FRM-704 Finished Product Specification.
--
-- active, approved GJM, effective 2026-09-21. Revision stays 'New' - the house pattern for a first
-- issue.
--
-- Issued as reviewed: guarded on the md5 of the live form_schema, which is byte-identical to the
-- seed (20260921000002) - the owner reviewed it unchanged. A later edit in the builder cannot be
-- issued unseen.
--
-- WHAT THIS DOES NOT CLOSE. 2.3.2.9 asks for finished product specifications that exist, are
-- current and are approved by the site AND its customer - not a form able to hold them. It closes as
-- each product is entered and signed, and its customer limb only once the customer has approved
-- (the owner's call today is site approval only, recorded as such on each entry).
--
-- FOLLOW-ON, deliberately not here: FSQM-014 Part 5 and FSQM-020 Part 4 state their finished-product
-- criteria in terms because no specification existed. They are repointed at FRM-704 once product
-- entries are submitted - pointing them at an empty register would repeat the defect.

begin;

do $guard$
declare st text; rev text; h text; n int;
begin
  select status, revision, md5((content->'form_schema')::text) into st, rev, h
    from public.sop_documents where sop_number = 'FRM-704';
  if st is null then raise exception 'FRM-704 does not exist.'; end if;
  if (st, rev) is distinct from ('draft', 'New') then
    raise exception 'FRM-704 is %/% - expected the unissued draft.', st, rev;
  end if;
  if h <> '805c0556094e7fd2eca59a6844f1c10a' then
    raise exception 'FRM-704 form_schema changed since it was reviewed (md5 %); review it again before issue.', h;
  end if;
  select count(*) into n from public.sop_document_responses r join public.sop_documents d on d.id = r.document_id
   where d.sop_number = 'FRM-704';
  if n <> 0 then raise exception 'FRM-704 has % entries before issue - check they are not test entries.', n; end if;
end $guard$;

update public.sop_documents
   set status         = 'active',
       approved_by    = 'GJM',
       effective_date = date '2026-09-21'
 where sop_number = 'FRM-704';

do $verify$
declare r record;
begin
  select status, revision, approved_by, effective_date, sqf_reference, sqf_required,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f) as fields
    into r from public.sop_documents where sop_number = 'FRM-704';
  if (r.status, r.approved_by, r.effective_date) is distinct from ('active', 'GJM', date '2026-09-21') then
    raise exception 'FRM-704 did not issue: %/%/%.', r.status, r.approved_by, r.effective_date;
  end if;
  if r.revision <> 'New' then raise exception 'a first issue stays New, got %.', r.revision; end if;
  if r.sqf_reference <> '2.3.2.9' or not r.sqf_required then raise exception 'SQF reference changed.'; end if;
  if r.fields <> 35 then raise exception 'FRM-704 is not the reviewed form (% fields).', r.fields; end if;
  raise notice 'D-09: FRM-704 issued active/GJM/2026-09-21. 2.3.2.9 closes as products are entered.';
end $verify$;

commit;
