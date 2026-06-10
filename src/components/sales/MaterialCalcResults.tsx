import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Package, RefreshCw } from "lucide-react";
import type { MaterialCalcJson, ProductCalc } from "@/lib/materialCalc";

interface Props {
  calc: MaterialCalcJson;
  onRerun?: () => void;
  rerunning?: boolean;
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ProductRow({ p }: { p: ProductCalc }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[hsl(var(--tp-hairline))] rounded">
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-[hsl(var(--tp-surface-hover),0.5)]"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-medium text-[hsl(var(--tp-text))]">{p.product_name}</span>
        <span className="flex items-center gap-3 text-xs text-[hsl(var(--tp-text-dim))]">
          <span>{p.order_qty} {p.order_unit} · {fmt(p.production_lbs)} lbs to produce</span>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-[hsl(var(--tp-hairline))]">
          {p.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 flex items-center gap-1 mt-2">
              <AlertTriangle className="w-3 h-3 shrink-0" /> {w}
            </p>
          ))}

          {p.ingredients.length > 0 && (
            <table className="w-full text-xs mt-2">
              <thead>
                <tr className="text-[hsl(var(--tp-text-dim))] uppercase tracking-wider text-[10px]">
                  <th className="text-left pb-1.5">Ingredient</th>
                  <th className="text-right pb-1.5">%</th>
                  <th className="text-right pb-1.5">Need (lbs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--tp-hairline))]">
                {p.ingredients.map((ing, i) => (
                  <tr key={i}>
                    <td className="py-1.5 text-[hsl(var(--tp-text))]">{ing.name}</td>
                    <td className="py-1.5 text-right text-[hsl(var(--tp-text-dim))] tabular-nums">{ing.percentage.toFixed(1)}%</td>
                    <td className="py-1.5 text-right text-[hsl(var(--tp-text))] tabular-nums font-medium">{fmt(ing.need_lbs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="flex gap-4 text-xs text-[hsl(var(--tp-text-dim))] pt-1 flex-wrap">
            <span>Primary packs: <strong className="text-[hsl(var(--tp-text))]">{p.packaging.primary_packs.toLocaleString()}</strong></span>
            {p.packaging.secondary_packs !== null && (
              <span>Secondary: <strong className="text-[hsl(var(--tp-text))]">{p.packaging.secondary_packs.toLocaleString()}</strong></span>
            )}
            <span>Shipper cases: <strong className="text-[hsl(var(--tp-text))]">{p.packaging.shipper_cases.toLocaleString()}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

export function MaterialCalcResults({ calc, onRerun, rerunning }: Props) {
  const shortfalls = calc.summary.ingredients.filter((i) => i.shortfall);
  const totalNeed = calc.summary.ingredients.reduce((s, i) => s + i.total_need_lbs, 0);
  const totalOnHand = calc.summary.ingredients.reduce((s, i) => s + i.on_hand_lbs, 0);
  const totalToBuy = calc.summary.ingredients.reduce((s, i) => s + i.to_buy_lbs, 0);

  return (
    <div className="space-y-4">
      {/* Sub-header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--tp-text-dim))]">
          Estimated {new Date(calc.calculated_at).toLocaleString()}
        </p>
        {shortfalls.length > 0 ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5" /> {shortfalls.length} shortfall{shortfalls.length !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> All ingredients on hand
          </span>
        )}
      </div>

      {/* Two-column layout: ingredient table + right panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-start">

        {/* Ingredient table — compact, not full-width */}
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse" style={{ minWidth: 360 }}>
            <thead>
              <tr className="border-b border-[hsl(var(--tp-hairline))]">
                <th className="text-left pb-2 pr-8 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold">
                  Ingredient
                </th>
                <th className="text-right pb-2 pr-6 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold whitespace-nowrap">
                  Need (lbs)
                </th>
                <th className="text-right pb-2 pr-6 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold whitespace-nowrap">
                  On Hand
                </th>
                <th className="text-right pb-2 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold whitespace-nowrap">
                  To Buy
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--tp-hairline))]">
              {calc.summary.ingredients.map((ing, i) => (
                <tr key={i}>
                  <td className="py-2 pr-8 text-[hsl(var(--tp-text))] font-medium">{ing.name}</td>
                  <td className={`py-2 pr-6 text-right tabular-nums ${ing.shortfall ? "text-amber-700 font-semibold" : "text-[hsl(var(--tp-text-dim))]"}`}>
                    {fmt(ing.total_need_lbs)}
                  </td>
                  <td className="py-2 pr-6 text-right tabular-nums text-[hsl(var(--tp-text-dim))]">
                    {fmt(ing.on_hand_lbs)}
                  </td>
                  <td className={`py-2 text-right tabular-nums font-semibold ${ing.shortfall ? "text-amber-700" : "text-[hsl(var(--tp-text-dim))]"}`}>
                    {ing.shortfall ? fmt(ing.to_buy_lbs) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[hsl(var(--tp-hairline))]">
                <td className="pt-2 pr-8 text-xs font-bold uppercase tracking-wider text-[hsl(var(--tp-text))]">Total</td>
                <td className="pt-2 pr-6 text-right tabular-nums font-bold text-[hsl(var(--tp-text))]">{fmt(totalNeed)}</td>
                <td className="pt-2 pr-6 text-right tabular-nums font-bold text-[hsl(var(--tp-text))]">{fmt(totalOnHand)}</td>
                <td className={`pt-2 text-right tabular-nums font-bold ${totalToBuy > 0 ? "text-amber-700" : "text-[hsl(var(--tp-text-dim))]"}`}>
                  {totalToBuy > 0 ? fmt(totalToBuy) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Right panel: packaging + per-product breakdown */}
        <div className="space-y-4 min-w-[220px]">
          {/* Packaging totals */}
          <div className="p-4 rounded border border-[hsl(var(--tp-hairline))] space-y-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Packaging
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-6">
                <span className="text-[hsl(var(--tp-text-dim))]">Primary packs</span>
                <span className="font-semibold text-[hsl(var(--tp-text))] tabular-nums">{calc.summary.total_primary_packs.toLocaleString()}</span>
              </div>
              {calc.summary.total_secondary_packs !== null && (
                <div className="flex justify-between gap-6">
                  <span className="text-[hsl(var(--tp-text-dim))]">Secondary</span>
                  <span className="font-semibold text-[hsl(var(--tp-text))] tabular-nums">{calc.summary.total_secondary_packs.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between gap-6">
                <span className="text-[hsl(var(--tp-text-dim))]">Shipper cases</span>
                <span className="font-semibold text-[hsl(var(--tp-text))] tabular-nums">{calc.summary.total_shipper_cases.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Per-product breakdown — only shown for multi-product orders */}
          {calc.products.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold">Per Product</p>
              {calc.products.map((p) => (
                <ProductRow key={p.product_id} p={p} />
              ))}
            </div>
          )}
          {/* Single-product calc breakdown */}
          {calc.products.length === 1 && (() => {
            const p = calc.products[0];
            return (
              <div className="p-4 rounded border border-[hsl(var(--tp-hairline))] space-y-1.5 text-sm">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold mb-2">Calculation breakdown</p>
                <div className="flex justify-between gap-4">
                  <span className="text-[hsl(var(--tp-text-dim))]">Order qty</span>
                  <span className="font-semibold text-[hsl(var(--tp-text))] tabular-nums">{p.order_qty} {p.order_unit}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[hsl(var(--tp-text-dim))]">Units to make</span>
                  <span className="font-semibold text-[hsl(var(--tp-text))] tabular-nums">{p.units_to_make.toLocaleString()}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[hsl(var(--tp-text-dim))]">Finished lbs</span>
                  <span className="font-semibold text-[hsl(var(--tp-text))] tabular-nums">{fmt(p.finished_lbs)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[hsl(var(--tp-text-dim))]">Waste %</span>
                  <span className="font-semibold text-[hsl(var(--tp-text))] tabular-nums">{p.waste_pct_used}%</span>
                </div>
                {p.formula_total_pct != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-[hsl(var(--tp-text-dim))]">Formula total (stored)</span>
                    <span className={`font-semibold tabular-nums ${Math.abs(p.formula_total_pct - 100) > 0.1 ? "text-amber-600" : "text-[hsl(var(--tp-text))]"}`}>
                      {p.formula_total_pct.toFixed(2)}%
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-4 border-t border-[hsl(var(--tp-hairline))] pt-1.5">
                  <span className="text-[hsl(var(--tp-text-dim))]">Production lbs</span>
                  <span className="font-bold text-[hsl(var(--tp-text))] tabular-nums">{fmt(p.production_lbs)}</span>
                </div>
                <p className="text-[10px] text-[hsl(var(--tp-text-dim))] pt-1">Batch sheet v{p.batch_sheet_version}</p>
                {p.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-700 flex items-center gap-1 pt-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" /> {w}
                  </p>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Re-run button at bottom */}
      {onRerun && (
        <div className="flex justify-end pt-2 border-t border-[hsl(var(--tp-hairline))]">
          <button
            onClick={onRerun}
            disabled={rerunning}
            className="flex items-center gap-1.5 text-xs text-[hsl(var(--tp-text-dim))] hover:text-[hsl(var(--tp-text))] disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rerunning ? "animate-spin" : ""}`} />
            {rerunning ? "Recalculating…" : "Re-run estimate"}
          </button>
        </div>
      )}
    </div>
  );
}
