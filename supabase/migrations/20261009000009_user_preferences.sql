-- public.user_preferences: a person's own settings for the app, one row per setting.
--
-- Owner's request, 2026-10-09: a form's helper text can be hidden, and the choice has to follow
-- the PERSON, not the tablet - two people share one tablet, and one person uses several devices.
-- He asked for the table to serve later per-person settings too, so it is a plain key and a JSON
-- value rather than a column per setting: a new setting is a new key, and needs no migration.
--
--   key    what the setting is, namespaced by its owner in the code ("form.helpHidden:<document id>")
--   value  whatever that setting stores (a list of field ids, a flag, an object)
--
-- THESE ARE CONVENIENCES, NEVER RECORDS. Nothing in here is evidence of anything, nothing reads
-- another person's row, and losing a row only puts a screen back to its default. So a person may
-- read, write and delete their own rows and nobody else's - admins included, who have no reason
-- to see how somebody arranges their screen.
--
-- The entrance tablet's account (role kiosk) is kept out, in keeping with the rule that it has no
-- table access at all.
--
-- Safe to run twice.

create table if not exists public.user_preferences (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  key        text        not null,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key),
  constraint user_preferences_key_shape check (char_length(key) between 1 and 200),
  -- A setting, not a store: one value stays small.
  constraint user_preferences_value_size check (pg_column_size(value) <= 16384)
);

comment on table public.user_preferences is
  'A person''s own app settings, one row per key (value is JSON). Conveniences only, never records: each person reads and writes their own rows and nobody else''s.';

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own on public.user_preferences
  for select to authenticated
  using (user_id = auth.uid() and not public.has_role(auth.uid(), 'kiosk'));

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own on public.user_preferences
  for insert to authenticated
  with check (user_id = auth.uid() and not public.has_role(auth.uid(), 'kiosk'));

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own on public.user_preferences
  for update to authenticated
  using (user_id = auth.uid() and not public.has_role(auth.uid(), 'kiosk'))
  with check (user_id = auth.uid() and not public.has_role(auth.uid(), 'kiosk'));

drop policy if exists user_preferences_delete_own on public.user_preferences;
create policy user_preferences_delete_own on public.user_preferences
  for delete to authenticated
  using (user_id = auth.uid() and not public.has_role(auth.uid(), 'kiosk'));

revoke all on public.user_preferences from anon;
grant select, insert, update, delete on public.user_preferences to authenticated;

drop trigger if exists user_preferences_touch on public.user_preferences;
create trigger user_preferences_touch
  before update on public.user_preferences
  for each row execute function public.touch_updated_at();
