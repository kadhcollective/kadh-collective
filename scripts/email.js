// ============================================================
//  KADH COLLECTIVE — Email Module
//  scripts/email.js
//
//  Handles all transactional email for KADH Collective.
//  Called by the storefront after payment success.
//
//  What it does:
//    1. Generates a branded HTML email receipt
//    2. Sends via Resend API
//
//  Environment variables (set in your hosting platform):
//    RESEND_API_KEY   — from resend.com dashboard
//    KADH_FROM_EMAIL  — e.g. orders@kadhcollective.com
//    KADH_SHOP_URL    — e.g. https://kadhcollective.com
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL     = process.env.KADH_FROM_EMAIL || 'orders@kadhcollective.com'
const SHOP_URL       = process.env.KADH_SHOP_URL   || 'https://kadhcollective.com'

// ─── Currency formatter ───────────────────────────────────────

function fmtMYR(amount) {
  return `RM ${Number(amount || 0).toFixed(2)}`
}

// ─── Date formatter ──────────────────────────────────────────

function fmtDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date()
  return d.toLocaleDateString('en-MY', {
    day: '2-digit', month: 'long', year: 'numeric',
    timeZone: 'Asia/Kuala_Lumpur',
  })
}

// ─── Build line items HTML ────────────────────────────────────

function buildItemsHTML(items = []) {
  if (!items.length) return '<tr><td colspan="3" style="padding:12px 0;color:#666;font-size:13px;">No items</td></tr>'
  return items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eae8e4;font-family:'Tenor Sans',Georgia,serif;font-size:13px;color:#000;">
        ${item.name || item.title || 'Item'}
        ${item.variant ? `<span style="color:#666;font-size:12px;display:block;margin-top:2px;">${item.variant}</span>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #eae8e4;font-family:'Tenor Sans',Georgia,serif;font-size:13px;color:#666;text-align:center;">
        × ${item.qty || item.quantity || 1}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #eae8e4;font-family:'Tenor Sans',Georgia,serif;font-size:13px;color:#000;text-align:right;">
        ${fmtMYR((item.price || 0) * (item.qty || item.quantity || 1))}
      </td>
    </tr>
  `).join('')
}

// ─── Build full HTML receipt email ───────────────────────────

