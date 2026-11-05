const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const clean=(v,n=240)=>String(v??"").replace(/[\\u0000-\\u001f\\u007f]/g," ").trim().slice(0,n);
const uuid=()=>crypto.randomUUID();
function sameOrigin(request){const origin=request.headers.get("origin");if(!origin)return true;try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}}
function destination(value,fallback="/shop.html"){const raw=String(value||"").trim();if(!raw||raw.startsWith("//"))return fallback;try{const u=new URL(raw,"https://phoneya2.pages.dev");if(!["https:","http:"].includes(u.protocol))return fallback;return u.origin==="https://phoneya2.pages.dev"?u.pathname+u.search+u.hash:u.href;}catch{return fallback;}}
async function readJson(url){try{const r=await fetch(url,{headers:{"cache-control":"no-cache"}});return r.ok?await r.json():null;}catch{return null;}}
async function insertNotification(db,event){await db.prepare("INSERT OR IGNORE INTO store_notifications(id,event_key,category,kind,title,message,destination,priority,metadata_json,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(uuid(),event.key,event.category,"event",clean(event.title,180),clean(event.message,420),destination(event.destination),event.priority||"normal",JSON.stringify(event.metadata||{}),event.expiresAt||null).run();}
async function syncProducts(db,origin){
 const [slugs,catalog]=await Promise.all([readJson(new URL("/content/products/index.json",origin).href),readJson(new URL("/content/products/catalog.json",origin).href)]);
 if(!Array.isArray(slugs)||!Array.isArray(catalog))return;
 const state=await db.prepare("SELECT source_type FROM store_notification_state WHERE source_type='products'").first();
 const priorRows=await db.prepare("SELECT source_id,price_minor,stock FROM store_notification_snapshots WHERE source_type='products'").all();
 const priorMap=new Map((priorRows.results||[]).map(x=>[x.source_id,x]));
 const bySlug=new Map(catalog.filter(p=>p&&p.slug).map(p=>[String(p.slug),p]));
 const statements=[];
 for(const slugValue of slugs){
  const slug=clean(slugValue,120),p=bySlug.get(slug);if(!slug||!p)continue;
  const price=Number(p.price),stock=Number(p.stock);if(!Number.isFinite(price)||price<0||!Number.isFinite(stock))continue;
  const priceMinor=Math.round(price*100),units=Math.max(0,Math.floor(stock)),prior=priorMap.get(slug);
  if(prior&&state){
   if(Number.isFinite(Number(prior.price_minor))&&priceMinor<Number(prior.price_minor))await insertNotification(db,{key:"product-price-drop:"+slug+":"+priceMinor,category:"price-drops",title:"Price drop: "+(p.title||slug),message:"The price has dropped to ZMW "+price.toFixed(2)+". Take another look while this price is available.",destination:"/product.html?id="+encodeURIComponent(slug),metadata:{slug,price}});
   if(Number(prior.stock)<=0&&units>0)await insertNotification(db,{key:"product-restock:"+slug+":"+units+":"+new Date().toISOString().slice(0,10),category:"restocks",title:"Back in stock: "+(p.title||slug),message:"This product is available again. View the current price and stock.",destination:"/product.html?id="+encodeURIComponent(slug),metadata:{slug,stock:units}});
   if(Number(prior.stock)>3&&units>0&&units<=3)await insertNotification(db,{key:"product-low-stock:"+slug+":"+units,category:"low-stock",title:"Limited availability: "+(p.title||slug),message:"Only "+units+" unit"+(units===1?"":"s")+" currently show as available. Check the product details before ordering.",destination:"/product.html?id="+encodeURIComponent(slug),metadata:{slug,stock:units}});
  }else if(!prior&&state)await insertNotification(db,{key:"new-product:"+slug,category:"products",title:"New in the PhoneYa2 shop: "+(p.title||slug),message:"A new product has been added to the catalogue. Explore the details and current availability.",destination:"/product.html?id="+encodeURIComponent(slug),metadata:{slug}});
  if(!prior||Number(prior.price_minor)!==priceMinor||Number(prior.stock)!==units)statements.push(db.prepare("INSERT INTO store_notification_snapshots(source_type,source_id,price_minor,stock,content_hash,checked_at) VALUES('products',?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(source_type,source_id) DO UPDATE SET price_minor=excluded.price_minor,stock=excluded.stock,checked_at=excluded.checked_at").bind(slug,priceMinor,units,""));
 }
 if(!state)statements.push(db.prepare("INSERT OR IGNORE INTO store_notification_state(source_type) VALUES('products')"));
 if(statements.length)await db.batch(statements);
}
async function syncOffers(db,now){
 try{
  const r=await db.prepare("SELECT ad.id,ad.title,ad.destination_url,a.business_name FROM ads ad JOIN advertisers a ON a.id=ad.advertiser_id WHERE ad.status='approved' AND a.status IN ('active','approved') AND (ad.start_date IS NULL OR ad.start_date<=?) AND (ad.end_date IS NULL OR ad.end_date>=?) ORDER BY ad.created_at DESC LIMIT 100").bind(now,now).all();
  const state=await db.prepare("SELECT source_type FROM store_notification_state WHERE source_type='offers'").first();
  const known=await db.prepare("SELECT source_id FROM store_notification_snapshots WHERE source_type='offers'").all(),ids=new Set((known.results||[]).map(x=>x.source_id)),batch=[];
  for(const a of r.results||[]){const id=clean(a.id,120);if(!id||ids.has(id))continue;if(state)await insertNotification(db,{key:"partner-offer:"+id,category:"offers",title:"A new PhoneYa2 partner offer",message:(a.business_name||"A PhoneYa2 partner")+" has published "+(a.title||"a new offer")+". Explore the details.",destination:destination(a.destination_url,"/community/")});batch.push(db.prepare("INSERT OR IGNORE INTO store_notification_snapshots(source_type,source_id) VALUES('offers',?)").bind(id));}
  if(!state)batch.push(db.prepare("INSERT OR IGNORE INTO store_notification_state(source_type) VALUES('offers')"));if(batch.length)await db.batch(batch);
 }catch(e){console.warn("Store offer sync skipped",String(e).slice(0,180));}
}
async function syncEditorial(db,origin){
 const [blog,seasonal]=await Promise.all([readJson(new URL("/content/blog/index.json",origin).href),readJson(new URL("/content/settings/seasonal-campaigns.json",origin).href)]);
 if(Array.isArray(blog)){
  const state=await db.prepare("SELECT source_type FROM store_notification_state WHERE source_type='blog'").first();
  const knownRows=await db.prepare("SELECT source_id FROM store_notification_snapshots WHERE source_type='blog'").all(),known=new Set((knownRows.results||[]).map(x=>x.source_id)),batch=[];
  for(const post of blog.filter(x=>x&&x.publish===true&&x.slug)){
   const slug=clean(post.slug,120);if(!slug)continue;
   if(state&&!known.has(slug))await insertNotification(db,{key:"new-blog-post:"+slug,category:"stories",title:"New PhoneYa2 guide: "+(post.title||slug),message:clean(post.excerpt||"A new PhoneYa2 article is ready. Discover useful tips and product guidance.",420),destination:"/blog-post.html?slug="+encodeURIComponent(slug)});
   if(!known.has(slug))batch.push(db.prepare("INSERT OR IGNORE INTO store_notification_snapshots(source_type,source_id) VALUES('blog',?)").bind(slug));
  }
  if(!state)batch.push(db.prepare("INSERT OR IGNORE INTO store_notification_state(source_type) VALUES('blog')"));
  if(batch.length)await db.batch(batch);
 }
 if(seasonal&&seasonal.enabled===true){
  const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lusaka",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const active=!seasonal.scheduled||(seasonal.start&&seasonal.end&&day>=String(seasonal.start).slice(0,10)&&day<=String(seasonal.end).slice(0,10));
  if(active){const theme=clean(seasonal.theme||"campaign",60),start=clean(seasonal.start||"always",20),end=clean(seasonal.end||"ongoing",20);await insertNotification(db,{key:"seasonal-campaign:"+theme+":"+start+":"+end,category:"seasonal",title:clean(seasonal.bannerTitle||"A PhoneYa2 seasonal campaign",180),message:clean(seasonal.bannerMessage||"Explore the latest PhoneYa2 seasonal collection and offers.",420),destination:destination(seasonal.bannerUrl||"/shop.html"),priority:"high"});}
 }
}
async function syncCommunity(db){
 try{const r=await db.prepare("SELECT event_key,category,title,message,destination FROM community_notifications ORDER BY created_at DESC LIMIT 30").all();const statements=(r.results||[]).map(n=>db.prepare("INSERT OR IGNORE INTO store_notifications(id,event_key,category,kind,title,message,destination,priority,metadata_json) VALUES(?,?,?,?,?,?,?,?,?)").bind(uuid(),"community-mirror:"+n.event_key,"community","event",clean(n.title,180),clean(n.message,420),destination(n.destination,"/community/"),"normal","{}"));if(statements.length)await db.batch(statements);}catch(e){/* Community migration may not yet be applied. */}
}
async function listNotifications(db,limit){const r=await db.prepare("SELECT id,event_key,category,kind,title,message,destination,priority,metadata_json,created_at,expires_at FROM store_notifications WHERE expires_at IS NULL OR expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') ORDER BY created_at DESC LIMIT ?").bind(limit).all();return(r.results||[]).map(n=>({...n,metadata:(()=>{try{return JSON.parse(n.metadata_json||"{}")}catch{return {}}})()}));}
export async function onRequestGet({request,env}){
 if(!env.DB)return json({ok:false,error:"Store notifications are temporarily unavailable."},503);
 try{const origin=new URL(request.url).origin,now=new Date().toISOString();await syncProducts(env.DB,origin);await syncOffers(env.DB,now);await syncEditorial(env.DB,origin);await syncCommunity(env.DB);const limit=Math.min(100,Math.max(1,Number(new URL(request.url).searchParams.get("limit"))||80));return json({ok:true,notifications:await listNotifications(env.DB,limit),generated_at:now});}
 catch(e){console.error("Store notification sync failed",e?.stack||e);return json({ok:false,error:"Could not load store notifications."},503);}
}
export async function onRequestPost({request,env}){
 if(!env.DB)return json({ok:false,error:"Store event tracking is temporarily unavailable."},503);if(!sameOrigin(request))return json({ok:false,error:"Request origin not allowed."},403);
 let body;try{body=await request.json();}catch{return json({ok:false,error:"Invalid request."},400);}
 const visitor=clean(body.visitor_id,80),action=clean(body.action,40);if(!/^[a-f0-9-]{20,80}$/i.test(visitor))return json({ok:false,error:"Invalid visitor identifier."},400);
 if(action==="cart"){const items=Array.isArray(body.items)?body.items.slice(0,30).map(x=>({slug:clean(x.slug,120),quantity:Math.max(1,Math.min(99,Math.floor(Number(x.quantity)||1)))})).filter(x=>/^[a-z0-9][a-z0-9-]{0,100}$/i.test(x.slug)):[];if(!items.length){await env.DB.prepare("DELETE FROM store_cart_sessions WHERE visitor_id=?").bind(visitor).run();return json({ok:true,saved:false});}await env.DB.prepare("INSERT INTO store_cart_sessions(visitor_id,cart_json,updated_at,expires_at) VALUES(?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now','+30 days')) ON CONFLICT(visitor_id) DO UPDATE SET cart_json=excluded.cart_json,updated_at=excluded.updated_at,expires_at=excluded.expires_at").bind(visitor,JSON.stringify(items)).run();return json({ok:true,saved:true});}
 const allowed=new Set(["product_view","search","cart_add","checkout_start","cart_recovered"]);if(action!=="event"||!allowed.has(clean(body.event_type,40)))return json({ok:false,error:"Unsupported event."},400);
 const eventType=clean(body.event_type,40),slug=clean(body.slug,120),key=clean(body.event_key,120)||visitor+":"+eventType+":"+slug+":"+Math.floor(Date.now()/60000),payload={slug,query:clean(body.query,100),quantity:Math.max(0,Math.min(99,Number(body.quantity)||0)),path:clean(body.path,180)};
 await env.DB.prepare("INSERT OR IGNORE INTO store_visitor_events(id,visitor_id,event_type,event_key,payload_json) VALUES(?,?,?,?,?)").bind(uuid(),visitor,eventType,key,JSON.stringify(payload)).run();return json({ok:true});
}
