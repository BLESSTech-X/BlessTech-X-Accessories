// ═══════════════════════════════════════════════════════════════════════
// PhoneYa2 Agent Network — Shared Config & Utilities
// V2 — Auth + Leads + Communication Hub + Rich Media Chat + WAV Voice
// ═══════════════════════════════════════════════════════════════════════

const SB_URL  = 'https://kavwhkznlhtcwabatmru.supabase.co';
const SB_KEY  = 'sb_publishable_pJzzNclsEPNq1bev2zVN5g_z7eOa5ei';

window.ADMIN_PASSWORD = 'blesstech2026admin'; // legacy — will be phased out

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

// ── TIERS + LEVELS ───────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════
// AUTH — Supabase Auth
// ═══════════════════════════════════════════════════════════════════════

const auth = {
  async signIn(email, password) {
    const url = `${SB_URL}/auth/v1/token?grant_type=password`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error_description || err.msg || 'Login failed');
    }
    const data = await res.json();
    sessionStorage.setItem('sb_token', data.access_token);
    sessionStorage.setItem('sb_user_id', data.user.id);
    sessionStorage.setItem('sb_email', data.user.email);
    return data;
  },

  async signOut() {
    const token = sessionStorage.getItem('sb_token');
    if (token) {
      try {
        await fetch(`${SB_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${token}` },
        });
      } catch (e) {}
    }
    sessionStorage.removeItem('sb_token');
    sessionStorage.removeItem('sb_user_id');
    sessionStorage.removeItem('sb_email');
  },

  currentUserId()  { return sessionStorage.getItem('sb_user_id'); },
  currentEmail()   { return sessionStorage.getItem('sb_email'); },
  currentToken()   { return sessionStorage.getItem('sb_token'); },

  isLoggedIn()     { return !!sessionStorage.getItem('sb_token'); },
};

async function getProfile() {
  const uid = auth.currentUserId();
  if (!uid) return null;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${uid}&select=*`, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${auth.currentToken()}`,
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch (e) { return null; }
}

async function isAdmin() {
  const p = await getProfile();
  return p && p.role === 'admin';
}

// ═══════════════════════════════════════════════════════════════════════
// SUPABASE REST HELPER
// ═══════════════════════════════════════════════════════════════════════

