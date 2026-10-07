/* eslint-disable @typescript-eslint/no-explicit-any -- the Web Speech API, the Wake Lock API and
   webkitAudioContext have no TypeScript lib types here; useSpeechCommand types them the same way. */
import { useCallback, useEffect, useRef, useState } from "react";
import { RECOGNIZER_LANG, type VoiceLang } from "@/lib/voiceLexicon";
import { VOICE_GATE, createVoiceGate, isListenKey, type ListenMode } from "@/lib/voiceHandsFree";

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

/** "ready" is button mode between presses: switched on, microphone closed, waiting for the button. */
export type HandsFreeState = "off" | "listening" | "ready" | "paused" | "error";

/** Errors after which trying again cannot help: the person has to do something first. */
const FATAL = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"]);

/**
 * What happens between sentences. "restart": recognition is started again through silence (the way
 * that works everywhere, with Android's tone each time). "button": nothing, until a button is
 * pressed. "hold" / "release": the quiet-mode trial, the level monitor sharing the microphone two ways.
 */
type Sharing = "hold" | "release" | "restart" | "button";
/**
 * Voice-started recognitions in a row that heard no words before the next way of sharing is tried.
 * One is enough to leave "hold": if recognition gets nothing while the monitor has the microphone,
 * it will get nothing the next time too, and each try costs the operator a check that was not heard.
 */
const EMPTY_RUNS_BEFORE_NEXT: Record<Sharing, number> = { hold: 1, release: 2, restart: Infinity, button: Infinity };

// BUTTON MODE (2026-10-07). The operator wears a Bluetooth headset; a press of its button, or of a
// Bluetooth pedal or clicker, starts ONE spell of listening. No tone through silence, no false
// starts from the sealer, and no trigger phrase - the press is the intent.
//  - A headset button reaches a web page only as a media key (play / pause / next / previous), and
//    only while the page is the device's "now playing" app. So a silent sound is looped to hold
//    that place (Chrome ignores anything under five seconds), and every media action is taken to
//    mean "listen". Which button a given headset sends, and whether Android passes it on while the
//    headset is in use, cannot be known from here: it is tried on the headset.
//  - A pedal or clicker pairs as a keyboard and sends an ordinary key, which always arrives.
function silentLoopUrl(): string {
  const seconds = 10, rate = 8000, n = seconds * rate;
  const bytes = new Uint8Array(44 + n);
  const view = new DataView(bytes.buffer);
  const ascii = (at: number, text: string) => { for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i); };
  ascii(0, "RIFF"); view.setUint32(4, 36 + n, true); ascii(8, "WAVE"); ascii(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  ascii(36, "data"); view.setUint32(40, n, true);
  bytes.fill(128, 44);                                   // 8-bit silence
  return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
}
const MEDIA_ACTIONS = ["play", "pause", "stop", "nexttrack", "previoustrack"] as const;

/** What the quiet wait is doing, shown on the bar so a trial on the tablet can be reported exactly. */
export interface HandsFreeTrace { sharing: Sharing; starts: number; heard: number }

let audioContext: any = null;

