/* ═══════════════════════════════════════════════════
   KADH ADMIN — sidebar.js
   Floating collapsible sidebar + breadcrumb helpers
   ═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  const LS_KEY = 'kadh_sidebar_open';

  /* ─── Init: inject DOM elements ─── */
  function initSidebar() {
    // Inject overlay element if not present
    if (!document.getElementById('sidebar-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'sidebar-overlay';
      overlay.className = 'sidebar-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlay);
      overlay.addEventListener('click', closeSidebar);
    }

    // Inject floating tab if not present
    if (!document.getElementById('sidebar-tab')) {
      const tab = document.createElement('button');
      tab.id = 'sidebar-tab';
      tab.className = 'sidebar-tab';
      tab.setAttribute('aria-label', 'Toggle navigation');
      tab.setAttribute('title', 'Toggle navigation');
      tab.innerHTML = '<span class="tab-icon">›</span>';
      document.body.appendChild(tab);
      tab.addEventListener('click', toggleSidebar);
    }

    // Wire topbar menu button if present
    const menuBtn = document.getElementById('topbar-menu-btn');
    if (menuBtn) menuBtn.addEventListener('click', toggleSidebar);

    // Keyboard: Escape closes sidebar
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSidebar();
    });

    // Restore state from localStorage
    const savedOpen = localStorage.getItem(LS_KEY);
    if (savedOpen === 'true') {
      openSidebar(true /* skipAnimation */);
    }
  }

  /* ─── Open ─── */
  function openSidebar(instant) {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;

    if (instant) {
      sidebar.style.transition = 'none';
      setTimeout(() => { sidebar.style.transition = ''; }, 50);
    }

    sidebar.classList.add('open');
    document.body.classList.add('sidebar-open');
    if (overlay) overlay.classList.add('visible');
    localStorage.setItem(LS_KEY, 'true');
  }

  /* ─── Close ─── */
  function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;

    sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
    if (overlay) overlay.classList.remove('visible');
    localStorage.setItem(LS_KEY, 'false');
  }

  /* ─── Toggle ─── */
  function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  /* ─── Breadcrumb builder ─── */
  // Usage: setBreadcrumb([{label:'Dashboard', panel:'dashboard'}, {label:'Orders'}, {label:'#1042', current:true}])
  function setBreadcrumb(crumbs) {
    const el = document.getElementById('breadcrumb');
    if (!el) return;

    if (!crumbs || crumbs.length === 0) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = crumbs.map(function (c, i) {
      const isLast = i === crumbs.length - 1;
      let html = '<span class="breadcrumb-item' + (isLast ? ' current' : '') + '">';

      if (!isLast && c.panel) {
        html += '<span class="breadcrumb-link" onclick="showPanel(\'' + c.panel + '\', null)">' + escHtml(c.label) + '</span>';
      } else if (!isLast && c.href) {
        html += '<a href="' + escHtml(c.href) + '">' + escHtml(c.label) + '</a>';
      } else if (!isLast && c.onclick) {
        html += '<span class="breadcrumb-link" onclick="' + c.onclick + '">' + escHtml(c.label) + '</span>';
      } else {
        html += escHtml(c.label);
      }

      html += '</span>';

      if (!isLast) {
        html += '<span class="breadcrumb-sep">›</span>';
      }

      return html;
    }).join('');
  }

  /* ─── Date range filter helper ─── */
  // Call initDateRangeBar(containerId, onChange)
  // onChange(startDate, endDate) called with Date objects (or null for All Time)
  function initDateRangeBar(containerId, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const buttons = container.querySelectorAll('.drb-btn[data-range]');
    const customWrap = container.querySelector('.drb-custom');
    const fromInput  = container.querySelector('.drb-from');
    const toInput    = container.querySelector('.drb-to');

    function setActive(btn) {
      buttons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    }

    function getRange(type) {
      const now   = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

      if (type === 'today') return { from: today, to: tomorrow };

      if (type === 'week') {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return { from: weekStart, to: tomorrow };
      }

      if (type === 'month') {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: monthStart, to: tomorrow };
      }

      return { from: null, to: null }; // all time
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setActive(btn);
        const range = btn.dataset.range;

        if (range === 'custom') {
          if (customWrap) customWrap.style.display = 'flex';
          return;
        }

        if (customWrap) customWrap.style.display = 'none';
        const { from, to } = getRange(range);
        if (onChange) onChange(from, to);
      });
    });

    function applyCustom() {
      if (!fromInput || !toInput) return;
      const from = fromInput.value ? new Date(fromInput.value) : null;
      const to   = toInput.value   ? new Date(toInput.value + 'T23:59:59') : null;
      if (onChange) onChange(from, to);
    }

    if (fromInput) fromInput.addEventListener('change', applyCustom);
    if (toInput)   toInput.addEventListener('change', applyCustom);
  }

  /* ─── Revenue chart renderer (Canvas-based, no external deps) ─── */
  // Usage: renderRevenueChart('canvasId', [{label:'Mon', value:1200}, ...], 'line'|'bar')
  function renderRevenueChart(canvasId, data, type) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.getContext) return;

    const ctx    = canvas.getContext('2d');
    const W      = canvas.offsetWidth  || 600;
    const H      = canvas.offsetHeight || 200;
    canvas.width  = W * window.devicePixelRatio;
    canvas.height = H * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, W, H);

    if (!data || data.length === 0) {
      ctx.fillStyle = '#6B5D4F';
      ctx.font = '13px Jost, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data for this period', W / 2, H / 2);
      return;
    }

    const gold   = '#B8965A';
    const dark   = '#2C2418';
    const sand   = '#E8DFD0';
    const pad    = { top: 20, right: 20, bottom: 36, left: 52 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top  - pad.bottom;
    const max    = Math.max(...data.map(function (d) { return d.value; }), 1);
    const step   = chartW / (data.length > 1 ? data.length - 1 : 1);

    // Grid lines
    const gridLines = 4;
    ctx.strokeStyle = sand;
    ctx.lineWidth   = 1;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + chartH - (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();

      // Y labels
      const val = (max / gridLines * i).toFixed(0);
      ctx.fillStyle = '#6B5D4F';
      ctx.font = '10px Jost, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('RM ' + Number(val).toLocaleString(), pad.left - 6, y + 4);
    }

    // Points array
    const pts = data.map(function (d, i) {
      return {
        x: pad.left + (data.length > 1 ? i * step : chartW / 2),
        y: pad.top  + chartH - (d.value / max) * chartH,
        label: d.label,
        value: d.value,
      };
    });

    if (type === 'bar') {
      const barW = Math.max(4, step * 0.55);
      pts.forEach(function (p) {
        const barH = (chartH * data[pts.indexOf(p)].value / max);
        ctx.fillStyle = gold;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.roundRect
          ? ctx.roundRect(p.x - barW / 2, p.y, barW, pad.top + chartH - p.y, 3)
          : ctx.rect(p.x - barW / 2, p.y, barW, pad.top + chartH - p.y);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    } else {
      // Area fill
      ctx.beginPath();
      pts.forEach(function (p, i) { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
      ctx.lineTo(pts[pts.length - 1].x, pad.top + chartH);
      ctx.lineTo(pts[0].x, pad.top + chartH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
      grad.addColorStop(0,   'rgba(184,150,90,0.25)');
      grad.addColorStop(1,   'rgba(184,150,90,0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      pts.forEach(function (p, i) { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
      ctx.strokeStyle = gold;
      ctx.lineWidth   = 2.5;
      ctx.lineJoin    = 'round';
      ctx.stroke();

      // Dots
      pts.forEach(function (p) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle   = '#fff';
        ctx.strokeStyle = gold;
        ctx.lineWidth   = 2;
        ctx.fill();
        ctx.stroke();
      });
    }

    // X labels
    ctx.fillStyle  = '#6B5D4F';
    ctx.font       = '10px Jost, sans-serif';
    ctx.textAlign  = 'center';
    pts.forEach(function (p) {
      ctx.fillText(p.label, p.x, pad.top + chartH + 18);
    });
  }

  /* ─── Audit log helper ─── */
  // logAuditEntry({ action, user, time, type:'success'|'danger'|'info'|'' })
  function logAuditEntry(entry) {
    const list = document.getElementById('audit-list');
    if (!list) return;

    const li = document.createElement('li');
    li.className = 'audit-entry';

    const typeClass = entry.type || '';
    const timeStr   = entry.time
      ? new Date(entry.time).toLocaleString('en-MY')
      : new Date().toLocaleString('en-MY');

    li.innerHTML =
      '<div class="audit-dot ' + typeClass + '"></div>' +
      '<div class="audit-body">' +
        '<div class="audit-action">' + entry.action + '</div>' +
        '<div class="audit-meta">' +
          '<span>' + escHtml(entry.user || 'Admin') + '</span>' +
          '<span>·</span>' +
          '<span>' + timeStr + '</span>' +
        '</div>' +
      '</div>';

    list.insertBefore(li, list.firstChild);
  }

  /* ─── Funnel bar renderer ─── */
  // renderFunnel([{label:'Views',value:1000},{label:'Cart',value:450},…])
  function renderFunnel(steps) {
    const container = document.getElementById('funnel-steps');
    if (!container) return;

    const max = steps[0] ? steps[0].value : 1;
    container.innerHTML = steps.map(function (s) {
      const pct    = max > 0 ? Math.round((s.value / max) * 100) : 0;
      const barPct = Math.max(pct, 3);
      return (
        '<div class="funnel-step">' +
          '<div class="funnel-label">' + escHtml(s.label) + '</div>' +
          '<div class="funnel-bar-wrap">' +
            '<div class="funnel-bar" style="width:' + barPct + '%">' +
              '<span>' + Number(s.value).toLocaleString() + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="funnel-pct">' + pct + '%</div>' +
        '</div>'
      );
    }).join('');
  }

  /* ─── Variant row builder ─── */
  function addVariantRow(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    data = data || {};
    const row = document.createElement('div');
    row.className = 'variant-row';
    row.innerHTML =
      '<input type="text"   placeholder="e.g. Black / M" value="' + escAttr(data.label || '') + '">' +
      '<input type="number" placeholder="RM"   value="' + escAttr(data.price || '') + '" min="0" step="0.01">' +
      '<input type="number" placeholder="Qty"  value="' + escAttr(data.qty   || '') + '" min="0">' +
      '<button class="variant-del" title="Remove" onclick="this.parentElement.remove()">×</button>';
    container.appendChild(row);
  }

  function getVariants(containerId) {
    const rows = document.querySelectorAll('#' + containerId + ' .variant-row');
    return Array.from(rows).map(function (row) {
      const inputs = row.querySelectorAll('input');
      return {
        label: inputs[0] ? inputs[0].value.trim() : '',
        price: inputs[1] ? parseFloat(inputs[1].value) || 0 : 0,
        qty:   inputs[2] ? parseInt(inputs[2].value)   || 0 : 0,
      };
    }).filter(function (v) { return v.label; });
  }

  /* ─── Escape helpers ─── */
  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escAttr(str) {
    return String(str || '').replace(/"/g, '&quot;');
  }

  /* ─── Expose public API ─── */
  window.KADH = window.KADH || {};
  window.KADH.sidebar = {
    open:    openSidebar,
    close:   closeSidebar,
    toggle:  toggleSidebar,
  };
  window.KADH.breadcrumb     = setBreadcrumb;
  window.KADH.dateRangeBar   = initDateRangeBar;
  window.KADH.revenueChart   = renderRevenueChart;
  window.KADH.auditLog       = logAuditEntry;
  window.KADH.funnel         = renderFunnel;
  window.KADH.addVariantRow  = addVariantRow;
  window.KADH.getVariants    = getVariants;

  /* ─── Auto-init when DOM is ready ─── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
  } else {
    initSidebar();
  }

})();
