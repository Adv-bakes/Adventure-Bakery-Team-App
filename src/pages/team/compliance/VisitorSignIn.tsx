// Visitor sign-in (FRM-905 + FRM-906) as one short screen on a tablet the host is logged into.
//
// A visitor reads and signs the GMP acknowledgement (FRM-906) on their FIRST visit. It stays valid
// for twelve months, or until FRM-906 is revised. After that they find themselves by phone number,
// its last four digits, or name, and answer only the two health questions. Every visit writes an
// FRM-905 entry that records which acknowledgement it relied on.
//
// NOTHING IS WRITTEN UNTIL THE HOST CONFIRMS, and both entries are then inserted already
// submitted. A draft would leave the visitor's signature and health declaration editable by the
// host for as long as the visitor is on site. The time out is added later by sign_out_visitor,
// which can write that one value and nothing else.
//
// The wording a visitor reads — the rules, the questions, the statements they sign against — comes
// from the two forms' own schemas, so this page cannot drift from the controlled documents.
//
// The decisions (who matches a lookup, whether an acknowledgement still counts, what each entry
// contains) are in src/lib/visitors.ts and tested by scripts/test-visitors.mjs.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, DoorOpen, Loader2, LogOut, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  buildZodSchema, emptyValues, getFormSchema,
  type FormField, type FormSchema, type InfoField, type PassFailField, type ReferenceTableField,
  type SelectField, type SignatureField,
} from "@/lib/formSchema";
import {
  createSubmittedResponse, fetchProfileNames, fetchVisitorIndex, fetchVisitorsOnSite, signOutVisitor,
  type VisitorOnSite,
} from "@/lib/formResponses";
import {
  VISITOR_FORMS, ackState, addMonthsIso, buildAckData, buildSignInData, findVisitorMatches,
  isRefused, isVisitorFlowSchema, localDate, localTime,
  type AckRecord, type Host, type VisitAnswers, type VisitorMatch,
} from "@/lib/visitors";
import { SignaturePad } from "@/components/team/forms/SignaturePad";

const cardStyle = { background: "#FFFFFF", borderColor: "rgba(200,155,60,0.25)" };

interface VisitorDoc {
  id: string;
  sop_number: string | null;
  revision: string | null;
  schema: FormSchema;
}

type Step = "home" | "lookup" | "details" | "health" | "rules" | "sign" | "host";

const BLANK: VisitAnswers = {
  name: "", company: "", phone: "", purpose: "", areas: "",
  noSymptoms: "pass", woundsCovered: "na", healthNotes: "", escortName: "", signatureImage: "",
};

// Supabase errors are plain objects with a message, not Error instances.
const messageOf = (e: unknown, fallback: string) => (e as { message?: string } | null)?.message ?? fallback;

const fieldOf = <T extends FormField>(schema: FormSchema, id: string) =>
  schema.sections.flatMap(s => s.fields).find(f => f.id === id) as T | undefined;

const prettyDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d
    ? new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : iso;
};

/** Load both active visitor forms. Called at the start of every sign-in so a tablet left open
 *  overnight never writes against a revision that has since been superseded. */
async function loadVisitorDocs(): Promise<{ signIn: VisitorDoc; ack: VisitorDoc } | null> {
  const { data, error } = await supabase
    .from("sop_documents")
    .select("id, sop_number, revision, content")
    .in("sop_number", [VISITOR_FORMS.signIn, VISITOR_FORMS.acknowledgement])
    .eq("status", "active");
  if (error) throw error;
  const pick = (num: string): VisitorDoc | null => {
    const row = (data ?? []).find(d => d.sop_number === num);
    const schema = row ? getFormSchema(row.content) : null;
    return row && schema && isVisitorFlowSchema(schema)
      ? { id: row.id, sop_number: row.sop_number, revision: row.revision, schema }
      : null;
  };
  const signIn = pick(VISITOR_FORMS.signIn);
  const ack = pick(VISITOR_FORMS.acknowledgement);
  return signIn && ack ? { signIn, ack } : null;
}

