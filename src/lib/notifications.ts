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
// "signature_signed" is news for the person who asked (sign_response_field writes it): nothing waits
// on it, so unlike the request it CAN be cleared.
export const FEED_TYPES = ["verification_due", "temperature_alert", "signature_requested", "signature_signed"] as const;

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
  /** Addressed to one person; null means team-wide, which every scheduled activity is. */
  assigned_to: string | null;
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
  "dedupe_key, responsible_position, assigned_to, due_on, severity, links, " +
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

/**
 * Team-wide rows, plus the ones addressed to me.
 *
 * Every notification that predates signature requests has assigned_to null and is therefore
 * unaffected: the feed stays team-wide, which is what 2.5.2.2's "responsible position" labelling
 * is for. Only a request addressed to a person is filtered, and only away from other people.
 */
function mine(query: any, userId: string | null) {
  const q = query
    .in("notification_type", FEED_TYPES as unknown as string[])
    .is("dismissed_at", null)
    .is("resolved_at", null);
  return userId ? q.or(`assigned_to.is.null,assigned_to.eq.${userId}`) : q.is("assigned_to", null);
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/** The sidebar pill. head:true so no rows cross the wire — only the count. */
export async function countOpenNotifications(): Promise<number> {
  const { count, error } = await mine(
    table().select("*", { count: "exact", head: true }), await currentUserId());
  if (error) throw error;
  return count || 0;
}

export async function fetchOpenNotifications(): Promise<AppNotification[]> {
  const { data, error } = await mine(table().select(COLUMNS), await currentUserId())
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
  // A signature request is not dismissable for the same shape of reason as a temperature alert:
  // clearing it would make the ask disappear without the signature ever being given. The ways out
  // are signing it, or the person who asked withdrawing it — neither of which is a dismissal.
  return n.notification_type !== "temperature_alert"
    && n.notification_type !== "signature_requested";
}

// ---------------------------------------------------------------- signature requests

/** Someone who can sign a verifier line: admin or owner. */
export interface Signatory { id: string; name: string }

export async function fetchSignatories(): Promise<Signatory[]> {
  const { data: roles, error } = await supabase
    .from("user_roles").select("user_id, role").in("role", ["admin", "owner"]);
  if (error) throw error;
  const ids = [...new Set((roles ?? []).map((r: any) => r.user_id as string))];
  if (!ids.length) return [];
  const { data: people } = await supabase
    // Not filtered on profiles.access_granted: that is the client portal's switch, and an admin
    // who signs in daily has it off.
    .from("profiles").select("id, full_name").in("id", ids);
  return (people ?? [])
    .map((p: any) => ({ id: p.id as string, name: (p.full_name as string) || "Unnamed" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Ask someone to review and sign a draft entry.
 *
 * Through an RPC rather than a plain insert because the table has no UPDATE policy — that is
 * deliberate, so the people a dismissal stamp describes cannot edit it — and asking twice has to
 * refresh the existing request rather than fail on the unique dedupe key.
 */
export async function requestSignature(
  responseId: string, assignedTo: string, note?: string,
): Promise<void> {
  const { error } = await (supabase as any).rpc("request_signature", {
    _response_id: responseId, _assigned_to: assignedTo, _note: note ?? null,
  });
  if (error) throw error;
}

/** Close the open request for an entry — because it was signed, or withdrawn. */
export async function resolveSignatureRequest(
  responseId: string, reason = "Signed",
): Promise<number> {
  const { data, error } = await (supabase as any).rpc("resolve_signature_request", {
    _response_id: responseId, _reason: reason,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

/** Is there an open request for this entry? Drives the entry page's button wording. */
export async function openSignatureRequest(responseId: string): Promise<AppNotification | null> {
  const { data, error } = await table()
    .select(COLUMNS)
    .eq("notification_type", "signature_requested")
    .eq("dedupe_key", `signature:${responseId}`)
    .is("resolved_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : null;
}

// ---------------------------------------------------------------- a signature from a named person
// A line with `signedBy` (FRM-952's employee acknowledgment) is asked for from one team member and
// signed from their own log-in. One request per entry AND field, so it never collides with the
// verifier request above (`signature:<entry>`): the key is `signature:<entry>:<field>`.

/**
 * Team members who can be asked: anyone with a staff, admin or owner role and a name. The role is
 * what lets them sign in to the Team Portal. `profiles.access_granted` is deliberately NOT tested -
 * it is the CLIENT portal's switch, and an admin who signs in daily has it off.
 */
export async function fetchTeamSigners(): Promise<Signatory[]> {
  const { data: roles, error } = await supabase
    .from("user_roles").select("user_id, role").in("role", ["staff", "admin", "owner"]);
  if (error) throw error;
  const ids = [...new Set((roles ?? []).map((r: any) => r.user_id as string))];
  if (!ids.length) return [];
  const { data: people, error: pErr } = await supabase
    .from("profiles").select("id, full_name").in("id", ids);
  if (pErr) throw pErr;
  return (people ?? [])
    .map((p: any) => ({ id: p.id as string, name: String(p.full_name ?? "").trim() }))
    .filter(p => p.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function requestFieldSignature(
  responseId: string, fieldId: string, assignedTo: string, note?: string,
): Promise<void> {
  const { error } = await (supabase as any).rpc("request_signature_on", {
    _response_id: responseId, _field_id: fieldId, _assigned_to: assignedTo, _note: note ?? null,
  });
  if (error) throw error;
}

/** Close the open request for one line, or (no field) for every such line of the entry. */
export async function withdrawFieldSignatureRequests(
  responseId: string, fieldId: string | null, reason: string,
): Promise<void> {
  const { error } = await (supabase as any).rpc("withdraw_signature_request_on", {
    _response_id: responseId, _field_id: fieldId, _reason: reason,
  });
  if (error) throw error;
}

/** Sign the line you were asked for. The server writes that one answer; nothing else can change. */
export async function signRequestedField(responseId: string, fieldId: string): Promise<void> {
  const { error } = await (supabase as any).rpc("sign_response_field", {
    _response_id: responseId, _field_id: fieldId,
  });
  if (error) throw error;
}

/** Open requests for this entry's named-person lines, keyed by field id. */
export async function openFieldSignatureRequests(responseId: string): Promise<Record<string, AppNotification>> {
  const prefix = `signature:${responseId}:`;
  const { data, error } = await table()
    .select(COLUMNS)
    .eq("notification_type", "signature_requested")
    .like("dedupe_key", `${prefix}%`)
    .is("resolved_at", null);
  if (error) throw error;
  const out: Record<string, AppNotification> = {};
  for (const row of data ?? []) {
    const n = normalize(row);
    if (n.dedupe_key) out[n.dedupe_key.slice(prefix.length)] = n;
  }
  return out;
}
