// ═══════════════════════════════════════════════════════════════════════
// PhoneYa2 Agent Network — Shared Config & Utilities
// Tier-based commission system (no products)
// ═══════════════════════════════════════════════════════════════════════

// ── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SB_URL  = 'https://kavwhkznlhtcwabatmru.supabase.co';
const SB_KEY  = 'sb_publishable_pJzzNclsEPNq1bev2zVN5g_z7eOa5ei';

// ── ADMIN CONFIG ─────────────────────────────────────────────────────────────
window.ADMIN_PASSWORD = 'blesstech2026admin';  // Change this after setup

// ── BUSINESS CONFIG ──────────────────────────────────────────────────────────
const CONFIG = {
  brandName:    'PhoneYa2-ZM',
  parentBrand:  'BLESSTech-X',
  waNumber:     '260979603741',

  // URLs — agent network on Cloudflare, shop on Vercel
  siteUrl:      'https://phoneya2-accessories.vercel.app',        // shop
  agentSiteUrl: 'https://phoneya2-agents.singbless89.workers.dev', // agent network

  logoUrl:      'https://i.ibb.co/s9CG52wV/file-0000000059948211a0bdd52c4d236852-1.jpg',

  // Fallback tiers (used if Supabase fetch fails — should match DB)
  fallbackTiers: [
    { min_amount: 1,    max_amount: 100,  percentage: 10 },
    { min_amount: 101,  max_amount: 500,  percentage: 8  },
    { min_amount: 501,  max_amount: 1000, percentage: 6  },
    { min_amount: 1001, max_amount: 5000, percentage: 4  },
    { min_amount: 5001, max_amount: null, percentage: 3  },
  ],
};

// ── COMMISSION TIERS (loaded from Supabase) ──────────────────────────────────
// The `commission_tiers` table in Supabase stores:
//   { id, min_amount, max_amount (nullable), percentage, label, active }
//
// This global holds the current tier list — call `loadTiers()` to populate it.
let COMMISSION_TIERS = [];

// Fetch tiers from Supabase. Call this on every page that needs the calculator.
async function loadTiers() {
  try {
    const rows = await db.getAll('commission_tiers', { filter: 'active=eq.true', order: 'min_amount.asc' });
    if (rows && rows.length) {
      COMMISSION_TIERS = rows;
    } else {
      COMMISSION_TIERS = CONFIG.fallbackTiers;
    }
  } catch (e) {
    console.warn('Could not load tiers from Supabase — using fallback.', e);
    COMMISSION_TIERS = CONFIG.fallbackTiers;
  }
  return COMMISSION_TIERS;
}

// ── COMMISSION CALCULATOR ────────────────────────────────────────────────────
// Given a sale amount (ZMW), find the matching tier and return:
//   { percentage, commission, tier }
// Returns { percentage: 0, commission: 0, tier: null } if amount <= 0 or no tier matches.
function calcCommissionFromAmount(amount) {
  const amt = Number(amount) || 0;
  if (amt <= 0 || !COMMISSION_TIERS.length) {
    return { percentage: 0, commission: 0, tier: null };
  }
  // Tiers are sorted by min_amount ascending. Find the first matching range.
  const tier = COMMISSION_TIERS.find(t => {
    const min = Number(t.min_amount) || 0;
    const max = t.max_amount === null || t.max_amount === undefined ? Infinity : Number(t.max_amount);
    return amt >= min && amt <= max;
  });
  if (!tier) return { percentage: 0, commission: 0, tier: null };
  const pct = Number(tier.percentage) || 0;
  return {
    percentage: pct,
    commission: Math.round(amt * pct / 100),
    tier,
  };
}

// Convenience wrappers
function getCommissionPercent(amount) { return calcCommissionFromAmount(amount).percentage; }
function calcCommission(amount)       { return calcCommissionFromAmount(amount).commission; }

