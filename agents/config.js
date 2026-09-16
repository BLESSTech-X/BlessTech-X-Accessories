// ═══════════════════════════════════════════════════════════════════════
// PhoneYa2 Agent Network — Shared Config & Utilities
// ═══════════════════════════════════════════════════════════════════════

const SB_URL  = 'https://kavwhkznlhtcwabatmru.supabase.co';
const SB_KEY  = 'sb_publishable_pJzzNclsEPNq1bev2zVN5g_z7eOa5ei';

window.ADMIN_PASSWORD = 'blesstech2026admin';

const CONFIG = {
  brandName:    'PhoneYa2-ZM',
  parentBrand:  'BLESSTech-X',
  waNumber:     '260979603741',
  siteUrl:      'https://phoneya2-accessories.vercel.app',
  agentSiteUrl: 'https://phoneya2-agents.singbless89.workers.dev',
  logoUrl:      'https://i.ibb.co/s9CG52wV/file-0000000059948211a0bdd52c4d236852-1.jpg',
  fallbackTiers: [
    { min_amount: 1,    max_amount: 100,  percentage: 10 },
    { min_amount: 101,  max_amount: 500,  percentage: 8  },
    { min_amount: 501,  max_amount: 1000, percentage: 6  },
    { min_amount: 1001, max_amount: 5000, percentage: 4  },
    { min_amount: 5001, max_amount: null, percentage: 3  },
  ],
  fallbackLevels: [
    { level_number: 1, name: 'Starter',           min_sales: 0,   min_revenue: 0 },
    { level_number: 2, name: 'Active',            min_sales: 5,   min_revenue: 2000 },
    { level_number: 3, name: 'Performer',         min_sales: 20,  min_revenue: 10000 },
    { level_number: 4, name: 'Leader',            min_sales: 50,  min_revenue: 30000 },
    { level_number: 5, name: 'Strategic Partner', min_sales: 100, min_revenue: 75000 },
  ],
};

let COMMISSION_TIERS = [];
let AGENT_LEVELS = [];

async function loadTiers() {
  try {
    const rows = await db.getAll('commission_tiers', { filter: 'active=eq.true', order: 'min_amount.asc' });
    COMMISSION_TIERS = (rows && rows.length) ? rows : CONFIG.fallbackTiers;
  } catch (e) { COMMISSION_TIERS = CONFIG.fallbackTiers; }
  return COMMISSION_TIERS;
}

async function loadLevels() {
  try {
    const rows = await db.getAll('agent_levels', { filter: 'active=eq.true', order: 'level_number.asc' });
    AGENT_LEVELS = (rows && rows.length) ? rows : CONFIG.fallbackLevels;
  } catch (e) { AGENT_LEVELS = CONFIG.fallbackLevels; }
  return AGENT_LEVELS;
}

function calcCommissionFromAmount(amount) {
  const amt = Number(amount) || 0;
  if (amt <= 0 || !COMMISSION_TIERS.length) return { percentage: 0, commission: 0, tier: null };
  const tier = COMMISSION_TIERS.find(t => {
    const min = Number(t.min_amount) || 0;
    const max = t.max_amount === null || t.max_amount === undefined ? Infinity : Number(t.max_amount);
    return amt >= min && amt <= max;
  });
  if (!tier) return { percentage: 0, commission: 0, tier: null };
  const pct = Number(tier.percentage) || 0;
  return { percentage: pct, commission: Math.round(amt * pct / 100), tier };
}

function getCommissionPercent(amount) { return calcCommissionFromAmount(amount).percentage; }
function calcCommission(amount)       { return calcCommissionFromAmount(amount).commission; }

