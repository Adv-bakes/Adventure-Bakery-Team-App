import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { fetchQuizQuestions, saveQuizQuestions, updateModuleContent, QuizQuestion } from "@/lib/training";

type EditableQuestion = Omit<QuizQuestion, "id" | "sop_id">;

export const DEFAULT_ACKNOWLEDGMENT_TEXT =
  "I have read and understand this training and agree to comply with its procedures.";

interface QuizEditorProps {
  sopId: string;
  title?: string;
  content?: any;
  onContentChange?: (content: any) => void;
}

const blankQuestion = (n: number): EditableQuestion => ({
  question_number: n,
  question_text: "",
  options: ["", "", "", ""],
  correct_option_index: 0,
  hint: null,
  rationale: null,
});

export function QuizEditor({ sopId, title, content, onContentChange }: QuizEditorProps) {
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ackRequired, setAckRequired] = useState<boolean>(!!content?.acknowledgment?.required);
  const [ackText, setAckText] = useState<string>(content?.acknowledgment?.text ?? DEFAULT_ACKNOWLEDGMENT_TEXT);
  const [generating, setGenerating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const narrations: string[] = Array.isArray(content?.narrations)
    ? content.narrations.filter((n: any) => typeof n === "string" && n.trim())
    : [];
  const slideCount: number = Array.isArray(content?.slides) ? content.slides.length : 0;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchQuizQuestions(sopId)
      .then(qs => { if (!cancelled) setQuestions(qs.map(({ id, sop_id, ...rest }) => rest)); })
      .catch((e: any) => toast.error(e.message ?? "Failed to load quiz questions"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sopId]);

  const addQuestion = () => {
    setQuestions(prev => [...prev, blankQuestion(prev.length + 1)]);
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    setQuestions(prev => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((q, i) => ({ ...q, question_number: i + 1 }));
    });
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, question_number: i + 1 })));
  };

  const updateQuestion = (idx: number, field: keyof EditableQuestion, value: any) => {
    setQuestions(prev => prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  };

  const updateOption = (idx: number, optIdx: number, value: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== idx) return q;
      const options = q.options.map((o, j) => (j === optIdx ? value : o));
      return { ...q, options };
    }));
  };

  const addOption = (idx: number) => {
    setQuestions(prev => prev.map((q, i) => (i === idx ? { ...q, options: [...q.options, ""] } : q)));
  };

  const removeOption = (idx: number, optIdx: number) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== idx) return q;
      const options = q.options.filter((_, j) => j !== optIdx);
      let correct = q.correct_option_index;
      if (correct === optIdx) correct = 0;
      else if (correct > optIdx) correct--;
      return { ...q, options, correct_option_index: correct };
    }));
  };

  const regenerate = async () => {
    setConfirmRegenerate(false);
    setGenerating(true);
    try {
      const count = Math.min(15, Math.max(5, Math.ceil((slideCount || narrations.length) / 2)));
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { title, narrations, count },
      });
      if (error) throw error;
      if (!Array.isArray(data?.questions) || data.questions.length === 0) {
        throw new Error(data?.error ?? "No questions returned");
      }
      setQuestions(data.questions.map((q: any, i: number) => ({
        question_number: i + 1,
        question_text: q.question_text,
        options: q.options,
        correct_option_index: q.correct_option_index,
        hint: q.hint ?? null,
        rationale: q.rationale ?? null,
      })));
      toast.success(`Drafted ${data.questions.length} questions — review and save`);
    } catch (e: any) {
      toast.error(e.message ?? "Quiz generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateClick = () => {
    if (questions.length > 0) setConfirmRegenerate(true);
    else regenerate();
  };

  const saveQuiz = async () => {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        toast.error(`Question ${i + 1} is missing its text`);
        return;
      }
      if (q.options.filter(o => o.trim()).length < 2) {
        toast.error(`Question ${i + 1} needs at least 2 answer options`);
        return;
      }
    }
    setSaving(true);
    try {
      const cleaned = questions.map((q, i) => ({
        ...q,
        question_number: i + 1,
        question_text: q.question_text.trim(),
        options: q.options.filter(o => o.trim()),
        hint: q.hint?.trim() || null,
        rationale: q.rationale?.trim() || null,
      }));
      const acknowledgment = {
        required: ackRequired,
        text: ackText.trim() || DEFAULT_ACKNOWLEDGMENT_TEXT,
      };
      const nextContent = { ...(content ?? {}), acknowledgment };
      await Promise.all([
        saveQuizQuestions(sopId, cleaned),
        updateModuleContent(sopId, nextContent),
      ]);
      setQuestions(cleaned);
      onContentChange?.(nextContent);
      toast.success("Quiz saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save quiz");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 border-t pt-4" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
      <div className="flex items-center justify-between">
        <Label className="block">
          Quiz Questions{!loading ? ` (${questions.length})` : ""}
        </Label>
        {narrations.length > 0 && (
          <Button
            type="button" variant="outline" size="sm"
            className="text-[#9A6F1E] border-[#C89B3C]/40 hover:bg-[#C89B3C]/10"
            onClick={handleRegenerateClick}
            disabled={generating || loading}
          >
            <Wand2 className={`w-3.5 h-3.5 mr-1 ${generating ? "animate-pulse" : ""}`} />
            {generating ? "Generating…" : "Regenerate with AI"}
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading quiz…</p>
      ) : questions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No quiz questions yet. Add questions manually{narrations.length > 0 ? " or draft them with AI from the slide narrations" : ""}.
        </p>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={idx} className="rounded-md border p-3 space-y-2" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
              <div className="flex items-center justify-between">
                <Label className="font-normal text-xs">Question {idx + 1}</Label>
                <div className="flex items-center">
                  <Button
                    type="button" variant="ghost" size="icon"
                    onClick={() => moveQuestion(idx, -1)}
                    disabled={idx === 0}
                    title="Move question up"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-[#9A6F1E]" />
                  </Button>
                  <Button
                    type="button" variant="ghost" size="icon"
                    onClick={() => moveQuestion(idx, 1)}
                    disabled={idx === questions.length - 1}
                    title="Move question down"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-[#9A6F1E]" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(idx)} title="Delete question">
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
              <Input
                placeholder="Question text"
                value={q.question_text}
                onChange={e => updateQuestion(idx, "question_text", e.target.value)}
              />
              {q.options.map((opt, optIdx) => (
                <div key={optIdx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`quiz-correct-${sopId}-${idx}`}
                    checked={q.correct_option_index === optIdx}
                    onChange={() => updateQuestion(idx, "correct_option_index", optIdx)}
                    title="Mark as correct answer"
                  />
                  <Input
                    placeholder={`Option ${optIdx + 1}`}
                    value={opt}
                    onChange={e => updateOption(idx, optIdx, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(idx, optIdx)}
                    disabled={q.options.length <= 2}
                    title="Remove option"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#2A1F0E]/40" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => addOption(idx)}>
                <Plus className="w-3.5 h-3.5 mr-1" />Add Option
              </Button>
              <div className="space-y-1">
                <Label htmlFor={`quiz-hint-${sopId}-${idx}`} className="font-normal text-xs text-muted-foreground">
                  Hint (optional)
                </Label>
                <Input
                  id={`quiz-hint-${sopId}-${idx}`}
                  placeholder="Nudge shown if the employee asks for help"
                  value={q.hint ?? ""}
                  onChange={e => updateQuestion(idx, "hint", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`quiz-rationale-${sopId}-${idx}`} className="font-normal text-xs text-muted-foreground">
                  Rationale (optional)
                </Label>
                <Input
                  id={`quiz-rationale-${sopId}-${idx}`}
                  placeholder="Explanation shown after answering"
                  value={q.rationale ?? ""}
                  onChange={e => updateQuestion(idx, "rationale", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-md border p-3" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`ack-required-${sopId}`}
            checked={ackRequired}
            onCheckedChange={c => setAckRequired(!!c)}
          />
          <Label htmlFor={`ack-required-${sopId}`} className="cursor-pointer font-normal text-xs">
            Require an "agree to comply" acknowledgment to complete this module
          </Label>
        </div>
        {ackRequired && (
          <Textarea
            value={ackText}
            onChange={e => setAckText(e.target.value)}
            placeholder={DEFAULT_ACKNOWLEDGMENT_TEXT}
            className="text-xs h-16"
          />
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={saveQuiz} disabled={saving || loading} className="bg-[#C89B3C] hover:bg-[#B8892C]">
          {saving ? "Saving…" : "Save Quiz"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={addQuestion} disabled={loading} className="h-10">
          <Plus className="w-3.5 h-3.5 mr-1" />Add Question
        </Button>
      </div>

      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate quiz questions?</AlertDialogTitle>
            <AlertDialogDescription>
              AI will draft new questions from the slide narrations, replacing the {questions.length} question{questions.length !== 1 ? "s" : ""} shown
              below. Nothing is saved until you click Save Quiz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={regenerate} className="bg-[#C89B3C] hover:bg-[#B8892C]">
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