// ── SUPABASE API HELPER ──────────────────────────────────────────────────────
const db = {
  async query(table, opts = {}) {
    let url = `${SB_URL}/rest/v1/${table}?`;
    if (opts.select)  url += `select=${encodeURIComponent(opts.select)}&`;
    if (opts.filter)  url += `${opts.filter}&`;
    if (opts.order)   url += `order=${opts.order}&`;
    if (opts.limit)   url += `limit=${opts.limit}&`;
    url = url.replace(/&$/, '');

    const res = await fetch(url, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        ...(opts.prefer ? { 'Prefer': opts.prefer } : {}),
      },
      method:  opts.method || 'GET',
      body:    opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `DB error ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  },

  async insert(table, data) {
    return this.query(table, { method: 'POST', body: data, prefer: 'return=representation', select: '*' });
  },

  async update(table, filter, data) {
    return this.query(table, { method: 'PATCH', filter, body: data, prefer: 'return=representation', select: '*' });
  },

  async remove(table, filter) {
    return this.query(table, { method: 'DELETE', filter });
  },

  async getOne(table, filter) {
    const rows = await this.query(table, { filter, limit: 1 });
    return rows?.[0] || null;
  },

  async getAll(table, opts = {}) {
    return this.query(table, opts);
  },

  async nextId(counter) {
    const row = await this.getOne('counters', `name=eq.${counter}`);
    const next = (row?.value || 0) + 1;
    await this.update('counters', `name=eq.${counter}`, { value: next });
    return next;
  },

  async logAudit(entity_type, entity_id, action, performed_by, previous_state, new_state, notes) {
    try {
      await this.insert('audit_log', {
        entity_type, entity_id, action, performed_by,
        previous_state: previous_state ? JSON.stringify(previous_state) : null,
        new_state:      new_state      ? JSON.stringify(new_state)      : null,
        notes: notes || null,
      });
    } catch (e) {
      console.warn('Audit log failed:', e);
    }
  },
};

// ── ID GENERATORS ────────────────────────────────────────────────────────────
function makeAppId(n) {
  const y = new Date().getFullYear();
  return `PY-${y}-${String(n).padStart(4,'0')}`;
}
function makeAgentId(n)   { return `PYA-${String(n).padStart(4,'0')}`; }
function makeAgentCode(n) { return `PY${String(n).padStart(3,'0')}`; }
function makeLeadId(n)    { return `L-${String(n).padStart(4,'0')}`; }
function makeSaleId(n)    { return `S-${String(n).padStart(4,'0')}`; }

// ── UTILITIES ────────────────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-ZM', { day:'numeric', month:'short', year:'numeric' });
}

function fmtMoney(n) {
  return 'ZMW ' + Number(n || 0).toLocaleString();
}

function toast(msg, duration = 3000) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
  if (loading) {
    btn._orig = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> ${label || 'Please wait…'}`;
  } else {
    btn.innerHTML = btn._orig || label || 'Submit';
  }
}

function waLink(msg) {
  return `https://wa.me/${CONFIG.waNumber}?text=${encodeURIComponent(msg)}`;
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
  } else {
    legacyCopy(text);
  }
}

function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

// ── AUTH HELPERS ─────────────────────────────────────────────────────────────
function adminLoggedIn() {
  return sessionStorage.getItem('btx_admin') === 'yes';
}
function agentCode() {
  return sessionStorage.getItem('agent_code') || localStorage.getItem('agent_code');
}
function requireAdmin() {
  if (!adminLoggedIn()) {
    window.location.href = 'admin.html';
    return false;
  }
  return true;
}
function requireAgent() {
  const code = agentCode();
  if (!code) {
    window.location.href = 'agent.html';
    return null;
  }
  return code;
}

// ── NAVBAR BUILDER ───────────────────────────────────────────────────────────
// Desktop: Home | Apply | Agent Login | [Apply Now]
// Mobile: [Agent Login] [Apply Now]  (two buttons side-by-side)
function buildNav(active) {
  return `
  <nav class="navbar">
    <div class="navbar-inner">
      <a href="index.html" class="nav-logo">
        <img src="${CONFIG.logoUrl}" alt="PhoneYa2" onerror="this.style.display='none'">
        <div>
          <div class="nav-brand">PhoneYa2<span>-ZM</span></div>
        </div>
      </a>
      <span class="nav-badge hide-mobile">Agent Network</span>
      <div class="nav-spacer"></div>
      <a href="index.html"  class="nav-link hide-mobile ${active==='public'?'active':''}">Home</a>
      <a href="apply.html"  class="nav-link hide-mobile ${active==='apply'?'active':''}">Apply</a>
      <a href="agent.html"  class="nav-btn-outline">
        <i class="fa-solid fa-user-tie"></i> <span class="hide-xs">Agent </span>Login
      </a>
      <a href="apply.html"  class="nav-cta">
        <i class="fa-solid fa-rocket"></i> Apply Now
      </a>
    </div>
  </nav>`;
}