function calcAgentLevel(totalSales, totalRevenue) {
  if (!AGENT_LEVELS.length) return { current: null, next: null, progress: 0 };
  const sorted = [...AGENT_LEVELS].sort((a,b) => a.level_number - b.level_number);
  let current = sorted[0];
  for (const lvl of sorted) {
    if (totalSales >= lvl.min_sales && totalRevenue >= lvl.min_revenue) current = lvl;
    else break;
  }
  const next = sorted.find(l => l.level_number > current.level_number) || null;
  let progress = 100;
  if (next) {
    const salesPct   = next.min_sales > 0 ? (totalSales / next.min_sales) * 100 : 0;
    const revenuePct = next.min_revenue > 0 ? (totalRevenue / next.min_revenue) * 100 : 0;
    progress = Math.min(100, Math.round(Math.min(salesPct, revenuePct)));
  }
  return { current, next, progress };
}

// ── ACTIVE CAMPAIGN CHECK ────────────────────────────────────────────────
// Returns the active campaign (if any) for a given date
async function getActiveCampaign(date) {
  try {
    const d = date ? new Date(date) : new Date();
    const campaigns = await db.getAll('campaigns', { filter: 'active=eq.true' });
    return campaigns.find(c => {
      const start = new Date(c.start_date);
      const end   = new Date(c.end_date);
      end.setHours(23, 59, 59, 999);
      return d >= start && d <= end;
    }) || null;
  } catch (e) { return null; }
}

// ── SUPABASE HELPER ──────────────────────────────────────────────────────
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
        entity_type, entity_id: entity_id || null, action,
        performed_by: performed_by || 'system',
        previous_state: previous_state ? JSON.stringify(previous_state) : null,
        new_state: new_state ? JSON.stringify(new_state) : null,
        notes: notes || null,
      });
    } catch (e) {}
  },
};

// ── WALLET ───────────────────────────────────────────────────────────────
async function recalcWallet(agentCode) {
  try {
    const sales = await db.getAll('sales', { filter: `agent_code=eq.${agentCode}` });
    const confirmed = sales.filter(s => s.status === 'confirmed');
    const pending   = sales.filter(s => s.status === 'pending');
    const paid      = sales.filter(s => s.status === 'paid');
    const totalEarned = sales.filter(s => s.status !== 'rejected').reduce((t,s) => t + (s.commission||0), 0);
    const pendingAmt  = pending.reduce((t,s) => t + (s.commission||0), 0);
    const available   = confirmed.reduce((t,s) => t + (s.commission||0), 0);
    const paidAmt     = paid.reduce((t,s) => t + (s.commission||0), 0);
    const existing = await db.getOne('wallets', `agent_code=eq.${agentCode}`);
    const data = {
      agent_code: agentCode, total_earned: totalEarned, pending: pendingAmt,
      available, paid: paidAmt, updated_at: new Date().toISOString(),
    };
    if (existing) await db.update('wallets', `agent_code=eq.${agentCode}`, data);
    else          await db.insert('wallets', data);
  } catch (e) {}
}

// ── NOTIFICATIONS ────────────────────────────────────────────────────────
async function createNotification(agentCode, title, message, type, link) {
  try {
    await db.insert('notifications', {
      agent_code: agentCode, title, message,
      type: type || 'info', link: link || null,
    });
  } catch (e) {}
}

