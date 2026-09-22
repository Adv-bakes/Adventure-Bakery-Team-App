// Team Portal Manufacturing Coach chat. Answers staff questions from the site's own ACTIVE
// controlled documents (SOPs, FSQM programs, forms, policies, training) and cites them.
// Expects: { messages: [{ role: "user" | "assistant", content: string }] }
// Returns: { reply: string, sources: [{ id, number, title }] }
//
// Retrieval is two passes because keyword matching alone misses situational questions: "the
// Hobart mixer broke, what do I fill out?" says nothing about "maintenance", yet the answer lives
// in the maintenance program and its job record. So the model first picks documents from a
// one-line catalog, keyword hits and any document number the user typed are merged in as a
// backstop (a failed selection call degrades to keyword retrieval, never to an error), and only
// then is the answer written from the selected bodies.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4000;
const MAX_SELECTED = 8;
const MAX_BODY_CHARS = 12000;

type ChatMessage = { role: "user" | "assistant"; content: string };
type Doc = { id: string; number: string; title: string; type: string; revision: string; category: string; summary: string; body: string };

const BODY_KEYS: [string, string][] = [
  ["purpose", "Purpose"], ["scope", "Scope"], ["definitions", "Definitions"],
  ["responsibility", "Responsibility"], ["procedure", "Procedure"], ["form_references", "Form references"],
  ["records", "Records"], ["governing_reference", "Governing reference"], ["statement", "Policy statement"],
];

const STOP = new Set(("a an the and or but if of to in on at for with by from as is are was were be been it its this that these " +
  "those i we you he she they me my our your do does did what which who how when where why can could should would " +
  "will shall may might must need needs have has had not no yes so than then there here about into up down out over " +
  "any all some just also get got use used using one two".split(" ")));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const asText = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join("\n");
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).map(asText).filter(Boolean).join(" · ");
  return String(v);
};

// Section titles and field labels only — enough for the coach to say what a form asks for.
function formOutline(schema: any): string {
  if (!schema || !Array.isArray(schema.sections)) return "";
  const lines: string[] = [];
  for (const s of schema.sections) {
    const fields = Array.isArray(s?.fields) ? s.fields : [];
    const labels = fields.map((f: any) => {
      const cols = Array.isArray(f?.columns) ? f.columns.map((c: any) => c?.label).filter(Boolean) : [];
      return cols.length ? `${f?.label ?? ""} (table: ${cols.join(", ")})` : f?.label;
    }).filter(Boolean);
    lines.push(`- ${s?.title || "Section"}: ${labels.join("; ")}`);
  }
  return lines.join("\n");
}

function toDoc(row: any): Doc {
  const c = row.content && typeof row.content === "object" ? row.content : {};
  const parts: string[] = [];
  for (const [key, label] of BODY_KEYS) {
    const t = asText(c[key]);
    if (t) parts.push(`${label}:\n${t}`);
  }
  const outline = formOutline(c.form_schema);
  if (outline) parts.push(`Form fields:\n${outline}`);
  const narr = asText(c.narrations);
  if (narr) parts.push(`Training narration:\n${narr}`);
  const summary = (asText(c.purpose) || asText(c.scope) || asText(c.statement)).replace(/\s+/g, " ").slice(0, 200);
  return {
    id: row.id,
    number: (row.sop_number || "").trim() || "(no number)",
    title: row.title || "",
    type: row.type || "",
    revision: row.revision ? String(row.revision) : "",
    category: row.category || "",
    summary,
    body: parts.join("\n\n"),
  };
}

const tokens = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9áéíóúñü\- ]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));

const normNum = (s: string) => s.toUpperCase().replace(/\s+/g, "");