export function useHandsFreeSpeech(
  onHeard: (alternatives: string[], byButton: boolean) => void,
  options: { lang?: VoiceLang; mode?: ListenMode } = {},
) {
  const [state, setState] = useState<HandsFreeState>("off");
  const [trace, setTrace] = useState<HandsFreeTrace | null>(null);
  // QUIET IS A TRIAL, OFF UNLESS ASKED FOR. The first version made it the only way and it broke
  // listening on the tablet the same day; restarting through silence is the way that is known to work.
  const modeRef = useRef<ListenMode>(options.mode ?? "always");
  modeRef.current = options.mode ?? "always";
  const silentAudio = useRef<HTMLAudioElement | null>(null);
  const silentUrl = useRef<string | null>(null);
  const [presses, setPresses] = useState(0);
  /** A voice-started recognition has heard words under the current way of sharing, so an empty one after it is noise. */
  const proven = useRef(false);
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
  const beginRef = useRef<(byVoice?: boolean, byButton?: boolean) => void>(() => undefined);
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
      setTrace(t => (t ? { ...t, starts: t.starts + 1 } : t));
      if (sharing.current === "release") releaseMicrophone();
      beginRef.current(true);
    }, VOICE_GATE.frameMs);
  }, [openMicrophone, releaseMicrophone, stopWatching]);
  waitRef.current = () => { void waitQuietly(); };

  /** Keep the silent loop playing: recognition and the spoken confirmation each take the sound away for a moment. */
  const keepNowPlaying = useCallback(() => {
    const audio = silentAudio.current;
    if (!audio || sharing.current !== "button" || !wanted.current) return;
    void audio.play().catch(() => undefined);
    try { (navigator as any).mediaSession.playbackState = "playing"; } catch { /* not supported */ }
  }, []);

  const begin = useCallback((byVoice = false, byButton = false) => {
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
          onHeardRef.current(alternatives, byButton);
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
        if (heardWords) {
          emptyRuns.current = 0;
          proven.current = true;
          setTrace(t => (t ? { ...t, heard: t.heard + 1 } : t));
        } else if (proven.current) {
          // This way of sharing works, so a start that heard no words was a noise: do not start on it again.
          gate.current.missed();
        } else {
          // Nothing has been heard this way yet. That is the microphone not being shared, NOT noise -
          // raising the threshold here made the first version deaf to the operator's own voice.
          emptyRuns.current += 1;
          if (emptyRuns.current >= EMPTY_RUNS_BEFORE_NEXT[sharing.current]) {
            emptyRuns.current = 0;
            sharing.current = sharing.current === "hold" ? "release" : "restart";
            gate.current = createVoiceGate();
            if (sharing.current === "restart") releaseMicrophone();
            const now = sharing.current;
            setTrace(t => (t ? { ...t, sharing: now } : t));
          }
        }
      }
      if (speaking.current || (typeof document !== "undefined" && document.hidden)) { setState("paused"); return; }
      if (sharing.current === "button") { setState("ready"); keepNowPlaying(); return; }
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
      retry.current = window.setTimeout(() => { retry.current = null; beginRef.current(byVoice, byButton); }, 1500);
    }
  }, [letSleep, releaseMicrophone, stopWatching, keepNowPlaying]);
  beginRef.current = begin;

  const halt = useCallback(() => {
    if (retry.current !== null) { window.clearTimeout(retry.current); retry.current = null; }
    stopWatching();
    const rec = recRef.current;
    recRef.current = null;
    try { rec?.abort(); } catch { /* not running */ }
  }, [stopWatching]);

  /** One spell of listening, from a press of the headset button, a pedal, a key, or the button on the bar. */
  const listenOnce = useCallback(() => {
    if (!wanted.current || sharing.current !== "button") return;
    setPresses(n => n + 1);
    if (recRef.current || speaking.current) return;       // already listening, or the tablet is talking
    begin(false, true);
  }, [begin]);
  const listenOnceRef = useRef(listenOnce);
  listenOnceRef.current = listenOnce;

  const armButton = useCallback(() => {
    try {
      if (!silentUrl.current) silentUrl.current = silentLoopUrl();
      const audio = silentAudio.current ?? new Audio(silentUrl.current);
      audio.loop = true;
      audio.volume = 1;                                    // the file is silence; a muted element is not "now playing"
      silentAudio.current = audio;
      void audio.play().catch(() => undefined);
      const session = (navigator as any).mediaSession;
      if (session) {
        try { session.metadata = new (window as any).MediaMetadata({ title: "FRM-606 hands-free", artist: "Press to record a check" }); } catch { /* optional */ }
        for (const action of MEDIA_ACTIONS) {
          try { session.setActionHandler(action, () => { keepNowPlaying(); listenOnceRef.current(); }); } catch { /* this action is not offered here */ }
        }
        try { session.playbackState = "playing"; } catch { /* not supported */ }
      }
    } catch { /* no audio on this device: a pedal, a key or the button on the bar still work */ }
  }, [keepNowPlaying]);
  const disarmButton = useCallback(() => {
    try { silentAudio.current?.pause(); } catch { /* not playing */ }
    const session = (navigator as any).mediaSession;
    if (session) for (const action of MEDIA_ACTIONS) { try { session.setActionHandler(action, null); } catch { /* not set */ } }
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!wanted.current || sharing.current !== "button") return;
      const el = event.target as HTMLElement | null;
      if (!isListenKey(event.key, el ? { tag: el.tagName, editable: el.isContentEditable } : null, event.repeat)) return;
      event.preventDefault();                              // a pedal's Page Down must not scroll the form away
      listenOnceRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Call from the tap that switches listening on - nothing may be awaited before it. */
  const start = useCallback(() => {
    if (!Recognition) { setErrorCode("unsupported"); setState("error"); return; }
    unlockSound();                    // the level monitor needs the audio context a tap unlocks
    wanted.current = true;
    failures.current = 0;
    emptyRuns.current = 0;
    proven.current = false;
    sharing.current = modeRef.current === "voice" ? "hold" : modeRef.current === "button" ? "button" : "restart";
    setTrace(modeRef.current === "voice" ? { sharing: "hold", starts: 0, heard: 0 } : null);
    setPresses(0);
    if (sharing.current === "button") armButton();      // inside the tap: the silent loop may not start otherwise
    gate.current = createVoiceGate();
    setErrorCode(null);
    setInterim("");
    // Recognition once, now, inside the tap: this is what asks for the microphone. When it ends
    // (the first silence) the quiet wait takes over.
    begin();
    void holdAwake();
  }, [begin, holdAwake, armButton]);

  const stop = useCallback(() => {
    wanted.current = false;
    halt();
    releaseMicrophone();
    disarmButton();
    letSleep();
    setInterim("");
    setTrace(null);
    setState("off");
  }, [halt, releaseMicrophone, disarmButton, letSleep]);

  /** Around a spoken confirmation, so the tablet does not hear itself. */
  const pauseForSpeech = useCallback(() => {
    speaking.current = true;
    halt();
    if (wanted.current) setState("paused");
  }, [halt]);
  const resumeAfterSpeech = useCallback(() => {
    speaking.current = false;
    if (!wanted.current) return;
    if (sharing.current === "button") { setState("ready"); keepNowPlaying(); }
    else if (sharing.current === "restart") begin();
    else waitRef.current();
  }, [begin, keepNowPlaying]);

  useEffect(() => {
    const onVisibility = () => {
      if (!wanted.current) return;
      if (document.hidden) { halt(); releaseMicrophone(); setState("paused"); }
      else {
        void holdAwake();
        if (sharing.current === "button") { setState("ready"); keepNowPlaying(); }
        else if (sharing.current === "restart") begin();
        else waitRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [begin, halt, holdAwake, releaseMicrophone, keepNowPlaying]);

  useEffect(() => () => {
    wanted.current = false;
    if (retry.current !== null) window.clearTimeout(retry.current);
    if (levelTimer.current !== null) window.clearInterval(levelTimer.current);
    try { recRef.current?.abort(); } catch { /* not running */ }
    try { stream.current?.getTracks().forEach(t => t.stop()); } catch { /* already stopped */ }
    try { wakeLock.current?.release?.(); } catch { /* already released */ }
    try { silentAudio.current?.pause(); } catch { /* not playing */ }
    const session = (navigator as any).mediaSession;
    if (session) for (const action of MEDIA_ACTIONS) { try { session.setActionHandler(action, null); } catch { /* not set */ } }
    if (silentUrl.current) { try { URL.revokeObjectURL(silentUrl.current); } catch { /* gone */ } }
  }, []);

  return { supported: handsFreeSupported, state, interim, errorCode, trace, presses, start, stop, listenOnce, pauseForSpeech, resumeAfterSpeech };
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
