-- Close the grant-never-revokes gap: assignments are now withdrawn when they stop being valid.
--
-- sync_module_training and sync_employee_training only ever INSERT. When a module is archived,
-- reverted to draft, stops being a training module, or an employee loses their team role, the
-- assignment stays. Today that had to be cleaned up by hand (migration 20260827000006 removed 17
-- such rows); nothing stopped it recurring.
--
-- TWO CLASSES OF STALENESS, AND ONLY ONE IS SAFE TO AUTOMATE.
--
--   MECHANICAL - the module is gone, or the person is not staff any more. There is no judgement in
--   it and no reading of the situation where the assignment should survive. Automated here.
--
--   SCOPE - the employee's department is no longer in the module's required_departments. That looks
--   equally mechanical and is not, because the SCOPE ITSELF MAY BE WRONG. Right now this rule would
--   revoke TRN-005 (HACCP) from the owner/CEO, whose department is Admin and who is very likely the
--   SQF practitioner - and 2.1.1.5 requires the practitioner to hold HACCP training. Automating that
--   would let a scoping choice silently remove a requirement the Code imposes. Reported, never
--   applied: see public.stale_training_report() below.
--
-- NOTHING WITH PROGRESS IS EVER TOUCHED, in either class. completed_at or progress means the person
-- did the work; the record of it is evidence under 2.9.2.3 and retention. If a completed assignment
-- ever becomes inappropriate that is a decision for a person, never a trigger.
--
-- SPANISH VARIANTS RESOLVE THROUGH THEIR ENGLISH SIBLING. An ES row deliberately carries
-- training_category = NULL (it is a content variant, not an assignable unit), so a naive
-- "training_category IS NULL means stale" rule would revoke every Spanish assignment on the site -
-- all eight of Diana's. Validity is therefore judged against the GOVERNING module: the EN row
-- sharing module_number, or the row itself when it is not an ES variant.

begin;

