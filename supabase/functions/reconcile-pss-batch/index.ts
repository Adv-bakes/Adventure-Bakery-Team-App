// Two-way reconciliation: fill blanks in PSS from batch sheet, and vice versa.
// - PSS structured data lives in client_documents.review_notes.extracted
// - Batch sheet structured data lives in batch_sheets.data_json
// - We never overwrite an existing value; we only fill nulls / empty strings.
// - Process steps are batch-sheet-only (proprietary) and never copied to PSS.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isBlank = (v: any) =>
  v === null || v === undefined || v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

const setIfBlank = (obj: any, path: string[], value: any): boolean => {
  if (isBlank(value)) return false;
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (cur[path[i]] === undefined || cur[path[i]] === null || typeof cur[path[i]] !== "object") {
      cur[path[i]] = {};
    }
    cur = cur[path[i]];
  }
  const key = path[path.length - 1];
  if (isBlank(cur[key])) {
    cur[key] = value;
    return true;
  }
  return false;
};

const get = (obj: any, path: string[]) => {
  let cur = obj;
  for (const p of path) {
    if (!cur) return undefined;
    cur = cur[p];
  }
  return cur;
};

// Field map: each pair is [pssPath, batchPath] inside their respective JSON roots.
const FIELD_MAP: Array<[string[], string[]]> = [
  [["header", "product_name"], ["header", "product_name"]],
  [["header", "company_name"], ["header", "company_name"]],
  [["header", "customer_name"], ["header", "customer_name"]],
  [["header", "product_code"], ["header", "product_code"]],
  [["header", "version_number"], ["header", "version_number"]],
  [["product", "target_unit_weight_raw"], ["product", "target_unit_weight_raw"]],
  [["product", "weight_unit"], ["product", "weight_unit"]],
  [["recipe", "total_batch_weight"], ["recipe", "total_batch_weight"]],
  [["recipe", "weight_unit"], ["recipe", "weight_unit"]],
  [["packaging", "primary", "vessel"], ["packaging", "primary", "vessel"]],
  [["packaging", "primary", "units_per_pack"], ["packaging", "primary", "units_per_pack"]],
  [["packaging", "primary", "net_weight_per_pack"], ["packaging", "primary", "net_weight_per_pack"]],
  [["packaging", "secondary", "type"], ["packaging", "secondary", "type"]],
  [["packaging", "secondary", "units_per_case"], ["packaging", "secondary", "units_per_case"]],
  [["packaging", "palletizing", "cases_per_pallet"], ["packaging", "palletizing", "cases_per_pallet"]],
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const internalSecret = req.headers.get("x-internal-secret");
    const isInternal = !!internalSecret && internalSecret === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!isInternal) {
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const anon = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await anon.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { data: ok } = await admin.rpc("is_staff_or_admin", { _user_id: user.id });
      if (!ok) return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const { pss_document_id, batch_sheet_id } = body;
    if (!pss_document_id && !batch_sheet_id) return json({ error: "pss_document_id or batch_sheet_id required" }, 400);

    // Load PSS
    let pssDoc: any = null;
    if (pss_document_id) {
      const r = await admin.from("client_documents").select("*").eq("id", pss_document_id).maybeSingle();
      pssDoc = r.data;
    }

    // Load active batch sheet — prefer match by pss_document_id, else by lead_id of the doc
    let batchSheet: any = null;
    if (batch_sheet_id) {
      const r = await admin.from("batch_sheets").select("*").eq("id", batch_sheet_id).maybeSingle();
      batchSheet = r.data;
      if (batchSheet && !pssDoc && batchSheet.pss_document_id) {
        const r2 = await admin.from("client_documents").select("*").eq("id", batchSheet.pss_document_id).maybeSingle();
        pssDoc = r2.data;
      }
    } else if (pss_document_id) {
      const r = await admin.from("batch_sheets")
        .select("*")
        .eq("pss_document_id", pss_document_id)
        .is("superseded_at", null)
        .order("version", { ascending: false })
        .limit(1).maybeSingle();
      batchSheet = r.data;
    }

    if (!pssDoc && !batchSheet) return json({ ok: true, filled: { pss_filled_count: 0, batch_filled_count: 0 }, note: "Nothing to reconcile" });
    if (!pssDoc || !batchSheet) {
      return json({ ok: true, filled: { pss_filled_count: 0, batch_filled_count: 0 }, note: "Only one side present" });
    }

    const pssExtracted = JSON.parse(JSON.stringify((pssDoc.review_notes && pssDoc.review_notes.extracted) || {}));
    const batchJson = JSON.parse(JSON.stringify(batchSheet.data_json || {}));

    let pssFilled = 0;
    let batchFilled = 0;
    const pssChanges: string[] = [];
    const batchChanges: string[] = [];

    // Scalar field copy
    for (const [pPath, bPath] of FIELD_MAP) {
      const pVal = get(pssExtracted, pPath);
      const bVal = get(batchJson, bPath);
      if (isBlank(pVal) && !isBlank(bVal)) {
        if (setIfBlank(pssExtracted, pPath, bVal)) { pssFilled++; pssChanges.push(pPath.join(".")); }
      } else if (isBlank(bVal) && !isBlank(pVal)) {
        if (setIfBlank(batchJson, bPath, pVal)) { batchFilled++; batchChanges.push(bPath.join(".")); }
      }
    }

    // Recipe ingredients: copy whole list if one side is empty
    const pIngs = get(pssExtracted, ["recipe", "ingredients"]) || [];
    const bIngs = get(batchJson, ["recipe", "ingredients"]) || [];
    if (Array.isArray(pIngs) && pIngs.length === 0 && Array.isArray(bIngs) && bIngs.length > 0) {
      pssExtracted.recipe = pssExtracted.recipe || {};
      pssExtracted.recipe.ingredients = bIngs.map((i: any) => ({
        name: i.name || i.ingredient_name,
        weight: i.weight ?? i.weight_g ?? null,
        weight_unit: i.weight_unit || "g",
        percentage: i.percentage ?? i.percentage_formula ?? null,
      }));
      pssFilled += pssExtracted.recipe.ingredients.length;
      pssChanges.push(`recipe.ingredients[+${pssExtracted.recipe.ingredients.length}]`);
    } else if (Array.isArray(bIngs) && bIngs.length === 0 && Array.isArray(pIngs) && pIngs.length > 0) {
      batchJson.recipe = batchJson.recipe || {};
      batchJson.recipe.ingredients = pIngs.map((i: any) => ({
        name: i.name,
        weight: i.weight ?? null,
        weight_unit: i.weight_unit || "g",
        percentage: i.percentage ?? null,
      }));
      batchFilled += batchJson.recipe.ingredients.length;
      batchChanges.push(`recipe.ingredients[+${batchJson.recipe.ingredients.length}]`);
    }

    // Persist
    if (pssFilled > 0) {
      const newNotes = { ...(pssDoc.review_notes || {}), extracted: pssExtracted };
      await admin.from("client_documents").update({ review_notes: newNotes }).eq("id", pssDoc.id);
    }
    if (batchFilled > 0) {
      await admin.from("batch_sheets").update({
        data_json: batchJson,
        updated_at: new Date().toISOString(),
      }).eq("id", batchSheet.id);
    }

    return json({
      ok: true,
      filled: {
        pss_filled_count: pssFilled,
        batch_filled_count: batchFilled,
        pss_changes: pssChanges,
        batch_changes: batchChanges,
      },
    });
  } catch (e) {
    console.error("reconcile-pss-batch error:", e);
    return json({ error: (e as Error).message || "Internal error" }, 500);
  }
});
