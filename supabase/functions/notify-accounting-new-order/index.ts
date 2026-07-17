import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logEmailSend } from "../_shared/emailLog.ts";

const TEMPLATE = "accounting-new-order";
const ACCOUNTING_RECIPIENT = "Accounting@AdventureBakes.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OrderItem {
  product_name: string;
  qty: number;
  unit: string;
}

interface Payload {
  orderId: string;
  orderNumber?: string;
  clientName: string;
  clientEmail: string;
  items: OrderItem[];
  shipToKind: "client" | "ab_warehouse";
  notes?: string;
  createdAt: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload: Payload = await req.json();
    const { orderId, orderNumber, clientName, clientEmail, items, shipToKind, notes, createdAt } = payload;

    const logMeta = { orderId, orderNumber: orderNumber ?? null, clientName };

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      await logEmailSend(TEMPLATE, "not_configured", {
        recipient: ACCOUNTING_RECIPIENT,
        error: "RESEND_API_KEY not set",
        metadata: logMeta,
      });
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderDate = new Date(createdAt).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const itemRows = items.map(i =>
      `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #e8e0d0;font-size:14px;color:#3d2e1e;">${i.product_name}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e8e0d0;font-size:14px;color:#3d2e1e;text-align:right;">${i.qty} ${i.unit}</td>
      </tr>`
    ).join("");

    const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;">

        <tr><td align="center" style="padding-bottom:28px;">
          <span style="font-size:22px;font-weight:700;color:#3d2e1e;letter-spacing:-0.5px;">Adventure Bakery</span>
        </td></tr>

        <tr><td style="background:#f5f0e8;border-radius:12px;padding:36px 32px;">
          <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#3d2e1e;">New Production Order</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#7a6555;">Please create a QuickBooks Estimate and send the 50% deposit invoice to the client.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
            style="background:rgba(255,255,255,0.6);border-radius:8px;padding:16px;margin-bottom:20px;">
            <tr><td style="padding:4px 0;font-size:13px;color:#7a6555;width:130px;font-weight:600;">Order #</td>
                <td style="padding:4px 0;font-size:13px;color:#3d2e1e;">${orderNumber ?? orderId.slice(0, 8).toUpperCase()}</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#7a6555;font-weight:600;">Date</td>
                <td style="padding:4px 0;font-size:13px;color:#3d2e1e;">${orderDate}</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#7a6555;font-weight:600;">Client</td>
                <td style="padding:4px 0;font-size:13px;color:#3d2e1e;">${clientName}</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#7a6555;font-weight:600;">Client Email</td>
                <td style="padding:4px 0;font-size:13px;color:#3d2e1e;">${clientEmail}</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#7a6555;font-weight:600;">Ship To</td>
                <td style="padding:4px 0;font-size:13px;color:#3d2e1e;">${shipToKind === "ab_warehouse" ? "AB Warehouse" : "Client (direct)"}</td></tr>
          </table>

          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#7a6555;text-transform:uppercase;letter-spacing:0.4px;">Products Ordered</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
            style="background:rgba(255,255,255,0.6);border-radius:8px;overflow:hidden;margin-bottom:20px;">
            <thead>
              <tr style="background:rgba(0,0,0,0.04);">
                <th style="padding:8px 12px;font-size:12px;color:#7a6555;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;">Product</th>
                <th style="padding:8px 12px;font-size:12px;color:#7a6555;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;">Qty</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          ${notes ? `<p style="margin:0;font-size:13px;color:#7a6555;"><strong>Notes:</strong> ${notes}</p>` : ""}

          <p style="margin:${notes ? "16px" : "0"} 0 0;font-size:13px;color:#9a8878;border-top:1px solid #e8e0d0;padding-top:16px;">
            Once the deposit is confirmed, please mark it in the AB Team App so production planning can begin.
          </p>
        </td></tr>

        <tr><td align="center" style="padding-top:20px;">
          <p style="margin:0;font-size:12px;color:#b0a090;">Adventure Bakery · 415 Specialty Point</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        // from must be on the Resend-verified sending domain; replies still
        // route to the monitored scale@adventurebakery.info inbox below.
        from: "AB Team App <scale@mail.adventurebakery.info>",
        to: ["Accounting@AdventureBakes.com"],
        reply_to: "scale@adventurebakery.info",
        subject: `New Order — ${clientName} · ${items.length} product${items.length !== 1 ? "s" : ""}`,
        html: htmlBody,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Resend error:", data);
      await logEmailSend(TEMPLATE, "failed", {
        recipient: ACCOUNTING_RECIPIENT,
        error: JSON.stringify(data),
        metadata: logMeta,
      });
      return new Response(JSON.stringify({ error: "Email failed", details: data }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logEmailSend(TEMPLATE, "sent", {
      recipient: ACCOUNTING_RECIPIENT,
      messageId: data.id ?? null,
      metadata: logMeta,
    });
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
