(function(){
'use strict';
var posts=[],category='All',search='',showSaved=false,visibleCount=2,PAGE_SIZE=2,scrollObserver=null;
var SAVED_KEY='phoneya2_blog_saved_v1';
function track(name,params){try{if(typeof gtag==='function')gtag('event',name,Object.assign({content_group:'PhoneYa2 Community Feed'},params||{}))}catch(e){}}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function dateLabel(v){if(!v)return 'PhoneYa2 community';var d=new Date(v);return isNaN(d)?'PhoneYa2 community':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}
function getSaved(){try{var v=JSON.parse(localStorage.getItem(SAVED_KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return []}}
function setSaved(v){try{localStorage.setItem(SAVED_KEY,JSON.stringify(v))}catch(e){} updateSavedCount()}
function updateSavedCount(){var el=document.getElementById('saved-post-count');if(el){var n=getSaved().length;el.textContent=n?n+' saved post'+(n===1?'':'s')+' on this device.':'Your saved posts stay on this device.'}}
function safeUrl(value){try{var u=new URL(String(value||''),location.origin);if(u.protocol!=='https:'&&u.protocol!=='http:')return '';if(u.origin===location.origin&&!/^\/assets\/videos\//i.test(u.pathname))return '';return u.href}catch(e){return ''}}
function videoMarkup(value,title){
 var url=safeUrl(value);if(!url)return '';
 var u;try{u=new URL(url)}catch(e){return ''}var host=u.hostname.toLowerCase().replace(/^www\./,''),embed='';
 if(host==='youtu.be'||host==='youtube.com'||host.endsWith('.youtube.com')||host==='youtube-nocookie.com'){
  var id='';if(host==='youtu.be')id=u.pathname.split('/').filter(Boolean)[0]||'';else if(u.pathname==='/watch')id=u.searchParams.get('v')||'';else{var a=u.pathname.split('/').filter(Boolean);if(['embed','shorts','live'].indexOf(a[0])>=0)id=a[1]||''}if(/^[\w-]{6,}$/.test(id))embed='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)
 }else if(host==='vimeo.com'||host.endsWith('.vimeo.com')){var vi=u.pathname.split('/').filter(Boolean).find(function(x){return /^\d+$/.test(x)});if(vi)embed='https://player.vimeo.com/video/'+vi}
 else if(host==='tiktok.com'||host.endsWith('.tiktok.com')){var p=u.pathname.split('/').filter(Boolean),tid='';for(var i=0;i<p.length-2;i++){if(p[i].charAt(0)==='@'&&p[i+1]==='video'&&/^\d+$/.test(p[i+2])){tid=p[i+2];break}}if(tid)embed='https://www.tiktok.com/embed/v2/'+tid}
 else if(host==='instagram.com'||host.endsWith('.instagram.com')){var im=u.pathname.match(/^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);if(im)embed='https://www.instagram.com/'+(im[1]==='reels'?'reel':im[1])+'/'+im[2]+'/embed'}
 else if(host==='facebook.com'||host.endsWith('.facebook.com')||host==='fb.watch')embed='https://www.facebook.com/plugins/video.php?href='+encodeURIComponent(url)+'&show_text=false&width=800';
 if(embed)return '<div class="py2-feed-media py2-feed-video"><iframe src="'+esc(embed)+'" title="'+esc(title||'PhoneYa2 video')+'" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>';
 if(/\.(mp4|webm|ogg)(?:$|[?#])/i.test(url))return '<div class="py2-feed-media py2-feed-video"><video controls playsinline preload="none" aria-label="'+esc(title||'PhoneYa2 video')+'"><source src="'+esc(url)+'">Your browser does not support video playback.</video></div>';
 return '<a class="py2-feed-external-video" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer"><span class="py2-play-icon">▶</span><span>Watch on the original platform</span><small>Some platforms restrict embedded playback</small></a>'
}
function bodyVideoUrl(markdown){var matches=String(markdown||'').match(/https?:\/\/[^\s)<>]+/gi)||[];for(var i=0;i<matches.length;i++){var value=matches[i].replace(/[.,!?]+$/,'');try{var u=new URL(value);var host=u.hostname.toLowerCase().replace(/^www\./,'');if(host==='youtu.be'||host==='youtube.com'||host.endsWith('.youtube.com'))return value}catch(e){}}return ''}
function enrichVideoLinks(items){return Promise.all(items.map(function(p){if(p.video_url||p._videoChecked)return p;p._videoChecked=true;return fetch('/content/blog/'+encodeURIComponent(p.slug)+'.md',{cache:'force-cache'}).then(function(r){return r.ok?r.text():''}).then(function(md){p.video_url=bodyVideoUrl(md);return p}).catch(function(){return p})}))}
function mediaMarkup(p){
 if(p.video_url){var video=videoMarkup(p.video_url,p.title);if(video)return video}
 if(p.image)return '<a class="py2-feed-media" href="/blog-post.html?slug='+encodeURIComponent(p.slug)+'"><img loading="lazy" decoding="async" src="'+esc(p.image)+'" alt="'+esc(p.title)+'" onerror="this.closest(\'.py2-feed-media\').classList.add(\'py2-media-failed\')"><span class="py2-media-fallback">PhoneYa2 community post</span></a>';
 return '<a class="py2-feed-no-media" href="/blog-post.html?slug='+encodeURIComponent(p.slug)+'"><span>PY<span>2</span></span><small>PHONEYA2 COMMUNITY</small></a>'
}
function galleryPreview(p){
 var raw=Array.isArray(p.gallery)?p.gallery:[],images=raw.map(function(item){if(typeof item==='string')return{image:item,caption:'',title:'',description:''};if(item&&typeof item==='object')return{image:String(item.image||item.src||''),caption:String(item.caption||''),title:String(item.title||''),description:String(item.description||'')};return null}).filter(function(item){return item&&item.image.trim()&&item.image!==p.image});
 if(!images.length)return '';
 var shown=images.slice(0,3),href='/blog-post.html?slug='+encodeURIComponent(p.slug);
 return '<div class="py2-blog-gallery-preview" aria-label="More photos from this story" style="display:flex;align-items:center;gap:7px;padding:0 14px 12px;flex-wrap:wrap">'+shown.map(function(item,i){var title=item.title||item.caption||'';return '<a href="'+href+'" aria-label="See photo '+(i+1)+' in '+esc(p.title)+'" title="'+esc(title||('Photo '+(i+1)))+'" style="display:block;width:54px;height:54px;border-radius:10px;overflow:hidden;border:1px solid #dbe3ee;background:#f1f5f9;flex:0 0 auto;box-shadow:0 2px 8px #0f172a12"><img src="'+esc(item.image)+'" alt="'+esc(title||'Additional story photo')+'" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover"></a>'}).join('')+'<a href="'+href+'" style="display:inline-flex;align-items:center;gap:5px;padding:9px 11px;border-radius:10px;background:linear-gradient(120deg,#eaf4ff,#f1edff);color:#174ea6;font-size:11px;font-weight:900;text-decoration:none;border:1px solid #d9e5ff">See '+(images.length>3?'all '+images.length:'all')+' photos <span aria-hidden="true">↗</span></a></div>';
}
function featuredProductsPreview(p){
 var items=Array.isArray(p.featured_products)?p.featured_products:[];
 if(!items.length)return '';
 ensureFeaturedProductPreviewStyles();
 return '<div class="py2-featured-product-strip"><div class="py2-featured-product-label">PRODUCTS IN THIS STORY · READY TO EXPLORE</div><div class="py2-featured-product-items">'+items.slice(0,4).map(function(item){
  var href='/product.html?id='+encodeURIComponent(item.slug);
  return '<a class="py2-featured-product-mini" href="'+href+'" aria-label="View '+esc(item.title)+'"><img src="'+esc(item.image||'')+'" alt="'+esc(item.title)+'" loading="lazy" decoding="async" onerror="this.style.visibility=\'hidden\'"><span>'+esc(item.title)+'</span>'+(item.offer_label?'<em>'+esc(item.offer_label)+'</em>':'')+(item.price?'<small>K'+esc(Number(item.price).toLocaleString('en-ZM',{maximumFractionDigits:2}))+'</small>':'')+'<b>View &amp; buy ↗</b></a>'
 }).join('')+(items.length>4?'<a class="py2-featured-product-more" href="/blog-post.html?slug='+encodeURIComponent(p.slug)+'">+'+(items.length-4)+' more</a>':'')+'</div><a class="py2-story-shop-cta" href="/shop.html">Explore all PhoneYa2 products <span aria-hidden="true">→</span></a></div>';
}
function ensureFeaturedProductPreviewStyles(){
 if(document.getElementById('py2-featured-product-preview-style'))return;
 var s=document.createElement('style');s.id='py2-featured-product-preview-style';
 s.textContent='.py2-featured-product-strip{padding:9px 12px 12px;border-top:1px solid #f0f2f5;background:linear-gradient(120deg,#fbfdff,#f8fafc)}.py2-featured-product-label{font-size:9px;letter-spacing:1px;font-weight:900;color:#16834a;margin-bottom:7px}.py2-featured-product-items{display:flex;gap:8px;align-items:stretch;flex-wrap:wrap}.py2-featured-product-mini{width:90px;min-width:0;display:flex;flex-direction:column;gap:4px;color:#263247;text-decoration:none;font-size:10px;font-weight:800;line-height:1.25;padding:6px;border-radius:10px;border:1px solid #e2eaf3;background:#fff;transition:transform .18s,box-shadow .18s}.py2-featured-product-mini:hover{transform:translateY(-2px);box-shadow:0 5px 15px #162b4517}.py2-featured-product-mini img{width:100%;height:70px;object-fit:contain;border:1px solid #e5eaf1;border-radius:8px;background:#fff}.py2-featured-product-mini span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.py2-featured-product-mini small{font-size:10px;color:#16834a;font-weight:900}.py2-featured-product-mini em{font-style:normal;color:#087344;font-size:9px;font-weight:900}.py2-featured-product-mini b{font-size:9px;color:#1558a6;margin-top:auto}.py2-featured-product-more{align-self:center;font-size:10px;font-weight:900;color:#174ea6}.py2-story-shop-cta{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;padding:10px 12px;border-radius:10px;background:#eaf4ff;color:#1558a6;text-decoration:none;font-size:11px;font-weight:900}';
 document.head.appendChild(s);
}
function commentsPanel(p){
 return '<section class="py2-comments-panel" data-comments-panel="'+esc(p.slug)+'" hidden aria-label="Comments on '+esc(p.title||'this post')+'">'+
  '<h4>Community comments</h4><div class="py2-comments-list" data-comments-list><p class="py2-comment-status">Open comments to load the conversation.</p></div>'+
  '<form class="py2-comment-form" data-comment-form data-post-slug="'+esc(p.slug)+'">'+
  '<label>Your name<input name="name" type="text" minlength="2" maxlength="60" autocomplete="name" required placeholder="How should we call you?"></label>'+
  '<label>Your comment<textarea name="message" minlength="3" maxlength="1200" required placeholder="Share a useful thought or question…"></textarea></label>'+
  '<label class="py2-comment-honeypot" aria-hidden="true">Leave this field empty<input name="website" type="text" tabindex="-1" autocomplete="off"></label>'+
  '<button type="submit">Submit comment</button><p class="py2-comment-status" data-comment-status aria-live="polite">Comments are reviewed before they appear publicly.</p></form></section>';
}
function renderComments(listEl, comments){
 if(!listEl)return;
 if(!comments.length){listEl.innerHTML='<p class="py2-comment-status">No approved comments yet. Start the conversation.</p>';return}
 listEl.innerHTML=comments.map(function(c){
  var date='';try{date=c.date?new Date(c.date).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):''}catch(e){}
  return '<article class="py2-comment"><div class="py2-comment-head"><strong>'+esc(c.name||'Reader')+'</strong><span class="py2-comment-date">'+esc(date)+'</span></div><p class="py2-comment-message">'+esc(c.message||'')+'</p></article>';
 }).join('');
}
async function loadComments(panel,slug){
 var list=panel.querySelector('[data-comments-list]');if(!list)return;
 list.innerHTML='<p class="py2-comment-status">Loading approved comments…</p>';
 try{
  var response=await fetch('/api/blog-comments?slug='+encodeURIComponent(slug),{headers:{Accept:'application/json'},cache:'no-store'});
  var data=await response.json();
  if(!response.ok)throw new Error(data.error||'Comments are temporarily unavailable.');
  renderComments(list,Array.isArray(data.comments)?data.comments:[]);
  panel.dataset.loaded='true';
 }catch(err){list.innerHTML='<p class="py2-comment-status">'+esc(err.message||'Comments are temporarily unavailable.')+' Please try again shortly.</p>'}
}

function salesConversionBlock(p){
 var message=String(p.sales_message||'').trim();
 if(!message)return '';
 ensureSalesConversionStyles();
 var first=Array.isArray(p.featured_products)?p.featured_products.find(function(item){return item&&item.slug}):null;
 var target=first?'/product.html?id='+encodeURIComponent(first.slug):'/shop.html';
 var label=String(p.sales_cta_label||'Explore this pick').trim().slice(0,48)||'Explore this pick';
 return '<section class="py2-sales-conversion" aria-label="Suggested next step"><div><span class="py2-sales-conversion-kicker">MAKE YOUR NEXT SMART CHOICE</span><p>'+esc(message)+'</p></div><a href="'+target+'">'+esc(label)+' <span aria-hidden="true">→</span></a></section>';
}
function ensureSalesConversionStyles(){
 if(document.getElementById('py2-sales-conversion-style'))return;
 var s=document.createElement('style');s.id='py2-sales-conversion-style';
 s.textContent='.py2-sales-conversion{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:10px 0 2px;padding:13px 14px;border:1px solid #bfe8d0;border-radius:13px;background:linear-gradient(120deg,#f0fff6,#f1f7ff)}.py2-sales-conversion-kicker{font-size:9px;letter-spacing:1.1px;font-weight:900;color:#16834a}.py2-sales-conversion p{margin:5px 0 0;color:#263247;font-size:12px;line-height:1.5;font-weight:650}.py2-sales-conversion a{display:inline-flex;align-items:center;gap:8px;flex-shrink:0;padding:10px 12px;border-radius:9px;background:#16834a;color:#fff;text-decoration:none;font-size:11px;font-weight:900;box-shadow:0 3px 0 #0d6236}.py2-sales-conversion a:hover{filter:brightness(1.04);transform:translateY(-1px)}@media(max-width:480px){.py2-sales-conversion{align-items:stretch}.py2-sales-conversion a{justify-content:center;width:100%}}';
 document.head.appendChild(s);
}

function card(p){
 var href='/blog-post.html?slug='+encodeURIComponent(p.slug);
 var saved=getSaved().indexOf(p.slug)>=0;
 var tags='';
 if(Array.isArray(p.tags)){tags=p.tags.slice(0,3).map(function(t){return '<span>#'+esc(String(t).replace(/^#/,''))+'</span>'}).join('')}
 var saveLabel=saved?'Saved':'Save';
 var saveClass=saved?' is-saved':'';
 var saveIcon=saved?'solid':'regular';
 return [
  '<article class="py2-social-post" data-post-slug="',esc(p.slug),'">',
  '<div class="py2-post-author-row"><div class="py2-post-avatar py2-post-logo"><img src="https://i.ibb.co/s9CG52wV/file-0000000059948211a0bdd52c4d236852-1.jpg" alt="PhoneYa2 logo" loading="lazy" decoding="async" onerror="this.style.display=\'none\'"></div>',
  '<div class="py2-post-author"><strong>PhoneYa2 <span class="py2-verified" aria-label="PhoneYa2">✓</span></strong>',
  '<span>',esc(dateLabel(p.date)),' · <i class="fa-solid fa-earth-africa" aria-label="Public"></i></span></div>',
  '<span class="py2-post-category">',esc(p.category||'Community'),'</span></div>',
  '<div class="py2-post-copy"><h3><a href="',href,'" data-blog-open="',esc(p.slug),'">',esc(p.title||'PhoneYa2 update'),'</a></h3>',
  '<p>',esc(p.excerpt||'Explore this PhoneYa2 update.'),'</p></div>',
  mediaMarkup(p),
  galleryPreview(p),
  featuredProductsPreview(p),
  salesConversionBlock(p),
  '<div class="py2-post-tags">',tags,'</div>',
  '<div class="py2-post-actions"><button type="button" class="py2-post-action',saveClass,'" data-save-post="',esc(p.slug),'" aria-pressed="',saved?'true':'false','"><i class="fa-',saveIcon,' fa-bookmark" aria-hidden="true"></i><span>',saveLabel,'</span></button>',
  '<button type="button" class="py2-post-action" data-share-post="',esc(p.slug),'"><i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i><span>Share</span></button>',
  '<button type="button" class="py2-post-action" data-toggle-comments="',esc(p.slug),'" aria-expanded="false"><i class="fa-regular fa-comment-dots" aria-hidden="true"></i><span>Comments</span></button>',
  '<a class="py2-post-action py2-post-open" href="',href,'" data-blog-open="',esc(p.slug),'"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i><span>Open post</span></a></div>',
  '<div class="py2-post-footer"><span><i class="fa-solid fa-lightbulb" aria-hidden="true"></i> Smart choices. Better connected.</span>',
  '<a href="',href,'" data-blog-open="',esc(p.slug),'">Read full post ↗</a></div>',
  '<div class="py2-latest-comment" data-latest-comment="',esc(p.slug),'" aria-live="polite" hidden></div>',
  commentsPanel(p),'</article>'
 ].join('');
}
function populateCategoryFilters(){
 var filters=document.getElementById('blog-filters');if(!filters)return;
 var names=Array.from(new Set(posts.map(function(p){return String(p.category||'Community').trim()}).filter(Boolean)));
 var preferred=['Buying Guides','Tips & Tricks','Offers','Product News','PhoneYa2 Updates'];
 names.sort(function(a,b){var ai=preferred.indexOf(a),bi=preferred.indexOf(b);if(ai<0)ai=preferred.length;if(bi<0)bi=preferred.length;return ai-bi||a.localeCompare(b)});
 var labelMap={'Buying Guides':'Buying guides','Tips & Tricks':'Tips & tricks','Product News':'Product news','PhoneYa2 Updates':'PhoneYa2 updates'};
 filters.innerHTML='<button class="blog-category-tab'+(category==='All'?' active':'')+'" data-category="All">All stories</button>'+names.map(function(name){return '<button class="blog-category-tab'+(category===name?' active':'')+'" data-category="'+esc(name)+'">'+esc(labelMap[name]||name)+'</button>'}).join('');
}
function openScrollableComments(slug,title){
 var overlay=document.createElement('div');overlay.className='py2-comments-modal';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Comments on '+(title||'this article'));
 overlay.innerHTML='<section class="py2-comments-modal-card"><header class="py2-comments-modal-head"><div><h2>'+esc(title||'Comments')+'</h2><p>Join the conversation</p></div><button class="py2-comments-modal-close" type="button" aria-label="Close comments">×</button></header><div class="py2-comments-modal-list" data-modal-comments-list><p class="py2-comment-status">Loading comments…</p></div><form class="py2-modal-comment-form"><label>Your name<input name="name" type="text" minlength="2" maxlength="60" autocomplete="name" required placeholder="Your name"></label><label>Your comment<textarea name="message" minlength="3" maxlength="1200" required placeholder="Write your comment…"></textarea></label><label class="py2-comment-honeypot" aria-hidden="true">Leave this field empty<input name="website" type="text" tabindex="-1" autocomplete="off"></label><button type="submit">Post Comment</button><p class="py2-modal-comment-status" aria-live="polite">Your comment will appear publicly after approval.</p></form></section>';
 document.body.appendChild(overlay);var close=overlay.querySelector('.py2-comments-modal-close'),list=overlay.querySelector('[data-modal-comments-list]'),sub=overlay.querySelector('.py2-comments-modal-head p'),form=overlay.querySelector('.py2-modal-comment-form'),status=overlay.querySelector('.py2-modal-comment-status');
 function remove(){overlay.remove();document.removeEventListener('keydown',onKey)}function onKey(e){if(e.key==='Escape')remove()}
 close.addEventListener('click',remove);overlay.addEventListener('click',function(e){if(e.target===overlay)remove()});document.addEventListener('keydown',onKey);
 function commentMarkup(c,pending){var d='';try{d=c.date?new Date(c.date).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):''}catch(e){}return '<article class="py2-comment'+(pending?' py2-comment-pending':'')+'"><div class="py2-comment-head"><strong>'+esc(c.name||'Reader')+'</strong><span class="py2-comment-date">'+esc(d)+'</span></div><p class="py2-comment-message">'+esc(c.message||'')+'</p>'+(pending?'<span class="py2-pending-badge">Pending approval · only visible here</span>':'')+'</article>'}
 fetch('/api/blog-comments?slug='+encodeURIComponent(slug),{headers:{Accept:'application/json'},cache:'no-store'}).then(function(r){if(!r.ok)throw Error();return r.json()}).then(function(data){var comments=Array.isArray(data.comments)?data.comments:[];sub.textContent=comments.length+' approved '+(comments.length===1?'comment':'comments');list.innerHTML=comments.length?comments.map(function(c){return commentMarkup(c,false)}).join(''):'<div class="py2-empty-comments"><strong>No comments yet</strong><p>Be the first to start the conversation.</p></div>'}).catch(function(){sub.textContent='Join the conversation';list.innerHTML='<p class="py2-comment-status">Approved comments could not be loaded, but you can still write a comment.</p>'});
 form.addEventListener('submit',async function(e){e.preventDefault();var submit=form.querySelector('button[type=submit]'),name=form.elements.name.value.trim(),message=form.elements.message.value.trim(),website=form.elements.website.value;if(name.length<2||message.length<3){status.textContent='Enter your name and a comment of at least 3 characters.';return}submit.disabled=true;submit.textContent='Posting…';status.textContent='Submitting your comment…';try{var response=await fetch('/api/blog-comments',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({post_slug:slug,name:name,message:message,website:website})});var data=await response.json();if(!response.ok)throw Error(data.error||'Your comment could not be submitted.');var empty=list.querySelector('.py2-empty-comments');if(empty)empty.remove();list.insertAdjacentHTML('afterbegin',commentMarkup({name:name,message:message,date:new Date().toISOString()},true));list.scrollTop=0;form.reset();if(window.py2ShowCommentSuccess)window.py2ShowCommentSuccess({form:form,name:name,slug:slug,mode:'modal'});else{status.textContent='Your comment is submitted and is now pending approval.';sub.textContent='Your comment is awaiting review'}}catch(err){status.textContent=err.message||'Could not submit your comment. Please try again.'}finally{submit.disabled=false;submit.textContent='Post Comment'}});
 close.focus();
}
function ensureScrollableCommentsStyles(){
 if(document.getElementById('py2-shared-comments-modal-style'))return;
 var s=document.createElement('style');s.id='py2-shared-comments-modal-style';
 s.textContent='.py2-comments-modal{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(15,23,42,.68);backdrop-filter:blur(4px)}.py2-comments-modal-card{display:flex;flex-direction:column;width:min(100%,620px);max-height:min(90vh,800px);overflow:hidden;border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 24px 80px #02061755}.py2-comments-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #e5eaf2;background:linear-gradient(110deg,#f0fdf4,#eff6ff)}.py2-comments-modal-head h2{margin:0;color:#111827;font-size:19px}.py2-comments-modal-head p{margin:4px 0 0;color:#64748b;font-size:12px}.py2-comments-modal-close{flex:0 0 auto;width:40px;height:40px;border:0;border-radius:50%;background:#fff;color:#172033;font-size:25px;cursor:pointer;box-shadow:0 2px 8px #0f172a12}.py2-comments-modal-list{padding:14px;overflow-y:auto;overscroll-behavior:contain;min-height:70px;flex:1}.py2-comments-modal-list .py2-comment{margin:0 0 10px;padding:13px 14px;border:1px solid #e5eaf2;border-radius:12px;background:#fff}.py2-comments-modal-list .py2-comment-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.py2-comments-modal-list .py2-comment-head strong{color:#172033;font-size:13px}.py2-comments-modal-list .py2-comment-date{color:#94a3b8;font-size:11px}.py2-comments-modal-list .py2-comment-message{margin:8px 0 0;color:#344256;font-size:14px;line-height:1.65;overflow-wrap:anywhere;white-space:pre-wrap}.py2-empty-comments{padding:14px;border:1px dashed #bfdbfe;border-radius:13px;background:#f8fbff;color:#334155}.py2-empty-comments p{font-size:13px;line-height:1.55}.py2-modal-comment-form{display:grid;gap:9px;padding:13px 16px 16px;border-top:1px solid #e5eaf2;background:#fff}.py2-modal-comment-form label{display:grid;gap:5px;color:#344256;font-size:12px;font-weight:800}.py2-modal-comment-form input,.py2-modal-comment-form textarea{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#111827;font:inherit;font-size:14px}.py2-modal-comment-form textarea{min-height:82px;max-height:150px;resize:vertical}.py2-modal-comment-form button{min-height:42px;border:0;border-radius:10px;background:#1677e8;color:#fff!important;-webkit-text-fill-color:#fff;font-size:13px;font-weight:900;cursor:pointer}.py2-modal-comment-form button:disabled{opacity:.6}.py2-modal-comment-status{margin:0;color:#64748b;font-size:11px;line-height:1.4}.py2-comment-pending{border-color:#fbbf24;background:#fffbeb}.py2-pending-badge{display:inline-block;margin-top:8px;padding:4px 8px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:10px;font-weight:900}.py2-comment-honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}@media(max-width:480px){.py2-comments-modal{padding:8px;align-items:flex-end}.py2-comments-modal-card{max-height:94vh;border-radius:18px 18px 12px 12px}.py2-comments-modal-head{padding:12px 14px}.py2-comments-modal-list{padding:10px}.py2-modal-comment-form{padding:10px 12px 12px}}';
 document.head.appendChild(s);
}
document.addEventListener('click',function(e){var b=e.target.closest('[data-open-comments-popup]');if(!b)return;e.preventDefault();ensureScrollableCommentsStyles();openScrollableComments(b.getAttribute('data-open-comments-popup'),b.getAttribute('data-comment-title')||'Comments')});
function loadLatestCommentPreviews(){
 var feed=document.getElementById('blog-feed');if(!feed)return;
 feed.querySelectorAll('[data-latest-comment]').forEach(function(box){
  var slug=box.getAttribute('data-latest-comment');if(!slug||box.dataset.requested==='true')return;
  box.dataset.requested='true';
  fetch('/api/blog-comments?slug='+encodeURIComponent(slug),{headers:{Accept:'application/json'},cache:'no-store'}).then(function(r){if(!r.ok)throw Error();return r.json()}).then(function(data){
   var comments=Array.isArray(data.comments)?data.comments:[];
   if(!comments.length){
    box.innerHTML='<div class="py2-latest-comment-heading"><i class="fa-regular fa-comment-dots" aria-hidden="true"></i><span>Join the conversation</span></div><p>Be the first to comment on this article.</p><button type="button" class="py2-open-comments-popup" data-toggle-comments="'+esc(slug)+'" aria-expanded="false">Be the first to comment</button>';
    box.hidden=false;return;
   }
   var latest=comments[0],date='';
   try{date=latest.date?new Date(latest.date).toLocaleDateString(undefined,{month:'short',day:'numeric'}):''}catch(e){}
   box.innerHTML='<div class="py2-latest-comment-heading"><i class="fa-regular fa-comment-dots" aria-hidden="true"></i><span>Latest comment</span></div><p><strong>'+esc(latest.name||'Reader')+(date?' · '+esc(date):'')+'</strong><br>'+esc(latest.message||'')+'</p><button type="button" class="py2-open-comments-popup" data-open-comments-popup="'+esc(slug)+'" data-comment-title="Comments · '+esc(comments.length)+'">View all comments ('+comments.length+') ↗</button>';
   box.hidden=false;
  }).catch(function(){ box.innerHTML='<div class="py2-latest-comment-heading"><i class="fa-regular fa-comment-dots" aria-hidden="true"></i><span>Be the first to comment</span></div><p>Start the conversation on this article.</p><button type="button" class="py2-open-comments-popup" data-toggle-comments="'+esc(slug)+'" aria-expanded="false">Be the first to comment</button>';box.hidden=false; });
 });
}
function ensureLatestCommentStyles(){
 if(document.getElementById('py2-latest-comment-style'))return;
 var s=document.createElement('style');s.id='py2-latest-comment-style';
 s.textContent='.py2-post-actions button[data-toggle-comments]{color:#174ea6!important;-webkit-text-fill-color:#174ea6!important;background:#eff6ff!important;border:1px solid #bfdbfe!important}.py2-post-actions button[data-toggle-comments] span{color:#174ea6!important;-webkit-text-fill-color:#174ea6!important}.py2-post-actions button[data-toggle-comments]:hover{background:#dbeafe!important}.py2-comment-form button[type=submit]{color:#fff!important;-webkit-text-fill-color:#fff!important;background:#2563eb!important;border-color:#2563eb!important}.py2-latest-comment{margin:0 12px 12px;padding:12px 13px;border:1px solid #dbeafe;border-radius:12px;background:linear-gradient(120deg,#f8fbff,#f0f7ff);overflow-wrap:anywhere}.py2-latest-comment-heading{display:flex;align-items:center;gap:7px;color:#174ea6;font-size:10px;font-weight:900;letter-spacing:.4px;text-transform:uppercase}.py2-latest-comment p{margin:7px 0 9px;color:#344256;font-size:12px;line-height:1.6;white-space:pre-wrap}.py2-latest-comment p strong{color:#172033;font-size:11px}.py2-latest-comment>a{display:inline-flex;align-items:center;gap:5px;color:#1558a6;font-size:11px;font-weight:900;text-decoration:none}.py2-latest-comment>a:hover{text-decoration:underline}';
 document.head.appendChild(s);
}
function render(){
 var saved=getSaved();
 var list=posts.filter(function(p){var matchesCategory=category==='All'||p.category===category;var hay=(p.title+' '+p.excerpt+' '+(p.tags||[]).join(' ')+' '+(p.category||'')).toLowerCase();return matchesCategory&&hay.includes(search.toLowerCase())&&(!showSaved||saved.indexOf(p.slug)>=0)});
 var count=document.getElementById('post-count');if(count)count.textContent=list.length+' post'+(list.length===1?'':'s');
 var feed=document.getElementById('blog-feed');if(feed){var visible=list.slice(0,visibleCount);feed.innerHTML=list.length?visible.map(card).join(''):'<div class="py2-empty"><strong>'+(showSaved?'No saved posts yet.':'Nothing matches that search yet.')+'</strong><p>'+(showSaved?'Tap Save on any post to keep it here on this device.':'Try another topic or choose All stories to see all posts.')+'</p></div>';if(list.length>visible.length){var sentinel=document.createElement('div');sentinel.className='blog-scroll-sentinel';sentinel.innerHTML='<span>Keep scrolling for more stories</span><button type="button" data-load-more>Load more stories ↓</button>';feed.appendChild(sentinel);if(scrollObserver)scrollObserver.observe(sentinel)}ensureLatestCommentStyles();loadLatestCommentPreviews()}
 document.querySelectorAll('[data-rail-category]').forEach(function(b){b.classList.toggle('is-active',b.getAttribute('data-rail-category')===category)});
 updateSavedCount();track('blog_feed_render',{category:category,result_count:list.length,visible_count:Math.min(list.length,visibleCount),search_used:!!search,saved_view:showSaved})
}
function loadMore(){visibleCount+=PAGE_SIZE;enrichVideoLinks(posts.slice(0,visibleCount)).then(render)}

var searchInput=document.getElementById('blog-search'),filters=document.getElementById('blog-filters'),feed=document.getElementById('blog-feed');
if('IntersectionObserver' in window){scrollObserver=new IntersectionObserver(function(entries){if(entries.some(function(entry){return entry.isIntersecting})){scrollObserver.disconnect();if(feed&&feed.querySelector('[data-load-more]'))loadMore()}},{rootMargin:'280px'})}
if(feed)feed.addEventListener('click',function(e){if(e.target.closest('[data-load-more]')){if(scrollObserver)scrollObserver.disconnect();loadMore()}});
if(searchInput)searchInput.addEventListener('input',function(){search=this.value;showSaved=false;visibleCount=PAGE_SIZE;render()});
if(filters)filters.addEventListener('click',function(e){var b=e.target.closest('[data-category]');if(!b)return;category=b.dataset.category;showSaved=false;visibleCount=PAGE_SIZE;filters.querySelectorAll('.blog-category-tab').forEach(function(x){x.classList.toggle('active',x===b)});render()});
document.querySelectorAll('[data-rail-category]').forEach(function(b){b.addEventListener('click',function(){category=this.getAttribute('data-rail-category');showSaved=false;visibleCount=PAGE_SIZE;if(filters){filters.querySelectorAll('.blog-category-tab').forEach(function(x){x.classList.toggle('active',x.getAttribute('data-category')===category)})}render()})});
if(feed){
 feed.addEventListener('submit',async function(e){
  var form=e.target.closest('[data-comment-form]');if(!form)return;
  e.preventDefault();
  var submit=form.querySelector('button[type="submit"]'),status=form.querySelector('[data-comment-status]');
  var name=form.elements.name.value.trim(),message=form.elements.message.value.trim(),website=form.elements.website.value;
  if(name.length<2||message.length<3){if(status)status.textContent='Please enter your name and a comment of at least 3 characters.';return}
  if(submit){submit.disabled=true;submit.textContent='Submitting…'}
  if(status)status.textContent='Sending your comment for review…';
  try{
   var response=await fetch('/api/blog-comments',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({post_slug:form.getAttribute('data-post-slug'),name:name,message:message,website:website})});
   var data=await response.json();
   if(!response.ok)throw new Error(data.error||'Your comment could not be submitted.');
   form.reset();
   if(window.py2ShowCommentSuccess)window.py2ShowCommentSuccess({form:form,name:name,slug:form.getAttribute('data-post-slug'),mode:'inline'});else if(status)status.textContent=data.message||'Thanks! Your comment is awaiting review.';
  }catch(err){if(status)status.textContent=err.message||'Your comment could not be submitted. Please try again.'}
  finally{if(submit){submit.disabled=false;submit.textContent='Submit comment'}}
 });
 feed.addEventListener('click',function(e){
  var commentToggle=e.target.closest('[data-toggle-comments]');
  if(commentToggle){
   var slug=commentToggle.getAttribute('data-toggle-comments'),article=commentToggle.closest('[data-post-slug]'),panel=article&&article.querySelector('[data-comments-panel]');
   if(!panel)return;
   var opening=panel.hidden;panel.hidden=!opening;commentToggle.setAttribute('aria-expanded',opening?'true':'false');
   if(opening&&panel.dataset.loaded!=='true')loadComments(panel,slug);
   if(opening)panel.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
   return;
  }
  var save=e.target.closest('[data-save-post]');if(save){var slug=save.getAttribute('data-save-post'),saved=getSaved(),i=saved.indexOf(slug);if(i>=0)saved.splice(i,1);else saved.unshift(slug);setSaved(saved);render();track('blog_post_save',{post_slug:slug,saved:i<0});return}
  var share=e.target.closest('[data-share-post]');if(share){var p=posts.find(function(x){return x.slug===share.getAttribute('data-share-post')});if(!p)return;var url=location.origin+'/blog-post.html?slug='+encodeURIComponent(p.slug),data={title:p.title||'PhoneYa2 post',text:p.excerpt||'See this PhoneYa2 post',url:url};track('blog_post_share',{post_slug:p.slug});if(navigator.share)navigator.share(data).catch(function(){});else if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(function(){share.classList.add('is-copied');share.querySelector('span').textContent='Link copied'}).catch(function(){window.prompt('Copy this post link',url)});else window.prompt('Copy this post link',url);return}
  var a=e.target.closest('[data-blog-open]');if(a)track('blog_post_open',{post_slug:a.getAttribute('data-blog-open'),link_location:'community_feed'})
 });
}
var savedButton=document.getElementById('show-saved-posts');
if(savedButton)savedButton.addEventListener('click',function(){showSaved=!showSaved;visibleCount=PAGE_SIZE;category='All';if(filters)filters.querySelectorAll('.blog-category-tab').forEach(function(x){x.classList.toggle('active',x.getAttribute('data-category')==='All')});if(searchInput)searchInput.value='';search='';this.innerHTML=showSaved?'<i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span>All posts</span>':'<i class="fa-regular fa-bookmark" aria-hidden="true"></i><span>Saved</span>';this.setAttribute('aria-pressed',showSaved?'true':'false');render();if(feed)feed.scrollIntoView({behavior:'smooth',block:'start'})});
var blogTabs=document.querySelector('.py2-blog-tabs');
function setBlogTab(name){if(!blogTabs)return;blogTabs.querySelectorAll('[data-blog-tab]').forEach(function(link){var active=link.getAttribute('data-blog-tab')===name;link.classList.toggle('is-active',active);if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')})}
if(blogTabs)blogTabs.addEventListener('click',function(e){var link=e.target.closest('[data-blog-tab]');if(!link)return;var name=link.getAttribute('data-blog-tab');if(name==='saved'){e.preventDefault();if(!showSaved&&savedButton)savedButton.click();else if(feed)feed.scrollIntoView({behavior:'smooth',block:'start'});setBlogTab('saved');return}if(name==='feed'&&showSaved&&savedButton)savedButton.click();setBlogTab(name)});
if(filters)filters.addEventListener('click',function(e){if(e.target.closest('[data-category]'))setBlogTab('topics')});
if(savedButton)savedButton.addEventListener('click',function(){setBlogTab(showSaved?'saved':'feed')});

function enrichFeaturedProducts(items){return fetch('/content/products/catalog.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw Error('Product catalogue unavailable');return r.json()}).then(function(catalog){var bySlug={};(Array.isArray(catalog)?catalog:[]).forEach(function(product){if(product&&product.slug)bySlug[product.slug]=product});items.forEach(function(post){post.featured_products=(Array.isArray(post.featured_products)?post.featured_products:[]).map(function(entry){var slug=typeof entry==='string'?entry:String(entry&&entry.product||'');var product=bySlug[slug];if(!product)return null;return Object.assign({},product,{caption:String(entry&&entry.caption||'')})}).filter(Boolean)});return items}).catch(function(){return items})}
fetch('/content/blog/index.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw Error('Blog index unavailable');return r.json()}).then(function(data){var items=Array.isArray(data)?data.filter(function(p){return p&&p.publish!==false}):[];items.sort(function(a,b){return String(b.date).localeCompare(String(a.date))});return Promise.all([enrichVideoLinks(items.slice(0,PAGE_SIZE)),enrichFeaturedProducts(items)]).then(function(){return items})}).then(function(items){posts=items;visibleCount=PAGE_SIZE;populateCategoryFilters();track('blog_hub_view',{published_post_count:posts.length});render()}).catch(function(){var el=document.getElementById('blog-feed');if(el)el.innerHTML='<div class="py2-empty"><strong>The community feed could not load.</strong><p>Check your connection and refresh the page. You can still <a href="/contact.html">contact PhoneYa2</a>.</p></div>';var count=document.getElementById('post-count');if(count)count.textContent='Feed unavailable'});
})();