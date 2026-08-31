-- Normalise two approver values on TRN-004A and TRN-012 to GJM.
--
-- The bulk approval in 20260831000010 only filled EMPTY approver fields, and correctly refused to
-- touch anything already signed. That left two values visible in the register that should not be
-- there, both surfaced by tallying approvers afterwards:
--
--   TRN-012   approved_by = 'TR-12'
--     Not a person. It reads as a mistyped module code - TRN-012 with characters dropped - sitting
--     in a signature field. It is the only approver value in the whole register that does not name
--     anybody, so an auditor asking "who approved this training module?" gets an answer that is not
--     an answer.
--
--   TRN-004A  approved_by = 'Gabriela Juncos Mercer'
--     The right person under the wrong identifier. Every other document she has approved - 77 of
--     them after 20260831000010 - records GJM. One document spelling her out in full reads as a
--     second, different approver to anyone matching signatures across the register, which is
--     exactly what an auditor does.
--
-- WHAT THIS IS NOT. It is not a re-approval and it does not change WHO approved anything. TRN-004A
-- was approved by Gabriela and still is; only the identifier is normalised. TRN-012 is the one
-- judgement call: 'TR-12' names nobody, so there is no signature to preserve, and the owner has
-- confirmed GJM is the approver.
--
-- DELIBERATELY UNTOUCHED: SOP-204 ('JD'), Hostinger Hosting Guide ('Richard Mercer') and Roles,
-- Permissions & User Administration ('RNM'). All three name a real person. JD is a different
-- approver, not a variant spelling of this one, and normalising it would be inventing a fact rather
-- than tidying a format. The assertion below proves all three survive.
--
-- No revision bump on either: neither document's content changes, and both were already approved.
-- approved_by is a watched field, so both writes leave audit snapshots of the prior value - which
-- is the point, since the previous values are what the record needs to show was corrected.

begin;

do $$
declare
  before_gjm int;
  after_gjm int;
  n_fixed int;
  bad text;
begin
  select count(*) into before_gjm from public.sop_documents where approved_by = 'GJM';

  update public.sop_documents
     set approved_by = 'GJM'
   where sop_number in ('TRN-004A', 'TRN-012')
     and status = 'active'
     and approved_by in ('TR-12', 'Gabriela Juncos Mercer');

  get diagnostics n_fixed = row_count;

  select count(*) into after_gjm from public.sop_documents where approved_by = 'GJM';

  select string_agg(x, '; ') into bad from (
    select 'normalised ' || n_fixed::text || ' documents, expected 2' as x where n_fixed <> 2
    union all
    select 'GJM count went ' || before_gjm::text || '->' || after_gjm::text
           || ', expected a rise of exactly 2'
     where after_gjm <> before_gjm + 2
    union all
    select 'TRN-004A approver is ' || coalesce(approved_by, 'null') from public.sop_documents
     where sop_number = 'TRN-004A' and status = 'active' and approved_by is distinct from 'GJM'
    union all
    select 'TRN-012 approver is ' || coalesce(approved_by, 'null') from public.sop_documents
     where sop_number = 'TRN-012' and status = 'active' and approved_by is distinct from 'GJM'
    union all
    -- no approver value may remain that fails to name a person
    select 'a non-person approver value survives: ' || approved_by from public.sop_documents
     where status = 'active' and approved_by ~ '^[A-Z]{2,4}-[0-9]'
    union all
    -- the three real signatures belonging to other people must be untouched
    select 'lost a signature: ' || w.d from (values
      ('SOP-204', 'JD'),
      ('Hostinger Hosting Guide', 'Richard Mercer'),
      ('Roles, Permissions & User Administration', 'RNM')
    ) as w(d, who)
     where not exists (
       select 1 from public.sop_documents
        where coalesce(sop_number, title) = w.d and approved_by = w.who)
    union all
    -- and the HACCP plan must still be unapproved
    select 'the HACCP plan gained an approver' from public.sop_documents
     where title like '%HACCP PLAN%' and status = 'active' and approved_by is not null
  ) t;

  if bad is not null then
    raise exception 'approver normalisation did not apply cleanly: %', bad;
  end if;

  raise notice 'normalised % approver values to GJM; SOP-204, Hostinger and Roles keep theirs', n_fixed;
end $$;

commit;
