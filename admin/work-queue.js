(()=>{"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
let mounted=false,loading=false,baselineReady=false,knownItems={},popupQueue=[],popupTimer=null,workSound=false,workAudio=null;
const KNOWN_KEY="py2_admin_work_known_v1",SOUND_KEY="py2_admin_work_sound_v1";
try{knownItems=JSON.parse(localStorage.getItem(KNOWN_KEY)||"{}")||{};baselineReady=localStorage.getItem(KNOWN_KEY)!==null;workSound=localStorage.getItem(SOUND_KEY)==="1";}catch{}
async function api(payload){
 const r=await fetch("/api/admin-work-queue",{method:payload?"POST":"GET",credentials:"same-origin",headers:{"content-type":"application/json"},body:payload?JSON.stringify(payload):undefined});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not load prepared work.");return d;
}
function card(item){
 const image=item.image_url?'<img class="work-thumb" src="'+esc(item.image_url)+'" alt="" loading="lazy" onerror="this.hidden=true">':'<div class="work-thumb work-placeholder" aria-hidden="true">✦</div>';
 const link=esc(item.action_url||item.destination||"/admin/communications.html");
 return '<article class="work-item" data-id="'+esc(item.id)+'">'+image+'<div class="work-copy"><div class="work-kicker">'+esc(item.category||"operations")+' · '+esc(item.priority||"normal")+'</div><strong>'+esc(item.title)+'</strong><p>'+esc(item.message)+'</p><div class="work-actions"><a class="work-open" href="'+link+'">Review work →</a><button type="button" data-work-action="complete">Done</button><button type="button" data-work-action="ignore">Ignore</button></div></div></article>';
}
function ensureWorkAudio(){if(workAudio)return;const A=window.AudioContext||window.webkitAudioContext;if(A){try{workAudio=new A();if(workAudio.state==="suspended")workAudio.resume();}catch{}}}
function workDing(){if(!workSound||!workAudio)return;try{const c=workAudio,o=c.createOscillator(),g=c.createGain();o.type="sine";o.frequency.setValueAtTime(740,c.currentTime);o.frequency.exponentialRampToValueAtTime(1110,c.currentTime+.12);g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.1,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.34);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.35);}catch{}}
function showWorkPopup(item){
 if(document.querySelector(".work-alert-popup"))return;
 const box=document.createElement("aside");box.dataset.workId=String(item.id);box.className="work-alert-popup";box.setAttribute("role","status");box.setAttribute("aria-live","polite");
 const copy=document.createElement("div"),tag=document.createElement("small"),title=document.createElement("strong"),message=document.createElement("p"),actions=document.createElement("div"),open=document.createElement("a"),close=document.createElement("button");
 tag.textContent="NEW JOB · "+String(item.category||"OPERATIONS").toUpperCase();title.textContent=item.title||"New work needs attention";message.textContent=item.message||"A new prepared task is waiting in the Command Centre.";
 open.href=item.action_url||item.destination||"/admin/communications.html";open.textContent="Review job →";close.type="button";close.textContent="×";close.setAttribute("aria-label","Dismiss alert");
 actions.append(open);copy.append(tag,title,message,actions);box.append(copy,close);document.body.append(box);workDing();
 try{knownItems[String(item.id)]=1;knownItems=Object.fromEntries(Object.entries(knownItems).slice(-300));localStorage.setItem(KNOWN_KEY,JSON.stringify(knownItems));}catch{}
 close.addEventListener("click",()=>{box.remove();setTimeout(processWorkPopups,450);});
 popupTimer=setTimeout(()=>{box.remove();setTimeout(processWorkPopups,450);},8500);
}
function processWorkPopups(){if(!popupQueue.length||document.querySelector(".work-alert-popup"))return;const item=popupQueue.shift();popupTimer=setTimeout(()=>showWorkPopup(item),500);}
function detectNewWork(items){
 const ids=items.map(x=>String(x.id));
 if(!baselineReady){ids.forEach(id=>knownItems[id]=1);baselineReady=true;try{localStorage.setItem(KNOWN_KEY,JSON.stringify(knownItems));}catch{}return;}
 const queued=new Set(popupQueue.map(x=>String(x.id)));const active=document.querySelector(".work-alert-popup")?.dataset.workId;if(active)queued.add(active);
 const fresh=items.filter(x=>x&&x.id&&!knownItems[String(x.id)]&&!queued.has(String(x.id)));
 fresh.forEach(x=>popupQueue.push(x));processWorkPopups();
}
async function load(host,detect=true){
 if(loading)return;loading=true;host.querySelector(".work-list").innerHTML='<p class="work-muted">Checking new work…</p>';
 try{
  const d=await api(),items=Array.isArray(d.items)?d.items:[];
  host.querySelector("[data-count=pending]").textContent=String(d.summary?.pending||0);
  host.querySelector("[data-count=approved]").textContent=String(d.summary?.approved||0);
  host.querySelector("[data-count=completed]").textContent=String(d.summary?.completed||0);
  host.querySelector(".work-list").innerHTML=items.length?items.map(card).join(""):'<div class="work-empty"><span class="work-empty-icon">✓</span><strong>Nothing needs your attention right now.</strong><p>Your work queue is clear. When a product, campaign, customer issue or operational task needs action, it will appear here with a clear next step.</p></div>';
  if(detect)detectNewWork(items);
 }catch(e){host.querySelector(".work-list").innerHTML='<div class="work-error">'+esc(e.message)+'</div>';}
 finally{loading=false;}
}
function mount(){
 if(mounted)return;const target=document.getElementById("view-actions");if(!target)return;
 mounted=true;
 const style=document.createElement("style");style.textContent='.work-queue{background:#fff;border:1px solid #e5e9f0;border-radius:16px;padding:18px;margin:0 0 16px;box-shadow:0 8px 24px #14213b08}.work-queue-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:13px}.work-tools{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.work-queue h2{margin:0;font-size:18px}.work-queue .work-muted,.work-queue p{color:#737c90;font-size:12px}.work-metrics{display:flex;gap:8px;flex-wrap:wrap}.work-metric{background:#f4f6fa;border-radius:9px;padding:8px 11px;font-size:11px;color:#626c80}.work-metric b{font-size:16px;color:#151827;margin-right:5px}.work-list{display:grid;gap:9px}.work-item{display:grid;grid-template-columns:66px minmax(0,1fr);gap:12px;padding:12px;border:1px solid #e8ebf2;border-radius:12px;background:#fff}.work-thumb{width:66px;height:66px;object-fit:cover;border-radius:10px;background:#f1f3f8}.work-placeholder{display:grid;place-items:center;font-size:24px;color:#ff6500}.work-kicker{text-transform:uppercase;font-size:9px;font-weight:900;letter-spacing:1px;color:#8a91a1;margin-bottom:3px}.work-copy>strong{font-size:13px}.work-copy>p{margin:4px 0 8px}.work-actions{display:flex;gap:7px;flex-wrap:wrap}.work-actions a,.work-actions button,.work-refresh{border:1px solid #e2e6ee;border-radius:8px;padding:7px 10px;font-size:11px;font-weight:850;background:#fff;cursor:pointer}.work-actions a{background:#fff2e9;border-color:#ffd8c0;color:#a94300}.work-actions button[data-work-action=ignore]{color:#a52b37}.work-empty,.work-error{padding:26px 22px;text-align:center;border:1px dashed #dfe4ed;border-radius:12px}.work-empty strong{display:block;font-size:15px;color:#176b4b}.work-empty p{max-width:520px;margin:6px auto 0;line-height:1.6}.work-empty-icon{display:grid;place-items:center;width:38px;height:38px;margin:0 auto 10px;border-radius:50%;background:#e8f8ef;color:#168456;font-size:20px;font-weight:900}.work-error{color:#a52b37;background:#fff4f4}.work-alert-popup{position:fixed;z-index:10020;top:88px;right:20px;width:min(390px,calc(100vw - 28px));display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:16px;background:#fff;border:1px solid #dce5f2;border-left:4px solid #3478f6;border-radius:14px;box-shadow:0 18px 55px #10182830;animation:workAlertIn .22s ease-out}.work-alert-popup small{display:block;color:#3478f6;font-size:9px;font-weight:950;letter-spacing:1px}.work-alert-popup strong{display:block;margin-top:4px;font-size:14px}.work-alert-popup p{margin:5px 0 9px;font-size:12px;line-height:1.5;color:#687386}.work-alert-popup a{font-size:11px;font-weight:900;color:#245fc4}.work-alert-popup>button{border:0;border-radius:7px;background:#f1f4f8;color:#526078;width:28px;height:28px;font-size:18px;cursor:pointer}@keyframes workAlertIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}@media(max-width:580px){.work-alert-popup{top:76px;right:10px;width:calc(100vw - 20px)}}.work-sound{border:1px solid #e2e6ee;border-radius:8px;padding:7px 10px;font-size:10px;font-weight:850;background:#f8fafc;color:#526078;cursor:pointer}.work-sound[aria-pressed=true]{background:#e8f8ef;border-color:#b8e8ce;color:#116a45}.work-refresh{background:#151827;color:#fff;border-color:#151827}@media(max-width:520px){.work-item{grid-template-columns:52px minmax(0,1fr);gap:9px}.work-thumb{width:52px;height:52px}.work-queue{padding:13px}}';document.head.append(style);
 const section=document.createElement("section");section.className="work-queue";section.innerHTML='<div class="work-queue-head"><div><div class="eyebrow">PHONEYA2 BUSINESS OPERATIONS</div><h2>Work prepared for you</h2><p>Review what the system has already prepared. Nothing is emailed or published without your approval.</p></div><div class="work-tools"><button class="work-sound" type="button" aria-pressed="false">🔕 Sound off</button><button class="work-refresh" type="button">Refresh work</button></div></div><div class="work-metrics"><span class="work-metric"><b data-count="pending">—</b>To review</span><span class="work-metric"><b data-count="approved">—</b>Approved</span><span class="work-metric"><b data-count="completed">—</b>Completed</span></div><div class="work-list" aria-live="polite" style="margin-top:12px"></div>';
 target.prepend(section);
 document.addEventListener("click",()=>{if(workSound)ensureWorkAudio();},{once:true});
 section.querySelector(".work-sound").setAttribute("aria-pressed",String(workSound));section.querySelector(".work-sound").textContent=workSound?"🔔 Sound on":"🔕 Sound off";
 section.querySelector(".work-sound").addEventListener("click",()=>{workSound=!workSound;try{localStorage.setItem(SOUND_KEY,workSound?"1":"0");}catch{}if(workSound)ensureWorkAudio();section.querySelector(".work-sound").setAttribute("aria-pressed",String(workSound));section.querySelector(".work-sound").textContent=workSound?"🔔 Sound on":"🔕 Sound off";});
 section.addEventListener("click",async e=>{
  if(e.target.closest(".work-refresh")){load(section,true);return;}
  const button=e.target.closest("[data-work-action]");if(!button)return;
  const item=button.closest(".work-item");button.disabled=true;
  try{await api({action:button.dataset.workAction,id:item.dataset.id});item.remove();await load(section,false);}
  catch(err){button.disabled=false;alert(err.message);}
 });
 load(section,true);
 setInterval(()=>{if(!document.hidden)load(section,true);},45000);
}
document.addEventListener("py2-admin-ready",mount);
const observer=new MutationObserver(()=>{if(document.getElementById("view-actions"))mount();});
observer.observe(document.documentElement,{childList:true,subtree:true});
mount();
setTimeout(()=>observer.disconnect(),15000);
})();