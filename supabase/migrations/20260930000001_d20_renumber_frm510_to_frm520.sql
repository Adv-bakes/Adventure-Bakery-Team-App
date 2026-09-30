-- D-20: renumber the Production Lot Record FRM-510 -> FRM-520 (owner, 2026-09-30).
--
-- FRM-510 read too close to FRM-501 (Formula Sheet & Batch Data): the owner opened FRM-501 looking for the
-- daily lot record. Both FRM-510 and FSQM-021 are still DRAFT, FRM-510 has no entries, and FSQM-021 is the
-- only document that names it (9 mentions), so the renumber is a plain text swap. FRM-520 is not used or
-- reserved in the remediation workbook.
-- Guarded on the md5 of both documents as merged in 20260929000005 (attachments excluded).

begin;

do $guard$
declare h text; st text;
begin
  if exists (select 1 from public.sop_documents where sop_number = 'FRM-520') then
    raise exception 'FRM-520 already exists.';
  end if;
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FSQM-021';
  if st is distinct from 'draft' or h <> 'be55206c7362c3686860237a1ca19449' then
    raise exception 'FSQM-021 is % or changed since it was drafted (md5 %).', st, h;
  end if;
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FRM-510';
  if st is distinct from 'draft' or h <> 'bceb97f79b113f326247104c6df35301' then
    raise exception 'FRM-510 is % or changed since it was drafted (md5 %).', st, h;
  end if;
  if exists (select 1 from public.sop_document_responses r join public.sop_documents d on d.id = r.document_id
              where d.sop_number = 'FRM-510') then
    raise exception 'FRM-510 has entries - they pinned its number; do not renumber.';
  end if;
  if exists (select 1 from public.sop_documents where sop_number not in ('FSQM-021', 'FRM-510')
              and content::text like '%FRM-510%') then
    raise exception 'another document names FRM-510.';
  end if;
end $guard$;

update public.sop_documents set sop_number = 'FRM-520' where sop_number = 'FRM-510' and status = 'draft';

update public.sop_documents
   set content = replace(content::text, 'FRM-510', 'FRM-520')::jsonb
 where sop_number = 'FSQM-021' and status = 'draft';

update public.sop_documents
   set content = jsonb_set(content, '{revision_history}', to_jsonb((content->>'revision_history') || $t$

RENUMBERED 2026-09-30: the Production Lot Record is FRM-520, not FRM-510, so it is not mistaken for FRM-501 Formula Sheet & Batch Data.$t$))
 where sop_number = 'FSQM-021' and status = 'draft';

do $verify$
begin
  if not exists (select 1 from public.sop_documents where sop_number = 'FRM-520' and title = 'Production Lot Record')
     or exists (select 1 from public.sop_documents where sop_number = 'FRM-510') then
    raise exception 'FRM-510 was not renumbered to FRM-520.';
  end if;
  -- the revision-history stamp names the old number on purpose, so it is excluded
  if exists (select 1 from public.sop_documents where (content - 'revision_history')::text like '%FRM-510%') then
    raise exception 'a document still names FRM-510.';
  end if;
  if (select content::text from public.sop_documents where sop_number = 'FSQM-021') not like '%RENUMBERED 2026-09-30%' then
    raise exception 'FSQM-021 revision history was not stamped.';
  end if;
end $verify$;

commit;
