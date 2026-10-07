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
     · Session tokens live in sessionStorage (Section 4.1 of the brief).
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
  // SESSION STORAGE
  //
  // Sessions live in sessionStorage under SESSION_KEY. sessionStorage is
  // per-tab and per-origin. It is cleared when the tab closes, and it is
  // NOT shared between tabs or between phoneya2.pages.dev and any other
  // origin. This is intentional for security, but it means:
  //
  //   · If you sign in and then open the dashboard in a new tab, you will
  //     be signed out in the new tab.
  //   · If you sign in on one hostname and use another, the session will
  //     not follow you.
  //
  // If you ever want cross-tab persistence, switch to localStorage. If you
  // want cross-origin persistence, you need real Supabase cookies or a
  // server-side session. Neither is done here.
  // ═══════════════════════════════════════════════════════════════════════════
  var SESSION_KEY = 'py2ads_session';

  function saveSession(data) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch (e) {}
  }
  function loadSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (e) {
      // Corrupted session blob. Clear it so the next call gets a clean miss.
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e2) {}
      return null;
    }
  }
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOW-LEVEL HTTP
  // ═══════════════════════════════════════════════════════════════════════════
  function authHeaders(accessToken) {
    return {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + (accessToken || SUPABASE_KEY),
      'Accept':        'application/json'
    };
  }

  function restUrl(path) {
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
          else if (body && body.error_description) msg = body.error_description;
          else if (body && body.error) msg = body.error;
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
  // AUTH
  // ═══════════════════════════════════════════════════════════════════════════
  var auth = {
    /**
     * Sign up a new advertiser via the signup-advertiser Edge Function.
     * The Edge Function atomically creates the auth user + advertisers row.
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
     * Sign in with email + password.
     * On success, stores the session in sessionStorage and resolves with
     * { user, access_token, refresh_token, expires_at }.
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
            var msg = data.error_description || data.error || 'Sign in failed';
            if (/invalid.*credentials|invalid.*grant/i.test(msg)) {
              msg = 'Incorrect email or password.';
            }
            throw new Error(msg);
          }
          if (!data.access_token || !data.user) {
            throw new Error('Sign in response was missing a token or user. Please try again.');
          }
          var session = {
            access_token:  data.access_token,
            refresh_token: data.refresh_token,
            expires_at:    data.expires_at,   // seconds since epoch
            user:          data.user
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
     *
     * Expiry window: we treat the session as expired 30 seconds before the
     * actual JWT expiry, so a slow request doesn't race the clock. If the
     * session is expired or malformed, we clear it and return null.
     */
    getSession: function () {
      var s = loadSession();
      if (!s) return null;
      if (!s.access_token || !s.user) {
        // Malformed session object. Clear it.
        clearSession();
        return null;
      }
      // expires_at is seconds since epoch. If missing, treat as non-expiring.
      if (s.expires_at && Date.now() / 1000 > s.expires_at - 30) {
        clearSession();
        return null;
      }
      return s;
    },

    getUser: function () {
      var s = auth.getSession();
      return s ? s.user : null;
    },

    getProfile: function () {
      var s = auth.getSession();
      if (!s) return Promise.resolve(null);
      return db.select('profiles', 'id=eq.' + encodeURIComponent(s.user.id) + '&limit=1', s.access_token)
        .then(function (rows) { return rows && rows[0] ? rows[0] : null; });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASE
  // ═══════════════════════════════════════════════════════════════════════════
  var db = {
    select: function (table, query, accessToken) {
      var url = restUrl(table) + (query ? '?' + query : '');
      return apiFetch(url, { method: 'GET', headers: authHeaders(accessToken) });
    },
    insert: function (table, row, accessToken) {
      var h = authHeaders(accessToken);
      h['Content-Type'] = 'application/json';
      h['Prefer']       = 'return=representation';
      return apiFetch(restUrl(table), { method: 'POST', headers: h, body: JSON.stringify(row) });
    },
    update: function (table, query, patch, accessToken) {
      var h = authHeaders(accessToken);
      h['Content-Type'] = 'application/json';
      h['Prefer']       = 'return=representation';
      return apiFetch(restUrl(table) + '?' + query, { method: 'PATCH', headers: h, body: JSON.stringify(patch) });
    },
    delete: function (table, query, accessToken) {
      var h = authHeaders(accessToken);
      h['Prefer'] = 'return=representation';
      return apiFetch(restUrl(table) + '?' + query, { method: 'DELETE', headers: h });
    },
    rpc: function (fnName, args, accessToken) {
      var h = authHeaders(accessToken);
      h['Content-Type'] = 'application/json';
      return apiFetch(restUrl('rpc/' + fnName), { method: 'POST', headers: h, body: JSON.stringify(args || {}) });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STORAGE
  //
  // Upload to Supabase Storage. Requires a valid session because the
  // storage bucket has RLS that checks auth.uid(). If the session is
  // missing, we throw a clear, actionable error — not the cryptic
  // "Not signed in" that used to appear.
  // ═══════════════════════════════════════════════════════════════════════════
  var storage = {
    upload: function (bucket, path, file, opts) {
      opts = opts || {};
      var s = auth.getSession();
      if (!s) {
        return Promise.reject(new Error(
          'Your session has expired or is missing. Please sign in again, then try the upload.'
        ));
      }
      if (!file) {
        return Promise.reject(new Error('No file selected.'));
      }

      var headers = {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + s.access_token,
        'Content-Type':  opts.contentType || file.type || 'application/octet-stream',
        'x-upsert':      opts.upsert ? 'true' : 'false'
      };
      var url = SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + path;

      return fetch(url, { method: 'POST', headers: headers, body: file })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (data) {
            if (!r.ok) {
              var msg = data.message || data.error || ('Upload failed (' + r.status + ')');
              // If Supabase says we're not authorised, that means the token
              // was rejected (expired mid-session, or RLS policy denied).
              // Surface a friendly message so the user knows to sign in.
              if (r.status === 401 || r.status === 403) {
                msg = 'Your session has expired. Please sign in again, then re-upload.';
                clearSession();
              }
              throw new Error(msg);
            }
            return data;
          });
        });
    },
    publicUrl: function (bucket, path) {
      return SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + path;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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

  function uniqueSuffix() {
    return Math.random().toString(36).slice(2, 8);
  }

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

  function toast(msg, kind) {
    var id = 'py2ads-toast';
    var el = document.getElementById(id);
    var icons = { info: '💬', success: '✅', error: '⚠️' };
    var icon  = icons[kind] || icons.info;
    var text  = icon + '  ' + msg;

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
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.style.opacity = '0'; }, 2800);
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

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
    config:       { url: SUPABASE_URL, key: SUPABASE_KEY },
    auth:         auth,
    db:           db,
    storage:      storage,
    esc:          esc,
    slugify:      slugify,
    uniqueSuffix: uniqueSuffix,
    visitorHash:  visitorHash,
    detectSource: detectSource,
    toast:        toast,
    formatDate:   formatDate,
    safe:         safe
  };
})();
