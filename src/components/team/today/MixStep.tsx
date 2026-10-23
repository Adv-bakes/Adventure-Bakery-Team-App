// The Mixing step of "Follow this lot": the lot record's (FRM-520) ingredients one screen at a
// time - how many batches, then ingredient by ingredient its lot on the container and its weight
// for every batch, then the rework question.
//
//  - Any number of batches (owner's live test, 2026-10-19: six). The weights of a line are one cell
//    of the record, "B1: 17.49; B2: 17.5" (FRM-520 v3, src/lib/batchWeights.ts).
//  - Ingredient by ingredient, as the floor weighs: the eggs for every batch, then the next one.
//    Each batch's weight is saved as soon as it is entered, so nothing waits for the last batch.
//  - Several people can weigh one lot at once, split by ingredient (owner, 2026-10-23): each tablet
//    chooses which ingredients it weighs (remembered for the tab, never on the record), and every
//    save goes through the database function write_mix_entry, which merges one answer into the
//    record under a lock - so two tablets never overwrite each other.
//  - A weight is never filled in for the person: the formula's figure is shown in grey and is
//    entered only by tapping "Use" or typing it (the owner's rule for anything measured).
//  - A label scan gives the lot code only, into a box the person reads before saving. The
//    ingredient and the brand are the formula's and are never written over.
//  - Which screen is next is read from the record (lotFlow.mixScreens); nothing is stored for it.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Camera, Check, CheckCircle2, ChevronLeft, FilePenLine, FlaskConical, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BatchSheetPickDialog } from "@/components/team/forms/BatchSheetPickDialog";
import { SuggestInput, type SuggestOption } from "@/components/team/forms/SuggestInput";
import { batchSheetFill, type FormulaSource } from "@/lib/batchSheetFill";
import { fetchResponse, loadLotOfferRecords, saveResponseData, StaleResponseError, writeMixEntry, type FormResponse } from "@/lib/formResponses";
import { lotOffers, type ReceiptLine, type UsedLine } from "@/lib/lotOffers";
import { getFormSchema, julianLotCode, valueFields, type GridField } from "@/lib/formSchema";
import {
  applyMixEntry, checkMixMapping, lineWeightsReadable, LOT_FLOW, LOT_SPEC, MIX_QUICK_BATCHES, mixEntryCells, mixLines, mixProgress,
  mixScreenDone, mixScreens, nextMixScreen, noReworkOption, weightsPastBatches,
  type MixChange, type MixLine, type MixScreen, type MixSpec,
} from "@/lib/lotFlow";
import { scanIngredientLot } from "@/lib/mixScan";
import { localDay, type LotSummary } from "@/lib/today";
import { TODAY_MSG, type TodayLang } from "@/lib/todayMessages";

type Doc = { id: string; sop_number: string; revision: string | null; content: any };
type Ingredient = Extract<MixScreen, { kind: "ingredient" }>;

const GOLD = "bg-[#C89B3C] text-[#2A1F0E] hover:bg-[#C89B3C]/90";
const PLAIN = "border-[#2A1F0E]/40 bg-white/70 text-[#2A1F0E] hover:bg-white";
const BIG = "h-12 text-lg bg-white";
const CHOICE = "border border-[#2A1F0E]/40 bg-white text-[#2A1F0E] hover:bg-[#C89B3C]/20";

/** Which ingredients this tab weighs: a list of lines, or null = all of them. */
const onlyKey = (id: string) => `mix.only:${id}`;
const readOnly = (id: string): MixLine[] | null => {
  try {
    const v = JSON.parse(sessionStorage.getItem(onlyKey(id)) ?? "null");
    return Array.isArray(v) && v.length > 0 ? v.filter(x => x && Number.isInteger(x.index) && typeof x.ingredient === "string") : null;
  } catch { return null; }
};

/** What a save sends to write_mix_entry: one line's cells, or a top-level answer (line null). */
type MixWrite = { line: { index: number; ingredient: string; brand: string } | null; set: Record<string, unknown> };
type Outcome = "saved" | "moved" | "record";

/**
 * The tablet's choice as it applies to the record now: lines that are no longer there (moved,
 * renamed, or a choice remembered from another lot) drop out, and a choice with nothing left in it
 * means all of them - never a tablet with nothing to weigh.
 */
