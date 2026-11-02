const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
async function requireAdmin(request,env){const {getAdminSession,sameOrigin}=await import("../_auth.js");if(!sameOrigin(request))return null;return await getAdminSession(request,env);}
export async function onRequest({request,env}){
 if(request.method!=="GET")return json({error:"Method not allowed."},405);
 const url=new URL(request.url);if(url.searchParams.get("admin")!=="1")return json({error:"Not found."},404);
 if(!await requireAdmin(request,env))return json({error:"Administrator sign-in required."},401);
 if(!env.DB)return json({error:"Cloudflare D1 database binding DB is not configured."},503);
 try{
  const [stats,activityRows,phoneRows,subscriberRows,automations]=await Promise.all([
   env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN source='automatic' THEN 1 ELSE 0 END) AS automatic,SUM(CASE WHEN source='manual' THEN 1 ELSE 0 END) AS manual,SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END) AS sent,SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,SUM(CASE WHEN status='bounced' THEN 1 ELSE 0 END) AS bounced,SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) AS queued,SUM(CASE WHEN created_at>=datetime('now','-30 days') THEN 1 ELSE 0 END) AS last_30_days,SUM(CASE WHEN status='failed' AND created_at>=datetime('now','-30 days') THEN 1 ELSE 0 END) AS failed_last_30_days FROM email_activity").first(),
   env.DB.prepare("SELECT id,created_at,sent_at,event_type,source,trigger_source,recipient_email,recipient_name,subject,status,provider,provider_message_id,error_message,related_order_number,related_product_slug,campaign_id,retry_count,metadata_json FROM email_activity ORDER BY created_at DESC LIMIT 250").all(),
   env.DB.prepare("SELECT id,campaign_id,recipient,recipient_name,channel,event_type,status,provider,provider_message_id,error_message,created_at FROM communication_activity ORDER BY created_at DESC LIMIT 250").all(),
   env.DB.prepare("SELECT status,COUNT(*) AS total FROM customer_subscribers GROUP BY status").all(),
   env.DB.prepare("SELECT automation_key,name,description,enabled,approval_required,updated_at FROM communication_automations ORDER BY name ASC").all()
  ]);
  const summary={total:0,subscribed:0,pending:0,unsubscribed:0,bounced:0};
  for(const row of subscriberRows.results||[]){summary.total+=Number(row.total||0);summary[row.status]=Number(row.total||0);}
  const activity=(activityRows.results||[]).map(row=>{let metadata={};try{metadata=JSON.parse(row.metadata_json||"{}")}catch{}return{...row,metadata};});
  const automationList=(automations.results||[]).map(row=>({...row,enabled:!!row.enabled,approval_required:!!row.approval_required}));
  return json({success:true,stats:stats||{},activity,phone_activity:phoneRows.results||[],subscriber_summary:summary,automations:automationList,activity_limit:250});
 }catch(error){console.error("PhoneYa2 D1 Communication Centre failed:",String(error).slice(0,250));return json({error:"Could not load communication activity. Confirm D1 migration 0012 has been applied."},503);}
}