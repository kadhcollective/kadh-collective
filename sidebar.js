// sidebar.js — KADH Admin Sidebar & Dashboard Utilities
// All functions operate on globals exposed by admin.html:
//   _orders, _products, sb (Supabase client), fmtMYR(), fmtDate()

// ─── Sidebar toggle (mobile) ──────────────────────────────

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
}

// ─── Breadcrumb builder ───────────────────────────────────
// Usage: buildBreadcrumb(['Dashboard', 'Orders', 'KADH-001'])
// Expects a <ol id="breadcrumb"> or <ul id="breadcrumb"> in the DOM.

function buildBreadcrumb(crumbs) {
  const container = document.getElementById('breadcrumb');
  if (!container) return;
  container.innerHTML = '';

  crumbs.forEach((crumb, i) => {
    const li = document.createElement('li');
    li.textContent = crumb;
    li.style.cssText = `
      display: inline;
      font-size: .72rem;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: ${i === crumbs.length - 1 ? 'var(--black)' : 'var(--muted)'};
    `;
    if (i < crumbs.length - 1) {
      const sep = document.createElement('span');
      sep.textContent = ' › ';
      sep.style.color = 'var(--muted)';
      container.appendChild(li);
      container.appendChild(sep);
    } else {
      container.appendChild(li);
    }
  });
}

// ─── Date range filter ────────────────────────────────────
// Filters the global _orders array by date range and re-renders the orders table.
// startDate / endDate: ISO strings or Date objects (e.g. '2025-01-01')

function dateRangeFilter(startDate, endDate) {
  if (!window._orders) return;

  const start = startDate ? new Date(startDate) : null;
  const end   = endDate   ? new Date(endDate)   : null;
  if (end) end.setHours(23, 59, 59, 999); // include the full end day

  // Temporarily override _orders with filtered slice, render, then restore
  const original = window._orders;
  window._orders = original.filter(o => {
    const d = new Date(o.created_at);
    if (start && d < start) return false;
    if (end   && d > end)   return false;
    return true;
  });

  if (typeof renderOrders === 'function') renderOrders();

  // Restore full dataset after render so search/filter still works
  window._orders = original;
}

// ─── Revenue chart renderer ───────────────────────────────
// Renders a simple SVG bar chart into #revenue-chart.
// data: array of { label: string, value: number }
// Example: renderRevenueChart([{ label: 'Jan', value: 1200 }, ...])

function renderRevenueChart(data) {
  const container = document.getElementById('revenue-chart');
  if (!container || !data || !data.length) return;

  const W = container.clientWidth  || 500;
  const H = 180;
  const PAD_L = 48, PAD_B = 28, PAD_T = 16, PAD_R = 16;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barW   = Math.max(4, Math.floor((chartW / data.length) * 0.6));
  const gap    = (chartW - barW * data.length) / (data.length + 1);

  // Y-axis tick count
  const ticks = 4;
  let yLines = '';
  let yLabels = '';
  for (let i = 0; i <= ticks; i++) {
    const y = PAD_T + chartH - (i / ticks) * chartH;
    const val = Math.round((i / ticks) * maxVal);
    yLines  += `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="var(--border-l)" stroke-dasharray="3,3"/>`;
    yLabels += `<text x="${PAD_L - 6}" y="${y + 4}" text-anchor="end" font-size="9" fill="var(--muted)">RM${val >= 1000 ? (val/1000).toFixed(1)+'k' : val}</text>`;
  }

  let bars = '';
  let xLabels = '';
  data.forEach((d, i) => {
    const x   = PAD_L + gap + i * (barW + gap);
    const bh  = Math.max(2, (d.value / maxVal) * chartH);
    const y   = PAD_T + chartH - bh;
    bars    += `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="var(--crimson)" rx="2" opacity=".85">
                  <title>${d.label}: RM${Number(d.value).toFixed(2)}</title>
                </rect>`;
    xLabels += `<text x="${x + barW / 2}" y="${H - 6}" text-anchor="middle" font-size="9" fill="var(--muted)">${d.label}</text>`;
  });

  container.innerHTML = `
    <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${yLines}${yLabels}${bars}${xLabels}
    </svg>`;
}

// ─── Audit log helper ─────────────────────────────────────
// Fetches from Supabase `audit_logs` table and renders into #audit-log.
// Falls back gracefully if the table doesn't exist yet.

