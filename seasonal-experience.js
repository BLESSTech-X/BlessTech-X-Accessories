/* PhoneYa2 Seasonal Experience — Decap CMS configuration source */
(()=>{'use strict';
const CONFIG='/content/settings/seasonal-campaigns.json';
const PREVIEW_KEY='phoneya2-seasonal-preview-v3';
const defaults={enabled:false,theme:'christmas',decorations:true,snow:false,snowIntensity:24,scheduled:false,start:'2026-11-15',end:'2026-12-27',coverage:'all',popup:false,popupMode:'delay',popupDelay:5,popupScroll:35,popupTitle:'Make Their Christmas Special',popupMessage:'Discover thoughtful gifts, explore festive offers and shop your favourite phone accessories.',popupButton:'Shop Christmas Deals',popupUrl:'/shop.html'};
let settings={...defaults},snowLayer=null,popupCreated=false;
const params=new URLSearchParams(location.search);
function localDay(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lusaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function inSchedule(){return !!(settings.scheduled&&settings.start&&settings.end&&localDay()>=settings.start.slice(0,10)&&localDay()<=settings.end.slice(0,10))}
function pageCovered(){const p=location.pathname.toLowerCase();if(settings.coverage==='shopping')return p==='/'||/^\/(shop|product|cart|checkout|account)(\.html)?$/.test(p);if(settings.coverage==='content')return /blog|about|contact|policy|newsletter|advertis|agent/.test(p);return true}
function active(){return pageCovered()&&(settings.enabled||inSchedule()||params.has('py2-seasonal-preview'))}
function safeDestination(value){try{const u=new URL(value||'/shop.html',location.origin);return u.origin===location.origin||u.protocol==='https:'?u.href:'/shop.html'}catch{return '/shop.html'}}
function decorateHeadings(){
 if(!settings.decorations)return;
 const selectors='main h1, .hero h1, .hero-section h1, .hero-banner h1, .section-head h2, .section-heading h2, .blog-section-heading h2, main section h2';
 const nodes=[...document.querySelectorAll(selectors)].filter(n=>!n.closest('#py2-xmas-popup')&&!n.hasAttribute('data-py2-seasonal-heading'));
 const ornaments=['🎄','✦','🔔','❄'];
 nodes.forEach((node,i)=>{node.setAttribute('data-py2-seasonal-heading','');node.style.setProperty('--py2-seasonal-ornament','"'+ornaments[i%ornaments.length]+'"')});
}
function makeSnow(){
 if(!settings.snow||!active()||matchMedia('(prefers-reduced-motion: reduce)').matches||snowLayer)return;
 const count=Math.max(5,Math.min(60,Number(settings.snowIntensity)||24));
 snowLayer=document.createElement('div');snowLayer.id='py2-seasonal-snow';snowLayer.setAttribute('aria-hidden','true');
 for(let i=0;i<count;i++){const flake=document.createElement('i');flake.className='py2-snowflake';flake.textContent='❄';flake.style.left=(Math.random()*100)+'%';flake.style.animationDuration=(9+Math.random()*13)+'s';flake.style.animationDelay=(-Math.random()*20)+'s';flake.style.setProperty('--snow-drift',(Math.random()*90-45)+'px');flake.style.opacity=(.35+Math.random()*.55).toFixed(2);flake.style.fontSize=(8+Math.random()*9)+'px';snowLayer.append(flake)}
 document.body.append(snowLayer);
}
function showPopup(){
 if(!settings.popup||!active()||popupCreated||sessionStorage.getItem('py2-xmas-dismissed'))return;
 popupCreated=true;const wrap=document.createElement('div');wrap.id='py2-xmas-popup';wrap.hidden=true;
 const section=document.createElement('section');section.className='py2-xmas-modal';section.setAttribute('role','dialog');section.setAttribute('aria-modal','true');section.setAttribute('aria-labelledby','py2-xmas-title');
 const close=document.createElement('button');close.className='py2-xmas-close';close.type='button';close.setAttribute('aria-label','Close promotion');close.textContent='×';
 const title=document.createElement('h2');title.id='py2-xmas-title';title.textContent=settings.popupTitle;
 const copy=document.createElement('p');copy.className='py2-xmas-copy';copy.textContent=settings.popupMessage;
 const link=document.createElement('a');link.className='py2-xmas-cta';link.textContent=settings.popupButton;link.href=safeDestination(settings.popupUrl);
 section.append(close,title,copy,link);wrap.append(section);document.body.append(wrap);
 const dismiss=()=>{wrap.hidden=true;sessionStorage.setItem('py2-xmas-dismissed','1')};
 close.addEventListener('click',dismiss);wrap.addEventListener('click',e=>{if(e.target===wrap)dismiss()});
 const reveal=()=>{if(!sessionStorage.getItem('py2-xmas-dismissed'))wrap.hidden=false};
 if(settings.popupMode==='immediate')setTimeout(reveal,700);
 else if(settings.popupMode==='scroll'){const onScroll=()=>{const progress=(scrollY+innerHeight)/Math.max(document.documentElement.scrollHeight,innerHeight)*100;if(progress>=Number(settings.popupScroll||35)){reveal();removeEventListener('scroll',onScroll)}};addEventListener('scroll',onScroll,{passive:true})}
 else setTimeout(reveal,Math.max(0,Math.min(60,Number(settings.popupDelay)||0))*1000);
}
function apply(){
 const enabled=active();document.documentElement.classList.toggle('py2-xmas',enabled);
 if(!enabled)return;
 decorateHeadings();makeSnow();showPopup();
}
async function load(){
 try{
  const response=await fetch(CONFIG,{cache:'no-store'});
  if(!response.ok)throw new Error('Campaign settings unavailable: '+response.status);
  const published=await response.json();settings={...defaults,...published};
  if(params.has('py2-seasonal-preview')){try{const draft=JSON.parse(localStorage.getItem(PREVIEW_KEY)||'null');if(draft)settings={...settings,...draft}}catch{}}
  apply();
 }catch(error){console.warn('[PhoneYa2 Seasonal]',error)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();