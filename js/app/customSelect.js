/**
 * 커스텀 Select — 모바일 Bottom Sheet / PC 드롭다운
 * 네이티브 <select>는 숨기고 value·change·required·폼 제출은 그대로 유지
 */
import { lockBodyScroll, unlockBodyScroll } from './appCore.js?v=2026.06.26.10';

const OVERLAY_KEY = 'csel';

let _backNav = null;
let _portal = null;
let _overlay = null;
let _panel = null;
let _list = null;
let _sheetTitle = null;
let _activeSelect = null;
let _activeTrigger = null;
let _pcOutsideHandler = null;
let _keyHandler = null;
let _open = false;

function isMobileLayout() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function shouldSkip(select) {
  if (!select || select.tagName !== 'SELECT') return true;
  if (select.dataset.csel === '1' || select.dataset.cselSkip !== undefined) return true;
  if (select.hasAttribute('hidden')) return true;
  var style = window.getComputedStyle(select);
  return style.display === 'none' || style.visibility === 'hidden';
}

function getOptions(select) {
  return Array.from(select.options).map(function(opt, idx) {
    return {
      index: idx,
      value: opt.value,
      label: opt.textContent || '',
      disabled: opt.disabled,
      selected: opt.selected
    };
  });
}

function getDisplayText(select) {
  var opt = select.options[select.selectedIndex];
  if (select.value && opt) return opt.textContent || '';
  var first = select.options[0];
  if (first && first.value === '') return first.textContent || '선택';
  return '선택';
}

function getLabelText(select) {
  if (!select.id) return '';
  var label = document.querySelector('label[for="' + select.id + '"]');
  return label ? label.textContent.replace(/\s+/g, ' ').trim() : '';
}

function ensurePortal() {
  if (_portal) return;
  _portal = document.createElement('div');
  _portal.id = 'csel-root';
  _portal.className = 'csel-root';
  _portal.hidden = true;
  _portal.innerHTML =
    '<div class="csel-overlay" id="csel-overlay" tabindex="-1"></div>'
    + '<div class="csel-panel" id="csel-panel" role="dialog" aria-modal="true" aria-label="선택">'
    + '<div class="csel-panel-inner">'
    + '<div class="csel-sheet-hdr">'
    + '<div class="csel-handle" aria-hidden="true"></div>'
    + '<div class="csel-sheet-title" id="csel-sheet-title"></div>'
    + '<button type="button" class="csel-close" id="csel-close" aria-label="닫기">'
    + '<span aria-hidden="true">✕</span></button>'
    + '</div>'
    + '<ul class="csel-list" id="csel-list" role="listbox" tabindex="-1"></ul>'
    + '</div></div>';
  document.body.appendChild(_portal);
  _overlay = _portal.querySelector('#csel-overlay');
  _panel = _portal.querySelector('#csel-panel');
  _list = _portal.querySelector('#csel-list');
  _sheetTitle = _portal.querySelector('#csel-sheet-title');

  _overlay.addEventListener('click', function() { closePanel(); });
  _portal.querySelector('#csel-close').addEventListener('click', function() { closePanel(); });
}

export function setCustomSelectBackNav(ctx) {
  _backNav = ctx || null;
}

export function refreshCustomSelect(select) {
  if (!select || select.dataset.csel !== '1') return;
  var wrap = select.closest('.csel');
  if (!wrap) return;
  var trigger = wrap.querySelector('.csel-trigger');
  var valueEl = wrap.querySelector('.csel-value');
  if (!trigger || !valueEl) return;
  trigger.disabled = !!select.disabled;
  wrap.classList.toggle('csel--disabled', !!select.disabled);
  valueEl.textContent = getDisplayText(select);
  wrap.classList.toggle('csel--empty', !select.value);
  wrap.classList.toggle('csel--selected', !!select.value);
  if (_activeSelect === select && _open) buildList(select);
}

