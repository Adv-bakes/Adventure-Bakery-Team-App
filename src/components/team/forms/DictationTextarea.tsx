import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, MicOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Browser speech recognition (prefixed in Chrome/Edge) — same detection as
// SlideContentEditor's narration dictation.
const SpeechRecognitionImpl: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined;

const UNDO_DISMISS_MS = 8000;

interface DictationTextareaProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  rows?: number;
  className?: string;
  /** Smaller icons/inset for grid cells. */
  compact?: boolean;
}

/**
 * Textarea with an optional mic button (dictates onto the end of the current
 * value) and an AI cleanup button (fixes punctuation/capitalization into a
 * clear statement via the cleanup-form-text edge function). The mic button
 * only renders when the browser exposes SpeechRecognition; the AI button
 * always renders (server-side, no browser feature needed) but disables
 * without text. After a successful cleanup, a small "AI cleanup applied —
 * Undo" chip floats over the textarea's bottom-right corner for a few
 * seconds so the change is reversible before it's forgotten.
 */
export function DictationTextarea({ value, onChange, onBlur, disabled, rows, className, compact }: DictationTextareaProps) {
  const [listening, setListening] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [undoValue, setUndoValue] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const dismissTimerRef = useRef<number | null>(null);
  // onresult / cleanup both fire after the value may have changed several
  // renders since the async call started, so read the live value via ref.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => () => {
    recognitionRef.current?.stop?.();
    if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
  }, []);

  const clearUndo = () => {
    setUndoValue(null);
    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setListening(false);
  };

  const startListening = () => {
    if (!SpeechRecognitionImpl) return;
    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) transcript += event.results[i][0].transcript;
      }
      if (transcript) {
        clearUndo();
        const prev = valueRef.current ?? "";
        onChange(prev ? `${prev.trimEnd()} ${transcript.trim()}` : transcript.trim());
      }
    };
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") toast.error("Microphone access denied");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const cleanupWithAi = async () => {
    const original = valueRef.current ?? "";
    if (!original.trim()) return;
    setCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-form-text", {
        body: { text: original.trim() },
      });
      if (error) throw error;
      if (!data?.text) throw new Error("No cleaned text returned");
      onChange(data.text);
      setUndoValue(original);
      if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = window.setTimeout(() => setUndoValue(null), UNDO_DISMISS_MS);
    } catch (e: any) {
      toast.error(e.message ?? "AI cleanup failed");
    } finally {
      setCleaning(false);
    }
  };

  const undo = () => {
    if (undoValue == null) return;
    onChange(undoValue);
    clearUndo();
  };

  const showMic = !!SpeechRecognitionImpl && !disabled;
  const showAi = !disabled;
  const iconSize = compact ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <div className="relative">
      <Textarea
        value={value ?? ""}
        onChange={e => { clearUndo(); onChange(e.target.value); }}
        onBlur={onBlur}
        disabled={disabled}
        rows={rows}
        className={cn((showMic || showAi) && (compact ? "pr-11" : "pr-14"), className)}
      />
      {(showMic || showAi) && (
        <div className={cn("absolute flex items-center", compact ? "top-1 right-1 gap-0.5" : "top-2 right-2 gap-1")}>
          {showAi && (
            <button
              type="button"
              onClick={cleanupWithAi}
              disabled={cleaning || !(value ?? "").trim()}
              title="AI cleanup — fix punctuation and capitalization"
              className="text-[#9A6F1E]/70 hover:text-[#9A6F1E] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {cleaning
                ? <Loader2 className={cn(iconSize, "animate-spin")} />
                : <Sparkles className={iconSize} />}
            </button>
          )}
          {showMic && (
            <button
              type="button"
              onClick={() => (listening ? stopListening() : startListening())}
              title={listening ? "Stop dictation" : "Dictate"}
              className={cn(
                "text-[#9A6F1E]/70 hover:text-[#9A6F1E] transition-colors",
                listening && "text-red-500 hover:text-red-600 animate-pulse",
              )}
            >
              {listening ? <MicOff className={iconSize} /> : <Mic className={iconSize} />}
            </button>
          )}
        </div>
      )}
      {undoValue !== null && (
        <div
          className={cn(
            "absolute z-10 flex items-center rounded-md bg-[#2A1F0E] text-white shadow-md",
            compact ? "bottom-1 right-1 gap-1 px-1.5 py-0.5 text-[9px]" : "bottom-2 right-2 gap-1.5 px-2 py-1 text-[11px]",
          )}
        >
          <Check className={cn("text-green-400 shrink-0", compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
          <span className="whitespace-nowrap">AI cleanup applied</span>
          <button
            type="button"
            onClick={undo}
            className="whitespace-nowrap font-semibold underline underline-offset-2 hover:text-[#C89B3C]"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
