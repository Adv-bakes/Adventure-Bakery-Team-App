import { useEffect, useMemo, useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Download, FileUp, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SopImportDialog } from "@/components/ops/SopImportDialog";
import { SlideContentEditor } from "@/components/team/SlideContentEditor";

type SopDocument = {
  id: string;
  sop_number: string | null;
  title: string;
  type: "sop" | "form" | "policy";
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
  created_at: string;
};

const cardStyle = {
  background: "#FFFFFF",
  borderColor: "rgba(200,155,60,0.25)",
};

const statusColors: Record<string, string> = {
  draft: "bg-[#C89B3C]/20 text-[#9A6F1E] border-[#C89B3C]/40",
  active: "bg-green-500/20 text-green-700",
  archived: "bg-amber-500/20 text-amber-700",
};

const TYPES = ["sop", "form", "policy"] as const;
const TYPE_LABELS: Record<string, string> = { sop: "SOP", form: "Form", policy: "Policy" };

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

export default function SopsLibrary() {
  const { role } = useUserRole();
  const isAdmin = role === "admin" || role === "owner";

  const [docs, setDocs] = useState<SopDocument[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("category");
  const [sqfOnly, setSqfOnly] = useState(false);
  const [selected, setSelected] = useState<SopDocument | null>(null);
  const [editDoc, setEditDoc] = useState<Partial<SopDocument> | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("sop_documents")
      .select("*")
      .order("sop_number", { ascending: true });
    if (error) return toast.error(error.message);
    setDocs((data ?? []) as SopDocument[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(d => {
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (sqfOnly && !d.sqf_required) return false;
      if (q && !`${d.sop_number ?? ""} ${d.title}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, search, typeFilter, sqfOnly]);

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

  const openNew = () => setEditDoc({ type: "sop", status: "draft", sqf_required: false });

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

  const DocTable = ({ items }: { items: SopDocument[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-[#2A1F0E]/60">Number</TableHead>
          <TableHead className="text-[#2A1F0E]/60">Title</TableHead>
          <TableHead className="text-[#2A1F0E]/60">Type</TableHead>
          <TableHead className="text-[#2A1F0E]/60">Revision</TableHead>
          <TableHead className="text-[#2A1F0E]/60">Effective Date</TableHead>
          <TableHead className="text-[#2A1F0E]/60">Status</TableHead>
          {viewMode === "category" && <TableHead className="text-[#2A1F0E]/60">SQF Ref</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(d => (
          <TableRow key={d.id} className="cursor-pointer hover:bg-[#C89B3C]/5" onClick={() => setSelected(d)}>
            <TableCell className="font-mono text-xs">{d.sop_number ?? "—"}</TableCell>
            <TableCell className="font-medium">
              <span>{d.title}</span>
              {d.sqf_required && (
                <ShieldCheck className="inline w-3.5 h-3.5 ml-1.5 text-[#C89B3C]" />
              )}
            </TableCell>
            <TableCell><Badge variant="outline">{TYPE_LABELS[d.type]}</Badge></TableCell>
            <TableCell>{d.revision ?? "—"}</TableCell>
            <TableCell>{d.effective_date ?? "—"}</TableCell>
            <TableCell><Badge className={statusColors[d.status]}>{d.status}</Badge></TableCell>
            {viewMode === "category" && <TableCell className="text-xs text-[#2A1F0E]/60">{d.sqf_reference ?? "—"}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

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
                <AccordionTrigger
                  className="px-4 py-3 hover:no-underline hover:bg-[#C89B3C]/5 [&[data-state=open]]:bg-[#C89B3C]/5"
                >
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
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
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
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">SOP #</Label><p>{selected.sop_number ?? "—"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Revision</Label><p>{selected.revision ?? "—"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Effective Date</Label><p>{selected.effective_date ?? "—"}</p></div>
                <div><Label className="text-xs text-muted-foreground">SQF Reference</Label><p>{selected.sqf_reference ?? "—"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Approved By</Label><p>{selected.approved_by ?? "—"}</p></div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Content</Label>
                {Array.isArray(selected.content?.slides) && selected.content.slides.length > 0 && isAdmin ? (
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
              {selected.file_url && (
                <a href={selected.file_url} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm"><Download className="w-3.5 h-3.5 mr-1" />Download File</Button>
                </a>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

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
              <div><Label>Category</Label><Input value={editDoc?.category ?? ""} onChange={e => setEditDoc({ ...editDoc!, category: e.target.value })} /></div>
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

      <SopImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={load} />
    </div>
  );
}
