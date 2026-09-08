-- D-34 Temperature-Controlled Storage — the two tables the alerting needs.
--
-- WHY. Three YoLink sensors have logged temperature_logs since 2026-06-24 and
-- /team/compliance/temperature displays them, but nothing anywhere records what "good"
-- means, what happens when it isn't, or that a human looked. SQF 11.6.2.3 wants a written
-- procedure covering the frequency of checks AND the corrective action taken when a
-- temperature is out of specification; of its four obligations the sensors satisfy one
-- ("records kept").
--
-- The site has 3-4 staff, so the answer is not another daily clipboard check. It is an
-- alert that watches continuously and a record of what was done when it fired. These two
-- tables are the limits it judges against and the log of what it found.
--
-- WHY NO-DATA IS A FIRST-CLASS ALERT KIND. There were three gaps in logging in the first
-- ten weeks, the longest 3 days 2 hours, and nobody noticed. An alert that only fires on a
-- bad READING would have been silent through every one of them - a dead sensor reads as
-- perfect compliance. Absence of data is the failure mode this design exists for.

-- ---------------------------------------------------------------- limits

CREATE TABLE IF NOT EXISTS public.temperature_limits (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Joins to temperature_logs.equipment_name, which the VPS logger sets from its
  -- DEVICE_MAPPING (vps/yolink-logger/main.py). Free text on both sides, so it is unique
  -- here and must match the mapping exactly.
  equipment_name        text NOT NULL UNIQUE,
  device_id             text,
  -- 'storage' is judged against a limit; 'ambient' never is. The Bakery Floor sensor is
  -- environmental monitoring, not a storage unit, and gets a row precisely so that a
  -- reader who sees three sensors and two limits is told why rather than left to guess.
  kind                  text NOT NULL DEFAULT 'storage' CHECK (kind IN ('storage', 'ambient')),
  -- A storage unit holding no food can be taken out of service; its readings are then not
  -- judged. This is how the freezer is issued - it holds no product since the vegan burger
  -- line was discontinued and may be switched off entirely - and it means the document
  -- survives that decision going either way.
  in_service            boolean NOT NULL DEFAULT true,
  min_f                 numeric,
  max_f                 numeric,
  -- Hours without a reading before a no_data alert opens. Sensors report roughly hourly.
  stale_hours           integer NOT NULL DEFAULT 6 CHECK (stale_hours > 0),
  notify_emails         text[] NOT NULL DEFAULT '{}',
  notes                 text,
  in_service_changed_at timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- An in-service storage unit with no upper limit cannot be judged, so the alerting would
  -- silently skip it while the register showed it as monitored. Refusing the row is better
  -- than monitoring that quietly does nothing.
  CONSTRAINT temperature_limits_storage_needs_max
    CHECK (kind <> 'storage' OR in_service = false OR max_f IS NOT NULL)
);

COMMENT ON TABLE public.temperature_limits IS
  'Per-unit temperature limits for SOP-401. One row per sensor in temperature_logs, keyed by equipment_name. Only kind=storage AND in_service rows are alerted on.';

-- ---------------------------------------------------------------- alerts

CREATE TABLE IF NOT EXISTS public.temperature_alerts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_name     text NOT NULL,
  kind               text NOT NULL CHECK (kind IN ('out_of_range', 'no_data', 'low_battery')),
  opened_at          timestamptz NOT NULL DEFAULT now(),
  -- Worst reading seen while open: °F for out_of_range, hours stale for no_data, battery
  -- level 1-4 for low_battery. One column because only one is ever meaningful per kind.
  worst_value        numeric,
  trigger_reading_at timestamptz,
  cleared_at         timestamptz,
  last_notified_at   timestamptz,
  notify_count       integer NOT NULL DEFAULT 0,
  acknowledged_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at    timestamptz,
  action_taken       text,
  details            jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.temperature_alerts IS
  'One row per temperature excursion, opened and closed by the temperature-alert edge function. Acknowledged through acknowledge_temperature_alert(); no client may INSERT, UPDATE or DELETE. This is the record the periodic review reads.';

-- THE COOLDOWN, enforced by the database rather than by the function. At most one OPEN
-- alert per unit per kind, so a unit that sits warm for six hours produces one alert and
-- one email, not twenty-four. Doing this as a partial unique index rather than a check in
-- the function means two overlapping cron runs cannot both open one.
CREATE UNIQUE INDEX IF NOT EXISTS temperature_alerts_open_uniq
  ON public.temperature_alerts (equipment_name, kind)
  WHERE cleared_at IS NULL;

CREATE INDEX IF NOT EXISTS temperature_alerts_opened_idx
  ON public.temperature_alerts (opened_at DESC);

