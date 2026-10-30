const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const ADMIN_FALLBACK = "singbless89@gmail.com";
const SETTINGS_FIELDS = [
  "enabled","theme","decorations","snow","snowIntensity","scheduled","start","end","coverage",
  "popup","popupMode","popupDelay","popupScroll","popupTitle","popupMessage","popupButton","popupUrl","popupImage",
  "banner","bannerTitle","bannerMessage","bannerButton","bannerUrl","bannerImage"
];
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
function secret(env,...names){for(const name of names)if(env[name])return env[name];return "";}
function sameOrigin(request){const origin=request.headers.get("origin");if(!origin)return true;try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}}
async function adminUser(request,env){
  const token=(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
  const base=String(env.SUPABASE_URL||"").replace(/\/$/,"");
  const anon=secret(env,"SUPABASE_ANON_KEY","SUPABASE_PUBLISHABLE_KEY");
  const allowed=String(env.ADMIN_EMAIL||ADMIN_FALLBACK).trim().toLowerCase();
  if(!token||!base||!anon)return null;
  const response=await fetch(base+"/auth/v1/user",{headers:{apikey:anon,authorization:"Bearer "+token}});
  if(!response.ok)return null;
  const user=await response.json();
  return user?.email&&String(user.email).toLowerCase()===allowed?user:null;
}
async function database(env,path,init={}){
  const base=String(env.SUPABASE_URL||"").replace(/\/$/,"");
  const key=secret(env,"SUPABASE_SERVICE_ROLE_KEY","SUPABASE_SECRET_KEY");
  if(!base||!key)throw new Error("PhoneYa2 database is not configured on Cloudflare Pages.");
  const headers=new Headers(init.headers||{});
  headers.set("apikey",key);headers.set("authorization","Bearer "+key);headers.set("content-type","application/json");
  return fetch(base+"/rest/v1/"+path,{...init,headers});
}
export async function onRequest({request,env}){
  if(!sameOrigin(request))return json({error:"Cross-origin request blocked."},403);
  try{
    if(request.method==="GET"){
      const response=await database(env,"seasonal_campaigns?id=eq.global&select=*");
      if(!response.ok)return json({error:"Seasonal campaign storage is not ready. Apply the seasonal campaign migration in Supabase first."},503);
      const rows=await response.json();
      if(!rows?.length)return json({error:"Seasonal campaign settings have not been initialized."},503);
      const row=rows[0];const {id,presets,updated_at,...settings}=row;
      return json({settings,presets:presets&&typeof presets==="object"?presets:{} ,updated_at});
    }
    if(request.method!=="PUT")return json({error:"Method not allowed."},405);
    const user=await adminUser(request,env);
    if(!user)return json({error:"Administrator authentication required."},401);
    const raw=await request.text();if(raw.length>1024*1024)return json({error:"Seasonal settings payload is too large."},413);
    let body;try{body=JSON.parse(raw);}catch{return json({error:"Submit valid JSON."},400);}
    const source=body?.settings&&typeof body.settings==="object"?body.settings:{};
    const settings={id:"global"};
    for(const key of SETTINGS_FIELDS)if(Object.prototype.hasOwnProperty.call(source,key))settings[key]=source[key];
    if(body?.presets&&typeof body.presets==="object"&&!Array.isArray(body.presets))settings.presets=body.presets;
    settings.updated_at=new Date().toISOString();
    const response=await database(env,"seasonal_campaigns?id=eq.global",{method:"PATCH",headers:{prefer:"return=representation"},body:JSON.stringify(settings)});
    if(!response.ok){const detail=await response.text();return json({error:"Could not save seasonal settings: "+detail.slice(0,300)},502);}
    const rows=await response.json();
    if(!rows?.length)return json({error:"No seasonal settings row was updated. Apply the database migration and retry."},409);
    return json({ok:true,updated_at:rows[0].updated_at});
  }catch(error){return json({error:error?.message||"Seasonal settings request failed."},500);}
}
