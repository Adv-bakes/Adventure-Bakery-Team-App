/* eslint-disable @typescript-eslint/no-explicit-any -- react-hook-form values and the Wake Lock API are
   untyped here, as in FormEntry and useHandsFreeSpeech. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { Bell, Check, Mic, MicOff, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  handsFreeFailed, handsFreeMissingHeader, parseHandsFree, reminderDue,
  type HandsFreeRow,
} from "@/lib/voiceHandsFree";
import { VOICE_LANGS, type VoiceLang } from "@/lib/voiceLexicon";
import { VOICE_MSG } from "@/lib/voiceMessages";
import { playTone, sayAloud, unlockSound, useHandsFreeSpeech } from "@/hooks/useHandsFreeSpeech";

// The bar under the production header of an open FRM-606 entry.
//
// Three ways to add a row without typing, all ending in the same place (onRow, which saves it):
//   - LISTENING MODE: "Form 606, air check passed". Off every time the entry is opened; the
//     operator switches it on, and that tap is what lets the browser open the microphone.
//   - THE BUTTONS: one tap each. They are the fallback - listening depends on the network, on the
//     noise at the sealer and on what Android Chrome allows, and the day's record must not.
//   - REMIND ME: a tone and a spoken prompt 30 minutes after the last row. A setting of this
//     tablet (remembered here, never written into the record), and a prompt only.
//
// The bar never touches the database and never decides what a row means: voiceHandsFree.ts parses,
// FormEntry applies and saves. Every row is said back, because the operator is not looking.

const REMIND_KEY = "frm606.remindMe";
const LANG_LABEL: Record<VoiceLang, string> = { en: "English", es: "Español" };

function readRemind(): boolean {
  try { return window.localStorage.getItem(REMIND_KEY) === "1"; } catch { return false; }
}
function writeRemind(on: boolean): void {
  try { window.localStorage.setItem(REMIND_KEY, on ? "1" : "0"); } catch { /* private window: not remembered */ }
}

export interface HandsFreeOutcome {
  ok: boolean;
  /** HH:mm the row was stamped with. */
  time?: string;
  error?: string;
}

interface HandsFreeBarProps {
  form: UseFormReturn<Record<string, any>>;
  defaultLang?: VoiceLang;
  /** Save the header before the first spoken row; called when listening is switched on. */
  onListenStart(): void;
  /** Put the row in the record and save it. Resolves when it is saved, or says why not. */
  onRow(row: HandsFreeRow, lang: VoiceLang): Promise<HandsFreeOutcome>;
  /** Remove the last hands-free row and save. */
  onUndo(): Promise<boolean>;
}

type Note = { tone: "ok" | "fail" | "warn"; text: string; canUndo?: boolean };

