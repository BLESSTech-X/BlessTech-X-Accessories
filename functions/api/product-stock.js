// Public, quantity-only availability overlay for PhoneYa2 products managed through Agent Network stock custody.
import {getProducts,syncProductCodes} from "./agent-network.js";
export async function onRequest({request,env}){
 if(request.method!=="GET")return new Response(JSON.stringify({ok:false,error:"Method not allowed."}),{status:405,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
 const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
 if(!env.DB)return new Response(JSON.stringify({ok:true,stock:{}}),{headers});
 try{
  // Bring newly published/updated catalogue products into the stock ledger before reading it.
  const catalogue=await getProducts({request,env});
  await syncProductCodes(env.DB,catalogue);
  const url=new URL(request.url),ref=String(url.searchParams.get("ref")||"").trim().toUpperCase();
  let agentId="";
  if(/^[A-Z0-9_-]{3,40}$/.test(ref)){
   const agent=await env.DB.prepare("SELECT agent_id FROM agent_accounts WHERE referral_code=? AND status='active'").bind(ref).first();
   agentId=String(agent?.agent_id||"");
  }
  const result=await env.DB.prepare("SELECT product_slug,MAX(0,stock) central,active FROM agent_product_codes WHERE active=1").all();
  let heldRows=[];
  if(agentId){const held=await env.DB.prepare("SELECT product_slug,COALESCE(SUM(quantity),0) agent_custody FROM agent_inventory WHERE agent_id=? AND ownership='phoneya2' GROUP BY product_slug").bind(agentId).all();heldRows=held.results||[];}
  const heldBySlug=new Map(heldRows.map(row=>[String(row.product_slug),Math.max(0,Number(row.agent_custody||0))]));
  const stock=Object.fromEntries((result.results||[]).map(row=>{const central=Math.max(0,Number(row.central||0)),agent_custody=Number(row.active)===1?(heldBySlug.get(String(row.product_slug))||0):0;return[String(row.product_slug),{central,agent_custody,total:central+agent_custody}];}));
  return new Response(JSON.stringify({ok:true,stock}),{headers});
 }catch(error){
  if(/no such table: agent_product_codes|no such table: agent_inventory/i.test(String(error)))return new Response(JSON.stringify({ok:true,stock:{}}),{headers});
  console.error("PhoneYa2 product stock overlay failed:",String(error).slice(0,220));
  return new Response(JSON.stringify({ok:false,error:"Stock availability is temporarily unavailable."}),{status:503,headers});
 }
}
