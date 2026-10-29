const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
function secret(env,...names){for(const n of names)if(env[n])return env[n];return "";}
async function requireAdmin(request,env){
 const token=(request.headers.get("authorization")||"").match(/^Bearer\\s+(.+)$/i)?.[1];
 const base=String(env.SUPABASE_URL||"").replace(/\\/$/,"");
 const key=secret(env,"SUPABASE_ANON_KEY","SUPABASE_PUBLISHABLE_KEY");
 const email=String(env.ADMIN_EMAIL||"").trim().toLowerCase();
 if(!token||!base||!key||!email)return false;
 const r=await fetch(base+"/auth/v1/user",{headers:{apikey:key,authorization:"Bearer "+token}});
 if(!r.ok)return false;const u=await r.json();return String(u.email||"").toLowerCase()===email;
}
async function db(env,path,init={}){
 const base=String(env.SUPABASE_URL||"").replace(/\\/$/,"");
 const key=secret(env,"SUPABASE_SERVICE_ROLE_KEY","SUPABASE_SECRET_KEY");
 if(!base||!key)throw new Error("Server database secrets are not configured.");
 const headers=new Headers(init.headers||{});headers.set("apikey",key);headers.set("authorization","Bearer "+key);headers.set("content-type","application/json");
 return fetch(base+path,{...init,headers});
}
const DEFAULT={theme:"none",title:"",message:"",effects:false,popup:false,banner:false,end_date:null};
export async function onRequest({request,env}){
 try{
  if(request.method==="GET"){
   const r=await db(env,"/rest/v1/phoneya2_site_settings?select=setting_key,setting_value&setting_key=eq.seasonal_theme");
   if(!r.ok)return json({error:"Seasonal theme storage is not ready. Run supabase/seasonal-theme.sql in Supabase SQL Editor."},503);
   const rows=await r.json();return json({success:true,config:rows?.[0]?.setting_value||DEFAULT});
  }
  if(request.method==="PUT"){
   if(!await requireAdmin(request,env))return json({error:"Administrator sign-in required. Sign in again and retry."},401);
   let body;try{body=await request.json();}catch{return json({error:"Invalid theme settings."},400);}
   const themes=["none","black-friday","christmas","independence","new-year","valentines","easter","custom"];
   const theme=String(body.theme||"none");if(!themes.includes(theme))return json({error:"Choose a supported event theme."},400);
   const config={theme,title:String(body.title||"").slice(0,90),message:String(body.message||"").slice(0,220),effects:body.effects===true,popup:body.popup===true,banner:body.banner===true,end_date:body.end_date&&/^\\d{4}-\\d{2}-\\d{2}$/.test(body.end_date)?body.end_date:null,updated_at:new Date().toISOString()};
   const r=await db(env,"/rest/v1/phoneya2_site_settings?on_conflict=setting_key",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({setting_key:"seasonal_theme",setting_value:config,updated_at:config.updated_at})});
   if(!r.ok)return json({error:"Could not save theme. Run supabase/seasonal-theme.sql and verify Cloudflare Supabase secrets."},503);
   return json({success:true,config});
  }
  return json({error:"Method not allowed."},405);
 }catch(e){console.error("Seasonal theme API:",String(e));return json({error:"Seasonal theme service is temporarily unavailable."},503);}
}
