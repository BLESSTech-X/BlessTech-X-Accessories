const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const SITE = "https://phoneya2.pages.dev";
function json(data, status=200) { return new Response(JSON.stringify(data), {status, headers:JSON_HEADERS}); }
function secret(env,...keys) { for (const k of keys) if (env[k]) return env[k]; return ""; }
function esc(v) { return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
async function db(env,path,init={}) {
  const base=String(env.SUPABASE_URL||"").replace(/\/$/,""), key=secret(env,"SUPABASE_SERVICE_ROLE_KEY","SUPABASE_SECRET_KEY");
  if(!base||!key) throw new Error("Server database secrets are not configured.");
  const headers=new Headers(init.headers||{}); headers.set("apikey",key); headers.set("authorization","Bearer "+key); headers.set("content-type","application/json");
  return fetch(base+path,{...init,headers});
}
async function admin(request,env) {
  const token=(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
  const base=String(env.SUPABASE_URL||"").replace(/\/$/,""), anon=secret(env,"SUPABASE_ANON_KEY","SUPABASE_PUBLISHABLE_KEY"), allowed=String(env.ADMIN_EMAIL||"").trim().toLowerCase();
  if(!token||!base||!anon||!allowed) return null;
  const r=await fetch(base+"/auth/v1/user",{headers:{apikey:anon,authorization:"Bearer "+token}});
  if(!r.ok) return null; const u=await r.json(); return u?.email?.toLowerCase()===allowed?u:null;
}
async function activity(env,r) {
  const response=await db(env,"/rest/v1/email_activity",{method:"POST",headers:{prefer:"return=minimal"},body:JSON.stringify({
    event_type:"marketing_campaign",source:"manual",trigger_source:"admin_campaign_send",recipient_email:r.email,recipient_name:r.name||"",
    subject:r.subject,status:r.ok?"sent":"failed",provider:"resend",provider_message_id:r.messageId||"",error_message:r.error||"",
    campaign_id:r.campaignId,retry_count:0,sent_at:r.ok?new Date().toISOString():null,metadata:{campaign_name:r.campaignName}
  })});
  if(!response.ok) console.error("Campaign activity logging failed:",response.status,(await response.text()).slice(0,180));
}
async function sendOne(env,campaign,subscriber) {
  const key=env.RESEND_API_KEY, from=env.RESEND_FROM;
  if(!key||!from) return {ok:false,error:"Resend API key or verified sender is not configured."};
  const token=subscriber.confirmation_token;
  const unsubscribe=SITE+"/api/subscribe?action=unsubscribe&token="+encodeURIComponent(token||"");
  const html="<div style=\"font-family:Arial,sans-serif;color:#18202b;max-width:640px;margin:auto;line-height:1.6\"><div style=\"background:#151827;color:#fff;padding:20px\"><b style=\"color:#ff8b45\">PHONEYA2 ACCESSORIES</b></div><div style=\"padding:22px;border:1px solid #e7eaf0\"><h1 style=\"font-size:23px\">"+esc(campaign.subject)+"</h1><p>Hello "+esc(subscriber.full_name||"there")+",</p><div style=\"white-space:pre-wrap\">"+esc(campaign.body_text)+"</div><p style=\"margin-top:26px\">PhoneYa2 Accessories</p></div><div style=\"font-size:12px;color:#687386;padding:14px\">You receive this because you opted in to PhoneYa2 updates. <a href=\""+esc(unsubscribe)+"\">Manage/unsubscribe from emails</a>.</div></div>";
  try {
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:"Bearer "+key,"content-type":"application/json"},body:JSON.stringify({from,to:[subscriber.email],subject:campaign.subject,html,headers:{"List-Unsubscribe":"<"+unsubscribe+">"}})});
    const result=await response.json().catch(()=>({}));
    return response.ok?{ok:true,messageId:result.id||""}:{ok:false,error:"Resend HTTP "+response.status+": "+String(result.message||result.name||"").slice(0,220)};
  } catch(e) { return {ok:false,error:String(e).slice(0,220)}; }
}
export async function onRequest(context) {
  const {request,env}=context;
  if(!await admin(request,env)) return json({error:"Administrator sign-in required."},401);
  try {
    if(request.method==="GET") {
      const [campaignsR,subsR]=await Promise.all([
        db(env,"/rest/v1/email_campaigns?select=*&order=created_at.desc&limit=100"),
        db(env,"/rest/v1/customer_subscribers?select=id,status&limit=1000")
      ]);
      if(!campaignsR.ok||!subsR.ok) return json({error:"Campaign tables are not ready. Run the latest communication-centre.sql migration."},503);
      const [campaigns,subs]=await Promise.all([campaignsR.json(),subsR.json()]);
      return json({success:true,campaigns,subscribers:{total:subs.length,subscribed:subs.filter(s=>s.status==="subscribed").length,pending:subs.filter(s=>s.status==="pending").length,unsubscribed:subs.filter(s=>s.status==="unsubscribed").length}});
    }
    if(request.method!=="POST") return json({error:"Method not allowed."},405);
    const body=await request.json().catch(()=>null); if(!body||typeof body!=="object") return json({error:"Invalid request body."},400);
    const userEmail=String((await admin(request,env)).email||"");
    if(body.action==="create") {
      const name=String(body.name||"").trim().slice(0,120), subject=String(body.subject||"").trim().slice(0,180), text=String(body.body_text||"").trim().slice(0,12000);
      if(name.length<2||subject.length<3||text.length<5) return json({error:"Enter a campaign name, subject and message (at least 5 characters)."},400);
      const r=await db(env,"/rest/v1/email_campaigns",{method:"POST",headers:{prefer:"return=representation"},body:JSON.stringify({name,subject,body_text:text,created_by:userEmail,status:"draft"})});
      if(!r.ok) return json({error:"Could not save campaign. Run the latest database migration."},503);
      return json({success:true,campaign:(await r.json())[0]},201);
    }
    if(body.action==="send") {
      const id=String(body.id||""); if(!/^[0-9a-f-]{36}$/i.test(id)) return json({error:"Invalid campaign."},400);
      const cr=await db(env,"/rest/v1/email_campaigns?id=eq."+encodeURIComponent(id)+"&select=*&limit=1");
      if(!cr.ok) return json({error:"Could not load campaign."},503); const rows=await cr.json(), campaign=rows[0];
      if(!campaign) return json({error:"Campaign not found."},404);
      if(campaign.status==="sent") return json({error:"This campaign is already complete."},409);
      const subR=await db(env,"/rest/v1/customer_subscribers?select=id,email,full_name,confirmation_token&status=eq.subscribed&order=created_at.asc&limit=1000");
      if(!subR.ok) return json({error:"Could not load opted-in subscribers."},503);
      const logR=await db(env,"/rest/v1/email_activity?select=recipient_email&campaign_id=eq."+encodeURIComponent(id)+"&status=in.(sent,delivered)");
      if(!logR.ok) return json({error:"Could not check campaign send history."},503);
      const sentSet=new Set((await logR.json()).map(x=>String(x.recipient_email).toLowerCase()));
      const subscribers=(await subR.json()).filter(s=>!sentSet.has(String(s.email).toLowerCase()));
      if(!subscribers.length) {
        await db(env,"/rest/v1/email_campaigns?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{prefer:"return=minimal"},body:JSON.stringify({status:"sent",completed_at:new Date().toISOString(),updated_at:new Date().toISOString(),last_error:""})});
        return json({success:true,done:true,message:"Campaign complete. No unsent opted-in subscribers remain.",processed:0,remaining:0});
      }
      await db(env,"/rest/v1/email_campaigns?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{prefer:"return=minimal"},body:JSON.stringify({status:"sending",updated_at:new Date().toISOString(),total_recipients:sentSet.size+subscribers.length})});
      const batch=subscribers.slice(0,20); let sent=0,failed=0; const errors=[];
      for(const s of batch) {
        const result=await sendOne(env,campaign,s);
        await activity(env,{...result,email:s.email,name:s.full_name,subject:campaign.subject,campaignId:id,campaignName:campaign.name});
        if(result.ok) sent++; else {failed++; if(errors.length<3) errors.push(result.error);}
      }
      const stillRemaining=subscribers.length-batch.length;
      const status=stillRemaining===0?(failed===0?"sent":"failed"):"sending";
      await db(env,"/rest/v1/email_campaigns?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{prefer:"return=minimal"},body:JSON.stringify({
        status,updated_at:new Date().toISOString(),sent_count:sentSet.size+sent,failed_count:Number(campaign.failed_count||0)+failed,
        completed_at:stillRemaining===0?new Date().toISOString():null,last_error:errors.join(" | ")
      })});
      return json({success:true,done:stillRemaining===0,message:stillRemaining===0?(failed?"Batch processed; failed recipients can be retried by resuming the campaign.":"Campaign sent successfully."):"Batch processed. Select Send/Resume again to continue.",processed:batch.length,sent,failed,remaining:stillRemaining,errors});
    }
    return json({error:"Unsupported action."},400);
  } catch(e) { console.error("PhoneYa2 campaign endpoint failed:",String(e).slice(0,300)); return json({error:"Campaign operation failed. Check server logs and configuration."},503); }
}
