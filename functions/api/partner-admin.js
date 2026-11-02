import { getAdminSession, sameOrigin } from "../_auth.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const TABLES = new Set([
  "tier_config", "ads", "advertisers", "advertiser_profiles",
  "ad_reports", "ad_moderation_log", "ad_impressions", "ad_clicks", "partner_content", "profiles"
]);

const WRITABLE = {
  advertisers: new Set(["status", "tier", "tier_started_at", "tier_expires_at"]),
  ads: new Set(["status", "rejection_reason"]),
  advertiser_profiles: new Set(["verified"]),
  ad_reports: new Set(["resolved"])
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function rowsOf(result) {
  return result && Array.isArray(result.results) ? result.results : [];
}

function parseQuery(raw) {
  if (raw.length > 2500 || /[\r\n;]/.test(raw)) throw new Error("Invalid query.");
  const params = new URLSearchParams(raw);
  const out = { id: null, email: null, order: null, limit: null };
  for (const [key, value] of params.entries()) {
    if (key === "select") {
      if (!/^[a-z_*,()]+$/i.test(value)) throw new Error("Invalid selection.");
    } else if (key === "id" && value.startsWith("eq.")) {
      const id = decodeURIComponent(value.slice(3));
      if (!UUID.test(id)) throw new Error("Invalid record id.");
      out.id = id;
    } else if (key === "email" && value.startsWith("eq.")) {
      const email = decodeURIComponent(value.slice(3)).trim().toLowerCase();
      if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Invalid email.");
      out.email = email;
    } else if (key === "order") {
      const m = /^(created_at|joined_at|rank)(?:\.(asc|desc))?$/i.exec(value);
      if (!m) throw new Error("Invalid sort.");
      out.order = { column: m[1], direction: (m[2] || "asc").toUpperCase() };
    } else if (key === "limit") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 10000) throw new Error("Invalid limit.");
      out.limit = n;
    } else {
      throw new Error("Unsupported query parameter.");
    }
  }
  return out;
}

async function all(db, sql, values = []) {
  const result = await db.prepare(sql).bind(...values).all();
  return rowsOf(result);
}

async function hydrateAds(db, items) {
  const ids = [...new Set(items.map(x => x.advertiser_id).filter(Boolean))];
  if (!ids.length) return items.map(x => ({ ...x, advertisers: null }));
  const placeholders = ids.map(() => "?").join(",");
  const advertisers = await all(db, `SELECT id,business_name,owner_name,email,tier,status FROM advertisers WHERE id IN (${placeholders})`, ids);
  const byId = new Map(advertisers.map(x => [x.id, x]));
  return items.map(x => ({ ...x, advertisers: byId.get(x.advertiser_id) || null }));
}

