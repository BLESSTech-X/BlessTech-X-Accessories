const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const SITE="https://phoneya2.pages.dev";
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:HEADERS});}
function html(body,status=200){return new Response("<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>PhoneYa2 Email Preferences</title><body style=\"font:16px/1.6 system-ui;background:#f4f6fa;color:#151827;padding:24px\"><main style=\"max-width:560px;margin:8vh auto;background:white;padding:28px;border-radius:16px\"><h1 style=\"margin-top:0\">PhoneYa2 Accessories</h1>"+body+"<p><a href=\""+SITE+"\" style=\"color:#d95700\">Return to PhoneYa2</a></p></main></body></html>",{status,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
}
function escape(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function db(env,path,init={}){const base=String(env.SUPABASE_URL||"").replace(/\/$/,""),key=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY;if(!base||!key)throw new Error("Database is not configured.");const headers=new Headers(init.headers||{});headers.set("apikey",key);headers.set("authorization","Bearer "+key);headers.set("content-type","application/json");return fetch(base+path,{...init,headers});}
async function log(env,email,subject,status,error="",messageId=""){try{await db(env,"/rest/v1/email_activity",{method:"POST",headers:{prefer:"return=minimal"},body:JSON.stringify({event_type:"subscription_confirmation",source:"automatic",trigger_source:"newsletter_signup",recipient_email:email,subject,status,provider:"resend",provider_message_id:messageId,error_message:error,sent_at:status==="sent"?new Date().toISOString():null})});}catch(e){console.error("Subscription email log failed:",String(e));}}
async function sendConfirmation(env,email,name,token){if(!env.RESEND_API_KEY||!env.RESEND_FROM)return{ok:false,error:"Email service is not configured."};const link=SITE+"/api/subscribe?action=confirm&token="+encodeURIComponent(token);try{const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:"Bearer "+env.RESEND_API_KEY,"content-type":"application/json"},body:JSON.stringify({from:env.RESEND_FROM,to:[email],subject:"Confirm your PhoneYa2 email updates",html:"<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#151827;line-height:1.6\"><h2>PhoneYa2 Accessories</h2><p>Hello "+escape(name||"there")+",</p><p>Please confirm that you want to receive product news and offers from PhoneYa2.</p><p><a href=\""+link+"\" style=\"display:inline-block;background:#ff6500;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold\">Confirm subscription</a></p><p>If you did not request these updates, ignore this email. You will not be subscribed unless you confirm.</p></div>"})});const d=await r.json().catch(()=>({}));return r.ok?{ok:true,id:d.id||""}:{ok:false,error:"Resend HTTP "+r.status+": "+String(d.message||d.name||"").slice(0,200)};}catch(e){return{ok:false,error:String(e).slice(0,200)};}}
export async function onRequest(context){
 const {request,env}=context,url=new URL(request.url),action=url.searchParams.get("action")||"";
 try{
  if(request.method==="GET"&&action==="confirm"){
   const token=url.searchParams.get("token")||"";if(!/^[0-9a-f-]{36}$/i.test(token))return html("<h2>Invalid confirmation link</h2><p>Please return to the website and subscribe again if you still want updates.</p>",400);
   const r=await db(env,"/rest/v1/customer_subscribers?confirmation_token=eq."+encodeURIComponent(token)+"&select=id,status&limit=1");
   if(!r.ok)return html("<h2>We could not confirm your subscription</h2><p>Please try again later.</p>",503);
   const rows=await r.json();if(!rows.length)return html("<h2>Link not found</h2><p>This link may have expired or already been used. If you are already subscribed, no action is needed.</p>",404);
   if(rows[0].status==="unsubscribed")return html("<h2>Subscription is inactive</h2><p>You previously unsubscribed. Please use the newsletter page to opt in again.</p>");
   const u=await db(env,"/rest/v1/customer_subscribers?id=eq."+encodeURIComponent(rows[0].id),{method:"PATCH",headers:{prefer:"return=minimal"},body:JSON.stringify({status:"subscribed",consented_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
   if(!u.ok)return html("<h2>We could not confirm your subscription</h2><p>Please try again later.</p>",503);
   return html("<h2>You're subscribed!</h2><p>Your email address is confirmed. You'll receive PhoneYa2 updates and product news. You can unsubscribe at any time using the link in our emails.</p>");
  }
  if(request.method==="GET"&&action==="unsubscribe"){
   const token=url.searchParams.get("token")||"";if(!/^[0-9a-f-]{36}$/i.test(token))return html("<h2>Invalid unsubscribe link</h2><p>Please contact PhoneYa2 if you need help.</p>",400);
   return html("<h2>Unsubscribe from emails?</h2><p>Confirm below to stop receiving PhoneYa2 promotional updates.</p><form method=\"post\" action=\"/api/subscribe\"><input type=\"hidden\" name=\"action\" value=\"unsubscribe\"><input type=\"hidden\" name=\"token\" value=\""+escape(token)+"\"><button style=\"border:0;border-radius:8px;padding:12px 18px;background:#b42318;color:white;font-weight:bold\">Confirm unsubscribe</button></form>");
  }
  let body={};
  if(request.method==="POST"&&request.headers.get("content-type")?.includes("application/json"))body=await request.json().catch(()=>({}));
  else if(request.method==="POST"){const form=await request.formData().catch(()=>null);if(form)body=Object.fromEntries(form.entries());}
  else return json({error:"Method not allowed."},405);
  const postAction=String(body.action||"");
  if(postAction==="unsubscribe"){
   const token=String(body.token||"");if(!/^[0-9a-f-]{36}$/i.test(token))return json({error:"Invalid unsubscribe token."},400);
   const r=await db(env,"/rest/v1/customer_subscribers?confirmation_token=eq."+encodeURIComponent(token),{method:"PATCH",headers:{prefer:"return=representation"},body:JSON.stringify({status:"unsubscribed",unsubscribed_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
   if(!r.ok)return request.headers.get("content-type")?.includes("application/json")?json({error:"Could not update your subscription."},503):html("<h2>Unsubscribe failed</h2><p>Please try again later.</p>",503);
   const rows=await r.json().catch(()=>[]);if(!rows.length)return json({error:"Subscription not found."},404);
   return request.headers.get("content-type")?.includes("application/json")?json({success:true,message:"You have been unsubscribed."}):html("<h2>You are unsubscribed</h2><p>You will no longer receive promotional emails from PhoneYa2.</p>");
  }
  if(postAction!=="subscribe")return json({error:"Unsupported action."},400);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email||"").trim())||body.consent!==true&&body.consent!=="true")return json({error:"Enter a valid email and explicitly agree to receive email updates."},400);
  const email=String(body.email).trim().toLowerCase().slice(0,254),name=String(body.name||"").trim().slice(0,120),token=crypto.randomUUID(),now=new Date().toISOString();
  const existingR=await db(env,"/rest/v1/customer_subscribers?email=eq."+encodeURIComponent(email)+"&select=id,status&limit=1");
  if(!existingR.ok)return json({error:"Subscription service is temporarily unavailable."},503);
  const existing=(await existingR.json())[0];
  if(existing&&existing.status==="subscribed")return json({success:true,message:"This email is already subscribed."});
  const record={email,full_name:name,status:"pending",consent_source:String(body.source||"PhoneYa2 newsletter form").slice(0,120),preferences:{new_arrivals:true,offers:true,tips:true},confirmation_token:token,confirmation_sent_at:now,consented_at:null,unsubscribed_at:null,updated_at:now};
  const save=await db(env,existing?"/rest/v1/customer_subscribers?id=eq."+encodeURIComponent(existing.id):"/rest/v1/customer_subscribers",{method:existing?"PATCH":"POST",headers:{prefer:"return=minimal"},body:JSON.stringify(record)});
  if(!save.ok)return json({error:"Could not save subscription. Please try again."},503);
  const result=await sendConfirmation(env,email,name,token);await log(env,email,"Confirm your PhoneYa2 email updates",result.ok?"sent":"failed",result.error||"",result.id||"");
  if(!result.ok)return json({success:true,message:"Your details were saved, but the confirmation email could not be sent. Please try again later."},202);
  return json({success:true,message:"Check your inbox and confirm your subscription. You will not receive marketing emails until you confirm."},202);
 }catch(e){console.error("PhoneYa2 subscription endpoint failed:",String(e).slice(0,250));return json({error:"Subscription request failed. Please try again later."},503);}
}
