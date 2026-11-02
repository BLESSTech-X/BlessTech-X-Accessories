// Aggregate-only metrics for the shared PY2-360 agent dashboard.
// Reads the same Cloudflare D1 orders used by the authenticated PhoneYa2 Command Centre.
// Customer identifiers, addresses, line items and private notes are never returned.
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});}
export async function onRequestPost({request,env}){
 let body;try{body=await request.json();}catch{return json({error:"Enter the PY2-360 access code."},400);}
 if(String(body?.code||"").trim().toUpperCase()!=="PY2-360")return json({error:"Incorrect PY2-360 access code."},401);
 if(!env.DB)return json({error:"Live order data is not configured: Cloudflare D1 binding DB is missing."},503);
 try{
  const result=await env.DB.prepare("SELECT created_at,status,total_amount_minor FROM orders ORDER BY created_at DESC LIMIT 5000").all();
  const normalized=(result.results||[]).map(o=>({created_at:o.created_at,status:String(o.status||"pending").toLowerCase(),amount:Number(o.total_amount_minor||0)/100}));
  return json({scope:"storewide_checkout_orders",generated_at:new Date().toISOString(),sales:normalized,orders:normalized,leads:[],lead_data_available:false});
 }catch(error){
  console.error("PY2-360 D1 order summary failed:",error instanceof Error?error.message:"unknown error");
  return json({error:"Could not read PhoneYa2 checkout orders from D1. Check the DB binding and order migration."},503);
 }
}
export async function onRequest({request}){
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"allow":"POST, OPTIONS"}});
 return json({error:"Method not allowed"},405);
}