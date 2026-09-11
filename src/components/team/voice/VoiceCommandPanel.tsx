import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, Info, Keyboard, Loader2, Mic, Printer, RotateCcw, Square, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSpeechCommand } from "@/hooks/useSpeechCommand";
import { parseAlternatives, sameProduct, VOICE_COMMANDS, type VoiceParse, type VoiceWarning } from "@/lib/voiceCommands";
import {
  createVoiceEntry, fetchVoiceForm, findTodaysDrafts, newVoiceState, type VoiceForm,
} from "@/lib/voiceCommandTarget";
import type { FormResponse } from "@/lib/formResponses";
import { unsavedFormId } from "@/lib/unsavedChanges";

// The Manufacturing Coach's voice panel: hear one line from the wall card, show what was
// understood, and open the record with the row filled in. It never saves - FormEntry holds the
// row unsaved until the operator has looked at it.

const warningStyle: Record<VoiceWarning["level"], string> = {
  fail: "border-red-300 bg-red-50 text-red-800",
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  info: "border-[#C89B3C]/30 bg-[#C89B3C]/5 text-[#2A1F0E]",
};

export function WarningList({ warnings }: { warnings: VoiceWarning[] }) {
  if (!warnings.length) return null;
  return (
    <ul className="space-y-1.5">
      {warnings.map((w, i) => (
        <li key={i} className={`flex gap-2 rounded border px-2 py-1.5 text-xs ${warningStyle[w.level]}`}>
          {w.level === "fail" ? <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            : w.level === "warn" ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            : <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          <span>{w.text}</span>
        </li>
      ))}
    </ul>
  );
}

const productOf = (response: FormResponse): string => String(response.data?.product ?? "").trim();

export function VoiceCommandPanel({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [result, setResult] = useState<VoiceParse | null>(null);
  const [partial, setPartial] = useState(false);
  const [typed, setTyped] = useState("");
  const [showTyped, setShowTyped] = useState(false);
  const [opening, setOpening] = useState(false);
  const [choice, setChoice] = useState<{ form: VoiceForm; drafts: FormResponse[] } | null>(null);
  // "Say the rest" re-listens and parses what was already heard plus the new words.
  const prefix = useRef("");
  const busy = useRef(false);

  const speech = useSpeechCommand((alternatives, wasPartial) => {
    const lines = prefix.current ? alternatives.map(a => `${prefix.current} ${a}`) : alternatives;
    setResult(parseAlternatives(lines, new Date()));
    setPartial(wasPartial);
    setChoice(null);
  });

  // Called straight from the tap: Chrome only grants the microphone to a start() that runs
  // synchronously inside the user's gesture.
  const listen = (keep: string) => {
    prefix.current = keep;
    setResult(null);
    setChoice(null);
    speech.start();
  };

  const parseTyped = () => {
    if (!typed.trim()) return;
    prefix.current = "";
    setResult(parseAlternatives([typed], new Date()));
    setPartial(false);
    setChoice(null);
  };

  const clear = () => {
    prefix.current = "";
    setResult(null);
    setChoice(null);
    speech.reset();
  };

  const fill = result?.ok ? result.fill ?? null : null;

  const go = (form: VoiceForm, response: FormResponse) => {
    if (!fill || !result) return;
    navigate(`/team/compliance/forms/${form.id}/entries/${response.id}`, {
      state: { voiceCommand: newVoiceState(response.id, fill, result.transcript) },
    });
    clear();
    setTyped("");
    onDone();
  };

  // BrowserRouter cannot block navigation, so ask before abandoning a DIFFERENT entry's unsaved edits.
  const leaveOk = (targetId: string | null) => {
    const dirty = unsavedFormId();
    if (!dirty || dirty === targetId) return true;
    return window.confirm("The form you have open has unsaved changes. Leave it without saving?");
  };

  const run = async (task: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setOpening(true);
    try {
      await task();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the record");
    } finally {
      busy.current = false;
      setOpening(false);
    }
  };

  const open = () => run(async () => {
    if (!fill) return;
    const form = await fetchVoiceForm(fill.formNumber);
    const drafts = await findTodaysDrafts(form.id, fill.productionDate);
    const match = drafts.find(d => !productOf(d) || sameProduct(productOf(d), fill.entryFields.product));
    if (match) {
      if (leaveOk(match.id)) go(form, match);
      return;
    }
    // Today's records are all for another product: the operator decides, nothing is written yet.
    if (drafts.length) {
      setChoice({ form, drafts });
      return;
    }
    if (!leaveOk(null)) return;
    go(form, await createVoiceEntry(form, fill));
  });

  const startNew = (form: VoiceForm) => run(async () => {
    if (!fill || !leaveOk(null)) return;
    go(form, await createVoiceEntry(form, fill));
  });

  const listening = speech.state === "listening";

  return (
    <div className="space-y-4 text-[#2A1F0E]">
      <div>
        <p className="text-sm font-semibold">Record a CCP check by voice</p>
        <p className="text-xs text-[#2A1F0E]/80 mt-0.5">
          Tap the microphone and read the line from the card on the wall. The record opens with the row filled in -
          check it, then tap Save Draft.
        </p>
      </div>

      {/* Mic */}
      <div className="flex flex-col items-center gap-2 py-2">
        {speech.supported ? (
          <button
            type="button"
            onClick={() => (listening ? speech.stop() : listen(""))}
            disabled={opening}
            aria-label={listening ? "Stop listening" : "Start listening"}
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-md transition-colors ${
              listening ? "bg-red-600 text-white animate-pulse" : "bg-[#C89B3C] text-white hover:bg-[#B8892C]"
            }`}
          >
            {listening ? <Square className="w-8 h-8" /> : <Mic className="w-9 h-9" />}
          </button>
        ) : (
          <p className="text-xs text-center text-amber-900 bg-amber-50 border border-amber-300 rounded px-3 py-2">
            This browser has no speech recognition. Use Chrome on the tablet, or type the line below.
          </p>
        )}
        <p className="text-xs text-[#2A1F0E]/80 min-h-[1rem] text-center">
          {listening ? "Listening - read the line now…" : speech.state === "idle" && !result ? "Tap to start" : ""}
        </p>
        {(listening || speech.interim) && (
          <p className="text-sm text-center italic px-2">"{speech.interim || "…"}"</p>
        )}
        {speech.error && (
          <p className="text-xs text-red-800 bg-red-50 border border-red-300 rounded px-3 py-2">{speech.error}</p>
        )}
      </div>

      {/* Not understood */}
      {result && !result.ok && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
          <p className="text-sm text-amber-900">{result.message}</p>
          {result.transcript && <p className="text-xs text-[#2A1F0E]/80 italic">Heard: "{result.transcript}"</p>}
          <div className="flex flex-wrap gap-2">
            {speech.supported && (
              <Button size="sm" onClick={() => listen("")}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Try again
              </Button>
            )}
            {speech.supported && result.reason === "missing" && (
              <Button size="sm" variant="outline" onClick={() => listen(result.transcript)}>
                <Mic className="w-3.5 h-3.5 mr-1.5" />Say the rest
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Understood - preview before anything is written */}
      {fill && (
        <div className="rounded-md border border-[#C89B3C]/50 bg-white p-3 space-y-3">
          <div>
            <p className="text-sm font-semibold">{fill.formNumber} · {fill.title}</p>
            <p className="text-xs text-[#2A1F0E]/80">
              Production date {format(new Date(`${fill.productionDate}T00:00:00`), "EEE d MMM yyyy")}
              {partial && " · the line may have been cut short - check every value"}
            </p>
          </div>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
            {fill.summary.map(line => (
              <div key={line.label} className="contents">
                <dt className="text-[#2A1F0E]/80">{line.label}</dt>
                <dd className={`font-medium flex items-center gap-1 ${
                  line.flag === "fail" ? "text-red-700" : line.flag === "pass" ? "text-green-800" : ""
                }`}>
                  {line.flag === "pass" && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {line.flag === "fail" && <XCircle className="w-3.5 h-3.5" />}
                  {line.flag === "check" && <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />}
                  {line.value}
                </dd>
              </div>
            ))}
          </dl>
          <WarningList warnings={fill.warnings} />

          {choice ? (
            <div className="space-y-2 rounded border border-amber-300 bg-amber-50 p-2">
              <p className="text-xs text-amber-900">
                You already have a {fill.formNumber} record today for a different product. Where should this row go?
              </p>
              {choice.drafts.map(d => (
                <Button
                  key={d.id}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={opening}
                  onClick={() => { if (leaveOk(d.id)) go(choice.form, d); }}
                >
                  Add to the record for "{productOf(d) || "no product"}"
                </Button>
              ))}
              <Button size="sm" className="w-full bg-[#C89B3C] hover:bg-[#B8892C]" disabled={opening} onClick={() => startNew(choice.form)}>
                Start a new record for "{fill.entryFields.product}"
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button className="bg-[#C89B3C] hover:bg-[#B8892C]" onClick={open} disabled={opening}>
                {opening && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                Open {fill.formNumber}
              </Button>
              <Button variant="outline" onClick={() => (speech.supported ? listen("") : clear())} disabled={opening}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Try again
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Typed fallback: no speech support, a noisy floor, or testing at a desk. */}
      <div className="border-t border-[#C89B3C]/20 pt-3 space-y-2">
        {speech.supported && (
          <button
            type="button"
            onClick={() => setShowTyped(s => !s)}
            className="inline-flex items-center gap-1.5 text-xs text-[#9A6F1E] hover:underline"
          >
            <Keyboard className="w-3.5 h-3.5" />{showTyped ? "Hide the typed line" : "Type the line instead"}
          </button>
        )}
        {(showTyped || !speech.supported) && (
          <div className="space-y-2">
            <Textarea
              value={typed}
              onChange={e => setTyped(e.target.value)}
              rows={3}
              placeholder={`e.g. Create a ${VOICE_COMMANDS[0].title} for Product …, Lot …, Temperature 350 for 27 minutes.`}
              className="text-sm"
            />
            <Button size="sm" variant="outline" onClick={parseTyped} disabled={!typed.trim() || opening}>Use this line</Button>
          </div>
        )}
        <a
          href="/team/compliance/voice-commands/print"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#9A6F1E] hover:underline"
        >
          <Printer className="w-3.5 h-3.5" />Print the wall script
        </a>
      </div>
    </div>
  );
}
