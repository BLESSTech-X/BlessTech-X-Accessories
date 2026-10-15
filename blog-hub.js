(function(){
'use strict';
var posts=[],category='All',search='',showSaved=false;
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
function mediaMarkup(p){
 if(p.video_url){var video=videoMarkup(p.video_url,p.title);if(video)return video}
 if(p.image)return '<a class="py2-feed-media" href="/blog-post.html?slug='+encodeURIComponent(p.slug)+'"><img loading="lazy" decoding="async" src="'+esc(p.image)+'" alt="'+esc(p.title)+'" onerror="this.closest(\'.py2-feed-media\').classList.add(\'py2-media-failed\')"><span class="py2-media-fallback">PhoneYa2 community post</span></a>';
 return '<a class="py2-feed-no-media" href="/blog-post.html?slug='+encodeURIComponent(p.slug)+'"><span>PY<span>2</span></span><small>PHONEYA2 COMMUNITY</small></a>'
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
  '<div class="py2-post-author-row"><div class="py2-post-avatar">PY<span>2</span></div>',
  '<div class="py2-post-author"><strong>PhoneYa2 <span class="py2-verified" aria-label="PhoneYa2">✓</span></strong>',
  '<span>',esc(dateLabel(p.date)),' · <i class="fa-solid fa-earth-africa" aria-label="Public"></i></span></div>',
  '<span class="py2-post-category">',esc(p.category||'Community'),'</span></div>',
  '<div class="py2-post-copy"><h3><a href="',href,'" data-blog-open="',esc(p.slug),'">',esc(p.title||'PhoneYa2 update'),'</a></h3>',
  '<p>',esc(p.excerpt||'Explore this PhoneYa2 update.'),'</p></div>',
  mediaMarkup(p),
  '<div class="py2-post-tags">',tags,'</div>',
  '<div class="py2-post-actions"><button type="button" class="py2-post-action',saveClass,'" data-save-post="',esc(p.slug),'" aria-pressed="',saved?'true':'false','"><i class="fa-',saveIcon,' fa-bookmark" aria-hidden="true"></i><span>',saveLabel,'</span></button>',
  '<button type="button" class="py2-post-action" data-share-post="',esc(p.slug),'"><i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i><span>Share</span></button>',
  '<a class="py2-post-action py2-post-open" href="',href,'" data-blog-open="',esc(p.slug),'"><i class="fa-regular fa-comment-dots" aria-hidden="true"></i><span>Open post</span></a></div>',
  '<div class="py2-post-footer"><span><i class="fa-solid fa-lightbulb" aria-hidden="true"></i> Smart choices. Better connected.</span>',
  '<a href="',href,'" data-blog-open="',esc(p.slug),'">Read full post ↗</a></div></article>'
 ].join('');
}
function render(){
 var saved=getSaved();
 var list=posts.filter(function(p){var matchesCategory=category==='All'||p.category===category;var hay=(p.title+' '+p.excerpt+' '+(p.tags||[]).join(' ')+' '+(p.category||'')).toLowerCase();return matchesCategory&&hay.includes(search.toLowerCase())&&(!showSaved||saved.indexOf(p.slug)>=0)});
 var count=document.getElementById('post-count');if(count)count.textContent=list.length+' post'+(list.length===1?'':'s');
 var feed=document.getElementById('blog-feed');if(feed)feed.innerHTML=list.length?list.map(card).join(''):'<div class="py2-empty"><strong>'+(showSaved?'No saved posts yet.':'Nothing matches that search yet.')+'</strong><p>'+(showSaved?'Tap Save on any post to keep it here on this device.':'Try another topic or choose For you to see all posts.')+'</p></div>';
 document.querySelectorAll('[data-rail-category]').forEach(function(b){b.classList.toggle('is-active',b.getAttribute('data-rail-category')===category)});
 updateSavedCount();track('blog_feed_render',{category:category,result_count:list.length,search_used:!!search,saved_view:showSaved})
}
var searchInput=document.getElementById('blog-search'),filters=document.getElementById('blog-filters'),feed=document.getElementById('blog-feed');
if(searchInput)searchInput.addEventListener('input',function(){search=this.value;showSaved=false;render()});
if(filters)filters.addEventListener('click',function(e){var b=e.target.closest('[data-category]');if(!b)return;category=b.dataset.category;showSaved=false;filters.querySelectorAll('.blog-category-tab').forEach(function(x){x.classList.toggle('active',x===b)});render()});
document.querySelectorAll('[data-rail-category]').forEach(function(b){b.addEventListener('click',function(){category=this.getAttribute('data-rail-category');showSaved=false;if(filters){filters.querySelectorAll('.blog-category-tab').forEach(function(x){x.classList.toggle('active',x.getAttribute('data-category')===category)})}render()})});
if(feed){
 feed.addEventListener('click',function(e){
  var save=e.target.closest('[data-save-post]');if(save){var slug=save.getAttribute('data-save-post'),saved=getSaved(),i=saved.indexOf(slug);if(i>=0)saved.splice(i,1);else saved.unshift(slug);setSaved(saved);render();track('blog_post_save',{post_slug:slug,saved:i<0});return}
  var share=e.target.closest('[data-share-post]');if(share){var p=posts.find(function(x){return x.slug===share.getAttribute('data-share-post')});if(!p)return;var url=location.origin+'/blog-post.html?slug='+encodeURIComponent(p.slug),data={title:p.title||'PhoneYa2 post',text:p.excerpt||'See this PhoneYa2 post',url:url};track('blog_post_share',{post_slug:p.slug});if(navigator.share)navigator.share(data).catch(function(){});else if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(function(){share.classList.add('is-copied');share.querySelector('span').textContent='Link copied'}).catch(function(){window.prompt('Copy this post link',url)});else window.prompt('Copy this post link',url);return}
  var a=e.target.closest('[data-blog-open]');if(a)track('blog_post_open',{post_slug:a.getAttribute('data-blog-open'),link_location:'community_feed'})
 });
}
var savedButton=document.getElementById('show-saved-posts');if(savedButton)savedButton.addEventListener('click',function(){showSaved=!showSaved;category='All';if(filters)filters.querySelectorAll('.py2-filter').forEach(function(x){x.classList.toggle('active',x.getAttribute('data-category')==='All')});if(searchInput)searchInput.value='';search='';this.textContent=showSaved?'Back to all posts':'Show saved posts';render();if(feed)feed.scrollIntoView({behavior:'smooth',block:'start'})});
fetch('/content/blog/index.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw Error('Blog index unavailable');return r.json()}).then(function(data){posts=Array.isArray(data)?data.filter(function(p){return p&&p.publish!==false}):[];posts.sort(function(a,b){return String(b.date).localeCompare(String(a.date))});track('blog_hub_view',{published_post_count:posts.length});render()}).catch(function(){var el=document.getElementById('blog-feed');if(el)el.innerHTML='<div class="py2-empty"><strong>The community feed could not load.</strong><p>Check your connection and refresh the page. You can still <a href="/contact.html">contact PhoneYa2</a>.</p></div>';var count=document.getElementById('post-count');if(count)count.textContent='Feed unavailable'});
})();