export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ ok: false, error: "Community database is not configured." }, { status: 503 });
  try {
    const result = await env.DB.prepare(`
      SELECT p.id, p.title, p.slug, p.excerpt, p.body, p.cover_image_url,
             p.post_type, p.published_at,
             a.business_name, a.logo_url, a.tier,
             pr.slug AS business_slug, pr.tagline,
             CASE WHEN sub.package_key IS NOT NULL AND sub.package_key != 'free' THEN 1 ELSE 0 END AS is_featured,
             COALESCE(pkg.advertising_weight, 0) AS feature_weight
      FROM partner_posts AS p
      JOIN advertisers AS a ON a.id = p.advertiser_id
      LEFT JOIN advertiser_profiles AS pr ON pr.advertiser_id = a.id
      LEFT JOIN partner_subscriptions AS sub
        ON sub.advertiser_id = a.id AND sub.status = 'active'
      LEFT JOIN partner_packages AS pkg ON pkg.package_key = sub.package_key
      WHERE p.status = 'published'
        AND p.moderation_status = 'approved'
        AND a.status IN ('active', 'approved')
      ORDER BY is_featured DESC, feature_weight DESC,
               COALESCE(p.published_at, p.created_at) DESC
      LIMIT 60
    `).all();
    return Response.json({ ok: true, posts: result.results || [] }, {
      headers: { "cache-control": "public, max-age=30, s-maxage=60" }
    });
  } catch (error) {
    console.error("Community feed failed", error?.stack || error);
    return Response.json({ ok: false, error: "The community feed could not be loaded." }, { status: 500 });
  }
}
