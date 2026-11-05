const SITE="https://phoneya2.pages.dev";
const STORE_SYNC_URL=SITE+"/api/store-notifications?limit=1";
const jsonHeaders={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const id=()=>crypto.randomUUID();
const clean=(v,n=500)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,n);
function safeImage(value){const raw=clean(value,800);try{const u=new URL(raw,SITE);return ["https:","http:"].includes(u.protocol)&&!u.username&&!u.password?u.href:"";}catch{return "";}}
async function readJson(path){const response=await fetch(SITE+path,{headers:{"cache-control":"no-cache"}});if(!response.ok)throw new Error("Content source "+path+" returned HTTP "+response.status);return response.json();}
async function syncPublished(db,type,items){
 const baseline=await db.prepare("SELECT content_slug FROM admin_content_snapshots WHERE source_type=? AND content_slug='__baseline__'").bind(type).first();
 const isBaseline=!baseline;
 for(const item of items){
  const slug=clean(item.slug,120);if(!slug)continue;
  const existing=await db.prepare("SELECT content_slug FROM admin_content_snapshots WHERE source_type=? AND content_slug=?").bind(type,slug).first();
  const title=clean(item.title||slug,180),image=safeImage(item.image_url||"");
  if(!existing&&!isBaseline){
   const category=type==="products"?"products":"blog";
   const event=type==="products"?"product_published":"blog_published";
   const destination=type==="products"?"/admin/#/collections/products":"/admin/#/collections/blog_posts";
   const message=type==="products"?"A new product, "+title+", is now in the published catalogue.":"A new PhoneYa2 blog post, "+title+", is now published.";
   await db.prepare("INSERT OR IGNORE INTO admin_notifications(id,event_key,category,event_type,title,message,priority,destination,related_id,related_label,image_url) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id(),"published:"+type+":"+slug,category,event,title===" "? "New content published":(type==="products"?"New product published":"New blog post published"),message,"normal",destination,slug,title,image).run();
  }
  await db.prepare("INSERT OR IGNORE INTO admin_content_snapshots(source_type,content_slug,content_title) VALUES(?,?,?)").bind(type,slug,title).run();
  if(image)await db.prepare("UPDATE admin_notifications SET image_url=? WHERE event_key=? AND (image_url='' OR image_url IS NULL)").bind(image,"published:"+type+":"+slug).run();
 }
 if(isBaseline)await db.prepare("INSERT OR IGNORE INTO admin_content_snapshots(source_type,content_slug,content_title) VALUES(?,'__baseline__','Initial content baseline')").bind(type).run();
}
async function prepareCampaign(db,kind,item){
 const automationKey=kind==="product"?"new_product_announcement":"new_blog_announcement";
 const automation=await db.prepare("SELECT enabled FROM communication_automations WHERE automation_key=?").bind(automationKey).first();
 if(!Number(automation?.enabled))return null;
 const slug=clean(item.slug,120);if(!slug)return null;
 const sourceKey="auto-new-"+kind+":"+slug;
 const title=clean(item.title||slug,160),image=safeImage(item.image_url||"");
 let subject,body,price=Number(item.price);
 if(kind==="product"){
  subject="Just added: "+title;
  const priceLine=Number.isFinite(price)&&price>0?"\nPrice: ZMW "+price.toFixed(2):"";
  body="Meet "+title+" — newly added to PhoneYa2 Accessories."+priceLine+"\n\nExplore the product: "+SITE+"/product.html?id="+encodeURIComponent(slug)+"\n\nSmart CHOICES. Better CONNECTED 💙";
 }else{
  subject="New PhoneYa2 guide: "+title;
  body=title+"\n\n"+clean(item.excerpt||"A new PhoneYa2 guide is ready. Read the latest tips and product guidance.",700)+"\n\nRead the full guide: "+SITE+"/blog-post.html?slug="+encodeURIComponent(slug)+"\n\nSmart CHOICES. Better CONNECTED 💙";
 }
 await db.prepare("INSERT OR IGNORE INTO email_campaigns(id,created_by,name,subject,body_text,audience,message_type,status,source_key,hero_image_url) VALUES(?,?,?,?,?,'subscribed','marketing','draft',?,?)")
  .bind(id(),"PhoneYa2 Automation",(kind==="product"?"New product: ":"New article: ")+title,subject,body,sourceKey,image).run();
 const campaign=await db.prepare("SELECT id FROM email_campaigns WHERE source_key=?").bind(sourceKey).first();
 if(kind==="product"){
  await db.prepare("INSERT OR IGNORE INTO product_announcement_jobs(id,product_slug,product_title,product_price,status) VALUES(?,?,?,?,'queued')")
   .bind(id(),slug,title,Number.isFinite(price)?price:0).run();
 }
 return campaign?.id||null;
}
async function prepareWork(db,products,posts){
 const productMap=new Map(products.map(p=>[String(p.slug),p]));
 const blogMap=new Map(posts.map(p=>[String(p.slug),p]));
 const events=await db.prepare("SELECT event_key,category,event_type,title,message,image_url,destination,priority,related_id,related_label FROM admin_notifications WHERE is_read=0 ORDER BY created_at DESC LIMIT 200").all();
 for(const event of events.results||[]){
  const product=event.event_type==="product_published"?productMap.get(event.related_id):null;
  const post=event.event_type==="blog_published"?blogMap.get(event.related_id):null;
  let campaignId=null,sourceKey="notification:"+event.event_key,category=event.category||"operations",title=event.title||"Business activity",message=event.message||"A business event needs your attention.",actionUrl=event.destination||"/admin/communications.html",priority=event.priority||"normal",image=event.image_url||"";
  if(product){
   campaignId=await prepareCampaign(db,"product",{...product,slug:event.related_id,image_url:product.image||product.image_url});
   sourceKey="product-published:"+event.related_id;category="products";title="New product: "+clean(product.title||event.related_id,150);
   message=campaignId?"A newsletter draft has been created and saved for your review. Check its image, wording and audience before sending.":"The product is published. No email draft was created because the product-announcement automation is disabled or could not be verified. Enable it or prepare a campaign manually.";
   actionUrl=campaignId?"/admin/campaigns.html?campaign="+encodeURIComponent(campaignId):"/admin/communications.html";
   priority="high";image=product.image||product.image_url||image;
  }else if(post){
   campaignId=await prepareCampaign(db,"blog",{...post,slug:event.related_id,image_url:post.image||post.featured_image||post.cover_image});
   sourceKey="blog-published:"+event.related_id;category="blog";title="New article: "+clean(post.title||event.related_id,150);
   message=campaignId?"A newsletter draft has been created and saved for your review. Check its image, wording and audience before sending.":"The article is published. No email draft was created because the article-announcement automation is disabled or could not be verified. Enable it or prepare a campaign manually.";
   actionUrl=campaignId?"/admin/campaigns.html?campaign="+encodeURIComponent(campaignId):"/admin/communications.html";
   image=post.image||post.featured_image||post.cover_image||image;
  }
  const relatedId=campaignId||event.related_id||"";
  await db.prepare("INSERT OR IGNORE INTO admin_work_items(id,source_key,category,title,message,image_url,destination,action_url,priority,related_id) VALUES(?,?,?,?,?,?,?,?,?,?)")
   .bind(id(),sourceKey,category,clean(title,180),clean(message,600),safeImage(image),clean(event.destination||"/admin/command-center.html",500),clean(actionUrl,500),priority,clean(relatedId,120)).run();
 }
}
async function runSync(env){
 if(!env.DB)throw new Error("D1 binding DB is missing from the notification scheduler.");
 const response=await fetch(STORE_SYNC_URL,{headers:{"cache-control":"no-store","user-agent":"PhoneYa2-Notification-Scheduler/2.0"}});
 if(!response.ok)throw new Error("Store notification sync returned HTTP "+response.status);
 const storeResult=await response.json();if(!storeResult||storeResult.ok!==true)throw new Error("Store notification sync did not confirm success");
 const [slugs,catalog,blog]=await Promise.all([readJson("/content/products/index.json"),readJson("/content/products/catalog.json"),readJson("/content/blog/index.json")]);
 if(!Array.isArray(slugs)||!Array.isArray(catalog)||!Array.isArray(blog))throw new Error("Published content indexes have an invalid shape.");
 const productMap=new Map(catalog.filter(p=>p&&p.slug).map(p=>[String(p.slug),p]));
 const products=slugs.map(slug=>productMap.get(String(slug))).filter(Boolean);
 const posts=blog.filter(p=>p&&p.publish===true&&p.slug);
 await syncPublished(env.DB,"products",products.map(p=>({slug:p.slug,title:p.title,image_url:p.image||p.image_url})));
 await syncPublished(env.DB,"blog",posts.map(p=>({slug:p.slug,title:p.title,image_url:p.image||p.featured_image||p.cover_image})));
 await prepareWork(env.DB,products,posts);
 return {ok:true,generated_at:new Date().toISOString(),products:products.length,articles:posts.length,store_notifications:storeResult.notifications?.length||0};
}
export default {
 async scheduled(controller,env,ctx){ctx.waitUntil(runSync(env).then(result=>console.log("PhoneYa2 automation cycle completed:",JSON.stringify(result))).catch(error=>console.error("PhoneYa2 automation cycle failed:",String(error?.stack||error).slice(0,500))));},
 async fetch(request,env){try{const result=await runSync(env);return new Response(JSON.stringify(result),{headers:jsonHeaders});}catch(error){return new Response(JSON.stringify({ok:false,error:"Automation cycle failed.",detail:String(error).slice(0,300)}),{status:503,headers:jsonHeaders});}}
};