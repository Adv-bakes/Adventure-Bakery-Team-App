import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail, founderName, companyName, productName, projectType } = await req.json();

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "Missing recipientEmail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const displayName = founderName || "there";
    const displayProduct = productName || "your product";
    const displayCompany = companyName || "";
    const displayProjectType = projectType || "";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
          
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:24px;font-weight:700;color:hsl(25,35%,15%);letter-spacing:-0.5px;">
                Adventure Bakery
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:hsl(40,33%,94%);border-radius:12px;padding:40px 32px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:hsl(25,35%,15%);">
                PRF Received — Thank You!
              </h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:hsl(30,15%,45%);">
                Hi ${displayName}, thank you for submitting your Product Request Form. Our team has received your submission and will review it shortly.
              </p>

              <!-- Summary -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:rgba(255,255,255,0.6);border-radius:8px;padding:16px;">
                <tr>
                  <td style="padding:8px 16px;">
                    <p style="margin:0 0 8px;font-size:13px;color:hsl(30,15%,55%);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Submission Summary</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:hsl(30,15%,45%);width:120px;font-weight:600;">Product</td>
                        <td style="padding:4px 0;font-size:14px;color:hsl(25,35%,15%);">${displayProduct}</td>
                      </tr>
                      ${displayCompany ? `<tr>
                        <td style="padding:4px 0;font-size:14px;color:hsl(30,15%,45%);width:120px;font-weight:600;">Company</td>
                        <td style="padding:4px 0;font-size:14px;color:hsl(25,35%,15%);">${displayCompany}</td>
                      </tr>` : ""}
                      ${displayProjectType ? `<tr>
                        <td style="padding:4px 0;font-size:14px;color:hsl(30,15%,45%);width:120px;font-weight:600;">Project Type</td>
                        <td style="padding:4px 0;font-size:14px;color:hsl(25,35%,15%);">${displayProjectType}</td>
                      </tr>` : ""}
                    </table>
                  </td>
                </tr>
              </table>

              <h2 style="margin:0 0 8px;font-size:16px;font-weight:700;color:hsl(25,35%,15%);">
                What Happens Next?
              </h2>
              <ol style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.8;color:hsl(30,15%,45%);">
                <li>Our product development team reviews your request</li>
                <li>We'll reach out to schedule a discovery call</li>
                <li>You'll receive a detailed project proposal</li>
              </ol>

              <p style="margin:0;font-size:13px;line-height:1.5;color:hsl(30,15%,55%);">
                If you have any questions in the meantime, reply to this email or contact us at <a href="mailto:scale@adventurebakery.info" style="color:hsl(43,52%,50%);">scale@adventurebakery.info</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:hsl(30,15%,60%);">
                Adventure Bakery · Kitchen to Factory
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Adventure Bakery <noreply@notify.adventurebakery.info>",
        to: [recipientEmail],
        cc: ["scale@adventurebakery.info"],
        subject: `PRF Received — ${displayProduct}`,
        html: htmlBody,
        reply_to: "scale@adventurebakery.info",
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
