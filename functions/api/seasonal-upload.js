const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const ADMIN_FALLBACK="singbless89@gmail.com";
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
async function adminUser(request,env){
 const token=(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
 const base=String(env.SUPABASE_URL||"").replace(/\/$/,"");
 const anon=env.SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY||"";
 const allowed=String(env.ADMIN_EMAIL||ADMIN_FALLBACK).trim().toLowerCase();
 if(!token||!base||!anon)return null;
 const response=await fetch(base+"/auth/v1/user",{headers:{apikey:anon,authorization:"Bearer "+token}});
 if(!response.ok)return null;const user=await response.json();
 return user?.email&&String(user.email).toLowerCase()===allowed?user:null;
}
export async function onRequest({request,env}){
 if(request.method!=="POST")return json({error:"Method not allowed."},405);
 const origin=request.headers.get("origin");if(origin){try{if(new URL(origin).host!==new URL(request.url).host)return json({error:"Cross-origin request blocked."},403);}catch{return json({error:"Invalid origin."},403);}}
 try{
  if(!await adminUser(request,env))return json({error:"Administrator authentication required."},401);
  const form=await request.formData(),file=form.get("file"),slot=String(form.get("slot")||""),theme=String(form.get("theme")||"").toLowerCase().replace(/[^a-z0-9-]/g,"").slice(0,40);
  const allowed={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/avif":"avif"};
  if(!["banner","popup"].includes(slot)||!theme)return json({error:"Choose a valid campaign image slot and season."},400);
  if(!(file instanceof File)||!allowed[file.type]||file.size>5*1024*1024)return json({error:"Use a JPG, PNG, WebP or AVIF image up to 5 MB."},400);
  const base=String(env.SUPABASE_URL||"").replace(/\/$/,""),key=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY||"";
  if(!base||!key)return json({error:"Seasonal image storage is not configured on Cloudflare Pages."},503);
  const path=theme+"/"+slot+"-"+Date.now()+"."+allowed[file.type];
  const response=await fetch(base+"/storage/v1/object/phoneya2-seasonal/"+path,{method:"POST",headers:{apikey:key,authorization:"Bearer "+key,"content-type":file.type,"x-upsert":"true"},body:file});
  if(!response.ok){const detail=await response.text();return json({error:"Storage upload failed: "+detail.slice(0,220)},502);}
  return json({ok:true,path,url:base+"/storage/v1/object/public/phoneya2-seasonal/"+path});
 }catch(error){return json({error:error?.message||"Image upload failed."},500);}
}