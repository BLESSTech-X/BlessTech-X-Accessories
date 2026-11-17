(function(){
'use strict';
var section=document.getElementById('phoneya2-community-products');
var root=document.getElementById('community-products-grid');
if(!section||!root)return;
function node(tag,cls,text){var el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el}
function money(v){var n=Number(v);return Number.isFinite(n)&&n>0?'K'+n.toLocaleString('en-ZM',{maximumFractionDigits:2}):''}
function addText(parent,tag,cls,value){if(value){parent.appendChild(node(tag,cls,value))}}
function card(p){
 var url='/product.html?id='+encodeURIComponent(p.slug);
 var price=Number(p.price)||0,original=Number(p.original_price)||0,stock=Number(p.stock)||0;
 var discount=original>price?Math.round((original-price)/original*100):0;
 var save=original>price?original-price:0;
 var details=p.other_product_details||{};
 var variant=[details.brand,details.variant,details.volume,details.fragrance].filter(Boolean).join(' · ');
 var article=node('article','py2-community-product-card');
 var imageLink=node('a','product-image');imageLink.href=url;imageLink.setAttribute('aria-label','View '+(p.title||'PhoneYa2 product'));
 if(p.image){var image=node('img');image.src=p.image;image.alt=p.title||'PhoneYa2 product';image.loading='lazy';image.decoding='async';imageLink.appendChild(image)}else imageLink.textContent='📦';
 article.appendChild(imageLink);
 var body=node('div','product-body');
 addText(body,'span','product-badge',p.offer_label||(p.sales_priority==='campaign'?'Campaign pick':p.sales_priority==='promote'?'PhoneYa2 pick':'PhoneYa2 product'));
 addText(body,'h3','',p.title);
 addText(body,'small','meta',p.category_title);
 addText(body,'p','',p.description);
 addText(body,'p','',p.sales_hook);
 addText(body,'small','meta',variant);
 var prices=node('div','price-row');prices.appendChild(node('strong','price',money(price)));
 if(save>0)prices.appendChild(node('span','was',money(original)));
 body.appendChild(prices);
 if(save>0)addText(body,'p','saving','Save '+money(save)+' · '+discount+'% off');
 addText(body,'p','terms',p.offer_details);
 addText(body,'p','terms',p.order_note);
 addText(body,'small','meta',stock>0?'In stock · '+stock+' in published catalogue':'Check availability on product page');
 var order=node('a','order','Order Now ↗');order.href=url;body.appendChild(order);
 article.appendChild(body);return article;
}
fetch('/content/products/catalog.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw Error('Catalogue unavailable');return r.json()}).then(function(products){
 if(!Array.isArray(products))throw Error('Invalid product catalogue');
 var selected=products.filter(function(p){return p&&p.visibility&&p.visibility.community===true&&Number(p.price)>0&&Number(p.stock)>0});
 selected.sort(function(a,b){var rank=function(p){return p.sales_priority==='promote'?0:p.sales_priority==='campaign'?1:2};return rank(a)-rank(b)||(Number(!!b.featured)-Number(!!a.featured))||String(b.date_added||'').localeCompare(String(a.date_added||''))});
 if(!selected.length)return;
 selected.slice(0,12).forEach(function(p){root.appendChild(card(p))});
 section.hidden=false;
}).catch(function(error){console.warn('[PhoneYa2] Community product catalogue unavailable',error)});
})();