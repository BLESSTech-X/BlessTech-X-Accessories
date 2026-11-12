// Shared operational event writer for the PhoneYa2 Command Centre.
const clean=(v,n=420)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,n);
export async function recordAdminActivity(db,event){
 if(!db||!event?.key)return;
 const id=crypto.randomUUID(),now=new Date().toISOString();
 await db.prepare("INSERT OR IGNORE INTO admin_notifications(id,event_key,category,event_type,title,message,priority,destination,related_id,related_label,image_url,created_at,is_read) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0)")
 .bind(id,clean(event.key,180),clean(event.category||"operations",60),clean(event.type||"activity",60),clean(event.title,180),clean(event.message,420),clean(event.priority||"normal",20),clean(event.destination||"/admin/command-center.html",500),clean(event.related_id||"",120),clean(event.related_label||"",180),clean(event.image_url||"",800),now).run();
}
