// ═══════════════════════════════════════════════════════════════════════
// PhoneYa2 Agent Network — Shared Config & Utilities
// ═══════════════════════════════════════════════════════════════════════

// ── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SB_URL  = 'https://kavwhkznlhtcwabatmru.supabase.co';
const SB_KEY  = 'sb_publishable_pJzzNclsEPNq1bev2zVN5g_z7eOa5ei';

// ── ADMIN CONFIG ─────────────────────────────────────────────────────────────
// ⚠️ CHANGE THIS to your own strong password before saving!
const ADMIN_PASSWORD = 'blesstech2026admin';

// ── BUSINESS CONFIG ──────────────────────────────────────────────────────────
const CONFIG = {
  brandName:    'PhoneYa2-ZM',
  parentBrand:  'BLESSTech-X',
  waNumber:     '260979603741',
  siteUrl:      'https://phoneya2-agents.singbless89.workers.dev',
  agentSiteUrl: 'https://phoneya2-agents.singbless89.workers.dev', // subfolder deployment
  logoUrl:      'https://i.ibb.co/s9CG52wV/file-0000000059948211a0bdd52c4d236852-1.jpg',

  // Commission rates per product (ZMW)
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

  // Products with selling prices
  products: [
    { name: 'Clear Slim Case',        price: 85,   commission: 15, category: 'Phone Case' },
    { name: '20W USB-C Charger',      price: 150,  commission: 20, category: 'Charger' },
    { name: 'TWS Wireless Earbuds',   price: 380,  commission: 25, category: 'Earphones' },
    { name: '10000mAh Power Bank',    price: 420,  commission: 30, category: 'Power Bank' },
    { name: 'Smart Watch 10-in-1',    price: 400,  commission: 40, category: 'Smart Watch' },
    { name: 'USB-C Braided Cable',    price: 65,   commission: 10, category: 'Cable' },
    { name: 'Shockproof Case',        price: 120,  commission: 15, category: 'Phone Case' },
    { name: '9H Tempered Glass',      price: 45,   commission: 10, category: 'Phone Case' },
  ],
};

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

  async nextId(counter) {
    // Fetch current counter, increment by 1, save back, return new value
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
  return 'ZMW ' + Number(n).toLocaleString();
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
      <span class="nav-badge">Agent Network</span>
      <div class="nav-spacer"></div>
      <a href="index.html"  class="nav-link ${active==='public'?'active':''}">Home</a>
      <a href="apply.html"  class="nav-link ${active==='apply'?'active':''}">Apply</a>
      <a href="agent.html"  class="nav-link ${active==='agent'?'active':''}">Agent Login</a>
      <a href="apply.html"  class="nav-cta">Apply Now</a>
    </div>
  </nav>`;
}
