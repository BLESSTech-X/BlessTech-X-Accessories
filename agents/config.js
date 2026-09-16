// ═══════════════════════════════════════════════════════════════════════
// PhoneYa2 Agent Network — Shared Config & Utilities
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

  // Commission rates per category (kept for reference / fallback)
  commissions: {
    'Phone Case':       15,
    'Charger':          20,
    'Earphones':        25,
    'Power Bank':       30,
    'Cable':            10,
    'Smart Watch':      40,
    'Refurbished Phone':150,
    'Other':            15,
  },

  // Products — percentage commission model
  // commission_percent = % of sale amount the agent earns
  // Example: ZMW 400 watch × 10% = ZMW 40 commission
  products: [
    { name: 'Clear Slim Case',        price: 85,   commission_percent: 18, category: 'Phone Case' },
    { name: '20W USB-C Charger',      price: 150,  commission_percent: 13, category: 'Charger' },
    { name: 'TWS Wireless Earbuds',   price: 380,  commission_percent: 7,  category: 'Earphones' },
    { name: '10000mAh Power Bank',    price: 420,  commission_percent: 7,  category: 'Power Bank' },
    { name: 'Smart Watch 10-in-1',    price: 400,  commission_percent: 10, category: 'Smart Watch' },
    { name: 'USB-C Braided Cable',    price: 65,   commission_percent: 15, category: 'Cable' },
    { name: 'Shockproof Case',        price: 120,  commission_percent: 13, category: 'Phone Case' },
    { name: '9H Tempered Glass',      price: 45,   commission_percent: 22, category: 'Phone Case' },
  ],
};

// ── COMMISSION CALCULATOR ────────────────────────────────────────────────────
// Commission = unit_price × quantity × commission_percent / 100
// Rounded to nearest whole ZMW
function calcCommission(unitPrice, quantity, percent) {
  const raw = (Number(unitPrice) || 0) * (Number(quantity) || 0) * (Number(percent) || 0) / 100;
  return Math.round(raw);
}

// Total sale amount = unit_price × quantity
function calcAmount(unitPrice, quantity) {
  return (Number(unitPrice) || 0) * (Number(quantity) || 0);
}

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

  async getOne(table, filter) {
    const rows = await this.query(table, { filter, limit: 1 });
    return rows?.[0] || null;
  },

  async getAll(table, opts = {}) {
    return this.query(table, opts);
  },

  // Sequential ID counter — uses only the `counters` table
  async nextId(counter) {
    const row = await this.getOne('counters', `name=eq.${counter}`);
    const next = (row?.value || 0) + 1;
    await this.update('counters', `name=eq.${counter}`, { value: next });
    return next;
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
  // active: 'public' | 'apply' | 'admin' | 'agent'
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
// Requires jsPDF + jspdf-autotable loaded via CDN on the page:
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
//
// Usage:
//   makeSalesStatementPdf({ agentName, agentId, agentCode, period, sales })
//
// Each `sales` item should have: { sale_id, created_at, product, quantity, amount, commission, status }
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

  // ── Header bar ──
  doc.setFillColor(10, 10, 26);            // navy
  doc.rect(0, 0, pageW, 70, 'F');

  // Brand text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PhoneYa2-ZM', 40, 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(255, 159, 67);          // orange
  doc.text('Agent Network · Sales Statement', 40, 50);

  // ── Statement info ──
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

  // ── Sales table ──
  const rows = sales.map(s => [
    s.sale_id || '—',
    fmtDate(s.created_at),
    s.product || '—',
    String(s.quantity || 1),
    fmtMoney(s.amount || 0),
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
    head: [['Sale ID', 'Date', 'Product', 'Qty', 'Amount', 'Commission', 'Status']],
    body: rows.length ? rows : [['—', '—', 'No sales for this period', '—', '—', '—', '—']],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 6, textColor: [26, 26, 46] },
    headStyles: { fillColor: [255, 96, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 70 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 35, halign: 'center' },
      4: { cellWidth: 70, halign: 'right' },
      5: { cellWidth: 70, halign: 'right' },
      6: { cellWidth: 60, halign: 'center' },
    },
    margin: { left: 40, right: 40 },
  });

  // ── Totals block ──
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

  // ── Footer on all pages ──
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

  // ── Save ──
  const filename = `PhoneYa2-Statement-${agentCode || 'All'}-${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
}
