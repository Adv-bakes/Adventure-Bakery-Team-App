// Auto-sends NDA + PSS magic link to a prospect after PRF acceptance.
// Called from SalesDocumentsInbox.accept() — caller must be staff.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

function randomToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isStaff } = await admin.rpc("is_staff_or_admin", { _user_id: u.user.id });
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const { leadId, prospectEmail: emailOverride } = await req.json();
    if (!leadId) return json({ error: "leadId required" }, 400);

    const { data: lead, error: leadErr } = await admin
      .from("sales_leads")
      .select("id, email, contact_name, company_name")
      .eq("id", leadId)
      .single();
    if (leadErr || !lead) return json({ error: "Lead not found" }, 404);

    const prospectEmail = (emailOverride || lead.email).toLowerCase();

    // Mint token + empty draft.
    const token = randomToken();
    const { error: tokErr } = await admin.from("document_send_tokens").insert({
      token,
      lead_id: lead.id,
      prospect_email: prospectEmail,
      contact_name: lead.contact_name,
      company_name: lead.company_name,
      created_by: u.user.id,
    });
    if (tokErr) return json({ error: tokErr.message }, 500);

    await admin.rpc("create_pss_draft_for_token", { _token: token, _product_label: null });

    // Pull active NDA template.
    const { data: nda } = await admin
      .from("document_templates")
      .select("file_path, file_name")
      .eq("kind", "nda")
      .eq("is_active", true)
      .maybeSingle();
    const { data: workbook } = await admin
      .from("document_templates")
      .select("file_path, file_name")
      .eq("kind", "pss_workbook")
      .eq("is_active", true)
      .maybeSingle();

    let ndaAttachment: { filename: string; content: string } | null = null;
    let workbookUrl: string | null = null;
    if (nda?.file_path) {
      const { data: file } = await admin.storage.from("document-templates").download(nda.file_path);
      if (file) {
        const buf = new Uint8Array(await file.arrayBuffer());
        let bin = "";
        const chunk = 0x8000;
        for (let i = 0; i < buf.length; i += chunk) {
          bin += String.fromCharCode(...buf.subarray(i, i + chunk));
        }
        const b64 = btoa(bin);
        ndaAttachment = { filename: nda.file_name || "NDA.pdf", content: b64 };
      }
    }
    if (workbook?.file_path) {
      const { data: signed } = await admin.storage
        .from("document-templates")
        .createSignedUrl(workbook.file_path, 60 * 60 * 24 * 60);
      workbookUrl = signed?.signedUrl ?? null;
    }

    const origin = req.headers.get("origin") || "https://adventurebakery.info";
    const magicLink = `${origin}/p/pss/${token}`;
    const firstName = (lead.contact_name || "there").split(" ")[0];

    const html = renderEmail({
      firstName,
      magicLink,
      workbookUrl,
      hasNda: !!ndaAttachment,
      hasWorkbook: !!workbookUrl,
    });

    const body: Record<string, unknown> = {
      from: "Adventure Bakery <scale@adventurebakery.info>",
      to: [prospectEmail],
      cc: ["scale@adventurebakery.info"],
      subject: "Next step with Adventure Bakery — your NDA + product spec sheet",
      html,
      reply_to: "scale@adventurebakery.info",
    };
    if (ndaAttachment) body.attachments = [ndaAttachment];

    let emailError: string | null = null;
    let resendId: string | null = null;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify(body),
      });
      const rData = await r.json();
      if (!r.ok) {
        console.error("Resend error", rData);
        emailError = typeof rData?.message === "string" ? rData.message : "Email send failed";
      } else {
        resendId = rData.id ?? null;
      }
    } catch (e) {
      console.error("Resend fetch failed", e);
      emailError = String((e as any)?.message ?? e);
    }

    // Advance lead to Send Documents regardless of email outcome — staff has the magic link.
    await admin
      .from("sales_leads")
      .update({ stage: "Send Documents", stage_updated_at: new Date().toISOString() })
      .eq("id", lead.id);

    // Log to client_activity if a profile is linked.
    await admin.from("client_activity").insert({
      client_id: lead.id,
      actor_id: u.user.id,
      action: "documents_sent",
      payload: { email: prospectEmail, magicLink, hasNda: !!ndaAttachment, hasWorkbook: !!workbookUrl, emailError },
    });

    return json({ success: true, token, magicLink, resendId, emailError }, 200);
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function renderEmail(p: {
  firstName: string;
  magicLink: string;
  workbookUrl: string | null;
  hasNda: boolean;
  hasWorkbook: boolean;
}) {
  const workbookBlock = p.hasWorkbook
    ? `<p style="margin:16px 0 0;font-size:13px;color:hsl(30,15%,55%);">
         Prefer to fill it offline? <a href="${p.workbookUrl}" style="color:hsl(43,52%,40%);">Download the PSS workbook (.xlsx)</a> and reply to this email with it filled in.
       </p>`
    : "";
  const ndaLine = p.hasNda
    ? "Sign the attached NDA PDF and upload it at the secure link below."
    : "Your NDA will be sent separately by the team.";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fff;font-family:-apple-system,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td align="center" style="padding-bottom:24px;"><span style="font-size:22px;font-weight:700;color:hsl(25,35%,15%);">Adventure Bakery</span></td></tr>
  <tr><td style="background:hsl(40,33%,94%);border-radius:12px;padding:36px 32px;">
    <h1 style="margin:0 0 12px;font-size:20px;color:hsl(25,35%,15%);">Two short next steps</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:hsl(30,15%,40%);">Hi ${p.firstName}, thanks for moving forward with us. To kick off product development, we need two things from you:</p>

    <h2 style="margin:24px 0 6px;font-size:15px;color:hsl(25,35%,15%);">1. NDA</h2>
    <p style="margin:0;font-size:14px;line-height:1.6;color:hsl(30,15%,40%);">${ndaLine}</p>

    <h2 style="margin:24px 0 6px;font-size:15px;color:hsl(25,35%,15%);">2. Product Spec Sheet (PSS)</h2>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:hsl(30,15%,40%);">The easiest way is to fill it online. It auto-saves so you can step away and come back to the same link any time.</p>
    <p style="margin:0 0 8px;font-size:13px;color:hsl(30,15%,55%);font-weight:600;">Sections we'll cover (so you can gather what you need):</p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:13px;line-height:1.7;color:hsl(30,15%,45%);">
      <li>Company &amp; product info</li>
      <li>Target unit weight &amp; dimensions</li>
      <li>Recipe — ingredients with their weights per batch</li>
      <li>Process — mixing, forming, baking, freezing</li>
      <li>Packaging — retail unit, case, pallet</li>
      <li>Optional — nutritionals, allergens, shelf-life data</li>
    </ul>
    ${workbookBlock}

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 4px;"><tr><td style="background:hsl(25,35%,15%);border-radius:8px;">
      <a href="${p.magicLink}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;">Open your secure link →</a>
    </td></tr></table>
    <p style="margin:8px 0 0;font-size:12px;color:hsl(30,15%,55%);word-break:break-all;">${p.magicLink}</p>
  </td></tr>
  <tr><td align="center" style="padding-top:24px;"><p style="margin:0;font-size:12px;color:hsl(30,15%,60%);">Adventure Bakery · Kitchen to Factory</p></td></tr>
</table></td></tr></table></body></html>`;
}