function buildList(select) {
  var options = getOptions(select);

  _list.innerHTML = options.map(function(opt) {
    if (opt.value === '' && options.length > 1) {
      return '<li class="csel-option csel-option--placeholder" role="option"'
        + ' data-value="" data-idx="' + opt.index + '"'
        + (opt.disabled ? ' aria-disabled="true"' : '')
        + ' tabindex="-1">'
        + '<span class="csel-option-label">' + escapeHtml(opt.label) + '</span></li>';
    }
    var selected = select.value === opt.value;
    return '<li class="csel-option' + (selected ? ' is-selected' : '') + (opt.disabled ? ' is-disabled' : '') + '"'
      + ' role="option" data-value="' + escapeAttr(opt.value) + '" data-idx="' + opt.index + '"'
      + ' aria-selected="' + (selected ? 'true' : 'false') + '"'
      + (opt.disabled ? ' aria-disabled="true"' : '')
      + ' tabindex="-1">'
      + '<span class="csel-option-label">' + escapeHtml(opt.label) + '</span>'
      + '<span class="csel-option-check" aria-hidden="true"></span></li>';
  }).join('');

  _list.querySelectorAll('.csel-option:not(.is-disabled)').forEach(function(li) {
    li.addEventListener('click', function() { pickValue(li.getAttribute('data-value')); });
  });

  var selectedEl = _list.querySelector('.csel-option.is-selected') || _list.querySelector('.csel-option:not(.is-disabled)');
  if (selectedEl) scrollOptionIntoView(selectedEl);
}

function visibleOptions() {
  return Array.from(_list.querySelectorAll('.csel-option:not(.is-disabled)'));
}

function scrollOptionIntoView(el) {
  if (!el || !_list) return;
  var listRect = _list.getBoundingClientRect();
  var elRect = el.getBoundingClientRect();
  if (elRect.top < listRect.top) _list.scrollTop -= (listRect.top - elRect.top);
  else if (elRect.bottom > listRect.bottom) _list.scrollTop += (elRect.bottom - listRect.bottom);
}

function pickValue(value) {
  if (!_activeSelect) return;
  _activeSelect.value = value == null ? '' : value;
  _activeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  refreshCustomSelect(_activeSelect);
  closePanel();
}

function positionPanel(trigger) {
  var mobile = isMobileLayout();
  _panel.classList.toggle('csel-panel--sheet', mobile);
  _overlay.classList.toggle('csel-overlay--dim', mobile);
  _portal.classList.toggle('csel-root--mobile', mobile);
  _portal.classList.toggle('csel-root--desktop', !mobile);

  if (mobile) {
    _panel.style.top = '';
    _panel.style.left = '';
    _panel.style.width = '';
    _panel.style.maxHeight = '';
    return;
  }

  var rect = trigger.getBoundingClientRect();
  var width = Math.max(rect.width, 220);
  var left = Math.min(rect.left, window.innerWidth - width - 8);
  _panel.style.width = width + 'px';
  _panel.style.left = Math.max(8, left) + 'px';
  _panel.style.maxHeight = 'min(320px, calc(100vh - ' + (rect.bottom + 16) + 'px))';

  _panel.classList.remove('csel-panel--up');
  _panel.style.top = (rect.bottom + 6) + 'px';

  requestAnimationFrame(function() {
    var panelRect = _panel.getBoundingClientRect();
    if (panelRect.bottom > window.innerHeight - 8) {
      var upTop = rect.top - panelRect.height - 6;
      if (upTop >= 8) {
        _panel.classList.add('csel-panel--up');
        _panel.style.top = upTop + 'px';
      }
    }
  });
}

function attachPcOutside(trigger) {
  detachPcOutside();
  _pcOutsideHandler = function(e) {
    if (!_open) return;
    if (_panel.contains(e.target) || trigger.contains(e.target)) return;
    closePanel();
  };
  setTimeout(function() {
    document.addEventListener('mousedown', _pcOutsideHandler);
    document.addEventListener('touchstart', _pcOutsideHandler, { passive: true });
  }, 0);
}

function detachPcOutside() {
  if (!_pcOutsideHandler) return;
  document.removeEventListener('mousedown', _pcOutsideHandler);
  document.removeEventListener('touchstart', _pcOutsideHandler);
  _pcOutsideHandler = null;
}

function attachKeyHandler() {
  detachKeyHandler();
  _keyHandler = function(e) {
    if (!_open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      var focused = document.activeElement;
      if (focused && focused.classList && focused.classList.contains('csel-option')) {
        e.preventDefault();
        pickValue(focused.getAttribute('data-value'));
      }
    }
  };
  document.addEventListener('keydown', _keyHandler);
}

function detachKeyHandler() {
  if (!_keyHandler) return;
  document.removeEventListener('keydown', _keyHandler);
  _keyHandler = null;
}

