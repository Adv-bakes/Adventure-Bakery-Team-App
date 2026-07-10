import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import {
  flattenForReport, getFormSchema, hasFormSchema, instanceTitle,
  type FormSchema, type ReportColumn,
} from "@/lib/formSchema";
import { fetchProfileNames, fetchResponses, type FormResponse } from "@/lib/formResponses";
import { generateFormReportPdf } from "@/lib/formPdf";

const cardStyle = { background: "#FFFFFF", borderColor: "rgba(200,155,60,0.25)" };

const statusBadge: Record<string, string> = {
  draft: "bg-[#C89B3C]/20 text-[#9A6F1E] border-[#C89B3C]/40",
  submitted: "bg-green-500/20 text-green-700",
};

type FormDoc = {
  id: string;
  title: string;
  sop_number: string | null;
  revision: string | null;
  type: string;
  content: any;
};

type StatusFilter = "all" | "submitted" | "draft";

/**
 * Form Records — cross-form browsing + per-form answer reporting over
 * sop_document_responses. All aggregation is client-side, mirroring the
 * TemperatureReport pattern (ranged fetch, memoized shaping, CSV/PDF export).
 */
export default function Records() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [forms, setForms] = useState<FormDoc[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>(searchParams.get("form") ?? "");
  const [from, setFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("submitted");
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  // Fillable forms for the selector
  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("sop_documents")
        .select("id, title, sop_number, revision, type, content")
        .eq("type", "form")
        .order("sop_number", { ascending: true });
      if (error) return toast.error(error.message);
      setForms(((data ?? []) as FormDoc[]).filter(d => hasFormSchema(d)));
    })();
  }, []);

  // Consume ?form=<docId> deep link once
  useEffect(() => {
    const id = searchParams.get("form");
    if (id) {
      setSelectedFormId(id);
      searchParams.delete("form");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const selectedForm = forms.find(f => f.id === selectedFormId) ?? null;
  const schema: FormSchema | null = selectedForm ? getFormSchema(selectedForm.content) : null;

  // Ranged fetch: with a form selected, that form's entries; otherwise recent entries across forms
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const range = { from: `${from}T00:00:00`, to: `${to}T23:59:59` };
    fetchResponses(selectedFormId || undefined, range)
      .then(async rows => {
        if (cancelled) return;
        setResponses(rows);
        const map = await fetchProfileNames(rows.map(r => r.created_by));
        if (!cancelled) setNames(map);
      })
      .catch((e: any) => toast.error(e.message ?? "Failed to load entries"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedFormId, from, to]);

  const visible = useMemo(
    () => responses.filter(r => statusFilter === "all" || r.status === statusFilter),
    [responses, statusFilter],
  );

  const reportColumns: ReportColumn[] = useMemo(
    () => (schema ? flattenForReport(schema) : []),
    [schema],
  );

  const formsById = useMemo(() => new Map(forms.map(f => [f.id, f])), [forms]);

  const openEntry = (r: FormResponse) =>
    navigate(`/team/compliance/forms/${r.document_id}/entries/${r.id}`);

  function exportCsv() {
    if (!selectedForm || !schema) return;
    if (visible.length === 0) { toast.error("No entries to export"); return; }
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const headers = ["Entry Date", "Filled By", "Status", ...reportColumns.map(c => c.header)];
    const lines = visible.map(r => [
      format(new Date(r.submitted_at ?? r.created_at), "yyyy-MM-dd HH:mm"),
      names.get(r.created_by) ?? "",
      r.status,
      ...reportColumns.map(c => c.cell(r.data ?? {})),
    ].map(v => esc(String(v ?? ""))).join(","));
    const csv = [headers.map(esc).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedForm.sop_number ?? "form"}-entries-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    if (!selectedForm || !schema) return;
    if (visible.length === 0) { toast.error("No entries to export"); return; }
    try {
      await generateFormReportPdf(
        selectedForm,
        reportColumns,
        visible.map(r => ({ response: r, fillerName: names.get(r.created_by) ?? "" })),
        { from, to },
      );
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate PDF");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "#F5F1E6" }}>Form Records</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(245,241,230,0.6)" }}>
          Filled-out form entries and per-form answer reports.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "rgba(245,241,230,0.6)" }}>Form</Label>
          <Select value={selectedFormId || "all"} onValueChange={v => setSelectedFormId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-72 bg-white"><SelectValue placeholder="All forms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All forms (recent entries)</SelectItem>
              {forms.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {f.sop_number ? `${f.sop_number} — ` : ""}{f.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "rgba(245,241,230,0.6)" }}>From</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-white w-40" />
        </div>
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "rgba(245,241,230,0.6)" }}>To</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-white w-40" />
        </div>
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "rgba(245,241,230,0.6)" }}>Status</Label>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-36 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {selectedForm && (
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={exportCsv} disabled={loading}>
              <Download className="w-4 h-4 mr-1.5" />CSV
            </Button>
            <Button onClick={exportPdf} disabled={loading} className="bg-[#C89B3C] hover:bg-[#B8892C]">
              <FileText className="w-4 h-4 mr-1.5" />PDF
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <Card className="p-8 text-center border" style={cardStyle}>
          <p className="text-[#2A1F0E]/50 text-sm">Loading entries…</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center border" style={cardStyle}>
          <p className="text-[#2A1F0E]/50 text-sm">
            No {statusFilter !== "all" ? `${statusFilter} ` : ""}entries in this range.
          </p>
        </Card>
      ) : selectedForm && schema ? (
        /* Per-form answer table: one column per (flattened) schema field */
        <Card className="border overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <Table className="[&_td]:py-2 [&_th]:h-9 min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[#2A1F0E]/60 whitespace-nowrap">Entry</TableHead>
                  <TableHead className="text-[#2A1F0E]/60 whitespace-nowrap">Filled by</TableHead>
                  <TableHead className="text-[#2A1F0E]/60 whitespace-nowrap">Status</TableHead>
                  {reportColumns.map(c => (
                    <TableHead key={c.id} className="text-[#2A1F0E]/60 whitespace-nowrap">{c.header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-[#C89B3C]/5" onClick={() => openEntry(r)}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(r.submitted_at ?? r.created_at), "M/d/yyyy h:mm a")}
                      {r.form_revision && r.form_revision !== selectedForm.revision && (
                        <span className="ml-1.5 text-[10px] text-[#2A1F0E]/40">Rev {r.form_revision}</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{names.get(r.created_by) ?? "—"}</TableCell>
                    <TableCell><Badge className={statusBadge[r.status]}>{r.status}</Badge></TableCell>
                    {reportColumns.map(c => {
                      const value = c.cell(r.data ?? {});
                      return (
                        <TableCell key={c.id} className="text-xs max-w-56 truncate" title={value}>
                          {value || "—"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        /* Cross-form recent entries */
        <Card className="border overflow-hidden" style={cardStyle}>
          <Table className="[&_td]:py-2 [&_th]:h-9">
            <TableHeader>
              <TableRow>
                <TableHead className="text-[#2A1F0E]/60">Form #</TableHead>
                <TableHead className="text-[#2A1F0E]/60">Form</TableHead>
                <TableHead className="text-[#2A1F0E]/60">Entry</TableHead>
                <TableHead className="text-[#2A1F0E]/60">Filled by</TableHead>
                <TableHead className="text-[#2A1F0E]/60">Status</TableHead>
                <TableHead className="text-[#2A1F0E]/60">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map(r => {
                const formDoc = formsById.get(r.document_id);
                const formSchema = formDoc ? getFormSchema(formDoc.content) : null;
                const filler = names.get(r.created_by) ?? "—";
                return (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-[#C89B3C]/5" onClick={() => openEntry(r)}>
                    <TableCell className="font-mono text-xs">{r.form_number ?? formDoc?.sop_number ?? "—"}</TableCell>
                    <TableCell className="font-medium">{formDoc?.title ?? "—"}</TableCell>
                    <TableCell className="text-xs">{instanceTitle(formSchema, r, filler)}</TableCell>
                    <TableCell>{filler}</TableCell>
                    <TableCell><Badge className={statusBadge[r.status]}>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs text-[#2A1F0E]/60">
                      {format(new Date(r.submitted_at ?? r.created_at), "M/d/yyyy h:mm a")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
