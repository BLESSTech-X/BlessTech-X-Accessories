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
  url.searchParams.set("limit","1000");
  const rows=[];
  const maxRecords=5000;
  for(let offset=0;offset<maxRecords;offset+=1000){
   const response=await fetch(url,{headers:{apikey:key,authorization:"Bearer "+key,accept:"application/json",range:offset+"-"+(offset+999)}});
   if(!response.ok) {
    const detail=await response.text().catch(()=>"");
    console.error("PY2-360 order summary failed:",response.status,detail.slice(0,300));
    return json({error:"Could not read the PhoneYa2 checkout orders used by Command Centre. Check the production database secret and orders-table permissions."},503);
   }
   const batch=await response.json();
   if(!Array.isArray(batch)) return json({error:"The order database returned an unexpected response."},503);
   rows.push(...batch);
   if(batch.length<1000) break;
  }
  const statusCounts={pending:0,confirmed:0,processing:0,shipped:0,delivered:0,cancelled:0};
  const weekly=Array.from({length:6},(_,i)=>({label:"W"+(i+1),count:0}));
  const now=Date.now(),windowStart=now-42*24*60*60*1000;
  let confirmedOrderValue=0,totalOrders=0;
  for(const row of rows){
   const status=String(row.status||"pending").toLowerCase();
   statusCounts[status]=(Number(statusCounts[status])||0)+1;
   totalOrders++;
   if(["confirmed","processing","shipped","delivered"].includes(status)) confirmedOrderValue+=Number(row.total_amount||0);
   const created=Date.parse(row.created_at||"");
   if(Number.isFinite(created)&&created>=windowStart&&created<=now){
    const bucket=Math.min(5,Math.floor((created-windowStart)/(7*24*60*60*1000)));
    weekly[bucket].count++;
   }
  }
  return json({
   scope:"latest_order_records_aggregate_only",
   generated_at:new Date().toISOString(),
   summary:{total_orders:totalOrders,status_counts:statusCounts,confirmed_order_value:Math.round(confirmedOrderValue*100)/100,weekly_orders:weekly,record_limit:maxRecords,is_truncated:rows.length>=maxRecords},
   leads:[],lead_data_available:false
  });
 } catch(error) {
  console.error("PY2-360 live order endpoint error:",error instanceof Error?error.message:"unknown error");
  return json({error:"Live checkout order data could not be reached. Check Cloudflare logs for the endpoint error."},503);
 }
}
export async function onRequest({request}) {
 if(request.method==="OPTIONS") return new Response(null,{status:204,headers:{"allow":"POST, OPTIONS"}});
 return json({error:"Method not allowed"},405);
}