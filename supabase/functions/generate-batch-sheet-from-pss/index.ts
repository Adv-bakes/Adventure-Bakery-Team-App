// Generates an internal Batch Sheet from an approved PSS.
// Upserts on pss_document_id — re-running overwrites (per spec).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const { data: { user: caller } } = await anon.auth.getUser();
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isStaff } = await admin.rpc("is_staff_or_admin", { _user_id: caller.id });
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const { pss_document_id } = await req.json();
    if (!pss_document_id) return json({ error: "pss_document_id required" }, 400);

    const { data: pss } = await admin
      .from("client_documents")
      .select("*")
      .eq("id", pss_document_id)
      .maybeSingle();
    if (!pss) return json({ error: "PSS not found" }, 404);

    // Validate user_id is a real UUID before storing in uuid columns
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const clientUserId = pss.user_id && UUID_RE.test(pss.user_id) ? pss.user_id : null;

    // Pull lead, falling back to email lookup via the uploader profile
    let lead: any = null;
    if (clientUserId) {
      const r = await admin.from("sales_leads").select("id, profile_id").eq("profile_id", clientUserId).maybeSingle();
      lead = r.data;
    }
    if (!lead && clientUserId) {
      const { data: prof } = await admin.from("profiles").select("email").eq("id", clientUserId).maybeSingle();
      if (prof?.email) {
        const r = await admin.from("sales_leads").select("id, profile_id").eq("email", prof.email.toLowerCase()).maybeSingle();
        lead = r.data;
      }
    }

    // Source data: prefer the AI-extracted blob from review_notes
    const extracted = (pss.review_notes && pss.review_notes.extracted) || {};
    const dataJson = {
      product_name: extracted.product_name || null,
      company_name: extracted.company_name || null,
      ingredients: extracted.ingredients || [],
      process_steps: extracted.process_steps || [],
      equipment: [],
      source_pss_id: pss_document_id,
      generated_at: new Date().toISOString(),
    };

    const { data: upserted, error: upsertErr } = await admin
      .from("batch_sheets")
      .upsert({
        pss_document_id,
        lead_id: lead?.id || null,
        client_user_id: clientUserId,
        status: "draft",
        data_json: dataJson,
        generated_from: "pss",
        updated_at: new Date().toISOString(),
      }, { onConflict: "pss_document_id" })
      .select()
      .single();

    if (upsertErr) return json({ error: upsertErr.message }, 500);

    if (lead?.profile_id) {
      await admin.from("client_activity").insert({
        client_id: lead.profile_id,
        actor_id: caller.id,
        action: "batch_sheet_drafted",
        payload: { pss_document_id, batch_sheet_id: upserted.id },
      });
    }

    return json({ ok: true, batch_sheet: upserted });
  } catch (e) {
    console.error("generate-batch-sheet-from-pss error:", e);
    return json({ error: (e as Error).message || "Unknown error" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
