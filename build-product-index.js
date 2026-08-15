#!/usr/bin/env node
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
