(()=>{'use strict';
const endpoint='/api/seasonal-theme';
const reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const presets={
 'black-friday':{bg:'#090d18',ink:'#f7f8fc',accent:'#ffd166',banner:'#171d2d'},
 christmas:{bg:'#f2f8f2',ink:'#173b2a',accent:'#d51f3d',banner:'#125c3b'},
 independence:{bg:'#f4fbf3',ink:'#183b26',accent:'#218b48',banner:'#176b39'},
 'new-year':{bg:'#f3f0ff',ink:'#252044',accent:'#e7bd68',banner:'#27204c'},
 valentines:{bg:'#fff2f6',ink:'#6c1738',accent:'#e11d48',banner:'#941c4d'},
 easter:{bg:'#fff9ef',ink:'#43335c',accent:'#a477d8',banner:'#624a8e'},
 'heroes-unity':{bg:'#fff8ed',ink:'#4c2d1a',accent:'#c87927',banner:'#70421f'},
 'africa-freedom':{bg:'#fff9ed',ink:'#3f321e',accent:'#d58b23',banner:'#79531e'},
 'labour-day':{bg:'#f3f7ff',ink:'#1d3152',accent:'#2670c8',banner:'#204e8a'},
 'youth-day':{bg:'#effaff',ink:'#153a55',accent:'#0a9bba',banner:'#14516d'},
 'farmers-day':{bg:'#f1f8ed',ink:'#294322',accent:'#5c8d35',banner:'#315d2a'},
 custom:{bg:'#f1f6ff',ink:'#172554',accent:'#ff6500',banner:'#173b7a'}
};
const safe=(v)=>String(v||'').replace(/[<>]/g,'');
function remove(){
 ['py2-seasonal-banner','py2-seasonal-popup-backdrop','py2-seasonal-effects','py2-seasonal-garland','py2-seasonal-side-decor'].forEach(id=>document.getElementById(id)?.remove());
 document.documentElement.removeAttribute('data-py2-season');
 document.getElementById('py2-seasonal-style')?.remove();
}
function makeDecor(id,items,cls){const el=document.createElement('div');el.id=id;el.className=cls;el.setAttribute('aria-hidden','true');items.forEach((item,i)=>{const s=document.createElement('span');s.textContent=item;s.style.setProperty('--i',i);el.appendChild(s)});document.body.appendChild(el);return el;}
function apply(c){
 if(!c)return;remove();if(!c.theme||c.theme==='none')return;
 if(c.end_date&&new Date(c.end_date+'T23:59:59')<new Date())return;
 const theme=presets[c.theme]?c.theme:'custom',p=presets[theme];
 document.documentElement.dataset.py2Season=theme;
 const style=document.createElement('style');style.id='py2-seasonal-style';
 style.textContent=`
 html[data-py2-season] body{background-color:${p.bg}!important;color:${p.ink};transition:background-color .35s ease}
 html[data-py2-season] body:before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(ellipse at 5% 0%,color-mix(in srgb,${p.accent} 12%,transparent),transparent 40%),radial-gradient(ellipse at 100% 80%,color-mix(in srgb,${p.banner} 9%,transparent),transparent 45%)}
 html[data-py2-season="black-friday"] body{background-image:radial-gradient(ellipse at 50% -20%,#30354c 0,transparent 55%),linear-gradient(160deg,#090d18,#111827 65%,#17121e)!important;color:#f7f8fc}
 html[data-py2-season="christmas"] body{background-image:radial-gradient(ellipse at 0% 0%,#dcefe0 0,transparent 42%),radial-gradient(ellipse at 100% 15%,#f9e0e2 0,transparent 35%),linear-gradient(180deg,#f4faf4,#edf6ef 60%,#f8f6ee)!important}
 html[data-py2-season="independence"] body{background-image:linear-gradient(135deg,#fff 0%,#f2fff0 46%,#fff7eb 100%)!important}
 html[data-py2-season="new-year"] body{background-image:radial-gradient(ellipse at 50% 0%,#ded6ff 0,transparent 45%),linear-gradient(180deg,#f7f4ff,#efedff)!important}
 html[data-py2-season="valentines"] body{background-image:radial-gradient(ellipse at 0% 0%,#ffdce7 0,transparent 42%),radial-gradient(ellipse at 100% 40%,#ffe6ed 0,transparent 40%),linear-gradient(180deg,#fff7fa,#fff0f5)!important}
 html[data-py2-season="easter"] body{background-image:radial-gradient(ellipse at 0% 0%,#f4e7ff 0,transparent 38%),radial-gradient(ellipse at 100% 25%,#fff0c9 0,transparent 35%),linear-gradient(180deg,#fffaf2,#f8f3ff)!important}
 html[data-py2-season="heroes-unity"] body,html[data-py2-season="africa-freedom"] body{background-image:linear-gradient(135deg,#fffaf0,#fff 52%,#f7e8d7)!important}
 html[data-py2-season="labour-day"] body{background-image:linear-gradient(145deg,#edf4ff,#fff 50%,#eaf1ff)!important}
 html[data-py2-season="youth-day"] body{background-image:linear-gradient(145deg,#e7faff,#fff 50%,#eaf6ff)!important}
 html[data-py2-season="farmers-day"] body{background-image:linear-gradient(145deg,#eaf5e5,#fff 48%,#f8f5df)!important}
 #py2-seasonal-banner{position:relative;z-index:30;display:flex;align-items:center;justify-content:center;gap:9px;flex-wrap:wrap;padding:11px 16px;text-align:center;background:linear-gradient(100deg,${p.banner},color-mix(in srgb,${p.banner} 75%,${p.accent}));color:#fff;font:750 13px/1.5 system-ui,sans-serif;box-shadow:0 5px 18px #10132212;border-bottom:1px solid #ffffff35}
 #py2-seasonal-banner .py2-season-symbol{font-size:18px;line-height:1}
 #py2-seasonal-banner .py2-season-copy{max-width:900px}
 #py2-seasonal-banner strong{color:#fff}
 #py2-seasonal-effects{position:fixed;inset:0;pointer-events:none;z-index:25;overflow:hidden}
 .py2-seasonal-particle{position:absolute;top:-8vh;left:var(--x);font-size:var(--s);opacity:var(--o);filter:drop-shadow(0 2px 3px #19321c20);animation:py2-season-fall var(--d) linear var(--delay) infinite;will-change:transform}
 @keyframes py2-season-fall{0%{transform:translate3d(0,-5vh,0) rotate(0deg)}50%{transform:translate3d(18px,52vh,0) rotate(100deg)}100%{transform:translate3d(-10px,112vh,0) rotate(220deg)}}
 #py2-seasonal-garland{position:fixed;top:0;left:0;right:0;z-index:26;height:37px;display:flex;align-items:flex-start;justify-content:space-around;pointer-events:none;overflow:hidden;opacity:.96;text-shadow:0 2px 4px #123a2a25}
 #py2-seasonal-garland:before{content:"";position:absolute;left:-2%;right:-2%;top:-15px;height:32px;border-bottom:3px solid #17653f;border-radius:0 0 50% 50%}
 #py2-seasonal-garland span{position:relative;margin-top:3px;font-size:clamp(15px,2.3vw,24px);filter:drop-shadow(0 2px 2px #173b2a22)}
 #py2-seasonal-side-decor{position:fixed;inset:0;z-index:24;pointer-events:none;overflow:hidden}
 #py2-seasonal-side-decor span{position:absolute;font-size:clamp(22px,4vw,42px);opacity:.76;filter:drop-shadow(0 3px 5px #173b2a20)}
 #py2-seasonal-side-decor span:nth-child(odd){left:8px;top:calc(18vh + var(--i)*7vh)}
 #py2-seasonal-side-decor span:nth-child(even){right:8px;top:calc(22vh + var(--i)*7vh)}
 #py2-seasonal-popup-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:18px;background:#101322b5;backdrop-filter:blur(7px)}
 #py2-seasonal-popup{position:relative;isolation:isolate;overflow:hidden;width:min(470px,100%);padding:30px 24px 25px;border:1px solid ${p.accent}55;border-radius:24px;background:linear-gradient(145deg,#fff 0%,${p.bg} 100%);color:#182033;text-align:center;box-shadow:0 28px 90px #0005}
 #py2-seasonal-popup:before{content:"";position:absolute;z-index:-1;inset:0 0 auto;height:7px;background:linear-gradient(90deg,${p.banner},${p.accent},${p.banner})}
 #py2-seasonal-popup .season-emoji{font-size:42px;line-height:1.35;letter-spacing:3px}
 #py2-seasonal-popup .season-ornaments{font-size:25px;letter-spacing:5px;margin:2px 0 10px}
 #py2-seasonal-popup h2{margin:8px 0;color:${p.banner};font-size:clamp(23px,5vw,29px);line-height:1.2}
 #py2-seasonal-popup p{line-height:1.65;color:#596579;margin:10px 0 20px}
 #py2-seasonal-popup button{border:0;border-radius:12px;padding:12px 19px;background:linear-gradient(110deg,${p.banner},color-mix(in srgb,${p.banner} 75%,${p.accent}));color:#fff;font-weight:850;box-shadow:0 6px 16px ${p.banner}30}
 @media(max-width:600px){#py2-seasonal-banner{padding:10px 12px;font-size:12px}#py2-seasonal-garland{height:30px}#py2-seasonal-garland span{font-size:16px}#py2-seasonal-side-decor span{font-size:24px}#py2-seasonal-side-decor span:nth-child(odd){left:2px}#py2-seasonal-side-decor span:nth-child(even){right:2px}}
 @media(prefers-reduced-motion:reduce){.py2-seasonal-particle{animation:none;display:none}}
 `;
 document.head.appendChild(style);
 if(c.banner&&c.title){const banner=document.createElement('div');banner.id='py2-seasonal-banner';const symbol=({christmas:'🎄',independence:'🇿🇲','black-friday':'✦','new-year':'✨',valentines:'💝',easter:'🐣','heroes-unity':'🇿🇲','africa-freedom':'🌍','labour-day':'🛠️','youth-day':'💡','farmers-day':'🌾'})[theme]||'✨';const icon=document.createElement('span');icon.className='py2-season-symbol';icon.textContent=symbol;const copy=document.createElement('span');copy.className='py2-season-copy';const title=document.createElement('strong');title.textContent=safe(c.title);const message=document.createElement('span');message.textContent=c.message?' — '+safe(c.message):'';copy.append(title,message);banner.append(icon,copy);document.body.prepend(banner);}
 if(c.effects&&!reduce){
  if(theme==='christmas'){
   makeDecor('py2-seasonal-garland',['🎄','🔴','🦌','✨','🎄','🟡','🎁','🎄','🔴','🦌','✨','🎄','🟡','🎁'],'');
   makeDecor('py2-seasonal-side-decor',['🦌','🎄','🎁','⭐','🦌','🎄'],'');
  }
  const fx=document.createElement('div');fx.id='py2-seasonal-effects';fx.setAttribute('aria-hidden','true');
  const particles={
   christmas:['❄️','❄️','✨','❄️','✦','❄️','✨','❄️'],
   independence:['✦','🇿🇲','✧','✦','✧','🇿🇲'],
   'black-friday':['✦','✧','✦','✧','✦'],
   'new-year':['✦','✨','✧','✨','✦','✨'],
   valentines:['♥','♡','♥','♡','♥'],
   easter:['✿','🌸','✧','🌼','✿'],
   'heroes-unity':['✦','🇿🇲','✧','✦'],
   'africa-freedom':['✦','🌍','✧','✦'],
   'labour-day':['✦','✧','🛠️','✦'],
   'youth-day':['✦','💡','✧','✦'],
   'farmers-day':['🍃','✧','🌿','🍃']
  };
  const list=particles[theme]||['✦','✧','✨','✦'];const count=theme==='christmas'?8:Math.min(7,list.length);
  for(let i=0;i<count;i++){const s=document.createElement('span');s.className='py2-seasonal-particle';s.textContent=list[i%list.length];s.style.setProperty('--x',((i*13.7+7)%94)+'%');s.style.setProperty('--s',(theme==='christmas'?12+(i%3)*5:12+(i%3)*4)+'px');s.style.setProperty('--d',(theme==='christmas'?19+(i%4)*5:22+(i%4)*5)+'s');s.style.setProperty('--delay',(-i*3.7)+'s');s.style.setProperty('--o',theme==='christmas'?'.42':'.28');fx.appendChild(s);}
  document.body.appendChild(fx);
 }
 if(c.popup&&c.title){
  let seen=false;try{seen=sessionStorage.getItem('py2-season-popup-'+theme+'-'+(c.updated_at||''))==='1';}catch(_){}
  if(!seen){const back=document.createElement('div');back.id='py2-seasonal-popup-backdrop';const card=document.createElement('section');card.id='py2-seasonal-popup';card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');const emoji=document.createElement('div');emoji.className='season-emoji';emoji.textContent=({christmas:'🎄🎁',independence:'🇿🇲', 'black-friday':'🖤✨','new-year':'🎆✨',valentines:'💝❤️',easter:'🐣🌷','heroes-unity':'🇿🇲🌿','africa-freedom':'🌍✨','labour-day':'🛠️⭐','youth-day':'💡🚀','farmers-day':'🌾🌱'})[theme]||'✨🎉';const ornaments=document.createElement('div');ornaments.className='season-ornaments';ornaments.textContent=theme==='christmas'?'🦌  🎄  🎁  🎄  🦌':theme==='independence'?'🟢  🟠  🔴  🇿🇲':'✦  ✧  ✦';const h=document.createElement('h2');h.textContent=safe(c.title);const ptag=document.createElement('p');ptag.textContent=safe(c.message||'Explore PhoneYa2 today.');const closeBtn=document.createElement('button');closeBtn.type='button';closeBtn.textContent='Continue shopping';card.append(emoji,ornaments,h,ptag,closeBtn);back.appendChild(card);
   const close=()=>{try{sessionStorage.setItem('py2-season-popup-'+theme+'-'+(c.updated_at||'') ,'1');}catch(_){}back.remove();};closeBtn.addEventListener('click',close);back.addEventListener('click',e=>{if(e.target===back)close();});document.body.appendChild(back);
  }
 }
}
window.PhoneYa2SeasonalTheme={apply};
fetch(endpoint,{headers:{accept:'application/json'}}).then(r=>r.ok?r.json():Promise.reject()).then(d=>apply(d.config)).catch(()=>{});
})();