-- ---------------------------------------------------------------- acknowledgement

-- An alert nobody acknowledged is a notification; an acknowledged alert is a record, and
-- the record is the point - it is what shows an auditor that the site noticed and
-- responded. SECURITY DEFINER so staff can write exactly these three columns and nothing
-- else: there is deliberately no UPDATE policy on the table, so cleared_at, opened_at and
-- worst_value cannot be edited from the app by anyone, including an admin.
CREATE OR REPLACE FUNCTION public.acknowledge_temperature_alert(
  _alert_id uuid,
  _action_taken text
) RETURNS public.temperature_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.temperature_alerts;
BEGIN
  IF NOT public.is_staff_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorised to acknowledge temperature alerts';
  END IF;

  IF _action_taken IS NULL OR btrim(_action_taken) = '' THEN
    RAISE EXCEPTION 'an acknowledgement must say what was done';
  END IF;

  -- Re-acknowledging would overwrite the first responder's account of what they did, so
  -- the first acknowledgement stands. A later correction is a new alert or a note on the
  -- monthly review, not a silent edit of the original.
  UPDATE public.temperature_alerts
     SET acknowledged_by = auth.uid(),
         acknowledged_at = now(),
         action_taken    = btrim(_action_taken)
   WHERE id = _alert_id
     AND acknowledged_at IS NULL
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'alert % not found, or already acknowledged', _alert_id;
  END IF;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.acknowledge_temperature_alert(uuid, text) IS
  'Records who responded to a temperature alert and what they did. The only way a client can write to temperature_alerts.';

-- ---------------------------------------------------------------- RLS

ALTER TABLE public.temperature_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temperature_alerts ENABLE ROW LEVEL SECURITY;

-- Limits: staff read them (they are quoted in SOP-401 and shown on the report page);
-- admin or owner change them, because changing a limit changes what compliance means.
DROP POLICY IF EXISTS "Staff read temperature limits" ON public.temperature_limits;
CREATE POLICY "Staff read temperature limits"
  ON public.temperature_limits FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins write temperature limits" ON public.temperature_limits;
CREATE POLICY "Admins write temperature limits"
  ON public.temperature_limits FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_owner(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Alerts: staff read. NO insert/update/delete policy at all - the edge function writes
-- with the service-role key, and acknowledgement goes through the function above. Same
-- append-only shape as admin_account_actions, and for the same reason: a record that the
-- people it describes can rewrite is not evidence.
DROP POLICY IF EXISTS "Staff read temperature alerts" ON public.temperature_alerts;
CREATE POLICY "Staff read temperature alerts"
  ON public.temperature_alerts FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- ---------------------------------------------------------------- seed

-- Names must match vps/yolink-logger/main.py DEVICE_MAPPING exactly.
INSERT INTO public.temperature_limits
  (equipment_name, device_id, kind, in_service, min_f, max_f, stale_hours, notes)
VALUES
  ('Walk-In Refrigerator', 'd88b4c010010b5da', 'storage', true, NULL, 41, 6,
   'Holds butter, liquid eggs and other TCS ingredients. 41 °F is the upper limit; at 41 passes, above 41 fails. The unit has never exceeded 41 °F in the logged history.'),
  ('Walk-In Freezer', 'd88b4c010010b513', 'storage', false, NULL, 10, 6,
   'OUT OF SERVICE: holds no product since the vegan burger line was discontinued, and may be switched off. Readings are not judged against the limit while out of service. Return to service requires SOP-401 Part 7.'),
  ('Bakery Floor', 'd88b4c010010b70a', 'ambient', false, NULL, NULL, 6,
   'Ambient production-area monitoring, not a storage unit. No temperature limit applies and no alert is raised. Recorded here so that the third sensor is accounted for rather than looking like a unit somebody forgot to set a limit on.')
ON CONFLICT (equipment_name) DO NOTHING;

-- Guard: the seed must have produced exactly the three sensors the logger writes, and the
-- refrigerator - the only unit actually in service - must be alertable.
DO $$
DECLARE
  n_units int;
  n_alertable int;
BEGIN
  SELECT count(*) INTO n_units FROM public.temperature_limits;
  SELECT count(*) INTO n_alertable FROM public.temperature_limits
   WHERE kind = 'storage' AND in_service AND max_f IS NOT NULL;

  IF n_units <> 3 THEN
    RAISE EXCEPTION 'expected 3 temperature_limits rows, found %', n_units;
  END IF;
  IF n_alertable <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 alertable unit (the refrigerator), found %', n_alertable;
  END IF;
END $$;
