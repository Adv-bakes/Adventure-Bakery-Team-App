// The in-app notification feed (D-18).
//
// internal_notifications has existed since 20260129202804 and, until this feature, had five writers
// and no reader at all. The columns this module depends on — dedupe_key, responsible_position,
// due_on, severity, links, dismissed_by/at, resolved_at — were added by
// 20260910000013_internal_notifications_feed.sql and are NOT in the generated Database types until
// someone regenerates them, so every query here goes through `(supabase as any)`. The casts are
// confined to this file, the same arrangement src/lib/temperatureAlerts.ts uses for
// temperature_limits / temperature_alerts; callers only see the typed wrappers below.

import { supabase } from "@/integrations/supabase/client";

/**
 * Which notification_types belong in the feed.
 *
 * An allowlist, not a denylist, and that is the whole point of it. Four of the five writers that
 * predate this feature — ingest-batch-sheet, generate-batch-sheet-from-pss, export-batch-sheet-xlsx
 * and PrivateLabel.tsx — write operational chatter that was never meant to be read by staff as a
 * to-do list. A denylist would quietly admit each new writer as it appeared; this way a new type
 * shows up only when somebody decides it should. If you add a writer and it does not appear on the
 * page, this is the line to change.
 */
export const FEED_TYPES = ["verification_due", "temperature_alert"] as const;

export type NotificationLink = { label: string; href: string };

export type AppNotification = {
  id: string;
  created_at: string;
  notification_type: string;
  reference_id: string | null;
  reference_table: string | null;
  title: string;
  message: string | null;
  dedupe_key: string | null;
  responsible_position: string | null;
  due_on: string | null;
  severity: "info" | "due" | "overdue" | "alert" | null;
  links: NotificationLink[];
  dismissed_by: string | null;
  dismissed_at: string | null;
  dismissed_note: string | null;
  resolved_at: string | null;
  resolved_reason: string | null;
};

const table = () => (supabase as any).from("internal_notifications");

const COLUMNS =
  "id, created_at, notification_type, reference_id, reference_table, title, message, " +
  "dedupe_key, responsible_position, due_on, severity, links, " +
  "dismissed_by, dismissed_at, dismissed_note, resolved_at, resolved_reason";

/**
 * Links are written by a service-role edge function and rendered as anchors, so they are checked
 * before use rather than trusted. Same-origin app paths only: a leading slash, and not "//", which
 * a browser reads as a protocol-relative URL to another host.
 */
export function isInternalHref(href: unknown): href is string {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//");
}

function normalize(row: Record<string, unknown>): AppNotification {
  const raw = Array.isArray(row.links) ? row.links : [];
  const links = raw
    .filter((l): l is NotificationLink =>
      !!l && typeof l === "object" &&
      typeof (l as NotificationLink).label === "string" &&
      isInternalHref((l as NotificationLink).href))
    .map((l) => ({ label: l.label, href: l.href }));
  return { ...(row as unknown as AppNotification), links };
}

/** The sidebar pill. head:true so no rows cross the wire — only the count. */
export async function countOpenNotifications(): Promise<number> {
  const { count, error } = await table()
    .select("*", { count: "exact", head: true })
    .in("notification_type", FEED_TYPES as unknown as string[])
    .is("dismissed_at", null)
    .is("resolved_at", null);
  if (error) throw error;
  return count || 0;
}

export async function fetchOpenNotifications(): Promise<AppNotification[]> {
  const { data, error } = await table()
    .select(COLUMNS)
    .in("notification_type", FEED_TYPES as unknown as string[])
    .is("dismissed_at", null)
    .is("resolved_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalize);
}

/** Recently cleared, however it was cleared. The attribution is the point of showing it. */
export async function fetchClearedNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await table()
    .select(COLUMNS)
    .in("notification_type", FEED_TYPES as unknown as string[])
    .or("dismissed_at.not.is.null,resolved_at.not.is.null")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(normalize);
}

/**
 * Clears an item for the whole team and records who did it.
 *
 * Goes through the RPC because there is no UPDATE policy on the table — deliberately, so that the
 * people a dismissal stamp describes cannot edit it. The note is optional: unlike
 * acknowledge_temperature_alert, where the sentence IS the corrective-action record, here the record
 * is the form entry the notification links to, so demanding prose would only teach people to type
 * "done".
 */
export async function dismissNotification(id: string, note?: string): Promise<void> {
  const { error } = await (supabase as any).rpc("dismiss_notification", {
    _notification_id: id,
    _note: note?.trim() ? note.trim() : null,
  });
  if (error) throw error;
}

export const SEVERITY_LABEL: Record<string, string> = {
  overdue: "Overdue",
  due: "Due",
  alert: "Alert",
  info: "For information",
};

/**
 * Temperature notifications carry no Dismiss button, and this is the function that says so.
 *
 * Clearing one would make the badge go away without the SOP-401 corrective-action record ever being
 * written — turning the feed into a way of SKIPPING the obligation rather than a prompt towards it.
 * They are closed by the job once the underlying alert is acknowledged (with its action-taken
 * sentence) or clears on its own, and the card links to the temperature page instead.
 */
export function isDismissable(n: AppNotification): boolean {
  return n.notification_type !== "temperature_alert";
}
