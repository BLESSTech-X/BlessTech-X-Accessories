const json = (data) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
async function notifyPartner(db, row, key, title, message, priority = "high") {
  await db.prepare("INSERT OR IGNORE INTO partner_notifications(id,advertiser_id,event_key,category,kind,title,message,priority,destination,action_label,created_at) VALUES(?,?,?,'packages','event',?,?,?,'packages','View package',?)")
    .bind(crypto.randomUUID(), row.advertiser_id, key, title, message, priority, new Date().toISOString()).run();
}
async function sendEmail(env, to, name, subject, html) {
  if (!env.BREVO_API_KEY || !env.BREVO_FROM_EMAIL) return { ok: false, error: "Brevo is not configured." };
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: env.BREVO_FROM_NAME || "PhoneYa2 Partner Network", email: env.BREVO_FROM_EMAIL },
        to: [{ email: to, name: name || "PhoneYa2 Partner" }],
        subject,
        htmlContent: html
      })
    });
    const payload = await response.json().catch(() => ({}));
    return response.ok ? { ok: true, id: String(payload.messageId || "") } : { ok: false, error: "Brevo returned HTTP " + response.status + ": " + JSON.stringify(payload).slice(0, 500) };
  } catch (error) { return { ok: false, error: String(error?.message || error).slice(0, 500) }; }
}
async function logEmail(db, row, subject, result, eventType) {
  try {
    await db.prepare("INSERT INTO communication_activity(id,campaign_id,recipient,recipient_name,channel,event_type,status,provider,provider_message_id,error_message) VALUES(?,'',?,?,'email',?,?, 'brevo',?,?)")
      .bind(crypto.randomUUID(), row.email, row.owner_name || row.business_name || "", eventType, result.ok ? "sent" : "failed", result.id || "", result.error || "").run();
  } catch (error) { console.warn("Partner subscription email activity could not be recorded:", error?.message || error); }
}
function emailHtml(row, title, message, cta) {
  return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;color:#17263b"><div style="font-size:22px;font-weight:800;color:#102b4e">PhoneYa<span style="color:#ff641f">2</span></div><p style="color:#ff641f;font-size:11px;font-weight:bold;letter-spacing:1.5px">PARTNER NETWORK</p><h2>' + esc(title) + '</h2><p>Hello ' + esc(row.owner_name || row.business_name || "Partner") + ',</p><p>' + esc(message) + '</p><p style="margin:25px 0"><a href="https://phoneya2.pages.dev/partners-dashboard/" style="background:#ff641f;color:white;text-decoration:none;padding:13px 19px;border-radius:8px;font-weight:bold">' + esc(cta) + '</a></p><p style="font-size:12px;color:#718096">You can still sign in to your Partner Studio if your paid package expires. Your account and website content are not deleted.</p><p style="font-size:12px;color:#718096">PhoneYa2 Partner Network</p></div>';
}
async function processReminders(env) {
  const db = env.DB, now = new Date().toISOString();
  let sent = 0, failed = 0;
  for (const days of [7, 3, 1]) {
    const due = await db.prepare("SELECT ps.id,ps.advertiser_id,ps.package_key,ps.current_period_end,pp.display_name AS package_name,a.business_name,a.owner_name,a.email FROM partner_subscriptions ps JOIN advertisers a ON a.id=ps.advertiser_id LEFT JOIN partner_packages pp ON pp.package_key=ps.package_key WHERE ps.status='active' AND ps.package_key!='free' AND ps.current_period_end IS NOT NULL AND date(ps.current_period_end)=date('now','+' || ? || ' days') LIMIT 500")
      .bind(days).all();
    for (const row of due.results || []) {
      await db.prepare("INSERT OR IGNORE INTO partner_subscription_reminders(subscription_id,advertiser_id,days_before_end,status) VALUES(?,?,?,'pending')").bind(row.id,row.advertiser_id,days).run();
      const state = await db.prepare("SELECT status FROM partner_subscription_reminders WHERE subscription_id=? AND days_before_end=?").bind(row.id,days).first();
      if (state?.status === "sent") continue;
      const date = new Date(row.current_period_end).toLocaleDateString("en-GB",{timeZone:"Africa/Lusaka"});
      const title = days === 1 ? "Your Partner Network package expires tomorrow" : "Your Partner Network package expires in " + days + " days";
      const message = "Your " + (row.package_name || row.package_key) + " package is due to end on " + date + ". Renew before the deadline to keep your paid package benefits active.";
      await notifyPartner(db,row,"subscription-reminder:"+row.id+":"+days,title,message);
      const result = await sendEmail(env,row.email,row.owner_name || row.business_name,title,emailHtml(row,title,message,"Open Partner Studio"));
      await db.prepare("UPDATE partner_subscription_reminders SET status=?,attempted_at=?,sent_at=?,provider_message_id=?,error_message=? WHERE subscription_id=? AND days_before_end=?")
        .bind(result.ok?"sent":"failed",now,result.ok?now:null,result.id||"",result.error||"",row.id,days).run();
      await logEmail(db,row,title,result,"partner_subscription_reminder");
      if(result.ok)sent++;else failed++;
    }
  }
  return { sent, failed };
}
async function processExpiries(env) {
  const db = env.DB, now = new Date().toISOString();
  const due = await db.prepare("SELECT ps.id,ps.advertiser_id,ps.package_key,ps.paid_months,ps.amount_minor,ps.currency,ps.current_period_end,a.business_name,a.owner_name,a.email FROM partner_subscriptions ps JOIN advertisers a ON a.id=ps.advertiser_id WHERE ps.status='active' AND ps.package_key!='free' AND ps.current_period_end IS NOT NULL AND ps.current_period_end<=? LIMIT 500").bind(now).all();
  let expired = 0;
  const free = await db.prepare("SELECT advertising_weight FROM partner_packages WHERE package_key='free' AND active=1").first();
  for (const row of due.results || []) {
    const result = await db.batch([
      db.prepare("UPDATE partner_subscriptions SET status='expired',ended_at=?,updated_at=? WHERE id=? AND status='active' AND current_period_end<=?").bind(now,now,row.id,now),
      db.prepare("UPDATE advertisers SET tier='free' WHERE id=?").bind(row.advertiser_id),
      db.prepare("UPDATE ads SET weight=? WHERE advertiser_id=? AND status IN ('pending','approved')").bind(Number(free?.advertising_weight||1),row.advertiser_id),
      db.prepare("INSERT OR IGNORE INTO partner_subscription_events(id,subscription_id,advertiser_id,event_type,package_key,paid_months,amount_minor,currency,starts_at,ends_at,note,actor,created_at) VALUES(?,?,?,'expired',?,?,?,?,?,?,?,'system',?)").bind(crypto.randomUUID(),row.id,row.advertiser_id,row.package_key,Number(row.paid_months||0),Number(row.amount_minor||0),row.currency||"ZMW",null,row.current_period_end,"Paid access ended automatically at its deadline.",now)
    ]);
    if (!result[0]?.meta || result[0].meta.changes === 0) continue;
    const date = new Date(row.current_period_end).toLocaleDateString("en-GB",{timeZone:"Africa/Lusaka"});
    const title = "Your paid Partner Network package has ended";
    const message = "Your " + row.package_key + " package ended on " + date + ". Your Partner Studio account remains available on the free Partner package. Renew whenever you are ready.";
    await notifyPartner(db,row,"package-expired:"+row.id,title,message);
    const mail = await sendEmail(env,row.email,row.owner_name || row.business_name,title,emailHtml(row,title,message,"Renew package"));
    await logEmail(db,row,title,mail,"partner_subscription_expired");
    expired++;
  }
  return expired;
}
async function run(env) {
  if (!env.DB) throw new Error("D1 binding DB is missing.");
  const reminders = await processReminders(env);
  const expired = await processExpiries(env);
  return { ok: true, reminders, expired, checked_at: new Date().toISOString() };
}
export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(run(env).then(result => console.log("Partner lifecycle sweep complete",result)).catch(error => console.error("Partner lifecycle sweep failed",error?.stack||error))); },
  async fetch(request, env) {
    if (request.method !== "POST") return json({ ok:false, error:"Method not allowed." });
    const secret = env.PARTNER_LIFECYCLE_SECRET;
    if (!secret || request.headers.get("authorization") !== "Bearer " + secret) return json({ok:false,error:"Unauthorized."});
    try { return json(await run(env)); } catch (error) { console.error("Partner lifecycle manual run failed",error?.stack||error); return json({ok:false,error:"Lifecycle sweep failed."}); }
  }
};
