-- D-34 — run the temperature check every 15 minutes.
--
-- WHY THE AUTHORIZATION HEADER IS COPIED RATHER THAN WRITTEN. Calling an edge function
-- from pg_cron needs a bearer token, and this file is committed to git, so the token
-- cannot be written here. This project already has at least one cron job posting to
-- /functions/v1/, so the credential is already in cron.job. Copying it means the secret
-- stays where it already lives, and rotating it in one place rotates it for both.
--
-- If no such job exists the migration stops with an instruction rather than quietly
-- installing a schedule that 401s every fifteen minutes for the rest of the year - which
-- is the same failure this whole deliverable exists to prevent, one level up: monitoring
-- that looks like it is running and is not.

DO $$
DECLARE
  auth_header text;
  fn_url      text := 'https://zsukaixinoqmggpxxonn.supabase.co/functions/v1/temperature-alert';
  donor       text;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'pg_cron is not installed. Enable it (Database -> Extensions) and re-run.';
  END IF;

  -- Any existing job that posts to an edge function will do; take the newest.
  -- substring(), not regexp_matches(): the latter is set-returning and in a select list it
  -- multiplies rows rather than returning one capture.
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
      'No existing cron job calls an edge function with a bearer token, so there is no key to copy. Schedule this one by hand in the SQL editor (the key must not be committed to git): select cron.schedule(''temperature-alert-check'', ''*/15 * * * *'', $q$ select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer <SERVICE_ROLE_KEY>''), body := ''{}''::jsonb) $q$);',
      fn_url;
  END IF;

  RAISE NOTICE 'copying edge-function credential from cron job %', donor;

  -- Idempotent: unschedule first so re-running replaces rather than duplicates.
  PERFORM cron.unschedule('temperature-alert-check')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'temperature-alert-check');

  PERFORM cron.schedule(
    'temperature-alert-check',
    '*/15 * * * *',
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

-- Guard: the schedule must exist and must be the 15-minute one.
DO $$
DECLARE
  sched text;
BEGIN
  SELECT schedule INTO sched FROM cron.job WHERE jobname = 'temperature-alert-check';
  IF sched IS NULL THEN
    RAISE EXCEPTION 'temperature-alert-check was not scheduled';
  END IF;
  IF sched <> '*/15 * * * *' THEN
    RAISE EXCEPTION 'temperature-alert-check scheduled as %, expected */15 * * * *', sched;
  END IF;
END $$;
