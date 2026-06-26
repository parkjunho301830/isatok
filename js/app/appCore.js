/**
 * DOM·스크롤·토스트 등 앱 공통 유틸
 */
import { APP_VERSION } from './version.js?v=2026.06.26.10';
import {
  DEEPLINK_POLL_INTERVAL,
  NAV_HEIGHT_MOBILE,
  NAV_HEIGHT_PC,
  COLOR_GRAY
} from './constants.js?v=2026.06.26.10';

export const g = function(id) { return document.getElementById(id); };

export function toast(msg, opts) {
  document.querySelectorAll('.toast').forEach(function(t) { t.remove(); });
  var t = document.createElement('div');
  t.className = 'toast' + (opts && opts.multiline ? ' toast-multiline' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, (opts && opts.duration) || 2800);
}

export function fmtP(el) {
  var v = el.value.replace(/\D/g, '');
  if (v.length <= 3) el.value = v;
  else if (v.length <= 7) el.value = v.slice(0, 3) + '-' + v.slice(3);
  else el.value = v.slice(0, 3) + '-' + v.slice(3, 7) + '-' + v.slice(7, 11);
}

export function $ko(d) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

export function renderEmptyState(emoji, title, subtitle) {
  return [
    "<div style='",
    "display:flex;flex-direction:column;align-items:center;",
    "justify-content:center;padding:48px 24px;text-align:center;",
    'color:' + COLOR_GRAY,
    "'>",
    "<div style='font-size:48px;margin-bottom:16px'>" + emoji + '</div>',
    "<div style='font-size:16px;font-weight:600;color:#1C1C1E;margin-bottom:8px'>" + title + '</div>',
    "<div style='font-size:14px;line-height:1.6'>" + subtitle + '</div>',
    '</div>'
  ].join('');
}

let _bodyScrollLock = 0;
let _scrollLockY = 0;

export function lockBodyScroll() {
  if (_bodyScrollLock++ > 0) return;
  _scrollLockY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.style.position = 'fixed';
  document.body.style.top = (-_scrollLockY) + 'px';
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
}

export function unlockBodyScroll() {
  if (_bodyScrollLock <= 0) return;
  if (--_bodyScrollLock > 0) return;
  var y = _scrollLockY;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  document.body.style.overflow = '';
  window.scrollTo(0, y);
}

export function getBodyScrollLock() {
  return _bodyScrollLock;
}

export function initAppCore() {
  if (!window.CSS || !window.CSS.escape) {
    window.CSS = window.CSS || {};
    window.CSS.escape = function(value) {
      return String(value).replace(/([^\w-])/g, '\\$1');
    };
  }
  window.toast = toast;
  window.fmtP = fmtP;
  window.openVersionInfo = function() {
    toast('버전 : v' + APP_VERSION, { duration: 2800 });
  };
}

export function cssEscape(value) {
  return window.CSS && window.CSS.escape
    ? window.CSS.escape(value)
    : String(value).replace(/'/g, "\\'");
}

export function isMobileUa() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function getScrollContainer(el) {
  var main = document.querySelector('.main');
  if (main) {
    var mainStyle = window.getComputedStyle(main);
    if (/auto|scroll/.test(mainStyle.overflowY) && main.scrollHeight > main.clientHeight) return main;
  }
  var parent = el.parentElement;
  while (parent && parent !== document.body) {
    var style = window.getComputedStyle(parent);
    var overflow = style.overflow + style.overflowY;
    if (/auto|scroll/.test(overflow) && parent.scrollHeight > parent.clientHeight) return parent;
    parent = parent.parentElement;
  }
  return window;
}

function smoothScrollTo(targetY, duration) {
  var startY = window.pageYOffset || document.documentElement.scrollTop || 0;
  var diff = targetY - startY;
  var startTime = null;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    var ease = progress < 0.5
      ? 2 * progress * progress
      : -1 + (4 - 2 * progress) * progress;
    window.scrollTo(0, startY + diff * ease);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export function scrollToElement(el) {
  var navHeight = isMobileUa() ? NAV_HEIGHT_MOBILE : NAV_HEIGHT_PC;
  var container = getScrollContainer(el);
  var rect = el.getBoundingClientRect();
  if (container === window) {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    var targetY = rect.top + scrollTop - (window.innerHeight / 2) + (rect.height / 2) - navHeight;
    targetY = Math.max(0, targetY);
    if ('scrollBehavior' in document.documentElement.style) {
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    } else {
      smoothScrollTo(targetY, 500);
    }
    return;
  }
  var containerRect = container.getBoundingClientRect();
  var targetScroll = container.scrollTop + rect.top - containerRect.top
    - (container.clientHeight / 2) + (rect.height / 2);
  targetScroll = Math.max(0, targetScroll);
  if ('scrollBehavior' in document.documentElement.style) {
    container.scrollTo({ top: targetScroll, behavior: 'smooth' });
  } else {
    container.scrollTop = targetScroll;
  }
}

export function waitForElement(selector, callback, maxWait, onTimeout) {
  maxWait = maxWait || 8000;
  var elapsed = 0;
  var interval = DEEPLINK_POLL_INTERVAL;
  var timer = setInterval(function() {
    var el = document.querySelector(selector);
    if (el) {
      clearInterval(timer);
      callback(el);
      return;
    }
    elapsed += interval;
    if (elapsed >= maxWait) {
      clearInterval(timer);
      console.warn('[이사탁] waitForElement: 요소를 찾지 못했습니다.', selector);
      if (onTimeout) onTimeout();
    }
  }, interval);
}

export function initVersionUI() {
  var label = 'v' + APP_VERSION;
  document.querySelectorAll('.header-ver-text').forEach(function(el) { el.textContent = label; });
}
