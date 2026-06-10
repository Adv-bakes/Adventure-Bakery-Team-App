import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IngredientCalc {
  name: string;
  percentage: number;
  need_lbs: number;
}

export interface PackagingCalc {
  primary_packs: number;
  secondary_packs: number | null;
  shipper_cases: number;
  primary_label: string | null;
  secondary_label: string | null;
  shipper_label: string | null;
}

export interface ProductCalc {
  product_id: string;
  product_name: string;
  batch_sheet_id: string;
  batch_sheet_version: number;
  order_qty: number;
  order_unit: "units" | "cases" | "lbs";
  units_to_make: number;
  finished_lbs: number;
  production_lbs: number;
  waste_pct_used: number;
  formula_total_pct: number;
  ingredients: IngredientCalc[];
  packaging: PackagingCalc;
  warnings: string[];
}

export interface SummaryIngredient {
  name: string;
  total_need_lbs: number;
  on_hand_lbs: number;
  to_buy_lbs: number;
  shortfall: boolean;
}

export interface MaterialCalcJson {
  calculated_at: string;
  waste_pct: number;
  order_type: string;
  products: ProductCalc[];
  summary: {
    ingredients: SummaryIngredient[];
    total_primary_packs: number;
    total_secondary_packs: number | null;
    total_shipper_cases: number;
  };
}

// ─── Unit weight helpers ───────────────────────────────────────────────────────

function toUnitWeightLbs(raw: number, unit: string): number {
  const u = (unit || "g").toLowerCase().trim();
  if (u === "g") return raw / 453.592;
  if (u === "oz") return raw / 16;
  return raw; // already lbs
}

// ─── Main calculation function ────────────────────────────────────────────────

