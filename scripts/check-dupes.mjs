import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js', 'app');
const dupes = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.name.endsWith('.js')) checkFile(full);
  }
}

function checkFile(fp) {
  const src = fs.readFileSync(fp, 'utf8');
  const imports = [...src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"](\.\/[^'"]+)['"]/g)];
  const imported = new Set();
  for (const m of imports) {
    m[1].split(',').forEach((s) => {
      const n = s.trim().replace(/^type\s+/, '');
      if (n) imported.add(n);
    });
  }
  for (const name of imported) {
    const localRe = new RegExp(
      '(?:^|[;\\n])\\s*export\\s+(?:async\\s+)?function\\s+' +
        name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\('
    );
    if (localRe.test(src)) {
      dupes.push({ file: path.relative(appDir, fp), name });
    }
  }
}

walk(appDir);
if (dupes.length) {
  console.error('Duplicate import+declare:', JSON.stringify(dupes, null, 2));
  process.exit(1);
}
console.log('No duplicate import+declare in js/app');
