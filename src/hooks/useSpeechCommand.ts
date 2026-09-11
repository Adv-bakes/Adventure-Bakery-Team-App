/* eslint-disable @typescript-eslint/no-explicit-any -- the Web Speech API (webkitSpeechRecognition and
   its events) has no TypeScript lib types; DictationTextarea types it the same way. */
import { useCallback, useEffect, useRef, useState } from "react";

// One spoken command, start to finish, through the browser's speech recognition.
//
// Different from DictationTextarea's mic on purpose. Dictation is continuous and appends as you
// talk; a command is ONE utterance that is then parsed, so recognition stops at the first final
// result and hands back every alternative the engine offers - the parser tries each, because the
// engine's first guess at a lot code is often not its best.
//
// ANDROID CHROME REALITIES this is built around:
//  - start() must run synchronously inside the tap handler. Any await before it and Chrome treats
//    the call as not user-initiated and refuses the microphone.
//  - Recognition runs on Google's servers, so a dropped connection surfaces as error "network".
//  - A long line with a pause in it sometimes ends without ever sending a final result. The last
//    interim text is then used, flagged as partial, rather than throwing the operator's words away.

const Recognition: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined;

export const speechRecognitionSupported = !!Recognition;

export type SpeechState = "idle" | "listening" | "done" | "error";

function errorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "The microphone is blocked. In Chrome, tap the lock icon beside the address, allow Microphone, then try again.";
    case "no-speech":
      return "I didn't hear anything. Tap the microphone and read the line.";
    case "audio-capture":
      return "No microphone was found on this device.";
    case "network":
      return "Voice recognition needs an internet connection. Check the Wi-Fi, or type the line below.";
    default:
      return `Voice recognition stopped (${code}). Try again, or type the line below.`;
  }
}

export function useSpeechCommand(onHeard: (alternatives: string[], partial: boolean) => void) {
  const [state, setState] = useState<SpeechState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const gotFinal = useRef(false);
  const lastInterim = useRef("");
  const onHeardRef = useRef(onHeard);
  onHeardRef.current = onHeard;

  const start = useCallback(() => {
    if (!Recognition) {
      setError("This browser has no speech recognition. Use Chrome, or type the line below.");
      setState("error");
      return;
    }
    try { recRef.current?.abort(); } catch { /* already stopped */ }

    const rec = new Recognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.lang = "en-US";
    gotFinal.current = false;
    lastInterim.current = "";
    setInterim("");
    setError(null);

    rec.onresult = (event: any) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const alternatives: string[] = [];
          for (let j = 0; j < result.length; j++) alternatives.push(result[j].transcript);
          gotFinal.current = true;
          setInterim(alternatives[0] ?? "");
          setState("done");
          try { rec.stop(); } catch { /* already stopping */ }
          onHeardRef.current(alternatives, false);
          return;
        }
        text += result[0].transcript;
      }
      lastInterim.current = text;
      setInterim(text);
    };
    rec.onerror = (event: any) => {
      if (event.error === "aborted") return;
      setError(errorMessage(event.error));
      setState("error");
    };
    rec.onend = () => {
      recRef.current = null;
      if (gotFinal.current) return;
      if (lastInterim.current.trim()) {
        setState("done");
        onHeardRef.current([lastInterim.current], true);
      } else {
        setState(s => (s === "error" ? s : "idle"));
      }
    };

    recRef.current = rec;
    setState("listening");
    try {
      rec.start();
    } catch (e: any) {
      recRef.current = null;
      setError(errorMessage(e?.name ?? "start-failed"));
      setState("error");
    }
  }, []);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* not running */ }
  }, []);

  const reset = useCallback(() => {
    try { recRef.current?.abort(); } catch { /* not running */ }
    recRef.current = null;
    setInterim("");
    setError(null);
    setState("idle");
  }, []);

  useEffect(() => () => {
    try { recRef.current?.abort(); } catch { /* not running */ }
  }, []);

  return { supported: speechRecognitionSupported, state, interim, error, start, stop, reset };
}
