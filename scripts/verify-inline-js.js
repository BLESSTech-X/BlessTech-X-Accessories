#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const files = ['index.html', 'shop.html', 'product.html', 'blog.html', 'agents/py2-360.html'];
const externalScripts = ['blog-hub.js', 'blog-post.js', 'blog-products.js', 'build-product-index.js'];
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
if (!process.exitCode) console.log('PASS: Parsed ' + checked + ' inline and external JavaScript blocks across storefront, blog and agent desk.');
