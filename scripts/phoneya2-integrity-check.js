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
  'advertiser/index.html',
  'ads-admin/index.html'
].reduce((total, file) => total + parseInlineScripts(file), 0);

console.log('PhoneYa2 integrity checks passed.');
console.log('Products verified: ' + productIndex.length);
console.log('Published blog posts verified: ' + blogSlugs.length);
console.log('Unique sitemap URLs verified: ' + locations.length);
console.log('Core inline JavaScript blocks parsed: ' + inlineScriptCount);
