import { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { format } from "date-fns";
import { AlertTriangle, ClipboardList, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { emptyValues, valueFields, type FormSchema, type GridField } from "@/lib/formSchema";
import { UPDATE_TARGET, applyMonthlyUpdate, monthlyUpdateLines, periodPhrase, updatePeriod } from "@/lib/monthlyUpdate";
import { loadMonthlyUpdateRecords } from "@/lib/monthlyUpdateLoad";

/**
 * "Fill from the records" on a Monthly SQF Update entry (FRM-009; owner's request, 2026-10-12).
 * Each standing matter the records can speak to gets what they show since the last update: the
 * schedule's open reminders, open corrective actions, complaints / breakages / holds / recalls,
 * audits and inspections, and changes with the documents issued or revised.
 *
 * Blank cells only - anything typed is left alone - and "Anything needing a decision or a
 * resource" is never filled. Like "Copy from a previous entry" the result is unsaved and dirty
 * until Save Draft, with one Undo. It is what the records show, for the person to read and add to.
 */
export function MonthlyUpdateFill({ form, schema, responseId }: { form: UseFormReturn<any>; schema: FormSchema; responseId: string | null }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ prev: Record<string, any>; filled: string[]; kept: string[]; period: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const rowLabels = useMemo(() => {
    const grid = valueFields(schema).find(f => f.id === UPDATE_TARGET.grid && f.type === "grid") as GridField | undefined;
    return grid && grid.rows.mode === "fixed" ? grid.rows.labels : [];
  }, [schema]);

  const fill = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { records, problems: found } = await loadMonthlyUpdateRecords();
      setProblems(found);
      const prev = { ...emptyValues(schema), ...form.getValues() };
      const period = updatePeriod(records.entries.updates, responseId, prev[UPDATE_TARGET.date], format(new Date(), "yyyy-MM-dd"));
      const res = applyMonthlyUpdate(prev, monthlyUpdateLines(records, period), rowLabels);
      if (res.filled.length === 0) {
        setNote("Nothing was filled: every matter the records can speak to already has something written. Clear a cell to have it looked up again.");
      } else {
        form.reset(res.values, { keepDefaultValues: true });
        setDone({ prev, filled: res.filled, kept: res.kept, period: periodPhrase(period) });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not read the records");
    } finally {
      setBusy(false);
    }
  };

  const undo = () => {
    if (!done) return;
    form.reset(done.prev, { keepDefaultValues: true });
    setDone(null);
  };

  return (
    <Card className="p-3 space-y-2 border" style={{ background: "#FFF", borderColor: "rgba(200,155,60,0.4)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardList className="w-4 h-4 text-[#9A6F1E]" />
        <p className="text-sm font-medium text-[#2A1F0E]">Fill from the records</p>
        <p className="text-xs text-[#2A1F0E]/60 flex-1 min-w-[16rem]">
          Looks up what the records show since the last update - the schedule, open corrective actions, complaints, breakages,
          holds, recalls, audits, inspections and changes - and writes it into each blank "What was raised". Set the date of
          the update first. You read it, add what no record holds, and answer the last row yourself.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={fill} disabled={busy}>
          {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5 mr-1.5" />}
          Fill from the records
        </Button>
      </div>
      {problems.length > 0 && (
        <div className="flex gap-2 text-xs rounded border border-amber-400 bg-amber-50 text-amber-900 p-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <p>A form this reads has changed, so part of the lookup may be missing:</p>
            <ul className="list-disc pl-4">{problems.map(p => <li key={p}>{p}</li>)}</ul>
          </div>
        </div>
      )}
      {note && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{note}
        </p>
      )}
      {done && (
        <div className="flex flex-wrap items-start justify-between gap-2 text-xs rounded border p-2" style={{ borderColor: "rgba(200,155,60,0.4)", background: "rgba(200,155,60,0.08)" }}>
          <p className="text-[#2A1F0E] flex-1 min-w-[240px]">
            Filled in {done.filled.length} matter{done.filled.length === 1 ? "" : "s"} from the records, {done.period}
            {done.kept.length > 0 && <> (left as written: {done.kept.join(", ")})</>}. <strong>Not saved yet.</strong> Read each
            one, add anything no record holds, then Save Draft.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={undo}>
            <Undo2 className="w-3.5 h-3.5 mr-1.5" />Undo
          </Button>
        </div>
      )}
    </Card>
  );
}
