-- Staff notices: a posting area in the Team Portal, with a record of who has read each post.
--
-- For D-03 (SQF 2.1.1.2): food safety objectives, results and changes have to be communicated to
-- staff, and until now that was done by word of mouth when an issue arose. Senior Site Management or
-- the SQF Practitioner posts a notice; every team member sees it on the Notifications page until
-- they tap "I have read this", and the post keeps the list of who read it and when.
--
-- A notice is never edited after it is posted, because people have put their name to having read
-- that wording. A wrong notice is withdrawn and posted again. So there are no INSERT, UPDATE or
-- DELETE policies on either table: every write goes through one of the three functions below, which
-- stamp the person and the time on the server.

begin;

create table if not exists public.staff_notices (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (length(btrim(title)) between 1 and 200),
  body          text not null check (length(btrim(body)) between 1 and 10000),
  title_es      text check (title_es is null or length(btrim(title_es)) between 1 and 200),
  body_es       text check (body_es is null or length(btrim(body_es)) between 1 and 10000),
  posted_by     uuid not null references auth.users(id),
  posted_at     timestamptz not null default now(),
  withdrawn_by  uuid references auth.users(id),
  withdrawn_at  timestamptz,
  check ((withdrawn_by is null) = (withdrawn_at is null))
);

create table if not exists public.staff_notice_reads (
  notice_id  uuid not null references public.staff_notices(id) on delete restrict,
  user_id    uuid not null references auth.users(id),
  read_at    timestamptz not null default now(),
  primary key (notice_id, user_id)
);

create index if not exists staff_notices_posted_at_idx on public.staff_notices (posted_at desc);

alter table public.staff_notices enable row level security;
alter table public.staff_notice_reads enable row level security;

-- The auditor reads notices too: they are the evidence that objectives were communicated.
drop policy if exists "Team reads staff notices" on public.staff_notices;
create policy "Team reads staff notices"
  on public.staff_notices for select to authenticated
  using (public.is_compliance_viewer(auth.uid()));

-- A person sees their own acknowledgements. Who else has read a notice comes from
-- staff_notice_readers(), which is limited to admin, owner and auditor.
drop policy if exists "People read their own notice acknowledgements" on public.staff_notice_reads;
create policy "People read their own notice acknowledgements"
  on public.staff_notice_reads for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------- post
create or replace function public.post_staff_notice(
  _title text, _body text, _title_es text default null, _body_es text default null
) returns public.staff_notices
language plpgsql security definer set search_path = public
as $$
declare result public.staff_notices;
begin
  if not (public.has_role(auth.uid(), 'admin') or public.is_owner(auth.uid())) then
    raise exception 'only an admin or the owner can post a notice';
  end if;

  insert into public.staff_notices (title, body, title_es, body_es, posted_by)
  values (btrim(_title), btrim(_body),
          nullif(btrim(coalesce(_title_es, '')), ''), nullif(btrim(coalesce(_body_es, '')), ''),
          auth.uid())
  returning * into result;

  -- The person who wrote it has read it.
  insert into public.staff_notice_reads (notice_id, user_id) values (result.id, auth.uid());
  return result;
end $$;

-- ---------------------------------------------------------------- acknowledge
create or replace function public.acknowledge_staff_notice(_notice_id uuid)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare stamped timestamptz;
begin
  if not public.is_staff_or_admin(auth.uid()) then
    raise exception 'not authorised to acknowledge notices';
  end if;
  if not exists (select 1 from public.staff_notices where id = _notice_id and withdrawn_at is null) then
    raise exception 'notice % not found, or withdrawn', _notice_id;
  end if;

  -- The first acknowledgement stands; tapping again does not move the time.
  insert into public.staff_notice_reads (notice_id, user_id) values (_notice_id, auth.uid())
  on conflict (notice_id, user_id) do nothing;

  select read_at into stamped from public.staff_notice_reads
   where notice_id = _notice_id and user_id = auth.uid();
  return stamped;
end $$;

-- ---------------------------------------------------------------- withdraw
create or replace function public.withdraw_staff_notice(_notice_id uuid)
returns public.staff_notices
language plpgsql security definer set search_path = public
as $$
declare result public.staff_notices;
begin
  if not (public.has_role(auth.uid(), 'admin') or public.is_owner(auth.uid())) then
    raise exception 'only an admin or the owner can withdraw a notice';
  end if;

  update public.staff_notices
     set withdrawn_by = auth.uid(), withdrawn_at = now()
   where id = _notice_id and withdrawn_at is null
  returning * into result;

  if result.id is null then
    raise exception 'notice % not found, or already withdrawn', _notice_id;
  end if;
  return result;
end $$;

-- ---------------------------------------------------------------- who has read what
-- One row per notice and team member: read_at is null where the person has not read it yet.
-- The team is everyone with portal access and a staff, admin or owner role - the same people the
-- notice is shown to. The kiosk account and the auditor are not asked to read notices.
create or replace function public.staff_notice_readers()
returns table (notice_id uuid, user_id uuid, full_name text, read_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not (public.has_role(auth.uid(), 'admin') or public.is_owner(auth.uid())
          or public.has_role(auth.uid(), 'auditor')) then
    raise exception 'not authorised to see who has read notices';
  end if;

  return query
  with team as (
    select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Unnamed') as full_name
      from public.profiles p
     where p.access_granted is true
       and exists (select 1 from public.user_roles r
                    where r.user_id = p.id and r.role in ('staff', 'admin', 'owner'))
  )
  select n.id, t.id, t.full_name, r.read_at
    from public.staff_notices n
    cross join team t
    left join public.staff_notice_reads r on r.notice_id = n.id and r.user_id = t.id
   order by n.posted_at desc, t.full_name;
end $$;

revoke all on function public.post_staff_notice(text, text, text, text) from public;
revoke all on function public.acknowledge_staff_notice(uuid)             from public;
revoke all on function public.withdraw_staff_notice(uuid)                from public;
revoke all on function public.staff_notice_readers()                     from public;
grant execute on function public.post_staff_notice(text, text, text, text) to authenticated;
grant execute on function public.acknowledge_staff_notice(uuid)             to authenticated;
grant execute on function public.withdraw_staff_notice(uuid)                to authenticated;
grant execute on function public.staff_notice_readers()                     to authenticated;

do $verify$
begin
  if (select count(*) from pg_policies where schemaname = 'public'
       and tablename in ('staff_notices', 'staff_notice_reads') and cmd <> 'SELECT') <> 0 then
    raise exception 'staff notices must have no write policies; writes go through the functions.';
  end if;
  if not (select bool_and(relrowsecurity) from pg_class
           where oid in ('public.staff_notices'::regclass, 'public.staff_notice_reads'::regclass)) then
    raise exception 'row level security is not on for the staff notice tables.';
  end if;
end $verify$;

commit;
