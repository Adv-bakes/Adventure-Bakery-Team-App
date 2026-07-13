import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateModuleContent } from "@/lib/training";
import {
  FIELD_TYPE_LABELS, FORM_SCHEMA_VERSION, emptyValues, getFormSchema, slugifyFieldId, valueFields,
  type FormField, type FormFieldType, type FormSchema, type FormSection, type GridField,
  type InfoField, type NumberField, type ReferenceTableField, type SelectField,
  type SignatureField, type TextareaField,
} from "@/lib/formSchema";
import { FormRenderer } from "./FormRenderer";
import { GridColumnsEditor } from "./GridColumnsEditor";
import { ReferenceTableEditor } from "./ReferenceTableEditor";

const goldBorder = { borderColor: "rgba(200,155,60,0.25)" };

const blankSchema = (): FormSchema => ({
  schemaVersion: FORM_SCHEMA_VERSION,
  settings: {},
  sections: [{ id: "section_1", title: "", fields: [] }],
});

const newField = (type: FormFieldType, taken: Set<string>): FormField => {
  const base = { id: slugifyFieldId(FIELD_TYPE_LABELS[type], taken), type, label: "" } as FormField;
  if (type === "select") (base as SelectField).options = [];
  if (type === "grid") {
    (base as GridField).columns = [];
    (base as GridField).rows = { mode: "dynamic", min: 1 };
  }
  if (type === "info") (base as InfoField).text = "";
  if (type === "reference_table") {
    (base as ReferenceTableField).columns = [];
    (base as ReferenceTableField).rows = [];
  }
  return base;
};

/** Live preview gets its own throwaway RHF instance, remounted per toggle. */
function SchemaPreview({ schema }: { schema: FormSchema }) {
  const form = useForm<Record<string, any>>({ defaultValues: emptyValues(schema) });
  return (
    <div className="rounded-lg border-2 border-dashed p-4" style={{ borderColor: "rgba(200,155,60,0.4)" }}>
      <p className="text-xs text-[#9A6F1E] font-medium mb-3">
        Preview — nothing entered here is saved.
      </p>
      <FormRenderer
        schema={schema}
        form={form}
        isAdmin
        signer={{ userId: "preview", name: "Preview User" }}
      />
    </div>
  );
}

interface FormSchemaBuilderProps {
  sopId: string;
  content: any;
  onContentChange?: (content: any) => void;
  /** Loads an AI-extracted proposal into the editor (unsaved). Rendered as a button when provided. */
  onGenerateAi?: () => Promise<FormSchema | null>;
  generateLabel?: string;
}

/**
 * Admin authoring/review UI for content.form_schema. Nothing persists until
 * "Save Form" (updateModuleContent merges, so attachments/body survive).
 * Field ids lock once saved — renaming an id would orphan recorded answers.
 */
