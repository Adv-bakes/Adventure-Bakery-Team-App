// Proposes a fillable form schema (content.form_schema shape) from a paper
// form's source document. The client extracts the .docx to HTML with mammoth
// (tables intact) and sends it here; scanned PDFs can later send page images.
// The result is a PROPOSAL — the admin reviews it in FormSchemaBuilder and
// nothing persists until they save.
//
// Expects: {
//   title: string,
//   formNumber?: string,
//   source: { kind: "html", html: string } | { kind: "pdf_images", urls: string[] }
// }
// Returns: { schema: FormSchema, warnings: string[] }
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SCALAR_TYPES = new Set([
  "text", "textarea", "number", "date", "time", "datetime",
  "checkbox", "select", "pass_fail", "signature", "heading", "info",
]);
const GRID_COLUMN_TYPES = new Set(["text", "number", "date", "time", "checkbox", "select", "pass_fail"]);

const SYSTEM_PROMPT = `You convert paper bakery quality-assurance forms into a JSON form schema for a web app. Preserve the paper document's structure faithfully:
- Every section heading on the paper becomes a section ({ "id", "title", "fields": [] }).
- Every table becomes a "grid" field with typed columns. Infer column types from headers and cell hints: temperatures/weights/counts -> "number" (set "unit" when the header shows one, e.g. °F, lbs), dates -> "date", times -> "time", checkmark cells -> "checkbox", Pass/Fail or OK/Not-OK or ✓/✗ cells -> "pass_fail", short lists of allowed values -> "select" with "options". Tables with repeated blank rows for the filler -> rows { "mode": "dynamic", "min": 1 }. Tables whose first column pre-lists items (equipment names, areas, days) -> rows { "mode": "fixed", "labels": [...those values...] } and do NOT also make that first column a column.
- Signature / initials / "completed by" / "reviewed by" lines become "signature" fields. Reviewer/verifier/QA-manager/supervisor signatures get "role": "verifier"; the person filling the form gets "role": "filler".
- Standalone labeled blanks become scalar fields ("text", "number", "date", "time", "checkbox", "select", "pass_fail"). Long remark/comment areas -> "textarea".
- Instructional paragraphs that the filler only reads become { "type": "info", "id", "label": short name, "text": the instructions }.
- Field ids are stable snake_case slugs derived from labels, unique across the whole form. Grid column ids are snake_case, unique within their grid.
- Mark a field "required": true only when the paper clearly demands it (e.g. marked with *, or a mandatory log column).
- Do NOT invent fields that are not on the paper. Do NOT include the document header block (form number / revision / effective date) as fields — the app tracks those already.
- Optional layout hint "width": "full" | "half" | "third" for scalar fields that sit side by side on the paper.

Respond with ONLY this JSON object (no markdown):
{"schema": {"schemaVersion": 1, "settings": {}, "sections": [{"id": "section_1", "title": "...", "fields": [
  {"id": "supplier_name", "type": "text", "label": "Supplier Name", "required": true, "width": "half"},
  {"id": "receiving_log", "type": "grid", "label": "Receiving Log", "columns": [
    {"id": "product", "type": "text", "label": "Product"},
    {"id": "temp", "type": "number", "label": "Temp", "unit": "°F"},
    {"id": "condition", "type": "pass_fail", "label": "Condition OK"}
  ], "rows": {"mode": "dynamic", "min": 1}},
  {"id": "completed_by", "type": "signature", "label": "Completed By", "role": "filler"},
  {"id": "verified_by", "type": "signature", "label": "Verified By", "role": "verifier"}
]}]}}`;

