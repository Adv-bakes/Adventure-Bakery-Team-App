// Supabase access for the D-34 temperature alerting tables.
//
// `temperature_limits` and `temperature_alerts` are not in the generated Database types
// (same as `temperature_logs`, `inventory_tolling` and `sop_document_responses`), so every
// `as any` cast the two tables need is confined to this file and the rest of the app sees
// real types — the pattern `formResponses.ts` already uses.

import { supabase } from "@/integrations/supabase/client";

export type UnitKind = "storage" | "ambient";
export type AlertKind = "out_of_range" | "no_data" | "low_battery";

export type TemperatureLimit = {
  id: string;
  equipment_name: string;
  device_id: string | null;
  kind: UnitKind;
  in_service: boolean;
  min_f: number | null;
  max_f: number | null;
  stale_hours: number;
  notify_emails: string[] | null;
  notes: string | null;
  in_service_changed_at: string | null;
  updated_at: string;
};

export type TemperatureAlert = {
  id: string;
  equipment_name: string;
  kind: AlertKind;
  opened_at: string;
  worst_value: number | null;
  trigger_reading_at: string | null;
  cleared_at: string | null;
  last_notified_at: string | null;
  notify_count: number;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  action_taken: string | null;
  details: { summary?: string; detail?: string; limits?: string } | null;
};

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  out_of_range: "Out of range",
  no_data: "No data",
  low_battery: "Low battery",
};

/** How the alert's single numeric column reads, which differs per kind. */
export function formatWorstValue(a: TemperatureAlert): string {
  if (a.worst_value === null) return "—";
  if (a.kind === "out_of_range") return `${Number(a.worst_value).toFixed(1)} °F`;
  if (a.kind === "no_data") return `${Number(a.worst_value).toFixed(1)} h stale`;
  return `battery ${a.worst_value}/4`;
}

/** One-line statement of a unit's limits, matching the wording the edge function emails. */
export function limitText(l: TemperatureLimit): string {
  if (l.kind === "ambient") return "No limit — ambient monitoring";
  if (!l.in_service) return "Out of service";
  const parts: string[] = [];
  if (l.min_f !== null) parts.push(`at or above ${l.min_f} °F`);
  if (l.max_f !== null) parts.push(`at or below ${l.max_f} °F`);
  return parts.join(" and ") || "No limit set";
}

export async function fetchTemperatureLimits(): Promise<TemperatureLimit[]> {
  const { data, error } = await supabase
    .from("temperature_limits" as any)
    .select("*")
    .order("kind", { ascending: true })
    .order("equipment_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as TemperatureLimit[];
}

/** Open alerts first, then recently closed ones — the order the review reads them in. */
export async function fetchTemperatureAlerts(limit = 50): Promise<TemperatureAlert[]> {
  const { data, error } = await supabase
    .from("temperature_alerts" as any)
    .select("*")
    .order("opened_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as TemperatureAlert[];
  return rows.sort((a, b) => {
    const openDiff = Number(!!a.cleared_at) - Number(!!b.cleared_at);
    if (openDiff !== 0) return openDiff;
    return b.opened_at.localeCompare(a.opened_at);
  });
}

export type LimitPatch = Partial<
  Pick<TemperatureLimit, "in_service" | "min_f" | "max_f" | "stale_hours" | "notify_emails" | "notes">
>;

export async function updateTemperatureLimit(
  id: string,
  patch: LimitPatch,
  opts: { markInServiceChange?: boolean } = {},
): Promise<TemperatureLimit> {
  const { data: auth } = await supabase.auth.getUser();
  const payload: Record<string, unknown> = {
    ...patch,
    updated_at: new Date().toISOString(),
    updated_by: auth?.user?.id ?? null,
  };
  // SOP-401 Part 7 turns on when a unit last changed state — return to service requires it
  // to hold at or below the limit for 24 hours before food goes in, and that clock has to
  // start somewhere readable.
  if (opts.markInServiceChange) payload.in_service_changed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("temperature_limits" as any)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as TemperatureLimit;
}

/**
 * Record who responded to an alert and what they did.
 *
 * Goes through a SECURITY DEFINER function rather than an UPDATE because
 * `temperature_alerts` has no UPDATE policy at all: opened_at, worst_value and cleared_at
 * are written only by the edge function, so the record cannot be edited after the fact by
 * the people it describes. The function also refuses a second acknowledgement, so the
 * first responder's account of what they did is not overwritten.
 */
export async function acknowledgeTemperatureAlert(
  alertId: string,
  actionTaken: string,
): Promise<TemperatureAlert> {
  const { data, error } = await supabase.rpc("acknowledge_temperature_alert" as any, {
    _alert_id: alertId,
    _action_taken: actionTaken,
  });
  if (error) throw error;
  return data as unknown as TemperatureAlert;
}
