import { renderPartnerSite } from "../_partner-site.js";
const HEADERS = { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };
const COOKIE = "__Host-py2_partner";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(data,status=200,extra={}){const headers=new Headers(HEADERS);for(const [key,value] of Object.entries(extra)){if(key.toLowerCase()==="set-cookie"&&Array.isArray(value)){for(const cookie of value)headers.append("set-cookie",cookie);}else headers.set(key,value);}return new Response(JSON.stringify(data),{status,headers});}
function fail(message,status=400){return json({ok:false,error:message},status);}
function b64url(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function unb64url(s){const v=String(s||"").replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(v+"=".repeat((4-v.length%4)%4)),c=>c.charCodeAt(0));}
function cookieValues(request){const jar=(request.headers.get("cookie")||"").split(";").map(x=>x.trim()),values=[];for(const name of [COOKIE,"py2_partner_session"]){const item=jar.find(x=>x.startsWith(name+"="));if(item){const value=item.slice(name.length+1);if(value&&!values.includes(value))values.push(value);}}return values;}function cookieValue(request){return cookieValues(request)[0]||"";}
function sameOrigin(request){const origin=request.headers.get("origin");if(!origin)return request.method==="GET"||request.headers.get("sec-fetch-site")==="same-origin";try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}}
async function digest(value){return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));}
async function passwordHash(password,salt){if(!crypto?.subtle)throw new Error("Web Crypto is unavailable in this Worker runtime.");const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:new Uint8Array(salt),iterations:PBKDF2_ITERATIONS,hash:"SHA-256"},key,256);return b64url(new Uint8Array(bits));}
async function newPasswordRecord(password){const salt=crypto.getRandomValues(new Uint8Array(16));const hash=await passwordHash(password,salt);if(!hash||hash.length!==43)throw new Error("Password derivation returned an invalid hash.");return {salt:b64url(salt),hash};}
async function verifyPassword(password,salt,expected){try{const actual=await passwordHash(password,unb64url(salt));const a=unb64url(actual),b=unb64url(expected);if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}catch{return false;}}
async function rateLimit(request,env,scope="login"){const ip=request.headers.get("cf-connecting-ip")||"unknown";const hash=b64url(await digest(scope+":"+ip));const now=Math.floor(Date.now()/1000);await env.DB.prepare("DELETE FROM partner_auth_attempts WHERE attempted_at < ?").bind(now-3600).run();const row=await env.DB.prepare("SELECT COUNT(*) AS n FROM partner_auth_attempts WHERE ip_hash=? AND attempted_at>?").bind(hash,now-900).first();if(Number(row?.n||0)>=12)return false;await env.DB.prepare("INSERT INTO partner_auth_attempts(ip_hash,attempted_at) VALUES(?,?)").bind(hash,now).run();return true;}
function slugify(value){return String(value||"business").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"business";}
async function uniqueSlug(db,name){const base=slugify(name);let slug=base;for(let i=0;i<8;i++){const row=await db.prepare("SELECT id FROM advertiser_profiles WHERE slug=? COLLATE NOCASE").bind(slug).first();if(!row)return slug;slug=base+"-"+crypto.randomUUID().slice(0,5).toLowerCase();}throw new Error("Could not create a unique business website address.");}
function sessionCookies(token){const age=SESSION_DAYS*86400;return [COOKIE+"="+token+"; Path=/; Max-Age="+age+"; HttpOnly; Secure; SameSite=Lax","py2_partner_session="+token+"; Path=/; Max-Age="+age+"; HttpOnly; Secure; SameSite=Lax"];}
function clearCookies(){return [COOKIE+"=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax","py2_partner_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"];}
async function createSession(db,accountId){const raw=b64url(crypto.getRandomValues(new Uint8Array(32)));const tokenHash=b64url(await digest(raw));const id=crypto.randomUUID();const expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();await db.prepare("INSERT INTO partner_sessions(id,account_id,token_hash,expires_at) VALUES(?,?,?,?)").bind(id,accountId,tokenHash,expires).run();return raw;}
async function partnerSessionFailureReason(request,env){
 const tokens=cookieValues(request);
 if(!tokens.length)return "cookie_missing";
 const now=new Date().toISOString();
 for(const raw of tokens){
  const tokenHash=b64url(await digest(raw));
  const row=await env.DB.prepare(`SELECT ps.revoked_at,ps.expires_at,a.id AS account_id,a.status AS account_status,adv.id AS advertiser_id,adv.status AS advertiser_status
   FROM partner_sessions ps
   LEFT JOIN advertiser_accounts a ON a.id=ps.account_id
   LEFT JOIN advertisers adv ON adv.account_id=a.id
   WHERE ps.token_hash=? LIMIT 1`).bind(tokenHash).first();
  if(!row)continue;
  if(row.revoked_at)return "session_revoked";
  if(!row.expires_at||row.expires_at<=now)return "session_expired";
  if(!row.account_id||row.account_status!=="active")return "account_inactive";
  if(!row.advertiser_id)return "advertiser_missing";
  if(row.advertiser_status==="suspended")return "advertiser_suspended";
  return "workspace_lookup_rejected";
 }
 return "session_not_found";
}
async function currentPartner(request,env){const tokens=cookieValues(request);if(!tokens.length)return null;const lookup=env.DB.prepare(`SELECT a.id AS account_id,a.email AS account_email,a.status AS account_status,
adv.id AS advertiser_id,adv.business_name,adv.owner_name,adv.phone,adv.email,adv.logo_url,adv.tier,adv.status AS advertiser_status,
p.id AS profile_id,p.slug,p.tagline,p.about,p.primary_color,p.accent_color,p.cover_image_url,p.social_links_json,p.contact_phone,p.contact_whatsapp,p.contact_email,
s.id AS site_id,s.site_title,s.site_description,s.hero_title,s.hero_subtitle,s.hero_image_url,s.logo_url,s.primary_color AS site_primary_color,s.accent_color AS site_accent_color,s.font_pair,s.template_key,s.show_catalogue,s.show_services,s.show_posts,s.published,s.seo_title,s.seo_description,s.social_links_json AS site_social_links_json,s.custom_colors_json AS site_custom_colors_json,s.page_background,s.header_style,s.post_layout,s.post_image_fit,s.post_card_style,s.button_style,s.content_width,s.announcement_text,s.announcement_link,s.show_announcement,s.show_social_links,s.show_contact_bar,s.hero_height,s.menu_style
FROM partner_sessions ps JOIN advertiser_accounts a ON a.id=ps.account_id
JOIN advertisers adv ON adv.account_id=a.id LEFT JOIN advertiser_profiles p ON p.advertiser_id=adv.id
LEFT JOIN partner_site_settings s ON s.advertiser_id=adv.id
WHERE ps.token_hash=? AND ps.revoked_at IS NULL AND ps.expires_at>?
AND a.status='active' AND adv.status NOT IN ('suspended') LIMIT 1`);for(const raw of tokens){const partner=await lookup.bind(b64url(await digest(raw)),new Date().toISOString()).first();if(partner)return partner;}return null;}
async function expirePartnerSubscriptions(db,advertiserId){
const now=new Date().toISOString();
const due=await db.prepare("SELECT ps.id,ps.advertiser_id,ps.package_key,ps.paid_months,ps.amount_minor,ps.currency,ps.current_period_end FROM partner_subscriptions ps WHERE ps.status='active' AND ps.package_key!='free' AND ps.current_period_end IS NOT NULL AND ps.current_period_end<=? AND ps.advertiser_id=? LIMIT 50").bind(now,advertiserId).all();
for(const row of due.results||[]){
const free=await db.prepare("SELECT advertising_weight FROM partner_packages WHERE package_key='free' AND active=1").first();
await db.batch([
db.prepare("UPDATE partner_subscriptions SET status='expired',ended_at=?,updated_at=? WHERE id=? AND status='active'").bind(now,now,row.id),
db.prepare("UPDATE advertisers SET tier='free' WHERE id=?").bind(row.advertiser_id),
db.prepare("UPDATE ads SET weight=? WHERE advertiser_id=? AND status IN ('pending','approved')").bind(Number(free?.advertising_weight||1),row.advertiser_id),
db.prepare("INSERT OR IGNORE INTO partner_subscription_events(id,subscription_id,advertiser_id,event_type,package_key,paid_months,amount_minor,currency,starts_at,ends_at,note,actor,created_at) VALUES(?,?,?,'expired',?,?,?,?,?,?,?,'system',?)").bind(crypto.randomUUID(),row.id,row.advertiser_id,row.package_key,Number(row.paid_months||0),Number(row.amount_minor||0),row.currency||"ZMW",null,row.current_period_end,"Paid access ended at its subscription deadline.",now),
db.prepare("INSERT OR IGNORE INTO partner_notifications(id,advertiser_id,event_key,category,kind,title,message,priority,destination,action_label,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),row.advertiser_id,"package-expired:"+row.id,"packages","event","Your paid package has ended","Your "+row.package_key+" package ended on "+new Date(row.current_period_end).toLocaleDateString("en-GB")+". Your account is still available on the free Partner package. Renew whenever you are ready.","high","packages","Renew package",now)
]);
}
}
async function addPartnerNotification(db,advertiserId,item){
const key=String(item.event_key||"").slice(0,220);
if(!key)return;
await db.prepare("INSERT OR IGNORE INTO partner_notifications(id,advertiser_id,event_key,category,kind,title,message,priority,destination,action_label,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
.bind(crypto.randomUUID(),advertiserId,key,item.category||"guidance",item.kind||"event",String(item.title||"Update").slice(0,180),String(item.message||"").slice(0,1200),item.priority||"normal",String(item.destination||"overview").slice(0,120),String(item.action_label||"Open").slice(0,50),new Date().toISOString()).run();
}
async function syncPartnerNotifications(db,partner,items,posts,enquiries,subscription,packageRequest,ads){
const aid=partner.advertiser_id;
for(const e of enquiries.filter(x=>x.status==="new")){
await addPartnerNotification(db,aid,{event_key:"enquiry:"+e.id,category:"enquiries",kind:"event",title:"New customer enquiry",message:(e.customer_name||"A customer")+" sent a message through your business website.",priority:"high",destination:"enquiries",action_label:"Open inbox"});
}
if(packageRequest){
await addPartnerNotification(db,aid,{event_key:"package-request:"+packageRequest.id,category:"packages",kind:"event",title:"Package request received",message:"Your "+(packageRequest.package_name||"new package")+" request is awaiting PhoneYa2 payment confirmation.",priority:"normal",destination:"packages",action_label:"View request"});
}
const periodEnd=subscription?.current_period_end||subscription?.ends_at||"";
if(periodEnd){const expiry=new Date(periodEnd),days=Math.ceil((expiry.getTime()-Date.now())/86400000);for(const n of [7,3,1])if(days===n)await addPartnerNotification(db,aid,{event_key:"subscription-reminder:"+subscription.id+":"+n,category:"packages",kind:"event",title:n===1?"Your package expires tomorrow":"Your package expires in "+n+" days",message:"Your "+(subscription.package_name||subscription.package_key)+" package ends on "+expiry.toLocaleDateString("en-GB")+". Contact PhoneYa2 to renew and keep your paid features active.",priority:"high",destination:"packages",action_label:"Renew package"});}

const currentPackage=String(subscription?.package_key||"free");
const packageState=await db.prepare("SELECT state_value FROM partner_notification_state WHERE advertiser_id=? AND state_key='active-package'").bind(aid).first();
if(!packageState){
await db.prepare("INSERT OR IGNORE INTO partner_notification_state(advertiser_id,state_key,state_value) VALUES(?,'active-package',?)").bind(aid,currentPackage).run();
}else if(packageState.state_value!==currentPackage){
await addPartnerNotification(db,aid,{event_key:"package-active:"+currentPackage+":"+String(subscription?.id||""),category:"packages",kind:"event",title:"Your package is now active",message:"Your Partner Studio package is now "+(subscription?.package_name||currentPackage)+". Explore the included benefits and tools.",priority:"high",destination:"packages",action_label:"View benefits"});
await db.prepare("UPDATE partner_notification_state SET state_value=?,updated_at=? WHERE advertiser_id=? AND state_key='active-package'").bind(currentPackage,new Date().toISOString(),aid).run();
}
const baselines=[["catalogue",items.filter(x=>Number(x.published)===1).map(x=>({id:x.id,title:x.title,destination:"catalogue",category:"shop",label:"New catalogue item"}))],["posts",posts.filter(x=>x.status==="published").map(x=>({id:x.id,title:x.title,destination:"composer",category:"website",label:"New post published"}))]];
const adBaseline=await db.prepare("SELECT state_value FROM partner_notification_state WHERE advertiser_id=? AND state_key='baseline:ads'").bind(aid).first();
if(!adBaseline){
await db.batch([...ads.map(x=>db.prepare("INSERT OR IGNORE INTO partner_notification_seen(advertiser_id,entity_type,entity_id) VALUES(?,?,?)").bind(aid,"ad-status",String(x.id)+":"+String(x.status||""))),db.prepare("INSERT OR IGNORE INTO partner_notification_state(advertiser_id,state_key,state_value) VALUES(?,'baseline:ads','1')").bind(aid)]);
}else{
for(const ad of ads){
const status=String(ad.status||"");if(!["approved","rejected"].includes(status))continue;
const seen=await db.prepare("SELECT entity_id FROM partner_notification_seen WHERE advertiser_id=? AND entity_type='ad-status' AND entity_id=?").bind(aid,String(ad.id)+":"+status).first();
if(seen)continue;
await addPartnerNotification(db,aid,{event_key:"ad-status:"+ad.id+":"+status,category:"communications",kind:"event",title:status==="approved"?"Your campaign was approved":"Your campaign needs attention",message:status==="approved"?"Your PhoneYa2 campaign has been approved and can now run according to its schedule.":("Your campaign was not approved. "+String(ad.rejection_reason||"Open your campaign to review the feedback and make changes.")),priority:status==="rejected"?"high":"normal",destination:"composer",action_label:"Review campaign"});
await db.prepare("INSERT OR IGNORE INTO partner_notification_seen(advertiser_id,entity_type,entity_id) VALUES(?,'ad-status',?)").bind(aid,String(ad.id)+":"+status).run();
}
}
const publishedState=await db.prepare("SELECT state_value FROM partner_notification_state WHERE advertiser_id=? AND state_key='website-published'").bind(aid).first();
const published=partner.published?"1":"0";
if(!publishedState)await db.prepare("INSERT OR IGNORE INTO partner_notification_state(advertiser_id,state_key,state_value) VALUES(?,'website-published',?)").bind(aid,published).run();
else if(publishedState.state_value!=="1"&&published==="1"){
await addPartnerNotification(db,aid,{event_key:"website-published:"+new Date().toISOString().slice(0,10),category:"website",kind:"event",title:"Your business website is live",message:"Your public business website is now published. Share its link with customers and keep your catalogue and contact details up to date.",priority:"high",destination:"website",action_label:"View website"});
await db.prepare("UPDATE partner_notification_state SET state_value='1',updated_at=? WHERE advertiser_id=? AND state_key='website-published'").bind(new Date().toISOString(),aid).run();
}else if(publishedState.state_value!==published){
await db.prepare("UPDATE partner_notification_state SET state_value=?,updated_at=? WHERE advertiser_id=? AND state_key='website-published'").bind(published,new Date().toISOString(),aid).run();
}
for(const [type,records] of baselines){
const stateKey="baseline:"+type;
const baseline=await db.prepare("SELECT state_value FROM partner_notification_state WHERE advertiser_id=? AND state_key=?").bind(aid,stateKey).first();
if(!baseline){
await db.batch([
...records.map(x=>db.prepare("INSERT OR IGNORE INTO partner_notification_seen(advertiser_id,entity_type,entity_id) VALUES(?,?,?)").bind(aid,type,String(x.id))),
db.prepare("INSERT OR IGNORE INTO partner_notification_state(advertiser_id,state_key,state_value) VALUES(?,?, '1')").bind(aid,stateKey)
]);
continue;
}
for(const x of records){
const seen=await db.prepare("SELECT entity_id FROM partner_notification_seen WHERE advertiser_id=? AND entity_type=? AND entity_id=?").bind(aid,type,String(x.id)).first();
if(seen)continue;
await addPartnerNotification(db,aid,{event_key:type+":"+x.id,category:x.category,kind:"event",title:x.label,message:(x.title||"Your content")+" is now available in your Partner Studio.",priority:"normal",destination:x.destination,action_label:type==="catalogue"?"View shop":"View post"});
await db.prepare("INSERT OR IGNORE INTO partner_notification_seen(advertiser_id,entity_type,entity_id) VALUES(?,?,?)").bind(aid,type,String(x.id)).run();
}
}
const profileReady=!!(String(partner.business_name||"").trim()&&String(partner.owner_name||"").trim()&&String(partner.phone||"").trim()&&String(partner.tagline||"").trim()&&String(partner.about||"").trim());
const siteReady=!!(String(partner.site_title||"").trim()&&String(partner.hero_title||"").trim());
const guidance=[
{key:"guide-profile",show:!profileReady,title:"Complete your business profile",message:"Add a clear business description, tagline and contact details to help customers understand and trust your business.",destination:"profile",action:"Complete profile"},
{key:"guide-website",show:!partner.published&&siteReady,title:"Your website is ready to publish",message:"Your website has its title and headline. Review the preview, then publish it when you're ready.",destination:"website",action:"Review website"},
{key:"guide-product",show:items.filter(x=>Number(x.published)===1).length===0,title:"Add your first product or service",message:"Build your online catalogue so visitors can discover what you sell. Add a clear photo, useful description and price.",destination:"catalogue",action:"Add a product"},
{key:"guide-post",show:posts.length===0,title:"Create your first business post",message:"Share an update, offer or event to give visitors a reason to return to your website.",destination:"composer",action:"Create a post"},
{key:"guide-product-photo",show:items.some(x=>Number(x.published)===1&&!String(x.image_url||"").trim()),title:"Improve your catalogue photos",message:"Some catalogue items do not have a product image yet. Clear, well-lit photos help customers understand what you offer.",destination:"catalogue",action:"Add product photos"},
{key:"guide-draft-post",show:posts.some(x=>x.status==="draft"),title:"Finish and publish your draft",message:"You have a saved draft. Review its text and image, then publish it when it is ready for visitors.",destination:"composer",action:"Review draft"},
{key:"guide-enquiries",show:enquiries.length>0&&enquiries.every(x=>x.status!=="new"),title:"Keep your customer leads moving",message:"Update enquiry statuses as you follow up. This helps you keep track of every potential customer.",destination:"enquiries",action:"Open inbox"},
{key:"guide-upgrade",show:currentPackage==="free"&&items.filter(x=>Number(x.published)===1).length>=3&&posts.some(x=>x.status==="published")&&(!!partner.published),title:"Explore a package upgrade",message:"Your business website and catalogue are active. Compare paid packages to see whether higher campaign priority, richer design options and expanded reporting fit your next growth stage.",destination:"packages",action:"Compare packages"}
];
for(const g of guidance)if(g.show)await addPartnerNotification(db,aid,{event_key:g.key,category:"guidance",kind:"guidance",title:g.title,message:g.message,priority:"low",destination:g.destination,action_label:g.action});
}
async function workspace(db,partner){const [items,posts,enquiries,subscription,packageRequest,ads,impressions,clicks]=await Promise.all([
db.prepare("SELECT * FROM partner_catalog_items WHERE advertiser_id=? ORDER BY sort_order,created_at DESC LIMIT 500").bind(partner.advertiser_id).all(),
db.prepare("SELECT * FROM partner_posts WHERE advertiser_id=? ORDER BY created_at DESC LIMIT 1000").bind(partner.advertiser_id).all(),
db.prepare("SELECT e.id,e.customer_name,e.customer_email,e.customer_phone,e.message,e.source,e.status,e.created_at,e.catalog_item_id,COALESCE(NULLIF(e.catalog_item_title,''),ci.title) AS item_title,COALESCE(NULLIF(e.catalog_item_image_url,''),ci.image_url) AS item_image_url,COALESCE(NULLIF(e.catalog_item_price_label,''),ci.price_label) AS item_price_label,COALESCE(NULLIF(e.catalog_item_type,''),ci.item_type) AS item_type FROM partner_enquiries e LEFT JOIN partner_catalog_items ci ON ci.id=e.catalog_item_id WHERE e.advertiser_id=? ORDER BY e.created_at DESC LIMIT 200").bind(partner.advertiser_id).all(),
db.prepare("SELECT ps.*,pp.display_name AS package_name,pp.benefits_json,pp.monthly_price_minor AS package_price_minor,pp.advertising_weight FROM partner_subscriptions ps LEFT JOIN partner_packages pp ON pp.package_key=ps.package_key WHERE ps.advertiser_id=? AND ps.status='active' ORDER BY ps.created_at DESC LIMIT 1").bind(partner.advertiser_id).first(),
db.prepare("SELECT ps.*,pp.display_name AS package_name,pp.monthly_price_minor AS package_price_minor FROM partner_subscriptions ps LEFT JOIN partner_packages pp ON pp.package_key=ps.package_key WHERE ps.advertiser_id=? AND ps.status='pending_payment' ORDER BY ps.created_at DESC LIMIT 1").bind(partner.advertiser_id).first(),
db.prepare("SELECT id,slug,title,description,media_url,media_type,video_provider,destination_type,destination_url,status,placement,weight,start_date,end_date,rejection_reason,created_at,updated_at FROM ads WHERE advertiser_id=? ORDER BY created_at DESC LIMIT 100").bind(partner.advertiser_id).all(),
db.prepare("SELECT COUNT(*) AS total FROM ad_impressions WHERE ad_id IN (SELECT id FROM ads WHERE advertiser_id=?)").bind(partner.advertiser_id).first(),
db.prepare("SELECT COUNT(*) AS total FROM ad_clicks WHERE ad_id IN (SELECT id FROM ads WHERE advertiser_id=?)").bind(partner.advertiser_id).first(),
]);const itemRows=items.results||[],postRows=posts.results||[],enquiryRows=enquiries.results||[],adRows=ads.results||[];let postAnalytics=[];try{const result=await db.prepare("SELECT post_id,COUNT(CASE WHEN event_type='view' THEN 1 END) AS views,COUNT(CASE WHEN event_type='cta_click' THEN 1 END) AS cta_clicks,COUNT(CASE WHEN event_type='share_click' THEN 1 END) AS shares,COUNT(CASE WHEN event_type='message_click' THEN 1 END) AS message_clicks,MAX(created_at) AS last_activity FROM partner_post_events WHERE advertiser_id=? GROUP BY post_id").bind(partner.advertiser_id).all();postAnalytics=result.results||[];}catch(error){console.warn("Per-post analytics are awaiting migration 0020:",error?.message||error);}const postMetricMap=new Map(postAnalytics.map(x=>[x.post_id,x]));for(const post of postRows){const metric=postMetricMap.get(post.id)||{};post.analytics={views:Number(metric.views||0),cta_clicks:Number(metric.cta_clicks||0),shares:Number(metric.shares||0),message_clicks:Number(metric.message_clicks||0)};}let socialLinkRows=[];try{const socialLinks=await db.prepare("SELECT id,platform,url,title,caption,created_at FROM partner_social_embeds WHERE advertiser_id=? ORDER BY created_at DESC LIMIT 100").bind(partner.advertiser_id).all();socialLinkRows=socialLinks.results||[];}catch(error){console.warn("Partner social embeds are not available until migration 0019 is applied.");}let notificationRows=[],notificationUnread=0;
try{for(const enquiry of enquiryRows.filter(x=>x.status==="new")){await addPartnerNotification(db,partner.advertiser_id,{event_key:"enquiry:"+enquiry.id,category:"enquiries",kind:"event",title:"New customer enquiry",message:(enquiry.customer_name||"A customer")+" sent a message through your business website.",priority:"high",destination:"enquiries",action_label:"Open inbox"});}}catch(error){console.error("Partner enquiry notification sync failed:",error?.stack||error);}
try{await syncPartnerNotifications(db,partner,itemRows,postRows,enquiryRows,subscription,packageRequest,adRows);}catch(error){console.error("Partner notification event sync failed; existing notifications will still load:",error?.stack||error);}try{const notifications=await db.prepare("SELECT id,event_key,category,kind,title,message,priority,destination,action_label,created_at,is_read,read_at,dismissed_at,completed_at FROM partner_notifications WHERE advertiser_id=? AND dismissed_at IS NULL ORDER BY is_read ASC,created_at DESC").bind(partner.advertiser_id).all();const notificationCounts=await db.prepare("SELECT COUNT(*) AS unread FROM partner_notifications WHERE advertiser_id=? AND is_read=0 AND dismissed_at IS NULL").bind(partner.advertiser_id).first();notificationRows=notifications.results||[];notificationUnread=Number(notificationCounts?.unread||0);}catch(error){console.error("Partner notification read failed; core workspace will continue:",error?.stack||error);}const packages=(await db.prepare("SELECT package_key,display_name,monthly_price_minor,currency,benefits_json,sort_order,advertising_weight FROM partner_packages WHERE active=1 ORDER BY sort_order").all()).results||[];return {partner,items:itemRows,posts:postRows,enquiries:enquiryRows,socialLinks:socialLinkRows,subscription,packageRequest,packages,ads:adRows,notifications:notificationRows,notificationUnread,campaignStats:{impressions:Number(impressions?.total||0),clicks:Number(clicks?.total||0)}};}
function cleanText(v,max=2000){return String(v??"").trim().slice(0,max);}

function builderSafeUrl(value,kind="href"){
 const raw=String(value||"").trim();if(!raw)return "";
 if(kind==="href"&&/^(#|mailto:|tel:)/i.test(raw))return raw;
 if(/^\/media\/partner\/[a-zA-Z0-9_./-]+$/.test(raw))return raw;
 if(/^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/i.test(raw)&&kind!=="href")return raw;
 try{const u=new URL(raw);return ["https:","http:"].includes(u.protocol)&&!u.username&&!u.password?u.href:""}catch{return ""}
}
function builderEscapeAttr(value){return String(value).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function sanitizeBuilderHtml(input){
 let html=String(input||"").slice(0,700000).replace(/<!--[\s\S]*?-->/g,"");
 html=html.replace(/<(script|style|iframe|object|embed|form|input|textarea|select|option|meta|link|base|template|math|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,"").replace(/<(script|style|iframe|object|embed|form|input|textarea|select|option|meta|link|base|template|math|noscript)\b[^>]*\/?\s*>/gi,"");
 const allowed=new Set("main section div article header footer nav aside figure figcaption picture source img video svg path circle rect line polyline polygon h1 h2 h3 h4 h5 h6 p span b strong em i small blockquote ul ol li a button br hr".split(" "));
 const attrs=new Set("class id title alt role href src poster target rel width height loading decoding style colspan viewbox d cx cy r x y rx ry fill stroke stroke-width stroke-linecap stroke-linejoin".split(" "));
 return html.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g,(tag,name,raw)=>{
  const t=name.toLowerCase();if(!allowed.has(t))return "";
  const closing=tag.startsWith("</");if(closing)return ["img","source","br","hr"].includes(t)?"":"</"+t+">";
  const out=[];
  raw.replace(/([a-zA-Z_:][a-zA-Z0-9:_.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,(_,key,a,b,c)=>{
   const k=key.toLowerCase(),v=a??b??c??"";
   if(k.startsWith("on")||k==="srcdoc"||k==="formaction"||k==="xmlns")return;
   if(attrs.has(k)){
    if(["href","src","poster"].includes(k)){const safe=builderSafeUrl(v,k==="href"?"href":"src");if(safe)out.push(k+'="'+builderEscapeAttr(safe)+'"');return;}
    if(k==="target"){if(v==="_blank")out.push('target="_blank"');return;}
    if(k==="rel"){out.push('rel="noopener noreferrer"');return;}
    if(k==="style"){let s=v.replace(/url\s*\([^)]*\)/gi,"").replace(/expression\s*\([^)]*\)/gi,"").replace(/@import|behavior\s*:|-moz-binding|javascript\s*:/gi,"").replace(/[<>\\]/g,"");if(s.length<3000)out.push('style="'+builderEscapeAttr(s)+'"');return;}
    out.push(k+'="'+builderEscapeAttr(v.slice(0,1000))+'"');return;
   }
   if(/^aria-[a-z-]+$/.test(k)||/^data-(?:phoneya2-component|message-business|business-name|message-source|message-item-title|message-item-image|message-item-price)$/.test(k))out.push(k+'="'+builderEscapeAttr(v.slice(0,1000))+'"');
  });
  if(t==="a"&&out.some(x=>x.startsWith('target="_blank"'))&&!out.some(x=>x.startsWith("rel=")))out.push('rel="noopener noreferrer"');
  return "<"+t+(out.length?" "+out.join(" "):"")+(["img","source","br","hr"].includes(t)?" />":">");
 });
}
function sanitizeBuilderCss(input){
 let css=String(input||"").slice(0,350000).replace(/\/\*[\s\S]*?\*\//g,"");
 css=css.replace(/@import[^;]*;?/gi,"").replace(/@(?:font-face|supports|keyframes)[^{]*\{[^{}]*\}/gi,"");
 css=css.replace(/url\s*\(([^)]*)\)/gi,(_,raw)=>{const u=builderSafeUrl(String(raw).trim().replace(/^['"]|['"]$/g,""),"src");return u?'url("'+u.replace(/["\\]/g,"")+'")':"none";});
 return css.replace(/expression\s*\([^)]*\)|behavior\s*:|-moz-binding|javascript\s*:/gi,"").replace(/[<>]/g,"");
}

async function handleAction(request,env,partner,body){
const db=env.DB,now=new Date().toISOString(),action=String(body.action||"");
if(action==="package.request"){
const packageKey=cleanText(body.package_key,32);
if(!/^(starter|standard|business|premium)$/.test(packageKey))return fail("Choose a valid paid package.");
const plan=await db.prepare("SELECT package_key,display_name,monthly_price_minor,currency FROM partner_packages WHERE package_key=? AND active=1").bind(packageKey).first();
if(!plan)return fail("This package is not currently available.");
const pending=await db.prepare("SELECT id FROM partner_subscriptions WHERE advertiser_id=? AND status='pending_payment' LIMIT 1").bind(partner.advertiser_id).first();
if(pending)return fail("You already have a package request awaiting PhoneYa2 follow-up. We will contact you shortly.");
const active=await db.prepare("SELECT package_key FROM partner_subscriptions WHERE advertiser_id=? AND status='active' ORDER BY created_at DESC LIMIT 1").bind(partner.advertiser_id).first();
if(active?.package_key===packageKey)return fail("This package is already active on your account.");
const id=crypto.randomUUID();
await db.prepare("INSERT INTO partner_subscriptions(id,advertiser_id,package_key,status,currency,amount_minor,billing_cycle) VALUES(?,?,?,'pending_payment',?,?,'monthly')").bind(id,partner.advertiser_id,packageKey,plan.currency||"ZMW",Number(plan.monthly_price_minor||0)).run();
return json({ok:true,id,message:"Package request sent. PhoneYa2 will contact you to confirm the package and arrange payment outside the website."},201);
}
if(action==="workspace")return json({ok:true,...await workspace(db,partner)});
if(action==="notification.read"||action==="notification.dismiss"||action==="notification.complete"){
const id=String(body.id||"");if(!UUID.test(id))return fail("Invalid notification.");
let result;if(action==="notification.read")result=await db.prepare("UPDATE partner_notifications SET is_read=1,read_at=? WHERE id=? AND advertiser_id=?").bind(now,id,partner.advertiser_id).run();else if(action==="notification.dismiss")result=await db.prepare("UPDATE partner_notifications SET dismissed_at=? WHERE id=? AND advertiser_id=?").bind(now,id,partner.advertiser_id).run();else result=await db.prepare("UPDATE partner_notifications SET completed_at=?,is_read=1,read_at=? WHERE id=? AND advertiser_id=?").bind(now,now,id,partner.advertiser_id).run();
if(!result.meta||!result.meta.changes)return fail("Notification not found.",404);
return json({ok:true});
}
if(action==="notification.read-all"){
await db.prepare("UPDATE partner_notifications SET is_read=1,read_at=? WHERE advertiser_id=? AND is_read=0 AND dismissed_at IS NULL").bind(now,partner.advertiser_id).run();return json({ok:true});
}
if(action==="profile.save"){
const business=cleanText(body.business_name,100),owner=cleanText(body.owner_name,100),phone=cleanText(body.phone,40),tagline=cleanText(body.tagline,180),about=cleanText(body.about,1200),contactPhone=cleanText(body.contact_phone,40),whatsapp=cleanText(body.contact_whatsapp,40),contactEmail=cleanText(body.contact_email,254).toLowerCase(),logo=cleanText(body.logo_url,1000);
if(!business||!owner||phone.replace(/\D/g,"").length<9)return fail("Enter your business name, owner name and a valid phone number.");
const emailParts=contactEmail.split("@");if(contactEmail&&(emailParts.length!==2||!emailParts[0]||!emailParts[1].includes(".")||emailParts[1].startsWith(".")||emailParts[1].endsWith(".")))return fail("Enter a valid public contact email.");
await db.prepare("UPDATE advertisers SET business_name=?,owner_name=?,phone=?,logo_url=? WHERE id=?").bind(business,owner,phone,logo,partner.advertiser_id).run();
await db.prepare("UPDATE advertiser_profiles SET tagline=?,about=?,contact_phone=?,contact_whatsapp=?,contact_email=? WHERE advertiser_id=?").bind(tagline,about,contactPhone||phone,whatsapp||contactPhone||phone,contactEmail,partner.advertiser_id).run();
return json({ok:true,message:"Business profile updated."});
}
if(action==="social-link.save"){const platform=cleanText(body.platform,24).toLowerCase(),url=cleanText(body.url,1200),title=cleanText(body.title,140),caption=cleanText(body.caption,500);if(!["youtube","tiktok","instagram","facebook","x","linkedin","pinterest","image","video"].includes(platform))return fail("Choose a supported platform.");let parsed;try{parsed=new URL(url)}catch{return fail("Paste a valid public post or media link.")}if(!["https:","http:"].includes(parsed.protocol)||parsed.username||parsed.password)return fail("Use a public http or https link.");const hosts={youtube:["youtube.com","youtu.be"],tiktok:["tiktok.com"],instagram:["instagram.com"],facebook:["facebook.com","fb.watch"],x:["x.com","twitter.com"],linkedin:["linkedin.com"],pinterest:["pinterest.com","pin.it"],image:[],video:[]};if(hosts[platform].length&&!hosts[platform].some(h=>parsed.hostname===h||parsed.hostname.endsWith("."+h)))return fail("That link does not match the selected platform.");if(["image","video"].includes(platform)&&![".png",".jpg",".jpeg",".webp",".gif",".avif",".mp4",".webm",".mov"].some(ext=>parsed.pathname.toLowerCase().endsWith(ext)))return fail("Use a direct image or video file URL.");const count=await db.prepare("SELECT COUNT(*) AS total FROM partner_social_embeds WHERE advertiser_id=?").bind(partner.advertiser_id).first();if(Number(count?.total||0)>=100)return fail("You have reached the 100-link limit.");const duplicate=await db.prepare("SELECT id FROM partner_social_embeds WHERE advertiser_id=? AND url=? LIMIT 1").bind(partner.advertiser_id,url).first();if(duplicate)return fail("This social post link has already been added.");const id=crypto.randomUUID();await db.prepare("INSERT INTO partner_social_embeds(id,advertiser_id,platform,url,title,caption,created_at) VALUES(?,?,?,?,?,?,?)").bind(id,partner.advertiser_id,platform,url,title,caption,now).run();return json({ok:true,id});}
if(action==="social-link.delete"){if(!UUID.test(String(body.id||"")))return fail("Invalid social post.");await db.prepare("DELETE FROM partner_social_embeds WHERE id=? AND advertiser_id=?").bind(body.id,partner.advertiser_id).run();return json({ok:true});}
if(action==="site.publish"){
await db.prepare("UPDATE partner_site_builder SET builder_published=0,updated_at=? WHERE advertiser_id=?").bind(now,partner.advertiser_id).run().catch(()=>{});
const ready=await db.prepare("SELECT site_title,hero_title FROM partner_site_settings WHERE advertiser_id=? LIMIT 1").bind(partner.advertiser_id).first();
if(!ready||!String(ready.site_title||"").trim()||!String(ready.hero_title||"").trim())return fail("Add your website title and hero headline before publishing.");
await db.prepare("UPDATE partner_site_settings SET published=1,updated_at=? WHERE advertiser_id=?").bind(now,partner.advertiser_id).run();
return json({ok:true,message:"Your business website is published."});
}
if(action==="site.unpublish"){
await db.prepare("UPDATE partner_site_settings SET published=0,updated_at=? WHERE advertiser_id=?").bind(now,partner.advertiser_id).run();
return json({ok:true,message:"Your business website is now private."});
}
if(action.startsWith("builder."))return fail("The visual drag-and-drop builder has been retired. Use the standard website editor in Partner Studio.",410);
if(action==="site.preview"){
 const [advertiser,storedSite]=await Promise.all([
  db.prepare("SELECT a.id,a.business_name,a.owner_name,a.phone,a.email,a.logo_url,a.tier,a.status,p.slug,p.tagline,p.about,p.primary_color,p.accent_color,p.cover_image_url,p.social_links_json,p.contact_phone,p.contact_whatsapp,p.contact_email,p.verified FROM advertiser_profiles p JOIN advertisers a ON a.id=p.advertiser_id WHERE p.advertiser_id=? LIMIT 1").bind(partner.advertiser_id).first(),
  db.prepare("SELECT * FROM partner_site_settings WHERE advertiser_id=? LIMIT 1").bind(partner.advertiser_id).first()
 ]);
 if(!advertiser||!storedSite)return fail("Your website setup could not be loaded for preview.",404);
 const site={...storedSite};
 const mapping={site_title:"site_title",site_description:"site_description",hero_title:"hero_title",hero_subtitle:"hero_subtitle",hero_image_url:"hero_image_url",logo_url:"logo_url",primary_color:"primary_color",accent_color:"accent_color",font_pair:"font_pair",template_key:"template_key",seo_title:"seo_title",seo_description:"seo_description",page_background:"page_background",header_style:"header_style",post_layout:"post_layout",post_image_fit:"post_image_fit",post_card_style:"post_card_style",button_style:"button_style",content_width:"content_width",hero_height:"hero_height",menu_style:"menu_style",announcement_text:"announcement_text",announcement_link:"announcement_link"};
 for(const [input,key] of Object.entries(mapping))if(body[input]!==undefined)site[key]=body[input];
 if(body.custom_colors&&typeof body.custom_colors==="object")site.custom_colors_json=JSON.stringify(body.custom_colors);
 if(body.social_links&&typeof body.social_links==="object")site.social_links_json=JSON.stringify(body.social_links);
 for(const key of ["show_announcement","show_social_links","show_contact_bar","show_catalogue","show_services","show_posts"])if(body[key]!==undefined)site[key]=body[key]?1:0;
 let items=[],posts=[],socialEmbeds=[];
 try{const result=await db.prepare("SELECT * FROM partner_catalog_items WHERE advertiser_id=? AND published=1 AND availability!='out_of_stock' AND moderation_status='approved' ORDER BY featured DESC,sort_order,created_at DESC LIMIT 200").bind(partner.advertiser_id).all();items=result.results||[];}
 catch(error){if(!/no such column: .*moderation_status/i.test(String(error?.message||error)))throw error;const result=await db.prepare("SELECT * FROM partner_catalog_items WHERE advertiser_id=? AND published=1 AND availability!='out_of_stock' ORDER BY featured DESC,sort_order,created_at DESC LIMIT 200").bind(partner.advertiser_id).all();items=result.results||[];}
 try{const result=await db.prepare("SELECT * FROM partner_posts WHERE advertiser_id=? AND status='published' AND moderation_status='approved' ORDER BY published_at DESC LIMIT 50").bind(partner.advertiser_id).all();posts=result.results||[];}
 catch(error){if(!/no such column: .*moderation_status/i.test(String(error?.message||error)))throw error;const result=await db.prepare("SELECT * FROM partner_posts WHERE advertiser_id=? AND status='published' ORDER BY published_at DESC LIMIT 50").bind(partner.advertiser_id).all();posts=result.results||[];}
 try{const result=await db.prepare("SELECT id,platform,url,title,caption,created_at FROM partner_social_embeds WHERE advertiser_id=? ORDER BY created_at DESC LIMIT 100").bind(partner.advertiser_id).all();socialEmbeds=result.results||[];}catch(error){if(!/no such table/i.test(String(error?.message||error)))throw error;}
 const previewBase=new URL("/b/"+encodeURIComponent(advertiser.slug)+"/",request.url).href;
 const html=renderPartnerSite({slug:advertiser.slug,advertiser,site,items,posts,socialEmbeds,share:{}}).replace("<head>","<head><base href=\""+previewBase+"\">");
 return json({ok:true,html});
}
if(action==="site.save"){
const activePackage=await db.prepare("SELECT ps.package_key,pp.benefits_json FROM partner_subscriptions ps JOIN partner_packages pp ON pp.package_key=ps.package_key WHERE ps.advertiser_id=? AND ps.status='active' ORDER BY ps.created_at DESC LIMIT 1").bind(partner.advertiser_id).first();
let benefits={};try{benefits=JSON.parse(activePackage?.benefits_json||'{}')}catch{}
const designLevel=benefits.design||"basic";
const designRank={basic:0,expanded:1,advanced:2,premium:3,full:4};
const currentDesign=await db.prepare("SELECT page_background,header_style,post_layout,post_image_fit,post_card_style,button_style,content_width,show_announcement,hero_height,menu_style,custom_colors_json FROM partner_site_settings WHERE advertiser_id=? LIMIT 1").bind(partner.advertiser_id).first()||{};
const requestedRank=(value,levels)=>levels.indexOf(value);
const requested={
page_background:cleanText(body.page_background,20),
header_style:cleanText(body.header_style,20),
post_layout:cleanText(body.post_layout,20),
post_image_fit:cleanText(body.post_image_fit,20),
post_card_style:cleanText(body.post_card_style,20),
button_style:cleanText(body.button_style,20),
content_width:cleanText(body.content_width,20),
hero_height:cleanText(body.hero_height,20),
menu_style:cleanText(body.menu_style,20)
};
const choices={
page_background:["soft","plain","gradient","image"],
header_style:["clean","solid","glass","centered"],
post_layout:["cards","feed","masonry"],
post_image_fit:["cover","contain"],
post_card_style:["elevated","minimal","outlined"],
button_style:["rounded","pill","square"],
content_width:["wide","standard","compact"],
hero_height:["compact","standard","tall","cinematic"],
menu_style:["standard","floating","overlay"]
};
const minimum={
page_background:{plain:0,soft:0,gradient:1,image:3},
header_style:{clean:0,solid:0,glass:2,centered:2},
post_layout:{cards:0,feed:1,masonry:3},
post_image_fit:{cover:0,contain:1},
post_card_style:{elevated:0,minimal:1,outlined:2},
button_style:{rounded:0,pill:1,square:2},
content_width:{wide:0,standard:1,compact:2},
hero_height:{compact:0,standard:0,tall:1,cinematic:4},
menu_style:{standard:0,floating:2,overlay:4}
};
for(const [key,allowed] of Object.entries(choices)){
const value=requested[key]||allowed[0];
if(!allowed.includes(value))return fail("Invalid "+key.replace(/_/g," ")+".");
const needed=minimum[key][value]??0;
if(needed>designRank[designLevel]&&value!==currentDesign[key])return fail("That design option requires a higher package. Upgrade to unlock it.");
requested[key]=value;
}
const colourKeys=["button_bg","button_text","button_hover","button_hover_text","link","page_bg","surface","text","border"];const colourDefaults={button_bg:"#ff641f",button_text:"#ffffff",button_hover:"#e94e12",button_hover_text:"#ffffff",link:"#1769b2",page_bg:"#f6f8fb",surface:"#ffffff",text:"#172b48",border:"#e4eaf1"};let previousColours={};try{previousColours=JSON.parse(currentDesign.custom_colors_json||"{}")}catch{};const customColours={};for(const key of colourKeys){const value=body.custom_colors?.[key];if(value!==undefined&&!/^#[0-9a-f]{6}$/i.test(String(value)))return fail("Invalid colour value for "+key.replace(/_/g," ")+".");customColours[key]=/^#[0-9a-f]{6}$/i.test(String(value||""))?String(value):(/^#[0-9a-f]{6}$/i.test(previousColours[key]||"")?previousColours[key]:colourDefaults[key]);}const currentDefaults=Object.fromEntries(colourKeys.map(k=>[k,/^#[0-9a-f]{6}$/i.test(previousColours[k]||"")?previousColours[k]:colourDefaults[k]]));const palettePresets=[{"button_bg":"#1672bd","button_text":"#ffffff","button_hover":"#0e5a9f","button_hover_text":"#ffffff","link":"#1769b2","page_bg":"#f4f8fc","surface":"#ffffff","text":"#172b48","border":"#dce6f0"},{"button_bg":"#f08048","button_text":"#ffffff","button_hover":"#d65b32","button_hover_text":"#ffffff","link":"#bd4c35","page_bg":"#fff7f2","surface":"#ffffff","text":"#402a28","border":"#f1ddd4"},{"button_bg":"#1b967b","button_text":"#ffffff","button_hover":"#116c59","button_hover_text":"#ffffff","link":"#147b68","page_bg":"#f1faf6","surface":"#ffffff","text":"#183b34","border":"#d5e9df"},{"button_bg":"#8055ca","button_text":"#ffffff","button_hover":"#5d369e","button_hover_text":"#ffffff","link":"#7047b8","page_bg":"#f7f4fc","surface":"#ffffff","text":"#30264a","border":"#e5dcf2"},{"button_bg":"#d35e88","button_text":"#ffffff","button_hover":"#a83c64","button_hover_text":"#ffffff","link":"#b94370","page_bg":"#fff5f8","surface":"#ffffff","text":"#472d38","border":"#efdce4"},{"button_bg":"#354e70","button_text":"#ffffff","button_hover":"#1d304c","button_hover_text":"#ffffff","link":"#526d93","page_bg":"#edf1f6","surface":"#ffffff","text":"#1b293b","border":"#d5dce5"},{"button_bg":"#d7a21c","button_text":"#201900","button_hover":"#9f7108","button_hover_text":"#ffffff","link":"#8b6a0b","page_bg":"#fffbee","surface":"#ffffff","text":"#3e350f","border":"#efe5bd"},{"button_bg":"#967653","button_text":"#ffffff","button_hover":"#6a5037","button_hover_text":"#ffffff","link":"#725638","page_bg":"#f8f5ef","surface":"#ffffff","text":"#392f25","border":"#e7dfd2"},{"button_bg":"#ef7469","button_text":"#ffffff","button_hover":"#c84d45","button_hover_text":"#ffffff","link":"#ca4f48","page_bg":"#fff6f4","surface":"#ffffff","text":"#452d2b","border":"#f0deda"},{"button_bg":"#3998d5","button_text":"#ffffff","button_hover":"#286d9f","button_hover_text":"#ffffff","link":"#277bb6","page_bg":"#f2f9fd","surface":"#ffffff","text":"#20384a","border":"#dceaf2"},{"button_bg":"#aa4d99","button_text":"#ffffff","button_hover":"#78316d","button_hover_text":"#ffffff","link":"#863976","page_bg":"#fbf3fa","surface":"#ffffff","text":"#402a40","border":"#ebdcec"},{"button_bg":"#444444","button_text":"#ffffff","button_hover":"#202020","button_hover_text":"#ffffff","link":"#333333","page_bg":"#f5f5f5","surface":"#ffffff","text":"#242424","border":"#dedede"}];const isPresetPalette=palettePresets.some(p=>["button_bg","button_text","button_hover","button_hover_text","link","page_bg","surface","text","border"].every(k=>p[k]===customColours[k]));if(designRank[designLevel]<1&&JSON.stringify(customColours)!==JSON.stringify(currentDefaults)&&!isPresetPalette)return fail("Individual colour controls are available from the Starter package. Choose a colour palette or upgrade to unlock custom colours.");
const announcement=cleanText(body.announcement_text,140);
const announcementLink=cleanText(body.announcement_link,1000);
if(announcementLink){let valid=announcementLink.startsWith("/")&&!announcementLink.startsWith("//");if(!valid){try{const u=new URL(announcementLink);valid=["http:","https:"].includes(u.protocol)}catch{valid=false}}if(!valid)return fail("Use a valid website link for the announcement.");}
if(body.show_announcement&&designRank[designLevel]<1&&Number(currentDesign.show_announcement||0)!==1)return fail("The announcement bar is available from the Starter package. Upgrade to unlock it.");
const fields={site_title:cleanText(body.site_title,100),site_description:cleanText(body.site_description,500),hero_title:cleanText(body.hero_title,140),hero_subtitle:cleanText(body.hero_subtitle,300),hero_image_url:cleanText(body.hero_image_url,1000),logo_url:cleanText(body.logo_url,1000),primary_color:/^#[0-9a-f]{6}$/i.test(body.primary_color||"")?body.primary_color:"#ff6000",accent_color:/^#[0-9a-f]{6}$/i.test(body.accent_color||"")?body.accent_color:"#173f73",font_pair:["modern","editorial","classic"].includes(body.font_pair)?body.font_pair:"modern",template_key:["signature","storefront","studio","hospitality","professional"].includes(body.template_key)?body.template_key:"signature",seo_title:cleanText(body.seo_title,120),seo_description:cleanText(body.seo_description,300),social_links_json:JSON.stringify(body.social_links&&typeof body.social_links==="object"?body.social_links:{}),...requested,announcement_text:announcement,announcement_link:announcementLink,show_announcement:body.show_announcement?1:0,show_social_links:body.show_social_links===false?0:1,show_contact_bar:body.show_contact_bar===false?0:1,show_catalogue:body.show_catalogue===false?0:1,show_services:body.show_services===false?0:1,show_posts:body.show_posts===false?0:1,hero_height:requested.hero_height||'standard',menu_style:requested.menu_style||'standard'};
await db.prepare(`UPDATE partner_site_settings SET site_title=?,site_description=?,hero_title=?,hero_subtitle=?,hero_image_url=?,logo_url=?,primary_color=?,accent_color=?,font_pair=?,template_key=?,seo_title=?,seo_description=?,social_links_json=?,custom_colors_json=?,page_background=?,header_style=?,post_layout=?,post_image_fit=?,post_card_style=?,button_style=?,content_width=?,announcement_text=?,announcement_link=?,show_announcement=?,show_social_links=?,show_contact_bar=?,show_catalogue=?,show_services=?,show_posts=?,hero_height=?,menu_style=?,updated_at=? WHERE advertiser_id=?`).bind(fields.site_title,fields.site_description,fields.hero_title,fields.hero_subtitle,fields.hero_image_url,fields.logo_url,fields.primary_color,fields.accent_color,fields.font_pair,fields.template_key,fields.seo_title,fields.seo_description,fields.social_links_json,JSON.stringify(customColours),fields.page_background,fields.header_style,fields.post_layout,fields.post_image_fit,fields.post_card_style,fields.button_style,fields.content_width,fields.announcement_text,fields.announcement_link,fields.show_announcement,fields.show_social_links,fields.show_contact_bar,fields.show_catalogue,fields.show_services,fields.show_posts,fields.hero_height,fields.menu_style,now,partner.advertiser_id).run();
try{await db.prepare("UPDATE partner_site_builder SET builder_published=0,updated_at=? WHERE advertiser_id=?").bind(now,partner.advertiser_id).run();}catch(error){if(!/no such table/i.test(String(error?.message||error)))throw error;}
await db.prepare("UPDATE advertiser_profiles SET primary_color=?,accent_color=?,cover_image_url=?,social_links_json=?,tagline=?,about=?,updated_at=? WHERE advertiser_id=?").bind(fields.primary_color,fields.accent_color,fields.hero_image_url,fields.social_links_json,fields.hero_subtitle,fields.site_description,now,partner.advertiser_id).run();
return json({ok:true,message:"Website design settings saved.",designLevel});
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
const id=UUID.test(String(body.id||""))?body.id:crypto.randomUUID();
const title=cleanText(body.title,160);
if(!title)return fail("Add a post title.");
let slug=slugify(body.slug||title);
const existingSlug=await db.prepare("SELECT id FROM partner_posts WHERE advertiser_id=? AND slug=? COLLATE NOCASE LIMIT 1").bind(partner.advertiser_id,slug).first();
if(existingSlug&&existingSlug.id!==id)slug=slug.slice(0,42)+"-"+crypto.randomUUID().slice(0,5).toLowerCase();
const status=body.status==="published"?"published":"draft";
const ctaLabel=cleanText(body.cta_label,32);
const ctaUrl=cleanText(body.cta_url,1000);
if(ctaUrl){let valid=ctaUrl.startsWith("#")&&/^#[a-z][a-z0-9_-]*$/i.test(ctaUrl);if(!valid&&ctaUrl.startsWith("/")&&!ctaUrl.startsWith("//")&&!ctaUrl.includes("\\"))valid=true;if(!valid){try{const parsed=new URL(ctaUrl);valid=parsed.protocol==="https:"||parsed.protocol==="http:";}catch{valid=false;}}if(!valid)return fail("Use a full http/https link or a section link such as #contact.");}
try{
await db.prepare(`INSERT INTO partner_posts(id,advertiser_id,title,slug,excerpt,body,cover_image_url,post_type,cta_label,cta_url,status,published_at,updated_at)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,slug=excluded.slug,excerpt=excluded.excerpt,body=excluded.body,cover_image_url=excluded.cover_image_url,post_type=excluded.post_type,cta_label=excluded.cta_label,cta_url=excluded.cta_url,status=excluded.status,published_at=excluded.published_at,updated_at=excluded.updated_at
WHERE partner_posts.advertiser_id=excluded.advertiser_id`).bind(id,partner.advertiser_id,title,slug,cleanText(body.excerpt,300),cleanText(body.body,20000),cleanText(body.cover_image_url,1000),cleanText(body.post_type,40)||"update",ctaLabel,ctaUrl,status,status==="published"?now:null,now).run();
}catch(error){
console.error("Partner post save failed:",String(error?.stack||error).slice(0,1000));
return fail("Your post could not be saved. Please check the details and try again. If it continues, contact PhoneYa2 support.",500);
}
return json({ok:true,id});
}
if(action==="post.delete"){if(!UUID.test(String(body.id||"")))return fail("Invalid post.");await db.prepare("DELETE FROM partner_posts WHERE id=? AND advertiser_id=?").bind(body.id,partner.advertiser_id).run();return json({ok:true});}
if(action==="enquiry.status"){if(!UUID.test(String(body.id||""))||!["new","contacted","qualified","won","closed"].includes(body.status))return fail("Invalid enquiry update.");await db.prepare("UPDATE partner_enquiries SET status=?,updated_at=? WHERE id=? AND advertiser_id=?").bind(body.status,now,body.id,partner.advertiser_id).run();return json({ok:true});}
return fail("Unknown partner action.",404);
}
export async function onRequest({request,env}){
if(!env.DB)return fail("PhoneYa2 D1 is not configured.",503);
if(!sameOrigin(request))return fail("Cross-origin request blocked.",403);
if(request.method==="GET"){
try{const partner=await currentPartner(request,env);if(!partner){const reason=await partnerSessionFailureReason(request,env);return json({ok:false,authenticated:false,reason},401);}try{await expirePartnerSubscriptions(env.DB,partner.advertiser_id);}catch(expiryError){console.warn("Partner subscription expiry check skipped; workspace will continue loading:",expiryError?.stack||expiryError);}return json({ok:true,authenticated:true,...await workspace(env.DB,partner)});}catch(error){console.error("Partner workspace GET failed:",error?.stack||error);return fail("Your partner workspace could not be loaded. Your account and sign-in session have been preserved. Please retry shortly.",500);}
}
if(request.method!=="POST")return fail("Method not allowed.",405);
if((request.headers.get("content-type")||"").includes("multipart/form-data")){
const partner=await currentPartner(request,env);if(!partner)return fail("Please sign in to your partner account.",401);try{await expirePartnerSubscriptions(env.DB,partner.advertiser_id);}catch(error){console.error("Partner subscription expiry sweep failed:",error?.stack||error);}
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
if(!await rateLimit(request,env,"signup"))return fail("Too many sign-up attempts. Wait 15 minutes before trying again.",429);
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
env.DB.prepare("INSERT INTO partner_subscriptions(id,advertiser_id,package_key,status,amount_minor,currency,billing_cycle,starts_at,current_period_start,current_period_end,paid_months) VALUES(?,?,'free','active',0,'ZMW','monthly',?,?,NULL,0)").bind(subscriptionId,advertiserId,stamp,stamp)
]);
stage="creating secure sign-in session";
const token=await createSession(env.DB,accountId);
return json({ok:true,authenticated:true,slug,message:"Your workspace is ready. It remains private until account verification and public publishing are enabled."},201,{"set-cookie":sessionCookies(token)});
}catch(e){
console.error("PhoneYa2 partner signup failure at ["+stage+"]:",e?.stack||e);
return fail("Account creation failed during: "+stage+". The exact technical details have been recorded in Cloudflare logs. Please retry once the latest site update is live.",500);
}
}
if(action==="login"){
if(!await rateLimit(request,env,"login"))return fail("Too many sign-in attempts. Please wait 15 minutes before trying again.",429);
const email=cleanText(body.email,254).toLowerCase(),password=String(body.password||"");const account=await env.DB.prepare("SELECT * FROM advertiser_accounts WHERE email=? COLLATE NOCASE LIMIT 1").bind(email).first();
let stored={};try{stored=JSON.parse(account?.password_hash||"{}");}catch{}
const valid=!!account&&account.status==="active"&&stored.scheme==="pbkdf2-sha256"&&await verifyPassword(password,stored.salt,stored.hash);
if(!valid)return fail("Email or password is incorrect.",401);
const token=await createSession(env.DB,account.id);const ip=request.headers.get("cf-connecting-ip")||"unknown";const loginHash=b64url(await digest("login:"+ip));await env.DB.prepare("DELETE FROM partner_auth_attempts WHERE ip_hash=?").bind(loginHash).run();return json({ok:true,authenticated:true},200,{"set-cookie":sessionCookies(token)});
}
if(action==="logout"){const raw=cookieValue(request);if(raw){const hash=b64url(await digest(raw));await env.DB.prepare("UPDATE partner_sessions SET revoked_at=? WHERE token_hash=?").bind(new Date().toISOString(),hash).run();}return json({ok:true,authenticated:false},200,{"set-cookie":clearCookies()});}
const partner=await currentPartner(request,env);if(!partner)return fail("Please sign in to your partner account.",401);
return handleAction(request,env,partner,body);
}
