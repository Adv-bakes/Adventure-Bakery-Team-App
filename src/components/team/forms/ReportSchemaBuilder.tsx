import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateModuleContent } from "@/lib/training";
import { getFormSchema, hasFormSchema, slugifyFieldId, valueFields, type FormField } from "@/lib/formSchema";
import {
  COLUMN_SOURCE_LABELS, REPORT_SCHEMA_VERSION, runReport,
  type CaseRule, type ColumnSource, type ReportColumnDef, type ReportParam, type ReportSchema,
} from "@/lib/formReport";

const goldBorder = { borderColor: "rgba(200,155,60,0.25)" };

type FormDoc = { id: string; title: string; sop_number: string | null; revision: string | null; content: any };

const blankSchema = (): ReportSchema => ({
  version: REPORT_SCHEMA_VERSION,
  sourceSopNumber: "",
  sourceStatus: "submitted",
  defaultDateField: "",
  columns: [],
  params: [],
});

const blankSource = (kind: ColumnSource["kind"]): ColumnSource => {
  switch (kind) {
    case "field": return { kind: "field", field: "" };
    case "template": return { kind: "template", template: "" };
    case "map": return { kind: "map", field: "", map: {} };
    case "cases": return { kind: "cases", cases: [], default: "" };
    case "const": return { kind: "const", value: "" };
  }
};

interface ReportSchemaBuilderProps {
  sopId: string;
  content: any;
  onSaved: (content: any) => void;
  onCancel?: () => void;
}

/**
 * Admin authoring UI for content.report_schema. Nothing persists until "Save
 * Report" (updateModuleContent merges, so form_schema/attachments survive).
 */
