const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const SITE="https://phoneya2.pages.dev";
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:HEADERS});}
function html(body,status=200){return new Response("<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>PhoneYa2 Email Preferences</title><body style='font:16px/1.6 system-ui;background:#f4f6fa;color:#151827;padding:24px'><main style='max-width:560px;margin:8vh auto;background:white;padding:28px;border-radius:16px'><h1>PhoneYa2 Accessories</h1>"+body+"<p><a href='"+SITE+"' style='color:#d95700'>Return to PhoneYa2</a></p></main></body></html>",{status,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});}
function escape(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function log(env,email,subject,status,error="",messageId=""){
 try{
  const activityId=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO email_activity(id,event_type,source,trigger_source,recipient_email,subject,status,provider,provider_message_id,error_message,sent_at,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
   .bind(activityId,"subscription_confirmation","automatic","newsletter_signup",email,subject,status,"brevo",messageId,String(error||"").slice(0,1000),status==="sent"?new Date().toISOString():null,"{}").run();
  if(status==="failed"){
   try{await env.DB.prepare("INSERT OR IGNORE INTO admin_notifications(id,event_key,category,event_type,title,message,priority,destination,related_id,related_label) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"email-failure:"+activityId,"communications","email_failed","Newsletter confirmation email failed",String(error||"The subscription confirmation email could not be delivered.").slice(0,300),"high","/admin/communications.html",activityId,subject).run();}catch(notificationError){console.error("Newsletter email notification failed:",String(notificationError).slice(0,180));}
  }
 }catch(e){console.error("D1 subscription email log failed:",String(e).slice(0,180));}
}
async function sendConfirmation(env,email,name,token){
 if(!env.BREVO_API_KEY||!env.BREVO_FROM_EMAIL)return{ok:false,error:"Brevo email service is not configured."};
 const link=SITE+"/api/subscribe?action=confirm&token="+encodeURIComponent(token);
 const body="<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#151827;line-height:1.6'><h2>PhoneYa2 Accessories</h2><p>Hello "+escape(name||"there")+",</p><p>Please confirm that you want to receive product news and offers from PhoneYa2.</p><p><a href='"+link+"' style='display:inline-block;background:#ff6500;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold'>Confirm subscription</a></p><p>If you did not request these updates, ignore this email. You will not be subscribed unless you confirm.</p></div>";
 try{const r=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":env.BREVO_API_KEY,"content-type":"application/json"},body:JSON.stringify({sender:{name:env.BREVO_FROM_NAME||"PhoneYa2 Accessories",email:env.BREVO_FROM_EMAIL},to:[{email,name:name||""}],subject:"Confirm your PhoneYa2 email updates",htmlContent:body})});const d=await r.json().catch(()=>({}));return r.ok?{ok:true,id:d.messageId||""}:{ok:false,error:"Brevo HTTP "+r.status+": "+String(d.message||d.code||"").slice(0,200)};}
 catch(e){return{ok:false,error:String(e).slice(0,200)};}
}
async function sendNewsletterOwnerAlert(email,name,source,status){
 try{const r=await fetch("https://formspree.io/f/mbgdwnab",{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({_subject:"New PhoneYa2 newsletter signup",subscriber_email:email,subscriber_name:name||"Not provided",subscription_status:status,signup_source:source||"PhoneYa2 newsletter form",notice:"The subscriber must confirm their email before receiving marketing messages."})});return r.ok;}
 catch(e){console.error("Newsletter Formspree alert failed:",String(e).slice(0,180));return false;}
}
export async function onRequest({request,env}){
 const url=new URL(request.url),action=url.searchParams.get("action")||"";
 if(!env.DB)return json({error:"Cloudflare D1 database is not configured."},503);
 try{
  if(request.method==="GET"&&action==="confirm"){
   const token=url.searchParams.get("token")||"";if(!/^[0-9a-f-]{36}$/i.test(token))return html("<h2>Invalid confirmation link</h2><p>Please return to the website and subscribe again if you still want updates.</p>",400);
   const row=await env.DB.prepare("SELECT id,status FROM customer_subscribers WHERE confirmation_token=? LIMIT 1").bind(token).first();
   if(!row)return html("<h2>Link not found</h2><p>This link may have expired or already been used. If you are already subscribed, no action is needed.</p>",404);
   if(row.status==="unsubscribed")return html("<h2>Subscription is inactive</h2><p>You previously unsubscribed. Please use the newsletter page to opt in again.</p>");
   const confirmedAt=new Date().toISOString();
   await env.DB.prepare("UPDATE customer_subscribers SET status='subscribed',consented_at=?,updated_at=? WHERE id=?").bind(confirmedAt,confirmedAt,row.id).run();
   try{await env.DB.prepare("INSERT OR IGNORE INTO admin_notifications(id,event_key,category,event_type,title,message,priority,destination,related_id,related_label) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"newsletter-confirmed:"+row.id,"newsletter","subscriber_confirmed","Newsletter subscriber confirmed","A new contact has confirmed their PhoneYa2 email subscription.","normal","/admin/campaigns.html",row.id,"Confirmed subscriber").run();}catch(e){console.error("Newsletter confirmation notification failed:",String(e).slice(0,180));}
   return html("<h2>You're subscribed!</h2><p>Your email address is confirmed. You'll receive PhoneYa2 updates and product news. You can unsubscribe at any time using the link in our emails.</p>");
  }
  if(request.method==="GET"&&action==="unsubscribe"){
   const token=url.searchParams.get("token")||"";if(!/^[0-9a-f-]{36}$/i.test(token))return html("<h2>Invalid unsubscribe link</h2><p>Please contact PhoneYa2 if you need help.</p>",400);
   const row=await env.DB.prepare("SELECT id FROM customer_subscribers WHERE confirmation_token=? LIMIT 1").bind(token).first();
   if(!row)return html("<h2>Unsubscribe link not found</h2><p>Please contact PhoneYa2 if you need help.</p>",404);
   return html("<h2>Unsubscribe from emails?</h2><p>Confirm below to stop receiving PhoneYa2 promotional updates.</p><form method='post' action='/api/subscribe'><input type='hidden' name='action' value='unsubscribe'><input type='hidden' name='token' value='"+escape(token)+"'><button style='border:0;border-radius:8px;padding:12px 18px;background:#b42318;color:white;font-weight:bold'>Confirm unsubscribe</button></form>");
  }
  let body={};
  if(request.method==="POST"&&request.headers.get("content-type")?.includes("application/json"))body=await request.json().catch(()=>({}));
  else if(request.method==="POST"){const form=await request.formData().catch(()=>null);if(form)body=Object.fromEntries(form.entries());}
  else return json({error:"Method not allowed."},405);
  const postAction=String(body.action||"");
  if(postAction==="unsubscribe"){
   const token=String(body.token||"");if(!/^[0-9a-f-]{36}$/i.test(token))return json({error:"Invalid unsubscribe token."},400);
   const result=await env.DB.prepare("UPDATE customer_subscribers SET status='unsubscribed',unsubscribed_at=?,updated_at=? WHERE confirmation_token=? AND status IN ('subscribed','pending')").bind(new Date().toISOString(),new Date().toISOString(),token).run();
   if(!result.meta?.changes)return request.headers.get("content-type")?.includes("application/json")?json({error:"Subscription not found or already inactive."},404):html("<h2>Subscription not found or already inactive</h2>",404);
   return request.headers.get("content-type")?.includes("application/json")?json({success:true,message:"You have been unsubscribed."}):html("<h2>You are unsubscribed</h2><p>You will no longer receive promotional emails from PhoneYa2.</p>");
  }
  if(postAction!=="subscribe")return json({error:"Unsupported action."},400);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email||"").trim())||(body.consent!==true&&body.consent!=="true"))return json({error:"Enter a valid email and explicitly agree to receive email updates."},400);
  const email=String(body.email).trim().toLowerCase().slice(0,254),name=String(body.name||"").trim().slice(0,120),source=String(body.source||"PhoneYa2 newsletter form").slice(0,120);
  const existing=await env.DB.prepare("SELECT id,status FROM customer_subscribers WHERE email=? COLLATE NOCASE LIMIT 1").bind(email).first();
  if(existing?.status==="subscribed")return json({success:true,message:"This email is already subscribed."});
  const id=existing?.id||crypto.randomUUID(),token=crypto.randomUUID(),now=new Date().toISOString();
  await env.DB.prepare("INSERT INTO customer_subscribers(id,email,full_name,status,consent_source,preferences_json,confirmation_token,confirmation_sent_at,created_at,updated_at) VALUES(?,?,?,'pending',?,'{\"new_arrivals\":true,\"offers\":true,\"tips\":true}',?,?,?,?) ON CONFLICT(email) DO UPDATE SET full_name=excluded.full_name,status='pending',consent_source=excluded.consent_source,confirmation_token=excluded.confirmation_token,confirmation_sent_at=excluded.confirmation_sent_at,unsubscribed_at=NULL,updated_at=excluded.updated_at")
   .bind(id,email,name,source,token,now,now,now).run();
  try{await env.DB.prepare("INSERT OR IGNORE INTO admin_notifications(id,event_key,category,event_type,title,message,priority,destination,related_id,related_label) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"newsletter-signup:"+id+":"+now,"newsletter","subscriber_signup","New newsletter signup",name?name+" ("+email+") has signed up. Confirmation is still pending.":email+" has signed up. Confirmation is still pending.","normal","/admin/campaigns.html",id,email).run();}catch(e){console.error("Newsletter signup notification failed:",String(e).slice(0,180));}
  await sendNewsletterOwnerAlert(email,name,source,"pending confirmation");
  const result=await sendConfirmation(env,email,name,token);await log(env,email,"Confirm your PhoneYa2 email updates",result.ok?"sent":"failed",result.error||"",result.id||"");
  if(!result.ok)return json({success:true,message:"Your details were saved, but the confirmation email could not be sent. Please try again later."},202);
  return json({success:true,message:"Check your inbox and confirm your subscription. You will not receive marketing emails until you confirm."},202);
 }catch(e){console.error("PhoneYa2 D1 subscription endpoint failed:",String(e).slice(0,250));return json({error:"Subscription request failed. Please try again later."},503);}
}