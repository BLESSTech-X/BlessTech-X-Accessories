/* PhoneYa2 dashboard-specific PWA installation.
 * Each workspace gets its own launch URL and install identity while sharing
 * the same secure backend. Sensitive dashboard data is never cached here.
 */
(function () {
  'use strict';
  var config = window.PHONEYA2_PWA_CONFIG || {};
  if (!config.id || !config.startUrl || !config.scope) return;

  var deferredPrompt = null;
  var installButton = null;
  var help = null;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  var standalone = function () {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      navigator.standalone === true;
  };
  var launchedAsThisApp = function () {
    return standalone() && new URLSearchParams(window.location.search).get('source') === 'installed';
  };
  var installed = function () { return launchedAsThisApp(); };
  var manifestLink = document.querySelector('link[rel="manifest"]');
  var manifestUrl = function (icon) {
    var url = '/api/pwa-manifest?app=' + encodeURIComponent(config.id);
    if (icon) url += '&icon=' + encodeURIComponent(icon);
    return url;
  };
  var setIcon = function (icon) {
    if (manifestLink) manifestLink.href = manifestUrl(icon || '');
    var appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = icon || '/icon-512x512.jpg';
  };
  var hide = function () {
    if (installButton) installButton.remove();
    installButton = null;
  };
  var show = function () {
    if (!window.PHONEYA2_PWA_AUTHENTICATED || installed() || installButton) return;
    installButton = document.createElement('div');
    installButton.id = 'py2-pwa-install-control';
    installButton.innerHTML =
      '<button type="button" class="py2-pwa-install-button" aria-label="Install this dashboard as an app">↓ <span>Install</span></button>' +
      '<div class="py2-pwa-install-help" role="status" aria-live="polite" hidden></div>';
    document.body.appendChild(installButton);
    var button = installButton.querySelector('button');
    help = installButton.querySelector('.py2-pwa-install-help');
    button.addEventListener('click', async function () {
      if (deferredPrompt) {
        var promptEvent = deferredPrompt;
        deferredPrompt = null;
        button.disabled = true;
        button.textContent = 'Opening…';
        try {
          await promptEvent.prompt();
          var choice = await promptEvent.userChoice;
          if (choice && choice.outcome === 'accepted') {
            button.textContent = 'Installing…';
            help.textContent = 'Finish the confirmation from your browser.';
            help.hidden = false;
          } else {
            button.disabled = false;
            button.innerHTML = '↓ <span>Install</span>';
          }
        } catch (error) {
          button.disabled = false;
          button.innerHTML = '↓ <span>Install</span>';
          showManualHelp();
        }
        return;
      }
      showManualHelp();
    });
  };
  var showManualHelp = function () {
    if (!help) return;
    if (isIOS && isSafari) {
      help.textContent = 'Safari: tap Share, choose “Add to Home Screen”, then tap Add.';
    } else if (/android/i.test(navigator.userAgent)) {
      help.textContent = 'Chrome on Android: tap ⋮, choose “Install app” or “Add to Home screen”, then confirm.';
    } else {
      help.textContent = 'Chrome on computer: select ⋮, choose “Cast, save and share” → “Install page as app” (or “Install app”), then confirm.';
    }
    help.hidden = false;
  };
  var style = document.createElement('style');
  style.textContent =
    '#py2-pwa-install-control{position:fixed;right:16px;bottom:calc(88px + env(safe-area-inset-bottom));z-index:9998;display:grid;justify-items:end;gap:8px;max-width:min(300px,calc(100vw - 24px));font:inherit}' +
    '.py2-pwa-install-button{display:inline-flex;align-items:center;gap:7px;border:1px solid #ff9a52;border-radius:999px;padding:9px 15px;background:linear-gradient(120deg,#ff7a18 0%,#f04438 52%,#c026d3 100%);color:#fff;box-shadow:0 5px 16px #e94b3745,0 2px 5px #17203318;font:850 12px system-ui,-apple-system,sans-serif;letter-spacing:.15px;cursor:pointer}' +
    '.py2-pwa-install-button:hover:not(:disabled){filter:brightness(1.06);transform:translateY(-1px)}.py2-pwa-install-button:disabled{opacity:.7;cursor:wait}' +
    '.py2-pwa-install-help{max-width:280px;padding:10px 12px;border:1px solid #dbe5f0;border-radius:11px;background:#fff;color:#344054;box-shadow:0 5px 20px #17203318;font:12px/1.5 system-ui,-apple-system,sans-serif}' +
    '.py2-pwa-install-help[hidden]{display:none}' +
    '@media(max-width:650px){#py2-pwa-install-control{right:12px;bottom:calc(78px + env(safe-area-inset-bottom))}}';
  document.head.appendChild(style);

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  var style = document.createElement('style');
  style.textContent =
    '#py2-dashboard-install-overlay{position:fixed;inset:0;z-index:999999;display:grid;place-items:center;padding:20px;background:rgba(9,18,34,.66);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}' +
    '#py2-dashboard-install{width:min(100%,430px);display:grid;justify-items:center;gap:15px;padding:28px 24px;background:#fff;color:#172033;border:1px solid #e2e8f0;border-radius:22px;box-shadow:0 24px 80px rgba(0,0,0,.3);font:inherit;text-align:center}' +
    '.py2-pwa-icon{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;background:#fff0e7;color:#f05b22;font-size:31px;font-weight:900}' +
    '.py2-pwa-copy{min-width:0;display:grid;gap:8px}.py2-pwa-copy strong{font-size:19px;font-weight:900}.py2-pwa-copy span{font-size:13px;line-height:1.55;color:#667085}.py2-pwa-help{font-size:12px;line-height:1.55;color:#344054;margin-top:5px}' +
    '.py2-pwa-actions{width:100%;display:grid;gap:9px}.py2-pwa-button,.py2-pwa-chrome{width:100%;border:0;border-radius:12px;padding:14px 18px;font-size:14px;font-weight:900;cursor:pointer}.py2-pwa-button{background:#f15b24;color:#fff}.py2-pwa-chrome{background:#172033;color:#fff}.py2-pwa-button:disabled{opacity:.65;cursor:wait}.py2-pwa-chrome[hidden]{display:none}' +
    '@media(max-width:420px){#py2-dashboard-install{padding:24px 19px;border-radius:19px}}';
  document.head.appendChild(style);

  if (manifestLink) setIcon(window.PHONEYA2_PWA_PROFILE_ICON || '');
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/pwa-dashboard-sw.js', {
        scope: config.scope,
        updateViaCache: 'none'
      }).catch(function (error) {
        console.warn('[PhoneYa2 dashboard PWA] Service worker registration failed.', error);
      });
    }, { once: true });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    if (window.PHONEYA2_PWA_AUTHENTICATED) show();
  });
  var confirmInstalled = function () {
    if (!launchedAsThisApp()) return false;
    deferredPrompt = null;
    hide();
    return true;
  };
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    hide();
  });
  window.addEventListener('focus', confirmInstalled);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) confirmInstalled();
  });
  window.addEventListener('phoneya2:pwa-ready', function (event) {
    window.PHONEYA2_PWA_AUTHENTICATED = true;
    var icon = event && event.detail && event.detail.icon;
    if (icon) window.PHONEYA2_PWA_PROFILE_ICON = icon;
    setIcon(window.PHONEYA2_PWA_PROFILE_ICON || '');
    if (!installed()) show();
  });
  window.addEventListener('phoneya2:pwa-logout', function () {
    window.PHONEYA2_PWA_AUTHENTICATED = false;
    hide();
  });

  if (window.PHONEYA2_PWA_AUTHENTICATED) {
    setIcon(window.PHONEYA2_PWA_PROFILE_ICON || '');
    if (!installed()) show();
  }
})();