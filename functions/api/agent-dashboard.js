// Aggregate-only metrics for the shared PY2-360 agent dashboard.
// Reads the same orders table used by the authenticated PhoneYa2 Command Centre.
// Customer identifiers, addresses, line items and private notes are never returned.
function json(data, status=200) {
 return new Response(JSON.stringify(data), {status, headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
}
export async function onRequestPost({request,env}) {
 let body;
 try { body=await request.json(); } catch { return json({error:"Enter the PY2-360 access code."},400); }
 const expected=String(env.PY2_360_ACCESS_CODE||"").trim();
 if(!expected) return json({error:"PY2-360 sign-in is not configured yet. The administrator must add the PY2_360_ACCESS_CODE secret in Cloudflare Pages Production variables."},503);
 const supplied=String(body?.code||"").trim();
 if(!supplied || supplied.length>256 || supplied!==expected) return json({error:"Incorrect PY2-360 access code."},401);
 const base=String(env.SUPABASE_URL||"https://kavwhkznlhtcwabatmru.supabase.co").replace(/\/$/,"");
 const key=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY;
 if(!key) return json({error:"Live order data is not configured: add SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) to Cloudflare Pages Production variables."},503);
 try {
  const url=new URL(base+"/rest/v1/orders");
  url.searchParams.set("select","created_at,status,total_amount");
  url.searchParams.set("order","created_at.desc");
  url.searchParams.set("limit","5000");
  const response=await fetch(url,{headers:{apikey:key,authorization:"Bearer "+key,accept:"application/json"}});
  if(!response.ok) {
   const detail=await response.text().catch(()=>"");
   console.error("PY2-360 order summary failed:",response.status,detail.slice(0,300));
   return json({error:"Could not read the PhoneYa2 checkout orders used by Command Centre. Check the production database secret and orders-table permissions."},503);
  }
  const rows=await response.json();
  const normalized=rows.map(o=>({created_at:o.created_at,status:String(o.status||"pending").toLowerCase(),amount:Number(o.total_amount||0)}));
  return json({scope:"storewide_checkout_orders",generated_at:new Date().toISOString(),sales:normalized,orders:normalized,leads:[],lead_data_available:false});
 } catch(error) {
  console.error("PY2-360 live order endpoint error:",error instanceof Error?error.message:"unknown error");
  return json({error:"Live checkout order data could not be reached. Check Cloudflare logs for the endpoint error."},503);
 }
}
export async function onRequest({request}) {
 if(request.method==="OPTIONS") return new Response(null,{status:204,headers:{"allow":"POST, OPTIONS"}});
 return json({error:"Method not allowed"},405);
}