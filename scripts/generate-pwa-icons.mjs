/**
 * favicon.svg → PWA PNG 아이콘 생성
 * 사용: node scripts/generate-pwa-icons.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'assets', 'favicon.svg');
const outDir = path.join(root, 'icons');

async function main() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (e) {
    console.error('sharp 패키지가 필요합니다: npm install sharp --no-save');
    process.exit(1);
  }

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const svg = fs.readFileSync(svgPath);

  await sharp(svg).resize(192, 192).png().toFile(path.join(outDir, 'icon-192.png'));
  await sharp(svg).resize(512, 512).png().toFile(path.join(outDir, 'icon-512.png'));
  console.log('Generated icons/icon-192.png, icons/icon-512.png');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
