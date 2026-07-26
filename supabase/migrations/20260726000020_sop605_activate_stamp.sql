-- SOP-605 (Flow Wrapper — S350X Rotary Pillow Packer) — activate and stamp approval metadata.
--
-- Transition the draft row to active and stamp it like the rest of the equipment docs:
-- effective_date 2026-06-01, approved_by 'GJM' (see 20260726000010/12/14/16/18).
--
-- Snapshot note: the sop_documents_history trigger fires WHEN old.status='active'. Here old.status is
-- 'draft', so this activation does NOT create a history row (this is the first active version).
--
-- Idempotent: guarded so re-running is a no-op once the row is already active/stamped.

update public.sop_documents
set status         = 'active',
    effective_date = date '2026-06-01',
    approved_by    = 'GJM'
where sop_number = 'SOP-605'
  and (status is distinct from 'active'
       or effective_date is distinct from date '2026-06-01'
       or approved_by is distinct from 'GJM');

insert into supabase_migrations.schema_migrations (version, name)
values ('20260726000020', 'sop605_activate_stamp')
on conflict (version) do nothing;
