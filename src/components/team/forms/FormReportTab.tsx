import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Copy, Database, Download, FileText, Pencil, Play } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  buildReportSql, distinctColumnValues, filterReportRows, getReportSchema, loadReportBase,
  type ParamValues, type ReportBase, type ReportSchema,
} from "@/lib/formReport";
import { generateDerivedReportPdf } from "@/lib/formPdf";
import { ReportSchemaBuilder } from "./ReportSchemaBuilder";

interface FormReportTabProps {
  doc: {
    id: string;
    title: string | null;
    sop_number: string | null;
    revision: string | null;
    effective_date?: string | null;
    content: any;
  };
  isAdmin: boolean;
  /** Bubble a saved content back up so the drawer/list refresh (mirrors saveBody). */
  onContentChange?: (content: any) => void;
}

const todayStr = () => format(new Date(), "yyyy-MM-dd");

/**
 * The drawer's Report tab: renders a derived register (this log form projected
 * from its source form's responses). Admins can define/edit the report schema.
 */
export function FormReportTab({ doc, isAdmin, onContentChange }: FormReportTabProps) {
  const schema: ReportSchema | null = getReportSchema(doc.content);
  const [editing, setEditing] = useState(false);
  const [base, setBase] = useState<ReportBase | null>(null);
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<ParamValues>({});
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!schema || editing) return;
    let cancelled = false;
    setLoading(true);
    loadReportBase(schema)
      .then(b => { if (!cancelled) setBase(b); })
      .catch((e: any) => toast.error(e.message ?? "Failed to run report"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // Re-run when the source/columns definition changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, editing, JSON.stringify(schema?.sourceSopNumber), JSON.stringify(schema?.sourceStatus), JSON.stringify(schema?.columns)]);

  const filtered = useMemo(
    () => (base && schema ? filterReportRows(schema, base.columns, base.rows, values) : []),
    [base, schema, values],
  );

  const sql = useMemo(
    () => (schema ? buildReportSql(schema, values, base?.sourceDoc) : ""),
    [schema, values, base?.sourceDoc],
  );

  // ----- Admin authoring -----
  if (isAdmin && (editing || !schema)) {
    return (
      <ReportSchemaBuilder
        key={doc.id}
        sopId={doc.id}
        content={doc.content}
        onSaved={(content) => { onContentChange?.(content); setEditing(false); }}
        onCancel={schema ? () => setEditing(false) : undefined}
      />
    );
  }

  if (!schema) {
    return (
      <p className="text-sm text-muted-foreground">
        No report is defined for this form yet. A report presents this log from another form's collected
        entries (an admin defines the mapping).
      </p>
    );
  }

  const columns = base?.columns ?? [];
  const rangeParam = schema.params.find(p => p.type === "date-range");
  const rangeVal = (rangeParam && typeof values[rangeParam.id] === "object" ? values[rangeParam.id] : {}) as { from?: string; to?: string };
  const setRange = (patch: { from?: string; to?: string }) =>
    rangeParam && setValues(v => ({ ...v, [rangeParam.id]: { ...rangeVal, ...patch } }));

  const rangeLabel = rangeVal.from || rangeVal.to ? `${rangeVal.from || "…"} to ${rangeVal.to || "…"}` : "all dates";

  function exportPdf() {
    if (filtered.length === 0) return toast.error("No rows to export");
    generateDerivedReportPdf(
      doc,
      columns.map(c => c.header),
      filtered.map(r => r.cells),
      {
        rangeLabel,
        count: filtered.length,
        sourceLabel: base?.sourceDoc ? `${base.sourceDoc.sop_number ?? ""} ${base.sourceDoc.title ?? ""}`.trim() : schema!.sourceSopNumber,
        legend: schema!.legend,
      },
    ).catch((e: any) => toast.error(e.message ?? "Failed to generate PDF"));
  }

  function exportCsv() {
    if (filtered.length === 0) return toast.error("No rows to export");
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const headers = columns.map(c => c.header);
    const lines = filtered.map(r => r.cells.map(c => esc(String(c ?? ""))).join(","));
    const csv = [headers.map(esc).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.sop_number ?? "log"}-${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      {/* Parameter controls */}
      <div className="flex flex-wrap items-end gap-3">
        {schema.params.map(param => {
          if (param.type === "date-range") {
            return (
              <div key={param.id} className="flex items-end gap-2">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">{param.label} — From</Label>
                    <button type="button" className="text-[10px] text-[#9A6F1E] hover:underline" onClick={() => setRange({ from: todayStr() })}>Today</button>
                  </div>
                  <Input type="date" className="h-8 w-36" value={rangeVal.from ?? ""} onChange={e => setRange({ from: e.target.value })} />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">To</Label>
                    <button type="button" className="text-[10px] text-[#9A6F1E] hover:underline" onClick={() => setRange({ to: todayStr() })}>Today</button>
                  </div>
                  <Input type="date" className="h-8 w-36" value={rangeVal.to ?? ""} onChange={e => setRange({ to: e.target.value })} />
                </div>
              </div>
            );
          }
          if (param.type === "text") {
            return (
              <div key={param.id}>
                <Label className="text-[10px] text-muted-foreground">{param.label}</Label>
                <Input
                  className="h-8 w-44"
                  placeholder={`Filter by ${param.label.toLowerCase()}`}
                  value={(typeof values[param.id] === "string" ? values[param.id] : "") as string}
                  onChange={e => setValues(v => ({ ...v, [param.id]: e.target.value }))}
                />
              </div>
            );
          }
          // select: distinct values of the bound column across all base rows
          const idx = param.column != null ? columns.findIndex(c => c.id === param.column) : -1;
          const options = idx >= 0 ? distinctColumnValues(base?.rows ?? [], idx) : [];
          const current = (typeof values[param.id] === "string" ? values[param.id] : "") as string;
          return (
            <div key={param.id}>
              <Label className="text-[10px] text-muted-foreground">{param.label}</Label>
              <Select value={current || "all"} onValueChange={val => setValues(v => ({ ...v, [param.id]: val === "all" ? "" : val }))}>
                <SelectTrigger className="h-8 w-40 bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        })}

        <div className="flex gap-2 ml-auto">
          {isAdmin && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit report
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setShowSql(s => !s)}>
            <Database className="w-3.5 h-3.5 mr-1.5" />{showSql ? "Hide SQL" : "View SQL"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={loading || filtered.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1.5" />CSV
          </Button>
          <Button type="button" size="sm" onClick={exportPdf} disabled={loading || filtered.length === 0} className="bg-[#C89B3C] hover:bg-[#B8892C]">
            <FileText className="w-3.5 h-3.5 mr-1.5" />PDF
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {loading ? "Running report…" : (
          <>
            {filtered.length} row{filtered.length === 1 ? "" : "s"}
            {base?.sourceDoc && <> · derived from <span className="font-medium">{base.sourceDoc.sop_number} {base.sourceDoc.title}</span></>}
            {(schema.sourceStatus ?? "submitted") === "submitted" && <> · submitted entries only</>}
          </>
        )}
      </p>

      {showSql && (
        <div className="rounded-md border bg-[#2A1F0E] text-[#F5F1E6]" style={{ borderColor: "rgba(200,155,60,0.3)" }}>
          <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: "rgba(245,241,230,0.12)" }}>
            <span className="text-[11px] uppercase tracking-wide text-[#C89B3C]">Equivalent read-only SQL · reflects current parameters</span>
            <Button
              type="button" variant="ghost" size="sm"
              className="h-7 text-[#F5F1E6] hover:bg-white/10"
              onClick={() => {
                navigator.clipboard.writeText(sql).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }).catch(() => toast.error("Copy failed"));
              }}
            >
              {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="p-3 text-[11px] leading-relaxed overflow-x-auto whitespace-pre font-mono">{sql}</pre>
        </div>
      )}

      {!loading && !base?.sourceDoc ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-[#2A1F0E]/75" style={{ borderColor: "rgba(200,155,60,0.4)" }}>
          Source form <span className="font-mono">{schema.sourceSopNumber}</span> wasn't found. Check the report definition.
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
          <Table className="[&_td]:py-2 [&_th]:h-9 min-w-max">
            <TableHeader>
              <TableRow>
                {columns.map(c => (
                  <TableHead key={c.id} className="text-[#2A1F0E]/80 whitespace-nowrap">{c.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length || 1} className="text-center text-sm text-[#2A1F0E]/50 py-6">
                    {loading ? "Running report…" : "No rows match the current parameters."}
                  </TableCell>
                </TableRow>
              ) : filtered.map(row => (
                <TableRow key={row.response.id}>
                  {row.cells.map((cell, i) => (
                    <TableCell key={columns[i].id} className="text-xs text-[#2A1F0E]/85 max-w-64 truncate" title={cell}>
                      {cell || <span className="text-[#2A1F0E]/35">—</span>}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {isAdmin && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Play className="w-3 h-3" /> Parameters filter live — no run button needed.
        </p>
      )}
    </div>
  );
}
