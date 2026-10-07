/* eslint-disable @typescript-eslint/no-explicit-any -- the Web Speech API, the Wake Lock API and
   webkitAudioContext have no TypeScript lib types here; useSpeechCommand types them the same way. */
import { useCallback, useEffect, useRef, useState } from "react";
import { RECOGNIZER_LANG, type VoiceLang } from "@/lib/voiceLexicon";
import { VOICE_GATE, createVoiceGate } from "@/lib/voiceHandsFree";

// Listening that stays on while a record is open, for "Form 606, air check passed".
//
// Different from useSpeechCommand on purpose. That hook hears ONE line after a tap and stops. This
// one stays ready until it is switched off, and hands every finished sentence to the caller, which
// decides whether it was meant for the form (voiceHandsFree.ts looks for the trigger).
//
// WAITING QUIETLY (2026-10-07, after the first day on the tablet). Android plays its own tone each
// time speech recognition starts or stops, and a page cannot silence it. Kept running through
// silence, recognition gives up every few seconds and has to be restarted - so the operator's
// headset played that tone every five seconds, all shift. Now, between sentences, recognition is
// OFF and the microphone LEVEL is watched instead (getUserMedia + an analyser, which is silent).
// Recognition is started only when a voice is heard (createVoiceGate), so the tones come once
// around each thing that is said. The first word can be clipped by the fraction of a second that
// start takes; voiceHandsFree accepts "606 ..." without the "Form" at the start of a sentence.
//
// WHAT THE BROWSER DOES NOT PROMISE, and this is built around:
//  - The first start() must run inside the tap that switched listening on. Later starts do not
//    need a tap, because the microphone permission has been given.
//  - Android may not let the level monitor and speech recognition hold the microphone together.
//    It is tried that way first ("hold"), because with a Bluetooth headset dropping the microphone
//    makes the headset switch modes. If recognition then keeps hearing nothing when a voice
//    started it, the monitor lets go of the microphone before each start ("release"); and if that
//    fails too, this falls back to restarting recognition through silence, tones and all.
//  - Recognition runs on Google's servers: no network, no listening. Errors that will not fix
//    themselves (microphone refused, no microphone) switch listening off and say why.
//  - A page in the background is not given the microphone, so listening pauses while the page is
//    hidden. A screen wake lock is held while listening is on, because a tablet that sleeps stops
//    listening without telling anyone.
//  - The tablet must not hear itself: everything is paused while it speaks a confirmation.

const Recognition: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined;

export const handsFreeSupported = !!Recognition;

export type HandsFreeState = "off" | "listening" | "paused" | "error";

/** Errors after which trying again cannot help: the person has to do something first. */
const FATAL = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"]);

/** How the level monitor and recognition share the microphone; "restart" is the fallback with no monitor. */
type Sharing = "hold" | "release" | "restart";
/** Voice-started recognitions in a row that heard no words before the next way of sharing is tried. */
const EMPTY_RUNS_BEFORE_NEXT = 3;

