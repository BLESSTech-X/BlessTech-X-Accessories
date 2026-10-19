#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sitemapPath = path.join(root, 'sitemap.xml');
const indexPath = path.join(root, 'content', 'products', 'index.json');
const requiredPages = [
  'index.html', 'shop.html', 'cart.html', 'checkout.html', 'account.html',
  'product.html', 'blog.html', 'blog-post.html', 'advertise/index.html',
  'advertiser/index.html', 'admin/index.html'
];
function fail(message) { console.error('FAIL:', message); process.exitCode = 1; }
function pass(message) { console.log('PASS:', message); }

for (const file of requiredPages) {
  if (!fs.existsSync(path.join(root, file))) fail('Required page missing: ' + file);
}
if (process.exitCode) process.exit();

let slugs;
try {
  slugs = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  if (!Array.isArray(slugs) || slugs.some(s => typeof s !== 'string' || !/^[a-z0-9][a-z0-9-]{0,100}$/.test(s))) {
    throw new Error('Product index must be an array of valid product slugs.');
  }
  if (new Set(slugs).size !== slugs.length) throw new Error('Product index contains duplicate slugs.');
  pass('Product index parses and contains unique, valid slugs (' + slugs.length + ').');
} catch (error) {
  fail('Product index validation failed: ' + error.message);
  process.exit();
}

let xml;
try { xml = fs.readFileSync(sitemapPath, 'utf8'); }
catch { fail('sitemap.xml is missing. Run node generate-sitemap.js first.'); process.exit(); }
if (!/^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">[\s\S]*<\/urlset>\s*$/.test(xml)) {
  fail('Sitemap XML envelope is malformed.');
} else {
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  if (!urls.length) fail('Sitemap has no URLs.');
  if (new Set(urls).size !== urls.length) fail('Sitemap contains duplicate URLs.');
  if (urls.some(url => !/^https:\/\/phoneya2\.pages\.dev\//.test(url))) fail('Sitemap contains an unexpected origin.');
  if (!urls.includes('https://phoneya2.pages.dev/')) fail('Sitemap does not include the homepage.');
  pass('Sitemap envelope and URL list checked (' + urls.length + ' unique URLs).');
}

if (!process.exitCode) console.log('PhoneYa2 repository integrity checks passed.');
