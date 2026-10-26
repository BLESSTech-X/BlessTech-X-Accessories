/* PhoneYa2 native PWA installation — no third-party install SDK. */
(function () {
  'use strict';

  var deferredPrompt = null;
  var STORAGE_KEY = 'py2-pwa-install-dismissed-v1';
  var isStandalone = function () {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.navigator.standalone === true;
  };
  // Load the shared navigation enhancement even when the site is already installed.
  var navScript = document.createElement('script');
  navScript.src = '/navigation-boost.js?v=20261026-instant-nav1';
  navScript.defer = true;
  document.head.appendChild(navScript);

  if (isStandalone()) return;

  // Register the site's own service worker. Registration is safe to repeat:
  // the browser reuses the existing registration for the same scope.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .catch(function (error) { console.warn('[PhoneYa2 PWA] Service worker registration failed.', error); });
    }, { once: true });
  }

  var style = document.createElement('style');
  style.textContent = [
    '#py2-install-card{position:fixed;z-index:9998;left:14px;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));max-width:520px;margin:0 auto;display:none;align-items:center;gap:12px;padding:13px 14px;background:#fff;border:1px solid #e6eaf0;border-radius:18px;box-shadow:0 14px 42px rgba(15,23,42,.2);font-family:inherit;color:#172033}',
    '#py2-install-card.py2-visible{display:flex;animation:py2InstallIn .22s ease-out}',
    '#py2-install-icon{width:46px;height:46px;flex:0 0 46px;border-radius:12px;object-fit:cover;background:#f3f4f6}',
    '#py2-install-copy{min-width:0;flex:1}',
    '#py2-install-copy strong{display:block;font-size:14px;line-height:1.25;font-weight:800}',
    '#py2-install-copy span{display:block;margin-top:3px;color:#667085;font-size:11px;line-height:1.4}',
    '#py2-install-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}',
    "#py2-install-now{border:0;border-radius:10px;background:#ff6000;color:#fff;font:700 12px 'DM Sans',sans-serif;padding:10px 12px;min-height:38px;cursor:pointer}",
    '#py2-install-close{width:30px;height:30px;border:0;border-radius:50%;background:#f2f4f7;color:#475467;font-size:19px;line-height:1;cursor:pointer}',
    '#py2-install-help{display:none;margin:8px 0 0;color:#475467;font-size:11px;line-height:1.45}',
    '@keyframes py2InstallIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',
    '@media(prefers-reduced-motion:reduce){#py2-install-card.py2-visible{animation:none}}',
    '@media(max-width:380px){#py2-install-card{left:8px;right:8px;padding:10px;gap:8px}#py2-install-icon{width:38px;height:38px;flex-basis:38px}#py2-install-copy strong{font-size:12px}#py2-install-copy span{font-size:10px}#py2-install-now{padding:9px 10px}}'
  ].join('\n');
  document.head.appendChild(style);

  var card = document.createElement('aside');
  card.id = 'py2-install-card';
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', 'Install PhoneYa2');
  card.innerHTML =
    '<img id="py2-install-icon" src="/icon-512x512.jpg" alt="" width="46" height="46">' +
    '<div id="py2-install-copy"><strong>Get PhoneYa2 on your phone</strong>' +
    '<span>Install for quicker access to shopping and orders.</span><div id="py2-install-help"></div></div>' +
    '<div id="py2-install-actions"><button id="py2-install-now" type="button">Install</button>' +
    '<button id="py2-install-close" type="button" aria-label="Dismiss install suggestion">×</button></div>';
  document.body.appendChild(card);

  var installButton = card.querySelector('#py2-install-now');
  var closeButton = card.querySelector('#py2-install-close');
  var help = card.querySelector('#py2-install-help');
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios|chrome|android/i.test(navigator.userAgent);

  function dismissed() {
    try { return sessionStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }
  function show() {
    if (!isStandalone && !dismissed()) card.classList.add('py2-visible');
  }
  function hide() { card.classList.remove('py2-visible'); }
  function dismiss() {
    hide();
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    installButton.textContent = 'Install';
    help.style.display = 'none';
    window.setTimeout(show, 1800);
  });

  installButton.addEventListener('click', async function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        var result = await deferredPrompt.userChoice;
        if (result && result.outcome === 'accepted') hide();
      } catch (e) {}
      deferredPrompt = null;
      return;
    }

    // iOS Safari doesn't expose beforeinstallprompt; guide the user through
    // the browser's native Share -> Add to Home Screen flow.
    if (isIOS && isSafari) {
      help.textContent = 'In Safari, tap Share (the square with an arrow), then choose “Add to Home Screen”.';
      help.style.display = 'block';
      installButton.textContent = 'How to install';
      show();
      return;
    }

    help.textContent = 'Open your browser menu (⋮ or Share) and choose “Install app” or “Add to Home screen” if available.';
    help.style.display = 'block';
    installButton.textContent = 'How to install';
    show();
  });

  closeButton.addEventListener('click', dismiss);
  window.addEventListener('appinstalled', function () {
    hide();
    deferredPrompt = null;
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
  });

  // Don't interrupt immediately; show a small, dismissible prompt only after
  // the visitor has had a moment to browse.
  window.addEventListener('load', function () {
    if (dismissed()) return;
    if (isIOS && isSafari) window.setTimeout(show, 6500);
  }, { once: true });
})();
