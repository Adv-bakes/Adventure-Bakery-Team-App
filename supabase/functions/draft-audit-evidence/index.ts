// Drafts the "Objective evidence seen" for one FRM-010 Internal Audit Record findings line.
// Expects: { clause: "11.2.4 Pest Prevention", requirements: [{ id, text }], asOf: "yyyy-MM-dd" }
// Returns: { evidence: string, window: { from, to }, sources: [{ id, number, title, status, submitted, last }] }
//
// The facts are computed in code (_shared/auditEvidence.ts): which documents bear on the clause
// (their sqf_reference), and for each form the submitted entries in the twelve months up to the
// audit date, first/last, longest gap, and entries with a failed check. The model only writes them
// up. It drafts EVIDENCE ONLY - never a result - and the client shows the draft for the auditor to
// Use or Discard; nothing is written here. `sources` is built from the query, never from the model,
// so the chips the auditor sees cannot be invented.
//
// Runs with the caller's JWT so RLS decides what can be read, and requires staff/admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { aiJSON } from "../_shared/ai.ts";
import {
  assembleEvidence, auditWindow, clauseIdOf, flattenEntry, relatedToClause, summariseForm, type EntryLite,
} from "../_shared/auditEvidence.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SELF = "FRM-010";              // the audit record itself is never evidence for the audit
const MAX_ENTRIES_PER_FORM = 300;
const RECENT_LINES = 25;
const MAX_PROGRAM_CHARS = 2500;
const MAX_PROMPT_CHARS = 60000;
// `statement` is where a POLICY keeps its text (FSQM-002) - leaving it out sent the policy empty and
// the draft never mentioned it for 2.1.1.1.
const PROGRAM_KEYS = ["statement", "purpose", "scope", "responsibility", "procedure", "records"];

const asText = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join("\n");
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).map(asText).filter(Boolean).join(" · ");
  return String(v);
};
const prefixOf = (n: string) => n.trim().toUpperCase().split("-")[0];

