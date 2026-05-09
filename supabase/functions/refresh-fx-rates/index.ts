// ============================================================
//  KADH Collective — refresh-fx-rates Edge Function
//  supabase/functions/refresh-fx-rates/index.ts
//
//  Fetches latest currency rates (MYR base) from open.er-api.com
//  (free, no key required) and writes them into site_settings.
//
//  Triggered by:
//    - Supabase Cron (daily at ~01:00 UTC / 09:00 MYT)
//    - Admin "Refresh FX rates" button (manual)
//    - Direct invoke from dashboard
//
//  No body required.
//  Returns: { success: true, rates: {MYR:1, USD:0.22, ...}, fetched_at } | { error }
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Currencies we display on the storefront
const WANTED = ["MYR", "USD", "AED", "GBP", "EUR", "SGD", "AUD", "SAR"]

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    // Fetch rates with MYR as base (so each value = how many `currency` per 1 MYR)
    const apiResp = await fetch("https://open.er-api.com/v6/latest/MYR")
    const data    = await apiResp.json()

    if (!apiResp.ok || data.result !== "success" || !data.rates) {
      throw new Error(`FX API error: ${JSON.stringify(data).slice(0, 200)}`)
    }

    const rates: Record<string, number> = {}
    for (const code of WANTED) {
      const r = data.rates[code]
      if (typeof r === "number" && isFinite(r) && r > 0) {
        rates[code] = Number(r.toFixed(4))
      }
    }
    rates.MYR = 1  // ensure base is exact

    if (Object.keys(rates).length < 4) {
      throw new Error(`Got too few rates: ${JSON.stringify(rates)}`)
    }

    const fetchedAt = new Date().toISOString()

    // Persist to site_settings (service role bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const { error: e1 } = await supabase
      .from("site_settings")
      .update({ value: rates, updated_at: fetchedAt })
      .eq("key", "currency_rates")

    if (e1) throw new Error(`Failed to write currency_rates: ${e1.message}`)

    const { error: e2 } = await supabase
      .from("site_settings")
      .update({ value: fetchedAt, updated_at: fetchedAt })
      .eq("key", "currency_rates_updated_at")

    if (e2) console.warn("[refresh-fx-rates] could not update timestamp:", e2.message)

    console.log(`[refresh-fx-rates] Updated ${Object.keys(rates).length} rates at ${fetchedAt}`)

    return new Response(
      JSON.stringify({ success: true, rates, fetched_at: fetchedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    console.error("[refresh-fx-rates]", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
