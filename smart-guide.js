(function () {
  'use strict';
  if (window.__py2TinyGuideV4) return;
  window.__py2TinyGuideV4 = true;

  var path = location.pathname.toLowerCase();
  var isShop = /shop\.html$/.test(path);
  var isProduct = /product\.html$/.test(path);
  var isCart = /cart\.html$/.test(path);
  var isCheckout = /checkout\.html$/.test(path);
  var isBlog = /blog(?:-post)?\.html$/.test(path);
  var isAbout = /about\.html$/.test(path);
  var isContact = /contact\.html$/.test(path);
  var isAccount = /account\.html$/.test(path);
  var isAdvertiser = /advertiser(?:\.html)?\/?$/.test(path) || /\/advertise\/?$/.test(path);

  var visible = false;
  var modal = null;
  var backdrop = null;
  var titleNode = null;
  var copyNode = null;
  var closeButton = null;
  var lastFocus = null;
  var retryTimer = null;
  var closeKey = 'py2_tiny_guide_last_close_v4';

  function storageGet(key) {
    try { return sessionStorage.getItem(key); } catch (_) { return null; }
  }
  function storageSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (_) {}
  }
  function pageMessage() {
    if (isCheckout) return ['checkout', 'Finish your order with confidence', 'Check your contact number, delivery details, items and total before submitting. If something goes wrong, I’ll point you to the field that needs attention.'];
    if (isCart) return ['cart', 'Your cart, your choice', 'Adjust quantities, remove anything you no longer need, and check the total. Continue to checkout when everything looks right.'];
    if (isProduct) return ['product', 'Check the details before you choose', 'Review the photo, price, compatibility, stock and description. Add the item only when it suits your device and needs.'];
    if (isShop) return ['shop', 'Find the right accessory', 'Compare products and prices, then open a product to check its details before deciding.'];
    if (isBlog) return ['blog', 'Turn useful advice into a smart choice', 'Explore the guides at your own pace. When you need an accessory, compare options in the shop before deciding.'];
    if (isAbout) return ['about', 'Get to know PhoneYa2', 'Learn about PhoneYa2, explore the shop, or contact us if you need help with a product or order.'];
    if (isContact) return ['contact', 'Get help faster', 'Tell us the product name and your device model. For an order question, include its reference if you have it. Never share passwords or payment PINs.'];
    if (isAccount) return ['account', 'Your PhoneYa2 account', 'Use your account to access available account features and order history. Keep your password and one-time security codes private.'];
    if (isAdvertiser) return ['advertiser', 'Help customers discover your business', 'Use a clear business name, a specific offer and a reliable contact method so people understand what you provide.'];
    return ['home', 'Welcome to PhoneYa2', 'Explore products, compare the details and prices, then add an item to your cart when it is right for you.'];
  }

  function addStyles() {
    if (document.getElementById('py2-tiny-guide-v4-css')) return;
    var style = document.createElement('style');
    style.id = 'py2-tiny-guide-v4-css';
    style.textContent = [
      '@keyframes py2TinyGuideEnterV4{from{opacity:0;transform:translate(-50%,-48%) scale(.98)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}',
      '@keyframes py2TinyLogoGlowV4{0%,100%{filter:drop-shadow(0 0 2px #35d07f44)}50%{filter:drop-shadow(0 0 7px #35d07f99)}}',
      '.py2-guide-backdrop-v4{position:fixed;inset:0;z-index:10018;background:rgba(8,17,34,.34);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}',
      '.py2-guide-backdrop-v4[hidden],.py2-guide-card-v4[hidden]{display:none!important}',
      'html.py2-tiny-guide-open,html.py2-tiny-guide-open body{overflow:hidden!important;overscroll-behavior:none!important}',
      '.py2-guide-card-v4{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:10019;width:min(294px,calc(100vw - 28px));max-height:min(78vh,400px);overflow:auto;padding:12px;border:1px solid transparent;border-radius:16px;background:linear-gradient(145deg,#111b31,#172642) padding-box,linear-gradient(130deg,#25c56b,#50c9f3,#7775ff,#ffae4b) border-box;box-shadow:0 18px 46px rgba(2,8,23,.42),0 0 19px rgba(49,190,117,.2);color:#fff;font:500 12px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;animation:py2TinyGuideEnterV4 .22s ease-out both}',
      '.py2-guide-head-v4{display:flex;align-items:center;gap:8px;margin-bottom:9px}',
      '.py2-guide-logo-v4{width:36px;height:36px;flex:0 0 36px;display:grid;place-items:center;border-radius:11px;background:linear-gradient(135deg,#fff,#eaf5ff);border:1px solid rgba(255,255,255,.22);overflow:hidden;animation:py2TinyLogoGlowV4 2.8s ease-in-out infinite}',
      '.py2-guide-logo-v4 img{display:block;width:100%;height:100%;object-fit:contain;padding:3px}',
      '.py2-guide-brand-v4{flex:1;min-width:0}',
      '.py2-guide-brand-v4 strong{display:block;font-size:13px;line-height:1.2;font-weight:950;letter-spacing:.1px;color:#fff}',
      '.py2-guide-slogan-v4{display:block;margin-top:3px;color:rgba(218,229,245,.58);font-size:8px;font-weight:750;letter-spacing:.08px;line-height:1.25;white-space:normal}',
      '.py2-guide-slogan-v4 .heart{color:#55aaff;opacity:.9}',
      '.py2-guide-close-v4{width:27px;height:27px;flex:0 0 27px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:#080f1e;color:#fff;font-size:20px;line-height:1;cursor:pointer}',
      '.py2-guide-close-v4:hover{background:#000;color:#fff;border-color:rgba(255,255,255,.42)}',
      '.py2-guide-title-v4{font-size:13px;line-height:1.3;font-weight:950;color:#fff;margin:0 0 5px}',
      '.py2-guide-copy-v4{font-size:11.5px;line-height:1.55;color:#d7e1f0;margin:0;overflow-wrap:anywhere}',
      '.py2-guide-foot-v4{margin-top:9px;color:rgba(202,216,236,.52);font-size:8px;font-weight:750;letter-spacing:.2px}',
      '.py2-guide-close-v4:focus-visible{outline:2px solid #42d787;outline-offset:3px}',
      '@media(max-width:360px){.py2-guide-card-v4{width:calc(100vw - 22px);padding:11px}.py2-guide-copy-v4{font-size:11px}}',
      '@media(prefers-reduced-motion:reduce){.py2-guide-logo-v4,.py2-guide-card-v4{animation:none!important}}'
    ].join('');
    document.head.appendChild(style);
  }

  function close() {
    if (!visible) return;
    visible = false;
    modal.hidden = true;
    backdrop.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    backdrop.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('py2-tiny-guide-open');
    window.__py2SellerNoticeOpen = false;
    storageSet(closeKey, String(Date.now()));
    window.dispatchEvent(new CustomEvent('py2:notice-dismissed'));
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus({ preventScroll: true }); } catch (_) {}
    }
  }

  function build() {
    addStyles();
    backdrop = document.createElement('div');
    backdrop.className = 'py2-guide-backdrop-v4';
    backdrop.hidden = true;
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.addEventListener('click', close);

    modal = document.createElement('section');
    modal.className = 'py2-guide-card-v4';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('aria-label', 'PhoneYa2 quick guide');

    var head = document.createElement('div');
    head.className = 'py2-guide-head-v4';
    var logo = document.createElement('div');
    logo.className = 'py2-guide-logo-v4';
    var logoImage = document.createElement('img');
    logoImage.src = 'https://i.ibb.co/s9CG52wV/file-0000000059948211a0bdd52c4d236852-1.jpg';
    logoImage.alt = 'PhoneYa2';
    logoImage.loading = 'eager';
    logoImage.onerror = function () {
      logo.textContent = 'PY2';
      logo.style.color = '#172642';
      logo.style.fontSize = '11px';
      logo.style.fontWeight = '1000';
    };
    logo.appendChild(logoImage);

    var brand = document.createElement('div');
    brand.className = 'py2-guide-brand-v4';
    var name = document.createElement('strong');
    name.textContent = 'PhoneYa2';
    var slogan = document.createElement('span');
    slogan.className = 'py2-guide-slogan-v4';
    slogan.append(document.createTextNode('Smart CHOICES. Better CONNECTED '));
    var heart = document.createElement('span');
    heart.className = 'heart';
    heart.textContent = '💙';
    slogan.appendChild(heart);
    brand.append(name, slogan);

    closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'py2-guide-close-v4';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', 'Close quick guide');
    closeButton.title = 'Close';
    closeButton.addEventListener('click', close);
    head.append(logo, brand, closeButton);

    titleNode = document.createElement('h2');
    titleNode.className = 'py2-guide-title-v4';
    copyNode = document.createElement('p');
    copyNode.className = 'py2-guide-copy-v4';
    var foot = document.createElement('div');
    foot.className = 'py2-guide-foot-v4';
    foot.textContent = 'Here when you need a hand';
    modal.append(head, titleNode, copyNode, foot);
    document.body.append(backdrop, modal);
  }

  function show(title, copy, urgent) {
    if (window.__py2SellerModalOpen) {
      clearTimeout(retryTimer);
      retryTimer = window.setTimeout(function () { show(title, copy, urgent); }, 1400);
      return;
    }
    if (visible) {
      titleNode.textContent = title;
      copyNode.textContent = copy;
      return;
    }
    var message = pageMessage();
    if (!urgent && storageGet('py2_notice_seen_v4_' + message[0]) === '1') return;
    if (!urgent && Date.now() - Number(storageGet(closeKey) || 0) < 16000) return;
    if (!modal) build();

    lastFocus = document.activeElement;
    titleNode.textContent = title;
    copyNode.textContent = copy;
    backdrop.hidden = false;
    modal.hidden = false;
    backdrop.setAttribute('aria-hidden', 'false');
    modal.setAttribute('aria-hidden', 'false');
    visible = true;
    window.__py2SellerNoticeOpen = true;
    document.documentElement.classList.add('py2-tiny-guide-open');
    if (!urgent) storageSet('py2_notice_seen_v4_' + message[0], '1');
    window.requestAnimationFrame(function () {
      if (visible && closeButton) closeButton.focus({ preventScroll: true });
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && visible) {
      event.preventDefault();
      close();
    }
    if (event.key === 'Tab' && visible && modal) {
      var focusables = modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  });

  function watchCheckoutErrors() {
    if (!isCheckout) return;
    var lastErrorAt = 0;
    function inspect() {
      var node = document.querySelector('.notice.error,[role="alert"],.field-error,[data-error="true"]');
      if (!node || !node.textContent || !node.textContent.trim() || Date.now() - lastErrorAt < 12000) return;
      if (node.offsetParent === null && !node.getAttribute('role')) return;
      lastErrorAt = Date.now();
      var text = node.textContent.trim().replace(/\s+/g, ' ');
      show('Let’s fix that together', text.slice(0, 220) + (text.length > 220 ? '…' : ''), true);
    }
    new MutationObserver(inspect).observe(document.body, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['class', 'aria-invalid', 'hidden']
    });
    document.addEventListener('invalid', function (event) {
      if (Date.now() - lastErrorAt < 12000) return;
      lastErrorAt = Date.now();
      var field = event.target;
      var label = field && field.labels && field.labels.length
        ? field.labels[0].textContent.trim()
        : (field && field.name ? field.name.replace(/[-_]/g, ' ') : 'this field');
      show('One quick correction', 'Please check ' + label + '. Complete the required field or correct its format, then try submitting again.', true);
    }, true);
  }

  function boot() {
    var message = pageMessage();
    window.setTimeout(function () { show(message[1], message[2], false); }, 8500 + Math.floor(Math.random() * 4500));
    watchCheckoutErrors();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();