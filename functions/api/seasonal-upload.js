const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const ADMIN_FALLBACK="singbless89@gmail.com";
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
async function adminUser(request,env){
 const token=(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
 const base=String(env.SUPABASE_URL||"").replace(/\/$/,""),anon=env.SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY||"";
 const allowed=String(env.ADMIN_EMAIL||ADMIN_FALLBACK).trim().toLowerCase();
 if(!token||!base||!anon)return null;
 const response=await fetch(base+"/auth/v1/user",{headers:{apikey:anon,authorization:"Bearer "+token}});
 if(!response.ok)return null;const user=await response.json();
 return user?.email&&String(user.email).toLowerCase()===allowed?user:null;
}
function encodeBase64(bytes){let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary);}
export async function onRequest({request,env}){
 if(request.method!=="POST")return json({error:"Method not allowed."},405);
 const origin=request.headers.get("origin");if(origin){try{if(new URL(origin).host!==new URL(request.url).host)return json({error:"Cross-origin request blocked."},403);}catch{return json({error:"Invalid origin."},403);}}
 try{
  if(!await adminUser(request,env))return json({error:"Administrator authentication required."},401);
  const token=env.PHONEYA2_GITHUB_TOKEN||env.GITHUB_TOKEN;if(!token)return json({error:"GitHub publishing is not configured. Add PHONEYA2_GITHUB_TOKEN as a Cloudflare Pages secret."},503);
  const form=await request.formData(),file=form.get("file"),slot=String(form.get("slot")||""),theme=String(form.get("theme")||"").toLowerCase();
  const allowed={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/avif":"avif"};
  if(!["banner","popup"].includes(slot)||!/^[a-z0-9-]{1,40}$/.test(theme))return json({error:"Choose a valid campaign image slot and season."},400);
  if(!(file instanceof File)||!allowed[file.type]||file.size>5*1024*1024)return json({error:"Use a JPG, PNG, WebP or AVIF image up to 5 MB."},400);
  const owner=env.PHONEYA2_GITHUB_OWNER||"BLESSTech-X",repo=env.PHONEYA2_GITHUB_REPO||"BlessTech-X-Accessories",branch=env.PHONEYA2_GITHUB_BRANCH||"main";
  const ext=allowed[file.type],path="images/seasonal/"+theme+"/"+slot+"-"+Date.now()+"."+ext;
  const bytes=new Uint8Array(await file.arrayBuffer()),content=encodeBase64(bytes);
  const response=await fetch("https://api.github.com/repos/"+owner+"/"+repo+"/contents/"+path,{method:"PUT",headers:{accept:"application/vnd.github+json","x-github-api-version":"2022-11-28",authorization:"Bearer "+token,"content-type":"application/json","user-agent":"PhoneYa2-Seasonal-Studio"},body:JSON.stringify({message:"Upload "+theme+" seasonal "+slot+" image",content,branch})});
  if(!response.ok){const detail=await response.text();return json({error:"GitHub image upload failed: "+detail.slice(0,240)},502);}
  const result=await response.json();
  const url="https://raw.githubusercontent.com/"+owner+"/"+repo+"/"+branch+"/"+path;
  return json({ok:true,path,url,commit:result.commit?.sha||null});
 }catch(error){return json({error:error?.message||"Image upload failed."},500);}
}