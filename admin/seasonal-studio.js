/* PhoneYa2 Seasonal Studio — campaign controls only; creative content stays in GitHub. */
(() => {
 'use strict';
 const SEASONS=['christmas','valentines','easter','halloween','black-friday','new-year','mothers-day','fathers-day','back-to-school','summer','independence'];
 const LABELS={'christmas':'Christmas 🎄','valentines':"Valentine's Day 💗",'easter':'Easter 🐣','halloween':'Halloween 🎃','black-friday':'Black Friday 🏷️','new-year':'New Year 🎆','mothers-day':"Mother's Day 💐",'fathers-day':"Father's Day 🎁",'back-to-school':'Back to School 🎒','summer':'Summer ☀️','independence':'Zambian Independence 🇿🇲'};
 const KEYS=['enabled','theme','decorations','snow','snowIntensity','scheduled','start','end','coverage','popup','popupMode','popupDelay','popupScroll','banner'];
 const DEFAULTS={enabled:false,theme:'christmas',decorations:true,snow:false,snowIntensity:24,scheduled:false,start:'2026-11-15',end:'2026-12-27',coverage:'all',popup:false,popupMode:'delay',popupDelay:5,popupScroll:35,banner:true};
 const $=id=>document.getElementById(id);
 let settings={...DEFAULTS},mounted=false,loading=false;
 function setStatus(message,type='info'){const el=$('seasonal-status');if(el){el.textContent=message;el.dataset.type=type;}}
 function field(label,id,type='text'){return '<label class="ss-field"><span>'+label+'</span><input id="'+id+'" type="'+type+'" autocomplete="off"></label>';}
 function select(label,id,options){return '<label class="ss-field"><span>'+label+'</span><select id="'+id+'">'+options.map(o=>'<option value="'+o[0]+'">'+o[1]+'</option>').join('')+'</select></label>';}
 function toggle(label,id){return '<label class="ss-toggle"><input id="'+id+'" type="checkbox"><span>'+label+'</span></label>';}
 function ensureWorkspace(){
  if(mounted)return true;
  const nav=$('workspace-nav'),host=$('workspace-views');if(!nav||!host)return false;
  const hiddenTabs=['actions','money','health','experiments','resources'];
  hiddenTabs.forEach(id=>{const b=$('tab-'+id);if(b)b.classList.add('ss-secondary-tab');});
  const more=document.createElement('div');more.className='ss-more';
  more.innerHTML='<button type="button" class="workspace-tab ss-more-button" aria-expanded="false">More <span>⌄</span></button><div class="ss-more-menu" hidden></div>';
  hiddenTabs.forEach(id=>{const source=$('tab-'+id);if(!source)return;const item=document.createElement('button');item.type='button';item.textContent=source.textContent.replace(/^[^A-Za-z0-9]+/,'');item.addEventListener('click',()=>{source.click();more.querySelector('.ss-more-menu').hidden=true;more.querySelector('.ss-more-button').setAttribute('aria-expanded','false');});more.querySelector('.ss-more-menu').append(item);});
  const moreButton=more.querySelector('.ss-more-button');moreButton.addEventListener('click',()=>{const menu=more.querySelector('.ss-more-menu');menu.hidden=!menu.hidden;moreButton.setAttribute('aria-expanded',String(!menu.hidden));});
  const tab=document.createElement('button');tab.type='button';tab.className='workspace-tab';tab.id='tab-seasonal-studio';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.textContent='Seasonal Studio';
  const panel=document.createElement('section');panel.className='workspace-view';panel.id='view-seasonal-studio';panel.setAttribute('role','tabpanel');panel.hidden=true;
  panel.innerHTML='<div class="ss-heading"><div><div class="ss-kicker">CAMPAIGN MANAGEMENT</div><h2>Seasonal Studio</h2><p>Switch seasons and control when the campaign appears. Creative content stays managed in GitHub.</p></div><div class="ss-heading-actions"><button class="btn" id="ss-preview" type="button">Preview storefront</button><button class="btn primary" id="ss-save" type="button">Save campaign settings</button></div></div><div id="seasonal-status" class="ss-status" role="status">Loading campaign settings…</div><section class="ss-card ss-control-card"><div class="ss-section-intro"><div><h3>Campaign controls</h3><p class="ss-help">Choose the season, schedule and storefront behaviour.</p></div><span class="ss-source-note">CONTENT: GITHUB</span></div><div class="ss-form-grid ss-primary-controls">'+select('Active season','ss-active-season',SEASONS.map(k=>[k,LABELS[k]]))+select('Page coverage','ss-coverage',[['all','All pages'],['shopping','Shopping pages'],['content','Content pages']])+field('Start date','ss-start','date')+field('End date','ss-end','date')+'</div><div class="ss-toggle-grid">'+toggle('Campaign enabled','ss-enabled')+toggle('Schedule campaign','ss-scheduled')+toggle('Show seasonal banner','ss-banner')+toggle('Show popup','ss-popup')+toggle('Decorations on headings','ss-decorations')+toggle('Falling snow','ss-snow')+'</div><div class="ss-advanced-controls"><h4>Display behaviour</h4><div class="ss-form-grid">'+select('Popup trigger','ss-popup-mode',[['delay','After a delay'],['immediate','Immediately'],['scroll','After scrolling']])+field('Popup delay (seconds)','ss-popup-delay','number')+field('Scroll threshold (%)','ss-popup-scroll','number')+field('Snow intensity','ss-snow-intensity','number')+'</div></div></section><p class="ss-footer-note">Season headings, messages, images, buttons and decorations are loaded directly from the published GitHub season files. This workspace does not edit them.</p>';
  host.append(panel);nav.append(tab);nav.append(more);
  function activate(){nav.querySelectorAll('[role=tab]').forEach(b=>{b.setAttribute('aria-selected',String(b===tab));b.tabIndex=b===tab?0:-1;});host.querySelectorAll('[role=tabpanel]').forEach(p=>p.hidden=p!==panel);panel.hidden=false;tab.scrollIntoView({block:'nearest',behavior:'smooth'});if(!loading)load();}
  tab.addEventListener('click',activate);
  $('ss-save').addEventListener('click',save);$('ss-preview').addEventListener('click',preview);
  $('ss-active-season').addEventListener('change',e=>{settings.theme=e.target.value;setStatus(LABELS[e.target.value]+' selected. Save campaign settings to apply the switch.','info');});
  mounted=true;return true;
 }
 function pickControls(source){const out={...DEFAULTS};KEYS.forEach(k=>{if(source&&Object.prototype.hasOwnProperty.call(source,k))out[k]=source[k];});return out;}
 function fill(){
  const s={...DEFAULTS,...settings};
  const map={enabled:'ss-enabled',scheduled:'ss-scheduled',banner:'ss-banner',popup:'ss-popup',decorations:'ss-decorations',snow:'ss-snow'};
  Object.entries(map).forEach(([key,id])=>$(id).checked=!!s[key]);
  $('ss-active-season').value=SEASONS.includes(s.theme)?s.theme:'christmas';$('ss-coverage').value=s.coverage||'all';
  $('ss-start').value=s.start||'';$('ss-end').value=s.end||'';
  $('ss-popup-mode').value=s.popupMode||'delay';$('ss-popup-delay').value=Number(s.popupDelay??5);
  $('ss-popup-scroll').value=Number(s.popupScroll??35);$('ss-snow-intensity').value=Number(s.snowIntensity??24);
 }
 async function load(){
  if(loading)return;loading=true;setStatus('Loading saved campaign controls…');
  try{
   let response=await fetch('/api/seasonal?v='+Date.now(),{cache:'no-store',credentials:'same-origin'});
   if(response.ok){const data=await response.json();settings=pickControls(data.settings||{});setStatus('Connected to shared campaign settings.','success');}
   else{
    response=await fetch('/content/settings/seasonal-campaigns.json?v='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw new Error('Campaign settings could not be loaded.');
    settings=pickControls(await response.json());setStatus('Loaded published settings. Save once to connect the shared campaign controls.','info');
   }
   fill();
  }catch(error){setStatus('Could not load campaign settings: '+error.message,'error');fill();}
  finally{loading=false;}
 }
 function collect(){
  const next={...settings,enabled:$('ss-enabled').checked,theme:$('ss-active-season').value,coverage:$('ss-coverage').value,start:$('ss-start').value,end:$('ss-end').value,scheduled:$('ss-scheduled').checked,banner:$('ss-banner').checked,popup:$('ss-popup').checked,decorations:$('ss-decorations').checked,snow:$('ss-snow').checked,popupMode:$('ss-popup-mode').value,popupDelay:Number($('ss-popup-delay').value||0),popupScroll:Number($('ss-popup-scroll').value||35),snowIntensity:Number($('ss-snow-intensity').value||0)};
  return pickControls(next);
 }
 function preview(){
  const draft=collect();draft.enabled=true;
  try{localStorage.setItem('phoneya2-seasonal-preview-v3',JSON.stringify(draft));window.open('/?py2-seasonal-preview=1','_blank','noopener');setStatus('Storefront preview opened. Your saved campaign has not been changed.','success');}
  catch(error){setStatus('Could not open preview: '+error.message,'error');}
 }
 async function save(){
  const token=window.PY2_SEASONAL_AUTH_TOKEN;if(!token){setStatus('Your admin session is missing. Sign out and back into Command Centre.','error');return;}
  const next=collect();
  if(next.scheduled&&(!next.start||!next.end)){setStatus('Choose both a start date and an end date before scheduling the campaign.','error');return;}
  if(next.scheduled&&next.end<next.start){setStatus('The end date must be on or after the start date.','error');return;}
  const button=$('ss-save');button.disabled=true;setStatus('Saving campaign controls…');
  try{
   const response=await fetch('/api/seasonal',{method:'PUT',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({settings:next})});
   const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Save failed.');
   settings=next;setStatus('Saved. The storefront will use the selected GitHub season content and these campaign controls.','success');
  }catch(error){setStatus(error.message,'error');}
  finally{button.disabled=false;}
 }
 function init(){if(!ensureWorkspace())return;load();}
 window.addEventListener('py2-admin-ready',init);if(window.PY2_SEASONAL_AUTH_TOKEN)init();
})();