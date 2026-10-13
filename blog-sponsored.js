/* Sponsored placement for the PhoneYa2 content hub. Uses the existing public Ads system. */
(function(){
'use strict';
var cfg=window.PY2_ADS_CONFIG||{},base=cfg.url,key=cfg.key;if(!base||!key)return;
function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function hash(){var raw=(navigator.userAgent||'')+'|'+(navigator.language||'')+'|'+new Date().toISOString().slice(0,10)+'|py2ads';if(crypto&&crypto.subtle&&window.TextEncoder)return crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)).then(function(b){return 'v1_'+Array.from(new Uint8Array(b)).slice(0,12).map(function(x){return x.toString(16).padStart(2,'0')}).join('')});var h=0;for(var i=0;i<raw.length;i++)h=((h<<5)-h+raw.charCodeAt(i))|0;return Promise.resolve('v1_'+Math.abs(h).toString(36))}
function rest(path,options){options=options||{};options.headers=Object.assign({'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'},options.headers||{});return fetch(base+'/rest/v1/'+path,options)}
function track(name,params){try{if(typeof gtag==='function')gtag('event',name,Object.assign({content_group:'PhoneYa2 Sponsored Content'},params||{}))}catch(e){}}
function record(table,body){hash().then(function(v){body.visitor_hash=v;return rest(table,{method:'POST',headers:{'Prefer':'return=minimal'},body:JSON.stringify(body),keepalive:true})}).catch(function(){})}
function videoMarkup(ad){
var url=String(ad.media_url||'').trim(),provider=String(ad.video_provider||'').toLowerCase(),u=null;
if(!url)return '';
try{u=new URL(url,window.location.href)}catch(e){}
var host=u?u.hostname.toLowerCase():'',path=u?u.pathname.toLowerCase():url.toLowerCase();
if(provider==='youtube'||host==='youtu.be'||host.indexOf('youtube.com')>=0){
var id='';
if(host==='youtu.be'&&u)id=u.pathname.split('/').filter(Boolean)[0]||'';
else if(u){id=u.searchParams.get('v')||'';var parts=u.pathname.split('/').filter(Boolean);if(!id&&(parts[0]==='embed'||parts[0]==='shorts'))id=parts[1]||''}
if(id)return '<iframe class="py2-sponsored-video-frame" src="https://www.youtube-nocookie.com/embed/'+esc(id)+'" title="'+esc(ad.title||'Sponsored video')+'" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
}
if(provider==='vimeo'||host.indexOf('vimeo.com')>=0){var partsV=u?u.pathname.split('/').filter(Boolean):[],vm=partsV[partsV.length-1]||'';if(/^\\d+$/.test(vm))return '<iframe class="py2-sponsored-video-frame" src="https://player.vimeo.com/video/'+esc(vm)+'" title="'+esc(ad.title||'Sponsored video')+'" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>'}
if(provider==='tiktok'||host.indexOf('tiktok.com')>=0)return '<a class="py2-sponsored-external-video" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer"><span>▶</span><strong>Watch video promotion</strong><small>Opens the original video</small></a>';
var mime=path.endsWith('.webm')?'video/webm':path.endsWith('.ogg')?'video/ogg':'video/mp4';
return '<video class="py2-sponsored-video-player" controls playsinline preload="metadata" aria-label="'+esc(ad.title||'Sponsored video')+'"><source src="'+esc(url)+'" type="'+mime+'">Your browser does not support video playback. <a href="'+esc(url)+'">Open video</a>.</video>';
}
function card(ad,placement){
placement=placement||'blog_featured';
var business=ad.advertisers&&ad.advertisers.business_name||'Advertiser';
var media='';
if(ad.media_type==='video')media='<div class="py2-sponsored-media py2-sponsored-media-video">'+videoMarkup(ad)+'</div>';
else if(ad.media_url)media='<div class="py2-sponsored-media"><img src="'+esc(ad.media_url)+'" alt="'+esc(ad.title||'Sponsored promotion')+'" loading="lazy" decoding="async" onerror="this.closest(\'.py2-sponsored-media\').classList.add(\'media-unavailable\');this.remove()"><span class="py2-sponsored-media-fallback" aria-hidden="true">PhoneYa2 promotion</span></div>';
else media='<div class="py2-sponsored-media py2-sponsored-media-fallback-only">PhoneYa2 promotion</div>';
var href='/ad/'+encodeURIComponent(ad.slug||'');
var el=document.createElement('article');el.className='py2-sponsored-card';
el.innerHTML='<div class="py2-sponsored-head"><span><i class="fa-solid fa-bullhorn" aria-hidden="true"></i> Sponsored promotion</span><span>PhoneYa2 Ads</span></div><a class="py2-sponsored-main" href="'+href+'">'+media+'<div class="py2-sponsored-copy"><div class="py2-sponsored-business">'+esc(business)+'</div><h3>'+esc(ad.title||'Discover this business')+'</h3><p>'+esc(ad.description||'Explore this advertiser on PhoneYa2.')+'</p><span class="py2-sponsored-cta">View promotion <span aria-hidden="true">↗</span></span></div></a><div class="py2-sponsored-foot">Paid promotion · Learn more before you buy</div>';
var main=el.querySelector('.py2-sponsored-main');
main.addEventListener('click',function(e){if(e.target.closest('video,iframe,.py2-sponsored-external-video'))e.preventDefault();else{record('ad_clicks',{ad_id:ad.id,placement:placement,source:'blog'});track('blog_sponsored_click',{ad_id:String(ad.id),ad_title:ad.title||'',placement:placement})}});
record('ad_impressions',{ad_id:ad.id,placement:placement,source:'blog'});track('blog_sponsored_impression',{ad_id:String(ad.id),placement:placement});
return el
}
function style(){var s=document.createElement('style');s.textContent='.py2-ad-rotation{position:relative}.py2-ad-rotation-controls{display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 0 0}.py2-ad-rotate-btn{width:32px;height:32px;border:1px solid #dce1e9;border-radius:50%;background:#fff;color:#111827;font-size:23px;line-height:1;cursor:pointer;box-shadow:0 2px 8px #1118270a}.py2-ad-rotate-btn:hover{background:#111827;color:#fff}.py2-ad-rotate-btn:disabled{opacity:.35;cursor:default}.py2-ad-rotate-status{font-size:10px;font-weight:800;color:#7b8493;min-width:42px;text-align:center}.py2-ad-rotation-stage>.py2-sponsored-slot{margin:0}.py2-ad-rotation-stage>.py2-sponsored-card{animation:py2AdFade .28s ease}@keyframes py2AdFade{from{opacity:.45;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}.py2-sponsored-slot{margin:22px 0}.py2-sponsored-card{border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 10px 28px rgba(15,23,42,.08);font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}.py2-sponsored-head{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#111827;color:#fff;padding:11px 16px;font-size:10px;font-weight:900;letter-spacing:.8px;text-transform:uppercase}.py2-sponsored-head span:first-child{color:#ffb176}.py2-sponsored-main{display:grid;grid-template-columns:minmax(240px,42%) minmax(0,1fr);color:#111827;text-decoration:none;min-width:0}.py2-sponsored-media{position:relative;min-height:240px;background:#eef1f6;overflow:hidden;display:grid;place-items:center}.py2-sponsored-media>img,.py2-sponsored-video-player,.py2-sponsored-video-frame{display:block;width:100%;height:100%;min-height:240px;max-height:360px;object-fit:cover;border:0;background:#0b1020}.py2-sponsored-video-frame{position:absolute;inset:0;height:100%;min-height:240px}.py2-sponsored-media-video{background:#0b1020}.py2-sponsored-video-player{object-fit:contain}.py2-sponsored-media-fallback{display:none;color:#64748b;font-size:12px;font-weight:800}.py2-sponsored-media.media-unavailable .py2-sponsored-media-fallback,.py2-sponsored-media-fallback-only{display:grid;place-items:center;min-height:240px;background:linear-gradient(135deg,#fff1e6,#eaf1fb);color:#d95300;font-size:14px;font-weight:900}.py2-sponsored-external-video{width:100%;min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:radial-gradient(circle at 50% 35%,#34425d,#0b1020 70%);color:#fff;text-decoration:none}.py2-sponsored-external-video span{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:#ff6500;font-size:22px}.py2-sponsored-external-video small{color:#cbd5e1}.py2-sponsored-copy{padding:clamp(18px,3vw,30px);display:flex;flex-direction:column;align-items:flex-start;justify-content:center;min-width:0}.py2-sponsored-business{color:#d95300;font-size:11px;font-weight:900;letter-spacing:.7px;text-transform:uppercase}.py2-sponsored-copy h3{font-size:clamp(20px,2.4vw,28px);line-height:1.2;letter-spacing:-.6px;margin:8px 0 10px;color:#111827}.py2-sponsored-copy p{font-size:14px;line-height:1.7;color:#5b6472;margin:0 0 18px}.py2-sponsored-cta{display:inline-flex;align-items:center;gap:9px;background:#ff6500;color:#fff;border-radius:9px;padding:11px 15px;font-size:12px;font-weight:900}.py2-sponsored-foot{border-top:1px solid #edf0f5;color:#7b8493;padding:9px 15px;font-size:10px}.py2-sponsored-inline .py2-sponsored-card{max-width:920px;margin:0 auto}@media(max-width:650px){.py2-sponsored-head{padding:10px 12px}.py2-sponsored-main{grid-template-columns:minmax(0,1fr)}.py2-sponsored-media{min-height:0;aspect-ratio:16/9}.py2-sponsored-media>img,.py2-sponsored-video-player,.py2-sponsored-video-frame{height:100%;min-height:0;max-height:none;aspect-ratio:16/9}.py2-sponsored-media-fallback-only,.py2-sponsored-media.media-unavailable .py2-sponsored-media-fallback,.py2-sponsored-external-video{min-height:180px}.py2-sponsored-copy{padding:18px}.py2-sponsored-copy h3{font-size:22px}}';document.head.appendChild(s)}
function mount(ads){
if(!ads.length)return;
var targets=[];
function buildSlot(target,placement,offset){
if(!target)return;
target.hidden=false;target.innerHTML='';
target.classList.add('has-live-ad');
var wrap=document.createElement('div');wrap.className='py2-ad-rotation';
var stage=document.createElement('div');stage.className='py2-ad-rotation-stage';
var controls=document.createElement('div');controls.className='py2-ad-rotation-controls';
var prev=document.createElement('button');prev.type='button';prev.className='py2-ad-rotate-btn';prev.setAttribute('aria-label','Previous promotion');prev.textContent='‹';
var status=document.createElement('span');status.className='py2-ad-rotate-status';status.setAttribute('aria-live','polite');
var next=document.createElement('button');next.type='button';next.className='py2-ad-rotate-btn';next.setAttribute('aria-label','Next promotion');next.textContent='›';
controls.append(prev,status,next);wrap.append(stage,controls);target.appendChild(wrap);
var localIndex=offset%ads.length;
function show(nextIndex){localIndex=(nextIndex+ads.length)%ads.length;stage.innerHTML='';stage.appendChild(card(ads[localIndex],placement));status.textContent=(localIndex+1)+' / '+ads.length;prev.disabled=ads.length<2;next.disabled=ads.length<2}
prev.addEventListener('click',function(){show(localIndex-1)});
next.addEventListener('click',function(){show(localIndex+1)});
show(localIndex);targets.push({show:show,getIndex:function(){return localIndex}});
}
var top=document.getElementById('blog-ad-slot-top');
if(top)buildSlot(top,'blog_featured',0);
else{var feed=document.getElementById('blog-feed');if(feed)buildSlot(feed.parentNode,'blog_featured',0);else{var article=document.getElementById('article-content');if(article)buildSlot(article.parentNode,'blog_featured',0)}}
var mid=document.getElementById('blog-ad-slot-mid');
if(mid&&ads.length>1)buildSlot(mid,'blog_inline',1);
if(ads.length>1){
var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,timer=null;
function start(){if(!timer&&!document.hidden&&!reduced)timer=window.setInterval(function(){targets.forEach(function(t){t.show(t.getIndex()+1)})},8000)}
function stop(){if(timer){window.clearInterval(timer);timer=null}}
start();document.addEventListener('visibilitychange',function(){if(document.hidden)stop();else start()});
}
}
style();var now=new Date().toISOString();var query='ads?select=id,slug,title,description,media_url,media_type,weight,status,placement,start_date,end_date,created_at,advertiser_id,advertisers(business_name,logo_url,tier)&status=eq.approved&placement=eq.carousel&start_date=lte.'+encodeURIComponent(now)+'&or=(end_date.is.null,end_date.gt.'+encodeURIComponent(now)+')&order=weight.desc,created_at.desc&limit=12';
rest(query).then(function(r){if(!r.ok)throw Error('ads unavailable');return r.json()}).then(function(ads){if(Array.isArray(ads)&&ads.length)mount(ads)}).catch(function(){/* Sponsored slot stays hidden if the Ads service is unavailable. */});
})();