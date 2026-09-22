import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RotateCcw, Send, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCoachMessages, setCoachMessages, useCoachMessages, type CoachMessage } from "./coachConversation";

const STARTERS = [
  "A piece of equipment broke down. What procedures do I follow and what do I fill out?",
  "What sanitizer concentration do we use on food-contact surfaces?",
  "What do I do with product that might be affected by a problem on the line?",
];

/**
 * The model is told to write plain text but still emits light markdown (`**bold**`, `*` bullets),
 * which would otherwise show as literal asterisks. Render just those two forms; nothing else.
 */
function ReplyText({ text }: { text: string }) {
  const lines = text.split("\n").map((line) => line.replace(/^(\s*)[*-]\s+/, "$1• "));
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            /^\*\*[^*]+\*\*$/.test(part) ? <strong key={j}>{part.slice(2, -2)}</strong> : part,
          )}
          {i < lines.length - 1 && "\n"}
        </span>
      ))}
    </>
  );
}

/** The conversation itself lives in coachConversation.ts, so it outlives this component. */
export function TeamCoachChat({ onNavigate }: { onNavigate: () => void }) {
  const navigate = useNavigate();
  const messages = useCoachMessages();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, sending]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || sending) return;
    const asked: CoachMessage = { role: "user", content: question };
    const next = [...getCoachMessages(), asked];
    setCoachMessages(next);
    setDraft("");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("team-coach", {
        body: { messages: next.map(({ role, content }) => ({ role, content })) },
      });
      if (error) throw error;
      if (!data?.reply) throw new Error(data?.error || "No reply");
      // Read the store again: the panel may have closed, or the page changed, while waiting.
      if (getCoachMessages().includes(asked)) {
        setCoachMessages([...getCoachMessages(), { role: "assistant", content: data.reply, sources: data.sources ?? [] }]);
      }
    } catch (e) {
      console.error("team-coach failed:", e);
      toast.error("The coach couldn't answer just now. Please try again.");
      // Take the question back out and put it in the box so it isn't lost.
      setCoachMessages(getCoachMessages().filter((m) => m !== asked));
      setDraft(question);
    } finally {
      setSending(false);
    }
  };

  const openDoc = (id: string) => {
    onNavigate();
    navigate(`/team/compliance/sops?doc=${id}`);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="rounded-lg p-4 border bg-white/70" style={{ borderColor: "hsl(43 52% 50% / 0.2)" }}>
              <p className="text-sm text-gray-800 leading-relaxed">
                Ask me how we do things here. I answer from our active SOPs, programs and forms, and I name the
                document each answer comes from.
              </p>
            </div>
            <p className="text-xs font-medium text-gray-500">Try asking:</p>
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full text-left text-sm rounded-md border px-3 py-2 bg-white/60 hover:bg-white text-gray-800"
                style={{ borderColor: "hsl(43 52% 50% / 0.25)" }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap text-white"
                  : "max-w-[95%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap text-gray-800 border bg-white/80"
              }
              style={m.role === "user" ? { background: "#C89B3C" } : { borderColor: "hsl(43 52% 50% / 0.2)" }}
            >
              {m.role === "assistant" ? <ReplyText text={m.content} /> : m.content}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t flex flex-wrap gap-1.5" style={{ borderColor: "hsl(43 52% 50% / 0.2)" }}>
                  {m.sources.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => openDoc(s.id)}
                      title={s.title}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border hover:bg-amber-50"
                      style={{ color: "#8a6a22", borderColor: "hsl(43 52% 50% / 0.4)" }}
                    >
                      <FileText className="w-3 h-3" />
                      {s.number}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking our documents…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t px-4 py-3 space-y-2 bg-white/60" style={{ borderColor: "hsl(43 52% 50% / 0.2)" }}>
        <div className="flex gap-2 items-end">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            placeholder="Ask a question…"
            rows={2}
            className="resize-none text-sm bg-white"
            disabled={sending}
          />
          <Button
            size="icon"
            onClick={() => send(draft)}
            disabled={sending || !draft.trim()}
            style={{ background: "#C89B3C" }}
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex justify-between items-center text-[11px] text-gray-500">
          <span>Always check the cited document before acting.</span>
          {messages.length > 0 && (
            <button onClick={() => setCoachMessages([])} disabled={sending} className="inline-flex items-center gap-1 hover:text-gray-800">
              <RotateCcw className="w-3 h-3" /> New conversation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