async function readTable(db, table, query) {
  if (table === "profiles") {
    // Admin identity is already authenticated by the shared Command Centre cookie.
    return [{ id: "admin", email: "singbless89@gmail.com", role: "admin" }];
  }

  if (table === "partner_content") {
    const limit = Math.min(1000, Math.max(1, Number(new URLSearchParams(query).get("limit") || 500)));
    const currentSql = `SELECT * FROM (
      SELECT i.id,i.advertiser_id,a.business_name,a.owner_name,a.email,
        i.title AS content_title, i.item_type AS content_kind,i.image_url AS content_image_url,
        CASE WHEN i.moderation_status='suspended' THEN 'suspended' WHEN i.published=1 THEN 'published' ELSE 'not published' END AS content_status,
        i.updated_at,'catalogue' AS content_table
      FROM partner_catalog_items i JOIN advertisers a ON a.id=i.advertiser_id
      UNION ALL
      SELECT p.id,p.advertiser_id,a.business_name,a.owner_name,a.email,
        p.title AS content_title,'story' AS content_kind,p.cover_image_url AS content_image_url,CASE WHEN p.moderation_status='suspended' THEN 'suspended' WHEN p.status='published' THEN 'published' ELSE 'draft' END AS content_status,
        p.updated_at,'stories' AS content_table
      FROM partner_posts p JOIN advertisers a ON a.id=p.advertiser_id
      UNION ALL
      SELECT pg.id,pg.advertiser_id,a.business_name,a.owner_name,a.email,
        pg.title AS content_title,'page' AS content_kind,NULL AS content_image_url,
        CASE WHEN pg.moderation_status='suspended' THEN 'suspended' WHEN pg.published=1 THEN 'published' ELSE 'not published' END AS content_status,
        pg.updated_at,'pages' AS content_table
      FROM partner_pages pg JOIN advertisers a ON a.id=pg.advertiser_id
    ) ORDER BY updated_at DESC LIMIT ${limit}`;
    try { return await all(db, currentSql); }
    catch (error) {
      if (!/no such column: (?:i|p|pg)\\.moderation_status|no such column: moderation_status/i.test(String(error?.message||error))) throw error;
      const compatibleSql = `SELECT * FROM (
        SELECT i.id,i.advertiser_id,a.business_name,a.owner_name,a.email,i.title AS content_title,
          i.item_type AS content_kind,i.image_url AS content_image_url,
          CASE WHEN i.published=1 THEN 'published' ELSE 'not published' END AS content_status,
          i.updated_at,'catalogue' AS content_table
        FROM partner_catalog_items i JOIN advertisers a ON a.id=i.advertiser_id
        UNION ALL
        SELECT p.id,p.advertiser_id,a.business_name,a.owner_name,a.email,p.title AS content_title,
          'story' AS content_kind,p.cover_image_url AS content_image_url,
          CASE WHEN p.status='published' THEN 'published' ELSE 'draft' END AS content_status,
          p.updated_at,'stories' AS content_table
        FROM partner_posts p JOIN advertisers a ON a.id=p.advertiser_id
        UNION ALL
        SELECT pg.id,pg.advertiser_id,a.business_name,a.owner_name,a.email,pg.title AS content_title,
          'page' AS content_kind,NULL AS content_image_url,
          CASE WHEN pg.published=1 THEN 'published' ELSE 'not published' END AS content_status,
          pg.updated_at,'pages' AS content_table
        FROM partner_pages pg JOIN advertisers a ON a.id=pg.advertiser_id
      ) ORDER BY updated_at DESC LIMIT ${limit}`;
      console.warn("Partner admin content moderation columns are not yet deployed; returning compatible content status.",String(error).slice(0,180));
      return all(db, compatibleSql);
    }
  }
  const q = parseQuery(query);
  if (table === "tier_config") {
    return all(db, "SELECT tier,rank,weight,ad_limit FROM tier_config ORDER BY rank ASC");
  }

  const columns = {
    ads: "*",
    advertisers: "*",
    advertiser_profiles: "*",
    ad_reports: "*",
    ad_moderation_log: "*",
    ad_impressions: "ad_id,source",
    ad_clicks: "ad_id,source"
  };
  const where = [];
  const values = [];
  if (q.id) { where.push("id = ?"); values.push(q.id); }
  if (q.email && table === "advertisers") { where.push("lower(email) = ?"); values.push(q.email); }
  let sql = `SELECT ${columns[table]} FROM ${table}`;
  if (where.length) sql += " WHERE " + where.join(" AND ");

  const allowedOrder = {
    ads: ["created_at"],
    advertisers: ["joined_at", "created_at"],
    ad_reports: ["created_at"],
    ad_moderation_log: ["created_at"]
  };
  if (q.order && allowedOrder[table]?.includes(q.order.column)) {
    sql += ` ORDER BY ${q.order.column} ${q.order.direction}`;
  } else if (!q.order && table === "ads") {
    sql += " ORDER BY created_at DESC";
  } else if (!q.order && table === "advertisers") {
    sql += " ORDER BY joined_at DESC";
  } else if (!q.order && ["ad_reports", "ad_moderation_log"].includes(table)) {
    sql += " ORDER BY created_at DESC";
  }
  if (q.limit) sql += " LIMIT " + q.limit;
  const result = await all(db, sql, values);

  if (table === "ads") return hydrateAds(db, result);
  if (table === "ad_reports") {
    const ads = await hydrateAds(db, await all(db,
      `SELECT id,title,slug,advertiser_id FROM ads WHERE id IN (${result.map(() => "?").join(",") || "NULL"})`,
      result.map(x => x.ad_id)
    ));
    const byId = new Map(ads.map(x => [x.id, x]));
    return result.map(x => ({ ...x, ads: byId.get(x.ad_id) || null }));
  }
  if (table === "ad_moderation_log") {
    const ids = [...new Set(result.map(x => x.ad_id).filter(Boolean))];
    const ads = ids.length ? await all(db,
      `SELECT id,title FROM ads WHERE id IN (${ids.map(() => "?").join(",")})`, ids
    ) : [];
    const byId = new Map(ads.map(x => [x.id, x]));
    return result.map(x => ({ ...x, ads: byId.get(x.ad_id) || null }));
  }
  return result;
}

