import { useState } from "react";
import { MessageSquare, Mic } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceCommandPanel } from "@/components/team/voice/VoiceCommandPanel";
import type { VoiceLang } from "@/lib/voiceLexicon";
import { TeamCoachChat } from "./TeamCoachChat";

type CoachTab = "chat" | "ccp";
const TAB_KEY = "team-coach-tab";

function readTab(): CoachTab {
  try {
    return localStorage.getItem(TAB_KEY) === "ccp" ? "ccp" : "chat";
  } catch {
    return "chat";
  }
}

/** The Team Portal Coach panel: ask questions, or record a CCP check by voice. */
export function TeamCoachPanel({
  close,
  voiceLang,
}: {
  close: () => void;
  voiceLang: VoiceLang;
}) {
  // A floor operator who always records CCPs lands back on that tab.
  const [tab, setTab] = useState<CoachTab>(readTab);
  const changeTab = (v: string) => {
    const next: CoachTab = v === "ccp" ? "ccp" : "chat";
    setTab(next);
    try { localStorage.setItem(TAB_KEY, next); } catch { /* storage unavailable */ }
  };

  return (
    <Tabs value={tab} onValueChange={changeTab} className="flex flex-col flex-1 min-h-0">
      <div className="px-5 pt-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chat" className="gap-1.5"><MessageSquare className="w-4 h-4" /> Ask the Coach</TabsTrigger>
          <TabsTrigger value="ccp" className="gap-1.5"><Mic className="w-4 h-4" /> Record CCP</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="chat" className="flex-1 min-h-0 mt-0 flex flex-col data-[state=inactive]:hidden">
        <TeamCoachChat onNavigate={close} />
      </TabsContent>
      <TabsContent value="ccp" className="flex-1 min-h-0 mt-0 overflow-y-auto p-5 data-[state=inactive]:hidden">
        <VoiceCommandPanel onDone={close} defaultLang={voiceLang} />
      </TabsContent>
    </Tabs>
  );
}
