// Reads a photograph of an INGREDIENT PACKAGE (a bag/case/tote of flour, cake
// base, egg, …) and returns the identifying facts printed on it, so one row of a
// batch/formulation grid can be filled without typing.
//
// Sibling of extract-form-answers, but a different job: that one reads a
// filled-out PAPER FORM and answers a whole schema; this one reads a PRODUCT
// LABEL and answers a fixed, closed set of facts about the pack.
//
// The result is a PROPOSAL — the client drops it into the row's visible cells
// with an Undo, and the worker checks it before saving. The lot code is the
// traceability spine of the record, so we would rather return nothing than a
// confident-looking wrong number.
//
// Expects: { imageUrls: string[], wanted?: string[] }
// Returns: { facts: {..}, alternates: { lot_code: string[] }, extras: [{label,value}], warnings: string[] }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Mirrors LABEL_FACTS in src/lib/formSchema.ts. Deliberately has NO allergen
// key: allergen declarations are a regulated statement that must come off the
// spec sheet, not off whatever fraction of an ingredient panel is in frame.
const FACT_KEYS = [
  "product_name", "brand", "lot_code", "best_by",
  "item_code", "net_weight", "pack_size", "plant_code", "barcode",
] as const;
type FactKey = (typeof FACT_KEYS)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const SYSTEM_PROMPT = `You read a photograph of a FOOD INGREDIENT PACKAGE (a bag, case, sack, pail or tote received at a bakery) and report the identifying information printed on it. A worker is staging this ingredient for a production batch and needs its identity and lot code recorded.

Return ONLY these fact keys, and only the ones you can actually read:
- "product_name": the product/ingredient description as printed (e.g. "Creme Cake Base"). Exclude the brand and any internal plant/spec codes.
- "brand": the brand or manufacturer printed on the artwork (e.g. "Pillsbury"). This is the maker, NOT necessarily the company the bakery bought it from — never infer or invent a distributor.
- "lot_code": the LOT / BATCH / production code. See the rules below; this one matters most.
- "best_by": a best-by / use-by / expiration date, as "YYYY-MM-DD". Interpret ambiguous numeric dates as US month/day/year.
- "item_code": the manufacturer's item / product / SKU number (e.g. a "GMI 013920808" or "39208" item number).
- "net_weight": net weight exactly as printed, with its unit (e.g. "50 LB").
- "pack_size": pack/case configuration if stated (e.g. "6/5 LB").
- "plant_code": a plant/facility code if one is identifiable as such.
- "barcode": the human-readable digits printed under a barcode (UPC/GTIN).

IDENTIFYING THE LOT CODE — the single most important distinction:
- The lot code is VARIABLE information applied AFTER printing: ink-jet, dot-matrix, laser, or a stamped/handwritten mark. It typically looks lower-quality than the surrounding artwork, sits in an otherwise blank area, and often combines a date fragment with letters and digits (e.g. "10MAY6 MR 0047 1 11418", "L2 4193 A", "B0824 21:14").
- PRE-PRINTED numbers are NOT the lot code: the item/SKU number, the digits under the barcode, the net weight, a phone number, a spec or copyright code. If a number is part of the printed artwork, it is not the lot.
- If more than one code could be the lot, pick the one that best fits the description above and put EVERY other candidate string in "alternates".lot_code. Never return a barcode or item number as "lot_code".
- If nothing on the pack looks like variable-applied code, omit "lot_code" entirely and say so in "warnings". Omitting it is correct; guessing is not.

OTHER RULES:
- Transcribe codes CHARACTER FOR CHARACTER, preserving spacing and case. Do not normalize, reformat, or "correct" a lot code. If a character is genuinely ambiguous (0/O, 1/I/l, 5/S, 8/B), transcribe your best reading and add a warning naming the ambiguity.
- A compressed or Julian date code that you cannot resolve to a real calendar date must NOT go in "best_by" — put the raw string in "extras" instead.
- Do NOT read or report the ingredient statement, the allergen ("Contains:") statement, or nutrition panel. Ignore them entirely.
- Anything else clearly readable and useful for identifying this pack (e.g. storage instructions, a "Keep Frozen" mark, a country of origin) goes in "extras" as {"label","value"} pairs. Keep extras short — at most 5.
- Omit any key you cannot read confidently. A missing key is correct when the pack does not show it or the photo is unclear. Never output empty strings or placeholders.
- If the photo does not show a food ingredient package at all, return empty facts and explain in "warnings".

Respond with ONLY this JSON object (no markdown):
{"facts": {"lot_code": "...", ...}, "alternates": {"lot_code": ["..."]}, "extras": [{"label":"...","value":"..."}], "warnings": ["..."]}`;

const cleanString = (value: unknown, max = 200): string | undefined => {
  if (value == null || typeof value === "object") return undefined;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "n/a") return undefined;
  return s.slice(0, max);
};

/** Whitelist the model's output down to known keys + safe strings. */
function sanitize(parsed: any, wanted: Set<FactKey>) {
  const facts: Record<string, string> = {};
  const extras: { label: string; value: string }[] = [];
  const warnings: string[] = Array.isArray(parsed?.warnings)
    ? parsed.warnings.map((w: any) => cleanString(w, 300)).filter(Boolean).slice(0, 10) as string[]
    : [];

  const rawFacts = parsed?.facts && typeof parsed.facts === "object" ? parsed.facts : {};
  for (const key of FACT_KEYS) {
    if (!wanted.has(key)) continue;
    const value = cleanString(rawFacts[key]);
    if (!value) continue;
    // A date the model failed to normalize is still information — keep it as a
    // detail rather than feeding a native date input something it renders blank.
    if (key === "best_by" && !ISO_DATE.test(value)) {
      extras.push({ label: "Date code", value });
      continue;
    }
    facts[key] = value;
  }

  const rawAlternates = parsed?.alternates?.lot_code;
  const lotAlternates = (Array.isArray(rawAlternates) ? rawAlternates : [])
    .map((a: any) => cleanString(a))
    .filter((a): a is string => !!a && a !== facts.lot_code)
    .slice(0, 6);

  for (const item of Array.isArray(parsed?.extras) ? parsed.extras : []) {
    const value = cleanString(item?.value ?? item);
    if (!value) continue;
    extras.push({ label: cleanString(item?.label, 60) ?? "Detail", value });
    if (extras.length >= 6) break;
  }

  return { facts, alternates: { lot_code: lotAlternates }, extras, warnings };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrls, wanted } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return json({ error: "Missing imageUrls" }, 400);
    }
    // An empty/absent list means "everything we know how to read".
    const requested = Array.isArray(wanted) && wanted.length
      ? new Set(FACT_KEYS.filter(k => wanted.includes(k)))
      : new Set(FACT_KEYS);
    if (requested.size === 0) return json({ error: "No readable fields requested" }, 400);

    const userContent = [
      {
        type: "text",
        text:
          "Photograph(s) of one ingredient package follow. Report these facts " +
          "(omit any you cannot read confidently): " +
          [...requested].join(", "),
      },
      ...imageUrls.slice(0, 4).map((url: string) => ({ type: "image_url", image_url: { url } })),
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

    return json(sanitize(parsed, requested as Set<FactKey>));
  } catch (e) {
    console.error("extract-package-label error:", e);
    return json({ error: String(e) }, 500);
  }
});
