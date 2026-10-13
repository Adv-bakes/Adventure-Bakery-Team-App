// "Release" on a lot's row of the Today page, once the lot is awaiting release: the steps that
// lead to the release, in order, each with what the records say about it.
//
//   1. the lot record (FRM-520)            2. the baking record that carries its oven loads (FRM-507)
//   3. its seal check records (FRM-606)    4. its retention sample (FRM-703)
//   5. the release record (FRM-701)
//
// Every state is read from the records (releaseSteps in today.ts) and nothing is stored: a step is
// ticked when its record is submitted, amber when it is still a draft to review, and "none yet"
// when there is no record. THE RETENTION SAMPLE IS THE EXCEPTION: its record stays a draft for as
// long as the sample is on the shelf, so it is ticked once "Sample taken by" is signed.
// Choosing a step opens that record. The retention sample and the release
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
import { releaseStepHref } from "@/lib/releaseStart";
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

  const go = async (step: ReleaseStep) => {
    setBusy(true);
    try {
      const href = await releaseStepHref(step, lot, docs);
      if (href) { navigate(href); return; }
      toast.message(R.noRecord[step.key]);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : R.startFailed);
    }
    setBusy(false);
  };

  const icon = (s: ReleaseStep) => s.state === "done"
    ? <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-700 shrink-0" />
    : s.state === "open"
      ? <AlertTriangle className="w-4 h-4 mr-2 text-amber-600 shrink-0" />
      : <CircleDashed className="w-4 h-4 mr-2 opacity-60 shrink-0" />;
  const startable = (k: ReleaseStepKey) => k === "retention" || k === "release";
  const status = (s: ReleaseStep) => s.sample
    ? (s.sample.stage === "started" ? R.sampleStarted : s.sample.stage === "on_shelf" ? R.sampleOnShelf(s.sample.discardDue) : R.sampleDisposed)
    : s.state === "done" ? R.done : s.state === "open" ? R.open : startable(s.key) ? R.start : R.none;
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
