/* ═══════════════════════════════════════════════════════════════════════════
   PhoneYa2 Ads — ads-config.js
   ────────────────────────────────────────────────────────────────────────
   Static config + thin helper API for the PhoneYa2 Ads subsystem.

   Loaded by:
     · The 5 existing shop pages (index, shop, product, about, contact)
       — they read window.PY2_ADS_CONFIG to decide whether to render
       their sponsored carousel / grid.
     · Every new ads page (advertise, advertiser, ads-admin, ad/[slug])
       — they use window.py2Ads for auth, DB access, storage, helpers.

   Design notes:
     · No SDK, no build step, no dependencies. Just fetch().
     · Uses the PUBLISHABLE key. RLS is the security boundary.
       The secret key never appears in this file or any client file.
     · Exposes only what pages need. Nothing privileged.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Hard-coded project config ────────────────────────────────────────────
  var SUPABASE_URL = 'https://signnapmkdctdcfpnsiu.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_BwOe5fD2oK-hz1LtPNmslw_9EaBZNUD';

  // Flag read by the existing shop pages. When this global exists,
  // the sponsored sections will attempt to load and render.
  window.PY2_ADS_CONFIG = {
    url: SUPABASE_URL,
    key: SUPABASE_KEY
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION STORAGE  (Section 4.1 of brief: sessionStorage, not localStorage)
  // ═══════════════════════════════════════════════════════════════════════════
  var SESSION_KEY = 'py2ads_session';

  function saveSession(data) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch (e) {}
  }
  function loadSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOW-LEVEL HTTP  (Supabase REST + Auth endpoints)
  // ═══════════════════════════════════════════════════════════════════════════
  function authHeaders(accessToken) {
    var h = {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + (accessToken || SUPABASE_KEY),
      'Accept':        'application/json'
    };
    return h;
  }

  function restUrl(path) {
    // path example: 'ads?status=eq.approved'
    return SUPABASE_URL + '/rest/v1/' + path;
  }

  function apiFetch(url, opts) {
    return fetch(url, opts).then(function (r) {
      var contentType = r.headers.get('content-type') || '';
      var parse = contentType.indexOf('application/json') >= 0
        ? r.json().catch(function () { return null; })
        : r.text();
      return parse.then(function (body) {
        if (!r.ok) {
          var msg = 'Request failed (' + r.status + ')';
          if (body && body.message) msg = body.message;
          else if (typeof body === 'string' && body.length < 200) msg = body;
          var err = new Error(msg);
          err.status = r.status;
          err.body = body;
          throw err;
        }
        return body;
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH  (Section 4 of brief)
  // ═══════════════════════════════════════════════════════════════════════════
  var auth = {
    /**
     * Sign up a new advertiser via the signup-advertiser Edge Function.
     * The Edge Function atomically creates the auth user + advertisers row.
     * See Section 4.5 of the brief.
     *
     * @param {Object} payload — { email, password, business_name, owner_name, phone, accepted_terms }
     * @returns {Promise<Object>} — { ok, message? }
     */
    signup: function (payload) {
      return fetch(SUPABASE_URL + '/functions/v1/signup-advertiser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY
        },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok || data.error) {
            throw new Error(data.error || ('Signup failed (' + r.status + ')'));
          }
          return data;
        });
      });
    },

    /**
     * Sign in with email + password. Stores the session in sessionStorage.
     * On success, resolves with { user, access_token, expires_at }.
     */
    signin: function (email, password) {
      return fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY
        },
        body: JSON.stringify({ email: email, password: password })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok || data.error) {
            throw new Error(data.error_description || data.error || 'Sign in failed');
          }
          var session = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at,
            user: data.user
          };
          saveSession(session);
          return session;
        });
      });
    },

    /**
     * Sign out. Clears the session locally and, best-effort, tells
     * Supabase to invalidate the token.
     */
    signout: function () {
      var s = loadSession();
      clearSession();
      if (s && s.access_token) {
        return fetch(SUPABASE_URL + '/auth/v1/logout', {
          method: 'POST',
          headers: authHeaders(s.access_token)
        }).catch(function () {});
      }
      return Promise.resolve();
    },

    /**
     * Return the current session if it exists and isn't expired.
     * Never makes a network call — cheap to call often.
     */
    getSession: function () {
      var s = loadSession();
      if (!s) return null;
      // expires_at is seconds since epoch
      if (s.expires_at && Date.now() / 1000 > s.expires_at - 30) {
        // Token is expired or about to expire — treat as signed out.
        // (We could refresh here; keeping it simple for V1.)
        clearSession();
        return null;
      }
      return s;
    },

    /**
     * Convenience: get the current auth user (or null).
     */
    getUser: function () {
      var s = auth.getSession();
      return s ? s.user : null;
    },

    /**
     * Best-effort profile fetch for the current user.
     * Returns null if not signed in.
     */
    getProfile: function () {
      var s = auth.getSession();
      if (!s) return Promise.resolve(null);
      return db.select('profiles', 'id=eq.' + encodeURIComponent(s.user.id) + '&limit=1', s.access_token)
        .then(function (rows) { return rows && rows[0] ? rows[0] : null; });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASE  — thin wrappers around the REST API
  // ═══════════════════════════════════════════════════════════════════════════
  var db = {
    /**
     * SELECT rows.
     * @param {string} table
     * @param {string} query — PostgREST query string (e.g. 'status=eq.pending')
     * @param {string} [accessToken] — if omitted, uses the publishable key
     */
    select: function (table, query, accessToken) {
      var url = restUrl(table) + (query ? '?' + query : '');
      return apiFetch(url, {
        method: 'GET',
        headers: authHeaders(accessToken)
      });
    },

    /**
     * INSERT a row (or array of rows).
     * Returns the created row(s) because we set Prefer: return=representation.
     */
    insert: function (table, row, accessToken) {
      var headers = authHeaders(accessToken);
      headers['Content-Type']  = 'application/json';
      headers['Prefer']        = 'return=representation';
      return apiFetch(restUrl(table), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(row)
      });
    },

    /**
     * UPDATE rows matching query. Returns the updated rows.
     */
    update: function (table, query, patch, accessToken) {
      var headers = authHeaders(accessToken);
      headers['Content-Type']  = 'application/json';
      headers['Prefer']        = 'return=representation';
      return apiFetch(restUrl(table) + '?' + query, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify(patch)
      });
    },

    /**
     * DELETE rows matching query. Returns the deleted rows.
     */
    delete: function (table, query, accessToken) {
      var headers = authHeaders(accessToken);
      headers['Prefer'] = 'return=representation';
      return apiFetch(restUrl(table) + '?' + query, {
        method: 'DELETE',
        headers: headers
      });
    },

    /**
     * Call a Postgres function exposed via RPC.
     */
    rpc: function (fnName, args, accessToken) {
      var headers = authHeaders(accessToken);
      headers['Content-Type'] = 'application/json';
      return apiFetch(restUrl('rpc/' + fnName), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(args || {})
      });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STORAGE  — upload to a bucket, get public URL
  // ═══════════════════════════════════════════════════════════════════════════
  var storage = {
    /**
     * Upload a file to a bucket.
     * Requires an authenticated session (Storage RLS enforces bucket rules).
     *
     * @param {string} bucket — e.g. 'ad-media'
     * @param {string} path — e.g. 'ads/<ad-id>/hero.jpg'
     * @param {File|Blob} file
     * @param {Object} [opts] — { contentType, upsert }
     */
    upload: function (bucket, path, file, opts) {
      opts = opts || {};
      var s = auth.getSession();
      if (!s) return Promise.reject(new Error('Not signed in'));

      var headers = {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + s.access_token,
        'Content-Type':  opts.contentType || file.type || 'application/octet-stream',
        'x-upsert':      opts.upsert ? 'true' : 'false'
      };
      var url = SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + path;

      return fetch(url, {
        method: 'POST',
        headers: headers,
        body: file
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) throw new Error(data.message || ('Upload failed (' + r.status + ')'));
          return data;
        });
      });
    },

    /**
     * Public URL for an object in a public bucket.
     */
    publicUrl: function (bucket, path) {
      return SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + path;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * HTML-escape a string. Use this for EVERY dynamic value you insert
   * into innerHTML. (Section 15, rule #2 of the brief.)
   */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * URL-safe slug. Used for ad slugs.
   * Example: slugify('iPhone 13 Sale — 30% Off!') → 'iphone-13-sale-30-off'
   */
  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);
  }

  /**
   * Appends a 6-character random suffix. Used for ad slugs to avoid
   * collisions across advertisers with similar titles.
   */
  function uniqueSuffix() {
    return Math.random().toString(36).slice(2, 8);
  }

  /**
   * Truncated SHA-256 visitor hash. (Section 11 of the brief.)
   * No PII stored. Rotates daily.
   */
  var _visitorHashCache = null;
  function visitorHash() {
    if (_visitorHashCache) return Promise.resolve(_visitorHashCache);
    try {
      var ua   = navigator.userAgent || '';
      var lang = navigator.language || '';
      var day  = new Date().toISOString().slice(0, 10);
      var raw  = ua + '|' + lang + '|' + day + '|py2ads';
      if (!window.crypto || !window.crypto.subtle) {
        var h = 0;
        for (var i = 0; i < raw.length; i++) { h = ((h << 5) - h + raw.charCodeAt(i)) | 0; }
        _visitorHashCache = 'v1_' + Math.abs(h).toString(36);
        return Promise.resolve(_visitorHashCache);
      }
      var buf = new TextEncoder().encode(raw);
      return window.crypto.subtle.digest('SHA-256', buf).then(function (digest) {
        var bytes = new Uint8Array(digest);
        var hex = '';
        for (var j = 0; j < 12; j++) { hex += ('0' + bytes[j].toString(16)).slice(-2); }
        _visitorHashCache = 'v1_' + hex;
        return _visitorHashCache;
      }).catch(function () {
        _visitorHashCache = 'v1_' + Math.random().toString(36).slice(2, 12);
        return _visitorHashCache;
      });
    } catch (e) {
      _visitorHashCache = 'v1_anon';
      return Promise.resolve(_visitorHashCache);
    }
  }

  /**
   * Referrer-based source detection. (Section 11 of the brief.)
   * Returns one of: 'whatsapp', 'facebook', 'instagram', 'adshare', 'direct', 'other'
   */
  function detectSource() {
    try {
      var ref = document.referrer || '';
      if (/whatsapp|wa\.me/i.test(ref))  return 'whatsapp';
      if (/facebook|fb\.com/i.test(ref)) return 'facebook';
      if (/instagram/i.test(ref))        return 'instagram';
      if (!ref) {
        var params = new URLSearchParams(window.location.search);
        if (params.get('ref') && params.get('ref').indexOf('adshare') === 0) return 'adshare';
        return 'direct';
      }
      return 'other';
    } catch (e) { return 'direct'; }
  }

  /**
   * Small toast. Creates the element on first call.
   * @param {string} msg
   * @param {'info'|'success'|'error'} [kind]
   */
  function toast(msg, kind) {
    var id = 'py2ads-toast';
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.cssText =
        'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);' +
        'background:#0a0a14;color:white;font-size:13px;font-weight:500;' +
        'padding:10px 20px;border-radius:100px;z-index:9999;' +
        'opacity:0;transition:opacity .3s;pointer-events:none;' +
        'white-space:nowrap;max-width:calc(100vw - 32px);overflow:hidden;' +
        'text-overflow:ellipsis;';
      document.body.appendChild(el);
    }
    var icons = { info: '💬', success: '✅', error: '⚠️' };
    var icon  = icons[kind] || icons.info;
    el.textContent = icon + '  ' + msg;
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.style.opacity = '0'; }, 2800);
  }

  /**
   * Format an ISO timestamp as a short, human-readable date.
   */
  function formatDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  /**
   * Simple wrapper: run an async function, show a toast on error.
   * Every fetch in the ads pages should go through this pattern.
   */
  function safe(promise, onErrorMsg) {
    return promise.catch(function (err) {
      toast(err.message || onErrorMsg || 'Something went wrong', 'error');
      throw err;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  window.py2Ads = {
    config:      { url: SUPABASE_URL, key: SUPABASE_KEY },
    auth:        auth,
    db:          db,
    storage:     storage,
    esc:         esc,
    slugify:     slugify,
    uniqueSuffix: uniqueSuffix,
    visitorHash: visitorHash,
    detectSource: detectSource,
    toast:       toast,
    formatDate:  formatDate,
    safe:        safe
  };
})();
