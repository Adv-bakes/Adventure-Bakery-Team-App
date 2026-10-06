-- Staff notices: a notice can be addressed to named people instead of the whole team.
--
-- The owner's request (2026-10-06): post a note to one team member, or to several, and keep it
-- private. Until now every notice went to everyone.
--
--   - staff_notices.audience is 'team' (as before, and the default) or 'people'.
--   - staff_notice_recipients holds who a 'people' notice is for.
--   - A 'people' notice is seen only by its recipients, the person who posted it, and admin / owner
--     (who can withdraw it and see who has read it). The auditor does not see it, and neither does
--     the rest of the team.
--   - Only a recipient is asked to read it, and the read list shows only the recipients.
--
-- The audience is a column, not "has recipient rows", so an addressed notice can never turn into a
-- notice to everyone because a row went missing.
--
-- Like the rest of staff notices, the new table has no write policy: post_staff_notice writes the
-- recipients in the same transaction as the notice. A notice is still never edited, so its
-- recipients are never changed either.
--
-- post_staff_notice gains a fifth argument with a default. The four-argument function is dropped
-- rather than kept beside it, because two functions that both accept the same four named arguments
-- cannot be told apart when called through the API. The app as deployed today calls it with four
-- arguments and keeps working.

begin;

alter table public.staff_notices
  add column if not exists audience text not null default 'team'
  check (audience in ('team', 'people'));

create table if not exists public.staff_notice_recipients (
  notice_id  uuid not null references public.staff_notices(id) on delete restrict,
  user_id    uuid not null references auth.users(id),
  primary key (notice_id, user_id)
);
create index if not exists staff_notice_recipients_user_idx on public.staff_notice_recipients (user_id);

alter table public.staff_notice_recipients enable row level security;

-- Used by the policy below. SECURITY DEFINER so the check does not depend on what the caller may
-- read in the recipients table.
create or replace function public.is_staff_notice_recipient(_notice_id uuid, _user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.staff_notice_recipients
                  where notice_id = _notice_id and user_id = _user_id);
$$;

-- A person sees the rows that name them; admin and owner see them all.
drop policy if exists "People read their own notice recipient rows" on public.staff_notice_recipients;
create policy "People read their own notice recipient rows"
  on public.staff_notice_recipients for select to authenticated
  using (user_id = auth.uid()
         or public.has_role(auth.uid(), 'admin') or public.is_owner(auth.uid()));

-- A notice to the team is read as before. An addressed notice is private.
drop policy if exists "Team reads staff notices" on public.staff_notices;
create policy "Team reads staff notices"
  on public.staff_notices for select to authenticated
  using (
    (audience = 'team' and public.is_compliance_viewer(auth.uid()))
    or (audience = 'people' and (
          posted_by = auth.uid()
          or public.has_role(auth.uid(), 'admin') or public.is_owner(auth.uid())
          or public.is_staff_notice_recipient(id, auth.uid())))
  );

