(()=>{'use strict';
// Register the shared service worker on every storefront page, not just product.html.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Navigation remains fully functional if offline caching is unavailable.
  });
}

// Warm same-origin HTML pages after a short hover intent so the first click feels faster.
const py2Prefetched = new Set();
function py2PrefetchLink(link) {
  if (!link || link.target && link.target !== '_self' || link.hasAttribute('download')) return;
  let target;
  try { target = new URL(link.href, location.href); } catch (_) { return; }
  if (target.origin !== location.origin || target.pathname.startsWith('/admin')) return;
  if (!(target.pathname === '/' || target.pathname.endsWith('.html'))) return;
  if (target.href === location.href || py2Prefetched.has(target.href)) return;
  py2Prefetched.add(target.href);
  fetch(target.href, {
    credentials: 'same-origin',
    headers: { 'X-PhoneYa2-Prefetch': '1' }
  }).catch(() => { /* Normal navigation remains the fallback. */ });
}
document.addEventListener('pointerover', event => {
  if (event.pointerType !== 'mouse') return;
  const link = event.target.closest && event.target.closest('a[href]');
  if (link) setTimeout(() => {
    if (link.matches(':hover')) py2PrefetchLink(link);
  }, 140);
}, { passive: true });
document.addEventListener('touchstart', event => {
  const link = event.target.closest && event.target.closest('a[href]');
  if (link) py2PrefetchLink(link);
}, { passive: true });

// Normalize open/close behavior across all page-specific drawer variants.
const menuRoots = () => Array.from(document.querySelectorAll(
  'body > .mob-nav, body > #mob-nav, body > .mobile-nav, body > #mobile-nav, body > .py2-header-drawer'
));
const syncMenuLock = () => {
  const isOpen = menuRoots().some(menu => menu.classList.contains('open'));
  body.classList.toggle('py2-menu-open', isOpen);
};
const closeMenuRoot = menu => {
  if (!menu) return;
  menu.classList.remove('open');
  syncMenuLock();
  const trigger = document.getElementById('hamburger');
  if (trigger) {
    trigger.setAttribute('aria-expanded', 'false');
    const icon = trigger.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-bars';
  }
};
document.addEventListener('click', event => {
  const menu = event.target.closest && event.target.closest(
    'body > .mob-nav, body > #mob-nav, body > .mobile-nav, body > #mobile-nav, body > .py2-header-drawer'
  );
  if (menu && event.target === menu) closeMenuRoot(menu);
  const closeButton = event.target.closest && event.target.closest(
    '.mob-nav-close, .mobile-nav-close, .py2-header-drawer-close, [data-menu-close]'
  );
  if (closeButton) closeMenuRoot(closeButton.closest(
    '.mob-nav, #mob-nav, .mobile-nav, #mobile-nav, .py2-header-drawer'
  ));
}, true);
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const opened = menuRoots().filter(menu => menu.classList.contains('open'));
  opened.forEach(closeMenuRoot);
});
const menuObserver = new MutationObserver(syncMenuLock);
menuRoots().forEach(menu => menuObserver.observe(menu, { attributes: true, attributeFilter: ['class'] }));
syncMenuLock();

const btn=document.getElementById('hamburger');
const root=document.documentElement,body=document.body;
const header=document.querySelector('body>.top-header');
const tabs=document.querySelector('body>nav.py2-quick-tabs');
const cats=document.querySelector('body>.cat-nav');
let measureFrame=0;
const measure=()=>{
 cancelAnimationFrame(measureFrame);
 measureFrame=requestAnimationFrame(()=>{
  const hh=header?Math.ceil(header.getBoundingClientRect().height):72;
  const th=tabs?Math.ceil(tabs.getBoundingClientRect().height):44;
  root.style.setProperty('--py2-header-height',hh+'px');
  root.style.setProperty('--py2-tabs-height',th+'px');
  body.style.setProperty('padding-top',(hh+th)+'px','important');
  if(cats)cats.style.setProperty('top',(hh+th)+'px','important');
 });
};
measure();
window.addEventListener('resize',measure,{passive:true});
window.addEventListener('load',measure,{once:true});
if('ResizeObserver'in window){const ro=new ResizeObserver(measure);if(header)ro.observe(header);if(tabs)ro.observe(tabs);}
if(!btn)return;
let drawer=document.getElementById('mob-nav')||document.getElementById('mobile-nav');
if(drawer){btn.setAttribute('aria-controls',drawer.id);return;}
drawer=document.createElement('div');drawer.className='py2-header-drawer';drawer.id='py2-header-drawer';drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-label','PhoneYa2 navigation');
drawer.innerHTML='<div class="py2-header-drawer-panel"><div class="py2-header-drawer-head"><strong>PhoneYa2 <span style="color:#159447">Accessories</span></strong><button type="button" class="py2-header-drawer-close" aria-label="Close menu">×</button></div><nav class="py2-header-drawer-links"><a href="/"><i class="fa-solid fa-house"></i> Home</a><a href="/shop.html"><i class="fa-solid fa-store"></i> Shop</a><a href="/account.html"><i class="fa-solid fa-user"></i> Account</a><a href="/about.html"><i class="fa-solid fa-circle-info"></i> About</a><a href="/contact.html"><i class="fa-solid fa-headset"></i> Contact</a><a href="/cart.html"><i class="fa-solid fa-cart-shopping"></i> Cart</a><a href="/blog.html"><i class="fa-solid fa-book-open"></i> Blog</a><a href="/return-policy.html"><i class="fa-solid fa-rotate-left"></i> Returns policy</a></nav><a class="py2-header-drawer-order" href="https://wa.me/260979603741?text=Hi%21%20I%20want%20to%20order%20from%20PhoneYa2." target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Order on WhatsApp</a></div>';
document.body.appendChild(drawer);
const close=()=>{drawer.classList.remove('open');btn.setAttribute('aria-expanded','false');btn.querySelector('i')?.classList.remove('fa-xmark');btn.querySelector('i')?.classList.add('fa-bars');};
btn.setAttribute('aria-controls',drawer.id);
btn.addEventListener('click',()=>{const open=drawer.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));const icon=btn.querySelector('i');if(icon)icon.className=open?'fa-solid fa-xmark':'fa-solid fa-bars';});
drawer.querySelector('.py2-header-drawer-close')?.addEventListener('click',close);
drawer.addEventListener('click',e=>{if(e.target===drawer)close();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
})();