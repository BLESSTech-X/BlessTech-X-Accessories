export async function onRequestGet({params,env}) {
 if(!env.DB)return new Response("Media unavailable.",{status:503});
 const id=String(params.id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return new Response("Not found.",{status:404});
 const asset=await env.DB.prepare("SELECT object_key FROM agent_media_assets WHERE id=? LIMIT 1").bind(id).first();if(!asset)return new Response("Not found.",{status:404});
 const stored=String(asset.object_key||""),dataUri=stored.startsWith(id+"|")?stored.slice(id.length+1):stored;
 const match=dataUri.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);if(!match)return new Response("Invalid image data.",{status:415});
 const binary=atob(match[2]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return new Response(bytes,{headers:{"content-type":match[1],"content-length":String(bytes.length),"cache-control":"public, max-age=31536000, immutable","x-content-type-options":"nosniff"}});
}
