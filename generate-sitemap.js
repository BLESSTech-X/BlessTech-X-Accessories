#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const baseUrl = 'https://phoneya2.pages.dev';
const productsDir = path.join(__dirname, 'content', 'products');
const indexFile = path.join(productsDir, 'index.json');
const sitemapFile = path.join(__dirname, 'sitemap.xml');
// Static pages (verified to exist in the site root)
const staticPages = [
  { loc: '/', priority: 1.0, changefreq: 'daily' },
  { loc: '/shop.html', priority: 0.9, changefreq: 'daily' },
  { loc: '/about.html', priority: 0.7, changefreq: 'monthly' },
  { loc: '/contact.html', priority: 0.7, changefreq: 'monthly' },
  { loc: '/privacy-policy.html', priority: 0.4, changefreq: 'yearly' },
  { loc: '/return-policy.html', priority: 0.4, changefreq: 'yearly' },
  { loc: '/blog.html', priority: 0.9, changefreq: 'daily' },
];

try {
  if (!fs.existsSync(indexFile)) {
    throw new Error(`index.json not found at ${indexFile}`);
  }

  const indexContent = fs.readFileSync(indexFile, 'utf8');
  const slugs = JSON.parse(indexContent);

  if (!Array.isArray(slugs) || slugs.length === 0) {
    throw new Error('No products found in index.json');
  }

  const productEntries = slugs.map((slug) => ({
    loc: `/product.html?id=${encodeURIComponent(slug)}`,
    priority: 0.8,
    changefreq: 'weekly',
  }));

  const blogIndexFile = path.join(__dirname, 'content', 'blog', 'index.json');
  let blogEntries = [];
  if (fs.existsSync(blogIndexFile)) {
    const posts = JSON.parse(fs.readFileSync(blogIndexFile, 'utf8'));
    if (Array.isArray(posts)) {
      blogEntries = posts.filter(post => post && post.slug).map(post => ({
        loc: `/blog-post.html?slug=${encodeURIComponent(post.slug)}`,
        priority: post.featured ? 0.8 : 0.6,
        changefreq: 'weekly',
      }));
    }
  }

  // Keep every canonical location unique even if a future source accidentally repeats one.
  const combinedEntries = [...staticPages, ...productEntries, ...blogEntries];
  const allEntries = [...new Map(combinedEntries.map(entry => [entry.loc, entry])).values()];

  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
  const xmlNamespace = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

  const urlEntries = allEntries
    .map((entry) => `  <url>
    <loc>${baseUrl}${entry.loc}</loc>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`)
    .join('\n');

  const xmlFooter = '</urlset>';
  const sitemap = `${xmlHeader}\n${xmlNamespace}\n${urlEntries}\n${xmlFooter}\n`;

  fs.writeFileSync(sitemapFile, sitemap, 'utf8');

  console.log(`✅ Sitemap generated: ${sitemapFile}`);
  console.log(`   - Static pages: ${staticPages.length}`);
  console.log(`   - Products: ${productEntries.length}`);
  console.log(`   - Published blog posts: ${blogEntries.length}`);
  console.log(`   - Total URLs: ${allEntries.length}`);
} catch (err) {
  console.error('❌ Failed to generate sitemap:', err.message);
  process.exit(1);
}
