import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type EmailSendStatus = "sent" | "failed" | "not_configured";

/**
 * Best-effort durable audit of an outbound-email attempt into
 * public.email_send_log. Invitation/notification emails otherwise leave no
 * trace beyond the ~24h edge-function logs, so a silent delivery failure
 * (e.g. an unverified Resend domain) is untraceable after a day.
 *
 * Uses a service-role client (bypasses RLS — the table grants service_role ALL)
 * created from the standard SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars
 * that every edge function has. Intentionally NEVER throws: a missing log row is
 * harmless, but a logging failure must never break the email path. Call it
 * without awaiting-and-caring, or await it — either is safe.
 */
export async function logEmailSend(
  templateName: string,
  status: EmailSendStatus,
  fields: {
    recipient: string;
    messageId?: string | null;
    error?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return;
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await admin.from("email_send_log").insert({
      template_name: templateName,
      recipient_email: fields.recipient,
      status,
      message_id: fields.messageId ?? null,
      error_message: fields.error ?? null,
      metadata: fields.metadata ?? {},
    });
  } catch (e) {
    console.error("email_send_log insert failed:", e);
  }
}
