/* PhoneYa2 dashboard-specific PWA installation.
 * Each workspace gets its own launch URL and install identity while sharing
 * the same secure backend. Sensitive dashboard data is never cached here.
 */
(function () {
  'use strict';
  var config = window.PHONEYA2_PWA_CONFIG || {};
  if (!config.id || !config.startUrl || !config.scope) return;

  var key = 'py2-dashboard-installed:' + config.id;
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
  var installed = function () {
    if (standalone()) {
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
    banner = document.createElement('section');
    banner.id = 'py2-dashboard-install';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Install PhoneYa2 app');
    banner.innerHTML =
      '<div class="py2-pwa-icon" aria-hidden="true">↓</div>' +
      '<div class="py2-pwa-copy"><strong>Install ' + escapeHtml(config.shortName || config.name || 'PhoneYa2') + '</strong>' +
      '<span>Get direct access from your home screen.</span><small class="py2-pwa-help" hidden></small></div>' +
      '<button type="button" class="py2-pwa-button">Install app</button>';
    document.body.appendChild(banner);
    button = banner.querySelector('button');
    help = banner.querySelector('.py2-pwa-help');
    button.addEventListener('click', async function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        var choice = await deferredPrompt.userChoice.catch(function () { return { outcome: 'dismissed' }; });
        deferredPrompt = null;
        if (choice && choice.outcome === 'accepted') {
          try { localStorage.setItem(key, '1'); } catch (e) {}
          hide();
        }
        return;
      }
      if (isIOS && isSafari) {
        help.textContent = 'In Safari, tap Share, then choose “Add to Home Screen”, and tap Add.';
      } else {
        help.textContent = 'Open your browser menu (⋮ or Share) and choose “Install app” or “Add to Home screen”.';
      }
      help.hidden = false;
      button.textContent = 'Installation steps';
    });
  };
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  var style = document.createElement('style');
  style.textContent =
    '#py2-dashboard-install{position:fixed;z-index:99990;left:14px;right:14px;bottom:calc(86px + env(safe-area-inset-bottom));max-width:470px;margin:0 auto;display:flex;align-items:center;gap:11px;padding:12px 13px;background:#fff;color:#172033;border:1px solid #dfe5ee;border-radius:16px;box-shadow:0 12px 36px rgba(15,23,42,.2);font:inherit}' +
    '.py2-pwa-icon{width:42px;height:42px;flex:0 0 42px;border-radius:12px;display:grid;place-items:center;background:#fff0e7;color:#f05b22;font-size:24px;font-weight:900}' +
    '.py2-pwa-copy{min-width:0;flex:1;display:grid;gap:2px}.py2-pwa-copy strong{font-size:13px}.py2-pwa-copy span{font-size:11px;color:#667085}.py2-pwa-help{font-size:11px;color:#344054;line-height:1.45;margin-top:4px}' +
    '.py2-pwa-button{border:0;border-radius:10px;padding:10px 12px;background:#f15b24;color:#fff;font-size:12px;font-weight:900;white-space:nowrap;cursor:pointer}' +
    '@media(max-width:420px){#py2-dashboard-install{left:9px;right:9px;gap:8px;padding:10px}.py2-pwa-icon{width:36px;height:36px;flex-basis:36px}.py2-pwa-button{padding:9px;font-size:11px}}';
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
  window.addEventListener('appinstalled', function () {
    try { localStorage.setItem(key, '1'); } catch (e) {}
    deferredPrompt = null;
    hide();
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