// The Dunking step of "Follow this lot", between Baking and Seal checks: the lot of each ingredient
// the formula sheet marks "Added at: Dunking" (the simple syrup and the rum), one line at a time.
//
//  - The lines are the lot record's (FRM-520) own ingredient lines, carried from the formula sheet
//    with a hidden marker (lotFlow.isDunkLine). They are left out of Mixing and asked for here.
//  - The lot is what matters for a recall. What a lot absorbs is not weighed, so the amount used is
//    optional free text, kept in the line's Notes ("Amount used: 2 gal").
//  - A second lot of an ingredient (a new bottle of rum part way through) is a second line, added
//    at the end of the table with "Another lot of ...".
//  - Each Save writes that one line onto the record as it is NOW, as the mixing step does.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Camera, CheckCircle2, ChevronLeft, FilePenLine, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchResponse, saveResponseData, StaleResponseError, type FormResponse } from "@/lib/formResponses";
import { addDunkLot, applyMixEntry, dunkProgress, dunkScreens, nextDunkScreen, removeDunkLine, type DunkScreen } from "@/lib/lotFlow";
import { scanIngredientLot } from "@/lib/mixScan";
import { syrupLotsFor, type LotSummary, type TodayRecords } from "@/lib/today";
import { normLot } from "@/lib/releaseAssist";
import { TODAY_MSG, type TodayLang } from "@/lib/todayMessages";

type Doc = { id: string; sop_number: string; revision: string | null; content: any };

const GOLD = "bg-[#C89B3C] text-[#2A1F0E] hover:bg-[#C89B3C]/90";
const PLAIN = "border-[#2A1F0E]/40 bg-white/70 text-[#2A1F0E] hover:bg-white";
const BIG = "h-12 text-lg bg-white";

