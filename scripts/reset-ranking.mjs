/**
 * 일회성: 전체/시즌 랭킹 기준 포인트 1000 초기화
 * - members.individualPoint, doublePoint → 1000
 * - completed 대결 → accepted (winner/score 제거) — 시즌 랭킹 재계산 시 1000 유지
 */
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
} from 'firebase/firestore';

const FB = {
  apiKey: 'AIzaSyDttEMgDQx3iS2siRzVIizxBBDZ4KjcJEw',
  authDomain: 'isatok-ef06a.firebaseapp.com',
  projectId: 'isatok-ef06a',
  storageBucket: 'isatok-ef06a.firebasestorage.app',
  messagingSenderId: '480704214424',
  appId: '1:480704214424:web:1f02fea9630e395bbb27ed',
};

const DEF_PT = 1000;
const BATCH_SIZE = 400;

async function commitBatch(db, ops) {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    ops.slice(i, i + BATCH_SIZE).forEach(({ ref, data }) => batch.update(ref, data));
    await batch.commit();
    console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: ${Math.min(BATCH_SIZE, ops.length - i)} docs`);
  }
}

const app = initializeApp(FB);
const db = getFirestore(app);

const membersSnap = await getDocs(collection(db, 'members'));
const challengesSnap = await getDocs(collection(db, 'challenges'));

console.log(`members: ${membersSnap.size}, challenges: ${challengesSnap.size}`);

const memberOps = [];
let ptChanged = 0;
membersSnap.forEach((d) => {
  const m = d.data();
  const ind = m.individualPoint ?? DEF_PT;
  const dbl = m.doublePoint ?? DEF_PT;
  if (ind !== DEF_PT || dbl !== DEF_PT) ptChanged++;
  memberOps.push({
    ref: doc(db, 'members', d.id),
    data: { individualPoint: DEF_PT, doublePoint: DEF_PT },
  });
});

const chOps = [];
let completedCount = 0;
challengesSnap.forEach((d) => {
  const c = d.data();
  if (c.status !== 'completed') return;
  completedCount++;
  chOps.push({
    ref: doc(db, 'challenges', d.id),
    data: {
      status: 'accepted',
      winner: null,
      score: null,
    },
  });
});

console.log(`members to reset: ${memberOps.length} (${ptChanged} had non-1000 points)`);
console.log(`completed challenges to revert: ${completedCount}`);

if (memberOps.length) {
  console.log('Updating members...');
  await commitBatch(db, memberOps);
}
if (chOps.length) {
  console.log('Reverting completed challenges...');
  await commitBatch(db, chOps);
}

console.log('Done. All rankings should show 1000 pt baseline.');
process.exit(0);
