/* PhoneYa2 dashboard-specific PWA installation.
 * Each workspace gets its own launch URL and install identity while sharing
 * the same secure backend. Sensitive dashboard data is never cached here.
 */
(function () {
  'use strict';
  var config = window.PHONEYA2_PWA_CONFIG || {};
  if (!config.id || !config.startUrl || !config.scope) return;

  var key = 'py2-dashboard-installed-v3:' + config.id;
  var deferredPrompt = null;
  var banner = null;
  var help = null;
  var button = null;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  var standalone = function () {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      navigator.standalone === true;
  };
  // A generic standalone window may be the main PhoneYa2 store app.
  // Only treat standalone mode as installed when this dashboard's own
  // manifest start URL launched it (or its appinstalled event fired).
  var launchedAsThisApp = function () {
    return standalone() && new URLSearchParams(window.location.search).get('source') === 'installed';
  };
  var installed = function () {
    if (launchedAsThisApp()) {
      try { localStorage.setItem(key, '1'); } catch (e) {}
      return true;
    }
    try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
  };
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
    if (banner) banner.remove();
    banner = null;
  };
  var show = function () {
    if (!window.PHONEYA2_PWA_AUTHENTICATED || installed() || banner) return;
    banner = document.createElement('div');
    banner.id = 'py2-dashboard-install-overlay';
    banner.innerHTML =
      '<section id="py2-dashboard-install" role="dialog" aria-modal="true" aria-labelledby="py2-pwa-title">' +
      '<div class="py2-pwa-icon" aria-hidden="true">↓</div>' +
      '<div class="py2-pwa-copy"><strong id="py2-pwa-title">Install ' + escapeHtml(config.shortName || config.name || 'PhoneYa2') + '</strong>' +
      '<span>Install this dashboard as an app for quick, direct access from your home screen.</span>' +
      '<small class="py2-pwa-help" aria-live="polite" hidden></small></div>' +
      '<button type="button" class="py2-pwa-button">Install app</button></section>';
    document.body.appendChild(banner);
    button = banner.querySelector('button');
    help = banner.querySelector('.py2-pwa-help');
    button.addEventListener('click', async function () {
      if (deferredPrompt) {
        button.disabled = true;
        button.textContent = 'Opening…';
        deferredPrompt.prompt();
        var promptEvent = deferredPrompt;
        var choice = await promptEvent.userChoice.catch(function () { return { outcome: 'dismissed' }; });
        deferredPrompt = null;
        if (choice && choice.outcome === 'accepted') {
          help.textContent = 'Finish installing in your browser. This message will close automatically once installation is complete.';
        } else {
          help.textContent = 'Installation was not completed. You can try again or use your browser menu to install this app.';
        }
        help.hidden = false;
        button.disabled = false;
        button.textContent = 'Try install again';
        return;
      }
      if (isIOS && isSafari) {
        help.textContent = 'To install: tap the Share button in Safari, choose “Add to Home Screen”, then tap Add. Return here after adding the app.';
      } else {
        help.textContent = 'Open your browser menu (⋮ or Share) and choose “Install app” or “Add to Home screen”. Return here after installation.';
      }
      help.hidden = false;
      button.textContent = 'Installation instructions';
    });
  };
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
    '.py2-pwa-button{width:100%;border:0;border-radius:12px;padding:14px 18px;background:#f15b24;color:#fff;font-size:14px;font-weight:900;cursor:pointer}.py2-pwa-button:disabled{opacity:.65;cursor:wait}' +
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
    try { localStorage.setItem(key, '1'); } catch (e) {}
    deferredPrompt = null;
    hide();
    return true;
  };
  window.addEventListener('appinstalled', function () {
    try { localStorage.setItem(key, '1'); } catch (e) {}
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