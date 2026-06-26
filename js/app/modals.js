/**
 * 모달 열기/닫기·배경 클릭 처리
 */
import { isMyPlayerSetupMandatory } from './wizard.js?v=2026.06.26.10';
import { registerOverlay, unregisterOverlay } from './backNav.js?v=2026.06.26.10';

let C = null;

function _moBackKey(id) {
  return 'mo:' + id;
}

export function initModals(ctx) {
  C = ctx;
  window.closeMo = closeMo;
  document.querySelectorAll('.mo').forEach(function(m) {
    m.addEventListener('click', function(e) {
      if (e.target === m && m.classList.contains('on')) {
        if (m.id === 'mo-my-player' && isMyPlayerSetupMandatory()) return;
        m.classList.remove('on');
        requestAnimationFrame(C.unlockBodyScroll);
      }
    });
  });
}

export function openMo(id) {
  const el = C.g(id);
  if (!el) { console.error('Modal not found:', id); return; }
  el.classList.add('on');
  if (el.classList.contains('write-mo')) {
    setTimeout(function() {
      const first = el.querySelector('input:not([type=hidden]), textarea');
      if (first) first.focus();
    }, 320);
  }
  if (!(id === 'mo-my-player' && isMyPlayerSetupMandatory())) {
    registerOverlay(_moBackKey(id), function(fromBack) {
      if (!fromBack) unregisterOverlay(_moBackKey(id));
      closeMo(id, true);
    });
  }
  requestAnimationFrame(C.lockBodyScroll);
}

export function closeMo(id, fromBack) {
  if (id === 'mo-my-player' && isMyPlayerSetupMandatory()) return;
  var el = C.g(id);
  if (!el || !el.classList.contains('on')) return;
  el.classList.remove('on');
  if (!fromBack && id !== 'mo-my-player') unregisterOverlay(_moBackKey(id));
  if (C.onModalClosed) C.onModalClosed(id);
  requestAnimationFrame(C.unlockBodyScroll);
}
