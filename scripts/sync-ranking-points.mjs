/**
 * 시즌 랭킹 기준으로 members.individualPoint / doublePoint 동기화
 * 사용: node scripts/sync-ranking-points.mjs
 */
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

const PT_INIT = 1000;
const PT = {
  individual: { win: 10, loss: -5 },
  double: { win: 5, loss: -2 },
};
const BATCH_SIZE = 400;

function isSinglesType(t) { return t === 'ms' || t === 'fs'; }
function isDoublesType(t) { return t === 'md' || t === 'fd' || t === 'xd'; }
function isMatchForRkMode(c, isDbl) {
  if (c.status !== 'completed') return false;
  return isDbl ? isDoublesType(c.type) : isSinglesType(c.type);
}
function chMatchDate(c) {
  var d = c.date || '';
  if (!d && c.createdAt) d = c.createdAt.slice(0, 10);
  return d;
}
function chInSeason(c, season) {
  if (!season || !season.startDate) return false;
  var d = chMatchDate(c);
  if (!d) return false;
  if (d < season.startDate) return false;
  if (season.endDate && d > season.endDate) return false;
  return true;
}
function playerSideInAnyMatch(c, name) {
  var my = c.myTeam || [], opp = c.oppTeam || [];
  if (my.indexOf(name) >= 0) return 'a';
  if (opp.indexOf(name) >= 0) return 'b';
  return null;
}
function playerWonAnyMatch(c, name) {
  var side = playerSideInAnyMatch(c, name);
  return side && c.winner === side;
}
function computeSeasonPoints(member, season, isDbl, challenges) {
  var pt = PT_INIT, name = member.name;
  challenges.forEach(function (c) {
    if (!chInSeason(c, season) || !isMatchForRkMode(c, isDbl)) return;
    if (!playerSideInAnyMatch(c, name)) return;
    var pts = isDbl ? PT.double : PT.individual;
    if (playerWonAnyMatch(c, name)) pt += pts.win;
    else pt += pts.loss;
  });
  return pt;
}

const app = initializeApp(FB);
const db = getFirestore(app);

const [membersSnap, seasonsSnap, challengesSnap] = await Promise.all([
  getDocs(collection(db, 'members')),
  getDocs(collection(db, 'seasons')),
  getDocs(collection(db, 'challenges')),
]);

const seasons = [];
seasonsSnap.forEach(function (d) { seasons.push({ id: d.id, ...d.data() }); });
const challenges = [];
challengesSnap.forEach(function (d) { challenges.push({ id: d.id, ...d.data() }); });

const season = seasons.find(function (s) { return s.isCurrent && s.status !== 'ended'; }) || null;
if (!season) {
  console.error('현재 시즌이 없습니다. 시즌을 먼저 생성해 주세요.');
  process.exit(1);
}

console.log('현재 시즌: ' + season.name + ' (' + season.startDate + ')');

var ops = [];
var changed = 0;
membersSnap.forEach(function (d) {
  var m = { id: d.id, ...d.data() };
  var ind = computeSeasonPoints(m, season, false, challenges);
  var dbl = computeSeasonPoints(m, season, true, challenges);
  var curInd = m.individualPoint ?? PT_INIT;
  var curDbl = m.doublePoint ?? PT_INIT;
  if (ind !== curInd || dbl !== curDbl) {
    changed++;
    console.log('  ' + (m.name || m.id) + ': 단식 ' + curInd + '→' + ind + ', 복식 ' + curDbl + '→' + dbl);
  }
  ops.push({
    ref: doc(db, 'members', d.id),
    data: { individualPoint: ind, doublePoint: dbl },
  });
});

for (var i = 0; i < ops.length; i += BATCH_SIZE) {
  var batch = writeBatch(db);
  ops.slice(i, i + BATCH_SIZE).forEach(function (op) { batch.update(op.ref, op.data); });
  await batch.commit();
  console.log('  committed ' + Math.min(i + BATCH_SIZE, ops.length) + ' / ' + ops.length);
}

console.log('Done. ' + ops.length + '명 동기화 (' + changed + '명 변경).');
process.exit(0);
