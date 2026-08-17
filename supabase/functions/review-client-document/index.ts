// AI review of a returned client document (NDA or PSS).
// Downloads the file from the product-spec-sheets bucket, extracts text,
// asks a generic AI provider to evaluate it against the required schema,
// and writes the verdict back to client_documents.review_status / review_notes.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as XLSX from "npm:xlsx@0.18.5/xlsx.mjs";
import { aiJSON, activeProvider } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: caller } } = await anon.auth.getUser();
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isStaff } = await admin.rpc("is_staff_or_admin", { _user_id: caller.id });
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    // doc_text / doc_images are supplied by the caller, which reads PDFs and Word files before
    // invoking (src/lib/clientDocRead.ts). A scan arrives as page images instead of text.
    const { document_id, doc_text, doc_images } = await req.json();
    if (!document_id) return json({ error: "document_id required" }, 400);

    const { data: doc, error: docErr } = await admin
      .from("client_documents")
      .select("*")
      .eq("id", document_id)
      .maybeSingle();
    if (docErr || !doc) return json({ error: "Document not found" }, 404);
    if (!doc.file_path) return json({ error: "Document has no file_path" }, 400);

    const docType = (doc.document_type || "").toLowerCase();
    if (docType !== "nda" && docType !== "pss") {
      return json({ error: `Unsupported document_type '${doc.document_type}'` }, 400);
    }

    // Download from storage
    const { data: file, error: dlErr } = await admin.storage
      .from("product-spec-sheets")
      .download(doc.file_path);
    if (dlErr || !file) return json({ error: `Download failed: ${dlErr?.message}` }, 400);

    // Extract text
    let extracted = "";
    let images: string[] = [];
    const lowerName = (doc.file_name || doc.file_path || "").toLowerCase();
    const buf = new Uint8Array(await file.arrayBuffer());

    const callerText = typeof doc_text === "string" ? doc_text.trim() : "";
    const callerImages = Array.isArray(doc_images)
      ? doc_images.filter((u: unknown) => typeof u === "string" && u.length > 0)
      : [];

    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      try {
        const wb = XLSX.read(buf, { type: "array" });
        for (const name of wb.SheetNames) {
          const sheet = wb.Sheets[name];
          extracted += `\n=== Sheet: ${name} ===\n` + XLSX.utils.sheet_to_csv(sheet);
        }
      } catch (e) {
        extracted = `[Could not parse spreadsheet: ${(e as Error).message}]`;
      }
    } else if (lowerName.endsWith(".pdf") || lowerName.endsWith(".docx")) {
      // Nothing usable can be recovered from the raw bytes here. PDF text sits in FlateDecode
      // content streams and a .docx is a zip of XML parts, so decoding either as text yields
      // binary noise -- and a scanned NDA has no text at all, only a full-page image per page.
      // All of it is handled by the caller; see src/lib/clientDocRead.ts.
      if (callerText) {
        extracted = callerText;
      } else if (callerImages.length > 0) {
        images = callerImages.slice(0, 8);
      } else {
        return json({
          error:
            "Could not read this document. Re-open it and run the review again so its contents " +
            "can be read; if it keeps failing the file may be corrupt or password-protected.",
        }, 422);
      }
    } else if (lowerName.endsWith(".doc")) {
      // Legacy OLE binary. No parser here or on the client reads it.
      return json({
        error: "Legacy .doc files can't be reviewed. Ask the client to resend it as .docx or PDF.",
      }, 422);
    } else {
      extracted = new TextDecoder("utf-8", { fatal: false }).decode(buf).slice(0, 60000);
    }

    extracted = extracted.slice(0, 60000); // hard cap before sending to AI

    // Build per-type prompt
    let system: string;
    let userPrompt: string;
    if (docType === "nda") {
      system = `You are reviewing a returned NDA from a prospective bakery client.
Return ONLY a JSON object matching this exact schema:
{
  "fully_executed": boolean,
  "signer_name": string | null,
  "company": string | null,
  "date": string | null,
  "signature_present": boolean,
  "issues": string[],
  "summary": string
}
- "fully_executed" = true ONLY if the client filled in their name, company, date AND signature appears present.
- "signature_present" = true if you see an explicit "Signed by:" / "Signature:" line followed by a name, OR clear evidence of a handwritten signature image/glyph block. If ambiguous, set false and add an issue.
- "issues" = short bullet-style strings, each ≤ 12 words.
- "summary" = one sentence the salesperson will read.`;
      userPrompt = images.length > 0
        ? `This NDA is a scan of the signed paper original, attached as one image per page. Read the pages, including handwriting. A handwritten signature counts as a signature.`
        : `NDA text:\n\n${extracted}`;
    } else {
      system = `You are reviewing a returned Product Spec Sheet (PSS) from a prospective bakery client.
The PSS is allowed to be PARTIAL — missing optional sections become services we can offer them, not reasons to reject.

Return ONLY a JSON object matching this exact schema (any field may be null if not stated):
{
  "has_required": {
    "company": boolean, "product": boolean, "recipe": boolean, "process": boolean,
    "size_weight": boolean, "units_per_primary": boolean, "units_per_retail": boolean, "signature": boolean
  },
  "missing_optional": string[],
  "services_to_offer": string[],
  "extracted": {
    "header": {
      "company_name": string|null, "customer_name": string|null,
      "product_name": string|null, "product_code": string|null,
      "version_number": string|null, "revision_number": string|null,
      "prepared_by": string|null, "approved_by": string|null, "date_of_issue": string|null
    },
    "product": {
      "target_unit_weight_raw": number|null, "target_unit_weight_baked": number|null, "weight_unit": string|null,
      "expected_bake_loss_pct": number|null,
      "unit_dimensions": { "l": number|null, "w": number|null, "h": number|null, "unit": string|null },
      "shape": string|null, "appearance": string|null, "intended_use": string|null, "target_shelf_life": string|null
    },
    "recipe": {
      "total_batch_weight": number|null, "weight_unit": string|null,
      "ingredients": [
        { "name": string, "weight": number|null, "weight_unit": string|null,
          "percentage": number|null, "category": string|null, "notes": string|null }
      ]
    },
    "process": {
      "method": "no-bake"|"melt"|"loose-batter"|"dough-extruder"|"round-former"|"press-die"|"manual"|null,
      "pre_bake": {
        "steps": [
          { "order": number, "station": string|null, "action": string,
            "ingredients_added": string[], "mix_time_min": number|null,
            "mix_speed": string|null, "temperature": number|null, "temp_unit": string|null, "notes": string|null }
        ],
        "dough_temp_target": number|null, "dough_temp_unit": string|null
      },
      "forming": { "machine": string|null, "target_deposit_weight_raw": number|null, "weight_unit": string|null, "die_or_wire": string|null, "notes": string|null },
      "bake": { "time_minutes": number|null, "temperature": number|null, "temp_unit": string|null, "expected_loss_pct": number|null },
      "post_bake": { "freeze_required": boolean|null, "freeze_temp": number|null, "freeze_time": string|null, "notes": string|null }
    },
    "packaging": {
      "primary": { "vessel": string|null, "units_per_pack": number|null, "net_weight_per_pack": number|null, "weight_unit": string|null, "machine": string|null, "lot_code_printed": boolean|null },
      "secondary": { "type": string|null, "units_per_case": number|null, "machine": string|null, "lot_code_printed": boolean|null },
      "palletizing": { "cases_per_pallet": number|null, "pattern": string|null, "notes": string|null }
    },
    "nutrition": {
      "serving_size": string|null,
      "rows": [ { "nutrient": string, "amount": string|null, "dv": string|null } ]
    },
    "allergens": { "<Allergen Name>": { "present": boolean|null, "source": string|null } },
    "storage": { "conditions": string|null, "shelf_life": string|null }
  },
  "summary": string
}

CRITICAL RULES:
- Ingredient weights are the source of truth. Return BOTH "weight" and "percentage" when stated; never invent one from the other — leave null if not present.
- recipe = true if at least 3 ingredients with a name are listed (weight strongly preferred).
- process = true if at least 2 ordered steps are present; tag each with ingredients_added[] when possible.
- Classify process.method from the allowed taxonomy; null if unclear.
- signature = true ONLY if an explicit signature line / "Signed by" appears with a name.
- Keep step "action" concise (≤ 120 chars). Cap pre_bake.steps at 20.
- nutrition.rows: one entry per row PRINTED on the form, using the form's own label verbatim
  ("Energy (kcal)", "Carbohydrates (g)" — do NOT substitute US Nutrition-Facts names like
  "Calories" or "Added Sugars"). "amount" is the value written in that row, transcribed as written
  ("9g", "59mg"). A row printed on the form but left blank gets amount null — never invent a value,
  and never emit a full blank template just because a nutrition section exists.
- allergens: key each entry with EXACTLY one of
  "Milk", "Eggs", "Tree nuts", "Peanuts", "Wheat / Gluten", "Soy", "Sesame", "Fish", "Shellfish"
  (map the form's wording onto these: "Wheat/gluten" -> "Wheat / Gluten", "Soybean" -> "Soy").
  present = true for yes/contains, false for no/none. If the form says something hedged such as
  "maybe" or "may contain", set present true and put the form's wording in "source". Omit the key
  entirely when that row was left blank -- an omitted key means unanswered, false means answered no.

SERVICES_TO_OFFER RULES (Adventure Bakery proprietary services — be strict):
- Allowed services, ONLY include when the corresponding section is missing or incomplete:
  * "Formula calculator" — when recipe ingredient weights or total batch weight are missing/inconsistent.
  * "Packaging design & optimization" — when packaging.primary.vessel AND packaging.secondary.type are both missing.
  * "Nutritional panel development" — when no nutrition.rows entry carries an amount.
  * "Allergen declaration & risk review" — when allergens is empty / no allergen is answered.
  * "Shelf-life study & validation" — when neither product.target_shelf_life nor storage.shelf_life is stated.
- NEVER offer "process development", "process design", "recipe optimization", "total batch weight calculator", or "bake profile development". Process is proprietary to Adventure Bakery.
- Do not invent other services. If everything is present, return an empty array.`;
      userPrompt = images.length > 0
        ? `This PSS is a scan with no text layer, attached as one image per page. Read the pages, including handwriting and table cells.`
        : `PSS contents (spreadsheet CSV, Word document HTML, or plain text):\n\n${extracted}`;
    }

    const verdict = await aiJSON({ system, user: userPrompt, images });

    // Decide status.
    // NDAs are approved on upload (see migration 20260817000001_nda_auto_approve.sql), so the AI
    // verdict is advisory for them: it is kept in review_notes and surfaced in the Documents Inbox,
    // but it must not write review_status or it would knock the document back out of approved.
    let review_status: string | null = null;
    if (docType !== "nda") {
      // Enforce Adventure Bakery service rules server-side (AI may drift)
      const ex = verdict.extracted || {};
      const recipe = ex.recipe || {};
      const pkg = ex.packaging || {};
      const ings = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
      const hasWeights = ings.length > 0 && ings.every((i: any) => typeof i.weight === "number" && i.weight > 0);

      // These test for CONTENT, not for the key existing. The previous version asked
      // `if (!opt.nutritional_panel)`, and the model habitually answered with `{}` -- which is
      // truthy in JS, so a completely blank panel counted as "present" and the service that
      // should have been offered never was.
      const nonEmpty = (v: unknown) => String(v ?? "").trim() !== "";
      const nutritionRows = Array.isArray(ex.nutrition?.rows) ? ex.nutrition.rows : [];
      const hasNutrition = nutritionRows.some((r: any) => nonEmpty(r?.amount));
      const hasAllergens = Object.values(ex.allergens || {}).some(
        (a: any) => typeof a?.present === "boolean" || nonEmpty(a?.source),
      );
      const hasShelfLife = nonEmpty(ex.product?.target_shelf_life) || nonEmpty(ex.storage?.shelf_life);

      const allowed: string[] = [];
      if (ings.length === 0 || !hasWeights || !recipe.total_batch_weight) allowed.push("Formula calculator");
      if (!pkg?.primary?.vessel && !pkg?.secondary?.type) allowed.push("Packaging design & optimization");
      if (!hasNutrition) allowed.push("Nutritional panel development");
      if (!hasAllergens) allowed.push("Allergen declaration & risk review");
      if (!hasShelfLife) allowed.push("Shelf-life study & validation");
      verdict.services_to_offer = allowed;

      const req = verdict.has_required || {};
      const requiredOk = req.company && req.product && req.recipe && req.process &&
        req.size_weight && req.units_per_primary && req.units_per_retail && req.signature;
      review_status = requiredOk ? "ai_passed" : "ai_flagged";
    }

    await admin
      .from("client_documents")
      .update({
        ...(review_status ? { review_status } : {}),
        review_notes: verdict,
        reviewed_at: new Date().toISOString(),
        reviewed_by: caller.id,
      })
      .eq("id", document_id);

    return json({ ok: true, review_status, verdict, ...activeProvider() });
  } catch (e) {
    console.error("review-client-document error:", e);
    return json({ error: (e as Error).message || "Unknown error" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