-- The governing module for an assignment: the EN sibling for an ES variant, else the row itself.
create or replace function public.governing_training_module(p_sop_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
           when d.title like '%(ES)%' then (
             select e.id from public.sop_documents e
              where e.module_number is not null
                and e.module_number = d.module_number
                and e.title not like '%(ES)%'
              limit 1)
           else d.id
         end
    from public.sop_documents d
   where d.id = p_sop_id;
$$;

-- Withdraw assignments that are stale for MECHANICAL reasons only.
create or replace function public.revoke_stale_training(p_employee_id uuid default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
DECLARE
  v_removed integer;
BEGIN
  WITH doomed AS (
    SELECT ta.id
      FROM public.training_assignments ta
      JOIN public.sop_documents d ON d.id = ta.sop_id
      LEFT JOIN public.sop_documents gov
             ON gov.id = public.governing_training_module(ta.sop_id)
     WHERE (p_employee_id IS NULL OR ta.employee_id = p_employee_id)
       -- never touch work that was started or finished
       AND ta.completed_at IS NULL
       AND ta.progress IS NULL
       AND (
             -- an ES variant whose EN sibling has gone: nothing governs it any more
             gov.id IS NULL
             -- the module is no longer published
          OR gov.status <> 'active'
             -- the module is no longer a training module at all
          OR gov.training_category IS NULL
             -- the person no longer holds a role that receives training
          OR NOT EXISTS (
               SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = ta.employee_id
                  AND ur.role IN ('owner', 'admin', 'staff'))
       )
  )
  DELETE FROM public.training_assignments ta
   USING doomed
   WHERE ta.id = doomed.id;

  GET DIAGNOSTICS v_removed = ROW_COUNT;
  RETURN v_removed;
END;
$$;

-- Report - never acts. Every assignment that is stale for ANY reason, mechanical or scope, with the
-- reason named. This is what to read before deciding whether a scope mismatch means the assignment
-- is wrong or the scope is.
create or replace function public.stale_training_report()
returns table (
  employee_id uuid,
  employee text,
  department text,
  module text,
  module_title text,
  is_spanish boolean,
  reason text,
  auto_revoked boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  SELECT ta.employee_id,
         COALESCE(p.full_name, 'User ' || left(p.id::text, 8)),
         p.department,
         COALESCE(gov.sop_number, d.sop_number, '-'),
         d.title,
         (d.title LIKE '%(ES)%'),
         CASE
           WHEN gov.id IS NULL              THEN 'no governing module'
           WHEN gov.status <> 'active'      THEN 'module is ' || gov.status
           WHEN gov.training_category IS NULL THEN 'not a training module'
           WHEN NOT EXISTS (SELECT 1 FROM public.user_roles ur
                             WHERE ur.user_id = ta.employee_id
                               AND ur.role IN ('owner','admin','staff'))
                                            THEN 'no team role'
           ELSE 'department out of scope'
         END,
         -- scope mismatches are reported but never revoked automatically
         (gov.id IS NULL OR gov.status <> 'active' OR gov.training_category IS NULL
          OR NOT EXISTS (SELECT 1 FROM public.user_roles ur
                          WHERE ur.user_id = ta.employee_id
                            AND ur.role IN ('owner','admin','staff')))
    FROM public.training_assignments ta
    JOIN public.sop_documents d ON d.id = ta.sop_id
    JOIN public.profiles p ON p.id = ta.employee_id
    LEFT JOIN public.sop_documents gov
           ON gov.id = public.governing_training_module(ta.sop_id)
   WHERE ta.completed_at IS NULL
     AND ta.progress IS NULL
     AND (
           gov.id IS NULL
        OR gov.status <> 'active'
        OR gov.training_category IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.user_roles ur
                        WHERE ur.user_id = ta.employee_id
                          AND ur.role IN ('owner','admin','staff'))
        OR (gov.required_departments IS NOT NULL
            AND (p.department IS NULL
                 OR NOT (p.department = ANY (gov.required_departments))))
     )
   ORDER BY 2, 4;
$$;

grant execute on function public.stale_training_report() to authenticated;

-- Wire the revoke into both sync paths, so grant and revoke happen together from now on.
create or replace function public.trg_sync_training_on_module_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
BEGIN
  PERFORM public.sync_module_training(NEW.id);
  -- and withdraw anything this change just made mechanically invalid
  PERFORM public.revoke_stale_training(NULL);
  RETURN NEW;
END;
$$;

do $$
declare
  bad text;
  n_stale int;
  n_auto int;
begin
  select string_agg(x, '; ') into bad from (
    select 'governing_training_module missing' as x where not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='governing_training_module')
    union all
    select 'revoke_stale_training missing' where not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='revoke_stale_training')
    union all
    select 'stale_training_report missing' where not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='stale_training_report')
    union all
    select 'the module trigger no longer calls sync_module_training' where not (
      select pg_get_functiondef(p.oid) like '%sync_module_training%'
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='trg_sync_training_on_module_change')
    union all
    select 'the module trigger does not call revoke_stale_training' where not (
      select pg_get_functiondef(p.oid) like '%revoke_stale_training%'
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='trg_sync_training_on_module_change')
    union all
    -- the department rule must NOT be in the revoking function; only in the report
    select 'revoke_stale_training must not act on department scope' where (
      select pg_get_functiondef(p.oid) like '%required_departments%'
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='revoke_stale_training')
  ) t;

  if bad is not null then
    raise exception 'revoke wiring did not apply cleanly: %', bad;
  end if;

  -- Run the mechanical pass once, now. It should find nothing: 20260827000006 already cleared the
  -- 17 rows by hand, and everything else is either valid or a scope mismatch this will not touch.
  select public.revoke_stale_training(null) into n_auto;
  if n_auto <> 0 then
    raise warning 'revoked % mechanically stale assignment(s) on first run', n_auto;
  end if;

  select count(*) into n_stale from public.stale_training_report();
  raise notice 'stale_training_report(): % row(s) need a human decision (department scope)', n_stale;
end $$;

commit;

-- WHAT IS DEFERRED, and why it is not a bug in this migration:
--
--   select * from public.stale_training_report() where not auto_revoked;
--
-- returns ten assignments whose employee's department is outside the module's scope - eight of them
-- the owner/CEO's, including TRN-005 HACCP. Before revoking any of those, settle the scope: if the
-- SQF practitioner sits in Admin, then TRN-005 (and arguably TRN-004 and TRN-006) should include
-- Admin rather than the practitioner losing the requirement. Fix the scope first, re-read the
-- report, and only then clear whatever genuinely remains out of scope.
