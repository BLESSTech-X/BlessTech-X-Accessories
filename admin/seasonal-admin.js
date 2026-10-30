/* PhoneYa2 Seasonal Campaign Studio — Command Centre */
(()=>{'use strict';
const HOST_ID='py2-seasonal-admin-host';
const PREVIEW_KEY='phoneya2-seasonal-preview-v3';
const DEFAULTS={
 id:'global',enabled:false,theme:'christmas',decorations:true,snow:false,snowIntensity:24,
 scheduled:false,start:'2026-11-15',end:'2026-12-27',coverage:'all',
 banner:true,bannerTitle:'The PhoneYa2 Christmas Edit',bannerMessage:'Thoughtful tech gifts. Better-connected moments.',bannerButton:'Explore Christmas Picks',bannerUrl:'/shop.html',bannerImage:'',
 popup:false,popupTitle:'Make Their Christmas Special',popupMessage:'Discover thoughtful gifts, explore festive offers and shop your favourite phone accessories.',popupButton:'Shop Christmas Deals',popupUrl:'/shop.html',popupImage:'',popupMode:'delay',popupDelay:5,popupScroll:35
};
const $=(s,r=document)=>r.querySelector(s);
let db=null,settings={...DEFAULTS},busy=false,mounted=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(message,type='info'){const el=$('#py2-seasonal-status');if(el){el.textContent=message;el.dataset.type=type;}}
function config(){const c=window.PY2_ADS_CONFIG;return c&&c.url&&c.key?c:null;}
function field(name,label,type='text',placeholder='',extra=''){
 const value=settings[name]??'';
 if(type==='checkbox')return '<label class="py2-check"><input type="checkbox" name="'+name+'" '+(value?'checked':'')+' '+extra+'><span>'+label+'</span></label>';
 if(type==='select')return '<label>'+label+'<select name="'+name+'" '+extra+'>'+placeholder+'</select></label>';
 return '<label>'+label+'<input type="'+type+'" name="'+name+'" value="'+esc(value)+'" placeholder="'+esc(placeholder)+'" '+extra+'></label>';
}
function render(){
 const host=document.getElementById(HOST_ID);if(!host)return;
 host.innerHTML=`
 <section id="py2-seasonal-admin" aria-labelledby="py2-seasonal-title">
  <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap">
   <div><div style="font-size:10px;font-weight:900;letter-spacing:.16em;color:#9b7b38">PHONEYA2 · CAMPAIGN MANAGEMENT</div><h2 id="py2-seasonal-title">Seasonal Campaign Studio</h2><p style="margin:0;color:#68766d;font-size:13px;line-height:1.5">Control the live storefront theme, seasonal decorations, banners and popups from this Command Centre.</p></div>
   <span id="py2-seasonal-state" style="padding:7px 11px;border-radius:99px;background:#eef2ed;color:#526354;font-size:11px;font-weight:850">Loading settings…</span>
  </div>
  <div class="py2-admin-grid">
   <label class="py2-check"><input type="checkbox" name="enabled"><span>Activate campaign</span></label>
   <label>Season / theme<select name="theme">
    <option value="christmas">🎄 Christmas</option><option value="valentines">💗 Valentine’s Day</option><option value="easter">🐣 Easter</option><option value="halloween">🎃 Halloween</option><option value="black-friday">🏷️ Black Friday</option><option value="new-year">🎆 New Year</option><option value="mothers-day">💐 Mother’s Day</option><option value="fathers-day">🎁 Father’s Day</option><option value="back-to-school">🎒 Back to School</option><option value="summer">☀️ Summer</option>
   </select></label>
   <label class="py2-check"><input type="checkbox" name="decorations"><span>Theme decorations on headings, brand and tabs</span></label>
   <label class="py2-check"><input type="checkbox" name="snow"><span>Falling snow (Christmas theme)</span></label>
   <label>Snowflake amount <input type="number" name="snowIntensity" min="0" max="70" step="1"></label>
   <label class="py2-check"><input type="checkbox" name="scheduled"><span>Schedule campaign dates</span></label>
   <label>Start date <input type="date" name="start"></label><label>End date <input type="date" name="end"></label>
   <label>Page coverage<select name="coverage"><option value="all">All storefront pages</option><option value="shopping">Shopping pages only</option><option value="content">Content pages only</option></select></label>
  </div>
  <details open style="margin-top:20px"><summary style="font-weight:900;color:#203329;cursor:pointer;padding:8px 0">Campaign banner</summary>
   <div class="py2-admin-grid">
    <label class="py2-check"><input type="checkbox" name="banner"><span>Show campaign banner</span></label>
    <label>Banner heading <input name="bannerTitle" type="text" maxlength="100"></label>
    <label>Banner message <input name="bannerMessage" type="text" maxlength="220"></label>
    <label>Button text <input name="bannerButton" type="text" maxlength="50"></label>
    <label>Button destination <input name="bannerUrl" type="text" placeholder="/shop.html"></label>
    <label>Banner image URL <input name="bannerImage" type="url" placeholder="https://…"></label>
   </div>
  </details>
  <details style="margin-top:12px"><summary style="font-weight:900;color:#203329;cursor:pointer;padding:8px 0">Popup campaign</summary>
   <div class="py2-admin-grid">
    <label class="py2-check"><input type="checkbox" name="popup"><span>Show popup</span></label>
    <label>Popup heading <input name="popupTitle" type="text" maxlength="100"></label>
    <label>Popup message <input name="popupMessage" type="text" maxlength="300"></label>
    <label>Button text <input name="popupButton" type="text" maxlength="50"></label>
    <label>Button destination <input name="popupUrl" type="text" placeholder="/shop.html"></label>
    <label>Popup image URL <input name="popupImage" type="url" placeholder="https://…"></label>
    <label>Popup trigger<select name="popupMode"><option value="delay">After a delay</option><option value="immediate">Shortly after page load</option><option value="scroll">After visitor scrolls</option></select></label>
    <label>Delay (seconds) <input name="popupDelay" type="number" min="0" max="60"></label>
    <label>Scroll threshold (%) <input name="popupScroll" type="number" min="5" max="90"></label>
   </div>
  </details>
  <div class="py2-admin-actions">
   <button type="button" class="primary" id="py2-seasonal-save">Save and publish campaign</button>
   <button type="button" id="py2-seasonal-preview">Preview storefront</button>
   <button type="button" id="py2-seasonal-reload">Reload saved settings</button>
  </div>
  <p id="py2-seasonal-status" class="py2-admin-note" role="status" aria-live="polite">Connecting to campaign settings…</p>
  <p class="py2-admin-note">Changes are saved to Supabase. Public storefront pages use the published campaign settings. Preview opens a private draft without publishing it.</p>
 </section>`;
 const form=$('#py2-seasonal-admin',host);
 for(const [k,v] of Object.entries(settings)){const el=form.elements.namedItem(k);if(!el)continue;if(el.type==='checkbox')el.checked=!!v;else el.value=v??'';}
 $('#py2-seasonal-save',host).addEventListener('click',save);
 $('#py2-seasonal-reload',host).addEventListener('click',load);
 $('#py2-seasonal-preview',host).addEventListener('click',preview);
 updateState();
}
function readForm(){
 const form=$('#py2-seasonal-admin');const out={id:'global'};
 for(const [k,v] of Object.entries(DEFAULTS)){if(k==='id')continue;const el=form.elements.namedItem(k);if(!el)continue;out[k]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value||0):el.value.trim();}
 out.updated_at=new Date().toISOString();return out;
}
function updateState(){const el=$('#py2-seasonal-state');if(!el)return;el.textContent=settings.enabled?'Campaign enabled':'Campaign disabled';el.style.background=settings.enabled?'#e5f4e9':'#eef2ed';el.style.color=settings.enabled?'#17633b':'#526354';}
async function load(){
 if(!db){status('Admin database connection is not ready. Sign in again and refresh this page.','error');return;}
 status('Loading saved campaign settings…');
 try{
  const {data,error}=await db.from('seasonal_campaigns').select('*').eq('id','global').maybeSingle();
  if(error)throw error;
  settings={...DEFAULTS,...(data||{})};
  const form=$('#py2-seasonal-admin');if(!form){render();return;}
  for(const [k,v] of Object.entries(settings)){const el=form.elements.namedItem(k);if(!el)continue;if(el.type==='checkbox')el.checked=!!v;else el.value=v??'';}
  updateState();status(data?'Saved campaign settings loaded.':'No global campaign row found. Save to create it.','success');
 }catch(e){status('Could not load Supabase campaign settings: '+(e.message||'Unknown error')+'. Check that the seasonal_campaigns table and policies exist in the Command Centre Supabase project.','error');}
}
async function save(){
 if(busy||!db)return;busy=true;const button=$('#py2-seasonal-save');if(button){button.disabled=true;button.textContent='Saving…';}
 try{
  const payload=readForm();
  const {data,error}=await db.from('seasonal_campaigns').upsert(payload,{onConflict:'id'}).select().single();
  if(error)throw error;settings={...DEFAULTS,...data};updateState();status('Campaign saved to Supabase. The storefront will use the new settings on its next page load.','success');
 }catch(e){status('Save failed: '+(e.message||'Unknown error')+'. If the error mentions a missing column, apply the latest seasonal campaign migration in Supabase.','error');}
 finally{busy=false;if(button){button.disabled=false;button.textContent='Save and publish campaign';}}
}
function preview(){
 const draft=readForm();try{localStorage.setItem(PREVIEW_KEY,JSON.stringify(draft));}catch(e){status('Preview could not be prepared because browser storage is unavailable.','error');return;}
 const url=new URL('/',location.origin);url.searchParams.set('py2-seasonal-preview','1');window.open(url.href,'_blank','noopener');status('Private preview opened. This draft has not been published.','success');
}
async function mount(){
 const host=document.getElementById(HOST_ID);if(!host)return;
 if(mounted&&host.dataset.mounted==='1')return;
 const token=window.PY2_SEASONAL_AUTH_TOKEN,cfg=config();
 if(!token||!cfg||!window.supabase?.createClient){host.innerHTML='<section id="py2-seasonal-admin"><h2>Seasonal Campaign Studio</h2><p>Sign in to the Command Centre to load campaign controls.</p></section>';return;}
 mounted=true;host.dataset.mounted='1';
 db=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:'Bearer '+token}}});
 settings={...DEFAULTS};render();await load();
}
window.PY2_mountSeasonalAdmin=mount;
window.addEventListener('py2-admin-ready',mount);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();