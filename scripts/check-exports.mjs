import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const boot = fs.readFileSync(path.join(root, 'js/app/appBootstrap.js'), 'utf8');
const imports = [...boot.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"](\.\/[^'"]+)['"]/g)];
const missing = [];

for (const m of imports) {
  const names = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  let rel = m[2].replace(/\?v=[^'"]+/, '');
  const fp = path.join(root, 'js/app', rel.replace('./', ''));
  if (!fs.existsSync(fp)) {
    missing.push({ file: m[2], name: '*', err: 'file missing: ' + fp });
    continue;
  }
  const src = fs.readFileSync(fp, 'utf8');
  for (const n of names) {
    const clean = n.replace(/^type\s+/, '');
    const re = new RegExp(
      'export\\s+(async\\s+)?(function|const|class)\\s+' +
        clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'
    );
    if (!re.test(src)) missing.push({ file: m[2], name: clean });
    const localRe = new RegExp(
      '(?:^|;)\\s*(?:export\\s+)?(?:async\\s+)?function\\s+' +
        clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\('
    );
    const importRe = new RegExp(
      'import\\s*\\{[^}]*\\b' + clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'
    );
    if (importRe.test(src) && localRe.test(src)) {
      missing.push({ file: m[2], name: clean, err: 'imported and redeclared locally' });
    }
  }
}

if (missing.length) {
  console.error('Missing exports:', JSON.stringify(missing, null, 2));
  process.exit(1);
}
console.log('All appBootstrap imports OK (' + imports.length + ' modules)');