export function ReportSchemaBuilder({ sopId, content, onSaved, onCancel }: ReportSchemaBuilderProps) {
  const [schema, setSchema] = useState<ReportSchema>(() => getReportSchemaOrBlank(content));
  const [forms, setForms] = useState<FormDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("sop_documents")
        .select("id, title, sop_number, revision, content, type")
        .eq("type", "form")
        .order("sop_number", { ascending: true });
      if (error) return toast.error(error.message);
      setForms(((data ?? []) as (FormDoc & { type: string })[]).filter(d => d.id !== sopId && hasFormSchema(d)));
    })();
  }, [sopId]);

  const sourceDoc = forms.find(f => f.sop_number === schema.sourceSopNumber) ?? null;
  const sourceFields: FormField[] = useMemo(() => {
    const s = sourceDoc ? getFormSchema(sourceDoc.content) : null;
    return s ? valueFields(s).filter(f => f.type !== "grid") : [];
  }, [sourceDoc]);
  const dateFields = sourceFields.filter(f => f.type === "date" || f.type === "datetime");

  // ----- schema patchers -----
  const patch = (p: Partial<ReportSchema>) => setSchema(prev => ({ ...prev, ...p }));
  const patchColumn = (i: number, p: Partial<ReportColumnDef>) =>
    setSchema(prev => ({ ...prev, columns: prev.columns.map((c, j) => (j === i ? { ...c, ...p } : c)) }));
  const patchSource = (i: number, source: ColumnSource) => patchColumn(i, { source });

  const addColumn = () =>
    setSchema(prev => {
      const taken = new Set(prev.columns.map(c => c.id));
      return { ...prev, columns: [...prev.columns, { id: slugifyFieldId("column", taken), header: "", source: blankSource("field") }] };
    });
  const removeColumn = (i: number) =>
    setSchema(prev => ({ ...prev, columns: prev.columns.filter((_, j) => j !== i) }));
  const moveColumn = (i: number, dir: -1 | 1) =>
    setSchema(prev => {
      const t = i + dir;
      if (t < 0 || t >= prev.columns.length) return prev;
      const columns = [...prev.columns];
      [columns[i], columns[t]] = [columns[t], columns[i]];
      return { ...prev, columns };
    });

  // Give a column a readable id from its header; cascade the rename into params.
  const renameColumnFromHeader = (i: number, header: string) => {
    setSchema(prev => {
      const col = prev.columns[i];
      const taken = new Set(prev.columns.filter((_, j) => j !== i).map(c => c.id));
      const nextId = slugifyFieldId(header || "column", taken);
      if (nextId === col.id) return { ...prev, columns: prev.columns.map((c, j) => (j === i ? { ...c, header } : c)) };
      return {
        ...prev,
        columns: prev.columns.map((c, j) => (j === i ? { ...c, id: nextId, header } : c)),
        params: prev.params.map(p => (p.column === col.id ? { ...p, column: nextId } : p)),
      };
    });
  };

  const addParam = () =>
    setSchema(prev => {
      const taken = new Set(prev.params.map(p => p.id));
      return {
        ...prev,
        params: [...prev.params, { id: slugifyFieldId("param", taken), label: "", type: "text", op: "contains" }],
      };
    });
  const patchParam = (i: number, p: Partial<ReportParam>) =>
    setSchema(prev => ({ ...prev, params: prev.params.map((x, j) => (j === i ? { ...x, ...p } : x)) }));
  const removeParam = (i: number) =>
    setSchema(prev => ({ ...prev, params: prev.params.filter((_, j) => j !== i) }));

  const runPreview = async () => {
    if (!schema.sourceSopNumber) return toast.error("Pick a source form first");
    setPreviewing(true);
    try {
      const result = await runReport(schema, {});
      setPreview({ headers: result.columns.map(c => c.header), rows: result.rows.slice(0, 5).map(r => r.cells) });
      if (!result.sourceDoc) toast.error(`Source form ${schema.sourceSopNumber} not found`);
    } catch (e: any) {
      toast.error(e.message ?? "Preview failed");
    } finally {
      setPreviewing(false);
    }
  };

  const save = async () => {
    if (!schema.sourceSopNumber) return toast.error("Pick a source form");
    if (schema.columns.length === 0) return toast.error("Add at least one column");
    for (const c of schema.columns) {
      if (!c.header.trim()) return toast.error("Every column needs a header");
      if (c.source.kind === "field" && !c.source.field) return toast.error(`Column "${c.header}" needs a source field`);
      if (c.source.kind === "map" && !c.source.field) return toast.error(`Column "${c.header}" needs a field to map`);
    }
    for (const p of schema.params) {
      if (!p.label.trim()) return toast.error("Every parameter needs a label");
    }
    const cleaned: ReportSchema = {
      ...schema,
      version: REPORT_SCHEMA_VERSION,
      defaultDateField: schema.defaultDateField || undefined,
      legend: schema.legend?.filter(l => l.trim()).length ? schema.legend.filter(l => l.trim()) : undefined,
    };
    setSaving(true);
    try {
      const nextContent = { ...(content ?? {}), report_schema: cleaned };
      await updateModuleContent(sopId, nextContent);
      toast.success("Report saved");
      onSaved(nextContent);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save report");
    } finally {
      setSaving(false);
    }
  };

  const fieldPicker = (value: string | undefined, onChange: (v: string) => void, only?: "date") => {
    const list = only === "date" ? dateFields : sourceFields;
    return (
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder={sourceDoc ? "Pick a field…" : "Pick a source form first"} /></SelectTrigger>
        <SelectContent>
          {list.map(f => <SelectItem key={f.id} value={f.id}>{f.label} <span className="opacity-40">({f.id})</span></SelectItem>)}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Label className="block">Report definition</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Present this log from another form's collected entries. Columns map source fields into the register.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={runPreview} disabled={previewing}>
            {preview ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
            {previewing ? "Running…" : "Preview"}
          </Button>
          {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
        </div>
      </div>

      {/* Source */}
      <div className="rounded-md border p-3 space-y-3" style={goldBorder}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-[10px] text-muted-foreground">Source form</Label>
            <Select value={schema.sourceSopNumber || ""} onValueChange={v => patch({ sourceSopNumber: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick a form…" /></SelectTrigger>
              <SelectContent>
                {forms.map(f => (
                  <SelectItem key={f.id} value={f.sop_number ?? f.id}>
                    {f.sop_number ? `${f.sop_number} — ` : ""}{f.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Include</Label>
            <Select value={schema.sourceStatus ?? "submitted"} onValueChange={v => patch({ sourceStatus: v as ReportSchema["sourceStatus"] })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="submitted">Submitted entries only</SelectItem>
                <SelectItem value="all">All (incl. drafts)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Default date field (for date-range params)</Label>
            {fieldPicker(schema.defaultDateField, v => patch({ defaultDateField: v }), "date")}
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Columns{schema.columns.length ? ` (${schema.columns.length})` : ""}</Label>
        {schema.columns.map((col, i) => (
          <div key={col.id} className="rounded-md border bg-white p-3 space-y-2" style={goldBorder}>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-[10px] text-muted-foreground">Column header</Label>
                <Input className="h-8" value={col.header} onChange={e => patchColumn(i, { header: e.target.value })} onBlur={e => renameColumnFromHeader(i, e.target.value)} />
              </div>
              <div className="w-48">
                <Label className="text-[10px] text-muted-foreground">Derived from</Label>
                <Select value={col.source.kind} onValueChange={k => patchSource(i, blankSource(k as ColumnSource["kind"]))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(COLUMN_SOURCE_LABELS) as ColumnSource["kind"][]).map(k => (
                      <SelectItem key={k} value={k}>{COLUMN_SOURCE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center shrink-0">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => moveColumn(i, -1)}><ChevronUp className="w-3.5 h-3.5 text-[#9A6F1E]" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === schema.columns.length - 1} onClick={() => moveColumn(i, 1)}><ChevronDown className="w-3.5 h-3.5 text-[#9A6F1E]" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeColumn(i)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
              </div>
            </div>
            <ColumnSourceEditor source={col.source} onChange={s => patchSource(i, s)} fieldPicker={fieldPicker} sourceFields={sourceFields} />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addColumn}><Plus className="w-3.5 h-3.5 mr-1" />Add Column</Button>
      </div>

      {/* Params */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Parameters{schema.params.length ? ` (${schema.params.length})` : ""}</Label>
        <p className="text-[11px] text-muted-foreground -mt-1">Filters shown above the report. They apply live.</p>
        {schema.params.map((p, i) => (
          <div key={p.id} className="rounded-md border bg-white p-3 flex flex-wrap items-end gap-2" style={goldBorder}>
            <div className="w-40">
              <Label className="text-[10px] text-muted-foreground">Label</Label>
              <Input className="h-8 text-xs" value={p.label} onChange={e => patchParam(i, { label: e.target.value })} />
            </div>
            <div className="w-36">
              <Label className="text-[10px] text-muted-foreground">Type</Label>
              <Select value={p.type} onValueChange={v => patchParam(i, { type: v as ReportParam["type"] })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-range">Date range</SelectItem>
                  <SelectItem value="text">Text search</SelectItem>
                  <SelectItem value="select">Dropdown (by column)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {p.type === "date-range" && (
              <div className="w-48">
                <Label className="text-[10px] text-muted-foreground">Date field</Label>
                {fieldPicker(p.field ?? schema.defaultDateField, v => patchParam(i, { field: v }), "date")}
              </div>
            )}
            {p.type === "text" && (
              <>
                <div className="w-48">
                  <Label className="text-[10px] text-muted-foreground">Field</Label>
                  {fieldPicker(p.field, v => patchParam(i, { field: v }))}
                </div>
                <div className="w-28">
                  <Label className="text-[10px] text-muted-foreground">Match</Label>
                  <Select value={p.op ?? "contains"} onValueChange={v => patchParam(i, { op: v as ReportParam["op"] })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="equals">Equals</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {p.type === "select" && (
              <div className="w-48">
                <Label className="text-[10px] text-muted-foreground">Column</Label>
                <Select value={p.column || ""} onValueChange={v => patchParam(i, { column: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick a column…" /></SelectTrigger>
                  <SelectContent>
                    {schema.columns.map(c => <SelectItem key={c.id} value={c.id}>{c.header || c.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeParam(i)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addParam}><Plus className="w-3.5 h-3.5 mr-1" />Add Parameter</Button>
      </div>

      {/* Legend */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Legend / notes (one per line, printed under the PDF table)</Label>
        <Textarea
          className="text-xs h-20"
          value={(schema.legend ?? []).join("\n")}
          onChange={e => patch({ legend: e.target.value.split("\n") })}
          onBlur={e => patch({ legend: e.target.value.split("\n").map(l => l.trim()).filter(Boolean) })}
        />
      </div>

      {preview && (
        <div className="rounded-lg border-2 border-dashed p-3 overflow-x-auto" style={{ borderColor: "rgba(200,155,60,0.4)" }}>
          <p className="text-xs text-[#9A6F1E] font-medium mb-2">Preview — first {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"} (no params applied)</p>
          <Table className="[&_td]:py-1.5 [&_th]:h-8 min-w-max">
            <TableHeader><TableRow>{preview.headers.map((h, i) => <TableHead key={i} className="text-[#2A1F0E]/70 whitespace-nowrap text-xs">{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {preview.rows.length === 0 ? (
                <TableRow><TableCell colSpan={preview.headers.length || 1} className="text-center text-xs text-[#2A1F0E]/50 py-4">No source entries yet.</TableCell></TableRow>
              ) : preview.rows.map((r, ri) => (
                <TableRow key={ri}>{r.map((c, ci) => <TableCell key={ci} className="text-xs whitespace-nowrap">{c || "—"}</TableCell>)}</TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Button type="button" onClick={save} disabled={saving} className="bg-[#C89B3C] hover:bg-[#B8892C]">
        {saving ? "Saving…" : "Save Report"}
      </Button>
    </div>
  );
}

function getReportSchemaOrBlank(content: any): ReportSchema {
  const raw = content?.report_schema;
  if (raw && typeof raw === "object" && Array.isArray(raw.columns) && raw.sourceSopNumber) return raw as ReportSchema;
  return blankSchema();
}

// ---------- per-kind source editors ----------

function ColumnSourceEditor({
  source, onChange, fieldPicker, sourceFields,
}: {
  source: ColumnSource;
  onChange: (s: ColumnSource) => void;
  fieldPicker: (value: string | undefined, onChange: (v: string) => void, only?: "date") => JSX.Element;
  sourceFields: FormField[];
}) {
  if (source.kind === "field") {
    return <div className="max-w-md">{fieldPicker(source.field, v => onChange({ kind: "field", field: v }))}</div>;
  }
  if (source.kind === "const") {
    return (
      <Input className="h-8 text-xs max-w-md" placeholder="Fixed text (leave blank for an empty column)"
        value={source.value} onChange={e => onChange({ kind: "const", value: e.target.value })} />
    );
  }
  if (source.kind === "template") {
    return (
      <div>
        <Input className="h-8 text-xs" placeholder="{product_name} / {lot_batch_code}"
          value={source.template} onChange={e => onChange({ kind: "template", template: e.target.value })} />
        <p className="text-[10px] text-muted-foreground mt-1">
          Use {"{field_id}"} tokens. Available: {sourceFields.map(f => f.id).join(", ") || "—"}
        </p>
      </div>
    );
  }
  if (source.kind === "map") {
    return <MapSourceEditor source={source} onChange={onChange} fieldPicker={fieldPicker} />;
  }
  return <CasesSourceEditor source={source} onChange={onChange} fieldPicker={fieldPicker} />;
}

function MapSourceEditor({
  source, onChange, fieldPicker,
}: {
  source: Extract<ColumnSource, { kind: "map" }>;
  onChange: (s: ColumnSource) => void;
  fieldPicker: (value: string | undefined, onChange: (v: string) => void, only?: "date") => JSX.Element;
}) {
  const [text, setText] = useState(() => Object.entries(source.map).map(([k, v]) => `${k} => ${v}`).join("\n"));
  const commit = (raw: string) => {
    const map: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const idx = line.includes("=>") ? line.indexOf("=>") : line.indexOf("=");
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + (line.includes("=>") ? 2 : 1)).trim();
      if (key) map[key] = val;
    }
    onChange({ ...source, map });
  };
  return (
    <div className="space-y-2">
      <div className="max-w-md">{fieldPicker(source.field, v => onChange({ ...source, field: v }))}</div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Value map — one per line: <span className="font-mono">source value =&gt; shown value</span></Label>
        <Textarea className="text-xs h-24 font-mono" value={text}
          onChange={e => setText(e.target.value)} onBlur={e => commit(e.target.value)}
          placeholder={"Critical (food safety risk) => C\nNon-Critical (quality concern) => NC"} />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Fallback (when no value matches)</Label>
        <Input className="h-8 text-xs max-w-xs" value={source.fallback ?? ""} onChange={e => onChange({ ...source, fallback: e.target.value || undefined })} />
      </div>
    </div>
  );
}

function CasesSourceEditor({
  source, onChange, fieldPicker,
}: {
  source: Extract<ColumnSource, { kind: "cases" }>;
  onChange: (s: ColumnSource) => void;
  fieldPicker: (value: string | undefined, onChange: (v: string) => void, only?: "date") => JSX.Element;
}) {
  const patchRule = (i: number, p: Partial<CaseRule>) =>
    onChange({ ...source, cases: source.cases.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const addRule = () => onChange({ ...source, cases: [...source.cases, { field: "", op: "notEmpty", then: "" }] });
  const removeRule = (i: number) => onChange({ ...source, cases: source.cases.filter((_, j) => j !== i) });
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground">First matching rule wins; otherwise the default is shown.</p>
      {source.cases.map((rule, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <div className="w-44"><Label className="text-[10px] text-muted-foreground">When field</Label>{fieldPicker(rule.field, v => patchRule(i, { field: v }))}</div>
          <div className="w-28">
            <Label className="text-[10px] text-muted-foreground">Is</Label>
            <Select value={rule.op} onValueChange={v => patchRule(i, { op: v as CaseRule["op"] })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="notEmpty">Not empty</SelectItem>
                <SelectItem value="empty">Empty</SelectItem>
                <SelectItem value="equals">Equals</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {rule.op === "equals" && (
            <div className="w-32"><Label className="text-[10px] text-muted-foreground">Value</Label><Input className="h-8 text-xs" value={rule.value ?? ""} onChange={e => patchRule(i, { value: e.target.value })} /></div>
          )}
          <div className="w-32"><Label className="text-[10px] text-muted-foreground">Show</Label><Input className="h-8 text-xs" value={rule.then} onChange={e => patchRule(i, { then: e.target.value })} /></div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRule(i)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRule}><Plus className="w-3.5 h-3.5 mr-1" />Add Rule</Button>
      <div className="w-40"><Label className="text-[10px] text-muted-foreground">Default</Label><Input className="h-8 text-xs" value={source.default ?? ""} onChange={e => onChange({ ...source, default: e.target.value })} /></div>
    </div>
  );
}
