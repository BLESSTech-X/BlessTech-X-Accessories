// Shared, auditable agent commission recovery helpers.
const rows=r=>r?.results||[];
export async function applyAgentCommissionRecoveries(db,agentId){
 const adjustments=await db.prepare("SELECT a.id,a.amount_minor,COALESCE((SELECT SUM(r.amount_minor) FROM agent_adjustment_recoveries r WHERE r.adjustment_id=a.id),0) recovered FROM agent_wallet_adjustments a WHERE a.agent_id=? ORDER BY a.created_at ASC").bind(agentId).all();
 const commissions=await db.prepare("SELECT l.id,l.commission_minor,COALESCE((SELECT SUM(pa.amount_minor) FROM agent_payout_allocations pa JOIN agent_payout_requests pr ON pr.id=pa.payout_id WHERE pa.commission_id=l.id AND pr.status='paid'),0) paid,COALESCE((SELECT SUM(ar.amount_minor) FROM agent_adjustment_recoveries ar WHERE ar.commission_id=l.id),0) recovered FROM agent_commission_ledger l WHERE l.agent_id=? AND l.status='available' ORDER BY l.created_at ASC").bind(agentId).all();
 const recoveryStatements=[];
 for(const adjustment of rows(adjustments)){
  let debt=Math.max(0,Number(adjustment.amount_minor)-Number(adjustment.recovered||0));
  for(const commission of rows(commissions)){
   if(debt<=0)break;
   const free=Math.max(0,Number(commission.commission_minor)-Number(commission.paid||0)-Number(commission.recovered||0));
   const take=Math.min(free,debt);
   if(take>0){recoveryStatements.push(db.prepare("INSERT OR IGNORE INTO agent_adjustment_recoveries(id,adjustment_id,commission_id,amount_minor) VALUES(?,?,?,?)").bind(crypto.randomUUID(),adjustment.id,commission.id,take));commission.recovered=Number(commission.recovered||0)+take;debt-=take;}
  }
  if(debt<=0)recoveryStatements.push(db.prepare("UPDATE agent_wallet_adjustments SET status='recovered',recovered_at=? WHERE id=?").bind(new Date().toISOString(),adjustment.id));
  else recoveryStatements.push(db.prepare("UPDATE agent_wallet_adjustments SET status='open',recovered_at=NULL WHERE id=?").bind(adjustment.id));
 }
 if(recoveryStatements.length)await db.batch(recoveryStatements);
}
export async function reverseAgentCommissionForCancelledOrder(db,order){
 if(!order?.id)return;
 const entry=await db.prepare("SELECT * FROM agent_commission_ledger WHERE order_id=?").bind(order.id).first();
 if(!entry||entry.status==="reversed")return;
 const paid=await db.prepare("SELECT COALESCE(SUM(pa.amount_minor),0) n FROM agent_payout_allocations pa JOIN agent_payout_requests pr ON pr.id=pa.payout_id WHERE pa.commission_id=? AND pr.status='paid'").bind(entry.id).first();
 const recoveries=await db.prepare("SELECT adjustment_id FROM agent_adjustment_recoveries WHERE commission_id=?").bind(entry.id).all();
 const statements=[db.prepare("DELETE FROM agent_adjustment_recoveries WHERE commission_id=?").bind(entry.id),db.prepare("UPDATE agent_commission_ledger SET status='reversed',admin_note='Order cancelled; commission reversed. Any amount already paid is recoverable.' WHERE id=?").bind(entry.id)];
 for(const row of rows(recoveries))statements.push(db.prepare("UPDATE agent_wallet_adjustments SET status='open',recovered_at=NULL WHERE id=?").bind(row.adjustment_id));
 const paidAmount=Number(paid?.n||0);
 if(paidAmount>0)statements.push(db.prepare("INSERT OR IGNORE INTO agent_wallet_adjustments(id,agent_id,order_id,amount_minor,reason) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),entry.agent_id,entry.order_id,paidAmount,"cancelled_order_after_payout"));
 await db.batch(statements);
 await applyAgentCommissionRecoveries(db,entry.agent_id);
 await db.prepare("INSERT OR IGNORE INTO agent_notifications(id,agent_id,event_key,title,message,destination) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),entry.agent_id,"commission-reversed:"+entry.id,"Commission reversed","Commission for order "+entry.order_number+" was reversed because the order was cancelled. Any amount already paid may be offset against future earnings.","/agents/network.html").run();
}
