import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DocumentAttachment } from "@/components/team/DocumentAttachment";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, CheckCircle2, Clock, AlertTriangle, Settings, Copy, Plus, Trash2, Upload, ImagePlus, Volume2 } from "lucide-react";
import { toast } from "sonner";
import {
  TRAINING_CATEGORIES, TRAINING_CATEGORY_LABELS, DEPARTMENTS,
  TrainingModule, TrainingAssignment, QuizQuestion,
  AssignmentStatus, getAssignmentStatus,
  fetchTrainingModules, fetchTrainingAssignments, fetchReferenceDocuments,
  updateModuleRequirements, fetchQuizQuestions, saveQuizQuestions, updateModuleQuizConfig,
  parseQuizCsv, uploadTrainingSlide, updateModuleContent, getTrainingSlideUrl,
  computeSlideDuration, type Attachment,
} from "@/lib/training";

type EditableQuestion = Omit<QuizQuestion, "id" | "sop_id">;

const blankQuestion = (questionNumber: number): EditableQuestion => ({
  question_number: questionNumber,
  question_text: "",
  options: ["", ""],
  correct_option_index: 0,
  hint: "",
  rationale: "",
});

const cardStyle = { background: "#FFFFFF", borderColor: "rgba(200,155,60,0.25)" };

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; className: string; icon: any }> = {
  not_started: { label: "Not Assigned", className: "bg-[#2A1F0E]/10 text-[#2A1F0E]/60 border-[#2A1F0E]/20", icon: Clock },
  in_progress: { label: "In Progress", className: "bg-[#C89B3C]/20 text-[#9A6F1E] border-[#C89B3C]/40", icon: Clock },
  completed: { label: "Completed", className: "bg-green-500/20 text-green-700 border-green-500/30", icon: CheckCircle2 },
  expired: { label: "Expired — Renew", className: "bg-red-500/20 text-red-700 border-red-500/30", icon: AlertTriangle },
};

