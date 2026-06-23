import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DocumentReader } from "@/components/team/DocumentReader";
import { SpanishFlag } from "@/components/team/SpanishFlag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, CheckCircle2, Clock, AlertTriangle, ArrowUp, ArrowDown, ChevronsUpDown, Download } from "lucide-react";
import { toast } from "sonner";
import {
  TRAINING_CATEGORIES, TRAINING_CATEGORY_LABELS,
  TrainingModule, TrainingAssignment,
  AssignmentStatus, getAssignmentStatus,
  fetchTrainingModules, fetchTrainingAssignments, fetchReferenceDocuments,
  hasSopBody,
} from "@/lib/training";
import { generateSopPdf } from "@/lib/sopPdf";

const TYPE_LABELS: Record<string, string> = { sop: "SOP", form: "Form", policy: "Policy", training: "Training", fsqm: "FSQM" };

const cardStyle = { background: "#FFFFFF", borderColor: "rgba(200,155,60,0.25)" };

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; className: string; icon: any }> = {
  not_started: { label: "Not Assigned", className: "bg-[#2A1F0E]/10 text-[#2A1F0E]/60 border-[#2A1F0E]/20", icon: Clock },
  in_progress: { label: "In Progress", className: "bg-[#C89B3C]/20 text-[#9A6F1E] border-[#C89B3C]/40", icon: Clock },
  completed: { label: "Completed", className: "bg-green-500/20 text-green-700 border-green-500/30", icon: CheckCircle2 },
  expired: { label: "Expired — Renew", className: "bg-red-500/20 text-red-700 border-red-500/30", icon: AlertTriangle },
};

type ModuleSortKey = "module" | "title" | "required" | "status" | "renewal";

const STATUS_ORDER: Record<AssignmentStatus, number> = {
  not_started: 0, in_progress: 1, completed: 2, expired: 3,
};

export default function TrainingSops() {
  const { role } = useUserRole();
  const isAdmin = role === "admin" || role === "owner";
  const navigate = useNavigate();

  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [myAssignments, setMyAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refDocs, setRefDocs] = useState<any[]>([]);
  const [selectedRef, setSelectedRef] = useState<any | null>(null);

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

  // Column sorting for the per-category module tables (shared across all groups)
  const [sortKey, setSortKey] = useState<ModuleSortKey>("module");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const toggleSort = (key: ModuleSortKey) => {
    if (key === sortKey) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };
  const sortValue = (m: TrainingModule): string | number => {
    switch (sortKey) {
      case "module": return m.sop_number ?? "";
      case "title": return m.title;
      case "required": return m.required_departments?.join(", ") ?? "All Staff";
      case "status": return STATUS_ORDER[getAssignmentStatus(assignmentByModule.get(m.id))];
      case "renewal": return m.is_annual_refresher ? 1 : 0;
    }
  };
  const sortItems = (items: TrainingModule[]) => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const av = sortValue(a), bv = sortValue(b);
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return cmp * dir;
    });
  };
  const SortHead = ({ k, label, className }: { k: ModuleSortKey; label: string; className?: string }) => (
    <TableHead className={className ?? "text-[#2A1F0E]/60"}>
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
                <Table className="[&_td]:py-2 [&_th]:h-9">
                  <TableHeader>
                    <TableRow>
                      <SortHead k="module" label="Number" />
                      <SortHead k="title" label="Title" />
                      <TableHead className="text-[#2A1F0E]/60 w-10"></TableHead>
                      <SortHead k="required" label="Required For" />
                      <SortHead k="status" label="Status" />
                      <SortHead k="renewal" label="Renewal" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortItems(group.items).map(m => {
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
                          <TableCell className="font-mono text-xs">{m.sop_number ?? "—"}</TableCell>
                          <TableCell className="font-medium">{m.title}</TableCell>
                          <TableCell className="w-10">
                            {(() => {
                              const esModule = spanishByEnTitle.get(m.title);
                              if (!esModule) return null;
                              return (
                                <button
                                  onClick={e => { e.stopPropagation(); navigate(`/team/hr/trainings/${esModule.id}`); }}
                                  title="Ver en español"
                                  className="leading-none hover:opacity-60 transition-opacity align-middle"
                                >
                                  <SpanishFlag />
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
                                Slide {progress.slide} of {slideCount} Â· {progress.pct}%
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-[#2A1F0E]/60">
                            {m.is_annual_refresher ? "Annual" : "—"}
                            {assignment?.expires_at && ` Â· expires ${assignment.expires_at}`}
                          </TableCell>
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
                    <TableHead className="text-[#2A1F0E]/60">Type</TableHead>
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
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[#2A1F0E]/60 border-[#2A1F0E]/20">{TYPE_LABELS[d.type] ?? d.type}</Badge>
                          {d.type === "sop" && hasSopBody(d.content) && (
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
              {/* Training & SOPs is the read/launch surface — document management
                  (upload/link/edit) lives in the SOPs Library. Always render the
                  read-only reader here, for admins and employees alike. */}
              <DocumentReader doc={selectedRef} />
            </div>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}