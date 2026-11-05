const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const SITE="https://phoneya2.pages.dev";
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function admin(request,env){const {getAdminSession,sameOrigin}=await import("../_auth.js");if(!sameOrigin(request))return null;return await getAdminSession(request,env);}
function normalizeZambiaPhone(value){let d=String(value||"").replace(/\D/g,"");if(d.startsWith("0"))d="260"+d.slice(1);return d.startsWith("260")?d:"";}
async function emailLog(env,campaign,recipient,result){
 try{await env.DB.prepare("INSERT INTO email_activity(id,event_type,source,trigger_source,recipient_email,recipient_name,subject,status,provider,provider_message_id,error_message,campaign_id,retry_count,sent_at,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)")
 .bind(crypto.randomUUID(),campaign.audience==="partners"?"partner_service_update":"marketing_campaign","manual",campaign.audience==="partners"?"admin_partner_update":"admin_campaign_send",recipient.email||"",recipient.full_name||"",campaign.subject,result.ok?"sent":"failed","brevo",result.messageId||"",String(result.error||"").slice(0,1000),campaign.id,result.ok?new Date().toISOString():null,JSON.stringify({campaign_name:campaign.name,audience:campaign.audience})).run();}
 catch(e){console.error("D1 campaign email activity logging failed:",String(e).slice(0,180));}
}
async function partnerDeliveryNotification(env,campaign,recipient,emailResult,smsResult){
 if(campaign.audience!=="partners"||!recipient.advertiser_id||!(emailResult?.ok||smsResult?.ok))return;
 try{
  const channel=emailResult?.ok&&smsResult?.ok?"email and SMS":emailResult?.ok?"email":"SMS";
  await env.DB.prepare("INSERT OR IGNORE INTO partner_notifications(id,advertiser_id,event_key,category,kind,title,message,priority,destination,action_label) VALUES(?,?,?,?,?,?,?,?,?,?)")
   .bind(crypto.randomUUID(),recipient.advertiser_id,"partner-campaign:"+campaign.id,"communications","event","New PhoneYa2 partner update","PhoneYa2 successfully sent you a partner update by "+channel+". Open the message in your email or phone for the full details.","normal","notifications","View notifications").run();
 }catch(error){console.error("Partner delivery notification could not be saved:",String(error?.message||error).slice(0,180));}
}
async function phoneLog(env,campaign,recipient,result){
 try{await env.DB.prepare("INSERT INTO communication_activity(id,campaign_id,recipient,recipient_name,channel,event_type,status,provider,provider_message_id,error_message) VALUES(?,?,?,?,?,?,?,?,?,?)")
 .bind(crypto.randomUUID(),campaign.id,normalizeZambiaPhone(recipient.phone),recipient.full_name||"","sms","partner_service_update",result.ok?"sent":result.skipped?"skipped":"failed","brevo",result.messageId||"",String(result.error||"").slice(0,500)).run();}
 catch(e){console.error("D1 campaign SMS activity logging failed:",String(e).slice(0,180));}
}
async function sendEmail(env,campaign,r){
 if(!r.email)return{ok:false,skipped:true,error:"Partner has no email address."};
 if(!env.BREVO_API_KEY||!env.BREVO_FROM_EMAIL)return{ok:false,error:"Brevo email is not configured."};
 const isPartner=campaign.audience==="partners",unsub=SITE+"/api/subscribe?action=unsubscribe&token="+encodeURIComponent(r.confirmation_token||"");
 const footer=isPartner?"<p style='font-size:12px;color:#687386'>This is an operational PhoneYa2 partner account update. Visit <a href='"+SITE+"/partners-dashboard/'>Partner Studio</a>.</p>":"<p style='font-size:12px;color:#687386'>You receive this because you confirmed PhoneYa2 email updates. <a href='"+esc(unsub)+"'>Unsubscribe</a>.</p>";
 const html="<div style='font-family:Arial,sans-serif;color:#18202b;max-width:640px;margin:auto;line-height:1.6'><div style='background:#151827;color:#fff;padding:20px'><b style='color:#ff8b45'>PHONEYA2 ACCESSORIES</b></div><div style='padding:22px;border:1px solid #e7eaf0'><h1 style='font-size:23px'>"+esc(campaign.subject)+"</h1><p>Hello "+esc(r.full_name||"there")+",</p><div style='white-space:pre-wrap'>"+esc(campaign.body_text)+"</div>"+(campaign.hero_image_url?"<img src='"+esc(campaign.hero_image_url)+"' alt='' style='display:block;width:100%;height:auto;border-radius:12px;margin:16px 0'>":"")+"</div><p style='margin-top:26px'>PhoneYa2 Team</p>"+footer+"</div></div>";
 try{const response=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":env.BREVO_API_KEY,"content-type":"application/json","accept":"application/json"},body:JSON.stringify({sender:{name:env.BREVO_FROM_NAME||"PhoneYa2 Accessories",email:env.BREVO_FROM_EMAIL},to:[{email:r.email,name:r.full_name||""}],subject:campaign.subject,htmlContent:html,textContent:campaign.body_text+"\n\nPhoneYa2 Accessories",headers:isPartner?{}:{"List-Unsubscribe":"<"+unsub+">"}})});const d=await response.json().catch(()=>({}));return response.ok?{ok:true,messageId:d.messageId||""}:{ok:false,error:"Brevo HTTP "+response.status+": "+String(d.message||d.code||"").slice(0,200)};}
 catch(e){return{ok:false,error:String(e).slice(0,200)};}
}
async function sendSms(env,campaign,r){
 const phone=normalizeZambiaPhone(r.phone),sender=String(env.BREVO_SMS_SENDER||"PhoneYa2").trim();
 if(!env.BREVO_API_KEY||!phone)return{ok:false,skipped:true,error:!env.BREVO_API_KEY?"Brevo SMS is not configured.":"Partner phone is not a valid Zambian mobile number."};
 if(!/^[A-Za-z0-9]{1,11}$/.test(sender))return{ok:false,skipped:true,error:"BREVO_SMS_SENDER must be an approved sender ID."};
 try{const response=await fetch("https://api.brevo.com/v3/transactionalSMS/send",{method:"POST",headers:{"api-key":env.BREVO_API_KEY,"content-type":"application/json","accept":"application/json"},body:JSON.stringify({sender,recipient:phone,content:(campaign.subject+": "+campaign.body_text).slice(0,450),type:"transactional",tag:"phoneya2_partner_update"})});const d=await response.json().catch(()=>({}));return response.ok?{ok:true,messageId:String(d.messageId||"")}:{ok:false,error:"Brevo SMS HTTP "+response.status+": "+String(d.message||d.code||"").slice(0,180)};}
 catch(e){return{ok:false,error:String(e).slice(0,180)};}
}
export async function onRequest({request,env}){
 const session=await admin(request,env);if(!session)return json({error:"Administrator sign-in required."},401);
 if(!env.DB)return json({error:"Cloudflare D1 binding DB is not configured."},503);
 try{
  if(request.method==="GET"){
   const [campaignRows,subs,partners]=await Promise.all([
    env.DB.prepare("SELECT * FROM email_campaigns ORDER BY created_at DESC LIMIT 100").all(),
    env.DB.prepare("SELECT status,COUNT(*) AS total FROM customer_subscribers GROUP BY status").all(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM advertisers WHERE status IN ('active','approved') AND (TRIM(COALESCE(email,''))<>'' OR TRIM(COALESCE(phone,''))<>'')").first()
   ]);
   const summary={total:0,subscribed:0,pending:0,unsubscribed:0,bounced:0};for(const row of subs.results||[]){summary.total+=Number(row.total||0);summary[row.status]=Number(row.total||0);}
   return json({success:true,campaigns:campaignRows.results||[],subscribers:summary,partners:{total:Number(partners?.total||0)}});
  }
  if(request.method!=="POST")return json({error:"Method not allowed."},405);
  const body=await request.json().catch(()=>null);if(!body||typeof body!=="object")return json({error:"Invalid request body."},400);
  if(body.action==="create"){
   const name=String(body.name||"").trim().slice(0,120),subject=String(body.subject||"").trim().slice(0,180),bodyText=String(body.body_text||"").trim().slice(0,12000),audience=body.audience==="partners"?"partners":"subscribed";
   if(name.length<2||subject.length<3||bodyText.length<5)return json({error:"Enter a campaign name, subject and message."},400);
   const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO email_campaigns(id,created_by,name,subject,body_text,audience,message_type,status) VALUES(?,?,?,?,?,?,?,'draft')").bind(id,String(session.email||""),name,subject,bodyText,audience,audience==="partners"?"service":"marketing").run();
   const campaign=await env.DB.prepare("SELECT * FROM email_campaigns WHERE id=?").bind(id).first();return json({success:true,campaign},201);
  }
  if(body.action==="send"){
   const id=String(body.id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:"Invalid campaign."},400);
   const campaign=await env.DB.prepare("SELECT * FROM email_campaigns WHERE id=?").bind(id).first();if(!campaign)return json({error:"Campaign not found."},404);if(campaign.status==="sent")return json({error:"This campaign is already complete."},409);
   let recipients=[];
   if(campaign.audience==="partners"){
    const rows=await env.DB.prepare("SELECT id AS advertiser_id,email,owner_name AS full_name,business_name,phone FROM advertisers WHERE status IN ('active','approved') AND (TRIM(COALESCE(email,''))<>'' OR TRIM(COALESCE(phone,''))<>'') ORDER BY created_at ASC LIMIT 1000").all();
    recipients=(rows.results||[]).map(p=>({advertiser_id:p.advertiser_id,email:String(p.email||"").trim().toLowerCase(),full_name:p.full_name||p.business_name||"Partner",phone:p.phone||""})).filter(p=>p.email||p.phone);
   }else{
    const rows=await env.DB.prepare("SELECT email,full_name,confirmation_token FROM customer_subscribers WHERE status='subscribed' ORDER BY created_at ASC LIMIT 1000").all();
    recipients=(rows.results||[]).map(s=>({...s,email:String(s.email||"").trim().toLowerCase()}));
   }
   const [sentEmails,sentPhones]=await Promise.all([
    env.DB.prepare("SELECT recipient_email FROM email_activity WHERE campaign_id=? AND status IN ('sent','delivered')").bind(id).all(),
    env.DB.prepare("SELECT recipient FROM communication_activity WHERE campaign_id=? AND channel='sms' AND status IN ('sent','delivered')").bind(id).all()
   ]);
   const sentSet=new Set((sentEmails.results||[]).map(x=>String(x.recipient_email||"").toLowerCase()));
   const phoneSet=new Set((sentPhones.results||[]).map(x=>String(x.recipient||"")));
   recipients=recipients.filter(r=>(r.email&&!sentSet.has(r.email))||(campaign.audience==="partners"&&normalizeZambiaPhone(r.phone)&&!phoneSet.has(normalizeZambiaPhone(r.phone))));
   if(!recipients.length){const completedAt=new Date().toISOString();await env.DB.prepare("UPDATE email_campaigns SET status='sent',completed_at=?,updated_at=?,last_error='' WHERE id=?").bind(completedAt,completedAt,id).run();try{await env.DB.prepare("INSERT OR IGNORE INTO admin_notifications(id,event_key,category,event_type,title,message,priority,destination,related_id,related_label) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"campaign-completed:"+id+":sent","communications","campaign_sent","Campaign completed",campaign.name+" finished. No remaining recipients were waiting to be processed.","normal","/admin/communications.html",id,campaign.name).run();}catch(e){console.error("Campaign notification failed:",String(e).slice(0,180));}return json({success:true,done:true,message:"Campaign complete. No remaining recipients in this audience.",processed:0,remaining:0});}
   await env.DB.prepare("UPDATE email_campaigns SET status='sending',updated_at=?,total_recipients=? WHERE id=?").bind(new Date().toISOString(),sentSet.size+phoneSet.size+recipients.length,id).run();
   const batch=recipients.slice(0,20);let sent=0,failed=0;const errors=[];
   for(const r of batch){
    let emailResult={ok:false,skipped:true,error:"No email address."};if(r.email&&!sentSet.has(r.email)){emailResult=await sendEmail(env,campaign,r);await emailLog(env,campaign,r,emailResult);}
    let smsResult={ok:false,skipped:true,error:"SMS is only used for partner service updates."};
    if(campaign.audience==="partners"&&r.phone){const phone=normalizeZambiaPhone(r.phone);if(phone&&!phoneSet.has(phone)){smsResult=await sendSms(env,campaign,r);await phoneLog(env,campaign,r,smsResult);}}
    if(emailResult.ok||smsResult.ok){sent++;await partnerDeliveryNotification(env,campaign,r,emailResult,smsResult);}else{failed++;if(errors.length<3)errors.push(emailResult.error||smsResult.error||"Delivery failed.");}
   }
   const remaining=recipients.length-batch.length,done=remaining===0,status=done?(failed?"failed":"sent"):"sending";
   const completedAt=new Date().toISOString();
   await env.DB.prepare("UPDATE email_campaigns SET status=?,updated_at=?,sent_count=sent_count+?,failed_count=failed_count+?,completed_at=?,last_error=? WHERE id=?").bind(status,completedAt,sent,failed,done?completedAt:null,errors.join(" | "),id).run();
   if(done){try{await env.DB.prepare("INSERT OR IGNORE INTO admin_notifications(id,event_key,category,event_type,title,message,priority,destination,related_id,related_label) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"campaign-completed:"+id+":"+status,"communications",status==="failed"?"campaign_failed":"campaign_sent",status==="failed"?"Campaign needs attention":"Campaign completed",campaign.name+" finished. "+sent+" delivery successes and "+failed+" failed attempts.",status==="failed"?"high":"normal","/admin/communications.html",id,campaign.name).run();}catch(e){console.error("Campaign notification failed:",String(e).slice(0,180));}}
   return json({success:true,done,processed:batch.length,sent,failed,remaining,errors,message:done?"Campaign batch completed.":"Batch processed. Select Send/Resume again to continue."});
  }
  return json({error:"Unsupported action."},400);
 }catch(e){console.error("PhoneYa2 D1 campaign endpoint failed:",String(e).slice(0,300));return json({error:"Campaign operation failed. Check D1 migrations and server logs."},503);}
}