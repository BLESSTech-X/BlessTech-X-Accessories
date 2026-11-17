// Public, quantity-only availability overlay for PhoneYa2 products managed through Agent Network stock custody.
export async function onRequest({request,env}){
 if(request.method!=="GET")return new Response(JSON.stringify({ok:false,error:"Method not allowed."}),{status:405,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
 const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
 if(!env.DB)return new Response(JSON.stringify({ok:true,stock:{}}),{headers});
 try{
  const result=await env.DB.prepare("SELECT p.product_slug,MAX(0,p.stock) central,COALESCE(SUM(CASE WHEN i.ownership='phoneya2' THEN i.quantity ELSE 0 END),0) agent_custody FROM agent_product_codes p LEFT JOIN agent_inventory i ON i.product_slug=p.product_slug WHERE p.active=1 GROUP BY p.product_slug").all();
  const stock=Object.fromEntries((result.results||[]).map(row=>[String(row.product_slug),{central:Math.max(0,Number(row.central||0)),agent_custody:Math.max(0,Number(row.agent_custody||0)),total:Math.max(0,Number(row.central||0))+Math.max(0,Number(row.agent_custody||0))}]));
  return new Response(JSON.stringify({ok:true,stock}),{headers});
 }catch(error){
  if(/no such table: agent_product_codes|no such table: agent_inventory/i.test(String(error)))return new Response(JSON.stringify({ok:true,stock:{}}),{headers});
  console.error("PhoneYa2 product stock overlay failed:",String(error).slice(0,220));
  return new Response(JSON.stringify({ok:false,error:"Stock availability is temporarily unavailable."}),{status:503,headers});
 }
}
