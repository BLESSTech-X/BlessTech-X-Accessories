(()=> {
'use strict';
const root=document.getElementById('partner-featured-stories');
const grid=document.getElementById('partner-featured-grid');
if(!root||!grid)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const style=document.createElement('style');
style.textContent=`
/* Partner features on Blog use the same compact editorial treatment as homepage inserts. */
#partner-featured-grid{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:12px!important}
#partner-featured-grid .py2-inline-editorial{position:relative;overflow:hidden;border:1px solid rgba(148,163,184,.28);border-left:5px solid #22c55e;border-radius:16px;background:linear-gradient(125deg,#10251f 0%,#123b35 58%,#172033 100%);box-shadow:0 12px 30px rgba(2,8,23,.24);max-width:100%;margin:0;isolation:isolate}
#partner-featured-grid .py2-inline-editorial:after{content:"";position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,#22c55e,#38bdf8,#f59e0b);pointer-events:none}
#partner-featured-grid .py2-inline-editorial-link{display:grid;grid-template-columns:clamp(104px,18%,180px) minmax(0,1fr);align-items:stretch;min-height:142px;color:#fff;text-decoration:none}
#partner-featured-grid .py2-inline-editorial-link:not(:has(>img)){grid-template-columns:minmax(0,1fr)}
#partner-featured-grid .py2-inline-editorial-link>img{display:block;width:100%;height:100%;min-height:142px;max-height:174px;object-fit:cover;background:#0f172a}
#partner-featured-grid .py2-inline-editorial-copy{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:7px;padding:15px 18px;min-width:0}
#partner-featured-grid .py2-inline-editorial-copy>span{font-size:9px;font-weight:900;letter-spacing:1.1px;color:#86efac}
#partner-featured-grid .py2-inline-editorial-copy strong{font-size:clamp(14px,1.6vw,18px);line-height:1.3;color:#fff}
#partner-featured-grid .py2-inline-editorial-copy p{margin:0;color:#cbd5e1;font-size:12px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#partner-featured-grid .py2-inline-editorial-copy b{display:inline-flex;align-items:center;justify-content:center;margin-top:3px;padding:8px 13px;border-radius:9px;background:linear-gradient(110deg,#059669,#16a34a);border:1px solid rgba(255,255,255,.18);color:#fff;font-size:11px;font-weight:900;box-shadow:0 5px 14px rgba(5,150,105,.25)}
#partner-featured-grid .py2-inline-editorial:hover{border-color:#4ade80;box-shadow:0 14px 32px rgba(2,8,23,.32);transform:translateY(-1px)}
@media(max-width:520px){
#partner-featured-grid .py2-inline-editorial-link{grid-template-columns:88px minmax(0,1fr);min-height:120px}
#partner-featured-grid .py2-inline-editorial-link>img{min-height:120px;max-height:136px}
#partner-featured-grid .py2-inline-editorial-copy{padding:11px 12px;gap:6px}
}
`;
document.head.appendChild(style);
fetch('/api/community',{headers:{accept:'application/json'},cache:'no-store'})
.then(r=>r.json())
.then(data=>{
 if(!data.ok)throw Error('Unable to load partner stories');
 const posts=(data.posts||[]).filter(p=>Number(p.is_featured)===1).slice(0,12);
 window.PhoneYa2FeaturedPartnerPosts=posts;
 root.hidden=true;
 document.dispatchEvent(new CustomEvent('phoneya2:featured-partners-ready'));
})
.catch(e=>console.warn('Partner featured stories:',e.message));
})();