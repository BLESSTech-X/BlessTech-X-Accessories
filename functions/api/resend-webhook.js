const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
function safeEqual(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
function decodeSecret(value){const raw=String(value||"").replace(/^whsec_/,"");try{return Uint8Array.from(atob(raw),c=>c.charCodeAt(0));}catch{return null;}}
async function verify(raw,headers,secret){
 const id=headers.get("svix-id")||"",timestamp=headers.get("svix-timestamp")||"",signature=headers.get("svix-signature")||"";
 if(!id||!timestamp||!signature||!secret)return false;
 const seconds=Number(timestamp);if(!Number.isFinite(seconds)||Math.abs(Date.now()/1000-seconds)>300)return false;
 const keyBytes=decodeSecret(secret);if(!keyBytes)return false;
 const key=await crypto.subtle.importKey("raw",keyBytes,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signed=new TextEncoder().encode(id+"."+timestamp+"."+raw);
 const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,signed));
 let binary="";digest.forEach(b=>binary+=String.fromCharCode(b));const expected=btoa(binary);
 return signature.split(" ").some(part=>{const sep=part.indexOf(",");return sep>0&&safeEqual(part.slice(sep+1),expected);});
}
async function db(env,path,init={}){const base=String(env.SUPABASE_URL||"").replace(/\/$/,""),key=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY;if(!base||!key)throw new Error("Database is not configured.");const headers=new Headers(init.headers||{});headers.set("apikey",key);headers.set("authorization","Bearer "+key);headers.set("content-type","application/json");return fetch(base+path,{...init,headers});}
export async function onRequest({request,env}){
 if(request.method!=="POST")return json({error:"Method not allowed."},405);
 const raw=await request.text();if(raw.length>1024*1024)return json({error:"Payload too large."},413);
 try{
  if(!await verify(raw,request.headers,env.RESEND_WEBHOOK_SECRET))return json({error:"Invalid webhook signature."},401);
  const event=JSON.parse(raw),type=String(event.type||""),data=event.data||{},messageId=String(data.email_id||data.id||"");
  if(!messageId)return json({received:true,ignored:true,reason:"No provider email id."});
  const mapping={"email.delivered":"delivered","email.bounced":"bounced","email.complained":"bounced","email.failed":"failed"};
  const status=mapping[type];if(!status)return json({received:true,ignored:true,reason:"Event type not tracked."});
  const detail=String(data.bounce?.message||data.reason||data.message||"").slice(0,1000);
  const r=await db(env,"/rest/v1/email_activity?provider_message_id=eq."+encodeURIComponent(messageId),{method:"PATCH",headers:{prefer:"return=minimal"},body:JSON.stringify({status,error_message:detail})});
  if(!r.ok){console.error("Resend webhook activity update failed:",r.status,(await r.text()).slice(0,200));return json({error:"Could not update email activity."},503);}
  return json({received:true,updated:true});
 }catch(e){console.error("Resend webhook processing failed:",String(e).slice(0,250));return json({error:"Webhook processing failed."},400);}
}