const SYSTEM = `You draft the "Objective evidence seen" of an SQF internal audit finding for Adventure Bakery, a small bakery.
You are given the numbered requirements of the clause being audited and, UNDER EACH REQUIREMENT, the site documents and records referenced to it with FACTS computed from the records for the audit window. The full text of the governing documents follows.

Write ONE line per requirement, for EVERY requirement listed, in the order given.
- Use ONLY what is given. Never state a number, date, name or form that is not in it. Copy counts and dates exactly.
- Say which document addresses the requirement and, in a few words, how (e.g. "FSQM-002 Food Safety and Quality Policy is the site's policy statement, covering ..."). Cite each record by form number with its count and dates.
- If a form has no submitted entries in the window, say so. If a document requires something at a frequency and the facts show fewer records or a long gap, state the gap factually.
- Mention failed checks and CAPAs given, with their dates.
- If nothing is referenced to a requirement, write exactly: "No site document or record references this requirement."
- Do NOT say whether the site is compliant, and do not grade anything. The auditor decides. Do not describe observations or interviews - none were given to you.
- Plain English, 1 to 3 sentences and at most 400 characters per line. Do not repeat the requirement number inside the text.
Return JSON: {"lines": [{"clause": "<requirement number>", "text": "<the line>"}]}`;

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

    const body = await req.json().catch(() => ({}));
    const clauseCell = String(body?.clause ?? "").slice(0, 200);
    const clauseId = clauseIdOf(clauseCell);
    if (!clauseId) return json({ error: "The Clause cell needs a clause number, e.g. 11.2.4." }, 400);
    const supplied: { id: string; text: string }[] = (Array.isArray(body?.requirements) ? body.requirements : [])
      .filter((r: any) => typeof r?.id === "string" && clauseIdOf(r.id) && typeof r?.text === "string")
      .slice(0, 40)
      .map((r: any) => ({ id: clauseIdOf(r.id)!, text: r.text.slice(0, 1200) }));
    // Every numbered requirement gets a line; without any, the clause itself is the one line.
    const reqs = supplied.length ? supplied : [{ id: clauseId, text: clauseCell }];
    const { from, to } = auditWindow(String(body?.asOf ?? ""));

    const { data: docRows, error: docErr } = await caller
      .from("sop_documents")
      .select("id, sop_number, title, status, sqf_reference, content")
      .in("status", ["active", "draft"])
      .not("sqf_reference", "is", null);
    if (docErr) throw docErr;
    const related = (docRows ?? [])
      .filter((d: any) => d.sop_number && d.sop_number.trim().toUpperCase() !== SELF && relatedToClause(d.sqf_reference, clauseId))
      .sort((a: any, b: any) => a.sop_number.localeCompare(b.sop_number, undefined, { numeric: true }));

    const forms = related.filter((d: any) => prefixOf(d.sop_number) === "FRM");
    const programs = related.filter((d: any) => !["FRM", "REP", "TRN"].includes(prefixOf(d.sop_number)));
    const training = related.filter((d: any) => prefixOf(d.sop_number) === "TRN");

    // Entries for every related form in one query (plus drafts, which are counted but not evidence).
    const formIds = forms.map((f: any) => f.id);
    const byForm = new Map<string, EntryLite[]>();
    if (formIds.length) {
      const { data: entries, error: entErr } = await caller
        .from("sop_document_responses")
        .select("id, document_id, status, submitted_at, created_at, data")
        .in("document_id", formIds)
        .or(`and(status.eq.submitted,submitted_at.gte.${from},submitted_at.lte.${to}T23:59:59Z),status.eq.draft`)
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .limit(MAX_ENTRIES_PER_FORM * formIds.length);
      if (entErr) throw entErr;
      for (const e of entries ?? []) {
        const list = byForm.get((e as any).document_id) ?? [];
        if (list.length < MAX_ENTRIES_PER_FORM) list.push(e as EntryLite);
        byForm.set((e as any).document_id, list);
      }
    }

    // CAPAs in the window that name the clause or one of the related forms.
    const capaNames = [clauseId, ...forms.map((f: any) => f.sop_number)];
    const capaDoc = (docRows ?? []).find((d: any) => d.sop_number?.trim().toUpperCase() === "FRM-007");
    const capaLines: string[] = [];
    if (capaDoc) {
      const { data: capas } = await caller
        .from("sop_document_responses")
        .select("status, submitted_at, created_at, data")
        .eq("document_id", capaDoc.id)
        .gte("created_at", from)
        .limit(200);
      for (const c of capas ?? []) {
        const text = flattenEntry(capaDoc.content?.form_schema, (c as any).data, 500);
        if (capaNames.some(n => text.includes(n))) {
          capaLines.push(`- FRM-007 ${(c as any).status} (${String((c as any).submitted_at ?? (c as any).created_at).slice(0, 10)}): ${text}`);
        }
      }
    }

    const sources = forms.map((f: any) => {
      const s = summariseForm(byForm.get(f.id) ?? [], from, to);
      return { doc: f, s };
    });

    // ---- The prompt: per requirement, what is referenced to it and the facts; then the documents ----
    const factFor = new Map(sources.map(({ doc, s }) => [doc.id, s]));
    const describe = (d: any): string => {
      const draft = d.status === "draft" ? " (DRAFT, not yet issued)" : "";
      const s = factFor.get(d.id);
      if (!s) return `${d.sop_number} ${d.title}${draft}`;
      return `${d.sop_number} ${d.title}${draft}: ` +
        (s.submitted === 0
          ? "0 submitted entries in the window"
          : `${s.submitted} submitted entr${s.submitted === 1 ? "y" : "ies"}, first ${s.first}, last ${s.last}, longest gap ${s.longestGapDays} days` +
            (s.withFail.length ? `, failed or non-conforming answers on ${s.withFail.join(", ")}` : ", no failed or non-conforming answers")) +
        (s.drafts ? `; ${s.drafts} unsubmitted draft${s.drafts === 1 ? "" : "s"}` : "");
    };
    const coverage: Record<string, string[]> = {};
    const reqBlocks = reqs.map(r => {
      const docs = related.filter((d: any) => relatedToClause(d.sqf_reference, r.id));
      coverage[r.id] = docs.map((d: any) => d.sop_number);
      return `## ${r.id}: ${r.text}\nReferenced: ${docs.length ? "\n" + docs.map((d: any) => `- ${describe(d)}`).join("\n") : "nothing"}`;
    });
    const programText = programs.map((p: any) => {
      const c = p.content ?? {};
      const t = PROGRAM_KEYS.map(k => asText(c[k])).filter(Boolean).join("\n");
      return `### ${p.sop_number} ${p.title}${p.status === "draft" ? " (DRAFT)" : ""}\n${t.slice(0, MAX_PROGRAM_CHARS)}`;
    });
    const recent = sources.flatMap(({ doc }) =>
      (byForm.get(doc.id) ?? [])
        .filter(e => e.status === "submitted")
        .slice(0, RECENT_LINES)
        .map(e => `- ${doc.sop_number} ${String(e.submitted_at).slice(0, 10)}: ${flattenEntry(doc.content?.form_schema, e.data)}`));

    const head = [
      `CLAUSE: ${clauseCell}`,
      `AUDIT WINDOW: ${from} to ${to}`,
      `REQUIREMENTS (one line each, in this order):\n\n${reqBlocks.join("\n\n")}`,
      `CAPAs (FRM-007) naming this clause or its forms:\n${capaLines.join("\n") || "- none"}`,
      `TRAINING MODULES referencing this clause: ${training.map((t: any) => t.sop_number).join(", ") || "none"}`,
      `GOVERNING DOCUMENTS (text):\n${programText.join("\n\n") || "- none reference this clause"}`,
    ].join("\n\n");
    let tail = recent;
    let prompt = `${head}\n\nRECENT ENTRIES (most recent first, for detail only):\n${tail.join("\n")}`;
    while (prompt.length > MAX_PROMPT_CHARS && tail.length) {
      tail = tail.slice(0, Math.floor(tail.length * 0.7));
      prompt = `${head}\n\nRECENT ENTRIES (most recent first, for detail only):\n${tail.join("\n")}`;
    }
    if (prompt.length > MAX_PROMPT_CHARS) prompt = prompt.slice(0, MAX_PROMPT_CHARS);

    const out = await aiJSON({ system: SYSTEM, user: prompt });
    if (!Array.isArray(out?.lines) || out.lines.length === 0) return json({ error: "The AI returned no draft. Try again." }, 502);
    const evidence = assembleEvidence({ from, to }, reqs.map(r => r.id), out.lines, coverage);

    return json({
      evidence,
      window: { from, to },
      sources: [
        ...sources.map(({ doc, s }) => ({ id: doc.id, number: doc.sop_number, title: doc.title, status: doc.status, submitted: s.submitted, last: s.last })),
        ...programs.map((p: any) => ({ id: p.id, number: p.sop_number, title: p.title, status: p.status, submitted: null, last: null })),
      ],
    });
  } catch (e) {
    console.error("draft-audit-evidence", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
