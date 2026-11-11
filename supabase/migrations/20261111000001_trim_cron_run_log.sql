-- Trim pg_cron's run log and keep it trimmed.
--
-- cron.job_run_details records every run of every scheduled job and nothing ever cleared it. With
-- process-email-queue running every minute since March it had grown to 501 MB, about two-thirds of
-- the database (found 2026-11-11, the day the project stalled and had to be restarted). The log is
-- only used to check that a job ran (VERIFICATION_NOTIFICATIONS.md), and a week of it is plenty.
--
-- Touches only cron.job_run_details: no record, form entry or document is affected. Safe to run
-- again: the delete is a no-op once trimmed, and cron.schedule updates a job of the same name.
-- The space is reused by the table as it refills; it is not handed back to the disk.

delete from cron.job_run_details
where start_time < now() - interval '7 days';

-- Every night at 03:30 UTC (the stage-2 draft clean-up runs at 03:00).
select cron.schedule(
  'trim-cron-run-log',
  '30 3 * * *',
  $$ delete from cron.job_run_details where start_time < now() - interval '7 days' $$
);

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'trim-cron-run-log' and active) then
    raise exception 'trim-cron-run-log was not scheduled';
  end if;
end $$;
