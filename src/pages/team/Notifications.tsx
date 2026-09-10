// The notification feed (D-18).
//
// Two things this page is careful about, both of them compliance rather than UI:
//
//   A notification is a PROMPT, not a record. Clearing one does not perform the activity and is not
//   evidence that it was performed — the evidence is the form entry the notification links to. The
//   dismissal dialog says so in as many words, because a feed that feels like a checklist is one
//   people will tick instead of doing the work.
//
//   Temperature alerts cannot be dismissed here. Clearing one would make the badge go away without
//   the SOP-401 corrective-action record ever being written, which would turn this page into a way
//   of skipping the obligation. They close themselves once the alert is acknowledged on the
//   temperature page (where acknowledging demands a sentence saying what was done) or clears.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, ChevronDown, Loader2, Thermometer } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AppNotification, dismissNotification, fetchClearedNotifications,
  fetchOpenNotifications, isDismissable,
} from "@/lib/notifications";
import { fetchProfileNames } from "@/lib/formResponses";

function ResponsiblePill({ position }: { position: string }) {
  // 2.5.2.2 requires the schedule to name who is responsible for each activity. That label travels
  // onto the notification and is never hidden behind a "show details" toggle — it is the reason
  // this feed can be team-wide instead of routed to individuals.
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full border border-[hsl(var(--tp-gold))] text-[hsl(var(--tp-gold))] whitespace-nowrap">
      {position}
    </span>
  );
}

function NotificationCard({
  n, onDismiss,
}: { n: AppNotification; onDismiss: (n: AppNotification) => void }) {
  const isTemp = n.notification_type === "temperature_alert";
  const overdue = n.severity === "overdue";
  const accent = overdue ? "border-l-destructive"
    : isTemp ? "border-l-destructive/70"
    : "border-l-[hsl(var(--tp-gold))]";

  return (
    <Card className={`border-l-4 ${accent}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="mt-0.5 shrink-0">
            {isTemp ? <Thermometer className="w-4 h-4 text-destructive" />
              : overdue ? <AlertTriangle className="w-4 h-4 text-destructive" />
              : <CalendarClock className="w-4 h-4 text-[hsl(var(--tp-gold))]" />}
          </div>
          <div className="flex-1 min-w-[240px]">
            <p className="font-medium leading-snug">{n.title}</p>
            {n.message && <p className="text-sm text-muted-foreground mt-1">{n.message}</p>}

            <div className="flex items-center gap-2 flex-wrap mt-2">
              {n.responsible_position && <ResponsiblePill position={n.responsible_position} />}
              {n.due_on && (
                <span className="text-[11px] text-muted-foreground">Due {n.due_on}</span>
              )}
            </div>

            {n.links.length > 0 && (
              <ul className="mt-3 space-y-1">
                {n.links.map((l) => (
                  <li key={l.href}>
                    <Link to={l.href} className="text-sm text-[hsl(var(--tp-gold))] hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {isTemp && (
              <Link
                to="/team/compliance/temperature"
                className="inline-block mt-3 text-sm text-[hsl(var(--tp-gold))] hover:underline"
              >
                Open temperature alerts to acknowledge and record what was done →
              </Link>
            )}
          </div>

          {isDismissable(n) && (
            <Button variant="outline" size="sm" className="shrink-0"
              onClick={() => onDismiss(n)}>
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Notifications() {
  const [open, setOpen] = useState<AppNotification[]>([]);
  const [cleared, setCleared] = useState<AppNotification[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showCleared, setShowCleared] = useState(false);
  const [target, setTarget] = useState<AppNotification | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, c] = await Promise.all([fetchOpenNotifications(), fetchClearedNotifications()]);
      setOpen(o);
      setCleared(c);
      const ids = [...new Set(c.map((n) => n.dismissed_by).filter((v): v is string => !!v))];
      setNames(ids.length ? await fetchProfileNames(ids) : new Map());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const confirmDismiss = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await dismissNotification(target.id, note);
      toast.success("Cleared for the team");
      setTarget(null);
      setNote("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear it");
    } finally {
      setBusy(false);
    }
  };

  const overdue = open.filter((n) => n.severity === "overdue");
  const due = open.filter((n) => n.notification_type === "verification_due" && n.severity !== "overdue");
  const alerts = open.filter((n) => n.notification_type === "temperature_alert");

  const group = (title: string, items: AppNotification[]) =>
    items.length > 0 && (
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{title} ({items.length})</h2>
        {items.map((n) => <NotificationCard key={n.id} n={n} onDismiss={setTarget} />)}
      </section>
    );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 tp-fade-up">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5 text-[hsl(var(--tp-gold))]" />
          Notifications
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verification activities that have fallen due, and open alerts. Everything here is visible
          to the whole team and labelled with the position responsible for it.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : open.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto text-[hsl(var(--tp-gold))]" />
            <p className="mt-3 font-medium">Nothing outstanding</p>
            <p className="text-sm text-muted-foreground mt-1">
              Every scheduled verification activity is up to date and no alerts are open.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {group("Overdue", overdue)}
          {group("Due", due)}
          {group("Alerts", alerts)}
        </div>
      )}

      {/* The attribution is the point of the whole dismissal design, so it is shown, not buried. */}
      <div>
        <button
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setShowCleared((v) => !v)}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showCleared ? "" : "-rotate-90"}`} />
          Recently cleared ({cleared.length})
        </button>
        {showCleared && (
          <Card className="mt-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Who cleared what
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {cleared.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing has been cleared yet.</p>
              )}
              {cleared.map((n) => (
                <div key={n.id} className="text-sm border-b last:border-0 pb-2 last:pb-0">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {n.dismissed_at
                      ? `Cleared by ${names.get(n.dismissed_by ?? "") ?? "a team member"} · ${new Date(n.dismissed_at).toLocaleString()}`
                      : `Closed automatically · ${n.resolved_reason ?? "no longer due"}`}
                  </p>
                  {n.dismissed_note && (
                    <p className="text-xs text-muted-foreground italic mt-0.5">{n.dismissed_note}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!target} onOpenChange={(v) => { if (!v) { setTarget(null); setNote(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this for the team?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  This clears the item for everyone and records your name and the time against it.
                </p>
                <p className="font-medium text-foreground">
                  It is not the verification record. The record is the form entry the notification
                  links to.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Optional note — what was done, or why it did not apply"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmDismiss(); }} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Clear it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
