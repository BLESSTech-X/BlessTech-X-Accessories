/* PhoneYa2 Partner Network — integrated Command Centre workspace */
(()=>{'use strict';
const boot=()=>{
 const nav=document.getElementById('workspace-nav'),views=document.getElementById('workspace-views'),modal=document.getElementById('workspace-modal');
 if(!nav||!views||!modal||document.getElementById('tab-partners'))return false;
 const tab=document.createElement('button');tab.type='button';tab.id='tab-partners';tab.className='workspace-tab';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.tabIndex=-1;tab.textContent='🤝 Partners';
 const view=document.createElement('section');view.id='view-partners';view.className='workspace-view';view.hidden=true;
 view.innerHTML='<div class="panel section py2-partner-workspace"><div class="py2-partner-head"><div><span class="py2-partner-kicker">PARTNER NETWORK OPERATIONS</span><h2>Partner Network Control</h2><p>Partners, campaigns, packages, websites, reports and performance — all in one place.</p></div><a class="btn" href="/partners-admin/index.html" target="_blank" rel="noopener">Open separately ↗</a></div><div class="py2-partner-shortcuts"><span>Business accounts</span><span>Campaign approvals</span><span>Package payments</span><span>Website moderation</span><span>Network analytics</span></div><iframe id="py2-partner-admin-frame" title="PhoneYa2 Partner Network Control" src="/partners-admin/index.html?embed=command-centre" loading="lazy"></iframe></div>';
 nav.append(tab);views.append(view);
 const activate=()=>{
  nav.querySelectorAll('[role="tab"]').forEach(b=>{const on=b===tab;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
  views.querySelectorAll('.workspace-view').forEach(v=>v.hidden=v!==view);
  localStorage.setItem('phoneya2_cc_last_tab','partners');
  localStorage.setItem('phoneya2_cc_tab_partners',String(Date.now()));
  window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 };
 tab.addEventListener('click',activate);
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==document.getElementById('py2-partner-admin-frame')?.contentWindow)return;
  if(e.data?.type==='py2-partner-admin-height'&&Number.isFinite(e.data.height)){
   const frame=document.getElementById('py2-partner-admin-frame');if(frame)frame.style.height=Math.max(950,Math.min(12000,e.data.height))+'px';
  }
 });
 if(localStorage.getItem('phoneya2_cc_last_tab')==='partners')activate();
 return true;
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{let n=0;const t=setInterval(()=>{if(boot()||++n>80)clearInterval(t)},250);});
else {let n=0;const t=setInterval(()=>{if(boot()||++n>80)clearInterval(t)},250);}
})();