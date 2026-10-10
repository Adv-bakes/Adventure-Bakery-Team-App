// Today - the floor's home page (WORKFLOW_ARCHITECTURE.md, Phase 1).
//
// The day in the order it happens: start the day (FRM-903), production (the lots in progress and
// the CCP records), receiving, finished product, shipping, and what needs attention. Every button
// opens an ordinary form entry; this page writes nothing of its own and renders no field. What it
// shows is DERIVED from the records by today.ts, never stored.
//
// The gate (owner, 2026-10-08): no production record opens until today's FRM-903 is SUBMITTED, and
// there is no override. The block is loud and carries the button that resolves it, in the shape
// the owner approved for blocking validation (red panel, says what is missing).
//
// Staff land here instead of the retired operations hub. Admin and owner see the same page plus
// the finished-product actions and the attention card.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, Bell, CheckCircle2, ClipboardCheck, Factory, Flame, Loader2, PackageCheck,
  PackageOpen, Play, ShieldAlert, Sun, Truck, Wind,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createResponse, fetchProfileNames, findDraftForDay, loadTodayRecords } from "@/lib/formResponses";
import { fetchOpenNotifications } from "@/lib/notifications";
import {
  attentionCounts, bakeState, bakingAwaitingReview, ccpToday, lastDispatch, lastReceipt, localDay, lotsInProgress, openHolds,
  ovenLoads, preopState, productionOpen, TODAY_FORMS,
  type LotSummary, type PreopState, type TodayEntry, type TodayRecords,
} from "@/lib/today";
import { TODAY_MSG, type TodayLang } from "@/lib/todayMessages";
import { BakeLoadButton } from "@/components/team/today/BakeLoadButton";
import { SealCheckButton } from "@/components/team/today/SealCheckButton";

const LANG_KEY = "today.lang";
type Doc = { id: string; sop_number: string; revision: string | null; content: any };

const entryHref = (docId: string, responseId: string) =>
  `/team/compliance/forms/${docId}/entries/${responseId}?from=today`;
const startHref = (docId: string) => `/team/compliance/forms/${docId}/start?from=today`;

