// Ingest a staff-uploaded batch sheet (.xlsx) directly into the batch_sheets table.
// - Parses the workbook with a structure compatible with generate-batch-sheet-from-pss.
// - Versions correctly (supersedes the prior active sheet for the same lead/pss link).
// - Then calls reconcile-pss-batch so a half-empty PSS gets filled from the batch sheet.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as XLSX from "npm:xlsx@0.18.5/xlsx.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isStaff } = await admin.rpc("is_staff_or_admin", { _user_id: user.id });
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const { file_path, lead_id, pss_document_id } = await req.json();
    if (!file_path) return json({ error: "file_path required" }, 400);

    const { data: fileData, error: dlErr } = await admin.storage
      .from("batch-sheets")
      .download(file_path);
    if (dlErr || !fileData) return json({ error: "Failed to download: " + (dlErr?.message || "unknown") }, 400);

    const ab = await fileData.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const cell = (ref: string): any => sheet[ref]?.v ?? null;
    const num = (v: any) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };

    // Header block (mirrors parse-batch-sheet's layout)
    const productName = cell("B1") || cell("C1") || cell("B2") || wb.SheetNames[0] || "Unknown Product";
    const productCode = cell("H2") || cell("G2");
    const versionNumber = cell("H3") || cell("G3");
    const customerName = cell("B3") || cell("C3");
    const preparedBy = cell("B4") || cell("C4");

    // Packaging block
    const rawFillWeight = num(cell("H5")) ?? num(cell("G5"));
    const unitsPerPack = num(cell("H6")) ?? num(cell("G6"));
    const netPerPack = num(cell("H7")) ?? num(cell("G7"));
    const unitsPerCase = num(cell("H9")) ?? num(cell("G9"));
    const casesPerPallet = num(cell("H11")) ?? num(cell("G11"));
    const bakeTemp = num(cell("H13")) ?? num(cell("G13"));
    const bakeTime = num(cell("H14")) ?? num(cell("G14"));

    // Ingredient rows
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:Z200");
    const ingredients: any[] = [];
    for (let r = 10; r <= range.e.r; r++) {
      const rn = r + 1;
      const name = cell(`B${rn}`) || cell(`A${rn}`);
      if (!name || typeof name !== "string") continue;
      const lower = name.toLowerCase().trim();
      if (!lower || lower === "total" || lower.includes("ingredient") || lower.includes("packaging") || lower.includes("method") || lower.includes("processing")) continue;
      const pct = num(cell(`C${rn}`)) ?? num(cell(`D${rn}`));
      const weight = num(cell(`E${rn}`)) ?? num(cell(`F${rn}`));
      if (pct === null && weight === null) continue;
      ingredients.push({ name: name.trim(), percentage: pct, weight: weight, weight_unit: "g" });
    }
    const totalBatchWeight = ingredients.reduce((s, i) => s + (i.weight || 0), 0) || null;

    // Build data_json in the same shape generate-batch-sheet-from-pss writes
    const data_json: any = {
      header: {
        company_name: customerName || null,
        customer_name: customerName || null,
        product_name: typeof productName === "string" ? productName.trim() : String(productName),
        product_code: productCode || null,
        version_number: versionNumber || null,
        prepared_by: preparedBy || null,
      },
      product: {
        target_unit_weight_raw: rawFillWeight,
        weight_unit: "g",
      },
      recipe: {
        total_batch_weight: totalBatchWeight,
        weight_unit: "g",
        ingredients,
      },
      process: {
        bake: { temperature: bakeTemp, time_minutes: bakeTime, temp_unit: "°F" },
        pre_bake: { steps: [] },
      },
      packaging: {
        primary: { vessel: null, units_per_pack: unitsPerPack, net_weight_per_pack: netPerPack, weight_unit: "g" },
        secondary: { type: null, units_per_case: unitsPerCase },
        palletizing: { cases_per_pallet: casesPerPallet },
      },
      source: { generated_at: new Date().toISOString(), method: "staff_upload" },
    };

    // Versioning. If a PSS link is given, scope by pss_document_id; otherwise by lead_id.
    const scope = pss_document_id
      ? admin.from("batch_sheets").select("id, version, status").eq("pss_document_id", pss_document_id).is("superseded_at", null).maybeSingle()
      : lead_id
        ? admin.from("batch_sheets").select("id, version, status").eq("lead_id", lead_id).is("superseded_at", null).order("version", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null });
    const { data: active } = await (scope as any);
    const nextVersion = (active?.version || 0) + 1;
    if (active) {
      await admin.from("batch_sheets")
        .update({ superseded_at: new Date().toISOString(), superseded_by_version: nextVersion })
        .eq("id", active.id);
    }

    const { data: inserted, error: insErr } = await admin.from("batch_sheets")
      .insert({
        pss_document_id: pss_document_id || null,
        lead_id: lead_id || null,
        status: "draft",
        data_json,
        generated_from: "staff_upload",
        version: nextVersion,
        source_change: active ? "staff_upload" : "initial",
        xlsx_path: file_path,
        last_edited_by: user.id,
      })
      .select()
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    await admin.from("internal_notifications").insert({
      notification_type: "batch_sheet_uploaded",
      reference_id: inserted.id,
      reference_table: "batch_sheets",
      title: `Batch sheet uploaded — ${data_json.header.product_name}`,
      message: `Staff-uploaded workbook, ${ingredients.length} ingredients parsed.`,
    });

    // If we know which PSS this belongs to, reconcile so blanks get filled
    let reconciled: any = null;
    if (pss_document_id) {
      const recRes = await admin.functions.invoke("reconcile-pss-batch", {
        body: { pss_document_id },
        headers: { Authorization: authHeader },
      });
      reconciled = (recRes as any)?.data || null;
    }

    return json({ ok: true, batch_sheet: inserted, ingredients_count: ingredients.length, reconciled });
  } catch (e) {
    console.error("ingest-batch-sheet error:", e);
    return json({ error: (e as Error).message || "Internal error" }, 500);
  }
});
