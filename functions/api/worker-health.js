const HEADERS={ "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
async function authorized(request,env){
 const {getAdminSession,sameOrigin}=await import("../_auth.js");
 return sameOrigin(request)&&!!(await getAdminSession(request,env));
}
export async function onRequest({request,env}){
 if(request.method!=="GET")return json({error:"Method not allowed."},405);
 if(!await authorized(request,env))return json({error:"Administrator sign-in required."},401);
 if(!env.DB)return json({error:"Cloudflare D1 database binding DB is not configured."},503);
 try{
  const url=new URL(request.url),worker=String(url.searchParams.get("worker")||"").trim();
  const allowed=["notification-scheduler","partner-lifecycle"];
  if(worker&&!allowed.includes(worker))return json({error:"Unknown worker."},400);
  const result=worker
   ?await env.DB.prepare("SELECT worker_key,worker_name,schedule,status,last_started_at,last_success_at,last_failure_at,last_duration_ms,last_error,total_runs,failed_runs,updated_at FROM worker_health WHERE worker_key=?").bind(worker).all()
   :await env.DB.prepare("SELECT worker_key,worker_name,schedule,status,last_started_at,last_success_at,last_failure_at,last_duration_ms,last_error,total_runs,failed_runs,updated_at FROM worker_health ORDER BY worker_key").all();
  return json({success:true,workers:result.results||[],checked_at:new Date().toISOString()});
 }catch(error){
  console.error("Worker health read failed:",String(error?.stack||error).slice(0,300));
  return json({error:"Worker health is not available. Apply D1 migration 0035_worker_health_monitoring.sql."},503);
 }
}
