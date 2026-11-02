export async function onRequestGet({params,env}) {
  if (!env.DB || !env.PARTNER_MEDIA) return new Response("Media storage unavailable.", {status:503});
  const id=String(params.id||"");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found.",{status:404});
  const asset=await env.DB.prepare("SELECT object_key FROM partner_media_assets WHERE id=? LIMIT 1").bind(id).first();
  if(!asset)return new Response("Not found.",{status:404});
  const object=await env.PARTNER_MEDIA.get(asset.object_key);
  if(!object)return new Response("Not found.",{status:404});
  const headers=new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag",object.httpEtag);
  headers.set("cache-control","public, max-age=31536000, immutable");
  headers.set("x-content-type-options","nosniff");
  return new Response(object.body,{headers});
}
