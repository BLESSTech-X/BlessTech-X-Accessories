(()=>{"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
let mounted=false,loading=false;
async function api(payload){
 const r=await fetch("/api/admin-work-queue",{method:payload?"POST":"GET",credentials:"same-origin",headers:{"content-type":"application/json"},body:payload?JSON.stringify(payload):undefined});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not load prepared work.");return d;
}
function card(item){
 const image=item.image_url?'<img class="work-thumb" src="'+esc(item.image_url)+'" alt="" loading="lazy" onerror="this.hidden=true">':'<div class="work-thumb work-placeholder" aria-hidden="true">✦</div>';
 const link=esc(item.action_url||item.destination||"/admin/communications.html");
 return '<article class="work-item" data-id="'+esc(item.id)+'">'+image+'<div class="work-copy"><div class="work-kicker">'+esc(item.category||"operations")+' · '+esc(item.priority||"normal")+'</div><strong>'+esc(item.title)+'</strong><p>'+esc(item.message)+'</p><div class="work-actions"><a class="work-open" href="'+link+'">Review work →</a><button type="button" data-work-action="complete">Done</button><button type="button" data-work-action="ignore">Ignore</button></div></div></article>';
}
async function load(host){
 if(loading)return;loading=true;host.querySelector(".work-list").innerHTML='<p class="work-muted">Checking new work…</p>';
 try{
  const d=await api(),items=Array.isArray(d.items)?d.items:[];
  host.querySelector("[data-count=pending]").textContent=String(d.summary?.pending||0);
  host.querySelector("[data-count=approved]").textContent=String(d.summary?.approved||0);
  host.querySelector("[data-count=completed]").textContent=String(d.summary?.completed||0);
  host.querySelector(".work-list").innerHTML=items.length?items.map(card).join(""):'<div class="work-empty"><strong>You are all caught up.</strong><p>New products, published articles and operational alerts will appear here when there is work to review.</p></div>';
 }catch(e){host.querySelector(".work-list").innerHTML='<div class="work-error">'+esc(e.message)+'</div>';}
 finally{loading=false;}
}
function mount(){
 if(mounted)return;const target=document.getElementById("view-actions");if(!target)return;
 mounted=true;
 const style=document.createElement("style");style.textContent='.work-queue{background:#fff;border:1px solid #e5e9f0;border-radius:16px;padding:18px;margin:0 0 16px;box-shadow:0 8px 24px #14213b08}.work-queue-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:13px}.work-queue h2{margin:0;font-size:18px}.work-queue .work-muted,.work-queue p{color:#737c90;font-size:12px}.work-metrics{display:flex;gap:8px;flex-wrap:wrap}.work-metric{background:#f4f6fa;border-radius:9px;padding:8px 11px;font-size:11px;color:#626c80}.work-metric b{font-size:16px;color:#151827;margin-right:5px}.work-list{display:grid;gap:9px}.work-item{display:grid;grid-template-columns:66px minmax(0,1fr);gap:12px;padding:12px;border:1px solid #e8ebf2;border-radius:12px;background:#fff}.work-thumb{width:66px;height:66px;object-fit:cover;border-radius:10px;background:#f1f3f8}.work-placeholder{display:grid;place-items:center;font-size:24px;color:#ff6500}.work-kicker{text-transform:uppercase;font-size:9px;font-weight:900;letter-spacing:1px;color:#8a91a1;margin-bottom:3px}.work-copy>strong{font-size:13px}.work-copy>p{margin:4px 0 8px}.work-actions{display:flex;gap:7px;flex-wrap:wrap}.work-actions a,.work-actions button,.work-refresh{border:1px solid #e2e6ee;border-radius:8px;padding:7px 10px;font-size:11px;font-weight:850;background:#fff;cursor:pointer}.work-actions a{background:#fff2e9;border-color:#ffd8c0;color:#a94300}.work-actions button[data-work-action=ignore]{color:#a52b37}.work-empty,.work-error{padding:22px;text-align:center;border:1px dashed #dfe4ed;border-radius:12px}.work-error{color:#a52b37;background:#fff4f4}.work-refresh{background:#151827;color:#fff;border-color:#151827}@media(max-width:520px){.work-item{grid-template-columns:52px minmax(0,1fr);gap:9px}.work-thumb{width:52px;height:52px}.work-queue{padding:13px}}';document.head.append(style);
 const section=document.createElement("section");section.className="work-queue";section.innerHTML='<div class="work-queue-head"><div><div class="eyebrow">PHONEYA2 BUSINESS OPERATIONS</div><h2>Work prepared for you</h2><p>Review what the system has already prepared. Nothing is emailed or published without your approval.</p></div><button class="work-refresh" type="button">Refresh work</button></div><div class="work-metrics"><span class="work-metric"><b data-count="pending">—</b>To review</span><span class="work-metric"><b data-count="approved">—</b>Approved</span><span class="work-metric"><b data-count="completed">—</b>Completed</span></div><div class="work-list" aria-live="polite" style="margin-top:12px"></div>';
 target.prepend(section);section.addEventListener("click",async e=>{
  if(e.target.closest(".work-refresh")){load(section);return;}
  const button=e.target.closest("[data-work-action]");if(!button)return;
  const item=button.closest(".work-item");button.disabled=true;
  try{await api({action:button.dataset.workAction,id:item.dataset.id});item.remove();const list=section.querySelector(".work-list");if(!list.querySelector(".work-item"))list.innerHTML='<div class="work-empty"><strong>You are all caught up.</strong><p>No prepared work is waiting for review.</p></div>';await load(section);}
  catch(err){button.disabled=false;alert(err.message);}
 });
 load(section);
}
document.addEventListener("py2-admin-ready",mount);
const observer=new MutationObserver(()=>{if(document.getElementById("view-actions"))mount();});
observer.observe(document.documentElement,{childList:true,subtree:true});
mount();
setTimeout(()=>observer.disconnect(),15000);
})();