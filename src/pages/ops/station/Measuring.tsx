import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { VirtualKeyboard } from "@/components/ops/VirtualKeyboard";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Scan, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  product_id: string;
  product_name: string;
  batch_sheet_id?: string;
  qty: number;
  unit: string;
}

interface Order {
  id: string;
  items: OrderItem[];
  batch_count: number | null;
  batch_size_lbs: number | null;
  client_id: string;
  order_type: string | null;
  order_number: string | null;
}

interface BatchInfo {
  id: string;
  lotCode: string;
  sizePerBatch: number;
}

interface IngRow {
  name: string;
  step: number | null;
  targetPerBatch: number;
  brand: string;
  lotCode: string;
  batches: Array<{
    batchId: string;
    actual: string;
    signedOff: boolean;
    entryId?: string;
  }>;
}

interface Additive {
  name: string;
  pct_of_batch: number;
}

// ─── Barcode parser ────────────────────────────────────────────────────────────
// Handles GS1-128 (bracketed or raw) and plain UPC/EAN
function parseBarcode(raw: string): { gtin?: string; lotCode?: string } {
  // Bracketed: (01)12345678901234(10)LOTABC
  const bracketed = raw.match(/\(01\)(\d{14}).*?\(10\)([^(]+)/i);
  if (bracketed) return { gtin: bracketed[1], lotCode: bracketed[2].trim() };

  // Raw GS1-128: starts with 01 + 14 digits
  if (/^01\d{14}/.test(raw)) {
    const gtin = raw.substring(2, 16);
    const rest = raw.substring(16);
    // AI 10 = lot code, terminated by FNC1 (x1d) or end
    const lotMatch = rest.match(/^10([^\x1d]{1,20})/);
    return { gtin, lotCode: lotMatch?.[1] };
  }

  // Plain UPC-A (12) or EAN-13 (13)
  if (/^\d{12,13}$/.test(raw)) return { gtin: raw };

  return {};
}

// ─── Unit weight helper ───────────────────────────────────────────────────────
function toUnitWeightLbs(raw: number, unit: string): number {
  const u = (unit || "g").toLowerCase().trim();
  if (u === "g") return raw / 453.592;
  if (u === "oz") return raw / 16;
  return raw;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MeasuringStation() {
  const { orderId } = useParams();

  const [order, setOrder] = useState<Order | null>(null);
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [rows, setRows] = useState<IngRow[]>([]);
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [additives, setAdditives] = useState<Additive[]>([]);
  const [stepLabels, setStepLabels] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Active cell
  const [activeRowIdx, setActiveRowIdx] = useState<number | null>(null);
  const [activeBatchIdx, setActiveBatchIdx] = useState<number | null>(null);
  const [kbValue, setKbValue] = useState("");

  // Inline text editing (brand / lot code)
  const [editCell, setEditCell] = useState<{ rowIdx: number; field: "brand" | "lotCode" } | null>(null);
  const [editText, setEditText] = useState("");
  const textRef = useRef<HTMLInputElement>(null);

  // Barcode scanner (keyboard-wedge)
  const scanBuf = useRef("");
  const scanTimer = useRef<number>();

  // ── Load order ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("production_orders")
        .select("id, items, batch_count, batch_size_lbs, client_id, order_type, order_number")
        .eq("id", orderId)
        .maybeSingle();
      if (!data) { setLoading(false); return; }
      setOrder(data as Order);
      const first = (data.items as OrderItem[]).find((i: OrderItem) => i.batch_sheet_id)
        ?? (data.items as OrderItem[])[0];
      setSelectedItem(first ?? null);
    })();
  }, [orderId]);

  // ── Build rows when item is selected ────────────────────────────────────────
  useEffect(() => {
    if (!selectedItem || !order) return;
    setLoading(true);
    setRows([]);
    setBatches([]);
    setSessionId(null);
    setActiveRowIdx(null);
    setActiveBatchIdx(null);

    (async () => {
      const sheetId = selectedItem.batch_sheet_id;
      if (!sheetId) {
        toast.error("No batch sheet linked to this product");
        setLoading(false);
        return;
      }

      // 1. Load batch sheet
      const { data: sheet } = await (supabase as any)
        .from("batch_sheets")
        .select("id, version, data_json")
        .eq("id", sheetId)
        .maybeSingle();
      if (!sheet) { toast.error("Batch sheet not found"); setLoading(false); return; }

      const ingredients: any[] = sheet.data_json?.recipe?.ingredients ?? [];
      const sheetAdditives: Additive[] = sheet.data_json?.production_notes?.production_additives ?? [];
      setAdditives(sheetAdditives);

      // Build step # → "Step N · Station" label from processing specs
      const specs: any[] = sheet.data_json?.process?.specifications ?? [];
      const labels = new Map<number, string>();
      specs.forEach((s: any, idx: number) => {
        const num = s.step ?? idx + 1;
        const station = s.station ? ` · ${s.station}` : "";
        labels.set(num, `Step ${num}${station}`);
      });
      setStepLabels(labels);
      const batchCount = order.batch_count ?? 1;

      // 2. Ensure production_batches rows exist for this order + batch_sheet
      const { data: existing } = await (supabase as any)
        .from("production_batches")
        .select("id, lot_code, target_batch_size_lbs")
        .eq("order_id", orderId)
        .eq("batch_sheet_id", sheetId);

      let currentBatches: BatchInfo[] = (existing ?? []).map((b: any) => ({
        id: b.id,
        lotCode: b.lot_code ?? "",
        sizePerBatch: b.target_batch_size_lbs as number,
      }));

      if (currentBatches.length < batchCount) {
        const needed = batchCount - currentBatches.length;
        // Fallback size: use existing rows' size if available, otherwise order-level field
        const fallbackSize = currentBatches[0]?.sizePerBatch ?? order.batch_size_lbs ?? 110;
        const insertRows = Array.from({ length: needed }, () => ({
          product_name: selectedItem.product_name,
          batch_date: new Date().toISOString().slice(0, 10),
          target_batch_size_lbs: fallbackSize,
          status: "Scheduled",
          order_id: orderId,
          batch_sheet_id: sheetId,
        }));
        const { data: created } = await (supabase as any)
          .from("production_batches")
          .insert(insertRows)
          .select("id, lot_code");
        currentBatches = [
          ...currentBatches,
          ...(created ?? []).map((b: any) => ({
            id: b.id,
            lotCode: b.lot_code ?? "",
            sizePerBatch: b.target_batch_size_lbs as number,
          })),
        ];
      }
      setBatches(currentBatches);

      // 3. Load or create measuring session (keyed by order + sheet + date)
      const today = new Date().toISOString().slice(0, 10);
      let sId: string | null = null;
      const { data: existingSession } = await (supabase as any)
        .from("batch_measuring_sessions")
        .select("id")
        .eq("order_id", orderId)
        .eq("batch_sheet_id", sheetId)
        .eq("session_date", today)
        .maybeSingle();

      if (existingSession) {
        sId = existingSession.id;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: newSess } = await (supabase as any)
          .from("batch_measuring_sessions")
          .insert({
            order_id: orderId,
            batch_sheet_id: sheetId,
            batch_ids: currentBatches.map(b => b.id),
            session_date: today,
            created_by: user?.id ?? null,
          })
          .select("id")
          .single();
        sId = newSess?.id ?? null;
      }
      setSessionId(sId);

      // 4. Load existing entries to resume a session
      const entryKey = (ingName: string, batchId: string) => `${ingName}::${batchId}`;
      const entryMap = new Map<string, any>();
      if (sId) {
        const { data: entries } = await (supabase as any)
          .from("batch_measuring_entries")
          .select("*")
          .eq("session_id", sId);
        for (const e of entries ?? []) {
          entryMap.set(entryKey(e.ingredient_name, e.batch_id), e);
        }
      }

      // 5. Build rows — use actual batch size from rows (batch_count × size = production_lbs exactly)
      // All batches for the same product have the same target_batch_size_lbs
      const actualBatchSize = currentBatches[0]?.sizePerBatch ?? order.batch_size_lbs ?? 110;

      const built: IngRow[] = ingredients
        .filter(ing => ing.name && Number(ing.percentage) > 0)
        .map(ing => {
          const pct = Number(ing.percentage) / 100;
          const targetPerBatch = Math.round(pct * actualBatchSize * 1000) / 1000;

          // Pull brand/lot code from any existing entry for this ingredient
          let brand = "";
          let lotCode = "";
          for (const b of currentBatches) {
            const e = entryMap.get(entryKey(ing.name, b.id));
            if (e?.ingredient_brand) brand = e.ingredient_brand;
            if (e?.ingredient_lot_code) lotCode = e.ingredient_lot_code;
          }

          const batchCols = currentBatches.map(b => {
            const e = entryMap.get(entryKey(ing.name, b.id));
            return {
              batchId: b.id,
              actual: e?.actual_weight_lbs != null ? String(e.actual_weight_lbs) : "",
              signedOff: !!(e?.actual_weight_lbs && e.actual_weight_lbs > 0),
              entryId: e?.id as string | undefined,
            };
          });

          return { name: ing.name, step: ing.step ?? null, targetPerBatch, brand, lotCode, batches: batchCols };
        });

      setRows(built);
      // Auto-focus first incomplete row
      const firstIncomplete = built.findIndex(r => !r.batches.every(b => b.signedOff));
      setActiveRowIdx(firstIncomplete >= 0 ? firstIncomplete : null);
      setLoading(false);
    })();
  }, [selectedItem, order, orderId]);

  // ── Barcode scanner listener ─────────────────────────────────────────────────
  const handleScan = useCallback(async (raw: string) => {
    if (activeRowIdx === null) {
      toast("Select an ingredient row first, then scan");
      return;
    }
    const { gtin, lotCode } = parseBarcode(raw);

    let brandName = "";
    if (gtin) {
      const { data: known } = await (supabase as any)
        .from("ingredient_barcodes")
        .select("brand_name")
        .eq("barcode", gtin)
        .maybeSingle();

      if (known?.brand_name) {
        brandName = known.brand_name;
      } else {
        // Save new barcode — brand name defaults to empty, user can update
        brandName = "";
        await (supabase as any)
          .from("ingredient_barcodes")
          .insert({ barcode: gtin, brand_name: "" })
          .select()
          .maybeSingle();
        toast.info("New barcode registered — enter brand name");
      }
    }

    setRows(prev => prev.map((r, i) => {
      if (i !== activeRowIdx) return r;
      return {
        ...r,
        brand: brandName || r.brand,
        lotCode: lotCode ?? r.lotCode,
      };
    }));

    if (lotCode) {
      toast.success("Brand + lot code captured from scan");
    } else {
      toast("Barcode scanned — enter lot code");
    }
  }, [activeRowIdx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (editCell) return;

      if (e.key === "Enter") {
        const buf = scanBuf.current;
        scanBuf.current = "";
        clearTimeout(scanTimer.current);
        if (buf.length > 3) handleScan(buf);
        return;
      }
      if (e.key.length === 1) {
        scanBuf.current += e.key;
        clearTimeout(scanTimer.current);
        scanTimer.current = window.setTimeout(() => { scanBuf.current = ""; }, 500);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleScan, editCell]);

  // ── Save a measuring entry ───────────────────────────────────────────────────
  const saveEntry = async (rowIdx: number, batchIdx: number, actualLbs: number) => {
    if (!sessionId) return;
    const row = rows[rowIdx];
    const batchCol = row.batches[batchIdx];
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      ingredient_brand: row.brand,
      ingredient_lot_code: row.lotCode,
      target_weight_lbs: row.targetPerBatch,
      actual_weight_lbs: actualLbs,
      measured_by: user?.id ?? null,
      measured_at: new Date().toISOString(),
    };

    if (batchCol.entryId) {
      await (supabase as any)
        .from("batch_measuring_entries")
        .update(payload)
        .eq("id", batchCol.entryId);
    } else {
      const { data: newEntry } = await (supabase as any)
        .from("batch_measuring_entries")
        .insert({
          ...payload,
          session_id: sessionId,
          batch_id: batchCol.batchId,
          ingredient_name: row.name,
        })
        .select("id")
        .single();
      if (newEntry?.id) {
        setRows(prev => prev.map((r, ri) => ri !== rowIdx ? r : {
          ...r,
          batches: r.batches.map((b, bi) => bi !== batchIdx ? b : { ...b, entryId: newEntry.id }),
        }));
      }
    }
  };

  // ── Commit weight (number pad Done) ─────────────────────────────────────────
  const commitWeight = async () => {
    if (activeRowIdx === null || activeBatchIdx === null) return;
    const val = parseFloat(kbValue);
    if (isNaN(val) || val <= 0) { toast.error("Enter a valid weight"); return; }
    const row = rows[activeRowIdx];
    if (!row.lotCode) { toast.error("Lot code is required before signing off"); return; }

    setSaving(true);
    await saveEntry(activeRowIdx, activeBatchIdx, val);
    setRows(prev => prev.map((r, ri) => ri !== activeRowIdx ? r : {
      ...r,
      batches: r.batches.map((b, bi) => bi !== activeBatchIdx ? b : {
        ...b, actual: String(val), signedOff: true,
      }),
    }));
    setSaving(false);
    setActiveBatchIdx(null);
    setKbValue("");

    // Auto-advance to next batch or next row
    const updatedRow = rows[activeRowIdx];
    const nextBatch = updatedRow.batches.findIndex((b, bi) => bi > activeBatchIdx && !b.signedOff);
    if (nextBatch >= 0) {
      setActiveBatchIdx(nextBatch);
      setKbValue("");
    } else {
      // Move to next incomplete row
      const nextRow = rows.findIndex((r, ri) => ri > activeRowIdx && !r.batches.every(b => b.signedOff));
      if (nextRow >= 0) setActiveRowIdx(nextRow);
    }
  };

  // ── Commit brand / lot code text ─────────────────────────────────────────────
  const commitText = () => {
    if (!editCell) return;
    const { rowIdx, field } = editCell;
    setRows(prev => prev.map((r, i) => i !== rowIdx ? r : { ...r, [field]: editText.trim() }));
    setEditCell(null);
    setEditText("");
  };

  // ── Update product lot code for a batch ──────────────────────────────────────
  const saveBatchLotCode = async (batchIdx: number, code: string) => {
    const b = batches[batchIdx];
    if (!b) return;
    setBatches(prev => prev.map((x, i) => i === batchIdx ? { ...x, lotCode: code } : x)); // sizePerBatch unchanged
    await (supabase as any)
      .from("production_batches")
      .update({ lot_code: code || null })
      .eq("id", b.id);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  const rowComplete = (r: IngRow) =>
    !!r.brand && !!r.lotCode && r.batches.every(b => b.signedOff);
  const allComplete = rows.length > 0 && rows.every(rowComplete);
  const showKb = activeBatchIdx !== null && activeRowIdx !== null;

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-background text-[hsl(var(--tp-text-dim))] text-sm">
      Loading measuring card…
    </div>
  );

  if (!order) return (
    <div className="h-screen flex items-center justify-center bg-background text-sm text-[hsl(var(--tp-text-dim))]">
      Order not found.
    </div>
  );

  if (!order.batch_count) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-background px-8 text-center">
      <AlertCircle className="w-8 h-8 text-amber-400" />
      <p className="text-[hsl(var(--tp-text))] font-medium">Batch setup not complete</p>
      <p className="text-sm text-[hsl(var(--tp-text-dim))]">
        Set the batch count and batch size before opening station cards.
      </p>
      <Link to={`/team/ops/orders/${orderId}`} className="tp-btn tp-btn-primary text-sm">
        Back to Order
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col select-none">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--tp-hairline))] shrink-0 bg-background">
        <Link
          to={`/team/ops/orders/${orderId}`}
          className="flex items-center gap-1 text-sm text-[hsl(var(--tp-text-dim))] hover:text-[hsl(var(--tp-text))] shrink-0"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        {/* Product picker (multi-product orders) */}
        <div className="flex items-baseline gap-2 min-w-0">
          {order.items.length > 1 ? (
            <select
              value={selectedItem?.product_id ?? ""}
              onChange={e => {
                const item = order.items.find(i => i.product_id === e.target.value);
                if (item) { setSelectedItem(item); setRows([]); setLoading(true); }
              }}
              className="font-semibold bg-transparent text-[hsl(var(--tp-text))] border-none text-base outline-none"
            >
              {order.items.map(item => (
                <option key={item.product_id} value={item.product_id}>{item.product_name}</option>
              ))}
            </select>
          ) : (
            <span className="font-semibold text-[hsl(var(--tp-text))] text-base truncate">
              {selectedItem?.product_name ?? ""}
            </span>
          )}
          {order.order_number && (
            <span className="text-xs font-mono text-[hsl(var(--tp-text-dim))] shrink-0">
              #{order.order_number}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-4 text-sm shrink-0">
          <span className="text-[hsl(var(--tp-text-dim))]">{new Date().toLocaleDateString()}</span>
          <span className="text-[hsl(var(--tp-text-dim))]">
            {order.batch_count} batch{order.batch_count !== 1 ? "es" : ""} × {order.batch_size_lbs} lbs
          </span>
          {allComplete && (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" /> All measured
            </span>
          )}
        </div>
      </div>

      {/* ── Scanner banner ── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--tp-gold))]/8 border-b border-[hsl(var(--tp-gold))]/15 shrink-0">
        <Scan className="w-3.5 h-3.5 text-[hsl(var(--tp-gold))] shrink-0" />
        <span className="text-xs text-[hsl(var(--tp-text-dim))]">
          Highlight a row, then scan ingredient bag — brand and lot code fill automatically
        </span>
      </div>

      {/* ── Batch lot codes ── */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface))] shrink-0 overflow-x-auto">
        <span className="text-[11px] uppercase tracking-widest text-[hsl(var(--tp-text-dim))] shrink-0">
          Product Lot #
        </span>
        {batches.map((b, bi) => (
          <div key={b.id} className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-[hsl(var(--tp-text-dim))]">Batch {bi + 1}</span>
            <input
              value={b.lotCode}
              onChange={e => setBatches(prev => prev.map((x, i) => i === bi ? { ...x, lotCode: e.target.value } : x))}
              onBlur={e => saveBatchLotCode(bi, e.target.value)}
              placeholder="AB-YYYYMMDD-001"
              className="w-36 h-7 rounded border border-[hsl(var(--tp-hairline))] bg-background px-2 text-xs font-mono text-[hsl(var(--tp-text))] focus:border-[hsl(var(--tp-gold))] outline-none"
            />
          </div>
        ))}
      </div>

      {/* ── Measuring table ── */}
      <div className={`flex-1 overflow-auto ${showKb ? "pb-64" : ""}`}>
        <table className="w-full text-sm border-collapse min-w-max">
          <thead>
            <tr className="sticky top-0 z-10 bg-background">
              <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))] font-medium border-b border-[hsl(var(--tp-hairline))] min-w-[160px]">
                Ingredient
              </th>
              <th className="text-right px-3 py-3 text-[11px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))] font-medium border-b border-[hsl(var(--tp-hairline))] min-w-[100px]">
                Target / batch
              </th>
              <th className="text-left px-3 py-3 text-[11px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))] font-medium border-b border-[hsl(var(--tp-hairline))] min-w-[140px]">
                Brand
              </th>
              <th className="text-left px-3 py-3 text-[11px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))] font-medium border-b border-[hsl(var(--tp-hairline))] min-w-[140px]">
                Lot Code <span className="text-red-400 normal-case tracking-normal font-normal">required</span>
              </th>
              {batches.map((_, bi) => (
                <th key={bi} className="text-center px-2 py-3 text-[11px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))] font-medium border-b border-[hsl(var(--tp-hairline))] min-w-[90px]">
                  Batch {bi + 1}
                </th>
              ))}
            </tr>
          </thead>

          {(() => {
            // Group rows by step number; unassigned (null) go last
            const stepNums = Array.from(new Set(rows.map(r => r.step).filter((s): s is number => s !== null))).sort((a, b) => a - b);
            const unassigned = rows.filter(r => r.step === null);
            const grandTarget = rows.reduce((s, r) => s + r.targetPerBatch, 0);

            const renderRow = (row: IngRow, ri: number) => {
              const isActive = ri === activeRowIdx;
              const complete = rowComplete(row);
              return (
                <tr
                  key={row.name}
                  onClick={() => { setActiveRowIdx(ri); if (activeBatchIdx !== null && !showKb) { setActiveBatchIdx(null); setKbValue(""); } }}
                  className={`border-b border-[hsl(var(--tp-hairline))] cursor-pointer transition-colors ${isActive ? "bg-[hsl(var(--tp-gold))]/10" : complete ? "opacity-50 hover:opacity-70" : "hover:bg-[hsl(var(--tp-surface))]"}`}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {complete ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : isActive ? <div className="w-2 h-2 rounded-full bg-[hsl(var(--tp-gold))] shrink-0" /> : <div className="w-4 shrink-0" />}
                      <span className={`font-medium ${complete ? "text-[hsl(var(--tp-text-dim))]" : "text-[hsl(var(--tp-text))]"}`}>{row.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-right font-mono text-[hsl(var(--tp-text-dim))] text-[13px]">{row.targetPerBatch.toFixed(3)} lbs</td>
                  <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
                    {editCell?.rowIdx === ri && editCell.field === "brand" ? (
                      <input ref={textRef} autoFocus value={editText} onChange={e => setEditText(e.target.value)} onBlur={commitText} onKeyDown={e => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setEditCell(null); }} className="w-full bg-transparent border-b-2 border-[hsl(var(--tp-gold))] outline-none text-sm px-1 py-0.5 text-[hsl(var(--tp-text))]" />
                    ) : (
                      <button onClick={() => { setActiveRowIdx(ri); setEditCell({ rowIdx: ri, field: "brand" }); setEditText(row.brand); }} className={`w-full text-left px-2 py-1.5 rounded text-sm min-h-[36px] ${row.brand ? "text-[hsl(var(--tp-text))]" : "text-[hsl(var(--tp-text-dim))] italic"} ${isActive ? "hover:bg-[hsl(var(--tp-gold))]/20" : "hover:bg-[hsl(var(--tp-surface))]"}`}>
                        {row.brand || "Scan or tap to enter"}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
                    {editCell?.rowIdx === ri && editCell.field === "lotCode" ? (
                      <input ref={textRef} autoFocus value={editText} onChange={e => setEditText(e.target.value)} onBlur={commitText} onKeyDown={e => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setEditCell(null); }} className="w-full bg-transparent border-b-2 border-[hsl(var(--tp-gold))] outline-none text-sm px-1 py-0.5 text-[hsl(var(--tp-text))]" />
                    ) : (
                      <button onClick={() => { setActiveRowIdx(ri); setEditCell({ rowIdx: ri, field: "lotCode" }); setEditText(row.lotCode); }} className={`w-full text-left px-2 py-1.5 rounded text-sm min-h-[36px] font-mono ${row.lotCode ? "text-[hsl(var(--tp-text))]" : "text-red-400 italic font-sans"} ${isActive ? "hover:bg-[hsl(var(--tp-gold))]/20" : "hover:bg-[hsl(var(--tp-surface))]"}`}>
                        {row.lotCode || "Required — tap or scan"}
                      </button>
                    )}
                  </td>
                  {row.batches.map((batch, bi) => (
                    <td key={bi} className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                      {batch.signedOff ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span className="text-xs font-mono text-[hsl(var(--tp-text-dim))]">{parseFloat(batch.actual).toFixed(2)}</span>
                        </div>
                      ) : (
                        <button disabled={!row.lotCode || saving} onClick={() => { setActiveRowIdx(ri); setActiveBatchIdx(bi); setKbValue(batch.actual || ""); }} title={!row.lotCode ? "Enter lot code first" : "Tap to enter weight"}
                          className={`w-full h-12 rounded-lg border text-sm font-mono transition-colors ${!row.lotCode ? "opacity-30 cursor-not-allowed border-[hsl(var(--tp-hairline))] text-[hsl(var(--tp-text-dim))]" : isActive && activeBatchIdx === bi ? "border-[hsl(var(--tp-gold))] bg-[hsl(var(--tp-gold))]/15 text-[hsl(var(--tp-text))]" : "border-[hsl(var(--tp-hairline))] text-[hsl(var(--tp-text-dim))] hover:border-[hsl(var(--tp-gold))]/50 hover:bg-[hsl(var(--tp-gold))]/5"}`}>
                          {batch.actual ? parseFloat(batch.actual).toFixed(2) : "—"}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              );
            };

            const colSpan = 4 + batches.length;

            return (
              <>
                {stepNums.map(stepNum => {
                  const stepRows = rows.filter(r => r.step === stepNum);
                  const stepTarget = stepRows.reduce((s, r) => s + r.targetPerBatch, 0);
                  const label = stepLabels.get(stepNum) ?? `Step ${stepNum}`;
                  return (
                    <tbody key={stepNum}>
                      <tr className="bg-[hsl(var(--tp-surface-2))]">
                        <td colSpan={colSpan} className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[hsl(var(--tp-gold))]">
                          {label}
                        </td>
                      </tr>
                      {stepRows.map(row => renderRow(row, rows.indexOf(row)))}
                      <tr className="bg-[hsl(var(--tp-surface-2))] border-t-2 border-[hsl(var(--tp-hairline))]">
                        <td className="px-4 py-2 text-right text-[11px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))]" colSpan={2}>Step total</td>
                        <td colSpan={2} />
                        {batches.map((_, bi) => {
                          const actual = stepRows.reduce((s, r) => s + (parseFloat(r.batches[bi]?.actual || "0") || 0), 0);
                          const allSigned = stepRows.every(r => r.batches[bi]?.signedOff);
                          return (
                            <td key={bi} className="px-2 py-2 text-center font-mono text-xs">
                              <span className={allSigned ? "text-emerald-400 font-semibold" : "text-[hsl(var(--tp-text-dim))]"}>
                                {actual > 0 ? actual.toFixed(3) : "—"}
                              </span>
                              <span className="block text-[10px] text-[hsl(var(--tp-text-dim))]">/ {stepTarget.toFixed(3)}</span>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  );
                })}

                {unassigned.length > 0 && (
                  <tbody>
                    <tr className="bg-amber-500/10">
                      <td colSpan={colSpan} className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-amber-500">
                        ⚠ Unassigned — add step numbers in the batch sheet
                      </td>
                    </tr>
                    {unassigned.map(row => renderRow(row, rows.indexOf(row)))}
                  </tbody>
                )}

                {/* Grand total */}
                <tbody>
                  <tr className="border-t-2 border-[hsl(var(--tp-text))] bg-[hsl(var(--tp-surface-2))]">
                    <td className="px-4 py-3 font-bold text-sm text-[hsl(var(--tp-text))]" colSpan={2}>
                      TOTAL BATCH — {grandTarget.toFixed(3)} lbs
                    </td>
                    <td colSpan={2} />
                    {batches.map((b, bi) => {
                      const actual = rows.reduce((s, r) => s + (parseFloat(r.batches[bi]?.actual || "0") || 0), 0);
                      const diff = actual - grandTarget;
                      const ok = Math.abs(diff) < 0.01;
                      const allSigned = rows.every(r => r.batches[bi]?.signedOff);
                      return (
                        <td key={bi} className="px-2 py-3 text-center">
                          <span className={`font-mono text-sm font-bold ${allSigned && ok ? "text-emerald-400" : allSigned && !ok ? "text-red-400" : "text-[hsl(var(--tp-text-dim))]"}`}>
                            {actual > 0 ? actual.toFixed(3) : "—"}
                          </span>
                          {allSigned && !ok && (
                            <span className="block text-[10px] text-red-400">{diff > 0 ? "+" : ""}{diff.toFixed(3)} lbs</span>
                          )}
                          <span className="block text-[10px] text-[hsl(var(--tp-text-dim))]">Batch {bi + 1}</span>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </>
            );
          })()}

          {/* Production additives — internal only, shown at bottom */}
          {additives.length > 0 && (
            <tbody>
              <tr>
                <td colSpan={4 + batches.length} className="px-4 pt-5 pb-1">
                  <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--tp-text-dim))] font-medium">
                    Production additives — internal use only
                  </p>
                </td>
              </tr>
              {additives.map((a, i) => {
                const upToLbs = ((a.pct_of_batch / 100) * (batches[0]?.sizePerBatch ?? 0));
                return (
                  <tr key={i} className="border-t border-dashed border-[hsl(var(--tp-hairline))]">
                    <td className="px-4 py-3" colSpan={2}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 shrink-0" />
                        <span className="text-sm font-medium text-[hsl(var(--tp-text-dim))]">{a.name}</span>
                      </div>
                    </td>
                    <td colSpan={2 + batches.length} className="px-3 py-3 text-sm text-amber-600 font-medium">
                      Add if necessary — UP TO {upToLbs.toFixed(3)} lbs ({a.pct_of_batch}% of batch)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>

      {/* ── Virtual number pad ── */}
      {showKb && (
        <VirtualKeyboard
          value={kbValue}
          onChange={setKbValue}
          onDone={commitWeight}
          label={`Batch ${(activeBatchIdx ?? 0) + 1} — ${rows[activeRowIdx ?? 0]?.name ?? ""}`}
        />
      )}
    </div>
  );
}
