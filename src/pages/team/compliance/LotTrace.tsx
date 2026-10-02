import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createResponse } from "@/lib/formResponses";
import { RECALL_FORM, RECALL_TYPES, toRecordFill, type TraceResult } from "@/lib/lotTrace";
import { LotTracePanel, useTraceData } from "@/components/team/trace/LotTracePanel";

/**
 * Compliance > Traceability: trace a supplier lot or one of our lots across the records
 * (FSQM-021), and start a mock recall or recall record (FRM-012, FSQM-023) from the result.
 * The everyday use is the quick question - a supplier's notice arrives, who got that lot? -
 * answered before anybody has decided to open a recall.
 */
export default function LotTrace() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useTraceData();
  const [creating, setCreating] = useState<string | null>(null);

  const startRecord = async (result: TraceResult, recordType: string) => {
    const doc = data?.docs[RECALL_FORM];
    if (!doc || creating) return;
    setCreating(recordType);
    try {
      const prefill = { ...toRecordFill(result), record_type: recordType, started: format(new Date(), "yyyy-MM-dd'T'HH:mm") };
      const resp = await createResponse(doc, prefill);
      navigate(`/team/compliance/forms/${doc.id}/entries/${resp.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't start the record");
      setCreating(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 tp-fade-up">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2 tp-on-bg">
          <ClipboardCheck className="w-5 h-5 text-[hsl(var(--tp-gold))]" />
          Traceability
        </h1>
        <p className="text-sm tp-on-bg-dim mt-1">
          Trace a supplier lot forward to every lot of ours it went into, or one of our lots back to its
          supplier lots and forward to the customers who collected it. The records are pulled from the
          Production Lot Records (FRM-520), receiving (FRM-301), dispatch (FRM-801), retention (FRM-703),
          release (FRM-701), holds (FRM-702) and the contact list (FRM-011).
        </p>
      </div>

      <div className="rounded-lg border p-4" style={{ borderColor: "rgba(200,155,60,0.3)", background: "#FFFFFF" }}>
        <LotTracePanel
          data={data}
          loading={loading}
          error={error}
          onReload={reload}
          actions={result => (
            <div className="rounded-lg border bg-white p-3 space-y-2" style={{ borderColor: "rgba(200,155,60,0.35)" }}>
              <p className="text-sm font-semibold text-[#2A1F0E]">Start a record from this trace (FRM-012)</p>
              {data && data.recallProblems.length > 0 ? (
                <div className="text-xs text-red-700 space-y-0.5">
                  <p>A record cannot be started from here yet - FRM-012 is not set up for it:</p>
                  <ul className="list-disc pl-5">{data.recallProblems.map(p => <li key={p}>{p}</li>)}</ul>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    The record opens with this trace already in it, and the 4-hour clock starts now. Nothing is sent to anybody.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" disabled={!!creating} onClick={() => startRecord(result, RECALL_TYPES.mock)}>
                      {creating === RECALL_TYPES.mock && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Start a mock recall record
                    </Button>
                    <Button type="button" variant="outline" disabled={!!creating} onClick={() => startRecord(result, RECALL_TYPES.withdrawal)}>
                      {creating === RECALL_TYPES.withdrawal && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Start a withdrawal record
                    </Button>
                    <Button type="button" className="bg-red-700 hover:bg-red-800 text-white" disabled={!!creating} onClick={() => startRecord(result, RECALL_TYPES.recall)}>
                      {creating === RECALL_TYPES.recall && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Start a recall record
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        />
      </div>
    </div>
  );
}