const liveChoice = (choice: MixLine[] | null, data: Record<string, any> | null | undefined): MixLine[] | null => {
  if (!choice) return null;
  const lines = mixLines(data);
  const left = choice.filter(c => lines.some(l => l.index === c.index && l.ingredient === c.ingredient && l.brand === c.brand));
  return left.length ? left : null;
};

const screenKey = (s: MixScreen | undefined) => (!s ? "" : s.kind === "ingredient" ? `ingredient:${s.index}` : s.kind);
const sameLine = (a: MixLine, b: MixLine) => a.index === b.index && a.ingredient === b.ingredient && a.brand === b.brand;

export function MixStep({ doc, lot, lang, back, version, onSaved, spec = LOT_SPEC }: {
  doc: Doc;
  /** The record being walked: its id and the form's document id (a lot record, or an FRM-530 batch). */
  lot: Pick<LotSummary, "id" | "docId">;
  lang: TodayLang;
  /** Batches and rework, or the one-batch FRM-530 (BATCH_SPEC). */
  spec?: MixSpec;
  /** The query that brings Back on the full record to this step. */
  back: string;
  /** Counts the page's loads of the records, so the record is read again after each. */
  version: number;
  onSaved: (saved: undefined) => void;
}) {
  const F = TODAY_MSG[lang].flow;
  const X = F.mix;
  const schema = getFormSchema(doc.content);
  const href = `/team/compliance/forms/${lot.docId}/entries/${lot.id}?${back}`;
  const mapping = useMemo(() => checkMixMapping(schema, spec), [schema, spec]);

  const [rec, setRec] = useState<FormResponse | null>(null);
  /** Why the step cannot write here, when it cannot. */
  const [closed, setClosed] = useState<"" | "record" | "submitted">("");
  const [loaded, setLoaded] = useState(false);
  /** The screen in view; null until the record has been read once. */
  const [at, setAt] = useState<number | null>(null);
  const [chosen, setChosen] = useState<MixLine[] | null>(() => readOnly(lot.id));
  const setOnly = (v: MixLine[] | null) => {
    setChosen(v);
    try { sessionStorage.setItem(onlyKey(lot.id), JSON.stringify(v)); } catch { /* no storage */ }
  };
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState("");
  const [picked, setPicked] = useState<MixLine[]>([]);
  const [lotText, setLotText] = useState("");
  /** The weight boxes of the ingredient in view, batch 1 first. */
  const [boxes, setBoxes] = useState<string[]>([]);
  /** Batches whose save is on its way. */
  const [sending, setSending] = useState<Set<number>>(new Set());
  const [unit, setUnit] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<{ reads: string; chips: string[]; none: boolean } | null>(null);
  const [reworkYes, setReworkYes] = useState(false);
  const [picking, setPicking] = useState(false);
  /** Bumped to put the record's own values back into the boxes (after the record changed under the page). */
  const [reset, setReset] = useState(0);
  const scanned = useRef("");
  const file = useRef<HTMLInputElement>(null);
  const live = useRef(true);
  /** The record as the last save left it, for that save's follow-up (state is not updated yet then). */
  const lastSaved = useRef<FormResponse | null>(null);
  /** Saves run one after another, in the order they were made. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => () => { live.current = false; }, []);

  // What the lot box offers: lots used before for the ingredient, and recent deliveries. Loaded once.
  const [offerData, setOfferData] = useState<{ used: UsedLine[]; receipts: ReceiptLine[] } | null>(null);
  useEffect(() => { void loadLotOfferRecords().then(d => { if (live.current) setOfferData(d); }); }, []);

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
          setAt(a => a ?? nextMixScreen(r.data, spec, liveChoice(chosen, r.data)));
        }
      } catch (e) {
        console.error(e);
        if (on) setClosed("record");
      } finally {
        if (on) setLoaded(true);
      }
    })();
    return () => { on = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.id, doc.revision, version, spec]);

  const data = rec?.data;
  const only = useMemo(() => liveChoice(chosen, data), [chosen, data]);
  const screens = useMemo(() => mixScreens(data, spec, only), [data, spec, only]);
  const idx = Math.min(at ?? 0, screens.length - 1);
  const screen = screens[idx];
  const progress = useMemo(() => mixProgress(data, spec), [data, spec]);
  const lines = useMemo(() => mixLines(data), [data]);
  const past = useMemo(() => weightsPastBatches(data, spec), [data, spec]);
  const key = screenKey(screen);

  // A new screen starts from what the record holds for it. The same screen keeps what is being typed.
  useEffect(() => {
    setLotText(screen?.kind === "ingredient" ? screen.lot : "");
    setBoxes(screen?.kind === "ingredient" ? [...screen.weights] : []);
    setUnit(screen?.kind === "ingredient" ? screen.unit : "");
    setCount(progress.batches ? String(progress.batches) : "");
    setPicked(only ?? []);
    setError(""); setScan(null); setReworkYes(false);
    scanned.current = "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reset]);

  // A weight saved since (by this tablet or another) shows up in its box - unless the box holds
  // something typed that is not saved yet, or its save is on its way.
  const shown = useRef<string[]>([]);
  useEffect(() => {
    if (screen?.kind !== "ingredient") { shown.current = []; return; }
    setBoxes(prev => screen.weights.map((w, i) =>
      sending.has(i + 1) || ((prev[i] ?? "") !== (shown.current[i] ?? "")) ? (prev[i] ?? "") : w));
    shown.current = [...screen.weights];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, key]);

  /**
   * Write a change onto the record as it is now. "moved" = the change no longer fits the record.
   * With `via`, through write_mix_entry (anyone on the team, one answer only); the ordinary save
   * (the record's own author) when the function is not on the database yet, or for a whole-table fill.
   */
  const write = async (change: (d: Record<string, any>) => Record<string, any> | null, via?: MixWrite): Promise<Outcome> => {
    if (via) {
      const res = await writeMixEntry(lot.id, via.line, via.set);
      if (res.outcome === "saved") { lastSaved.current = res.response; if (live.current) setRec(res.response); return "saved"; }
      if (res.outcome === "moved") {
        const r = await fetchResponse(lot.id).catch(() => null);
        if (r && live.current) setRec(r);
        return "moved";
      }
      if (res.outcome === "record") return "record";
    }
    const run = async (): Promise<Outcome> => {
      const r = await fetchResponse(lot.id);
      if (!r || r.status !== "draft" || r.form_revision !== doc.revision) return "record";
      const next = change({ ...(r.data ?? {}) });
      if (!next) { if (live.current) setRec(r); return "moved"; }
      const saved = await saveResponseData(r.id, next, r.updated_at);
      lastSaved.current = saved;
      if (live.current) setRec(saved);
      return "saved";
    };
    try { return await run(); }
    catch (e) { if (!(e instanceof StaleResponseError)) throw e; return await run(); }
  };

  /** Say what happened to a save that did not land. */
  const report = (outcome: Outcome) => {
    if (outcome === "moved") { toast.message(X.moved); setReset(n => n + 1); }
    else if (outcome === "record") { toast.message(F.needsRecord); setClosed("record"); }
  };

  /** Run a save that moves the screen on, and say what happened. `then` runs once it is on the record. */
  const commit = async (change: (d: Record<string, any>) => Record<string, any> | null, then: () => void, via?: MixWrite) => {
    if (busy) return;
    setBusy(true);
    try {
      await queue.current;
      const outcome = await write(change, via);
      if (!live.current) return;
      if (outcome === "saved") { then(); onSaved(undefined); }
      else report(outcome);
    } catch (e) {
      console.error(e);
      toast.error(X.saveFailed);
    } finally {
      if (live.current) setBusy(false);
    }
  };

  const saveBatches = (n: number) => {
    if (!Number.isInteger(n) || n < 1) { setError(X.badCount); return; }
    setError("");
    void commit(d => ({ ...d, [LOT_FLOW.batches]: n }), () => setCount(String(n)), { line: null, set: { [LOT_FLOW.batches]: n } });
  };
  const chooseWhich = (v: MixLine[] | null) => {
    if (v && v.length === 0) { setError(X.whichNone); return; }
    setError("");
    setOnly(v);
    setAt(nextMixScreen(data, spec, v));
  };

  // The units the lot record's own Unit column offers.
  const units = useMemo(() => {
    const grid = schema ? valueFields(schema).find(f => f.id === LOT_FLOW.grid) as GridField | undefined : undefined;
    const col = grid?.columns.find(c => c.id === LOT_FLOW.unit) as { options?: unknown[] } | undefined;
    return (col?.options ?? []).map(String);
  }, [schema]);
  /** The unit is the person's to give where the formula sheet gives the line no quantity, or no unit. */
  const asksUnit = (s: Ingredient) => units.length > 0 && (!s.needsWeight || !s.unit);

  const refOf = (s: Ingredient) => ({ index: s.index, ingredient: s.ingredient, brand: s.brand });

  const shortDay = (day: string) => {
    const d = new Date(`${day}T12:00:00`);
    return Number.isNaN(d.getTime()) ? day : d.toLocaleDateString(lang === "es" ? "es-US" : "en-US", { month: "short", day: "numeric" });
  };
  const lotOptions = useMemo<SuggestOption[]>(() => {
    if (!offerData || screen?.kind !== "ingredient") return [];
    return lotOffers({ ingredient: screen.ingredient, brand: screen.brand }, offerData.used, offerData.receipts, { today: localDay(), self: lot.id })
      .map(o => ({
        value: o.lot,
        hint: o.kind === "used" ? X.offerUsed(shortDay(o.date)) : X.offerReceived(shortDay(o.date), o.material ?? "", o.brand ?? ""),
      }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerData, key, lang]);

  /** A weight is a number of 0 or more; "" takes a weight off. Null = not a weight. */
  const readWeight = (typed: string): number | "" | null => {
    const t = typed.trim();
    if (t === "") return "";
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  /**
   * Save one batch's weight as soon as it is entered - queued behind any save still on its way,
   * so the person can go straight on to the next box.
   */
  const saveWeight = (s: Ingredient, batch: number, typed: string) => {
    const w = readWeight(typed);
    if (w === null) { setError(X.badWeight); return; }
    if (String(w) === (s.weights[batch - 1] ?? "")) return;
    if (spec.weights === "list" && !lineWeightsReadable(data, s.index)) { setError(X.unreadable); return; }
    const picksUnit = asksUnit(s) && w !== "";
    if (picksUnit && !unit) { setError(X.needUnit); return; }
    setError("");
    const change: MixChange = { batch, weight: w, ...(picksUnit && unit !== s.unit ? { unit } : {}) };
    const cells = mixEntryCells(change, spec);
    if (!cells) return;
    setSending(prev => new Set(prev).add(batch));
    const job = queue.current.then(async () => {
      try {
        const outcome = await write(d => applyMixEntry(d, refOf(s), change, spec), { line: refOf(s), set: cells });
        if (!live.current) return;
        if (outcome === "saved") onSaved(undefined); else report(outcome);
      } catch (e) {
        console.error(e);
        if (live.current) toast.error(X.saveFailed);
      } finally {
        if (live.current) setSending(prev => { const n = new Set(prev); n.delete(batch); return n; });
      }
    });
    queue.current = job;
  };

  /**
   * Save the lot as soon as it is picked from the list or the box is left - like the weights, so
   * moving to another ingredient (Skip, Back, the step strip) never loses it (owner, 2026-10-23).
   * A lot typed where none was shown is first come, first served: another tablet may have entered
   * it meanwhile, and then theirs stays and the person is told.
   */
  const [sendingLot, setSendingLot] = useState(false);
  const saveLot = (s: Ingredient, typed: string) => {
    const t = typed.trim();
    if (!t || t === s.lot) return;
    const change: MixChange = s.lot ? { lot: t } : { lotIfBlank: t };
    const cells = mixEntryCells(change, spec);
    if (!cells) return;
    setSendingLot(true);
    const job = queue.current.then(async () => {
      try {
        const outcome = await write(d => applyMixEntry(d, refOf(s), change, spec), { line: refOf(s), set: cells });
        if (!live.current) return;
        if (outcome !== "saved") { report(outcome); return; }
        onSaved(undefined);
        const kept = String(lastSaved.current?.data?.[LOT_FLOW.grid]?.[s.index]?.[LOT_FLOW.lot] ?? "").trim();
        if (!s.lot && kept && kept !== t) { toast.warning(X.lotKept(kept, t), { duration: 15000 }); setLotText(kept); }
      } catch (e) {
        console.error(e);
        if (live.current) toast.error(X.saveFailed);
      } finally {
        if (live.current) setSendingLot(false);
      }
    });
    queue.current = job;
  };

  /** "Save and next": the lot if it changed, any box not yet saved, then the next ingredient. */
  const saveIngredient = async (s: Ingredient) => {
    const typedLot = lotText.trim();
    if (!typedLot) { setError(X.needLot); return; }
    const weights = boxes.map(readWeight);
    if (weights.some(w => w === null)) { setError(X.badWeight); return; }
    if (s.needsWeight && weights.some(w => w === "")) { setError(X.badWeight); return; }
    const anyWeight = weights.some(w => w !== "");
    if (asksUnit(s) && anyWeight && !unit) { setError(X.needUnit); return; }
    boxes.forEach((b, i) => saveWeight(s, i + 1, b));
    await queue.current;
    if (!live.current) return;
    if (typedLot === s.lot && !(asksUnit(s) && unit && unit !== s.unit)) { setAt(idx + 1); return; }
    // A lot typed where none was shown is first come, first served: the other tablet may have
    // entered it meanwhile, and then theirs stays.
    const change: MixChange = {
      ...(typedLot !== s.lot ? (s.lot ? { lot: typedLot } : { lotIfBlank: typedLot }) : {}),
      ...(asksUnit(s) && unit && unit !== s.unit ? { unit } : {}),
    };
    const cells = mixEntryCells(change, spec);
    void commit(
      d => applyMixEntry(d, refOf(s), change, spec),
      () => {
        const kept = String(lastSaved.current?.data?.[LOT_FLOW.grid]?.[s.index]?.[LOT_FLOW.lot] ?? "").trim();
        if (!s.lot && kept && kept !== typedLot) toast.warning(X.lotKept(kept, typedLot), { duration: 15000 });
        setAt(idx + 1);
      },
      cells ? { line: refOf(s), set: cells } : undefined,
    );
  };

  const takePhoto = async (photo: File | undefined) => {
    if (file.current) file.current.value = "";
    if (!photo || !rec || scanning) return;
    setScanning(true);
    try {
      const r = await scanIngredientLot(rec.id, photo);
      if (!live.current) return;
      const chips = [...r.alternates];
      // The lot goes into the box only when the box is empty or still holds an earlier scan:
      // something typed is kept, and the reading is offered beside it.
      if (r.lot) {
        if (lotText.trim() === "" || lotText.trim() === scanned.current) { setLotText(r.lot); scanned.current = r.lot; setError(""); }
        else if (r.lot !== lotText.trim()) chips.unshift(r.lot);
      }
      setScan({ reads: r.reads, chips, none: !r.lot && chips.length === 0 });
    } catch (e) {
      console.error(e);
      toast.error(X.scanFailed);
    } finally {
      if (live.current) setScanning(false);
    }
  };

  const cfg = schema?.settings?.batchSheet;
  const fromFormula = (source: FormulaSource) => {
    setPicking(false);
    if (!cfg || !schema) return;
    const grid = valueFields(schema).find(f => f.id === cfg.grid) as GridField | undefined;
    const columns = (grid?.columns ?? []).map(c => c.id);
    let filled = 0, warnings: string[] = [];
    void commit(
      d => {
        const res = batchSheetFill(cfg, columns, d, source);
        filled = res.lines; warnings = res.warnings;
        // A record started blank has no bake date: a lot started here is today's, and the date
        // gives the lot code (the form's own rule). A date or a code already there is kept.
        const v = res.values;
        if (!String(v[spec.dateField] ?? "").trim() && !String(v[LOT_FLOW.lotCode] ?? "").trim()) {
          const day = localDay();
          v[spec.dateField] = day;
          v[LOT_FLOW.lotCode] = julianLotCode(day) ?? "";
        }
        return v;
      },
      () => {
        toast.success(X.formulaFilled(filled));
        for (const w of warnings) toast.message(w);
        setAt(a => a ?? 0);
      },
    );
  };

  const openRecord = (
    <Button asChild variant="outline" className={PLAIN}>
      <Link to={href}><FilePenLine className="w-4 h-4 mr-1.5" />{spec.batches ? F.openLotRecord : F.batch.openRecord}</Link>
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
  if (closed === "record" || mapping.length > 0 || !rec) {
    return (
      <div className="space-y-4">
        {amber(mapping.length > 0 ? X.mapping(mapping.join(", ")) : F.needsRecord)}
        {openRecord}
      </div>
    );
  }

  // A lot record started blank has no lines to walk through: they come from the formula sheet.
  if (progress.lines === 0) {
    return (
      <div className="space-y-4">
        {amber(X.noLines)}
        <div className="flex flex-wrap gap-2">
          {cfg && (
            <Button type="button" className={GOLD} disabled={busy} onClick={() => setPicking(true)}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <FlaskConical className="w-4 h-4 mr-1.5" />}{X.fromFormula}
            </Button>
          )}
          {openRecord}
        </div>
        {cfg && (
          <BatchSheetPickDialog open={picking} onOpenChange={setPicking} formNumber={cfg.source} onPick={fromFormula}
            title={X.fromFormula} description={TODAY_MSG[lang].pickFormula} />
        )}
      </div>
    );
  }

  const skipped = screens.filter(s => s.kind !== "rework" && !mixScreenDone(data, s, spec)).length;
  const saving = busy || sending.size > 0 || sendingLot;
  const nav = (save?: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <div className="flex flex-wrap gap-2">
        {idx > 0 && (
          <Button type="button" variant="outline" className={PLAIN} disabled={busy} onClick={() => setAt(idx - 1)}>
            <ChevronLeft className="w-4 h-4 mr-1" />{X.back}
          </Button>
        )}
        {openRecord}
      </div>
      <div className="flex flex-wrap gap-2">
        {idx < screens.length - 1 && screen.kind !== "batches" && (
          <Button type="button" variant="ghost" className="text-[#2A1F0E] hover:bg-black/5" disabled={busy} onClick={() => setAt(idx + 1)}>{X.skip}</Button>
        )}
        {save}
      </div>
    </div>
  );
  const status = progress.batches > 0 && (
    <p className={`flex items-center gap-1.5 text-sm ${progress.state === "done" ? "font-medium text-emerald-800" : "opacity-80"}`}>
      {progress.state === "done" && <CheckCircle2 className="w-4 h-4" />}
      {progress.state === "done" ? X.done : F.mixingProgress(progress.linesDone, progress.lines)}
    </p>
  );
  const whichLine = spec.batches && (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">{only ? X.onlySome(only.length, lines.length) : X.onlyAll}</span>
      <button type="button" className="underline underline-offset-2 hover:opacity-80" onClick={() => setAt(0)}>{X.changeWhich}</button>
    </p>
  );

  if (screen.kind === "batches") {
    const typed = Number(count.trim());
    return (
      <div className="space-y-4">
        {status}
        <div>
          <p className="text-lg font-semibold">{X.batchesQ}</p>
          <p className="text-sm opacity-80">{X.batchesHelp}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {MIX_QUICK_BATCHES.map(n => (
            <Button key={n} type="button" disabled={busy} onClick={() => saveBatches(n)} aria-pressed={progress.batches === n}
              className={`h-16 px-6 text-xl ${progress.batches === n ? GOLD : CHOICE}`}>
              {n}
            </Button>
          ))}
        </div>
        {/* Any other number is typed: there is no upper limit. */}
        <form className="flex flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); saveBatches(typed); }}>
          <label htmlFor="mix-count" className="text-sm font-medium">{X.countLabel}</label>
          <Button type="button" variant="outline" className={`h-12 w-12 p-0 ${PLAIN}`} disabled={busy}
            onClick={() => setCount(String(Math.max(1, (Number.isInteger(typed) ? typed : 0) - 1)))} aria-label="-1"><Minus className="w-4 h-4" /></Button>
          <Input id="mix-count" type="number" inputMode="numeric" min={1} step={1} value={count} disabled={busy}
            onChange={e => { setCount(e.target.value); setError(""); }} className={`${BIG} w-24 text-center`} />
          <Button type="button" variant="outline" className={`h-12 w-12 p-0 ${PLAIN}`} disabled={busy}
            onClick={() => setCount(String((Number.isInteger(typed) && typed > 0 ? typed : 0) + 1))} aria-label="+1"><Plus className="w-4 h-4" /></Button>
          <Button type="submit" className={`h-12 ${GOLD}`} disabled={busy || typed === progress.batches}>
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}{X.setCount}
          </Button>
          {progress.batches > 0 && <span className="text-sm opacity-80">{X.batchN(progress.batches)}</span>}
        </form>
        {past > 0 && amber(X.pastBatches(past))}

        {progress.batches > 0 && (
          <div className="space-y-3 border-t border-[#2A1F0E]/15 pt-4">
            <div>
              <p className="text-lg font-semibold">{X.whichQ}</p>
              <p className="text-sm opacity-80">{X.whichHelp}</p>
            </div>
            <Button type="button" disabled={busy} onClick={() => chooseWhich(null)} aria-pressed={only == null}
              className={`h-14 px-6 text-lg ${only == null ? GOLD : CHOICE}`}>
              {X.whichAll}
            </Button>
            <div className="space-y-2">
              <p className="text-sm font-medium">{X.whichSome}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {lines.map(l => {
                  const on = picked.some(p => sameLine(p, l));
                  return (
                    <label key={l.index} className={`flex items-center gap-3 rounded-md border px-3 py-2 text-base cursor-pointer ${on ? "border-[#C89B3C] bg-[#C89B3C]/15" : "border-[#2A1F0E]/25 bg-white/70"}`}>
                      <input type="checkbox" className="h-5 w-5 accent-[#C89B3C]" checked={on}
                        onChange={() => setPicked(prev => on ? prev.filter(p => !sameLine(p, l)) : [...prev, l])} />
                      <span>{l.ingredient}{l.brand && <span className="opacity-70"> · {l.brand}</span>}</span>
                    </label>
                  );
                })}
              </div>
              <Button type="button" variant="outline" className={PLAIN} disabled={busy || picked.length === 0}
                onClick={() => chooseWhich(picked)}>{X.whichGo}</Button>
            </div>
          </div>
        )}
        {error && <p className="text-sm font-medium text-red-700">{error}</p>}
        {nav(progress.batches > 0
          ? <Button type="button" className={GOLD} disabled={busy} onClick={() => setAt(idx + 1)}>{F.next}</Button> : undefined)}
      </div>
    );
  }

  if (screen.kind === "rework") {
    const answer = String(data?.[LOT_FLOW.rework] ?? "").trim();
    const no = noReworkOption(schema);
    return (
      <div className="space-y-4">
        {status}
        <p className="text-lg font-semibold">{X.reworkQ}</p>
        {answer && <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800"><CheckCircle2 className="w-4 h-4" />{X.answered(answer)}</p>}
        <div className="flex flex-wrap gap-3">
          {no && (
            <Button type="button" disabled={busy} onClick={() => commit(d => ({ ...d, [LOT_FLOW.rework]: no }), () => setReworkYes(false), { line: null, set: { [LOT_FLOW.rework]: no } })}
              className={`h-14 px-6 text-lg ${GOLD}`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}{X.reworkNo}
            </Button>
          )}
          <Button type="button" variant="outline" disabled={busy} onClick={() => setReworkYes(true)} aria-pressed={reworkYes} className={`h-14 px-6 text-lg ${PLAIN}`}>
            {X.reworkYes}
          </Button>
        </div>
        {reworkYes && (
          <div className="rounded-md border border-amber-500 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
            <p>{X.reworkYesBody}</p>
            <Button asChild className={GOLD}><Link to={href}><FilePenLine className="w-4 h-4 mr-1.5" />{spec.batches ? F.openLotRecord : F.batch.openRecord}</Link></Button>
          </div>
        )}
        {skipped > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {amber(X.stillOpen(skipped))}
            <Button type="button" variant="outline" className={PLAIN} onClick={() => setAt(nextMixScreen(data, spec, only))}>{X.goToOpen}</Button>
          </div>
        )}
        {nav()}
      </div>
    );
  }

  const s = screen;
  const many = spec.batches;
  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); void saveIngredient(s); }}>
      <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { void takePhoto(e.target.files?.[0]); }} />
      {/* Where the person is says enough here; the count of complete lines is on the first and last screens. */}
      <p className="text-sm font-medium opacity-80">{many ? X.where(s.position, s.of, s.weights.length) : X.whereOne(s.position, s.of)}</p>
      {whichLine}
      <div>
        <p className="text-2xl font-semibold leading-tight">{s.ingredient}</p>
        {s.brand && <p className="text-sm opacity-80">{s.brand}</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="mix-lot" className="block text-sm font-medium">{X.lotLabel}</label>
        <div className="flex flex-wrap items-center gap-2">
          {/* An offer of the lots on record - used before, then received - never a closed list. */}
          <div className="w-full max-w-sm">
            <SuggestInput id="mix-lot" value={lotText} onChange={v => { setLotText(v); setError(""); }} options={lotOptions}
              onPick={v => saveLot(s, v)}
              emptyText={offerData ? X.offersEmpty : undefined} className={BIG} disabled={busy} />
          </div>
          <Button type="button" variant="outline" className={`h-12 ${PLAIN}`} disabled={busy || scanning} onClick={() => file.current?.click()}>
            {scanning ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Camera className="w-4 h-4 mr-1.5" />}{scanning ? X.scanning : X.scan}
          </Button>
          {sendingLot ? <Loader2 className="w-4 h-4 animate-spin text-[#C89B3C]" />
            : s.lot !== "" && lotText.trim() === s.lot && <span className="flex items-center gap-1 text-xs font-medium text-emerald-800"><Check className="w-4 h-4" />{X.saved}</span>}
        </div>
        {scan?.reads && <p className="text-sm opacity-80">{X.scanReads(scan.reads)}</p>}
        {scan?.none && amber(X.scanNone)}
        {scan && scan.chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="opacity-80">{X.scanOffer}</span>
            {scan.chips.map(c => (
              <button key={c} type="button" onClick={() => { setLotText(c); setError(""); }}
                className="rounded-full border border-[#C89B3C] bg-white px-3 py-1 font-medium hover:bg-[#C89B3C]/20">{c}</button>
            ))}
          </div>
        )}
        {many && s.lot && <p className="text-xs opacity-70">{X.otherLot}</p>}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium">{many ? X.weightsHelp : X.weighedOne}</p>
          {asksUnit(s) ? (
            <select aria-label={X.unitLabel} value={unit} disabled={busy} onChange={e => { setUnit(e.target.value); setError(""); }}
              className="h-11 rounded-md border border-input bg-white px-3 text-base">
              <option value="">{X.unitLabel}</option>
              {[...new Set([...units, ...(unit ? [unit] : [])])].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          ) : s.unit && <span className="text-base font-medium">{s.unit}</span>}
        </div>
        <p className="text-xs opacity-70">{s.needsWeight ? X.formula(s.expected, s.unit) : X.optionalWeight}</p>
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
          {boxes.map((value, i) => {
            const batch = i + 1;
            const savedHere = value.trim() !== "" && value.trim() === (s.weights[i] ?? "") && !sending.has(batch);
            return (
              <div key={batch} className="flex items-center gap-2 rounded-md border border-[#2A1F0E]/15 bg-white/60 px-2 py-1.5">
                <label htmlFor={`mix-w-${batch}`} className="w-20 shrink-0 text-sm font-medium">{many ? X.weightLabel(batch) : X.weighedOne}</label>
                {/* The formula's figure is a grey hint only: the box stays empty until it is typed or taken with the link. */}
                <Input id={`mix-w-${batch}`} type="number" inputMode="decimal" step="any" min={0} value={value} placeholder={s.expected}
                  enterKeyHint="next" disabled={busy}
                  onChange={e => { const v = e.target.value; setBoxes(prev => prev.map((p, j) => (j === i ? v : p))); setError(""); }}
                  onBlur={() => saveWeight(s, batch, value)}
                  onKeyDown={e => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    saveWeight(s, batch, value);
                    document.getElementById(`mix-w-${batch + 1}`)?.focus();
                  }}
                  className="h-11 w-28 bg-white text-lg" />
                {sending.has(batch) ? <Loader2 className="w-4 h-4 animate-spin text-[#C89B3C]" />
                  : savedHere ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-800"><Check className="w-4 h-4" />{X.saved}</span>
                  : s.needsWeight && value.trim() === "" && (
                    <button type="button" disabled={busy} onClick={() => {
                      setBoxes(prev => prev.map((p, j) => (j === i ? s.expected : p)));
                      saveWeight(s, batch, s.expected);
                    }} className="whitespace-nowrap text-sm font-medium underline underline-offset-2 text-[#7a5a14] hover:text-[#2A1F0E]">{X.takeFigure(s.expected, s.unit)}</button>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
      {nav(
        <Button type="submit" className={`h-12 px-6 text-base ${GOLD}`} disabled={saving || scanning}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}{X.save}
        </Button>,
      )}
    </form>
  );
}
