// Generates draft multiple-choice quiz questions from training narrations.
// Expects: { title: string, narrations: string[], count: number }
// Returns: { questions: [{ question_text, options, correct_option_index, hint, rationale }] }
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, narrations, count } = await req.json();
    if (!Array.isArray(narrations) || narrations.filter((n) => n?.trim()).length === 0) {
      return json({ error: "Missing narrations" }, 400);
    }
    const questionCount = Math.min(15, Math.max(1, Number(count) || 10));

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const contentText = narrations
      .map((n: string, i: number) => (n?.trim() ? `Slide ${i + 1}: ${n.trim()}` : null))
      .filter(Boolean)
      .join("\n\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You write quiz questions for bakery employee training. Given the training content, " +
              `write exactly ${questionCount} multiple-choice questions that test understanding of the ` +
              "material (not trivia about slide numbers or formatting). Each question has exactly 4 answer " +
              "options with one correct answer, a short hint, and a one-sentence rationale explaining the " +
              "correct answer. Vary which option position is correct. Respond with ONLY a JSON object: " +
              '{"questions":[{"question_text":string,"options":[string,string,string,string],' +
              '"correct_option_index":number,"hint":string,"rationale":string}]}',
          },
          { role: "user", content: `Training module: ${title ?? "Untitled"}\n\n${contentText}` },
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
      // Fall back to extracting the outermost JSON object from the response
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return json({ error: "AI returned unparseable content" }, 502);
      parsed = JSON.parse(match[0]);
    }

    const questions = (Array.isArray(parsed?.questions) ? parsed.questions : [])
      .filter(
        (q: any) =>
          typeof q?.question_text === "string" &&
          Array.isArray(q?.options) &&
          q.options.length >= 2 &&
          Number.isInteger(q?.correct_option_index) &&
          q.correct_option_index >= 0 &&
          q.correct_option_index < q.options.length,
      )
      .map((q: any, i: number) => ({
        question_number: i + 1,
        question_text: q.question_text,
        options: q.options.map((o: any) => String(o)),
        correct_option_index: q.correct_option_index,
        hint: typeof q.hint === "string" && q.hint ? q.hint : null,
        rationale: typeof q.rationale === "string" && q.rationale ? q.rationale : null,
      }));

    if (questions.length === 0) return json({ error: "No valid questions generated" }, 502);
    return json({ questions });
  } catch (e) {
    console.error("generate-quiz error:", e);
    return json({ error: String(e) }, 500);
  }
});
