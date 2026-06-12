import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileUp, Loader2, CheckCircle2, Presentation, ListChecks } from "lucide-react";
import { toast } from "sonner";
import {
  getTrainingSlideUrl, deleteTrainingSlide, updateModuleContent,
  computeSlideDuration, saveQuizQuestions, TRAINING_CATEGORY_LABELS,
  parseQuizCsv, type ImportedQuizQuestion,
} from "@/lib/training";
import { extractSpeakerNotes } from "@/lib/pptxNotes";

interface PptxImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (moduleId: string) => void;
  /** When set, the import replaces this module's content instead of creating a new module */
  existingModule?: { id: string; content: any };
  /** Defaults applied when creating a new module (ignored in replace mode) */
  defaults?: { training_category?: number; category?: string | null };
}

type Step = { label: string; state: "pending" | "active" | "done" };

export function PptxImportDialog({ open, onOpenChange, onImported, existingModule, defaults }: PptxImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [quizFile, setQuizFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [generateQuiz, setGenerateQuiz] = useState(true);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quizInputRef = useRef<HTMLInputElement>(null);

  const isReplace = !!existingModule;

  const pickFile = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pptx")) {
      toast.error("Please choose a .pptx file");
      return;
    }
    setFile(f);
    if (!isReplace && !title) {
      setTitle(f.name.replace(/\.pptx$/i, "").replace(/[-_]+/g, " ").trim());
    }
  };

  const pickQuizFile = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please choose a .csv file");
      return;
    }
    setQuizFile(f);
  };

  const setStep = (label: string) => {
    setSteps(prev => {
      const next = prev.map(s => (s.state === "active" ? { ...s, state: "done" as const } : s));
      return [...next, { label, state: "active" }];
    });
  };

  const finishSteps = () => {
    setSteps(prev => prev.map(s => (s.state === "active" ? { ...s, state: "done" as const } : s)));
  };

  const runImport = async () => {
    if (!file) return;
    if (!isReplace && !title.trim()) {
      toast.error("Title required");
      return;
    }
    setRunning(true);
    setSteps([]);
    let moduleId = existingModule?.id ?? "";

    try {
      // 0. Read hand-authored content up front so a bad file fails before any writes
      let authoredQuiz: ImportedQuizQuestion[] = [];
      if (quizFile) {
        setStep("Reading quiz CSV");
        authoredQuiz = parseQuizCsv(await quizFile.text());
        if (authoredQuiz.length === 0) throw new Error("Quiz CSV contained no questions");
      }
      setStep("Reading speaker notes");
      const authoredNotes = await extractSpeakerNotes(file);
      const authoredCount = authoredNotes.filter(n => n?.trim()).length;

      // 1. Create the module row (new mode) or clear old slides (replace mode)
      if (isReplace) {
        setStep("Removing existing slides");
        const oldSlides: string[] = Array.isArray(existingModule!.content?.slides)
          ? existingModule!.content.slides : [];
        for (const path of oldSlides) {
          await deleteTrainingSlide(path).catch(() => {});
        }
      } else {
        setStep("Creating draft module");
        const { data, error } = await (supabase as any)
          .from("sop_documents")
          .insert({
            title: title.trim(),
            type: "sop",
            status: "draft",
            training_category: defaults?.training_category ?? 1,
            category: defaults?.category ?? null,
            passing_score_pct: 80,
          })
          .select("id")
          .single();
        if (error) throw error;
        moduleId = data.id;
      }

      // 2. Upload the deck
      setStep("Uploading presentation");
      const sourcePath = `${moduleId}/source.pptx`;
      const { error: upErr } = await supabase.storage
        .from("training-content")
        .upload(sourcePath, file, { upsert: true });
      if (upErr) throw upErr;

      // 3. Convert to slide images
      setStep("Converting slides (may take a minute)");
      const { data: conv, error: convErr } = await supabase.functions.invoke("convert-pptx", {
        body: { sopId: moduleId, sourcePath },
      });
      if (convErr) throw convErr;
      if (conv?.error) throw new Error(conv.error);
      const slides: string[] = conv?.slides ?? [];
      if (slides.length === 0) throw new Error("Conversion produced no slides");

      // 4. Narration: speaker notes win; AI fills slides without notes
      if (authoredCount > 0) {
        setStep(`Using speaker notes as narration (${Math.min(authoredCount, slides.length)} of ${slides.length} slides)`);
      }
      const narrations: string[] = [];
      let narrationFailures = 0;
      for (let i = 0; i < slides.length; i++) {
        const authored = authoredNotes[i]?.trim();
        if (authored) {
          narrations.push(authored);
          continue;
        }
        setStep(`Writing narration ${i + 1} of ${slides.length}`);
        try {
          const url = await getTrainingSlideUrl(slides[i]);
          const { data, error } = await supabase.functions.invoke("generate-narration", {
            body: { imageUrl: url },
          });
          if (error || !data?.text) throw error ?? new Error("empty");
          narrations.push(data.text);
        } catch {
          narrations.push("");
          narrationFailures++;
        }
      }

      // 5. Persist slides + narrations + dwell durations
      setStep("Saving module content");
      const slideDurations = narrations.map(computeSlideDuration);
      const baseContent = isReplace ? (existingModule!.content ?? {}) : {};
      await updateModuleContent(moduleId, { ...baseContent, slides, narrations, slideDurations });

      // 6. Quiz: hand-authored CSV wins over AI generation
      let quizCount = 0;
      if (authoredQuiz.length > 0) {
        setStep("Saving hand-authored quiz");
        await saveQuizQuestions(moduleId, authoredQuiz.map((q, i) => ({ ...q, question_number: i + 1 })));
        quizCount = authoredQuiz.length;
      } else if (generateQuiz) {
        setStep("Drafting quiz questions");
        try {
          const count = Math.min(15, Math.max(5, Math.ceil(slides.length / 2)));
          const { data, error } = await supabase.functions.invoke("generate-quiz", {
            body: { title: title.trim() || undefined, narrations, count },
          });
          if (error || !Array.isArray(data?.questions)) throw error ?? new Error("empty");
          await saveQuizQuestions(moduleId, data.questions);
          quizCount = data.questions.length;
        } catch {
          toast.warning("Quiz generation failed — add questions manually in the quiz editor");
        }
      }

      finishSteps();
      const summary = [
        `${slides.length} slide${slides.length !== 1 ? "s" : ""}`,
        `${slides.length - narrationFailures} narration${slides.length - narrationFailures !== 1 ? "s" : ""}`,
        quizCount > 0 ? `${quizCount} ${authoredQuiz.length > 0 ? "imported" : "draft"} quiz questions` : null,
      ].filter(Boolean).join(", ");
      toast.success(`Import complete: ${summary}. Review before activating.`);
      onImported(moduleId);
      onOpenChange(false);
      setFile(null);
      setQuizFile(null);
      setTitle("");
      setSteps([]);
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
      setSteps(prev => prev.map(s => (s.state === "active" ? { ...s, label: `${s.label} — failed`, state: "done" as const } : s)));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isReplace ? "Replace Content from PowerPoint" : "Import Training from PowerPoint"}
          </DialogTitle>
          <DialogDescription>
            Converts each slide to an image. Speaker notes become the narration; AI writes it
            for slides without notes
            {quizFile ? ", and your quiz CSV is imported" : generateQuiz ? ", and a quiz is drafted" : ""}.
            {isReplace ? " Existing slides and narrations will be replaced." : ""}
            {!isReplace && (defaults?.category || defaults?.training_category != null)
              ? ` The module is created under "${defaults.category ?? TRAINING_CATEGORY_LABELS[defaults.training_category!] ?? ""}".`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pptx"
              className="hidden"
              onChange={e => { pickFile(e.target.files); e.target.value = ""; }}
              disabled={running}
            />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={running}>
              <Presentation className="w-4 h-4 mr-1" />
              {file ? file.name : "Choose .pptx file"}
            </Button>
          </div>

          {!isReplace && (
            <div>
              <Label htmlFor="pptx-title">Module Title</Label>
              <Input
                id="pptx-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={running}
                placeholder="e.g. Allergen Management in Shared Spaces"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={quizInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { pickQuizFile(e.target.files); e.target.value = ""; }}
              disabled={running}
            />
            <Button type="button" variant="outline" onClick={() => quizInputRef.current?.click()} disabled={running}>
              <ListChecks className="w-4 h-4 mr-1" />
              {quizFile ? quizFile.name : "Quiz CSV (optional)"}
            </Button>
            {quizFile && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setQuizFile(null)} disabled={running}>
                Remove
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="pptx-quiz"
              checked={quizFile ? false : generateQuiz}
              onCheckedChange={c => setGenerateQuiz(!!c)}
              disabled={running || !!quizFile}
            />
            <Label htmlFor="pptx-quiz" className="cursor-pointer font-normal">
              {quizFile
                ? "Quiz comes from the CSV file"
                : <>Draft quiz questions from the content{isReplace ? " (replaces existing questions)" : ""}</>}
            </Label>
          </div>

          {steps.length > 0 && (
            <ul className="space-y-1 rounded-md border p-3 text-sm" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
              {steps.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  {s.state === "active"
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C89B3C]" />
                    : <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                  <span className={s.state === "active" ? "" : "text-muted-foreground"}>{s.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>Cancel</Button>
          <Button onClick={runImport} disabled={!file || running} className="bg-[#C89B3C] hover:bg-[#B8892C]">
            <FileUp className="w-4 h-4 mr-1" />
            {running ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
