const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:HEADERS});}
async function admin(request,env){
 const {getAdminSession,sameOrigin}=await import("../_auth.js");
 if(!sameOrigin(request))return false;
 return !!(await getAdminSession(request,env));
}
async function syncPublishedContent(request,env){
 try{
  const origin=new URL(request.url).origin;
  const [productIndexRes,catalogRes,blogRes]=await Promise.all([
   fetch(new URL("/content/products/index.json",origin),{headers:{"cache-control":"no-cache"}}),
   fetch(new URL("/content/products/catalog.json",origin),{headers:{"cache-control":"no-cache"}}),
   fetch(new URL("/content/blog/index.json",origin),{headers:{"cache-control":"no-cache"}})
  ]);
  const productSlugs=productIndexRes.ok?await productIndexRes.json():[];
  const catalog=catalogRes.ok?await catalogRes.json():[];
  const blogPosts=blogRes.ok?await blogRes.json():[];
  const sources=[
   {type:"products",items:Array.isArray(productSlugs)?productSlugs.map(slug=>{const p=Array.isArray(catalog)?catalog.find(x=>x.slug===slug):null;return{slug:String(slug),title:String(p?.title||slug),image_url:String(p?.image||""),category:"products",event:"product_published",destination:"/admin/#/collections/products",label:"New product published",message:"A new product, "+String(p?.title||slug)+", is now in the published catalogue."};}):[]},
   {type:"blog",items:Array.isArray(blogPosts)?blogPosts.map(post=>({slug:String(post.slug||""),title:String(post.title||post.slug||"Blog post"),image_url:String(post.image||post.featured_image||post.cover_image||""),category:"blog",event:"blog_published",destination:"/admin/#/collections/blog_posts",label:"New blog post published",message:"A new PhoneYa2 blog post, "+String(post.title||post.slug||"Blog post")+", is now published."})).filter(post=>post.slug):[]}
  ];
  for(const source of sources){
   const baseline=await env.DB.prepare("SELECT content_slug FROM admin_content_snapshots WHERE source_type=? AND content_slug='__baseline__'").bind(source.type).first();
   const isBaseline=!baseline;
   const statements=[];
   for(const item of source.items){
    const existing=await env.DB.prepare("SELECT content_slug FROM admin_content_snapshots WHERE source_type=? AND content_slug=?").bind(source.type,item.slug).first();
    if(!existing&&!isBaseline){
     statements.push(env.DB.prepare("INSERT OR IGNORE INTO admin_notifications(id,event_key,category,event_type,title,message,priority,destination,related_id,related_label,image_url) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"published:"+source.type+":"+item.slug,item.category,item.event,item.label,item.message,"normal",item.destination,item.slug,item.title,item.image_url||""));
    }else if(existing&&item.image_url){
     statements.push(env.DB.prepare("UPDATE admin_notifications SET image_url=CASE WHEN ?<>'' THEN ? ELSE image_url END WHERE event_key=?").bind(item.image_url,item.image_url,"published:"+source.type+":"+item.slug));
    }
    if(!existing)statements.push(env.DB.prepare("INSERT OR IGNORE INTO admin_content_snapshots(source_type,content_slug,content_title) VALUES(?,?,?)").bind(source.type,item.slug,item.title));
   }
   if(isBaseline)statements.push(env.DB.prepare("INSERT OR IGNORE INTO admin_content_snapshots(source_type,content_slug,content_title) VALUES(?,'__baseline__','Initial content baseline')").bind(source.type));
   if(statements.length)await env.DB.batch(statements);
  }
 }catch(error){console.warn("Published content notification sync skipped:",String(error).slice(0,220));}
}
export async function onRequest({request,env}){
 if(!await admin(request,env))return json({error:"Administrator sign-in required."},401);
 if(!env.DB)return json({error:"Cloudflare D1 database binding DB is not configured."},503);
 if(request.method==="GET"){
  try{
   await syncPublishedContent(request,env);
   const url=new URL(request.url),limit=Math.min(200,Math.max(1,Number(url.searchParams.get("limit"))||100));
   const [rows,counts]=await Promise.all([
    env.DB.prepare("SELECT id,event_key,category,event_type,title,message,priority,destination,related_id,related_label,image_url,created_at,is_read,read_at FROM admin_notifications ORDER BY created_at DESC LIMIT ?").bind(limit).all(),
    env.DB.prepare("SELECT category,COUNT(*) AS total FROM admin_notifications WHERE is_read=0 GROUP BY category").all()
   ]);
   const unread_by_category={};let unread=0;
   for(const row of counts.results||[]){const count=Number(row.total||0);unread_by_category[row.category]=count;unread+=count;}
   return json({success:true,notifications:rows.results||[],unread,unread_by_category,limit});
  }catch(error){console.error("Command Centre notifications read failed:",String(error).slice(0,300));return json({error:"Could not load notifications. Apply D1 migration 0015_admin_notifications.sql first."},503);}
 }
 if(request.method==="POST"){
  let body;try{body=await request.json();}catch{return json({error:"Submit a valid notification action."},400);}
  try{
   if(body.action==="mark_read"){
    const id=String(body.id||"").slice(0,100);if(!id)return json({error:"Notification ID is required."},400);
    await env.DB.prepare("UPDATE admin_notifications SET is_read=1,read_at=COALESCE(read_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id=?").bind(id).run();
   }else if(body.action==="stock_snapshot"){
    if(!Array.isArray(body.products)||body.products.length>200)return json({error:"Submit a valid stock snapshot of up to 200 products."},400);
    const entries=body.products.map(p=>({slug:String(p?.slug||"").trim().slice(0,120),title:String(p?.title||"Product").trim().slice(0,180),image_url:String(p?.image||p?.image_url||"").trim().slice(0,800),stock:Number(p?.stock)})).filter(p=>/^[A-Za-z0-9._-]{1,120}$/.test(p.slug)&&Number.isInteger(p.stock)&&p.stock>=0);
    const statements=[],now=new Date().toISOString();
    for(const product of entries){
     const previous=await env.DB.prepare("SELECT stock FROM admin_inventory_snapshots WHERE product_slug=?").bind(product.slug).first();
     if(previous){
      const before=Number(previous.stock),crossedOut=before>0&&product.stock===0,crossedLow=before>3&&product.stock>0&&product.stock<=3;
      if(crossedOut||crossedLow){
       const kind=crossedOut?"out_of_stock":"low_stock",title=crossedOut?product.title+" is out of stock":product.title+" is running low";
       const detail=crossedOut?"Stock has reached zero. Review the product listing and replenish inventory.":"Only "+product.stock+" unit"+(product.stock===1?"":"s")+" remain. Review replenishment before promoting this product.";
       statements.push(env.DB.prepare("INSERT OR IGNORE INTO admin_notifications(id,event_key,category,event_type,title,message,priority,destination,related_id,related_label,created_at,image_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"stock:"+product.slug+":"+before+":"+product.stock+":"+now,"inventory",kind,title,detail,"high","/admin/#/collections/products",product.slug,product.title,now,product.image_url));
      }
     }
     statements.push(env.DB.prepare("INSERT INTO admin_inventory_snapshots(product_slug,product_title,stock,updated_at) VALUES(?,?,?,?) ON CONFLICT(product_slug) DO UPDATE SET product_title=excluded.product_title,stock=excluded.stock,updated_at=excluded.updated_at").bind(product.slug,product.title,product.stock,now));
    }
    if(statements.length)await env.DB.batch(statements);
    return json({success:true,checked:entries.length});
   }else if(body.action==="mark_all_read"){
    await env.DB.prepare("UPDATE admin_notifications SET is_read=1,read_at=COALESCE(read_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE is_read=0").run();
   }else{return json({error:"Unknown notification action."},400);}
   return json({success:true});
  }catch(error){console.error("Command Centre notification update failed:",String(error).slice(0,300));return json({error:"Could not update notification status."},503);}
 }
 return json({error:"Method not allowed."},405);
}
