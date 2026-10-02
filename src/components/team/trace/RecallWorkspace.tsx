import { memo, useEffect, useMemo, useState } from "react";
import { useWatch, type Control, type UseFormReturn } from "react-hook-form";
import { format } from "date-fns";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, ExternalLink, MinusCircle, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchDocIdsByNumber } from "@/lib/formResponses";
import type { FormSchema } from "@/lib/formSchema";
import {
  NOTICE_LIMIT_MS, RECALL_FORM, RECALL_TRIGGERS, TRACE_TARGET_MS, clockState, deriveRecallSteps, formatDuration, isMockRecall,
  recallEmailDraft, toRecordFill, type TraceResult, type TraceStart,
} from "@/lib/lotTrace";
import { LotTracePanel, useTraceData } from "./LotTracePanel";

type Values = Record<string, any>;
const HAIR = "rgba(200,155,60,0.35)";

/** Fields the steps are derived from - watched by the steps leaf only, so typing elsewhere re-renders nothing here. */
const STEP_FIELDS = ["record_type", "hold_ref", "trace_back", "completed", "decision", "contacts_checked", "notifications",
  "recovered", "reconciliation", "gaps", "capa_no", "closed_by"] as const;

function useNow(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

function ModeBanner({ control }: { control: Control<Values> }) {
  const type = useWatch({ control, name: "record_type" });
  if (!type) return <p className="text-sm text-muted-foreground">Choose the Type below: mock recall test, withdrawal or recall.</p>;
  const mock = isMockRecall({ record_type: type });
  return (
    <p className={cn("rounded-md px-3 py-2 text-sm font-semibold", mock ? "bg-[#2A1F0E]/10 text-[#2A1F0E]" : "bg-red-600 text-white")}>
      {mock ? "MOCK RECALL - a test. Do not notify customers, authorities or SQFI." : `${String(type).toUpperCase()} - a real event. Follow FSQM-023.`}
    </p>
  );
}

function RecallClock({ control, ticking }: { control: Control<Values>; ticking: boolean }) {
  const [type, started, completed, decidedAt] = useWatch({ control, name: ["record_type", "started", "completed", "decided_at"] });
  const now = useNow(ticking);
  const trace = clockState(started, TRACE_TARGET_MS, now, completed);
  const mock = isMockRecall({ record_type: type });
  const notice = clockState(decidedAt || started, NOTICE_LIMIT_MS, now);

  const traceText = {
    idle: "Fill in 'Started' below and the 4-hour trace clock starts.",
    running: `${formatDuration(trace.elapsedMs)} used - ${formatDuration(trace.remainingMs)} left of the 4-hour target`,
    over: `Over the 4-hour target by ${formatDuration(trace.remainingMs)} - finish the trace and fill in 'Trace completed'`,
    met: `Trace completed in ${formatDuration(trace.elapsedMs)} - inside the 4-hour target`,
    missed: `Trace took ${formatDuration(trace.elapsedMs)} - over the 4-hour target; raise a CAPA on FRM-007`,
  }[trace.state];
  const traceTone = trace.state === "over" || trace.state === "missed" ? "border-red-500 bg-red-50 text-red-900"
    : trace.state === "met" ? "border-green-600 bg-green-50 text-green-900"
    : trace.state === "running" && trace.remainingMs < 60 * 60 * 1000 ? "border-amber-500 bg-amber-50 text-amber-900"
    : "border-[#C89B3C]/50 bg-white text-[#2A1F0E]";

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className={cn("rounded-md border-2 px-3 py-2", traceTone)}>
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Trace clock</p>
        <p className="text-sm font-semibold">{traceText}</p>
      </div>
      {!mock && type && (
        <div className={cn("rounded-md border-2 px-3 py-2",
          notice.state === "over" ? "border-red-500 bg-red-50 text-red-900" : "border-[#C89B3C]/50 bg-white text-[#2A1F0E]")}>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">24-hour written notice</p>
          {notice.deadline ? (
            <>
              <p className="text-sm font-semibold">
                SQFI and the certification body by {format(notice.deadline, "EEE d MMM, HH:mm")}
                {ticking && (notice.state === "over" ? ` - passed ${formatDuration(notice.remainingMs)} ago` : ` - ${formatDuration(notice.remainingMs)} left`)}
              </p>
              <p className="text-xs opacity-80">
                Needed for a recall, or any food safety event that needs public notification. SQFI: foodsafetycrisis@sqfi.com.
                FDA Reportable Food Registry in the same 24 hours where serious harm is probable.
              </p>
            </>
          ) : <p className="text-sm">Starts from 'Started' (or the decision time, once recorded).</p>}
        </div>
      )}
    </div>
  );
}

