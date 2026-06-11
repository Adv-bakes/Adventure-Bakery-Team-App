// Converts an uploaded .pptx into one PNG per slide via CloudConvert,
// storing the images in the training-content bucket.
// Expects: { sopId: string, sourcePath: string } — returns { slides: string[] }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { sopId, sourcePath } = await req.json();
    if (!sopId || !sourcePath) return json({ error: "Missing sopId or sourcePath" }, 400);

    const ccKey = Deno.env.get("CLOUDCONVERT_API_KEY");
    if (!ccKey) return json({ error: "CLOUDCONVERT_API_KEY not configured" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Signed URL for CloudConvert to fetch the deck
    const { data: signed, error: signErr } = await supabase.storage
      .from("training-content")
      .createSignedUrl(sourcePath, 60 * 60);
    if (signErr) throw signErr;

    // One job: import the pptx, convert to PNGs (one per slide), export URLs
    const jobRes = await fetch("https://api.cloudconvert.com/v2/jobs", {
      method: "POST",
      headers: { Authorization: `Bearer ${ccKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tasks: {
          "import-deck": { operation: "import/url", url: signed.signedUrl, filename: "deck.pptx" },
          "convert-slides": {
            operation: "convert",
            input: "import-deck",
            input_format: "pptx",
            output_format: "png",
            pixel_density: 96,
          },
          "export-slides": { operation: "export/url", input: "convert-slides" },
        },
      }),
    });
    if (!jobRes.ok) {
      console.error("CloudConvert job create failed:", jobRes.status, await jobRes.text());
      return json({ error: "CloudConvert job creation failed" }, 502);
    }
    const job = await jobRes.json();

    // Wait for completion (CloudConvert sync endpoint blocks until done)
    const waitRes = await fetch(`https://sync.api.cloudconvert.com/v2/jobs/${job.data.id}`, {
      headers: { Authorization: `Bearer ${ccKey}` },
    });
    if (!waitRes.ok) {
      console.error("CloudConvert wait failed:", waitRes.status, await waitRes.text());
      return json({ error: "CloudConvert conversion failed" }, 502);
    }
    const finished = await waitRes.json();
    if (finished.data.status !== "finished") {
      console.error("CloudConvert job status:", finished.data.status);
      return json({ error: `Conversion ${finished.data.status}` }, 502);
    }

    const exportTask = finished.data.tasks.find(
      (t: any) => t.operation === "export/url" && t.status === "finished",
    );
    const files: { filename: string; url: string }[] = exportTask?.result?.files ?? [];
    if (files.length === 0) return json({ error: "No slides produced" }, 502);

    // CloudConvert names multi-page output like deck-1.png … deck-10.png; sort numerically
    files.sort((a, b) => {
      const num = (f: { filename: string }) => Number(f.filename.match(/(\d+)\.png$/i)?.[1] ?? 0);
      return num(a) - num(b);
    });

    const slides: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const pngRes = await fetch(files[i].url);
      if (!pngRes.ok) throw new Error(`Failed to download slide ${i + 1}`);
      const bytes = new Uint8Array(await pngRes.arrayBuffer());
      const path = `${sopId}/slide-${String(i + 1).padStart(2, "0")}.png`;
      const { error: upErr } = await supabase.storage
        .from("training-content")
        .upload(path, bytes, { upsert: true, contentType: "image/png" });
      if (upErr) throw upErr;
      slides.push(path);
    }

    // Clean up the uploaded source deck
    await supabase.storage.from("training-content").remove([sourcePath]);

    return json({ slides });
  } catch (e) {
    console.error("convert-pptx error:", e);
    return json({ error: String(e) }, 500);
  }
});
