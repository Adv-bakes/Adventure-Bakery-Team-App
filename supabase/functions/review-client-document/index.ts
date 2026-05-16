// AI review of a returned client document (NDA or PSS).
// Downloads the file from the product-spec-sheets bucket, extracts text,
// asks a generic AI provider to evaluate it against the required schema,
// and writes the verdict back to client_documents.review_status / review_notes.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as XLSX from "npm:xlsx@0.18.5/xlsx.mjs";
import { aiJSON } from "../_shared/ai.ts";

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

    const { document_id } = await req.json();
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
    const lowerName = (doc.file_name || doc.file_path || "").toLowerCase();
    const buf = new Uint8Array(await file.arrayBuffer());

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
    } else if (lowerName.endsWith(".pdf")) {
      // Best-effort: pull printable ASCII strings from the PDF stream.
      // Heavy PDF parsing is deferred; this is enough for AI to spot signed-by / completed fields.
      const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      extracted = (text.match(/[\x20-\x7E\n\r]{4,}/g) || []).join("\n").slice(0, 60000);
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
      userPrompt = `NDA text:\n\n${extracted}`;
    } else {
      system = `You are reviewing a returned Product Spec Sheet (PSS) from a prospective bakery client.
The PSS is allowed to be PARTIAL — missing optional sections become services we can offer them, not reasons to reject.

Return ONLY a JSON object matching this exact schema:
{
  "has_required": {
    "company": boolean,
    "product": boolean,
    "recipe": boolean,
    "process": boolean,
    "size_weight": boolean,
    "units_per_primary": boolean,
    "units_per_retail": boolean,
    "signature": boolean
  },
  "missing_optional": string[],   // any of: "nutritional_panel", "allergens", "packaging", "shelf_life"
  "services_to_offer": string[],  // human-readable upsell items derived from missing_optional
  "extracted": {
    "company_name": string | null,
    "product_name": string | null,
    "ingredients": [{ "name": string, "percentage": number | null }],
    "process_steps": string[]
  },
  "summary": string
}
- recipe = true if at least 3 ingredients with a name are listed.
- process = true if at least 2 ordered process steps are present.
- signature = true ONLY if an explicit signature line / "Signed by" appears with a name.
- Keep "process_steps" concise (≤ 20 items, each ≤ 120 chars).`;
      userPrompt = `PSS contents (CSV/text):\n\n${extracted}`;
    }

    const verdict = await aiJSON({ system, user: userPrompt });

    // Decide status
    let review_status: string;
    if (docType === "nda") {
      review_status = verdict.fully_executed ? "ai_passed" : "ai_flagged";
    } else {
      const req = verdict.has_required || {};
      const requiredOk = req.company && req.product && req.recipe && req.process &&
        req.size_weight && req.units_per_primary && req.units_per_retail && req.signature;
      review_status = requiredOk ? "ai_passed" : "ai_flagged";
    }

    await admin
      .from("client_documents")
      .update({
        review_status,
        review_notes: verdict,
        reviewed_at: new Date().toISOString(),
        reviewed_by: caller.id,
      })
      .eq("id", document_id);

    return json({ ok: true, review_status, verdict });
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
