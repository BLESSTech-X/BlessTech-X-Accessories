const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{...HEADERS,...extra}});}
const SITE="https://phoneya2.pages.dev";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function clean(v,n=500){return String(v??"").trim().slice(0,n);}
function safeUrl(v){const s=clean(v,1000);if(!s)return "";try{const u=new URL(s,SITE);return ["https:","http:"].includes(u.protocol)&&!u.username&&!u.password?u.href:"";}catch{return "";}}
function sameOrigin(request){const origin=request.headers.get("origin");if(!origin)return request.method==="GET"||request.headers.get("sec-fetch-site")==="same-origin";try{return new URL(origin).host===new URL(request.url).host}catch{return false}}
async function visitorKey(request,provided){const raw=clean(provided,100)||((request.headers.get("cf-connecting-ip")||"")+"|"+(request.headers.get("user-agent")||""));const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw));return Array.from(new Uint8Array(digest).slice(0,16),b=>b.toString(16).padStart(2,"0")).join("");}
export async function onRequest({request,env}){
 if(!env.DB)return json({ok:false,error:"Campaign service is temporarily unavailable."},503);
 if(!sameOrigin(request))return json({ok:false,error:"Cross-origin request blocked."},403);
 if(request.method==="GET"){
  const now=new Date().toISOString();
  const rows=await env.DB.prepare("SELECT id,name,subject,body_text,hero_image_url,destination_url,cta_label,starts_at,ends_at,published_at,channels_json FROM email_campaigns WHERE approval_status='approved' AND published_at IS NOT NULL AND (starts_at IS NULL OR starts_at='' OR starts_at<=?) AND (ends_at IS NULL OR ends_at='' OR ends_at>=?) ORDER BY published_at DESC LIMIT 30").bind(now,now).all();
  const campaigns=(rows.results||[]).filter(c=>{try{return JSON.parse(c.channels_json||'["email"]').includes("homepage")}catch{return false}}).map(c=>({id:c.id,title:c.name,headline:c.subject,body:c.body_text,image_url:c.hero_image_url,destination_url:c.destination_url||"/",cta_label:c.cta_label||"Shop now",starts_at:c.starts_at,ends_at:c.ends_at}));
  return json({ok:true,campaigns},200,{"cache-control":"public, max-age=30, s-maxage=60"});
 }
 if(request.method!=="POST")return json({ok:false,error:"Method not allowed."},405);
 let body={};try{body=await request.json()}catch{return json({ok:false,error:"Invalid request."},400)}
 const id=clean(body.campaign_id,50),event=clean(body.event_type,20);
 if(!UUID.test(id)||!["impression","click","conversion"].includes(event))return json({ok:false,error:"Invalid campaign event."},400);
 const exists=await env.DB.prepare("SELECT id FROM email_campaigns WHERE id=? AND approval_status='approved' AND published_at IS NOT NULL").bind(id).first();
 if(!exists)return json({ok:false,error:"Campaign is not available."},404);
 const key=await visitorKey(request,body.visitor_key);
 await env.DB.prepare("INSERT INTO campaign_engagement(id,campaign_id,event_type,visitor_key,placement,source,order_id) VALUES(?,?,?,?,?,?,?)")
  .bind(crypto.randomUUID(),id,event,key,clean(body.placement,50),clean(body.source,50),event==="conversion"?clean(body.order_id,100):"").run();
 return json({ok:true});
}
