/* PhoneYa2 performance guard.
   Preserve native touch momentum; never animate or hijack the scroll position. */
(function () {
  'use strict';
  if (window.__py2PerformanceGuardLoaded) return;
  window.__py2PerformanceGuardLoaded = true;

  var root = document.documentElement;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Keep scrolling under browser control and reduce decorative GPU work only while the user scrolls.
  var style = document.createElement('style');
  style.setAttribute('data-py2-scroll-performance', 'true');
  style.textContent = [
    'html{scroll-behavior:auto!important;-webkit-overflow-scrolling:touch}',
    '@media (max-width:768px){body::before,body::after{animation:none!important;filter:none!important;will-change:auto!important}}',
    'html.py2-scrolling .adv-glow,html.py2-scrolling .orb,html.py2-scrolling .py2-page-logo-ambient,html.py2-scrolling .phoneya2-home-intro::before{opacity:0!important;animation:none!important;filter:none!important;box-shadow:none!important;transition:none!important}',
    '@media (prefers-reduced-motion:reduce){html,html *{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}'
  ].join('');
  (document.head || root).appendChild(style);

  if (reducedMotion) return;

  var scrollTimer = 0;
  var active = false;
  function onScroll() {
    if (!active) {
      active = true;
      root.classList.add('py2-scrolling');
    }
    window.clearTimeout(scrollTimer);
    // Restore decorative effects shortly after movement ends, not on every scroll event.
    scrollTimer = window.setTimeout(function () {
      root.classList.remove('py2-scrolling');
      active = false;
    }, 180);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pagehide', function () {
    window.clearTimeout(scrollTimer);
    root.classList.remove('py2-scrolling');
  }, { passive: true });
})();