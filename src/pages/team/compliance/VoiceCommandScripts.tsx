import { format } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import { Printer } from "lucide-react";
import {
  VOICE_COMMANDS, VOICE_REGISTRY_VERSION, renderExample, type VoiceCommandDef,
} from "@/lib/voiceCommands";
import type { VoiceLang } from "@/lib/voiceLexicon";
import { VOICE_MSG } from "@/lib/voiceMessages";

// The cards posted on the wall, one command per page, one language per card.
//
// Generated from the same registry the parser uses, so the words on the wall are always the words
// the app listens for. It is a job aid, not a controlled document: the controlled records are
// FRM-507 and FRM-606. The version and print date are on every card so an out-of-date copy on the
// wall can be spotted.
//
// A card never mixes languages: a bilingual card invites reading half a line in each, and the parser
// reads a line wholly in one language. ?lang=en | es | both (default both).
//
// Rendered without TeamLayout so the sidebar and the Coach orb do not print.

type Choice = VoiceLang | "both";
const CHOICES: Array<{ value: Choice; label: string }> = [
  { value: "both", label: "Both" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

function ScriptCard({ def, lang, last }: { def: VoiceCommandDef; lang: VoiceLang; last: boolean }) {
  const text = def.text[lang];
  const card = VOICE_MSG[lang].card;
  const printed = lang === "es"
    ? format(new Date(), "d 'de' MMM yyyy", { locale: esLocale })
    : format(new Date(), "d MMM yyyy");
  return (
    <section
      lang={lang}
      className="border-2 border-[#2A1F0E] rounded-lg p-6 mb-6 print:mb-0 print:border-0 print:rounded-none"
      style={{ breakAfter: last ? "auto" : "page", pageBreakAfter: last ? "auto" : "always" }}
    >
      <h2 className="text-3xl font-bold">{text.cardHeading}</h2>
      <p className="mt-1 text-base">{card.intro}</p>

      <p className="mt-5 text-2xl leading-[2.6rem]">
        {text.script.map((part, i) =>
          "text" in part ? (
            <span key={i}>{part.text}</span>
          ) : (
            <span key={i} className="inline-block border-2 border-[#2A1F0E] rounded px-2 mx-0.5 font-semibold leading-8">
              {part.placeholder}{part.optional ? card.optional : ""}
            </span>
          ),
        )}
      </p>

      <p className="mt-5 text-base">
        <span className="font-semibold">{card.example}</span>"{renderExample(def, lang)}"
      </p>

      <ul className="mt-5 list-disc pl-6 space-y-1 text-base">
        {text.tips.map((tip, i) => <li key={i}>{tip}</li>)}
      </ul>

      <p className="mt-5 text-base border-t border-[#2A1F0E]/40 pt-3">{text.limitsText}</p>

      <p className="mt-6 text-xs">{card.footer(VOICE_REGISTRY_VERSION, def.formNumber, printed)}</p>
    </section>
  );
}

export default function VoiceCommandScripts() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("lang");
  const choice: Choice = raw === "en" || raw === "es" ? raw : "both";
  const langs: VoiceLang[] = choice === "both" ? ["en", "es"] : [choice];
  const cards = langs.flatMap(lang => VOICE_COMMANDS.map(def => ({ def, lang })));

  return (
    <div className="min-h-screen bg-white text-[#2A1F0E]">
      <div className="max-w-3xl mx-auto p-6 print:p-0 print:max-w-none">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
          <div>
            <h1 className="text-xl font-bold">Voice command scripts</h1>
            <p className="text-sm">One card per command and language. Print and post them where the checks are done.</p>
            <div role="group" aria-label="Language" className="mt-2 inline-flex rounded-md border border-[#C89B3C]/50 overflow-hidden text-sm">
              {CHOICES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={choice === c.value}
                  onClick={() => setParams(c.value === "both" ? {} : { lang: c.value }, { replace: true })}
                  className={`px-3 py-1 ${choice === c.value ? "bg-[#C89B3C] text-white font-semibold" : "bg-white hover:bg-[#C89B3C]/10"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-[#C89B3C] px-4 py-2 text-sm font-medium text-white hover:bg-[#B8892C]"
          >
            <Printer className="w-4 h-4" />Print
          </button>
        </div>
        {cards.map(({ def, lang }, i) => (
          <ScriptCard key={`${lang}-${def.id}`} def={def} lang={lang} last={i === cards.length - 1} />
        ))}
      </div>
    </div>
  );
}
