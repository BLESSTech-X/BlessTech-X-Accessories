/* PhoneYa2 Partner Network — embeds the complete admin workspace in the existing Partners tab */
(()=>{'use strict';
const boot=()=>{
 const view=document.getElementById('view-network');
 if(!view||view.dataset.partnerAdminMounted)return false;
 view.dataset.partnerAdminMounted='1';
 const panel=document.createElement('section');panel.className='panel section py2-partner-workspace';
 panel.innerHTML='<div class="py2-partner-head"><div><span class="py2-partner-kicker">PARTNER NETWORK OPERATIONS</span><h2>Partner Network Control</h2><p>Manage accounts, campaigns, packages, partner websites, reports and performance here.</p></div><a class="btn" href="/partners-admin/index.html" target="_blank" rel="noopener">Open separately ↗</a></div><div class="py2-partner-shortcuts"><span>Business accounts</span><span>Campaign approvals</span><span>Package payments</span><span>Website moderation</span><span>Network analytics</span></div><iframe id="py2-partner-admin-frame" title="PhoneYa2 Partner Network Control" src="/partners-admin/index.html?embed=command-centre" loading="lazy"></iframe>';
 view.prepend(panel);
 document.querySelectorAll('[data-open-partner-workspace]').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();document.getElementById('tab-network')?.click();}));
 window.addEventListener('message',e=>{
  const frame=document.getElementById('py2-partner-admin-frame');
  if(e.origin!==location.origin||e.source!==frame?.contentWindow)return;
  if(e.data?.type==='py2-partner-admin-height'&&Number.isFinite(e.data.height))frame.style.height=Math.max(950,Math.min(12000,e.data.height))+'px';
 });
 return true;
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{let n=0;const t=setInterval(()=>{if(boot()||++n>100)clearInterval(t)},250);});
else {let n=0;const t=setInterval(()=>{if(boot()||++n>100)clearInterval(t)},250);}
})();