function keywordTop(docs: Doc[], query: string, n: number): Doc[] {
  const terms = [...new Set(tokens(query))];
  if (!terms.length) return [];
  return docs
    .map(d => {
      const t = d.title.toLowerCase(), b = d.body.toLowerCase();
      const score = terms.reduce((acc, w) => acc + (t.includes(w) ? 3 : 0) + (b.includes(w) ? 1 : 0), 0);
      return { d, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(x => x.d);
}

function mentionedNumbers(docs: Doc[], text: string): Doc[] {
  const found = new Set((text.toUpperCase().match(/\b(?:SOP|SSOP|FSQM|FRM|POL|TRN|REP)[-\s]?\d+(?:\.\d+)*\b/g) ?? [])
    .map(m => normNum(m).replace(/^([A-Z]+)(\d)/, "$1-$2")));
  return docs.filter(d => found.has(normNum(d.number)));
}

async function gateway(apiKey: string, messages: unknown[], jsonMode = false): Promise<string> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, ...(jsonMode ? { response_format: { type: "json_object" } } : {}) }),
  });
  if (!res.ok) throw new Error(`AI gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

const conversationText = (msgs: ChatMessage[]) =>
  msgs.map(m => `${m.role === "user" ? "Staff" : "Coach"}: ${m.content}`).join("\n");

async function selectDocs(apiKey: string, docs: Doc[], msgs: ChatMessage[]): Promise<Doc[]> {
  const catalog = docs.map(d => `${d.number} · ${d.type} · ${d.title}${d.summary ? ` — ${d.summary}` : ""}`).join("\n");
  const content = await gateway(apiKey, [
    {
      role: "system",
      content:
        "You choose which of a food manufacturer's controlled documents are needed to answer a staff member's latest question. " +
        "Think about the whole situation, not just the words used: e.g. equipment breaking down involves the maintenance program and " +
        "its job record, the equipment's own operating/cleaning SOP, sanitation and release before the equipment is used again, and " +
        "holding product that may be affected. Include the forms (FRM) that would have to be filled out. " +
        `Return JSON {"numbers": ["..."]} with at most ${MAX_SELECTED} document numbers, copied exactly from the catalog, most relevant first. ` +
        "Return an empty list if nothing applies.",
    },
    { role: "user", content: `CATALOG:\n${catalog}\n\nCONVERSATION:\n${conversationText(msgs.slice(-6))}` },
  ], true);
  const parsed = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  const wanted: string[] = Array.isArray(parsed?.numbers) ? parsed.numbers.map((n: unknown) => normNum(String(n))) : [];
  const byNum = new Map(docs.map(d => [normNum(d.number), d]));
  return wanted.map(n => byNum.get(n)).filter((d): d is Doc => !!d);
}

const ANSWER_PROMPT = `You are the Manufacturing Coach for Adventure Bakery staff (a bakery manufacturing site working to SQF Edition 9).
You answer questions about how this site does things, using the site's own controlled documents supplied below.

Rules:
- Base answers on the SUPPLIED DOCUMENTS and cite each one you rely on in square brackets with its exact number, e.g. [SOP-501] or [FRM-509].
- NEVER state a limit, concentration, temperature, time or frequency that is not written in a supplied document. If a number is needed and not supplied, say it is not in the documents.
- You may add general food-safety or equipment knowledge only when it helps, and you must label it on its own line starting "General guidance, not from our SOPs:" (in Spanish: "Orientación general, no de nuestros SOP:"). Anything that comes from a supplied document, including a training module, is not general guidance: cite it instead.
- If the documents do not cover the question, or disagree with each other, say so plainly and suggest asking the SQF Practitioner.
- The DOCUMENT INDEX lists every active document; you may point staff to one that is listed there but not supplied, by number and title, without describing its contents.
- For "what do I do / what do I fill out" questions, answer in two labeled parts: "Procedures to follow:" (numbered, in the order to do them) and "Records to fill out:" (each form number, what it is, and when to fill it). In Spanish, label them "Procedimientos a seguir:" and "Registros a llenar:".
- Write plain text: short paragraphs and "- " or "1. " lists. No markdown headings, no bold, no tables.
- Be concise and practical. Reply in the language the staff member wrote in (English or Spanish); keep document numbers as-is.
- Only discuss this site's manufacturing, food safety, quality, equipment and compliance work; politely decline anything else.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: isStaff } = await caller.rpc("is_staff_or_admin", { _user_id: user.id });
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const msgs: ChatMessage[] = (Array.isArray(body?.messages) ? body.messages : [])
      .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim())
      .slice(-MAX_MESSAGES)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
    if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ error: "Missing question" }, 400);

    // Caller's client, so RLS decides what the coach can read.
    const { data: rows, error } = await caller
      .from("sop_documents")
      .select("id, sop_number, title, type, revision, category, content")
      .eq("status", "active");
    if (error) throw error;
    const docs = (rows ?? []).map(toDoc);

    const recentUser = msgs.filter(m => m.role === "user").slice(-2).map(m => m.content).join("\n");
    let picked: Doc[] = [];
    try {
      picked = await selectDocs(apiKey, docs, msgs);
    } catch (e) {
      console.error("team-coach selection failed, falling back to keywords:", e);
    }
    const selected: Doc[] = [];
    for (const d of [...mentionedNumbers(docs, recentUser), ...picked, ...keywordTop(docs, recentUser, 3)]) {
      if (!selected.includes(d)) selected.push(d);
    }
    const supplied = selected.slice(0, MAX_SELECTED + 3);

    const index = docs.map(d => `${d.number} — ${d.title}`).sort().join("\n");
    const suppliedText = supplied.length
      ? supplied.map(d =>
          `=== ${d.number} — ${d.title} (${d.type}${d.revision ? `, rev ${d.revision}` : ""}) ===\n` +
          (d.body ? d.body.slice(0, MAX_BODY_CHARS) : "(no text body on file)")).join("\n\n")
      : "(no documents matched this question)";

    const reply = await gateway(apiKey, [
      { role: "system", content: `${ANSWER_PROMPT}\n\nDOCUMENT INDEX (all active documents):\n${index}\n\nSUPPLIED DOCUMENTS:\n${suppliedText}` },
      ...msgs,
    ]);
    if (!reply) return json({ error: "No reply returned" }, 502);

    // An English module and its Spanish variant share one number (the ES title ends " (ES)"), so
    // one citation matches two rows. Keep one chip per number, in the language of the reply.
    const cited = new Set((reply.toUpperCase().match(/[A-Z]+-\d+(?:\.\d+)*/g) ?? []).map(normNum));
    const byNumber = new Map<string, Doc>();
    for (const d of docs) {
      const key = normNum(d.number);
      if (!cited.has(key)) continue;
      const isEs = /\(ES\)\s*$/.test(d.title);
      const wantEs = reply.toUpperCase().includes(`${key} (ES)`);
      const current = byNumber.get(key);
      if (!current || (isEs === wantEs && /\(ES\)\s*$/.test(current.title) !== wantEs)) byNumber.set(key, d);
    }
    const sources = [...byNumber.values()].map(d => ({ id: d.id, number: d.number, title: d.title }));

    return json({ reply, sources });
  } catch (e) {
    console.error("team-coach error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
