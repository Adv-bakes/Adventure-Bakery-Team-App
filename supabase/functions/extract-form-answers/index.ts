// Reads a photograph of a FILLED-OUT paper QA form and returns the
// handwritten/checked answers for a known set of fields, so the digital entry
// (sop_document_responses) can be pre-filled. This is the mirror image of
// generate-form-schema: that function BUILDS a schema from a blank form's
// layout; this one FILLS an existing schema's fields from a completed copy.
//
// The result is a PROPOSAL — the client merges it into the on-screen form and
// the user reviews/corrects before anything is saved. Handwriting OCR is never
// perfect, so we omit unreadable fields rather than guess.
//
// Expects: {
//   manifest: FieldManifest[],   // the value-bearing fields to fill (no signatures)
//   imageUrls: string[]          // signed URLs of the photographed page(s)
// }
// Returns: { answers: { [fieldId]: value }, warnings: string[] }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Field types the client sends in the manifest. `signature` is filtered out
// client-side (answerManifest) and defensively dropped again here.
const SCALAR_TYPES = new Set([
  "text", "textarea", "number", "date", "time", "datetime", "checkbox", "select", "pass_fail",
]);
const GRID_COLUMN_TYPES = new Set(["text", "number", "date", "time", "checkbox", "select", "pass_fail"]);

const SYSTEM_PROMPT = `You read a photograph (or several pages) of a FILLED-OUT paper bakery quality-assurance form and return the values the person wrote or checked, for a specific list of fields you are given.

You are given a JSON "manifest" array. Each item describes one field: { "id", "type", "label", "options"?, "columns"?, "rowMode"?, "rowLabels"? }. Return ONLY answers keyed by these exact ids. Never invent ids. Never return a field that is not in the manifest.

Read the handwriting, printed text, checkmarks, and X marks in the photo. Match each field by its label (and section context) to what is written on the paper. Output the value in EXACTLY the format required by the field's type:
- "text" / "textarea": the written string, transcribed verbatim (fix only obvious OCR ambiguity). Clean up nothing else.
- "number": a number (e.g. 12, 68.5). Strip units/labels.
- "date": "YYYY-MM-DD". Interpret dates like 7/12/2026 or 7/12/26 as US month/day/year.
- "time": 24-hour "HH:MM" (e.g. "12:05", "13:30"). Convert AM/PM (12:00 PM -> "12:00", 12:30 PM -> "12:30", 1:00 PM -> "13:00").
- "datetime": "YYYY-MM-DDTHH:MM".
- "checkbox": boolean true if the box is ticked/checked/Xed, false if clearly empty. If you cannot tell, omit the field.
- "pass_fail": one of "pass", "fail", "na" (map Yes/OK/✓ -> "pass", No/Not-OK/✗ -> "fail", N/A -> "na").
- "select": EXACTLY one of the provided "options" strings (match the checked/circled/written choice). If it is a multi-choice, return an array of matching option strings. If nothing on the paper matches an option, omit the field.
- "grid": an array of row objects. Each row object is keyed by the grid's column ids (from "columns"). Include only rows the filler actually wrote on the paper. For a fixed-row grid ("rowMode":"fixed") the "rowLabels" tell you which pre-listed item each row is; return rows in that order and only for rows that were filled. Each cell follows its column's type using the same rules above.

CRITICAL RULES:
- OMIT any field you cannot read confidently. Do NOT guess and do NOT output empty strings/zeros as filler. A missing key is correct when the paper is blank or illegible for that field.
- Do NOT transcribe the pre-printed form header (form number, revision, effective date, approved-by) — those are not in the manifest and the app already tracks them.
- Add a short note to "warnings" for any field that was present on the paper but ambiguous/hard to read.

Respond with ONLY this JSON object (no markdown):
{"answers": { "field_id": <value>, ... }, "warnings": ["..."]}`;

