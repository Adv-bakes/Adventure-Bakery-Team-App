-- D-10: issue FRM-206 Contract Services Register.
--
-- active, approved GJM, effective 2026-09-16. Revision stays 'New' - the house pattern for a first
-- issue.
--
-- NOTHING ELSE MOVES WITH IT, and that is worth stating because every other issue migration today
-- carried three or four changes. FRM-206 has no governing programme to issue alongside it: D-10's
-- deliverable is the register itself, and 2.3.2.8 asks for the description of services to be
-- documented rather than for a procedure describing how to document it. No verification activity
-- was added either, so FSQM-017 is untouched for the first time today.
--
-- WHAT THIS DOES NOT CLOSE. D-10's "what to produce" is a register OF the site's contracted
-- services, with the contract on file - not an empty form capable of holding one. 2.3.2.8 is
-- answered when the pest control entry is filled and SUBMITTED, with the provider's licence
-- details and the contract attached. D-10 therefore stays WIP, unlike D-06, whose deliverable was
-- the documents themselves.
--
-- THE REGISTER IS CURRENTLY UNREFERENCED. No active document points at FRM-206, and none carries
-- 2.3.2.8 in its sqf_reference. That is not wrong - the form stands on its own and the Document
-- Register lists it - but if the site later wants the register reachable from the procedure that
-- governs supplier approval, SOP-2.3.4 Vendor Approval is where a line belongs. Left alone here
-- rather than widened without being asked.

begin;

do $guard$
declare st text; rev text;
begin
  select status, revision into st, rev
    from public.sop_documents where sop_number = 'FRM-206';
  if st is null then
    raise exception 'FRM-206 does not exist - run 20260916000009 first.';
  end if;
  if (st, rev) is distinct from ('draft', 'New') then
    raise exception 'FRM-206 is %/% - expected the unissued draft.', st, rev;
  end if;
  -- issue the form that was reviewed, not one that lost its shape since
  if (select count(*) from public.sop_documents d,
                           jsonb_array_elements(d.content->'form_schema'->'sections') s,
                           jsonb_array_elements(s->'fields') f
       where d.sop_number = 'FRM-206') <> 30 then
    raise exception 'FRM-206 no longer has the 30 fields that were reviewed.';
  end if;
end $guard$;

update public.sop_documents
   set status         = 'active',
       approved_by    = 'GJM',
       effective_date = date '2026-09-16'
 where sop_number = 'FRM-206';

do $verify$
declare r record;
begin
  select status, revision, approved_by, effective_date, sqf_reference,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'id' = 'training_requirements' and (f->>'required')::boolean) as training_req,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where (f->>'showInList')::boolean)                                      as listed
    into r
    from public.sop_documents where sop_number = 'FRM-206';

  if r.status <> 'active' or r.approved_by <> 'GJM' or r.effective_date <> date '2026-09-16' then
    raise exception 'FRM-206 did not issue: %, %, %.', r.status, r.approved_by, r.effective_date;
  end if;
  if r.revision <> 'New' then
    raise exception 'FRM-206 revision is % - a first issue stays New.', r.revision;
  end if;
  if r.sqf_reference <> '2.3.2.8' then
    raise exception 'FRM-206 sqf_reference is %.', r.sqf_reference;
  end if;
  -- the two things that make it a register rather than a questionnaire have to survive issue
  if r.training_req <> 1 then
    raise exception 'The training requirements field is no longer required; that is the limb 2.3.2.8 was raised on.';
  end if;
  if r.listed <> 3 then
    raise exception 'The entries list no longer surfaces the three register columns (found %).', r.listed;
  end if;

  raise notice 'D-10: FRM-206 issued active/GJM/2026-09-16. The register is empty until the pest control entry is submitted.';
end $verify$;

commit;
