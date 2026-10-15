#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = __dirname;
const productsDir = path.join(root, 'content', 'products');
const blogDir = path.join(root, 'content', 'blog');

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return {};
  const result = {};
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if (value === '' && i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) {
      const items = [];
      while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) {
        items.push(lines[++i].replace(/^\s+-\s+/, '').trim().replace(/^['"]|['"]$/g, ''));
      }
      result[key] = items;
      continue;
    }
    value = value.replace(/^['"]|['"]$/g, '');
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    result[key] = value;
  }
  return result;
}

try {
  const productSlugs = fs.readdirSync(productsDir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .map(f => f.replace(/\.md$/, ''))
    .sort();
  fs.writeFileSync(path.join(productsDir, 'index.json'), JSON.stringify(productSlugs, null, 2));

  // Build one compact product catalogue for storefront listing pages.
  // This replaces dozens of per-product Markdown requests on every page load.
  const productCatalog = productSlugs.map(slug => {
    const source = fs.readFileSync(path.join(productsDir, slug + '.md'), 'utf8');
    const meta = parseFrontmatter(source);
    return {
      slug,
      title: String(meta.title || slug),
      price: Number(meta.price) || 0,
      original_price: Number(meta.original_price) || 0,
      stock: Number(meta.stock) || 0,
      category: String(meta.category || 'other'),
      description: String(meta.description || ''),
      image: String(meta.image || ''),
      video_url: String(meta.video_url || ''),
      order_note: String(meta.order_note || ''),
      featured: meta.featured === true || meta.featured === 'true',
      date_added: String(meta.date_added || meta.created_at || ''),
      gallery: []
    };
  });
  fs.writeFileSync(path.join(productsDir, 'catalog.json'), JSON.stringify(productCatalog));
  console.log('Product catalogue built: ' + productCatalog.length + ' products');

  console.log('Product index built: ' + productSlugs.length + ' products');

  fs.mkdirSync(blogDir, { recursive: true });
  const blogPosts = fs.readdirSync(blogDir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .map(file => {
      const slug = file.replace(/\.md$/, '');
      const source = fs.readFileSync(path.join(blogDir, file), 'utf8');
      const meta = parseFrontmatter(source);
      if (meta.publish !== true) return null;
      const body = source.replace(/^---\s*\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
      const bodyVideo = body.match(/https?:\/\/(?:www\.)?(?:youtu\.be\/[A-Za-z0-9_-]{6,}|youtube\.com\/(?:watch\?v=[A-Za-z0-9_-]{6,}|shorts\/[A-Za-z0-9_-]{6,}|embed\/[A-Za-z0-9_-]{6,}|live\/[A-Za-z0-9_-]{6,})[^\s)<>]*)/i);
      const videoUrl = String(meta.video_url || (bodyVideo ? bodyVideo[0].replace(/[.,!?]+$/, '') : ''));
      return {
        slug,
        title: String(meta.title || 'PhoneYa2 Update'),
        date: String(meta.date || ''),
        category: String(meta.category || 'PhoneYa2 Updates'),
        excerpt: String(meta.excerpt || ''),
        image: String(meta.featured_image || ''),
        video_url: videoUrl,
        author: String(meta.author || 'PhoneYa2'),
        featured: meta.featured === true,
        publish: true,
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        related_products: Array.isArray(meta.related_products) ? meta.related_products : []
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  fs.writeFileSync(path.join(blogDir, 'index.json'), JSON.stringify(blogPosts, null, 2));
  console.log('Published blog index built: ' + blogPosts.length + ' posts');
} catch (err) {
  console.error('Failed to build content indexes:', err.message);
  process.exit(1);
}
