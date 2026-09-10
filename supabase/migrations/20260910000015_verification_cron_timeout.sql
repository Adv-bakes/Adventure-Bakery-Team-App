-- D-18 - give the verification job longer than pg_net's five-second default.
--
-- WHAT WENT WRONG, AND IT IS THE FAILURE MODE THIS WHOLE FEATURE EXISTS TO PREVENT. net.http_post
-- defaults to timeout_milliseconds = 5000. The verification job resolves the schedule, then reads
-- the latest submission for each evidence form, then writes notifications - and on 2026-09-10 the
-- 19:00 UTC run crossed five seconds and was cut off. net._http_response recorded
-- "Timeout of 5000 ms reached"; nothing was written; and cron.job still showed a job that had run
-- on schedule. A monitoring job that fails while continuing to look healthy is exactly what D-34's
-- no_data alert was built to catch, and it would have been quietly true here twice a day.
--
-- TWO FIXES, BECAUSE ONE IS NOT ENOUGH. The function itself was collapsed from roughly ten
-- sequential round trips to one query for every form's latest submission, which is the real repair.
-- This migration is the belt to that pair of braces: even a fast function should not be sitting one
-- slow cold start away from silently writing nothing. 30 seconds is well inside the edge function's
-- own wall-clock limit and far outside anything this job should ever need.
--
-- 20260910000014 IS ALREADY APPLIED and its filename is immutable, so the schedule is replaced here
-- rather than edited there. cron.schedule upserts by name, so re-registering the same jobname with a
-- new command is the supported way to change it.
--
-- The bearer token is copied out of the existing job rather than written, for the reason
-- 20260908000002 gives: this file is committed to git and the service-role key must not be. Here
-- the donor is the job being replaced, so the credential never changes hands.

DO $$
DECLARE
  auth_header text;
  fn_url      text := 'https://zsukaixinoqmggpxxonn.supabase.co/functions/v1/verification-notifications';
  sched       text := '0 11,19 * * *';
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'pg_cron is not installed.';
  END IF;

  SELECT substring(command from 'Bearer\s+([A-Za-z0-9._\-]+)')
    INTO auth_header
    FROM cron.job
   WHERE jobname = 'verification-notifications-check';

  IF auth_header IS NULL THEN
    RAISE EXCEPTION
      'verification-notifications-check is not scheduled, or carries no bearer token. Apply 20260910000014 first.';
  END IF;

  PERFORM cron.unschedule('verification-notifications-check');

  PERFORM cron.schedule(
    'verification-notifications-check',
    sched,
    format(
      $q$select net.http_post(
           url := %L,
           headers := jsonb_build_object(
             'Content-Type', 'application/json',
             'Authorization', 'Bearer %s'),
           body := '{}'::jsonb,
           timeout_milliseconds := 30000) $q$,
      fn_url, auth_header)
  );
END $$;

-- Guard: the schedule must survive unchanged AND the timeout must actually be in the command.
DO $$
DECLARE r record;
BEGIN
  SELECT schedule, command INTO r FROM cron.job
   WHERE jobname = 'verification-notifications-check';

  IF r.schedule IS NULL THEN
    RAISE EXCEPTION 'verification-notifications-check was lost while being replaced';
  END IF;
  IF r.schedule <> '0 11,19 * * *' THEN
    RAISE EXCEPTION 'schedule is now %, expected 0 11,19 * * *', r.schedule;
  END IF;
  IF r.command NOT LIKE '%timeout_milliseconds := 30000%' THEN
    RAISE EXCEPTION 'the timeout did not make it into the command; the job would still cut off at 5s';
  END IF;
  IF r.command NOT LIKE '%Bearer %' THEN
    RAISE EXCEPTION 'the bearer token was lost; the job would 401 twice a day';
  END IF;
END $$;
