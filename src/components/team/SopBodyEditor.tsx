import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Bold, Italic, List } from "lucide-react";
import { toast } from "sonner";
import { updateModuleContent } from "@/lib/training";
import { SECTION_LABELS, groupProcedureSteps, parseInlineMarks } from "@/lib/sopDocxParser";

// Renders plain text with **bold** / *italic* inline marks as formatted spans.
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInlineMarks(text).map((s, i) =>
        s.bold ? <strong key={i}>{s.text}</strong>
        : s.italic ? <em key={i}>{s.text}</em>
        : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}

type Props = {
  sopId: string;
  // The record's content object (holds the structured body + attachments).
  content: any;
  docType: "sop" | "form" | "policy" | "training" | "fsqm";
  // Provided for admins → editable; omit → read-only.
  onChange?: (content: any) => void | Promise<void>;
};

// The sop/form body sections, in order, sourced from the parser's label map.
const BODY_SECTIONS = SECTION_LABELS.map(s => ({ key: s.key as string, display: s.display }));

export function SopBodyEditor({ sopId, content, docType, onChange }: Props) {
  const isAdmin = !!onChange;
  const isPolicy = docType === "policy";
  const [busy, setBusy] = useState(false);

  // Local editable copy of the body fields.
  const [statement, setStatement] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  // Ref to the Procedure textarea so the formatting toolbar can act on the selection.
  const procRef = useRef<HTMLTextAreaElement>(null);

  // Restores focus + selection after a state-driven value change (next frame).
  const restoreSelection = (start: number, end: number) => {
    requestAnimationFrame(() => {
      const ta = procRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(start, end);
    });
  };

  // Wraps the current selection in the Procedure field with a marker (e.g. ** for bold).
  const wrapProcedureSelection = (marker: string) => {
    const ta = procRef.current;
    if (!ta) return;
    const v = fields.procedure ?? "";
    const { selectionStart: s, selectionEnd: e } = ta;
    const sel = v.slice(s, e) || "text";
    const next = v.slice(0, s) + marker + sel + marker + v.slice(e);
    setFields(prev => ({ ...prev, procedure: next }));
    restoreSelection(s + marker.length, s + marker.length + sel.length);
  };

  // Prefixes the line under the caret with a bullet marker (turns it into a sub-bullet).
  const bulletProcedureLine = () => {
    const ta = procRef.current;
    if (!ta) return;
    const v = fields.procedure ?? "";
    const caret = ta.selectionStart;
    const lineStart = v.lastIndexOf("\n", caret - 1) + 1;
    if (/^\s*[•◦‣·\-*]\s/.test(v.slice(lineStart))) return; // already a bullet
    const next = v.slice(0, lineStart) + "• " + v.slice(lineStart);
    setFields(prev => ({ ...prev, procedure: next }));
    restoreSelection(caret + 2, caret + 2);
  };

  useEffect(() => {
    const c = content ?? {};
    setStatement(c.statement ?? "");
    const next: Record<string, string> = {};
    for (const { key } of BODY_SECTIONS) {
      next[key] = key === "procedure"
        ? (Array.isArray(c.procedure) ? c.procedure.join("\n") : "")
        : (c[key] ?? "");
    }
    setFields(next);
  }, [content]);

  const save = async () => {
    setBusy(true);
    try {
      const body: any = isPolicy
        ? { statement }
        : Object.fromEntries(BODY_SECTIONS.map(({ key }) =>
            [key, key === "procedure" ? fields.procedure.split("\n").map(s => s.trim()).filter(Boolean) : fields[key]]
          ));
      const merged = { ...(content ?? {}), ...body };
      await updateModuleContent(sopId, merged);
      await onChange?.(merged);
      toast.success("Document saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  // ----- Read-only rendering -----
  if (!isAdmin) {
    if (isPolicy) {
      return (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#9A6F1E] uppercase tracking-wide">Policy Statement</p>
          <p className="whitespace-pre-wrap text-sm text-[#2A1F0E]/80 leading-relaxed">{statement || "—"}</p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {BODY_SECTIONS.map(({ key, display }) => {
          const val = fields[key];
          if (!val?.trim()) return null;
          return (
            <div key={key} className="space-y-1">
              <p className="text-xs font-semibold text-[#9A6F1E] uppercase tracking-wide">{display}</p>
              {key === "procedure" ? (() => {
                const groups = groupProcedureSteps(val.split("\n").filter(Boolean));
                // A leading bullet block (no numbered step above it) renders as a plain
                // bullet list so it doesn't get a stray "1." number.
                const lead = groups[0]?.text === "" ? groups[0] : null;
                const numbered = lead ? groups.slice(1) : groups;
                return (
                  <div className="text-sm text-[#2A1F0E]/80 space-y-1">
                    {lead && lead.bullets.length > 0 && (
                      <ul className="list-disc pl-5 space-y-0.5">
                        {lead.bullets.map((b, j) => <li key={j}><Inline text={b} /></li>)}
                      </ul>
                    )}
                    {numbered.length > 0 && (
                      <ol className="list-decimal pl-5 space-y-1">
                        {numbered.map((g, i) => (
                          <li key={i}>
                            <Inline text={g.text} />
                            {g.bullets.length > 0 && (
                              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                                {g.bullets.map((b, j) => <li key={j}><Inline text={b} /></li>)}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })() : (
                <p className="whitespace-pre-wrap text-sm text-[#2A1F0E]/80 leading-relaxed">{val}</p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ----- Editable (admin) -----
  return (
    <div className="space-y-3">
      {isPolicy ? (
        <div>
          <Label>Policy Statement</Label>
          <Textarea rows={10} value={statement} onChange={e => setStatement(e.target.value)} />
        </div>
      ) : (
        BODY_SECTIONS.map(({ key, display }) => (
          <div key={key}>
            <Label>{key === "procedure" ? "Procedure (one step per line)" : display}</Label>
            {key === "procedure" && (
              <div className="flex items-center gap-1 mt-1 mb-1">
                <Button type="button" variant="outline" size="sm" className="h-7 px-2" title="Bold (**text**)" onClick={() => wrapProcedureSelection("**")}>
                  <Bold className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 px-2" title="Italic (*text*)" onClick={() => wrapProcedureSelection("*")}>
                  <Italic className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 px-2" title="Make this line a sub-bullet" onClick={bulletProcedureLine}>
                  <List className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            <Textarea
              ref={key === "procedure" ? procRef : undefined}
              rows={key === "procedure" ? 6 : 2}
              value={fields[key] ?? ""}
              onChange={e => setFields(prev => ({ ...prev, [key]: e.target.value }))}
            />
            {key === "procedure" && (
              <p className="text-xs text-muted-foreground mt-1">
                Each line is a numbered step. Use the toolbar (or type) <code className="font-mono">**bold**</code> and <code className="font-mono">*italic*</code> for emphasis, and start a line with <code className="font-mono">•</code> or <code className="font-mono">-</code> to make it a sub-bullet under the step above it (no new number).
              </p>
            )}
          </div>
        ))
      )}
      <div className="flex justify-end">
        <Button onClick={save} disabled={busy} size="sm" className="bg-[#C89B3C] hover:bg-[#B8892C]">
          {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
          Save Document
        </Button>
      </div>
    </div>
  );
}
