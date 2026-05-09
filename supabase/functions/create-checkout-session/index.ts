// ============================================================
//  KADH Collective — create-checkout-session Edge Function
//  supabase/functions/create-checkout-session/index.ts
//
//  Called by storefront after placeOrder() saves a pending order.
//  Builds a Stripe Checkout Session with the order's line items,
//  returns the hosted-checkout URL for the storefront to redirect to.
//
//  Body:    { order_ref: string }
//  Returns: { checkout_url: string, session_id: string } | { error: string }
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const { order_ref } = await req.json().catch(() => ({}))
    if (!order_ref || typeof order_ref !== "string") {
      return new Response(JSON.stringify({ error: "order_ref required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // Fetch the pending order
    const { data: order, error: orderErr } = await supabase
      .from("orders").select("*").eq("order_ref", order_ref).single()

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: `Order ${order_ref} not found` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    if (order.status === "paid") {
      return new Response(JSON.stringify({ error: `Order ${order_ref} is already paid` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    if (!order.email) {
      return new Response(JSON.stringify({ error: `Order ${order_ref} has no email` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Fetch shop_url for redirect targets
    const { data: settings } = await supabase
      .from("site_settings").select("key, value").in("key", ["shop_url"])
    const settingsMap = Object.fromEntries((settings || []).map((s) => [s.key, s.value]))
    const shopUrl = (settingsMap.shop_url as string) || "https://kadhcollective.com"

    // Stripe secret from edge function env
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured")

    // Build line items from order
    const items = Array.isArray(order.items) ? order.items : []
    const lineItems: any[] = items.map((item: any) => {
      // Storefront uses `unit_price`; legacy/admin paths might use `price`.
      const unitPrice = Number(item.unit_price ?? item.price ?? 0)
      const qty       = Number(item.qty ?? item.quantity ?? 1)
      return {
        currency:    "myr",
        productName: item.name || item.title || "Item",
        description: item.variant || "",
        unitAmount:  Math.round(unitPrice * 100), // RM → sen
        quantity:    qty,
      }
    })

    // Append shipping as a line item if there's a cost
    const shippingCost = Number(order.shipping_cost || 0)
    if (shippingCost > 0) {
      lineItems.push({
        currency:    "myr",
        productName: `Shipping — ${order.shipping_method || "Standard"}`,
        description: order.shipping_eta || "",
        unitAmount:  Math.round(shippingCost * 100),
        quantity:    1,
      })
    }

    // Build form-encoded body for Stripe API
    const params: Record<string, string> = {
      "mode":                  "payment",
      "customer_email":        order.email,
      "client_reference_id":   order_ref,
      "metadata[order_ref]":   order_ref,
      "success_url":           `${shopUrl}/?stripe=success&order_ref=${encodeURIComponent(order_ref)}&session_id={CHECKOUT_SESSION_ID}`,
      "cancel_url":            `${shopUrl}/?stripe=cancelled&order_ref=${encodeURIComponent(order_ref)}`,
      // No payment_method_types here on purpose: Stripe Checkout auto-shows
      // every method enabled on your account (Card + FPX + GrabPay + Apple Pay
      // + Google Pay) and selects the right ones for the buyer's region.
    }

    lineItems.forEach((li, i) => {
      params[`line_items[${i}][price_data][currency]`]                  = li.currency
      params[`line_items[${i}][price_data][product_data][name]`]        = li.productName
      if (li.description) {
        params[`line_items[${i}][price_data][product_data][description]`] = li.description
      }
      params[`line_items[${i}][price_data][unit_amount]`]               = String(li.unitAmount)
      params[`line_items[${i}][quantity]`]                              = String(li.quantity)
    })

    const body = new URLSearchParams(params).toString()

    const stripeResp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body,
    })

    const session = await stripeResp.json()
    if (!stripeResp.ok) {
      console.error("[stripe] error response:", session)
      throw new Error(`Stripe API: ${session.error?.message || JSON.stringify(session)}`)
    }

    return new Response(
      JSON.stringify({ checkout_url: session.url, session_id: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    console.error("[create-checkout-session]", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
