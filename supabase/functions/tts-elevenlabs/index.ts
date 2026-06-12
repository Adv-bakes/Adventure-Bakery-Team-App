// Text-to-speech via ElevenLabs — renders narration in the company's cloned voice.
// Expects: { text: string, voiceId?: string, lang?: "en" | "es" } — returns audio/mpeg bytes.
// The ElevenLabs API key never leaves the server; the browser only receives the MP3.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId, lang } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Voice ID from the request, else the configured default (the CEO's cloned voice).
    const voice = (typeof voiceId === "string" && voiceId.trim()) || Deno.env.get("ELEVENLABS_VOICE_ID");
    if (!voice) {
      return new Response(JSON.stringify({ error: "No voiceId provided and ELEVENLABS_VOICE_ID not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // eleven_multilingual_v2 auto-detects language from the text, so the same cloned
    // voice speaks English and Spanish. `lang` is accepted for forward-compat / logging.
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      console.error("ElevenLabs error:", response.status, detail, "lang:", lang);
      return new Response(JSON.stringify({ error: "ElevenLabs error", status: response.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audio = await response.arrayBuffer();
    // IMPORTANT: use application/octet-stream, not audio/mpeg. supabase-js functions.invoke
    // only returns a Blob for octet-stream; for audio/mpeg it decodes the body as text and
    // corrupts the binary. The MP3's real content-type is set when it's uploaded to storage.
    return new Response(audio, {
      headers: { ...corsHeaders, "Content-Type": "application/octet-stream" },
    });
  } catch (e) {
    console.error("tts-elevenlabs error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
