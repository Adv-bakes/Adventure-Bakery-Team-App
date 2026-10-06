// Translates a staff notice between English and Spanish, for the "Post a notice" dialog.
// Expects: { title: string, body: string }
// Returns: { source: "en" | "es", title: string, body: string } - `source` is the language the
// notice was written in; title and body are the same notice in the OTHER language.
//
// The team is part English-speaking and part Spanish-speaking, and the person posting usually
// writes only one of the two. Nothing is written here: the dialog shows the translation, the person
// can change it, and it is posted through post_staff_notice like any other notice.
//
// Requires staff/admin, so it must never be callable anonymously (verify_jwt = true).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { aiJSON } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `You translate a notice that the management of a small bakery posts to its production team.
The notice is written in English or in Spanish. Decide which, then translate the title and the notice into the OTHER language (English to Spanish, Spanish to English).
- Translate everything and nothing else: do not add, drop, soften or explain anything.
- Keep every number, date, time, quantity, unit, name and document number (FRM-507, FSQM-006, SOP-2.3.1) exactly as written.
- Keep the line breaks and any list layout of the notice.
- Spanish: plain Latin American Spanish as spoken in a workplace in the United States, addressing the team as "ustedes". English: plain workplace English.
- If the title is empty, return an empty title.
Return JSON: {"source": "en" or "es" (the language the notice was WRITTEN in), "title": "<translated title>", "body": "<translated notice>"}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: isStaff } = await caller.rpc("is_staff_or_admin", { _user_id: user.id });
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const input = await req.json().catch(() => ({}));
    const title = typeof input?.title === "string" ? input.title.trim().slice(0, 200) : "";
    const body = typeof input?.body === "string" ? input.body.trim().slice(0, 10000) : "";
    if (!body) return json({ error: "Write the notice first." }, 400);

    const out = await aiJSON({ system: SYSTEM, user: JSON.stringify({ title, body }) });
    const source = out?.source === "es" ? "es" : out?.source === "en" ? "en" : null;
    const outBody = typeof out?.body === "string" ? out.body.trim() : "";
    const outTitle = typeof out?.title === "string" ? out.title.trim() : "";
    if (!source || !outBody || (title && !outTitle)) {
      return json({ error: "The translation came back incomplete. Try again." }, 502);
    }
    return json({ source, title: outTitle.slice(0, 200), body: outBody.slice(0, 10000) });
  } catch (e) {
    console.error("translate-notice", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
