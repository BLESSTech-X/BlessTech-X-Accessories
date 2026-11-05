import { renderPartnerSite } from "../_partner-site.js";
async function visitorHash(request){const raw=(request.headers.get("cf-connecting-ip")||"")+"|"+(request.headers.get("user-agent")||"");const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw));return Array.from(new Uint8Array(b).slice(0,16),x=>x.toString(16).padStart(2,"0")).join("")}
export async function onRequestGet({params,env,request}){
 if(!env.DB)return new Response("Business websites are temporarily unavailable.",{status:503});
 const slug=String(params.slug||"").trim().toLowerCase();
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return new Response("Business website not found.",{status:404});
 const advertiser=await env.DB.prepare(`SELECT a.id,a.business_name,a.owner_name,a.phone,a.email,a.logo_url,a.tier,a.status,p.slug,p.tagline,p.about,p.primary_color,p.accent_color,p.cover_image_url,p.social_links_json,p.contact_phone,p.contact_whatsapp,p.contact_email,p.verified
 FROM advertiser_profiles p JOIN advertisers a ON a.id=p.advertiser_id
 JOIN partner_site_settings s ON s.advertiser_id=a.id
 WHERE p.slug=? COLLATE NOCASE AND s.published=1 AND a.status IN ('active','approved') LIMIT 1`).bind(slug).first();
 if(!advertiser)return new Response("Business website not found or not yet published.",{status:404,headers:{"cache-control":"no-store"}});
 const sitePromise=env.DB.prepare("SELECT * FROM partner_site_settings WHERE advertiser_id=? LIMIT 1").bind(advertiser.id).first();
 let site,items,posts,socialEmbeds;
 let useModeration=true,usePostCtas=true;
 for(let attempt=0;attempt<3;attempt++){
   try{
     const itemModeration=useModeration?" AND moderation_status='approved'":"";
     const postModeration=useModeration?" AND moderation_status='approved'":"";
     const postCtas=usePostCtas?",cta_label,cta_url":"";
     [site,items,posts,socialEmbeds]=await Promise.all([
       sitePromise,
       env.DB.prepare("SELECT * FROM partner_catalog_items WHERE advertiser_id=? AND published=1"+itemModeration+" AND availability!='out_of_stock' ORDER BY featured DESC,sort_order,created_at DESC LIMIT 200").bind(advertiser.id).all(),
       env.DB.prepare("SELECT title,slug,excerpt,body,cover_image_url,post_type"+postCtas+",published_at FROM partner_posts WHERE advertiser_id=? AND status='published'"+postModeration+" ORDER BY published_at DESC LIMIT 50").bind(advertiser.id).all(),
       env.DB.prepare("SELECT id,platform,url,title,caption,created_at FROM partner_social_embeds WHERE advertiser_id=? ORDER BY created_at DESC LIMIT 100").bind(advertiser.id).all()
     ]);
     break;
   }catch(error){
     const message=String(error?.message||error);
     if(usePostCtas&&/no such column: (?:partner_posts\.)?cta_(?:label|url)/i.test(message)){usePostCtas=false;console.warn("Partner post CTA migration 0009 is not applied; using default post buttons until migration is applied.");continue;}
     if(useModeration&&/no such column: (?:partner_posts|partner_catalog_items\.)?moderation_status/i.test(message)){useModeration=false;console.warn("Partner content moderation migration 0008 is not applied; serving published website content without moderation filtering until migration is applied.");continue;}
     throw error;
   }
 }
 if(!items||!posts)throw new Error("Partner website content could not be loaded after schema compatibility checks.");
 const visitor=await visitorHash(request),source=request.headers.get("referer")?"referral":"direct",now=new Date().toISOString();
 await env.DB.batch([
 env.DB.prepare("INSERT INTO advertiser_profile_views(id,advertiser_id,visitor_hash,source) VALUES(?,?,?,?)").bind(crypto.randomUUID(),advertiser.id,visitor,source),
 env.DB.prepare("INSERT INTO partner_site_events(id,advertiser_id,event_type,visitor_hash,source) VALUES(?,?, 'page_view',?,?)").bind(crypto.randomUUID(),advertiser.id,visitor,source)
 ]).catch(e=>console.error("Partner profile analytics failed",String(e).slice(0,180)));
 const visibleItems=items.results||[],visiblePosts=site?.show_posts===0?[]:(posts.results||[]);
 const shareToken=new URL(request.url).searchParams.get("share")||"";let share={};
 if(shareToken.startsWith("post:")){const shareSlug=shareToken.slice(5).slice(0,100);const post=visiblePosts.find(x=>x.slug===shareSlug);if(post)share={title:post.title||advertiser.business_name,description:String(post.excerpt||post.body||advertiser.business_name).slice(0,280),image:post.cover_image_url?new URL(post.cover_image_url,request.url).href:(site?.hero_image_url?new URL(site.hero_image_url,request.url).href:advertiser.logo_url||""),url:new URL(request.url).href};}else if(shareToken.startsWith("ad:")){const adSlug=shareToken.slice(3).slice(0,100);const ad=await env.DB.prepare("SELECT title,description,media_url,media_type FROM ads WHERE slug=? AND advertiser_id=? AND status='approved' LIMIT 1").bind(adSlug,advertiser.id).first();if(ad)share={title:ad.title||advertiser.business_name,description:String(ad.description||advertiser.business_name).slice(0,280),image:ad.media_type==="image"&&ad.media_url?new URL(ad.media_url,request.url).href:advertiser.logo_url||"",url:new URL(request.url).href};}
 const html=renderPartnerSite({slug,advertiser,site:site||{},items:visibleItems,posts:visiblePosts,socialEmbeds:socialEmbeds?.results||[],share});
 return new Response(html,{status:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=0, s-maxage=5, must-revalidate","x-content-type-options":"nosniff"}});
}