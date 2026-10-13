// Cloudflare Pages Function: provide shareable, post-specific metadata to social crawlers.
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function frontmatter(md){const m=String(md).match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);if(!m)return{};const o={};m[1].split(/\r?\n/).forEach(function(line){const f=line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);if(f)o[f[1]]=f[2].trim().replace(/^['"]|['"]$/g,'')});return o}
function meta(html,regex,value){const safe=esc(value);return html.replace(regex,function(tag){return tag.replace(/content=(["'])[^"']*\1/i,'content="'+safe+'"')})}
export async function onRequest(context){
 const request=context.request;if(request.method!=='GET')return context.next();
 const url=new URL(request.url),slug=url.searchParams.get('slug');
 if(!slug||slug.length>180||slug==='.'||slug==='..'||/[\/\\\u0000-\u001f]/.test(slug))return context.next();
 try{
  const idx=await context.env.ASSETS.fetch(new Request(new URL('/content/blog/index.json',url.origin)));
  if(!idx.ok)return context.next();
  const posts=await idx.json(),post=Array.isArray(posts)?posts.find(p=>p&&p.slug===slug&&p.publish===true):null;
  if(!post)return context.next();
  const page=await context.env.ASSETS.fetch(new Request(new URL('/blog-post.html',url.origin),{headers:request.headers}));
  if(!page.ok)return page;
  let html=await page.text();
  const title=String(post.title||'PhoneYa2 Blog')+' | PhoneYa2';
  const description=String(post.excerpt||'Offers, buying guides and tech tips from PhoneYa2 in Zambia.').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,300);
  const canonical=new URL('/blog-post.html?slug='+encodeURIComponent(slug),url.origin).href;
  const image=post.image?new URL(String(post.image),url.origin).href:'https://phoneya2.pages.dev/icon-512x512.jpg';
  html=html.replace(/<title>[^<]*<\/title>/i,'<title>'+esc(title)+'</title>');
  html=meta(html,/<meta\s+name="description"\s+content=(["'])[^"']*\1\s*\/?>/i,description);
  html=meta(html,/<meta\s+property="og:title"\s+content=(["'])[^"']*\1\s*\/?>/i,post.title||title);
  html=meta(html,/<meta\s+property="og:description"\s+content=(["'])[^"']*\1\s*\/?>/i,description);
  const tags='<meta property="og:url" content="'+esc(canonical)+'"><meta property="og:image" content="'+esc(image)+'"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+esc(title)+'"><meta name="twitter:description" content="'+esc(description)+'"><meta name="twitter:image" content="'+esc(image)+'">';
  html=html.replace(/<meta\s+property="og:type"[^>]*>/i,'<meta property="og:type" content="article">\n'+tags);
  const headers=new Headers(page.headers);headers.set('Content-Type','text/html; charset=utf-8');headers.set('Cache-Control','no-store, max-age=0');headers.set('X-Content-Type-Options','nosniff');
  return new Response(html,{status:page.status,statusText:page.statusText,headers});
 }catch(e){return context.next()}
}
