// D-18 — raises the verification activities that have fallen due, so the master schedule is a thing
// the site is prompted by rather than a printed table nobody opens.
//
// Invoked by pg_cron twice a day. It reads public.verification_schedule, works out when each active
// activity was last actually recorded, and inserts one notification per activity that is due or
// overdue. It also closes what no longer applies, so the badge count can go down as well as up.
//
// THREE THINGS IT DELIBERATELY DOES NOT DO:
//
//   It never writes to sop_document_responses. Any UPDATE there fires the
//   sop_document_responses_touch trigger and bumps updated_at, which is the optimistic-concurrency
//   token — so a background write would hand a StaleResponseError to whoever had that form open on
//   the floor. Last-completed is READ from the evidence records and never stored back.
//
//   It never raises a `planned` activity. Seven of the twenty seeded rows are scheduled but not yet
//   performed, because the programs that govern them have not been issued — there is no HACCP plan,
//   no calibration program, no water or compressed-air program, no internal audit program. Raising
//   "CCP record review is overdue" at a site with no CCPs would be the machinery asserting something
//   the document set explicitly denies. assessDue() drops them; this file never sees them.
//
//   It never dismisses anything on a person's behalf. When an activity has been done, the
//   notification is closed with resolved_at — never dismissed_at — so a stamped dismissal always
//   means a human took the prompt.
//
// The decision half is in ../_shared/verificationSchedule.ts, free of Deno APIs and I/O, because
// there is no Deno toolchain on the dev machine and this file cannot be run locally.
// scripts/test-verification-schedule.mjs exercises it.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assessDue, retentionLinks, formLink, addDays,
  type Completion, type NotificationLink, type ScheduleRow,
} from "../_shared/verificationSchedule.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// "Due today" has to mean the day the floor is standing in, not the day UTC is in. The database runs
// UTC and pg_cron schedules in UTC, so the local date is computed here.
//
// THIS AND THE CRON HOURS ARE ONE DECISION MADE TWICE. If the site timezone ever changes, change
// this AND the UTC hours in 20260910000014_verification_notifications_cron.sql together — a job that
// fires at 07:00 local while this function believes it is already tomorrow would raise every
// activity a day early, every day.
const SITE_TZ = "America/New_York";

// A retention sample due within a week is worth linking now: the review is weekly, so anything
// falling due before the next review should be dealt with at this one.
const RETENTION_HORIZON_DAYS = 7;
const RETENTION_LINK_CAP = 25;

const NOTIFICATION_TYPE = "verification_due";

type Summary = {
  checked: number; opened: number; escalated: number;
  resolved: number; skipped: number; errors: string[];
};

