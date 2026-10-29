-- Temperature Monitoring for the auditor, and no anonymous read of the sensor readings.
--
-- The auditor role can open /team/compliance/temperature, but temperature_limits and temperature_alerts
-- were readable by staff/admin/owner only, so an auditor saw the readings without the limits they are
-- judged against or the alert log with its acknowledgements (the corrective-action record of SOP-401).
-- Both now also read for is_compliance_viewer (staff, admin, owner, auditor - not the kiosk), the rule
-- every other compliance record uses.
--
-- temperature_logs also had "Allow public read access" (USING true, role public), so anyone holding the
-- public anon key could read every reading without signing in. Nothing needs it: the Team Portal reads as
-- a signed-in compliance viewer (its own policy), the temperature-alert edge function and the YoLink logger
-- on the VPS use the service-role key, which bypasses RLS (vps/yolink-logger/README.md). It is dropped.

begin;

drop policy if exists "Allow public read access" on public.temperature_logs;

drop policy if exists "Compliance viewers read temperature limits" on public.temperature_limits;
create policy "Compliance viewers read temperature limits" on public.temperature_limits
  for select to authenticated using (public.is_compliance_viewer(auth.uid()));

drop policy if exists "Compliance viewers read temperature alerts" on public.temperature_alerts;
create policy "Compliance viewers read temperature alerts" on public.temperature_alerts
  for select to authenticated using (public.is_compliance_viewer(auth.uid()));

do $verify$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'temperature_logs' and qual = 'true') then
    raise exception 'temperature_logs is still readable by anyone.';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'temperature_logs' and policyname = 'Compliance viewers read temperature_logs') then
    raise exception 'the signed-in read of temperature_logs is missing.';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and policyname in ('Compliance viewers read temperature limits', 'Compliance viewers read temperature alerts')) <> 2 then
    raise exception 'the auditor read policies were not created.';
  end if;
end $verify$;

commit;
