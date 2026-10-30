/* PhoneYa2 Seasonal Experience — Decap CMS configuration source */
(()=>{'use strict';
const CONFIG='/content/settings/seasonal-campaigns.json';
const PREVIEW_KEY='phoneya2-seasonal-preview-v3';
const defaults={enabled:false,theme:'christmas',decorations:true,snow:false,snowIntensity:24,scheduled:false,start:'2026-11-15',end:'2026-12-27',coverage:'all',popup:false,popupMode:'delay',popupDelay:5,popupScroll:35,popupTitle:'Make Their Christmas Special',popupMessage:'Discover thoughtful gifts, explore festive offers and shop your favourite phone accessories.',popupButton:'Shop Christmas Deals',popupUrl:'/shop.html',banner:true,bannerTitle:'The PhoneYa2 Christmas Edit',bannerMessage:'Thoughtful tech gifts. Better-connected moments.',bannerButton:'Explore Christmas Picks',bannerUrl:'/shop.html',bannerImage:'https://images.unsplash.com/photo-1764519430085-8e84e7fca425?auto=format&fit=crop&fm=jpg&q=85&w=2200',popupImage:'https://images.unsplash.com/photo-1669130183532-377dd8fd6718?auto=format&fit=crop&fm=jpg&q=85&w=1600'};
let settings={...defaults},snowLayer=null,popupCreated=false;
const params=new URLSearchParams(location.search);
function localDay(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lusaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function inSchedule(){return !!(settings.scheduled&&settings.start&&settings.end&&localDay()>=settings.start.slice(0,10)&&localDay()<=settings.end.slice(0,10))}
function pageCovered(){const p=location.pathname.toLowerCase();if(settings.coverage==='shopping')return p==='/'||/^\/(shop|product|cart|checkout|account)(\.html)?$/.test(p);if(settings.coverage==='content')return /blog|about|contact|policy|newsletter|advertis|agent/.test(p);return true}
function active(){const campaignLive=!!settings.enabled&&(!settings.scheduled||inSchedule());return pageCovered()&&(campaignLive||params.has('py2-seasonal-preview'))}
function safeImage(value){try{const u=new URL(value,location.origin);return (u.protocol==='https:'||u.origin===location.origin)?u.href:''}catch{return ''}}
function safeDestination(value){try{const u=new URL(value||'/shop.html',location.origin);return u.origin===location.origin||u.protocol==='https:'?u.href:'/shop.html'}catch{return '/shop.html'}}
function themeKey(){return String(settings.theme||'default').toLowerCase().replace(/[^a-z0-9-]/g,'-')}
function themeMarks(){const key=themeKey();if(key.includes('valentine'))return ['💗','🌹','💝','💕'];if(key.includes('easter'))return ['🐣','🌷','🐰','🥚'];if(key.includes('halloween'))return ['🎃','🦇','👻','🕸️'];if(key.includes('black'))return ['🛍️','🏷️','⭐','🛒'];if(key.includes('new-year')||key.includes('newyear'))return ['🎆','✨','🥂','🎇'];if(key.includes('school'))return ['🎒','📚','✏️','⭐'];if(key.includes('mother'))return ['🌷','💐','💗','🎁'];if(key.includes('father'))return ['🎁','⭐','🏆','💙'];if(key.includes('summer'))return ['☀️','🌴','🌊','🍉'];if(key.includes('independence'))return ['🇿🇲','💚','🖤','🧡','❤️'];if(key.includes('christmas'))return ['🎄','🎅','🔔','🎁','🦌','⛄'];return ['✦','✧','•','✦']}
function decorateHeadings(){
 if(!settings.decorations)return;
 const selectors='main h1,main h2,main h3,.hero h1,.hero h2,.hero-section h1,.hero-section h2,.hero-banner h1,.hero-banner h2,.section-head h2,.section-heading h2,.blog-section-heading h2,main section h2,.heading,.section-title';
 const nodes=[...document.querySelectorAll(selectors)].filter(n=>!n.closest('#py2-xmas-popup')&&!n.querySelector(':scope > .py2-seasonal-ornament'));
 const ornaments=themeMarks();
 nodes.forEach((node,i)=>{const mark=document.createElement('span');mark.className='py2-seasonal-ornament';mark.setAttribute('aria-hidden','true');mark.textContent=ornaments[i%ornaments.length];node.append(mark)});
 const tabMarks=themeMarks();
 const tabs=[...document.querySelectorAll('body>nav.py2-quick-tabs a, .cat-nav .cat-nav-item, .bottom-nav .bnav-item')];
 tabs.forEach((tab,i)=>{if(tab.querySelector(':scope > .py2-seasonal-tab-mark'))return;const mark=document.createElement('span');mark.className='py2-seasonal-tab-mark';mark.setAttribute('aria-hidden','true');mark.textContent=tabMarks[i%tabMarks.length];tab.prepend(mark)});
}
function decorateBrand(){
 if(!settings.decorations)return;
 document.querySelectorAll('.logo-brand-name,.logo-text-block .brand-name,.logo-wrap .logo-text').forEach(name=>{
  if(name.querySelector(':scope > .py2-seasonal-brand-marks'))return;
  const marks=document.createElement('span');marks.className='py2-seasonal-brand-marks';marks.setAttribute('aria-hidden','true');
  const icons=themeMarks();
  const first=document.createElement('span');first.textContent=icons[0];
  const second=document.createElement('span');second.textContent=icons[1]||icons[0];
  marks.append(first,second);name.insertAdjacentElement('afterend',marks);
 });
}
function createCampaignBanner(){
 if(!settings.banner||document.getElementById('py2-xmas-ribbon'))return;
 const ribbon=document.createElement('aside');ribbon.id='py2-xmas-ribbon';ribbon.className='py2-xmas-ribbon';if(settings.bannerImage){const image=safeImage(settings.bannerImage);if(image)ribbon.style.setProperty('--py2-xmas-banner-image','url('+JSON.stringify(image)+')')}
 ribbon.setAttribute('aria-label','PhoneYa2 Christmas campaign');
 const inner=document.createElement('div');inner.className='py2-xmas-ribbon-inner';
 const mark=document.createElement('span');mark.className='py2-xmas-ribbon-mark';mark.setAttribute('aria-hidden','true');mark.textContent='✦';
 const copy=document.createElement('div');copy.className='py2-xmas-ribbon-copy';
 const title=document.createElement('strong');title.textContent=settings.bannerTitle||'The PhoneYa2 Christmas Edit';
 const message=document.createElement('span');message.textContent=settings.bannerMessage||'Thoughtful tech gifts. Better-connected moments.';
 copy.append(title,message);
 const link=document.createElement('a');link.className='py2-xmas-ribbon-link';link.href=safeDestination(settings.bannerUrl||'/shop.html');link.textContent=settings.bannerButton||'Explore gifts';
 const close=document.createElement('button');close.type='button';close.className='py2-xmas-ribbon-close';close.setAttribute('aria-label','Dismiss Christmas banner');close.textContent='×';
 close.addEventListener('click',()=>{ribbon.remove();sessionStorage.setItem('py2-xmas-ribbon-dismissed','1')});
 inner.append(mark,copy,link,close);ribbon.append(inner);
 if(sessionStorage.getItem('py2-xmas-ribbon-dismissed'))return;
 const header=document.querySelector('.top-header,.site-header,header');
 if(header&&header.parentNode)header.insertAdjacentElement('afterend',ribbon);
 else {const main=document.querySelector('main');(main||document.body).insertAdjacentElement('afterbegin',ribbon)}
}
function applyHeroTreatment(){
 const heroes=document.querySelectorAll('.hero-zone,.hero-banner,.shop-hero,.hero-section,.hero,.hero-content,.intro');
 heroes.forEach(el=>{if(!el.closest('#py2-xmas-popup')&&!el.classList.contains('py2-xmas-hero'))el.classList.add('py2-xmas-hero')});
}
function makeSnow(){
 if(!settings.snow||!active()||matchMedia('(prefers-reduced-motion: reduce)').matches||snowLayer)return;
 const mobile=matchMedia('(max-width: 768px)').matches;const requested=Number(settings.snowIntensity)||12;const count=Math.max(4,Math.min(mobile?10:20,requested));
 snowLayer=document.createElement('div');snowLayer.id='py2-seasonal-snow';snowLayer.setAttribute('aria-hidden','true');
 for(let i=0;i<count;i++){const flake=document.createElement('i');flake.className='py2-snowflake';flake.textContent='❄';flake.style.left=(Math.random()*100)+'%';flake.style.animationDuration=(9+Math.random()*13)+'s';flake.style.animationDelay=(-Math.random()*20)+'s';flake.style.setProperty('--snow-drift',(Math.random()*90-45)+'px');flake.style.opacity=(.35+Math.random()*.55).toFixed(2);flake.style.fontSize=(8+Math.random()*9)+'px';snowLayer.append(flake)}
 document.body.append(snowLayer);
}
function showPopup(){
 if(!settings.popup||!active()||popupCreated||sessionStorage.getItem('py2-xmas-dismissed'))return;
 popupCreated=true;const wrap=document.createElement('div');wrap.id='py2-xmas-popup';wrap.hidden=true;
 const section=document.createElement('section');section.className='py2-xmas-modal';section.setAttribute('role','dialog');section.setAttribute('aria-modal','true');section.setAttribute('aria-labelledby','py2-xmas-title');
 const close=document.createElement('button');close.className='py2-xmas-close';close.type='button';close.setAttribute('aria-label','Close promotion');close.textContent='×';
 const art=document.createElement('div');art.className='py2-xmas-modal-art';const image=safeImage(settings.popupImage);if(image)art.style.backgroundImage='linear-gradient(180deg,#071b1420 0%,#071b1499 100%),url('+JSON.stringify(image)+')';
 const eyebrow=document.createElement('span');eyebrow.className='py2-xmas-modal-eyebrow';eyebrow.textContent='PHONEYA2 • CHRISTMAS COLLECTION';
 const title=document.createElement('h2');title.id='py2-xmas-title';title.textContent=settings.popupTitle;art.append(eyebrow,title);
 const copy=document.createElement('p');copy.className='py2-xmas-copy';copy.textContent=settings.popupMessage;
 const link=document.createElement('a');link.className='py2-xmas-cta';link.textContent=settings.popupButton;link.href=safeDestination(settings.popupUrl);
 section.append(close,art,copy,link);wrap.append(section);document.body.append(wrap);
 const dismiss=()=>{wrap.hidden=true;sessionStorage.setItem('py2-xmas-dismissed','1')};
 close.addEventListener('click',dismiss);wrap.addEventListener('click',e=>{if(e.target===wrap)dismiss()});
 const reveal=()=>{if(!sessionStorage.getItem('py2-xmas-dismissed'))wrap.hidden=false};
 if(settings.popupMode==='immediate')setTimeout(reveal,700);
 else if(settings.popupMode==='scroll'){const onScroll=()=>{const progress=(scrollY+innerHeight)/Math.max(document.documentElement.scrollHeight,innerHeight)*100;if(progress>=Number(settings.popupScroll||35)){reveal();removeEventListener('scroll',onScroll)}};addEventListener('scroll',onScroll,{passive:true})}
 else setTimeout(reveal,Math.max(0,Math.min(60,Number(settings.popupDelay)||0))*1000);
}
function apply(){
 const enabled=active();const root=document.documentElement;
 root.classList.remove(...Array.from(root.classList).filter(name=>name.startsWith('py2-season-')));
 if(enabled){const key=themeKey();root.classList.add('py2-season-active','py2-season-theme-'+key);}
 root.classList.toggle('py2-xmas',enabled&&themeKey().includes('christmas'));
 if(!enabled)return;
 decorateHeadings();decorateBrand();applyHeroTreatment();createCampaignBanner();makeSnow();showPopup();
}
async function loadPublishedSettings(){
 const response=await fetch(CONFIG+'?v='+encodeURIComponent(document.documentElement.dataset.seasonalVersion||'live')+'&t='+Date.now(),{cache:'no-store',credentials:'same-origin'});
 if(!response.ok)throw new Error('Decap seasonal settings file unavailable: '+response.status);
 const data=await response.json();
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Seasonal settings file is not a valid JSON object');
 return data;
}
async function load(){
 try{
  const published=await loadPublishedSettings();
  settings={...defaults,...published};
  if(params.has('py2-seasonal-preview')){try{const draft=JSON.parse(localStorage.getItem(PREVIEW_KEY)||'null');if(draft)settings={...settings,...draft}}catch{}}
  apply();
 }catch(error){console.warn('[PhoneYa2 Seasonal] Could not load Decap-published settings:',error)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
// Deliberately do not observe the entire document: product grids and live widgets mutate often.
// Decorations are applied once after the page has loaded, avoiding repeated full-page DOM scans.
})();