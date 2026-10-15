(function () {
  'use strict';
  if (window.__py2InterestPopupsLoaded) return;
  window.__py2InterestPopupsLoaded = true;

  var STORAGE_KEY = 'py2_product_interest_v1';
  var SESSION_COUNT_KEY = 'py2_interest_popup_count_v1';
  var DISMISSED_KEY = 'py2_interest_popup_snooze_v1';
  var MAX_POPUPS_PER_SESSION = 4;
  var catalog = [];
  var currentSlug = new URLSearchParams(location.search).get('id') || '';
  var pagePath = location.pathname.toLowerCase();
  var isProductPage = /product\.html$/.test(pagePath);
  var popup = null;
  var timer = null;
  var visible = false;
  var startAt = Date.now();
  var backdrop = null;

  function safeRead(key, fallback) {
    try { var value = JSON.parse(localStorage.getItem(key) || 'null'); return value == null ? fallback : value; }
    catch (_) { return fallback; }
  }
  function safeWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function escapeText(value) { return String(value == null ? '' : value); }
  function getInterests() {
    var list = safeRead(STORAGE_KEY, []);
    return Array.isArray(list) ? list.filter(function (x) { return x && x.slug; }) : [];
  }
  function rememberProduct(slug, seconds, action) {
    if (!slug) return;
    var p = catalog.find(function (item) { return item.slug === slug; });
    if (!p || !(Number(p.price) > 0) || Number(p.stock) <= 0) return;
    var list = getInterests();
    var entry = list.find(function (x) { return x.slug === slug; });
    if (!entry) {
      entry = { slug: p.slug, score: 0, firstSeen: Date.now(), lastSeen: Date.now(), seconds: 0, action: '' };
      list.unshift(entry);
    }
    entry.score = Math.min(20, Number(entry.score || 0) + (action === 'click' ? 3 : action === 'view' ? 2 : 1));
    entry.seconds = Math.min(600, Number(entry.seconds || 0) + Math.max(0, Number(seconds || 0)));
    entry.lastSeen = Date.now();
    entry.action = action || entry.action || 'view';
    list.sort(function (a, b) { return Number(b.score || 0) - Number(a.score || 0) || Number(b.lastSeen || 0) - Number(a.lastSeen || 0); });
    safeWrite(STORAGE_KEY, list.slice(0, 12));
  }
  function getEligibleProducts() {
    var interests = getInterests();
    var now = Date.now();
    return interests.map(function (interest) {
      var product = catalog.find(function (p) { return p.slug === interest.slug; });
      if (!product || Number(product.stock) <= 0 || !(Number(product.price) > 0)) return null;
      if (now - Number(interest.lastSeen || 0) > 30 * 86400000) return null;
      return { product: product, interest: interest };
    }).filter(Boolean);
  }
  function chooseProduct() {
    var options = getEligibleProducts();
    if (!options.length) return null;
    var different = options.filter(function (x) { return x.product.slug !== currentSlug; });
    var pool = different.length ? different : options;
    var weights = pool.map(function (x) { return Math.max(1, Number(x.interest.score || 1)); });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var roll = Math.random() * total;
    for (var i = 0; i < pool.length; i++) { roll -= weights[i]; if (roll <= 0) return pool[i].product; }
    return pool[0].product;
  }
  function addStyles() {
    if (document.getElementById('py2-interest-popup-styles')) return;
    var style = document.createElement('style');
    style.id = 'py2-interest-popup-styles';
    style.textContent = `
      @keyframes py2InterestIn{from{opacity:0;transform:translate(-50%,-46%) scale(.97)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      @keyframes py2InterestGlow{0%,100%{box-shadow:0 10px 30px rgba(17,24,39,.18),0 0 0 1px rgba(85,151,255,.22),0 0 18px rgba(85,151,255,.14)}50%{box-shadow:0 12px 34px rgba(17,24,39,.22),0 0 0 1px rgba(255,111,145,.42),0 0 25px rgba(97,110,255,.3)}}
      html.py2-interest-open,html.py2-interest-open body{overflow:hidden!important}.py2-interest-backdrop{position:fixed;inset:0;z-index:10018;background:rgba(12,22,42,.30);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}.py2-interest-backdrop[hidden]{display:none!important}.py2-interest-popup{position:fixed;left:50%;top:50%;right:auto;bottom:auto;transform:translate(-50%,-50%);z-index:10020;width:min(360px,calc(100vw - 24px));display:grid;grid-template-columns:66px minmax(0,1fr) 26px;gap:11px;align-items:center;padding:12px;border:1px solid rgba(113,157,255,.55);border-radius:17px;background:linear-gradient(135deg,rgba(255,255,255,.98),rgba(243,247,255,.98));color:#172033;font:500 13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;animation:py2InterestIn .32s ease-out,py2InterestGlow 3.8s ease-in-out .4s infinite;backdrop-filter:blur(12px);box-shadow:0 20px 60px rgba(12,22,42,.28)}
      .py2-interest-popup[hidden]{display:none!important}.py2-interest-img{width:66px;height:66px;border-radius:12px;object-fit:contain;background:#fff;border:1px solid #e8edf7}
      .py2-interest-copy{min-width:0}.py2-interest-eyebrow{display:flex;align-items:center;gap:5px;color:#4d65cb;font-size:10px;font-weight:800;letter-spacing:.65px;text-transform:uppercase;margin-bottom:3px}.py2-interest-eyebrow:before{content:"";width:6px;height:6px;border-radius:50%;background:linear-gradient(135deg,#ff7e5f,#7765ff);box-shadow:0 0 8px #8b82ff}
      .py2-interest-title{font-weight:800;font-size:13px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:3px}.py2-interest-price{font-size:12px;font-weight:800;color:#111827;margin-bottom:7px}.py2-interest-cta{display:inline-flex;align-items:center;gap:5px;border:0;border-radius:9px;padding:7px 10px;background:linear-gradient(110deg,#5b63e8,#7b49ce 55%,#ec6096);color:#fff!important;text-decoration:none!important;font-weight:800;font-size:11px;box-shadow:0 4px 12px rgba(100,86,218,.25)}
      .py2-interest-close{align-self:start;border:0;background:#e9edf5;color:#667085;border-radius:50%;width:25px;height:25px;font-size:17px;line-height:1;cursor:pointer}.py2-interest-close:focus-visible,.py2-interest-cta:focus-visible{outline:2px solid #4f46e5;outline-offset:3px}
      @media(max-width:480px){.py2-interest-popup{left:50%;top:50%;right:auto;bottom:auto;transform:translate(-50%,-50%);width:min(324px,calc(100vw - 20px));grid-template-columns:58px minmax(0,1fr) 23px;gap:9px;padding:10px;border-radius:15px}.py2-interest-img{width:58px;height:58px}.py2-interest-close{width:23px;height:23px}}
      @media(prefers-reduced-motion:reduce){.py2-interest-popup{animation:none!important}}
    `;
    document.head.appendChild(style);
  }
  function buildPopup() {
    addStyles();
    backdrop = document.createElement('div');
    backdrop.className = 'py2-interest-backdrop';
    backdrop.hidden = true;
    backdrop.addEventListener('click', dismissPopup);
    document.body.appendChild(backdrop);
    popup = document.createElement('aside');
    popup.className = 'py2-interest-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-label', 'PhoneYa2 product recommendation');
    popup.hidden = true;
    var img = document.createElement('img');
    img.className = 'py2-interest-img';
    img.alt = '';
    img.loading = 'lazy';
    var copy = document.createElement('div');
    copy.className = 'py2-interest-copy';
    var eyebrow = document.createElement('div');
    eyebrow.className = 'py2-interest-eyebrow';
    eyebrow.textContent = 'Your PhoneYa2 pick';
    var title = document.createElement('div');
    title.className = 'py2-interest-title';
    var price = document.createElement('div');
    price.className = 'py2-interest-price';
    var cta = document.createElement('a');
    cta.className = 'py2-interest-cta';
    cta.textContent = 'Take another look ↗';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'py2-interest-close';
    close.setAttribute('aria-label', 'Dismiss product reminder');
    close.textContent = '×';
    close.addEventListener('click', function () {
      dismissPopup();
      try { sessionStorage.setItem(DISMISSED_KEY, String(Date.now() + 60000)); } catch (_) {}
      scheduleNext(60000 + Math.floor(Math.random() * 30000));
    });
    cta.addEventListener('click', function () {
      try { if (typeof gtag === 'function') gtag('event', 'interest_product_click', { product_slug: cta.dataset.slug || '', page_path: pagePath }); } catch (_) {}
    });
    copy.appendChild(eyebrow); copy.appendChild(title); copy.appendChild(price); copy.appendChild(cta);
    popup.appendChild(img); popup.appendChild(copy); popup.appendChild(close);
    document.body.appendChild(popup);
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && visible) dismissPopup(); });
    var add = document.createElement('button');
    add.type = 'button'; add.className = 'py2-interest-cta py2-interest-add'; add.textContent = 'Add to cart +';
    add.style.cssText = 'margin-left:5px;border:0;cursor:pointer;font:inherit;font-weight:800;';
    add.addEventListener('click', function () {
      var slug = popup._cta.dataset.slug || '';
      var item = catalog.find(function (p) { return p.slug === slug; });
      if (!item || Number(item.stock) <= 0) { add.textContent = 'Unavailable'; add.disabled = true; return; }
      var rows = []; try { rows = JSON.parse(localStorage.getItem('phoneya2-checkout-cart-v1') || '[]'); } catch (_) {}
      if (!Array.isArray(rows)) rows = [];
      var map = new Map(rows.filter(function (r) { return Array.isArray(r) && r[0]; }));
      var qty = Number(map.get(slug) || 0) + 1;
      if (qty > Number(item.stock)) { add.textContent = 'Stock limit reached'; return; }
      map.set(slug, qty);
      try { localStorage.setItem('phoneya2-checkout-cart-v1', JSON.stringify(Array.from(map.entries()))); } catch (_) { add.textContent = 'Could not save'; return; }
      window.dispatchEvent(new CustomEvent('phoneya2:cart-updated', { detail: { slug: slug, quantity: qty } }));
      try { if (typeof gtag === 'function') gtag('event', 'interest_product_add_to_cart', { product_slug: slug }); } catch (_) {}
      add.textContent = 'Added ✓'; add.disabled = true; dismissPopup();
    });
    copy.appendChild(add);
    popup._img = img; popup._title = title; popup._price = price; popup._cta = cta; popup._add = add;
  }
  function showPopup() {
    if (!popup || visible || document.visibilityState === 'hidden') return;
    if (window.__py2SellerNoticeOpen) { scheduleNext(12000 + Math.floor(Math.random() * 8000)); return; }
    var count = 0;
    try { count = Number(sessionStorage.getItem(SESSION_COUNT_KEY) || 0); } catch (_) {}
    if (count >= MAX_POPUPS_PER_SESSION) return;
    try { if (Number(sessionStorage.getItem(DISMISSED_KEY) || 0) > Date.now()) { scheduleNext(20000 + Math.floor(Math.random() * 20000)); return; } } catch (_) {}
    var product = chooseProduct();
    if (!product) return;
    popup._img.src = product.image || '/logo-wide.png';
    popup._img.alt = product.title || 'PhoneYa2 product';
    popup._img.onerror = function () { popup._img.src = '/logo-wide.png'; };
    popup._title.textContent = product.title || 'A product you viewed';
    popup._price.textContent = 'ZMW ' + Number(product.price).toLocaleString();
    popup._cta.href = '/product.html?id=' + encodeURIComponent(product.slug);
    popup._cta.dataset.slug = product.slug;
    if (window.__py2SellerNoticeOpen) { scheduleNext(12000 + Math.floor(Math.random() * 8000)); return; }
    popup.hidden = false;
    backdrop.hidden = false;
    document.documentElement.classList.add('py2-interest-open');
    window.__py2SellerModalOpen = true;
    visible = true;
    try { sessionStorage.setItem(SESSION_COUNT_KEY, String(count + 1)); } catch (_) {}

  }
  function dismissPopup() {
    if (popup) popup.hidden = true;
    if (backdrop) backdrop.hidden = true;
    visible = false;
    window.__py2SellerModalOpen = false;
    document.documentElement.classList.remove('py2-interest-open');
    try { sessionStorage.setItem(DISMISSED_KEY, String(Date.now() + 60000)); } catch (_) {}
  }
  function scheduleNext(delay) {
    window.clearTimeout(timer);
    timer = window.setTimeout(showPopup, delay);
  }
  function trackProductPage() {
    if (!isProductPage || !currentSlug) return;
    var started = Date.now();
    window.setTimeout(function () {
      if (document.visibilityState === 'visible') rememberProduct(currentSlug, Math.round((Date.now() - started) / 1000), 'view');
      if (popup && !visible) scheduleNext(9000 + Math.floor(Math.random() * 14000));
    }, 12000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        var seconds = Math.round((Date.now() - started) / 1000);
        if (seconds >= 5) rememberProduct(currentSlug, seconds, 'view');
      }
    });
  }
  function trackProductClicks() {
    function slugFrom(target) {
      if (!target || !target.closest) return '';
      var link = target.closest('a[href*="product.html?id="], [data-product-slug], [data-slug]');
      var slug = link ? (link.getAttribute('data-product-slug') || link.getAttribute('data-slug') || '') : '';
      if (link && !slug && link.href) { try { slug = new URL(link.href, location.href).searchParams.get('id') || ''; } catch (_) {} }
      if (!slug) {
        var card = target.closest('.pcard, .showcase-card, [data-slug], [data-product-slug]');
        if (card) {
          slug = card.getAttribute('data-slug') || card.getAttribute('data-product-slug') || '';
          if (!slug) {
            var titleNode = card.querySelector('.pcard-name, .showcase-title, [data-product-title]');
            var title = titleNode ? titleNode.textContent.trim().toLowerCase() : '';
            var match = title && catalog.find(function (p) { return String(p.title || '').trim().toLowerCase() === title; });
            if (match) slug = match.slug;
          }
        }
      }
      return slug;
    }
    document.addEventListener('click', function (event) {
      var target = event.target && event.target.closest ? event.target : null;
      if (!target) return;
      var slug = slugFrom(target);
      if (slug) rememberProduct(slug, 0, 'click');
      var addButton = target.closest('.py2-add-cart, #add, [data-action="add-to-cart"], .pcard-actions button');
      if (addButton && slug) rememberProduct(slug, 0, 'add');
    }, true);
    document.addEventListener('pointerover', function (event) {
      var card = event.target && event.target.closest ? event.target.closest('.pcard, .showcase-card, [data-slug], [data-product-slug]') : null;
      if (!card || card.contains(event.relatedTarget)) return;
      var slug = slugFrom(card);
      if (slug) rememberProduct(slug, 0, 'hover');
    }, { passive: true });
    document.addEventListener('input', function (event) {
      var input = event.target;
      if (!input || !input.matches('#main-search, input[type="search"], .shop-search input, [data-product-search]')) return;
      var query = String(input.value || '').trim().toLowerCase();
      if (query.length < 2) return;
      catalog.filter(function (p) { return String(p.title || '').toLowerCase().indexOf(query) >= 0; }).slice(0, 6)
        .forEach(function (p) { rememberProduct(p.slug, 0, 'search'); });
    });
    window.addEventListener('phoneya2:cart-updated', function (event) {
      var slug = event.detail && event.detail.slug;
      if (slug) rememberProduct(slug, 0, 'add');
    });
  }
  function boot() {
    fetch('/content/products/catalog.json?v=interest1', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('catalog unavailable');
      return r.json();
    }).then(function (data) {
      catalog = Array.isArray(data) ? data : [];
      if (!catalog.length) return;
      if (isProductPage) {
        var p = catalog.find(function (item) { return item.slug === currentSlug; });
        if (p) { /* Record after a short meaningful dwell, not on a quick accidental tap. */ }
      }
      trackProductClicks();
      trackProductPage();
      buildPopup();
      var interest = getEligibleProducts();
      if (interest.length) scheduleNext(17000 + Math.floor(Math.random() * 18000));
      window.addEventListener('pagehide', function () {
        if (isProductPage && currentSlug) {
          var seconds = Math.round((Date.now() - startAt) / 1000);
          if (seconds >= 5) rememberProduct(currentSlug, seconds, 'view');
        }
      });
    }).catch(function () { /* Keep storefront usable if recommendations cannot load. */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();