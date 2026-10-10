const SITE="https://phoneya2.pages.dev";
const H={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
function json(d,s=200){return new Response(JSON.stringify(d),{status:s,headers:H});}
function eq(a,b){if(!a||!b||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function db(env,path,init={}){const base=String(env.SUPABASE_URL||"").replace(/\/$/,""),key=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY;if(!base||!key)throw new Error("Database is not configured.");const headers=new Headers(init.headers||{});headers.set("apikey",key);headers.set("authorization","Bearer "+key);headers.set("content-type","application/json");return fetch(base+path,{...init,headers});}
async function log(env,j,s,result){const r=await db(env,"/rest/v1/email_activity",{method:"POST",headers:{prefer:"return=minimal"},body:JSON.stringify({event_type:"product_announcement",source:"automatic",trigger_source:"cms_product_published",recipient_email:s.email,recipient_name:s.full_name||"",subject:"New on PhoneYa2: "+j.product_title,status:result.ok?"sent":"failed",provider:"resend",provider_message_id:result.id||"",error_message:result.error||"",related_product_slug:j.product_slug,campaign_id:j.id,retry_count:0,sent_at:result.ok?new Date().toISOString():null,metadata:{product_title:j.product_title,product_price:Number(j.product_price)}})});if(!r.ok)console.error("Product announcement log failed:",r.status,(await r.text()).slice(0,180));}
async function send(env,j,s){if(!env.RESEND_API_KEY||!env.RESEND_FROM)return{ok:false,error:"Resend is not configured."};const unsub=SITE+"/api/subscribe?action=unsubscribe&token="+encodeURIComponent(s.confirmation_token||"");const product=SITE+"/product.html?id="+encodeURIComponent(j.product_slug);const subject="New on PhoneYa2: "+j.product_title;const html="<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#151827;line-height:1.6\"><div style=\"background:#151827;color:white;padding:20px\"><b style=\"color:#ff8b45\">PHONEYA2 ACCESSORIES</b></div><div style=\"padding:22px;border:1px solid #e7eaf0\"><p>Hello "+esc(s.full_name||"there")+",</p><h1 style=\"font-size:24px\">A new product has arrived</h1><h2>"+esc(j.product_title)+"</h2><p>Price: <strong>ZMW "+Number(j.product_price).toFixed(2)+"</strong></p><p><a href=\""+product+"\" style=\"display:inline-block;background:#ff6500;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold\">View product</a></p></div><p style=\"font-size:12px;color:#687386\">You receive this because you confirmed PhoneYa2 email updates. <a href=\""+unsub+"\">Manage/unsubscribe</a>.</p></div>";try{const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:"Bearer "+env.RESEND_API_KEY,"content-type":"application/json"},body:JSON.stringify({from:env.RESEND_FROM,to:[s.email],subject,html,headers:{"List-Unsubscribe":"<"+unsub+">"}})});const d=await r.json().catch(()=>({}));return r.ok?{ok:true,id:d.id||""}:{ok:false,error:"Resend HTTP "+r.status+": "+String(d.message||d.name||"").slice(0,200)};}catch(e){return{ok:false,error:String(e).slice(0,200)};}}
export async function onRequest({request,env}){
 if(request.method!=="POST")return json({error:"Method not allowed."},405);
 const expected=String(env.PRODUCT_ANNOUNCEMENT_SECRET||"");const auth=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!eq(auth,expected))return json({error:"Unauthorized."},401);
 try{
  const b=await request.json().catch(()=>null);if(!b||typeof b!=="object")return json({error:"Invalid JSON."},400);
  if(b.action==="prepare"){
   const slug=String(b.slug||"").trim(),title=String(b.title||"").trim().slice(0,180),price=Number(b.price);
   if(!/^[a-z0-9][a-z0-9-]{0,100}$/.test(slug)||title.length<2||!Number.isFinite(price)||price<0)return json({error:"Invalid product details."},400);
   const ar=await db(env,"/rest/v1/communication_automations?automation_key=eq.new_product_announcement&select=enabled&limit=1");
   if(!ar.ok)return json({error:"Could not check automation setting."},503);const automation=(await ar.json())[0];
   if(!automation?.enabled)return json({success:true,disabled:true,message:"New-product announcement automation is disabled."});
   const existingR=await db(env,"/rest/v1/product_announcement_jobs?product_slug=eq."+encodeURIComponent(slug)+"&select=id,status&limit=1");
   if(!existingR.ok)return json({error:"Product announcement table is not ready; run the latest SQL migration."},503);
   const existing=(await existingR.json())[0];if(existing)return json({success:true,duplicate:true,job_id:existing.id,status:existing.status});
   const r=await db(env,"/rest/v1/product_announcement_jobs",{method:"POST",headers:{prefer:"return=representation"},body:JSON.stringify({product_slug:slug,product_title:title,product_price:price,status:"queued"})});
   if(!r.ok)return json({error:"Could not create product announcement job."},503);const job=(await r.json())[0];return json({success:true,job_id:job.id,status:job.status},201);
  }
  if(b.action==="send"){
   const id=String(b.job_id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:"Invalid job id."},400);
   const jr=await db(env,"/rest/v1/product_announcement_jobs?id=eq."+encodeURIComponent(id)+"&select=*&limit=1");if(!jr.ok)return json({error:"Could not load product announcement."},503);const j=(await jr.json())[0];if(!j)return json({error:"Announcement not found."},404);if(j.status==="sent")return json({success:true,done:true,message:"Announcement already completed."});
   const ar=await db(env,"/rest/v1/communication_automations?automation_key=eq.new_product_announcement&select=enabled&limit=1");if(!ar.ok)return json({error:"Could not check automation setting."},503);if(!(await ar.json())[0]?.enabled)return json({success:true,disabled:true,message:"Automation was disabled before sending; no emails sent."});
   const [sr,lr]=await Promise.all([
    db(env,"/rest/v1/customer_subscribers?select=id,email,full_name,confirmation_token&status=eq.subscribed&order=created_at.asc&limit=1000"),
    db(env,"/rest/v1/email_activity?select=recipient_email&event_type=eq.product_announcement&related_product_slug=eq."+encodeURIComponent(j.product_slug)+"&status=in.(sent,delivered)")
   ]);
   if(!sr.ok||!lr.ok)return json({error:"Could not load subscribers or send history."},503);
   const done=new Set((await lr.json()).map(x=>String(x.recipient_email).toLowerCase())), subs=(await sr.json()).filter(s=>!done.has(String(s.email).toLowerCase()));
   if(!subs.length){await db(env,"/rest/v1/product_announcement_jobs?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{prefer:"return=minimal"},body:JSON.stringify({status:"sent",updated_at:new Date().toISOString(),completed_at:new Date().toISOString()})});return json({success:true,done:true,processed:0,remaining:0});}
   await db(env,"/rest/v1/product_announcement_jobs?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{prefer:"return=minimal"},body:JSON.stringify({status:"sending",updated_at:new Date().toISOString(),total_recipients:done.size+subs.length})});
   const batch=subs.slice(0,20);let sent=0,failed=0;const errors=[];
   for(const s of batch){const result=await send(env,j,s);await log(env,j,s,result);if(result.ok)sent++;else{failed++;if(errors.length<3)errors.push(result.error);}}
   const remaining=subs.length-batch.length,finished=remaining===0;await db(env,"/rest/v1/product_announcement_jobs?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{prefer:"return=minimal"},body:JSON.stringify({status:finished?(failed?"failed":"sent"):"sending",updated_at:new Date().toISOString(),sent_count:done.size+sent,failed_count:Number(j.failed_count||0)+failed,last_error:errors.join(" | "),completed_at:finished?new Date().toISOString():null})});
   return json({success:true,done:finished,processed:batch.length,sent,failed,remaining,errors});
  }
  return json({error:"Unsupported action."},400);
 }catch(e){console.error("Product announcement handler failed:",String(e).slice(0,250));return json({error:"Product announcement operation failed."},503);}
}
