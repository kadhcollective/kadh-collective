// ============================================================
//  KADH COLLECTIVE — Unified Notifier
//  scripts/notify.js
//
//  Sends branded emails via Resend and WhatsApp messages via
//  Meta Cloud API. Called by tracking-sync.js for every
//  automated customer-facing notification.
//
//  Environment variables required (set in GitHub Actions secrets):
//    RESEND_API_KEY        — from resend.com dashboard
//    META_WA_TOKEN         — from Meta Developer Portal
//    META_WA_PHONE_ID      — your WhatsApp Business phone number ID
//    KADH_FROM_EMAIL       — e.g. orders@kadhcollective.com
//    KADH_SHOP_URL         — e.g. https://kadhcollective.com
// ============================================================

const RESEND_API    = 'https://api.resend.com/emails'
const META_WA_API   = `https://graph.facebook.com/v19.0/${process.env.META_WA_PHONE_ID}/messages`
const FROM_EMAIL    = process.env.KADH_FROM_EMAIL  || 'orders@kadhcollective.com'
const SHOP_URL      = process.env.KADH_SHOP_URL    || 'https://kadhcollective.com'
const WA_NUMBER     = '60183977367'

// ─── Courier tracking URL map ────────────────────────────────
const COURIER_TRACK = {
  'Pos Laju':          'https://track.pos.com.my/postal-services-item-tracking-system/?itemIdNos=',
  'J&T Express':       'https://www.jtexpress.my/index/query/gzquery.html?bills=',
  'GDEX':              'https://www.gdexpress.com/official/index.php?controller=tracking&awb=',
  'DHL Express':       'https://www.dhl.com/my-en/home/tracking/tracking-express.html?submit=1&tracking-id=',
  'DHL International': 'https://www.dhl.com/my-en/home/tracking/tracking-express.html?submit=1&tracking-id=',
  'FedEx':             'https://www.fedex.com/fedextrack/?trknbr=',
  'Aramex':            'https://www.aramex.com/us/en/track/results?ShipmentNumber=',
}

function buildTrackUrl(courier, awb) {
  if (!awb) return `${SHOP_URL}/track.html`
  const base = COURIER_TRACK[courier]
  return base
    ? base + encodeURIComponent(awb)
    : `https://easyparcel.com/my/en/track/?awb=${encodeURIComponent(awb)}`
}

function buildKADHTrackUrl(order) {
  const ref = encodeURIComponent(order.order_ref || '')
  const awb = encodeURIComponent(order.ep_awb || order.ep_tracking_no || '')
  return `${SHOP_URL}/track.html?ref=${ref}&awb=${awb}`
}

// ─── Email templates ─────────────────────────────────────────

