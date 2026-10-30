/* PhoneYa2 Seasonal Studio — Command Centre workspace */
(() => {
 'use strict';
 const SEASONS=['christmas','valentines','easter','halloween','black-friday','new-year','mothers-day','fathers-day','back-to-school','summer','independence'];
 const LABELS={'christmas':'Christmas','valentines':"Valentine's Day",'easter':'Easter','halloween':'Halloween','black-friday':'Black Friday','new-year':'New Year',"mothers-day":"Mother's Day","fathers-day":"Father's Day",'back-to-school':'Back to School','summer':'Summer','independence':'Zambian Independence'};
 const $=id=>document.getElementById(id);
 let settings={},presets={},mounted=false,loading=false;
 const defaultPreset=key=>({season:key,season_label:LABELS[key],heroTitle:'',heroSubtitle:'',bannerTitle:'',bannerMessage:'',bannerButton:'Shop now',bannerUrl:'/shop.html',bannerImage:'',popupTitle:'',popupMessage:'',popupButton:'Shop now',popupUrl:'/shop.html',popupImage:'',marks:[]});
 const defaults={enabled:false,theme:'christmas',decorations:true,snow:false,snowIntensity:24,scheduled:false,start:'2026-11-15',end:'2026-12-27',coverage:'all',popup:false,popupMode:'delay',popupDelay:5,popupScroll:35,banner:true};
 function safeText(value){return String(value??'');}
 function setStatus(text,type='info'){const el=$('seasonal-status');if(el){el.textContent=text;el.dataset.type=type;}}
 function field(label,id,type='text',hint=''){return '<label class="ss-field"><span>'+label+'</span><input id="'+id+'" type="'+type+'" autocomplete="off"></label>'+(hint?'<small class="ss-hint">'+hint+'</small>':'');}
 function area(label,id){return '<label class="ss-field"><span>'+label+'</span><textarea id="'+id+'" rows="3"></textarea></label>';}
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
  nav.append(more);
  const tab=document.createElement('button');tab.type='button';tab.className='workspace-tab';tab.id='tab-seasonal-studio';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.textContent='Seasonal Studio';
  const panel=document.createElement('section');panel.className='workspace-view';panel.id='view-seasonal-studio';panel.setAttribute('role','tabpanel');panel.hidden=true;
  panel.innerHTML='<div class="ss-heading"><div><div class="ss-kicker">CAMPAIGN MANAGEMENT</div><h2>Seasonal Studio</h2><p>Manage every season, campaign setting, banner and popup from one place.</p></div><div class="ss-heading-actions"><button class="btn" id="ss-import" type="button">Import latest from Decap</button><button class="btn primary" id="ss-save" type="button">Save campaign changes</button></div></div><div id="seasonal-status" class="ss-status" role="status">Loading seasonal settings…</div><div class="ss-layout"><section class="ss-card"><h3>Campaign controls</h3><p class="ss-help">Choose what is live and how it appears on the storefront.</p><div class="ss-form-grid">'+select('Active season','ss-active-season',SEASONS.map(k=>[k,LABELS[k]]))+select('Page coverage','ss-coverage',[['all','All pages'],['shopping','Shopping pages'],['content','Content pages']])+field('Start date','ss-start','date')+field('End date','ss-end','date')+'</div><div class="ss-toggle-grid">'+toggle('Campaign enabled','ss-enabled')+toggle('Schedule campaign','ss-scheduled')+toggle('Show seasonal banner','ss-banner')+toggle('Show popup','ss-popup')+toggle('Decorations','ss-decorations')+toggle('Falling snow','ss-snow')+'</div><div class="ss-form-grid">'+select('Popup trigger','ss-popup-mode',[['delay','After a delay'],['scroll','After scrolling']])+field('Popup delay (seconds)','ss-popup-delay','number')+field('Scroll threshold (%)','ss-popup-scroll','number')+field('Snow intensity','ss-snow-intensity','number')+'</div></section><section class="ss-card"><div class="ss-card-head"><div><h3>Season content</h3><p class="ss-help">Each season has independent copy, images and decorations.</p></div>'+select('Edit season','ss-edit-season',SEASONS.map(k=>[k,LABELS[k]]))+'</div><div class="ss-form-grid">'+field('Main campaign heading','ss-hero-title')+field('Main campaign subtitle','ss-hero-subtitle')+field('Banner heading','ss-banner-title')+field('Banner button label','ss-banner-button')+'</div>'+area('Banner message','ss-banner-message')+field('Banner destination URL','ss-banner-url')+field('Banner image URL','ss-banner-image','url')+'<label class="ss-upload">Upload banner image<input id="ss-banner-upload" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label><div class="ss-image-preview" id="ss-banner-preview"><span>Banner image preview</span></div><div class="ss-form-grid">'+field('Popup heading','ss-popup-title')+field('Popup button label','ss-popup-button')+'</div>'+area('Popup message','ss-popup-message')+field('Popup destination URL','ss-popup-url')+field('Popup image URL','ss-popup-image','url')+'<label class="ss-upload">Upload popup image<input id="ss-popup-upload" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label><div class="ss-image-preview ss-popup-preview" id="ss-popup-preview"><span>Popup image preview</span></div>'+area('Seasonal decorations (one per line)','ss-marks')+'</section></div><div class="ss-footer-note">Decap CMS remains available. Use “Import latest from Decap” to bring its latest published seasonal records into this workspace before saving them to the shared campaign store.</div>';
  host.append(panel);nav.append(tab);
  function activate(){nav.querySelectorAll('[role=tab]').forEach(b=>{b.setAttribute('aria-selected',String(b===tab));b.tabIndex=b===tab?0:-1;});host.querySelectorAll('[role=tabpanel]').forEach(p=>p.hidden=p!==panel);panel.hidden=false;tab.scrollIntoView({block:'nearest',behavior:'smooth'});if(!loading)load();}
  tab.addEventListener('click',activate);
  $('ss-edit-season').addEventListener('change',()=>fillPreset($('ss-edit-season').value));
  ['ss-banner-image','ss-popup-image'].forEach(id=>$(id).addEventListener('input',updatePreviews));
  $('ss-banner-upload').addEventListener('change',e=>uploadImage(e.target.files?.[0],'ss-banner-image',e.target));
  $('ss-popup-upload').addEventListener('change',e=>uploadImage(e.target.files?.[0],'ss-popup-image',e.target));
  $('ss-save').addEventListener('click',save);
  $('ss-import').addEventListener('click',importDecap);
  mounted=true;return true;
 }
 function readPreset(key){
  const p={...defaultPreset(key)};
  ['heroTitle','heroSubtitle','bannerTitle','bannerMessage','bannerButton','bannerUrl','bannerImage','popupTitle','popupMessage','popupButton','popupUrl','popupImage'].forEach(k=>p[k]=$('ss-'+k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()))?.value||'');
  p.marks=$('ss-marks').value.split('\n').map(x=>x.trim()).filter(Boolean);
  return p;
 }
 function fillPreset(key){
  const p={...defaultPreset(key),...(presets[key]||{})};
  const keys=['heroTitle','heroSubtitle','bannerTitle','bannerMessage','bannerButton','bannerUrl','bannerImage','popupTitle','popupMessage','popupButton','popupUrl','popupImage'];
  keys.forEach(k=>{const id='ss-'+k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase());if($(id))$(id).value=safeText(p[k]);});
  $('ss-marks').value=Array.isArray(p.marks)?p.marks.join('\n'):'';
  updatePreviews();
 }
 function updatePreviews(){
  [['ss-banner-image','ss-banner-preview'],['ss-popup-image','ss-popup-preview']].forEach(([input,box])=>{const url=$(input).value.trim();box.style.backgroundImage=url?'url("'+url.replace(/["\\]/g,'')+'")':'none';box.classList.toggle('has-image',!!url);box.querySelector('span').textContent=url?'Image preview':'Add an image URL to preview';});
 }
 async function uploadImage(file,targetId,input){
  if(!file)return;
  if(!/^image\/(jpeg|png|webp|avif)$/.test(file.type)||file.size>5*1024*1024){setStatus('Choose a JPG, PNG, WebP or AVIF image up to 5 MB.','error');input.value='';return;}
  const config=window.PY2_ADS_CONFIG,token=window.PY2_SEASONAL_AUTH_TOKEN;
  if(!config?.url||!config?.key||!token){setStatus('Your secure upload session is unavailable. Sign in again.','error');return;}
  const ext=({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif' })[file.type];
  const name='seasonal-'+Date.now()+'-'+Math.random().toString(36).slice(2,9)+'.'+ext;
  input.disabled=true;setStatus('Uploading image securely…');
  try{
   const response=await fetch(config.url+'/storage/v1/object/phoneya2-seasonal/'+encodeURIComponent(name),{method:'POST',headers:{apikey:config.key,authorization:'Bearer '+token,'content-type':file.type,'x-upsert':'true'},body:file});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.message||result.error||'Image upload failed.');
   $(targetId).value=config.url+'/storage/v1/object/public/phoneya2-seasonal/'+name;
   updatePreviews();setStatus('Image uploaded. Save campaign changes to publish it.','success');
  }catch(error){setStatus(error.message,'error');}
  finally{input.disabled=false;input.value='';}
 }
 function fillSettings(){
  const s={...defaults,...settings};
  const map={'enabled':'ss-enabled','scheduled':'ss-scheduled','banner':'ss-banner','popup':'ss-popup','decorations':'ss-decorations','snow':'ss-snow'};
  Object.entries(map).forEach(([k,id])=>$(id).checked=!!s[k]);
  $('ss-active-season').value=s.theme||'christmas';$('ss-coverage').value=s.coverage||'all';$('ss-start').value=s.start||'';$('ss-end').value=s.end||'';
  $('ss-popup-mode').value=s.popupMode||'delay';$('ss-popup-delay').value=Number(s.popupDelay??5);$('ss-popup-scroll').value=Number(s.popupScroll??35);$('ss-snow-intensity').value=Number(s.snowIntensity??24);
  $('ss-edit-season').value=s.theme||'christmas';fillPreset($('ss-edit-season').value);
 }
 async function load(){
  if(loading)return;loading=true;setStatus('Loading shared seasonal settings…');
  try{
   const response=await fetch('/api/seasonal?v='+Date.now(),{cache:'no-store'});
   if(response.ok){
    const data=await response.json();settings=data.settings||{};presets=data.presets||{};
    if(!Object.keys(presets).length){
     await importDecap(false);
     setStatus('Loaded the current published Decap campaign. Save to initialize the shared campaign store.','info');
    }else{
     for(const key of SEASONS){if(!presets[key]){const r=await fetch('/content/settings/seasonal-presets/'+key+'.json?v='+Date.now(),{cache:'no-store'});if(r.ok)presets[key]=await r.json();}}
     setStatus('Connected to the shared seasonal campaign store.','success');
    }
   }else await importDecap(false);
   fillSettings();
  }catch(e){setStatus('Could not load seasonal settings: '+e.message,'error');}
  finally{loading=false;}
 }
 async function importDecap(showMessage=true){
  try{
   const globalResponse=await fetch('/content/settings/seasonal-campaigns.json?v='+Date.now(),{cache:'no-store'});
   if(!globalResponse.ok)throw new Error('Could not read Decap campaign control file.');
   settings=await globalResponse.json();presets={};
   for(const key of SEASONS){const response=await fetch('/content/settings/seasonal-presets/'+key+'.json?v='+Date.now(),{cache:'no-store'});if(response.ok)presets[key]=await response.json();}
   fillSettings();if(showMessage)setStatus('Imported the latest published Decap settings. Save to publish them to the shared campaign store.','success');
  }catch(e){setStatus('Decap import failed: '+e.message,'error');}
 }
 async function save(){
  const token=window.PY2_SEASONAL_AUTH_TOKEN;if(!token){setStatus('Your admin session is missing. Sign out and back into Command Centre.','error');return;}
  const key=$('ss-edit-season').value;presets[key]=readPreset(key);
  settings={...settings,enabled:$('ss-enabled').checked,theme:$('ss-active-season').value,coverage:$('ss-coverage').value,start:$('ss-start').value,end:$('ss-end').value,scheduled:$('ss-scheduled').checked,banner:$('ss-banner').checked,popup:$('ss-popup').checked,decorations:$('ss-decorations').checked,snow:$('ss-snow').checked,popupMode:$('ss-popup-mode').value,popupDelay:Number($('ss-popup-delay').value||0),popupScroll:Number($('ss-popup-scroll').value||35),snowIntensity:Number($('ss-snow-intensity').value||0)};
  const activePreset=presets[settings.theme]||{};['bannerTitle','bannerMessage','bannerButton','bannerUrl','bannerImage','popupTitle','popupMessage','popupButton','popupUrl','popupImage'].forEach(k=>{if(activePreset[k]!==undefined)settings[k]=activePreset[k];});
  const button=$('ss-save');button.disabled=true;setStatus('Saving campaign settings…');
  try{const response=await fetch('/api/seasonal',{method:'PUT',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({settings,presets})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Save failed.');setStatus('Saved. The live storefront will use these campaign settings.','success');}
  catch(e){setStatus(e.message,'error');}
  finally{button.disabled=false;}
 }
 function init(){if(!ensureWorkspace())return;load();}
 window.addEventListener('py2-admin-ready',init);
 if(window.PY2_SEASONAL_AUTH_TOKEN)init();
})();
