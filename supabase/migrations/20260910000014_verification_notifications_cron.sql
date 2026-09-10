-- D-18 - raise due verification activities twice a day.
--
-- THE AUTHORIZATION HEADER IS COPIED, NOT WRITTEN, for the reason 20260908000002 gives: this file is
-- committed to git and the service-role key must not be. The donor is temperature-alert-check, which
-- has run every 15 minutes since 2026-09-08, so the credential already sits in cron.job and rotating
-- it in one place rotates it for both. If that job has been unscheduled, this migration stops with
-- copy-paste instructions rather than quietly installing a schedule that 401s twice a day.
--
-- WHY TWICE DAILY IS SAFE. The function is idempotent per (activity, due date): the unique index
-- internal_notifications_dedupe_uniq means the afternoon run cannot re-raise what the morning run
-- raised, and because that index is TOTAL rather than partial on dismissal, it cannot resurrect what
-- somebody cleared in between. The second run exists so an activity that falls due mid-morning, or a
-- retention sample whose FRM-703 draft is created at lunchtime, is not sat on until tomorrow.
--
-- THE UTC HOURS ARE A DECISION, NOT A DEFAULT. pg_cron schedules in UTC and has no idea daylight
-- saving exists. The site is US Eastern, so a fixed expression drifts an hour twice a year and the
-- only question is which hour it drifts to:
--
--     11:00 UTC = 06:00 EST (winter) / 07:00 EDT (summer)
--     19:00 UTC = 14:00 EST (winter) / 15:00 EDT (summer)
--
-- 10:00/18:00 would read more naturally as "6am and 2pm" in summer, but puts the winter morning run
-- at 05:00 local - before anyone is on site, and hours before the first person could act on it.
-- These two keep BOTH runs inside the working day all year, which matters more than either being
-- exactly on the hour intended.
--
-- THIS AND SITE_TZ ARE ONE DECISION MADE TWICE. supabase/functions/verification-notifications/
-- index.ts computes "today" in America/New_York to decide what is due. If the site timezone ever
-- changes, change both together: a job firing at 07:00 local while the function believes it is
-- already tomorrow would raise every activity a day early, every day, and nothing would look broken.
--
-- PUSH THIS LAST. It POSTs to an edge function; if verification-notifications has not been deployed
-- yet, this schedules a 404 twice a day.

DO $$
DECLARE
  auth_header text;
  fn_url      text := 'https://zsukaixinoqmggpxxonn.supabase.co/functions/v1/verification-notifications';
  sched       text := '0 11,19 * * *';
  donor       text;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'pg_cron is not installed. Enable it (Database -> Extensions) and re-run.';
  END IF;

  -- Any existing job that posts to an edge function will do; take the newest.
  SELECT jobname,
         substring(command from 'Bearer\s+([A-Za-z0-9._\-]+)')
    INTO donor, auth_header
    FROM cron.job
   WHERE command LIKE '%/functions/v1/%'
     AND command ~ 'Bearer\s+[A-Za-z0-9._\-]+'
   ORDER BY jobid DESC
   LIMIT 1;

  IF auth_header IS NULL THEN
    RAISE EXCEPTION
      'No existing cron job calls an edge function with a bearer token, so there is no key to copy. Schedule this one by hand in the SQL editor (the key must not be committed to git): select cron.schedule(''verification-notifications-check'', %L, $q$ select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer <SERVICE_ROLE_KEY>''), body := ''{}''::jsonb) $q$);',
      sched, fn_url;
  END IF;

  RAISE NOTICE 'copying edge-function credential from cron job %', donor;

  -- Idempotent: unschedule first so re-running replaces rather than duplicates.
  PERFORM cron.unschedule('verification-notifications-check')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'verification-notifications-check');

  PERFORM cron.schedule(
    'verification-notifications-check',
    sched,
    format(
      $q$select net.http_post(
           url := %L,
           headers := jsonb_build_object(
             'Content-Type', 'application/json',
             'Authorization', 'Bearer %s'),
           body := '{}'::jsonb) $q$,
      fn_url, auth_header)
  );
END $$;

-- Guard: the schedule must exist and must be the twice-daily one.
DO $$
DECLARE sched text;
BEGIN
  SELECT schedule INTO sched FROM cron.job WHERE jobname = 'verification-notifications-check';
  IF sched IS NULL THEN
    RAISE EXCEPTION 'verification-notifications-check was not scheduled';
  END IF;
  IF sched <> '0 11,19 * * *' THEN
    RAISE EXCEPTION 'verification-notifications-check scheduled as %, expected 0 11,19 * * *', sched;
  END IF;
END $$;
