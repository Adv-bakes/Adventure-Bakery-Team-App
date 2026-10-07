-- Staff notices: "the team" is everyone with a staff, admin or owner role - not profiles.access_granted.
--
-- Same mistake as 20261007000008, found the same day. Three functions took "the team" to be people
-- with a team role AND profiles.access_granted. That flag is the CLIENT portal's access switch; a
-- team member signs in on their role. An admin who signs in daily has it off, and so was missing
-- from the tick list for a private note, could not be addressed one, and was left off every read
-- list - while being able to read the notices all along (the read policy never tested the flag).
--
-- Only that condition is removed from staff_notice_team, post_staff_notice and
-- staff_notice_readers; everything else is as pushed in 20261006000006. Effect on existing
-- notices to the whole team: anyone previously left out now appears on their read lists as not
-- yet read, which is the truth.

begin;

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
   where exists (select 1 from public.user_roles r
                  where r.user_id = p.id and r.role in ('staff', 'admin', 'owner'))
   order by 2;
end $$;

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
                          where p.id = u
                            and exists (select 1 from public.user_roles r
                                         where r.user_id = p.id and r.role in ('staff', 'admin', 'owner')))
    ) then
      raise exception 'a notice can only be addressed to a team member';
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
     where exists (select 1 from public.user_roles r
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

do $verify$
declare n int;
begin
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname in ('staff_notice_team', 'post_staff_notice', 'staff_notice_readers')
     and p.prosecdef and position('access_granted' in p.prosrc) = 0;
  if n <> 3 then raise exception 'expected the three notice functions replaced and free of access_granted, found %.', n; end if;
  if (select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'post_staff_notice') <> 1 then
    raise exception 'post_staff_notice has more than one version.';
  end if;
end $verify$;

commit;