let audioContext: any = null;

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

  // The quiet wait.
  const sharing = useRef<Sharing>("hold");
  const emptyRuns = useRef(0);
  const gate = useRef(createVoiceGate());
  const stream = useRef<MediaStream | null>(null);
  const analyser = useRef<any>(null);
  const source = useRef<any>(null);
  const levelTimer = useRef<number | null>(null);
  const beginRef = useRef<(byVoice?: boolean) => void>(() => undefined);
  const waitRef = useRef<() => void>(() => undefined);

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

  const stopWatching = useCallback(() => {
    if (levelTimer.current !== null) { window.clearInterval(levelTimer.current); levelTimer.current = null; }
  }, []);
  const releaseMicrophone = useCallback(() => {
    try { source.current?.disconnect?.(); } catch { /* not connected */ }
    source.current = null;
    analyser.current = null;
    try { stream.current?.getTracks().forEach(t => t.stop()); } catch { /* already stopped */ }
    stream.current = null;
  }, []);

  /** Open the microphone for the level monitor. False when this device will not allow it. */
  const openMicrophone = useCallback(async (): Promise<boolean> => {
    if (analyser.current && stream.current?.getAudioTracks().some(t => t.readyState === "live")) return true;
    releaseMicrophone();
    try {
      if (!navigator.mediaDevices?.getUserMedia || !audioContext) return false;
      const s = await navigator.mediaDevices.getUserMedia({
        // No automatic gain: it would turn the room up during silence and hide the difference a voice makes.
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } as any,
      });
      if (audioContext.state === "suspended") await audioContext.resume();
      const node = audioContext.createAnalyser();
      node.fftSize = 1024;
      const src = audioContext.createMediaStreamSource(s);
      src.connect(node);                      // to the analyser only - never to the speakers
      stream.current = s;
      source.current = src;
      analyser.current = node;
      return true;
    } catch {
      return false;
    }
  }, [releaseMicrophone]);

  /** Recognition off, the level watched: silent until somebody speaks. */
  const waitQuietly = useCallback(async () => {
    if (!wanted.current || speaking.current || recRef.current) return;
    if (typeof document !== "undefined" && document.hidden) { setState("paused"); return; }
    if (sharing.current === "restart" || !(await openMicrophone())) {
      sharing.current = "restart";
      beginRef.current();
      return;
    }
    if (!wanted.current || speaking.current || recRef.current) return;
    setState("listening");
    stopWatching();
    gate.current.reset();
    const samples = new Float32Array(analyser.current.fftSize);
    levelTimer.current = window.setInterval(() => {
      const node = analyser.current;
      if (!node || !wanted.current || speaking.current || recRef.current) return;
      node.getFloatTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      if (!gate.current.push(Math.sqrt(sum / samples.length))) return;
      stopWatching();
      if (sharing.current === "release") releaseMicrophone();
      beginRef.current(true);
    }, VOICE_GATE.frameMs);
  }, [openMicrophone, releaseMicrophone, stopWatching]);
  waitRef.current = () => { void waitQuietly(); };

  const begin = useCallback((byVoice = false) => {
    if (!Recognition || !wanted.current || speaking.current || recRef.current) return;
    if (typeof document !== "undefined" && document.hidden) { setState("paused"); return; }
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.lang = RECOGNIZER_LANG[langRef.current];
    let heardWords = false;

    rec.onresult = (event: any) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const alternatives: string[] = [];
          for (let j = 0; j < result.length; j++) alternatives.push(result[j].transcript);
          failures.current = 0;
          if ((alternatives[0] ?? "").trim()) heardWords = true;
          setInterim(alternatives[0] ?? "");
          onHeardRef.current(alternatives);
        } else {
          text += result[0].transcript;
        }
      }
      if (text.trim()) { heardWords = true; setInterim(text); }
    };
    rec.onerror = (event: any) => {
      const code = String(event?.error ?? "");
      if (code === "aborted" || code === "no-speech") return;   // silence is the normal case here
      failures.current += 1;
      if (FATAL.has(code)) {
        wanted.current = false;
        setErrorCode(code);
        setState("error");
        stopWatching();
        releaseMicrophone();
        letSleep();
      } else {
        setErrorCode(code);                                      // "network" and the like: shown, then retried
      }
    };
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null;
      if (!wanted.current) return;
      if (byVoice) {
        if (heardWords) emptyRuns.current = 0;
        else {
          // A voice started it and no words came back: noise, or the microphone was not shared.
          gate.current.missed();
          emptyRuns.current += 1;
          if (emptyRuns.current >= EMPTY_RUNS_BEFORE_NEXT) {
            emptyRuns.current = 0;
            sharing.current = sharing.current === "hold" ? "release" : "restart";
            if (sharing.current === "restart") releaseMicrophone();
          }
        }
      }
      if (speaking.current || (typeof document !== "undefined" && document.hidden)) { setState("paused"); return; }
      if (sharing.current !== "restart") { waitRef.current(); return; }
      // The fallback: straight back on after a pause in speech; slower when it keeps failing, so a
      // dead network does not spin the recogniser.
      const wait = Math.min(300 + failures.current * 1000, 8000);
      retry.current = window.setTimeout(() => { retry.current = null; beginRef.current(); }, wait);
    };

    recRef.current = rec;
    try {
      rec.start();
      setState("listening");
    } catch {
      recRef.current = null;
      failures.current += 1;
      retry.current = window.setTimeout(() => { retry.current = null; beginRef.current(byVoice); }, 1500);
    }
  }, [letSleep, releaseMicrophone, stopWatching]);
  beginRef.current = begin;

  const halt = useCallback(() => {
    if (retry.current !== null) { window.clearTimeout(retry.current); retry.current = null; }
    stopWatching();
    const rec = recRef.current;
    recRef.current = null;
    try { rec?.abort(); } catch { /* not running */ }
  }, [stopWatching]);

  /** Call from the tap that switches listening on - nothing may be awaited before it. */
  const start = useCallback(() => {
    if (!Recognition) { setErrorCode("unsupported"); setState("error"); return; }
    unlockSound();                    // the level monitor needs the audio context a tap unlocks
    wanted.current = true;
    failures.current = 0;
    emptyRuns.current = 0;
    sharing.current = "hold";
    gate.current = createVoiceGate();
    setErrorCode(null);
    setInterim("");
    // Recognition once, now, inside the tap: this is what asks for the microphone. When it ends
    // (the first silence) the quiet wait takes over.
    begin();
    void holdAwake();
  }, [begin, holdAwake]);

  const stop = useCallback(() => {
    wanted.current = false;
    halt();
    releaseMicrophone();
    letSleep();
    setInterim("");
    setState("off");
  }, [halt, releaseMicrophone, letSleep]);

  /** Around a spoken confirmation, so the tablet does not hear itself. */
  const pauseForSpeech = useCallback(() => {
    speaking.current = true;
    halt();
    if (wanted.current) setState("paused");
  }, [halt]);
  const resumeAfterSpeech = useCallback(() => {
    speaking.current = false;
    if (!wanted.current) return;
    if (sharing.current === "restart") begin();
    else waitRef.current();
  }, [begin]);

  useEffect(() => {
    const onVisibility = () => {
      if (!wanted.current) return;
      if (document.hidden) { halt(); releaseMicrophone(); setState("paused"); }
      else {
        void holdAwake();
        if (sharing.current === "restart") begin();
        else waitRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [begin, halt, holdAwake, releaseMicrophone]);

  useEffect(() => () => {
    wanted.current = false;
    if (retry.current !== null) window.clearTimeout(retry.current);
    if (levelTimer.current !== null) window.clearInterval(levelTimer.current);
    try { recRef.current?.abort(); } catch { /* not running */ }
    try { stream.current?.getTracks().forEach(t => t.stop()); } catch { /* already stopped */ }
    try { wakeLock.current?.release?.(); } catch { /* already released */ }
  }, []);

  return { supported: handsFreeSupported, state, interim, errorCode, start, stop, pauseForSpeech, resumeAfterSpeech };
}

// ─── Sound ───────────────────────────────────────────────────────────────────

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
