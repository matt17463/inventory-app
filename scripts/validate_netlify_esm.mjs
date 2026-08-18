import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('netlify/functions');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
}
walk(root);

const errors = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (/\brequire\s*\(/.test(source)) errors.push(`${file}: CommonJS require() is not allowed.`);
  if (/\bexports\s*\./.test(source) || /\bmodule\.exports\b/.test(source)) errors.push(`${file}: CommonJS exports are not allowed.`);
  if (!/\bexport\s+(?:async\s+)?(?:const|function|\{)/.test(source)) errors.push(`${file}: no ESM export found.`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Validated ${files.length} Netlify JavaScript files as ESM.`);
