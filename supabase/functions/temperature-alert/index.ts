// D-34 — the temperature check that runs instead of a daily clipboard round.
//
// Invoked by pg_cron every 15 minutes. For each in-service storage unit in
// temperature_limits it looks at the tail of temperature_logs and decides whether an
// excursion is open, and emails + records it when the answer changes.
//
// THREE ALERT KINDS, and the second is the one that matters most:
//
//   out_of_range  the latest TWO consecutive readings are outside the unit's limits. Two,
//                 not one, because a walk-in door held open while somebody carries butter
//                 out will spike a single reading and should not page anyone at 3am.
//   no_data       nothing has been logged for longer than stale_hours. Logging stopped
//                 three times in the first ten weeks - once for 3 days 2 hours - and
//                 nobody noticed, because a dead sensor reads as perfect compliance. This
//                 is the failure mode the whole design exists for.
//   low_battery   the sensor is reporting low battery, which is how no_data starts.
//
// Deduplication is a partial unique index in the database (one open alert per unit per
// kind), not a check here, so two overlapping runs cannot both open one.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmailSend } from "../_shared/emailLog.ts";
import {
  assess, limitText,
  type AlertKind, type Limit, type Reading,
} from "../_shared/temperatureRules.ts";

const TEMPLATE = "temperature-alert";
const FROM = "AB Team App <scale@mail.adventurebakery.info>";
const REPLY_TO = "scale@adventurebakery.info";
const APP_URL = "https://team.adventurebakes.com/team/compliance/temperature";

// An open, unacknowledged alert is re-sent this often. Without it, one missed email means a
// walk-in sits warm indefinitely while the system considers itself to have done its job.
const RENOTIFY_HOURS = 24;

