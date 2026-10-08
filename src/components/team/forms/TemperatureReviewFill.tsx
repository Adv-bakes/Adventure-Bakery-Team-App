import { useState } from "react";
import { Link } from "react-router-dom";
import type { UseFormReturn } from "react-hook-form";
import { format } from "date-fns";
import { AlertTriangle, Loader2, Thermometer, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { emptyValues, type FormSchema } from "@/lib/formSchema";
import { loadFrm401Prefill, mergeFrm401Prefill, monthLabelToYm, monthRange } from "@/lib/temperatureReview";

/**
 * "Fill from the temperature logs" on an FRM-401 entry (owner's request, 2026-10-08): an entry
 * started from the SOPs Library opened empty, while one started from the Temperature Monitoring
 * page came with the month's figures. This runs the same fill from inside the entry.
 *
 * It fills blanks only - the month, the review date, each unit's Min/Max/Avg and the alert rows -
 * and never replaces something already entered. Like "Copy from a previous entry" the result is
 * unsaved and dirty until Save Draft, with one Undo. An entry already for another month is left
 * alone and says so.
 */
export function TemperatureReviewFill({ form, schema }: { form: UseFormReturn<any>; schema: FormSchema }) {
  const thisMonth = format(new Date(), "yyyy-MM");
  const [ym, setYm] = useState<string>(() => monthLabelToYm(form.getValues("review_month")) ?? thisMonth);
  const [busy, setBusy] = useState(false);
  const [filled, setFilled] = useState<{ label: string; prev: Record<string, any> } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const range = ym ? monthRange(ym) : null;

  const fill = async () => {
    if (!ym) return;
    setBusy(true);
    setProblem(null);
    try {
      const { prefill, label } = await loadFrm401Prefill(schema, ym);
      const prev = { ...emptyValues(schema), ...form.getValues() };
      const merged = mergeFrm401Prefill(prev, prefill);
      if (merged.otherMonth) {
        setProblem(`This entry's Month reviewed is ${merged.otherMonth}. Choose that month here, or clear Month reviewed first.`);
      } else if (!merged.changed) {
        setProblem(`Nothing to fill for ${label}: every figure the logs can supply is already entered.`);
      } else {
        form.reset(merged.data, { keepDefaultValues: true });
        setFilled({ label, prev });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not read the temperature logs");
    } finally {
      setBusy(false);
    }
  };

  const undo = () => {
    if (!filled) return;
    form.reset(filled.prev, { keepDefaultValues: true });
    setFilled(null);
  };

  return (
    <Card className="p-3 space-y-2 border" style={{ background: "#FFF", borderColor: "rgba(200,155,60,0.4)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <Thermometer className="w-4 h-4 text-[#9A6F1E]" />
        <p className="text-sm font-medium text-[#2A1F0E]">Fill from the temperature logs</p>
        <p className="text-xs text-[#2A1F0E]/60">
          This review is best started from the{" "}
          <Link to="/team/compliance/temperature" className="underline underline-offset-2">Temperature Monitoring page</Link>.
          You can also fill it here: the month, each unit's Min/Max/Avg and the month's alerts come from the logs. You complete the rest.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="month"
          aria-label="Month to review"
          className="w-44 h-9 bg-white text-[#2A1F0E]"
          value={ym}
          max={thisMonth}
          onChange={e => { setYm(e.target.value); setProblem(null); }}
        />
        <Button type="button" variant="outline" size="sm" onClick={fill} disabled={busy || !ym}>
          {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Thermometer className="w-3.5 h-3.5 mr-1.5" />}
          Populate from temperature logs
        </Button>
        {range && (
          <span className="text-xs text-[#2A1F0E]/60">
            {format(new Date(`${range.start}T00:00:00`), "MMM d")} – {format(new Date(`${range.end}T00:00:00`), "MMM d, yyyy")}
            {range.toDate ? " (month to date)" : ""}
          </span>
        )}
      </div>
      {problem && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{problem}
        </p>
      )}
      {filled && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs rounded border p-2" style={{ borderColor: "rgba(200,155,60,0.4)", background: "rgba(200,155,60,0.08)" }}>
          <p className="text-[#2A1F0E]">
            Filled in the <strong>{filled.label}</strong> figures from the temperature logs — not saved yet. Check them, complete the rest, then Save Draft.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={undo}>
            <Undo2 className="w-3.5 h-3.5 mr-1.5" />Undo
          </Button>
        </div>
      )}
    </Card>
  );
}