// ── REFERRAL ANALYTICS ───────────────────────────────────────────────────
async function logReferralEvent(agentCode, eventType, metadata) {
  try {
    await db.insert('referral_events', {
      agent_code: agentCode, event_type: eventType,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (e) {}
}

// ── FRAUD DETECTION ──────────────────────────────────────────────────────
async function checkFraud(sale, agentData) {
  const flags = [];
  const agentPhoneClean = (agentData.phone || '').replace(/\D/g, '').slice(-9);
  const customerPhoneClean = (sale.customer_phone || '').replace(/\D/g, '').slice(-9);
  if (agentPhoneClean && customerPhoneClean && agentPhoneClean === customerPhoneClean) {
    flags.push({ flag_type: 'self_purchase', agent_code: sale.agent_code, sale_id: sale.sale_id, details: { reason: 'Customer phone matches agent phone' } });
  }
  try {
    const recent = await db.getAll('sales', { filter: `agent_code=eq.${sale.agent_code}&customer_phone=eq.${sale.customer_phone}`, order: 'created_at.desc', limit: 5 });
    const last24h = recent.filter(s => {
      const diff = Date.now() - new Date(s.created_at).getTime();
      return diff < 24 * 60 * 60 * 1000 && s.sale_id !== sale.sale_id;
    });
    if (last24h.length) flags.push({ flag_type: 'duplicate_customer_24h', agent_code: sale.agent_code, sale_id: sale.sale_id, details: { previous_sales: last24h.map(s => s.sale_id) } });
  } catch (e) {}
  try {
    const recent = await db.getAll('sales', { filter: `agent_code=eq.${sale.agent_code}`, order: 'created_at.desc', limit: 10 });
    const lastHour = recent.filter(s => Date.now() - new Date(s.created_at).getTime() < 60 * 60 * 1000);
    if (lastHour.length >= 5) flags.push({ flag_type: 'rapid_submission', agent_code: sale.agent_code, sale_id: sale.sale_id, details: { count_last_hour: lastHour.length } });
  } catch (e) {}
  for (const f of flags) { try { await db.insert('fraud_flags', f); } catch (e) {} }
  return flags;
}

// ── CUSTOMER UPSERT ──────────────────────────────────────────────────────
async function upsertCustomer(sale) {
  if (!sale.customer_phone) return;
  try {
    const existing = await db.getOne('customers', `phone=eq.${sale.customer_phone}`);
    if (existing) {
      await db.update('customers', `phone=eq.${sale.customer_phone}`, {
        name: sale.customer_name || existing.name,
        total_spent: (existing.total_spent || 0) + (sale.amount || 0),
        total_purchases: (existing.total_purchases || 0) + 1,
        last_purchase_at: new Date().toISOString(),
      });
    } else {
      const n = await db.nextId('customers');
      const cid = `C-${String(n).padStart(4,'0')}`;
      await db.insert('customers', {
        customer_id: cid, name: sale.customer_name, phone: sale.customer_phone,
        whatsapp: sale.customer_phone, introduced_by: sale.agent_code,
        total_spent: sale.amount || 0, total_purchases: 1,
        last_purchase_at: new Date().toISOString(),
      });
    }
  } catch (e) {}
}

// ── ID GENERATORS ────────────────────────────────────────────────────────
function makeAppId(n)     { return `PY-${new Date().getFullYear()}-${String(n).padStart(4,'0')}`; }
function makeAgentId(n)   { return `PYA-${String(n).padStart(4,'0')}`; }
function makeAgentCode(n) { return `PY${String(n).padStart(3,'0')}`; }
function makeLeadId(n)    { return `L-${String(n).padStart(4,'0')}`; }
function makeSaleId(n)    { return `S-${String(n).padStart(4,'0')}`; }
function makePayoutId(n)  { return `PR-${String(n).padStart(4,'0')}`; }
function makeCampaignId(n){ return `CAMP-${String(n).padStart(3,'0')}`; }
function makeMaterialId(n){ return `M-${String(n).padStart(4,'0')}`; }

// ── UTILITIES ────────────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-ZM', { day:'numeric', month:'short', year:'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-ZM', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtMoney(n) { return 'ZMW ' + Number(n || 0).toLocaleString(); }

function toast(msg, duration = 3000) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
  if (loading) { btn._orig = btn.innerHTML; btn.innerHTML = `<span class="spinner"></span> ${label || 'Please wait…'}`; }
  else         { btn.innerHTML = btn._orig || label || 'Submit'; }
}

function waLink(msg) { return `https://wa.me/${CONFIG.waNumber}?text=${encodeURIComponent(msg)}`; }

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
  } else {
    legacyCopy(text);
  }
}
function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  document.execCommand('copy'); document.body.removeChild(ta);
}

// ── AUTH ─────────────────────────────────────────────────────────────────
function adminLoggedIn() { return sessionStorage.getItem('btx_admin') === 'yes'; }
function agentCode() { return sessionStorage.getItem('agent_code') || localStorage.getItem('agent_code'); }
function requireAdmin() { if (!adminLoggedIn()) { window.location.href = 'admin.html'; return false; } return true; }
function requireAgent() {
  const code = agentCode();
  if (!code) { window.location.href = 'agent.html'; return null; }
  return code;
}