export default function TrainingSops() {
  const { role } = useUserRole();
  const isAdmin = role === "admin" || role === "owner";
  const navigate = useNavigate();

  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [myAssignments, setMyAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TrainingModule | null>(null);
  const [savingRequirements, setSavingRequirements] = useState(false);
  const [refDocs, setRefDocs] = useState<any[]>([]);
  const [selectedRef, setSelectedRef] = useState<any | null>(null);

  const [quizQuestions, setQuizQuestions] = useState<EditableQuestion[]>([]);
  const [passingScorePct, setPassingScorePct] = useState(80);
  const [isCritical, setIsCritical] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [uploadingSlides, setUploadingSlides] = useState(false);
  const [narrations, setNarrations] = useState<string[]>([]);
  const [slideThumbUrls, setSlideThumbUrls] = useState<string[]>([]);
  const [savingNarrations, setSavingNarrations] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;

      const [mods, assigns, refs] = await Promise.all([
        fetchTrainingModules(),
        uid ? fetchTrainingAssignments(uid) : Promise.resolve([]),
        fetchReferenceDocuments(isAdmin),
      ]);
      setModules(mods);
      setMyAssignments(assigns);
      setRefDocs(refs);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load training data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const assignmentByModule = useMemo(() => {
    const map = new Map<string, TrainingAssignment>();
    for (const a of myAssignments) map.set(a.sop_id, a);
    return map;
  }, [myAssignments]);

  const spanishByEnTitle = useMemo(() => {
    const map = new Map<string, TrainingModule>();
    for (const m of modules) {
      if (m.title.includes("(ES)")) {
        const enTitle = m.title.replace(/\s*\(ES\)\s*$/, "").trim();
        map.set(enTitle, m);
      }
    }
    return map;
  }, [modules]);

  const groups = useMemo(() => {
    return TRAINING_CATEGORIES.map(cat => ({
      category: cat,
      label: TRAINING_CATEGORY_LABELS[cat],
      items: modules.filter(m => m.training_category === cat && !m.title.includes("(ES)")),
    })).filter(g => g.items.length > 0);
  }, [modules]);

  useEffect(() => {
    if (!selected || !isAdmin) return;
    setPassingScorePct(selected.passing_score_pct);
    setIsCritical(selected.is_critical);
    setCsvText("");
    setLoadingQuiz(true);
    fetchQuizQuestions(selected.id)
      .then(qs => setQuizQuestions(qs.length > 0 ? qs.map(({ id, sop_id, ...rest }) => rest) : []))
      .catch((e: any) => toast.error(e.message ?? "Failed to load quiz questions"))
      .finally(() => setLoadingQuiz(false));
  }, [selected?.id, isAdmin]);

  // Sync narration drafts and slide thumbnails with the selected module's content
  useEffect(() => {
    const slides: string[] = Array.isArray(selected?.content?.slides) ? selected.content.slides : [];
    const saved: string[] = Array.isArray(selected?.content?.narrations) ? selected.content.narrations : [];
    setNarrations(slides.map((_, i) => saved[i] ?? ""));
    if (slides.length === 0) {
      setSlideThumbUrls([]);
      return;
    }
    let cancelled = false;
    Promise.all(slides.map(path => getTrainingSlideUrl(path)))
      .then(urls => { if (!cancelled) setSlideThumbUrls(urls); })
      .catch(() => { if (!cancelled) setSlideThumbUrls([]); });
    return () => { cancelled = true; };
  }, [selected?.id, selected?.content?.slides]);

  const saveNarrations = async () => {
    if (!selected) return;
    setSavingNarrations(true);
    try {
      // Recompute the dwell time only for slides whose narration text changed,
      // preserving any manually set durations on untouched slides
      const prevNarrations: string[] = Array.isArray(selected.content?.narrations) ? selected.content.narrations : [];
      const prevDurations: number[] = Array.isArray(selected.content?.slideDurations) ? selected.content.slideDurations : [];
      const slideDurations = narrations.map((n, i) =>
        n === (prevNarrations[i] ?? "") && prevDurations[i] != null
          ? prevDurations[i]
          : computeSlideDuration(n),
      );
      const content = { ...(selected.content ?? {}), narrations, slideDurations };
      await updateModuleContent(selected.id, content);
      const updated = { ...selected, content };
      setModules(prev => prev.map(m => m.id === selected.id ? updated : m));
      setSelected(updated);
      toast.success("Narrations saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save narrations");
    } finally {
      setSavingNarrations(false);
    }
  };

  const addQuestion = () => {
    setQuizQuestions(prev => [...prev, blankQuestion(prev.length + 1)]);
  };

  const removeQuestion = (idx: number) => {
    setQuizQuestions(prev => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, question_number: i + 1 })));
  };

  const updateQuestion = (idx: number, field: keyof EditableQuestion, value: any) => {
    setQuizQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const updateOption = (idx: number, optIdx: number, value: string) => {
    setQuizQuestions(prev => prev.map((q, i) => {
      if (i !== idx) return q;
      const options = [...q.options];
      options[optIdx] = value;
      return { ...q, options };
    }));
  };

  const addOption = (idx: number) => {
    setQuizQuestions(prev => prev.map((q, i) => i === idx ? { ...q, options: [...q.options, ""] } : q));
  };

  const removeOption = (idx: number, optIdx: number) => {
    setQuizQuestions(prev => prev.map((q, i) => {
      if (i !== idx) return q;
      const options = q.options.filter((_, j) => j !== optIdx);
      let correct = q.correct_option_index;
      if (optIdx === correct) correct = 0;
      else if (optIdx < correct) correct = correct - 1;
      return { ...q, options, correct_option_index: correct };
    }));
  };

  const importQuizCsv = () => {
    try {
      const imported = parseQuizCsv(csvText);
      if (imported.length === 0) {
        toast.error("No questions found in pasted CSV");
        return;
      }
      setQuizQuestions(imported.map((q, i) => ({ ...q, question_number: i + 1 })));
      setCsvText("");
      toast.success(`Imported ${imported.length} question${imported.length !== 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to parse CSV");
    }
  };

  const handleSlideUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selected) return;
    setUploadingSlides(true);
    try {
      const existing: string[] = Array.isArray(selected.content?.slides) ? selected.content.slides : [];
      const newPaths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = await uploadTrainingSlide(selected.id, file, existing.length + newPaths.length);
        newPaths.push(path);
      }
      const slides = [...existing, ...newPaths];
      const content = { ...(selected.content ?? {}), slides };
      await updateModuleContent(selected.id, content);
      const updated = { ...selected, content };
      setModules(prev => prev.map(m => m.id === selected.id ? updated : m));
      setSelected(updated);
      toast.success(`Uploaded ${newPaths.length} slide${newPaths.length !== 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to upload slides");
    } finally {
      setUploadingSlides(false);
    }
  };

  const saveQuiz = async () => {
    if (!selected) return;
    setSavingQuiz(true);
    try {
      await Promise.all([
        saveQuizQuestions(selected.id, quizQuestions),
        updateModuleQuizConfig(selected.id, { passing_score_pct: passingScorePct, is_critical: isCritical }),
      ]);
      const updated = { ...selected, passing_score_pct: passingScorePct, is_critical: isCritical };
      setModules(prev => prev.map(m => m.id === selected.id ? updated : m));
      setSelected(updated);
      toast.success("Quiz settings saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save quiz");
    } finally {
      setSavingQuiz(false);
    }
  };

  const saveRefFileUrl = async (file_url: string | null) => {
    if (!selectedRef) return;
    const { error } = await (supabase as any).from("sop_documents").update({ file_url }).eq("id", selectedRef.id);
    if (error) return toast.error(error.message);
    const updated = { ...selectedRef, file_url };
    setSelectedRef(updated);
    setRefDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
  };

  const saveModuleAttachments = async (attachments: Attachment[]) => {
    if (!selected) return;
    const content = { ...(selected.content ?? {}), attachments };
    try {
      await updateModuleContent(selected.id, content);
    } catch (e: any) {
      return toast.error(e.message ?? "Failed to save related materials");
    }
    const updated = { ...selected, content };
    setSelected(updated);
    setModules(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  const saveModuleFileUrl = async (file_url: string | null) => {
    if (!selected) return;
    const { error } = await (supabase as any).from("sop_documents").update({ file_url }).eq("id", selected.id);
    if (error) return toast.error(error.message);
    const updated = { ...selected, file_url };
    setSelected(updated);
    setModules(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  const saveRefAttachments = async (attachments: Attachment[]) => {
    if (!selectedRef) return;
    const content = { ...(selectedRef.content ?? {}), attachments };
    try {
      await updateModuleContent(selectedRef.id, content);
    } catch (e: any) {
      return toast.error(e.message ?? "Failed to save attachments");
    }
    const updated = { ...selectedRef, content };
    setSelectedRef(updated);
    setRefDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
  };

  const copyDeepLink = (moduleId: string) => {
    const url = `${window.location.origin}/team/hr/trainings/${moduleId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const toggleRequiredDepartment = async (mod: TrainingModule, dept: string) => {
    const current = mod.required_departments ?? [];
    const next = current.includes(dept) ? current.filter(d => d !== dept) : [...current, dept];
    setSavingRequirements(true);
    try {
      await updateModuleRequirements(mod.id, next.length === 0 ? null : next);
      const updated = { ...mod, required_departments: next.length === 0 ? null : next };
      setModules(prev => prev.map(m => m.id === mod.id ? updated : m));
      setSelected(updated);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update requirements");
    } finally {
      setSavingRequirements(false);
    }
  };

  const setRequiredForAll = async (mod: TrainingModule) => {
    setSavingRequirements(true);
    try {
      await updateModuleRequirements(mod.id, null);
      const updated = { ...mod, required_departments: null };
      setModules(prev => prev.map(m => m.id === mod.id ? updated : m));
      setSelected(updated);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update requirements");
    } finally {
      setSavingRequirements(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "#F5F1E6" }}>Training & SOPs</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(245,241,230,0.6)" }}>
            SQF Fundamentals curriculum — review each module and sign off when complete.
            Assignments are generated automatically based on each employee's department.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="modules">Training Modules</TabsTrigger>
          <TabsTrigger value="reference">Reference Library</TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="space-y-3">
      {groups.length === 0 ? (
        <Card className="p-8 text-center border" style={cardStyle}>
          <p className="text-[#2A1F0E]/50 text-sm">No training modules found.</p>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={groups.map(g => String(g.category))} className="space-y-3">
          {groups.map(group => (
            <AccordionItem
              key={group.category}
              value={String(group.category)}
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: "rgba(200,155,60,0.25)", background: "#FFFFFF" }}
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[#C89B3C]/5 [&[data-state=open]]:bg-[#C89B3C]/5">
                <div className="flex items-center gap-3 text-[#2A1F0E]">
                  <span className="font-semibold">Category {group.category}: {group.label}</span>
                  <Badge variant="outline" className="text-[#2A1F0E]/60 border-[#2A1F0E]/20">
                    {group.items.length} module{group.items.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[#2A1F0E]/60">Module</TableHead>
                      <TableHead className="text-[#2A1F0E]/60">Title</TableHead>
                      <TableHead className="text-[#2A1F0E]/60">Required For</TableHead>
                      <TableHead className="text-[#2A1F0E]/60">Status</TableHead>
                      <TableHead className="text-[#2A1F0E]/60">Renewal</TableHead>
                      {isAdmin && <TableHead className="text-[#2A1F0E]/60"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map(m => {
                      const assignment = assignmentByModule.get(m.id);
                      const status = getAssignmentStatus(assignment);
                      const cfg = STATUS_CONFIG[status];
                      const Icon = cfg.icon;
                      // Mid-training position saved by the module viewer
                      const slideCount = Array.isArray(m.content?.slides) ? m.content.slides.length : 0;
                      const progress = status === "in_progress" && slideCount > 0 && assignment?.progress
                        ? {
                            slide: Math.min((assignment.progress.maxVisitedIndex ?? 0) + 1, slideCount),
                            pct: Math.min(100, Math.round(((assignment.progress.maxVisitedIndex ?? 0) + 1) / slideCount * 100)),
                          }
                        : null;
                      return (
                        <TableRow
                          key={m.id}
                          className="cursor-pointer hover:bg-[#C89B3C]/5 text-[#2A1F0E]"
                          onClick={() => navigate(`/team/hr/trainings/${m.id}`)}
                        >
                          <TableCell className="font-mono text-xs">{m.module_number}</TableCell>
                          <TableCell className="font-medium">
                            <span>{m.title}</span>
                            {(() => {
                              const esModule = spanishByEnTitle.get(m.title);
                              if (!esModule) return null;
                              return (
                                <button
                                  onClick={e => { e.stopPropagation(); navigate(`/team/hr/trainings/${esModule.id}`); }}
                                  title="Ver en español"
                                  className="ml-2 text-base leading-none hover:opacity-60 transition-opacity align-middle"
                                >
                                  🇪🇸
                                </button>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-xs text-[#2A1F0E]/60">
                            {m.required_departments ? m.required_departments.join(", ") : "All Staff"}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${cfg.className} gap-1`}>
                              <Icon className="w-3 h-3" />{cfg.label}
                            </Badge>
                            {progress && (
                              <p className="text-xs text-[#2A1F0E]/50 mt-1">
                                Slide {progress.slide} of {slideCount} · {progress.pct}%
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-[#2A1F0E]/60">
                            {m.is_annual_refresher ? "Annual" : "—"}
                            {assignment?.expires_at && ` · expires ${assignment.expires_at}`}
                          </TableCell>
                          {isAdmin && (
                            <TableCell onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" onClick={() => setSelected(m)} title="Manage module">
                                <Settings className="w-4 h-4 text-[#2A1F0E]/50" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
        </TabsContent>

        <TabsContent value="reference">
          {refDocs.length === 0 ? (
            <Card className="p-8 text-center border" style={cardStyle}>
              <p className="text-[#2A1F0E]/50 text-sm">No reference documents yet.</p>
            </Card>
          ) : (
            <Card className="border overflow-hidden" style={cardStyle}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[#2A1F0E]/60">Title</TableHead>
                    <TableHead className="text-[#2A1F0E]/60">Category</TableHead>
                    <TableHead className="text-[#2A1F0E]/60">SQF Ref</TableHead>
                    <TableHead className="text-[#2A1F0E]/60">Document</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refDocs.map(d => (
                    <TableRow
                      key={d.id}
                      className="cursor-pointer hover:bg-[#C89B3C]/5 text-[#2A1F0E]"
                      onClick={() => setSelectedRef(d)}
                    >
                      <TableCell className="font-medium">{d.title}</TableCell>
                      <TableCell className="text-xs text-[#2A1F0E]/60">{d.category ?? "—"}</TableCell>
                      <TableCell className="text-xs text-[#2A1F0E]/60">{d.sqf_reference ?? "—"}</TableCell>
                      <TableCell>
                        {(() => {
                          const n = (Array.isArray(d.content?.attachments) ? d.content.attachments.length : 0) + (d.file_url ? 1 : 0);
                          return (
                            <Badge variant="outline" className="text-[#2A1F0E]/60 border-[#2A1F0E]/20">
                              {n > 0 ? `${n} file${n !== 1 ? "s" : ""}` : "—"}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Reference document drawer */}
      <Sheet open={!!selectedRef} onOpenChange={(o) => !o && setSelectedRef(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl lg:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedRef?.title}</SheetTitle>
          </SheetHeader>
          {selectedRef && (
            <div className="space-y-4 mt-4 text-sm text-[#2A1F0E]">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">Category</Label><p>{selectedRef.category ?? "—"}</p></div>
                <div><Label className="text-xs text-muted-foreground">SQF Reference</Label><p>{selectedRef.sqf_reference ?? "—"}</p></div>
              </div>
              <DocumentAttachment
                sopId={selectedRef.id}
                attachments={Array.isArray(selectedRef.content?.attachments) ? selectedRef.content.attachments : []}
                onChange={isAdmin ? saveRefAttachments : undefined}
                legacyFileUrl={selectedRef.file_url}
                onClearLegacy={isAdmin ? () => saveRefFileUrl(null) : undefined}
              />
              {!isAdmin && !selectedRef.file_url && (
                <p className="text-xs text-[#2A1F0E]/50">No document is attached to this entry yet.</p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Module detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.module_number} — {selected?.title}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-4 mt-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{TRAINING_CATEGORY_LABELS[selected.training_category]}</Badge>
                {selected.is_annual_refresher && (
                  <Badge className="bg-[#C89B3C]/15 text-[#9A6F1E] border-[#C89B3C]/30">Annual Refresher</Badge>
                )}
              </div>

              <div>
                <Label className="mb-2 block">Training Link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={`${window.location.origin}/team/hr/trainings/${selected.id}`} className="text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copyDeepLink(selected.id)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Share this link in reminder emails so employees can jump directly to this module.
                </p>
              </div>

              {isAdmin && (
                <div>
                  <Label className="mb-2 block">Required For</Label>
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      id="required-all"
                      checked={!selected.required_departments}
                      disabled={savingRequirements}
                      onCheckedChange={(checked) => checked && setRequiredForAll(selected)}
                    />
                    <Label htmlFor="required-all" className="cursor-pointer font-normal">All Staff</Label>
                  </div>
                  {selected.required_departments !== null && (
                    <div className="grid grid-cols-2 gap-1.5 pl-6">
                      {DEPARTMENTS.map(dept => (
                        <div key={dept} className="flex items-center gap-2">
                          <Checkbox
                            id={`dept-${dept}`}
                            checked={(selected.required_departments ?? []).includes(dept)}
                            disabled={savingRequirements}
                            onCheckedChange={() => toggleRequiredDepartment(selected, dept)}
                          />
                          <Label htmlFor={`dept-${dept}`} className="cursor-pointer font-normal">{dept}</Label>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Employees in matching departments are automatically assigned this module.
                  </p>
                </div>
              )}

              <div className="border-t pt-4" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
                <DocumentAttachment
                  sopId={selected.id}
                  attachments={Array.isArray(selected.content?.attachments) ? selected.content.attachments : []}
                  onChange={isAdmin ? saveModuleAttachments : undefined}
                  legacyFileUrl={selected.file_url}
                  onClearLegacy={isAdmin ? () => saveModuleFileUrl(null) : undefined}
                  variant="training"
                />
              </div>

              {isAdmin && (
                <div className="space-y-3 border-t pt-4" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
                  <Label className="block">Quiz Settings</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="passing-score" className="font-normal text-xs">Passing score (%)</Label>
                      <Input
                        id="passing-score"
                        type="number"
                        min={0}
                        max={100}
                        value={passingScorePct}
                        onChange={e => setPassingScorePct(Number(e.target.value))}
                        disabled={isCritical}
                        className="w-20 h-8"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="is-critical" checked={isCritical} onCheckedChange={c => setIsCritical(!!c)} />
                      <Label htmlFor="is-critical" className="cursor-pointer font-normal text-xs">
                        Critical item — requires 100%
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-normal text-xs">Import quiz from CSV (NotebookLLM export)</Label>
                    <Textarea
                      placeholder="Paste CSV with columns: #, Question, Hint, Option A, Option B, ..., Correct Answer, Rationale"
                      value={csvText}
                      onChange={e => setCsvText(e.target.value)}
                      className="text-xs font-mono h-20"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={importQuizCsv} disabled={!csvText.trim()}>
                      <Upload className="w-3.5 h-3.5 mr-1" />Import CSV (replaces questions below)
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="block">Quiz Questions</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addQuestion} disabled={loadingQuiz}>
                      <Plus className="w-3.5 h-3.5 mr-1" />Add Question
                    </Button>
                  </div>

                  {loadingQuiz ? (
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  ) : quizQuestions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No quiz questions yet. Add questions or import from NotebookLLM-generated content.</p>
                  ) : (
                    <div className="space-y-3">
                      {quizQuestions.map((q, idx) => (
                        <div key={idx} className="rounded-md border p-3 space-y-2" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
                          <div className="flex items-center justify-between">
                            <Label className="font-normal text-xs">Question {idx + 1}</Label>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(idx)}>
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
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
                                name={`correct-${idx}`}
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
                          <Input
                            placeholder="Hint (optional)"
                            value={q.hint ?? ""}
                            onChange={e => updateQuestion(idx, "hint", e.target.value)}
                          />
                          <Input
                            placeholder="Rationale (shown after answering, optional)"
                            value={q.rationale ?? ""}
                            onChange={e => updateQuestion(idx, "rationale", e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <Button type="button" onClick={saveQuiz} disabled={savingQuiz || loadingQuiz} className="bg-[#C89B3C] hover:bg-[#B8892C]">
                    {savingQuiz ? "Saving..." : "Save Quiz"}
                  </Button>
                </div>
              )}

              {isAdmin && (
                <div className="space-y-2 border-t pt-4" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
                  <Label className="block">Module Content (Slides)</Label>
                  {Array.isArray(selected.content?.slides) && selected.content.slides.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        {selected.content.slides.length} slide image{selected.content.slides.length !== 1 ? "s" : ""} uploaded.
                        Add narration text below — employees can have it read aloud on each slide.
                      </p>
                      {(selected.content.slides as string[]).map((_, idx) => (
                        <div key={idx} className="flex gap-2 items-start rounded-md border p-2" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
                          {slideThumbUrls[idx] ? (
                            <img
                              src={slideThumbUrls[idx]}
                              alt={`Slide ${idx + 1}`}
                              className="w-16 rounded border border-black/10 shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-10 rounded bg-black/5 shrink-0" />
                          )}
                          <div className="flex-1 space-y-1">
                            <Label className="font-normal text-xs">Slide {idx + 1} narration</Label>
                            <Textarea
                              placeholder="Text to read aloud for this slide (leave blank for no audio)"
                              value={narrations[idx] ?? ""}
                              onChange={e => setNarrations(prev => prev.map((n, i) => i === idx ? e.target.value : n))}
                              className="text-xs h-16"
                            />
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        onClick={saveNarrations}
                        disabled={savingNarrations}
                        className="bg-[#C89B3C] hover:bg-[#B8892C]"
                      >
                        <Volume2 className="w-3.5 h-3.5 mr-1" />
                        {savingNarrations ? "Saving..." : "Save Narrations"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No slide images uploaded yet.</p>
                  )}
                  <div>
                    <input
                      type="file"
                      id="slide-upload"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={e => handleSlideUpload(e.target.files)}
                      disabled={uploadingSlides}
                    />
                    <Button type="button" variant="outline" size="sm" disabled={uploadingSlides} asChild>
                      <label htmlFor="slide-upload" className="cursor-pointer">
                        <ImagePlus className="w-3.5 h-3.5 mr-1" />
                        {uploadingSlides ? "Uploading..." : "Upload Slide Images"}
                      </label>
                    </Button>
                  </div>
                </div>
              )}

              {selected.content && !Array.isArray(selected.content?.slides) ? (
                <pre className="mt-1 whitespace-pre-wrap rounded-md border border-white/10 bg-black/20 p-3 text-xs">
                  {JSON.stringify(selected.content, null, 2)}
                </pre>
              ) : !selected.content ? (
                <p className="text-muted-foreground">No content uploaded yet for this module.</p>
              ) : null}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