function moveFocus(dir) {
  var items = visibleOptions();
  if (!items.length) return;
  var idx = items.indexOf(document.activeElement);
  if (idx < 0) idx = items.findIndex(function(li) { return li.classList.contains('is-selected'); });
  var next = items[(idx + dir + items.length) % items.length];
  if (next) {
    next.focus();
    scrollOptionIntoView(next);
  }
}

function openPanel(select, trigger) {
  if (select.disabled) return;
  if (_open && _activeSelect === select) {
    closePanel();
    return;
  }
  if (_open) closePanel();

  ensurePortal();
  _activeSelect = select;
  _activeTrigger = trigger;
  _open = true;

  var label = getLabelText(select);
  _sheetTitle.textContent = label || '선택';
  _panel.setAttribute('aria-label', label || '선택');

  buildList(select);
  positionPanel(trigger);

  _portal.hidden = false;
  requestAnimationFrame(function() {
    if (isMobileLayout()) _overlay.classList.add('on');
    _panel.classList.add('on');
    trigger.setAttribute('aria-expanded', 'true');
  });

  if (isMobileLayout()) {
    lockBodyScroll();
    if (_backNav && _backNav.registerOverlay) {
      _backNav.registerOverlay(OVERLAY_KEY, function() { closePanel(true); });
    }
  } else {
    attachPcOutside(trigger);
  }
  attachKeyHandler();

  var sel = _list.querySelector('.csel-option.is-selected:not(.is-disabled)')
    || _list.querySelector('.csel-option:not(.is-disabled)');
  if (sel) sel.focus();
  else _list.focus();
}

function closePanel(fromBack) {
  if (!_open) return;
  _open = false;
  _overlay.classList.remove('on');
  _panel.classList.remove('on');
  detachPcOutside();
  detachKeyHandler();

  if (_activeTrigger) _activeTrigger.setAttribute('aria-expanded', 'false');

  var mobile = isMobileLayout();
  if (mobile) {
    unlockBodyScroll();
    if (!fromBack && _backNav && _backNav.unregisterOverlay) {
      _backNav.unregisterOverlay(OVERLAY_KEY);
    }
  }

  setTimeout(function() {
    if (!_open) _portal.hidden = true;
  }, 280);

  if (_activeTrigger && !fromBack) _activeTrigger.focus();
  _activeSelect = null;
  _activeTrigger = null;
}

function onTriggerKeydown(e, select, trigger) {
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
    e.preventDefault();
    openPanel(select, trigger);
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

export function enhanceSelect(select) {
  if (shouldSkip(select)) return;
  if (select.dataset.csel === '1') return;
  select.dataset.csel = '1';

  var wrap = document.createElement('div');
  wrap.className = 'csel';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);

  select.classList.add('csel-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  var trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'csel-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  if (select.id) {
    trigger.id = select.id + '-trigger';
    var labelEl = document.querySelector('label[for="' + select.id + '"]');
    if (labelEl) {
      if (!labelEl.id) labelEl.id = select.id + '-label';
      trigger.setAttribute('aria-labelledby', labelEl.id);
    }
  }

  var valueSpan = document.createElement('span');
  valueSpan.className = 'csel-value';

  var chevron = document.createElement('span');
  chevron.className = 'csel-chevron';
  chevron.setAttribute('aria-hidden', 'true');

  trigger.appendChild(valueSpan);
  trigger.appendChild(chevron);
  wrap.appendChild(trigger);

  trigger.addEventListener('click', function() { openPanel(select, trigger); });
  trigger.addEventListener('keydown', function(e) { onTriggerKeydown(e, select, trigger); });

  var mo = new MutationObserver(function() { refreshCustomSelect(select); });
  mo.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['selected', 'disabled'] });
  select._cselObserver = mo;

  refreshCustomSelect(select);
}

export function initCustomSelects(root) {
  var scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('select').forEach(function(sel) {
    enhanceSelect(sel);
  });
}

export function isCustomSelectOpen() {
  return _open;
}

export function closeCustomSelectPanel(fromBack) {
  closePanel(!!fromBack);
}

let _domObserver = null;

export function watchCustomSelects() {
  if (_domObserver) return;
  _domObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'SELECT') enhanceSelect(node);
        if (node.querySelectorAll) {
          node.querySelectorAll('select').forEach(enhanceSelect);
        }
      });
    });
  });
  _domObserver.observe(document.body, { childList: true, subtree: true });
}
