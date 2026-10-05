// Visitor sign-in (FRM-905 + FRM-906) as one short screen the visitor completes alone.
//
// A visitor reads and signs the GMP acknowledgement (FRM-906) on their FIRST visit. It stays valid
// for twelve months, or until FRM-906 is revised. After that they find themselves by phone number,
// its last four digits, or name, and answer only the two health questions. Every visit writes an
// FRM-905 entry that records which acknowledgement it relied on.
//
// TWO PLACES, ONE SCREEN. The entrance tablet runs it full-screen as a `kiosk` account
// (/team/visitor-kiosk, the `kiosk` prop) — an account that can reach nothing else. Staff also have
// it inside the portal (/team/compliance/visitors). Nobody from the site takes part in a sign-in:
// the visitor says who they are here to see, declares the entry conditions themselves, and signs.
//
// NOTHING IS WRITTEN UNTIL THE VISITOR SIGNS, and then visitor_sign_in writes both entries in one
// transaction, already submitted. The time out is added later by sign_out_visitor, which can write
// that one value and nothing else. All data access is through those server functions — see
// "Visitor sign-in" in formResponses.ts.
//
// The wording a visitor reads — the rules, the questions, the statement they sign against — comes
// from the two forms' own schemas, so this page cannot drift from the controlled documents.
//
// The decisions (who matches a lookup, whether an acknowledgement still counts, what each entry
// contains) are in src/lib/visitors.ts and tested by scripts/test-visitors.mjs.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, DoorOpen, Loader2, LogOut, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  buildZodSchema, emptyValues,
  type FormField, type FormSchema, type InfoField, type PassFailField, type ReferenceTableField,
  type SelectField, type SignatureField,
} from "@/lib/formSchema";
import {
  loadVisitorDesk, lookupVisitors, signOutVisitor, visitorSignIn,
  type VisitorDesk, type VisitorOnSite,
} from "@/lib/formResponses";
import {
  HOST_UNKNOWN, ackState, buildAckData, buildSignInData, capitalizeName, findVisitorMatches, isRefused, localDate, localTime,
  type AckRecord, type VisitAnswers, type VisitorMatch,
} from "@/lib/visitors";
import { SignaturePad } from "@/components/team/forms/SignaturePad";

const cardStyle = { background: "#FFFFFF", borderColor: "rgba(200,155,60,0.25)" };

type Step = "home" | "lookup" | "details" | "health" | "rules" | "sign" | "done";

const BLANK: VisitAnswers = {
  name: "", company: "", phone: "", purpose: "", host: "",
  noSymptoms: "pass", woundsCovered: "na", healthNotes: "", signatureImage: "",
};

// How long the "you are signed in" screen stays before the tablet is ready for the next person.
const DONE_MS = 8000;
// How long a sign-out button stays armed before it stands down.
const ARMED_MS = 10000;

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

/** Whether a typed query says enough to look anybody up (the server applies the same floor). */
const canLookUp = (q: string) =>
  q.replace(/\D/g, "").length >= 4 || q.replace(/[^a-z]/gi, "").length >= 2;

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
              "min-h-12 rounded-md border px-4 py-2 text-base font-medium transition-colors",
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

/**
 * Today's date and the time, large, beside the welcome on the kiosk's home screen. A visitor
 * signing out is asked nothing, so this is where they see the time that will be recorded; it also
 * shows at a glance that the tablet is awake and current.
 *
 * It is in the header, not at the foot of the screen: the list of people on site grows downwards,
 * and with two visitors signed in a clock at the bottom was already below the fold.
 *
 * Its own component so the tick re-renders these two lines and not the page. It ticks every
 * second but the text only changes with the minute, and React skips a state set to the same text.
 */
