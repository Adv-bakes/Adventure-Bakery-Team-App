// "Release" on a lot's row of the Today page, once the lot is awaiting release: the steps that
// lead to the release, in order, each with what the records say about it.
//
//   1. the lot record (FRM-520)            2. the baking record that carries its oven loads (FRM-507)
//   3. its seal check records (FRM-606)    4. its retention sample (FRM-703)
//   5. the release record (FRM-701)
//
// Every state is read from the records (releaseSteps in today.ts) and nothing is stored: a step is
// ticked when its record is submitted, amber when it is still a draft to review, and "none yet"
// when there is no record. Choosing a step opens that record. The retention sample and the release
// record are STARTED from here when there is none, with the lot and product filled in - on the
// release record that is what lets the helper look the rest up without picking the lot again.
// The retention sample is also started with what the records can answer (retentionStart.ts): the
// bar code digits, the customer, the best-by date and the discard date.
//
// Shown to admins and owners only: FSQM-020 has the SQF Practitioner alone release product.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleDashed, Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createResponse, fetchResponse, saveResponseData } from "@/lib/formResponses";
import { getFormSchema } from "@/lib/formSchema";
import { blanksFilled, retentionDefaults } from "@/lib/retentionStart";
import type { LotSummary, ReleaseStep, ReleaseStepKey } from "@/lib/today";
import { TODAY_MSG, type TodayLang } from "@/lib/todayMessages";

type Doc = { id: string; sop_number: string; revision: string | null; content: any };

export function ReleaseButton({ lot, steps, docs, lang }: {
  lot: LotSummary;
  steps: ReleaseStep[];
  /** The forms a step may have to start an entry on. */
  docs: { retention?: Doc; release?: Doc };
  lang: TodayLang;
}) {
  const R = TODAY_MSG[lang].releaseSteps;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const href = (docId: string, id: string) => `/team/compliance/forms/${docId}/entries/${id}?from=today`;

  const go = async (step: ReleaseStep) => {
    // A retention sample already started but not finished: what the records can now answer is put
    // into its BLANK answers before it opens. Nothing typed is touched.
    if (step.key === "retention" && step.state === "open" && step.entryId && step.docId) {
      setBusy(true);
      try {
        const r = await fetchResponse(step.entryId);
        if (r && r.status === "draft") {
          const add = blanksFilled(r.data, await retentionDefaults(lot, getFormSchema(docs.retention?.content)));
          if (Object.keys(add).length) await saveResponseData(r.id, { ...(r.data ?? {}), ...add }, r.updated_at);
        }
      } catch (e) {
        console.error(e);   // the record still opens; it is only missing the looked-up answers
      }
      navigate(href(step.docId, step.entryId));
      return;
    }
    if (step.entryId && step.docId) { navigate(href(step.docId, step.entryId)); return; }
    // Only the last two are started from here; a missing production record is not made up after the fact.
    const doc = step.key === "retention" ? docs.retention : step.key === "release" ? docs.release : undefined;
    if (!doc) { toast.message(R.noRecord[step.key]); return; }
    setBusy(true);
    try {
      const prefill = step.key === "retention"
        ? await retentionDefaults(lot, getFormSchema(doc.content))
        : { product_name: lot.product, lot_code: lot.lotCode };
      const r = await createResponse(doc, prefill);
      navigate(href(doc.id, r.id));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : R.startFailed);
      setBusy(false);
    }
  };

  const icon = (s: ReleaseStep) => s.state === "done"
    ? <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-700 shrink-0" />
    : s.state === "open"
      ? <AlertTriangle className="w-4 h-4 mr-2 text-amber-600 shrink-0" />
      : <CircleDashed className="w-4 h-4 mr-2 opacity-60 shrink-0" />;
  const startable = (k: ReleaseStepKey) => k === "retention" || k === "release";
  const status = (s: ReleaseStep) => s.state === "done" ? R.done : s.state === "open" ? R.open : startable(s.key) ? R.start : R.none;
  const ready = steps.slice(0, -1).every(s => s.state === "done");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={busy} className={ready ? "border-[#C89B3C] bg-[#C89B3C]/10" : ""}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <PackageCheck className="w-4 h-4 mr-1" />}
          {R.button}
          <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-[22rem]">
        <DropdownMenuLabel className="text-xs font-normal opacity-80">{R.heading}</DropdownMenuLabel>
        {steps.map((s, i) => (
          <div key={s.key}>
            {s.key === "release" && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={() => go(s)} className="items-start">
              {icon(s)}
              <span className="flex-1">
                <span className="block">{i + 1}. {R.step[s.key]}</span>
                <span className={`block text-xs ${s.state === "open" ? "text-amber-700" : "opacity-70"}`}>{status(s)}</span>
              </span>
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
