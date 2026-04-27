// ============================================================
//  KADH COLLECTIVE — Tracking Sync Script
//  scripts/tracking-sync.js
//
//  Run by GitHub Actions every 2 hours (7am–9pm KL time).
//  Also callable manually: node scripts/tracking-sync.js
//
//  What it does:
//    1. Fetches all active shipments from Supabase
//    2. For each: calls EasyParcel tracking API
//    3. Normalises and stores status + event history
//    4. Auto-sends OFD alert (email + WA) if status changed
//       to "Out for Delivery" and alert not yet sent
//    5. Sends dispatched notification when first picked up
//    6. Sends delivered notification on completion
//    7. Writes a sync_log row with results
//
//  Environment variables (GitHub Actions secrets):
//    SUPABASE_URL          — your Supabase project URL
//    SUPABASE_SERVICE_KEY  — service_role key (bypasses RLS)
//    EP_API_KEY            — EasyParcel API key
//    EP_SANDBOX            — 'true' for sandbox, 'false' for live
//    RESEND_API_KEY        — Resend email API key
//    META_WA_TOKEN         — Meta WhatsApp Cloud API token
//    META_WA_PHONE_ID      — WhatsApp Business phone number ID
//    KADH_FROM_EMAIL       — sender email address
//    KADH_SHOP_URL         — your shop domain
// ============================================================

const { notify } = require('./notify.js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY  // service_role key
const EP_API_KEY   = process.env.EP_API_KEY
const EP_SANDBOX   = process.env.EP_SANDBOX === 'true'
const EP_BASE      = EP_SANDBOX
  ? 'https://demo.easyparcel.com/api/v3'
  : 'https://api.easyparcel.com/api/v3'

// ─── Supabase REST helpers ───────────────────────────────────

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
    },
  })
  if (!res.ok) throw new Error(`Supabase GET ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function sbPatch(table, match, data) {
  const params = Object.entries(match).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Supabase PATCH ${table}: ${res.status} ${await res.text()}`)
}

async function sbInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    },
    body: JSON.stringify(data),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`Supabase INSERT ${table}: ${res.status} ${JSON.stringify(body)}`)
  return Array.isArray(body) ? body[0] : body
}

// ─── EasyParcel tracking ─────────────────────────────────────

const STATUS_KEYWORDS = {
  'out for delivery':  'Out for Delivery',
  'out_for_delivery':  'Out for Delivery',
  'with delivery':     'Out for Delivery',
  'on delivery':       'Out for Delivery',
  'delivery attempt':  'Out for Delivery',
  'in transit':        'In Transit',
  'in_transit':        'In Transit',
  'transit':           'In Transit',
  'picked up':         'Picked Up',
  'pickup':            'Picked Up',
  'collected':         'Picked Up',
  'delivered':         'Delivered',
  'completed':         'Delivered',
  'exception':         'Exception',
  'failed':            'Exception',
  'return':            'Exception',
  'booked':            'Booked',
}

function normaliseStatus(raw) {
  if (!raw) return null
  const lower = String(raw).toLowerCase()
  for (const [key, val] of Object.entries(STATUS_KEYWORDS)) {
    if (lower.includes(key)) return val
  }
  return raw
}

