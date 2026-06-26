/**
 * 조직도(GAS) 회원 사진 — fetch · 캐시 · 아바타 HTML
 */
import { ORG_CHART_API_URL, MEMBER_PHOTO_CACHE_TTL_MS } from './constants.js?v=2026.06.26.10';
import { registerOverlay, unregisterOverlay } from './backNav.js?v=2026.06.26.10';

const LS_PHOTO_CACHE = 'isatok_member_photos_v2';
const LB_BACK_KEY = 'lightbox';

/** @type {Record<string, string>} */
let _photoByName = {};
let _syncPromise = null;
let _lastSyncAt = 0;

function _escAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _photoInitial(name) {
  return name ? name.slice(0, 2) : '??';
}

function _normName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim();
}

/** Drive 공유 URL → 외부 img에서 로드 가능한 썸네일 URL */
function _normalizePhotoUrl(url) {
  if (!url) return '';
  var s = String(url).trim();
  if (!s) return '';
  if (/^https?:\/\/lh3\.googleusercontent\.com/i.test(s)) return s;

  var id = '';
  var fileMatch = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) id = fileMatch[1];
  if (!id) {
    var idMatch = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) id = idMatch[1];
  }
  if (id) return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w400';
  if (/^https?:\/\//i.test(s)) return s;
  return s;
}

/** 썸네일 URL → 라이트박스용 고해상도 URL */
function _photoLargeUrl(url) {
  if (!url) return '';
  if (/[?&]sz=w\d+/i.test(url)) return url.replace(/sz=w\d+/i, 'sz=w1600');
  return url;
}

function _loadCache() {
  try {
    var raw = localStorage.getItem(LS_PHOTO_CACHE);
    if (!raw) return;
    var data = JSON.parse(raw);
    if (data && data.map && typeof data.map === 'object') {
      var next = {};
      Object.keys(data.map).forEach(function (k) {
        var nk = _normName(k);
        if (!nk) return;
        next[nk] = _normalizePhotoUrl(data.map[k]);
      });
      _photoByName = next;
      _lastSyncAt = data.syncedAt || 0;
    }
  } catch (e) { /* ignore */ }
}

function _saveCache() {
  try {
    localStorage.setItem(LS_PHOTO_CACHE, JSON.stringify({
      syncedAt: _lastSyncAt,
      map: _photoByName
    }));
  } catch (e) { /* ignore */ }
}

/**
 * @param {string} name
 * @returns {string}
 */
export function getMemberPhotoUrl(name) {
  var k = _normName(name);
  if (!k) return '';
  return _photoByName[k] || '';
}

/**
 * @param {string} name
 * @returns {string}
 */
export function getMemberPhotoLargeUrl(name) {
  return _photoLargeUrl(getMemberPhotoUrl(name));
}

let _lbEl = null;
let _lbOpen = false;

function _ensureLightbox() {
  if (_lbEl) return _lbEl;
  _lbEl = document.createElement('div');
  _lbEl.id = 'member-photo-lightbox';
  _lbEl.className = 'photo-lightbox';
  _lbEl.setAttribute('role', 'dialog');
  _lbEl.setAttribute('aria-modal', 'true');
  _lbEl.hidden = true;
  _lbEl.innerHTML =
    '<button type="button" class="photo-lightbox__backdrop" aria-label="닫기"></button>'
    + '<div class="photo-lightbox__stage">'
    + '<img class="photo-lightbox__img" alt="" decoding="async" referrerpolicy="no-referrer" />'
    + '<div class="photo-lightbox__caption"></div>'
    + '</div>'
    + '<button type="button" class="photo-lightbox__close" aria-label="닫기">×</button>';
  document.body.appendChild(_lbEl);

  _lbEl.querySelector('.photo-lightbox__backdrop').addEventListener('click', closeMemberPhotoLightbox);
  _lbEl.querySelector('.photo-lightbox__close').addEventListener('click', closeMemberPhotoLightbox);
  document.addEventListener('keydown', function (e) {
    if (_lbOpen && e.key === 'Escape') closeMemberPhotoLightbox();
  });
  return _lbEl;
}

/**
 * 회원 사진을 전체 화면에 크게 표시
 * @param {string} name - 회원 이름
 */
