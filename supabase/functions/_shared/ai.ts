// Generic AI provider abstraction so we can swap between Lovable AI, OpenAI, or Ollama
// without touching the edge functions that consume it.
//
// Switch providers by setting the AI_PROVIDER env var:
//   - "lovable" (default) → Lovable AI Gateway, uses LOVABLE_API_KEY
//   - "openai"            → OpenAI, uses OPENAI_API_KEY
//   - "ollama"            → self-hosted Ollama, uses OLLAMA_BASE_URL
//
// Override the model with AI_MODEL.

type AiCallArgs = {
  system: string;
  user: string;
  schemaHint?: string;
};

const DEFAULT_MODELS: Record<string, string> = {
  lovable: "google/gemini-2.5-flash",
  openai: "gpt-4o-mini",
  ollama: "llama3.1",
};

export function activeProvider(): { provider: string; model: string } {
  const provider = (Deno.env.get("AI_PROVIDER") || "lovable").toLowerCase();
  const model = Deno.env.get("AI_MODEL") || DEFAULT_MODELS[provider] || DEFAULT_MODELS.lovable;
  return { provider, model };
}

export async function aiJSON({ system, user }: AiCallArgs): Promise<any> {
  const { provider, model } = activeProvider();

  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  let url: string;
  let headers: Record<string, string> = { "Content-Type": "application/json" };

  if (provider === "openai") {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("OPENAI_API_KEY not configured");
    url = "https://api.openai.com/v1/chat/completions";
    headers.Authorization = `Bearer ${key}`;
  } else if (provider === "ollama") {
    const base = Deno.env.get("OLLAMA_BASE_URL");
    if (!base) throw new Error("OLLAMA_BASE_URL not configured");
    url = `${base.replace(/\/$/, "")}/v1/chat/completions`;
    const key = Deno.env.get("OLLAMA_API_KEY");
    if (key) headers.Authorization = `Bearer ${key}`;
  } else {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    url = "https://ai.gateway.lovable.dev/v1/chat/completions";
    headers.Authorization = `Bearer ${key}`;
  }

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI provider '${provider}' (${resp.status}): ${text.slice(0, 500)}`);
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    // Some models wrap JSON in ```json fences — strip and retry once
    const stripped = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(stripped);
  }
}