async function epTrack(parcelId) {
  // EasyParcel sandbox: simulate progressive statuses
  if (!EP_API_KEY || EP_API_KEY === 'YOUR_EASYPARCEL_API_KEY') {
    console.log(`[ep] Sandbox mode — simulating tracking for ${parcelId}`)
    return {
      status: 'In Transit',
      events: [{
        timestamp: new Date().toISOString(),
        status:    'In Transit',
        location:  'Kuala Lumpur Sortation Centre',
        note:      'Simulated tracking (sandbox)',
      }],
    }
  }

  const res = await fetch(`${EP_BASE}/shipment/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: EP_API_KEY, parcel_id: parcelId }),
  })
  if (!res.ok) throw new Error(`EasyParcel track API: ${res.status}`)
  const data = await res.json()
  const result = data.data || data

  return {
    status: normaliseStatus(result.status || result.current_status),
    events: (result.events || result.tracking_events || []).map(e => ({
      timestamp: e.date || e.timestamp,
      status:    normaliseStatus(e.status || e.description),
      location:  e.location || '',
      note:      e.description || e.remark || '',
    })),
  }
}

// ─── Notification deduplication ──────────────────────────────

async function alreadyNotified(orderRef, channel) {
  const rows = await sbGet(
    `notification_log?order_ref=eq.${encodeURIComponent(orderRef)}&channel=eq.${channel}&status=eq.sent&limit=1`
  )
  return rows.length > 0
}

async function logNotification(orderRef, channel, type, recipient, providerId, error = null) {
  await sbInsert('notification_log', {
    order_ref:   orderRef,
    type,
    channel,
    recipient,
    status:      error ? 'failed' : 'sent',
    provider:    type === 'email' ? 'resend' : 'meta_wa',
    provider_id: providerId,
    error,
  })
}

// ─── Process a single order ───────────────────────────────────

async function processOrder(order, syncErrors) {
  const ref = order.order_ref
  console.log(`\n[sync] Processing ${ref} — current status: ${order.ep_track_status || 'none'}`)

  let trackData
  try {
    trackData = await epTrack(order.ep_parcel_id)
  } catch (err) {
    console.error(`[sync] EP track failed for ${ref}:`, err.message)
    syncErrors.push({ ref, error: err.message })
    return { updated: false }
  }

  const newStatus  = trackData.status
  const prevStatus = order.ep_track_status
  const now        = new Date().toISOString()

  // Always update tracking data in Supabase
  const patch = {
    ep_track_status:    newStatus,
    ep_track_events:    JSON.stringify(trackData.events),
    ep_track_synced_at: now,
  }

  // ── Notification logic ──────────────────────────────────────

  // 1. Dispatched alert (first time status reaches Picked Up or beyond)
  if (
    ['Picked Up', 'In Transit', 'Out for Delivery', 'Delivered'].includes(newStatus) &&
    !['Picked Up', 'In Transit', 'Out for Delivery', 'Delivered'].includes(prevStatus)
  ) {
    const sent = await alreadyNotified(ref, 'dispatched')
    if (!sent) {
      console.log(`[sync] Sending dispatched notification for ${ref}`)
      try {
        const results = await notify(order, 'dispatched')
        await logNotification(ref, 'dispatched', 'email',     order.email, results.email?.id)
        await logNotification(ref, 'dispatched', 'whatsapp',  order.phone, results.whatsapp?.messages?.[0]?.id)
      } catch (err) {
        console.error(`[sync] Dispatched notification failed for ${ref}:`, err.message)
        syncErrors.push({ ref, error: `dispatched notify: ${err.message}` })
      }
    }
  }

  // 2. Out-for-Delivery alert
  if (newStatus === 'Out for Delivery' && prevStatus !== 'Out for Delivery') {
    const sent = await alreadyNotified(ref, 'ofd')
    if (!sent) {
      console.log(`[sync] Sending OFD alert for ${ref}`)
      try {
        const results = await notify(order, 'ofd')
        await logNotification(ref, 'ofd', 'email',    order.email, results.email?.id)
        await logNotification(ref, 'ofd', 'whatsapp', order.phone, results.whatsapp?.messages?.[0]?.id)
        patch.ep_ofd_sent = now
      } catch (err) {
        console.error(`[sync] OFD alert failed for ${ref}:`, err.message)
        syncErrors.push({ ref, error: `ofd notify: ${err.message}` })
      }
    }
  }

  // 3. Delivered notification
  if (newStatus === 'Delivered' && prevStatus !== 'Delivered') {
    const sent = await alreadyNotified(ref, 'delivered')
    if (!sent) {
      console.log(`[sync] Sending delivered notification for ${ref}`)
      try {
        const results = await notify(order, 'delivered')
        await logNotification(ref, 'delivered', 'email',    order.email, results.email?.id)
        await logNotification(ref, 'delivered', 'whatsapp', order.phone, results.whatsapp?.messages?.[0]?.id)
      } catch (err) {
        console.error(`[sync] Delivered notification failed for ${ref}:`, err.message)
        syncErrors.push({ ref, error: `delivered notify: ${err.message}` })
      }
    }
  }

  // Write the tracking update to Supabase
  await sbPatch('orders', { order_ref: ref }, patch)

  const changed = newStatus !== prevStatus
  console.log(`[sync] ${ref} → ${newStatus}${changed ? ' (changed)' : ' (no change)'}`)

  return { updated: changed, newStatus }
}

// ─── Main sync loop ───────────────────────────────────────────

async function run() {
  console.log(`\n${'═'.repeat(56)}`)
  console.log(`  KADH Tracking Sync — ${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })} KL`)
  console.log(`  Mode: ${EP_SANDBOX ? 'SANDBOX' : 'LIVE'}`)
  console.log(`${'═'.repeat(56)}`)

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[sync] SUPABASE_URL or SUPABASE_SERVICE_KEY not set — aborting')
    process.exit(1)
  }

  // Create sync log entry
  let syncLogId
  try {
    const logRow = await sbInsert('sync_log', { status: 'running' })
    syncLogId = logRow?.id
  } catch (err) {
    console.warn('[sync] Could not create sync_log entry:', err.message)
  }

  // Fetch active shipments (those not yet Delivered or Exception)
  let orders = []
  try {
    orders = await sbGet(
      `orders?ep_parcel_id=not.is.null` +
      `&ep_track_status=not.in.(Delivered,Exception)` +
      `&select=order_ref,customer_name,email,phone,country,address,shipping_method,shipping_eta,total,items,ep_courier,ep_awb,ep_tracking_no,ep_parcel_id,ep_track_status,ep_handover,ep_ofd_sent` +
      `&order=created_at.desc`
    )
    console.log(`[sync] Found ${orders.length} active shipment(s) to check`)
  } catch (err) {
    console.error('[sync] Failed to fetch orders:', err.message)
    if (syncLogId) {
      await sbPatch('sync_log', { id: syncLogId }, {
        status: 'failed', finished_at: new Date().toISOString(),
        errors: JSON.stringify([{ error: err.message }])
      })
    }
    process.exit(1)
  }

  // Process each order with a small delay between requests
  let updated = 0, ofdSent = 0
  const syncErrors = []

  for (const order of orders) {
    const result = await processOrder(order, syncErrors)
    if (result.updated) updated++
    if (result.newStatus === 'Out for Delivery') ofdSent++

    // Gentle rate limiting — 300ms between EP API calls
    await new Promise(r => setTimeout(r, 300))
  }

  // Update sync log
  const finalStatus = syncErrors.length === 0
    ? 'success'
    : syncErrors.length < orders.length ? 'partial' : 'failed'

  if (syncLogId) {
    await sbPatch('sync_log', { id: syncLogId }, {
      finished_at:     new Date().toISOString(),
      orders_checked:  orders.length,
      orders_updated:  updated,
      ofd_alerts_sent: ofdSent,
      errors:          JSON.stringify(syncErrors),
      status:          finalStatus,
    })
  }

  console.log(`\n${'─'.repeat(56)}`)
  console.log(`  Checked: ${orders.length}  |  Updated: ${updated}  |  OFD alerts: ${ofdSent}`)
  console.log(`  Errors: ${syncErrors.length}  |  Status: ${finalStatus.toUpperCase()}`)
  console.log(`${'─'.repeat(56)}\n`)

  process.exit(syncErrors.length > 0 && orders.length > 0 ? 1 : 0)
}

run().catch(err => {
  console.error('[sync] Fatal error:', err)
  process.exit(1)
})
