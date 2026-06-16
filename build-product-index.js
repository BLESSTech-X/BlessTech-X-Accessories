#!/usr/bin/env node
// This script runs during Netlify build to generate content/products/index.json
// It scans the content/products/ folder and lists all .md slugs
// Netlify runs this automatically on every deploy via netlify.toml

const fs = require('fs');
const path = require('path');

const productsDir = path.join(__dirname, 'content', 'products');
const outputFile = path.join(productsDir, 'index.json');

try {
  const files = fs.readdirSync(productsDir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .map(f => f.replace('.md', ''))
    .sort();

  fs.writeFileSync(outputFile, JSON.stringify(files, null, 2));
  console.log(`✅ Product index built: ${files.length} products`);
  files.forEach(f => console.log(`   - ${f}`));
} catch (err) {
  console.error('❌ Failed to build product index:', err.message);
  process.exit(1);
}
