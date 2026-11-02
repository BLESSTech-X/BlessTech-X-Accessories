const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{...HEADERS,...extra}});}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function clean(v,n=300){return String(v??"").trim().slice(0,n);}
function sameOrigin(request){const origin=request.headers.get("origin");if(!origin)return request.method==="GET"||request.headers.get("sec-fetch-site")==="same-origin";try{return new URL(origin).host===new URL(request.url).host}catch{return false}}
async function hash(value){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("")}
export async function onRequest({request,env}){
 if(!env.DB)return json({ok:false,error:"Campaign service is temporarily unavailable."},503);
 if(!sameOrigin(request))return json({ok:false,error:"Cross-origin request blocked."},403);
 if(request.method==="GET"){
  const now=new Date().toISOString();
  const rows=await env.DB.prepare(`SELECT ad.id,ad.slug,ad.title,ad.description,ad.media_url,ad.media_type,ad.video_provider,ad.destination_type,ad.destination_url,ad.weight,ad.placement,ad.start_date,ad.end_date,ad.advertiser_id,adv.business_name,adv.logo_url,adv.tier,p.slug AS profile_slug
  FROM ads ad JOIN advertisers adv ON adv.id=ad.advertiser_id LEFT JOIN advertiser_profiles p ON p.advertiser_id=adv.id
  WHERE ad.status='approved' AND adv.status IN ('active','approved') AND (ad.start_date IS NULL OR ad.start_date<=?) AND (ad.end_date IS NULL OR ad.end_date>=?)
  ORDER BY ad.created_at DESC LIMIT 100`).bind(now,now).all();
  return json({ok:true,ads:rows.results||[]},200,{"cache-control":"public, max-age=60, s-maxage=180"});
 }
 if(request.method!=="POST")return json({ok:false,error:"Method not allowed."},405);
 let body={};try{body=await request.json()}catch{return json({ok:false,error:"Invalid request."},400)}
 const action=clean(body.action,20),id=clean(body.ad_id,50),placement=["carousel","popup","interstitial","detail"].includes(body.placement)?body.placement:"carousel",source=["direct","whatsapp","facebook","instagram","adshare","other"].includes(body.source)?body.source:"other";
 if(!UUID.test(id))return json({ok:false,error:"Invalid campaign."},400);
 const exists=await env.DB.prepare("SELECT id FROM ads WHERE id=? AND status='approved'").bind(id).first();
 if(!exists)return json({ok:false,error:"Campaign not found."},404);
 const visitor=clean(body.visitor_hash,100)||await hash((request.headers.get("cf-connecting-ip")||"")+"|"+(request.headers.get("user-agent")||""));
 if(action==="impression"||action==="click"){
  const table=action==="impression"?"ad_impressions":"ad_clicks";
  await env.DB.prepare(`INSERT INTO ${table}(id,ad_id,visitor_hash,placement,source) VALUES(?,?,?,?,?)`).bind(crypto.randomUUID(),id,visitor,placement,source).run();
  return json({ok:true});
 }
 if(action==="report"){
  const reason=clean(body.reason,500);if(!reason)return json({ok:false,error:"Please enter a reason."},400);
  const reporter=await hash(visitor+"|"+(request.headers.get("cf-connecting-ip")||""));
  const recent=await env.DB.prepare("SELECT COUNT(*) AS n FROM ad_reports WHERE reporter_hash=? AND created_at>datetime('now','-1 day')").bind(reporter).first();
  if(Number(recent?.n||0)>=5)return json({ok:false,error:"Report limit reached. Please try again later."},429);
  await env.DB.prepare("INSERT INTO ad_reports(id,ad_id,reporter_hash,reason,details) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),id,reporter,reason,"").run();
  return json({ok:true});
 }
 return json({ok:false,error:"Unknown campaign action."},400);
}