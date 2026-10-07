/* eslint-disable @typescript-eslint/no-explicit-any -- the Web Speech API, the Wake Lock API and
   webkitAudioContext have no TypeScript lib types here; useSpeechCommand types them the same way. */
import { useCallback, useEffect, useRef, useState } from "react";
import { RECOGNIZER_LANG, type VoiceLang } from "@/lib/voiceLexicon";

// Listening that stays on while a record is open, for "Form 606, air check passed".
//
// Different from useSpeechCommand on purpose. That hook hears ONE line after a tap and stops. This
// one keeps the microphone open until it is switched off, and hands every finished sentence to the
// caller, which decides whether it was meant for the form (voiceHandsFree.ts looks for the trigger).
//
// WHAT THE BROWSER DOES NOT PROMISE, and this is built around:
//  - Android Chrome ends recognition after every pause, `continuous` or not, so `onend` restarts it
//    for as long as listening is wanted. It may play its start sound each time; that cannot be
//    turned off from a page.
//  - The first start() must run inside the tap that switched listening on. Restarts afterwards do
//    not need a tap, because the microphone permission has been given.
//  - Recognition runs on Google's servers: no network, no listening. Errors that will not fix
//    themselves (microphone refused, no microphone) switch listening off and say why; the rest back
//    off and try again.
//  - A page in the background is not given the microphone, so listening pauses while the page is
//    hidden and resumes when it is shown again. A screen wake lock is held while listening is on,
//    because a tablet that sleeps stops listening without telling anyone.
//  - The tablet must not hear itself: recognition is paused while it speaks a confirmation.

const Recognition: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined;

export const handsFreeSupported = !!Recognition;

export type HandsFreeState = "off" | "listening" | "paused" | "error";

/** Errors after which trying again cannot help: the person has to do something first. */
const FATAL = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"]);

