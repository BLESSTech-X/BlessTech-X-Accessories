import { getAdminSession, sameOrigin } from "../_auth.js";
const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const TABLES=new Set(["tier_config","ads","advertisers","advertiser_profiles","ad_reports","ad_moderation_log","ad_impressions","ad_clicks","profiles"]);
const WRITABLE={
 advertisers:new Set(["status","tier","tier_started_at","tier_expires_at"]),
 ads:new Set(["status","rejection_reason"]),
 advertiser_profiles:new Set(["verified"]),
 ad_reports:new Set(["resolved"]),
 ad_moderation_log:new Set(["ad_id","action","reason","performed_by","notes"])
};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
function dbConfig(env){const base=String(env.SUPABASE_URL||"").replace(/\/$/,"");const key=String(env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY||"");if(!base||!key)throw new Error("Advertising database is not configured.");return {base,key};}
async function db(env,path,init={}){const {base,key}=dbConfig(env);const headers=new Headers(init.headers||{});headers.set("apikey",key);headers.set("authorization","Bearer "+key);headers.set("accept","application/json");if(init.body)headers.set("content-type","application/json");return fetch(base+"/rest/v1/"+path,{...init,headers});}
function validId(value){return /^[0-9a-f-]{36}$/i.test(String(value||""));}
export async function onRequest({request,env}){
 if(!sameOrigin(request))return json({error:"Cross-origin request blocked."},403);
 if(!await getAdminSession(request,env))return json({error:"Command Centre sign-in required."},401);
 const url=new URL(request.url);
 try{
  if(request.method==="GET"){
   const table=url.searchParams.get("table")||"",query=url.searchParams.get("query")||"";
   if(!TABLES.has(table)||query.length>2500||/[\r\n]/.test(query))return json({error:"Invalid advertising data request."},400);
   const response=await db(env,table+(query?"?"+query:""),{method:"GET"});
   if(!response.ok){console.error("Ads admin read failed",table,response.status,(await response.text()).slice(0,180));return json({error:"Could not load "+table+"."},503);}
   return json(await response.json());
  }
  if(request.method!=="POST")return json({error:"Method not allowed."},405);
  const raw=await request.text();if(raw.length>12000)return json({error:"Request is too large."},413);
  const body=JSON.parse(raw),table=String(body.table||""),action=String(body.action||""),values=body.values&&typeof body.values==="object"&&!Array.isArray(body.values)?body.values:null;
  if(!TABLES.has(table)||!values)return json({error:"Invalid advertising update."},400);
  let method="PATCH",query=String(body.query||"");
  if(action==="insert-log"&&table==="ad_moderation_log"){
   method="POST";query="";
   const profileResponse=await db(env,"profiles?select=id&email=eq."+encodeURIComponent("singbless89@gmail.com")+"&limit=1");
   if(!profileResponse.ok)return json({error:"Admin profile could not be verified."},503);
   const profiles=await profileResponse.json();if(!profiles.length)return json({error:"Admin profile is missing."},403);
   values.performed_by=profiles[0].id;
  }else{
   if(!WRITABLE[table]||!validId((query.match(/(?:^|&)id=eq\.([^&]+)/)||[])[1]))return json({error:"This advertising update is not allowed."},400);
   if(Object.keys(values).some(key=>!WRITABLE[table].has(key)))return json({error:"This advertising field cannot be changed."},400);
   if(table==="ads"&&!["approved","rejected","banned","paused"].includes(String(values.status||"")))return json({error:"Invalid ad status."},400);
   if(table==="advertisers"&&values.status&&!["active","suspended","pending","approved"].includes(String(values.status)))return json({error:"Invalid advertiser status."},400);
   if(table==="ad_reports"&&typeof values.resolved!=="boolean")return json({error:"Invalid report status."},400);
   if(table==="advertiser_profiles"&&typeof values.verified!=="boolean")return json({error:"Invalid verification status."},400);
  }
  const response=await db(env,table+(query?"?"+query:""),{method,headers:{prefer:"return=representation"},body:JSON.stringify(values)});
  if(!response.ok){console.error("Ads admin write failed",table,response.status,(await response.text()).slice(0,200));return json({error:"The advertising change could not be saved."},503);}
  const text=await response.text();return json({ok:true,rows:text?JSON.parse(text):[]});
 }catch(error){console.error("Ads admin API failed",String(error).slice(0,240));return json({error:"Advertising admin request failed."},503);}
}