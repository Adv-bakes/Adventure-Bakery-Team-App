-- Sanitation-forms consolidation — activate + stamp the two daily/periodic records, archive the
-- retired form. Follow-up to 20260727000001/2/3 (which deployed the consolidated schemas as drafts).
--
-- FRM-903 (Daily Sanitation, Pre-Operation & Release Record) and FRM-901 (Master Sanitation Schedule,
-- reslimmed) are activated and stamped like the rest of the compliance docs: effective_date 2026-06-01,
-- approved_by 'GJM'. FRM-904 (GMP Daily Operation Check, empty) is now retired — its purpose lives in
-- FRM-903 section 5 — so it is archived. FRM-902 (Sanitation Verification Log) is DELIBERATELY LEFT AS
-- A DRAFT: Adventure Bakery does not run swab verification yet, so the form stays parked until a swab
-- program exists (confirmed 2026-07-27).
--
-- Snapshot note: the sop_documents_history trigger fires WHEN old.status='active'. FRM-901/FRM-903 are
-- currently 'draft' (set by the prior migrations), so activating them does NOT snapshot — the prior
-- active schemas were already snapshotted when 20260727000001/3 ran. Archiving FRM-904 (old.status=
-- 'active', status is a watched field) DOES snapshot it, preserving the retired row.
--
-- Idempotent: each update is guarded so re-running is a no-op once the rows are in the target state.

-- Activate + stamp FRM-903 and FRM-901.
update public.sop_documents
set status         = 'active',
    effective_date = date '2026-06-01',
    approved_by    = 'GJM'
where sop_number in ('FRM-903', 'FRM-901')
  and (status is distinct from 'active'
       or effective_date is distinct from date '2026-06-01'
       or approved_by is distinct from 'GJM');

-- Archive the retired FRM-904 (absorbed into FRM-903).
update public.sop_documents
set status = 'archived'
where sop_number = 'FRM-904'
  and status is distinct from 'archived';

insert into supabase_migrations.schema_migrations (version, name)
values ('20260727000004', 'sanitation_forms_activate_stamp')
on conflict (version) do nothing;
