/**
 * 오늘(KST) attendance 문서 일괄 삭제 (Firestore REST API)
 * 사용: node scripts/clear-today-attendance.mjs
 */
const PROJECT_ID = 'isatok-ef06a';
const API_KEY = 'AIzaSyDttEMgDQx3iS2siRzVIizxBBDZ4KjcJEw';
const COLLECTION = 'attendance';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function getTodayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function buildTodayQuery(today) {
  return JSON.stringify({
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
  });
}

async function queryTodayDocs(today) {
  const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: buildTodayQuery(today),
  });
  if (!res.ok) {
    throw new Error(`runQuery failed [${res.status}]: ${await res.text()}`);
  }
  const rows = await res.json();
  return rows
    .filter((item) => item.document && item.document.name)
    .map((item) => item.document.name);
}

async function deleteDoc(docName) {
  const url = docName.startsWith('http')
    ? docName
    : `https://firestore.googleapis.com/v1/${docName}`;
  const res = await fetch(`${url}?key=${API_KEY}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`delete failed [${res.status}]: ${docName}`);
  }
}

const today = getTodayKst();
const docNames = await queryTodayDocs(today);

console.log(`오늘(${today}) 출석 문서: ${docNames.length}건`);

if (!docNames.length) {
  console.log('삭제할 문서가 없습니다.');
  process.exit(0);
}

for (const name of docNames) {
  await deleteDoc(name);
  console.log(`  삭제: ${name.split('/').pop()}`);
}

console.log(`완료: ${docNames.length}건 삭제`);