const db = {
  async query(table, opts = {}) {
    let url = `${SB_URL}/rest/v1/${table}?`;
    if (opts.select)  url += `select=${encodeURIComponent(opts.select)}&`;
    if (opts.filter)  url += `${opts.filter}&`;
    if (opts.order)   url += `order=${opts.order}&`;
    if (opts.limit)   url += `limit=${opts.limit}&`;
    url = url.replace(/&$/, '');

    const token = auth.currentToken() || SB_KEY;

    const res = await fetch(url, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${token}`,
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

// ═══════════════════════════════════════════════════════════════════════
// LEADS — mini CRM
// ═══════════════════════════════════════════════════════════════════════

const LEAD_STATUSES = [
  { code: 'new',         label: 'New',         icon: 'fa-star',           cls: 'yellow' },
  { code: 'contacted',   label: 'Contacted',   icon: 'fa-comment',        cls: 'blue' },
  { code: 'interested',  label: 'Interested',  icon: 'fa-fire',           cls: 'orange' },
  { code: 'negotiating', label: 'Negotiating', icon: 'fa-handshake',      cls: 'orange' },
  { code: 'ordered',     label: 'Ordered',     icon: 'fa-cart-shopping',  cls: 'blue' },
  { code: 'paid',        label: 'Paid',        icon: 'fa-money-bill',     cls: 'green' },
  { code: 'delivered',   label: 'Delivered',   icon: 'fa-circle-check',   cls: 'green' },
  { code: 'lost',        label: 'Lost',        icon: 'fa-circle-xmark',   cls: 'red' },
];

function leadStatusInfo(code) {
  return LEAD_STATUSES.find(s => s.code === code) || LEAD_STATUSES[0];
}

async function createLead(data) {
  const n = await db.nextId('leads');
  const leadId = makeLeadId(n);
  const payload = {
    lead_id:         leadId,
    agent_code:      data.agent_code,
    customer_name:   data.customer_name,
    customer_phone:  data.customer_phone,
    customer_wa:     data.customer_wa || data.customer_phone,
    product:         data.product || null,
    quantity:        Number(data.quantity) || 1,
    estimated_value: Number(data.estimated_value) || null,
    location:        data.location || null,
    notes:           data.notes || null,
    source:          data.source || 'other',
    status:          'new',
    followup_date:   data.followup_date || null,
  };
  const result = await db.insert('leads', payload);
  await db.logAudit('lead', leadId, 'created', data.agent_code, null, payload);
  return result?.[0] || null;
}

async function updateLead(id, updates) {
  updates.updated_at = new Date().toISOString();
  if (updates.status) updates.last_contacted_at = new Date().toISOString();
  const result = await db.update('leads', `id=eq.${id}`, updates);
  return result?.[0] || null;
}

async function getLeads(agentCode) {
  const filter = agentCode ? `agent_code=eq.${agentCode}` : '';
  return db.getAll('leads', { filter, order: 'created_at.desc' });
}

async function getLeadsDueToday(agentCode) {
  const today = new Date().toISOString().slice(0, 10);
  return db.getAll('leads', {
    filter: `agent_code=eq.${agentCode}&followup_date=lte.${today}&status=not.in.(delivered,lost)`,
    order: 'followup_date.asc',
  });
}

// ═══════════════════════════════════════════════════════════════════════
// MESSAGES / COMMUNICATION HUB
// ═══════════════════════════════════════════════════════════════════════

async function getConversationByType(type) {
  return db.getOne('conversations', `type=eq.${type}`);
}

async function getMessages(conversationId, limit = 100) {
  return db.getAll('messages', {
    filter: `conversation_id=eq.${conversationId}`,
    order: 'created_at.desc',
    limit,
  });
}

async function sendMessage(conversationId, payload) {
  const profile = await getProfile();
  const msg = {
    conversation_id: conversationId,
    sender_id:       auth.currentUserId(),
    sender_name:     profile?.full_name || profile?.email || 'User',
    message_type:    payload.message_type || 'text',
    text:            payload.text || null,
    media_url:       payload.media_url || null,
    media_thumbnail: payload.media_thumbnail || null,
    media_duration:  payload.media_duration || null,
    reply_to_id:     payload.reply_to_id || null,
  };
  return db.insert('messages', msg);
}

async function keepMessage(id) {
  return db.update('messages', `id=eq.${id}`, { is_kept: true });
}

async function deleteMessage(id) {
  return db.update('messages', `id=eq.${id}`, { deleted_at: new Date().toISOString() });
}

async function addReaction(messageId, emoji) {
  return db.insert('message_reactions', {
    message_id: messageId,
    user_id:    auth.currentUserId(),
    emoji:      emoji,
  });
}

async function removeReaction(messageId, emoji) {
  return db.remove('message_reactions', `message_id=eq.${messageId}&user_id=eq.${auth.currentUserId()}&emoji=eq.${emoji}`);
}

// ── CHAT MEDIA UPLOAD (with compression + progress) ────────────────────
async function uploadChatMedia(file, type = 'image', onProgress) {
  const uid = auth.currentUserId();
  if (!uid) throw new Error('Not logged in');
  if (!file) throw new Error('No file provided');

  let uploadBlob = file;
  let ext = 'bin';
  let contentType = file.type || 'application/octet-stream';

  if (type === 'image' && file.type && file.type.startsWith('image/')) {
    uploadBlob  = await compressImage(file, 1400, 0.82);
    ext         = 'jpg';
    contentType = 'image/jpeg';
  } else if (type === 'voice') {
    const mt = (file.type || '').toLowerCase();
    if (mt.includes('wav')) {
      ext = 'wav';
      contentType = 'audio/wav';
    } else if (mt.includes('mp4') || mt.includes('m4a') || mt.includes('aac')) {
      ext = 'm4a';
      contentType = 'audio/mp4';
    } else if (mt.includes('ogg')) {
      ext = 'ogg';
      contentType = 'audio/ogg';
    } else {
      ext = 'webm';
      contentType = 'audio/webm';
    }
  } else {
    ext = (file.name?.split('.').pop() || 'bin').toLowerCase();
    if (ext.length > 6) ext = 'bin';
  }

  const filename = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const url = `${SB_URL}/storage/v1/object/chat-media/${filename}`;

  if (onProgress) onProgress(10);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${auth.currentToken()}`,
      'Content-Type': contentType,
      'x-upsert': 'false',
      'cache-control': 'public, max-age=31536000',
    },
    body: uploadBlob,
  });

  if (onProgress) onProgress(90);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Upload failed: ${res.status}`);
  }

  if (onProgress) onProgress(100);

  return `${SB_URL}/storage/v1/object/public/chat-media/${filename}`;
}

// ── VOICE RECORDER (WAV OUTPUT — reliable everywhere) ──────────────────
// Uses AudioContext + ScriptProcessor to capture raw PCM, then encodes
// to WAV locally. WAV has a fixed duration header, so playback is
// always correct — no more "wrong duration" or "blip" problems.
let _voiceStream = null;
let _voiceSourceNode = null;
let _voiceProcessor = null;
let _voiceAudioCtx = null;
let _voiceSamples = [];
let _voiceSampleRate = 44100;
let _recordStartTime = 0;

async function startVoiceRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Voice recording not supported on this device');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    }
  });

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();
  _voiceSampleRate = audioCtx.sampleRate;
  _voiceSamples = [];
  _recordStartTime = Date.now();

  const source = audioCtx.createMediaStreamSource(stream);
  const bufferSize = 4096;
  const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);

  processor.onaudioprocess = (e) => {
    const inputData = e.inputBuffer.getChannelData(0);
    _voiceSamples.push(new Float32Array(inputData));
  };

  source.connect(processor);
  processor.connect(audioCtx.destination);

  _voiceStream = stream;
  _voiceSourceNode = source;
  _voiceProcessor = processor;
  _voiceAudioCtx = audioCtx;

  return {
    stop: () => new Promise((resolve) => {
      try {
        processor.disconnect();
        source.disconnect();
        stream.getTracks().forEach(t => t.stop());
        audioCtx.close();
      } catch (e) {}

      const duration = Math.round((Date.now() - _recordStartTime) / 1000);
      const blob = _encodeWav(_voiceSamples, _voiceSampleRate);

      _voiceStream = null;
      _voiceSourceNode = null;
      _voiceProcessor = null;
      _voiceAudioCtx = null;
      _voiceSamples = [];

      resolve({ blob, duration });
    }),
    cancel: () => {
      try {
        processor.disconnect();
        source.disconnect();
        stream.getTracks().forEach(t => t.stop());
        audioCtx.close();
      } catch (e) {}
      _voiceStream = null;
      _voiceSourceNode = null;
      _voiceProcessor = null;
      _voiceAudioCtx = null;
      _voiceSamples = [];
    },
  };
}

// Encode raw Float32 PCM samples as a proper WAV file
function _encodeWav(samplesArrays, sampleRate) {
  let totalSamples = 0;
  for (const arr of samplesArrays) totalSamples += arr.length;
  const merged = new Float32Array(totalSamples);
  let offset = 0;
  for (const arr of samplesArrays) {
    merged.set(arr, offset);
    offset += arr.length;
  }

  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = merged.length * bytesPerSample;
  const bufferSize = 44 + dataSize;

  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  _writeWavString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  _writeWavString(view, 8, 'WAVE');
  _writeWavString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  _writeWavString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let pcmOffset = 44;
  for (let i = 0; i < merged.length; i++) {
    let s = Math.max(-1, Math.min(1, merged[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(pcmOffset, s, true);
    pcmOffset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function _writeWavString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// ── MEDIA HELPERS ───────────────────────────────────────────────────────
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function linkify(text) {
  if (!text) return '';
  const escaped = esc(text);
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;word-break:break-all;">$1</a>'
  );
}

// ── REALTIME SUBSCRIPTION (polling fallback) ───────────────────────────
function subscribeToMessages(conversationId, onNew, intervalMs = 4000) {
  let lastCheck = new Date().toISOString();
  const timer = setInterval(async () => {
    try {
      const rows = await db.getAll('messages', {
        filter: `conversation_id=eq.${conversationId}&created_at=gt.${lastCheck}`,
        order: 'created_at.asc',
      });
      if (rows && rows.length) {
        lastCheck = rows[rows.length - 1].created_at;
        rows.forEach(onNew);
      }
    } catch (e) {}
  }, intervalMs);
  return () => clearInterval(timer);
}

// ═══════════════════════════════════════════════════════════════════════
// PHOTO UPLOAD (agent profile)
// ═══════════════════════════════════════════════════════════════════════

function compressImage(file, maxDim = 800, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided'));
    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Please select an image file'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Could not read image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

async function uploadAgentPhoto(file, agentCode) {
  if (!agentCode) throw new Error('Agent code required');
  const blob = await compressImage(file);
  const filename = `${agentCode}/photo-${Date.now()}.jpg`;
  const url = `${SB_URL}/storage/v1/object/agent-photos/${filename}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
      'cache-control': 'public, max-age=31536000',
    },
    body: blob,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Upload failed: ${res.status}`);
  }
  const publicUrl = `${SB_URL}/storage/v1/object/public/agent-photos/${filename}`;
  await db.update('agents', `agent_code=eq.${agentCode}`, {
    profile_photo_url: publicUrl,
    photo_updated_at: new Date().toISOString(),
  });
  await db.logAudit('agent', agentCode, 'photo_uploaded', agentCode, null, { url: publicUrl });
  return publicUrl;
}

async function deleteAgentPhoto(agentCode, currentPhotoUrl) {
  if (!agentCode) throw new Error('Agent code required');
  if (currentPhotoUrl && currentPhotoUrl.includes('/agent-photos/')) {
    const path = currentPhotoUrl.split('/agent-photos/')[1];
    if (path) {
      try {
        await fetch(`${SB_URL}/storage/v1/object/agent-photos/${path}`, {
          method: 'DELETE',
          headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` },
        });
      } catch (e) {}
    }
  }
  await db.update('agents', `agent_code=eq.${agentCode}`, {
    profile_photo_url: null,
    photo_updated_at: new Date().toISOString(),
  });
  await db.logAudit('agent', agentCode, 'photo_deleted', agentCode);
}

