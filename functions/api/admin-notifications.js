const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:HEADERS});}
async function admin(request,env){
 const {getAdminSession,sameOrigin}=await import("../_auth.js");
 if(!sameOrigin(request))return false;
 return !!(await getAdminSession(request,env));
}
export async function onRequest({request,env}){
 if(!await admin(request,env))return json({error:"Administrator sign-in required."},401);
 if(!env.DB)return json({error:"Cloudflare D1 database binding DB is not configured."},503);
 if(request.method==="GET"){
  try{
   const url=new URL(request.url),limit=Math.min(200,Math.max(1,Number(url.searchParams.get("limit"))||100));
   const [rows,counts]=await Promise.all([
    env.DB.prepare("SELECT id,event_key,category,event_type,title,message,priority,destination,related_id,related_label,created_at,is_read,read_at FROM admin_notifications ORDER BY created_at DESC LIMIT ?").bind(limit).all(),
    env.DB.prepare("SELECT category,COUNT(*) AS total FROM admin_notifications WHERE is_read=0 GROUP BY category").all()
   ]);
   const unread_by_category={};let unread=0;
   for(const row of counts.results||[]){const count=Number(row.total||0);unread_by_category[row.category]=count;unread+=count;}
   return json({success:true,notifications:rows.results||[],unread,unread_by_category,limit});
  }catch(error){console.error("Command Centre notifications read failed:",String(error).slice(0,300));return json({error:"Could not load notifications. Apply D1 migration 0015_admin_notifications.sql first."},503);}
 }
 if(request.method==="POST"){
  let body;try{body=await request.json();}catch{return json({error:"Submit a valid notification action."},400);}
  try{
   if(body.action==="mark_read"){
    const id=String(body.id||"").slice(0,100);if(!id)return json({error:"Notification ID is required."},400);
    await env.DB.prepare("UPDATE admin_notifications SET is_read=1,read_at=COALESCE(read_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id=?").bind(id).run();
   }else if(body.action==="mark_all_read"){
    await env.DB.prepare("UPDATE admin_notifications SET is_read=1,read_at=COALESCE(read_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE is_read=0").run();
   }else{return json({error:"Unknown notification action."},400);}
   return json({success:true});
  }catch(error){console.error("Command Centre notification update failed:",String(error).slice(0,300));return json({error:"Could not update notification status."},503);}
 }
 return json({error:"Method not allowed."},405);
}