-- ---------------------------------------------------------------- the team, for the picker
-- The same people a notice to the team is shown to: portal access and a staff, admin or owner role.
create or replace function public.staff_notice_team()
returns table (user_id uuid, full_name text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not (public.has_role(auth.uid(), 'admin') or public.is_owner(auth.uid())) then
    raise exception 'only an admin or the owner can address a notice';
  end if;
  return query
  select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Unnamed')
    from public.profiles p
   where p.access_granted is true
     and exists (select 1 from public.user_roles r
                  where r.user_id = p.id and r.role in ('staff', 'admin', 'owner'))
   order by 2;
end $$;

-- ---------------------------------------------------------------- post
drop function if exists public.post_staff_notice(text, text, text, text);

create or replace function public.post_staff_notice(
  _title text, _body text, _title_es text default null, _body_es text default null,
  _recipients uuid[] default null
) returns public.staff_notices
language plpgsql security definer set search_path = public
as $$
declare
  result public.staff_notices;
  people uuid[];
begin
  if not (public.has_role(auth.uid(), 'admin') or public.is_owner(auth.uid())) then
    raise exception 'only an admin or the owner can post a notice';
  end if;

  -- No recipients means the whole team. An empty list is refused rather than read as "everyone":
  -- a private note must never go to the team by accident.
  if _recipients is not null then
    select array_agg(distinct u) into people from unnest(_recipients) u where u is not null;
    if people is null then
      raise exception 'choose at least one person, or post the notice to the whole team';
    end if;
    if exists (
      select 1 from unnest(people) u
       where not exists (select 1 from public.profiles p
                          where p.id = u and p.access_granted is true
                            and exists (select 1 from public.user_roles r
                                         where r.user_id = p.id and r.role in ('staff', 'admin', 'owner')))
    ) then
      raise exception 'a notice can only be addressed to a team member with access to the portal';
    end if;
  end if;

  insert into public.staff_notices (title, body, title_es, body_es, posted_by, audience)
  values (btrim(_title), btrim(_body),
          nullif(btrim(coalesce(_title_es, '')), ''), nullif(btrim(coalesce(_body_es, '')), ''),
          auth.uid(), case when people is null then 'team' else 'people' end)
  returning * into result;

  if people is not null then
    insert into public.staff_notice_recipients (notice_id, user_id)
    select result.id, u from unnest(people) u;
  end if;

  -- The person who wrote it has read it.
  insert into public.staff_notice_reads (notice_id, user_id) values (result.id, auth.uid());
  return result;
end $$;

-- ---------------------------------------------------------------- acknowledge
-- Unchanged, except that an addressed notice can only be acknowledged by someone it is addressed to.
create or replace function public.acknowledge_staff_notice(_notice_id uuid)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  stamped timestamptz;
  who text;
begin
  if not public.is_staff_or_admin(auth.uid()) then
    raise exception 'not authorised to acknowledge notices';
  end if;
  select audience into who from public.staff_notices where id = _notice_id and withdrawn_at is null;
  if who is null then
    raise exception 'notice % not found, or withdrawn', _notice_id;
  end if;
  if who = 'people' and not public.is_staff_notice_recipient(_notice_id, auth.uid()) then
    raise exception 'notice % is not addressed to you', _notice_id;
  end if;

  -- The first acknowledgement stands; tapping again does not move the time.
  insert into public.staff_notice_reads (notice_id, user_id) values (_notice_id, auth.uid())
  on conflict (notice_id, user_id) do nothing;

  select read_at into stamped from public.staff_notice_reads
   where notice_id = _notice_id and user_id = auth.uid();
  return stamped;
end $$;

-- ---------------------------------------------------------------- who has read what
-- A notice to the team: one row per team member, as before. An addressed notice: one row per
-- recipient, and it is left out altogether for the auditor, who does not see private notes.
create or replace function public.staff_notice_readers()
returns table (notice_id uuid, user_id uuid, full_name text, read_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare manages boolean := public.has_role(auth.uid(), 'admin') or public.is_owner(auth.uid());
begin
  if not (manages or public.has_role(auth.uid(), 'auditor')) then
    raise exception 'not authorised to see who has read notices';
  end if;

  return query
  with team as (
    select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Unnamed') as full_name
      from public.profiles p
     where p.access_granted is true
       and exists (select 1 from public.user_roles r
                    where r.user_id = p.id and r.role in ('staff', 'admin', 'owner'))
  ),
  asked as (
    select n.id as notice_id, n.posted_at, t.id as user_id, t.full_name
      from public.staff_notices n cross join team t
     where n.audience = 'team'
    union all
    select n.id, n.posted_at, c.user_id, coalesce(nullif(btrim(p.full_name), ''), 'Unnamed')
      from public.staff_notices n
      join public.staff_notice_recipients c on c.notice_id = n.id
      left join public.profiles p on p.id = c.user_id
     where n.audience = 'people' and manages
  )
  select a.notice_id, a.user_id, a.full_name, r.read_at
    from asked a
    left join public.staff_notice_reads r on r.notice_id = a.notice_id and r.user_id = a.user_id
   order by a.posted_at desc, a.full_name;
end $$;

revoke all on function public.post_staff_notice(text, text, text, text, uuid[]) from public;
revoke all on function public.staff_notice_team()                               from public;
revoke all on function public.is_staff_notice_recipient(uuid, uuid)             from public;
grant execute on function public.post_staff_notice(text, text, text, text, uuid[]) to authenticated;
grant execute on function public.staff_notice_team()                               to authenticated;
grant execute on function public.is_staff_notice_recipient(uuid, uuid)             to authenticated;

do $verify$
begin
  if (select count(*) from pg_policies where schemaname = 'public'
       and tablename in ('staff_notices', 'staff_notice_reads', 'staff_notice_recipients')
       and cmd <> 'SELECT') <> 0 then
    raise exception 'staff notices must have no write policies; writes go through the functions.';
  end if;
  if not (select bool_and(relrowsecurity) from pg_class
           where oid in ('public.staff_notices'::regclass, 'public.staff_notice_reads'::regclass,
                         'public.staff_notice_recipients'::regclass)) then
    raise exception 'row level security is not on for the staff notice tables.';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'post_staff_notice') <> 1 then
    raise exception 'there must be exactly one post_staff_notice function.';
  end if;
  if exists (select 1 from public.staff_notices where audience <> 'team') then
    raise exception 'every notice posted before this migration is a notice to the team.';
  end if;
end $verify$;

commit;