function renderAvatar(agent, size = 56, extraClass = '') {
  const s = Number(size) || 56;
  if (agent && agent.profile_photo_url) {
    return `<img src="${esc(agent.profile_photo_url)}" alt="${esc(agent.full_name || 'Agent')}"
      class="${extraClass}"
      style="width:${s}px;height:${s}px;border-radius:50%;object-fit:cover;flex-shrink:0;background:#eee;"
      onerror="this.style.display='none';this.nextElementSibling && (this.nextElementSibling.style.display='flex');">
      <div class="${extraClass}" style="display:none;width:${s}px;height:${s}px;border-radius:50%;background:linear-gradient(135deg,#ff6000,#ff9f43);align-items:center;justify-content:center;color:white;font-family:'Syne',sans-serif;font-weight:800;font-size:${Math.round(s*0.42)}px;flex-shrink:0;">${(agent.full_name || '?')[0].toUpperCase()}</div>`;
  }
  return `<div class="${extraClass}" style="width:${s}px;height:${s}px;border-radius:50%;background:linear-gradient(135deg,#ff6000,#ff9f43);display:flex;align-items:center;justify-content:center;color:white;font-family:'Syne',sans-serif;font-weight:800;font-size:${Math.round(s*0.42)}px;flex-shrink:0;">${(agent && agent.full_name ? agent.full_name[0].toUpperCase() : '?')}</div>`;
}