function KioskClock() {
  const read = () => {
    const now = new Date();
    return {
      time: now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      // Short names on purpose: "Wednesday, September 30" is wide enough to push the welcome onto two lines.
      date: now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    };
  };
  const [time, setTime] = useState(() => read().time);
  const [date, setDate] = useState(() => read().date);
  useEffect(() => {
    const timer = setInterval(() => { const now = read(); setTime(now.time); setDate(now.date); }, 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="ml-auto shrink-0 whitespace-nowrap text-right">
      <p className="text-4xl font-semibold tabular-nums tp-on-bg">{time}</p>
      <p className="text-lg tp-on-bg-dim mt-1">{date}</p>
    </div>
  );
}

/**
 * The way out of the kiosk, for staff. The kiosk screen has no portal around it and so no account
 * menu; without this the only way to sign the tablet out was to clear the browser's site data.
 *
 * It asks for the account's password first. The tablet sits where visitors can reach it, and a
 * one-tap sign-out would let anybody leave it on the login page with nobody able to sign in.
 * The password is checked by signing in again as the same account, which changes nothing if it
 * is right and leaves the session alone if it is wrong.
 */
function KioskExit() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const exit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("This tablet is not signed in.");
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
      if (error) throw new Error("That is not this account's password.");
      await supabase.auth.signOut();
      window.location.replace("/team");
    } catch (err) {
      toast.error(messageOf(err, "Could not sign out"));
      setBusy(false);
    }
  };

  return (
    <>
      <div className="pt-6 text-center">
        <button type="button" className="text-sm tp-on-bg-dim underline underline-offset-2" onClick={() => { setPassword(""); setOpen(true); }}>
          Staff: sign this tablet out
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign this tablet out</DialogTitle>
            <DialogDescription>
              Visitors cannot sign in until somebody signs the tablet back in. Enter this account's password to continue.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={exit} className="space-y-3">
            {/* Deliberately NOT type="password". A password field makes the browser offer every
                saved login for this site - including this account's - to whoever is holding the
                tablet, which hands a visitor the very thing this dialog asks for. Chrome ignores
                autocomplete="off" on password fields, so the field is plain text, masked with
                text-security, and carries the opt-out hints the common password managers honour. */}
            <Input
              type="text"
              name="kiosk-exit-code"
              aria-label="Account password"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={!password || busy}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Sign out
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function VisitorSignIn({ kiosk = false }: { kiosk?: boolean }) {
  const [desk, setDesk] = useState<VisitorDesk | null>(null);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<Step>("home");
  const [query, setQuery] = useState("");
  // Whether the visitor has said they have signed in on this screen before, which is what shows
  // the search box.
  const [returning, setReturning] = useState(false);
  const [candidates, setCandidates] = useState<AckRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<VisitorMatch | null>(null);
  const [answers, setAnswers] = useState<VisitAnswers>(BLANK);
  const [health, setHealth] = useState<{ symptoms: string | null; wounds: string | null }>({ symptoms: null, wounds: null });
  const [rulesRead, setRulesRead] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ name: string; time: string; refused: boolean } | null>(null);
  // Signing somebody out is not undoable, and on the kiosk the list is other people's names:
  // the first tap arms the button, the second signs out.
  const [armed, setArmed] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState<string | null>(null);

  // The entrance tablet is read standing up, at arm's length. Everything on this page is sized in
  // rem, so on the kiosk the root size follows the width of the screen (about 22px on a 1280px
  // tablet, never below the normal 16px) and the whole screen - type, buttons, dialogs, toasts -
  // grows together. The kiosk is its own page, and the size is put back when it is left.
  useEffect(() => {
    if (!kiosk) return;
    const root = document.documentElement;
    const before = root.style.fontSize;
    root.style.fontSize = "clamp(16px, 1.7vw, 24px)";
    return () => { root.style.fontSize = before; };
  }, [kiosk]);

  const today = localDate(new Date());
  const set = (patch: Partial<VisitAnswers>) => setAnswers(a => ({ ...a, ...patch }));

  const refresh = useCallback(async () => {
    const loaded = await loadVisitorDesk();
    setDesk(loaded);
    return loaded;
  }, []);

  useEffect(() => {
    let live = true;
    refresh()
      .catch(e => toast.error(messageOf(e, "Could not load the visitor forms")))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [refresh]);

  // Returning-visitor lookup: asked of the server once the visitor has typed enough to be somebody.
  const lookupSeq = useRef(0);
  useEffect(() => {
    if (step !== "lookup") return;
    const q = query.trim();
    if (!canLookUp(q)) { setCandidates([]); setSearching(false); return; }
    const seq = ++lookupSeq.current;
    setSearching(true);
    const timer = setTimeout(() => {
      lookupVisitors(q)
        .then(rows => { if (seq === lookupSeq.current) setCandidates(rows); })
        .catch(() => { if (seq === lookupSeq.current) setCandidates([]); })
        .finally(() => { if (seq === lookupSeq.current) setSearching(false); });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, step]);

  // An armed "Tap again to confirm" must not wait for the next person to walk up: one stray tap
  // would then sign somebody else out. It stands down by itself.
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(null), ARMED_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  // After a sign-in the tablet returns to the start by itself, ready for the next visitor.
  useEffect(() => {
    if (step !== "done") return;
    const timer = setTimeout(() => setStep("home"), DONE_MS);
    return () => clearTimeout(timer);
  }, [step]);

  const forms = desk?.forms ?? null;
  const matches = useMemo(() => findVisitorMatches(candidates, query), [candidates, query]);

  const pickedState = forms && picked ? ackState(picked.ack, forms.ack.revision, today) : null;
  const refused = health.symptoms === "fail";
  // The rules are read when there is no acknowledgement that still counts — and never by somebody
  // who is not going in.
  const needsRules = !refused && !pickedState?.valid;

  const begin = async () => {
    setQuery(""); setCandidates([]); setPicked(null); setAnswers(BLANK); setRulesRead(false); setReturning(false);
    setHealth({ symptoms: null, wounds: null }); setArmed(null);
    setStep("lookup");
    // Re-read the forms at the start of every sign-in, so a tablet left open overnight never
    // shows a visitor a revision that has since been superseded.
    try { await refresh(); } catch (e) { toast.error(messageOf(e, "Could not refresh the visitor forms")); }
  };

  const choose = (m: VisitorMatch | null) => {
    setPicked(m);
    setAnswers({ ...BLANK, name: m?.name ?? "", company: m?.company ?? "", phone: m?.ack.phone ?? "" });
    setStep("details");
  };

  const finish = async () => {
    if (!forms) return;
    setSaving(true);
    try {
      const at = new Date();
      const full: VisitAnswers = {
        ...answers,
        noSymptoms: refused ? "fail" : "pass",
        woundsCovered: health.wounds === "pass" ? "pass" : "na",
      };
      const onFile = pickedState?.valid && picked ? { id: picked.ack.id, ackDate: picked.ack.ackDate } : null;

      let ack: Record<string, unknown> | null = null;
      if (!onFile && !isRefused(full)) {
        const check = buildZodSchema(forms.ack.schema)
          .safeParse({ ...emptyValues(forms.ack.schema), ...buildAckData(full, at) });
        if (!check.success) throw new Error(check.error.issues[0]?.message ?? "The acknowledgement is incomplete.");
        ack = check.data;
      }

      const check = buildZodSchema(forms.signIn.schema)
        .safeParse({ ...emptyValues(forms.signIn.schema), ...buildSignInData(full, at, onFile) });
      if (!check.success) throw new Error(check.error.issues[0]?.message ?? "The sign-in is incomplete.");

      await visitorSignIn(check.data, ack, { signIn: forms.signIn.revision, ack: forms.ack.revision });

      setDone({ name: full.name.trim(), time: localTime(at), refused: isRefused(full) });
      setStep("done");
      refresh().catch(() => undefined);
    } catch (e) {
      toast.error(messageOf(e, "Could not record the sign-in"));
    } finally {
      setSaving(false);
    }
  };

  const signOut = async (v: VisitorOnSite) => {
    if (armed !== v.id) { setArmed(v.id); return; }
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
      setArmed(null);
    }
  };

  // The kiosk has no portal around it, so it brings the portal's own backdrop.
  const shell = (children: React.ReactNode) => kiosk
    ? <div className="team-portal team-portal-bg min-h-screen">{children}</div>
    : <>{children}</>;

  if (loading) {
    return shell(
      <div className="flex items-center gap-2 p-6 tp-on-bg-dim">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>,
    );
  }

  // On the kiosk the welcome is large on the home screen and shrinks to one line during a sign-in,
  // so the questions - and the on-screen keyboard - have the room.
  const welcome = kiosk && (step === "home" || step === "done");
  const header = (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-2">
      <div className="flex-1 min-w-[18rem]">
        <h1 className={cn("font-semibold flex items-center tp-on-bg", welcome ? "text-4xl gap-3" : "text-2xl gap-2")}>
          <DoorOpen className={cn("text-[hsl(var(--tp-gold))]", welcome ? "w-8 h-8" : "w-5 h-5")} />
          {kiosk ? "Welcome to Adventure Bakery" : "Visitor Sign-In"}
        </h1>
        {(!kiosk || welcome) && (
          <p className={cn("tp-on-bg-dim mt-1", welcome ? "text-lg" : "text-sm")}>
            {kiosk
              ? "Every visitor signs in here before entering, and signs out on leaving."
              : "Every visitor signs in at every visit (FRM-905). The food safety rules are read and signed on the first visit, and again after twelve months (FRM-906)."}
          </p>
        )}
      </div>
      {welcome && <KioskClock />}
    </div>
  );
  // The kiosk has the whole screen to itself; inside the portal the page keeps its column.
  const column = cn("mx-auto p-6 space-y-4 tp-fade-up", kiosk ? "max-w-[54rem]" : "max-w-2xl");

  if (!forms) {
    return shell(
      <div className={column}>
        {header}
        <Card className="border" style={cardStyle}>
          <CardContent className="p-5 text-sm text-[#2A1F0E] space-y-2">
            <p className="font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> This screen is not switched on yet.
            </p>
            {kiosk ? (
              <p>Please ask a member of staff to sign you in.</p>
            ) : (
              <p>
                It needs revision v4 of FRM-905 and FRM-906, both active. Until then, sign visitors in
                from each form's Entries tab in the <Link className="underline" to="/team/compliance/sops">SOPs Library</Link>.
              </p>
            )}
          </CardContent>
        </Card>
      </div>,
    );
  }

  const s905 = forms.signIn.schema;
  const s906 = forms.ack.schema;
  const purposes = fieldOf<SelectField>(s905, "purpose")?.options ?? [];
  const symptomsQ = fieldOf<PassFailField>(s905, "no_symptoms");
  const woundsQ = fieldOf<PassFailField>(s905, "wounds_covered");
  const rules = fieldOf<ReferenceTableField>(s906, "rules_table");
  const visitorStatement = fieldOf<SignatureField>(s905, "visitor_signature")?.statement;
  const ackStatement = fieldOf<InfoField>(s906, "ack_statement")?.text;
  const staff = desk?.staff ?? [];
  const onSite = desk?.onSite ?? [];

  const steps: Step[] = ["lookup", "details", "health", ...(needsRules ? ["rules" as Step] : []), "sign"];
  const go = (dir: 1 | -1) => setStep(steps[steps.indexOf(step) + dir] ?? "home");

  const canLeave: Partial<Record<Step, boolean>> = {
    details: !!answers.name.trim() && !!answers.purpose && !!answers.host.trim(),
    health: health.symptoms === "fail" || (health.symptoms === "pass" && (health.wounds === "pass" || health.wounds === "na")),
    rules: rulesRead,
    sign: !!answers.signatureImage && !!answers.name.trim(),
  };

  // On the kiosk the larger type makes some steps taller than the screen, and a Next button below
  // the fold reads as a dead end. There the bar stays in view at the bottom while the step scrolls.
  const nav = (nextLabel = "Next") => (
    <div className={cn(
      "flex items-center justify-between pt-2",
      kiosk && "sticky bottom-0 z-10 -mx-6 !-mb-6 px-6 py-3 bg-white border-t border-[#2A1F0E]/10 rounded-b-lg",
    )}>
      <Button type="button" variant="ghost" className="min-h-12 text-base" onClick={() => go(-1)} disabled={saving}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>
      <Button
        type="button"
        className="min-h-12 px-8 text-base bg-[#C89B3C] text-[#2A1F0E] hover:bg-[#B58A30]"
        disabled={!canLeave[step] || saving}
        onClick={() => (step === "sign" ? finish() : go(1))}
      >
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {nextLabel}
      </Button>
    </div>
  );

  return shell(
    <div className={column}>
      {header}

      {step === "home" && (
        <>
          <Button
            type="button"
            className={cn("w-full bg-[#C89B3C] text-[#2A1F0E] hover:bg-[#B58A30]", kiosk ? "min-h-24 text-2xl" : "min-h-16 text-lg")}
            onClick={begin}
          >
            <UserPlus className={cn("mr-2", kiosk ? "!w-7 !h-7" : "w-5 h-5")} /> {kiosk ? "Sign in" : "Sign in a visitor"}
          </Button>

          <Card className="border" style={cardStyle}>
            <CardContent className="p-5 text-[#2A1F0E]">
              <h2 className="text-lg font-semibold mb-2">{kiosk ? "Leaving? Sign out here" : `On site now (${onSite.length})`}</h2>
              {onSite.length === 0 ? (
                <p className="text-base text-[#2A1F0E]/65">No visitors are signed in.</p>
              ) : (
                <ul className="divide-y divide-[#2A1F0E]/10">
                  {onSite.map(v => (
                    <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-lg font-medium truncate">{v.name}{v.company ? ` — ${v.company}` : ""}</p>
                        <p className="text-sm text-[#2A1F0E]/65">
                          In at {v.timeIn}{v.visitDate !== today ? ` on ${prettyDate(v.visitDate)}` : ""}
                          {v.host === HOST_UNKNOWN ? " · no appointment" : v.host ? ` · seeing ${v.host}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant={armed === v.id ? "destructive" : "outline"}
                          className="min-h-12 px-5 text-base"
                          disabled={signingOut === v.id}
                          onClick={() => signOut(v)}
                        >
                          {signingOut === v.id
                            ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            : <LogOut className="w-4 h-4 mr-1" />}
                          {armed === v.id ? "Tap again to confirm" : "Sign out"}
                        </Button>
                        {/* The way back from a wrong tap: the wrong person, or not leaving after all. */}
                        {armed === v.id && signingOut !== v.id && (
                          <button
                            type="button"
                            aria-label="Cancel sign out"
                            title="Cancel"
                            onClick={() => setArmed(null)}
                            className="h-12 w-10 inline-flex items-center justify-center rounded-md text-[#2A1F0E]/45 hover:text-[#2A1F0E] hover:bg-[#2A1F0E]/5"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {kiosk && <KioskExit />}
        </>
      )}

      {step === "done" && done && (
        <Card className="border" style={cardStyle}>
          <CardContent className="p-8 space-y-4 text-[#2A1F0E] text-center">
            {done.refused ? (
              <>
                <AlertTriangle className="w-14 h-14 mx-auto text-red-600" />
                <h2 className="text-2xl font-semibold">Please do not enter, {done.name}</h2>
                <p className="text-lg">
                  You declared a symptom of illness, so you cannot go into the production areas today.
                  This has been recorded. Please speak to the person you came to see.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-14 h-14 mx-auto text-green-600" />
                <h2 className="text-2xl font-semibold">You are signed in, {done.name}</h2>
                <p className="text-lg">Signed in at {done.time}. Please sign out here when you leave.</p>
              </>
            )}
            <Button type="button" variant="outline" className="min-h-12 px-8 text-base" onClick={() => setStep("home")}>Done</Button>
          </CardContent>
        </Card>
      )}

      {step !== "home" && step !== "done" && (
        <Card className="border" style={cardStyle}>
          <CardContent className="p-6 space-y-5 text-[#2A1F0E]">
            <p className="text-sm text-[#2A1F0E]/55">Step {steps.indexOf(step) + 1} of {steps.length}</p>

            {step === "lookup" && (
              <>
                <h2 className="text-2xl font-semibold">Have you signed in on this screen before?</h2>
                {/* The question is answered first, with two buttons. When the search box led the
                    screen, first-time visitors started typing their phone number into it before
                    they saw there was a first-visit button underneath.
                    It asks about SIGNING IN ON THIS SCREEN, not about visiting: a contractor who
                    had been to the site before the kiosk existed answered "visited before" with
                    yes, and then could not find himself. */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => choose(null)}
                    className="min-h-24 rounded-md border px-5 py-4 text-left bg-[#C89B3C] text-[#2A1F0E] border-[#C89B3C] hover:bg-[#B58A30]"
                  >
                    <span className="block text-lg font-semibold">No — this is my first time</span>
                    <span className="block text-sm opacity-80">Takes about two minutes</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={returning}
                    onClick={() => setReturning(true)}
                    className={cn(
                      "min-h-24 rounded-md border px-5 py-4 text-left transition-colors",
                      returning
                        ? "bg-[#2A1F0E] text-white border-[#2A1F0E]"
                        : "bg-white text-[#2A1F0E] border-[#2A1F0E]/25 hover:bg-[#C89B3C]/10",
                    )}
                  >
                    <span className="block text-lg font-semibold">Yes — I have signed in here before</span>
                    <span className="block text-sm opacity-80">Find yourself and skip the rules</span>
                  </button>
                </div>
                {returning && (
                  <>
                    <div>
                      <Label className="text-base" htmlFor="visitor-lookup">Your phone number, its last 4 digits, or your name</Label>
                      <div className="relative mt-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#2A1F0E]/40" />
                        <Input
                          id="visitor-lookup"
                          className="pl-9 h-12 text-base md:text-base"
                          autoComplete="off"
                          autoFocus
                          value={query}
                          onChange={e => setQuery(e.target.value)}
                        />
                      </div>
                    </div>
                    {canLookUp(query) && (
                      <div className="space-y-2">
                        {matches.length === 0 && (
                          <p className="text-base text-[#2A1F0E]/65">
                            {searching ? "Looking…" : "No match yet. Keep typing, or choose \"No — this is my first time\" above."}
                          </p>
                        )}
                        {matches.map(m => {
                          const state = ackState(m.ack, forms.ack.revision, today);
                          return (
                            <button
                              key={m.ack.id}
                              type="button"
                              onClick={() => choose(m)}
                              className="w-full text-left rounded-md border border-[#2A1F0E]/20 px-4 py-3 hover:bg-[#C89B3C]/10"
                            >
                              <span className="text-lg font-medium">{m.name}</span>
                              {m.company && <span className="text-lg text-[#2A1F0E]/70"> — {m.company}</span>}
                              <span className="block text-sm text-[#2A1F0E]/60">
                                {state.valid ? "Rules already signed — two quick questions" : "The rules need reading again"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
                <div className="pt-2">
                  <Button type="button" variant="ghost" className="min-h-12 text-base" onClick={() => setStep("home")}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                </div>
              </>
            )}

            {step === "details" && (
              <>
                <h2 className="text-2xl font-semibold">{picked ? `Welcome back, ${picked.name}` : "Your details"}</h2>
                {!picked && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-base" htmlFor="v-name">Full name</Label>
                      {/* Capitals are put in as the name is typed. While an on-screen keyboard is still
                          composing a word the text is left alone (rewriting it mid-word makes some
                          Android keyboards double letters) and is tidied when the word is committed. */}
                      <Input
                        id="v-name" className="h-12 text-base md:text-base" autoComplete="off" autoCapitalize="words"
                        value={answers.name}
                        onChange={e => {
                          const el = e.target;
                          if ((e.nativeEvent as InputEvent).isComposing) { set({ name: el.value }); return; }
                          const at = el.selectionStart;
                          set({ name: capitalizeName(el.value) });
                          // React moves the caret to the end when it rewrites the value; put it back.
                          requestAnimationFrame(() => {
                            if (at != null && document.activeElement === el) el.setSelectionRange(at, at);
                          });
                        }}
                        onCompositionEnd={e => set({ name: capitalizeName(e.currentTarget.value) })}
                        onBlur={e => set({ name: capitalizeName(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label className="text-base" htmlFor="v-company">Company / organisation</Label>
                      <Input id="v-company" className="h-12 text-base md:text-base" autoComplete="off" value={answers.company} onChange={e => set({ company: e.target.value })} />
                    </div>
                  </div>
                )}
                {(!picked || !pickedState?.valid) && (
                  <div>
                    <Label className="text-base" htmlFor="v-phone">Phone number, or just its last 4 digits (optional)</Label>
                    <Input id="v-phone" className="h-12 text-base md:text-base sm:max-w-xs" inputMode="tel" autoComplete="off" maxLength={30} value={answers.phone} onChange={e => set({ phone: e.target.value })} />
                    <p className="text-sm text-[#2A1F0E]/60 mt-1">Only used so you can find yourself next time.</p>
                  </div>
                )}
                <div>
                  <Label className="text-base">Who are you here to see?</Label>
                  <div className="mt-1">
                    {staff.length > 0 ? (
                      <Choice
                        value={answers.host || null}
                        onChange={v => set({ host: v })}
                        options={[
                          ...staff.map(n => ({ key: n, label: n, tone: "neutral" as const })),
                          { key: HOST_UNKNOWN, label: "I don't know", tone: "neutral" as const },
                        ]}
                      />
                    ) : (
                      <Input aria-label="Who are you here to see?" className="h-12 text-base md:text-base" autoComplete="off" value={answers.host} onChange={e => set({ host: e.target.value })} />
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-base">Purpose of visit</Label>
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
                <h2 className="text-2xl font-semibold">Health today</h2>
                <div className="space-y-2">
                  <p className="text-lg">{symptomsQ?.label}</p>
                  <Choice
                    value={health.symptoms}
                    onChange={v => setHealth(h => ({ ...h, symptoms: v }))}
                    options={[
                      { key: "pass", label: symptomsQ?.labels?.pass ?? "No, I have none of these", tone: "good" },
                      { key: "fail", label: symptomsQ?.labels?.fail ?? "Yes, I have at least one of these", tone: "bad" },
                    ]}
                  />
                </div>
                {health.symptoms === "fail" ? (
                  <div className="rounded-md border border-red-300 bg-red-50 p-4 text-base text-red-800">
                    <p className="font-semibold">You cannot enter the production areas today.</p>
                    <p>Please sign on the next screen so this is recorded, then speak to the person you came to see.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-lg">{woundsQ?.label}</p>
                    <Choice
                      value={health.wounds}
                      onChange={v => setHealth(h => ({ ...h, wounds: v }))}
                      options={[
                        { key: "na", label: woundsQ?.labels?.na ?? "No cuts or grazes", tone: "good" },
                        { key: "pass", label: woundsQ?.labels?.pass ?? "Yes, and it is covered", tone: "good" },
                        { key: "fail", label: woundsQ?.labels?.fail ?? "Yes, and it is not covered", tone: "bad" },
                      ]}
                    />
                    {health.wounds === "fail" && (
                      <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-base text-amber-900">
                        Please ask for a dressing. Once the cut is covered, choose "{woundsQ?.labels?.pass ?? "Yes, and it is covered"}".
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <Label className="text-base" htmlFor="v-health-notes">Anything we should know (optional)</Label>
                  <Textarea id="v-health-notes" rows={2} className="text-base md:text-base" value={answers.healthNotes} onChange={e => set({ healthNotes: e.target.value })} />
                </div>
                {nav()}
              </>
            )}

            {step === "rules" && (
              <>
                <h2 className="text-2xl font-semibold">Food safety and hygiene rules</h2>
                {pickedState && "reason" in pickedState && picked && (
                  <p className="text-base text-[#2A1F0E]/70">
                    {pickedState.reason === "revised"
                      ? "The rules have been revised since you last signed them."
                      : "It is more than twelve months since you last signed these."} Please read them again.
                  </p>
                )}
                <ol className="space-y-3 text-base">
                  {(rules?.rows ?? []).map(row => (
                    <li key={row[0]} className="flex gap-3">
                      <span className="font-semibold text-[#9A6F1E] w-6 shrink-0 text-right">{row[0]}</span>
                      <span>{row[1]}</span>
                    </li>
                  ))}
                </ol>
                <label className="flex items-start gap-3 rounded-md border border-[#C89B3C]/50 bg-[#C89B3C]/5 p-4 text-base cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-6 w-6 shrink-0 accent-[#C89B3C]"
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
                <h2 className="text-2xl font-semibold">Sign, {answers.name.trim()}</h2>
                {refused ? (
                  <p className="rounded-md border border-red-300 bg-red-50 p-4 text-base text-red-800">
                    You declared a symptom of illness, so you cannot enter today (SQF 11.3.4.3).
                    Signing records your declaration.
                  </p>
                ) : (
                  <p className="text-base">{visitorStatement}</p>
                )}
                {/* The pad keeps its 500:160 shape, so its width is capped: full width on the kiosk
                    would push the Sign in button below the bottom of the screen. */}
                <div className="max-w-[34rem]">
                  <SignaturePad value={answers.signatureImage || undefined} onChange={img => set({ signatureImage: img ?? "" })} />
                </div>
                {nav(refused ? "Sign and finish" : "Sign in")}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>,
  );
}
