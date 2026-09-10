// The master verification schedule (D-18, SQF 2.5.2.2).
//
// Read-only here. The schedule is edited through the same table the job reads, and "last completed"
// is DERIVED from the evidence records rather than stored — so the date shown is the record itself,
// not somebody's assertion about it, and it cannot drift out of step with what was actually filed.
//
// PLANNED ROWS ARE RENDERED SO THEY CANNOT BE MISTAKEN FOR ACTIVE ONES. Seven of the twenty seeded
// activities are scheduled but not yet performed, because the programs governing them have not been
// issued. An auditor reading this page must not be able to read a planned row as a live control, so
// they are muted, they show an em dash rather than a due date, and they name the deliverable that
// will make them real.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ScheduleRow, Completion, frequencyLabel, rowState,
} from "@/lib/verificationSchedule";

const STATE_STYLE: Record<string, string> = {
  overdue: "text-destructive font-medium",
  due: "text-[hsl(var(--tp-gold))] font-medium",
  never: "text-destructive",
  ok: "text-muted-foreground",
  planned: "text-muted-foreground",
  retired: "text-muted-foreground",
};

const STATE_LABEL: Record<string, string> = {
  overdue: "Overdue",
  due: "Due",
  never: "Never recorded",
  ok: "Up to date",
  planned: "Not yet implemented",
  retired: "Retired",
};

export default function VerificationSchedule() {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [docIdOf, setDocIdOf] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const today = useMemo(
    () => new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date()),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("verification_schedule")
        .select("*")
        .neq("status", "retired")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const sched = (data ?? []) as ScheduleRow[];
      setRows(sched);

      // Last completed, derived. One query per referenced document, filtered by document_id first —
      // there is no index on sop_document_responses.data.
      const docNumbers = [...new Set(
        sched.filter((r) => r.status === "active" && r.evidence_document_number)
             .map((r) => r.evidence_document_number as string),
      )];
      if (!docNumbers.length) { setCompletions([]); setDocIdOf(new Map()); return; }

      const { data: docs } = await (supabase as any)
        .from("sop_documents").select("id, sop_number").in("sop_number", docNumbers);
      const idOf = new Map<string, string>(
        (docs ?? []).map((d: { id: string; sop_number: string }) => [d.sop_number, d.id]),
      );
      setDocIdOf(idOf);

      const found: Completion[] = [];
      for (const r of sched) {
        if (r.status !== "active" || !r.evidence_document_number) continue;
        const docId = idOf.get(r.evidence_document_number);
        if (!docId) continue;
        const { data: last } = await (supabase as any)
          .from("sop_document_responses")
          .select("submitted_at")
          .eq("document_id", docId)
          .eq("status", "submitted")
          .order("submitted_at", { ascending: false })
          .limit(1);
        const at = last?.[0]?.submitted_at as string | undefined;
        found.push({ activity_key: r.activity_key, completed_on: at ? at.slice(0, 10) : null });
      }
      setCompletions(found);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load the verification schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const lastOf = new Map(completions.map((c) => [c.activity_key, c.completed_on]));

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 tp-fade-up">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2 tp-on-bg">
          <CalendarCheck className="w-5 h-5 text-[hsl(var(--tp-gold))]" />
          Master Verification Schedule
        </h1>
        <p className="text-sm tp-on-bg-dim mt-1">
          Every verification activity, its frequency and the position responsible for it
          (SQF 2.5.2.2). Recorded on FRM-008 and on the form named against each activity.
        </p>
        <p className="text-sm tp-on-bg-dim mt-2">
          Activities shown as <strong>Not yet implemented</strong> are scheduled but are not being
          performed: the program that governs them has not been issued. They raise no reminders.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 tp-on-bg-dim">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Responsible</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Last completed</TableHead>
                  <TableHead>Next due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const last = lastOf.get(r.activity_key) ?? null;
                  const st = rowState(r, last, today);
                  const muted = r.status !== "active";
                  return (
                    <TableRow key={r.activity_key} className={muted ? "opacity-60" : undefined}>
                      <TableCell className="align-top">
                        <div className="font-medium">{r.activity}</div>
                        {r.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>
                        )}
                        {r.pending_deliverable && (
                          <div className="text-xs text-muted-foreground mt-0.5 italic">
                            Awaiting {r.pending_deliverable}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top whitespace-nowrap">
                        {frequencyLabel(r.frequency_unit, r.frequency_count)}
                      </TableCell>
                      <TableCell className="align-top">{r.responsible_position}</TableCell>
                      <TableCell className="align-top whitespace-nowrap">
                        {r.evidence_kind === "none" ? "—" : (() => {
                          const num = r.evidence_document_number ?? "FRM-008";
                          const id = docIdOf.get(num);
                          // Only a link when the document actually exists. FRM-008 will not until
                          // it is seeded, and a dead link on the compliance schedule is worse than
                          // plain text.
                          return id ? (
                            <Link to={`/team/compliance/sops?doc=${id}`}
                              className="text-[hsl(var(--tp-gold))] hover:underline">
                              {num}
                            </Link>
                          ) : num;
                        })()}
                        {r.owning_program && (
                          <div className="text-xs text-muted-foreground">{r.owning_program}</div>
                        )}
                      </TableCell>
                      <TableCell className="align-top whitespace-nowrap">{last ?? "—"}</TableCell>
                      <TableCell className="align-top whitespace-nowrap">{st.nextDueOn ?? "—"}</TableCell>
                      <TableCell className={`align-top whitespace-nowrap ${STATE_STYLE[st.state]}`}>
                        {STATE_LABEL[st.state]}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