// ═══════════════════════════════════════════════════════════════════════
// WALLET / NOTIFICATIONS / REFERRAL / FRAUD / CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════

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

async function createNotification(agentCode, title, message, type, link) {
  try {
    await db.insert('notifications', {
      agent_code: agentCode, title, message,
      type: type || 'info', link: link || null,
    });
  } catch (e) {}
}

async function logReferralEvent(agentCode, eventType, metadata) {
  try {
    await db.insert('referral_events', {
      agent_code: agentCode, event_type: eventType,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (e) {}
}

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

// ═══════════════════════════════════════════════════════════════════════
// ID GENERATORS
// ═══════════════════════════════════════════════════════════════════════

function makeAppId(n)     { return `PY-${new Date().getFullYear()}-${String(n).padStart(4,'0')}`; }
function makeAgentId(n)   { return `PYA-${String(n).padStart(4,'0')}`; }
function makeAgentCode(n) { return `PY${String(n).padStart(3,'0')}`; }
function makeLeadId(n)    { return `L-${String(n).padStart(4,'0')}`; }
function makeSaleId(n)    { return `S-${String(n).padStart(4,'0')}`; }
function makePayoutId(n)  { return `PR-${String(n).padStart(4,'0')}`; }
function makeCampaignId(n){ return `CAMP-${String(n).padStart(3,'0')}`; }
function makeMaterialId(n){ return `M-${String(n).padStart(4,'0')}`; }

// ═══════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-ZM', { day:'numeric', month:'short', year:'numeric' });
}
function fmtDateLong(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-ZM', { day:'numeric', month:'long', year:'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-ZM', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-ZM', { hour:'2-digit', minute:'2-digit' });
}
function fmtMoney(n) { return 'ZMW ' + Number(n || 0).toLocaleString(); }

function timeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(date);
}

