-- D-29: issue FSQM-031 Pest Prevention Program and FRM-914 Pest Activity Log.
--
-- Owner, 2026-09-29: "issue now". active, GJM, 2026-09-29, revision New (first issue). Guarded on the md5
-- of each document's content as reviewed, EXCLUDING attachments - the owner is attaching files as this is
-- written. A separate check requires every file the program's text points at to be attached: the device
-- map (11.2.4.1 vi) and the label + SDS of each of the contractor's four products (11.2.4.1 vii).
--
-- D-29 STAYS WIP: the technician's applicator licence is not yet on the FRM-206 pest control entry (open
-- under D-10), and the technician does not yet sign in on arrival - the site is directing him to.

begin;

do $guard$
declare h text; st text; missing text[];
begin
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FSQM-031';
  if st is distinct from 'draft' or h <> 'c89dc64ac08969c6a3d118cb7131d69d' then
    raise exception 'FSQM-031 is % or changed since review (md5 %).', st, h;
  end if;
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FRM-914';
  if st is distinct from 'draft' or h <> 'a86ddc4e945780b987ca0dbc43670d0a' then
    raise exception 'FRM-914 is % or changed since review (md5 %).', st, h;
  end if;

  select array_agg(want) into missing
    from unnest(array['%device map%', '%contrac%', '%advion ant%', '%advion cockroach%', '%alpine%']) want
   where not exists (
     select 1 from public.sop_documents d, jsonb_array_elements(coalesce(d.content->'attachments', '[]')) a
      where d.sop_number = 'FSQM-031' and lower(a->>'name') like want and lower(a->>'name') like '%.pdf');
  if missing is not null then
    raise exception 'FSQM-031 is missing an attachment matching %.', missing;
  end if;

  -- the Contrac original carried the contractor's employee timesheet on pages 7-8; only the cleaned copy goes on
  if exists (select 1 from public.sop_documents d, jsonb_array_elements(coalesce(d.content->'attachments', '[]')) a
              where d.sop_number = 'FSQM-031' and lower(a->>'name') like '%contact soft bait%') then
    raise exception 'FSQM-031 carries the ORIGINAL Contrac PDF (with the contractor timesheet) - remove it first.';
  end if;
end $guard$;

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-09-29',
       content = content || jsonb_build_object('revision_history', (content->>'revision_history') || $t$

ISSUED 2026-09-29. Of the four items the draft listed to confirm: the device map is attached (three exterior bait stations, BS-1 between the 415 and 425 entrances and BS-2, BS-3 on the outer side wall of 415, drawn from FSQM-039; the station numbers are to be matched with the technician's at the next visit), and the label and SDS of each product the contractor applies here are attached - Contrac Soft Bait (EPA Reg. No. 12455-146), Advion Ant Gel (100-1498), Advion Cockroach Gel Bait (100-1484) and Alpine WSG (499-561). The technician does NOT yet sign in on FRM-905 or report on arrival; the site is directing him to, which is what this program requires. The technician's applicator licence is still to be recorded on the FRM-206 entry. D-29 stays WIP until both are done.$t$)
 where sop_number = 'FSQM-031' and status = 'draft';

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-09-29'
 where sop_number = 'FRM-914' and status = 'draft';

do $verify$
begin
  if (select count(*) from public.sop_documents where sop_number in ('FSQM-031', 'FRM-914') and status = 'active'
        and approved_by = 'GJM' and effective_date = date '2026-09-29' and revision = 'New') <> 2 then
    raise exception 'FSQM-031 and FRM-914 were not both issued.';
  end if;
  if (select content->>'revision_history' from public.sop_documents where sop_number = 'FSQM-031') not like '%ISSUED 2026-09-29%' then
    raise exception 'FSQM-031 revision history was not stamped.';
  end if;
end $verify$;

commit;
