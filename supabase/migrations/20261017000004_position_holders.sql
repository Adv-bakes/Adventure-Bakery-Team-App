-- Who holds each FSQM-004 position (owner, 2026-10-17).
--
-- FSQM-004 describes positions and names nobody, so nothing in the app said who the Production
-- Supervisor is, or therefore who covers Receiving. This keeps the people beside the document:
-- one row per person per position, with a history - a holder who gives a position up is ENDED,
-- never deleted, so "who held it on that date" stays answerable.
--
-- The two SQF Practitioner positions are not kept here: the designation in force is FRM-005's.
--
-- No write policies. set_position_holder (admin/owner) stamps who made each change and when.
-- Read: anyone internal, and the auditor (is_compliance_viewer).

create table if not exists public.position_holders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id),
  position    text not null check (position in (
                'senior_site_management', 'production_supervisor', 'production_operator',
                'receiving', 'administration', 'maintenance')),
  started_at  timestamptz not null default now(),
  started_by  uuid,
  ended_at    timestamptz,
  ended_by    uuid
);

create unique index if not exists position_holders_current
  on public.position_holders (user_id, position) where ended_at is null;

alter table public.position_holders enable row level security;

drop policy if exists "position holders are readable internally" on public.position_holders;
create policy "position holders are readable internally" on public.position_holders
  for select using (public.is_staff_or_admin(auth.uid()) or public.is_compliance_viewer(auth.uid()));

create or replace function public.set_position_holder(_user uuid, _position text, _holds boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.has_role(auth.uid(), 'admin') or public.is_owner(auth.uid())) then
    raise exception 'Only an admin or the owner can change who holds a position.';
  end if;
  if not exists (select 1 from public.user_roles where user_id = _user and role in ('staff', 'admin', 'owner')) then
    raise exception 'Positions are held by team members only.';
  end if;
  if _holds then
    insert into public.position_holders (user_id, position, started_by)
    values (_user, _position, auth.uid())
    on conflict (user_id, position) where ended_at is null do nothing;
  else
    update public.position_holders
       set ended_at = now(), ended_by = auth.uid()
     where user_id = _user and position = _position and ended_at is null;
  end if;
end $$;
