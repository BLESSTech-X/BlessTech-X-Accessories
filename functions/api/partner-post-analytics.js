const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:HEADERS});}
function clean(v,max=200){return String(v??"").trim().slice(0,max);}
function sameOrigin(request){const origin=request.headers.get("origin");if(!origin)return request.headers.get("sec-fetch-site")==="same-origin";try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}}
async function hash(value){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");}
export async function onRequest({request,env}){
 if(request.method!=="POST")return json({ok:false,error:"Method not allowed."},405);
 if(!sameOrigin(request))return json({ok:false,error:"Cross-origin request blocked."},403);
 if(!env.DB)return json({ok:false,error:"Analytics are temporarily unavailable."},503);
 let body={};try{body=await request.json();}catch{return json({ok:false,error:"Invalid request."},400);}
 const slug=clean(body.slug,80).toLowerCase(),postId=clean(body.post_id,64),type=clean(body.event_type,24);
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!/^[0-9a-f-]{36}$/i.test(postId)||!["view","cta_click","share_click","message_click"].includes(type))return json({ok:false,error:"Invalid analytics event."},400);
 try{
  const post=await env.DB.prepare("SELECT p.id,p.advertiser_id FROM partner_posts p JOIN advertiser_profiles pr ON pr.advertiser_id=p.advertiser_id JOIN partner_site_settings s ON s.advertiser_id=p.advertiser_id JOIN advertisers a ON a.id=p.advertiser_id WHERE p.id=? AND pr.slug=? COLLATE NOCASE AND p.status='published' AND s.published=1 AND a.status IN ('active','approved') LIMIT 1").bind(postId,slug).first();
  if(!post)return json({ok:false,error:"Published post not found."},404);
  const ip=request.headers.get("cf-connecting-ip")||"unknown";
  const visitorHash=await hash("phoneya2-post-analytics:"+ip+"|"+(request.headers.get("user-agent")||"").slice(0,180));
  const now=new Date(),day=now.toISOString().slice(0,10),source=(()=>{try{const ref=new URL(request.headers.get("referer")||"");return ref.searchParams.get("utm_source")||ref.hostname.slice(0,120)||"direct";}catch{return "direct";}})();
  const id=crypto.randomUUID();
  if(type==="view"){
   await env.DB.prepare("INSERT OR IGNORE INTO partner_post_events(id,advertiser_id,post_id,event_type,visitor_hash,event_day,source) VALUES(?,?,?,'view',?,?,?)").bind(id,post.advertiser_id,post.id,visitorHash,day,source).run();
  }else{
   await env.DB.prepare("INSERT INTO partner_post_events(id,advertiser_id,post_id,event_type,visitor_hash,event_day,source) VALUES(?,?,?,?,?,?,?)").bind(id,post.advertiser_id,post.id,type,visitorHash,day,source).run();
  }
  return json({ok:true});
 }catch(error){console.error("Partner post analytics event failed:",error?.stack||error);return json({ok:false,error:"Analytics event could not be recorded."},500);}
}
