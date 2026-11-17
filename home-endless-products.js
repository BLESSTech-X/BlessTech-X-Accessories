/* Endless repeating PhoneYa2 homepage catalogue, using live CMS product data. */
(function(){
'use strict';
var host=document.getElementById('py2-endless-grid'),sentinel=document.getElementById('py2-endless-sentinel');
if(!host||!sentinel)return;
var products=[],cursor=0,observer=null,rendered=0;
var labels={case:'Case',charger:'Charger',cable:'Cable',earphone:'Earphone',powerbank:'Power Bank',protector:'Protector',phone:'Phone',watch:'Watch',accessory:'Other Accessories',other:'Other',perfumes:'Perfumes'};
var colors={case:'linear-gradient(135deg,#54a0ff,#5f27cd)',charger:'linear-gradient(135deg,#feca57,#ff6b6b)',cable:'linear-gradient(135deg,#48dbfb,#54a0ff)',earphone:'linear-gradient(135deg,#ff9ff3,#ff6b6b)',powerbank:'linear-gradient(135deg,#5f27cd,#48dbfb)',protector:'linear-gradient(135deg,#48dbfb,#ff9ff3)',phone:'linear-gradient(135deg,#ff6b6b,#5f27cd)',watch:'linear-gradient(135deg,#54a0ff,#128c7e)',accessory:'linear-gradient(135deg,#25d366,#48dbfb)',other:'linear-gradient(135deg,#feca57,#48dbfb)',perfumes:'linear-gradient(135deg,#8b5cf6,#ec4899)'};
function ensureEditorialStyles(){if(document.getElementById('py2-inline-editorial-style'))return;var s=document.createElement('style');s.id='py2-inline-editorial-style';s.textContent="\n/* Compact editorial inserts keep the endless catalogue in the lead. */\n.py2-editorial-feed-slot{grid-column:1/-1;min-width:0;margin:8px 0 14px}\n.py2-inline-editorial{overflow:hidden;border:2px solid #c8d9ec;border-left:5px solid #1677e8;border-radius:15px;background:linear-gradient(110deg,#fff 0%,#f8fbff 100%);box-shadow:0 7px 22px rgba(18,43,74,.11);max-width:100%}\n.py2-inline-editorial-link{display:grid;grid-template-columns:clamp(104px,18%,180px) minmax(0,1fr);align-items:stretch;min-height:138px;color:#14243a;text-decoration:none}\n.py2-inline-editorial-link:not(:has(>img)){grid-template-columns:minmax(0,1fr)}\n.py2-inline-editorial-link>img{width:100%;height:100%;min-height:138px;max-height:168px;object-fit:cover;background:#edf4fb}\n.py2-inline-editorial-copy{display:flex;flex-direction:column;justify-content:center;gap:6px;padding:14px 17px;min-width:0}\n.py2-inline-editorial-copy>span{font-size:9px;font-weight:900;letter-spacing:.9px;color:#1677e8}\n.py2-inline-editorial-copy strong{font-size:clamp(14px,1.6vw,17px);line-height:1.3;color:#14243a}\n.py2-inline-editorial-copy p{margin:0;color:#607187;font-size:12px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\n.py2-inline-editorial-copy b{font-size:11px;color:#e65b00}\n.py2-inline-editorial-partner{border-color:#c9e3d2;border-left-color:#159447;background:linear-gradient(110deg,#fff 0%,#f7fcf8 100%)}\n.py2-inline-editorial-partner .py2-inline-editorial-copy>span{color:#159447}\n@media(max-width:520px){.py2-inline-editorial-link{grid-template-columns:88px minmax(0,1fr);min-height:116px}.py2-inline-editorial-link>img{min-height:116px;max-height:132px}.py2-inline-editorial-copy{padding:10px 12px;gap:5px}.py2-inline-editorial-copy p{-webkit-line-clamp:2}}\n";document.head.appendChild(s)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function jsq(v){return String(v==null?'':v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/[\r\n]/g,' ')}
function money(v){return Number(v||0).toLocaleString('en-US',{maximumFractionDigits:2})}
function cardFor(p,index){
var stock=Math.max(0,parseInt(p.stock,10)||0),status=stock===0?{label:'Out of Stock',cls:'sb-out',can:false}:stock<=5?{label:'Only '+stock+' left!',cls:'sb-low',can:true}:{label:'In Stock',cls:'sb-in',can:true};
var price=Number(p.price)||0,orig=Number(p.original_price)||0,drop=orig>price,cat=labels[p.category]||p.category_title||p.category||'Other',slug=jsq(p.slug),title=esc(p.title||'Product');
var img=p.image?'<img src="'+esc(p.image)+'" alt="'+title+'" loading="lazy" decoding="async" onerror="this.parentElement.textContent=\'📱\'">':'📱';
var priceRow=drop?'<div class="pcard-price-row"><div class="pcard-price">ZMW '+money(price)+'</div><div class="pcard-orig">ZMW '+money(orig)+'</div><div class="pcard-save">Save ZMW '+money(orig-price)+'</div></div>':'<div class="pcard-price-row"><div class="pcard-price">ZMW '+money(price)+'</div></div>';
var actions=status.can?'<div class="pcard-actions"><button type="button" class="py2-add-cart" onclick="event.stopPropagation();PhoneYa2Cart.add(\''+slug+'\',1,'+stock+')"><i class="fa-solid fa-cart-plus"></i> Add to cart</button><a href="/checkout.html?product='+encodeURIComponent(p.slug)+'&qty=1" class="btn-order" onclick="event.stopPropagation()"><i class="fa-solid fa-bolt"></i> Buy now</a></div>':'<button type="button" class="btn-notify" onclick="event.stopPropagation();notifyMe(\''+jsq(p.title)+'\')"><i class="fa-regular fa-bell"></i> Notify When Available</button>';
var el=document.createElement('article');el.className='pcard'+(drop?' py2-discount-card':'');el.setAttribute('aria-label',p.title||'Product');el.style.animationDelay=Math.min((index%10)*.025,.25)+'s';
el.innerHTML='<div class="cat-badge" style="background:'+(colors[p.category]||'linear-gradient(135deg,#54a0ff,#128c7e)')+'">'+esc(cat)+'</div><div class="stock-badge '+status.cls+'">'+status.label+'</div><a class="pcard-img pcard-image-link" href="/product.html?id='+encodeURIComponent(p.slug)+'" aria-label="View details for '+title+'">'+img+'</a><div class="pcard-body"><div class="pcard-cat">'+esc(cat)+'</div><div class="pcard-name">'+title+'</div>'+(p.offer_label?'<div class="py2-sales-label">'+esc(p.offer_label)+'</div>':'')+(p.sales_hook?'<div class="py2-sales-hook">'+esc(p.sales_hook)+'</div>':'')+'<div class="pcard-desc">'+esc(p.description||'')+'</div>'+(drop?'<div class="price-drop-banner"><i class="fa-solid fa-fire"></i> Price dropped — save ZMW '+money(orig-price)+'!</div>':'')+priceRow+(p.offer_details?'<div class="py2-offer-details">'+esc(p.offer_details)+'</div>':'')+'<a class="pcard-view-details" href="/product.html?id='+encodeURIComponent(p.slug)+'"><i class="fa-solid fa-eye" aria-hidden="true"></i> View Details</a>'+actions+'<div class="card-share-row"><button class="card-share-btn" type="button" aria-label="Share product on Facebook" title="Share on Facebook"><i class="fa-brands fa-facebook-f"></i></button><button class="card-share-btn" type="button" aria-label="Share product on WhatsApp" title="Share on WhatsApp"><i class="fa-brands fa-whatsapp"></i></button><button class="card-share-btn" type="button" aria-label="Copy product link" title="Copy link"><i class="fa-regular fa-copy"></i></button></div></div>';
var buttons=el.querySelectorAll('.card-share-btn');
buttons[0].addEventListener('click',function(e){e.stopPropagation();if(typeof shareFacebookProduct==='function')shareFacebookProduct(p)});
buttons[1].addEventListener('click',function(e){e.stopPropagation();if(typeof shareProduct==='function')shareProduct(p)});
buttons[2].addEventListener('click',function(e){e.stopPropagation();if(typeof copyProductLink==='function')copyProductLink(p.slug,e);else if(navigator.clipboard)navigator.clipboard.writeText(location.origin+'/product.html?id='+encodeURIComponent(p.slug))});
return el;
}
var editorialItems=[],editorialCursor=0,productsSinceEditorial=0,started=false;
function editorialCard(item){
 var href=item.type==='partner'?item.href:'/blog-post.html?slug='+encodeURIComponent(item.slug||'');
 var label=item.type==='partner'?'PHONEYA2 PARTNER':'PHONEYA2 JOURNAL';
 var image=item.image?'<img src="'+esc(item.image)+'" alt="'+esc(item.title)+'" loading="lazy" decoding="async">':'';
 return '<article class="py2-inline-editorial py2-inline-editorial-'+item.type+'"><a class="py2-inline-editorial-link" href="'+esc(href)+'">'+image+'<div class="py2-inline-editorial-copy"><span>'+label+'</span><strong>'+esc(item.title||'A useful update from PhoneYa2')+'</strong><p>'+esc(item.excerpt||'Discover the latest from PhoneYa2 and its business community.').slice(0,125)+'</p><b>'+(item.type==='partner'?'Discover partner ↗':'Read story ↗')+'</b></div></a></article>';
}
function appendEditorial(frag){
 if(!editorialItems.length)return;
 var item=editorialItems[editorialCursor%editorialItems.length];
 editorialCursor++;
 var wrap=document.createElement('div');wrap.className='py2-editorial-feed-slot';wrap.innerHTML=editorialCard(item);frag.appendChild(wrap);
}
function appendBatch(count){
 if(!products.length)return;
 count=Math.max(1,Math.min(12,Number(count)||8));
 var frag=document.createDocumentFragment();
 for(var i=0;i<count;i++){
  frag.appendChild(cardFor(products[cursor],rendered++));
  cursor=(cursor+1)%products.length;
  productsSinceEditorial++;
  if(productsSinceEditorial>=6){productsSinceEditorial=0;appendEditorial(frag)}
 }
 host.appendChild(frag);
}
function loadEditorial(){
 return Promise.all([
  fetch('/content/blog/index.json',{cache:'no-cache'}).then(function(r){return r.ok?r.json():[]}).catch(function(){return []}),
  fetch('/api/community',{headers:{accept:'application/json'},cache:'no-store'}).then(function(r){return r.ok?r.json():{}}).catch(function(){return {}})
 ]).then(function(results){
  var blogs=Array.isArray(results[0])?results[0].filter(function(p){return p&&p.slug&&p.publish!==false}):[];
  blogs.sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''))});
  var partners=results[1]&&results[1].ok&&Array.isArray(results[1].posts)?results[1].posts.filter(function(p){return Number(p.is_featured)===1}):[];
  editorialItems=blogs.slice(0,8).map(function(p){return{type:'blog',slug:p.slug,title:p.title,excerpt:p.excerpt,image:p.image||p.featured_image||''}});
  partners.slice(0,8).forEach(function(p){editorialItems.push({type:'partner',title:p.title,excerpt:p.excerpt||p.body,image:p.cover_image_url||'',href:p.business_slug?'/b/'+encodeURIComponent(p.business_slug)+'/':'/community/'})});
  // Alternate journal and partner content so neither source dominates the shopping feed.
  var blogItems=editorialItems.filter(function(x){return x.type==='blog'}),partnerItems=editorialItems.filter(function(x){return x.type==='partner'}),mixed=[];
  for(var i=0;i<Math.max(blogItems.length,partnerItems.length);i++){if(blogItems[i])mixed.push(blogItems[i]);if(partnerItems[i])mixed.push(partnerItems[i])}
  editorialItems=mixed;
 });
}
function start(list){
 ensureEditorialStyles();
 if(started||!Array.isArray(list)||!list.length)return;
 started=true;
 products=list.filter(function(p){return p&&p.slug&&Number.isFinite(Number(p.price))&&(!p.visibility||p.visibility.homepage!==false)});
 if(!products.length){host.innerHTML='<div class="py2-endless-loading">Products are temporarily unavailable. Please visit the shop to browse the catalogue.</div>';return}
 host.innerHTML='';
 loadEditorial().then(function(){
  appendBatch(Math.min(8,products.length));
  if(observer)observer.disconnect();
  if('IntersectionObserver'in window){observer=new IntersectionObserver(function(entries){if(entries.some(function(e){return e.isIntersecting})){appendBatch(8)}},{rootMargin:'500px 0px'});observer.observe(sentinel)}
  else{window.addEventListener('scroll',function(){if(sentinel.getBoundingClientRect().top<window.innerHeight+900)appendBatch(8)},{passive:true})}
 });
}
window.addEventListener('phoneya2:catalog-ready',function(e){start(e.detail)});
if(Array.isArray(window.phoneya2Products)&&window.phoneya2Products.length)start(window.phoneya2Products);
})();