function timeOf(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Today() {
  const navigate = useNavigate();
  const { role, roles } = useUserRole();
  const isAdmin = role === "admin" || role === "owner";
  const canVoice = roles.some(r => r === "staff" || r === "admin" || r === "owner");

  const [lang, setLang] = useState<TodayLang>(() => {
    try { const v = localStorage.getItem(LANG_KEY); if (v === "en" || v === "es") return v; } catch { /* no storage */ }
    return "en";
  });
  const [langFromProfile, setLangFromProfile] = useState(false);
  const M = TODAY_MSG[lang];

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<TodayRecords | null>(null);
  const [docs, setDocs] = useState<Record<string, Doc>>({});
  const [problems, setProblems] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [attention, setAttention] = useState({ overdue: 0, due: 0, askedOfMe: 0, alerts: 0 });
  const [busy, setBusy] = useState<string | null>(null);

  const today = localDay();

  // The start language is the operator's Training Language, unless they switched it here before.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      if (cancelled) return;
      setUserId(uid);
      if (!uid || langFromProfile) return;
      let stored: string | null = null;
      try { stored = localStorage.getItem(LANG_KEY); } catch { /* no storage */ }
      if (stored) { setLangFromProfile(true); return; }
      const { data } = await supabase.from("profiles").select("preferred_language").eq("id", uid).maybeSingle();
      if (!cancelled) { setLang(data?.preferred_language === "es" ? "es" : "en"); setLangFromProfile(true); }
    })();
    return () => { cancelled = true; };
  }, [langFromProfile]);

  const switchLang = (l: TodayLang) => {
    setLang(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* no storage */ }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ records, docs, problems }, notifications] = await Promise.all([
        loadTodayRecords(),
        fetchOpenNotifications().catch(() => []),
      ]);
      setRecords(records); setDocs(docs); setProblems(problems);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      setAttention(attentionCounts(notifications, uid));
      // Who submitted today's pre-op, for the "submitted at 07:42 by Diana" line.
      const ids = [...new Set(records.preops.flatMap(e => [e.submittedBy, e.createdBy]).filter((x): x is string => !!x))];
      if (ids.length) setNames(Object.fromEntries(await fetchProfileNames(ids)));
    } catch (e) {
      console.error(e);
      toast.error(M.loadError);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const preop: PreopState = useMemo(() => records ? preopState(records.preops, today) : { state: "none" }, [records, today]);
  const open = productionOpen(preop);
  const lots: LotSummary[] = useMemo(() => records ? lotsInProgress(records) : [], [records]);
  const holds: TodayEntry[] = useMemo(() => records ? openHolds(records.holds) : [], [records]);
  const ccp = useMemo(() => records ? ccpToday(records, today) : { baking: null, sealing: [] }, [records, today]);
  const review = useMemo(() => records ? bakingAwaitingReview(records, today) : null, [records, today]);
  const dispatch = useMemo(() => records ? lastDispatch(records.dispatches) : null, [records]);
  const receipt = useMemo(() => records ? lastReceipt(records.receipts) : null, [records]);
  const awaitingRelease = lots.filter(l => l.stage === "awaiting_release");
  const awaitingCollection = lots.filter(l => l.stage === "released");

  const docOf = (kind: keyof typeof TODAY_FORMS): Doc | undefined => docs[TODAY_FORMS[kind].form];

  /** A new FRM-520 for a new lot. Not the /start route: that resumes the newest draft, which is another lot. */
  const startLot = async () => {
    const doc = docOf("lots");
    if (!doc) return;
    setBusy("lot");
    try {
      const r = await createResponse(doc);
      navigate(entryHref(doc.id, r.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start a lot");
      setBusy(null);
    }
  };

  /**
   * Today's day-level record: the caller's draft for today's date if there is one, else a new one
   * dated today. Never the generic /start route - that resumes the NEWEST draft whatever its date,
   * which on the first tablet trial reopened the FRM-903 left from 2026-10-06, so the day's record
   * got submitted with the wrong date and the gate stayed shut.
   */
  const openDayRecord = async (kind: "baking" | "sealing" | "preops") => {
    const doc = docOf(kind);
    if (!doc) return;
    const dateField = kind === "preops" ? "inspection_date" : "production_date";
    setBusy(kind);
    try {
      const existing = await findDraftForDay(doc.id, dateField, today);
      const r = existing ?? await createResponse(doc, { [dateField]: today });
      navigate(entryHref(doc.id, r.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the record");
      setBusy(null);
    }
  };

  const preopDoc = docOf("preops");
  const preopName = preop.state !== "none"
    ? (names[preop.entry.submittedBy ?? ""] ?? names[preop.entry.createdBy ?? ""] ?? (preop.entry.data.released_by?.name ?? ""))
    : "";

  const langSwitch = (
    <div className="flex items-center gap-1 text-xs">
      {(["en", "es"] as TodayLang[]).map(l => (
        <button key={l} type="button" onClick={() => switchLang(l)}
          className={`px-2 py-1 rounded border ${lang === l ? "border-[hsl(var(--tp-gold))] text-[hsl(var(--tp-gold))]" : "border-transparent tp-on-bg-dim hover:text-[#F5F1E6]"}`}>
          {l === "en" ? "English" : "Español"}
        </button>
      ))}
    </div>
  );

  const section = (title: string, icon: React.ReactNode, body: React.ReactNode) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{body}</CardContent>
    </Card>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 tp-fade-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2 tp-on-bg">
            <Sun className="w-5 h-5 text-[hsl(var(--tp-gold))]" />
            {M.title}
            <span className="text-base font-normal tp-on-bg-dim">
              {new Date().toLocaleDateString(lang === "es" ? "es-US" : "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </span>
          </h1>
          <p className="text-sm tp-on-bg-dim mt-1">{M.intro}</p>
        </div>
        {langSwitch}
      </div>

      {problems.length > 0 && (
        <div className="rounded-md border border-amber-500/60 bg-amber-500/10 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium"><AlertTriangle className="w-4 h-4" />{M.mappingProblem}</div>
          <ul className="list-disc ml-6 mt-1">{problems.map(p => <li key={p}>{p}</li>)}</ul>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 tp-on-bg-dim"><Loader2 className="w-4 h-4 animate-spin" /> {M.loading}</div>
      ) : (
        <>
          {/* ---- Start the day ---- */}
          {section(M.startDay, <ClipboardCheck className="w-4 h-4 text-[hsl(var(--tp-gold))]" />, (
            preop.state === "submitted" ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>{M.preopDone(timeOf(preop.entry.submittedAt), preopName)}</span>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to={entryHref(preop.entry.docId, preop.entry.id)}>{M.openPreop}</Link>
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  <span>{preop.state === "draft" ? M.preopDraft : M.preopNotDone}</span>
                </div>
                {preopDoc && (
                  <Button onClick={() => openDayRecord("preops")} disabled={busy === "preops"} size="sm"
                    className="bg-[hsl(var(--tp-gold))] text-[#2A1F0E] hover:bg-[hsl(var(--tp-gold))]/90">
                    {busy === "preops" && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                    {preop.state === "draft" ? M.continuePreop : M.startPreop}
                  </Button>
                )}
              </div>
            )
          ))}

          {/* ---- Production ---- */}
          {section(M.production, <Factory className="w-4 h-4 text-[hsl(var(--tp-gold))]" />, (
            <>
              {!open && (
                <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-destructive">
                    <ShieldAlert className="w-4 h-4" />{M.blockedTitle}
                  </div>
                  <p>{M.blockedBody}</p>
                  {preopDoc && (
                    <Button onClick={() => openDayRecord("preops")} disabled={busy === "preops"} size="sm" variant="destructive">
                      {busy === "preops" && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                      {preop.state === "draft" ? M.continuePreop : M.startPreop}
                    </Button>
                  )}
                </div>
              )}

              {lots.length === 0 ? (
                <p className="text-sm tp-card-dim">{M.noLots}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {lots.map(l => (
                    <li key={l.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-sm">
                        <div className="font-medium">
                          Lot {l.lotCode || "—"} · {l.product || "—"}
                          {l.status === "draft" && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded border tp-card-dim">{M.draft}</span>}
                        </div>
                        <div className="tp-card-dim">
                          {l.bakeDate && <span>{M.bakedOn(l.bakeDate)} · </span>}
                          <span>{M.stage[l.stage] ?? l.stage}</span>
                          {l.onHold && <span className="ml-2 text-destructive font-medium">{M.onHold}</span>}
                        </div>
                      </div>
                      {l.stage === "awaiting_release" || l.stage === "released" ? (
                        <Button asChild variant="outline" size="sm"><Link to={entryHref(l.docId, l.id)}>FRM-520</Link></Button>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Baking comes before the lot record's next step, so its button comes first. */}
                          {canVoice && docOf("baking") && l.lotCode && l.product && (
                            <BakeLoadButton
                              doc={docOf("baking")!} lot={l.lotCode} product={l.product} today={today}
                              state={bakeState(records!, today, l.product, l.lotCode)}
                              lang={lang} disabled={!open} onSaved={load}
                            />
                          )}
                          {canVoice && docOf("sealing") && l.lotCode && l.product && (
                            <SealCheckButton
                              doc={docOf("sealing")!} lot={l.lotCode} product={l.product} today={today}
                              lang={lang} disabled={!open} onSaved={load}
                            />
                          )}
                          <Button asChild size="sm" variant="outline" disabled={!open}>
                            <Link to={entryHref(l.docId, l.id)} aria-disabled={!open} onClick={e => { if (!open) e.preventDefault(); }}>
                              {M.continueLot}
                            </Link>
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={startLot} disabled={!open || !docOf("lots") || busy === "lot"} size="sm"
                  className="bg-[hsl(var(--tp-gold))] text-[#2A1F0E] hover:bg-[hsl(var(--tp-gold))]/90">
                  {busy === "lot" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                  {M.startLot}
                </Button>
                {canVoice && (
                  <>
                    <Button onClick={() => openDayRecord("baking")} disabled={!open || !docOf("baking") || busy === "baking"} size="sm" variant="outline">
                      {busy === "baking" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Flame className="w-4 h-4 mr-1" />}
                      {M.recordOvenLoad}
                    </Button>
                    <Button onClick={() => openDayRecord("sealing")} disabled={!open || !docOf("sealing") || busy === "sealing"} size="sm" variant="outline">
                      {busy === "sealing" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Wind className="w-4 h-4 mr-1" />}
                      {M.recordSealChecks}
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs tp-card-dim">
                {ccp.baking || ccp.sealing.length
                  ? [ccp.baking ? M.ccpBakingToday(ovenLoads(ccp.baking)) : null, ccp.sealing.length ? M.ccpSealingToday(ccp.sealing.length) : null].filter(Boolean).join(" ")
                  : M.ccpTodayNone}
                {review && <span className="ml-1 font-medium text-emerald-700">{M.bake.awaitingReview(review.by)}</span>}
              </p>
            </>
          ))}

          {/* ---- Receiving ---- */}
          {section(M.receiving, <PackageOpen className="w-4 h-4 text-[hsl(var(--tp-gold))]" />, (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm space-y-1">
                <div className="tp-card-dim">{receipt ? M.lastReceipt(receipt.date, receipt.lines, receipt.suppliers.join(", ")) : M.noReceipts}</div>
                <div className={holds.length ? "text-destructive font-medium" : "tp-card-dim"}>{M.holdsOpen(holds.length)}</div>
                {holds.length > 0 && (
                  <ul className="text-xs space-y-0.5">
                    {holds.map(h => (
                      <li key={h.id}>
                        <Link className="text-[hsl(var(--tp-gold))] hover:underline" to={entryHref(h.docId, h.id)}>
                          {h.data.hold_tag_number ? `Tag ${h.data.hold_tag_number}` : "FRM-702"} · {h.data.material_name_description || "—"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {docOf("receipts") && (
                <Button asChild size="sm" variant="outline"><Link to={startHref(docOf("receipts")!.id)}>{M.receiveDelivery}</Link></Button>
              )}
            </div>
          ))}

          {/* ---- Finished product ---- */}
          {section(M.finished, <PackageCheck className="w-4 h-4 text-[hsl(var(--tp-gold))]" />, (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm space-y-1">
                <div className={awaitingRelease.length ? "font-medium" : "tp-card-dim"}>{M.awaitingRelease(awaitingRelease.length)}</div>
                {awaitingRelease.length > 0 && (
                  <ul className="text-xs tp-card-dim">{awaitingRelease.map(l => <li key={l.id}>Lot {l.lotCode} · {l.product}</li>)}</ul>
                )}
                <div className="tp-card-dim">{M.awaitingCollection(awaitingCollection.length)}</div>
              </div>
              {isAdmin && docOf("releases") && (
                <Button asChild size="sm" variant="outline"><Link to={startHref(docOf("releases")!.id)}>{M.release}</Link></Button>
              )}
            </div>
          ))}

          {/* ---- Shipping ---- */}
          {section(M.shipping, <Truck className="w-4 h-4 text-[hsl(var(--tp-gold))]" />, (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm tp-card-dim">
                {dispatch ? M.lastDispatch(dispatch.date, dispatch.customer, dispatch.lots, dispatch.status !== "submitted") : M.noDispatches}
              </div>
              {docOf("dispatches") && (
                <Button asChild size="sm" variant="outline"><Link to={startHref(docOf("dispatches")!.id)}>{M.recordCollection}</Link></Button>
              )}
            </div>
          ))}

          {/* ---- Attention (admin / owner) ---- */}
          {isAdmin && section(M.attention, <Bell className="w-4 h-4 text-[hsl(var(--tp-gold))]" />, (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm flex flex-wrap gap-x-4 gap-y-1">
                <span className={attention.overdue ? "text-destructive font-medium" : "tp-card-dim"}>{M.overdue(attention.overdue)}</span>
                <span className={attention.due ? "" : "tp-card-dim"}>{M.due(attention.due)}</span>
                <span className={attention.askedOfMe ? "font-medium" : "tp-card-dim"}>{M.askedOfYou(attention.askedOfMe)}</span>
                <span className={attention.alerts ? "text-destructive font-medium" : "tp-card-dim"}>{M.alerts(attention.alerts)}</span>
              </div>
              <Button asChild size="sm" variant="outline"><Link to="/team/notifications">{M.openNotifications}</Link></Button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
