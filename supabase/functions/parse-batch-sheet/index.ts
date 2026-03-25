import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as XLSX from "npm:xlsx@0.18.5/xlsx.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: userError } = await anonClient.auth.getUser();
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = caller.id;

    // Use service role client for cross-user DB operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check caller is staff/admin
    const { data: roleCheck } = await adminClient.rpc("is_staff_or_admin", { _user_id: callerId });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Only staff can parse batch sheets" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { file_path, user_id, action } = body;

    if (!file_path || !user_id) {
      return new Response(JSON.stringify({ error: "file_path and user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download file from storage
    const { data: fileData, error: downloadErr } = await adminClient.storage
      .from("product-spec-sheets")
      .download(file_path);

    if (downloadErr || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download file: " + (downloadErr?.message || "unknown") }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse XLSX
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Helper to get cell value
    const cell = (ref: string): any => {
      const c = sheet[ref];
      return c ? c.v : null;
    };

    // Extract data from known batch sheet layout
    // Row 1-8: Header area
    const productName = cell("B1") || cell("C1") || cell("B2") || sheetName || "Unknown Product";
    const formulaNumber = cell("H2") || cell("G2") || null;
    const versionNumber = cell("H3") || cell("G3") || null;
    const revisionNumber = cell("H4") || cell("G4") || null;
    const customerName = cell("B3") || cell("C3") || null;
    const preparedBy = cell("B4") || cell("C4") || null;

    // Packaging hierarchy - try common cell positions
    const rawFillWeight = parseFloat(cell("H5")) || parseFloat(cell("G5")) || null;
    const unitsPerPack = parseInt(cell("H6")) || parseInt(cell("G6")) || null;
    const netPerPack = parseFloat(cell("H7")) || parseFloat(cell("G7")) || null;
    const unitsPerCaddy = parseInt(cell("H8")) || parseInt(cell("G8")) || null;
    const unitsPerShipper = parseInt(cell("H9")) || parseInt(cell("G9")) || null;
    const netPerCase = parseFloat(cell("H10")) || parseFloat(cell("G10")) || null;
    const casesPerPallet = parseInt(cell("H11")) || parseInt(cell("G11")) || null;

    // Baking specs
    const bakingTemp = parseFloat(cell("H13")) || parseFloat(cell("G13")) || null;
    const bakingTimeMinutes = parseFloat(cell("H14")) || parseFloat(cell("G14")) || null;

    // Parse ingredients from the sheet - scan for ingredient rows
    // Look for rows that have ingredient data (name + percentage + weight)
    const ingredients: Array<{
      ingredient_name: string;
      percentage_formula: number | null;
      weight_g: number | null;
      ingredient_category: string | null;
    }> = [];

    // Scan rows for ingredient data - typical batch sheet has ingredients starting around row 15-20
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:Z100");
    for (let r = 10; r <= range.e.r; r++) {
      const rowNum = r + 1;
      // Try columns A/B for name, C/D for percentage, E/F for weight
      const nameA = cell(`A${rowNum}`);
      const nameB = cell(`B${rowNum}`);
      const name = nameB || nameA;
      
      if (!name || typeof name !== "string" || name.trim() === "") continue;
      
      // Skip header-like rows
      const nameLower = name.toLowerCase().trim();
      if (
        nameLower.includes("ingredient") && nameLower.includes("name") ||
        nameLower === "total" ||
        nameLower.includes("packaging") ||
        nameLower.includes("method") ||
        nameLower.includes("processing")
      ) continue;

      const pctC = parseFloat(cell(`C${rowNum}`));
      const pctD = parseFloat(cell(`D${rowNum}`));
      const pct = !isNaN(pctC) ? pctC : !isNaN(pctD) ? pctD : null;

      const weightE = parseFloat(cell(`E${rowNum}`));
      const weightF = parseFloat(cell(`F${rowNum}`));
      const weight = !isNaN(weightE) ? weightE : !isNaN(weightF) ? weightF : null;

      // Only add if we have at least a name and one numeric value
      if (pct !== null || weight !== null) {
        ingredients.push({
          ingredient_name: name.trim(),
          percentage_formula: pct,
          weight_g: weight,
          ingredient_category: null,
        });
      }
    }

    // Build processing steps from sheet
    const processingSteps: any[] = [];

    const parsed = {
      product_name: typeof productName === "string" ? productName.trim() : String(productName),
      formula_number: formulaNumber,
      version_number: versionNumber,
      revision_number: revisionNumber,
      customer_name: customerName,
      prepared_by: preparedBy,
      raw_fill_weight: rawFillWeight,
      units_per_pack: unitsPerPack,
      net_per_pack: netPerPack,
      units_per_caddy: unitsPerCaddy,
      units_per_shipper: unitsPerShipper,
      net_per_case: netPerCase,
      cases_per_pallet: casesPerPallet,
      baking_temp: bakingTemp,
      baking_time_minutes: bakingTimeMinutes,
      ingredients,
      processing_steps: processingSteps,
    };

    // Check for existing product with same name for this user
    const { data: existingConcepts } = await adminClient
      .from("concepts")
      .select("id, product_name, version_number, status")
      .eq("user_id", user_id)
      .eq("status", "active")
      .ilike("product_name", parsed.product_name);

    const existingConcept = existingConcepts && existingConcepts.length > 0 ? existingConcepts[0] : null;

    // If action is "check", just return parsed data + existing info
    if (action === "check") {
      return new Response(
        JSON.stringify({
          parsed,
          existing_concept_id: existingConcept?.id || null,
          existing_product_name: existingConcept?.product_name || null,
          existing_version: existingConcept?.version_number || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: create, new_version, or update
    if (action === "create" || (action === "new_version" && existingConcept) || action === "update") {
      let conceptId: number;

      if (action === "new_version" && existingConcept) {
        // Archive old concept
        await adminClient
          .from("concepts")
          .update({ status: "archived" })
          .eq("id", existingConcept.id);

        // Create new concept linked to old
        const { data: newConcept, error: conceptErr } = await adminClient
          .from("concepts")
          .insert({
            user_id,
            product_name: parsed.product_name,
            product_code: parsed.formula_number,
            version_number: parsed.version_number,
            revision_number: parsed.revision_number,
            customer_name: parsed.customer_name,
            prepared_by: parsed.prepared_by,
            baking_temp: parsed.baking_temp,
            baking_time_minutes: parsed.baking_time_minutes,
            processing_steps: parsed.processing_steps,
            status: "active",
            parent_concept_id: existingConcept.id,
          })
          .select("id")
          .single();

        if (conceptErr) throw conceptErr;
        conceptId = newConcept.id;
      } else if (action === "update" && existingConcept) {
        // Update existing concept in place
        const { error: updateErr } = await adminClient
          .from("concepts")
          .update({
            product_code: parsed.formula_number,
            version_number: parsed.version_number,
            revision_number: parsed.revision_number,
            customer_name: parsed.customer_name,
            prepared_by: parsed.prepared_by,
            baking_temp: parsed.baking_temp,
            baking_time_minutes: parsed.baking_time_minutes,
            processing_steps: parsed.processing_steps,
          })
          .eq("id", existingConcept.id);

        if (updateErr) throw updateErr;
        conceptId = existingConcept.id;
      } else {
        // Create new concept
        const { data: newConcept, error: conceptErr } = await adminClient
          .from("concepts")
          .insert({
            user_id,
            product_name: parsed.product_name,
            product_code: parsed.formula_number,
            version_number: parsed.version_number,
            revision_number: parsed.revision_number,
            customer_name: parsed.customer_name,
            prepared_by: parsed.prepared_by,
            baking_temp: parsed.baking_temp,
            baking_time_minutes: parsed.baking_time_minutes,
            processing_steps: parsed.processing_steps,
            status: "active",
          })
          .select("id")
          .single();

        if (conceptErr) throw conceptErr;
        conceptId = newConcept.id;
      }

      // Create/update product record
      const { data: existingProduct } = await adminClient
        .from("products")
        .select("id")
        .eq("concept_id", action === "update" && existingConcept ? existingConcept.id : conceptId)
        .maybeSingle();

      if (existingProduct && action === "update") {
        await adminClient
          .from("products")
          .update({
            product_name: parsed.product_name,
            raw_fill_weight: parsed.raw_fill_weight,
            units_per_pack: parsed.units_per_pack,
            net_per_pack: parsed.net_per_pack,
            units_per_caddy: parsed.units_per_caddy,
            units_per_shipper: parsed.units_per_shipper,
            net_per_case: parsed.net_per_case,
            cases_per_pallet: parsed.cases_per_pallet,
          })
          .eq("id", existingProduct.id);
      } else {
        // Generate a unique product ID (timestamp-based)
        const productId = Date.now();
        await adminClient.from("products").insert({
          id: productId,
          user_id,
          concept_id: conceptId,
          product_name: parsed.product_name,
          raw_fill_weight: parsed.raw_fill_weight,
          units_per_pack: parsed.units_per_pack,
          net_per_pack: parsed.net_per_pack,
          units_per_caddy: parsed.units_per_caddy,
          units_per_shipper: parsed.units_per_shipper,
          net_per_case: parsed.net_per_case,
          cases_per_pallet: parsed.cases_per_pallet,
        });
      }

      // Delete existing formulas for update, then insert new ones
      if (action === "update" && existingConcept) {
        await adminClient
          .from("formulas")
          .delete()
          .eq("concept_id", existingConcept.id)
          .eq("user_id", user_id);
      }

      // Insert formula rows for ingredients
      if (parsed.ingredients.length > 0) {
        const formulaRows = parsed.ingredients.map((ing, idx) => ({
          id: Date.now() + idx,
          user_id,
          concept_id: conceptId,
          ingredient_name: ing.ingredient_name,
          percentage_formula: ing.percentage_formula,
          weight_g: ing.weight_g,
          ingredient_category: ing.ingredient_category,
        }));

        const { error: formulaErr } = await adminClient.from("formulas").insert(formulaRows);
        if (formulaErr) {
          console.error("Formula insert error:", formulaErr);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          concept_id: conceptId,
          action,
          ingredients_count: parsed.ingredients.length,
          parsed,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: check, create, new_version, update" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("parse-batch-sheet error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
