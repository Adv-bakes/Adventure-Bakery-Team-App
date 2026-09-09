import { Controller, type Control } from "react-hook-form";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { GridColumn, GridField } from "@/lib/formSchema";
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
  /** Rescan this row's package label. Omitted when the grid has no scan. */
  onScan?: () => void;
  scanning?: boolean;
}

export function GridRowDialog({
  field, control, rowIndex, onClose, disabled, rowLabel, onScan, scanning,
}: GridRowDialogProps) {
  const open = rowIndex != null;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="text-[#2A1F0E]">
            {field.label}
            {rowIndex != null && <span className="text-muted-foreground font-normal"> · Row {rowIndex + 1}</span>}
          </DialogTitle>
          <DialogDescription>
            {rowLabel
              ? rowLabel.split("\n")[0]
              : "Every column of this row, top to bottom. Changes are kept as you make them."}
          </DialogDescription>
        </DialogHeader>

        {/* The dialog body scrolls, the header and footer do not — a fourteen-field
            form on a tablet is taller than the viewport. */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
          {onScan && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={disabled || scanning}
              onClick={onScan}
            >
              {scanning
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reading the label…</>
                : <><Camera className="w-4 h-4 mr-2 text-[#9A6F1E]" />Photograph the package label</>}
            </Button>
          )}

          {rowIndex != null && field.columns.map((column: GridColumn) => (
            <div key={column.id} className="space-y-1.5">
              <Label className="text-xs font-medium text-[#2A1F0E]">
                {column.label}
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
                    />
                    {fieldState.error?.message && (
                      <p className="text-xs text-red-600">{fieldState.error.message}</p>
                    )}
                  </>
                )}
              />
            </div>
          ))}
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button type="button" onClick={onClose} className="w-full sm:w-auto">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
