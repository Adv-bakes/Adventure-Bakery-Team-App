import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileUp, ShieldCheck, Presentation, ChevronDown, FileText, GraduationCap, BookOpen, ArrowUp, ArrowDown, ChevronsUpDown, ClipboardList, Copy, Download, ListChecks, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { SopImportDialog } from "@/components/ops/SopImportDialog";
import { SlideContentEditor } from "@/components/team/SlideContentEditor";
import { DocumentAttachment } from "@/components/team/DocumentAttachment";
import { QuizEditor } from "@/components/team/QuizEditor";
import { PptxImportDialog } from "@/components/team/PptxImportDialog";
import { TRAINING_CATEGORY_LABELS, DEPARTMENTS, updateModuleContent, updateModuleRequirements, updateModuleQuizConfig, hasReferenceDocs, hasSopBody, resolveFileUrl, type Attachment } from "@/lib/training";
import { hasFormSchema, getFormSchema, type FormSchema } from "@/lib/formSchema";
import { FormSchemaBuilder } from "@/components/team/forms/FormSchemaBuilder";
import { FormEntriesTab } from "@/components/team/forms/FormEntriesTab";
import { SopBodyEditor } from "@/components/team/SopBodyEditor";
import { generateSopPdf } from "@/lib/sopPdf";
import { CategorySelect } from "@/components/team/CategorySelect";
import { SpanishFlag } from "@/components/team/SpanishFlag";
import { SqfReference } from "@/components/team/SqfReference";
import { DocNumberHint } from "@/components/team/DocNumberHint";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Map a SOPs Library category name back to its HR training category number
// (e.g. "Core Onboarding" → 1) so modules created here also appear in the
// right section of Training & SOPs. Unknown categories default to 1.
function trainingCategoryForLabel(label: string): number {
  const entry = Object.entries(TRAINING_CATEGORY_LABELS).find(([, l]) => l === label);
  return entry ? Number(entry[0]) : 1;
}

type SopDocument = {
  id: string;
  sop_number: string | null;
  title: string;
  type: "sop" | "form" | "policy" | "training" | "fsqm";
  category: string | null;
  revision: string | null;
  effective_date: string | null;
  approved_by: string | null;
  content: any;
  status: "draft" | "active" | "archived";
  sqf_reference: string | null;
  sqf_required: boolean;
  file_url: string | null;
  media_url: string | null;
  training_category: number | null;
  module_number: string | null;
  required_departments: string[] | null;
  passing_score_pct: number | null;
  is_critical: boolean | null;
  is_annual_refresher: boolean | null;
  created_at: string;
};

const isSpanish = (doc: SopDocument) => doc.title.includes("(ES)");

const cardStyle = {
  background: "#FFFFFF",
  borderColor: "rgba(200,155,60,0.25)",
};

const statusColors: Record<string, string> = {
  draft: "bg-[#C89B3C]/20 text-[#9A6F1E] border-[#C89B3C]/40",
  active: "bg-green-500/20 text-green-700",
  archived: "bg-amber-500/20 text-amber-700",
};

const TYPES = ["sop", "form", "policy", "training", "fsqm"] as const;
const TYPE_LABELS: Record<string, string> = { sop: "SOP", form: "Form", policy: "Policy", training: "Training", fsqm: "FSQM" };

// SQF Code section names (top-level integer prefix of the reference code)
const SQF_SECTION_NAMES: Record<string, string> = {
  "2": "SQF System Elements",
  "4": "Site Requirements",
  "5": "Food Safety Plan – HACCP",
  "6": "Food Quality Plan",
  "7": "Food Defense & Food Fraud",
  "11": "Good Manufacturing Practices – Food",
  "12": "GMP – Food Packaging",
  "13": "GMP – Storage & Distribution",
};

function sqfSection(ref: string | null): string {
  if (!ref) return "";
  const match = ref.match(/^(\d+)/);
  return match ? match[1] : "";
}

function sqfSectionLabel(section: string): string {
  return SQF_SECTION_NAMES[section] ?? `Section ${section}`;
}

type ViewMode = "category" | "sqf";
type KindFilter = "all" | "training" | "reference";
type DocSortKey = "number" | "title" | "type" | "revision" | "effective" | "status" | "sqf";

