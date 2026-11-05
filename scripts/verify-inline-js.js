#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const files = ['index.html', 'shop.html', 'product.html', 'blog.html', 'agents/py2-360.html', 'admin/command-center.html', 'admin/campaigns.html'];
const externalScripts = ['blog-hub.js', 'blog-post.js', 'blog-products.js', 'build-product-index.js', 'cart.js', 'store-notifications.js', 'seasonal-experience.js', 'admin/work-queue.js'];
let checked = 0;
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const tags = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  let inlineIndex = 0;
  while ((match = tags.exec(source))) {
    const attrs = match[1] || '';
    const code = match[2] || '';
    if (/\bsrc\s*=/.test(attrs) || !code.trim()) continue;
    const type = (attrs.match(/\btype\s*=\s*["']([^"']+)["']/i) || [,''])[1].toLowerCase();
    if (type && !['text/javascript','application/javascript'].includes(type)) continue;
    inlineIndex++;
    try {
      new vm.Script(code, { filename: file + '#inline-script-' + inlineIndex });
      checked++;
    } catch (error) {
      console.error('FAIL: Inline JavaScript syntax error in ' + file + ' script ' + inlineIndex + ': ' + error.message);
      process.exitCode = 1;
    }
  }
}
for (const file of externalScripts) {
  try {
    new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
    checked++;
  } catch (error) {
    console.error('FAIL: JavaScript syntax error in ' + file + ': ' + error.message);
    process.exitCode = 1;
  }
}
function collectJavaScript(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? collectJavaScript(full) : (entry.isFile() && entry.name.endsWith('.js') ? [full] : []);
  });
}
const moduleFiles = [
  ...collectJavaScript(path.join(root, 'functions')),
  ...collectJavaScript(path.join(root, 'workers'))
];
for (const file of moduleFiles) {
  const result = spawnSync(process.execPath, ['--check', '--input-type=module'], {
    input: fs.readFileSync(file, 'utf8'),
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    console.error('FAIL: JavaScript module syntax error in ' + path.relative(root, file) + ': ' + (result.stderr || result.stdout).trim());
    process.exitCode = 1;
  } else {
    checked++;
  }
}
if (!process.exitCode) console.log('PASS: Parsed ' + checked + ' inline, storefront and server-side JavaScript modules.');