async function fetchAuditLogs() {
  const container = document.getElementById('audit-log');
  if (!container) return;

  container.innerHTML = '<div class="spinner"></div>';

  try {
    const { data, error } = await sb
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      // Table may not exist yet — show a graceful message
      container.innerHTML = '<p style="font-size:.8rem;color:var(--muted);">No audit log table found.</p>';
      return;
    }

    if (!data || !data.length) {
      container.innerHTML = '<p style="font-size:.8rem;color:var(--muted);">No audit entries yet.</p>';
      return;
    }

    container.innerHTML = data.map(entry => `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;
                  padding:.45rem 0;border-bottom:1px solid var(--border-l);font-size:.78rem;">
        <div>
          <span style="font-weight:500;">${entry.action || '—'}</span>
          ${entry.detail ? `<span style="color:var(--muted);margin-left:.4rem;">${entry.detail}</span>` : ''}
        </div>
        <span style="color:var(--muted);white-space:nowrap;margin-left:.75rem;">
          ${typeof fmtDate === 'function' ? fmtDate(entry.created_at) : entry.created_at?.slice(0, 10) || ''}
        </span>
      </div>`).join('');
  } catch (e) {
    container.innerHTML = `<p style="font-size:.8rem;color:var(--danger);">Error: ${e.message}</p>`;
  }
}

// ─── Funnel bar renderer ──────────────────────────────────
// Renders order-status counts as a horizontal funnel into #conversion-funnel.
// data: object keyed by status, e.g. { pending: 5, confirmed: 12, shipped: 8, delivered: 3 }
// If data is omitted it is derived from the global _orders array.

function renderFunnelBar(data) {
  const container = document.getElementById('conversion-funnel');
  if (!container) return;

  // Derive from _orders if no data passed
  if (!data && window._orders) {
    data = { pending: 0, confirmed: 0, shipped: 0, delivered: 0, flagged: 0 };
    window._orders.forEach(o => {
      if (data[o.status] !== undefined) data[o.status]++;
      else data[o.status] = (data[o.status] || 0) + 1;
    });
  }
  if (!data) return;

  const stages = [
    { key: 'pending',   label: 'Pending',   color: '#92400E', bg: '#FEF3C7' },
    { key: 'confirmed', label: 'Confirmed', color: '#1E40AF', bg: '#DBEAFE' },
    { key: 'shipped',   label: 'Shipped',   color: '#065F46', bg: '#D1FAE5' },
    { key: 'delivered', label: 'Delivered', color: '#065F46', bg: '#D1FAE5' },
    { key: 'flagged',   label: 'Flagged',   color: '#991B1B', bg: '#FEE2E2' },
  ];

  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;

  container.innerHTML = stages.map(s => {
    const count = data[s.key] || 0;
    const pct   = Math.round((count / total) * 100);
    return `
      <div style="margin-bottom:.6rem;">
        <div style="display:flex;justify-content:space-between;font-size:.72rem;
                    color:var(--muted);margin-bottom:.25rem;">
          <span>${s.label}</span>
          <span>${count} <span style="opacity:.6;">(${pct}%)</span></span>
        </div>
        <div style="height:10px;background:var(--border-l);border-radius:20px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${s.bg};border-radius:20px;
                      border:1px solid ${s.color};transition:width .3s ease;"></div>
        </div>
      </div>`;
  }).join('');
}

// ─── Variant row builder ──────────────────────────────────
// Builds a product variant row HTML string for use in the product modal.
// variant: { id, size, color, stock, price_modifier }
// Returns an HTML string — caller should inject into the variant container.

function buildVariantRow(variant = {}) {
  const id  = variant.id    || `v_${Date.now()}`;
  const sid = id.replace(/[^a-z0-9]/gi, '_');

  return `
    <div class="variant-row" id="vrow_${sid}"
         style="display:grid;grid-template-columns:1fr 1fr 80px 80px auto;
                gap:.5rem;align-items:center;margin-bottom:.5rem;">
      <input class="field-input" placeholder="Size (e.g. S / M / L)"
             value="${variant.size  || ''}"
             id="vsize_${sid}">
      <input class="field-input" placeholder="Colour (e.g. Black)"
             value="${variant.color || ''}"
             id="vcolor_${sid}">
      <input class="field-input" type="number" min="0" placeholder="Stock"
             value="${variant.stock !== undefined ? variant.stock : ''}"
             id="vstock_${sid}">
      <input class="field-input" type="number" step="0.01" placeholder="±Price"
             value="${variant.price_modifier !== undefined ? variant.price_modifier : ''}"
             id="vprice_${sid}"
             title="Price modifier (e.g. +10 or -5 from base price)">
      <button class="btn btn-danger btn-xs"
              onclick="document.getElementById('vrow_${sid}').remove()"
              title="Remove variant">✕</button>
    </div>`;
}