/** Large, tablet-sized answer buttons for one question. */
function Choice({ value, onChange, options }: {
  value: string | null;
  onChange: (v: string) => void;
  options: Array<{ key: string; label: string; tone: "good" | "bad" | "neutral" }>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const on = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.key)}
            className={cn(
              "min-h-12 rounded-md border px-4 py-2 text-sm font-medium transition-colors",
              on && o.tone === "good" && "bg-green-600 text-white border-green-600",
              on && o.tone === "bad" && "bg-red-600 text-white border-red-600",
              on && o.tone === "neutral" && "bg-[#2A1F0E] text-white border-[#2A1F0E]",
              !on && "bg-white text-[#2A1F0E] border-[#2A1F0E]/25 hover:bg-[#C89B3C]/10",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function VisitorSignIn() {
  const [docs, setDocs] = useState<{ signIn: VisitorDoc; ack: VisitorDoc } | null>(null);
  const [host, setHost] = useState<Host | null>(null);
  const [index, setIndex] = useState<AckRecord[]>([]);
  const [onSite, setOnSite] = useState<VisitorOnSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);

  const [step, setStep] = useState<Step>("home");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<VisitorMatch | null>(null);
  const [answers, setAnswers] = useState<VisitAnswers>(BLANK);
  const [health, setHealth] = useState<{ symptoms: string | null; wounds: string | null }>({ symptoms: null, wounds: null });
  const [rulesRead, setRulesRead] = useState(false);
  // The acknowledgement written by a sign-in whose second write failed: a retry must rely on it,
  // not sign a second one.
  const [ackWritten, setAckWritten] = useState<{ id: string; ackDate: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState<string | null>(null);

  const today = localDate(new Date());
  const set = (patch: Partial<VisitAnswers>) => setAnswers(a => ({ ...a, ...patch }));

  const refresh = useCallback(async () => {
    const loaded = await loadVisitorDocs();
    setDocs(loaded);
    setNotReady(!loaded);
    if (!loaded) return null;
    const [ix, here] = await Promise.all([
      fetchVisitorIndex(loaded.ack.id),
      fetchVisitorsOnSite(loaded.signIn.id, addMonthsIso(localDate(new Date()), -1)),
    ]);
    setIndex(ix);
    setOnSite(here);
    return loaded;
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (user) {
          const names = await fetchProfileNames([user.id]);
          if (live) setHost({ userId: user.id, name: names.get(user.id) || user.email || "Unknown" });
        }
        await refresh();
      } catch (e) {
        toast.error(messageOf(e, "Could not load the visitor forms"));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [refresh]);

  const matches = useMemo(() => findVisitorMatches(index, query), [index, query]);

  const pickedState = docs && picked ? ackState(picked.ack, docs.ack.revision, today) : null;
  const refused = health.symptoms === "fail";
  // The rules are read when there is no acknowledgement that still counts — and never by somebody
  // who is not going in.
  const needsRules = !refused && !ackWritten && !pickedState?.valid;

  const begin = async () => {
    setQuery(""); setPicked(null); setAnswers(BLANK); setRulesRead(false); setAckWritten(null);
    setHealth({ symptoms: null, wounds: null });
    setStep("lookup");
    try { await refresh(); } catch (e) { toast.error(messageOf(e, "Could not refresh the visitor forms")); }
  };

  const choose = (m: VisitorMatch | null) => {
    setPicked(m);
    setAnswers({ ...BLANK, name: m?.name ?? "", company: m?.company ?? "", phone: m?.ack.phone ?? "" });
    setStep("details");
  };

  const finish = async () => {
    if (!docs || !host) return;
    setSaving(true);
    try {
      // Re-read the forms: the revision an entry is pinned to must be the one in force now.
      const current = await loadVisitorDocs();
      if (!current) throw new Error("The visitor forms are not available. Tell the SQF Practitioner.");
      if (current.ack.revision !== docs.ack.revision || current.signIn.revision !== docs.signIn.revision) {
        setDocs(current);
        throw new Error("The visitor forms were revised a moment ago. Please start this sign-in again.");
      }

      const at = new Date();
      const full: VisitAnswers = {
        ...answers,
        noSymptoms: refused ? "fail" : "pass",
        woundsCovered: health.wounds === "pass" ? "pass" : "na",
      };

      let ack: { id: string; ackDate: string } | null =
        ackWritten ?? (pickedState?.valid && picked ? { id: picked.ack.id, ackDate: picked.ack.ackDate } : null);

      if (!ack && !isRefused(full)) {
        const data = { ...emptyValues(current.ack.schema), ...buildAckData(full, host, at) };
        const check = buildZodSchema(current.ack.schema).safeParse(data);
        if (!check.success) throw new Error(check.error.issues[0]?.message ?? "The acknowledgement is incomplete.");
        const row = await createSubmittedResponse(current.ack, check.data);
        ack = { id: row.id, ackDate: localDate(at) };
        setAckWritten(ack);
      }

      const data = { ...emptyValues(current.signIn.schema), ...buildSignInData(full, host, at, ack) };
      const check = buildZodSchema(current.signIn.schema).safeParse(data);
      if (!check.success) throw new Error(check.error.issues[0]?.message ?? "The sign-in is incomplete.");
      await createSubmittedResponse(current.signIn, check.data);

      toast.success(isRefused(full)
        ? `Refused entry recorded for ${full.name.trim()}.`
        : `${full.name.trim()} is signed in at ${localTime(at)}.`);
      setStep("home");
      await refresh();
    } catch (e) {
      toast.error(messageOf(e, "Could not record the sign-in"));
    } finally {
      setSaving(false);
    }
  };

  const signOut = async (v: VisitorOnSite) => {
    setSigningOut(v.id);
    try {
      const time = localTime(new Date());
      await signOutVisitor(v.id, time);
      toast.success(`${v.name} signed out at ${time}.`);
      await refresh();
    } catch (e) {
      toast.error(messageOf(e, "Could not sign the visitor out"));
    } finally {
      setSigningOut(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 tp-on-bg-dim">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  const header = (
    <div>
      <h1 className="text-2xl font-semibold flex items-center gap-2 tp-on-bg">
        <DoorOpen className="w-5 h-5 text-[hsl(var(--tp-gold))]" />
        Visitor Sign-In
      </h1>
      <p className="text-sm tp-on-bg-dim mt-1">
        Every visitor signs in at every visit (FRM-905). The food safety rules are read and signed on
        the first visit, and again after twelve months (FRM-906).
      </p>
    </div>
  );

  if (notReady || !docs) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4 tp-fade-up">
        {header}
        <Card className="border" style={cardStyle}>
          <CardContent className="p-5 text-sm text-[#2A1F0E] space-y-2">
            <p className="font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> This screen is not switched on yet.
            </p>
            <p>
              It needs revision v3 of FRM-905 and FRM-906, both active. Until then, sign visitors in
              from each form's Entries tab in the <Link className="underline" to="/team/compliance/sops">SOPs Library</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s905 = docs.signIn.schema;
  const s906 = docs.ack.schema;
  const purposes = fieldOf<SelectField>(s905, "purpose")?.options ?? [];
  const symptomsQ = fieldOf<PassFailField>(s905, "no_symptoms");
  const woundsQ = fieldOf<PassFailField>(s905, "wounds_covered");
  const rules = fieldOf<ReferenceTableField>(s906, "rules_table");
  const visitorStatement = fieldOf<SignatureField>(s905, "visitor_signature")?.statement;
  const hostStatement = fieldOf<SignatureField>(s905, "host_signature")?.statement;
  const ackStatement = fieldOf<InfoField>(s906, "ack_statement")?.text;

  const steps: Step[] = ["lookup", "details", "health", ...(needsRules ? ["rules" as Step] : []), "sign", "host"];
  const go = (dir: 1 | -1) => {
    const i = steps.indexOf(step);
    const next = steps[i + dir];
    setStep(next ?? "home");
  };

  const canLeave: Record<Step, boolean> = {
    home: true,
    lookup: true,
    details: !!answers.name.trim() && !!answers.purpose,
    health: health.symptoms === "fail" || (health.symptoms === "pass" && (health.wounds === "pass" || health.wounds === "na")),
    rules: rulesRead,
    sign: !!answers.signatureImage && !!answers.name.trim(),
    host: true,
  };

  const nav = (nextLabel = "Next") => (
    <div className="flex items-center justify-between pt-2">
      <Button type="button" variant="ghost" onClick={() => go(-1)} disabled={saving}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>
      <Button
        type="button"
        className="min-h-12 px-6 bg-[#C89B3C] text-[#2A1F0E] hover:bg-[#B58A30]"
        disabled={!canLeave[step] || saving}
        onClick={() => (step === "host" ? finish() : go(1))}
      >
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {nextLabel}
      </Button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4 tp-fade-up">
      {header}

      {step === "home" && (
        <>
          <Button
            type="button"
            className="w-full min-h-16 text-lg bg-[#C89B3C] text-[#2A1F0E] hover:bg-[#B58A30]"
            onClick={begin}
          >
            <UserPlus className="w-5 h-5 mr-2" /> Sign in a visitor
          </Button>

          <Card className="border" style={cardStyle}>
            <CardContent className="p-5 text-[#2A1F0E]">
              <h2 className="font-semibold mb-2">On site now ({onSite.length})</h2>
              {onSite.length === 0 ? (
                <p className="text-sm text-[#2A1F0E]/65">No visitors are signed in.</p>
              ) : (
                <ul className="divide-y divide-[#2A1F0E]/10">
                  {onSite.map(v => (
                    <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{v.name}{v.company ? ` — ${v.company}` : ""}</p>
                        <p className="text-xs text-[#2A1F0E]/65">
                          In at {v.timeIn}{v.visitDate !== today ? ` on ${prettyDate(v.visitDate)}` : ""} · host {v.host}
                        </p>
                      </div>
                      <Button type="button" variant="outline" disabled={signingOut === v.id} onClick={() => signOut(v)}>
                        {signingOut === v.id
                          ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          : <LogOut className="w-4 h-4 mr-1" />}
                        Sign out
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {step !== "home" && (
        <Card className="border" style={cardStyle}>
          <CardContent className="p-5 space-y-4 text-[#2A1F0E]">
            <p className="text-xs text-[#2A1F0E]/55">Step {steps.indexOf(step) + 1} of {steps.length}</p>

            {step === "lookup" && (
              <>
                <h2 className="text-lg font-semibold">Have you visited before?</h2>
                <div>
                  <Label htmlFor="visitor-lookup">Your phone number, its last 4 digits, or your name</Label>
                  <div className="relative mt-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#2A1F0E]/40" />
                    <Input
                      id="visitor-lookup"
                      className="pl-9 h-12 text-base"
                      autoComplete="off"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                    />
                  </div>
                </div>
                {query.trim() && (
                  <div className="space-y-2">
                    {matches.length === 0 && (
                      <p className="text-sm text-[#2A1F0E]/65">No match yet. Keep typing, or choose first visit below.</p>
                    )}
                    {matches.map(m => {
                      const state = ackState(m.ack, docs.ack.revision, today);
                      return (
                        <button
                          key={m.ack.id}
                          type="button"
                          onClick={() => choose(m)}
                          className="w-full text-left rounded-md border border-[#2A1F0E]/20 px-4 py-3 hover:bg-[#C89B3C]/10"
                        >
                          <span className="font-medium">{m.name}</span>
                          {m.company && <span className="text-[#2A1F0E]/70"> — {m.company}</span>}
                          <span className="block text-xs text-[#2A1F0E]/60">
                            {state.valid ? "Rules already signed — two quick questions" : "The rules need reading again"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center justify-between pt-2">
                  <Button type="button" variant="ghost" onClick={() => setStep("home")}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => choose(null)}>
                    This is my first visit
                  </Button>
                </div>
              </>
            )}

            {step === "details" && (
              <>
                <h2 className="text-lg font-semibold">{picked ? `Welcome back, ${picked.name}` : "Your details"}</h2>
                {!picked && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="v-name">Full name</Label>
                      <Input id="v-name" className="h-12 text-base" autoComplete="off" value={answers.name} onChange={e => set({ name: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="v-company">Company / organisation</Label>
                      <Input id="v-company" className="h-12 text-base" autoComplete="off" value={answers.company} onChange={e => set({ company: e.target.value })} />
                    </div>
                  </div>
                )}
                {(!picked || !pickedState?.valid) && (
                  <div>
                    <Label htmlFor="v-phone">Phone number, or just its last 4 digits (optional)</Label>
                    <Input id="v-phone" className="h-12 text-base sm:max-w-xs" inputMode="tel" autoComplete="off" maxLength={30} value={answers.phone} onChange={e => set({ phone: e.target.value })} />
                    <p className="text-xs text-[#2A1F0E]/60 mt-1">Only used so you can find yourself next time.</p>
                  </div>
                )}
                <div>
                  <Label>Purpose of visit</Label>
                  <div className="mt-1">
                    <Choice
                      value={answers.purpose || null}
                      onChange={v => set({ purpose: v })}
                      options={purposes.map(p => ({ key: p, label: p, tone: "neutral" as const }))}
                    />
                  </div>
                </div>
                {nav()}
              </>
            )}

            {step === "health" && (
              <>
                <h2 className="text-lg font-semibold">Health today</h2>
                <div className="space-y-2">
                  <p className="text-sm">{symptomsQ?.label}</p>
                  <Choice
                    value={health.symptoms}
                    onChange={v => setHealth(h => ({ ...h, symptoms: v }))}
                    options={[
                      { key: "pass", label: symptomsQ?.labels?.pass ?? "Yes — none of these", tone: "good" },
                      { key: "fail", label: symptomsQ?.labels?.fail ?? "No — I have one of these", tone: "bad" },
                    ]}
                  />
                </div>
                {health.symptoms === "fail" ? (
                  <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                    <p className="font-semibold">You cannot enter the production areas today.</p>
                    <p>Please tell your host. The next two steps record that entry was refused.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm">{woundsQ?.label}</p>
                    <Choice
                      value={health.wounds}
                      onChange={v => setHealth(h => ({ ...h, wounds: v }))}
                      options={[
                        { key: "na", label: woundsQ?.labels?.na ?? "No cuts or grazes", tone: "good" },
                        { key: "pass", label: woundsQ?.labels?.pass ?? "Yes — covered", tone: "good" },
                        { key: "fail", label: woundsQ?.labels?.fail ?? "No — not covered", tone: "bad" },
                      ]}
                    />
                    {health.wounds === "fail" && (
                      <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                        Ask your host for a dressing. Once the cut is covered, choose "{woundsQ?.labels?.pass ?? "Yes — covered"}".
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <Label htmlFor="v-health-notes">Anything your host should know (optional)</Label>
                  <Textarea id="v-health-notes" rows={2} value={answers.healthNotes} onChange={e => set({ healthNotes: e.target.value })} />
                </div>
                {nav()}
              </>
            )}

            {step === "rules" && (
              <>
                <h2 className="text-lg font-semibold">Food safety and hygiene rules</h2>
                {pickedState && "reason" in pickedState && picked && (
                  <p className="text-sm text-[#2A1F0E]/70">
                    {pickedState.reason === "revised"
                      ? "The rules have been revised since you last signed them."
                      : "It is more than twelve months since you last signed these."} Please read them again.
                  </p>
                )}
                <ol className="space-y-2 text-sm">
                  {(rules?.rows ?? []).map(row => (
                    <li key={row[0]} className="flex gap-3">
                      <span className="font-semibold text-[#9A6F1E] w-5 shrink-0 text-right">{row[0]}</span>
                      <span>{row[1]}</span>
                    </li>
                  ))}
                </ol>
                <label className="flex items-start gap-3 rounded-md border border-[#C89B3C]/50 bg-[#C89B3C]/5 p-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 accent-[#C89B3C]"
                    checked={rulesRead}
                    onChange={e => setRulesRead(e.target.checked)}
                  />
                  <span>{ackStatement}</span>
                </label>
                {nav()}
              </>
            )}

            {step === "sign" && (
              <>
                <h2 className="text-lg font-semibold">Sign, {answers.name.trim()}</h2>
                <p className="text-sm">{visitorStatement}</p>
                {needsRules && <p className="text-sm">{ackStatement}</p>}
                <SignaturePad value={answers.signatureImage || undefined} onChange={img => set({ signatureImage: img ?? "" })} />
                <p className="text-sm font-medium">Now please hand the tablet back to your host.</p>
                {nav()}
              </>
            )}

            {step === "host" && (
              <>
                <h2 className="text-lg font-semibold">Host: {host?.name}</h2>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-[#2A1F0E]/60">Visitor</dt>
                  <dd>{answers.name.trim()}{answers.company.trim() ? ` — ${answers.company.trim()}` : ""}</dd>
                  <dt className="text-[#2A1F0E]/60">Purpose</dt>
                  <dd>{answers.purpose}</dd>
                  <dt className="text-[#2A1F0E]/60">Rules</dt>
                  <dd>
                    {refused
                      ? "Not applicable — entry refused"
                      : pickedState?.valid && picked
                        ? `Signed ${prettyDate(picked.ack.ackDate)}, valid until ${prettyDate(pickedState.expiresOn)}`
                        : "Read and signed today"}
                  </dd>
                </dl>
                {refused ? (
                  <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                    <p className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Entry refused</p>
                    <p>The visitor declared a symptom of illness and must not enter any food handling area (SQF 11.3.4.3). Confirming records the refusal.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="v-areas">Areas the visitor will enter</Label>
                        <Input id="v-areas" autoComplete="off" value={answers.areas} onChange={e => set({ areas: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="v-escort">Escort, if escorted (optional)</Label>
                        <Input id="v-escort" autoComplete="off" value={answers.escortName} onChange={e => set({ escortName: e.target.value })} />
                      </div>
                    </div>
                    <p className="rounded-md border border-[#C89B3C]/50 bg-[#C89B3C]/5 p-3 text-sm flex gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#9A6F1E]" />
                      <span>{hostStatement}</span>
                    </p>
                  </>
                )}
                {nav(refused ? `Record refused entry as ${host?.name}` : `Confirm and sign as ${host?.name}`)}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