function buildReceiptHTML(order) {
  const {
    order_ref     = '',
    customer_name = '',
    email         = '',
    phone         = '',
    address       = '',
    items         = [],
    subtotal      = 0,
    shipping_cost = 0,
    total         = 0,
    shipping_method = '',
    shipping_eta    = '',
    created_at,
  } = order

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>KADH Collective — Order Receipt ${order_ref}</title>
  <link href="https://fonts.googleapis.com/css2?family=Forum&family=Tenor+Sans&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F2F0ED;font-family:'Tenor Sans',Georgia,serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F0ED;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:#F2F0ED;padding:40px 48px 32px;text-align:center;border-bottom:1px solid #ddd9d3;">
              <p style="font-family:'Forum',Georgia,serif;font-size:28px;letter-spacing:0.12em;color:#6B0E0E;margin:0 0 4px;">KADH COLLECTIVE</p>
              <p style="font-family:'Tenor Sans',Georgia,serif;font-size:11px;letter-spacing:0.25em;color:#888;margin:0;text-transform:uppercase;">Order Confirmation &amp; Receipt</p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#ffffff;padding:40px 48px;">

              <!-- Greeting -->
              <p style="font-family:'Forum',Georgia,serif;font-size:20px;color:#000;margin:0 0 8px;">
                Thank you, ${customer_name.split(' ')[0] || 'there'}.
              </p>
              <p style="font-family:'Tenor Sans',Georgia,serif;font-size:14px;color:#444;margin:0 0 32px;line-height:1.6;">
                Your order has been confirmed and we are carefully preparing it for you.
                You will receive a WhatsApp message from us shortly with further details.
              </p>

              <!-- Order Meta -->
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

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #eae8e4;margin:0 0 28px;">

              <!-- Items -->
              <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#999;margin:0 0 12px;font-family:'Tenor Sans',Georgia,serif;">Items Ordered</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                ${buildItemsHTML(items)}
              </table>

              <!-- Totals -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="font-family:'Tenor Sans',Georgia,serif;font-size:13px;color:#666;padding:5px 0;">Subtotal</td>
                  <td style="font-family:'Tenor Sans',Georgia,serif;font-size:13px;color:#000;padding:5px 0;text-align:right;">${fmtMYR(subtotal)}</td>
                </tr>
                <tr>
                  <td style="font-family:'Tenor Sans',Georgia,serif;font-size:13px;color:#666;padding:5px 0;">Shipping</td>
                  <td style="font-family:'Tenor Sans',Georgia,serif;font-size:13px;color:#000;padding:5px 0;text-align:right;">
                    ${Number(shipping_cost) === 0 ? 'Free' : fmtMYR(shipping_cost)}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:12px;border-top:1px solid #eae8e4;"></td>
                </tr>
                <tr>
                  <td style="font-family:'Forum',Georgia,serif;font-size:16px;color:#000;padding:4px 0;letter-spacing:0.03em;">Total</td>
                  <td style="font-family:'Forum',Georgia,serif;font-size:16px;color:#6B0E0E;padding:4px 0;text-align:right;letter-spacing:0.03em;">${fmtMYR(total)}</td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #eae8e4;margin:0 0 28px;">

              <!-- Delivery Info -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:50%;vertical-align:top;padding-right:24px;">
                    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#999;margin:0 0 8px;font-family:'Tenor Sans',Georgia,serif;">Delivering To</p>
                    <p style="font-size:13px;color:#000;font-family:'Tenor Sans',Georgia,serif;margin:0;line-height:1.7;">
                      ${customer_name}<br>
                      ${phone ? phone + '<br>' : ''}
                      ${(address || '').replace(/\n/g, '<br>')}
                    </p>
                  </td>
                  <td style="width:50%;vertical-align:top;text-align:right;">
                    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#999;margin:0 0 8px;font-family:'Tenor Sans',Georgia,serif;">Shipping Method</p>
                    <p style="font-size:13px;color:#000;font-family:'Tenor Sans',Georgia,serif;margin:0 0 12px;">${shipping_method || 'Standard'}</p>
                    ${shipping_eta ? `
                    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#999;margin:0 0 8px;font-family:'Tenor Sans',Georgia,serif;">Estimated Arrival</p>
                    <p style="font-size:13px;color:#000;font-family:'Tenor Sans',Georgia,serif;margin:0;">${shipping_eta}</p>
                    ` : ''}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#F2F0ED;padding:28px 48px;text-align:center;border-top:1px solid #ddd9d3;">
              <p style="font-family:'Tenor Sans',Georgia,serif;font-size:12px;color:#999;margin:0 0 6px;line-height:1.7;">
                Questions? Reply to this email or reach us at
                <a href="mailto:${FROM_EMAIL}" style="color:#6B0E0E;text-decoration:none;">${FROM_EMAIL}</a>
              </p>
              <p style="font-family:'Tenor Sans',Georgia,serif;font-size:11px;color:#bbb;margin:0;">
                © ${new Date().getFullYear()} KADH Collective. All rights reserved.
              </p>
              <p style="margin:12px 0 0;">
                <a href="${SHOP_URL}" style="font-family:'Forum',Georgia,serif;font-size:12px;letter-spacing:0.15em;color:#6B0E0E;text-decoration:none;">kadhcollective.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`
}

// ─── Send receipt email via Resend ────────────────────────────

async function sendReceipt(order) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set')
  if (!order.email)    throw new Error('Order has no email address')

  const html = buildReceiptHTML(order)

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    `KADH Collective <${FROM_EMAIL}>`,
      to:      [order.email],
      subject: `Your KADH Collective order ${order.order_ref} is confirmed`,
      html,
    }),
  })

  const body = await res.json()
  if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(body)}`)

  console.log(`[email] Receipt sent to ${order.email} — ID: ${body.id}`)
  return body
}

// ─── Re-send receipt (called from admin panel) ───────────────

async function resendReceipt(order) {
  return sendReceipt(order)
}

module.exports = { sendReceipt, resendReceipt, buildReceiptHTML }
