/**
 * 관리자 PIN·관리자 허브
 */
import { ADMIN_PIN } from './constants.js?v=2026.06.26.10';

const ADMIN_STORAGE_KEY = 'isatok_admin';

let C = null;
let _adminPinCallback = null;

export function initAdminTab(ctx) {
  C = ctx;
  window.toggleAdmin = toggleAdmin;
  window.submitAdminPin = submitAdminPin;
  window.requireAdminAction = requireAdminAction;
  window.adminGoResultEdit = adminGoResultEdit;
  window.adminGoDelete = adminGoDelete;
  window.adminRefreshStats = adminRefreshStats;
}

function g(id) { return C.g(id); }
function toast(msg) { return C.toast(msg); }
function nav(id) { return C.nav(id); }
function setF(f) { return window.setF(f); }

export function isAdmin() {
  try { return localStorage.getItem(ADMIN_STORAGE_KEY) === '1'; } catch (e) { return false; }
}

export function requireAdmin(fn) {
  if (isAdmin()) {
    if (fn) fn();
    return;
  }
  _adminPinCallback = fn || null;
  openMo('mo-admin-pin');
}

function setAdmin(on) {
  try {
    if (on) localStorage.setItem(ADMIN_STORAGE_KEY, '1');
    else localStorage.removeItem(ADMIN_STORAGE_KEY);
  } catch (e) {}
  document.documentElement.classList.toggle('is-admin', on);
  updateAdminBtn();
  if (C.getCurrentPage() === 'challenge') C.renderC();
  if (C.getCurrentPage() === 'members') C.renderM();
  if (C.getCurrentPage() === 'ranking') C.renderR();
  var snMo = g('mo-season');
  if (snMo && snMo.classList.contains('on')) C.renderSeasonList();
  if (isAdmin()) renderAdminHub();
}

function updateAdminBtn() {
  var lbl = isAdmin() ? '🔓 관리자 종료' : '🔐 관리자';
  var btn = g('btn-admin'), btnM = g('btn-admin-m');
  if (btn) {
    btn.textContent = lbl;
    btn.classList.toggle('btn-p', isAdmin());
    btn.classList.toggle('btn-g', !isAdmin());
  }
  if (btnM) {
    btnM.textContent = isAdmin() ? '🔓' : '🔐';
    btnM.title = isAdmin() ? '관리자 종료' : '관리자';
  }
}

export function applyAdminUI() {
  document.documentElement.classList.toggle('is-admin', isAdmin());
  updateAdminBtn();
  if (isAdmin()) renderAdminHub();
  if (C.getCurrentPage() === 'admin' && !isAdmin()) nav('challenge');
}

export function onAdminModalClosed(id) {
  if (id !== 'mo-admin-pin') return;
  _adminPinCallback = null;
  var pinEl = g('admin-pin');
  if (pinEl) pinEl.value = '';
}

function openMo(id) { return C.openMo(id); }
function closeMo(id) { return C.closeMo(id); }

function toggleAdmin() {
  if (isAdmin()) {
    setAdmin(false);
    toast('관리자 모드 종료');
    return;
  }
  _adminPinCallback = null;
  var inp = g('admin-pin');
  if (inp) inp.value = '';
  openMo('mo-admin-pin');
  setTimeout(function() { if (inp) inp.focus(); }, 200);
}

function submitAdminPin() {
  var inp = g('admin-pin');
  var pin = (inp && inp.value || '').trim();
  if (!/^\d{4}$/.test(pin)) { toast('⚠️ 4자리 PIN을 입력해주세요'); return; }
  if (pin !== ADMIN_PIN) { toast('❌ PIN이 올바르지 않습니다'); return; }
  setAdmin(true);
  closeMo('mo-admin-pin');
  if (inp) inp.value = '';
  toast('🔓 관리자 모드 활성화');
  var cb = _adminPinCallback;
  _adminPinCallback = null;
  if (cb) cb();
  else nav('admin');
}

function requireAdminAction(fn) {
  requireAdmin(fn);
}

export function renderAdminHub() {
  var box = g('admin-hub');
  if (!box || !isAdmin()) return;
  var items = [
    { icon: '✏️', title: '결과 수정', desc: '완료된 경기 결과 변경', fn: 'adminGoResultEdit()' },
    { icon: '🗑', title: '결과 삭제', desc: '대결 카드 삭제', fn: 'adminGoDelete()' },
    { icon: '👤', title: '회원 관리', desc: '등록 · 수정 · 삭제', fn: "nav('members')" },
    { icon: '📇', title: '연락처보내기', desc: '선수 연락처 .vcf 파일', fn: 'exportMembersVcf()' },
    { icon: '📈', title: '통계 새로고침', desc: '명예의 전당 다시 계산', fn: 'adminRefreshStats()' },
    { icon: '📅', title: '시즌 관리', desc: '시즌 생성 · 종료', fn: 'openSeasonMo()' }
  ];
  box.innerHTML = items.map(function(it) {
    return '<button type="button" class="admin-hub-card" onclick="' + it.fn + '">'
      + '<span class="admin-hub-icon">' + it.icon + '</span>'
      + '<div class="admin-hub-text"><div class="admin-hub-t">' + it.title + '</div><div class="admin-hub-d">' + it.desc + '</div></div>'
      + '</button>';
  }).join('');
}

function adminGoResultEdit() {
  nav('challenge');
  setF('completed');
  toast('완료된 대결에서 「결과 수정」을 선택하세요');
}

function adminGoDelete() {
  nav('challenge');
  setF('all');
  toast('삭제할 대결 카드의 🗑 버튼을 눌러주세요');
}

function adminRefreshStats() {
  C.renderHall();
  if (C.getCurrentPage() === 'ranking') C.renderR();
  toast('📈 통계를 새로고침했습니다');
}