function timeUntilExpiry(expiresAt) {
  if (!expiresAt) return '';
  const seconds = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
  if (seconds <= 0) return 'expired';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

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

// ═══════════════════════════════════════════════════════════════════════
// LEGACY AUTH HELPERS
// ═══════════════════════════════════════════════════════════════════════

function adminLoggedIn() { return sessionStorage.getItem('btx_admin') === 'yes'; }
function agentCode() { return sessionStorage.getItem('agent_code') || localStorage.getItem('agent_code'); }
function requireAdmin() { if (!adminLoggedIn()) { window.location.href = 'admin.html'; return false; } return true; }
function requireAgent() {
  const code = agentCode();
  if (!code) { window.location.href = 'agent.html'; return null; }
  return code;
}

// ═══════════════════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════
// PDF GENERATORS
// ═══════════════════════════════════════════════════════════════════════

function pdfAddHeader(doc, title, subtitle) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(10, 10, 26);
  doc.rect(0, 0, W, 80, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('PhoneYa2-ZM', 40, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(255, 159, 67);
  doc.text('Agent Network · ' + (subtitle || title), 40, 56);
}

function pdfAddFooter(doc, label) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(229, 231, 235);
    doc.line(40, pageH - 40, pageW - 40, pageH - 40);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('PhoneYa2-ZM · Smart Choices. Better Connection.', 40, pageH - 24);
    doc.text(`${label || ''} · Page ${i} of ${pageCount}`, pageW - 40, pageH - 24, { align: 'right' });
  }
}

function loadImageAsDataUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function makeSalesStatementPdf(opts = {}) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { toast('⚠️ PDF library not loaded'); return; }
  const { agentName, agentId, agentCode, period, sales = [] } = opts;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  pdfAddHeader(doc, 'Sales Statement', 'Sales Statement');

  let y = 110;
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

  pdfAddFooter(doc, agentCode || 'All');
  doc.save(`PhoneYa2-Statement-${agentCode || 'All'}-${new Date().toISOString().slice(0,10)}.pdf`);
}

