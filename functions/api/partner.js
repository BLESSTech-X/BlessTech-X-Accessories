const HEADERS = { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };
const COOKIE = "__Host-py2_partner";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 310000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{...HEADERS,...extra}});}
function fail(message,status=400){return json({ok:false,error:message},status);}
function b64url(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function unb64url(s){const v=String(s||"").replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(v+"=".repeat((4-v.length%4)%4)),c=>c.charCodeAt(0));}
function cookieValue(request){for(const p of (request.headers.get("cookie")||"").split(";")){const x=p.trim();if(x.startsWith(COOKIE+"="))return x.slice(COOKIE.length+1);}return "";}
function sameOrigin(request){const origin=request.headers.get("origin");if(!origin)return request.method==="GET"||request.headers.get("sec-fetch-site")==="same-origin";try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}}
async function digest(value){return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));}
async function passwordHash(password,salt){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:PBKDF2_ITERATIONS,hash:"SHA-256"},key,256);return b64url(new Uint8Array(bits));}
async function newPasswordRecord(password){const salt=crypto.getRandomValues(new Uint8Array(16));return {salt:b64url(salt),hash:await passwordHash(password,salt)};}
async function verifyPassword(password,salt,expected){try{const actual=await passwordHash(password,unb64url(salt));const a=unb64url(actual),b=unb64url(expected);if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}catch{return false;}}
async function rateLimit(request,env){const ip=request.headers.get("cf-connecting-ip")||"unknown";const hash=b64url(await digest(ip));const now=Math.floor(Date.now()/1000);await env.DB.prepare("DELETE FROM partner_auth_attempts WHERE attempted_at < ?").bind(now-3600).run();const row=await env.DB.prepare("SELECT COUNT(*) AS n FROM partner_auth_attempts WHERE ip_hash=? AND attempted_at>?").bind(hash,now-900).first();if(Number(row?.n||0)>=12)return false;await env.DB.prepare("INSERT INTO partner_auth_attempts(ip_hash,attempted_at) VALUES(?,?)").bind(hash,now).run();return true;}
function slugify(value){return String(value||"business").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"business";}
async function uniqueSlug(db,name){const base=slugify(name);let slug=base;for(let i=0;i<8;i++){const row=await db.prepare("SELECT id FROM advertiser_profiles WHERE slug=? COLLATE NOCASE").bind(slug).first();if(!row)return slug;slug=base+"-"+crypto.randomUUID().slice(0,5).toLowerCase();}throw new Error("Could not create a unique business website address.");}
function sessionCookie(token){return COOKIE+"="+token+"; Path=/; Max-Age="+(SESSION_DAYS*86400)+"; HttpOnly; Secure; SameSite=Lax";}
function clearCookie(){return COOKIE+"=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";}
async function createSession(db,accountId){const raw=b64url(crypto.getRandomValues(new Uint8Array(32)));const tokenHash=b64url(await digest(raw));const id=crypto.randomUUID();const expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();await db.prepare("INSERT INTO partner_sessions(id,account_id,token_hash,expires_at) VALUES(?,?,?,?)").bind(id,accountId,tokenHash,expires).run();return raw;}
async function currentPartner(request,env){const raw=cookieValue(request);if(!raw)return null;const tokenHash=b64url(await digest(raw));return await env.DB.prepare(`SELECT a.id AS account_id,a.email AS account_email,a.status AS account_status,
adv.id AS advertiser_id,adv.business_name,adv.owner_name,adv.phone,adv.email,adv.tier,adv.status AS advertiser_status,
p.id AS profile_id,p.slug,p.tagline,p.about,p.primary_color,p.accent_color,p.cover_image_url,p.social_links_json,p.contact_phone,p.contact_whatsapp,p.contact_email,
s.id AS site_id,s.site_title,s.site_description,s.hero_title,s.hero_subtitle,s.hero_image_url,s.logo_url,s.primary_color AS site_primary_color,s.accent_color AS site_accent_color,s.font_pair,s.template_key,s.show_catalogue,s.show_services,s.show_posts,s.published,s.seo_title,s.seo_description,s.social_links_json AS site_social_links_json
FROM partner_sessions ps JOIN advertiser_accounts a ON a.id=ps.account_id
JOIN advertisers adv ON adv.account_id=a.id LEFT JOIN advertiser_profiles p ON p.advertiser_id=adv.id
LEFT JOIN partner_site_settings s ON s.advertiser_id=adv.id
WHERE ps.token_hash=? AND ps.revoked_at IS NULL AND ps.expires_at>?
AND a.status='active' AND adv.status NOT IN ('suspended') LIMIT 1`).bind(tokenHash,new Date().toISOString()).first();}
async function workspace(db,partner){const [items,posts,enquiries,subscription]=await Promise.all([
db.prepare("SELECT * FROM partner_catalog_items WHERE advertiser_id=? ORDER BY sort_order,created_at DESC LIMIT 500").bind(partner.advertiser_id).all(),
db.prepare("SELECT * FROM partner_posts WHERE advertiser_id=? ORDER BY created_at DESC LIMIT 200").bind(partner.advertiser_id).all(),
db.prepare("SELECT id,customer_name,customer_email,customer_phone,message,source,status,created_at,catalog_item_id FROM partner_enquiries WHERE advertiser_id=? ORDER BY created_at DESC LIMIT 200").bind(partner.advertiser_id).all(),
db.prepare("SELECT * FROM partner_subscriptions WHERE advertiser_id=? ORDER BY created_at DESC LIMIT 1").bind(partner.advertiser_id).first()
]);return {partner,items:items.results||[],posts:posts.results||[],enquiries:enquiries.results||[],subscription};}
function cleanText(v,max=2000){return String(v??"").trim().slice(0,max);}
async function handleAction(request,env,partner,body){
const db=env.DB,now=new Date().toISOString(),action=String(body.action||"");
if(action==="workspace")return json({ok:true,...await workspace(db,partner)});
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
let body={};try{body=await request.json();}catch{return fail("Invalid JSON request.");}
const action=String(body.action||"");
if(action==="signup"){
if(!await rateLimit(request,env))return fail("Too many attempts. Try again later.",429);
const email=cleanText(body.email,254).toLowerCase(),password=String(body.password||""),business=cleanText(body.business_name,100),owner=cleanText(body.owner_name,100),phone=cleanText(body.phone,40);
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail("Enter a valid email address.");
if(password.length<10||password.length>128)return fail("Use a password between 10 and 128 characters.");
if(!business||phone.replace(/\D/g,"").length<9)return fail("Business name and a valid phone number are required.");
const existing=await env.DB.prepare("SELECT id FROM advertiser_accounts WHERE email=? COLLATE NOCASE").bind(email).first();if(existing)return fail("An account with this email already exists. Sign in instead.",409);
const accountId=crypto.randomUUID(),advertiserId=crypto.randomUUID(),profileId=crypto.randomUUID(),siteId=crypto.randomUUID(),subscriptionId=crypto.randomUUID();const slug=await uniqueSlug(env.DB,business);const pass=await newPasswordRecord(password);const stamp=new Date().toISOString();
try{
await env.DB.batch([
env.DB.prepare("INSERT INTO advertiser_accounts(id,email,password_hash,status) VALUES(?,?,?,'active')").bind(accountId,email,JSON.stringify({scheme:"pbkdf2-sha256",iterations:PBKDF2_ITERATIONS,salt:pass.salt,hash:pass.hash})),
env.DB.prepare("INSERT INTO advertisers(id,account_id,business_name,owner_name,phone,email,tier,status) VALUES(?,?,?,?,?,?,'free','active')").bind(advertiserId,accountId,business,owner,phone,email),
env.DB.prepare("INSERT INTO advertiser_profiles(id,advertiser_id,slug,contact_phone,contact_whatsapp,contact_email) VALUES(?,?,?,?,?,?)").bind(profileId,advertiserId,slug,phone,phone,email),
env.DB.prepare("INSERT INTO partner_site_settings(id,advertiser_id,site_title,site_description,hero_title,hero_subtitle,published) VALUES(?,?,?,?,?,?,0)").bind(siteId,advertiserId,business,"Welcome to "+business,business,"Discover what we offer",0),
env.DB.prepare("INSERT INTO partner_subscriptions(id,advertiser_id,package_key,status,amount_minor,currency,billing_cycle,starts_at,current_period_start,current_period_end) VALUES(?,?,'free','active',0,'ZMW','monthly',?,?,?)").bind(subscriptionId,advertiserId,stamp,stamp,new Date(Date.now()+30*86400000).toISOString())
]);
const token=await createSession(env.DB,accountId);return json({ok:true,authenticated:true,slug,message:"Your workspace is ready. It remains private until account verification and public publishing are enabled."},201,{"set-cookie":sessionCookie(token)});
}catch(e){return fail("We could not create the account. Check the details and try again.",409);}
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
