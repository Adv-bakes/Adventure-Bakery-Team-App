import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseSopDocx, type ParsedSop, type SopType } from "@/lib/sopDocxParser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, FileText, ChevronRight, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface QueueItem {
  file: File;
  status: "pending" | "parsing" | "ready" | "saving" | "done" | "error";
  parsed?: ParsedSop;
  error?: string;
}

interface SopImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

const TYPES: SopType[] = ["sop", "form", "policy"];
const TYPE_LABELS: Record<SopType, string> = { sop: "SOP", form: "Form", policy: "Policy" };

type ImportMode = "existing" | "generate";

export function SopImportDialog({ open, onOpenChange, onImported }: SopImportDialogProps) {
  const [mode, setMode] = useState<ImportMode>("existing");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMode("existing");
    setQueue([]);
    setActiveIdx(null);
    setDragOver(false);
  };

  const close = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const addFiles = async (files: FileList | File[]) => {
    const docxFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith(".docx"));
    if (!docxFiles.length) {
      toast.error("Please drop .docx files only");
      return;
    }
    const newItems: QueueItem[] = docxFiles.map(f => ({ file: f, status: "pending" }));
    const startIdx = queue.length;
    setQueue(prev => [...prev, ...newItems]);

    for (let i = 0; i < newItems.length; i++) {
      const idx = startIdx + i;
      setQueue(prev => prev.map((q, qi) => (qi === idx ? { ...q, status: "parsing" } : q)));
      try {
        const parsed = await parseSopDocx(newItems[i].file);
        setQueue(prev => prev.map((q, qi) => (qi === idx ? { ...q, status: "ready", parsed } : q)));
        if (activeIdx === null) setActiveIdx(idx);
      } catch (e: any) {
        setQueue(prev => prev.map((q, qi) => (qi === idx ? { ...q, status: "error", error: e?.message || "Failed to parse file" } : q)));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const updateActiveParsed = (patch: Partial<ParsedSop>) => {
    if (activeIdx === null) return;
    setQueue(prev => prev.map((q, qi) => {
      if (qi !== activeIdx || !q.parsed) return q;
      return { ...q, parsed: { ...q.parsed, ...patch } };
    }));
  };

  const updateActiveContent = (patch: Partial<ParsedSop["content"]>) => {
    if (activeIdx === null) return;
    setQueue(prev => prev.map((q, qi) => {
      if (qi !== activeIdx || !q.parsed) return q;
      return { ...q, parsed: { ...q.parsed, content: { ...q.parsed.content, ...patch } } };
    }));
  };

  const saveActive = async () => {
    if (activeIdx === null) return;
    const item = queue[activeIdx];
    if (!item?.parsed) return;
    if (!item.parsed.title || !item.parsed.sop_number) {
      toast.error("SOP number and title are required");
      return;
    }
    setQueue(prev => prev.map((q, qi) => (qi === activeIdx ? { ...q, status: "saving" } : q)));
    const p = item.parsed;
    const payload = {
      sop_number: p.sop_number,
      title: p.title,
      type: p.type,
      revision: p.revision || null,
      effective_date: p.effective_date || null,
      approved_by: p.approved_by || null,
      sqf_reference: p.sqf_reference || null,
      sqf_required: p.sqf_required,
      status: "draft",
      content: p.type === "policy"
        ? { statement: p.content.statement }
        : {
            purpose: p.content.purpose,
            scope: p.content.scope,
            responsibility: p.content.responsibility,
            procedure: p.content.procedure,
            form_references: p.content.form_references,
            records: p.content.records,
            governing_reference: p.content.governing_reference,
          },
    };
    const { error } = await (supabase as any).from("sop_documents").insert(payload);
    if (error) {
      setQueue(prev => prev.map((q, qi) => (qi === activeIdx ? { ...q, status: "error", error: error.message } : q)));
      toast.error(error.message);
      return;
    }
    setQueue(prev => prev.map((q, qi) => (qi === activeIdx ? { ...q, status: "done" } : q)));
    toast.success(`Imported "${p.title}"`);
    onImported?.();

    const nextIdx = queue.findIndex((q, qi) => qi > activeIdx && q.status === "ready");
    setActiveIdx(nextIdx === -1 ? null : nextIdx);
  };

  const total = queue.length;
  const completed = queue.filter(q => q.status === "done" || q.status === "error").length;
  const active = activeIdx !== null ? queue[activeIdx] : null;
  const parsed = active?.parsed;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import SOPs from Word (.docx)</DialogTitle></DialogHeader>

        <div className="flex gap-2 rounded-lg border p-1" style={{ borderColor: "rgba(200,155,60,0.2)", background: "rgba(0,0,0,0.15)" }}>
          <button
            onClick={() => setMode("existing")}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            style={{
              background: mode === "existing" ? "rgba(200,155,60,0.18)" : "transparent",
              color: mode === "existing" ? "#F5F1E6" : "rgba(245,241,230,0.6)",
            }}
          >
            <UploadCloud className="w-4 h-4" />Import existing SOP
          </button>
          <button
            onClick={() => setMode("generate")}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            style={{
              background: mode === "generate" ? "rgba(200,155,60,0.18)" : "transparent",
              color: mode === "generate" ? "#F5F1E6" : "rgba(245,241,230,0.6)",
            }}
          >
            <Sparkles className="w-4 h-4" />Generate SOP from source document
          </button>
        </div>

        {mode === "generate" ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center" style={{ borderColor: "rgba(200,155,60,0.2)" }}>
            <Sparkles className="w-8 h-8" style={{ color: "#C89B3C" }} />
            <p className="text-sm font-medium" style={{ color: "#F5F1E6" }}>Generate SOP from source document</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Coming soon — upload a raw source document (e.g. a process video transcript, vendor spec, or rough notes) and have a draft SOP generated automatically for review.
            </p>
          </div>
        ) : queue.length === 0 ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors"
            style={{
              borderColor: dragOver ? "#C89B3C" : "rgba(200,155,60,0.3)",
              background: dragOver ? "rgba(200,155,60,0.08)" : "transparent",
            }}
          >
            <UploadCloud className="w-8 h-8" style={{ color: "#C89B3C" }} />
            <p className="text-sm font-medium" style={{ color: "#F5F1E6" }}>Drag & drop .docx files here, or click to browse</p>
            <p className="text-xs text-muted-foreground">Supports multiple files — they'll be processed and reviewed one by one.</p>
            <input
              ref={inputRef}
              type="file"
              accept=".docx"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{completed} of {total} processed</span>
                <span>{Math.round((completed / total) * 100)}%</span>
              </div>
              <Progress value={(completed / total) * 100} />
            </div>

            <div className="flex flex-wrap gap-2">
              {queue.map((q, i) => (
                <button
                  key={i}
                  onClick={() => q.parsed && setActiveIdx(i)}
                  disabled={!q.parsed}
                  className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                  style={{
                    borderColor: i === activeIdx ? "#C89B3C" : "rgba(200,155,60,0.2)",
                    background: i === activeIdx ? "rgba(200,155,60,0.1)" : "transparent",
                  }}
                >
                  {q.status === "done" && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                  {q.status === "error" && <AlertTriangle className="w-3 h-3 text-red-400" />}
                  {(q.status === "pending" || q.status === "parsing" || q.status === "saving") && <FileText className="w-3 h-3 text-muted-foreground" />}
                  {q.status === "ready" && <ChevronRight className="w-3 h-3" style={{ color: "#C89B3C" }} />}
                  <span className="truncate max-w-[140px]">{q.file.name}</span>
                </button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()}>
                <UploadCloud className="w-3.5 h-3.5 mr-1" />Add more
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".docx"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </div>

            {active?.status === "parsing" && (
              <p className="text-sm text-muted-foreground">Parsing {active.file.name}…</p>
            )}
            {active?.status === "error" && (
              <p className="text-sm text-red-400">Failed to parse {active.file.name}: {active.error}</p>
            )}

            {parsed && (
              <div className="space-y-4 border-t pt-4" style={{ borderColor: "rgba(200,155,60,0.15)" }}>
                {parsed.warnings.length > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-medium text-amber-900"><AlertTriangle className="w-3.5 h-3.5" />Review before saving</div>
                    {parsed.warnings.map((w, i) => <p key={i}>• {w}</p>)}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div><Label>SOP / Form Number *</Label><Input value={parsed.sop_number} onChange={e => updateActiveParsed({ sop_number: e.target.value, type: detectTypeLocal(e.target.value) })} /></div>
                  <div><Label>Revision</Label><Input value={parsed.revision} onChange={e => updateActiveParsed({ revision: e.target.value })} /></div>
                </div>
                <div><Label>Title *</Label><Input value={parsed.title} onChange={e => updateActiveParsed({ title: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={parsed.type} onValueChange={v => updateActiveParsed({ type: v as SopType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Effective Date</Label><Input type="date" value={parsed.effective_date} onChange={e => updateActiveParsed({ effective_date: e.target.value })} /></div>
                  <div><Label>Approved By</Label><Input value={parsed.approved_by} onChange={e => updateActiveParsed({ approved_by: e.target.value })} /></div>
                </div>
                <div><Label>SQF Reference</Label><Input value={parsed.sqf_reference} onChange={e => updateActiveParsed({ sqf_reference: e.target.value })} /></div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="sqf_required"
                    checked={parsed.sqf_required}
                    onCheckedChange={v => updateActiveParsed({ sqf_required: !!v })}
                  />
                  <Label htmlFor="sqf_required" className="cursor-pointer">Required for SQF audit</Label>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline">{TYPE_LABELS[parsed.type]}</Badge>
                  <Badge className="bg-gray-500/20 text-gray-300">draft</Badge>
                </div>

                {parsed.type === "policy" ? (
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label>Policy Statement</Label>
                      <Textarea
                        rows={10}
                        value={parsed.content.statement ?? ""}
                        onChange={e => updateActiveContent({ statement: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    <div><Label>Purpose</Label><Textarea rows={2} value={parsed.content.purpose} onChange={e => updateActiveContent({ purpose: e.target.value })} /></div>
                    <div><Label>Scope</Label><Textarea rows={2} value={parsed.content.scope} onChange={e => updateActiveContent({ scope: e.target.value })} /></div>
                    <div><Label>Responsibility</Label><Textarea rows={2} value={parsed.content.responsibility} onChange={e => updateActiveContent({ responsibility: e.target.value })} /></div>
                    <div>
                      <Label>Procedure (steps, one per line)</Label>
                      <Textarea
                        rows={5}
                        value={parsed.content.procedure.join("\n")}
                        onChange={e => updateActiveContent({ procedure: e.target.value.split("\n").filter(Boolean) })}
                      />
                    </div>
                    <div><Label>Form References</Label><Textarea rows={2} value={parsed.content.form_references} onChange={e => updateActiveContent({ form_references: e.target.value })} /></div>
                    <div><Label>Records</Label><Textarea rows={2} value={parsed.content.records} onChange={e => updateActiveContent({ records: e.target.value })} /></div>
                    <div><Label>Governing Reference</Label><Textarea rows={2} value={parsed.content.governing_reference} onChange={e => updateActiveContent({ governing_reference: e.target.value })} /></div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Close</Button>
          {parsed && (
            <Button
              onClick={saveActive}
              disabled={active?.status === "saving"}
              className="bg-[#C89B3C] hover:bg-[#B8892C]"
            >
              {active?.status === "saving" ? "Saving…" : "Confirm & Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function detectTypeLocal(sopNumber: string): SopType {
  const n = sopNumber.trim().toUpperCase();
  if (n.startsWith("FSQM")) return "policy";
  if (n.startsWith("FRM")) return "form";
  return "sop";
}
