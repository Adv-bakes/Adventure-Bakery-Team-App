-- A team invite that grants a training-bearing role must name a department.
--
-- Since 20260827000005 scoped eight modules to departments, the grant predicate is
--     (required_departments IS NULL OR p.department = ANY(required_departments))
-- so an employee with no department matches only the nine ALL STAFF modules. They receive none of
-- their job-specific training and their record shows them fully compliant. Before the scoping that
-- was harmless; now it is a silent failure that looks like success, which is the worst shape a
-- compliance defect can take.
--
-- It is reachable on the DEFAULT PATH, not an edge case: the invite dialog opens with role "staff"
-- and department "— None —" (HrDirectory.tsx), so sending an invite without touching the department
-- selector produces exactly this. Empty string, not NULL - the RPC already normalises it with
-- NULLIF(trim(...), '') - so a `department IS NOT NULL` check elsewhere would not have caught it.
--
-- Two guards are added:
--
--   1. A training-bearing role (owner, admin, staff) requires a department. Those three are exactly
--      the roles sync_module_training and sync_employee_training gate on, so they are exactly the
--      people who receive training. auditor and user receive none, and a department on an auditor
--      would be actively wrong - they are read-only observers, not staff.
--
--   2. The department must be one the app actually offers. A typo ("Producton") is not caught by a
--      NOT NULL check and fails the same silent way: = ANY(...) simply never matches. The list
--      mirrors DEPARTMENTS in src/lib/training.ts; if a department is ever added there, add it here
--      too or invites for it will be rejected.
--
-- WHAT THIS DOES NOT CLOSE. Roles can also be granted directly from the member detail page, which
-- writes user_roles without going through this RPC (TeamMemberDetail.tsx). Promoting an existing
-- auditor to staff therefore bypasses this guard entirely. That path is covered by the "missing
-- department" warning added to the HR directory in the same change, which surfaces the condition
-- rather than preventing it. Blocking it properly means a constraint or trigger on user_roles, and
-- that is a larger decision than this.
--
-- Nothing about existing data changes: all three current staff/admin/owner profiles already carry a
-- department, so there is nothing to backfill and no invitation in flight to invalidate.

create or replace function public.create_team_invitation(_email text, _role text, _department text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_token text;
  v_dept  text := NULLIF(trim(_department), '');
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins or owners can invite team members';
  END IF;
  IF _role NOT IN ('owner', 'admin', 'staff', 'auditor', 'user') THEN
    RAISE EXCEPTION 'Invalid role: %', _role;
  END IF;
  IF _role IN ('owner', 'admin') AND NOT public.is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only an owner can invite an owner or admin';
  END IF;

  -- Roles that receive training must say which department, or their job-specific modules are
  -- never assigned and the gap is invisible.
  IF _role IN ('owner', 'admin', 'staff') AND v_dept IS NULL THEN
    RAISE EXCEPTION 'A department is required when inviting a % — training is assigned by '
                    'department, so without one this person receives only the all-staff modules '
                    'and appears fully trained.', _role;
  END IF;

  -- A department the app does not offer matches no module, failing exactly as silently as none.
  IF v_dept IS NOT NULL
     AND v_dept NOT IN ('Production', 'Sourcing', 'Quality Control', 'Admin', 'R&D', 'Sales') THEN
    RAISE EXCEPTION 'Unknown department: %. Valid departments are Production, Sourcing, '
                    'Quality Control, Admin, R&D, Sales.', v_dept;
  END IF;

  INSERT INTO public.client_invitations (email, invited_by, invite_kind, role, department)
  VALUES (lower(trim(_email)), auth.uid(), 'team', _role, v_dept)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$function$;

do $$
declare
  src text;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_team_invitation';

  if src is null then
    raise exception 'create_team_invitation is missing after the replace';
  end if;
  if src not like '%A department is required when inviting%' then
    raise exception 'the department guard is not present in create_team_invitation';
  end if;
  if src not like '%Unknown department%' then
    raise exception 'the department whitelist is not present in create_team_invitation';
  end if;
  -- the original authorisation checks must survive the rewrite
  if src not like '%Only admins or owners can invite team members%'
     or src not like '%Only an owner can invite an owner or admin%' then
    raise exception 'the rewrite dropped an authorisation check';
  end if;
  if src not like '%SECURITY DEFINER%' then
    raise exception 'create_team_invitation is no longer SECURITY DEFINER';
  end if;
end $$;

-- No staff/admin/owner profile may already be missing a department. This is a check, not a fix:
-- if it ever fires, the right response is to set the department on the person, not to relax it.
do $$
declare
  n int;
  who text;
begin
  select count(*), string_agg(coalesce(p.full_name, p.id::text), ', ')
    into n, who
    from public.profiles p
   where exists (select 1 from public.user_roles ur
                  where ur.user_id = p.id and ur.role in ('owner', 'admin', 'staff'))
     and nullif(trim(coalesce(p.department, '')), '') is null;

  if n > 0 then
    raise warning 'ATTENTION: % team member(s) hold a training-bearing role with no department and '
                  'will receive only the all-staff modules: %. Set their department in the HR '
                  'directory.', n, who;
  end if;
end $$;
