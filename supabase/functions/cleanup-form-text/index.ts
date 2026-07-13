// Cleans up dictated/typed free-text answers on compliance form fields.
// Expects: { text: string } — returns { text: string } with the polished version.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You clean up a dictated or hastily typed free-text answer on a food-safety compliance form " +
              "(e.g. an incident report, root-cause note, or inspection comment). " +
              "Fix grammar, punctuation, capitalization, and speech-to-text filler words (\"um\", \"uh\", false starts). " +
              "Keep every fact, name, quantity, and technical term exactly as given — do not add, remove, or infer information. " +
              "Present it as a single clear, well-formed statement suitable for a compliance record. " +
              "Return ONLY the cleaned text, no preamble or quotes.",
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("AI gateway error:", response.status, detail);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const cleaned = data.choices?.[0]?.message?.content?.trim();
    if (!cleaned) {
      return new Response(JSON.stringify({ error: "No content returned" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text: cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cleanup-form-text error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