async function writeTable(db, body) {
  const { table, action, values } = body;
  if (table === "partner_content" && action === "moderate-content") {
    const id = String(body.id || "");
    const kind = String(body.content_table || "");
    const operation = String(body.operation || "");
    if (!UUID.test(id) || !["catalogue","stories","pages"].includes(kind) || !["hide","restore","delete"].includes(operation)) {
      throw new Error("Invalid partner content moderation request.");
    }
    const target = kind === "catalogue" ? "partner_catalog_items" : kind === "stories" ? "partner_posts" : "partner_pages";
    if (operation === "delete") {
      const result = await db.prepare(`DELETE FROM ${target} WHERE id=?`).bind(id).run();
      if (!result.meta || result.meta.changes === 0) throw new Error("Content not found.");
      return { ok: true, operation };
    }
    if (operation === "hide") {
      if (kind === "stories") {
        await db.prepare("UPDATE partner_posts SET moderation_status='suspended',status='archived',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(id).run();
      } else {
        await db.prepare(`UPDATE ${target} SET moderation_status='suspended',published=0,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`).bind(id).run();
      }
    } else {
      if (kind === "stories") {
        await db.prepare("UPDATE partner_posts SET moderation_status='approved',status='published',published_at=COALESCE(published_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(id).run();
      } else {
        await db.prepare(`UPDATE ${target} SET moderation_status='approved',published=1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`).bind(id).run();
      }
    }
    return { ok: true, operation };
  }
  if (!TABLES.has(table) || !values || typeof values !== "object" || Array.isArray(values)) {
    throw new Error("Invalid advertising update.");
  }

  if (action === "insert-log" && table === "ad_moderation_log") {
    const allowed = new Set(["ad_id", "action", "reason", "notes", "performed_by"]);
    if (Object.keys(values).some(k => !allowed.has(k)) || !String(values.action || "").trim()) {
      throw new Error("Invalid moderation log entry.");
    }
    const id = crypto.randomUUID();
    await db.prepare(`INSERT INTO ad_moderation_log
      (id,ad_id,action,reason,performed_by,notes)
      VALUES(?,?,?,?,?,?)`).bind(
        id,
        values.ad_id && UUID.test(String(values.ad_id)) ? values.ad_id : null,
        String(values.action).slice(0,80),
        values.reason == null ? null : String(values.reason).slice(0,1000),
        "admin",
        values.notes == null ? null : String(values.notes).slice(0,2000)
      ).run();
    return all(db, "SELECT * FROM ad_moderation_log WHERE id = ?", [id]);
  }

  const writable = WRITABLE[table];
  if (!writable || Object.keys(values).length === 0 || Object.keys(values).some(k => !writable.has(k))) {
    throw new Error("This advertising field cannot be changed.");
  }
  const q = parseQuery(String(body.query || ""));
  if (!q.id) throw new Error("A valid record id is required.");

  if (table === "ads" && values.status && !["approved", "rejected", "banned", "paused"].includes(String(values.status))) {
    throw new Error("Invalid ad status.");
  }
  if (table === "advertisers") {
    if (values.status && !["active", "suspended", "pending", "approved"].includes(String(values.status))) throw new Error("Invalid advertiser status.");
    if (values.tier && !["free", "starter", "standard", "business", "premium"].includes(String(values.tier))) throw new Error("Invalid advertiser tier.");
  }
  if (table === "ad_reports" && typeof values.resolved !== "boolean") throw new Error("Invalid report status.");
  if (table === "advertiser_profiles" && typeof values.verified !== "boolean") throw new Error("Invalid verification status.");

  const keys = Object.keys(values);
  const assignments = keys.map(k => `${k} = ?`).join(", ");
  const params = keys.map(k => {
    const value = values[k];
    if (table === "ad_reports" || table === "advertiser_profiles") return value ? 1 : 0;
    return value == null ? null : String(value).slice(0, 2000);
  });
  params.push(q.id);
  const result = await db.prepare(`UPDATE ${table} SET ${assignments} WHERE id = ?`).bind(...params).run();
  if (!result.meta || result.meta.changes === 0) throw new Error("Record not found or unchanged.");
  if (table === "advertisers" && values.tier) {
    const tier = await db.prepare("SELECT rotation_weight FROM ad_tiers WHERE tier=?").bind(String(values.tier)).first();
    await db.prepare("UPDATE ads SET weight=? WHERE advertiser_id=? AND status IN ('pending','approved')").bind(Number(tier?.rotation_weight||1),q.id).run();
  }
  return all(db, `SELECT * FROM ${table} WHERE id = ?`, [q.id]);
}

export async function onRequest({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin request blocked." }, 403);
  if (!await getAdminSession(request, env)) return json({ error: "Command Centre sign-in required." }, 401);
  if (!env.DB) return json({ error: "Cloudflare D1 database binding DB is unavailable." }, 503);

  const url = new URL(request.url);
  try {
    if (request.method === "GET") {
      const table = url.searchParams.get("table") || "";
      const query = url.searchParams.get("query") || "";
      if (!TABLES.has(table)) return json({ error: "Invalid advertising data request." }, 400);
      return json(await readTable(env.DB, table, query));
    }
    if (request.method === "POST") {
      const raw = await request.text();
      if (raw.length > 12000) return json({ error: "Request is too large." }, 413);
      const body = JSON.parse(raw);
      return json({ ok: true, rows: await writeTable(env.DB, body) });
    }
    return json({ error: "Method not allowed." }, 405);
  } catch (error) {
    const message = String(error && error.message || "");
    console.error("Ads admin D1 request failed", message.slice(0, 240));
    const clientError = /Invalid|Unsupported|cannot be changed|required|not found/i.test(message);
    return json({ error: clientError ? message : "The advertising database request failed." }, clientError ? 400 : 503);
  }
}
