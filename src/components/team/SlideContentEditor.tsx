import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, ArrowRight, ImagePlus, Trash2, Mic, MicOff, Sparkles, Wand2, Volume2, Square, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  getTrainingSlideUrl, replaceTrainingSlide, deleteTrainingSlide, updateModuleContent,
  computeSlideDuration,
} from "@/lib/training";

interface SlideContentEditorProps {
  sopId: string;
  content: any;
  onContentChange: (content: any) => void;
}

// Browser speech recognition (prefixed in Chrome/Edge)
const SpeechRecognitionImpl: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined;

export function SlideContentEditor({ sopId, content, onContentChange }: SlideContentEditorProps) {
  const slides: string[] = Array.isArray(content?.slides) ? content.slides : [];
  const savedNarrations: string[] = Array.isArray(content?.narrations) ? content.narrations : [];
  const savedDurations: number[] = Array.isArray(content?.slideDurations) ? content.slideDurations : [];

  const [index, setIndex] = useState(0);
  const [slideUrl, setSlideUrl] = useState<string | null>(null);
  const [urlVersion, setUrlVersion] = useState(0);
  const [narration, setNarration] = useState("");
  const [duration, setDuration] = useState(20);
  const [durationTouched, setDurationTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [listening, setListening] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);

  const total = slides.length;
  const clampedIndex = Math.min(index, Math.max(total - 1, 0));

  // Load current slide image + narration draft when the slide changes
  useEffect(() => {
    setNarration(savedNarrations[clampedIndex] ?? "");
    setDuration(savedDurations[clampedIndex] ?? computeSlideDuration(savedNarrations[clampedIndex]));
    setDurationTouched(false);
    let cancelled = false;
    setSlideUrl(null);
    if (slides[clampedIndex]) {
      getTrainingSlideUrl(slides[clampedIndex])
        .then(url => { if (!cancelled) setSlideUrl(url); })
        .catch(() => { if (!cancelled) setSlideUrl(null); });
    }
    return () => { cancelled = true; };
  }, [sopId, clampedIndex, slides[clampedIndex], urlVersion]);

  // Stop dictation and speech when switching slides or unmounting
  useEffect(() => () => {
    recognitionRef.current?.stop?.();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);
  useEffect(() => { stopListening(); stopSpeech(); }, [clampedIndex]);

  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const stopSpeech = () => {
    if (ttsSupported) window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const speakNarration = () => {
    if (!ttsSupported || !narration.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(narration);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const persist = async (next: any) => {
    await updateModuleContent(sopId, next);
    onContentChange(next);
  };

  const saveNarration = async () => {
    setSaving(true);
    try {
      const narrations = slides.map((_, i) => (i === clampedIndex ? narration : savedNarrations[i] ?? ""));
      // Manual duration edit wins; otherwise recompute from the narration text
      const newDuration = durationTouched ? Math.max(0, Math.round(duration)) : computeSlideDuration(narration);
      const slideDurations = slides.map((_, i) =>
        i === clampedIndex ? newDuration : savedDurations[i] ?? computeSlideDuration(narrations[i]),
      );
      await persist({ ...(content ?? {}), narrations, slideDurations });
      setDuration(newDuration);
      setDurationTouched(false);
      toast.success(`Slide ${clampedIndex + 1} narration saved`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save narration");
    } finally {
      setSaving(false);
    }
  };

  const handleReplace = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setReplacing(true);
    try {
      await replaceTrainingSlide(slides[clampedIndex], file);
      setUrlVersion(v => v + 1);
      toast.success(`Slide ${clampedIndex + 1} image replaced`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to replace image");
    } finally {
      setReplacing(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    try {
      await deleteTrainingSlide(slides[clampedIndex]);
      const nextSlides = slides.filter((_, i) => i !== clampedIndex);
      const nextNarrations = slides
        .map((_, i) => savedNarrations[i] ?? "")
        .filter((_, i) => i !== clampedIndex);
      const nextDurations = slides
        .map((_, i) => savedDurations[i] ?? computeSlideDuration(savedNarrations[i]))
        .filter((_, i) => i !== clampedIndex);
      await persist({ ...(content ?? {}), slides: nextSlides, narrations: nextNarrations, slideDurations: nextDurations });
      setIndex(i => Math.max(Math.min(i, nextSlides.length - 1), 0));
      toast.success("Slide deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete slide");
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setListening(false);
  };

  const startListening = () => {
    if (!SpeechRecognitionImpl) {
      toast.error("Voice entry is not supported in this browser");
      return;
    }
    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) transcript += event.results[i][0].transcript;
      }
      if (transcript) {
        setNarration(prev => (prev ? `${prev.trimEnd()} ${transcript.trim()}` : transcript.trim()));
      }
    };
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") toast.error("Microphone access denied");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const generateFromSlide = async () => {
    if (!slideUrl) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-narration", {
        body: { imageUrl: slideUrl },
      });
      if (error) throw error;
      if (!data?.text) throw new Error("No narration returned");
      setNarration(data.text);
      if (!durationTouched) setDuration(computeSlideDuration(data.text));
      toast.success("Narration generated from slide — review before saving");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate narration");
    } finally {
      setGenerating(false);
    }
  };

  const generateAll = async () => {
    // Current slide's unsaved draft counts as its narration so we don't overwrite it
    const current = slides.map((_, i) => (i === clampedIndex ? narration : savedNarrations[i] ?? ""));
    const targets = current.map((n, i) => ({ n, i })).filter(({ n }) => !n.trim()).map(({ i }) => i);
    if (targets.length === 0) {
      toast.info("Every slide already has narration");
      return;
    }
    setBulkProgress({ done: 0, total: targets.length });
    try {
      const next = [...current];
      let failed = 0;
      for (let k = 0; k < targets.length; k++) {
        const i = targets[k];
        try {
          const url = await getTrainingSlideUrl(slides[i]);
          const { data, error } = await supabase.functions.invoke("generate-narration", {
            body: { imageUrl: url },
          });
          if (error || !data?.text) throw error ?? new Error("No narration returned");
          next[i] = data.text;
        } catch {
          failed++;
        }
        setBulkProgress({ done: k + 1, total: targets.length });
      }
      const slideDurations = slides.map((_, i) =>
        targets.includes(i) ? computeSlideDuration(next[i]) : savedDurations[i] ?? computeSlideDuration(next[i]),
      );
      await persist({ ...(content ?? {}), narrations: next, slideDurations });
      setNarration(next[clampedIndex] ?? "");
      setDuration(slideDurations[clampedIndex] ?? 20);
      setDurationTouched(false);
      if (failed > 0) toast.warning(`Generated ${targets.length - failed} narrations — ${failed} slide${failed !== 1 ? "s" : ""} failed`);
      else toast.success(`Generated narration for ${targets.length} slide${targets.length !== 1 ? "s" : ""} — review each before publishing`);
    } catch (e: any) {
      toast.error(e.message ?? "Bulk generation failed");
    } finally {
      setBulkProgress(null);
    }
  };

  const cleanupWithAi = async () => {
    if (!narration.trim()) return;
    setCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-narration", {
        body: { text: narration },
      });
      if (error) throw error;
      if (!data?.text) throw new Error("No cleaned text returned");
      setNarration(data.text);
      toast.success("Narration cleaned up");
    } catch (e: any) {
      toast.error(e.message ?? "AI cleanup failed");
    } finally {
      setCleaning(false);
    }
  };

  if (total === 0) {
    return <p className="text-xs text-muted-foreground">No slide images uploaded yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#2A1F0E]/60">Slide {clampedIndex + 1} of {total}</span>
          <div className="flex items-center gap-1.5" title="Minimum viewing time before employees can advance past this slide">
            <Clock className="w-3.5 h-3.5 text-[#9A6F1E]" />
            <Input
              type="number"
              min={0}
              value={duration}
              onChange={e => { setDuration(Number(e.target.value)); setDurationTouched(true); }}
              className="w-16 h-7 text-xs"
            />
            <span className="text-xs text-[#2A1F0E]/50">sec min</span>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => setIndex(i => Math.max(i - 1, 0))}
            disabled={clampedIndex === 0}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => setIndex(i => Math.min(i + 1, total - 1))}
            disabled={clampedIndex >= total - 1}
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {slideUrl ? (
        <img src={slideUrl} alt={`Slide ${clampedIndex + 1}`} className="w-full rounded-md border border-black/10" />
      ) : (
        <div className="w-full h-40 rounded-md bg-black/5 flex items-center justify-center text-xs text-muted-foreground">
          Loading slide…
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="file"
          id={`replace-slide-${sopId}`}
          accept="image/*"
          className="hidden"
          onChange={e => { handleReplace(e.target.files); e.target.value = ""; }}
          disabled={replacing}
        />
        <Button type="button" variant="outline" size="sm" disabled={replacing} asChild>
          <label htmlFor={`replace-slide-${sopId}`} className="cursor-pointer">
            <ImagePlus className="w-3.5 h-3.5 mr-1" />
            {replacing ? "Replacing…" : "Replace Image"}
          </label>
        </Button>
        <Button
          type="button" variant="outline" size="sm"
          className="text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" />Delete Slide
        </Button>
        <Button
          type="button" variant="outline" size="sm"
          className="ml-auto text-[#9A6F1E] border-[#C89B3C]/40 hover:bg-[#C89B3C]/10"
          onClick={generateAll}
          disabled={!!bulkProgress}
        >
          <Wand2 className={`w-3.5 h-3.5 mr-1 ${bulkProgress ? "animate-pulse" : ""}`} />
          {bulkProgress ? `Generating ${bulkProgress.done}/${bulkProgress.total}…` : "Generate All"}
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="font-normal text-xs">Narration</Label>
        <div className="relative">
          <Textarea
            placeholder="Text to read aloud for this slide (leave blank for no audio)"
            value={narration}
            onChange={e => setNarration(e.target.value)}
            className="text-xs h-24 pr-16"
          />
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              type="button"
              onClick={generateFromSlide}
              disabled={generating || !slideUrl}
              title="Generate narration from the slide image"
              className="p-1 rounded text-[#9A6F1E] hover:bg-[#C89B3C]/15 disabled:opacity-40"
            >
              <Wand2 className={`w-4 h-4 ${generating ? "animate-pulse" : ""}`} />
            </button>
            <button
              type="button"
              onClick={cleanupWithAi}
              disabled={cleaning || !narration.trim()}
              title="AI cleanup of the narration text"
              className="p-1 rounded text-[#9A6F1E] hover:bg-[#C89B3C]/15 disabled:opacity-40"
            >
              <Sparkles className={`w-4 h-4 ${cleaning ? "animate-pulse" : ""}`} />
            </button>
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              title={listening ? "Stop dictation" : "Dictate narration"}
              className={`p-1 rounded hover:bg-[#C89B3C]/15 ${listening ? "text-red-600 animate-pulse" : "text-[#9A6F1E]"}`}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button" size="sm"
            onClick={saveNarration}
            disabled={saving}
            className="bg-[#C89B3C] hover:bg-[#B8892C]"
          >
            {saving ? "Saving…" : "Save Narration"}
          </Button>
          {ttsSupported && (
            <Button
              type="button" variant="outline" size="sm"
              onClick={speaking ? stopSpeech : speakNarration}
              disabled={!narration.trim()}
              className="text-[#9A6F1E] border-[#C89B3C]/40 hover:bg-[#C89B3C]/10"
            >
              {speaking ? (
                <><Square className="w-3.5 h-3.5 mr-1 animate-pulse" />Stop</>
              ) : (
                <><Volume2 className="w-3.5 h-3.5 mr-1" />Listen</>
              )}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete slide {clampedIndex + 1}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the image file from storage and its narration text. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
