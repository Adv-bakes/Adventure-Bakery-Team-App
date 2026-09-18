// Reads a photograph of a FOOD PACKAGE and returns the identifying facts printed
// on it, so a grid row (or a form section) can be filled without typing.
//
// TWO MODES, because the two kinds of pack disagree about what a lot code looks
// like: "ingredient" is a supplier bag/case/tote received at the dock (lot
// jetted on after printing), "finished_goods" is our own retail carton (whole
// label block printed in one pass per lot). See MODES below.
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
// THIRD MODE, "specification", for FRM-207 Material Specification Register: the same ingredient
// pack, read for the RECORD OF THE MATERIAL rather than for one delivery - so it also transcribes
// the ingredient statement, the "Contains" line, any "may contain" statement and the storage
// instruction. The other two modes still never read declarations; see DECLARATION_KEYS.
//
// Expects: { imageUrls: string[], wanted?: string[], mode?: "ingredient" | "finished_goods" | "specification" }
// Returns: { facts: {..}, alternates: { lot_code: string[] }, extras: [{label,value}], warnings: string[] }

import { allergensFromContains, ingredientsMissingDeclared, storageClass } from "../_shared/allergenStatement.ts";

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

// Declarations: read ONLY in "specification" mode, and only for FRM-207. In the receiving modes the
// original rule stands - an allergen declaration for a DELIVERY must come off the spec sheet, not
// off whatever part of a panel is in frame. For the SPECIFICATION of a material the printed label
// is itself the manufacturer's regulated declaration, and the photo is kept with the entry as the
// evidence for what was transcribed. Mirrors DECLARATION_FACTS in src/lib/formSchema.ts.
//
// "allergens" and "storage" are NEVER taken from the model. The model transcribes
// contains_statement and a storage instruction verbatim; allergenStatement.ts turns those into the
// ticked allergens and the storage class, so every ticked box is traceable to printed words.
const DECLARATION_KEYS = ["ingredients", "contains_statement", "allergens", "may_contain", "storage"] as const;
type DeclarationKey = (typeof DECLARATION_KEYS)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Which kind of pack is in frame. Mirrors ScanMode in src/lib/formSchema.ts.
//
// THE TWO MODES DISAGREE ABOUT WHAT A LOT CODE LOOKS LIKE, which is why this is
// a mode and not a wording tweak. On a supplier's ingredient sack the artwork is
// pre-printed and the lot is jetted on afterwards, so it is found by looking for
// the odd-one-out. On our own finished carton the entire block — barcode,
// product name, lot, best-by, URL — is printed in ONE pass per lot on a blank
// substrate: there is no artwork to contrast against, the "looks lower quality
// than its surroundings" test finds nothing, and the ingredient prompt's rule
// that a number belonging to the printed artwork is never the lot points at
// exactly the wrong answer.
const MODES = ["ingredient", "finished_goods", "specification"] as const;
type Mode = (typeof MODES)[number];

const INGREDIENT_PROMPT = `You read a photograph of a FOOD INGREDIENT PACKAGE (a bag, case, sack, pail or tote received at a bakery) and report the identifying information printed on it. A worker is staging this ingredient for a production batch and needs its identity and lot code recorded.

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

const FINISHED_GOODS_PROMPT = `You read a photograph of a FINISHED PACKAGED FOOD PRODUCT — a retail carton, box, tray or bag of baked product. A worker is recording the identity of this pack against a batch that was produced and shipped.

The label is usually a single printed block on an otherwise blank carton: a barcode, the product name, and one line each for the lot and the date, often with a website. The whole block, INCLUDING THE LOT, is printed in one pass at production time. Read what it says.

Return ONLY these fact keys, and only the ones you can actually read:
- "product_name": the product description as printed (e.g. "Banana Rum Cake").
- "brand": the brand or company. On this kind of pack it is often only a website or domain — report it as printed.
- "lot_code": the LOT / BATCH code. See the rules below.
- "best_by": the best-by / expiration date EXACTLY AS PRINTED, verbatim. See the rules below.
- "item_code": an item / SKU / product number, if one is printed separately from the barcode.
- "net_weight": net weight exactly as printed, with its unit (e.g. "16 OZ").
- "pack_size": pack/case configuration if stated (e.g. "12 CT").
- "plant_code": a plant/facility/establishment code if one is identifiable as such.
- "barcode": the human-readable digits printed under the barcode (UPC/GTIN), digits only, in printed order.

