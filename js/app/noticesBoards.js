/**
 * 공지사항·자유게시판 (오프라인/관리용 CRUD)
 */
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { COL_NOTICES, COL_BOARDS } from './constants.js?v=2026.06.26.10';

let C = null;

const NCLS = { 필독: 'br', 일정: 'ba', 안내: 'bb', 일반: 'bz' };

export function initNoticesBoards(ctx) {
  C = ctx;
  window.openNoticeModal = openNoticeModal;
  window.submitNotice = submitNotice;
  window.openNEdit = openNEdit;
  window.saveNoticeEdit = saveNoticeEdit;
  window.delN = delN;
  window.openBoardModal = openBoardModal;
  window.submitBoard = submitBoard;
  window.openBEdit = openBEdit;
  window.saveBoardEdit = saveBoardEdit;
  window.delBd = delBd;
}

function g(id) { return C.g(id); }
function toast(msg) { return C.toast(msg); }
function db() { return C.getDb(); }
function notices() { return C.getNotices(); }
function boards() { return C.getBoards(); }

export function renderN() {
  const el = g('nl');
  if (!el) return;
  const list = notices();
  if (!list.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--t3)">공지사항이 없습니다</div>';
    return;
  }
  el.innerHTML = list.map(function(n) {
    return '<div class="ni">'
      + '<div class="ni-row">'
      + '<span class="badge ' + (NCLS[n.type] || 'bz') + '">' + (n.type || '일반') + '</span>'
      + '<span class="ni-title">' + n.title + '</span>'
      + '<div class="ni-acts">'
      + '<button class="btn btn-g btn-xs" onclick="openNEdit(\'' + n.id + '\')">✏️</button>'
      + '<button class="btn btn-d btn-xs" onclick="delN(\'' + n.id + '\')">🗑</button>'
      + '</div></div>'
      + '<div class="ni-meta">' + (n.createdAt ? new Date(n.createdAt).toLocaleDateString('ko-KR') : '') + '</div>'
      + (n.body ? '<div class="ni-body">' + n.body + '</div>' : '')
      + '</div>';
  }).join('');
}

function openNoticeModal() {
  ['ntitle', 'nbody'].forEach(function(id) { g(id).value = ''; });
  g('ntype').selectedIndex = 0;
  g('e-nt').classList.remove('on');
  C.openMo('mo-notice');
}

async function submitNotice() {
  const title = g('ntitle').value.trim();
  if (!title) { g('e-nt').classList.add('on'); return; }
  const data = {
    type: g('ntype').value,
    title: title,
    body: g('nbody').value.trim(),
    createdAt: new Date().toISOString()
  };
  C.closeMo('mo-notice');
  try {
    if (db()) await addDoc(collection(db(), COL_NOTICES), data);
    else { C.unshiftNoticeLocal({ id: 'l' + Date.now(), ...data }); renderN(); }
    toast('📢 공지 등록!');
  } catch (e) { toast('❌ ' + e.message); }
}

function openNEdit(id) {
  const n = notices().find(function(x) { return x.id === id; });
  if (!n) return;
  g('neid').value = id;
  g('netype').value = n.type || '일반';
  g('netitle').value = n.title;
  g('nebody').value = n.body || '';
  g('e-net').classList.remove('on');
  C.openMo('mo-nedit');
}

async function saveNoticeEdit() {
  const id = g('neid').value;
  const title = g('netitle').value.trim();
  if (!title) { g('e-net').classList.add('on'); return; }
  const u = {
    type: g('netype').value,
    title: title,
    body: g('nebody').value.trim(),
    updatedAt: new Date().toISOString()
  };
  C.closeMo('mo-nedit');
  try {
    if (db()) await updateDoc(doc(db(), COL_NOTICES, id), u);
    else { C.updateNoticeLocal(id, u); renderN(); }
    toast('✅ 공지 수정!');
  } catch (e) { toast('❌ ' + e.message); }
}

async function delN(id) {
  if (!confirm('공지를 삭제할까요?')) return;
  try {
    if (db()) await deleteDoc(doc(db(), COL_NOTICES, id));
    else { C.removeNoticeLocal(id); renderN(); }
    toast('🗑 공지 삭제');
  } catch (e) { toast('❌ ' + e.message); }
}

export function renderB() {
  const el = g('bl');
  if (!el) return;
  const list = boards();
  if (!list.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--t3)">게시글이 없습니다</div>';
    return;
  }
  el.innerHTML = list.map(function(b) {
    return '<div class="ni">'
      + '<div class="ni-row">'
      + '<span style="font-size:12px;color:var(--t3);flex-shrink:0">' + (b.author || '익명') + '</span>'
      + '<span class="ni-title" style="font-size:14px">' + b.title + '</span>'
      + '<div class="ni-acts">'
      + '<button class="btn btn-g btn-xs" onclick="openBEdit(\'' + b.id + '\')">✏️</button>'
      + '<button class="btn btn-d btn-xs" onclick="delBd(\'' + b.id + '\')">🗑</button>'
      + '</div></div>'
      + '<div class="ni-meta">' + (b.createdAt ? new Date(b.createdAt).toLocaleDateString('ko-KR') : '') + '</div>'
      + (b.body ? '<div class="ni-body">' + b.body + '</div>' : '')
      + '</div>';
  }).join('');
}

function openBoardModal() {
  ['bauthor', 'btitle', 'bbody'].forEach(function(id) { g(id).value = ''; });
  ['e-ba', 'e-bt'].forEach(function(id) { g(id).classList.remove('on'); });
  C.openMo('mo-board');
}

async function submitBoard() {
  const author = g('bauthor').value.trim();
  const title = g('btitle').value.trim();
  let ok = true;
  if (!author) { g('e-ba').classList.add('on'); ok = false; }
  if (!title) { g('e-bt').classList.add('on'); ok = false; }
  if (!ok) return;
  const data = {
    author: author,
    title: title,
    body: g('bbody').value.trim(),
    createdAt: new Date().toISOString()
  };
  C.closeMo('mo-board');
  try {
    if (db()) await addDoc(collection(db(), COL_BOARDS), data);
    else { C.unshiftBoardLocal({ id: 'l' + Date.now(), ...data }); renderB(); }
    toast('✅ 게시글 등록!');
  } catch (e) { toast('❌ ' + e.message); }
}

function openBEdit(id) {
  const b = boards().find(function(x) { return x.id === id; });
  if (!b) return;
  g('beid').value = id;
  g('beauthor').value = b.author || '';
  g('betitle').value = b.title;
  g('bebody').value = b.body || '';
  g('e-bet').classList.remove('on');
  C.openMo('mo-bedit');
}

async function saveBoardEdit() {
  const id = g('beid').value;
  const title = g('betitle').value.trim();
  if (!title) { g('e-bet').classList.add('on'); return; }
  const u = {
    author: g('beauthor').value.trim(),
    title: title,
    body: g('bebody').value.trim(),
    updatedAt: new Date().toISOString()
  };
  C.closeMo('mo-bedit');
  try {
    if (db()) await updateDoc(doc(db(), COL_BOARDS, id), u);
    else { C.updateBoardLocal(id, u); renderB(); }
    toast('✅ 게시글 수정!');
  } catch (e) { toast('❌ ' + e.message); }
}

async function delBd(id) {
  if (!confirm('게시글을 삭제할까요?')) return;
  try {
    if (db()) await deleteDoc(doc(db(), COL_BOARDS, id));
    else { C.removeBoardLocal(id); renderB(); }
    toast('🗑 게시글 삭제');
  } catch (e) { toast('❌ ' + e.message); }
}
