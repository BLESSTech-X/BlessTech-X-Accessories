// Cloudflare Pages Function: provide shareable, post-specific metadata to social crawlers.
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function frontmatter(md){const m=String(md).match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);if(!m)return{};const o={};m[1].split(/\r?\n/).forEach(function(line){const f=line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);if(f)o[f[1]]=f[2].trim().replace(/^['"]|['"]$/g,'')});return o}
function meta(html,regex,value){const safe=esc(value);return html.replace(regex,function(tag){return tag.replace(/content=(["'])[^"']*\1/i,'content="'+safe+'"')})}

function renderInline(value){
 let text=esc(value);
 text=text.replace(/\[([^\]]+)\]\((https?:\/\/[^ )]+|\/[^ )]*)\)/g,function(all,label,href){if(!href.startsWith('/')&&!/^https?:\/\//i.test(href))return label;return '<a href="'+esc(href)+'" rel="noopener noreferrer">'+label+'</a>'});
 text=text.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
 return text;
}
function renderArticleMarkdown(markdown,title){
 const source=String(markdown||'').replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/,'');
 const lines=source.split(/\r?\n/),out=[];let para=[],list='';
 function flush(){if(para.length){const p=para.join(' ').trim();if(p)out.push('<p>'+renderInline(p)+'</p>');para=[]}}
 function close(){if(list){out.push('</'+list+'>');list=''}}
 lines.forEach(function(raw){
  const line=raw.trim();if(!line){flush();close();return}
  const h=line.match(/^(#{1,3})\s+(.+)$/);
  if(h){flush();close();const t=h[2].replace(/\s+#+\s*$/,'');if(h[1].length===1&&t.trim().toLowerCase()===String(title||'').trim().toLowerCase())return;const n=h[1].length+1;out.push('<h'+n+'>'+renderInline(t)+'</h'+n+'>');return}
  const ul=line.match(/^[-*]\s+(.+)$/),ol=line.match(/^\d+[.)]\s+(.+)$/);
  if(ul||ol){flush();const kind=ul?'ul':'ol';if(list!==kind){close();list=kind;out.push('<'+list+'>')}out.push('<li>'+renderInline((ul||ol)[1])+'</li>');return}
  if(line.startsWith('>')){flush();close();out.push('<blockquote>'+renderInline(line.replace(/^>\s?/,''))+'</blockquote>');return}
  close();para.push(line);
 });
 flush();close();return out.join('\n');
}

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
  const videoUrl=String(post.video_url||'').trim();
  let youtubeId='';
  try{const vu=new URL(videoUrl);const host=vu.hostname.toLowerCase().replace(/^www\./,'');if(host==='youtu.be')youtubeId=vu.pathname.split('/').filter(Boolean)[0]||'';else if(host==='youtube.com'||host.endsWith('.youtube.com')||host==='youtube-nocookie.com'){if(vu.pathname==='/watch')youtubeId=vu.searchParams.get('v')||'';else{const parts=vu.pathname.split('/').filter(Boolean);if(['embed','shorts','live','v'].includes(parts[0]))youtubeId=parts[1]||''}}}catch(e){}
  if(!/^[A-Za-z0-9_-]{6,}$/.test(youtubeId))youtubeId='';
  const image=youtubeId?'https://i.ytimg.com/vi/'+encodeURIComponent(youtubeId)+'/hqdefault.jpg':(post.image?new URL(String(post.image),url.origin).href:'https://phoneya2.pages.dev/icon-512x512.jpg');
  html=html.replace(/<title>[^<]*<\/title>/i,'<title>'+esc(title)+'</title>');
  html=meta(html,/<meta\s+name="description"\s+content=(["'])[^"']*\1\s*\/?>/i,description);
  html=meta(html,/<meta\s+property="og:title"\s+content=(["'])[^"']*\1\s*\/?>/i,post.title||title);
  html=meta(html,/<meta\s+property="og:description"\s+content=(["'])[^"']*\1\s*\/?>/i,description);
  let videoTags='';
  if(youtubeId){
   const player='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(youtubeId);
   videoTags='<meta property="og:video" content="'+esc(player)+'"><meta property="og:video:secure_url" content="'+esc(player)+'"><meta property="og:video:type" content="text/html"><meta property="og:video:width" content="1280"><meta property="og:video:height" content="720"><meta name="twitter:card" content="player"><meta name="twitter:player" content="'+esc(player)+'"><meta name="twitter:player:width" content="1280"><meta name="twitter:player:height" content="720">';
  }else{videoTags='<meta name="twitter:card" content="summary_large_image">'}
  const tags='<link rel="canonical" href="'+esc(canonical)+'"><meta property="og:url" content="'+esc(canonical)+'"><meta property="og:image" content="'+esc(image)+'"><meta property="og:image:secure_url" content="'+esc(image)+'"><meta name="twitter:title" content="'+esc(title)+'"><meta name="twitter:description" content="'+esc(description)+'"><meta name="twitter:image" content="'+esc(image)+'">'+videoTags;
  html=html.replace(/<meta\s+property="og:type"[^>]*>/i,'<meta property="og:type" content="article">\n'+tags);
  const articleFile=await context.env.ASSETS.fetch(new Request(new URL('/content/blog/'+encodeURIComponent(slug)+'.md',url.origin)));
  if(articleFile.ok){
   const markdown=await articleFile.text(),body=renderArticleMarkdown(markdown,post.title);
   if(body.trim()){
    const date=String(post.date||''),dateISO=date&&!Number.isNaN(Date.parse(date))?new Date(date).toISOString():'';
    const author=String(post.author||'PhoneYa2 Editorial Team'),category=String(post.category||'PhoneYa2 Guides');
    const cover=post.image?'<img class="py2-server-cover" src="'+esc(new URL(String(post.image),url.origin).href)+'" alt="'+esc(post.title)+'" loading="eager">':'';
    const dateMarkup=dateISO?'<time datetime="'+esc(dateISO)+'">'+esc(dateISO.slice(0,10))+'</time>':'';
    const rendered='<article class="py2-server-article"><div class="py2-server-meta"><span>'+esc(category)+'</span>'+(dateMarkup?'<span>'+dateMarkup+'</span>':'')+'<span>By '+esc(author)+'</span></div><h1>'+esc(post.title)+'</h1><p class="py2-server-excerpt">'+esc(description)+'</p>'+cover+'<div class="py2-server-body">'+body+'</div><nav class="py2-server-more" aria-label="More PhoneYa2 content"><a href="/guides.html">Practical guides</a><a href="/blog.html">More stories</a><a href="/shop.html">Shop accessories</a></nav></article>';
    const placeholder='<div id="article-content" class="py2-related" style="margin-top:20px">Loading article…</div>';
    html=html.replace(placeholder,rendered);
    const articleSchema={"@context":"https://schema.org","@type":"BlogPosting","headline":String(post.title||''),"description":description,"url":canonical,"author":{"@type":"Organization","name":author},"publisher":{"@type":"Organization","name":"PhoneYa2","url":url.origin+"/"},"articleSection":category};
    if(dateISO)articleSchema.datePublished=dateISO;if(post.image)articleSchema.image=[new URL(String(post.image),url.origin).href];
    const schemaTag='<script type="application/ld+json" id="py2-server-article-schema">'+JSON.stringify(articleSchema).replace(/</g,'\\u003c')+'</script>';
    html=html.replace(/<head>/i,'<head>\n'+schemaTag+'\n<style id="py2-server-article-style">.py2-server-article{max-width:850px;margin:20px auto;padding:clamp(18px,4vw,34px);background:#fff;border:1px solid #e5eaf2;border-radius:18px;color:#172033;font:16px/1.8 system-ui,-apple-system,"Segoe UI",sans-serif}.py2-server-article a{color:#b84a00}.py2-server-meta{display:flex;gap:10px;flex-wrap:wrap;color:#667085;font-size:13px}.py2-server-meta span:first-child{color:#b84a00;font-weight:800}.py2-server-article h1{font-size:clamp(30px,5vw,46px);line-height:1.15;letter-spacing:-1px;margin:14px 0}.py2-server-excerpt{font-size:18px;color:#465166}.py2-server-cover{display:block;width:100%;max-height:460px;object-fit:cover;border-radius:14px;margin:22px 0}.py2-server-body h2{font-size:25px;line-height:1.3;margin:30px 0 8px}.py2-server-body h3{font-size:20px;margin:24px 0 6px}.py2-server-body li{margin:7px 0}.py2-server-body blockquote{border-left:4px solid #ff6000;padding:8px 16px;background:#fff7f0;color:#465166;margin:20px 0}.py2-server-more{margin-top:28px;padding-top:18px;border-top:1px solid #e5eaf2}.py2-server-more a{font-weight:800;margin-right:12px}@media(max-width:600px){.py2-server-article{margin:12px;padding:18px;border-radius:12px}}</style>\n');
   }
  }
  const headers=new Headers(page.headers);headers.set('Content-Type','text/html; charset=utf-8');headers.set('Cache-Control','no-store, max-age=0');headers.set('X-Content-Type-Options','nosniff');
  return new Response(html,{status:page.status,statusText:page.statusText,headers});
 }catch(e){return context.next()}
}
