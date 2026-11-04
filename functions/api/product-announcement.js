const SITE="https://phoneya2.pages.dev";
const H={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
function json(d,s=200){return new Response(JSON.stringify(d),{status:s,headers:H});}
function eq(a,b){if(!a||!b||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function log(env,j,s,result){
 try{await env.DB.prepare("INSERT INTO email_activity(id,event_type,source,trigger_source,recipient_email,recipient_name,subject,status,provider,provider_message_id,error_message,related_product_slug,campaign_id,retry_count,sent_at,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)")
 .bind(crypto.randomUUID(),"product_announcement","automatic","cms_product_published",s.email,s.full_name||"","New on PhoneYa2: "+j.product_title,result.ok?"sent":"failed","brevo",result.id||"",String(result.error||"").slice(0,1000),j.product_slug,j.id,result.ok?new Date().toISOString():null,JSON.stringify({product_title:j.product_title,product_price:Number(j.product_price)})).run();}
 catch(e){console.error("D1 product announcement activity log failed:",String(e).slice(0,180));}
}
async function send(env,j,s){
 if(!env.BREVO_API_KEY||!env.BREVO_FROM_EMAIL)return{ok:false,error:"Brevo is not configured."};
 const unsub=SITE+"/api/subscribe?action=unsubscribe&token="+encodeURIComponent(s.confirmation_token||""),product=SITE+"/product.html?id="+encodeURIComponent(j.product_slug),subject="New on PhoneYa2: "+j.product_title;
 const html="<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#151827;line-height:1.6'><div style='background:#151827;color:white;padding:20px'><b style='color:#ff8b45'>PHONEYA2 ACCESSORIES</b></div><div style='padding:22px;border:1px solid #e7eaf0'><p>Hello "+esc(s.full_name||"there")+",</p><h1 style='font-size:24px'>A new product has arrived</h1><h2>"+esc(j.product_title)+"</h2><p>Price: <strong>ZMW "+Number(j.product_price).toFixed(2)+"</strong></p><p><a href='"+product+"' style='display:inline-block;background:#ff6500;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold'>View product</a></p></div><p style='font-size:12px;color:#687386'>You receive this because you confirmed PhoneYa2 email updates. <a href='"+unsub+"'>Unsubscribe</a>.</p></div>";
 try{const r=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":env.BREVO_API_KEY,"content-type":"application/json"},body:JSON.stringify({sender:{name:env.BREVO_FROM_NAME||"PhoneYa2 Accessories",email:env.BREVO_FROM_EMAIL},to:[{email:s.email,name:s.full_name||""}],subject,htmlContent:html,headers:{"List-Unsubscribe":"<"+unsub+">"}})});const d=await r.json().catch(()=>({}));return r.ok?{ok:true,id:d.messageId||""}:{ok:false,error:"Brevo HTTP "+r.status+": "+String(d.message||d.code||"").slice(0,200)};}
 catch(e){return{ok:false,error:String(e).slice(0,200)};}
}
export async function onRequest({request,env}){
 if(request.method!=="POST")return json({error:"Method not allowed."},405);
 const expected=String(env.PHONEYA2_PRODUCT_ANNOUNCEMENT_SECRET||env.PRODUCT_ANNOUNCEMENT_SECRET||""),auth=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!eq(auth,expected))return json({error:"Unauthorized."},401);
 if(!env.DB)return json({error:"Cloudflare D1 database is not configured."},503);
 try{
  const b=await request.json().catch(()=>null);if(!b||typeof b!=="object")return json({error:"Invalid JSON."},400);
  if(b.action==="prepare"){
   const slug=String(b.slug||"").trim(),title=String(b.title||"").trim().slice(0,180),price=Number(b.price);
   if(!/^[a-z0-9][a-z0-9-]{0,100}$/.test(slug)||title.length<2||!Number.isFinite(price)||price<0)return json({error:"Invalid product details."},400);
   const automation=await env.DB.prepare("SELECT enabled FROM communication_automations WHERE automation_key='new_product_announcement'").first();
   if(!automation?.enabled)return json({success:true,disabled:true,message:"New-product announcement automation is disabled."});
   const existing=await env.DB.prepare("SELECT id,status FROM product_announcement_jobs WHERE product_slug=? LIMIT 1").bind(slug).first();
   if(existing)return json({success:true,duplicate:true,job_id:existing.id,status:existing.status});
   const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO product_announcement_jobs(id,product_slug,product_title,product_price,status) VALUES(?,?,?,?,'queued')").bind(id,slug,title,price).run();
   return json({success:true,job_id:id,status:"queued"},201);
  }
  if(b.action==="send"){
   const id=String(b.job_id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:"Invalid job id."},400);
   const j=await env.DB.prepare("SELECT * FROM product_announcement_jobs WHERE id=?").bind(id).first();if(!j)return json({error:"Announcement not found."},404);if(j.status==="sent")return json({success:true,done:true,message:"Announcement already completed."});
   const automation=await env.DB.prepare("SELECT enabled FROM communication_automations WHERE automation_key='new_product_announcement'").first();if(!automation?.enabled)return json({success:true,disabled:true,message:"Automation is disabled; no emails sent."});
   const [subRows,logRows]=await Promise.all([
    env.DB.prepare("SELECT email,full_name,confirmation_token FROM customer_subscribers WHERE status='subscribed' ORDER BY created_at ASC LIMIT 1000").all(),
    env.DB.prepare("SELECT recipient_email FROM email_activity WHERE event_type='product_announcement' AND related_product_slug=? AND status IN ('sent','delivered')").bind(j.product_slug).all()
   ]);
   const done=new Set((logRows.results||[]).map(x=>String(x.recipient_email||"").toLowerCase()));
   const subs=(subRows.results||[]).filter(s=>!done.has(String(s.email||"").toLowerCase()));
   if(!subs.length){await env.DB.prepare("UPDATE product_announcement_jobs SET status='sent',updated_at=?,completed_at=? WHERE id=?").bind(new Date().toISOString(),new Date().toISOString(),id).run();return json({success:true,done:true,processed:0,remaining:0});}
   await env.DB.prepare("UPDATE product_announcement_jobs SET status='sending',updated_at=?,total_recipients=? WHERE id=?").bind(new Date().toISOString(),done.size+subs.length,id).run();
   const batch=subs.slice(0,20);let sent=0,failed=0;const errors=[];
   for(const s of batch){const result=await send(env,j,s);await log(env,j,s,result);if(result.ok)sent++;else{failed++;if(errors.length<3)errors.push(result.error||"Delivery failed.");}}
   const remaining=subs.length-batch.length,finished=remaining===0;
   await env.DB.prepare("UPDATE product_announcement_jobs SET status=?,updated_at=?,sent_count=sent_count+?,failed_count=failed_count+?,last_error=?,completed_at=? WHERE id=?").bind(finished?(failed?"failed":"sent"):"sending",new Date().toISOString(),sent,failed,errors.join(" | "),finished?new Date().toISOString():null,id).run();
   return json({success:true,done:finished,processed:batch.length,sent,failed,remaining,errors});
  }
  return json({error:"Unsupported action."},400);
 }catch(e){console.error("D1 product announcement handler failed:",String(e).slice(0,250));return json({error:"Product announcement operation failed. Check D1 migration 0012."},503);}
}