/** yyyy-MM-dd in the site's timezone. en-CA formats as ISO, which is why it is used here. */
function siteToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
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

  const today = siteToday();
  const summary: Summary = {
    checked: 0, opened: 0, escalated: 0, resolved: 0, skipped: 0, errors: [],
  };

  try {
    // ---------------------------------------------------------------- the schedule
    const { data: rows, error: schedErr } = await admin
      .from("verification_schedule")
      .select("*")
      .order("sort_order", { ascending: true });
    if (schedErr) throw new Error(`reading the schedule: ${schedErr.message}`);

    const all = (rows ?? []) as ScheduleRow[];
    const active = all.filter((r) => r.status === "active");
    summary.checked = active.length;
    summary.skipped = all.length - active.length;

    // ---------------------------------------------------------------- resolve the documents once
    const wanted = new Set<string>();
    for (const r of active) if (r.evidence_document_number) wanted.add(r.evidence_document_number);
    wanted.add("FRM-703"); // needed for the retention links whether or not it is on the schedule

    const { data: docRows, error: docErr } = await admin
      .from("sop_documents")
      .select("id, sop_number, title")
      .in("sop_number", [...wanted]);
    if (docErr) throw new Error(`resolving documents: ${docErr.message}`);
    type DocRow = { id: string; sop_number: string; title: string | null };
    const docIdOf = new Map<string, string>(
      (docRows ?? []).map((d: DocRow) => [d.sop_number, d.id]),
    );
    const docTitleOf = new Map<string, string | null>(
      (docRows ?? []).map((d: DocRow) => [d.sop_number, d.title]),
    );

    // ---------------------------------------------------------------- last completed
    // Derived, never stored. Filter by document_id first: there is no index on `data`, only
    // (document_id, created_at DESC), so anything else is a sequential scan of every form entry
    // in the system.
    const completions: Completion[] = [];

    const formRows = active.filter(
      (r) => r.evidence_kind === "form_entry" && r.evidence_document_number,
    );
    for (const r of formRows) {
      const docId = docIdOf.get(r.evidence_document_number!);
      if (!docId) {
        // The schedule names a document that does not exist. Say so rather than treating the
        // activity as never done, which would raise a notification nobody can act on.
        summary.errors.push(`${r.activity_key}: ${r.evidence_document_number} not found`);
        continue;
      }
      const { data, error } = await admin
        .from("sop_document_responses")
        .select("submitted_at")
        .eq("document_id", docId)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .limit(1);
      if (error) { summary.errors.push(`${r.activity_key}: ${error.message}`); continue; }
      const at = data?.[0]?.submitted_at as string | undefined;
      completions.push({
        activity_key: r.activity_key,
        completed_on: at ? at.slice(0, 10) : null,
      });
    }

    // FRM-008 activities: one query, reduced per activity in JS. FRM-008 will hold tens of entries,
    // not thousands, and this avoids a jsonb predicate against an unindexed column.
    const frm008Rows = active.filter((r) => r.evidence_kind === "frm008");
    if (frm008Rows.length) {
      const docId = docIdOf.get("FRM-008");
      if (docId) {
        const { data, error } = await admin
          .from("sop_document_responses")
          .select("submitted_at, data")
          .eq("document_id", docId)
          .eq("status", "submitted");
        if (error) {
          summary.errors.push(`FRM-008: ${error.message}`);
        } else {
          const latest = new Map<string, string>();
          for (const e of data ?? []) {
            const key = String((e as { data?: Record<string, unknown> }).data?.activity ?? "");
            const at = (e as { submitted_at?: string }).submitted_at;
            if (!key || !at) continue;
            const day = at.slice(0, 10);
            if (!latest.has(key) || day > latest.get(key)!) latest.set(key, day);
          }
          for (const r of frm008Rows) {
            completions.push({
              activity_key: r.activity_key,
              // FRM-008's activity select stores the human label, which is what the schedule's
              // `activity` column holds. activity_key is the machine identity and never appears
              // on the form.
              completed_on: latest.get(r.activity) ?? null,
            });
          }
        }
      } else {
        summary.errors.push("FRM-008 not found; its activities cannot be dated");
      }
    }

    // ---------------------------------------------------------------- decide
    const findings = assessDue(all, completions, today);

    // ---------------------------------------------------------------- retention deep links
    // One notification for the review, carrying a link per sample, so each can be opened and closed
    // out directly instead of being hunted for in the entries list.
    const linksFor = new Map<string, NotificationLink[]>();
    if (findings.some((f) => f.activityKey === "retention_sample_review")) {
      const docId = docIdOf.get("FRM-703");
      if (docId) {
        const { data, error } = await admin
          .from("sop_document_responses")
          .select("id, status, reopened_at, data")
          .eq("document_id", docId)
          .eq("status", "draft");
        if (error) {
          summary.errors.push(`FRM-703: ${error.message}`);
        } else {
          linksFor.set(
            "retention_sample_review",
            retentionLinks(
              (data ?? []) as never,
              docId,
              today,
              RETENTION_HORIZON_DAYS,
              RETENTION_LINK_CAP,
            ),
          );
        }
      }
    }

    // ---------------------------------------------------------------- write
    const liveKeys = new Set<string>();
    for (const f of findings) {
      liveKeys.add(f.dedupeKey);
      const row = all.find((r) => r.activity_key === f.activityKey);

      // Every activity links to the form it is completed on, so the notification is one click from
      // the work rather than a sentence naming a document you then go and find. The retention
      // review's per-sample links follow it: the form link is the general way in, the sample links
      // are the specific items to close out.
      const links: NotificationLink[] = [];
      const evidenceNumber = row?.evidence_kind === "frm008"
        ? "FRM-008"
        : row?.evidence_document_number ?? null;
      const evidenceId = evidenceNumber ? docIdOf.get(evidenceNumber) : undefined;
      if (evidenceNumber && evidenceId) {
        links.push(formLink(evidenceNumber, evidenceId, docTitleOf.get(evidenceNumber)));
      }
      links.push(...(linksFor.get(f.activityKey) ?? []));

      const { error } = await admin.from("internal_notifications").insert({
        notification_type: NOTIFICATION_TYPE,
        reference_table: "verification_schedule",
        reference_id: row?.id ?? null,
        title: f.title,
        message: f.message,
        dedupe_key: f.dedupeKey,
        responsible_position: f.responsiblePosition,
        due_on: f.dueOn,
        severity: f.severity,
        links,
      });

      if (!error) { summary.opened++; continue; }

      // 23505 is the dedupe index doing its job: this occurrence was already raised, by the
      // morning run or by an overlapping one. Same idiom as temperature-alert.
      if ((error as { code?: string }).code !== "23505") {
        summary.errors.push(`${f.activityKey}: ${error.message}`);
        continue;
      }

      // Already raised. Refresh it — an activity that has crossed from due into overdue should say
      // so, and the retention links move as samples come and go. Only ever the OPEN row: touching a
      // dismissed one would silently edit somebody's cleared record.
      const { error: updErr } = await admin
        .from("internal_notifications")
        .update({ severity: f.severity, message: f.message, links })
        .eq("dedupe_key", f.dedupeKey)
        .is("dismissed_at", null)
        .is("resolved_at", null);
      if (updErr) summary.errors.push(`${f.activityKey} (refresh): ${updErr.message}`);
      else summary.escalated++;
    }

    // ---------------------------------------------------------------- close what is done
    // An open verification notification whose occurrence is no longer in the live set means the
    // activity was performed (or the schedule changed). resolved_at, not dismissed_at: no person
    // did this, and the stamp must keep meaning that one did.
    const { data: open, error: openErr } = await admin
      .from("internal_notifications")
      .select("id, dedupe_key")
      .eq("notification_type", NOTIFICATION_TYPE)
      .is("dismissed_at", null)
      .is("resolved_at", null);
    if (openErr) {
      summary.errors.push(`reading open notifications: ${openErr.message}`);
    } else {
      const stale = (open ?? [])
        .filter((n: { dedupe_key: string | null }) => n.dedupe_key && !liveKeys.has(n.dedupe_key))
        .map((n: { id: string }) => n.id);
      if (stale.length) {
        const { error } = await admin
          .from("internal_notifications")
          .update({ resolved_at: new Date().toISOString(), resolved_reason: "Completed or no longer due" })
          .in("id", stale);
        if (error) summary.errors.push(`resolving: ${error.message}`);
        else summary.resolved += stale.length;
      }
    }

    // ---------------------------------------------------------------- close settled temperature alerts
    // These rows are written by the temperature-alert function, which has no idea anything reads
    // them. Without this the alert half of the badge would only ever count up.
    const { data: tempNotes, error: tnErr } = await admin
      .from("internal_notifications")
      .select("id, reference_id")
      .eq("notification_type", "temperature_alert")
      .is("dismissed_at", null)
      .is("resolved_at", null);
    if (tnErr) {
      summary.errors.push(`reading temperature notifications: ${tnErr.message}`);
    } else if ((tempNotes ?? []).length) {
      const ids = (tempNotes ?? [])
        .map((n: { reference_id: string | null }) => n.reference_id)
        .filter((v: string | null): v is string => !!v);
      if (ids.length) {
        const { data: alerts, error } = await admin
          .from("temperature_alerts")
          .select("id, acknowledged_at, cleared_at")
          .in("id", ids);
        if (error) {
          summary.errors.push(`reading temperature alerts: ${error.message}`);
        } else {
          const settled = new Set(
            (alerts ?? [])
              .filter((a: { acknowledged_at: string | null; cleared_at: string | null }) =>
                a.acknowledged_at !== null || a.cleared_at !== null)
              .map((a: { id: string }) => a.id),
          );
          const close = (tempNotes ?? [])
            .filter((n: { reference_id: string | null }) => n.reference_id && settled.has(n.reference_id))
            .map((n: { id: string }) => n.id);
          if (close.length) {
            const { error: cErr } = await admin
              .from("internal_notifications")
              .update({
                resolved_at: new Date().toISOString(),
                resolved_reason: "Temperature alert acknowledged or cleared",
              })
              .in("id", close);
            if (cErr) summary.errors.push(`resolving temperature: ${cErr.message}`);
            else summary.resolved += close.length;
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, today, horizon: addDays(today, RETENTION_HORIZON_DAYS), ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e), today, ...summary }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
