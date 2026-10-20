(function(){
'use strict';
var root=document.getElementById('blog-products-grid');if(!root)return;
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function money(v){if(v==null||v===''||!Number.isFinite(Number(v))||Number(v)<=0)return '';return 'K'+Number(v).toLocaleString('en-ZM',{maximumFractionDigits:2})}
function card(p){
 var url='/product.html?id='+encodeURIComponent(p.slug),price=Number(p.price)||0,original=Number(p.original_price)||0,stock=Number(p.stock)||0,save=original>price?Math.round(original-price):0;
 var badge=p.offer_label||(p.sales_priority==='promote'?'PhoneYa2 pick':p.sales_priority==='campaign'?'Campaign pick':p.featured?'Featured':'Recommended');
 return '<article class="py2-product-card py2-selling-pick'+(save>0?' py2-discount-card':'')+'">'+(p.image?'<a class="py2-product-image-link" href="'+url+'"><img loading="lazy" decoding="async" src="'+esc(p.image)+'" alt="'+esc(p.title)+'" onerror="this.closest(\'.py2-product-image-link\').classList.add(\'image-failed\')"></a>':'<a href="'+url+'" class="py2-product-image-fallback" aria-label="'+esc(p.title)+'">📦</a>')+'<div class="py2-product-card-body"><span class="py2-selling-badge">'+esc(badge)+'</span><h3><a href="'+url+'">'+esc(p.title)+'</a></h3>'+(p.sales_hook?'<p class="py2-selling-hook">'+esc(p.sales_hook)+'</p>':'')+'<div class="py2-selling-price-row"><strong class="py2-product-price">'+esc(money(price))+'</strong>'+(save>0?'<span class="py2-selling-was">'+esc(money(original))+'</span>':'')+'</div>'+(save>0?'<p class="py2-selling-savings">Save '+esc(money(save))+' against the listed reference price</p>':'')+(p.offer_details?'<p class="py2-selling-terms">'+esc(p.offer_details)+'</p>':'')+'<div class="py2-product-stock">'+(stock>0?'In stock · confirm current availability':'Check availability before ordering')+'</div><a class="py2-product-link py2-selling-cta" href="'+url+'">View details &amp; buy <span>↗</span></a></div></article>';
}
function render(products){
 var rank=p=>p.sales_priority==='promote'?0:p.sales_priority==='campaign'?1:2;
 var available=products.filter(p=>Number(p.stock)>0&&Number(p.price)>0).sort((a,b)=>rank(a)-rank(b)||(Number(!!b.featured)-Number(!!a.featured))||(Number(b.date_added?new Date(b.date_added).getTime():0)-Number(a.date_added?new Date(a.date_added).getTime():0))||Number(a.price)-Number(b.price)).slice(0,12);
 if(!available.length){root.innerHTML='<p class="py2-product-empty">No products are currently available. Visit the shop to check the full catalogue.</p>';return}
 root.innerHTML=available.map(card).join('');
}
fetch('/content/products/catalog.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw Error('Product catalogue unavailable');return r.json()}).then(function(data){if(!Array.isArray(data))throw Error('Product catalogue has an unexpected format');render(data)}).catch(function(){root.innerHTML='<p class="py2-product-empty">Product picks are temporarily unavailable. <a href="/shop.html">Browse the full shop ↗</a></p>'});
})();