// ── NAVBAR ───────────────────────────────────────────────────────────────
function buildNav(active) {
  return `
  <nav class="navbar">
    <div class="navbar-inner">
      <a href="index.html" class="nav-logo">
        <img src="${CONFIG.logoUrl}" alt="PhoneYa2" onerror="this.style.display='none'">
        <div><div class="nav-brand">PhoneYa2<span>-ZM</span></div></div>
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

// ── PDF STATEMENT ────────────────────────────────────────────────────────
function makeSalesStatementPdf(opts = {}) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { toast('⚠️ PDF library not loaded'); return; }
  const { agentName, agentId, agentCode, period, sales = [] } = opts;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(10, 10, 26); doc.rect(0, 0, pageW, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('PhoneYa2-ZM', 40, 32);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(255, 159, 67);
  doc.text('Agent Network · Sales Statement', 40, 50);

  let y = 100;
  doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('SALES STATEMENT', 40, y); y += 20;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(107, 114, 128);
  if (agentName) doc.text(`Agent: ${agentName}`, 40, y), y += 14;
  if (agentId)   doc.text(`Agent ID: ${agentId}`, 40, y), y += 14;
  if (agentCode) doc.text(`Agent Code: ${agentCode}`, 40, y), y += 14;
  doc.text(`Period: ${period || 'All time'}`, 40, y); y += 14;
  doc.text(`Generated: ${new Date().toLocaleString('en-ZM')}`, 40, y); y += 24;

  const rows = sales.map(s => [
    s.sale_id || '—', fmtDate(s.created_at), s.customer_name || '—',
    fmtMoney(s.amount || 0),
    (s.commission_pct != null ? s.commission_pct + '%' : '—'),
    fmtMoney(s.commission || 0), (s.status || '—').toString(),
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
    body: rows.length ? rows : [['—','—','No sales','—','—','—','—']],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 6, textColor: [26, 26, 46] },
    headStyles: { fillColor: [255, 96, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 40, right: 40 },
  });

  let ty = doc.lastAutoTable.finalY + 24;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 26, 46);
  doc.text('Summary', 40, ty); ty += 16;
  doc.setFont('helvetica', 'normal');
  doc.text(`Total sales amount: ${fmtMoney(totals.amount)}`, 40, ty); ty += 14;
  doc.setTextColor(22, 163, 74); doc.text(`Confirmed commission: ${fmtMoney(totals.confirmed)}`, 40, ty); ty += 14;
  doc.setTextColor(245, 158, 11); doc.text(`Pending commission: ${fmtMoney(totals.pending)}`, 40, ty);

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(229, 231, 235);
    doc.line(40, pageH - 40, pageW - 40, pageH - 40);
    doc.setFontSize(8); doc.setTextColor(107, 114, 128);
    doc.text('PhoneYa2-ZM · Smart Choices. Better Connection.', 40, pageH - 24);
    doc.text(`Page ${i} of ${pageCount}`, pageW - 40, pageH - 24, { align: 'right' });
  }
  doc.save(`PhoneYa2-Statement-${agentCode || 'All'}-${new Date().toISOString().slice(0,10)}.pdf`);
}

// ── PDF — ID CARD ────────────────────────────────────────────────────────
function makeIdCardPdf(agent) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { toast('⚠️ PDF library not loaded'); return; }
  const doc = new jsPDF({ unit: 'pt', format: [240, 380], orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Front card
  doc.setFillColor(10, 10, 26); doc.rect(0, 0, W, H, 'F');

  // Top strip
  doc.setFillColor(255, 96, 0); doc.rect(0, 0, W, 6, 'F');

  // Brand
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text('PhoneYa2-ZM', W / 2, 40, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(255, 159, 67);
  doc.text('SALES ASSISTANT ID CARD', W / 2, 54, { align: 'center' });

  // Avatar circle
  doc.setFillColor(255, 96, 0);
  doc.circle(W / 2, 110, 30, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(28);
  doc.text((agent.full_name || '?')[0].toUpperCase(), W / 2, 122, { align: 'center' });

  // Name
  doc.setTextColor(255, 255, 255); doc.setFontSize(14);
  doc.text(agent.full_name || 'Agent', W / 2, 175, { align: 'center' });

  // Role
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(255, 159, 67);
  doc.text('Sales Assistant', W / 2, 192, { align: 'center' });

  // Details
  doc.setTextColor(200, 200, 220); doc.setFontSize(9);
  doc.text('Agent ID:  ' + (agent.agent_id || '—'), W / 2, 220, { align: 'center' });
  doc.text('Agent Code:  ' + (agent.agent_code || '—'), W / 2, 235, { align: 'center' });
  doc.text('Status:  ACTIVE', W / 2, 250, { align: 'center' });

  // QR placeholder text
  doc.setFillColor(245, 245, 250); doc.roundedRect(W / 2 - 35, 265, 70, 70, 6, 6, 'F');
  doc.setTextColor(150, 150, 170); doc.setFontSize(8);
  doc.text('QR Code', W / 2, 302, { align: 'center' });
  doc.text('Verify below', W / 2, 315, { align: 'center' });

  doc.setTextColor(255, 255, 255); doc.setFontSize(7);
  doc.text('Verify at:', W / 2, 350, { align: 'center' });
  doc.setTextColor(255, 159, 67);
  doc.text(`${CONFIG.agentSiteUrl}/verify.html?id=${agent.agent_id}`, W / 2, 361, { align: 'center', maxWidth: W - 20 });

  doc.save(`PhoneYa2-ID-${agent.agent_code}.pdf`);
}

// ── PDF — CERTIFICATE ────────────────────────────────────────────────────
function makeCertificatePdf(opts) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { toast('⚠️ PDF library not loaded'); return; }
  const { agent, title, subtitle, date } = opts;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Border
  doc.setDrawColor(255, 96, 0); doc.setLineWidth(6);
  doc.rect(20, 20, W - 40, H - 40);
  doc.setDrawColor(10, 10, 26); doc.setLineWidth(1);
  doc.rect(30, 30, W - 60, H - 60);

  // Navy header bar
  doc.setFillColor(10, 10, 26); doc.rect(30, 30, W - 60, 70, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.text('PhoneYa2-ZM', 60, 70);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(255, 159, 67);
  doc.text('Agent Network · Certificate', 60, 88);

  // Title
  doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold'); doc.setFontSize(38);
  doc.text(title || 'Certificate', W / 2, 180, { align: 'center' });

  // Subtitle
  doc.setFont('helvetica', 'normal'); doc.setFontSize(14);
  doc.setTextColor(107, 114, 128);
  doc.text(subtitle || 'Proudly awarded to', W / 2, 215, { align: 'center' });

  // Agent name
  doc.setFont('helvetica', 'bold'); doc.setFontSize(30);
  doc.setTextColor(255, 96, 0);
  doc.text(agent.full_name || 'Agent', W / 2, 265, { align: 'center' });

  // Line
  doc.setDrawColor(229, 231, 235); doc.setLineWidth(1);
  doc.line(W / 2 - 200, 285, W / 2 + 200, 285);

  // Details
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text(`Agent ID: ${agent.agent_id || '—'}`, W / 2, 305, { align: 'center' });

  // Date
  doc.text(date || new Date().toLocaleDateString('en-ZM'), W / 2, 340, { align: 'center' });

  // Signature line
  doc.setDrawColor(26, 26, 46); doc.setLineWidth(1);
  doc.line(120, H - 90, 320, H - 90);
  doc.setFontSize(10);
  doc.text('Authorized Signature', 220, H - 75, { align: 'center' });

  doc.line(W - 320, H - 90, W - 120, H - 90);
  doc.text('PhoneYa2-ZM Director', W - 220, H - 75, { align: 'center' });

  doc.save(`PhoneYa2-Certificate-${agent.agent_code}.pdf`);
}
