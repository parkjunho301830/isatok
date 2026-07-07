/**
 * 오늘(KST) 특정 회원 출석 삭제
 * 사용: node scripts/delete-today-attendance-member.mjs "박준호"
 */
const PROJECT_ID = 'isatok-ef06a';
const API_KEY = 'AIzaSyDttEMgDQx3iS2siRzVIizxBBDZ4KjcJEw';
const COLLECTION = 'attendance';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const memberName = (process.argv[2] || '').trim();
if (!memberName) {
  console.error('사용법: node scripts/delete-today-attendance-member.mjs "이름"');
  process.exit(1);
}

function getTodayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function queryTodayDocs(today) {
  const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: COLLECTION }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'date' },
            op: 'EQUAL',
            value: { stringValue: today },
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`runQuery failed [${res.status}]: ${await res.text()}`);
  const rows = await res.json();
  return rows
    .filter((item) => item.document)
    .map((item) => item.document);
}

async function deleteDoc(docName) {
  const url = docName.startsWith('http')
    ? docName
    : `https://firestore.googleapis.com/v1/${docName}`;
  const res = await fetch(`${url}?key=${API_KEY}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`delete failed [${res.status}]: ${docName}`);
}

const today = getTodayKst();
const docs = await queryTodayDocs(today);
const targets = docs.filter((doc) => (doc.fields?.memberName?.stringValue || '') === memberName);

console.log(`오늘(${today}) ${memberName} 출석: ${targets.length}건`);

if (!targets.length) {
  console.log('삭제할 문서가 없습니다.');
  process.exit(0);
}

for (const doc of targets) {
  await deleteDoc(doc.name);
  console.log(`  삭제: ${doc.name.split('/').pop()}`);
}

console.log(`완료: ${targets.length}건 삭제`);
