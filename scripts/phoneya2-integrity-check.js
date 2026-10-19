#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const productsDir = path.join(root, 'content', 'products');
const productFiles = fs.readdirSync(productsDir)
  .filter(name => name.endsWith('.md') && name !== 'README.md')
  .map(name => name.slice(0, -3))
  .sort();
const productIndex = JSON.parse(fs.readFileSync(path.join(productsDir, 'index.json'), 'utf8'));
const productCatalog = JSON.parse(fs.readFileSync(path.join(productsDir, 'catalog.json'), 'utf8'));

assert.deepEqual(productIndex, productFiles, 'Product index must exactly match Markdown product files.');
assert.equal(new Set(productIndex).size, productIndex.length, 'Product index must not contain duplicate slugs.');
for (const slug of productIndex) {
  assert.ok(slug.length > 0 && slug.length <= 101, 'Product slug length is invalid: ' + slug);
  assert.ok(slug !== '.' && slug !== '..', 'Product slug cannot be a dot path: ' + slug);
  assert.ok(!/[\/\\\u0000-\u001f\u007f?#]/.test(slug), 'Product slug contains a path separator, control character, or URL delimiter: ' + slug);
}
assert.deepEqual(productCatalog.map(product => product.slug), productIndex, 'Product catalogue order/slugs must match the generated product index.');

const blogIndex = JSON.parse(fs.readFileSync(path.join(root, 'content', 'blog', 'index.json'), 'utf8'));
assert.ok(Array.isArray(blogIndex), 'Published blog index must be an array.');
const blogSlugs = blogIndex.filter(post => post && post.slug).map(post => post.slug);
assert.equal(new Set(blogSlugs).size, blogSlugs.length, 'Published blog index must not contain duplicate slugs.');

const checkoutHtml = fs.readFileSync(path.join(root, 'checkout.html'), 'utf8');
const cartHtml = fs.readFileSync(path.join(root, 'cart.html'), 'utf8');
const orderApi = fs.readFileSync(path.join(root, 'functions', 'api', 'orders.js'), 'utf8');
const idempotencySql = fs.readFileSync(path.join(root, 'supabase', 'order-idempotency-migration.sql'), 'utf8');

assert.ok(checkoutHtml.includes('phoneya2-order-idempotency-v1'), 'Checkout must persist its idempotency key for retries.');
assert.ok(checkoutHtml.includes('result.replayed'), 'Checkout must explain when a retry recovered an existing order.');
assert.ok(checkoutHtml.includes('Your order may already be saved. Keep these details unchanged'), 'Checkout must guide customers through an uncertain-response retry without changing the request.');
assert.ok(!checkoutHtml.includes('/^[a-z0-9][a-z0-9-]{0,100}$/'), 'Checkout must not reject valid Unicode product slugs.');
assert.ok(!cartHtml.includes('/^[a-z0-9][a-z0-9-]{0,100}$/'), 'Cart must not reject valid Unicode product slugs.');
assert.ok(orderApi.includes('request_fingerprint&limit=1'), 'Order API must look up an existing request before current catalogue validation.');
assert.ok(orderApi.includes('could not confirm whether your order was saved'), 'Order API must not falsely claim a failed response means no order exists.');
assert.ok(orderApi.includes('p_request_fingerprint: requestFingerprint'), 'Order API must pass its request fingerprint to the database transaction.');
assert.ok(orderApi.includes('different order details') && orderApi.includes('}, 409);'), 'Order API must return a conflict when a key is reused with different details.');
assert.ok(idempotencySql.includes('pg_advisory_xact_lock'), 'Database order creation must serialize simultaneous retries.');
assert.ok(idempotencySql.includes('CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_unique'), 'Database must enforce unique idempotency keys.');
assert.ok(idempotencySql.includes('ADD COLUMN IF NOT EXISTS request_fingerprint TEXT'), 'Database migration must store the request fingerprint.');
assert.ok(!idempotencySql.includes('DROP FUNCTION IF EXISTS public.create_phoneya2_order(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT);'), 'Migration must preserve the legacy RPC signature for a controlled rollback.');

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
assert.ok(locations.length > 0, 'Sitemap must contain at least one URL.');
assert.equal(new Set(locations).size, locations.length, 'Sitemap must not contain duplicate URL locations.');
assert.ok(sitemap.startsWith('<?xml'), 'Sitemap must begin with an XML declaration.');

function parseServerScript(relativePath) {
  const file = path.join(root, relativePath);
  const source = fs.readFileSync(file, 'utf8')
    .replace(/^export\s+(?=(?:async\s+)?function\b)/gm, '')
    .replace(/^export\s+(?=(?:const|let|var|class)\b)/gm, '');
  new vm.Script(source, { filename: relativePath });
}
[
  'functions/api/orders.js',
  'functions/api/agent-dashboard.js',
  'functions/api/analytics.js',
  'functions/api/public-analytics.js',
  'build-product-index.js',
  'generate-sitemap.js'
].forEach(parseServerScript);

function parseInlineScripts(relativePath) {
  const html = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const tags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  let parsed = 0;
  for (const [, attributes, code] of tags) {
    if (!code.trim() || /\bsrc\s*=/.test(attributes)) continue;
    const type = (attributes.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || 'text/javascript';
    if (!/^(text|application)\/(javascript|ecmascript)$/i.test(type)) continue;
    new vm.Script(code, { filename: relativePath + ' inline script ' + (parsed + 1) });
    parsed++;
  }
  return parsed;
}
const inlineScriptCount = [
  'agents/py2-360.html',
  'admin/command-center.html',
  'checkout.html',
  'cart.html',
  'advertiser/index.html',
  'ads-admin/index.html'
].reduce((total, file) => total + parseInlineScripts(file), 0);

console.log('PhoneYa2 integrity checks passed.');
console.log('Products verified: ' + productIndex.length);
console.log('Published blog posts verified: ' + blogSlugs.length);
console.log('Unique sitemap URLs verified: ' + locations.length);
console.log('Core inline JavaScript blocks parsed: ' + inlineScriptCount);
console.log('Checkout idempotency and Unicode slug safeguards verified.');
