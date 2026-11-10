export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ ok: false, error: "Community database is not configured." }, { status: 503 });
  try {
    const now = new Date().toISOString();
    const result = await env.DB.prepare(`
      SELECT p.id, p.title, p.slug, p.excerpt, p.body, p.cover_image_url,
             p.post_type, p.published_at,
             a.business_name,
             COALESCE(NULLIF(a.logo_url, ''), NULLIF(site.logo_url, '')) AS logo_url,
             a.tier,
             pr.slug AS business_slug, pr.tagline,
             CASE WHEN sub.package_key IS NOT NULL AND sub.package_key != 'free' THEN 1 ELSE 0 END AS is_featured,
             COALESCE(pkg.advertising_weight, 0) AS feature_weight
      FROM partner_posts AS p
      JOIN advertisers AS a ON a.id = p.advertiser_id
      LEFT JOIN advertiser_profiles AS pr ON pr.advertiser_id = a.id
      LEFT JOIN partner_site_settings AS site ON site.advertiser_id = a.id
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
    const catalogue = await env.DB.prepare(`
      SELECT i.id, i.title, i.slug, i.summary AS excerpt, i.description AS body,
             i.image_url AS cover_image_url, i.item_type AS post_type,
             i.updated_at AS published_at, a.business_name,
             COALESCE(NULLIF(a.logo_url, ''), NULLIF(site.logo_url, '')) AS logo_url,
             a.tier, pr.slug AS business_slug, pr.tagline,
             CASE WHEN sub.package_key IS NOT NULL AND sub.package_key != 'free' THEN 1 ELSE 0 END AS is_featured,
             COALESCE(pkg.advertising_weight, 0) AS feature_weight,
             i.price_label, i.category, i.availability
      FROM partner_catalog_items AS i
      JOIN advertisers AS a ON a.id = i.advertiser_id
      LEFT JOIN advertiser_profiles AS pr ON pr.advertiser_id = a.id
      LEFT JOIN partner_site_settings AS site ON site.advertiser_id = a.id
      LEFT JOIN partner_subscriptions AS sub
        ON sub.advertiser_id = a.id AND sub.status = 'active'
      LEFT JOIN partner_packages AS pkg ON pkg.package_key = sub.package_key
      WHERE i.published = 1
        AND i.moderation_status = 'approved'
        AND a.status IN ('active', 'approved')
      ORDER BY is_featured DESC, feature_weight DESC, i.updated_at DESC
      LIMIT 100
    `).all();

    const ads = await env.DB.prepare(`
      SELECT ad.id, ad.slug, ad.title, ad.description, ad.media_url,
             ad.media_type, ad.destination_type, ad.destination_url,
             ad.weight, ad.placement, ad.start_date, ad.end_date,
             ad.created_at AS published_at, a.business_name, a.logo_url,
             a.tier, pr.slug AS business_slug
      FROM ads AS ad
      JOIN advertisers AS a ON a.id = ad.advertiser_id
      LEFT JOIN advertiser_profiles AS pr ON pr.advertiser_id = a.id
      WHERE ad.status = 'approved'
        AND a.status IN ('active', 'approved')
        AND (ad.start_date IS NULL OR ad.start_date <= ?)
        AND (ad.end_date IS NULL OR ad.end_date >= ?)
      ORDER BY ad.weight DESC, ad.created_at DESC
      LIMIT 30
    `).bind(now, now).all();

    const sponsored = (ads.results || []).map(ad => ({
      ...ad,
      is_paid_ad: true,
      post_type: 'sponsored',
      excerpt: ad.description || '',
      cover_image_url: ad.media_url || '',
      is_featured: 1
    }));
    const posts = (result.results || []).map(post => ({ ...post, is_paid_ad: false }));
    const productsAndServices = (catalogue.results || []).map(item => ({ ...item, is_paid_ad: false }));
    const combined = [...posts, ...productsAndServices, ...sponsored].sort((a, b) => {
      const featured = Number(b.is_featured || 0) - Number(a.is_featured || 0);
      if (featured) return featured;
      return new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0);
    }).slice(0, 180);

    return Response.json({ ok: true, posts: combined }, {
      headers: { "cache-control": "public, max-age=30, s-maxage=60" }
    });
  } catch (error) {
    console.error("Community feed failed", error?.stack || error);
    return Response.json({ ok: false, error: "The community feed could not be loaded." }, { status: 500 });
  }
}