export function HandsFreeBar({ form, defaultLang = "en", onListenStart, onRow, onUndo }: HandsFreeBarProps) {
  const [lang, setLang] = useState<VoiceLang>(defaultLang);
  useEffect(() => { setLang(defaultLang); }, [defaultLang]);
  const M = VOICE_MSG[lang].handsFree;

  const [production_date, product, lot_code] = useWatch({ control: form.control, name: ["production_date", "product", "lot_code"] });
  const missing = handsFreeMissingHeader({ production_date, product, lot_code });
  const ready = missing.length === 0;

  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const lastRowAt = useRef<number | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;

  // Bound after the hook below is created; the hook's callback needs them and they need the hook.
  const speechRef = useRef<{ pauseForSpeech(): void; resumeAfterSpeech(): void } | null>(null);
  const say = useCallback(async (text: string) => {
    speechRef.current?.pauseForSpeech();
    await sayAloud(text, langRef.current);
    speechRef.current?.resumeAfterSpeech();
  }, []);

  const record = useCallback(async (row: HandsFreeRow) => {
    const L = langRef.current;
    const H = VOICE_MSG[L].handsFree;
    setBusy(true);
    try {
      const outcome = await onRow(row, L);
      if (!outcome.ok) {
        setNote({ tone: "warn", text: outcome.error || H.saveFailed });
        void say(H.saveFailed);
        return;
      }
      lastRowAt.current = Date.now();
      const failed = handsFreeFailed(row);
      const line = H.recorded(H.describe(row), outcome.time ?? "");
      setNote({ tone: failed ? "fail" : "ok", text: failed ? `${line} ${H.failedStop}` : line, canUndo: true });
      void say(failed ? `${line} ${H.failedStop}` : line);
    } finally {
      setBusy(false);
    }
  }, [onRow, say]);

  const undo = useCallback(async () => {
    const H = VOICE_MSG[langRef.current].handsFree;
    setBusy(true);
    try {
      const done = await onUndo();
      setNote({ tone: done ? "ok" : "warn", text: done ? H.undone : H.nothingToUndo });
      void say(done ? H.undone : H.nothingToUndo);
    } finally {
      setBusy(false);
    }
  }, [onUndo, say]);

  const onHeard = useCallback((alternatives: string[]) => {
    const heard = parseHandsFree(alternatives, langRef.current);
    if (!heard) return;                                   // no trigger: not for the form
    if (heard.kind === "undo") { void undo(); return; }
    if (heard.kind === "unclear" || !heard.row) {
      const H = VOICE_MSG[langRef.current].handsFree;
      setNote({ tone: "warn", text: H.unclear });
      void say(H.unclear);
      return;
    }
    void record(heard.row);
  }, [record, undo, say]);

  const speech = useHandsFreeSpeech(onHeard, { lang });
  speechRef.current = speech;
  const listening = speech.state === "listening" || speech.state === "paused";

  const toggleListening = (on: boolean) => {
    if (on) {
      if (!ready) return;
      // Synchronously, inside the tap: the microphone and the sound are both refused otherwise.
      unlockSound();
      speech.start();
      onListenStart();
    } else {
      speech.stop();
    }
  };
  // A header emptied while listening would leave spoken rows on a record that does not say what it is.
  const stopListening = speech.stop;
  useEffect(() => { if (!ready && listening) stopListening(); }, [ready, listening, stopListening]);

  // ── Remind me ──────────────────────────────────────────────────────────────
  const [remind, setRemind] = useState(false);
  const remindStartedAt = useRef(0);
  const lastRemindedAt = useRef<number | null>(null);
  useEffect(() => { if (readRemind()) { remindStartedAt.current = Date.now(); setRemind(true); } }, []);
  const toggleRemind = (on: boolean) => {
    if (on) { unlockSound(); remindStartedAt.current = Date.now(); lastRemindedAt.current = null; }
    writeRemind(on);
    setRemind(on);
  };
  // A row typed or changed in the table also counts as a check made, so the 30 minutes start again.
  const rows = useWatch({ control: form.control, name: "seal_checks" });
  const rowsKey = Array.isArray(rows) ? rows.map((r: any) => [r?.check, r?.visual, r?.pull_test, r?.vacuum_reading].join("|")).join(";") : "";
  const firstRows = useRef(true);
  useEffect(() => {
    if (firstRows.current) { firstRows.current = false; return; }
    lastRowAt.current = Date.now();
  }, [rowsKey]);
  useEffect(() => {
    if (!remind) return;
    const tick = window.setInterval(() => {
      const now = Date.now();
      if (!reminderDue(now, remindStartedAt.current, lastRowAt.current, lastRemindedAt.current)) return;
      lastRemindedAt.current = now;
      const H = VOICE_MSG[langRef.current].handsFree;
      playTone();
      setNote({ tone: "warn", text: H.reminder });
      window.setTimeout(() => void say(H.reminder), 600);
    }, 15_000);
    return () => window.clearInterval(tick);
  }, [remind, say]);
  // Hold the screen awake while reminders are on, even with listening off: a sleeping tablet is silent.
  useEffect(() => {
    if (!remind) return;
    let lock: any = null;
    let cancelled = false;
    const hold = async () => {
      try { lock = await (navigator as any).wakeLock?.request("screen"); if (cancelled) lock?.release?.(); } catch { /* not supported */ }
    };
    void hold();
    const onVisible = () => { if (!document.hidden) void hold(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); try { lock?.release?.(); } catch { /* released */ } };
  }, [remind]);

  const status = speech.state === "listening" ? M.listening : speech.state === "paused" ? M.paused : M.notListening;
  const tap = (row: HandsFreeRow) => { unlockSound(); void record(row); };

  return (
    <div
      lang={lang}
      className="rounded-lg border p-4 space-y-3"
      style={{ borderColor: listening ? "#1F7A3F" : "rgba(200,155,60,0.6)", background: listening ? "#F1FAF4" : "#FFFDF7" }}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="font-semibold text-[#2A1F0E]">{M.title}</h2>
        <label className="flex items-center gap-2 text-sm font-medium text-[#2A1F0E]">
          <Switch checked={listening} onCheckedChange={toggleListening} disabled={!ready || !speech.supported} aria-label={M.switchLabel} />
          {M.switchLabel}
        </label>
        <span
          role="status"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
            speech.state === "listening" ? "bg-[#1F7A3F] text-white" : "bg-[#2A1F0E]/10 text-[#2A1F0E]",
          )}
        >
          {speech.state === "listening" ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          {status}
        </span>
        <div className="ml-auto flex items-center gap-1 text-xs">
          {VOICE_LANGS.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              disabled={listening}
              className={cn("rounded px-2 py-1", l === lang ? "bg-[#C89B3C] text-white" : "text-[#2A1F0E]/70 hover:bg-[#C89B3C]/10")}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
      </div>

      {!ready && <p className="text-sm text-[#8A5A00]">{M.needHeader(missing.map(k => M.fieldNames[k]))}</p>}
      {ready && !speech.supported && <p className="text-sm text-[#8A5A00]">{M.unsupported}</p>}
      {speech.errorCode && speech.errorCode !== "unsupported" && <p className="text-sm text-[#B42318]">{M.error(speech.errorCode)}</p>}
      {listening && (
        <p className="text-sm text-[#2A1F0E]/80">
          {M.sayThis}
          {speech.interim && <span className="block mt-1 italic text-[#2A1F0E]/60">{M.heard(speech.interim)}</span>}
        </p>
      )}

      {note && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
            note.tone === "fail" ? "bg-[#FDECEA] text-[#B42318]" : note.tone === "warn" ? "bg-[#FFF4DB] text-[#8A5A00]" : "bg-[#E7F5EC] text-[#1F7A3F]",
          )}
        >
          <span className="flex-1 min-w-[12rem]">{note.text}</span>
          {note.tone === "fail" && (
            <a href="#form-section-deviation" className="underline">{M.goToSection3}</a>
          )}
          {note.canUndo && (
            <Button type="button" size="sm" variant="outline" onClick={() => void undo()} disabled={busy}>
              <Undo2 className="w-3.5 h-3.5 mr-1" />{M.undo}
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#2A1F0E]/60">{M.atSealing}</p>
          <div className="grid grid-cols-2 gap-2">
            <TapButton label={M.airPass} pass disabled={!ready || busy} onClick={() => tap({ check: "In process", visual: "pass" })} />
            <TapButton label={M.airFail} disabled={!ready || busy} onClick={() => tap({ check: "In process", visual: "fail" })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#2A1F0E]/60">{M.atBoxing}</p>
          <div className="grid grid-cols-2 gap-2">
            <TapButton label={M.pullPass} pass disabled={!ready || busy} onClick={() => tap({ check: "At boxing", pull_test: "pass" })} />
            <TapButton label={M.pullFail} disabled={!ready || busy} onClick={() => tap({ check: "At boxing", pull_test: "fail" })} />
            <TapButton label={M.boxPass} pass disabled={!ready || busy} onClick={() => tap({ check: "At boxing", visual: "pass" })} />
            <TapButton label={M.boxFail} disabled={!ready || busy} onClick={() => tap({ check: "At boxing", visual: "fail" })} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-x-6 gap-y-2 pt-1 border-t" style={{ borderColor: "rgba(200,155,60,0.3)" }}>
        <label className="flex items-center gap-2 text-sm font-medium text-[#2A1F0E] pt-2">
          <Checkbox checked={remind} onCheckedChange={v => toggleRemind(v === true)} />
          <Bell className="w-4 h-4 text-[#C89B3C]" />
          {M.remind}
        </label>
        <p className="flex-1 min-w-[14rem] text-xs text-[#2A1F0E]/60 pt-2">
          {remind ? M.remindNote : M.limits}
        </p>
      </div>
    </div>
  );
}

function TapButton({ label, pass, disabled, onClick }: { label: string; pass?: boolean; disabled?: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-semibold min-h-[3.25rem] disabled:opacity-40",
        pass ? "border-[#1F7A3F] text-[#1F7A3F] bg-white hover:bg-[#E7F5EC]" : "border-[#B42318] text-[#B42318] bg-white hover:bg-[#FDECEA]",
      )}
    >
      {pass ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
      {label}
    </button>
  );
}
