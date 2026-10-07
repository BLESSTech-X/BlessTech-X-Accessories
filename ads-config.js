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
          var session = {
            access_token:  data.access_token,
            refresh_token: data.refresh_token,
            expires_at:    data.expires_at,
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
     */
    getSession: function () {
      var s = loadSession();
      if (!s) return null;
      // expires_at is seconds since epoch
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
  // ═══════════════════════════════════════════════════════════════════════════
  var storage = {
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

      return fetch(url, { method: 'POST', headers: headers, body: file })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (data) {
            if (!r.ok) throw new Error(data.message || ('Upload failed (' + r.status + ')'));
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
     // ═══════════════════════════════════════════════════════════════════════
  // SHARED AD CARD RENDERER
  //
  // Renders a single sponsored-ad card. Used by the interstitials on
  // index.html, shop.html, and product.html.
  //
  // Tier visuals (Step 5):
  //   · free     — no badge, standard card
  //   · starter  — small tier badge, standard card
  //   · standard — tier badge, subtle accent border
  //   · business — tier badge, stronger border + slight size increase
  //   · premium  — tier badge, strongest border + size increase
  //
  // Tier ordering (Step 5):
  //   · Carousel items are sorted by tier rank (descending) BEFORE the
  //     weighted shuffle is applied. The first three slides therefore
  //     always show the highest-tier ads available. From slide 4 onwards,
  //     the existing weighted shuffle takes over. This gives paid tiers a
  //     guaranteed front row without making Free/Starter invisible to
  //     shoppers who scroll past the first three.
  //
  // Callers pass an ad object from the ads table. They are responsible for
  // wiring click/impression tracking. This function only renders markup.
  // ═══════════════════════════════════════════════════════════════════════

  var TIER_RANK = { free: 0, starter: 1, standard: 2, business: 3, premium: 4 };
  var TIER_LABEL = { starter: 'Starter', standard: 'Standard', business: 'Business', premium: 'Premium' };

  function py2TierFromAd(ad) {
    return (ad && ad.advertisers && ad.advertisers.tier) || 'free';
  }

  function py2TierRank(ad) {
    return TIER_RANK[py2TierFromAd(ad)] || 0;
  }

  // Sort: highest tier first, ties broken by weight desc, then created_at desc.
  function py2SortByTier(list) {
    return list.slice().sort(function (a, b) {
      var r = py2TierRank(b) - py2TierRank(a);
      if (r !== 0) return r;
      var w = (parseInt(b.weight, 10) || 1) - (parseInt(a.weight, 10) || 1);
      if (w !== 0) return w;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }

  // Rotate the list so the top N remain at the front, and the rest is the
  // weighted-shuffled remainder. The caller supplies the shuffle function
  // because it lives on the ad-serving side.
  function py2FrontloadByTier(list, weightedShuffleFn, topN) {
    topN = topN || 3;
    if (!list.length) return list;
    var sorted = py2SortByTier(list);
    if (sorted.length <= topN) return sorted;
    var front = sorted.slice(0, topN);
    var rest  = sorted.slice(topN);
    var shuffledRest = typeof weightedShuffleFn === 'function' ? weightedShuffleFn(rest) : rest;
    return front.concat(shuffledRest);
  }

  // Renders one sponsored-ad card as a DOM element.
  // opts = {
  //   esc,                    // HTML escaping function
  //   renderMedia,            // function(ad) → HTML string for the media element
  //   ctaFor,                 // function(ad) → { href, icon, label } for the CTA
  //   ctaLabelShort,          // function(ad) → short label for the CTA
  //   onCardClick,            // function(ad) → called when the card body is clicked
  //   onClickCta,             // function(ad) → called when the CTA is clicked
  //   onReport                // function(adId) → called when Report is clicked
  // }
  function py2BuildAdCard(ad, opts) {
    opts = opts || {};
    var esc            = opts.esc            || function (s) { return String(s == null ? '' : s); };
    var renderMedia    = opts.renderMedia    || function () { return ''; };
    var ctaFor         = opts.ctaFor         || function () { return { href: '#', icon: 'fa-solid fa-arrow-up-right-from-square', label: 'View' }; };
    var ctaLabelShort  = opts.ctaLabelShort  || function () { return 'Open'; };
    var onCardClick    = opts.onCardClick    || function () {};
    var onClickCta     = opts.onClickCta     || function () {};
    var onReport       = opts.onReport       || function () {};

    var tier  = py2TierFromAd(ad);
    var biz   = (ad.advertisers && ad.advertisers.business_name) || 'Zambian Business';
    var cta   = ctaFor(ad);
    var short = ctaLabelShort(ad);

    var card = document.createElement('div');
    card.className = 'py2-ads-card py2-ads-tier-' + tier;
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', ad.title);

    var tierBadgeHtml = '';
    if (tier !== 'free' && TIER_LABEL[tier]) {
      tierBadgeHtml = '<span class="py2-ads-tier-badge py2-ads-tier-badge-' + tier + '">' + TIER_LABEL[tier] + '</span>';
    }

    card.innerHTML =
      '<div class="py2-ads-img">' +
        '<span class="py2-ads-sponsored">Sponsored</span>' +
        tierBadgeHtml +
        '<button class="py2-ads-report" type="button" aria-label="Report this ad">Report</button>' +
        renderMedia(ad) +
      '</div>' +
      '<div class="py2-ads-body">' +
        '<div class="py2-ads-biz" title="' + esc(biz) + '">' + esc(biz) + '</div>' +
        '<div class="py2-ads-title">' + esc(ad.title || '') + '</div>' +
        (ad.description ? '<div class="py2-ads-desc">' + esc(ad.description) + '</div>' : '') +
        '<a class="py2-ads-cta" href="' + esc(cta.href) + '" target="_blank" rel="noopener">' +
          '<span><i class="' + cta.icon + '"></i> ' + esc(short) + '</span>' +
          '<span class="arrow"><i class="fa-solid fa-arrow-right"></i></span>' +
        '</a>' +
      '</div>';

    var reportBtn = card.querySelector('.py2-ads-report');
    if (reportBtn) reportBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      onReport(ad.id);
    });

    var ctaEl = card.querySelector('.py2-ads-cta');
    if (ctaEl) ctaEl.addEventListener('click', function (e) {
      e.stopPropagation();
      onClickCta(ad);
    });

    card.addEventListener('click', function () {
      onCardClick(ad);
    });

    return card;
  }

  // Expose for the shop pages.
  window.py2AdsCard = {
    build:           py2BuildAdCard,
    tierFromAd:      py2TierFromAd,
    tierRank:        py2TierRank,
    sortByTier:      py2SortByTier,
    frontloadByTier: py2FrontloadByTier,
    TIER_RANK:       TIER_RANK,
    TIER_LABEL:      TIER_LABEL
  };
})();
