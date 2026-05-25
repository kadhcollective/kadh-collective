// ============================================================
//  KADH Collective — send-receipt Edge Function
//  supabase/functions/send-receipt/index.ts
//
//  Triggered by:
//    1. Storefront after successful checkout (POST from index.html)
//    2. Admin "Resend Receipt" button (POST from admin.html)
//
//  Body:    { order_ref: string }
//  Returns: { success: true, id: string, sent_to: string }  on success
//           { error: string }                                on failure
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const fmtMYR  = (n: number) => `RM ${Number(n || 0).toFixed(2)}`

const fmtDate = (d?: string) => {
  const date = d ? new Date(d) : new Date()
  return date.toLocaleDateString("en-MY", {
    day: "2-digit", month: "long", year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  })
}

function buildItemsHTML(items: any[] = []) {
  if (!items.length) {
    return `<tr><td colspan="3" style="padding:12px 0;color:#666;font-size:13px;">No items</td></tr>`
  }
  return items.map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eae8e4;font-family:'Tenor Sans',Georgia,serif;font-size:13px;color:#000;">
        ${item.name || item.title || "Item"}
        ${item.variant ? `<span style="color:#666;font-size:12px;display:block;margin-top:2px;">${item.variant}</span>` : ""}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #eae8e4;font-family:'Tenor Sans',Georgia,serif;font-size:13px;color:#666;text-align:center;">
        × ${item.qty || item.quantity || 1}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #eae8e4;font-family:'Tenor Sans',Georgia,serif;font-size:13px;color:#000;text-align:right;">
        ${fmtMYR((item.unit_price || item.price || 0) * (item.qty || item.quantity || 1))}
      </td>
    </tr>
  `).join("")
}

function buildReceiptHTML(order: any, opts: { shopName: string; shopUrl: string; fromEmail: string }) {
  const {
    order_ref       = "",
    customer_name   = "",
    phone           = "",
    address         = "",
    items           = [],
    subtotal        = 0,
    shipping_cost   = 0,
    total           = 0,
    shipping_method = "",
    shipping_eta    = "",
    created_at,
  } = order

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${opts.shopName} — Order Receipt ${order_ref}</title>
  <link href="https://fonts.googleapis.com/css2?family=Forum&family=Tenor+Sans&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F2F0ED;font-family:'Tenor Sans',Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F0ED;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#F2F0ED;padding:40px 48px 32px;text-align:center;border-bottom:1px solid #ddd9d3;">
          <p style="font-family:'Forum',Georgia,serif;font-size:28px;letter-spacing:0.12em;color:#6B0E0E;margin:0 0 4px;">${opts.shopName.toUpperCase()}</p>
          <p style="font-family:'Tenor Sans',Georgia,serif;font-size:11px;letter-spacing:0.25em;color:#888;margin:0;text-transform:uppercase;">Order Confirmation &amp; Receipt</p>
        </td></tr>
        <tr><td style="background:#ffffff;padding:40px 48px;">
          <p style="font-family:'Forum',Georgia,serif;font-size:20px;color:#000;margin:0 0 8px;">
            Thank you, ${(customer_name || "").split(" ")[0] || "there"}.
          </p>
          <p style="font-family:'Tenor Sans',Georgia,serif;font-size:14px;color:#444;margin:0 0 32px;line-height:1.6;">
            Your order has been confirmed and we are carefully preparing it for you.
            You will receive a WhatsApp message from us shortly with further details.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
              <td style="width:50%;vertical-align:top;">
                <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#999;margin:0 0 6px;font-family:'Tenor Sans',Georgia,serif;">Order Reference</p>
                <p style="font-size:15px;color:#6B0E0E;font-family:'Forum',Georgia,serif;margin:0;letter-spacing:0.05em;">${order_ref}</p>
              </td>
              <td style="width:50%;vertical-align:top;text-align:right;">
                <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#999;margin:0 0 6px;font-family:'Tenor Sans',Georgia,serif;">Order Date</p>
                <p style="font-size:14px;color:#000;font-family:'Tenor Sans',Georgia,serif;margin:0;">${fmtDate(created_at)}</p>
              </td>
            </tr>
          </table>
          <hr style="border:none;border-top:1px solid #eae8e4;margin:0 0 28px;">
          <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#999;margin:0 0 12px;font-family:'Tenor Sans',Georgia,serif;">Items Ordered</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">${buildItemsHTML(items)}</table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
              <td style="font-family:'Tenor Sans',Georgia,serif;font-size:13px;color:#666;padding:5px 0;">Subtotal</td>
              <td style="font-family:'Tenor Sans',Georgia,serif;font-size:13px;color:#000;padding:5px 0;text-align:right;">${fmtMYR(subtotal)}</td>
            </tr>
            <tr>
              <td style="font-family:'Tenor Sans',Georgia,serif;font-size:13px;color:#666;padding:5px 0;">Shipping</td>
              <td style="font-family:'Tenor Sans',Georgia,serif;font-size:13px;color:#000;padding:5px 0;text-align:right;">${Number(shipping_cost) === 0 ? "Free" : fmtMYR(shipping_cost)}</td>
            </tr>
            <tr><td colspan="2" style="padding-top:12px;border-top:1px solid #eae8e4;"></td></tr>
            <tr>
              <td style="font-family:'Forum',Georgia,serif;font-size:16px;color:#000;padding:4px 0;letter-spacing:0.03em;">Total</td>
              <td style="font-family:'Forum',Georgia,serif;font-size:16px;color:#6B0E0E;padding:4px 0;text-align:right;letter-spacing:0.03em;">${fmtMYR(total)}</td>
            </tr>
          </table>
          <hr style="border:none;border-top:1px solid #eae8e4;margin:0 0 28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:50%;vertical-align:top;padding-right:24px;">
                <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#999;margin:0 0 8px;font-family:'Tenor Sans',Georgia,serif;">Delivering To</p>
                <p style="font-size:13px;color:#000;font-family:'Tenor Sans',Georgia,serif;margin:0;line-height:1.7;">
                  ${customer_name}<br>
                  ${phone ? phone + "<br>" : ""}
                  ${(address || "").replace(/\n/g, "<br>")}
                </p>
              </td>
              <td style="width:50%;vertical-align:top;text-align:right;">
                <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#999;margin:0 0 8px;font-family:'Tenor Sans',Georgia,serif;">Shipping Method</p>
                <p style="font-size:13px;color:#000;font-family:'Tenor Sans',Georgia,serif;margin:0 0 12px;">${shipping_method || "Standard"}</p>
                ${shipping_eta ? `
                <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#999;margin:0 0 8px;font-family:'Tenor Sans',Georgia,serif;">Estimated Arrival</p>
                <p style="font-size:13px;color:#000;font-family:'Tenor Sans',Georgia,serif;margin:0;">${shipping_eta}</p>
                ` : ""}
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:#F2F0ED;padding:28px 48px;text-align:center;border-top:1px solid #ddd9d3;">
          <p style="font-family:'Tenor Sans',Georgia,serif;font-size:12px;color:#999;margin:0 0 6px;line-height:1.7;">
            Questions? Reply to this email or reach us at
            <a href="mailto:${opts.fromEmail}" style="color:#6B0E0E;text-decoration:none;">${opts.fromEmail}</a>
          </p>
          <p style="font-family:'Tenor Sans',Georgia,serif;font-size:11px;color:#bbb;margin:0;">
            © ${new Date().getFullYear()} ${opts.shopName}. All rights reserved.
          </p>
          <p style="margin:12px 0 0;">
            <a href="${opts.shopUrl}" style="font-family:'Forum',Georgia,serif;font-size:12px;letter-spacing:0.15em;color:#6B0E0E;text-decoration:none;">${opts.shopUrl.replace(/^https?:\/\//, "")}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const order_ref = body?.order_ref
    if (!order_ref || typeof order_ref !== "string") {
      return new Response(JSON.stringify({ error: "order_ref required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Service role client — bypasses RLS, can read private settings
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // Fetch the order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("order_ref", order_ref)
      .single()

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: `Order ${order_ref} not found` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    if (!order.email) {
      return new Response(JSON.stringify({ error: `Order ${order_ref} has no email` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Fetch settings
    const { data: settings, error: settingsErr } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["resend_api_key", "from_email", "shop_name", "shop_url"])

    if (settingsErr) {
      throw new Error(`Failed to load settings: ${settingsErr.message}`)
    }

    const map = Object.fromEntries((settings || []).map((s) => [s.key, s.value]))
    const resendKey = map.resend_api_key as string
    const fromEmail = (map.from_email   as string) || "orders@kadhcollective.com"
    const shopName  = (map.shop_name    as string) || "KADH Collective"
    const shopUrl   = (map.shop_url     as string) || "https://kadhcollective.com"

    if (!resendKey) {
      throw new Error("Resend API key not configured in site_settings")
    }

    // Build receipt + send via Resend
    const html = buildReceiptHTML(order, { shopName, shopUrl, fromEmail })

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    `${shopName} <${fromEmail}>`,
        to:      [order.email],
        subject: `Your ${shopName} order ${order.order_ref} is confirmed`,
        html,
      }),
    })

    const respBody = await resp.json()
    if (!resp.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(respBody)}`)
    }

    return new Response(
      JSON.stringify({ success: true, id: respBody.id, sent_to: order.email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    console.error("[send-receipt]", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
