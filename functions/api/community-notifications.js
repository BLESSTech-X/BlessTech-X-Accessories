const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:HEADERS});}
const clean=(v,n=180)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,n);
const uuid=()=>crypto.randomUUID();
function safePath(value,fallback="/community/"){
 const raw=String(value||"").trim();if(!raw||raw.startsWith("//"))return fallback;
 try{const u=new URL(raw,"https://phoneya2.pages.dev");return (u.protocol==="https:"||u.protocol==="http:")?u.href:fallback;}catch{return fallback;}
}
async function readJson(url){try{const r=await fetch(url,{headers:{"cache-control":"no-cache"}});if(!r.ok)return null;return await r.json();}catch{return null;}}
async function recordSource(db,type,items){
 const baseline=await db.prepare("SELECT source_type FROM community_notification_state WHERE source_type=?").bind(type).first();
 const statements=[];
 const snapshotRows=await db.prepare("SELECT source_id FROM community_notification_snapshots WHERE source_type=?").bind(type).all();
 const known=new Set((snapshotRows.results||[]).map(row=>row.source_id));
 for(const item of items){
  const id=clean(item.id,180);if(!id)continue;
  const prior=known.has(id);
  if(!prior&&baseline){
   statements.push(db.prepare("INSERT OR IGNORE INTO community_notifications(id,event_key,category,kind,title,message,destination,related_id,related_label) VALUES(?,?,?,?,?,?,?,?,?)")
    .bind(uuid(),"community:"+type+":"+id,item.category,"event",clean(item.title||item.label||"PhoneYa2 update"),clean(item.message||"",420),safePath(item.destination),id,clean(item.label||item.title||"",180)));
  }
  if(!prior)statements.push(db.prepare("INSERT OR IGNORE INTO community_notification_snapshots(source_type,source_id) VALUES(?,?)").bind(type,id));
 }
 if(!baseline)statements.push(db.prepare("INSERT OR IGNORE INTO community_notification_state(source_type) VALUES(?)").bind(type));
 if(statements.length)await db.batch(statements);
}
async function sync(db,request){
 const origin=new URL(request.url).origin,now=new Date().toISOString();
 const [posts,ads,businesses,blog,productSlugs,catalog]=await Promise.all([
  db.prepare("SELECT p.id,p.title,p.slug,p.published_at,p.created_at,a.business_name,pr.slug AS business_slug FROM partner_posts p JOIN advertisers a ON a.id=p.advertiser_id LEFT JOIN advertiser_profiles pr ON pr.advertiser_id=a.id WHERE p.status='published' AND p.moderation_status='approved' AND a.status IN ('active','approved') ORDER BY COALESCE(p.published_at,p.created_at) DESC LIMIT 100").all(),
  db.prepare("SELECT ad.id,ad.title,ad.slug,ad.destination_type,ad.destination_url,ad.created_at,a.business_name,pr.slug AS business_slug FROM ads ad JOIN advertisers a ON a.id=ad.advertiser_id LEFT JOIN advertiser_profiles pr ON pr.advertiser_id=a.id WHERE ad.status='approved' AND a.status IN ('active','approved') AND (ad.start_date IS NULL OR ad.start_date<=?) AND (ad.end_date IS NULL OR ad.end_date>=?) ORDER BY ad.created_at DESC LIMIT 100").bind(now,now).all(),
  db.prepare("SELECT a.id,a.business_name,pr.slug AS business_slug FROM advertisers a JOIN advertiser_profiles pr ON pr.advertiser_id=a.id WHERE a.status IN ('active','approved') AND pr.slug IS NOT NULL AND pr.slug!='' ORDER BY a.created_at DESC LIMIT 200").all(),
  readJson(new URL("/content/blog/index.json",origin).href),
  readJson(new URL("/content/products/index.json",origin).href),
  readJson(new URL("/content/products/catalog.json",origin).href)
 ]);
 const postItems=(posts.results||[]).map(p=>({id:p.id,category:"community",title:"New community post from "+(p.business_name||"a PhoneYa2 partner"),label:p.title||"Community post",message:(p.business_name||"A PhoneYa2 partner")+" has published a new update: "+(p.title||"View the latest post")+".",destination:"/community/#community-post-"+encodeURIComponent(p.id)}));
 const offerItems=(ads.results||[]).map(a=>({id:a.id,category:"offers",title:"A new partner offer is available",label:a.title||a.business_name||"Special offer",message:(a.business_name||"A PhoneYa2 partner")+" has a new promotion: "+(a.title||"Explore the offer")+".",destination:safePath(a.destination_url)}));
 const businessItems=(businesses.results||[]).map(b=>({id:b.id,category:"businesses",title:"Discover a new PhoneYa2 business",label:b.business_name,message:(b.business_name||"A new business")+" is now part of the PhoneYa2 partner network.",destination:b.business_slug?"/b/"+encodeURIComponent(b.business_slug)+"/":"/partners/"}));
 const blogItems=(Array.isArray(blog)?blog:[]).filter(p=>p&&p.publish===true&&p.slug).map(p=>({id:p.slug,category:"blog",title:"New PhoneYa2 article",label:p.title||p.slug,message:"A new PhoneYa2 story is ready to read: "+(p.title||p.slug)+".",destination:"/blog-post.html?slug="+encodeURIComponent(p.slug)}));
 const catalogRows=Array.isArray(catalog)?catalog:[];
 const productItems=(Array.isArray(productSlugs)?productSlugs:[]).map(slug=>{const p=catalogRows.find(x=>x&&x.slug===slug);return{id:slug,category:"products",title:"New product in the PhoneYa2 shop",label:p?.title||slug,message:(p?.title||slug)+" has been added to the PhoneYa2 catalogue.",destination:"/product.html?id="+encodeURIComponent(slug)};});
 await recordSource(db,"posts",postItems);await recordSource(db,"offers",offerItems);await recordSource(db,"businesses",businessItems);await recordSource(db,"blog",blogItems);await recordSource(db,"products",productItems);
}
export async function onRequestGet({request,env}){
 if(!env.DB)return json({ok:false,error:"Community notifications are temporarily unavailable."},503);
 try{
  await sync(env.DB,request);
  const limit=Math.min(100,Math.max(1,Number(new URL(request.url).searchParams.get("limit"))||80));
  const rows=await env.DB.prepare("SELECT id,event_key,category,kind,title,message,destination,related_id,related_label,created_at FROM community_notifications ORDER BY created_at DESC LIMIT ?").bind(limit).all();
  return json({ok:true,notifications:rows.results||[],generated_at:new Date().toISOString()});
 }catch(error){console.error("Community notification sync failed",error?.stack||error);return json({ok:false,error:"Could not load Community notifications."},503);}
}