/** Parse a value against a manifest field's type; return undefined to omit. */
function coerceScalar(type: string, value: unknown, options?: string[]): any {
  if (value == null) return undefined;
  switch (type) {
    case "checkbox":
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const v = value.trim().toLowerCase();
        if (["true", "yes", "y", "x", "checked", "✓"].includes(v)) return true;
        if (["false", "no", "n", "", "unchecked"].includes(v)) return false;
      }
      return undefined;
    case "number": {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      const n = Number(String(value).replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) && String(value).trim() !== "" ? n : undefined;
    }
    case "pass_fail": {
      const v = String(value).trim().toLowerCase();
      if (["pass", "fail", "na"].includes(v)) return v;
      if (["yes", "ok", "✓", "y"].includes(v)) return "pass";
      if (["no", "✗", "n"].includes(v)) return "fail";
      if (["n/a"].includes(v)) return "na";
      return undefined;
    }
    case "select": {
      const opts = Array.isArray(options) ? options : [];
      const pick = (s: unknown) => {
        const str = String(s).trim();
        const hit = opts.find(o => o.toLowerCase() === str.toLowerCase());
        return hit; // undefined if no match
      };
      if (Array.isArray(value)) {
        const matched = value.map(pick).filter((x): x is string => !!x);
        return matched.length ? matched : undefined;
      }
      return pick(value);
    }
    case "date": case "time": case "datetime": case "text": case "textarea":
    default: {
      const s = String(value).trim();
      return s ? s.slice(0, 5000) : undefined;
    }
  }
}

/** Whitelist/coerce the model's answers against the manifest; collect warnings. */
function sanitizeAnswers(rawAnswers: any, manifest: any[], warnings: string[]) {
  const byId = new Map<string, any>();
  for (const item of Array.isArray(manifest) ? manifest : []) {
    if (item && typeof item.id === "string") byId.set(item.id, item);
  }
  const out: Record<string, any> = {};
  if (!rawAnswers || typeof rawAnswers !== "object") return out;

  for (const [id, value] of Object.entries(rawAnswers)) {
    const field = byId.get(id);
    if (!field) continue;                       // unknown id
    const type = String(field.type ?? "");
    if (type === "signature") continue;         // never auto-filled

    if (type === "grid") {
      const cols = new Map<string, any>();
      for (const c of Array.isArray(field.columns) ? field.columns : []) {
        if (c && typeof c.id === "string") cols.set(c.id, c);
      }
      const rows = (Array.isArray(value) ? value : [])
        .map((row: any) => {
          if (!row || typeof row !== "object") return null;
          const cleaned: Record<string, any> = {};
          for (const [colId, cellVal] of Object.entries(row)) {
            const col = cols.get(colId);
            if (!col || !GRID_COLUMN_TYPES.has(String(col.type))) continue;
            const coerced = coerceScalar(String(col.type), cellVal, col.options);
            if (coerced !== undefined) cleaned[colId] = coerced;
          }
          return Object.keys(cleaned).length ? cleaned : null;
        })
        .filter((r: any): r is Record<string, any> => r !== null);
      if (rows.length) out[id] = rows;
      continue;
    }

    if (!SCALAR_TYPES.has(type)) continue;
    const coerced = coerceScalar(type, value, field.options);
    if (coerced !== undefined) out[id] = coerced;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { manifest, imageUrls } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    if (!Array.isArray(manifest) || manifest.length === 0) {
      return json({ error: "Missing manifest" }, 400);
    }
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return json({ error: "Missing imageUrls" }, 400);
    }

    const userContent = [
      {
        type: "text",
        text:
          "Photographed page(s) of a filled-out paper form follow. Fill these fields " +
          "(the manifest describes each field's id, type, and any allowed options):\n\n" +
          JSON.stringify(manifest).slice(0, 40000),
      },
      ...imageUrls.slice(0, 10).map((url: string) => ({ type: "image_url", image_url: { url } })),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status, await response.text());
      return json({ error: "AI gateway error" }, 502);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return json({ error: "AI returned unparseable content" }, 502);
      parsed = JSON.parse(match[0]);
    }

    const warnings: string[] = Array.isArray(parsed?.warnings)
      ? parsed.warnings.map((w: any) => String(w).slice(0, 300)).slice(0, 25)
      : [];
    const answers = sanitizeAnswers(parsed?.answers ?? parsed, manifest, warnings);
    return json({ answers, warnings });
  } catch (e) {
    console.error("extract-form-answers error:", e);
    return json({ error: String(e) }, 500);
  }
});
