#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sitemapPath = path.join(root, 'sitemap.xml');
const indexPath = path.join(root, 'content', 'products', 'index.json');
const catalogPath = path.join(root, 'content', 'products', 'catalog.json');
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
  if (!Array.isArray(slugs) || slugs.some(s => typeof s !== 'string' || !/^[^\s/\\?#]{1,150}$/u.test(s))) {
    throw new Error('Product index must be an array of valid product slugs.');
  }
  if (new Set(slugs).size !== slugs.length) throw new Error('Product index contains duplicate slugs.');
  pass('Product index parses and contains unique, valid slugs (' + slugs.length + ').');
} catch (error) {
  fail('Product index validation failed: ' + error.message);
  process.exit();
}

try {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  if (!Array.isArray(catalog) || catalog.length !== slugs.length) throw new Error('Product catalogue count does not match product index.');
  const requiredSalesFields = ['sales_hook', 'offer_label', 'offer_details', 'sales_priority'];
  for (const product of catalog) {
    if (!product || !slugs.includes(product.slug)) throw new Error('Catalogue contains a product absent from the index.');
    if (requiredSalesFields.some(field => typeof product[field] !== 'string')) throw new Error('Sales messaging fields are missing for ' + product.slug + '.');
    if (!Number.isFinite(Number(product.price)) || Number(product.price) < 0) throw new Error('Invalid price for ' + product.slug + '.');
  }
  pass('Product catalogue includes all products and CMS-managed sales fields (' + catalog.length + ').');
} catch (error) {
  fail('Product catalogue validation failed: ' + error.message);
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

const seasonalPath = path.join(root, 'content', 'settings', 'seasonal-campaigns.json');
try {
  const seasonal = JSON.parse(fs.readFileSync(seasonalPath, 'utf8'));
  if (seasonal.enabled && seasonal.scheduled) {
    const validDay = value => typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value + 'T00:00:00.000Z')) &&
      new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) === value;
    if (!validDay(seasonal.start) || !validDay(seasonal.end) || seasonal.start > seasonal.end) {
      fail('Enabled scheduled seasonal campaign has an invalid date window.');
    } else {
      pass('Seasonal campaign schedule is valid (' + seasonal.start + ' to ' + seasonal.end + ').');
    }
  } else {
    pass('Seasonal campaign configuration parses.');
  }
} catch (error) {
  fail('Seasonal campaign configuration is invalid: ' + error.message);
}

const notificationApiPath = path.join(root, 'functions', 'api', 'store-notifications.js');
try {
  const api = fs.readFileSync(notificationApiPath, 'utf8');
  for (const [label, pattern] of [
    ['idempotent notification upsert', /ON CONFLICT\(event_key\) DO UPDATE/],
    ['metadata merge protection', /json_valid\(store_notifications\.metadata_json\)/],
    ['scheduled campaign date validation', /seasonal\.scheduled===true/],
    ['campaign expiry', /expires_at/]
  ]) {
    if (!pattern.test(api)) fail('Store notification API is missing ' + label + '.');
  }
  pass('Store notification persistence and schedule safeguards are present.');
} catch (error) {
  fail('Store notification API could not be validated: ' + error.message);
}

const migrationPath = path.join(root, 'd1', 'migrations', '0023_store_notification_engine.sql');
try {
  const migration = fs.readFileSync(migrationPath, 'utf8');
  for (const table of ['store_notifications', 'store_notification_snapshots', 'store_notification_state', 'store_visitor_events', 'store_cart_sessions']) {
    if (!new RegExp('CREATE TABLE IF NOT EXISTS\\\\s+' + table + '\\\\b', 'i').test(migration)) {
      fail('Store notification migration is missing table ' + table + '.');
    }
  }
  pass('Store notification D1 migration includes all required tables.');
} catch (error) {
  fail('Store notification D1 migration is missing or unreadable: ' + error.message);
}

const schedulerPath = path.join(root, 'workers', 'notification-scheduler', 'wrangler.toml');
try {
  const scheduler = fs.readFileSync(schedulerPath, 'utf8');
  if (!/name\\s*=\\s*["']phoneya2-notification-scheduler["']/.test(scheduler) ||
      !/crons\\s*=\\s*\\[["']\\*\\/15 \\* \\* \\* \\*["']\\]/.test(scheduler)) {
    fail('Notification scheduler worker is missing its expected 15-minute cron configuration.');
  } else {
    pass('Notification scheduler configuration is present.');
  }
} catch (error) {
  fail('Notification scheduler configuration is missing or unreadable: ' + error.message);
}

if (!process.exitCode) console.log('PhoneYa2 repository integrity checks passed.');