IDENTIFYING THE LOT CODE:
- The lot is normally introduced by its own printed label: "Lot:", "LOT", "Lot Code", "Batch:", "B:", "L:". Take the value that follows it. That label is the strongest signal available and you should trust it.
- DO NOT require the lot to look ink-jetted, stamped, handwritten, or lower-quality than its surroundings. On this kind of pack it is set in the same font, in the same print pass, as everything else. Its appearance says nothing about whether it is the lot.
- The digits printed under the barcode are NEVER the lot code, even when they are the only number on the pack. Neither is a phone number, a copyright year, or a net weight.
- If no line is labelled as a lot or batch, put any plausible candidate in "alternates".lot_code and omit "lot_code". Omitting it is correct; guessing is not.

READING THE DATE — this matters as much as the lot:
- Report "best_by" EXACTLY AS PRINTED. If the pack says "July 2027", return "July 2027". If it says "07/15/2027", return "07/15/2027".
- Do NOT convert it, normalize it to YYYY-MM-DD, or invent a day that is not printed. These packs are frequently coded to the month only, and a day you supplied would be recorded as though the pack carried it.
- If more than one date is printed (e.g. a pack date and a best-by), put the best-by in "best_by" and the other in "extras".

OTHER RULES:
- Transcribe codes CHARACTER FOR CHARACTER, preserving spacing and case. Do not normalize or "correct" a lot code. If a character is genuinely ambiguous (0/O, 1/I/l, 5/S, 8/B), transcribe your best reading and add a warning naming the ambiguity.
- Do NOT read or report the ingredient statement, the allergen ("Contains:") statement, or the nutrition panel. Ignore them entirely.
- Anything else clearly readable and useful for identifying this pack goes in "extras" as {"label","value"} pairs. Keep extras short — at most 5.
- Omit any key you cannot read confidently. A missing key is correct when the pack does not show it or the photo is unclear. Never output empty strings or placeholders.
- If the photo does not show a packaged food product at all, return empty facts and explain in "warnings".