export function openMemberPhotoLightbox(name) {
  var url = getMemberPhotoLargeUrl(name);
  if (!url) return;
  var el = _ensureLightbox();
  var img = el.querySelector('.photo-lightbox__img');
  var cap = el.querySelector('.photo-lightbox__caption');
  img.src = url;
  img.alt = name || '';
  cap.textContent = name || '';
  el.hidden = false;
  el.classList.add('is-open');
  document.documentElement.classList.add('photo-lightbox-open');
  _lbOpen = true;
  registerOverlay(LB_BACK_KEY, function (fromBack) {
    if (!fromBack) unregisterOverlay(LB_BACK_KEY);
    closeMemberPhotoLightbox(true);
  });
}

export function isMemberPhotoLightboxOpen() {
  return _lbOpen;
}

export function closeMemberPhotoLightbox(fromBack) {
  if (!_lbEl || !_lbOpen) return;
  if (!fromBack) unregisterOverlay(LB_BACK_KEY);
  _lbEl.classList.remove('is-open');
  _lbEl.hidden = true;
  var img = _lbEl.querySelector('.photo-lightbox__img');
  if (img) img.removeAttribute('src');
  document.documentElement.classList.remove('photo-lightbox-open');
  _lbOpen = false;
}

/** 사진 아바타 탭 → 라이트박스 (이벤트 위임) */
export function initMemberPhotoLightbox() {
  document.addEventListener('click', function (e) {
    var av = e.target.closest('.member-avatar--photo.member-avatar--zoomable:not(.member-avatar--fallback)');
    if (!av) return;
    var name = av.getAttribute('data-member-name') || '';
    if (!name || !getMemberPhotoUrl(name)) return;
    e.preventDefault();
    e.stopPropagation();
    openMemberPhotoLightbox(name);
  }, true);
}

/**
 * 앱 시작 시 캐시 로드 + 백그라운드 동기화
 * @param {boolean} [force]
 * @returns {Promise<void>}
 */
export function initMemberPhotos(force) {
  _loadCache();
  return syncMemberPhotos(!!force);
}

/**
 * 조직도 API에서 사진 목록 동기화
 * @param {boolean} [force]
 * @returns {Promise<void>}
 */
export function syncMemberPhotos(force) {
  if (!ORG_CHART_API_URL) return Promise.resolve();
  if (!force && _lastSyncAt && Date.now() - _lastSyncAt < MEMBER_PHOTO_CACHE_TTL_MS) {
    return Promise.resolve();
  }
  if (_syncPromise) return _syncPromise;

  _syncPromise = fetch(ORG_CHART_API_URL, { redirect: 'follow', cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (text) {
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('JSON parse failed — GAS API 배포를 확인하세요');
      }
      if (!data || !data.ok || !Array.isArray(data.members)) {
        throw new Error('invalid API response');
      }
      var next = {};
      data.members.forEach(function (m) {
        if (!m || !m.name || !m.photoUrl) return;
        var nk = _normName(m.name);
        if (!nk) return;
        next[nk] = _normalizePhotoUrl(m.photoUrl);
      });
      _photoByName = next;
      _lastSyncAt = Date.now();
      _saveCache();
    })
    .catch(function (err) {
      console.warn('[이사탁] 조직도 사진 동기화 실패:', err.message || err);
    })
    .finally(function () {
      _syncPromise = null;
    });

  return _syncPromise;
}

/**
 * 회원 아바타 HTML (사진 있으면 img, 없으면 이니셜)
 * @param {string} name
 * @param {string} [colorClass] - avc() 등 배경 클래스
 * @param {string} [extraClass]
 * @returns {string}
 */
export function memberAvatarHtml(name, colorClass, extraClass, inlineStyle) {
  var url = getMemberPhotoUrl(name);
  var init = _photoInitial(name);
  var cls = 'member-avatar' + (colorClass ? ' ' + colorClass : '') + (extraClass ? ' ' + extraClass : '');
  var styleAttr = inlineStyle ? (' style="' + _escAttr(inlineStyle) + '"') : '';

  if (url) {
    return '<div class="' + cls + ' member-avatar--photo member-avatar--zoomable" data-member-name="' + _escAttr(name) + '"' + styleAttr + '>'
      + '<img src="' + _escAttr(url) + '" alt="" class="member-avatar__img" loading="lazy" decoding="async" referrerpolicy="no-referrer"'
      + ' onerror="this.closest(\'.member-avatar--photo\').classList.add(\'member-avatar--fallback\')">'
      + '<span class="member-avatar__init">' + init + '</span></div>';
  }
  return '<div class="' + cls + '"' + styleAttr + '><span class="member-avatar__init">' + init + '</span></div>';
}
