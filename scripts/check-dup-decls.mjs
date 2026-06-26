import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js', 'app');
const issues = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.name.endsWith('.js')) checkFile(full);
  }
}

function checkFile(fp) {
  const src = fs.readFileSync(fp, 'utf8');
  const decls = new Map();
  const re = /(?:^|[;\n])\s*(?:let|var|const)\s+([A-Za-z_$][\w$]*)\s*=/gm;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    const line = src.slice(0, m.index).split('\n').length;
    if (!decls.has(name)) decls.set(name, []);
    decls.get(name).push(line);
  }
  for (const [name, lines] of decls) {
    if (lines.length > 1) {
      issues.push({ file: path.relative(appDir, fp), name, lines });
    }
  }
}

walk(appDir);
if (issues.length) {
  console.error(JSON.stringify(issues, null, 2));
  process.exit(1);
}
console.log('No duplicate top-level declarations');
