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
#partner-featured-grid .py2-inline-editorial{overflow:hidden;border:2px solid #c9e3d2;border-left:5px solid #159447;border-radius:15px;background:linear-gradient(110deg,#fff 0%,#f7fcf8 100%);box-shadow:0 7px 22px rgba(18,43,74,.11);max-width:100%;margin:0}
#partner-featured-grid .py2-inline-editorial-link{display:grid;grid-template-columns:clamp(104px,18%,180px) minmax(0,1fr);align-items:stretch;min-height:138px;color:#14243a;text-decoration:none}
#partner-featured-grid .py2-inline-editorial-link:not(:has(>img)){grid-template-columns:minmax(0,1fr)}
#partner-featured-grid .py2-inline-editorial-link>img{display:block;width:100%;height:100%;min-height:138px;max-height:168px;object-fit:cover;background:#edf4fb}
#partner-featured-grid .py2-inline-editorial-copy{display:flex;flex-direction:column;justify-content:center;gap:6px;padding:14px 17px;min-width:0}
#partner-featured-grid .py2-inline-editorial-copy>span{font-size:9px;font-weight:900;letter-spacing:.9px;color:#159447}
#partner-featured-grid .py2-inline-editorial-copy strong{font-size:clamp(14px,1.6vw,17px);line-height:1.3;color:#14243a}
#partner-featured-grid .py2-inline-editorial-copy p{margin:0;color:#607187;font-size:12px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#partner-featured-grid .py2-inline-editorial-copy b{font-size:11px;color:#e65b00}
#partner-featured-grid .py2-inline-editorial:hover{border-color:#a8d4b7;box-shadow:0 10px 25px rgba(18,43,74,.14);transform:translateY(-1px)}
@media(max-width:520px){
#partner-featured-grid .py2-inline-editorial-link{grid-template-columns:88px minmax(0,1fr);min-height:116px}
#partner-featured-grid .py2-inline-editorial-link>img{min-height:116px;max-height:132px}
#partner-featured-grid .py2-inline-editorial-copy{padding:10px 12px;gap:5px}
}
`;
document.head.appendChild(style);
fetch('/api/community',{headers:{accept:'application/json'},cache:'no-store'})
.then(r=>r.json())
.then(data=>{
 if(!data.ok)throw Error('Unable to load partner stories');
 const posts=(data.posts||[]).filter(p=>Number(p.is_featured)===1).slice(0,4);
 if(!posts.length){root.hidden=true;return}
 grid.innerHTML=posts.map(p=>{
  const href=p.business_slug?'/b/'+encodeURIComponent(p.business_slug)+'/':'/community/';
  const image=p.cover_image_url?'<img src="'+esc(p.cover_image_url)+'" alt="'+esc(p.title||'Partner story')+'" loading="lazy" decoding="async">':'';
  return '<article class="py2-inline-editorial py2-inline-editorial-partner"><a class="py2-inline-editorial-link" href="'+href+'">'+image+'<div class="py2-inline-editorial-copy"><span>PHONEYA2 PARTNER SPOTLIGHT</span><strong>'+esc(p.title||'A story from our business community')+'</strong><p>'+esc(p.excerpt||p.body||'Discover this PhoneYa2 business partner and what they offer.').slice(0,125)+'</p><b>Discover partner ↗</b></div></a></article>';
 }).join('');
 root.hidden=false;
})
.catch(e=>console.warn('Partner featured stories:',e.message));
})();