// Readings to pull per unit, newest first. Sensors report roughly hourly; two are needed for
// the consecutive-reading rule and the third makes the tail legible in the function logs.
const TAIL = 3;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function emailHtml(title: string, detail: string, opened: string, resolved: boolean) {
  const accent = resolved ? "#5C7A4A" : "#A33B3B";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;">
  <tr><td align="center" style="padding-bottom:28px;">
    <span style="font-size:22px;font-weight:700;color:#3d2e1e;letter-spacing:-0.5px;">Adventure Bakery</span>
  </td></tr>
  <tr><td style="background:#f5f0e8;border-radius:12px;padding:36px 32px;border-left:4px solid ${accent};">
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.6px;">
      ${resolved ? "Resolved" : "Temperature alert"}</p>
    <h1 style="margin:0 0 14px;font-size:20px;font-weight:700;color:#3d2e1e;">${title}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#3d2e1e;">${detail}</p>
    <p style="margin:0 0 20px;font-size:13px;color:#7a6555;">Alert opened ${opened}</p>
    ${resolved ? "" : `<p style="margin:0 0 4px;font-size:13px;color:#7a6555;">
      SOP-401 requires the corrective action to be recorded. Open the alert and say what you did:</p>
    <p style="margin:0;"><a href="${APP_URL}" style="display:inline-block;background:#C89B3C;color:#fff;
      text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:6px;">
      Acknowledge in the Team App</a></p>`}
  </td></tr>
  <tr><td align="center" style="padding-top:20px;">
    <p style="margin:0;font-size:12px;color:#b0a090;">Adventure Bakery · automated temperature monitoring</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "Supabase env not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = Date.now();
  const summary = { checked: 0, opened: 0, cleared: 0, notified: 0, skipped: 0, errors: [] as string[] };

  try {
    const { data: limitRows, error: limErr } = await admin
      .from("temperature_limits")
      .select("id, equipment_name, kind, in_service, min_f, max_f, stale_hours, notify_emails");
    if (limErr) throw limErr;

    const limits = ((limitRows ?? []) as Limit[])
      .filter(l => l.kind === "storage" && l.in_service);
    summary.skipped = (limitRows?.length ?? 0) - limits.length;

    // Fallback recipients: every admin/owner account. Falling back to the people who run
    // the site means alerting works the moment this is deployed, rather than after
    // somebody remembers to fill in an email column.
    let fallback: string[] = [];
    {
      const { data: roleRows } = await admin
        .from("user_roles").select("user_id").in("role", ["admin", "owner"]);
      const ids = (roleRows ?? []).map((r: any) => r.user_id).filter(Boolean);
      if (ids.length) {
        const { data: profs } = await admin
          .from("profiles").select("email").in("id", ids);
        fallback = (profs ?? []).map((p: any) => p.email)
          .filter((e: string | null): e is string => !!e);
      }
      fallback = Array.from(new Set(fallback));
    }

    for (const lim of limits) {
      summary.checked++;

      const { data: tailRows, error: tailErr } = await admin
        .from("temperature_logs")
        .select("created_at, temperature_fahrenheit, temperature_celsius, battery_level, low_battery_alarm")
        .eq("equipment_name", lim.equipment_name)
        .order("created_at", { ascending: false })
        .limit(TAIL);
      if (tailErr) { summary.errors.push(`${lim.equipment_name}: ${tailErr.message}`); continue; }

      const findings = assess(lim, (tailRows ?? []) as Reading[], now);
      const liveKinds = new Set(findings.map(f => f.kind));

      const { data: openRows, error: openErr } = await admin
        .from("temperature_alerts")
        .select("id, kind, opened_at, worst_value, last_notified_at, notify_count, acknowledged_at")
        .eq("equipment_name", lim.equipment_name)
        .is("cleared_at", null);
      if (openErr) { summary.errors.push(`${lim.equipment_name}: ${openErr.message}`); continue; }
      const open = new Map<string, any>((openRows ?? []).map((r: any) => [r.kind, r]));

      const recipients = (lim.notify_emails?.length ? lim.notify_emails : fallback)
        .filter(Boolean);

      // --- open new alerts, or re-notify ones still live and unacknowledged
      for (const f of findings) {
        const existing = open.get(f.kind);

        if (!existing) {
          const { data: made, error: insErr } = await admin
            .from("temperature_alerts")
            .insert({
              equipment_name: lim.equipment_name,
              kind: f.kind,
              worst_value: f.worstValue,
              trigger_reading_at: f.triggerAt,
              details: { summary: f.summary, detail: f.detail, limits: limitText(lim) },
            })
            .select("id, opened_at")
            .single();
          // A unique-violation here means a concurrent run opened it first, which is the
          // index doing its job - not an error worth reporting.
          if (insErr) {
            if ((insErr as any).code !== "23505") summary.errors.push(`${lim.equipment_name}: ${insErr.message}`);
            continue;
          }
          summary.opened++;
          await admin.from("internal_notifications").insert({
            notification_type: "temperature_alert",
            reference_id: made!.id,
            reference_table: "temperature_alerts",
            title: f.summary,
            message: f.detail,
          });
          if (await notify(recipients, f.summary, f.detail, made!.opened_at, false, lim.equipment_name)) {
            summary.notified++;
            await admin.from("temperature_alerts")
              .update({ last_notified_at: new Date().toISOString(), notify_count: 1 })
              .eq("id", made!.id);
          }
          continue;
        }

        // Still live. Track the worst value seen, and chase it if nobody has responded.
        const worse = f.worstValue !== null &&
          (existing.worst_value === null ||
           (f.kind === "out_of_range"
             ? Math.abs(f.worstValue) > Math.abs(Number(existing.worst_value))
             : f.worstValue > Number(existing.worst_value)));
        if (worse) {
          await admin.from("temperature_alerts")
            .update({ worst_value: f.worstValue, trigger_reading_at: f.triggerAt })
            .eq("id", existing.id);
        }

        const lastNotified = existing.last_notified_at
          ? new Date(existing.last_notified_at).getTime() : 0;
        const due = (now - lastNotified) / 3_600_000 >= RENOTIFY_HOURS;
        if (!existing.acknowledged_at && due) {
          if (await notify(recipients, `Still open — ${f.summary}`, f.detail,
                           existing.opened_at, false, lim.equipment_name)) {
            summary.notified++;
            await admin.from("temperature_alerts")
              .update({
                last_notified_at: new Date().toISOString(),
                notify_count: (existing.notify_count ?? 1) + 1,
              })
              .eq("id", existing.id);
          }
        }
      }

      // --- close alerts whose condition has gone away
      for (const [kind, row] of open) {
        if (liveKinds.has(kind as AlertKind)) continue;
        const { error: clrErr } = await admin
          .from("temperature_alerts")
          .update({ cleared_at: new Date().toISOString() })
          .eq("id", row.id);
        if (clrErr) { summary.errors.push(`${lim.equipment_name}: ${clrErr.message}`); continue; }
        summary.cleared++;
        if (await notify(recipients, `Resolved — ${lim.equipment_name} back within limits`,
                         `${lim.equipment_name} is reading within its limits again ` +
                         `(${limitText(lim)}). This alert has been closed. If product was ` +
                         `affected, the disposition is still recorded under FSQM-018.`,
                         row.opened_at, true, lim.equipment_name)) {
          summary.notified++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, ...summary }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("temperature-alert failed:", err);
    return new Response(JSON.stringify({ error: String(err), ...summary }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Send one alert email. Never throws: an alert that was recorded but not emailed is far
 *  better than a run that aborts and leaves the rest of the units unchecked. */
async function notify(
  recipients: string[], subject: string, detail: string,
  openedAt: string, resolved: boolean, equipment: string,
): Promise<boolean> {
  const meta = { equipment, resolved };
  const key = Deno.env.get("RESEND_API_KEY");
  if (!recipients.length) {
    await logEmailSend(TEMPLATE, "not_configured", {
      recipient: "(none)", error: "no notify_emails and no admin/owner email on file", metadata: meta,
    });
    return false;
  }
  if (!key) {
    await logEmailSend(TEMPLATE, "not_configured", {
      recipient: recipients.join(","), error: "RESEND_API_KEY not set", metadata: meta,
    });
    return false;
  }
  try {
    const opened = new Date(openedAt).toLocaleString("en-US", {
      dateStyle: "medium", timeStyle: "short",
    });
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: FROM,
        to: recipients,
        reply_to: REPLY_TO,
        subject: `${resolved ? "" : "⚠ "}${subject}`,
        html: emailHtml(subject, detail, opened, resolved),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      await logEmailSend(TEMPLATE, "failed", {
        recipient: recipients.join(","), error: JSON.stringify(data), metadata: meta,
      });
      return false;
    }
    await logEmailSend(TEMPLATE, "sent", {
      recipient: recipients.join(","), messageId: data.id ?? null, metadata: meta,
    });
    return true;
  } catch (e) {
    await logEmailSend(TEMPLATE, "failed", {
      recipient: recipients.join(","), error: String(e), metadata: meta,
    });
    return false;
  }
}
