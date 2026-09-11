import { format } from "date-fns";
import { Printer } from "lucide-react";
import {
  CCP1_LIMITS, VOICE_COMMANDS, VOICE_REGISTRY_VERSION, renderExample, type VoiceCommandDef,
} from "@/lib/voiceCommands";

// The card posted on the wall, one command per page.
//
// Generated from the same registry the parser uses, so the words on the wall are always the words
// the app listens for. It is a job aid, not a controlled document: the controlled records are
// FRM-507 and FRM-606. The version and print date are on every card so an out-of-date copy on the
// wall can be spotted.
//
// Rendered without TeamLayout so the sidebar and the Coach orb do not print.

function limitsText(def: VoiceCommandDef): string {
  if (def.id === "ccp1_bake") {
    return `Critical limits: oven at least ${CCP1_LIMITS.ovenMinF}°F and bake time at least ${CCP1_LIMITS.bakeMinMinutes} minutes. The app decides Pass or Fail from the numbers.`;
  }
  return "The vacuum level and seal width are not yet confirmed for this machine, so the gauge reading is recorded but not judged. A failed visual check or pull test stops sealing.";
}

function ScriptCard({ def, printed, last }: { def: VoiceCommandDef; printed: string; last: boolean }) {
  return (
    <section
      className="border-2 border-[#2A1F0E] rounded-lg p-6 mb-6 print:mb-0 print:border-0 print:rounded-none"
      style={{ breakAfter: last ? "auto" : "page", pageBreakAfter: last ? "auto" : "always" }}
    >
      <h2 className="text-3xl font-bold">{def.cardHeading}</h2>
      <p className="mt-1 text-base">Tap the Manufacturing Coach button (bottom right), then the microphone, and read:</p>

      <p className="mt-5 text-2xl leading-[2.6rem]">
        {def.script.map((part, i) =>
          "text" in part ? (
            <span key={i}>{part.text}</span>
          ) : (
            <span key={i} className="inline-block border-2 border-[#2A1F0E] rounded px-2 mx-0.5 font-semibold leading-8">
              {part.placeholder}{part.optional ? " (optional)" : ""}
            </span>
          ),
        )}
      </p>

      <p className="mt-5 text-base">
        <span className="font-semibold">Example: </span>"{renderExample(def)}"
      </p>

      <ul className="mt-5 list-disc pl-6 space-y-1 text-base">
        {def.tips.map((tip, i) => <li key={i}>{tip}</li>)}
      </ul>

      <p className="mt-5 text-base border-t border-[#2A1F0E]/40 pt-3">{limitsText(def)}</p>

      <p className="mt-6 text-xs">Voice script v{VOICE_REGISTRY_VERSION} · {def.formNumber} · printed {printed}</p>
    </section>
  );
}

export default function VoiceCommandScripts() {
  const printed = format(new Date(), "d MMM yyyy");
  return (
    <div className="min-h-screen bg-white text-[#2A1F0E]">
      <div className="max-w-3xl mx-auto p-6 print:p-0 print:max-w-none">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
          <div>
            <h1 className="text-xl font-bold">Voice command scripts</h1>
            <p className="text-sm">One card per command. Print and post them where the checks are done.</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-[#C89B3C] px-4 py-2 text-sm font-medium text-white hover:bg-[#B8892C]"
          >
            <Printer className="w-4 h-4" />Print
          </button>
        </div>
        {VOICE_COMMANDS.map((def, i) => (
          <ScriptCard key={def.id} def={def} printed={printed} last={i === VOICE_COMMANDS.length - 1} />
        ))}
      </div>
    </div>
  );
}