function emailBase(title, preheader, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Jost:wght@300;400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#F4EDE3;font-family:'Jost',sans-serif;font-size:14px;color:#2C2418;-webkit-font-smoothing:antialiased}
  .wrap{max-width:600px;margin:0 auto;background:#FAF7F2}
  .header{background:#2C2418;padding:28px 40px;text-align:center}
  .brand{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;letter-spacing:.18em;color:#FAF7F2}
  .brand span{color:#B8965A}
  .body{padding:40px}
  .eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#B8965A;margin-bottom:8px}
  .title{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:300;color:#2C2418;margin-bottom:16px;line-height:1.3}
  .para{font-size:13px;color:#6B5D4F;line-height:1.8;margin-bottom:16px}
  .box{background:#F4EDE3;border:1px solid #E8DFD0;border-radius:8px;padding:20px 24px;margin:20px 0}
  .box-label{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#B8965A;margin-bottom:12px}
  .row{display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid #E8DFD0}
  .row:last-child{border-bottom:none}
  .row-key{color:#6B5D4F}
  .row-val{font-weight:500;color:#2C2418}
  .total-row{display:flex;justify-content:space-between;font-family:'Cormorant Garamond',serif;font-size:18px;padding-top:12px;border-top:1px solid #2C2418;margin-top:8px}
  .btn{display:block;background:#2C2418;color:#FAF7F2;text-align:center;padding:14px 32px;border-radius:4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;margin:24px 0}
  .btn-gold{background:#B8965A}
  .divider{border:none;border-top:1px solid #E8DFD0;margin:28px 0}
  .footer{background:#2C2418;padding:20px 40px;text-align:center}
  .footer-text{font-size:10px;color:rgba(250,247,242,.45);letter-spacing:.06em;line-height:1.8}
  .footer-brand{font-family:'Cormorant Garamond',serif;font-size:14px;color:#B8965A;letter-spacing:.16em;margin-bottom:8px}
  .wa-badge{display:inline-block;background:#25D366;color:#fff;padding:8px 20px;border-radius:20px;font-size:11px;text-decoration:none;margin-top:8px}
  .track-pill{display:inline-flex;align-items:center;gap:6px;background:#F4EDE3;border:1px solid #E8DFD0;border-radius:20px;padding:6px 14px;font-size:11px;color:#2C2418;text-decoration:none;margin:4px 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="brand">KADH <span>COLLECTIVE</span></div>
  </div>
  <div class="body">
    ${bodyHtml}
  </div>
  <div class="footer">
    <div class="footer-brand">KADH COLLECTIVE</div>
    <div class="footer-text">
      Ships from Kuala Lumpur, Malaysia<br>
      Questions? <a href="https://wa.me/${WA_NUMBER}" style="color:#B8965A">WhatsApp us</a> · hello@kadhcollective.com<br>
      © ${new Date().getFullYear()} KADH Collective. All rights reserved.
    </div>
  </div>
</div>
</body>
</html>`
}

function itemsHtml(items = []) {
  return items.map(i =>
    `<div class="row">
      <span class="row-key">${i.name || 'Item'} × ${i.qty || 1}</span>
      <span class="row-val">RM ${Number(i.line_total || (+(i.unit_price||i.price||0)) * (i.qty||1)).toFixed(2)}</span>
    </div>`
  ).join('')
}

// Template: order confirmed
function emailOrderConfirmed(order) {
  const firstName = (order.customer_name || '').split(' ')[0]
  const kadhUrl   = buildKADHTrackUrl(order)
  const items     = Array.isArray(order.items) ? order.items : []
  return {
    subject: `Order Confirmed — ${order.order_ref}`,
    html: emailBase(
      `Order Confirmed — ${order.order_ref}`,
      `Your KADH Collective order has been received`,
      `<div class="eyebrow">Order Confirmed</div>
      <div class="title">Shukran, ${firstName}! 🌙</div>
      <p class="para">Your order has been received and validated. We're carefully preparing your pieces and will dispatch them soon.</p>
      <div class="box">
        <div class="box-label">Order Summary — ${order.order_ref}</div>
        ${itemsHtml(items)}
        <div class="row">
          <span class="row-key">Shipping (${order.shipping_method || 'Standard'})</span>
          <span class="row-val">${order.shipping_cost > 0 ? 'RM ' + Number(order.shipping_cost).toFixed(2) : 'Free'}</span>
        </div>
        <div class="total-row"><span>Total</span><span>RM ${Number(order.total||0).toFixed(2)}</span></div>
      </div>
      <div class="box">
        <div class="box-label">Shipping To</div>
        <div class="row"><span class="row-key">Name</span><span class="row-val">${order.customer_name}</span></div>
        <div class="row"><span class="row-key">Address</span><span class="row-val">${order.address}</span></div>
        <div class="row"><span class="row-key">Country</span><span class="row-val">${order.country}</span></div>
        <div class="row"><span class="row-key">Est. Delivery</span><span class="row-val">${order.shipping_eta || '—'}</span></div>
      </div>
      <a href="${kadhUrl}" class="btn">Track My Order</a>
      <p class="para" style="font-size:12px;text-align:center">We'll email you again when your order is dispatched with tracking details.</p>`
    )
  }
}

// Template: dispatched
function emailDispatched(order) {
  const firstName = (order.customer_name || '').split(' ')[0]
  const trackUrl  = buildTrackUrl(order.ep_courier, order.ep_awb || order.ep_tracking_no)
  const kadhUrl   = buildKADHTrackUrl(order)
  return {
    subject: `Your order is on its way — ${order.order_ref}`,
    html: emailBase(
      `Dispatched — ${order.order_ref}`,
      `Your KADH Collective parcel is on its way`,
      `<div class="eyebrow">Dispatched</div>
      <div class="title">Your parcel is on its way, ${firstName}! 📦</div>
      <p class="para">Your KADH Collective order has been collected by <strong>${order.ep_courier || 'your courier'}</strong> and is now in transit to you.</p>
      <div class="box">
        <div class="box-label">Shipment Details</div>
        <div class="row"><span class="row-key">Order Ref</span><span class="row-val">${order.order_ref}</span></div>
        <div class="row"><span class="row-key">Courier</span><span class="row-val">${order.ep_courier || '—'}</span></div>
        <div class="row"><span class="row-key">Tracking No</span><span class="row-val" style="font-family:monospace">${order.ep_awb || order.ep_tracking_no || '—'}</span></div>
        <div class="row"><span class="row-key">Est. Delivery</span><span class="row-val">${order.shipping_eta || '—'}</span></div>
        <div class="row"><span class="row-key">Handover</span><span class="row-val">${order.ep_handover === 'dropoff' ? 'Drop-Off' : 'Courier Pickup'}</span></div>
      </div>
      <a href="${trackUrl}" class="btn btn-gold">Track on ${order.ep_courier || 'Courier'} Website</a>
      <p class="para" style="text-align:center;font-size:12px">Or track via your <a href="${kadhUrl}" style="color:#B8965A">KADH order page</a></p>`
    )
  }
}

// Template: out for delivery
function emailOFD(order) {
  const firstName = (order.customer_name || '').split(' ')[0]
  const trackUrl  = buildTrackUrl(order.ep_courier, order.ep_awb || order.ep_tracking_no)
  const kadhUrl   = buildKADHTrackUrl(order)
  return {
    subject: `🚚 Out for delivery today — ${order.order_ref}`,
    html: emailBase(
      `Out for Delivery — ${order.order_ref}`,
      `Your parcel is out for delivery today!`,
      `<div class="eyebrow">Out for Delivery</div>
      <div class="title">Your parcel arrives today, ${firstName}! 🚚</div>
      <p class="para">Great news — your KADH Collective parcel is <strong>out for delivery today</strong>. Please ensure someone is available to receive it at your address.</p>
      <div class="box" style="border-color:#B8965A;background:#FFFDF9">
        <div class="box-label">Delivery Details</div>
        <div class="row"><span class="row-key">Courier</span><span class="row-val">${order.ep_courier || '—'}</span></div>
        <div class="row"><span class="row-key">Tracking No</span><span class="row-val" style="font-family:monospace">${order.ep_awb || order.ep_tracking_no || '—'}</span></div>
        <div class="row"><span class="row-key">Delivering To</span><span class="row-val">${order.address || '—'}</span></div>
      </div>
      <a href="${trackUrl}" class="btn btn-gold">Track in Real Time</a>
      <p class="para" style="font-size:12px;text-align:center">If you miss the delivery, the courier will leave a notice. You can also track via your <a href="${kadhUrl}" style="color:#B8965A">KADH order page</a>.</p>
      <p class="para" style="font-size:12px;text-align:center">Questions? <a href="https://wa.me/${WA_NUMBER}" style="color:#B8965A">WhatsApp us immediately</a> — we'll help coordinate.</p>`
    )
  }
}

// Template: delivered
function emailDelivered(order) {
  const firstName = (order.customer_name || '').split(' ')[0]
  return {
    subject: `Delivered! Hope you love it — ${order.order_ref}`,
    html: emailBase(
      `Delivered — ${order.order_ref}`,
      `Your KADH Collective order has been delivered`,
      `<div class="eyebrow">Delivered</div>
      <div class="title">It's arrived, ${firstName}! 🎉</div>
      <p class="para">Your KADH Collective order has been successfully delivered. We hope you absolutely love your new pieces.</p>
      <p class="para" style="text-align:center;font-size:1.2rem;font-family:'Cormorant Garamond',serif;font-weight:300">Shukran for choosing KADH Collective. 🤍</p>
      <hr class="divider">
      <p class="para" style="font-size:12px">If anything isn't right with your order — wrong item, damage, or any concerns — please reach out within 30 days and we'll make it right.</p>
      <a href="https://wa.me/${WA_NUMBER}" class="btn">Contact Us on WhatsApp</a>`
    )
  }
}

// ─── WhatsApp message templates ──────────────────────────────

function waOrderConfirmed(order) {
  const firstName = (order.customer_name || '').split(' ')[0]
  const kadhUrl   = buildKADHTrackUrl(order)
  return (
    `Assalamualaikum ${firstName}! 🌙\n\n` +
    `*Order Confirmed — ${order.order_ref}* ✅\n\n` +
    `Thank you for your order! We've received it and it's being prepared with care.\n\n` +
    `*Total:* RM ${Number(order.total||0).toFixed(2)}\n` +
    `*Est. Delivery:* ${order.shipping_eta || '—'}\n\n` +
    `Track your order anytime:\n${kadhUrl}\n\n` +
    `We'll message you again when it's dispatched. Shukran! 🤍`
  )
}

function waDispatched(order) {
  const firstName = (order.customer_name || '').split(' ')[0]
  const trackUrl  = buildTrackUrl(order.ep_courier, order.ep_awb || order.ep_tracking_no)
  const kadhUrl   = buildKADHTrackUrl(order)
  return (
    `Assalamualaikum ${firstName}! 📦\n\n` +
    `Your KADH Collective order *${order.order_ref}* has been dispatched!\n\n` +
    `*Courier:* ${order.ep_courier || '—'}\n` +
    `*Tracking No:* ${order.ep_awb || order.ep_tracking_no || '—'}\n` +
    `*Est. Delivery:* ${order.shipping_eta || '—'}\n\n` +
    `Track your parcel:\n${trackUrl}\n\n` +
    `Or via your KADH order page:\n${kadhUrl}\n\n` +
    `Shukran for your patience! 🤍`
  )
}

function waOFD(order) {
  const firstName = (order.customer_name || '').split(' ')[0]
  const trackUrl  = buildTrackUrl(order.ep_courier, order.ep_awb || order.ep_tracking_no)
  return (
    `Assalamualaikum ${firstName}! 🚚✨\n\n` +
    `Your KADH Collective parcel is *OUT FOR DELIVERY* today!\n\n` +
    `*Order:* ${order.order_ref}\n` +
    `*Courier:* ${order.ep_courier || '—'}\n` +
    `*Tracking No:* ${order.ep_awb || order.ep_tracking_no || '—'}\n\n` +
    `Please ensure someone is available to receive your parcel. If you miss it, ` +
    `the courier will leave a notice at your door.\n\n` +
    `📦 Track in real time:\n${trackUrl}\n\n` +
    `Questions? Just reply to this message. Shukran! 🤍\n` +
    `— KADH Collective`
  )
}

function waDelivered(order) {
  const firstName = (order.customer_name || '').split(' ')[0]
  return (
    `Assalamualaikum ${firstName}! 🎉\n\n` +
    `Your KADH Collective order *${order.order_ref}* has been *delivered*!\n\n` +
    `We hope you love your new pieces. Shukran for choosing KADH Collective! 🤍\n\n` +
    `If anything isn't right, please reply within 30 days and we'll make it right.`
  )
}

// ─── Send via Resend ─────────────────────────────────────────

async function sendEmail(to, template) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[notify] RESEND_API_KEY not set — skipping email')
    return { skipped: true }
  }
  if (!to || !to.includes('@')) {
    console.warn('[notify] Invalid email address:', to)
    return { skipped: true }
  }

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    `KADH Collective <${FROM_EMAIL}>`,
      to:      [to],
      subject: template.subject,
      html:    template.html,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(data)}`)
  return data  // { id: 're_xxxx' }
}

// ─── Send via Meta WhatsApp Cloud API ────────────────────────

async function sendWhatsApp(phone, text) {
  if (!process.env.META_WA_TOKEN || !process.env.META_WA_PHONE_ID) {
    console.warn('[notify] META_WA_TOKEN or META_WA_PHONE_ID not set — skipping WA')
    return { skipped: true }
  }

  // Normalise phone — remove spaces, dashes, brackets, leading +
  const cleaned = String(phone || '').replace(/[\s\-()]/g, '').replace(/^\+/, '')
  if (!cleaned || cleaned.length < 7) {
    console.warn('[notify] Invalid phone number:', phone)
    return { skipped: true }
  }

  const res = await fetch(META_WA_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.META_WA_TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to:                cleaned,
      type:              'text',
      text:              { body: text },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Meta WA error: ${JSON.stringify(data)}`)
  return data  // { messages: [{ id: 'wamid.xxx' }] }
}

// ─── Master notification dispatcher ─────────────────────────
//
// channel: 'order_confirmed' | 'dispatched' | 'ofd' | 'delivered'
// Returns: { email: result, whatsapp: result }

async function notify(order, channel) {
  const results = { email: null, whatsapp: null }
  const TEMPLATES = {
    order_confirmed: { email: emailOrderConfirmed, wa: waOrderConfirmed },
    dispatched:      { email: emailDispatched,     wa: waDispatched     },
    ofd:             { email: emailOFD,            wa: waOFD            },
    delivered:       { email: emailDelivered,      wa: waDelivered      },
  }

  const tmpl = TEMPLATES[channel]
  if (!tmpl) throw new Error(`Unknown notification channel: ${channel}`)

  // Send email
  try {
    if (order.email) {
      results.email = await sendEmail(order.email, tmpl.email(order))
      console.log(`[notify] Email sent to ${order.email} — channel: ${channel}`)
    }
  } catch (err) {
    console.error(`[notify] Email failed for ${order.order_ref}:`, err.message)
    results.email = { error: err.message }
  }

  // Send WhatsApp
  try {
    if (order.phone) {
      const text = tmpl.wa(order)
      results.whatsapp = await sendWhatsApp(order.phone, text)
      console.log(`[notify] WA sent to ${order.phone} — channel: ${channel}`)
    }
  } catch (err) {
    console.error(`[notify] WA failed for ${order.order_ref}:`, err.message)
    results.whatsapp = { error: err.message }
  }

  return results
}

module.exports = { notify, sendEmail, sendWhatsApp, buildTrackUrl, buildKADHTrackUrl }
