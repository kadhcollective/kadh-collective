// ============================================================
//  KADH Collective — stripe-webhook Edge Function
//  supabase/functions/stripe-webhook/index.ts
//
//  Receives webhook events from Stripe. Verifies signature,
//  marks orders as paid, triggers receipt email.
//
//  Events handled:
//    - checkout.session.completed → mark order paid + send receipt
//
//  Stripe sends events with header:  stripe-signature: t=...,v1=...
//  We verify HMAC-SHA256(timestamp.body, STRIPE_WEBHOOK_SECRET) matches v1.
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts: Record<string, string> = {}
  for (const el of sigHeader.split(",")) {
    const [k, ...rest] = el.split("=")
    parts[k] = rest.join("=")
  }
  const t  = parts.t
  const v1 = parts.v1
  if (!t || !v1) return false

  // Replay protection — reject events older than 5 minutes
  const ageSec = Math.floor(Date.now() / 1000) - parseInt(t)
  if (ageSec > 300) {
    console.warn(`[stripe-webhook] Rejecting stale event, age ${ageSec}s`)
    return false
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${t}.${payload}`),
  )
  const hex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0")).join("")
  return hex === v1
}

serve(async (req) => {
  // Webhook is server-to-server, no CORS needed
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const sig = req.headers.get("stripe-signature")
  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 })
  }

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET")
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured")
    return new Response("Server misconfigured", { status: 500 })
  }

  // RAW body needed for signature verification — must be text(), not json()
  const payload = await req.text()

  const valid = await verifyStripeSignature(payload, sig, secret)
  if (!valid) {
    console.warn("[stripe-webhook] Invalid signature")
    return new Response("Invalid signature", { status: 400 })
  }

  let event: any
  try {
    event = JSON.parse(payload)
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  console.log(`[stripe-webhook] received: ${event.type} | ${event.id}`)

  // ─── checkout.session.completed: mark order paid + send receipt ─
  if (event.type === "checkout.session.completed") {
    const session   = event.data.object
    const order_ref = session.metadata?.order_ref || session.client_reference_id

    if (!order_ref) {
      console.warn(`[stripe-webhook] ${event.id} missing order_ref`)
      return new Response("OK (no order_ref)", { status: 200 })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const { data: order } = await supabase
      .from("orders").select("status").eq("order_ref", order_ref).single()

    if (!order) {
      console.error(`[stripe-webhook] Order ${order_ref} not found`)
      return new Response("OK (order not found)", { status: 200 })
    }

    // Idempotency — Stripe can deliver the same event multiple times
    if (order.status === "paid") {
      console.log(`[stripe-webhook] Order ${order_ref} already paid, skipping`)
      return new Response("OK (already paid)", { status: 200 })
    }

    // Mark as paid
    const { error: updateErr } = await supabase
      .from("orders")
      .update({
        status:                "paid",
        stripe_session_id:     session.id,
        stripe_payment_intent: session.payment_intent,
        paid_at:               new Date().toISOString(),
      })
      .eq("order_ref", order_ref)

    if (updateErr) {
      console.error(`[stripe-webhook] Failed to mark order paid:`, updateErr)
      // Don't return 500 — Stripe will keep retrying. Better to log and acknowledge.
      return new Response(`OK (db update failed: ${updateErr.message})`, { status: 200 })
    }

    // Trigger receipt email (await so we know it succeeded)
    try {
      const emailResp = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "apikey":         Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          },
          body: JSON.stringify({ order_ref }),
        },
      )
      const emailBody = await emailResp.json().catch(() => ({}))
      if (!emailResp.ok) {
        console.error(`[stripe-webhook] Receipt email failed:`, emailBody)
      } else {
        console.log(`[stripe-webhook] Receipt email sent: ${emailBody.id}`)
      }
    } catch (e) {
      console.error("[stripe-webhook] Receipt email exception:", e)
      // Don't fail webhook — order is paid, email can be re-sent from admin
    }

    console.log(`[stripe-webhook] Order ${order_ref} marked paid`)
    return new Response("OK", { status: 200 })
  }

  // Unhandled event types — acknowledge so Stripe stops retrying
  console.log(`[stripe-webhook] unhandled event type: ${event.type}`)
  return new Response("OK", { status: 200 })
})