export function FormSchemaBuilder({ sopId, content, onContentChange, onGenerateAi, generateLabel }: FormSchemaBuilderProps) {
  const [schema, setSchema] = useState<FormSchema>(() => getFormSchema(content) ?? blankSchema());
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isProposal, setIsProposal] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);

  // Ids present in the last-SAVED schema are locked (answers may reference them).
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    const saved = getFormSchema(content);
    const ids = new Set<string>();
    if (saved) {
      for (const f of valueFields(saved)) {
        ids.add(f.id);
        if (f.type === "grid") for (const c of (f as GridField).columns) ids.add(`${f.id}.${c.id}`);
      }
    }
    return ids;
  });

  const takenIds = useMemo(
    () => new Set(schema.sections.flatMap(s => s.fields.map(f => f.id))),
    [schema],
  );

  const patchSection = (sIdx: number, patch: Partial<FormSection>) =>
    setSchema(prev => ({ ...prev, sections: prev.sections.map((s, i) => (i === sIdx ? { ...s, ...patch } : s)) }));

  const patchField = (sIdx: number, fIdx: number, patch: Partial<FormField>) =>
    setSchema(prev => ({
      ...prev,
      sections: prev.sections.map((s, i) =>
        i === sIdx ? { ...s, fields: s.fields.map((f, j) => (j === fIdx ? ({ ...f, ...patch } as FormField) : f)) } : s),
    }));

  const setFieldLabel = (sIdx: number, fIdx: number, label: string) => {
    const field = schema.sections[sIdx].fields[fIdx];
    const patch: Partial<FormField> = { label };
    if (!savedIds.has(field.id)) {
      const taken = new Set(takenIds);
      taken.delete(field.id);
      patch.id = slugifyFieldId(label || field.type, taken);
    }
    patchField(sIdx, fIdx, patch);
  };

  const addField = (sIdx: number, type: FormFieldType) =>
    setSchema(prev => ({
      ...prev,
      sections: prev.sections.map((s, i) =>
        i === sIdx ? { ...s, fields: [...s.fields, newField(type, new Set(prev.sections.flatMap(x => x.fields.map(f => f.id))))] } : s),
    }));

  const removeField = (sIdx: number, fIdx: number) =>
    setSchema(prev => ({
      ...prev,
      sections: prev.sections.map((s, i) => (i === sIdx ? { ...s, fields: s.fields.filter((_, j) => j !== fIdx) } : s)),
    }));

  const moveField = (sIdx: number, fIdx: number, dir: -1 | 1) =>
    setSchema(prev => ({
      ...prev,
      sections: prev.sections.map((s, i) => {
        if (i !== sIdx) return s;
        const target = fIdx + dir;
        if (target < 0 || target >= s.fields.length) return s;
        const fields = [...s.fields];
        [fields[fIdx], fields[target]] = [fields[target], fields[fIdx]];
        return { ...s, fields };
      }),
    }));

  const addSection = () =>
    setSchema(prev => {
      const taken = new Set(prev.sections.map(s => s.id));
      return { ...prev, sections: [...prev.sections, { id: slugifyFieldId("section", taken), title: "", fields: [] }] };
    });

  const removeSection = (sIdx: number) =>
    setSchema(prev => ({ ...prev, sections: prev.sections.filter((_, i) => i !== sIdx) }));

  const moveSection = (sIdx: number, dir: -1 | 1) =>
    setSchema(prev => {
      const target = sIdx + dir;
      if (target < 0 || target >= prev.sections.length) return prev;
      const sections = [...prev.sections];
      [sections[sIdx], sections[target]] = [sections[target], sections[sIdx]];
      return { ...prev, sections };
    });

  const patchSettings = (patch: Partial<NonNullable<FormSchema["settings"]>>) =>
    setSchema(prev => ({ ...prev, settings: { ...(prev.settings ?? {}), ...patch } }));

  const generate = async () => {
    if (!onGenerateAi) return;
    setGenerating(true);
    try {
      const proposal = await onGenerateAi();
      if (proposal) {
        setSchema(proposal);
        setIsProposal(true);
        toast.success("AI proposal loaded — review each field, then Save Form");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Schema generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    for (const section of schema.sections) {
      for (const field of section.fields) {
        if (!field.label.trim() && field.type !== "info") {
          return toast.error(`A ${FIELD_TYPE_LABELS[field.type]} field is missing its label`);
        }
        if (field.type === "select" && (field as SelectField).options.length === 0) {
          return toast.error(`Dropdown "${field.label}" needs at least one option`);
        }
        if (field.type === "grid") {
          const grid = field as GridField;
          if (grid.columns.length === 0) return toast.error(`Grid "${field.label}" needs at least one column`);
          if (grid.columns.some(c => !c.label.trim())) return toast.error(`Grid "${field.label}" has a column without a label`);
          if (grid.rows.mode === "fixed" && grid.rows.labels.filter(l => l.trim()).length === 0) {
            return toast.error(`Grid "${field.label}" (fixed rows) needs at least one row label`);
          }
        }
        if (field.type === "reference_table") {
          const rt = field as ReferenceTableField;
          if (rt.columns.length === 0) return toast.error(`Reference table "${field.label}" needs at least one column`);
          if (rt.rows.length === 0) return toast.error(`Reference table "${field.label}" needs at least one row`);
        }
      }
    }
    const cleaned: FormSchema = {
      ...schema,
      schemaVersion: FORM_SCHEMA_VERSION,
      sections: schema.sections
        .map(s => ({ ...s, title: s.title?.trim() || undefined, description: s.description?.trim() || undefined }))
        .filter(s => s.fields.length > 0 || schema.sections.length === 1),
    };
    setSaving(true);
    try {
      const nextContent = { ...(content ?? {}), form_schema: cleaned };
      await updateModuleContent(sopId, nextContent);
      setSchema(cleaned);
      setIsProposal(false);
      const ids = new Set<string>();
      for (const f of valueFields(cleaned)) {
        ids.add(f.id);
        if (f.type === "grid") for (const c of (f as GridField).columns) ids.add(`${f.id}.${c.id}`);
      }
      setSavedIds(ids);
      onContentChange?.(nextContent);
      toast.success("Form saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save form");
    } finally {
      setSaving(false);
    }
  };

  const fieldCount = schema.sections.reduce((n, s) => n + s.fields.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Label className="block">Form Fields{fieldCount ? ` (${fieldCount})` : ""}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Changes take effect for new entries once saved. Bump the Revision above when the paper form revision changes.
          </p>
        </div>
        <div className="flex gap-2">
          {onGenerateAi && (
            <Button
              type="button" variant="outline" size="sm"
              className="text-[#9A6F1E] border-[#C89B3C]/40 hover:bg-[#C89B3C]/10"
              onClick={generate} disabled={generating}
            >
              {generating ? "Generating…" : generateLabel ?? "Generate with AI"}
            </Button>
          )}
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => { setPreview(p => !p); setPreviewNonce(n => n + 1); }}
          >
            {preview ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
            {preview ? "Close Preview" : "Preview"}
          </Button>
        </div>
      </div>

      {isProposal && (
        <div className="rounded-md border border-[#C89B3C] bg-[#C89B3C]/10 p-3 text-xs text-[#9A6F1E]">
          AI proposal — review every field against the paper form before saving. Nothing is stored until you click Save Form.
        </div>
      )}

      {preview && <SchemaPreview key={previewNonce} schema={schema} />}

      {!preview && (
        <>
          {schema.sections.map((section, sIdx) => (
            <div key={section.id} className="rounded-md border p-3 space-y-3" style={goldBorder}>
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder={`Section ${sIdx + 1} title (optional)`}
                    value={section.title ?? ""}
                    onChange={e => patchSection(sIdx, { title: e.target.value })}
                    className="font-medium"
                  />
                  <Input
                    placeholder="Section description (optional)"
                    value={section.description ?? ""}
                    onChange={e => patchSection(sIdx, { description: e.target.value })}
                    className="text-xs h-8"
                  />
                </div>
                <div className="flex items-center shrink-0">
                  <Button type="button" variant="ghost" size="icon" disabled={sIdx === 0} onClick={() => moveSection(sIdx, -1)} title="Move section up">
                    <ChevronUp className="w-3.5 h-3.5 text-[#9A6F1E]" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" disabled={sIdx === schema.sections.length - 1} onClick={() => moveSection(sIdx, 1)} title="Move section down">
                    <ChevronDown className="w-3.5 h-3.5 text-[#9A6F1E]" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" disabled={schema.sections.length <= 1} onClick={() => removeSection(sIdx)} title="Delete section">
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </div>

              {section.fields.map((field, fIdx) => (
                <div key={`${section.id}-${fIdx}`} className="rounded-md border bg-white p-3 space-y-2" style={goldBorder}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-[#9A6F1E] shrink-0">{FIELD_TYPE_LABELS[field.type] ?? field.type}</span>
                      <span className="font-mono text-[10px] text-[#2A1F0E]/40 truncate" title={savedIds.has(field.id) ? "Field id (locked — answers reference it)" : "Field id (derived from label)"}>
                        {field.id}
                      </span>
                    </div>
                    <div className="flex items-center shrink-0">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={fIdx === 0} onClick={() => moveField(sIdx, fIdx, -1)} title="Move up">
                        <ChevronUp className="w-3.5 h-3.5 text-[#9A6F1E]" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={fIdx === section.fields.length - 1} onClick={() => moveField(sIdx, fIdx, 1)} title="Move down">
                        <ChevronDown className="w-3.5 h-3.5 text-[#9A6F1E]" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeField(sIdx, fIdx)} title="Delete field">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-48">
                      <Label className="text-[10px] text-muted-foreground">{field.type === "heading" ? "Heading text" : "Label"}</Label>
                      <Input className="h-8" value={field.label} onChange={e => setFieldLabel(sIdx, fIdx, e.target.value)} />
                    </div>
                    {field.type !== "heading" && field.type !== "info" && field.type !== "grid" && field.type !== "reference_table" && (
                      <div className="w-24">
                        <Label className="text-[10px] text-muted-foreground">Width</Label>
                        <Select value={field.width ?? "full"} onValueChange={v => patchField(sIdx, fIdx, { width: v as FormField["width"] })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Full</SelectItem>
                            <SelectItem value="half">Half</SelectItem>
                            <SelectItem value="third">Third</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {field.type !== "heading" && field.type !== "info" && field.type !== "reference_table" && (
                      <div className="flex items-center gap-1.5 pb-2">
                        <Checkbox
                          id={`req-${sIdx}-${fIdx}`}
                          checked={field.required ?? false}
                          onCheckedChange={c => patchField(sIdx, fIdx, { required: !!c || undefined })}
                        />
                        <Label htmlFor={`req-${sIdx}-${fIdx}`} className="text-xs font-normal cursor-pointer">Required</Label>
                      </div>
                    )}
                    {field.type !== "heading" && field.type !== "info" && field.type !== "grid" && field.type !== "reference_table" && (
                      <div className="flex items-center gap-1.5 pb-2">
                        <Checkbox
                          id={`list-${sIdx}-${fIdx}`}
                          checked={field.showInList ?? false}
                          onCheckedChange={c => patchField(sIdx, fIdx, { showInList: !!c || undefined })}
                        />
                        <Label htmlFor={`list-${sIdx}-${fIdx}`} className="text-xs font-normal cursor-pointer">Show in Entries list</Label>
                      </div>
                    )}
                  </div>

                  {/* Per-type extras */}
                  {field.type === "textarea" && (
                    <div className="w-28">
                      <Label className="text-[10px] text-muted-foreground">Rows</Label>
                      <Input type="number" min={2} className="h-8 text-xs" value={(field as TextareaField).rows ?? ""} onChange={e => patchField(sIdx, fIdx, { rows: e.target.value === "" ? undefined : Number(e.target.value) } as any)} />
                    </div>
                  )}
                  {field.type === "number" && (
                    <div className="flex flex-wrap gap-2">
                      {(["min", "max", "step"] as const).map(k => (
                        <div key={k} className="w-24">
                          <Label className="text-[10px] text-muted-foreground capitalize">{k}</Label>
                          <Input type="number" className="h-8 text-xs" value={(field as NumberField)[k] ?? ""} onChange={e => patchField(sIdx, fIdx, { [k]: e.target.value === "" ? undefined : Number(e.target.value) } as any)} />
                        </div>
                      ))}
                      <div className="w-24">
                        <Label className="text-[10px] text-muted-foreground">Unit</Label>
                        <Input className="h-8 text-xs" placeholder="°F, lbs…" value={(field as NumberField).unit ?? ""} onChange={e => patchField(sIdx, fIdx, { unit: e.target.value || undefined } as any)} />
                      </div>
                    </div>
                  )}
                  {(field.type === "date" || field.type === "time" || field.type === "datetime") && (
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id={`today-${sIdx}-${fIdx}`}
                        checked={(field as any).defaultToday ?? false}
                        onCheckedChange={c => patchField(sIdx, fIdx, { defaultToday: !!c || undefined } as any)}
                      />
                      <Label htmlFor={`today-${sIdx}-${fIdx}`} className="text-xs font-normal cursor-pointer">Default to now when the entry is created</Label>
                    </div>
                  )}
                  {field.type === "select" && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Options (one per line)</Label>
                        <Textarea
                          className="text-xs h-20"
                          value={(field as SelectField).options.join("\n")}
                          onChange={e => patchField(sIdx, fIdx, { options: e.target.value.split("\n") } as any)}
                          onBlur={e => patchField(sIdx, fIdx, { options: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) } as any)}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Checkbox
                          id={`multi-${sIdx}-${fIdx}`}
                          checked={(field as SelectField).multiple ?? false}
                          onCheckedChange={c => patchField(sIdx, fIdx, { multiple: !!c || undefined } as any)}
                        />
                        <Label htmlFor={`multi-${sIdx}-${fIdx}`} className="text-xs font-normal cursor-pointer">Allow multiple selections</Label>
                      </div>
                    </div>
                  )}
                  {field.type === "pass_fail" && (
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id={`na-${sIdx}-${fIdx}`}
                        checked={(field as any).naAllowed !== false}
                        onCheckedChange={c => patchField(sIdx, fIdx, { naAllowed: c ? undefined : false } as any)}
                      />
                      <Label htmlFor={`na-${sIdx}-${fIdx}`} className="text-xs font-normal cursor-pointer">Allow N/A</Label>
                    </div>
                  )}
                  {field.type === "signature" && (
                    <div className="flex flex-wrap gap-2 items-end">
                      <div className="w-40">
                        <Label className="text-[10px] text-muted-foreground">Signed by</Label>
                        <Select value={(field as SignatureField).role ?? "filler"} onValueChange={v => patchField(sIdx, fIdx, { role: v as SignatureField["role"] } as any)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="filler">The person filling the form</SelectItem>
                            <SelectItem value="verifier">Verifier (admin only)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 min-w-48">
                        <Label className="text-[10px] text-muted-foreground">Statement (optional)</Label>
                        <Input className="h-8 text-xs" placeholder="I certify the above is accurate" value={(field as SignatureField).statement ?? ""} onChange={e => patchField(sIdx, fIdx, { statement: e.target.value || undefined } as any)} />
                      </div>
                    </div>
                  )}
                  {field.type === "info" && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Instruction text</Label>
                      <Textarea className="text-xs h-16" value={(field as InfoField).text} onChange={e => patchField(sIdx, fIdx, { text: e.target.value } as any)} />
                    </div>
                  )}
                  {field.type === "grid" && (
                    <GridColumnsEditor
                      field={field as GridField}
                      onChange={f => patchField(sIdx, fIdx, f)}
                      savedIds={savedIds}
                    />
                  )}
                  {field.type === "reference_table" && (
                    <ReferenceTableEditor
                      field={field as ReferenceTableField}
                      onChange={f => patchField(sIdx, fIdx, f)}
                    />
                  )}
                  {field.type !== "heading" && field.type !== "info" && field.type !== "reference_table" && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Help text (optional)</Label>
                      <Input className="h-8 text-xs" value={field.help ?? ""} onChange={e => patchField(sIdx, fIdx, { help: e.target.value || undefined })} />
                    </div>
                  )}
                </div>
              ))}

              <div className="flex items-center gap-2">
                <Select value="" onValueChange={v => addField(sIdx, v as FormFieldType)}>
                  <SelectTrigger className="w-44 h-9 text-xs">
                    <span className="flex items-center"><Plus className="w-3.5 h-3.5 mr-1" />Add Field</span>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FIELD_TYPE_LABELS) as FormFieldType[]).map(t => (
                      <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addSection}>
            <Plus className="w-3.5 h-3.5 mr-1" />Add Section
          </Button>

          {/* Per-form settings */}
          <div className="rounded-md border p-3 space-y-2" style={goldBorder}>
            <Label className="text-xs font-medium">Form Settings</Label>
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="set-deletable"
                checked={schema.settings?.deletable !== false}
                onCheckedChange={c => patchSettings({ deletable: c ? undefined : false })}
              />
              <Label htmlFor="set-deletable" className="text-xs font-normal cursor-pointer">
                Entries can be deleted (admins only). Uncheck for records that must be retained.
              </Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="set-multidraft"
                checked={schema.settings?.allowMultipleDrafts !== false}
                onCheckedChange={c => patchSettings({ allowMultipleDrafts: c ? undefined : false })}
              />
              <Label htmlFor="set-multidraft" className="text-xs font-normal cursor-pointer">
                Allow multiple open drafts per person (unchecked: "New Entry" resumes their existing draft)
              </Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="set-verify"
                checked={schema.settings?.requireVerification ?? false}
                onCheckedChange={c => patchSettings({ requireVerification: !!c || undefined })}
              />
              <Label htmlFor="set-verify" className="text-xs font-normal cursor-pointer">
                Requires verification (surface the verifier signature on submitted entries)
              </Label>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Entry title template (optional) — tokens: {"{date}"}, {"{user}"}, {"{field_id}"}
              </Label>
              <Input
                className="h-8 text-xs"
                placeholder="{date} — {supplier_name}"
                value={schema.settings?.instanceTitleTemplate ?? ""}
                onChange={e => patchSettings({ instanceTitleTemplate: e.target.value || undefined })}
              />
            </div>
          </div>

          <Button type="button" onClick={save} disabled={saving} className="bg-[#C89B3C] hover:bg-[#B8892C]">
            {saving ? "Saving…" : "Save Form"}
          </Button>
        </>
      )}
    </div>
  );
}
