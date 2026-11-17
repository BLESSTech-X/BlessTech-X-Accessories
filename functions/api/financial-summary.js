import {getAdminSession} from "../_auth.js";

const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const rows=result=>result?.results||[];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const fail=(message,status=400)=>json({ok:false,error:message},status);
function sameOrigin(request){
 const origin=request.headers.get("origin");
 if(!origin)return request.method==="GET"||request.headers.get("sec-fetch-site")==="same-origin";
 try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}
}

export async function onRequest({request,env}){
 if(request.method!=="GET")return fail("Method not allowed.",405);
 if(!sameOrigin(request))return fail("Cross-origin request blocked.",403);
 if(!env.DB)return fail("D1 database unavailable.",503);
 if(!await getAdminSession(request,env))return fail("Administrator sign-in required.",401);
 const period=new URL(request.url).searchParams.get("period")||"30d";
 const windows={"1d":1,"7d":7,"30d":30,"90d":90};
 if(period!=="all"&&!Object.prototype.hasOwnProperty.call(windows,period))return fail("Choose a supported reporting period.");
 const since=period==="all"?null:new Date(Date.now()-windows[period]*86400000).toISOString();
 const where=since?"WHERE created_at>=?":"";
 const bindQuery=sql=>since?env.DB.prepare(sql).bind(since):env.DB.prepare(sql);
 try{
  const [orders,commissions,payouts,agents]=await Promise.all([
   bindQuery("SELECT COUNT(*) total_orders,SUM(CASE WHEN status<>'cancelled' THEN 1 ELSE 0 END) active_orders,SUM(CASE WHEN status<>'cancelled' THEN total_amount_minor ELSE 0 END) recorded_sales_minor,SUM(CASE WHEN status='delivered' THEN total_amount_minor ELSE 0 END) delivered_sales_minor,SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) delivered_orders,SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending_orders,SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) cancelled_orders FROM orders "+where).first(),
   env.DB.prepare("SELECT status,COUNT(*) entries,COALESCE(SUM(commission_minor),0) amount_minor FROM agent_commission_ledger "+(since?"WHERE (CASE WHEN status='paid' THEN COALESCE(paid_at,created_at) ELSE created_at END)>=?":"")+" GROUP BY status").bind(...(since?[since]:[])).all(),
   env.DB.prepare("SELECT status,COUNT(*) requests,COALESCE(SUM(amount_minor),0) amount_minor FROM agent_payout_requests "+(since?"WHERE (CASE WHEN status='paid' THEN COALESCE(paid_at,requested_at) WHEN status IN ('approved','rejected') THEN COALESCE(reviewed_at,requested_at) ELSE requested_at END)>=?":"")+" GROUP BY status").bind(...(since?[since]:[])).all(),
   env.DB.prepare("SELECT a.agent_id,COALESCE(p.display_name,a.agent_id) display_name,a.status,(SELECT COUNT(*) FROM orders o WHERE o.agent_code=a.agent_id AND o.status<>'cancelled' "+(since?"AND o.created_at>=?":"")+") attributed_orders,(SELECT COALESCE(SUM(o.total_amount_minor),0) FROM orders o WHERE o.agent_code=a.agent_id AND o.status='delivered' "+(since?"AND o.created_at>=?":"")+") delivered_sales_minor,(SELECT COUNT(*) FROM orders o WHERE o.agent_code=a.agent_id AND o.status='delivered' "+(since?"AND o.created_at>=?":"")+") delivered_orders,(SELECT COALESCE(SUM(l.commission_minor),0) FROM agent_commission_ledger l WHERE l.agent_id=a.agent_id "+(since?"AND l.created_at>=?":"")+") commission_minor,(SELECT COALESCE(SUM(l.commission_minor),0) FROM agent_commission_ledger l WHERE l.agent_id=a.agent_id AND l.status IN ('pending_review','available') "+(since?"AND l.created_at>=?":"")+") outstanding_commission_minor,(SELECT COALESCE(SUM(l.commission_minor),0) FROM agent_commission_ledger l WHERE l.agent_id=a.agent_id AND l.status='paid' "+(since?"AND COALESCE(l.paid_at,l.created_at)>=?":"")+") recorded_paid_commission_minor FROM agent_accounts a LEFT JOIN agent_profiles p ON p.agent_id=a.agent_id ORDER BY delivered_sales_minor DESC,display_name").bind(...(since?[since,since,since,since,since,since]:[])).all()
  ]);
  const payoutRows=rows(payouts),commissionRows=rows(commissions),agentRows=rows(agents);
  const sumStatus=(list,status)=>Number(list.find(x=>x.status===status)?.amount_minor||0);
  return json({ok:true,period,generated_at:new Date().toISOString(),orders:{
   total:Number(orders?.total_orders||0),active:Number(orders?.active_orders||0),recorded_sales_minor:Number(orders?.recorded_sales_minor||0),delivered_sales_minor:Number(orders?.delivered_sales_minor||0),delivered:Number(orders?.delivered_orders||0),pending:Number(orders?.pending_orders||0),cancelled:Number(orders?.cancelled_orders||0)
  },commissions:{by_status:commissionRows,total_minor:commissionRows.reduce((sum,row)=>sum+Number(row.amount_minor||0),0),pending_review_minor:sumStatus(commissionRows,"pending_review"),available_minor:sumStatus(commissionRows,"available"),paid_minor:sumStatus(commissionRows,"paid"),needs_cost_minor:sumStatus(commissionRows,"needs_cost"),reversed_minor:sumStatus(commissionRows,"reversed")},payouts:{by_status:payoutRows,requested_minor:sumStatus(payoutRows,"requested"),approved_minor:sumStatus(payoutRows,"approved"),paid_minor:sumStatus(payoutRows,"paid"),rejected_minor:sumStatus(payoutRows,"rejected")},agents:agentRows.map(agent=>({...agent,attributed_orders:Number(agent.attributed_orders||0),delivered_orders:Number(agent.delivered_orders||0),delivered_sales_minor:Number(agent.delivered_sales_minor||0),commission_minor:Number(agent.commission_minor||0),outstanding_commission_minor:Number(agent.outstanding_commission_minor||0),recorded_paid_commission_minor:Number(agent.recorded_paid_commission_minor||0)}))});
 }catch(error){
  console.error("Financial summary failed:",error?.stack||error);
  return fail("Financial reporting could not load. No financial records were changed.",500);
 }
}