function RecallSteps({ control, links, sectionNo }: { control: Control<Values>; links: Record<string, string>; sectionNo: Record<string, string> }) {
  const watched = useWatch({ control, name: STEP_FIELDS as unknown as string[] });
  const values = Object.fromEntries(STEP_FIELDS.map((k, i) => [k, watched[i]]));
  const steps = deriveRecallSteps(values);
  const mock = isMockRecall(values);
  const next = steps.find(s => s.applies && !s.done)?.id;
  const jump = (section: string) => document.getElementById(`form-section-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const libraryLink = (id: string): [string, string] | null =>
    id === "hold" && !mock && links["FRM-702"] ? ["FRM-702 holds", links["FRM-702"]]
    : id === "capa" && links["FRM-007"] ? ["FRM-007 CAPA", links["FRM-007"]] : null;

  return (
    <ol className="space-y-1">
      {steps.map((s, i) => {
        const link = libraryLink(s.id);
        return (
          <li key={s.id} className={cn("flex gap-2 rounded-md px-2 py-1.5", s.id === next && "bg-[#C89B3C]/10", !s.applies && "opacity-50")}>
            {!s.applies ? <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#2A1F0E]/40" />
              : s.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#9A6F1E]" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#2A1F0E]">
                {i + 1}. {s.label}
                {s.id === next && <span className="ml-2 text-xs font-semibold text-[#9A6F1E]">next</span>}
                {!s.applies && <span className="ml-2 text-xs font-normal">not part of a mock recall</span>}
              </p>
              {s.applies && !s.done && <p className="text-xs text-[#2A1F0E]/70">{s.detail}</p>}
            </div>
            {s.applies && (
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <button type="button" onClick={() => jump(s.section)} className="text-xs font-medium text-[#9A6F1E] hover:underline whitespace-nowrap">
                  Go to section{sectionNo[s.section] ? ` ${sectionNo[s.section]}` : ""}
                </button>
                {link && (
                  <a href={`/team/compliance/sops?doc=${link[1]}`} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1 text-xs font-medium text-[#9A6F1E] hover:underline">
                    {link[0]}<ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The record's own trigger as a trace start, read once when the trace is opened. */
function startFromRecord(v: Values): TraceStart | null {
  const first = (s: unknown) => String(s ?? "").split(",")[0].trim();
  if (v.trigger === RECALL_TRIGGERS.material && String(v.material_lot ?? "").trim()) {
    return { kind: "material", lot: String(v.material_lot).trim(), name: String(v.material ?? "").trim() || undefined };
  }
  if (first(v.lot_codes)) {
    const many = String(v.lot_codes).includes(",") || String(v.product ?? "").includes(",");
    return { kind: "lot", lot: first(v.lot_codes), name: many ? undefined : String(v.product ?? "").trim() || undefined };
  }
  if (String(v.material_lot ?? "").trim()) return { kind: "material", lot: String(v.material_lot).trim() };
  return null;
}

function WorkspaceTrace({ form, canEdit }: { form: UseFormReturn<Values>; canEdit: boolean }) {
  const { data, error, loading, reload } = useTraceData();
  const type = useWatch({ control: form.control, name: "record_type" });
  const [initial] = useState(() => startFromRecord(form.getValues()));
  const [undo, setUndo] = useState<Values | null>(null);

  // Like "Copy from a previous entry": the result is unsaved and dirty, and one Undo restores it.
  const apply = (result: TraceResult) => {
    const prev = form.getValues();
    const has = (g: unknown) => Array.isArray(g) && g.some(r => r && Object.entries(r).some(([k, x]) => !k.startsWith("_") && x !== "" && x != null));
    if ((has(prev.trace_back) || has(prev.trace_forward) || has(prev.reconciliation))
      && !window.confirm("Replace the trace and reconciliation already in this record with this one?")) return;
    form.reset({ ...prev, ...toRecordFill(result) }, { keepDefaultValues: true });
    setUndo(prev);
    toast.success("Trace put into the record. Check it against the records, then Save Draft.");
  };

  return (
    <LotTracePanel
      data={data}
      loading={loading}
      error={error}
      onReload={reload}
      initialStart={initial}
      mock={isMockRecall({ record_type: type })}
      emailDraft={() => recallEmailDraft(form.getValues())}
      pdfTitle={() => {
        const v = form.getValues();
        return [RECALL_FORM, v.record_type, v.lot_codes && `lot ${v.lot_codes}`].filter(Boolean).join(" - ");
      }}
      actions={result => canEdit && (
        <div className="rounded-lg border bg-white p-3 space-y-2" style={{ borderColor: HAIR }}>
          {data && data.recallProblems.length > 0 ? (
            <ul className="list-disc pl-5 text-xs text-red-700">{data.recallProblems.map(p => <li key={p}>{p}</li>)}</ul>
          ) : undo ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-[#2A1F0E]">
              <span>The trace is in the record below, unsaved. Count what is on site, fill in the reconciliation, then Save Draft.</span>
              <Button type="button" size="sm" variant="outline" onClick={() => { form.reset(undo, { keepDefaultValues: true }); setUndo(null); }}>
                <Undo2 className="mr-1.5 h-3.5 w-3.5" />Undo
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => apply(result)} disabled={result.lots.length === 0}>Put this trace into the record</Button>
              <span className="text-xs text-muted-foreground">
                Fills What went in, Where it went and the reconciliation. Counts of what is on site are left for you.
              </span>
            </div>
          )}
        </div>
      )}
    />
  );
}

/**
 * The card above an FRM-012 entry (settings.recallWorkspace): which mode this is, the clocks, the
 * steps of FSQM-023 ticked from the record itself, and the lot trace that fills the record.
 * Memoised with stable props, and every changing value is read in a leaf with its own narrow
 * useWatch - FormEntry re-renders on each keystroke and none of that may re-run the trace.
 */
export const RecallWorkspace = memo(function RecallWorkspace({ form, canEdit, schema }: { form: UseFormReturn<Values>; canEdit: boolean; schema: FormSchema }) {
  // The steps and the form's sections are two separate numberings ("step 7" is written down in
  // "section 4"), so the link names the section it goes to - the number printed in its title.
  const sectionNo = useMemo(() => Object.fromEntries(schema.sections.map((s, i) =>
    [s.id, /^\s*(\d+)/.exec(s.title ?? "")?.[1] ?? String(i + 1)])), [schema]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(canEdit);
  useEffect(() => {
    let live = true;
    fetchDocIdsByNumber(["FRM-702", "FRM-007"]).then(l => { if (live) setLinks(l); }).catch(() => { /* links are a convenience */ });
    return () => { live = false; };
  }, []);

  return (
    <div className="rounded-lg border-2 p-4 space-y-3" style={{ borderColor: "rgba(200,155,60,0.6)", background: "#FFFDF7" }}>
      <h2 className="text-base font-semibold text-[#2A1F0E]">Recall workspace</h2>
      <ModeBanner control={form.control} />
      <RecallClock control={form.control} ticking={canEdit} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#9A6F1E]">Steps (FSQM-023) - ticked from this record</p>
        <p className="mb-1 text-xs text-muted-foreground">The steps are in the order you do them. Each link says which section of the form below it is written in.</p>
        <RecallSteps control={form.control} links={links} sectionNo={sectionNo} />
      </div>
      <div className="rounded-md border" style={{ borderColor: HAIR }}>
        <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#C89B3C]/5">
          {open ? <ChevronDown className="h-4 w-4 text-[#9A6F1E]" /> : <ChevronRight className="h-4 w-4 text-[#9A6F1E]" />}
          <span className="text-sm font-medium text-[#2A1F0E]">Trace the lots from the records</span>
        </button>
        {open && <div className="border-t p-3" style={{ borderColor: HAIR }}><WorkspaceTrace form={form} canEdit={canEdit} /></div>}
      </div>
    </div>
  );
});
