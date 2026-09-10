-- D-18 - internal_notifications becomes a feed somebody actually reads.
--
-- WHY EXTEND RATHER THAN BUILD A NEW TABLE. This table has existed since 20260129202804 with FIVE
-- writers and ZERO readers: temperature-alert, ingest-batch-sheet, generate-batch-sheet-from-pss,
-- export-batch-sheet-xlsx and PrivateLabel.tsx all insert into it and nothing has ever selected from
-- it. It is already team-wide - no user_id - which is exactly the shape 2.5.2.2 wants, because the
-- schedule names the responsible POSITION and the site has three or four people. And the temperature
-- alerts this feed must also surface are already being written here, so reading this table gets them
-- for free with no change to a deployed edge function. A second notifications table beside an unread
-- one would add a sixth writer to a table nobody reads, which is how the dormant scaffold tables
-- CLAUDE.md warns about came to exist.
--
-- WHAT is_read AND read_at ARE. Vestigial. No code has ever written either, and neither carries WHO
-- - which is the whole point of a dismissal that clears an item for the entire team. They are
-- commented rather than dropped: dropping a column that is in the generated types would break the
-- build for no gain, and repurposing them would silently change meaning for the five writers above.
--
-- DISMISSAL AND RESOLUTION ARE DIFFERENT THINGS and get different columns. A person clearing an item
-- is stamped with their name; the job closing an item because the activity was completed or the
-- temperature alert was acknowledged must NOT be, or the stamp stops being evidence that a person
-- acted. Without the machine-side column the badge count would also only ever grow.
--
-- WHY THE DEDUPE INDEX IS TOTAL, unlike temperature_alerts_open_uniq. That one is partial on
-- cleared_at IS NULL because a temperature excursion is a CONDITION that can recur on the same unit.
-- A verification due date is an OCCURRENCE: the due date is IN the key, so the next occurrence is a
-- different key by construction. Making it total is what stops the 15:00 run resurrecting what
-- somebody dismissed at 09:30. Existing rows carry NULL, and Postgres permits many NULLs in a unique
-- index, so nothing already written is affected - and temperature alerts, which have no dedupe_key,
-- keep their own dedupe in temperature_alerts where it belongs.
--
-- THE UPDATE POLICIES ARE REMOVED. Two overlapping ones exist (20260311190256 and 20260325222621),
-- and between them any staff user can rewrite any column of any row. That was harmless for a table
-- nobody read; it is wrong for one carrying a who-cleared-it stamp, because the people the stamp
-- describes could edit it. Nothing in src/ or supabase/functions/ updates this table, so removing
-- them breaks nothing. Dismissal goes through a SECURITY DEFINER function that writes exactly three
-- columns, the same shape as acknowledge_temperature_alert.

begin;

create temporary table _notif_before on commit drop as
  select count(*) as n,
         count(*) filter (where is_read) as n_read
    from public.internal_notifications;

alter table public.internal_notifications
  -- Stable identity of the thing being notified about. NULL for the five legacy writers and for
  -- temperature alerts. Verification rows use 'verification:<activity_key>:<due_on>'.
  add column if not exists dedupe_key           text,
  -- 2.5.2.2 requires the schedule to name who is responsible for each activity; this carries that
  -- label onto the notification, which is why per-user routing was rejected - the label does the
  -- work a routing table would, and it does not go stale when the roster changes.
  add column if not exists responsible_position text,
  add column if not exists due_on               date,
  add column if not exists severity             text
      check (severity is null or severity in ('info','due','overdue','alert')),
  -- [{label, href}] - internal app paths only; the page refuses anything not starting with "/".
  add column if not exists links                jsonb not null default '[]'::jsonb,
  -- A person cleared it. Stamped, and team-wide.
  add column if not exists dismissed_by         uuid references auth.users(id) on delete set null,
  add column if not exists dismissed_at         timestamptz,
  add column if not exists dismissed_note       text,
  -- The system closed it. Never stamped with a person.
  add column if not exists resolved_at          timestamptz,
  add column if not exists resolved_reason      text;

