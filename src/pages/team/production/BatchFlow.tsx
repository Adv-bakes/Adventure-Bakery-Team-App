// A batch made on site for use in other products - the simple syrup made in the kettle - taken step by
// step (owner, 2026-10-14). The short sibling of "Follow this lot" (LotFlow.tsx): two steps, the
// ingredients (the mixing screens, one batch, no rework) and Finish and sign. It writes the
// Intermediate Batch Record, FRM-530, and nothing is stored for the flow.
//
// Opened from "Start a lot step by step" when the formula sheet picked says "Made on site for use in
// other products", and from the batch's line on the Today page.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, CircleDot, FilePenLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { MixStep } from "@/components/team/today/MixStep";
import {
  fetchProfileNames, fetchResponse, loadTodayRecords, saveResponseData, StaleResponseError, submitResponse, type FormResponse,
} from "@/lib/formResponses";
import { buildZodSchema, deriveDateValue, emptyValues, getFormSchema, valueFields, type FormSchema, type GridField } from "@/lib/formSchema";
import { BATCH_SPEC, mixProgress } from "@/lib/lotFlow";
import { TODAY_FORMS, type TodayRecords } from "@/lib/today";
import { TODAY_MSG, type TodayLang } from "@/lib/todayMessages";

type Doc = { id: string; sop_number: string; revision: string | null; content: any };
type Step = "ingredients" | "finish";

const LANG_KEY = "today.lang";
const GOLD = "bg-[#C89B3C] text-[#2A1F0E] hover:bg-[#C89B3C]/90";
const PLAIN = "border-[#2A1F0E]/40 bg-white/70 text-[#2A1F0E] hover:bg-white";

/** The single map of FRM-530's answer keys this page writes. Rename a field, update this. */
const BATCH_FORM = {
  form: "FRM-530",
  product: "product",
  lotCode: "lot_code",
  madeOn: "made_on",
  quantity: "quantity_made",
  useBy: "use_by",
  labelled: "container_labelled",
  notes: "batch_notes",
  signature: "made_by",
} as const;

/** What still stops the batch record being submitted, in the form's own words. */
function missingAnswers(schema: FormSchema, values: Record<string, any>, line: (table: string, n: number, column: string) => string): string[] {
  const res = buildZodSchema(schema).safeParse(values);
  if (res.success) return [];
  const fields = new Map(valueFields(schema).map(f => [f.id, f]));
  const out: string[] = [];
  for (const issue of res.error.issues) {
    const f = fields.get(String(issue.path[0]));
    if (!f) continue;
    const col = f.type === "grid" && typeof issue.path[1] === "number" && issue.path[2] !== undefined
      ? (f as GridField).columns.find(c => c.id === issue.path[2]) : undefined;
    out.push(col ? line(f.label, Number(issue.path[1]) + 1, col.label) : f.label);
  }
  return [...new Set(out)];
}

/** The use-by the form's own rule gives (date made + 30 days), from the field's `derive`. */
function derivedUseBy(schema: FormSchema | null, madeOn: unknown): string {
  const f = schema ? valueFields(schema).find(x => x.id === BATCH_FORM.useBy) as any : undefined;
  return f?.derive ? deriveDateValue(f.derive, madeOn) ?? "" : "";
}

