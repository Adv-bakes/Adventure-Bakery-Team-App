import { DocRefText } from "./DocRefText";
import { useRef, useState } from "react";
import { Controller, type Control } from "react-hook-form";
import { Camera, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { AiCellDraft, GridColumn, GridField } from "@/lib/formSchema";
import { GridCell } from "./GridFieldInput";

/**
 * One grid row, stacked vertically.
 *
 * WHY IT EXISTS. A receiving log is fourteen columns wide and is filled on a tablet at a
 * loading dock. The grid's own floor is ~1450px for that many columns, so it scrolls sideways
 * no matter how the column weights are set — the filler cannot see the field they are typing
 * into and the one they just filled at the same time. This presents the same row as a normal
 * top-to-bottom form, which is what a person filling in one delivery actually wants.
 *
 * IT IS A SECOND VIEW, NOT A SECOND COPY. Every input here binds to the identical
 * react-hook-form path the grid cell uses (`<fieldId>.<rowIndex>.<columnId>`), so the grid and
 * this dialog are two renderings of one value. Nothing syncs, nothing can drift, and edits made
 * here are already in the form state when it closes — which is also why there is no Save button:
 * a Save that did nothing but close would imply Cancel could discard, and it could not.
 */
export interface GridRowDialogProps {
  field: GridField;
  control: Control<Record<string, any>>;
  /** Row being edited, or null when closed. */
  rowIndex: number | null;
  onClose: () => void;
  disabled?: boolean;
  /** Read-only leading label, for a fixed-row grid. */
  rowLabel?: string;
  /** What to look at for this row (GridRows.guidance). Shown above the first field. */
  guidance?: string;
  /**
   * The row's useFieldArray key. A scan replaces the whole row through
   * `update()`, which mints a new key; the table re-reads because its <TableRow>
   * is keyed on it, and these inputs must do the same or they keep rendering the
   * values from before the scan. That was a real bug: scanning from inside this
   * dialog filled the row underneath and showed nothing.
   */
  rowKey?: string;
  /**
   * Scan a package label into this row. The dialog owns its own file input rather
   * than reaching for the grid's: that one lives outside the modal, and driving a
   * hidden input across a focus-trapped portal is a needless thing to depend on.
   */
  onScanFile?: (file: File) => void;
  scanning?: boolean;
  /** Grey suggestion for a cell (column.suggestFrom), computed by the grid that owns the row. */
  suggestionFor?: (column: GridColumn, rowIndex: number) => string | null;
  /** "Draft from records" for columns with `aiDraft` (FRM-010 evidence). Absent = no button. */
  onDraftCell?: (column: GridColumn, rowIndex: number) => Promise<AiCellDraft | null>;
}

export function GridRowDialog({
  field, control, rowIndex, onClose, disabled, rowLabel, guidance, rowKey, onScanFile, scanning, suggestionFor, onDraftCell,
}: GridRowDialogProps) {
  const open = rowIndex != null;
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="text-[#2A1F0E]">
            <DocRefText text={field.label} />
            {rowIndex != null && <span className="text-muted-foreground font-normal"> · Row {rowIndex + 1}</span>}
          </DialogTitle>
          <DialogDescription>
            {rowLabel
              ? <DocRefText text={rowLabel.split("\n")[0]} />
              : "Every column of this row, top to bottom. Changes are kept as you make them."}
          </DialogDescription>
        </DialogHeader>

        {/* The dialog body scrolls, the header and footer do not — a fourteen-field
            form on a tablet is taller than the viewport. */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
          {/* Two ways in, because `capture` is all-or-nothing per input: WITH it a
              phone opens the camera and will not offer the gallery, WITHOUT it a
              phone offers the gallery and never the camera. One button therefore
              always forces somebody down the wrong path. Desktop browsers ignore
              `capture` entirely, so there both buttons land on the file picker —
              harmless, and honest about what the machine can do. */}
          {onScanFile && (() => {
            const take = (input: HTMLInputElement | null) => input?.click();
            const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              e.target.value = "";            // so the same photo can be retaken
              if (file) onScanFile(file);
            };
            return (
              <>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                       className="hidden" onChange={onPick} />
                <input ref={fileRef} type="file" accept="image/*"
                       className="hidden" onChange={onPick} />
                {scanning ? (
                  <Button type="button" variant="outline" className="w-full" disabled>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />Reading the label…
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" disabled={disabled}
                            onClick={() => take(cameraRef.current)}>
                      <Camera className="w-4 h-4 mr-2 text-[#9A6F1E]" />Take photo
                    </Button>
                    <Button type="button" variant="outline" disabled={disabled}
                            onClick={() => take(fileRef.current)}>
                      <ImageIcon className="w-4 h-4 mr-2 text-[#9A6F1E]" />Choose photo
                    </Button>
                  </div>
                )}
              </>
            );
          })()}

          <div key={rowKey ?? rowIndex ?? "none"} className="space-y-4">
          {rowIndex != null && guidance && <RowGuidance text={guidance} />}
          {rowIndex != null && field.columns.map((column: GridColumn) => (
            <div key={column.id} className="space-y-1.5">
              <Label className="text-xs font-medium text-[#2A1F0E]">
                <DocRefText text={column.label} />
                {column.unit && <span className="text-muted-foreground font-normal"> ({column.unit})</span>}
                {column.required && <span className="text-red-600"> *</span>}
              </Label>
              <Controller
                control={control}
                name={`${field.id}.${rowIndex}.${column.id}`}
                render={({ field: f, fieldState }) => (
                  <>
                    <GridCell
                      column={column}
                      value={f.value}
                      onChange={f.onChange}
                      disabled={disabled}
                      stacked
                      suggestion={suggestionFor?.(column, rowIndex)}
                      control={control}
                      rowPath={`${field.id}.${rowIndex}`}
                    />
                    {fieldState.error?.message && (
                      <p className="text-xs text-red-600">{fieldState.error.message}</p>
                    )}
                    {column.aiDraft && onDraftCell && !disabled && (
                      <AiDraftAssist
                        value={f.value}
                        onChange={f.onChange}
                        draft={() => onDraftCell(column, rowIndex)}
                      />
                    )}
                  </>
                )}
              />
            </div>
          ))}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button type="button" onClick={onClose} className="w-full sm:w-auto">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "What to look at" for the row being filled. Lines starting "• " collapse into
 * one list; any other line is a paragraph, so a lead sentence can sit above
 * its bullets.
 */
function RowGuidance({ text }: { text: string }) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const blocks: Array<{ kind: "p"; text: string } | { kind: "ul"; items: string[] }> = [];
  for (const line of lines) {
    const bullet = /^[•\-*]\s+/.exec(line);
    if (bullet) {
      const last = blocks[blocks.length - 1];
      const item = line.slice(bullet[0].length);
      if (last?.kind === "ul") last.items.push(item);
      else blocks.push({ kind: "ul", items: [item] });
    } else {
      blocks.push({ kind: "p", text: line });
    }
  }
  return (
    <div className="rounded-md border px-3 py-2.5 space-y-1.5 bg-[#C89B3C]/8" style={{ borderColor: "rgba(200,155,60,0.35)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9A6F1E]">What to look at</p>
      {blocks.map((b, i) =>
        b.kind === "p" ? (
          <p key={i} className="text-sm text-[#2A1F0E]"><DocRefText text={b.text} /></p>
        ) : (
          <ul key={i} className="list-disc pl-5 space-y-1 text-sm text-[#2A1F0E]">
            {b.items.map((item, j) => <li key={j}><DocRefText text={item} /></li>)}
          </ul>
        ),
      )}
    </div>
  );
}

/**
 * "Draft from records" (GridColumn.aiDraft). The draft is SHOWN, never written: the auditor reads
 * it with the records it came from and taps Use (or Replace / Add below when they have already
 * typed something), which is an ordinary edit of the cell, saved by Save Draft. Discard leaves the
 * cell exactly as it was. It lives inside the row's key, so moving to another row starts clean.
 */
function AiDraftAssist({ value, onChange, draft }: {
  value: unknown;
  onChange: (v: string) => void;
  draft: () => Promise<AiCellDraft | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AiCellDraft | null>(null);
  const current = typeof value === "string" ? value.trim() : "";

  const run = async () => {
    setBusy(true);
    try {
      const r = await draft();
      if (r) setResult(r);
    } finally {
      setBusy(false);
    }
  };
  const apply = (mode: "replace" | "append") => {
    if (!result) return;
    onChange(mode === "append" && current ? `${current}\n${result.text}` : result.text);
    setResult(null);
  };

  if (!result) {
    return (
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={busy} onClick={run}>
        {busy
          ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Reading a year of records…</>
          : <><Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#C89B3C]" />Draft from records</>}
      </Button>
    );
  }
  return (
    <div className="rounded-md border px-3 py-2.5 space-y-2 bg-[#2A1F0E]/[0.03]" style={{ borderColor: "rgba(200,155,60,0.45)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9A6F1E]">
        Draft - not in the record until you use it
      </p>
      <p className="text-sm italic text-[#2A1F0E]/80 whitespace-pre-wrap">{result.text}</p>
      {result.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.sources.map(s => (
            <a
              key={s.id}
              href={`/team/compliance/sops?doc=${s.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`${s.number} ${s.title}${s.last ? ` - last entry ${s.last}` : ""}`}
              className="inline-flex items-center gap-1 rounded-full border border-[#C89B3C]/40 px-2 py-0.5 text-xs hover:bg-[#C89B3C]/10"
            >
              <span className="font-medium text-[#9A6F1E]">{s.number}</span>
              {s.submitted != null && (
                <span className={s.submitted === 0 ? "text-amber-700 font-medium" : "text-[#2A1F0E]/55"}>· {s.submitted}</span>
              )}
              {s.status === "draft" && <span className="text-[10px] uppercase text-[#2A1F0E]/50">draft</span>}
            </a>
          ))}
        </div>
      )}
      <p className="text-xs text-[#2A1F0E]/60">
        Drafted from the records only{result.window ? ` (${result.window.from} to ${result.window.to})` : ""}. Add what you saw on the floor and who you asked.
      </p>
      <div className="flex flex-wrap gap-2">
        {current ? (
          <>
            <Button type="button" size="sm" className="h-8 text-xs" onClick={() => apply("replace")}>Replace</Button>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => apply("append")}>Add below</Button>
          </>
        ) : (
          <Button type="button" size="sm" className="h-8 text-xs" onClick={() => apply("replace")}>Use</Button>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setResult(null)}>Discard</Button>
      </div>
    </div>
  );
}
