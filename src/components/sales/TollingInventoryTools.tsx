import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, ClipboardList, History, GitMerge } from "lucide-react";
import { toast } from "sonner";

export interface TollingRowLite {
  id?: string;
  ingredient_name: string;
  qty_on_hand: number;
  unit: string;
  lot_code: string | null;
  expiry_date: string | null;
  fromBatchSheet?: boolean;
  batchSheetIds?: string[];
  category?: string;
}

interface ParsedImportRow {
  ingredient_name: string;
  qty_on_hand: number;
  unit: string;
  lot_code: string | null;
  expiry_date: string | null;
  category?: "ingredient" | "packaging" | "finished_good";
}

function normalizeCategory(raw: string): ParsedImportRow["category"] {
  const c = normalizeHeader(raw);
  if (!c) return undefined;
  if (/\b(packag|box|label|bag)/.test(c)) return "packaging";
  if (/\b(finish|product)/.test(c)) return "finished_good";
  if (/\b(ingredient|raw material|material)/.test(c)) return "ingredient";
  return undefined;
}

function normalizeHeader(h: string) {
  return h
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Keyword-based matching (not exact-string) so real-world sheets with messy/compound
// headers (e.g. "Qty - On Hand", "Ingredients") still parse. Order matters: more specific
// fields are checked before the generic "ingredient_name" catch-all.
function matchHeaderKey(rawHeader: string): keyof ParsedImportRow | null {
  const h = normalizeHeader(rawHeader);
  if (!h) return null;
  if (/\b(reference|system|ignore)\b/.test(h)) return null; // explicitly excluded columns (e.g. our own count-sheet reference column)
  if (/\bexpir/.test(h)) return "expiry_date";
  if (/\blot\b/.test(h)) return "lot_code";
  if (/\b(unit|uom)\b/.test(h)) return "unit";
  if (/\bcategor/.test(h)) return "category";
  if (/\b(qty|quantity|on hand|count)/.test(h)) return "qty_on_hand";
  if (/(ingredient|item|material|product)/.test(h)) return "ingredient_name";
  return null;
}

// ExcelJS cell.value isn't always a plain primitive — formula cells come back as
// { formula, result }, styled text as { richText: [...] }, hyperlinks as { text, hyperlink }.
// Unwrap to the underlying primitive before reading it as a number/string/date.
function cellPrimitive(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value;
  const v = value as Record<string, unknown>;
  if (Array.isArray(v.richText)) return (v.richText as Array<{ text: string }>).map((r) => r.text).join("");
  if ("result" in v) return v.result;
  if ("text" in v) return v.text;
  return value;
}

function cellNumber(value: unknown): number {
  const prim = cellPrimitive(value);
  if (prim == null) return 0;
  const n = Number(String(prim).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function cellText(value: unknown): string {
  const prim = cellPrimitive(value);
  return prim == null ? "" : String(prim).trim();
}

function toIsoDate(value: unknown): string | null {
  const prim = cellPrimitive(value);
  if (!prim) return null;
  if (prim instanceof Date) return prim.toISOString().slice(0, 10);
  const d = new Date(String(prim));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function adjustedAtFor(dateIso: string) {
  return new Date(`${dateIso}T12:00:00`).toISOString();
}

const MAX_HEADER_SCAN_ROWS = 5;

async function parseWorkbook(file: File): Promise<ParsedImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  let headerRowNumber = -1;
  let colMap: Record<number, keyof ParsedImportRow> = {};
  for (let r = 1; r <= Math.min(MAX_HEADER_SCAN_ROWS, sheet.rowCount); r++) {
    const candidate: Record<number, keyof ParsedImportRow> = {};
    sheet.getRow(r).eachCell((cell, colNumber) => {
      const key = matchHeaderKey(cellText(cell.value));
      if (key) candidate[colNumber] = key;
    });
    if (Object.values(candidate).includes("ingredient_name")) {
      headerRowNumber = r;
      colMap = candidate;
      break;
    }
  }
  if (headerRowNumber === -1) return [];

  const rows: ParsedImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    const draft: Partial<ParsedImportRow> = {};
    row.eachCell((cell, colNumber) => {
      const key = colMap[colNumber];
      if (!key) return;
      if (key === "qty_on_hand") draft.qty_on_hand = cellNumber(cell.value);
      else if (key === "expiry_date") draft.expiry_date = toIsoDate(cell.value);
      else if (key === "category") draft.category = normalizeCategory(cellText(cell.value));
      else draft[key] = cellText(cell.value);
    });
    if (draft.ingredient_name) {
      rows.push({
        ingredient_name: draft.ingredient_name,
        qty_on_hand: draft.qty_on_hand ?? 0,
        unit: draft.unit || "lbs",
        lot_code: draft.lot_code || null,
        expiry_date: draft.expiry_date ?? null,
        category: draft.category,
      });
    }
  });
  return rows;
}

async function parseCsv(file: File): Promise<ParsedImportRow[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  let headerLineIndex = -1;
  let colMap: Record<number, keyof ParsedImportRow> = {};
  for (let i = 0; i < Math.min(MAX_HEADER_SCAN_ROWS, lines.length); i++) {
    const candidate: Record<number, keyof ParsedImportRow> = {};
    lines[i].split(",").forEach((cell, idx) => {
      const key = matchHeaderKey(cell);
      if (key) candidate[idx] = key;
    });
    if (Object.values(candidate).includes("ingredient_name")) {
      headerLineIndex = i;
      colMap = candidate;
      break;
    }
  }
  if (headerLineIndex === -1) return [];

  const rows: ParsedImportRow[] = [];
  for (const line of lines.slice(headerLineIndex + 1)) {
    const cells = line.split(",");
    const draft: Partial<ParsedImportRow> = {};
    Object.entries(colMap).forEach(([idxStr, key]) => {
      const raw = (cells[Number(idxStr)] ?? "").trim();
      if (key === "qty_on_hand") draft.qty_on_hand = Number(raw) || 0;
      else if (key === "expiry_date") draft.expiry_date = toIsoDate(raw);
      else if (key === "category") draft.category = normalizeCategory(raw);
      else draft[key] = raw;
    });
    if (draft.ingredient_name) {
      rows.push({
        ingredient_name: draft.ingredient_name,
        qty_on_hand: draft.qty_on_hand ?? 0,
        unit: draft.unit || "lbs",
        lot_code: draft.lot_code || null,
        expiry_date: draft.expiry_date ?? null,
        category: draft.category,
      });
    }
  }
  return rows;
}

const COUNT_SHEET_CATEGORY_LABELS: Record<string, string> = {
  ingredient: "Ingredients",
  packaging: "Packaging Materials",
  finished_good: "Finished Goods",
};

export async function downloadCountSheet(clientName: string, rows: TollingRowLite[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Count Sheet");
  sheet.columns = [
    { header: "Category", key: "category", width: 20 },
    { header: "Ingredient", key: "ingredient", width: 32 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Reference: Current Stock", key: "current", width: 20 },
    { header: "Qty", key: "qty", width: 12 },
    { header: "Lot Code", key: "lot", width: 16 },
    { header: "Expiry Date", key: "expiry", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };
  [...rows]
    .sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.ingredient_name.localeCompare(b.ingredient_name))
    .forEach((r) => {
      sheet.addRow({
        category: COUNT_SHEET_CATEGORY_LABELS[r.category ?? ""] ?? r.category ?? "",
        ingredient: r.ingredient_name,
        unit: r.unit,
        current: r.qty_on_hand,
        qty: "",
        lot: "",
        expiry: "",
      });
    });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${clientName.replace(/[^a-z0-9]+/gi, "-")}-count-sheet-${todayIso()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TollingExcelImportDialog({
  open,
  onOpenChange,
  clientId,
  existingRows,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  existingRows: TollingRowLite[];
  onComplete: () => void;
}) {
  const [parsed, setParsed] = useState<ParsedImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [countDate, setCountDate] = useState(todayIso);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      const rows = isCsv ? await parseCsv(file) : await parseWorkbook(file);
      if (rows.length === 0) {
        toast.error("No rows found. Make sure the file has an 'Ingredient' column.");
        return;
      }
      setParsed(rows);
    } catch (e: any) {
      toast.error(e.message || "Could not read file");
    }
  };

  const confirmImport = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const adjustedBy = userData?.user?.id ?? null;
    const existingByName = new Map(existingRows.map((r) => [r.ingredient_name.toLowerCase().trim(), r]));

    for (const row of parsed) {
      const key = row.ingredient_name.toLowerCase().trim();
      const existing = existingByName.get(key);
      // Recipe ingredients are always "Ingredients" regardless of what the sheet says;
      // otherwise honor the sheet's category, falling back to whatever it already was.
      const resolvedCategory = existing?.fromBatchSheet ? "ingredient" : (row.category ?? existing?.category);
      const payload: Record<string, unknown> = {
        client_id: clientId,
        ingredient_name: row.ingredient_name,
        qty_on_hand: row.qty_on_hand,
        unit: row.unit,
        lot_code: row.lot_code,
        expiry_date: row.expiry_date,
        updated_at: new Date().toISOString(),
      };
      if (resolvedCategory) payload.category = resolvedCategory;

      let tollingId = existing?.id ?? null;
      if (tollingId) {
        const { error } = await supabase.from("inventory_tolling").update(payload).eq("id", tollingId);
        if (error) { toast.error(`${row.ingredient_name}: ${error.message}`); continue; }
      } else {
        const { data, error } = await supabase.from("inventory_tolling").insert(payload).select("id").single();
        if (error) { toast.error(`${row.ingredient_name}: ${error.message}`); continue; }
        tollingId = data?.id ?? null;
      }

      await supabase.from("inventory_tolling_adjustments").insert({
        tolling_id: tollingId,
        client_id: clientId,
        ingredient_name: row.ingredient_name,
        previous_qty: existing?.qty_on_hand ?? 0,
        counted_qty: row.qty_on_hand,
        source: "excel_import",
        note: fileName,
        adjusted_by: adjustedBy,
        adjusted_at: adjustedAtFor(countDate),
      });
    }

    setSaving(false);
    toast.success(`Imported ${parsed.length} ingredient${parsed.length === 1 ? "" : "s"}`);
    setParsed([]);
    setFileName("");
    onOpenChange(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setParsed([]); setFileName(""); setCountDate(todayIso()); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Upload Inventory (Excel/CSV)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Columns recognized: Ingredient, Category (Ingredient / Packaging / Finished Good), Qty (or Quantity), Unit, Lot Code, Expiry Date.
            Category is optional — leave it out (or off) to keep an existing item's current category. New items with no category default to Ingredients.
            Only items listed in the file are touched — everything else is left as-is.
          </p>
          <div>
            <Label className="text-xs">Count Date</Label>
            <Input
              type="date"
              value={countDate}
              onChange={(e) => setCountDate(e.target.value)}
              className="w-44"
            />
          </div>
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {parsed.length > 0 && (
            <div className="max-h-80 overflow-y-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Ingredient</TableHead><TableHead>Category</TableHead><TableHead>Qty</TableHead><TableHead>Unit</TableHead><TableHead>Lot</TableHead><TableHead>Expires</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.ingredient_name}</TableCell>
                      <TableCell>{r.category ? COUNT_SHEET_CATEGORY_LABELS[r.category] : <span className="text-muted-foreground italic">unchanged</span>}</TableCell>
                      <TableCell>{r.qty_on_hand}</TableCell>
                      <TableCell>{r.unit}</TableCell>
                      <TableCell>{r.lot_code ?? "—"}</TableCell>
                      <TableCell>{r.expiry_date ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={parsed.length === 0 || saving} onClick={confirmImport} className="bg-[#C89B3C] hover:bg-[#B8892C]">
            {saving ? "Importing…" : `Import ${parsed.length || ""} Row${parsed.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TollingRecountDialog({
  open,
  onOpenChange,
  clientId,
  rows,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  rows: TollingRowLite[];
  onComplete: () => void;
}) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [countDate, setCountDate] = useState(todayIso);

  const setCount = (name: string, value: string) => setCounts((c) => ({ ...c, [name]: value }));

  const confirmRecount = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const adjustedBy = userData?.user?.id ?? null;
    let changed = 0;

    for (const row of rows) {
      const draft = counts[row.ingredient_name];
      if (draft === undefined || draft === "") continue;
      const countedQty = Number(draft);
      if (Number.isNaN(countedQty) || countedQty === row.qty_on_hand) continue;

      let tollingId = row.id ?? null;
      if (tollingId) {
        const { error } = await supabase.from("inventory_tolling").update({
          qty_on_hand: countedQty,
          updated_at: new Date().toISOString(),
        }).eq("id", tollingId);
        if (error) { toast.error(`${row.ingredient_name}: ${error.message}`); continue; }
      } else {
        const { data, error } = await supabase.from("inventory_tolling").insert({
          client_id: clientId,
          ingredient_name: row.ingredient_name,
          qty_on_hand: countedQty,
          unit: row.unit,
        }).select("id").single();
        if (error) { toast.error(`${row.ingredient_name}: ${error.message}`); continue; }
        tollingId = data?.id ?? null;
      }

      await supabase.from("inventory_tolling_adjustments").insert({
        tolling_id: tollingId,
        client_id: clientId,
        ingredient_name: row.ingredient_name,
        previous_qty: row.qty_on_hand,
        counted_qty: countedQty,
        source: "recount",
        adjusted_by: adjustedBy,
        adjusted_at: adjustedAtFor(countDate),
      });
      changed++;
    }

    setSaving(false);
    if (changed === 0) {
      toast("No quantities were changed");
    } else {
      toast.success(`Adjusted ${changed} ingredient${changed === 1 ? "" : "s"}`);
    }
    setCounts({});
    onOpenChange(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setCounts({}); setCountDate(todayIso()); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Adjust Inventory</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          For a quick one-off correction. Enter a new quantity only for ingredients that changed — leave the rest blank and they won't be touched. Enter 0 if none are left.
          For a full plant recount, use <strong>Download Count Sheet</strong> to print a blank sheet, then <strong>Upload Excel</strong> once it's filled in.
        </p>
        <div>
          <Label className="text-xs">Count Date</Label>
          <Input
            type="date"
            value={countDate}
            onChange={(e) => setCountDate(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="max-h-96 overflow-y-auto border rounded">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Ingredient</TableHead><TableHead>System Qty</TableHead><TableHead>Counted Qty</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.ingredient_name}>
                  <TableCell className="font-medium">{row.ingredient_name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.qty_on_hand > 0 ? `${row.qty_on_hand} ${row.unit}` : "—"}</TableCell>
                  <TableCell>
                    <Input
                      type="number" min={0} step={0.01}
                      value={counts[row.ingredient_name] ?? ""}
                      onChange={(e) => setCount(row.ingredient_name, e.target.value)}
                      className="w-28 h-8"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving} onClick={confirmRecount} className="bg-[#C89B3C] hover:bg-[#B8892C]">
            {saving ? "Saving…" : "Save Adjustments"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Adjustment {
  id: string;
  previous_qty: number;
  counted_qty: number;
  source: string;
  note: string | null;
  adjusted_at: string;
}

export function AdjustmentHistoryPopover({ clientId, ingredientName }: { clientId: string; ingredientName: string }) {
  const [adjustments, setAdjustments] = useState<Adjustment[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory_tolling_adjustments")
      .select("id, previous_qty, counted_qty, source, note, adjusted_at")
      .eq("client_id", clientId)
      .ilike("ingredient_name", ingredientName)
      .order("adjusted_at", { ascending: false })
      .limit(20);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setAdjustments(data ?? []);
  };

  return (
    <Popover onOpenChange={(o) => o && !adjustments && load()}>
      <PopoverTrigger asChild>
        <button className="opacity-0 group-hover:opacity-100 p-1 rounded text-[hsl(var(--tp-text-dim))] hover:text-[hsl(var(--tp-text))] transition-opacity">
          <History className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs">
        <div className="font-semibold mb-2">{ingredientName} — adjustment history</div>
        {loading && <div className="text-muted-foreground">Loading…</div>}
        {!loading && adjustments?.length === 0 && <div className="text-muted-foreground">No adjustments recorded.</div>}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {adjustments?.map((a) => (
            <div key={a.id} className="border-b border-[hsl(var(--tp-hairline))] pb-1.5 last:border-0">
              <div className="flex justify-between">
                <span>{a.previous_qty} → <span className="font-medium">{a.counted_qty}</span></span>
                <span className="text-muted-foreground">{a.source === "excel_import" ? "Import" : "Recount"}</span>
              </div>
              <div className="text-muted-foreground">{new Date(a.adjusted_at).toLocaleString()}{a.note ? ` · ${a.note}` : ""}</div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Duplicate detection (fuzzy name matching, review-only — never auto-applies) ──────

// Common food-processing/packaging descriptors that show up across many unrelated
// ingredients — never treat these alone as evidence two rows are the same item.
// Deliberately excludes "raw"/"cooked" — in food inventory those mark genuinely
// different SKUs (different yield/moisture), not interchangeable descriptors.
const STOPWORDS = new Set([
  "the", "and", "for", "with", "of",
  "organic", "powder", "powdered", "ground", "dried", "branded", "retail", "original",
  "natural", "chopped", "fine", "coarse", "large", "small", "case", "cases", "master", "type", "protein", "patties",
]);

function isNumericToken(w: string) {
  return /^\d+$/.test(w);
}

function allWords(name: string): string[] {
  return normalizeHeader(name)
    .split(" ")
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w) && !isNumericToken(w));
}

// Words that actually distinguish one ingredient from another. Short, common
// descriptors ("rice", "cook", "pea") are excluded so they don't cause unrelated
// items to match just because they share one generic word (e.g. "Rice Oil" vs.
// every other rice-containing ingredient).
function significantWords(name: string): string[] {
  return allWords(name).filter((w) => w.length >= 3);
}

function similarityScore(a: string, b: string): number {
  // Same words, just reordered/re-punctuated (e.g. "Rice Oil" vs "Oil, Rice") — certain match.
  const setA = new Set(allWords(a));
  const setB = new Set(allWords(b));
  if (setA.size > 0 && setA.size === setB.size && [...setA].every((w) => setB.has(w))) return 1;

  const sigA = new Set(significantWords(a));
  const sigB = new Set(significantWords(b));
  const shared = [...sigA].filter((w) => sigB.has(w));
  if (shared.length === 0) return 0;
  // A single shared word is only a strong signal if it's long/specific (e.g. "carrageenan",
  // "methylcellulose") — short shared words are too generic to mean much on their own.
  if (shared.length === 1) return shared[0].length >= 7 ? 0.9 : 0;
  const union = sigA.size + sigB.size - shared.length;
  return union === 0 ? 0 : shared.length / union;
}

// Recipe ingredients are read live from batch_sheets.data_json on every load, so
// renaming/merging one only in inventory_tolling doesn't stick — the old name
// reappears verbatim on the next load. This rewrites the ingredient's name inside
// every batch sheet it actually came from.
async function renameRecipeIngredientInBatchSheets(sheetIds: string[], oldName: string, newName: string): Promise<{ error?: string }> {
  const oldKey = oldName.trim().toLowerCase();
  for (const sheetId of sheetIds) {
    const { data, error: fetchError } = await supabase
      .from("batch_sheets")
      .select("data_json")
      .eq("id", sheetId)
      .single();
    if (fetchError) return { error: fetchError.message };

    const dataJson = (data?.data_json as any) ?? {};
    const ingredients: any[] = dataJson.recipe?.ingredients ?? [];
    let changed = false;
    const updated = ingredients.map((ing) => {
      if (ing?.name && ing.name.trim().toLowerCase() === oldKey) {
        changed = true;
        return { ...ing, name: newName };
      }
      return ing;
    });
    if (!changed) continue;

    const { error: updateError } = await supabase
      .from("batch_sheets")
      .update({ data_json: { ...dataJson, recipe: { ...dataJson.recipe, ingredients: updated } } })
      .eq("id", sheetId);
    if (updateError) return { error: updateError.message };
  }
  return {};
}

// Merges `source` into `keep`: keep's name survives, source's qty/lot/expiry
// overwrite keep's, source's adjustment history is re-pointed (not lost), and
// the source row is deleted. Used by both the auto-suggested duplicate review
// and the manual "Merge with..." picker — manual merge never runs a similarity
// score, the manager just names the two rows that should become one.
// If `source` is recipe-sourced, its name is also rewritten inside the batch
// sheet(s) it came from — otherwise it would reappear unchanged on next load.
export async function mergeTollingRows(clientId: string, keep: TollingRowLite, source: TollingRowLite): Promise<{ error?: string }> {
  if (source.fromBatchSheet && source.batchSheetIds?.length) {
    const { error } = await renameRecipeIngredientInBatchSheets(source.batchSheetIds, source.ingredient_name, keep.ingredient_name);
    if (error) return { error };
  }

  const { data: userData } = await supabase.auth.getUser();
  const adjustedBy = userData?.user?.id ?? null;

  let targetId = keep.id ?? null;
  const payload = {
    client_id: clientId,
    ingredient_name: keep.ingredient_name,
    qty_on_hand: source.qty_on_hand,
    unit: source.unit || keep.unit,
    lot_code: source.lot_code,
    expiry_date: source.expiry_date,
    updated_at: new Date().toISOString(),
  };

  if (targetId) {
    const { error } = await supabase.from("inventory_tolling").update(payload).eq("id", targetId);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("inventory_tolling").insert(payload).select("id").single();
    if (error) return { error: error.message };
    targetId = data?.id ?? null;
  }

  if (source.qty_on_hand !== keep.qty_on_hand) {
    await supabase.from("inventory_tolling_adjustments").insert({
      tolling_id: targetId,
      client_id: clientId,
      ingredient_name: keep.ingredient_name,
      previous_qty: keep.qty_on_hand,
      counted_qty: source.qty_on_hand,
      source: "recount",
      note: `Merged from duplicate entry "${source.ingredient_name}"`,
      adjusted_by: adjustedBy,
    });
  }

  if (source.id) {
    await supabase.from("inventory_tolling_adjustments")
      .update({ ingredient_name: keep.ingredient_name, tolling_id: targetId })
      .eq("tolling_id", source.id);
    await supabase.from("inventory_tolling").delete().eq("id", source.id);
  }

  return {};
}

export interface DuplicatePair {
  a: TollingRowLite;
  b: TollingRowLite;
  score: number;
}

const DUPLICATE_SCORE_THRESHOLD = 0.55;

export function findDuplicateCandidates(rows: TollingRowLite[]): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (a.ingredient_name.toLowerCase().trim() === b.ingredient_name.toLowerCase().trim()) continue;
      if (a.category && b.category && a.category !== b.category) continue; // different material categories can't be the same item
      const score = similarityScore(a.ingredient_name, b.ingredient_name);
      if (score >= DUPLICATE_SCORE_THRESHOLD) pairs.push({ a, b, score });
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

export function TollingDuplicateReviewDialog({
  open,
  onOpenChange,
  clientId,
  rows,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  rows: TollingRowLite[];
  onComplete: () => void;
}) {
  const candidates = useMemo(() => (open ? findDuplicateCandidates(rows) : []), [open, rows]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [dismissedLoaded, setDismissedLoaded] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);
  // Per-pair override of which row's name should survive the merge (defaults to the batch-sheet/canonical name).
  const [keepChoice, setKeepChoice] = useState<Record<string, "a" | "b">>({});

  // Order-independent so a dismissal sticks regardless of which row sorts first.
  const pairKey = (p: DuplicatePair) => [p.a.ingredient_name, p.b.ingredient_name].sort().join("|");

  useEffect(() => {
    if (!open) { setDismissedLoaded(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from("inventory_tolling_dismissed_duplicates")
        .select("name_a, name_b")
        .eq("client_id", clientId);
      if (error) { toast.error(error.message); return; }
      setDismissed(new Set((data ?? []).map((d) => [d.name_a, d.name_b].sort().join("|"))));
      setDismissedLoaded(true);
    })();
  }, [open, clientId]);

  const dismiss = async (p: DuplicatePair) => {
    const key = pairKey(p);
    setDismissed((d) => new Set(d).add(key));
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("inventory_tolling_dismissed_duplicates").insert({
      client_id: clientId,
      name_a: p.a.ingredient_name,
      name_b: p.b.ingredient_name,
      dismissed_by: userData?.user?.id ?? null,
    });
    if (error && !error.message.includes("duplicate key")) toast.error(error.message);
  };

  const defaultKeep = (p: DuplicatePair): "a" | "b" => {
    if (p.a.fromBatchSheet && !p.b.fromBatchSheet) return "a";
    if (p.b.fromBatchSheet && !p.a.fromBatchSheet) return "b";
    return "a";
  };

  const merge = async (p: DuplicatePair) => {
    const key = pairKey(p);
    const keep = keepChoice[key] ?? defaultKeep(p);
    const target = keep === "a" ? p.a : p.b;
    const source = keep === "a" ? p.b : p.a;

    setMerging(key);
    const { error } = await mergeTollingRows(clientId, target, source);
    setMerging(null);
    if (error) { toast.error(error); return; }
    toast.success(`Merged into "${target.ingredient_name}"`);
    onComplete();
  };

  const visible = dismissedLoaded ? candidates.filter((p) => !dismissed.has(pairKey(p))) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Review Possible Duplicates</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          These pairs look like they <strong>might</strong> be the same ingredient under different names — this is a name-matching guess, not a certainty, so read both names carefully before merging.
          Nothing is changed until you click Merge. Merging keeps one name (defaulting to the recipe's ingredient name) and applies the other row's quantity/lot/expiry to it, then removes the duplicate.
          "Not a duplicate" is remembered, so dismissed pairs won't show up again.
        </p>
        {!dismissedLoaded && (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        )}
        {dismissedLoaded && visible.length === 0 && (
          <div className="text-sm text-muted-foreground py-6 text-center">No (remaining) possible duplicates found.</div>
        )}
        <div className="space-y-3 max-h-[28rem] overflow-y-auto">
          {visible.map((p) => {
            const key = pairKey(p);
            const keep = keepChoice[key] ?? defaultKeep(p);
            return (
              <div key={key} className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Name similarity: {Math.round(p.score * 100)}% — not a guarantee, please verify</span>
                  <button className="underline" onClick={() => dismiss(p)}>Not a duplicate</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[{ row: p.a, side: "a" as const }, { row: p.b, side: "b" as const }].map(({ row, side }) => (
                    <label
                      key={side}
                      className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${keep === side ? "border-[hsl(var(--tp-gold))] bg-[hsl(var(--tp-gold-glow))]" : "border-[hsl(var(--tp-hairline))]"}`}
                    >
                      <input
                        type="radio"
                        className="mt-1"
                        checked={keep === side}
                        onChange={() => setKeepChoice((c) => ({ ...c, [key]: side }))}
                      />
                      <div className="text-sm">
                        <div className="font-medium">{row.ingredient_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.qty_on_hand > 0 ? `${row.qty_on_hand} ${row.unit}` : "—"}
                          {row.fromBatchSheet ? " · recipe ingredient" : ""}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button size="sm" disabled={merging === key} onClick={() => merge(p)} className="bg-[#C89B3C] hover:bg-[#B8892C]">
                    <GitMerge className="w-3.5 h-3.5 mr-1.5" />
                    {merging === key ? "Merging…" : `Merge, keep "${keep === "a" ? p.a.ingredient_name : p.b.ingredient_name}"`}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manual merge (manager-driven, no scoring) ─────────────────────────────
// Lets the manager pick any two rows and merge them, regardless of what the
// fuzzy matcher above would or wouldn't flag. This is the authoritative path:
// the manager is the one deciding two rows are the same product, never the algorithm.

export function TollingManualMergeDialog({
  open,
  onOpenChange,
  clientId,
  row,
  allRows,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  row: TollingRowLite | null;
  allRows: TollingRowLite[];
  onComplete: () => void;
}) {
  const [targetName, setTargetName] = useState<string>("");
  const [keepSide, setKeepSide] = useState<"row" | "target">("row");
  const [merging, setMerging] = useState(false);

  const options = useMemo(
    () => (row ? allRows.filter((r) => r.ingredient_name !== row.ingredient_name) : []),
    [row, allRows]
  );
  const target = options.find((r) => r.ingredient_name === targetName) ?? null;

  const confirmMerge = async () => {
    if (!row || !target) return;
    const keep = keepSide === "row" ? row : target;
    const source = keepSide === "row" ? target : row;
    setMerging(true);
    const { error } = await mergeTollingRows(clientId, keep, source);
    setMerging(false);
    if (error) { toast.error(error); return; }
    toast.success(`Merged into "${keep.ingredient_name}"`);
    setTargetName("");
    setKeepSide("row");
    onOpenChange(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setTargetName(""); setKeepSide("row"); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Merge "{row?.ingredient_name}" with…</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Pick the other row that's actually the same product. This always merges exactly what you choose — there's no matching guess involved.
          Merging combines quantity/lot/expiry into one row (under whichever name you keep below) and removes the other.
        </p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Merge with</Label>
            <select
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              className="w-full h-9 rounded border border-[hsl(var(--tp-hairline))] bg-background px-2 text-sm focus:border-[hsl(var(--tp-gold))] outline-none"
            >
              <option value="">Select an item…</option>
              {options.map((r) => (
                <option key={r.ingredient_name} value={r.ingredient_name}>
                  {r.ingredient_name}{r.fromBatchSheet ? " (recipe)" : ""}
                </option>
              ))}
            </select>
          </div>
          {row && target && (
            <div>
              <Label className="text-xs">Keep this name</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[{ side: "row" as const, label: row.ingredient_name }, { side: "target" as const, label: target.ingredient_name }].map(({ side, label }) => (
                  <label
                    key={side}
                    className={`flex items-start gap-2 p-2 rounded border cursor-pointer text-sm ${keepSide === side ? "border-[hsl(var(--tp-gold))] bg-[hsl(var(--tp-gold-glow))]" : "border-[hsl(var(--tp-hairline))]"}`}
                  >
                    <input type="radio" className="mt-1" checked={keepSide === side} onChange={() => setKeepSide(side)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!target || merging} onClick={confirmMerge} className="bg-[#C89B3C] hover:bg-[#B8892C]">
            <GitMerge className="w-3.5 h-3.5 mr-1.5" />
            {merging ? "Merging…" : "Merge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { Upload, ClipboardList };