const slugify = (label: string, taken: Set<string>): string => {
  let base = String(label ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
  if (!base) base = "field";
  if (/^\d/.test(base)) base = `f_${base}`;
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}_${n++}`;
  taken.add(id);
  return id;
};

/** Whitelist/normalize the model's proposal; collect what got dropped. */
function sanitizeSchema(raw: any, warnings: string[]) {
  const sections = Array.isArray(raw?.sections) ? raw.sections : [];
  const fieldIds = new Set<string>();
  const sectionIds = new Set<string>();

  const cleanSections = sections.map((section: any) => {
    const fields = (Array.isArray(section?.fields) ? section.fields : [])
      .map((field: any) => {
        const type = String(field?.type ?? "");
        const label = String(field?.label ?? "").trim().slice(0, 200);
        if (type !== "grid" && !SCALAR_TYPES.has(type)) {
          warnings.push(`Dropped "${label || "unnamed"}" — unknown field type "${type}"`);
          return null;
        }
        if (!label && type !== "info") {
          warnings.push(`Dropped a ${type} field with no label`);
          return null;
        }
        const id = slugify(typeof field.id === "string" && field.id ? field.id : label, fieldIds);
        const out: Record<string, unknown> = { id, type, label };
        if (field.required === true) out.required = true;
        if (typeof field.help === "string" && field.help.trim()) out.help = field.help.trim().slice(0, 300);
        if (["full", "half", "third"].includes(field.width)) out.width = field.width;

        if (type === "select") {
          const options = (Array.isArray(field.options) ? field.options : [])
            .map((o: any) => String(o).trim().slice(0, 120)).filter(Boolean);
          if (options.length === 0) {
            warnings.push(`Dropdown "${label}" had no options — converted to text`);
            out.type = "text";
          } else {
            out.options = options;
            if (field.multiple === true) out.multiple = true;
          }
        }
        if (type === "number") {
          if (typeof field.min === "number") out.min = field.min;
          if (typeof field.max === "number") out.max = field.max;
          if (typeof field.unit === "string" && field.unit.trim()) out.unit = field.unit.trim().slice(0, 20);
        }
        if (type === "pass_fail" && field.naAllowed === false) out.naAllowed = false;
        if (type === "signature") {
          out.role = field.role === "verifier" ? "verifier" : "filler";
          if (typeof field.statement === "string" && field.statement.trim()) out.statement = field.statement.trim().slice(0, 300);
        }
        if (type === "info") out.text = String(field.text ?? label).trim().slice(0, 2000);

        if (type === "grid") {
          const colIds = new Set<string>();
          const columns = (Array.isArray(field.columns) ? field.columns : [])
            .map((col: any) => {
              const colLabel = String(col?.label ?? "").trim().slice(0, 120);
              const colType = GRID_COLUMN_TYPES.has(String(col?.type)) ? String(col.type) : "text";
              if (!colLabel) return null;
              const colOut: Record<string, unknown> = {
                id: slugify(typeof col.id === "string" && col.id ? col.id : colLabel, colIds),
                label: colLabel,
                type: colType,
              };
              if (colType === "select") {
                const opts = (Array.isArray(col.options) ? col.options : [])
                  .map((o: any) => String(o).trim().slice(0, 120)).filter(Boolean);
                if (opts.length === 0) colOut.type = "text";
                else colOut.options = opts;
              }
              if (typeof col.unit === "string" && col.unit.trim()) colOut.unit = col.unit.trim().slice(0, 20);
              if (col.required === true) colOut.required = true;
              return colOut;
            })
            .filter(Boolean);
          if (columns.length === 0) {
            warnings.push(`Dropped grid "${label}" — no usable columns`);
            return null;
          }
          out.columns = columns;
          const rows = field.rows ?? {};
          if (rows.mode === "fixed" && Array.isArray(rows.labels) && rows.labels.length > 0) {
            // Unlike column headers, a fixed row label can be a full review-item
            // block (title + description + target line joined by \n) — 120 chars
            // truncated these mid-sentence.
            out.rows = { mode: "fixed", labels: rows.labels.map((l: any) => String(l).trim().slice(0, 1000)).filter(Boolean) };
          } else {
            const rowsOut: Record<string, unknown> = { mode: "dynamic" };
            if (typeof rows.min === "number" && rows.min >= 0) rowsOut.min = rows.min;
            if (typeof rows.max === "number" && rows.max > 0) rowsOut.max = rows.max;
            out.rows = rowsOut;
          }
        }
        return out;
      })
      .filter(Boolean);

    return {
      id: slugify(typeof section?.id === "string" && section.id ? section.id : (section?.title || "section"), sectionIds),
      ...(typeof section?.title === "string" && section.title.trim() ? { title: section.title.trim().slice(0, 200) } : {}),
      ...(typeof section?.description === "string" && section.description.trim() ? { description: section.description.trim().slice(0, 500) } : {}),
      fields,
    };
  }).filter((s: any) => s.fields.length > 0);

  return { schemaVersion: 1, settings: {}, sections: cleanSections };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, formNumber, source } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    let userContent: unknown;
    if (source?.kind === "html" && typeof source.html === "string" && source.html.trim()) {
      userContent =
        `Form: ${title ?? "Untitled"}${formNumber ? ` (${formNumber})` : ""}\n\n` +
        `HTML extracted from the original Word document (tables preserved):\n\n` +
        source.html.slice(0, 60000);
    } else if (source?.kind === "pdf_images" && Array.isArray(source.urls) && source.urls.length > 0) {
      userContent = [
        { type: "text", text: `Form: ${title ?? "Untitled"}${formNumber ? ` (${formNumber})` : ""}\nScanned pages of the paper form follow.` },
        ...source.urls.slice(0, 10).map((url: string) => ({ type: "image_url", image_url: { url } })),
      ];
    } else {
      return json({ error: "Missing source (html or pdf_images)" }, 400);
    }

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

    const warnings: string[] = [];
    const schema = sanitizeSchema(parsed?.schema ?? parsed, warnings);
    if (schema.sections.length === 0) {
      return json({ error: "No usable fields could be extracted from the document" }, 502);
    }
    return json({ schema, warnings });
  } catch (e) {
    console.error("generate-form-schema error:", e);
    return json({ error: String(e) }, 500);
  }
});
