/* PhoneYa2 dashboard-specific PWA installation.
 * Each workspace gets its own launch URL and install identity while sharing
 * the same secure backend. Sensitive dashboard data is never cached here.
 */
(function () {
  'use strict';
  var config = window.PHONEYA2_PWA_CONFIG || {};
  if (!config.id || !config.startUrl || !config.scope) return;

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
  // Do not use a shared-origin localStorage install flag: installing the
  // main PhoneYa2 app must never suppress another dashboard's install popup.
  // A dashboard is considered installed only when launched standalone through
  // its own manifest start URL.
  var installed = function () {
    return launchedAsThisApp();
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
      '<div class="py2-pwa-actions"><button type="button" class="py2-pwa-button">Install app</button><button type="button" class="py2-pwa-chrome" hidden>Open in Chrome</button></div></section>';
    document.body.appendChild(banner);
    button = banner.querySelector('.py2-pwa-button');
    var chromeButton = banner.querySelector('.py2-pwa-chrome');
    help = banner.querySelector('.py2-pwa-help');
    chromeButton.addEventListener('click', function () {
      var target = window.location.href;
      var hostPath = window.location.host + window.location.pathname + window.location.search + window.location.hash;
      if (/android/i.test(navigator.userAgent)) {
        var fallback = encodeURIComponent(target);
        window.location.href = 'intent://' + hostPath + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + fallback + ';end';
      } else if (isIOS) {
        window.location.href = 'googlechromes://' + window.location.host + window.location.pathname + window.location.search + window.location.hash;
        window.setTimeout(function () { help.textContent = 'If Chrome did not open, install/open Chrome manually and paste this dashboard address: ' + target; }, 900);
      } else {
        // From an installed desktop PWA, a user-initiated new-tab window
        // leaves the app window and opens the URL in Chrome's normal browser.
        var opened = window.open(target, '_blank', 'noopener');
        if (!opened) {
          help.textContent = 'Your browser blocked the new tab. Allow pop-ups for this site, then press Open in Chrome again. You can also copy this address into a Chrome tab: ' + target;
        }
      }
    });
    button.addEventListener('click', async function () {
      if (deferredPrompt) {
        button.disabled = true;
        button.textContent = 'Opening…';
        deferredPrompt.prompt();
        var promptEvent = deferredPrompt;
        var choice = await promptEvent.userChoice.catch(function () { return { outcome: 'dismissed' }; });
        deferredPrompt = null;
        if (choice && choice.outcome === 'accepted') {
          help.textContent = 'Installation started. Complete the browser prompt; this window will close when the app is installed.';
          help.hidden = false;
          button.textContent = 'Installing…';
          button.disabled = true;
        } else {
          help.textContent = 'The installation prompt was closed. Press Install app to try again.';
          help.hidden = false;
          button.disabled = false;
          button.textContent = 'Install app';
        }
        return;
      }

      if (isIOS && isSafari) {
        help.textContent = 'In Safari, tap Share, then “Add to Home Screen”, and tap Add.';
      } else if (standalone()) {
        help.textContent = 'To install separately: open this dashboard in Chrome, tap ⋮, then “Install app”.';
      } else {
        help.textContent = 'Tap your browser menu (⋮), then choose “Install app” or “Add to Home screen”.';
      }
      help.hidden = false;
      chromeButton.hidden = false;
      button.textContent = 'Install instructions';
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