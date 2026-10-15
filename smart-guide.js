(function () {
  'use strict';
  if (window.__py2SmartGuideLoadedV4) return;
  window.__py2SmartGuideLoadedV4 = true;

  var path = location.pathname.toLowerCase();
  var isPost = path.indexOf('blog-post.html') >= 0;
  var isBlog = path.indexOf('blog.html') >= 0;
  var isProduct = path.indexOf('product.html') >= 0;
  var isShop = path.indexOf('shop.html') >= 0;
  var isCart = path.indexOf('cart.html') >= 0;
  var isCheckout = path.indexOf('checkout.html') >= 0;
  var isAdvertiser = path.indexOf('advertiser') >= 0 || path.indexOf('advertise') >= 0;
  var dismissKey = 'py2_smart_guide_dismissed_v4_' + path;
  var visible = false, timer = 0, box, titleEl, bodyEl, ctaEl;
  var lastActionTip = 0;

  function cartRows() {
    try {
      var rows = JSON.parse(localStorage.getItem('phoneya2-checkout-cart-v1') || '[]');
      return Array.isArray(rows) ? rows.filter(function (r) { return Array.isArray(r) && r[0] && Number(r[1]) > 0; }) : [];
    } catch (_) { return []; }
  }
  function pageTip() {
    if (isCheckout) return {title:'Let’s complete your order', body:'Add or check your products first, then enter your full name, email, WhatsApp number and delivery details. “Place order” submits a pending order; PhoneYa2 will contact you to confirm delivery and payment arrangements.', cta:'Start with your name', href:'#name', kind:'checkout'};
    if (isCart) {
      var hasItems = cartRows().length > 0;
      return hasItems
        ? {title:'Need help with your cart?', body:'Use + or − to change quantities, remove anything you no longer want, and check your total. When everything looks right, continue to checkout.', cta:'Continue to checkout', href:'/checkout.html', kind:'cart'}
        : {title:'Let’s find something for your cart', body:'Open the shop, choose a product, and press “Add to cart”. You can come back here to adjust quantities before checkout.', cta:'Browse products', href:'/shop.html', kind:'empty-cart'};
    }
    if (isProduct) return {title:'How to order this product', body:'Check the price, stock and compatibility. Choose your quantity, then tap “Add to cart” to keep shopping or “Buy now” to go straight to checkout.', cta:'View your cart', href:'/cart.html', kind:'product'};
    if (isShop) return {title:'Find it, then add it to your cart', body:'Search by product name or choose a category. Open a product to inspect its details, then use “Add to cart” or “Buy now”.', cta:'Browse products', href:'#products-grid', kind:'shop'};
    if (isBlog) return {title:'Turn a useful tip into your next choice', body:'Read a guide, browse the product picks, or open the shop to compare accessories. The menu button opens more PhoneYa2 pages.', cta:'See product picks', href:'#product-picks', kind:'blog'};
    if (isPost) return {title:'Want to take the next step?', body:'Use the related product links in this guide to check details and prices, or return to the blog for another practical tip.', cta:'Explore more stories', href:'/blog.html', kind:'article'};
    if (isAdvertiser) return {title:'Get your business ready to advertise', body:'Use a clear offer, an accurate description and a working contact method so people understand what you provide.', cta:'Open advertiser page', href:'/advertiser', kind:'advertiser'};
    return {title:'Need a hand with PhoneYa2?', body:'Browse the shop, check a product, add it to your cart, or visit Contact if you need help placing an order.', cta:'Explore the shop', href:'/shop.html', kind:'general'};
  }
  function build() {
    if (document.getElementById('py2-smart-guide-v4')) return;
    box = document.createElement('aside');
    box.id = 'py2-smart-guide-v4';
    box.className = 'py2-smart-guide';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'PhoneYa2 shopping assistant');
    box.hidden = true;
    var head = document.createElement('div'); head.className = 'py2-smart-guide-head';
    var mark = document.createElement('span'); mark.className = 'py2-smart-guide-mark'; mark.setAttribute('aria-hidden','true'); mark.textContent = '✦';
    titleEl = document.createElement('strong'); titleEl.className = 'py2-smart-guide-title';
    var close = document.createElement('button'); close.type='button'; close.className='py2-smart-guide-close'; close.setAttribute('aria-label','Dismiss tip'); close.textContent='×';
    head.appendChild(mark); head.appendChild(titleEl); head.appendChild(close);
    bodyEl = document.createElement('p');
    var actions = document.createElement('div'); actions.className='py2-smart-guide-actions';
    ctaEl = document.createElement('a'); ctaEl.className='py2-smart-guide-cta';
    var later = document.createElement('button'); later.type='button'; later.className='py2-smart-guide-later'; later.textContent='Not now';
    actions.appendChild(ctaEl); actions.appendChild(later);
    box.appendChild(head); box.appendChild(bodyEl); box.appendChild(actions);
    document.body.appendChild(box);
    function dismiss() {
      box.hidden = true; visible = false;
      try { localStorage.setItem(dismissKey, String(Date.now() + 20 * 60 * 1000)); } catch (_) {}
    }
    close.addEventListener('click', dismiss);
    later.addEventListener('click', dismiss);
    ctaEl.addEventListener('click', function (event) {
      var href = ctaEl.getAttribute('href') || '';
      if (href.charAt(0) === '#') {
        var target = document.querySelector(href);
        if (target) { event.preventDefault(); target.scrollIntoView({behavior:'smooth', block:'center'}); }
      }
      if (href === '#name') {
        event.preventDefault();
        var name = document.getElementById('name');
        if (name) { name.focus({preventScroll:false}); name.scrollIntoView({behavior:'smooth', block:'center'}); }
      }
      try { if (typeof gtag === 'function') gtag('event','smart_guide_action',{guide_type:ctaEl.dataset.kind || 'help',page_path:path}); } catch (_) {}
      if (!event.defaultPrevented && href.charAt(0) !== '#') { box.hidden = true; visible = false; }
    });
  }
  function show(tip, force) {
    if (!box || document.visibilityState === 'hidden') return;
    if (!force) {
      try { if (Number(localStorage.getItem(dismissKey) || 0) > Date.now()) return; } catch (_) {}
    }
    titleEl.textContent = tip.title;
    bodyEl.textContent = tip.body;
    ctaEl.textContent = tip.cta + ' ↗';
    ctaEl.href = tip.href;
    ctaEl.dataset.kind = tip.kind || 'help';
    box.hidden = false; visible = true;
  }
  function showInitial() {
    var tip = pageTip();
    show(tip, false);
  }
  function scheduleInitial() {
    window.clearTimeout(timer);
    timer = window.setTimeout(showInitial, 6500 + Math.floor(Math.random() * 4500));
  }
  function showActionHelp(tip) {
    var now = Date.now();
    if (now - lastActionTip < 25000) return;
    lastActionTip = now;
    window.clearTimeout(timer);
    window.setTimeout(function () { show(tip, true); }, 700);
  }

  function boot() {
    build();
    scheduleInitial();
    document.addEventListener('phoneya2:cart-updated', function () {
      var rows = cartRows();
      var tip = rows.length
        ? {title:'Your cart is updated', body:'Your items are saved on this device. Open the cart to adjust quantities or remove items, then continue to checkout when you’re ready.', cta:'Review your cart', href:'/cart.html', kind:'cart-updated'}
        : {title:'Your cart is empty now', body:'No problem—browse the shop and add any product you want to keep for later.', cta:'Browse products', href:'/shop.html', kind:'cart-empty'};
      showActionHelp(tip);
    });
    document.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('.py2-add-cart, #add') : null;
      if (!button) return;
      showActionHelp({title:'Added something? Here’s what next', body:'Your cart keeps the items you add. You can continue browsing, or open the cart to check quantities and the total before checkout.', cta:'Review your cart', href:'/cart.html', kind:'add-to-cart'});
    }, true);
    if (isCheckout) {
      var form = document.getElementById('order-form');
      if (form) form.addEventListener('invalid', function () {
        showActionHelp({title:'One or more details need attention', body:'Complete the required fields marked by your browser. Use a valid email, a reachable phone or WhatsApp number, and a delivery address or collection details.', cta:'Check customer details', href:'#name', kind:'checkout-validation'});
      }, true);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();