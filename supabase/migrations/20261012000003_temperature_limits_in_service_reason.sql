-- temperature_limits.in_service_reason: why a unit was last placed in or out of service.
--
-- SOP-401 Part 7: "Only the SQF Practitioner places a unit in or out of service, in the Team
-- App, recording the reason." The app had the switch (in_service) and the date
-- (in_service_changed_at) but nowhere for the reason, so it went into Notes, or nowhere. The
-- Limits editor now asks for it whenever the switch is moved and refuses to save without it,
-- and the FRM-401 fill from the temperature logs carries it into the month's "Units placed in
-- or out of service" row. One column, the last reason only - the review record is where the
-- history lives, and sop_document_history keeps the review.
--
-- Until this is pushed the app folds the reason into Notes instead (undefined-column fallback
-- in src/lib/temperatureAlerts.ts), so the state change is recordable either way.

alter table public.temperature_limits
  add column if not exists in_service_reason text;

comment on column public.temperature_limits.in_service_reason is
  'Why the unit was last placed in or out of service (SOP-401 Part 7). Written by the Limits editor with in_service_changed_at; read by the FRM-401 fill.';
