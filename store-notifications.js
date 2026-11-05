/* PhoneYa2 homepage notification centre + contextual update popups. */
(function(){
 "use strict";
 if(window.__py2StoreNotificationsV2)return;
 window.__py2StoreNotificationsV2=true;
 const READ_KEY="py2_store_notification_read_v2";
 const DISMISSED_KEY="py2_store_notification_dismissed_v1";
 const POPUP_SEEN_KEY="py2_store_notification_popup_seen_v2";
 const POPUP_COOLDOWN_KEY="py2_store_notification_popup_last_v2";
 const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
 // Strip control characters only. Do not use escaped backslashes here: they
 // would match ordinary letters and digits in customer-facing notification text.
 const safe=(v,n=240)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,n);
 function readState(){try{return JSON.parse(localStorage.getItem(READ_KEY)||"{}")||{};}catch{return {};}}
 function saveRead(id){if(!id)return;const x=readState();x[id]=Date.now();try{localStorage.setItem(READ_KEY,JSON.stringify(x));}catch{}}
 function isRead(n){return Boolean(readState()[n.id]);}
 function dismissedState(){try{return JSON.parse(localStorage.getItem(DISMISSED_KEY)||"{}")||{};}catch{return {};}}
 function isDismissed(n){return Boolean(dismissedState()[n.id]);}
 function dismissNotification(id){if(!id)return;const saved=dismissedState();saved[id]=Date.now();const entries=Object.entries(saved).sort((a,b)=>b[1]-a[1]).slice(0,500);try{localStorage.setItem(DISMISSED_KEY,JSON.stringify(Object.fromEntries(entries)));}catch{}render();}
 function popupSeen(){try{return JSON.parse(localStorage.getItem(POPUP_SEEN_KEY)||"{}")||{};}catch{return {};}}
 function markPopupSeen(id){if(!id)return;const x=popupSeen();x[id]=Date.now();const entries=Object.entries(x).sort((a,b)=>b[1]-a[1]).slice(0,160);try{localStorage.setItem(POPUP_SEEN_KEY,JSON.stringify(Object.fromEntries(entries)));}catch{}}
 const state={items:[],filter:"all",open:false,popupTimer:null};
 const categoryLabel={products:"New product",offers:"Partner offer","price-drops":"Price drop",restocks:"Back in stock","low-stock":"Limited availability",community:"Community",businesses:"Partner update",blog:"New story",stories:"New story",seasonal:"Seasonal update",system:"PhoneYa2 update"};
 const categoryIcon={products:"🛍️",offers:"🤝","price-drops":"🏷️",restocks:"↗","low-stock":"⏳",stories:"📖",blog:"📖",community:"💬",seasonal:"✨",system:"🔔"};
 function validImage(value){const raw=String(value||"").trim();if(!raw||raw.startsWith("//")||/^data:|^javascript:/i.test(raw))return "";try{const u=new URL(raw,location.origin);if(!["https:","http:"].includes(u.protocol)||u.username||u.password)return "";if(u.origin!==location.origin&&u.protocol!=="https:")return "";return u.href;}catch{return "";}}
 function validDestination(value){
  const raw=String(value||"").trim();
  if(!raw||raw.startsWith("//"))return null;
  try{
   const u=new URL(raw,location.origin);
   if(!["https:","http:"].includes(u.protocol))return null;
   if(u.origin!==location.origin&&u.protocol!=="https:")return null;
   return {href:u.href,internal:u.origin===location.origin};
  }catch{return null;}
 }
 function styles(){
  if($("#py2-store-notification-styles"))return;
  const s=document.createElement("style");s.id="py2-store-notification-styles";
  s.textContent=`
  .py2-notify-wrap{position:relative;display:flex;align-items:center;flex:0 0 auto}
  .py2-notify-bell{position:relative;width:42px;height:42px;border:1px solid #e7e9ef;border-radius:11px;background:#fff;color:#172033;display:inline-flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer;box-shadow:0 2px 8px #1018280a}
  .py2-notify-bell:hover,.py2-notify-bell[aria-expanded=true]{border-color:#ff6000;color:#ff6000;background:#fff8f3}
  .py2-notify-count{position:absolute;right:-5px;top:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:99px;background:#e63946;color:#fff;font:800 10px/18px system-ui;text-align:center;box-shadow:0 0 0 2px #fff,0 0 10px #e6394670}
  .py2-notify-count[hidden]{display:none}
  .py2-notify-panel{position:absolute;right:0;top:calc(100% + 12px);width:min(390px,calc(100vw - 24px));max-height:min(590px,calc(100vh - 100px));background:#fff;border:1px solid #e6e9ef;border-radius:17px;box-shadow:0 22px 65px #1018282b;z-index:9998;display:none;overflow:hidden;color:#172033}
  .py2-notify-panel.is-open{display:flex;flex-direction:column;animation:py2NotifyIn .18s ease-out}
  @keyframes py2NotifyIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  .py2-notify-head{padding:17px 18px 12px;border-bottom:1px solid #edf0f4;display:flex;justify-content:space-between;gap:10px;align-items:center}
  .py2-notify-head h3{margin:0;font:800 17px/1.2 Syne,system-ui,sans-serif;color:#172033}
  .py2-notify-head p{margin:4px 0 0;font:12px/1.4 system-ui;color:#778195}
  .py2-notify-mark{border:0;background:transparent;color:#e65c13;font:700 11px system-ui;cursor:pointer;padding:7px}
  .py2-notify-tabs{display:flex;gap:6px;padding:10px 14px;border-bottom:1px solid #edf0f4}
  .py2-notify-tabs button{border:1px solid transparent;background:#f5f6f8;color:#667085;border-radius:99px;padding:7px 12px;font:700 11px system-ui;cursor:pointer}
  .py2-notify-tabs button[aria-pressed=true]{background:#fff1e8;border-color:#ffd6bd;color:#c94b00}
  .py2-notify-list{overflow:auto;overscroll-behavior:contain}
  .py2-notify-row{display:flex;align-items:stretch;border-bottom:1px solid #f0f2f5;background:#fff}
  .py2-notify-row:hover{background:#fff9f5}
  .py2-notify-item{display:flex;gap:11px;padding:13px 8px 13px 16px;border:0;flex:1;min-width:0;text-decoration:none;color:inherit}
  .py2-notify-remove{align-self:flex-start;flex:0 0 28px;width:28px;height:28px;margin:10px 10px 0 0;border:0;border-radius:8px;background:#f3f4f6;color:#7b8493;font:20px/1 system-ui;cursor:pointer;display:grid;place-items:center}
  .py2-notify-remove:hover{background:#ffe9dc;color:#c94b00}
  .py2-notify-remove:focus-visible{outline:2px solid #ff6500;outline-offset:2px}
  .py2-notify-item:hover{background:#fff9f5}
  .py2-notify-item.is-unread{background:#fffaf6}
  .py2-notify-dot{width:9px;height:9px;border-radius:50%;background:#e63946;flex:0 0 9px;margin-top:6px;box-shadow:0 0 8px #e6394655}.py2-notify-thumb{width:46px;height:46px;flex:0 0 46px;object-fit:cover;border-radius:9px;background:#f2f4f7;border:1px solid #edf0f4}
  .py2-notify-item.is-read .py2-notify-dot{background:#d5d9e0;box-shadow:none}
  .py2-notify-copy{min-width:0;flex:1}
  .py2-notify-title{display:block;font:750 13px/1.4 system-ui;color:#172033;overflow-wrap:anywhere}
  .py2-notify-message{display:block;margin-top:4px;font:12px/1.5 system-ui;color:#687386;overflow-wrap:anywhere}
  .py2-notify-meta{display:flex;gap:8px;margin-top:7px;font:10px system-ui;color:#98a1af}
  .py2-notify-tag{color:#c94b00;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
  .py2-notify-empty{padding:34px 20px;text-align:center;color:#778195;font:13px/1.5 system-ui}
  .py2-notify-foot{padding:11px 16px;background:#fafbfc;border-top:1px solid #edf0f4;font:11px/1.45 system-ui;color:#8a93a2}
  .py2-notify-popup{position:fixed;z-index:10050;top:86px;right:18px;width:min(390px,calc(100vw - 28px));display:grid;grid-template-columns:44px minmax(0,1fr) 28px;gap:12px;align-items:start;padding:15px;background:#fff;border:1px solid #e8eaf0;border-radius:17px;box-shadow:0 18px 55px #10182830;color:#172033;animation:py2NotifyPopupIn .25s ease-out}
  @keyframes py2NotifyPopupIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
  .py2-notify-popup-icon{width:52px;height:52px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(135deg,#fff0e5,#fff8f2);font-size:22px;overflow:hidden}.py2-notify-popup-image{display:block;width:100%;height:100%;object-fit:cover;background:#f3f4f6}
  .py2-notify-popup-copy{min-width:0}
  .py2-notify-popup-kicker{display:block;margin:1px 0 5px;color:#d6530a;font:800 10px/1.2 system-ui;letter-spacing:.09em;text-transform:uppercase}
  .py2-notify-popup-title{display:block;color:#172033;font:800 14px/1.35 system-ui;overflow-wrap:anywhere}
  .py2-notify-popup-message{display:block;margin-top:5px;color:#667085;font:12px/1.45 system-ui;overflow-wrap:anywhere}
  .py2-notify-popup-cta{display:inline-flex;margin-top:10px;color:#e65300;font:800 12px system-ui;text-decoration:none}
  .py2-notify-popup-close{width:28px;height:28px;border:0;border-radius:8px;background:#f3f4f6;color:#667085;font:18px/1 system-ui;cursor:pointer}
  .py2-notify-popup-close:hover{background:#ffe9dc;color:#c94b00}
  @media(max-width:680px){.py2-notify-bell{width:36px;height:36px;border-radius:9px;font-size:15px}.py2-global-blog-button{display:none!important}.py2-notify-panel{position:fixed;top:74px;right:10px;left:10px;width:auto;max-height:calc(100vh - 92px)}.py2-notify-popup{top:78px;right:10px;width:calc(100vw - 20px)}}
  @media(prefers-reduced-motion:reduce){.py2-notify-panel.is-open,.py2-notify-popup{animation:none}}`;
  document.head.appendChild(s);
 }
 function ago(v){const t=Date.parse(v||"");if(!Number.isFinite(t))return"Recently";const m=Math.max(0,Math.floor((Date.now()-t)/60000));return m<1?"Just now":m<60?m+"m ago":m<1440?Math.floor(m/60)+"h ago":Math.floor(m/1440)+"d ago";}
 function label(v){return categoryLabel[v]||"PhoneYa2 update";}
 function render(){
  const panel=$(".py2-notify-panel");if(!panel)return;
  const badge=$(".py2-notify-count"),visibleItems=state.items.filter(n=>!isDismissed(n)),count=visibleItems.filter(n=>!isRead(n)).length;
  badge.textContent=count>99?"99+":String(count);badge.hidden=!count;
  const list=visibleItems.filter(n=>state.filter==="all"||(state.filter==="unread"&&!isRead(n))||(state.filter==="read"&&isRead(n))),host=$(".py2-notify-list");
  host.replaceChildren();
  if(!list.length){const e=document.createElement("div");e.className="py2-notify-empty";e.textContent=state.filter==="unread"?"You're all caught up. New updates will appear here.":"No notifications yet. We'll let you know when something relevant happens.";host.append(e);}
  list.forEach(n=>{
   const row=document.createElement("div");row.className="py2-notify-row";
   const target=validDestination(n.destination),a=document.createElement(target?"a":"div");
   a.className="py2-notify-item "+(isRead(n)?"is-read":"is-unread");
   if(target){a.href=target.href;if(!target.internal){a.target="_blank";a.rel="noopener noreferrer";}a.addEventListener("click",()=>saveRead(n.id));}
   else a.setAttribute("aria-disabled","true");
   const dot=document.createElement("span");dot.className="py2-notify-dot";
   const c=document.createElement("span");c.className="py2-notify-copy";
   const t=document.createElement("span");t.className="py2-notify-title";t.textContent=safe(n.title,180);
   const m=document.createElement("span");m.className="py2-notify-message";m.textContent=safe(n.message,420);
   const meta=document.createElement("span");meta.className="py2-notify-meta";
   const cat=document.createElement("span");cat.className="py2-notify-tag";cat.textContent=label(n.category);
   const time=document.createElement("span");time.textContent=ago(n.created_at);
   meta.append(cat,time);c.append(t,m,meta);const thumbUrl=validImage(n.metadata?.image);let thumb=null;if(thumbUrl){thumb=document.createElement("img");thumb.className="py2-notify-thumb";thumb.src=thumbUrl;thumb.alt="";thumb.loading="lazy";thumb.onerror=()=>thumb.remove();}a.append(thumb||dot,c);
   const remove=document.createElement("button");remove.type="button";remove.className="py2-notify-remove";remove.textContent="×";remove.setAttribute("aria-label","Remove "+safe(n.title,100));remove.title="Remove notification";remove.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();dismissNotification(n.id);});
   row.append(a,remove);host.append(row);
  });
  $$(".py2-notify-tabs button",panel).forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.filter===state.filter)));
 }
 function closePopup(id){const el=$("#py2-notify-popup");if(!el)return;if(id)markPopupSeen(id);el.remove();window.__py2NotificationPopupOpen=false;if(state.popupTimer)clearTimeout(state.popupTimer);state.popupTimer=null;}
 function blockedByAnotherPopup(){
  return Boolean(window.__py2SellerModalOpen||window.__py2SellerNoticeOpen||window.__py2ProductPopupOpen||window.__py2BlogSpotlightOpen||window.__py2ContextTipOpen||window.__py2AdPopupOpen||window.__py2NotificationPopupOpen);
 }
 function showPopup(n){
  if(!n||$("#py2-notify-popup"))return;
  const target=validDestination(n.destination);if(!target)return;
  const wrap=document.createElement("aside");wrap.id="py2-notify-popup";wrap.className="py2-notify-popup";wrap.setAttribute("role","status");wrap.setAttribute("aria-live","polite");
  const icon=document.createElement("span");icon.className="py2-notify-popup-icon";icon.setAttribute("aria-hidden","true");const imagePath=validImage(n.metadata?.image);if(imagePath){const image=document.createElement("img");image.className="py2-notify-popup-image";image.src=imagePath;image.alt="";image.loading="lazy";image.onerror=()=>{image.remove();icon.textContent=categoryIcon[n.category]||"🔔";};icon.append(image);}else icon.textContent=categoryIcon[n.category]||"🔔";
  const copy=document.createElement("div");copy.className="py2-notify-popup-copy";
  const kicker=document.createElement("span");kicker.className="py2-notify-popup-kicker";kicker.textContent=label(n.category);
  const link=document.createElement("a");link.href=target.href;link.className="py2-notify-popup-link";link.style.cssText="display:block;color:inherit;text-decoration:none";
  if(!target.internal){link.target="_blank";link.rel="noopener noreferrer";}
  const title=document.createElement("strong");title.className="py2-notify-popup-title";title.textContent=safe(n.title,150);
  const message=document.createElement("span");message.className="py2-notify-popup-message";message.textContent=safe(n.message,220);
  const cta=document.createElement("span");cta.className="py2-notify-popup-cta";cta.textContent="View this update →";
  link.append(title,message,cta);link.addEventListener("click",()=>{markPopupSeen(n.id);saveRead(n.id);});
  const close=document.createElement("button");close.type="button";close.className="py2-notify-popup-close";close.setAttribute("aria-label","Dismiss notification");close.textContent="×";close.addEventListener("click",()=>closePopup(n.id));
  copy.append(kicker,link);wrap.append(icon,copy,close);document.body.append(wrap);
  window.__py2NotificationPopupOpen=true;
  state.popupTimer=setTimeout(()=>closePopup(n.id),10000);
 }
 function maybeShowPopup(items){
  const seen=popupSeen(),now=Date.now(),last=Number(localStorage.getItem(POPUP_COOLDOWN_KEY)||0);
  if(last&&now-last<8*60*1000)return;
  const allowed=new Set(["products","stories","blog","price-drops","restocks","low-stock","offers"]);
  const candidates=(items||[]).filter(n=>n&&n.id&&allowed.has(n.category)&&!seen[n.id]&&Number.isFinite(Date.parse(n.created_at))&&now-Date.parse(n.created_at)<36*60*60*1000&&now>=Date.parse(n.created_at)-5*60*1000);
  if(!candidates.length)return;
  const chosen=candidates.slice().sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0];
  markPopupSeen(chosen.id);try{localStorage.setItem(POPUP_COOLDOWN_KEY,String(now));}catch{}
  const attempt=()=>{if(blockedByAnotherPopup()){state.popupTimer=setTimeout(attempt,5000);return;}showPopup(chosen);};
  state.popupTimer=setTimeout(attempt,1200);
 }
 function build(){
  const header=$(".top-header-inner");if(!header||$(".py2-notify-wrap"))return;
  styles();
  const w=document.createElement("div");w.className="py2-notify-wrap";
  w.innerHTML='<button class="py2-notify-bell" type="button" aria-label="Notifications" aria-expanded="false" aria-controls="py2-notify-panel"><i class="fa-regular fa-bell" aria-hidden="true"></i><span class="py2-notify-count" hidden>0</span></button><section class="py2-notify-panel" id="py2-notify-panel" aria-label="PhoneYa2 notifications"><header class="py2-notify-head"><div><h3>Notifications</h3><p>Useful updates from PhoneYa2</p></div><button class="py2-notify-mark" type="button">Mark all read</button></header><nav class="py2-notify-tabs" aria-label="Notification filters"><button type="button" data-filter="all" aria-pressed="true">All</button><button type="button" data-filter="unread" aria-pressed="false">Unread</button><button type="button" data-filter="read" aria-pressed="false">Read</button></nav><div class="py2-notify-list" aria-live="polite"><div class="py2-notify-empty">Loading updates…</div></div><footer class="py2-notify-foot">Your read status is saved on this browser. Select any update to open its destination.</footer></section>';
  const cart=$(".header-cart-cta",header);if(cart)header.insertBefore(w,cart);else header.append(w);
  const bell=$(".py2-notify-bell",w),panel=$(".py2-notify-panel",w);
  bell.addEventListener("click",()=>{state.open=!state.open;panel.classList.toggle("is-open",state.open);bell.setAttribute("aria-expanded",String(state.open));if(state.open)load(false);});
  $(".py2-notify-mark",panel).addEventListener("click",()=>{state.items.forEach(n=>saveRead(n.id));render();});
  $$(".py2-notify-tabs button",panel).forEach(b=>b.addEventListener("click",()=>{state.filter=b.dataset.filter;render();}));
  document.addEventListener("click",e=>{if(state.open&&!w.contains(e.target)){state.open=false;panel.classList.remove("is-open");bell.setAttribute("aria-expanded","false");}});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(state.open){state.open=false;panel.classList.remove("is-open");bell.setAttribute("aria-expanded","false");bell.focus();}closePopup();}});
 }
 async function load(allowPopup){
  try{
   const r=await fetch("/api/store-notifications?limit=100",{cache:"no-store",headers:{"accept":"application/json"}});
   if(!r.ok)throw Error("Notification request failed");
   const d=await r.json();if(!d.ok||!Array.isArray(d.notifications))throw Error("Invalid notification response");
   state.items=d.notifications;render();
   if(allowPopup!==false)maybeShowPopup(state.items);
  }catch{
   const h=$(".py2-notify-list");if(h&&!state.items.length)h.textContent="Updates are temporarily unavailable. Shopping is not affected.";
  }
 }
 function init(){
  build();if(!$(".py2-notify-wrap"))return;
  load(true);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)load(false);});
  setInterval(()=>{if(!document.hidden)load(true);},60000);
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();