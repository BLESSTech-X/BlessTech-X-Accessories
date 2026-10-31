const JSON_HEADERS={ "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };
const ADMIN_FALLBACK="singbless89@gmail.com";
const SETTINGS_FIELDS=["enabled","theme","decorations","snow","snowIntensity","scheduled","start","end","coverage","popup","popupMode","popupDelay","popupScroll","banner"];
const OWNER="BLESSTech-X",REPO="BlessTech-X-Accessories",BRANCH="main",SETTINGS_PATH="content/settings/seasonal-campaigns.json";
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
function sameOrigin(request){const origin=request.headers.get("origin");if(!origin)return true;try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}}
async function adminUser(request,env){
 const token=(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
 const base=String(env.SUPABASE_URL||"").replace(/\/$/,""),anon=env.SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY||"";
 const allowed=String(env.ADMIN_EMAIL||ADMIN_FALLBACK).trim().toLowerCase();
 if(!token||!base||!anon)return null;
 const response=await fetch(base+"/auth/v1/user",{headers:{apikey:anon,authorization:"Bearer "+token}});
 if(!response.ok)return null;const user=await response.json();
 return user?.email&&String(user.email).toLowerCase()===allowed?user:null;
}
function githubConfig(env){
 const token=env.PHONEYA2_GITHUB_TOKEN||env.GITHUB_TOKEN;
 if(!token)throw new Error("GitHub publishing is not configured. Add PHONEYA2_GITHUB_TOKEN as a Cloudflare Pages secret.");
 return {token,owner:env.PHONEYA2_GITHUB_OWNER||OWNER,repo:env.PHONEYA2_GITHUB_REPO||REPO,branch:env.PHONEYA2_GITHUB_BRANCH||BRANCH};
}
async function githubRequest(config,path,init={}){
 const response=await fetch("https://api.github.com/repos/"+config.owner+"/"+config.repo+"/contents/"+path+(init.method?"":"?ref="+encodeURIComponent(config.branch)),{
  ...init,headers:{accept:"application/vnd.github+json","x-github-api-version":"2022-11-28",authorization:"Bearer "+config.token,"user-agent":"PhoneYa2-Seasonal-Studio",...(init.headers||{})}
 });
 return response;
}
function decodeFile(content){const bytes=Uint8Array.from(atob(String(content||"").replace(/\s/g,"")),c=>c.charCodeAt(0));return new TextDecoder().decode(bytes);}
function encodeFile(content){const bytes=new TextEncoder().encode(content);let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary);}
async function readFile(config,path){
 const response=await githubRequest(config,path);
 if(response.status===404)return {data:null,sha:null};
 if(!response.ok)throw new Error("GitHub read failed for "+path+" (HTTP "+response.status+").");
 const file=await response.json();return {data:JSON.parse(decodeFile(file.content)),sha:file.sha};
}
async function writeFile(config,path,data,sha,message){
 const body={message,content:encodeFile(JSON.stringify(data,null,2)+"\n"),branch:config.branch};
 if(sha)body.sha=sha;
 const response=await githubRequest(config,path,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 if(!response.ok){const detail=await response.text();throw new Error("GitHub could not publish "+path+": "+detail.slice(0,260));}
 return response.json();
}
export async function onRequest({request,env}){
 if(!sameOrigin(request))return json({error:"Cross-origin request blocked."},403);
 try{
  if(request.method!=="GET"&&request.method!=="PUT")return json({error:"Method not allowed."},405);
  if(request.method==="PUT"&&!await adminUser(request,env))return json({error:"Administrator authentication required."},401);
  const config=githubConfig(env);
  if(request.method==="GET"){
   const {data}=await readFile(config,SETTINGS_PATH);
   if(!data||typeof data!=="object"||Array.isArray(data))return json({error:"The Decap seasonal settings file is missing or invalid."},503);
   return json({settings:data,presets:{}});
  }
  const raw=await request.text();if(raw.length>1024*1024)return json({error:"Seasonal settings payload is too large."},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:"Submit valid JSON."},400);}
  const source=body?.settings&&typeof body.settings==="object"&&!Array.isArray(body.settings)?body.settings:{};
  const current=await readFile(config,SETTINGS_PATH);
  const settings={...(current.data||{})};
  for(const key of SETTINGS_FIELDS)if(Object.prototype.hasOwnProperty.call(source,key))settings[key]=source[key];
  await writeFile(config,SETTINGS_PATH,settings,current.sha,"Update PhoneYa2 seasonal campaign controls");
  const presets=body?.presets&&typeof body.presets==="object"&&!Array.isArray(body.presets)?body.presets:{};
  for(const [theme,overrides] of Object.entries(presets)){
   if(!/^[a-z0-9-]{1,40}$/.test(theme)||!overrides||typeof overrides!=="object"||Array.isArray(overrides))continue;
   const path="content/settings/seasonal-presets/"+theme+".json";
   const existing=await readFile(config,path);if(!existing.data)continue;
   const next={...existing.data};
   for(const key of ["bannerImage","popupImage"])if(typeof overrides[key]==="string")next[key]=overrides[key];
   await writeFile(config,path,next,existing.sha,"Update "+theme+" seasonal campaign images");
  }
  return json({ok:true,source:"github",branch:config.branch,message:"Campaign settings committed to GitHub. Cloudflare Pages will publish the update after deployment."});
 }catch(error){return json({error:error?.message||"Seasonal settings request failed."},500);}
}
