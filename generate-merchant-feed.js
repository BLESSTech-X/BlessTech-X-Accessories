#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const baseUrl = 'https://phoneya2.pages.dev';
const productsDir = path.join(__dirname, 'content', 'products');
const feedFile = path.join(__dirname, 'merchant-feed.xml');

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseFrontMatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const data = {};
  let currentKey = null;

  for (const rawLine of match[1].split(/\r?\n/)) {
    if (!rawLine.trim()) continue;

    const keyMatch = rawLine.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      data[currentKey] = keyMatch[2].trim();
      continue;
    }

    // Support simple folded multiline scalar values such as descriptions.
    if (/^\s+/.test(rawLine) && currentKey && typeof data[currentKey] === 'string') {
      const continuation = rawLine.trim();
      if (continuation && !continuation.startsWith('- ')) {
        data[currentKey] += ' ' + continuation;
      }
    }
  }

  for (const key of Object.keys(data)) {
    let value = data[key].trim();

    // Remove simple matching YAML quotes.
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    data[key] = value.replace(/\\n/g, ' ').replace(/\\r/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return data;
}

function absoluteUrl(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return baseUrl + value;
  return baseUrl + '/' + value.replace(/^\.\//, '');
}

function merchantProductId(slug) {
  // Google Merchant Center limits product IDs to 50 characters.
  // Keep existing short IDs unchanged; shorten only long slugs deterministically.
  if (slug.length <= 50) return slug;
  const hash = crypto.createHash('sha1').update(slug).digest('hex').slice(0, 8);
  return `${slug.slice(0, 41)}-${hash}`;
}

function cleanDescription(value, title) {
  const description = String(value || '').replace(/<[^>]*>/g, '').trim();
  return description || title;
}

function generateFeed() {
  if (!fs.existsSync(productsDir)) {
    throw new Error(`Products directory not found: ${productsDir}`);
  }

  const files = fs.readdirSync(productsDir)
    .filter(file => file.endsWith('.md') && file !== 'README.md')
    .sort();

  if (files.length === 0) {
    throw new Error('No product Markdown files found');
  }

  const items = [];
  let skipped = 0;

  for (const file of files) {
    const slug = file.slice(0, -3);
    const content = fs.readFileSync(path.join(productsDir, file), 'utf8');
    const product = parseFrontMatter(content);

    const title = product.title;
    const price = Number.parseFloat(product.price);
    const stock = Number.parseInt(product.stock, 10);
    const image = absoluteUrl(product.image);

    if (!title || !Number.isFinite(price) || price < 0 || !image) {
      skipped++;
      console.warn(`⚠️ Skipping ${file}: missing title, valid price, or image`);
      continue;
    }

    const availability = Number.isFinite(stock) && stock > 0 ? 'in_stock' : 'out_of_stock';
    const link = `${baseUrl}/product.html?id=${encodeURIComponent(slug)}`;
    const merchantId = merchantProductId(slug);

    items.push(`    <item>
      <g:id>${xmlEscape(merchantId)}</g:id>
      <g:title>${xmlEscape(title)}</g:title>
      <g:description>${xmlEscape(cleanDescription(product.description, title))}</g:description>
      <g:link>${xmlEscape(link)}</g:link>
      <g:image_link>${xmlEscape(image)}</g:image_link>
      <g:availability>${availability}</g:availability>
      <g:price>${price.toFixed(2)} ZMW</g:price>
      <g:condition>new</g:condition>
      <g:product_type>${xmlEscape(product.category || 'Accessories')}</g:product_type>
    </item>`);
  }

  if (items.length === 0) {
    throw new Error('No valid products were available for the Merchant Center feed');
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>PhoneYa2-ZM Product Feed</title>
    <link>${baseUrl}/</link>
    <description>PhoneYa2-ZM products available in Zambia</description>
${items.join('\n')}
  </channel>
</rss>
`;

  fs.writeFileSync(feedFile, xml, 'utf8');

  console.log(`✅ Merchant Center feed generated: ${feedFile}`);
  console.log(`   - Products included: ${items.length}`);
  console.log(`   - Products skipped: ${skipped}`);
}

if (require.main === module) {
  try {
    generateFeed();
  } catch (err) {
    console.error('❌ Failed to generate Merchant Center feed:', err.message);
    process.exit(1);
  }
}

module.exports = { generateFeed };