export function DunkStep({ doc, lot, lang, back, version, onSaved, records, today }: {
  doc: Doc; lot: LotSummary; lang: TodayLang;
  /** The day's records, for the batches made on site (FRM-530) a line can be offered. */
  records: TodayRecords;
  today: string;
  /** The query that brings Back on the full record to this step. */
  back: string;
  /** Counts the page's loads of the records, so the record is read again after each. */
  version: number;
  onSaved: (saved: undefined) => void;
}) {
  const F = TODAY_MSG[lang].flow;
  const X = F.dunk;
  const M = F.mix;
  const B = F.batch;
  const href = `/team/compliance/forms/${lot.docId}/entries/${lot.id}?${back}`;

  const [rec, setRec] = useState<FormResponse | null>(null);
  const [closed, setClosed] = useState<"" | "record" | "submitted">("");
  const [loaded, setLoaded] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [lotText, setLotText] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<{ reads: string; chips: string[]; none: boolean } | null>(null);
  const [reset, setReset] = useState(0);
  const scanned = useRef("");
  const file = useRef<HTMLInputElement>(null);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await fetchResponse(lot.id);
        if (!on) return;
        if (!r || (r.status === "draft" && r.form_revision !== doc.revision)) { setClosed("record"); }
        else if (r.status !== "draft") { setClosed("submitted"); }
        else {
          setClosed("");
          setRec(r);
          setAt(a => a ?? nextDunkScreen(r.data));
        }
      } catch (e) {
        console.error(e);
        if (on) setClosed("record");
      } finally {
        if (on) setLoaded(true);
      }
    })();
    return () => { on = false; };
  }, [lot.id, doc.revision, version]);

  const data = rec?.data;
  const screens = useMemo(() => dunkScreens(data), [data]);
  const idx = Math.max(0, Math.min(at ?? 0, screens.length - 1));
  const screen: DunkScreen | undefined = screens[idx];
  const progress = useMemo(() => dunkProgress(data), [data]);
  const key = screen ? `${screen.index}:${screen.ingredient}` : "";

  // A new screen starts from what the record holds for it. The same screen keeps what is being typed.
  useEffect(() => {
    setLotText(screen?.lot ?? "");
    setAmount(screen?.amount ?? "");
    setError(""); setScan(null);
    scanned.current = "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reset]);

  /** Write a change onto the record as it is now. "moved" = the change no longer fits the record. */
  const write = async (change: (d: Record<string, any>) => Record<string, any> | null): Promise<"saved" | "moved" | "record"> => {
    const run = async (): Promise<"saved" | "moved" | "record"> => {
      const r = await fetchResponse(lot.id);
      if (!r || r.status !== "draft" || r.form_revision !== doc.revision) return "record";
      const next = change({ ...(r.data ?? {}) });
      if (!next) { if (live.current) setRec(r); return "moved"; }
      const saved = await saveResponseData(r.id, next, r.updated_at);
      if (live.current) setRec(saved);
      return "saved";
    };
    try { return await run(); }
    catch (e) { if (!(e instanceof StaleResponseError)) throw e; return await run(); }
  };

  const commit = async (change: (d: Record<string, any>) => Record<string, any> | null, then: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await write(change);
      if (!live.current) return;
      if (outcome === "saved") { then(); onSaved(undefined); }
      else if (outcome === "moved") { toast.message(M.moved); setReset(n => n + 1); }
      else { toast.message(F.needsRecord); setClosed("record"); }
    } catch (e) {
      console.error(e);
      toast.error(M.saveFailed);
    } finally {
      if (live.current) setBusy(false);
    }
  };

  const ref = (s: DunkScreen) => ({ index: s.index, ingredient: s.ingredient, brand: s.brand });

  const save = (s: DunkScreen) => {
    const typed = lotText.trim();
    if (!typed) { setError(M.needLot); return; }
    setError("");
    void commit(d => applyMixEntry(d, ref(s), { lot: typed, amount }), () => setAt(Math.min(idx + 1, screens.length - 1)));
  };

  const another = (s: DunkScreen) => {
    let added = -1;
    // Whatever is typed on this line is saved with it, so the first lot is never lost to the tap.
    const typed = lotText.trim();
    void commit(
      d => {
        const kept = typed || amount.trim() ? applyMixEntry(d, ref(s), { lot: typed, amount }) : d;
        const res = kept && addDunkLot(kept, ref(s));
        if (!res) return null;
        added = res.index;
        return res.values;
      },
      () => {
        toast.message(X.added(s.ingredient));
        // The new line is the last dunking line of the table, so the last screen.
        if (added >= 0) setAt(Number.MAX_SAFE_INTEGER);
      },
    );
  };

  const remove = (s: DunkScreen) => commit(d => removeDunkLine(d, ref(s)), () => setAt(Math.max(0, idx - 1)));

  const takePhoto = async (photo: File | undefined) => {
    if (file.current) file.current.value = "";
    if (!photo || !rec || scanning) return;
    setScanning(true);
    try {
      const r = await scanIngredientLot(rec.id, photo);
      if (!live.current) return;
      const chips = [...r.alternates];
      // As at mixing: the lot goes into the box only when it is empty or still holds an earlier scan.
      if (r.lot) {
        if (lotText.trim() === "" || lotText.trim() === scanned.current) { setLotText(r.lot); scanned.current = r.lot; setError(""); }
        else if (r.lot !== lotText.trim()) chips.unshift(r.lot);
      }
      setScan({ reads: r.reads, chips, none: !r.lot && chips.length === 0 });
    } catch (e) {
      console.error(e);
      toast.error(M.scanFailed);
    } finally {
      if (live.current) setScanning(false);
    }
  };

  const openRecord = (
    <Button asChild variant="outline" className={PLAIN}>
      <Link to={href}><FilePenLine className="w-4 h-4 mr-1.5" />{F.openLotRecord}</Link>
    </Button>
  );
  const amber = (text: string) => (
    <p className="flex items-start gap-1.5 text-sm text-amber-800"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{text}</p>
  );

  if (!loaded) return <Loader2 className="w-5 h-5 animate-spin text-[#C89B3C]" />;
  if (closed === "submitted") {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800"><CheckCircle2 className="w-4 h-4" />{X.submitted}</p>
        {openRecord}
      </div>
    );
  }
  if (closed === "record" || !rec || !screen) {
    return (
      <div className="space-y-4">
        {amber(F.needsRecord)}
        {openRecord}
      </div>
    );
  }

  const s = screen;
  // Syrup made on site: its batches (FRM-530) are offered by name; a bought syrup has none and is typed or scanned.
  const offers = syrupLotsFor(records, s.ingredient, today).slice(0, 5);
  const chosen = offers.find(o => normLot(o.lotCode) === normLot(lotText) && lotText.trim() !== "");
  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); save(s); }}>
      <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { void takePhoto(e.target.files?.[0]); }} />
      <div className="space-y-1">
        <p className="text-sm opacity-80">{X.lead}</p>
        <p className="text-sm font-medium opacity-80">{X.where(s.position, s.of)}</p>
        {progress.state === "done" && <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800"><CheckCircle2 className="w-4 h-4" />{X.done}</p>}
      </div>
      <div>
        <p className="text-2xl font-semibold leading-tight">{s.ingredient}</p>
        {s.brand && <p className="text-sm opacity-80">{s.brand}</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="dunk-lot" className="block text-sm font-medium">{M.lotLabel}</label>
        {offers.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm opacity-80">{B.offer}</p>
            <div className="flex flex-wrap gap-2">
              {offers.map(o => (
                <button key={o.id} type="button" disabled={busy} onClick={() => { setLotText(o.lotCode); setError(""); }}
                  aria-pressed={chosen?.id === o.id}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-medium ${chosen?.id === o.id ? "border-[#C89B3C] bg-[#C89B3C]/25" : "border-[#2A1F0E]/30 bg-white hover:bg-[#C89B3C]/15"} ${o.expired ? "text-amber-900" : ""}`}>
                  {B.offerLine(o.lotCode, o.madeOn || "—", o.useBy || "—")}
                  {o.status !== "submitted" && <span className="ml-1 font-normal opacity-70">({B.draft})</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Input id="dunk-lot" value={lotText} onChange={e => { setLotText(e.target.value); setError(""); }} autoComplete="off" autoCapitalize="characters"
            className={`${BIG} max-w-xs`} disabled={busy} />
          <Button type="button" variant="outline" className={`h-12 ${PLAIN}`} disabled={busy || scanning} onClick={() => file.current?.click()}>
            {scanning ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Camera className="w-4 h-4 mr-1.5" />}{scanning ? M.scanning : M.scan}
          </Button>
        </div>
        {chosen?.expired && amber(B.expired(chosen.useBy))}
        {scan?.reads && <p className="text-sm opacity-80">{M.scanReads(scan.reads)}</p>}
        {scan?.none && amber(M.scanNone)}
        {scan && scan.chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="opacity-80">{M.scanOffer}</span>
            {scan.chips.map(c => (
              <button key={c} type="button" onClick={() => { setLotText(c); setError(""); }}
                className="rounded-full border border-[#C89B3C] bg-white px-3 py-1 font-medium hover:bg-[#C89B3C]/20">{c}</button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="dunk-amount" className="block text-sm font-medium">{X.amountLabel}</label>
        <Input id="dunk-amount" value={amount} onChange={e => setAmount(e.target.value)} autoComplete="off" className={`${BIG} w-48`} disabled={busy} />
        <p className="text-xs opacity-70">{X.amountHelp}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className={PLAIN} disabled={busy} onClick={() => another(s)}>
          <Plus className="w-4 h-4 mr-1.5" />{X.anotherLot(s.ingredient)}
        </Button>
        {s.twin && !s.lot && !s.amount && (
          <Button type="button" variant="outline" className={PLAIN} disabled={busy} onClick={() => { void remove(s); }}>
            <Trash2 className="w-4 h-4 mr-1.5" />{X.removeLine}
          </Button>
        )}
      </div>

      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex flex-wrap gap-2">
          {idx > 0 && (
            <Button type="button" variant="outline" className={PLAIN} disabled={busy} onClick={() => setAt(idx - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" />{M.back}
            </Button>
          )}
          {openRecord}
        </div>
        <div className="flex flex-wrap gap-2">
          {idx < screens.length - 1 && (
            <Button type="button" variant="ghost" className="text-[#2A1F0E] hover:bg-black/5" disabled={busy} onClick={() => setAt(idx + 1)}>{M.skip}</Button>
          )}
          <Button type="submit" className={`h-12 px-6 text-base ${GOLD}`} disabled={busy || scanning}>
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}{M.save}
          </Button>
        </div>
      </div>
    </form>
  );
}
