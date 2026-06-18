import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updateModuleContent } from "@/lib/training";
import { SECTION_LABELS } from "@/lib/sopDocxParser";

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
              {key === "procedure" ? (
                <ol className="list-decimal pl-5 text-sm text-[#2A1F0E]/80 space-y-1">
                  {val.split("\n").filter(Boolean).map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              ) : (
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
            <Textarea
              rows={key === "procedure" ? 6 : 2}
              value={fields[key] ?? ""}
              onChange={e => setFields(prev => ({ ...prev, [key]: e.target.value }))}
            />
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
