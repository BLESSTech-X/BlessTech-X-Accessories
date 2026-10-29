(()=>{'use strict';
const endpoint='/api/seasonal-theme';const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const presets={
 'black-friday':{bg:'#101116',ink:'#fff',accent:'#ffcf33',banner:'#1b1b22'},
 christmas:{bg:'#f3fbf5',ink:'#153b29',accent:'#c51f36',banner:'#146b43'},
 independence:{bg:'#f7fff5',ink:'#163b20',accent:'#198b45',banner:'#198b45'},
 'new-year':{bg:'#f5f3ff',ink:'#28204b',accent:'#7c3aed',banner:'#34265f'},
 valentines:{bg:'#fff4f7',ink:'#6c1738',accent:'#e11d48',banner:'#9d174d'},
 easter:{bg:'#fffaf0',ink:'#44315f',accent:'#8b5cf6',banner:'#6d4ba0'},
 custom:{bg:'#f4f8ff',ink:'#172554',accent:'#ff6500',banner:'#173b7a'}
};
function remove(){document.getElementById('py2-seasonal-banner')?.remove();document.getElementById('py2-seasonal-popup')?.remove();document.getElementById('py2-seasonal-effects')?.remove();document.documentElement.removeAttribute('data-py2-season');document.getElementById('py2-seasonal-style')?.remove();}
function apply(c){if(!c)return;remove();if(!c.theme||c.theme==='none')return;if(c.end_date&&new Date(c.end_date+'T23:59:59')<new Date())return;
const p=presets[c.theme]||presets.custom;document.documentElement.dataset.py2Season=c.theme;
const style=document.createElement('style');style.id='py2-seasonal-style';style.textContent=`
html[data-py2-season="black-friday"] body{background:${p.bg}!important;color:${p.ink}}
html[data-py2-season="christmas"] body,html[data-py2-season="easter"] body{background:${p.bg}!important}
html[data-py2-season="independence"] body{background:linear-gradient(135deg,#fff 0%,#f2fff0 100%)!important}
#py2-seasonal-banner{position:relative;z-index:20;padding:10px 14px;text-align:center;background:${p.banner};color:#fff;font:800 13px/1.45 system-ui,sans-serif}
#py2-seasonal-banner strong{color:${p.accent}}
#py2-seasonal-effects{position:fixed;inset:0;pointer-events:none;z-index:999;overflow:hidden}
.py2-seasonal-flake{position:absolute;top:-8vh;left:var(--x);font-size:var(--s);opacity:.78;animation:py2-fall var(--d) linear infinite;animation-delay:var(--delay)}
@keyframes py2-fall{to{transform:translate3d(25px,110vh,0) rotate(360deg)}}
#py2-seasonal-popup-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:18px;background:#101322a8;backdrop-filter:blur(5px)}
#py2-seasonal-popup{width:min(440px,100%);padding:28px 22px;border-radius:22px;background:#fff;color:#182033;text-align:center;box-shadow:0 24px 90px #0005}
#py2-seasonal-popup .season-emoji{font-size:36px}#py2-seasonal-popup h2{margin:8px 0;color:${p.banner};font-size:24px}#py2-seasonal-popup p{line-height:1.6;color:#596579}#py2-seasonal-popup button{border:0;border-radius:10px;padding:11px 17px;background:${p.banner};color:#fff;font-weight:850}
`;document.head.appendChild(style);
if(c.banner&&c.title){const banner=document.createElement('div');banner.id='py2-seasonal-banner';banner.innerHTML='<strong></strong> <span></span>';banner.querySelector('strong').textContent=c.title;banner.querySelector('span').textContent=c.message||'';document.body.prepend(banner);}
if(c.effects&&!reduce){const fx=document.createElement('div');fx.id='py2-seasonal-effects';fx.setAttribute('aria-hidden','true');const emoji=c.theme==='christmas'?'❄':c.theme==='independence'?'✦':c.theme==='black-friday'?'✦':c.theme==='easter'?'✿':c.theme==='valentines'?'♥':'✧';for(let i=0;i<24;i++){const f=document.createElement('span');f.className='py2-seasonal-flake';f.textContent=emoji;f.style.setProperty('--x',(i*4.3%100)+'%');f.style.setProperty('--s',(8+(i%4)*5)+'px');f.style.setProperty('--d',(8+(i%7)*2)+'s');f.style.setProperty('--delay',(-i%15)+'s');fx.appendChild(f);}document.body.appendChild(fx);}
if(c.popup&&c.title){let seen=false;try{seen=sessionStorage.getItem('py2-season-popup-'+c.theme+'-'+(c.updated_at||''))==='1';}catch(_){}if(!seen){const back=document.createElement('div');back.id='py2-seasonal-popup-backdrop';back.innerHTML='<section id="py2-seasonal-popup" role="dialog" aria-modal="true"><div class="season-emoji" aria-hidden="true"></div><h2></h2><p></p><button type="button">Continue shopping</button></section>';back.querySelector('.season-emoji').textContent=c.theme==='christmas'?'🎄🎁':c.theme==='independence'?'🇿🇲':c.theme==='black-friday'?'🖤':c.theme==='easter'?'🐣':c.theme==='valentines'?'❤️':'✨';back.querySelector('h2').textContent=c.title;back.querySelector('p').textContent=c.message||'Explore PhoneYa2 today.';const close=()=>{try{sessionStorage.setItem('py2-season-popup-'+c.theme+'-'+(c.updated_at||''),'1');}catch(_){}back.remove();};back.querySelector('button').addEventListener('click',close);back.addEventListener('click',e=>{if(e.target===back)close();});document.body.appendChild(back);}}
}
window.PhoneYa2SeasonalTheme={apply};
fetch(endpoint,{headers:{accept:'application/json'}}).then(r=>r.ok?r.json():Promise.reject()).then(d=>apply(d.config)).catch(()=>{});
})();