export async function runMaterialCalc(
  _orderId: string,
  items: Array<{ product_id: string; product_name?: string; batch_sheet_id?: string; qty: number; unit: "units" | "cases" | "lbs" }>,
  wastePct: number,
  orderType: "jit" | "tolling_warehoused" | "tolling_external" = "jit",
  clientId?: string,
): Promise<MaterialCalcJson> {
  // Fetch batch sheets — prefer direct batch_sheet_id on item, fall back to pss_document_id lookup
  const directIds = items.map(i => i.batch_sheet_id).filter(Boolean) as string[];
  const productIds = items.map(i => i.product_id);

  let sheetMap = new Map<string, any>(); // keyed by product_id

  if (directIds.length) {
    const { data: byId } = await (supabase as any)
      .from("batch_sheets")
      .select("id, version, data_json, status")
      .in("id", directIds);
    const idMap = new Map((byId ?? []).map((s: any) => [s.id, s]));
    for (const item of items) {
      if (item.batch_sheet_id && idMap.has(item.batch_sheet_id)) {
        sheetMap.set(item.product_id, idMap.get(item.batch_sheet_id));
      }
    }
  }

  // For any product still without a sheet, look up via prf_submission → concept_id or lead_id → batch_sheet
  const missing = items.filter(i => !sheetMap.has(i.product_id));
  if (missing.length) {
    const { data: prfRows } = await (supabase as any)
      .from("prf_submissions")
      .select("id, concept_id, lead_id, product_name")
      .in("id", missing.map(i => i.product_id));

    // Path 1: concept_id
    const conceptIds = (prfRows ?? []).map((p: any) => p.concept_id).filter(Boolean);
    const sheetsByConceptId = new Map<number, any>();
    if (conceptIds.length) {
      const { data: sheets } = await (supabase as any)
        .from("batch_sheets")
        .select("id, version, data_json, status, concept_id")
        .in("concept_id", conceptIds)
        .is("superseded_at", null)
        .order("version", { ascending: false });
      for (const s of sheets ?? []) {
        if (!sheetsByConceptId.has(s.concept_id)) sheetsByConceptId.set(s.concept_id, s);
      }
    }

    // Path 2: lead_id (for PRFs without concept_id)
    const leadIds = (prfRows ?? [])
      .filter((p: any) => !p.concept_id || !sheetsByConceptId.has(p.concept_id))
      .map((p: any) => p.lead_id).filter(Boolean);
    const sheetsByLeadId = new Map<string, any[]>();
    if (leadIds.length) {
      const { data: sheets } = await (supabase as any)
        .from("batch_sheets")
        .select("id, version, data_json, status, lead_id")
        .in("lead_id", leadIds)
        .is("superseded_at", null)
        .order("version", { ascending: false });
      for (const s of sheets ?? []) {
        if (!sheetsByLeadId.has(s.lead_id)) sheetsByLeadId.set(s.lead_id, []);
        sheetsByLeadId.get(s.lead_id)!.push(s);
      }
    }

    for (const prf of prfRows ?? []) {
      if (sheetMap.has(prf.id)) continue;
      // Try concept_id first
      if (prf.concept_id && sheetsByConceptId.has(prf.concept_id)) {
        sheetMap.set(prf.id, sheetsByConceptId.get(prf.concept_id));
        continue;
      }
      // Fall back to lead_id + name match
      if (prf.lead_id && sheetsByLeadId.has(prf.lead_id)) {
        const candidates = sheetsByLeadId.get(prf.lead_id)!;
        const name = (prf.product_name || "").toLowerCase().trim();
        const match = candidates.find((s: any) =>
          (s.data_json?.product?.name || "").toLowerCase().trim() === name
        ) ?? candidates[0] ?? null;
        if (match) sheetMap.set(prf.id, match);
      }
    }
  }

  // Product name map — use item.product_name when available, fetch remainder from prf_submissions
  const itemsNeedingName = items.filter(i => !i.product_name);
  let prfNameMap = new Map<string, string>();
  if (itemsNeedingName.length) {
    const { data: prfRows } = await supabase
      .from("prf_submissions")
      .select("id, product_name")
      .in("id", itemsNeedingName.map(i => i.product_id));
    prfNameMap = new Map((prfRows ?? []).map((r: any) => [r.id, r.product_name ?? "(unnamed)"]));
  }

  // Build inventory map based on orderType
  const inventoryMap = new Map<string, number>();
  if (orderType === "jit") {
    const { data: jitRows } = await supabase
      .from("inventory_jit")
      .select("ingredient_name, total_lbs, cases_on_hand, lbs_per_case");
    for (const r of jitRows ?? []) {
      const lbs = (r as any).total_lbs ?? ((r as any).cases_on_hand * (r as any).lbs_per_case);
      const key = (r as any).ingredient_name.toLowerCase().trim();
      inventoryMap.set(key, (inventoryMap.get(key) ?? 0) + lbs);
    }
  } else if (orderType === "tolling_warehoused" && clientId) {
    const { data: tollingRows } = await supabase
      .from("inventory_tolling")
      .select("ingredient_name, qty_on_hand")
      .eq("client_id", clientId);
    for (const r of tollingRows ?? []) {
      const key = (r as any).ingredient_name.toLowerCase().trim();
      inventoryMap.set(key, (inventoryMap.get(key) ?? 0) + (r as any).qty_on_hand);
    }
  }
  // tolling_external: inventoryMap stays empty — no check, list goes to client

  // ─── Per-product calculation ─────────────────────────────────────────────

  const productCalcs: ProductCalc[] = [];

  for (const item of items) {
    const warnings: string[] = [];
    const productName = item.product_name || prfNameMap.get(item.product_id) || "(unknown product)";
    const sheet = sheetMap.get(item.product_id);

    if (!sheet) {
      warnings.push("No approved (final) batch sheet found — product skipped in ingredient totals");
      productCalcs.push({
        product_id: item.product_id,
        product_name: productName,
        batch_sheet_id: "",
        batch_sheet_version: 0,
        order_qty: item.qty,
        order_unit: item.unit,
        units_to_make: 0,
        finished_lbs: 0,
        production_lbs: 0,
        waste_pct_used: wastePct,
        formula_total_pct: 0,
        ingredients: [],
        packaging: { primary_packs: 0, secondary_packs: null, shipper_cases: 0, primary_label: null, secondary_label: null, shipper_label: null },
        warnings,
      });
      continue;
    }

    const d = sheet.data_json ?? {};
    const product = d.product ?? {};
    const packaging = d.packaging ?? {};
    const ingredients: any[] = d.recipe?.ingredients ?? [];

    // Per-product waste % — read from batch sheet, fall back to order-level value
    const productWastePct = d.production_notes?.waste_pct != null
      ? Number(d.production_notes.waste_pct)
      : wastePct;

    // Unit weight
    const rawWeight = Number(product.target_unit_weight_raw) || 0;
    const unitWeightLbs = toUnitWeightLbs(rawWeight, product.weight_unit ?? "g");
    if (!unitWeightLbs) warnings.push("Unit weight is zero — check batch sheet product weight");

    // Packaging field names as saved by BatchSheetEditor:
    //   packaging.primary.units_per_pack          = individual units per primary pack
    //   packaging.secondary.primaries_per_secondary = primary packs per secondary (0 = no secondary tier)
    //   packaging.shipper.secondaries_per_case    = secondaries per case (or primaries per case when no secondary)
    const unitsPerPrimary = Number(packaging.primary?.units_per_pack) || 1;
    const primPerSec      = Number(packaging.secondary?.primaries_per_secondary) || 0;
    const secPerCase      = Number(packaging.shipper?.secondaries_per_case) || 0;
    const hasSecondary    = primPerSec > 0;

    // Total individual units per shipper case
    const unitsPerCase = hasSecondary && secPerCase > 0
      ? secPerCase * primPerSec * unitsPerPrimary  // 3-tier: primary → secondary → case
      : secPerCase > 0
        ? secPerCase * unitsPerPrimary             // 2-tier: primary → case directly
        : unitsPerPrimary;                         // no case info, treat as single primary

    // Units to make + finished lbs
    let unitsToMake: number;
    let finishedLbs: number;
    let shipperCases: number;
    let secondaryPacks: number | null = null;
    let primaryPacks: number;

    if (item.unit === "cases") {
      shipperCases = item.qty;
      if (hasSecondary && secPerCase > 0) {
        secondaryPacks = shipperCases * secPerCase;
        primaryPacks   = secondaryPacks * primPerSec;
        unitsToMake    = primaryPacks * unitsPerPrimary;
      } else if (secPerCase > 0) {
        // No secondary — secPerCase means primaries per case
        primaryPacks = shipperCases * secPerCase;
        unitsToMake  = primaryPacks * unitsPerPrimary;
      } else {
        unitsToMake  = item.qty * unitsPerPrimary;
        primaryPacks = item.qty;
      }
      finishedLbs = unitsToMake * unitWeightLbs;
    } else if (item.unit === "lbs") {
      finishedLbs  = item.qty;
      unitsToMake  = unitWeightLbs > 0 ? Math.ceil(item.qty / unitWeightLbs) : 0;
      primaryPacks = Math.ceil(unitsToMake / unitsPerPrimary);
      if (hasSecondary && secPerCase > 0) {
        secondaryPacks = Math.ceil(primaryPacks / primPerSec);
        shipperCases   = Math.ceil(secondaryPacks / secPerCase);
      } else {
        shipperCases = secPerCase > 0 ? Math.ceil(primaryPacks / secPerCase) : primaryPacks;
      }
    } else {
      // units
      unitsToMake  = item.qty;
      finishedLbs  = unitsToMake * unitWeightLbs;
      primaryPacks = Math.ceil(unitsToMake / unitsPerPrimary);
      if (hasSecondary && secPerCase > 0) {
        secondaryPacks = Math.ceil(primaryPacks / primPerSec);
        shipperCases   = Math.ceil(secondaryPacks / secPerCase);
      } else {
        shipperCases = secPerCase > 0 ? Math.ceil(primaryPacks / secPerCase) : primaryPacks;
      }
    }

    const productionLbs = finishedLbs * (1 + productWastePct / 100);

    // Per-ingredient
    const ingCalcs: IngredientCalc[] = ingredients
      .filter((ing) => ing.name && Number(ing.percentage) > 0)
      .map((ing) => ({
        name: ing.name,
        percentage: Number(ing.percentage),
        need_lbs: (Number(ing.percentage) / 100) * productionLbs,
      }));

    const formulaTotalPct = ingCalcs.reduce((s, i) => s + i.percentage, 0);

    productCalcs.push({
      product_id: item.product_id,
      product_name: productName,
      batch_sheet_id: sheet.id,
      batch_sheet_version: sheet.version,
      order_qty: item.qty,
      order_unit: item.unit,
      units_to_make: unitsToMake,
      finished_lbs: Math.round(finishedLbs * 100) / 100,
      production_lbs: Math.round(productionLbs * 100) / 100,
      waste_pct_used: productWastePct,
      formula_total_pct: Math.round(formulaTotalPct * 100) / 100,
      ingredients: ingCalcs,
      packaging: {
        primary_packs: primaryPacks,
        secondary_packs: secondaryPacks,
        shipper_cases: shipperCases,
        primary_label: packaging.primary?.type ?? null,
        secondary_label: packaging.secondary?.type ?? null,
        shipper_label: packaging.shipper?.type ?? null,
      },
      warnings,
    });
  }

  // ─── Aggregate ingredient summary ──────────────────────────────────────────

  const aggMap = new Map<string, number>();
  for (const p of productCalcs) {
    for (const ing of p.ingredients) {
      const key = ing.name.toLowerCase().trim();
      aggMap.set(key, (aggMap.get(key) ?? 0) + ing.need_lbs);
    }
  }

  const canonicalName = new Map<string, string>();
  for (const p of productCalcs) {
    for (const ing of p.ingredients) {
      const key = ing.name.toLowerCase().trim();
      if (!canonicalName.has(key)) canonicalName.set(key, ing.name);
    }
  }

  const summaryIngredients: SummaryIngredient[] = Array.from(aggMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, totalNeed]) => {
      const onHand = inventoryMap.get(key) ?? 0;
      const toBuy = Math.max(0, totalNeed - onHand);
      return {
        name: canonicalName.get(key) ?? key,
        total_need_lbs: Math.round(totalNeed * 100) / 100,
        on_hand_lbs: Math.round(onHand * 100) / 100,
        to_buy_lbs: Math.round(toBuy * 100) / 100,
        shortfall: toBuy > 0,
      };
    });

  const totalPrimary = productCalcs.reduce((s, p) => s + p.packaging.primary_packs, 0);
  const totalSecondary = productCalcs.some((p) => p.packaging.secondary_packs !== null)
    ? productCalcs.reduce((s, p) => s + (p.packaging.secondary_packs ?? 0), 0)
    : null;
  const totalShipper = productCalcs.reduce((s, p) => s + p.packaging.shipper_cases, 0);

  return {
    calculated_at: new Date().toISOString(),
    waste_pct: wastePct,
    order_type: orderType,
    products: productCalcs,
    summary: {
      ingredients: summaryIngredients,
      total_primary_packs: totalPrimary,
      total_secondary_packs: totalSecondary,
      total_shipper_cases: totalShipper,
    },
  };
}
