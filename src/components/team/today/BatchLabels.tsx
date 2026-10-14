// Container labels for a signed batch made on site (FRM-530): how many containers, each label's share
// of the quantity, Print here, and - because the label printer is on a USB cable at one computer
// (owner, 2026-10-14) - Send to the label printer, which asks a named person there to print them.
// Used on the batch's Finish and sign step and on the print page the request links to.

import { useEffect, useState } from "react";
import { Loader2, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labelBatchFrom, labelPages, labelQuantity, MAX_LABELS } from "@/lib/batchLabel";
import { printBatchLabels } from "@/lib/batchLabelPdf";
import { fetchTeamSigners, requestLabelPrint, type Signatory } from "@/lib/notifications";
import { useUserPref } from "@/lib/userPrefs";
import { TODAY_MSG, type TodayLang } from "@/lib/todayMessages";

const GOLD = "bg-[#C89B3C] text-[#2A1F0E] hover:bg-[#C89B3C]/90";
const PLAIN = "border-[#2A1F0E]/40 bg-white/70 text-[#2A1F0E] hover:bg-white";

export function BatchLabels({ responseId, data, lang, initialCount = 1, canSend = true, onPrinted }: {
  responseId: string;
  /** The signed FRM-530 entry's answers. */
  data: Record<string, any>;
  lang: TodayLang;
  initialCount?: number;
  /** Offer Send to the label printer (not on the print page itself). */
  canSend?: boolean;
  /** Called after the labels were opened to print. */
  onPrinted?: () => void;
}) {
  const L = TODAY_MSG[lang].flow.batch.labels;
  const [count, setCount] = useState(String(initialCount));
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [people, setPeople] = useState<Signatory[] | null>(null);
  // Who this person last sent labels to: the person at the printer computer, on any device.
  const [printerPref, setPrinterPref] = useUserPref<string>("labels.printer", "");
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");
  const n = Math.floor(Number(count));
  const valid = Number.isInteger(n) && n >= 1 && n <= MAX_LABELS;
  const batch = labelBatchFrom(data);
  const each = valid ? labelQuantity(batch.quantityMade, n) : null;

  useEffect(() => { setCount(String(initialCount)); }, [initialCount]);
  useEffect(() => {
    if (!sending || people) return;
    fetchTeamSigners().then(setPeople).catch(e => { console.error(e); setPeople([]); });
  }, [sending, people]);
  useEffect(() => {
    if (people && !who) setWho(people.some(p => p.id === printerPref) ? printerPref : "");
  }, [people, printerPref, who]);

  const print = async () => {
    if (!valid || busy) return;
    // Opened in the tap itself: a window opened after the PDF is built would be blocked.
    const win = window.open("", "_blank");
    setBusy(true);
    try {
      await printBatchLabels(labelPages(batch, n), win);
      onPrinted?.();
    } catch (e) {
      console.error(e);
      win?.close();
      toast.error(L.failed);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!valid || !who || busy) return;
    setBusy(true);
    try {
      await requestLabelPrint(responseId, n, who, note.trim() || undefined);
      setPrinterPref(who);
      toast.success(L.sent(n, people?.find(p => p.id === who)?.name ?? ""));
      setSending(false); setNote("");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : L.sendFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-[#2A1F0E]/20 bg-white/70 p-3 space-y-2">
      <p className="text-sm font-medium">{L.lead}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="label-count" className="text-sm">{L.count}</label>
        <Input id="label-count" type="number" inputMode="numeric" min={1} max={MAX_LABELS} step={1} value={count}
          onChange={e => setCount(e.target.value)} className="h-12 w-24 text-lg bg-white" disabled={busy} />
        <Button type="button" onClick={print} disabled={!valid || busy} className={`h-12 px-5 ${GOLD}`}>
          {busy && !sending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Printer className="w-4 h-4 mr-1.5" />}{L.print(valid ? n : 1)}
        </Button>
        {canSend && (
          <Button type="button" variant="outline" onClick={() => setSending(v => !v)} disabled={busy} aria-expanded={sending} className={`h-12 px-5 ${PLAIN}`}>
            <Send className="w-4 h-4 mr-1.5" />{L.sendToPrinter}
          </Button>
        )}
      </div>
      <p className="text-sm opacity-80">{!valid ? L.badCount(MAX_LABELS) : each ? L.each(each) : L.noQuantity(batch.quantityMade)}</p>
      {canSend && sending && (
        <div className="rounded-md border border-[#C89B3C]/60 bg-[#C89B3C]/10 p-3 space-y-2">
          <p className="text-sm">{L.sendLead}</p>
          {people === null ? <Loader2 className="w-4 h-4 animate-spin text-[#C89B3C]" /> : (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="label-who" className="text-sm">{L.sendTo}</label>
              <select id="label-who" value={who} onChange={e => setWho(e.target.value)} disabled={busy}
                className="h-11 rounded-md border border-input bg-white px-3 text-base">
                <option value="">{L.choose}</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder={L.notePlaceholder} className="bg-white" disabled={busy} maxLength={200} />
          <div className="flex justify-end">
            <Button type="button" onClick={send} disabled={!valid || !who || busy} className={GOLD}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}{L.send(valid ? n : 1)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