Respond with ONLY this JSON object (no markdown):
{"facts": {"lot_code": "...", ...}, "alternates": {"lot_code": ["..."]}, "extras": [{"label":"...","value":"..."}], "warnings": ["..."]}`;

// Built from the ingredient prompt so the identity and lot rules cannot drift apart; only the
// purpose line and the declarations rule are swapped. The asserts fail loudly at boot if the
// ingredient prompt is ever reworded and a swap silently stops matching.
const INGREDIENT_PURPOSE =
  "A worker is staging this ingredient for a production batch and needs its identity and lot code recorded.";
const INGREDIENT_NO_DECLARATIONS =
  '- Do NOT read or report the ingredient statement, the allergen ("Contains:") statement, or nutrition panel. Ignore them entirely.';
if (!INGREDIENT_PROMPT.includes(INGREDIENT_PURPOSE) || !INGREDIENT_PROMPT.includes(INGREDIENT_NO_DECLARATIONS)) {
  throw new Error("SPECIFICATION_PROMPT no longer matches INGREDIENT_PROMPT - update the swaps.");
}
const SPECIFICATION_PROMPT = INGREDIENT_PROMPT
  .replace(INGREDIENT_PURPOSE,
    "A quality manager is recording the SPECIFICATION of this material - what it is, who makes it, what it declares - so it can be approved for use.")
  .replace(INGREDIENT_NO_DECLARATIONS, '- ALSO READ THE DECLARATIONS, transcribed WORD FOR WORD exactly as printed - these are regulated statements and must not be paraphrased, summarised, corrected or completed:\n  - "ingredients": the full ingredient statement, starting after the word "INGREDIENTS". If any part is cut off, folded or unreadable, transcribe what is legible and add a warning saying the statement is incomplete.\n  - "contains_statement": the allergen statement beginning "Contains" (e.g. "CONTAINS WHEAT, MILK, SOY AND EGG INGREDIENTS."), including the word "Contains". Omit it if there is none - never build one from the ingredient list.\n  - "may_contain": any precautionary statement ("May contain...", "Made in a facility that also processes..."), verbatim. Omit if none.\n  - "storage_instruction": a printed storage instruction ("Keep frozen", "Store in a cool, dry place"), verbatim. Omit if none - never assume one.\n  Do not read the nutrition panel.');

const PROMPTS: Record<Mode, string> = {
  ingredient: INGREDIENT_PROMPT,
  finished_goods: FINISHED_GOODS_PROMPT,
  specification: SPECIFICATION_PROMPT,
};

// A SPECIFICATION scan transcribes a dense, regulated ingredient panel word for word, and the fast
// model was seen to drop three ingredients (one of them the milk) and substitute one that is not on
// the pack. Those scans are rare - one per material - so they get the stronger model; the receiving
// scans, which read a handful of short codes many times a day, stay on the fast one.
const MODELS: Record<Mode, string> = {
  ingredient: "google/gemini-2.5-flash",
  finished_goods: "google/gemini-2.5-flash",
  specification: "google/gemini-2.5-pro",
};

const SUBJECT: Record<Mode, string> = {
  ingredient: "one ingredient package",
  finished_goods: "one finished packaged product",
  specification: "one ingredient package, read for its specification",
};

const cleanString = (value: unknown, max = 200): string | undefined => {
  if (value == null || typeof value === "object") return undefined;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "n/a") return undefined;
  return s.slice(0, max);
};

/** Whitelist the model's output down to known keys + safe strings. */
function sanitize(parsed: any, wanted: Set<FactKey>, mode: Mode, declarations: Set<DeclarationKey>) {
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
    // INGREDIENT MODE ONLY. There, best_by is asked for as YYYY-MM-DD because it
    // lands in a date cell, so a date the model failed to normalize is still
    // information but must not be fed to a native date input that renders it
    // blank — it becomes a detail instead.
    //
    // FINISHED-GOODS MODE DELIBERATELY KEEPS IT VERBATIM. Our own packs are
    // coded to the month ("Best By: July 2027"), that IS the printed date, and
    // demoting it to an extra would throw away the one value FRM-703's retention
    // clock is computed from. The client stores it as text and derives the
    // discard date under FSQM-014 Part 6's last-day-of-month convention.
    if (mode !== "finished_goods" && key === "best_by" && !ISO_DATE.test(value)) {
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

  // Declarations - specification mode only, and only the ones the form asked for.
  if (mode === "specification" && declarations.size) {
    const ingredients = cleanString(rawFacts.ingredients, 4000);
    const contains = cleanString(rawFacts.contains_statement, 500);
    const mayContain = cleanString(rawFacts.may_contain, 500);
    const storageText = cleanString(rawFacts.storage_instruction, 300);
    if (declarations.has("ingredients") && ingredients) facts.ingredients = ingredients;
    if (declarations.has("contains_statement") && contains) facts.contains_statement = contains;
    if (declarations.has("may_contain") && mayContain) facts.may_contain = mayContain;
    const reading = allergensFromContains(contains);
    if (declarations.has("allergens")) {
      if (reading.allergens.length) facts.allergens = reading.allergens.join(", ");
      warnings.push(...reading.warnings);
    }
    // The transcription can silently drop part of a dense panel; every allergen the Contains line
    // declares must be named in the transcribed ingredients, or the scan says so.
    if (facts.ingredients) warnings.push(...ingredientsMissingDeclared(facts.ingredients, reading.allergens));
    if (declarations.has("storage")) {
      const cls = storageClass(storageText);
      if (cls) facts.storage = cls;
      if (storageText) extras.push({ label: "Storage instruction", value: storageText });
    }
  }

  return { facts, alternates: { lot_code: lotAlternates }, extras, warnings };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrls, wanted, mode: rawMode } = await req.json();
    // Unknown/absent mode falls back to the original behaviour, so a client that
    // has not been updated keeps working exactly as before.
    const mode: Mode = MODES.includes(rawMode) ? rawMode : "ingredient";
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return json({ error: "Missing imageUrls" }, 400);
    }
    // An empty/absent list means "everything we know how to read".
    const requested = Array.isArray(wanted) && wanted.length
      ? new Set(FACT_KEYS.filter(k => wanted.includes(k)))
      : new Set(FACT_KEYS);
    const declarations = new Set<DeclarationKey>(
      mode === "specification" && Array.isArray(wanted)
        ? DECLARATION_KEYS.filter(k => wanted.includes(k))
        : [],
    );
    if (requested.size === 0 && declarations.size === 0) {
      return json({ error: "No readable fields requested" }, 400);
    }
    // What the model is asked to transcribe: allergens and storage are derived here, so it is
    // asked for the printed statements they are derived from.
    const asked = [...requested, ...[...declarations].map(k =>
      k === "allergens" ? "contains_statement" : k === "storage" ? "storage_instruction" : k)]
      .filter((k, i, all) => all.indexOf(k) === i);

    const userContent = [
      {
        type: "text",
        text:
          `Photograph(s) of ${SUBJECT[mode]} follow. Report these facts ` +
          "(omit any you cannot read confidently): " +
          asked.join(", "),
      },
      ...imageUrls.slice(0, 4).map((url: string) => ({ type: "image_url", image_url: { url } })),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELS[mode],
        messages: [
          { role: "system", content: PROMPTS[mode] },
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

    return json(sanitize(parsed, requested as Set<FactKey>, mode, declarations));
  } catch (e) {
    console.error("extract-package-label error:", e);
    return json({ error: String(e) }, 500);
  }
});