// ── PDF HELPER — Sales Statement ─────────────────────────────────────────────
// Requires jsPDF + jspdf-autotable via CDN.
// Sales items shape: { sale_id, created_at, customer_name, amount, commission, commission_pct, status }
function makeSalesStatementPdf(opts = {}) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    toast('⚠️ PDF library not loaded');
    return;
  }

  const { agentName, agentId, agentCode, period, sales = [] } = opts;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header bar
  doc.setFillColor(10, 10, 26);
  doc.rect(0, 0, pageW, 70, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PhoneYa2-ZM', 40, 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(255, 159, 67);
  doc.text('Agent Network · Sales Statement', 40, 50);

  // Statement info
  let y = 100;
  doc.setTextColor(26, 26, 46);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('SALES STATEMENT', 40, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  if (agentName) doc.text(`Agent: ${agentName}`, 40, y);
  y += 14;
  if (agentId)   doc.text(`Agent ID: ${agentId}`, 40, y);
  y += 14;
  if (agentCode) doc.text(`Agent Code: ${agentCode}`, 40, y);
  y += 14;
  doc.text(`Period: ${period || 'All time'}`, 40, y);
  y += 14;
  doc.text(`Generated: ${new Date().toLocaleString('en-ZM')}`, 40, y);
  y += 24;

  // Sales table — no product column anymore
  const rows = sales.map(s => [
    s.sale_id || '—',
    fmtDate(s.created_at),
    s.customer_name || '—',
    fmtMoney(s.amount || 0),
    (s.commission_pct != null ? s.commission_pct + '%' : '—'),
    fmtMoney(s.commission || 0),
    (s.status || '—').toString(),
  ]);

  const totals = sales.reduce((acc, s) => {
    acc.amount += Number(s.amount || 0);
    if (s.status === 'confirmed' || s.status === 'paid') acc.confirmed += Number(s.commission || 0);
    if (s.status === 'pending') acc.pending += Number(s.commission || 0);
    return acc;
  }, { amount: 0, confirmed: 0, pending: 0 });

  doc.autoTable({
    startY: y,
    head: [['Sale ID', 'Date', 'Customer', 'Amount', 'Rate', 'Commission', 'Status']],
    body: rows.length ? rows : [['—', '—', 'No sales for this period', '—', '—', '—', '—']],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 6, textColor: [26, 26, 46] },
    headStyles: { fillColor: [255, 96, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 65 },
      1: { cellWidth: 65 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 70, halign: 'right' },
      4: { cellWidth: 45, halign: 'center' },
      5: { cellWidth: 70, halign: 'right' },
      6: { cellWidth: 60, halign: 'center' },
    },
    margin: { left: 40, right: 40 },
  });

  // Totals block
  let ty = doc.lastAutoTable.finalY + 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(26, 26, 46);
  doc.text('Summary', 40, ty);
  ty += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Total sales amount: ${fmtMoney(totals.amount)}`, 40, ty);
  ty += 14;
  doc.setTextColor(22, 163, 74);
  doc.text(`Confirmed commission: ${fmtMoney(totals.confirmed)}`, 40, ty);
  ty += 14;
  doc.setTextColor(245, 158, 11);
  doc.text(`Pending commission: ${fmtMoney(totals.pending)}`, 40, ty);

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(229, 231, 235);
    doc.line(40, pageH - 40, pageW - 40, pageH - 40);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('PhoneYa2-ZM · Smart Choices. Better Connection.', 40, pageH - 24);
    doc.text(`Page ${i} of ${pageCount}`, pageW - 40, pageH - 24, { align: 'right' });
  }

  const filename = `PhoneYa2-Statement-${agentCode || 'All'}-${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
}