export default function SopsLibrary() {
  const { role } = useUserRole();
  const isAdmin = role === "admin" || role === "owner";

  const [docs, setDocs] = useState<SopDocument[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("category");
  const [sqfOnly, setSqfOnly] = useState(false);
  // Column sorting for the document tables (shared across all category/SQF groups)
  const [sortKey, setSortKey] = useState<DocSortKey>("number");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<SopDocument | null>(null);
  const [editDoc, setEditDoc] = useState<Partial<SopDocument> | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pptxImportOpen, setPptxImportOpen] = useState(false);
  // Category targeted by a per-group "Add Module" button; null = dialog closed
  const [importCategory, setImportCategory] = useState<string | null>(null);
  // "Add Reference Document" dialog: the category it targets (null = closed), title input, saving flag
  const [refDocCategory, setRefDocCategory] = useState<string | null>(null);
  const [refDocTitle, setRefDocTitle] = useState("");
  const [creatingRefDoc, setCreatingRefDoc] = useState(false);
  // Editable copy of the selected doc's metadata shown in the detail drawer
  const [detail, setDetail] = useState<Partial<SopDocument>>({});
  const [savingDetail, setSavingDetail] = useState(false);
  const [changingKind, setChangingKind] = useState(false);
  // Hard-delete confirmation: the doc pending permanent deletion (null = no dialog) + in-flight flag
  const [deleteTarget, setDeleteTarget] = useState<SopDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Training-module management (migrated from the Training & SOPs gear drawer)
  const [passingScorePct, setPassingScorePct] = useState(80);
  const [isCritical, setIsCritical] = useState(false);
  const [savingRequirements, setSavingRequirements] = useState(false);
  const [savingQuizSettings, setSavingQuizSettings] = useState(false);

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("sop_documents")
      .select("*")
      .order("sop_number", { ascending: true });
    if (error) return toast.error(error.message);
    setDocs((data ?? []) as SopDocument[]);
  };
  useEffect(() => { load(); }, []);

  // Deep-link support: the Document Register links here with ?doc=<id> to open a doc's drawer.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const docId = searchParams.get("doc");
    if (!docId || docs.length === 0) return;
    const match = docs.find(d => d.id === docId);
    if (match) {
      setSelected(match);
      // Consume the param so re-renders / closing the drawer don't re-open it.
      searchParams.delete("doc");
      setSearchParams(searchParams, { replace: true });
    }
  }, [docs, searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(d => {
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (kindFilter === "training" && d.training_category == null) return false;
      if (kindFilter === "reference" && !(d.training_category == null || hasReferenceDocs(d))) return false;
      if (sqfOnly && !d.sqf_required) return false;
      if (q && !`${d.sop_number ?? ""} ${d.title}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, search, typeFilter, kindFilter, sqfOnly]);

  // Group by category
  const categoryGroups = useMemo(() => {
    const map = new Map<string, SopDocument[]>();
    for (const d of filtered) {
      const key = d.category ?? "Uncategorized";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    // Sort: named categories first alphabetically, Uncategorized last
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  // Group by SQF section (only docs with a sqf_reference)
  const sqfGroups = useMemo(() => {
    const map = new Map<string, SopDocument[]>();
    for (const d of filtered) {
      const sec = sqfSection(d.sqf_reference);
      if (!sec) continue;
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(d);
    }
    return Array.from(map.entries()).sort(([a], [b]) => Number(a) - Number(b));
  }, [filtered]);

  // Distinct category names already in use, for the category dropdowns
  const existingCategories = useMemo(
    () => Array.from(new Set(docs.map(d => d.category).filter(Boolean))) as string[],
    [docs],
  );

  // Primary: module_number → Spanish doc
  const spanishByModuleNumber = useMemo(() => {
    const map = new Map<string, SopDocument>();
    for (const d of docs) {
      if (isSpanish(d) && d.module_number) map.set(d.module_number, d);
    }
    return map;
  }, [docs]);

  // Fallback: English title (stripped of " (ES)") → Spanish doc
  const spanishByEnTitle = useMemo(() => {
    const map = new Map<string, SopDocument>();
    for (const d of docs) {
      if (isSpanish(d)) {
        const enTitle = d.title.replace(/\s*\(ES\)\s*$/, "").trim();
        map.set(enTitle, d);
      }
    }
    return map;
  }, [docs]);

  const openNew = () => setEditDoc({ type: "sop", status: "draft", sqf_required: false });

  // Keep the drawer's editable fields in sync with the selected doc
  useEffect(() => {
    if (!selected) return;
    setDetail({
      title: selected.title,
      sop_number: selected.sop_number,
      revision: selected.revision,
      effective_date: selected.effective_date,
      sqf_reference: selected.sqf_reference,
      approved_by: selected.approved_by,
      category: selected.category,
      type: selected.type,
      status: selected.status,
      sqf_required: selected.sqf_required,
      file_url: selected.file_url,
    });
    setPassingScorePct(selected.passing_score_pct ?? 80);
    setIsCritical(selected.is_critical ?? false);
  }, [selected?.id]);

  const saveDetail = async () => {
    if (!selected) return;
    if (!detail.title?.trim()) return toast.error("Title required");
    setSavingDetail(true);
    const payload = {
      title: detail.title.trim(),
      sop_number: detail.sop_number || null,
      revision: detail.revision || null,
      effective_date: detail.effective_date || null,
      sqf_reference: detail.sqf_reference || null,
      approved_by: detail.approved_by || null,
      category: detail.category || null,
      type: detail.type ?? selected.type,
      status: detail.status ?? selected.status,
      sqf_required: detail.sqf_required ?? false,
    };
    const { error } = await (supabase as any).from("sop_documents").update(payload).eq("id", selected.id);
    setSavingDetail(false);
    if (error) return toast.error(error.message);
    const updated = { ...selected, ...payload } as SopDocument;
    setSelected(updated);
    setDocs(prev => prev.map(d => d.id === selected.id ? updated : d));
    toast.success("Details saved");
  };

  const copyDeepLink = (moduleId: string) => {
    const url = `${window.location.origin}/team/hr/trainings/${moduleId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const applyRequirements = async (next: string[] | null) => {
    if (!selected) return;
    setSavingRequirements(true);
    try {
      await updateModuleRequirements(selected.id, next);
      const updated = { ...selected, required_departments: next } as SopDocument;
      setSelected(updated);
      setDocs(prev => prev.map(d => d.id === selected.id ? updated : d));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update requirements");
    } finally {
      setSavingRequirements(false);
    }
  };

  const toggleRequiredDepartment = (dept: string) => {
    if (!selected) return;
    const current = selected.required_departments ?? [];
    const next = current.includes(dept) ? current.filter(d => d !== dept) : [...current, dept];
    applyRequirements(next.length === 0 ? null : next);
  };

  const saveQuizSettings = async () => {
    if (!selected) return;
    setSavingQuizSettings(true);
    try {
      await updateModuleQuizConfig(selected.id, { passing_score_pct: passingScorePct, is_critical: isCritical });
      const updated = { ...selected, passing_score_pct: passingScorePct, is_critical: isCritical } as SopDocument;
      setSelected(updated);
      setDocs(prev => prev.map(d => d.id === selected.id ? updated : d));
      toast.success("Quiz settings saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save quiz settings");
    } finally {
      setSavingQuizSettings(false);
    }
  };

  // Clears the legacy single file_url (upload/remove of the object happens in DocumentAttachment).
  const saveFileUrl = async (file_url: string | null) => {
    if (!selected) return;
    const { error } = await (supabase as any).from("sop_documents").update({ file_url }).eq("id", selected.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...selected, file_url } as SopDocument;
    setSelected(updated);
    setDetail(prev => ({ ...prev, file_url }));
    setDocs(prev => prev.map(d => d.id === selected.id ? updated : d));
  };

  // The SopBodyEditor writes content itself; this just syncs local state with the merged content.
  const saveBody = (content: any) => {
    if (!selected) return;
    const updated = { ...selected, content } as SopDocument;
    setSelected(updated);
    setDocs(prev => prev.map(d => d.id === selected.id ? updated : d));
  };

  // Persist the multi-attachment list into content.attachments (upload/remove done in the component).
  const saveAttachments = async (attachments: Attachment[]) => {
    if (!selected) return;
    const content = { ...(selected.content ?? {}), attachments };
    try {
      await updateModuleContent(selected.id, content);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save attachments");
      return;
    }
    const updated = { ...selected, content } as SopDocument;
    setSelected(updated);
    setDocs(prev => prev.map(d => d.id === selected.id ? updated : d));
  };

  // The uploaded original a form's field schema can be AI-extracted from
  // (.docx only for now — the Word import stores it in content.attachments).
  const findFormSource = (doc: SopDocument): Attachment | null => {
    const attachments: Attachment[] = Array.isArray(doc.content?.attachments) ? doc.content.attachments : [];
    return attachments.find(a => a.path && /\.docx$/i.test(a.path)) ?? null;
  };

  // AI schema extraction: mammoth keeps the docx tables that sopDocxParser drops,
  // so the edge function sees the real form layout. The result is only a proposal —
  // FormSchemaBuilder holds it unsaved until the admin reviews and clicks Save Form.
  const generateFormSchemaAi = async (): Promise<FormSchema | null> => {
    if (!selected) return null;
    const source = findFormSource(selected);
    if (!source?.path) {
      toast.error("Attach the form's original .docx in Reference Documents first.");
      return null;
    }
    const url = await resolveFileUrl(source.path);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not download the source document");
    const arrayBuffer = await res.arrayBuffer();
    const mammoth = await import("mammoth");
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
    const { data, error } = await supabase.functions.invoke("generate-form-schema", {
      body: {
        title: selected.title,
        formNumber: selected.sop_number,
        source: { kind: "html", html: html.slice(0, 60000) },
      },
    });
    if (error) throw error;
    if (!data?.schema) throw new Error(data?.error ?? "No schema returned");
    if (Array.isArray(data.warnings) && data.warnings.length > 0) {
      toast(`AI extraction notes: ${data.warnings.slice(0, 3).join("; ")}${data.warnings.length > 3 ? "…" : ""}`);
    }
    return data.schema as FormSchema;
  };

  // Creates a reference document (no slides/quiz; training_category null) and opens its
  // drawer so the user can attach files/links right away.
  const createRefDoc = async () => {
    if (!refDocTitle.trim()) return toast.error("Title required");
    setCreatingRefDoc(true);
    const payload = {
      title: refDocTitle.trim(),
      type: "sop",
      status: "draft",
      category: refDocCategory === "Uncategorized" ? null : refDocCategory,
    };
    const { data, error } = await (supabase as any)
      .from("sop_documents").insert(payload).select("*").single();
    setCreatingRefDoc(false);
    if (error) return toast.error(error.message);
    toast.success("Reference document created");
    setRefDocCategory(null);
    setRefDocTitle("");
    setDocs(prev => [...prev, data as SopDocument]);
    setSelected(data as SopDocument); // open drawer to attach files/links
  };

  // Non-destructive: turns a reference document into a training module by assigning a
  // training_category (the DB trigger auto-assigns to employees when status is active).
  const setAsTraining = async () => {
    if (!selected) return;
    setChangingKind(true);
    try {
      const tc = trainingCategoryForLabel(selected.category ?? "");
      const { error } = await (supabase as any).from("sop_documents").update({ training_category: tc, type: "training" }).eq("id", selected.id);
      if (error) throw error;
      const updated = { ...selected, training_category: tc, type: "training" } as SopDocument;
      setSelected(updated);
      setDocs(prev => prev.map(d => d.id === selected.id ? updated : d));
      toast.success("Now a training module");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    } finally {
      setChangingKind(false);
    }
  };

  // Permanently removes a document. Unlike "Archived" (a status), this cannot be undone.
  // quiz_questions + training_assignments are removed by their ON DELETE CASCADE FKs; the
  // storage folder (slides/audio/files/source.pptx) is best-effort purged afterwards.
  const deleteDoc = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleting(true);
    try {
      const { error } = await (supabase as any).from("sop_documents").delete().eq("id", id);
      if (error) throw error;

      // Best-effort storage cleanup — orphaned objects are harmless, so failures don't block.
      try {
        const folders = ["slides", "audio", "files"];
        const paths: string[] = [`${id}/source.pptx`];
        for (const folder of folders) {
          const { data: list } = await (supabase as any).storage
            .from("training-content").list(`${id}/${folder}`, { limit: 1000 });
          for (const obj of list ?? []) paths.push(`${id}/${folder}/${obj.name}`);
        }
        if (paths.length) await (supabase as any).storage.from("training-content").remove(paths);
      } catch { /* ignore storage cleanup errors */ }

      setDocs(prev => prev.filter(d => d.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success("Document permanently deleted");
    } catch (e: any) {
      // FK RESTRICT from sop_document_responses: records retention says filled
      // entries must survive, so the form can only be archived.
      if (e?.code === "23503") {
        toast.error("This form has filled entries — archive it instead of deleting.");
      } else {
        toast.error(e.message ?? "Failed to delete document");
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const saveDoc = async () => {
    if (!editDoc?.title) return toast.error("Title required");
    setSaving(true);
    const payload = {
      sop_number: editDoc.sop_number || null,
      title: editDoc.title,
      type: editDoc.type || "sop",
      category: editDoc.category || null,
      revision: editDoc.revision || null,
      effective_date: editDoc.effective_date || null,
      sqf_reference: editDoc.sqf_reference || null,
      sqf_required: editDoc.sqf_required ?? false,
      file_url: editDoc.file_url || null,
      media_url: editDoc.media_url || null,
      status: editDoc.status || "draft",
    };
    const { error } = await (supabase as any).from("sop_documents").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("SOP added");
    setEditDoc(null);
    load();
  };

  const groups = viewMode === "category" ? categoryGroups : sqfGroups;
  const defaultOpen = groups.map(([key]) => key);

  const toggleSort = (key: DocSortKey) => {
    if (key === sortKey) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };
  const docSortValue = (d: SopDocument): string => {
    switch (sortKey) {
      case "number": return d.sop_number ?? "";
      case "title": return d.title;
      case "type": return TYPE_LABELS[d.type] ?? d.type;
      case "revision": return d.revision ?? "";
      case "effective": return d.effective_date ?? "";
      case "status": return d.status;
      case "sqf": return d.sqf_reference ?? "";
    }
  };
  const sortDocs = (items: SopDocument[]) => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const av = docSortValue(a), bv = docSortValue(b);
      // Empty/"—" values always sort last regardless of direction
      if (av === "" && bv !== "") return 1;
      if (bv === "" && av !== "") return -1;
      return av.localeCompare(bv, undefined, { numeric: true }) * dir;
    });
  };
  const SortHead = ({ k, label }: { k: DocSortKey; label: string }) => (
    <TableHead className="text-[#2A1F0E]/60">
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-[#C89B3C] transition-colors"
      >
        {label}
        {sortKey === k
          ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
          : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </TableHead>
  );

  const DocTable = ({ items }: { items: SopDocument[] }) => {
    const visibleItems = sortDocs(items.filter(d => !isSpanish(d)));
    return (
      <Table className="[&_td]:py-2 [&_th]:h-9">
        <TableHeader>
          <TableRow>
            <SortHead k="number" label="Number" />
            <SortHead k="title" label="Title" />
            <TableHead className="text-[#2A1F0E]/60 w-10"></TableHead>
            <SortHead k="type" label="Type" />
            <SortHead k="revision" label="Revision" />
            <SortHead k="effective" label="Effective Date" />
            <SortHead k="status" label="Status" />
            {viewMode === "category" && <SortHead k="sqf" label="SQF Ref" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleItems.map(d => {
            const esDoc = (d.module_number ? spanishByModuleNumber.get(d.module_number) : undefined) ?? spanishByEnTitle.get(d.title);
            return (
              <TableRow key={d.id} className="cursor-pointer hover:bg-[#C89B3C]/5" onClick={() => setSelected(d)}>
                <TableCell className="font-mono text-xs">{d.sop_number ?? "—"}</TableCell>
                <TableCell className="font-medium">
                  <span>{d.title}</span>
                  {d.sqf_required && (
                    <ShieldCheck className="inline w-3.5 h-3.5 ml-1.5 text-[#C89B3C]" />
                  )}
                </TableCell>
                <TableCell className="w-10">
                  {esDoc && (
                    <button
                      onClick={e => { e.stopPropagation(); setSelected(esDoc); }}
                      title="Ver en español"
                      className="leading-none hover:opacity-60 transition-opacity align-middle"
                    >
                      <SpanishFlag />
                    </button>
                  )}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <Badge variant="outline">{TYPE_LABELS[d.type]}</Badge>
                    {hasFormSchema(d) && (
                      <Badge className="bg-[#C89B3C]/15 text-[#9A6F1E] border-[#C89B3C]/30">Fillable</Badge>
                    )}
                    {hasSopBody(d.content) && (
                      <button
                        onClick={async e => {
                          e.stopPropagation();
                          try { await generateSopPdf(d); }
                          catch (err: any) { toast.error(err?.message ?? "Failed to generate PDF"); }
                        }}
                        title="Download PDF"
                        className="leading-none text-[#C89B3C] hover:opacity-60 transition-opacity align-middle"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </span>
                </TableCell>
                <TableCell>{d.revision ?? "—"}</TableCell>
                <TableCell>{d.effective_date ?? "—"}</TableCell>
                <TableCell><Badge className={statusColors[d.status]}>{d.status}</Badge></TableCell>
                {viewMode === "category" && <TableCell className="text-xs text-[#2A1F0E]/60"><SqfReference value={d.sqf_reference} /></TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "#F5F1E6" }}>SOPs Library</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(245,241,230,0.6)" }}>Versioned standard operating procedures.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp className="w-4 h-4 mr-1" />Import from Word
            </Button>
            <Button variant="outline" onClick={() => setPptxImportOpen(true)}>
              <Presentation className="w-4 h-4 mr-1" />Import from PowerPoint
            </Button>
            <Button onClick={openNew} className="bg-[#C89B3C] hover:bg-[#B8892C]">
              <Plus className="w-4 h-4 mr-1" />Add SOP
            </Button>
          </div>
        )}
      </div>

      {/* Filters & view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by number or title…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* SQF required filter */}
        <button
          onClick={() => setSqfOnly(v => !v)}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
          style={{
            borderColor: sqfOnly ? "#C89B3C" : "rgba(200,155,60,0.3)",
            background: sqfOnly ? "rgba(200,155,60,0.15)" : "transparent",
            color: sqfOnly ? "#9A6F1E" : "rgba(245,241,230,0.7)",
          }}
        >
          <ShieldCheck className="w-3.5 h-3.5" />SQF Required
        </button>

        {/* Kind filter: training vs reference */}
        <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
          {([["all", "All"], ["training", "Training Modules"], ["reference", "Reference Material"]] as [KindFilter, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className="px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: kindFilter === k ? "rgba(200,155,60,0.18)" : "transparent",
                color: kindFilter === k ? "#F5F1E6" : "rgba(245,241,230,0.55)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* View mode toggle */}
        <div className="ml-auto flex rounded-lg border overflow-hidden" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
          {(["category", "sqf"] as ViewMode[]).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className="px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: viewMode === m ? "rgba(200,155,60,0.18)" : "transparent",
                color: viewMode === m ? "#F5F1E6" : "rgba(245,241,230,0.55)",
              }}
            >
              {m === "category" ? "By Category" : "By SQF Section"}
            </button>
          ))}
        </div>
      </div>

      {/* SQF section note when in SQF view */}
      {viewMode === "sqf" && (
        <p className="text-xs" style={{ color: "rgba(245,241,230,0.5)" }}>
          Showing only documents with an SQF reference code. Documents without a code are hidden in this view.
        </p>
      )}

      {/* Grouped accordion */}
      {groups.length === 0 ? (
        <Card className="p-8 text-center border" style={cardStyle}>
          <p className="text-[#2A1F0E]/50 text-sm">No documents found.</p>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-3">
          {groups.map(([groupKey, items]) => {
            const label = viewMode === "category"
              ? groupKey
              : `Section ${groupKey} — ${sqfSectionLabel(groupKey)}`;
            const required = items.filter(d => d.sqf_required).length;

            return (
              <AccordionItem
                key={groupKey}
                value={groupKey}
                className="rounded-lg border overflow-hidden"
                style={{ borderColor: "rgba(200,155,60,0.25)", background: "#FFFFFF" }}
              >
                <div className="flex items-center hover:bg-[#C89B3C]/5">
                  <AccordionTrigger className="flex-1 px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-3 text-[#2A1F0E]">
                      <span className="font-semibold">{label}</span>
                      <Badge variant="outline" className="text-[#2A1F0E]/60 border-[#2A1F0E]/20">
                        {items.length} doc{items.length !== 1 ? "s" : ""}
                      </Badge>
                      {required > 0 && (
                        <Badge className="bg-[#C89B3C]/15 text-[#9A6F1E] border-[#C89B3C]/30 gap-1">
                          <ShieldCheck className="w-3 h-3" />{required} SQF required
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  {isAdmin && viewMode === "category" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-3 shrink-0 border-[#C89B3C]/40 text-[#2A1F0E]"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />Add
                          <ChevronDown className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setImportCategory(groupKey)}>
                          <Presentation className="w-3.5 h-3.5 mr-2" />Import Training Deck
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setRefDocTitle(""); setRefDocCategory(groupKey); }}>
                          <FileText className="w-3.5 h-3.5 mr-2" />Add Reference Document
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <AccordionContent className="px-0 pb-0">
                  <div className="text-[#2A1F0E]">
                    <DocTable items={items} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl lg:max-w-3xl xl:max-w-5xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.title}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-4 mt-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{TYPE_LABELS[selected.type]}</Badge>
                <Badge className={statusColors[selected.status]}>{selected.status}</Badge>
                {selected.category && <Badge variant="outline">{selected.category}</Badge>}
                {selected.sqf_required && (
                  <Badge className="bg-[#C89B3C]/15 text-[#9A6F1E] border-[#C89B3C]/30 gap-1">
                    <ShieldCheck className="w-3 h-3" />SQF Required
                  </Badge>
                )}
              </div>

              {isAdmin ? (
                <div className="space-y-3">
                  <div><Label className="text-xs text-muted-foreground">Title *</Label><Input value={detail.title ?? ""} onChange={e => setDetail({ ...detail, title: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">SOP #</Label><Input value={detail.sop_number ?? ""} onChange={e => setDetail({ ...detail, sop_number: e.target.value })} /><DocNumberHint value={detail.sop_number} /></div>
                    <div><Label className="text-xs text-muted-foreground">Revision</Label><Input value={detail.revision ?? ""} onChange={e => setDetail({ ...detail, revision: e.target.value })} /></div>
                    <div><Label className="text-xs text-muted-foreground">Effective Date</Label><Input type="date" value={detail.effective_date ?? ""} onChange={e => setDetail({ ...detail, effective_date: e.target.value })} /></div>
                    <div><Label className="text-xs text-muted-foreground">SQF Reference</Label><Input value={detail.sqf_reference ?? ""} onChange={e => setDetail({ ...detail, sqf_reference: e.target.value })} /></div>
                    <div><Label className="text-xs text-muted-foreground">Approved By</Label><Input value={detail.approved_by ?? ""} onChange={e => setDetail({ ...detail, approved_by: e.target.value })} /></div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Category</Label>
                      <CategorySelect
                        value={detail.category}
                        categories={existingCategories}
                        onChange={category => setDetail({ ...detail, category })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Type</Label>
                      <Select value={detail.type ?? "sop"} onValueChange={v => setDetail({ ...detail, type: v as SopDocument["type"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Select value={detail.status ?? "draft"} onValueChange={v => setDetail({ ...detail, status: v as SopDocument["status"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="detail_sqf_required"
                        checked={detail.sqf_required ?? false}
                        onCheckedChange={v => setDetail({ ...detail, sqf_required: !!v })}
                      />
                      <Label htmlFor="detail_sqf_required" className="cursor-pointer">Required for SQF audit</Label>
                    </div>
                    <Button onClick={saveDetail} disabled={savingDetail} size="sm" className="bg-[#C89B3C] hover:bg-[#B8892C]">
                      {savingDetail ? "Saving…" : "Save Details"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground">SOP #</Label><p>{selected.sop_number ?? "—"}</p></div>
                  <div><Label className="text-xs text-muted-foreground">Revision</Label><p>{selected.revision ?? "—"}</p></div>
                  <div><Label className="text-xs text-muted-foreground">Effective Date</Label><p>{selected.effective_date ?? "—"}</p></div>
                  <div><Label className="text-xs text-muted-foreground">SQF Reference</Label><p><SqfReference value={selected.sqf_reference} /></p></div>
                  <div><Label className="text-xs text-muted-foreground">Approved By</Label><p>{selected.approved_by ?? "—"}</p></div>
                </div>
              )}
              {/* Coexisting regions — pure view toggle, no data is changed by switching. */}
              <Tabs
                key={selected.id}
                defaultValue={
                  selected.type === "form"
                    ? (hasFormSchema(selected) ? "entries" : "form")
                    : selected.training_category != null ? "training" : hasSopBody(selected.content) ? "document" : "reference"
                }
                className="space-y-3"
              >
                <TabsList>
                  {selected.type === "form" && (
                    <TabsTrigger value="form"><ClipboardList className="w-3.5 h-3.5 mr-1.5" />Form</TabsTrigger>
                  )}
                  {selected.type === "form" && hasFormSchema(selected) && (
                    <TabsTrigger value="entries"><ListChecks className="w-3.5 h-3.5 mr-1.5" />Entries</TabsTrigger>
                  )}
                  <TabsTrigger value="training"><GraduationCap className="w-3.5 h-3.5 mr-1.5" />Training</TabsTrigger>
                  {hasSopBody(selected.content) && (
                    <TabsTrigger value="document"><FileText className="w-3.5 h-3.5 mr-1.5" />Document</TabsTrigger>
                  )}
                  <TabsTrigger value="reference"><BookOpen className="w-3.5 h-3.5 mr-1.5" />Reference Documents</TabsTrigger>
                </TabsList>

                {selected.type === "form" && (
                  <TabsContent value="form">
                    {isAdmin ? (
                      <FormSchemaBuilder
                        key={selected.id}
                        sopId={selected.id}
                        content={selected.content}
                        onContentChange={saveBody}
                        onGenerateAi={findFormSource(selected) ? generateFormSchemaAi : undefined}
                      />
                    ) : hasFormSchema(selected) ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          This form is fillable in the app — open the Entries tab to record or review entries.
                        </p>
                        <ul className="text-sm list-disc pl-5 space-y-0.5">
                          {(getFormSchema(selected.content)?.sections ?? []).flatMap(s => s.fields)
                            .filter(f => f.type !== "heading" && f.type !== "info")
                            .map(f => <li key={f.id}>{f.label}{f.required ? " *" : ""}</li>)}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        This form isn't fillable in the app yet — an admin needs to define its fields.
                      </p>
                    )}
                  </TabsContent>
                )}

                {selected.type === "form" && hasFormSchema(selected) && (
                  <TabsContent value="entries">
                    <FormEntriesTab doc={selected} />
                  </TabsContent>
                )}

                {hasSopBody(selected.content) && (
                  <TabsContent value="document">
                    <div className="flex justify-end mb-3">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-[#C89B3C] hover:bg-[#B8892C]"
                        onClick={async () => {
                          try {
                            await generateSopPdf(selected);
                          } catch (e: any) {
                            toast.error(e?.message ?? "Failed to generate PDF");
                          }
                        }}
                      >
                        <Download className="w-4 h-4 mr-1.5" />Download PDF
                      </Button>
                    </div>
                    <SopBodyEditor
                      sopId={selected.id}
                      content={selected.content}
                      docType={selected.type}
                      onChange={isAdmin ? saveBody : undefined}
                    />
                  </TabsContent>
                )}

                <TabsContent value="training" className="space-y-4">
                  {selected.training_category != null ? (
                    <>
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
                        <div className="border-t pt-4" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
                          <Label className="mb-2 block">Required For</Label>
                          <div className="flex items-center gap-2 mb-2">
                            <Checkbox
                              id="required-all"
                              checked={!selected.required_departments}
                              disabled={savingRequirements}
                              onCheckedChange={(checked) => applyRequirements(checked ? null : [])}
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
                                    onCheckedChange={() => toggleRequiredDepartment(dept)}
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
                        <Label className="text-xs text-muted-foreground">Content</Label>
                        {isAdmin ? (
                          <div className="mt-1">
                            <SlideContentEditor
                              sopId={selected.id}
                              content={selected.content}
                              onContentChange={(content) => {
                                const updated = { ...selected, content };
                                setSelected(updated);
                                setDocs(prev => prev.map(d => d.id === selected.id ? updated : d));
                              }}
                            />
                          </div>
                        ) : (
                          <pre className="mt-1 whitespace-pre-wrap rounded-md border border-white/10 bg-black/20 p-3 text-xs">
                            {selected.content ? JSON.stringify(selected.content, null, 2) : "—"}
                          </pre>
                        )}
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
                          <Button type="button" size="sm" onClick={saveQuizSettings} disabled={savingQuizSettings} className="bg-[#C89B3C] hover:bg-[#B8892C]">
                            {savingQuizSettings ? "Saving…" : "Save Quiz Settings"}
                          </Button>
                        </div>
                      )}

                      {isAdmin && (
                        <QuizEditor
                          key={selected.id}
                          sopId={selected.id}
                          title={selected.title}
                          content={selected.content}
                          onContentChange={(content) => {
                            const updated = { ...selected, content };
                            setSelected(updated);
                            setDocs(prev => prev.map(d => d.id === selected.id ? updated : d));
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <div className="rounded-md border border-dashed border-[#C89B3C]/40 p-6 text-center space-y-3">
                      <p className="text-sm text-[#2A1F0E]/70">
                        This is a reference document — it has no training material.
                      </p>
                      {isAdmin && (
                        <>
                          <p className="text-xs text-[#2A1F0E]/50">
                            Make it a training module to add slides and a quiz and assign it to employees. Nothing already attached is removed.
                          </p>
                          <Button onClick={setAsTraining} disabled={changingKind} size="sm" className="bg-[#C89B3C] hover:bg-[#B8892C]">
                            <GraduationCap className="w-3.5 h-3.5 mr-1" />{changingKind ? "Working…" : "Make this a training module"}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="reference">
                  <DocumentAttachment
                    sopId={selected.id}
                    attachments={Array.isArray(selected.content?.attachments) ? selected.content.attachments : []}
                    onChange={isAdmin ? saveAttachments : undefined}
                    legacyFileUrl={detail.file_url}
                    onClearLegacy={isAdmin ? () => saveFileUrl(null) : undefined}
                    variant={selected.training_category != null ? "training" : "reference"}
                  />
                </TabsContent>
              </Tabs>

              {isAdmin && (
                <div className="border-t pt-4 mt-2" style={{ borderColor: "rgba(220,38,38,0.25)" }}>
                  <Label className="text-xs text-muted-foreground">Danger Zone</Label>
                  <div className="flex items-center justify-between gap-3 mt-1.5">
                    <p className="text-xs text-[#2A1F0E]/60">
                      Permanently delete this document, its quiz, and all training assignments. This cannot be undone — use Archive instead to keep a record.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-red-500/40 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setDeleteTarget(selected)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />Delete Permanently
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Hard-delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the document along with its quiz questions, training assignments,
              and uploaded files. This action cannot be undone. To keep a record instead, set its status to Archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); deleteDoc(); }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? "Deleting…" : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add SOP dialog */}
      <Dialog open={!!editDoc} onOpenChange={(o) => !o && setEditDoc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add SOP</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>SOP Number</Label><Input value={editDoc?.sop_number ?? ""} onChange={e => setEditDoc({ ...editDoc!, sop_number: e.target.value })} /></div>
              <div><Label>Revision</Label><Input value={editDoc?.revision ?? ""} onChange={e => setEditDoc({ ...editDoc!, revision: e.target.value })} /></div>
            </div>
            <div><Label>Title *</Label><Input value={editDoc?.title ?? ""} onChange={e => setEditDoc({ ...editDoc!, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={editDoc?.type ?? "sop"} onValueChange={v => setEditDoc({ ...editDoc!, type: v as SopDocument["type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editDoc?.status ?? "draft"} onValueChange={v => setEditDoc({ ...editDoc!, status: v as SopDocument["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <CategorySelect
                  value={editDoc?.category}
                  categories={existingCategories}
                  onChange={category => setEditDoc({ ...editDoc!, category })}
                />
              </div>
              <div><Label>Effective Date</Label><Input type="date" value={editDoc?.effective_date ?? ""} onChange={e => setEditDoc({ ...editDoc!, effective_date: e.target.value })} /></div>
            </div>
            <div><Label>SQF Reference</Label><Input value={editDoc?.sqf_reference ?? ""} onChange={e => setEditDoc({ ...editDoc!, sqf_reference: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit_sqf_required"
                checked={editDoc?.sqf_required ?? false}
                onCheckedChange={v => setEditDoc({ ...editDoc!, sqf_required: !!v })}
              />
              <Label htmlFor="edit_sqf_required" className="cursor-pointer">Required for SQF audit</Label>
            </div>
            <div><Label>File URL</Label><Input value={editDoc?.file_url ?? ""} onChange={e => setEditDoc({ ...editDoc!, file_url: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoc(null)}>Cancel</Button>
            <Button onClick={saveDoc} disabled={saving} className="bg-[#C89B3C] hover:bg-[#B8892C]">{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Reference Document dialog (no slides/quiz — just a titled record to attach files/links to) */}
      <Dialog open={refDocCategory !== null} onOpenChange={(o) => { if (!o) setRefDocCategory(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Reference Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Creates a reference entry{refDocCategory && refDocCategory !== "Uncategorized" ? ` under "${refDocCategory}"` : ""}.
              No slides or quiz — after it's created you can attach files or links.
            </p>
            <div>
              <Label className="mb-1.5 block">Document Title *</Label>
              <Input
                autoFocus
                placeholder="e.g. Allergen Cleaning Procedure"
                value={refDocTitle}
                onChange={e => setRefDocTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createRefDoc(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefDocCategory(null)}>Cancel</Button>
            <Button onClick={createRefDoc} disabled={creatingRefDoc} className="bg-[#C89B3C] hover:bg-[#B8892C]">
              {creatingRefDoc ? "Creating…" : "Create & Attach"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SopImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={load} categories={existingCategories} />
      <PptxImportDialog open={pptxImportOpen} onOpenChange={setPptxImportOpen} onImported={load} />
      <PptxImportDialog
        open={importCategory !== null}
        onOpenChange={(o) => { if (!o) setImportCategory(null); }}
        onImported={load}
        defaults={importCategory !== null ? {
          category: importCategory === "Uncategorized" ? null : importCategory,
          training_category: trainingCategoryForLabel(importCategory),
        } : undefined}
      />
    </div>
  );
}