function FinishStep({ doc, entryId, lang, version, onDone }: {
  doc: Doc; entryId: string; lang: TodayLang; version: number; onDone: () => void;
}) {
  const B = TODAY_MSG[lang].flow.batch;
  const F = TODAY_MSG[lang].flow;
  const schema = getFormSchema(doc.content);
  const [rec, setRec] = useState<FormResponse | null>(null);
  const [closed, setClosed] = useState<"" | "record" | "submitted">("");
  const [signer, setSigner] = useState<{ id: string; name: string } | null>(null);
  const [quantity, setQuantity] = useState("");
  const [useBy, setUseBy] = useState("");
  const [labelled, setLabelled] = useState(false);
  const [notes, setNotes] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const id = data?.user?.id ?? "";
        const name = id ? (await fetchProfileNames([id]).catch(() => new Map<string, string>())).get(id) ?? "" : "";
        const r = await fetchResponse(entryId);
        if (!on) return;
        setSigner(id && name ? { id, name } : null);
        if (!r || (r.status === "draft" && r.form_revision !== doc.revision)) { setClosed("record"); return; }
        setRec(r);
        if (r.status !== "draft") { setClosed("submitted"); return; }
        setClosed("");
        const d = r.data ?? {};
        setQuantity(String(d[BATCH_FORM.quantity] ?? ""));
        // The use-by is notation, not a measurement: the form's own rule fills it while it is blank.
        setUseBy(String(d[BATCH_FORM.useBy] ?? "") || derivedUseBy(schema, d[BATCH_FORM.madeOn]));
        setLabelled(d[BATCH_FORM.labelled] === true);
        setNotes(String(d[BATCH_FORM.notes] ?? ""));
      } catch (e) {
        console.error(e);
        if (on) setClosed("record");
      }
    })();
    return () => { on = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, version]);

  const submit = async () => {
    if (!schema || !signer || busy) return;
    setBusy(true);
    const run = async () => {
      const r = await fetchResponse(entryId);
      if (!r || r.status !== "draft" || r.form_revision !== doc.revision) { setClosed("record"); return; }
      const values: Record<string, any> = {
        ...emptyValues(schema), ...(r.data ?? {}),
        [BATCH_FORM.quantity]: quantity.trim(),
        [BATCH_FORM.useBy]: useBy,
        [BATCH_FORM.labelled]: labelled,
        [BATCH_FORM.notes]: notes,
      };
      if (!values[BATCH_FORM.signature]?.signed_at) {
        values[BATCH_FORM.signature] = { user_id: signer.id, name: signer.name, signed_at: new Date().toISOString() };
      }
      const gaps = missingAnswers(schema, values, F.missingLine);
      if (gaps.length) {
        // Keep what was typed on the record, so nothing is lost while the gap is fixed - but no signature.
        const { [BATCH_FORM.signature]: _sig, ...unsigned } = values;
        setRec(await saveResponseData(r.id, { ...unsigned, [BATCH_FORM.signature]: r.data?.[BATCH_FORM.signature] ?? null }, r.updated_at));
        setMissing(gaps);
        return;
      }
      await submitResponse(r.id, buildZodSchema(schema).parse(values), r.updated_at);
      toast.success(B.submitted(String(values[BATCH_FORM.product] ?? ""), String(values[BATCH_FORM.lotCode] ?? ""), useBy));
      onDone();
    };
    try { await run(); }
    catch (e) {
      if (e instanceof StaleResponseError) { try { await run(); } catch (e2) { console.error(e2); toast.error(B.failed); } }
      else { console.error(e); toast.error(B.failed); }
    } finally {
      setBusy(false);
    }
  };

  const href = `/team/compliance/forms/${doc.id}/entries/${entryId}?from=today`;
  const openRecord = (
    <Button asChild variant="outline" className={PLAIN}>
      <Link to={href}><FilePenLine className="w-4 h-4 mr-1.5" />{B.openRecord}</Link>
    </Button>
  );

  if (closed === "submitted") {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800"><CheckCircle2 className="w-4 h-4" />{B.done(String(rec?.data?.[BATCH_FORM.useBy] ?? ""))}</p>
        {openRecord}
      </div>
    );
  }
  if (closed === "record") {
    return (
      <div className="space-y-4">
        <p className="flex items-start gap-1.5 text-sm text-amber-800"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{B.needsRecord}</p>
        {openRecord}
      </div>
    );
  }
  if (!rec) return <Loader2 className="w-5 h-5 animate-spin text-[#C89B3C]" />;

  return (
    <div className="space-y-4">
      <p className="text-sm">{B.finishLead}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="batch-qty" className="block text-sm font-medium">{B.quantityMade}</label>
          <Input id="batch-qty" value={quantity} onChange={e => setQuantity(e.target.value)} className="h-12 text-lg bg-white" disabled={busy} />
          <p className="text-xs opacity-70">{B.quantityHelp}</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="batch-useby" className="block text-sm font-medium">{B.useBy}</label>
          <Input id="batch-useby" type="date" value={useBy} onChange={e => setUseBy(e.target.value)} className="h-12 text-lg bg-white" disabled={busy} />
          <p className="text-xs opacity-70">{B.useByHelp}</p>
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-md border border-[#2A1F0E]/20 bg-white/70 p-3 text-base">
        <Checkbox checked={labelled} onCheckedChange={v => setLabelled(v === true)} disabled={busy} className="mt-1 h-5 w-5" />
        <span>{B.labelled}</span>
      </label>
      <div className="space-y-1.5">
        <label htmlFor="batch-notes" className="block text-sm font-medium">{B.notes}</label>
        <Textarea id="batch-notes" value={notes} onChange={e => setNotes(e.target.value)} className="bg-white" disabled={busy} />
      </div>
      {missing.length > 0 && (
        <div className="rounded-md border border-amber-500 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">{F.missing}</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">{missing.map(m => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
      <div className="flex flex-wrap justify-between gap-2">
        {openRecord}
        {signer && (
          <Button onClick={submit} disabled={busy} className={`h-12 px-6 text-base ${GOLD}`}>
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}{B.signAndSubmit(signer.name)}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function BatchFlow() {
  const { entryId = "" } = useParams<{ entryId: string }>();
  const [params, setParams] = useSearchParams();
  const [lang, setLang] = useState<TodayLang>(() => {
    try { const v = localStorage.getItem(LANG_KEY); if (v === "en" || v === "es") return v; } catch { /* no storage */ }
    return "en";
  });
  const M = TODAY_MSG[lang];
  const B = M.flow.batch;
  const switchLang = (l: TodayLang) => { setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* no storage */ } };

  const [records, setRecords] = useState<TodayRecords | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      const { records, docs } = await loadTodayRecords();
      setRecords(records); setDoc(docs[TODAY_FORMS.intermediates.form] ?? null); setVersion(v => v + 1);
      return records;
    } catch (e) {
      console.error(e);
      setFailed(true);
      return null;
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Sized for the tablet, as the lot page is.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.fontSize;
    root.style.fontSize = "clamp(16px, 1.5vw, 22px)";
    return () => { root.style.fontSize = before; };
  }, []);

  const entry = useMemo(() => records?.intermediates.find(e => e.id === entryId) ?? null, [records, entryId]);
  const mixed = mixProgress(entry?.data, BATCH_SPEC).state === "done";
  const submitted = entry?.status === "submitted";
  const asked = params.get("step");
  const step: Step = asked === "ingredients" || asked === "finish" ? asked : mixed || submitted ? "finish" : "ingredients";
  const go = (s: Step) => setParams({ step: s }, { replace: true });

  const onMixed = async () => {
    const fresh = await load();
    const now = fresh?.intermediates.find(e => e.id === entryId);
    if (now && mixProgress(now.data, BATCH_SPEC).state === "done") go("finish");
  };

  const steps: { key: Step; state: "done" | "open" | "none" }[] = [
    { key: "ingredients", state: mixed || submitted ? "done" : mixProgress(entry?.data, BATCH_SPEC).state },
    { key: "finish", state: submitted ? "done" : "none" },
  ];

  return (
    <div className="team-portal team-portal-bg min-h-screen" lang={lang}>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link to="/team/today" className="flex items-center gap-1.5 text-sm font-medium tp-on-bg hover:underline">
            <ArrowLeft className="w-4 h-4" />{M.flow.backToToday}
          </Link>
          <div className="flex items-center gap-1 text-xs">
            {(["en", "es"] as TodayLang[]).map(l => (
              <button key={l} type="button" onClick={() => switchLang(l)} aria-pressed={lang === l}
                className={`px-2.5 py-1 rounded border font-medium ${lang === l ? "border-[hsl(var(--tp-gold))] bg-[hsl(var(--tp-gold))] text-[#2A1F0E]" : "border-[#F5F1E6]/60 bg-black/35 text-[#F5F1E6] hover:bg-black/55"}`}>
                {l === "en" ? "English" : "Español"}
              </button>
            ))}
          </div>
        </div>

        {!records ? (
          <div className="flex items-center gap-2 tp-on-bg py-10">
            {failed ? <><AlertTriangle className="w-5 h-5" />{M.loadError}</> : <><Loader2 className="w-5 h-5 animate-spin" />{M.loading}</>}
          </div>
        ) : !entry || !doc ? (
          <p className="tp-on-bg py-10">{B.notFound}</p>
        ) : (
          <>
            <h1 className="text-2xl md:text-3xl font-semibold tp-on-bg">{B.title(String(entry.data.product ?? ""), String(entry.data.lot_code ?? ""))}</h1>
            <ol className="flex flex-wrap gap-2">
              {steps.map((s, i) => {
                const current = s.key === step;
                const Icon = s.state === "done" ? CheckCircle2 : s.state === "open" ? CircleDot : Circle;
                return (
                  <li key={s.key}>
                    <button type="button" onClick={() => go(s.key)} aria-current={current ? "step" : undefined} title={M.flow.state[s.state]}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${current
                        ? "border-[#C89B3C] bg-[#C89B3C] text-[#2A1F0E]" : "border-[#F5F1E6]/50 bg-black/35 text-[#F5F1E6] hover:bg-black/55"}`}>
                      <Icon className={`w-4 h-4 ${current ? "" : s.state === "done" ? "text-emerald-400" : s.state === "open" ? "text-amber-300" : "opacity-60"}`} />
                      {i + 1}. {B.step[s.key]}
                    </button>
                  </li>
                );
              })}
            </ol>
            <div key={step} className="rounded-xl bg-[#F5F1E6] text-[#2A1F0E] p-5 md:p-6 shadow-lg">
              <h2 className="text-xl font-semibold mb-3">{steps.findIndex(s => s.key === step) + 1}. {B.step[step]}</h2>
              {step === "ingredients"
                ? <MixStep doc={doc} lot={{ id: entry.id, docId: doc.id }} lang={lang} back="from=today" version={version} onSaved={() => { void onMixed(); }} spec={BATCH_SPEC} />
                : <FinishStep doc={doc} entryId={entry.id} lang={lang} version={version} onDone={() => { void load(); }} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
