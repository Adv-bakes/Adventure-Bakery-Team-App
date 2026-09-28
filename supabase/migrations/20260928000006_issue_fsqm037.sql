-- D-36: issue FSQM-037 Waste Management Program.
--
-- Owner, 2026-09-28: "issue D-36", after reading the draft and correcting it four times (bin washing by
-- condition; trademarked waste risk-assessed; waste out at the end of the day; covered-bins line
-- dropped).
--
-- active, GJM, 2026-09-28, revision New (first issue). Guarded on the md5 of the content as corrected and on
-- the four owner decisions still being in the text, so this cannot issue a version that quietly lost one
-- of them.
--
-- Closes 11.8.1.1 and 11.8.1.6 as written. The other eight limbs of 11.8 are judged by observation on
-- site, and the program gives the observation something to be judged against. No form: waste is row
-- 11.8.1 on the monthly GMP inspection (FRM-913), which is where 11.8.1.10 asks for it.

begin;

do $guard$
declare h text; st text; rev text; p text;
begin
  select md5(content::text), status, revision, (content->'procedure')::text
    into h, st, rev, p from public.sop_documents where sop_number = 'FSQM-037';
  if (st, rev) is distinct from ('draft', 'New') or h <> '7606e0f6ff49f941fe08b75f5ffcbd73' then
    raise exception 'FSQM-037 is %/% or changed since review (md5 %).', st, rev, h;
  end if;
  if p not like '%NOT HIGH-RISK, and disposed of as ordinary waste%'
     or p not like '%HIGH-RISK, and defaced before it goes out%'
     or p not like '%PACKAGING AGREEMENT OVERRIDES%'
     or p not like '%not to a schedule%'
     or p like '%end of each run%'
     or p like '%kept covered when not in use%' then
    raise exception 'FSQM-037 is missing one of the owner''s four corrections - not issuing.';
  end if;
end $guard$;

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-09-28',
       content = content || jsonb_build_object('revision_history', (content->>'revision_history') || $t$

ISSUED 2026-09-28 - active, approved GJM, effective 2026-09-28, after the owner read the draft through and made four corrections to it: bins washed by condition rather than to a schedule, trademarked waste risk-assessed rather than destroyed wholesale, waste taken out at the end of the day rather than at the end of each run, and the covered-bins line removed. Every one of them replaced something the program asserted with something the site actually does.

WHAT CHANGES ON THE FLOOR: one thing only. Spoiled and mis-printed labels and coded cases are torn through the code and the brand before they go in the dumpster. Everything else in this program was already the practice.$t$)
 where sop_number = 'FSQM-037';

do $verify$
declare r record;
begin
  select status, approved_by, effective_date, revision, jsonb_array_length(content->'procedure') n
    into r from public.sop_documents where sop_number = 'FSQM-037';
  if (r.status, r.approved_by, r.effective_date, r.revision) is distinct from ('active', 'GJM', date '2026-09-28', 'New') then
    raise exception 'FSQM-037 did not issue: %/%/%/%', r.status, r.approved_by, r.effective_date, r.revision;
  end if;
  if r.n <> 31 then raise exception 'FSQM-037 procedure is % lines, expected 31.', r.n; end if;
end $verify$;

commit;
