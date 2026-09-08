// D-34 — the alert log and the limits it is judged against, on /team/compliance/temperature.
//
// The rest of that page is descriptive: it shows what the sensors recorded. This panel is
// the part SQF 11.6.2.3 actually asks for — what "good" means for each unit, and the record
// of what somebody did when a reading wasn't. An alert nobody acknowledged is a
// notification; an acknowledged alert is evidence, which is why the acknowledge dialog
// insists on a sentence rather than offering a "Dismiss" button.

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, BellRing, Check, Loader2, Settings2, Thermometer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import {
  ALERT_KIND_LABEL, acknowledgeTemperatureAlert, fetchTemperatureAlerts,
  fetchTemperatureLimits, formatWorstValue, limitText, updateTemperatureLimit,
  type TemperatureAlert, type TemperatureLimit,
} from "@/lib/temperatureAlerts";

const GOLD = "#C89B3C";

function when(iso: string | null) {
  return iso ? format(new Date(iso), "MMM d, yyyy HH:mm") : "—";
}

/** Acknowledge dialog. Requires a sentence — that sentence is the corrective-action record. */
function AcknowledgeDialog({
  alert, onClose, onDone,
}: { alert: TemperatureAlert | null; onClose: () => void; onDone: (a: TemperatureAlert) => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setText(""); }, [alert?.id]);

  async function save() {
    if (!alert || !text.trim()) return;
    setSaving(true);
    try {
      onDone(await acknowledgeTemperatureAlert(alert.id, text.trim()));
      toast.success("Alert acknowledged");
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Could not acknowledge the alert");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!alert} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Acknowledge alert</DialogTitle>
          <DialogDescription>
            {alert?.details?.summary ?? alert?.equipment_name}
          </DialogDescription>
        </DialogHeader>
        {alert?.details?.detail && (
          <p className="text-sm text-muted-foreground">{alert.details.detail}</p>
        )}
        <div className="space-y-2">
          <Label htmlFor="temp-ack">What did you do?</Label>
          <Textarea
            id="temp-ack"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="e.g. Door found ajar and closed at 14:20. Probe read 39 °F at 14:35. Butter and eggs checked, all firm and within temperature — no product held."
          />
          <p className="text-xs text-muted-foreground">
            This is the corrective-action record SOP-401 requires, and it cannot be edited
            afterwards. If product is in doubt, place it on Hold under FSQM-018 and say so here.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={save}
            disabled={saving || !text.trim()}
            style={{ backgroundColor: GOLD }}
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Admin editor for one unit's limits. */
function LimitEditor({
  limit, onSaved,
}: { limit: TemperatureLimit; onSaved: (l: TemperatureLimit) => void }) {
  const [draft, setDraft] = useState(limit);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(limit); }, [limit]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(limit);
  const stateChanged = draft.in_service !== limit.in_service;

  async function save() {
    // Mirrors the database CHECK, so the failure is a sentence rather than a constraint name.
    if (draft.kind === "storage" && draft.in_service && draft.max_f === null) {
      toast.error("An in-service unit needs an upper limit — otherwise nothing is alerted on.");
      return;
    }
    setSaving(true);
    try {
      const saved = await updateTemperatureLimit(limit.id, {
        in_service: draft.in_service,
        min_f: draft.min_f,
        max_f: draft.max_f,
        stale_hours: draft.stale_hours,
        notify_emails: draft.notify_emails,
        notes: draft.notes,
      }, { markInServiceChange: stateChanged });
      onSaved(saved);
      toast.success(`${limit.equipment_name} updated`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Could not save the limits");
    } finally {
      setSaving(false);
    }
  }

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">{limit.equipment_name}</div>
          <div className="text-xs text-muted-foreground">
            {limit.kind === "ambient" ? "Ambient sensor" : "Storage unit"}
            {limit.device_id ? ` · ${limit.device_id}` : ""}
          </div>
        </div>
        {limit.kind === "storage" && (
          <div className="flex items-center gap-2">
            <Label htmlFor={`svc-${limit.id}`} className="text-xs">In service</Label>
            <Switch
              id={`svc-${limit.id}`}
              checked={draft.in_service}
              onCheckedChange={(v) => setDraft({ ...draft, in_service: v })}
            />
          </div>
        )}
      </div>

      {limit.kind === "storage" && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Min °F</Label>
              <Input
                type="number" inputMode="decimal"
                value={draft.min_f ?? ""}
                onChange={(e) => setDraft({ ...draft, min_f: num(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max °F</Label>
              <Input
                type="number" inputMode="decimal"
                value={draft.max_f ?? ""}
                onChange={(e) => setDraft({ ...draft, max_f: num(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">No-data after (h)</Label>
              <Input
                type="number" inputMode="numeric" min={1}
                value={draft.stale_hours}
                onChange={(e) => setDraft({ ...draft, stale_hours: Number(e.target.value) || 1 })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Alert emails (comma separated — blank sends to all admins and owners)
            </Label>
            <Input
              value={(draft.notify_emails ?? []).join(", ")}
              placeholder="blank = every admin/owner account"
              onChange={(e) => setDraft({
                ...draft,
                notify_emails: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
              })}
            />
          </div>
        </>
      )}

      <div>
        <Label className="text-xs text-muted-foreground">Notes</Label>
        <Textarea
          rows={2}
          value={draft.notes ?? ""}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </div>

      {stateChanged && draft.in_service && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Returning a unit to service: SOP-401 Part 7 requires it to be clean, inspected,
          reporting, and holding at or below its limit for 24 hours before food goes in.
        </p>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty || saving} style={{ backgroundColor: GOLD }}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

export default function TemperatureAlertsPanel() {
  const { role } = useUserRole();
  const isAdmin = role === "admin" || role === "owner";

  const [limits, setLimits] = useState<TemperatureLimit[]>([]);
  const [alerts, setAlerts] = useState<TemperatureAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [acking, setAcking] = useState<TemperatureAlert | null>(null);
  // The tables land with the migration; until it is pushed, this panel is absent rather
  // than an error banner on a page that otherwise works.
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, a] = await Promise.all([fetchTemperatureLimits(), fetchTemperatureAlerts()]);
      setLimits(l);
      setAlerts(a);
      setUnavailable(false);
    } catch (e: any) {
      console.error(e);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (unavailable) return null;

  const open = alerts.filter(a => !a.cleared_at);
  const history = alerts.filter(a => a.cleared_at).slice(0, 10);
  const unacked = open.filter(a => !a.acknowledged_at);

  return (
    <>
      {/* Open alerts */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BellRing className="h-5 w-5" style={{ color: GOLD }} />
              Temperature Alerts
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Checked automatically every 15 minutes against the limits below — this is the
              monitoring check, so no daily manual round is required.
            </p>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowSettings(s => !s)}>
              <Settings2 className="h-4 w-4 mr-2" />
              {showSettings ? "Hide limits" : "Limits"}
            </Button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : open.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <Check className="h-4 w-4 shrink-0" />
            No open alerts — every in-service unit is reporting and within its limits.
          </div>
        ) : (
          <>
            {unacked.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 mb-3">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  {unacked.length} alert{unacked.length === 1 ? "" : "s"} awaiting a recorded
                  response. SOP-401 requires the corrective action to be written down.
                </p>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Alert</TableHead>
                  <TableHead>Worst</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {open.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.equipment_name}</TableCell>
                    <TableCell>
                      <Badge variant={a.kind === "low_battery" ? "secondary" : "destructive"}>
                        {ALERT_KIND_LABEL[a.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatWorstValue(a)}</TableCell>
                    <TableCell className="text-muted-foreground">{when(a.opened_at)}</TableCell>
                    <TableCell>
                      {a.acknowledged_at ? (
                        <span className="text-sm">
                          <Check className="h-3.5 w-3.5 inline mr-1 text-emerald-600" />
                          {a.action_taken}
                        </span>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setAcking(a)}>
                          Acknowledge
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        {/* Limits — the answer to "what does good mean", visible to everyone, editable by admins */}
        {(showSettings || !isAdmin) && limits.length > 0 && (
          <div className="mt-5 pt-4 border-t">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Thermometer className="h-4 w-4" style={{ color: GOLD }} /> Unit limits
            </h3>
            {isAdmin && showSettings ? (
              <div className="space-y-3">
                {limits.map(l => (
                  <LimitEditor
                    key={l.id}
                    limit={l}
                    onSaved={(saved) => setLimits(ls => ls.map(x => x.id === saved.id ? saved : x))}
                  />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Limit</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {limits.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.equipment_name}</TableCell>
                      <TableCell>{limitText(l)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {/* Recently closed — the evidence a monthly review reads */}
        {history.length > 0 && (
          <div className="mt-5 pt-4 border-t">
            <h3 className="text-sm font-semibold mb-2">Recently closed</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Alert</TableHead>
                  <TableHead>Worst</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead>Action taken</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.equipment_name}</TableCell>
                    <TableCell>{ALERT_KIND_LABEL[a.kind]}</TableCell>
                    <TableCell>{formatWorstValue(a)}</TableCell>
                    <TableCell className="text-muted-foreground">{when(a.opened_at)}</TableCell>
                    <TableCell className="text-muted-foreground">{when(a.cleared_at)}</TableCell>
                    <TableCell className="text-xs">
                      {a.action_taken ?? (
                        <span className="text-amber-700">Not acknowledged</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <AcknowledgeDialog
        alert={acking}
        onClose={() => setAcking(null)}
        onDone={(saved) => setAlerts(as => as.map(x => x.id === saved.id ? saved : x))}
      />
    </>
  );
}
