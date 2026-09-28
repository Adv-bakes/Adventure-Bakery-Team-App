-- D-33: issue FSQM-035 Receipt, Storage and Handling Program.
--
-- Owner, 2026-09-28: the dry storage room layout map is attached (task 33.1), so the program issues.
-- active, GJM, 2026-09-28, revision New (first issue). Guarded on the md5 of the content as reviewed - the
-- draft plus the owner's two rounds of corrections (20260922000003, 20260922000004). The md5 EXCLUDES
-- attachments, because the owner is adding files as this is written (the PDF map and its draw.io
-- source); a separate check requires a PDF still to be attached, since the program's text points at it.
--
-- D-33 STAYS WIP: the chemical locker is not bought, so chemicals are still unlocked near the sink.

begin;

do $guard$
declare h text; st text; n int;
begin
  select md5((content - 'attachments')::text), status,
         (select count(*) from jsonb_array_elements(coalesce(content->'attachments', '[]')) a
           where lower(a->>'name') like '%.pdf')
    into h, st, n from public.sop_documents where sop_number = 'FSQM-035';
  if st is distinct from 'draft' or h <> '627144be08ce570e4a6f562bf9e07652' then
    raise exception 'FSQM-035 is % or changed since review (md5 %).', st, h;
  end if;
  if n < 1 then raise exception 'FSQM-035 has no PDF attachment - expected the layout map.'; end if;
end $guard$;

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-09-28',
       content = content || jsonb_build_object('revision_history', (content->>'revision_history') || $t$

ISSUED 2026-09-28 - the dry storage room layout map (task 33.1) is attached, which was the last thing this program waited on. D-33 STAYS WIP: the chemical locker is not yet bought, so chemicals still stand unlocked on the cleaning supplies shelf by the sink, which 11.6.4.2 does not accept.$t$)
 where sop_number = 'FSQM-035';

do $verify$
declare r record;
begin
  select status, approved_by, effective_date, revision,
         (select count(*) from jsonb_array_elements(content->'attachments') a
           where lower(a->>'name') like '%layout%.pdf') att,
         jsonb_array_length(content->'procedure') n,
         content->'attachments'->0->>'name' map
    into r from public.sop_documents where sop_number = 'FSQM-035';
  if (r.status, r.approved_by, r.effective_date, r.revision) is distinct from ('active', 'GJM', date '2026-09-28', 'New') then
    raise exception 'FSQM-035 did not issue: %/%/%/%', r.status, r.approved_by, r.effective_date, r.revision;
  end if;
  if r.att < 1 or r.n <> 31 then
    raise exception 'FSQM-035 layout map missing or content changed (% pdf maps, % lines).', r.att, r.n;
  end if;
end $verify$;

commit;
