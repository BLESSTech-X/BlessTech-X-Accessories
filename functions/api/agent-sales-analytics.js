import {getAdminSession} from "../_auth.js";

const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
function sameOrigin(request){
 const origin=request.headers.get("origin");
 if(!origin)return request.method==="GET"||request.headers.get("sec-fetch-site")==="same-origin";
 try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}
}
export async function onRequest({request,env}){
 if(request.method!=="GET")return json({ok:false,error:"Method not allowed."},405);
 if(!sameOrigin(request))return json({ok:false,error:"Cross-origin request blocked."},403);
 if(!env.DB)return json({ok:false,error:"D1 database unavailable."},503);
 if(!await getAdminSession(request,env))return json({ok:false,error:"Administrator sign-in required."},401);
 try{
  const result=await env.DB.prepare("SELECT s.id,s.agent_id,s.product_slug,s.product_code,s.quantity,s.customer_name,s.customer_phone,s.customer_email,s.estimated_sale_minor,s.estimated_commission_minor,s.created_at,s.updated_at,p.display_name,c.product_name FROM agent_sales s LEFT JOIN agent_profiles p ON p.agent_id=s.agent_id LEFT JOIN agent_product_codes c ON c.product_slug=s.product_slug WHERE s.status='verified' AND s.linked_order_id IS NULL ORDER BY s.created_at DESC LIMIT 10000").all();
  return json({ok:true,sales:(result.results||[])});
 }catch(error){
  console.error("Agent sales analytics failed:",error?.stack||error);
  return json({ok:false,error:"Verified agent sales could not be loaded."},500);
 }
}
