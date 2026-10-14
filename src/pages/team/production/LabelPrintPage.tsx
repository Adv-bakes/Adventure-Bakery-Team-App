// The print page a label print request links to (owner, 2026-10-14): opened at the computer the label
// printer is plugged into. It shows the batch's labels for the number of containers asked for, prints
// them, and "The labels are printed" closes the request.

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BatchLabels } from "@/components/team/today/BatchLabels";
import { fetchResponse, type FormResponse } from "@/lib/formResponses";
import { MAX_LABELS } from "@/lib/batchLabel";
import { resolveLabelPrint } from "@/lib/notifications";
import { TODAY_MSG, type TodayLang } from "@/lib/todayMessages";

export default function LabelPrintPage() {
  const { entryId = "" } = useParams<{ entryId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const lang: TodayLang = (() => {
    try { const v = localStorage.getItem("today.lang"); if (v === "en" || v === "es") return v; } catch { /* no storage */ }
    return "en";
  })();
  const L = TODAY_MSG[lang].flow.batch.labels;
  const asked = Math.floor(Number(params.get("count")));
  const count = Number.isInteger(asked) && asked >= 1 && asked <= MAX_LABELS ? asked : 1;
  const fromNotifications = params.get("from") === "notifications";

  const [rec, setRec] = useState<FormResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "unsigned">("loading");
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let on = true;
    fetchResponse(entryId)
      .then(r => {
        if (!on) return;
        if (!r || r.form_number !== "FRM-530") setState("missing");
        else if (r.status !== "submitted") setState("unsigned");
        else { setRec(r); setState("ready"); }
      })
      .catch(e => { console.error(e); if (on) setState("missing"); });
    return () => { on = false; };
  }, [entryId]);

  const printed = async () => {
    setClosing(true);
    try {
      await resolveLabelPrint(entryId);
      toast.success(L.markedPrinted);
      navigate(fromNotifications ? "/team/notifications" : "/team/today");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : L.sendFailed);
      setClosing(false);
    }
  };

  const back = fromNotifications ? "/team/notifications" : "/team/today";
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4 tp-fade-up">
      <Link to={back} className="flex items-center gap-1.5 text-sm font-medium tp-on-bg hover:underline">
        <ArrowLeft className="w-4 h-4" />{fromNotifications ? L.back : TODAY_MSG[lang].flow.backToToday}
      </Link>
      {state === "loading" ? (
        <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--tp-gold))]" />
      ) : state !== "ready" || !rec ? (
        <Card><CardContent className="pt-6 flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />{state === "unsigned" ? L.notSigned : L.notFound}
        </CardContent></Card>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tp-on-bg">{L.pageTitle(String(rec.data?.product ?? ""), String(rec.data?.lot_code ?? ""))}</h1>
          <p className="text-sm tp-on-bg-dim">{L.pageLead}</p>
          <div className="text-[#2A1F0E]">
            <BatchLabels responseId={rec.id} data={rec.data ?? {}} lang={lang} initialCount={count} canSend={false} />
          </div>
          <div className="flex justify-end">
            <Button onClick={printed} disabled={closing} className="bg-[hsl(var(--tp-gold))] text-[#2A1F0E] hover:bg-[hsl(var(--tp-gold))]/90">
              {closing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}{L.printed}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
