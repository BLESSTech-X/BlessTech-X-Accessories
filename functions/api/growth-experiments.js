const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const clean=(v,n=1000)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,n);
async function admin(request,env){const {getAdminSession,sameOrigin}=await import("../_auth.js");return sameOrigin(request)&&!!(await getAdminSession(request,env));}
const fields=["name","category","hypothesis","change_description","product_slug","channel","audience","primary_metric","baseline_value","target_value","result_value","duration_days","status","start_at","end_at","notes","learning"];
function normalize(b){
 const x={};
 for(const k of fields){if(!(k in b))continue;const v=b[k];
  if(["baseline_value","target_value","result_value"].includes(k)){if(v===null||v==="")x[k]=null;else if(Number.isFinite(Number(v)))x[k]=Number(v);else throw new Error("Enter a valid number for "+k.replaceAll("_"," ")+".");}
  else if(k==="duration_days"){const n=Number(v);if(!Number.isInteger(n)||n<1||n>90)throw new Error("Test duration must be between 1 and 90 days.");x[k]=n;}
  else if(k==="status"){if(!["planned","running","review","won","lost","inconclusive","paused"].includes(v))throw new Error("Invalid experiment status.");x[k]=v;}
  else x[k]=clean(v,k==="hypothesis"||k==="change_description"||k==="notes"||k==="learning"?3000: k==="name"?140:180);
 }
 return x;
}
export async function onRequest({request,env}){
 if(!await admin(request,env))return json({error:"Administrator sign-in required."},401);
 if(!env.DB)return json({error:"Cloudflare D1 binding DB is not configured."},503);
 try{
  if(request.method==="GET"){
   const rows=await env.DB.prepare("SELECT * FROM growth_experiments ORDER BY CASE status WHEN 'running' THEN 0 WHEN 'review' THEN 1 WHEN 'planned' THEN 2 ELSE 3 END,created_at DESC LIMIT 200").all();
   return json({success:true,experiments:rows.results||[]});
  }
  if(request.method!=="POST")return json({error:"Method not allowed."},405);
  const body=await request.json().catch(()=>null);if(!body||typeof body!=="object")return json({error:"Submit a valid experiment action."},400);
  const action=clean(body.action,20),id=clean(body.id,80);
  if(action==="delete"){if(!id)return json({error:"Experiment ID is required."},400);await env.DB.prepare("DELETE FROM growth_experiments WHERE id=?").bind(id).run();return json({success:true});}
  const x=normalize(body.experiment||{});
  if(action==="create"){
   if(!x.name||!x.hypothesis||!x.change_description)return json({error:"Name, hypothesis and the single change are required."},400);
   const newId=crypto.randomUUID(),duration=x.duration_days||7;
   const start=x.start_at||null,end=x.end_at||null;
   const cols=["name","category","hypothesis","change_description","product_slug","channel","audience","primary_metric","baseline_value","target_value","result_value","duration_days","status","start_at","end_at","notes","learning"];
   const vals=cols.map(k=>x[k]??({category:"product_page",channel:"website",audience:"all_visitors",primary_metric:"completed_orders",duration_days:7,status:"planned"}[k]??null));
   await env.DB.prepare("INSERT INTO growth_experiments(id,"+cols.join(",")+") VALUES("+["?","?","?","?","?","?","?","?","?","?","?","?","?","?","?","?","?"].join(",")+")").bind(newId,...vals).run();
   return json({success:true,id:newId});
  }
  if(action==="update"||action==="status"){
   if(!id)return json({error:"Experiment ID is required."},400);
   const updates=action==="status"?{status:x.status}:x,keys=Object.keys(updates).filter(k=>fields.includes(k));
   if(!keys.length)return json({error:"No valid experiment fields supplied."},400);
   await env.DB.prepare("UPDATE growth_experiments SET "+keys.map(k=>k+"=?").join(",")+",updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(...keys.map(k=>updates[k]),id).run();
   return json({success:true});
  }
  return json({error:"Unknown experiment action."},400);
 }catch(error){console.error("Growth Lab API:",error?.stack||error);return json({error:error.message||"Could not save experiment. Confirm D1 migration 0025 is applied."},400);}
}
