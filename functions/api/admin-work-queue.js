const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const clean=(v,n=500)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,n);
const uuid=()=>crypto.randomUUID();
async function authorized(request,env){
 const {getAdminSession,sameOrigin}=await import("../_auth.js");
 return sameOrigin(request)&&!!(await getAdminSession(request,env));
}
function safeImage(value){const raw=clean(value,800);try{const u=new URL(raw,"https://phoneya2.pages.dev");return ["https:","http:"].includes(u.protocol)?u.href:"";}catch{return "";}}
async function addTask(db,item){
 await db.prepare("INSERT OR IGNORE INTO admin_work_items(id,source_key,category,title,message,image_url,destination,action_url,priority,related_id) VALUES(?,?,?,?,?,?,?,?,?,?)")
 .bind(uuid(),item.source_key,item.category||"operations",clean(item.title,180),clean(item.message,600),safeImage(item.image_url),clean(item.destination||"/admin/command-center.html",500),clean(item.action_url||"/admin/communications.html",500),item.priority||"normal",clean(item.related_id,120)).run();
}
async function prepareProductCampaign(db,product){
 const automation=await db.prepare("SELECT enabled FROM communication_automations WHERE automation_key='new_product_announcement'").first();
 if(!Number(automation?.enabled))return null;
 const slug=clean(product.slug,120);if(!slug)return null;
 const sourceKey="auto-new-product:"+slug;
 const title=clean(product.title||slug,160),price=Number(product.price);
 const priceLine=Number.isFinite(price)&&price>0?"\nPrice: ZMW "+price.toFixed(2):"";
 const image=safeImage(product.image);
 const body="Meet "+title+" — newly added to PhoneYa2 Accessories."+priceLine+"\n\nExplore the product: https://phoneya2.pages.dev/product.html?id="+encodeURIComponent(slug)+"\n\nSmart CHOICES. Better CONNECTED 💙";
 const id=uuid();
 await db.prepare("INSERT OR IGNORE INTO email_campaigns(id,created_by,name,subject,body_text,audience,message_type,status,source_key,hero_image_url) VALUES(?,?,?,?,?,'subscribed','marketing','draft',?,?)")
 .bind(id,"PhoneYa2 Automation","New product: "+title,"Just added: "+title,body,sourceKey,image).run();
 const campaign=await db.prepare("SELECT id FROM email_campaigns WHERE source_key=?").bind(sourceKey).first();
 await db.prepare("INSERT OR IGNORE INTO product_announcement_jobs(id,product_slug,product_title,product_price,status) VALUES(?,?,?,?,'queued')")
 .bind(uuid(),slug,title,Number.isFinite(price)?price:0).run();
 return campaign?.id||null;
}
async function syncWork(db,request){
 const origin=new URL(request.url).origin;
 const [indexRes,catalogRes,blogRes]=await Promise.all([
  fetch(new URL("/content/products/index.json",origin),{headers:{"cache-control":"no-cache"}}),
  fetch(new URL("/content/products/catalog.json",origin),{headers:{"cache-control":"no-cache"}}),
  fetch(new URL("/content/blog/index.json",origin),{headers:{"cache-control":"no-cache"}})
 ]);
 const [index,catalog,blog]=await Promise.all([
  indexRes.ok?indexRes.json():[],catalogRes.ok?catalogRes.json():[],blogRes.ok?blogRes.json():[]
 ]);
 const products=Array.isArray(catalog)?catalog:[];
 const productSlugs=Array.isArray(index)?index:[];
 for(const slugValue of productSlugs){
  const slug=clean(slugValue,120),p=products.find(x=>String(x.slug)===slug);if(!slug||!p)continue;
  const event=await db.prepare("SELECT id FROM admin_notifications WHERE event_key=?").bind("published:products:"+slug).first();
  if(!event)continue;
  const campaignId=await prepareProductCampaign(db,{...p,slug});
  await addTask(db,{source_key:"product-published:"+slug,category:"products",title:"Review new-product email: "+(p.title||slug),message:"A product is live and a newsletter email draft has been prepared. Check the product details and approve it before sending.",image_url:p.image,destination:"/admin/#/collections/products",action_url:campaignId?"/admin/campaigns.html?campaign="+encodeURIComponent(campaignId):"/admin/campaigns.html",priority:"high",related_id:campaignId||slug});
 }
 for(const post of (Array.isArray(blog)?blog:[]).filter(x=>x&&x.publish===true&&x.slug)){
  const slug=clean(post.slug,120),event=await db.prepare("SELECT id FROM admin_notifications WHERE event_key=?").bind("published:blog:"+slug).first();
  if(!event)continue;
  await addTask(db,{source_key:"blog-published:"+slug,category:"blog",title:"Promote new article: "+(post.title||slug),message:"A new guide is published. Review a suggested newsletter mention and decide whether to include it in your next campaign.",image_url:post.image||post.featured_image||post.cover_image,destination:"/admin/#/collections/blog_posts",action_url:"/admin/campaigns.html",priority:"normal",related_id:slug});
 }
 const notifications=await db.prepare("SELECT id,event_key,category,title,message,image_url,destination,priority,related_id FROM admin_notifications WHERE is_read=0 ORDER BY created_at DESC LIMIT 100").all();
 for(const n of notifications.results||[]){
  await addTask(db,{source_key:"notification:"+n.event_key,category:n.category,title:n.title,message:n.message,image_url:n.image_url,destination:n.destination,action_url:n.destination||"/admin/communications.html",priority:n.priority,related_id:n.related_id});
 }
}
export async function onRequest({request,env}){
 if(!await authorized(request,env))return json({error:"Administrator sign-in required."},401);
 if(!env.DB)return json({error:"Cloudflare D1 binding DB is not configured."},503);
 try{
  if(request.method==="GET"){
   await syncWork(env.DB,request);
   const [rows,counts]=await Promise.all([
    env.DB.prepare("SELECT * FROM admin_work_items WHERE status IN ('pending','approved') ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,created_at DESC LIMIT 150").all(),
    env.DB.prepare("SELECT status,COUNT(*) AS total FROM admin_work_items GROUP BY status").all()
   ]);
   const summary={pending:0,approved:0,ignored:0,completed:0};for(const r of counts.results||[])summary[r.status]=Number(r.total||0);
   return json({success:true,items:rows.results||[],summary,generated_at:new Date().toISOString()});
  }
  if(request.method==="POST"){
   const body=await request.json().catch(()=>null);if(!body||typeof body!=="object")return json({error:"Invalid request."},400);
   const id=clean(body.id,100),action=clean(body.action,30);
   const status=({ignore:"ignored",complete:"completed",approve:"approved",reopen:"pending"})[action];
   if(!id||!status)return json({error:"Choose a valid work item action."},400);
   const result=await env.DB.prepare("UPDATE admin_work_items SET status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(status,id).run();
   if(!result.meta?.changes)return json({error:"Work item not found."},404);
   return json({success:true,status});
  }
  return json({error:"Method not allowed."},405);
 }catch(error){console.error("Command Centre work queue failed:",error?.stack||error);return json({error:"Could not load prepared work. Check that migration 0024 is applied."},503);}
}
