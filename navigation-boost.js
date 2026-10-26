/* PhoneYa2 instant-navigation helper.
   Prefetches likely next pages, lets the service worker warm its navigation cache,
   and adds subtle cross-document transitions without replacing page-specific app logic. */
(function () {
  'use strict';
  if (window.__phoneya2NavigationBoost) return;
  window.__phoneya2NavigationBoost = true;

  var origin = window.location.origin;
  var prefetched = new Set();
  var ignoredPath = /^\/(?:admin|api)(?:\/|$)/i;
  var sensitivePath = /^\/(?:cart|checkout|account)\.html$/i;
  var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var saveData = !!(connection && connection.saveData);
  var slowNetwork = !!(connection && /^(slow-2g|2g)$/.test(connection.effectiveType || ''));
  var canWarm = !saveData && !slowNetwork;

  // Cross-document View Transitions are progressive enhancement; normal navigation remains the fallback.
  try {
    var style = document.createElement('style');
    style.textContent = '@view-transition{navigation:auto}::view-transition-old(root){animation:py2NavOut .12s ease both}::view-transition-new(root){animation:py2NavIn .18s ease both}@keyframes py2NavOut{to{opacity:.94}}@keyframes py2NavIn{from{opacity:.94}to{opacity:1}}@media(prefers-reduced-motion:reduce){::view-transition-old(root),::view-transition-new(root){animation:none!important}}';
    (document.head || document.documentElement).appendChild(style);
  } catch (_) {}

  function eligible(anchor) {
    if (!anchor || !anchor.href || anchor.hasAttribute('download') ||
        anchor.target && anchor.target !== '_self' ||
        anchor.relList && anchor.relList.contains('external')) return null;
    var url;
    try { url = new URL(anchor.href, location.href); } catch (_) { return null; }
    if (url.origin !== origin || !/^https?:$/.test(url.protocol) ||
        ignoredPath.test(url.pathname) || sensitivePath.test(url.pathname) ||
        url.pathname === location.pathname && url.search === location.search ||
        /\.(?:pdf|zip|png|jpe?g|gif|webp|svg|mp4|mp3|woff2?|ttf|css|js|json|xml)$/i.test(url.pathname)) return null;
    return url;
  }

  function warm(anchor) {
    if (!canWarm) return;
    var url = eligible(anchor);
    if (!url) return;
    var key = url.href;
    if (prefetched.has(key)) return;
    prefetched.add(key);
    // The custom header lets the service worker store the HTML for an instant next navigation.
    fetch(key, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'X-PhoneYa2-Prefetch': '1' }
    }).catch(function () { prefetched.delete(key); });
  }

  document.addEventListener('pointerover', function (event) {
    if (event.pointerType === 'touch') return;
    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (anchor) warm(anchor);
  }, { passive: true });
  document.addEventListener('focusin', function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (anchor) warm(anchor);
  }, { passive: true });
  document.addEventListener('touchstart', function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (anchor) warm(anchor);
  }, { passive: true, capture: true });
  document.addEventListener('pointerdown', function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (anchor) warm(anchor);
  }, { passive: true });

  // Warm only a few primary navigation destinations during idle time; avoid downloading the whole site.
  function warmPrimaryLinks() {
    if (!canWarm) return;
    var anchors = Array.from(document.querySelectorAll('.desk-nav a[href], .mob-nav-links a[href], .py2-quick-tabs a[href], .cat-nav a[href]'))
      .filter(function (anchor) { return !!eligible(anchor); })
      .slice(0, 4);
    anchors.forEach(function (anchor, index) {
      window.setTimeout(function () { warm(anchor); }, index * 350);
    });
  }
  if ('requestIdleCallback' in window) requestIdleCallback(warmPrimaryLinks, { timeout: 2200 });
  else window.setTimeout(warmPrimaryLinks, 1400);

  // Register on pages that don't already install the PWA worker.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }
})();