const fs   = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, 'figma-to-markdown-bundle.json');
const outputDir  = path.join(__dirname, 'figma-to-markdown');

const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));

let count = 0;
for (const [relPath, content] of Object.entries(bundle.files)) {
  const fullPath = path.join(outputDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('  ✅  ' + relPath);
  count++;
}

console.log('\n🎉  Done! ' + count + ' files written to: ' + outputDir);
console.log('\nNext steps:');
console.log('  cd figma-to-markdown');
console.log('  npm install');
console.log('  cp .env.example .env');
console.log('  npm run dev');
