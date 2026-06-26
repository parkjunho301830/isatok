/**
 * CSV 선수 목록 → Firestore members.phone 일괄 반영
 * 사용: node scripts/import-member-phones.mjs "경로/이사탁_선수목록_YYYYMMDD.csv"
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '..', 'functions', 'package.json'));
const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
} = require('firebase/firestore');

const FB = {
  apiKey: 'AIzaSyDttEMgDQx3iS2siRzVIizxBBDZ4KjcJEw',
  authDomain: 'isatok-ef06a.firebaseapp.com',
  projectId: 'isatok-ef06a',
  storageBucket: 'isatok-ef06a.firebasestorage.app',
  messagingSenderId: '480704214424',
  appId: '1:480704214424:web:1f02fea9630e395bbb27ed',
};

const BATCH_SIZE = 400;
const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/import-member-phones.mjs <csv-file>');
  process.exit(1);
}

function parseCsvLine(line) {
  var out = [];
  var cur = '';
  var inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  var lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(function (l) { return l.trim(); });
  if (!lines.length) return [];
  var headers = parseCsvLine(lines[0]);
  var idIdx = headers.indexOf('ID');
  var phoneIdx = headers.indexOf('휴대폰');
  if (idIdx < 0 || phoneIdx < 0) throw new Error('CSV must have ID and 휴대폰 columns');
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = parseCsvLine(lines[i]);
    var id = (cols[idIdx] || '').trim();
    var phone = (cols[phoneIdx] || '').trim();
    if (id && phone) rows.push({ id: id, phone: phone });
  }
  return rows;
}

const app = initializeApp(FB);
const db = getFirestore(app);

const raw = fs.readFileSync(csvPath, 'utf8');
const rows = parseCsv(raw);
console.log('CSV rows with phone: ' + rows.length);

const snap = await getDocs(collection(db, 'members'));
const known = new Set();
snap.forEach(function (d) { known.add(d.id); });

var ops = [];
var skipped = 0;
for (var r of rows) {
  if (!known.has(r.id)) {
    skipped++;
    console.warn('  skip unknown id: ' + r.id);
    continue;
  }
  ops.push({ ref: doc(db, 'members', r.id), data: { phone: r.phone } });
}

for (var i = 0; i < ops.length; i += BATCH_SIZE) {
  var batch = writeBatch(db);
  ops.slice(i, i + BATCH_SIZE).forEach(function (op) {
    batch.update(op.ref, op.data);
  });
  await batch.commit();
  console.log('  committed ' + Math.min(i + BATCH_SIZE, ops.length) + ' / ' + ops.length);
}

console.log('Done. Updated ' + ops.length + ' members (' + skipped + ' skipped).');
process.exit(0);