async function makeIdCardPdf(agent) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { toast('⚠️ PDF library not loaded'); return; }
  const doc = new jsPDF({ unit: 'pt', format: [240, 380], orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  doc.setFillColor(10, 10, 26); doc.rect(0, 0, W, H, 'F');
  doc.setFillColor(255, 96, 0); doc.rect(0, 0, W, 6, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text('PhoneYa2-ZM', W / 2, 40, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(255, 159, 67);
  doc.text('SALES ASSISTANT ID CARD', W / 2, 54, { align: 'center' });

  let photoAdded = false;
  if (agent.profile_photo_url) {
    try {
      const img = await loadImageAsDataUrl(agent.profile_photo_url);
      if (img) {
        doc.addImage(img, 'JPEG', W / 2 - 30, 80, 60, 60, undefined, 'FAST');
        photoAdded = true;
      }
    } catch (e) {}
  }
  if (!photoAdded) {
    doc.setFillColor(255, 96, 0);
    doc.circle(W / 2, 110, 30, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(28);
    doc.text((agent.full_name || '?')[0].toUpperCase(), W / 2, 122, { align: 'center' });
  }

  doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(agent.full_name || 'Agent', W / 2, 175, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(255, 159, 67);
  doc.text('Sales Assistant', W / 2, 192, { align: 'center' });

  doc.setTextColor(200, 200, 220); doc.setFontSize(9);
  doc.text('Agent ID:  ' + (agent.agent_id || '—'), W / 2, 220, { align: 'center' });
  doc.text('Agent Code:  ' + (agent.agent_code || '—'), W / 2, 235, { align: 'center' });
  doc.text('Status:  ACTIVE', W / 2, 250, { align: 'center' });

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

function makeCertificatePdf(opts) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { toast('⚠️ PDF library not loaded'); return; }
  const { agent, title, subtitle, date } = opts;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  doc.setDrawColor(255, 96, 0); doc.setLineWidth(6);
  doc.rect(20, 20, W - 40, H - 40);
  doc.setDrawColor(10, 10, 26); doc.setLineWidth(1);
  doc.rect(30, 30, W - 60, H - 60);

  doc.setFillColor(10, 10, 26); doc.rect(30, 30, W - 60, 70, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.text('PhoneYa2-ZM', 60, 70);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(255, 159, 67);
  doc.text('Agent Network · Certificate of Achievement', 60, 88);

  doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold'); doc.setFontSize(38);
  doc.text(title || 'Certificate of Achievement', W / 2, 180, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(14);
  doc.setTextColor(107, 114, 128);
  doc.text(subtitle || 'Proudly awarded to', W / 2, 215, { align: 'center' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(30);
  doc.setTextColor(255, 96, 0);
  doc.text(agent.full_name || 'Agent', W / 2, 265, { align: 'center' });

  doc.setDrawColor(229, 231, 235); doc.setLineWidth(1);
  doc.line(W / 2 - 200, 285, W / 2 + 200, 285);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text(`Agent ID: ${agent.agent_id || '—'}`, W / 2, 305, { align: 'center' });
  doc.text(date || new Date().toLocaleDateString('en-ZM'), W / 2, 340, { align: 'center' });

  doc.setDrawColor(26, 26, 46); doc.setLineWidth(1);
  doc.line(120, H - 90, 320, H - 90);
  doc.setFontSize(10);
  doc.text('Authorized Signature', 220, H - 75, { align: 'center' });
  doc.line(W - 320, H - 90, W - 120, H - 90);
  doc.text('PhoneYa2-ZM Director', W - 220, H - 75, { align: 'center' });

  doc.save(`PhoneYa2-Certificate-Achievement-${agent.agent_code}.pdf`);
}

function makeParticipationCertificatePdf(agent) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { toast('⚠️ PDF library not loaded'); return; }
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  doc.setDrawColor(124, 58, 237); doc.setLineWidth(6);
  doc.rect(20, 20, W - 40, H - 40);
  doc.setDrawColor(10, 10, 26); doc.setLineWidth(1);
  doc.rect(30, 30, W - 60, H - 60);

  doc.setFillColor(10, 10, 26); doc.rect(30, 30, W - 60, 70, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.text('PhoneYa2-ZM', 60, 70);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(255, 159, 67);
  doc.text('Agent Network · Certificate of Participation', 60, 88);

  doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold'); doc.setFontSize(34);
  doc.text('Certificate of Participation', W / 2, 170, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(14);
  doc.setTextColor(107, 114, 128);
  doc.text('This certifies that', W / 2, 205, { align: 'center' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(32);
  doc.setTextColor(255, 96, 0);
  doc.text(agent.full_name || 'Agent', W / 2, 255, { align: 'center' });

  doc.setDrawColor(229, 231, 235); doc.setLineWidth(1);
  doc.line(W / 2 - 200, 275, W / 2 + 200, 275);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
  doc.setTextColor(107, 114, 128);
  const text = 'has been officially accepted into the PhoneYa2-ZM Sales Agent Network and is authorised to promote and sell PhoneYa2-ZM products.';
  const lines = doc.splitTextToSize(text, 500);
  let ly = 305;
  lines.forEach(line => { doc.text(line, W / 2, ly, { align: 'center' }); ly += 18; });
  doc.setFontSize(10);
  doc.text(`Agent ID: ${agent.agent_id || '—'}`, W / 2, ly + 20, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text(`Issued: ${fmtDateLong(new Date())}`, W / 2, H - 120, { align: 'center' });

  doc.setDrawColor(26, 26, 46); doc.setLineWidth(1);
  doc.line(120, H - 90, 320, H - 90);
  doc.setFontSize(10);
  doc.text('Authorized Signature', 220, H - 75, { align: 'center' });
  doc.line(W - 320, H - 90, W - 120, H - 90);
  doc.text('PhoneYa2-ZM Director', W - 220, H - 75, { align: 'center' });

  doc.save(`PhoneYa2-Certificate-Participation-${agent.agent_code}.pdf`);
}

function makeWelcomeLetterPdf(agent) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { toast('⚠️ PDF library not loaded'); return; }
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  pdfAddHeader(doc, 'Welcome Letter', 'Welcome Letter');

  let y = 120;
  doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text('Welcome to PhoneYa2-ZM', 40, y); y += 30;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text(fmtDateLong(new Date()), 40, y); y += 25;
  doc.setTextColor(26, 26, 46); doc.setFontSize(12);
  doc.text(`Dear ${agent.full_name || 'Agent'},`, 40, y); y += 25;

  const paragraphs = [
    'On behalf of the entire PhoneYa2-ZM team, we are delighted to welcome you to our Sales Agent Network.',
    'You are now an official PhoneYa2-ZM Sales Assistant. Your Agent ID is ' + (agent.agent_id || '—') + ' and your Agent Code is ' + (agent.agent_code || '—') + '.',
    'Your personal referral link is:',
  ];
  paragraphs.forEach(p => {
    const lines = doc.splitTextToSize(p, W - 80);
    lines.forEach(line => { doc.text(line, 40, y); y += 16; });
    y += 8;
  });

  doc.setFillColor(245, 245, 250);
  const refText = agent.referral_url || `${CONFIG.agentSiteUrl}/?ref=${agent.agent_code}`;
  const refLines = doc.splitTextToSize(refText, W - 100);
  const boxH = 20 + (refLines.length * 16);
  doc.roundedRect(40, y, W - 80, boxH, 6, 6, 'F');
  doc.setTextColor(255, 96, 0); doc.setFont('courier', 'bold'); doc.setFontSize(10);
  refLines.forEach((line, i) => { doc.text(line, 50, y + 20 + i * 16); });
  y += boxH + 20;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(26, 26, 46);
  const remaining = [
    'As an agent you earn commission on every confirmed sale.',
    'We have included a training centre in your dashboard where you can complete 9 short modules to unlock your Certificate of Achievement.',
    'If you have any questions, simply reach out to us on WhatsApp at +' + CONFIG.waNumber + '.',
    'Once again, welcome. We look forward to a successful partnership.',
  ];
  remaining.forEach(p => {
    const lines = doc.splitTextToSize(p, W - 80);
    lines.forEach(line => { doc.text(line, 40, y); y += 16; });
    y += 10;
  });

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Warm regards,', 40, y); y += 18;
  doc.text('PhoneYa2-ZM Team', 40, y); y += 16;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text('A BLESSTech-X Venture · Lusaka, Zambia', 40, y);

  pdfAddFooter(doc, 'Welcome Letter');
  doc.save(`PhoneYa2-Welcome-${agent.agent_code}.pdf`);
}

function makeApplicationPdf(application, agent) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { toast('⚠️ PDF library not loaded'); return; }
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const a = application || {};

  pdfAddHeader(doc, 'Application', 'Sales Agent Application');

  let y = 110;
  doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('SALES AGENT APPLICATION', 40, y); y += 22;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(107, 114, 128);
  doc.text(`Application ID: ${a.app_id || '—'}`, 40, y); y += 14;
  doc.text(`Date Submitted: ${fmtDate(a.created_at)}`, 40, y); y += 14;
  doc.text(`Status: ${(a.status || 'pending').toUpperCase()}`, 40, y); y += 20;

  const sections = [
    ['Personal Information', [
      ['Full Name', a.full_name], ['Age', a.age], ['Location', a.location],
      ['Education', a.education], ['Phone', a.phone], ['WhatsApp', a.whatsapp], ['Email', a.email],
    ]],
    ['Background', [
      ['Occupation', a.occupation], ['Social Platforms', a.platforms],
      ['Sales Experience', a.experience], ['Network Size', a.reach], ['Hours Per Week', a.hours],
      ['Referral Source', a.source],
    ]],
  ];

  sections.forEach(([title, fields]) => {
    doc.setFillColor(245, 245, 250);
    doc.rect(40, y, W - 80, 20, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(80, 80, 100);
    doc.text(title, 48, y + 14); y += 28;
    fields.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(120, 120, 140);
      doc.text(label, 40, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(26, 26, 46);
      const v = String(value || '—');
      const lines = doc.splitTextToSize(v, W - 200);
      doc.text(lines, 180, y);
      y += Math.max(lines.length * 14, 16);
      if (y > H - 100) { doc.addPage(); pdfAddHeader(doc, 'Application', 'Sales Agent Application (continued)'); y = 110; }
    });
    y += 8;
  });

  doc.setFillColor(245, 245, 250);
  doc.rect(40, y, W - 80, 20, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(80, 80, 100);
  doc.text('Motivation', 48, y + 14); y += 28;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(26, 26, 46);
  const motiv = doc.splitTextToSize(a.motivation || '—', W - 80);
  motiv.forEach(line => { doc.text(line, 40, y); y += 15; });

  pdfAddFooter(doc, a.app_id || '');
  doc.save(`PhoneYa2-Application-${a.app_id || 'unknown'}.pdf`);
}

function makeAgreementPdf(agreement, agent) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { toast('⚠️ PDF library not loaded'); return; }
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  pdfAddHeader(doc, 'Agreement', 'Sales Agent Agreement');

  let y = 110;
  doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('SALES AGENT AGREEMENT', 40, y); y += 20;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(107, 114, 128);
  doc.text(`Version: ${(agreement && agreement.version) || '1.0'}`, 40, y); y += 14;
  if (agent) {
    doc.text(`Agent: ${agent.full_name || '—'}  (${agent.agent_id || '—'})`, 40, y); y += 14;
    if (agent.agreement_accepted_at) doc.text(`Accepted: ${fmtDate(agent.agreement_accepted_at)}`, 40, y), y += 14;
  }
  y += 12;
  doc.setDrawColor(229, 231, 235);
  doc.line(40, y, W - 40, y);
  y += 20;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(26, 26, 46);
  const content = (agreement && agreement.content) || 'Agreement text not available.';
  const lines = doc.splitTextToSize(content, W - 80);
  lines.forEach(line => {
    if (y > H - 80) { doc.addPage(); pdfAddHeader(doc, 'Agreement', 'Sales Agent Agreement (continued)'); y = 110; }
    doc.text(line, 40, y); y += 14;
  });

  pdfAddFooter(doc, 'Agreement');
  doc.save(`PhoneYa2-Agreement-${(agent && agent.agent_code) || 'agent'}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════
// PWA REGISTRATION
// ═══════════════════════════════════════════════════════════════════════

(function registerPWA() {
  if (typeof document === 'undefined') return;
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = './manifest.json';
    document.head.appendChild(link);
  }
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#ff6000';
    document.head.appendChild(meta);
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .then(reg => console.log('✅ Service worker registered'))
        .catch(err => console.warn('Service worker registration failed:', err));
    });
  }
})();
