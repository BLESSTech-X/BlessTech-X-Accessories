const HEADERS = { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };
const COOKIE = "__Host-py2_partner";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{...HEADERS,...extra}});}
function fail(message,status=400){return json({ok:false,error:message},status);}
function b64url(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function unb64url(s){const v=String(s||"").replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(v+"=".repeat((4-v.length%4)%4)),c=>c.charCodeAt(0));}
function cookieValue(request){for(const p of (request.headers.get("cookie")||"").split(";")){const x=p.trim();if(x.startsWith(COOKIE+"="))return x.slice(COOKIE.length+1);}return "";}
function sameOrigin(request){const origin=request.headers.get("origin");if(!origin)return request.method==="GET"||request.headers.get("sec-fetch-site")==="same-origin";try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}}
async function digest(value){return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));}
async function passwordHash(password,salt){if(!crypto?.subtle)throw new Error("Web Crypto is unavailable in this Worker runtime.");const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:new Uint8Array(salt),iterations:PBKDF2_ITERATIONS,hash:"SHA-256"},key,256);return b64url(new Uint8Array(bits));}
async function newPasswordRecord(password){const salt=crypto.getRandomValues(new Uint8Array(16));const hash=await passwordHash(password,salt);if(!hash||hash.length!==43)throw new Error("Password derivation returned an invalid hash.");return {salt:b64url(salt),hash};}
async function verifyPassword(password,salt,expected){try{const actual=await passwordHash(password,unb64url(salt));const a=unb64url(actual),b=unb64url(expected);if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}catch{return false;}}
async function rateLimit(request,env){const ip=request.headers.get("cf-connecting-ip")||"unknown";const hash=b64url(await digest(ip));const now=Math.floor(Date.now()/1000);await env.DB.prepare("DELETE FROM partner_auth_attempts WHERE attempted_at < ?").bind(now-3600).run();const row=await env.DB.prepare("SELECT COUNT(*) AS n FROM partner_auth_attempts WHERE ip_hash=? AND attempted_at>?").bind(hash,now-900).first();if(Number(row?.n||0)>=12)return false;await env.DB.prepare("INSERT INTO partner_auth_attempts(ip_hash,attempted_at) VALUES(?,?)").bind(hash,now).run();return true;}
function slugify(value){return String(value||"business").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"business";}
async function uniqueSlug(db,name){const base=slugify(name);let slug=base;for(let i=0;i<8;i++){const row=await db.prepare("SELECT id FROM advertiser_profiles WHERE slug=? COLLATE NOCASE").bind(slug).first();if(!row)return slug;slug=base+"-"+crypto.randomUUID().slice(0,5).toLowerCase();}throw new Error("Could not create a unique business website address.");}
function sessionCookie(token){return COOKIE+"="+token+"; Path=/; Max-Age="+(SESSION_DAYS*86400)+"; HttpOnly; Secure; SameSite=Lax";}
function clearCookie(){return COOKIE+"=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";}
async function createSession(db,accountId){const raw=b64url(crypto.getRandomValues(new Uint8Array(32)));const tokenHash=b64url(await digest(raw));const id=crypto.randomUUID();const expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();await db.prepare("INSERT INTO partner_sessions(id,account_id,token_hash,expires_at) VALUES(?,?,?,?)").bind(id,accountId,tokenHash,expires).run();return raw;}
async function currentPartner(request,env){const raw=cookieValue(request);if(!raw)return null;const tokenHash=b64url(await digest(raw));return await env.DB.prepare(`SELECT a.id AS account_id,a.email AS account_email,a.status AS account_status,
adv.id AS advertiser_id,adv.business_name,adv.owner_name,adv.phone,adv.email,adv.logo_url,adv.tier,adv.status AS advertiser_status,
p.id AS profile_id,p.slug,p.tagline,p.about,p.primary_color,p.accent_color,p.cover_image_url,p.social_links_json,p.contact_phone,p.contact_whatsapp,p.contact_email,
s.id AS site_id,s.site_title,s.site_description,s.hero_title,s.hero_subtitle,s.hero_image_url,s.logo_url,s.primary_color AS site_primary_color,s.accent_color AS site_accent_color,s.font_pair,s.template_key,s.show_catalogue,s.show_services,s.show_posts,s.published,s.seo_title,s.seo_description,s.social_links_json AS site_social_links_json
FROM partner_sessions ps JOIN advertiser_accounts a ON a.id=ps.account_id
JOIN advertisers adv ON adv.account_id=a.id LEFT JOIN advertiser_profiles p ON p.advertiser_id=adv.id
LEFT JOIN partner_site_settings s ON s.advertiser_id=adv.id
WHERE ps.token_hash=? AND ps.revoked_at IS NULL AND ps.expires_at>?
AND a.status='active' AND adv.status NOT IN ('suspended') LIMIT 1`).bind(tokenHash,new Date().toISOString()).first();}
async function workspace(db,partner){const [items,posts,enquiries,subscription,ads,impressions,clicks]=await Promise.all([
db.prepare("SELECT * FROM partner_catalog_items WHERE advertiser_id=? ORDER BY sort_order,created_at DESC LIMIT 500").bind(partner.advertiser_id).all(),
db.prepare("SELECT * FROM partner_posts WHERE advertiser_id=? ORDER BY created_at DESC LIMIT 200").bind(partner.advertiser_id).all(),
db.prepare("SELECT id,customer_name,customer_email,customer_phone,message,source,status,created_at,catalog_item_id FROM partner_enquiries WHERE advertiser_id=? ORDER BY created_at DESC LIMIT 200").bind(partner.advertiser_id).all(),
db.prepare("SELECT ps.*,pp.display_name AS package_name,pp.benefits_json,pp.monthly_price_minor AS package_price_minor,pp.advertising_weight FROM partner_subscriptions ps LEFT JOIN partner_packages pp ON pp.package_key=ps.package_key WHERE ps.advertiser_id=? ORDER BY ps.created_at DESC LIMIT 1").bind(partner.advertiser_id).first(),
db.prepare("SELECT id,slug,title,description,media_url,media_type,video_provider,destination_type,destination_url,status,placement,weight,start_date,end_date,rejection_reason,created_at,updated_at FROM ads WHERE advertiser_id=? ORDER BY created_at DESC LIMIT 100").bind(partner.advertiser_id).all(),
db.prepare("SELECT COUNT(*) AS total FROM ad_impressions WHERE ad_id IN (SELECT id FROM ads WHERE advertiser_id=?)").bind(partner.advertiser_id).first(),
db.prepare("SELECT COUNT(*) AS total FROM ad_clicks WHERE ad_id IN (SELECT id FROM ads WHERE advertiser_id=?)").bind(partner.advertiser_id).first()
]);return {partner,items:items.results||[],posts:posts.results||[],enquiries:enquiries.results||[],subscription,packages:(await db.prepare("SELECT package_key,display_name,monthly_price_minor,currency,benefits_json,sort_order,advertising_weight FROM partner_packages WHERE active=1 ORDER BY sort_order").all()).results||[],ads:ads.results||[],campaignStats:{impressions:Number(impressions?.total||0),clicks:Number(clicks?.total||0)}};}
function cleanText(v,max=2000){return String(v??"").trim().slice(0,max);}
async function handleAction(request,env,partner,body){
const db=env.DB,now=new Date().toISOString(),action=String(body.action||"");
if(action==="workspace")return json({ok:true,...await workspace(db,partner)});
if(action==="profile.save"){
const business=cleanText(body.business_name,100),owner=cleanText(body.owner_name,100),phone=cleanText(body.phone,40),tagline=cleanText(body.tagline,180),about=cleanText(body.about,1200),contactPhone=cleanText(body.contact_phone,40),whatsapp=cleanText(body.contact_whatsapp,40),contactEmail=cleanText(body.contact_email,254).toLowerCase(),logo=cleanText(body.logo_url,1000);
if(!business||!owner||phone.replace(/\D/g,"").length<9)return fail("Enter your business name, owner name and a valid phone number.");
const emailParts=contactEmail.split("@");if(contactEmail&&(emailParts.length!==2||!emailParts[0]||!emailParts[1].includes(".")||emailParts[1].startsWith(".")||emailParts[1].endsWith(".")))return fail("Enter a valid public contact email.");
await db.prepare("UPDATE advertisers SET business_name=?,owner_name=?,phone=?,logo_url=? WHERE id=?").bind(business,owner,phone,logo,partner.advertiser_id).run();
await db.prepare("UPDATE advertiser_profiles SET tagline=?,about=?,contact_phone=?,contact_whatsapp=?,contact_email=? WHERE advertiser_id=?").bind(tagline,about,contactPhone||phone,whatsapp||contactPhone||phone,contactEmail,partner.advertiser_id).run();
return json({ok:true,message:"Business profile updated."});
}
if(action==="site.publish"){
const ready=await db.prepare("SELECT site_title,hero_title FROM partner_site_settings WHERE advertiser_id=? LIMIT 1").bind(partner.advertiser_id).first();
if(!ready||!String(ready.site_title||"").trim()||!String(ready.hero_title||"").trim())return fail("Add your website title and hero headline before publishing.");
await db.prepare("UPDATE partner_site_settings SET published=1,updated_at=? WHERE advertiser_id=?").bind(now,partner.advertiser_id).run();
return json({ok:true,message:"Your business website is published."});
}
if(action==="site.unpublish"){
await db.prepare("UPDATE partner_site_settings SET published=0,updated_at=? WHERE advertiser_id=?").bind(now,partner.advertiser_id).run();
return json({ok:true,message:"Your business website is now private."});
}
if(action==="site.save"){
const fields={site_title:cleanText(body.site_title,100),site_description:cleanText(body.site_description,500),hero_title:cleanText(body.hero_title,140),hero_subtitle:cleanText(body.hero_subtitle,300),hero_image_url:cleanText(body.hero_image_url,1000),logo_url:cleanText(body.logo_url,1000),primary_color:/^#[0-9a-f]{6}$/i.test(body.primary_color||"")?body.primary_color:"#ff6000",accent_color:/^#[0-9a-f]{6}$/i.test(body.accent_color||"")?body.accent_color:"#173f73",font_pair:["modern","editorial","classic"].includes(body.font_pair)?body.font_pair:"modern",template_key:["signature","storefront","studio","hospitality","professional"].includes(body.template_key)?body.template_key:"signature",seo_title:cleanText(body.seo_title,120),seo_description:cleanText(body.seo_description,300),social_links_json:JSON.stringify(body.social_links&&typeof body.social_links==="object"?body.social_links:{})};
await db.prepare(`UPDATE partner_site_settings SET site_title=?,site_description=?,hero_title=?,hero_subtitle=?,hero_image_url=?,logo_url=?,primary_color=?,accent_color=?,font_pair=?,template_key=?,seo_title=?,seo_description=?,social_links_json=?,updated_at=? WHERE advertiser_id=?`).bind(fields.site_title,fields.site_description,fields.hero_title,fields.hero_subtitle,fields.hero_image_url,fields.logo_url,fields.primary_color,fields.accent_color,fields.font_pair,fields.template_key,fields.seo_title,fields.seo_description,fields.social_links_json,now,partner.advertiser_id).run();
await db.prepare("UPDATE advertiser_profiles SET primary_color=?,accent_color=?,cover_image_url=?,social_links_json=?,tagline=?,about=?,updated_at=? WHERE advertiser_id=?").bind(fields.primary_color,fields.accent_color,fields.hero_image_url,fields.social_links_json,fields.hero_subtitle,fields.site_description,now,partner.advertiser_id).run();
return json({ok:true,message:"Website settings saved."});
}
if(action==="campaign.save"){
const id=UUID.test(String(body.id||""))?body.id:crypto.randomUUID();
const title=cleanText(body.title,120),description=cleanText(body.description,1000),mediaUrl=cleanText(body.media_url,1000),destinationUrl=cleanText(body.destination_url,1000);
if(!title)return fail("Add a campaign title.");
if(!destinationUrl)return fail("Add the destination customers should visit.");
const mediaType=body.media_type==="video"?"video":"image";
const destinationType=["website","whatsapp","facebook","instagram","tiktok","youtube"].includes(body.destination_type)?body.destination_type:"website";
const placement=["carousel","popup","both"].includes(body.placement)?body.placement:"carousel";
const validUrl=value=>{try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)}catch{return false}};
if(!validUrl(destinationUrl))return fail("Enter a valid destination URL.");
if(mediaUrl&&!validUrl(mediaUrl))return fail("Enter a valid image or video URL.");
if(mediaType==="video"&&!mediaUrl)return fail("Add a video URL.");
const start=body.start_date?new Date(body.start_date).toISOString():now;
const end=body.end_date?(String(body.end_date).length===10?new Date(body.end_date+"T23:59:59.999Z").toISOString():new Date(body.end_date).toISOString()):null;
if(end&&Date.parse(end)<=Date.parse(start))return fail("Campaign end date must be after its start date.");
let slug;
if(body.id&&UUID.test(String(body.id))){const existing=await db.prepare("SELECT id,slug,status FROM ads WHERE id=? AND advertiser_id=?").bind(id,partner.advertiser_id).first();if(!existing)return fail("Campaign not found.",404);slug=existing.slug;}
else{slug=slugify(title);for(let n=0;n<8;n++){const exists=await db.prepare("SELECT id FROM ads WHERE slug=? COLLATE NOCASE").bind(slug).first();if(!exists)break;slug=slugify(title)+"-"+crypto.randomUUID().slice(0,5).toLowerCase();}}
const existing=body.id?await db.prepare("SELECT status FROM ads WHERE id=? AND advertiser_id=?").bind(id,partner.advertiser_id).first():null;
if(existing?.status==="banned")return fail("This campaign has been removed by PhoneYa2 moderation. Contact support if you believe this is an error.",403);
const status=existing&&existing.status==="approved"?"pending":(existing?existing.status:"pending");
const tier=await db.prepare("SELECT a.tier,t.rotation_weight,t.ad_limit,(SELECT ps.package_key FROM partner_subscriptions ps WHERE ps.advertiser_id=a.id AND ps.status='active' ORDER BY ps.created_at DESC LIMIT 1) AS package_key,(SELECT pp.advertising_weight FROM partner_subscriptions ps JOIN partner_packages pp ON pp.package_key=ps.package_key WHERE ps.advertiser_id=a.id AND ps.status='active' ORDER BY ps.created_at DESC LIMIT 1) AS package_weight FROM advertisers a LEFT JOIN ad_tiers t ON t.tier=a.tier WHERE a.id=?").bind(partner.advertiser_id).first();
const packageKey=tier?.package_key||"free",limit=Number(tier?.ad_limit||3);
if(!existing){const active=await db.prepare("SELECT COUNT(*) AS n FROM ads WHERE advertiser_id=? AND status IN ('pending','approved')").bind(partner.advertiser_id).first();if(Number(active?.n||0)>=limit)return fail("Your current package allows "+limit+" active campaigns. Pause or remove an existing campaign, or contact PhoneYa2 to upgrade.");}
const weight=Number(tier?.package_weight||tier?.rotation_weight||1);
await db.prepare(`INSERT INTO ads(id,advertiser_id,slug,title,description,media_url,media_type,video_provider,destination_type,destination_url,status,placement,weight,start_date,end_date,updated_at)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,media_url=excluded.media_url,media_type=excluded.media_type,video_provider=excluded.video_provider,destination_type=excluded.destination_type,destination_url=excluded.destination_url,status=excluded.status,placement=excluded.placement,weight=excluded.weight,start_date=excluded.start_date,end_date=excluded.end_date,updated_at=excluded.updated_at
WHERE ads.advertiser_id=excluded.advertiser_id`).bind(id,partner.advertiser_id,slug,title,description,mediaUrl,mediaType,cleanText(body.video_provider,30),destinationType,destinationUrl,status,placement,weight,start,end,now).run();
return json({ok:true,id,status,message:status==="pending"?"Campaign submitted for review.":"Campaign saved."});
}
if(action==="campaign.pause"||action==="campaign.resume"){
const id=String(body.id||"");if(!UUID.test(id))return fail("Invalid campaign.");
const row=await db.prepare("SELECT status FROM ads WHERE id=? AND advertiser_id=?").bind(id,partner.advertiser_id).first();if(!row)return fail("Campaign not found.",404);if(row.status==="banned")return fail("This campaign has been removed by PhoneYa2 moderation.",403);
if(action==="campaign.pause"){await db.prepare("UPDATE ads SET status='paused',updated_at=? WHERE id=? AND advertiser_id=?").bind(now,id,partner.advertiser_id).run();}
else{await db.prepare("UPDATE ads SET status='pending',rejection_reason='',updated_at=? WHERE id=? AND advertiser_id=?").bind(now,id,partner.advertiser_id).run();}
return json({ok:true,message:action==="campaign.pause"?"Campaign paused. It will no longer be shown.":"Campaign resubmitted for review."});
}
if(action==="campaign.delete"){
const id=String(body.id||"");if(!UUID.test(id))return fail("Invalid campaign.");
await db.prepare("DELETE FROM ads WHERE id=? AND advertiser_id=? AND status IN ('pending','rejected','paused')").bind(id,partner.advertiser_id).run();
return json({ok:true});
}
if(action==="catalog.save"){
const id=UUID.test(String(body.id||""))?body.id:crypto.randomUUID();const type=body.item_type==="service"?"service":"product";const title=cleanText(body.title,120);if(!title)return fail("Add a product or service name.");const slug=slugify(body.slug||title);const price=body.price_minor===null||body.price_minor===""?null:Number(body.price_minor);if(price!==null&&(!Number.isSafeInteger(price)||price<0))return fail("Enter a valid price in ngwee.");const availability=["available","out_of_stock","limited","on_request"].includes(body.availability)?body.availability:"available";
try{await db.prepare(`INSERT INTO partner_catalog_items(id,advertiser_id,item_type,title,slug,summary,description,price_minor,price_label,image_url,gallery_json,category,sku,availability,featured,published,sort_order,updated_at)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET item_type=excluded.item_type,title=excluded.title,slug=excluded.slug,summary=excluded.summary,description=excluded.description,price_minor=excluded.price_minor,price_label=excluded.price_label,image_url=excluded.image_url,gallery_json=excluded.gallery_json,category=excluded.category,sku=excluded.sku,availability=excluded.availability,featured=excluded.featured,published=excluded.published,sort_order=excluded.sort_order,updated_at=excluded.updated_at
WHERE partner_catalog_items.advertiser_id=excluded.advertiser_id`).bind(id,partner.advertiser_id,type,title,slug,cleanText(body.summary,240),cleanText(body.description,5000),price,cleanText(body.price_label,80),cleanText(body.image_url,1000),JSON.stringify(Array.isArray(body.gallery)?body.gallery.slice(0,12):[]),cleanText(body.category,80),cleanText(body.sku,80),availability,body.featured?1:0,body.published===false?0:1,Number.isInteger(body.sort_order)?body.sort_order:0,now).run();}catch(e){return fail("Could not save this item. Check that its website URL is unique.",409);}return json({ok:true,id});
}
if(action==="catalog.delete"){if(!UUID.test(String(body.id||"")))return fail("Invalid item.");await db.prepare("DELETE FROM partner_catalog_items WHERE id=? AND advertiser_id=?").bind(body.id,partner.advertiser_id).run();return json({ok:true});}
if(action==="post.save"){
const id=UUID.test(String(body.id||""))?body.id:crypto.randomUUID();const title=cleanText(body.title,160);if(!title)return fail("Add a post title.");const slug=slugify(body.slug||title);const status=body.status==="published"?"published":"draft";await db.prepare(`INSERT INTO partner_posts(id,advertiser_id,title,slug,excerpt,body,cover_image_url,post_type,status,published_at,updated_at)
VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,slug=excluded.slug,excerpt=excluded.excerpt,body=excluded.body,cover_image_url=excluded.cover_image_url,post_type=excluded.post_type,status=excluded.status,published_at=excluded.published_at,updated_at=excluded.updated_at
WHERE partner_posts.advertiser_id=excluded.advertiser_id`).bind(id,partner.advertiser_id,title,slug,cleanText(body.excerpt,300),cleanText(body.body,20000),cleanText(body.cover_image_url,1000),cleanText(body.post_type,40)||"update",status,status==="published"?now:null,now).run();return json({ok:true,id});
}
if(action==="post.delete"){if(!UUID.test(String(body.id||"")))return fail("Invalid post.");await db.prepare("DELETE FROM partner_posts WHERE id=? AND advertiser_id=?").bind(body.id,partner.advertiser_id).run();return json({ok:true});}
if(action==="enquiry.status"){if(!UUID.test(String(body.id||""))||!["new","contacted","qualified","won","closed"].includes(body.status))return fail("Invalid enquiry update.");await db.prepare("UPDATE partner_enquiries SET status=?,updated_at=? WHERE id=? AND advertiser_id=?").bind(body.status,now,body.id,partner.advertiser_id).run();return json({ok:true});}
return fail("Unknown partner action.",404);
}
export async function onRequest({request,env}){
if(!env.DB)return fail("PhoneYa2 D1 is not configured.",503);
if(!sameOrigin(request))return fail("Cross-origin request blocked.",403);
if(request.method==="GET"){
const partner=await currentPartner(request,env);if(!partner)return json({ok:false,authenticated:false},401);
return json({ok:true,authenticated:true,...await workspace(env.DB,partner)});
}
if(request.method!=="POST")return fail("Method not allowed.",405);
if((request.headers.get("content-type")||"").includes("multipart/form-data")){
const partner=await currentPartner(request,env);if(!partner)return fail("Please sign in to your partner account.",401);
try{
const form=await request.formData(),file=form.get("file");
if(!file||typeof file.arrayBuffer!=="function")return fail("Choose an image to upload.");
if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type))return fail("Upload a JPG, PNG, WEBP or GIF image.");

const bytes=new Uint8Array(await file.arrayBuffer());let binary="";
for(let offset=0;offset<bytes.length;offset+=0x8000)binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
const encoded="data:"+file.type+";base64,"+btoa(binary),id=crypto.randomUUID(),storageKey=id+"|"+encoded,url=new URL("/media/partner/"+id,request.url).href;
// object_key is UNIQUE: prefix the payload with this upload UUID so identical image files can be uploaded more than once.
await env.DB.prepare("INSERT INTO partner_media_assets(id,advertiser_id,object_key,public_url,media_type,file_name,file_size) VALUES(?,?,?,?,?,?,?)").bind(id,partner.advertiser_id,storageKey,url,"image",cleanText(file.name,180),file.size).run();
return json({ok:true,url,id});
}catch(e){console.error("Partner media upload failed",e?.stack||e);const detail=String(e?.message||"Storage operation failed").slice(0,220);return fail("The image reached PhoneYa2, but storage failed: "+detail,500);}
}
let body={};try{body=await request.json();}catch{return fail("Invalid JSON request.");}
const action=String(body.action||"");
if(action==="signup"){
let stage="database preflight";
try{
const requiredTables=["advertiser_accounts","advertisers","advertiser_profiles","partner_site_settings","partner_subscriptions","partner_sessions","partner_auth_attempts"];
const tableRows=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ("+requiredTables.map(()=>"?").join(",")+")").bind(...requiredTables).all();
const present=new Set((tableRows.results||[]).map(row=>row.name));
const missing=requiredTables.filter(name=>!present.has(name));
if(missing.length)return fail("PhoneYa2 Partner Network setup is incomplete. Missing tables: "+missing.join(", ")+". Apply the existing migrations before retrying.",503);
stage="signup rate limit";
if(!await rateLimit(request,env))return fail("Too many attempts. Wait 15 minutes before trying again.",429);
stage="input validation";
const email=cleanText(body.email,254).toLowerCase(),password=String(body.password||""),business=cleanText(body.business_name,100),owner=cleanText(body.owner_name,100),phone=cleanText(body.phone,40);
const emailParts=email.split("@");if(emailParts.length!==2||!emailParts[0]||!emailParts[1]||!emailParts[1].includes(".")||emailParts[1].startsWith(".")||emailParts[1].endsWith("."))return fail("Enter a valid email address.");
if(password.length<10||password.length>128)return fail("Use a password between 10 and 128 characters.");
if(!business||phone.replace(/\D/g,"").length<9)return fail("Business name and a valid phone number are required.");
stage="checking account email";
const existing=await env.DB.prepare("SELECT id FROM advertiser_accounts WHERE email=? COLLATE NOCASE").bind(email).first();
if(existing)return fail("An account with this email already exists. Sign in instead.",409);
stage="creating business address";
const accountId=crypto.randomUUID(),advertiserId=crypto.randomUUID(),profileId=crypto.randomUUID(),siteId=crypto.randomUUID(),subscriptionId=crypto.randomUUID();
const slug=await uniqueSlug(env.DB,business);
stage="securing password";
const pass=await newPasswordRecord(password);
const stamp=new Date().toISOString();
stage="saving partner account and workspace";
await env.DB.batch([
env.DB.prepare("INSERT INTO advertiser_accounts(id,email,password_hash,status) VALUES(?,?,?,'active')").bind(accountId,email,JSON.stringify({scheme:"pbkdf2-sha256",iterations:PBKDF2_ITERATIONS,salt:pass.salt,hash:pass.hash})),
env.DB.prepare("INSERT INTO advertisers(id,account_id,business_name,owner_name,phone,email,tier,status) VALUES(?,?,?,?,?,?,'free','active')").bind(advertiserId,accountId,business,owner,phone,email),
env.DB.prepare("INSERT INTO advertiser_profiles(id,advertiser_id,slug,contact_phone,contact_whatsapp,contact_email) VALUES(?,?,?,?,?,?)").bind(profileId,advertiserId,slug,phone,phone,email),
env.DB.prepare("INSERT INTO partner_site_settings(id,advertiser_id,site_title,site_description,hero_title,hero_subtitle,published) VALUES(?,?,?,?,?,?,?)").bind(siteId,advertiserId,business,"Welcome to "+business,business,"Discover what we offer",0),
env.DB.prepare("INSERT INTO partner_subscriptions(id,advertiser_id,package_key,status,amount_minor,currency,billing_cycle,starts_at,current_period_start,current_period_end) VALUES(?,?,'free','active',0,'ZMW','monthly',?,?,?)").bind(subscriptionId,advertiserId,stamp,stamp,new Date(Date.now()+30*86400000).toISOString())
]);
stage="creating secure sign-in session";
const token=await createSession(env.DB,accountId);
return json({ok:true,authenticated:true,slug,message:"Your workspace is ready. It remains private until account verification and public publishing are enabled."},201,{"set-cookie":sessionCookie(token)});
}catch(e){
console.error("PhoneYa2 partner signup failure at ["+stage+"]:",e?.stack||e);
return fail("Account creation failed during: "+stage+". The exact technical details have been recorded in Cloudflare logs. Please retry once the latest site update is live.",500);
}
}
if(action==="login"){
if(!await rateLimit(request,env))return fail("Too many attempts. Try again later.",429);
const email=cleanText(body.email,254).toLowerCase(),password=String(body.password||"");const account=await env.DB.prepare("SELECT * FROM advertiser_accounts WHERE email=? COLLATE NOCASE LIMIT 1").bind(email).first();
let stored={};try{stored=JSON.parse(account?.password_hash||"{}");}catch{}
const valid=!!account&&account.status==="active"&&stored.scheme==="pbkdf2-sha256"&&await verifyPassword(password,stored.salt,stored.hash);
if(!valid)return fail("Email or password is incorrect.",401);
const token=await createSession(env.DB,account.id);return json({ok:true,authenticated:true},200,{"set-cookie":sessionCookie(token)});
}
if(action==="logout"){const raw=cookieValue(request);if(raw){const hash=b64url(await digest(raw));await env.DB.prepare("UPDATE partner_sessions SET revoked_at=? WHERE token_hash=?").bind(new Date().toISOString(),hash).run();}return json({ok:true,authenticated:false},200,{"set-cookie":clearCookie()});}
const partner=await currentPartner(request,env);if(!partner)return fail("Please sign in to your partner account.",401);
return handleAction(request,env,partner,body);
}