comment on column public.internal_notifications.is_read is
  'VESTIGIAL. Never written by any code since 20260129202804, and carries no actor. Use dismissed_by / dismissed_at.';
comment on column public.internal_notifications.read_at is
  'VESTIGIAL. See is_read.';
comment on column public.internal_notifications.links is
  'Array of {label, href}. Internal app paths only - src/lib/notifications.ts refuses anything else before rendering.';
comment on column public.internal_notifications.resolved_at is
  'Closed by the system because the underlying thing was done. Kept apart from dismissed_at so that a machine action never wears a person''s name.';

create unique index if not exists internal_notifications_dedupe_uniq
  on public.internal_notifications (dedupe_key);

-- The feed's own query: what is still open, newest first.
create index if not exists internal_notifications_open_idx
  on public.internal_notifications (created_at desc)
  where dismissed_at is null and resolved_at is null;

-- ---------------------------------------------------------------- dismissal
create or replace function public.dismiss_notification(
  _notification_id uuid,
  _note text default null
) returns public.internal_notifications
language plpgsql security definer set search_path = public
as $$
declare result public.internal_notifications;
begin
  if not public.is_staff_or_admin(auth.uid()) then
    raise exception 'not authorised to dismiss notifications';
  end if;

  update public.internal_notifications
     set dismissed_by   = auth.uid(),
         dismissed_at   = now(),
         dismissed_note = nullif(btrim(coalesce(_note, '')), '')
   where id = _notification_id
     and dismissed_at is null
     and resolved_at is null
  returning * into result;

  if result.id is null then
    raise exception 'notification % not found, or already cleared', _notification_id;
  end if;
  return result;
end $$;

comment on function public.dismiss_notification(uuid, text) is
  'Clears a notification for the whole team and records who did it. The only route by which a client can write to an internal_notifications row. A dismissal is NOT the verification record - the record is the form entry the notification links to.';

-- ---------------------------------------------------------------- RLS
-- SELECT and INSERT are left exactly as they are: PrivateLabel.tsx and four edge functions insert
-- here today, and the feed reads under the existing staff SELECT policy.
drop policy if exists "Only staff can update notifications" on public.internal_notifications;
drop policy if exists "Staff/admin update notifications"    on public.internal_notifications;

do $$
declare r record;
begin
  select
    (select count(*) from public.internal_notifications)                              as n,
    (select n from _notif_before)                                                     as n_before,
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'internal_notifications'
        and cmd = 'UPDATE')                                                           as upd_policies,
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'internal_notifications'
        and cmd in ('SELECT','INSERT'))                                               as keep_policies,
    (select count(*) from public.internal_notifications
      where dedupe_key is not null or dismissed_at is not null
         or resolved_at is not null or links <> '[]'::jsonb)                          as touched,
    (select count(*) from pg_indexes
      where schemaname = 'public' and indexname = 'internal_notifications_dedupe_uniq') as dedupe_idx,
    (select count(*) from pg_proc p join pg_namespace nsp on nsp.oid = p.pronamespace
      where nsp.nspname = 'public' and p.proname = 'dismiss_notification')             as fn
  into r;

  if r.n <> r.n_before then
    raise exception 'row count moved from % to %; this migration adds columns only.', r.n_before, r.n;
  end if;
  -- The stamp must not be editable by the people it describes.
  if r.upd_policies <> 0 then
    raise exception '% UPDATE policies remain; the dismissal stamp is still editable.', r.upd_policies;
  end if;
  if r.keep_policies = 0 then
    raise exception 'the SELECT/INSERT policies were removed; the five existing writers would break.';
  end if;
  -- Every pre-existing row must be inert: no dedupe key, not dismissed, not resolved, no links.
  if r.touched <> 0 then
    raise exception '% existing row(s) picked up feed state; they should all be untouched.', r.touched;
  end if;
  if r.dedupe_idx <> 1 then
    raise exception 'the dedupe index did not land; twice-daily runs would pile up duplicates.';
  end if;
  if r.fn <> 1 then
    raise exception 'dismiss_notification did not land; nothing could be cleared.';
  end if;
end $$;

commit;