export function useHandsFreeSpeech(
  onHeard: (alternatives: string[]) => void,
  options: { lang?: VoiceLang } = {},
) {
  const [state, setState] = useState<HandsFreeState>("off");
  const [interim, setInterim] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const wanted = useRef(false);     // the switch
  const speaking = useRef(false);   // the tablet is talking
  const recRef = useRef<any>(null);
  const retry = useRef<number | null>(null);
  const failures = useRef(0);
  const wakeLock = useRef<any>(null);
  const onHeardRef = useRef(onHeard);
  onHeardRef.current = onHeard;
  const langRef = useRef<VoiceLang>(options.lang ?? "en");
  langRef.current = options.lang ?? "en";

  const holdAwake = useCallback(async () => {
    try {
      if (!wakeLock.current && (navigator as any).wakeLock) {
        wakeLock.current = await (navigator as any).wakeLock.request("screen");
        wakeLock.current.addEventListener?.("release", () => { wakeLock.current = null; });
      }
    } catch { /* not allowed or not supported: listening still works while the screen is on */ }
  }, []);
  const letSleep = useCallback(() => {
    try { wakeLock.current?.release?.(); } catch { /* already released */ }
    wakeLock.current = null;
  }, []);

  const begin = useCallback(() => {
    if (!Recognition || !wanted.current || speaking.current || recRef.current) return;
    if (typeof document !== "undefined" && document.hidden) { setState("paused"); return; }
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.lang = RECOGNIZER_LANG[langRef.current];

    rec.onresult = (event: any) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const alternatives: string[] = [];
          for (let j = 0; j < result.length; j++) alternatives.push(result[j].transcript);
          failures.current = 0;
          setInterim(alternatives[0] ?? "");
          onHeardRef.current(alternatives);
        } else {
          text += result[0].transcript;
        }
      }
      if (text) setInterim(text);
    };
    rec.onerror = (event: any) => {
      const code = String(event?.error ?? "");
      if (code === "aborted" || code === "no-speech") return;   // silence is the normal case here
      failures.current += 1;
      if (FATAL.has(code)) {
        wanted.current = false;
        setErrorCode(code);
        setState("error");
        letSleep();
      } else {
        setErrorCode(code);                                      // "network" and the like: shown, then retried
      }
    };
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null;
      if (!wanted.current) return;
      if (speaking.current || (typeof document !== "undefined" && document.hidden)) { setState("paused"); return; }
      // Straight back on after a pause in speech; slower when it keeps failing, so a dead network
      // does not spin the recogniser.
      const wait = Math.min(300 + failures.current * 1000, 8000);
      retry.current = window.setTimeout(() => { retry.current = null; begin(); }, wait);
    };

    recRef.current = rec;
    try {
      rec.start();
      setState("listening");
    } catch {
      recRef.current = null;
      failures.current += 1;
      retry.current = window.setTimeout(() => { retry.current = null; begin(); }, 1500);
    }
  }, [letSleep]);

  const halt = useCallback(() => {
    if (retry.current !== null) { window.clearTimeout(retry.current); retry.current = null; }
    const rec = recRef.current;
    recRef.current = null;
    try { rec?.abort(); } catch { /* not running */ }
  }, []);

  /** Call from the tap that switches listening on - nothing may be awaited before it. */
  const start = useCallback(() => {
    if (!Recognition) { setErrorCode("unsupported"); setState("error"); return; }
    wanted.current = true;
    failures.current = 0;
    setErrorCode(null);
    setInterim("");
    begin();
    void holdAwake();
  }, [begin, holdAwake]);

  const stop = useCallback(() => {
    wanted.current = false;
    halt();
    letSleep();
    setInterim("");
    setState("off");
  }, [halt, letSleep]);

  /** Around a spoken confirmation, so the tablet does not hear itself. */
  const pauseForSpeech = useCallback(() => {
    speaking.current = true;
    halt();
    if (wanted.current) setState("paused");
  }, [halt]);
  const resumeAfterSpeech = useCallback(() => {
    speaking.current = false;
    if (wanted.current) begin();
  }, [begin]);

  useEffect(() => {
    const onVisibility = () => {
      if (!wanted.current) return;
      if (document.hidden) { halt(); setState("paused"); }
      else { void holdAwake(); begin(); }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [begin, halt, holdAwake]);

  useEffect(() => () => {
    wanted.current = false;
    if (retry.current !== null) window.clearTimeout(retry.current);
    try { recRef.current?.abort(); } catch { /* not running */ }
    try { wakeLock.current?.release?.(); } catch { /* already released */ }
  }, []);

  return { supported: handsFreeSupported, state, interim, errorCode, start, stop, pauseForSpeech, resumeAfterSpeech };
}

// ─── Sound ───────────────────────────────────────────────────────────────────

let audioContext: any = null;

/** Call inside a tap, once: a page may not make sound until the person has touched it. */
export function unlockSound(): void {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    audioContext = audioContext ?? new Ctx();
    if (audioContext.state === "suspended") void audioContext.resume();
  } catch { /* no sound on this device */ }
}

/** Two short notes. Made here rather than played from a file, so there is nothing to load. */
export function playTone(): void {
  try {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    for (const [offset, frequency] of [[0, 880], [0.22, 1175]] as const) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.5, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.22);
    }
  } catch { /* no sound on this device */ }
}

/** Say a sentence aloud. Resolves when it has been said, or at once where there is no speech. */
export function sayAloud(text: string, lang: VoiceLang): Promise<void> {
  return new Promise(resolve => {
    try {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (!synth || typeof SpeechSynthesisUtterance === "undefined") { resolve(); return; }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = RECOGNIZER_LANG[lang];
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      utterance.onend = finish;
      utterance.onerror = finish;
      // Some Android builds never fire onend; do not leave the microphone paused for good.
      window.setTimeout(finish, 6000);
      synth.cancel();
      synth.speak(utterance);
    } catch { resolve(); }
  });
}
