const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:HEADERS});}
function clean(v,max){return String(v??"").trim().slice(0,max);}
function sameOrigin(request){const origin=request.headers.get("origin");if(!origin)return request.headers.get("sec-fetch-site")==="same-origin";try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}}
async function ipHash(request){const ip=request.headers.get("cf-connecting-ip")||"unknown";const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");}
export async function onRequest({request,env}){
 if(request.method!=="POST")return json({ok:false,error:"Method not allowed."},405);
 if(!sameOrigin(request))return json({ok:false,error:"Cross-origin request blocked."},403);
 if(!env.DB)return json({ok:false,error:"Partner enquiries are temporarily unavailable."},503);
 let body={};try{body=await request.json();}catch{return json({ok:false,error:"Invalid request."},400);}
 if(clean(body.website,200))return json({ok:false,error:"We could not verify this submission. Please reload the page and try again."},400);
 const slug=clean(body.slug,80).toLowerCase();const name=clean(body.name,100),phone=clean(body.phone,40),email=clean(body.email,254),message=clean(body.message,2000);
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!name||!message||(!phone&&!email))return json({ok:false,error:"Please provide your name, a phone number or email, and a message."},400);
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({ok:false,error:"Enter a valid email address."},400);
 const ip=await ipHash(request),now=Math.floor(Date.now()/1000);
 // Rate limiting must never prevent a valid customer lead from being saved.
 let recent=0;
 try{
  await env.DB.prepare("DELETE FROM partner_enquiry_attempts WHERE attempted_at<?").bind(now-3600).run();
  const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM partner_enquiry_attempts WHERE ip_hash=? AND attempted_at>?").bind(ip,now-3600).first();
  recent=Number(count?.n||0);
 }catch(error){console.error("Partner enquiry rate-limit check unavailable:",error?.message||error);}
 if(recent>=8)return json({ok:false,error:"Too many enquiries from this connection. Please try again later."},429);
 const site=await env.DB.prepare("SELECT a.id AS advertiser_id FROM advertiser_profiles p JOIN advertisers a ON a.id=p.advertiser_id JOIN partner_site_settings s ON s.advertiser_id=a.id WHERE p.slug=? COLLATE NOCASE AND s.published=1 AND a.status IN ('active','approved') LIMIT 1").bind(slug).first();
 if(!site)return json({ok:false,error:"This business website is not accepting enquiries yet."},404);
 const id=crypto.randomUUID();
 try{
  await env.DB.prepare("INSERT INTO partner_enquiries(id,advertiser_id,customer_name,customer_email,customer_phone,message,source,status) VALUES(?,?,?,?,?,?,'website','new')").bind(id,site.advertiser_id,name,email,phone,message).run();
  const saved=await env.DB.prepare("SELECT id FROM partner_enquiries WHERE id=? AND advertiser_id=?").bind(id,site.advertiser_id).first();
  if(!saved)throw new Error("Enquiry insert could not be verified.");
 }catch(error){
  console.error("Partner enquiry could not be saved:",error?.stack||error);
  return json({ok:false,error:"Your message could not be saved just now. Please try again or contact the business directly."},500);
 }
 // Record the rate-limit attempt after the lead is safely persisted.
 await env.DB.prepare("INSERT INTO partner_enquiry_attempts(ip_hash,attempted_at) VALUES(?,?)").bind(ip,now).run().catch(error=>console.error("Partner enquiry rate-limit log unavailable:",error?.message||error));

 return json({ok:true,message:"Enquiry received."},201);
}