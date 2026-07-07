/**

 * 영상 탭 — 점심경기 · 저녁경기 · 레슨 · 훈련

 */

import {

  collection, doc, addDoc, updateDoc, deleteDoc

} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import {

  COL_VIDEOS, VIDEO_CATEGORIES, VIDEO_CLUB_CATEGORIES, VIDEO_CATEGORY_DEFAULT,

  VIDEO_CATEGORY_BADGE, VIDEO_CATEGORY_DATE_SORT, VIDEO_FILTER_CHALLENGE,

  VIDEO_FILTER_TABS, VIDEO_CATEGORY_EMOJI

} from './constants.js?v=2026.07.07.01';

import {

  extractYouTubeVideoId, buildYouTubeThumbUrl, buildYouTubeEmbedUrl, formatViewCount

} from './youtubeUtils.js?v=2026.07.07.01';

import {

  fetchYouTubeViewCounts, getAppViewCount, resolveViewCountLabel, hasYouTubeViewStats

} from './youtubeViewStats.js?v=2026.07.07.01';

import { trackLessonVideoView } from './videoViews.js?v=2026.07.07.01';
import { logVideoView } from './videoViewLogs.js?v=2026.07.07.01';

import { requireAdmin, isAdmin } from './adminTab.js?v=2026.07.07.01';

import { $ko, scrollVideoCardIntoView } from './appCore.js?v=2026.07.07.01';

import { initLessonShare } from './lessonShare.js?v=2026.07.07.01';

import {

  lessonMemberNames, lessonMemberLabel, lessonHasMember, lessonMemberIds

} from './lessonMemberUtils.js?v=2026.07.07.01';

import {

  getVideoCategory, getVideoDisplayTitle, isDateSortCategory, getVideoDisplayDate,

  sortVideosList, todayDateInputValue

} from './videoCategoryUtils.js?v=2026.07.07.01';

import {

  initVideoDeepLink,

  handleLessonVideoDeepLink,

  handleMatchVideoDeepLink,

  restoreVideosScrollAnchor,

  armVideosScrollAnchor,

  clearVideosScrollAnchor,

  onVideoModalClosed

} from './videoDeepLink.js?v=2026.07.07.01';



export {

  handleLessonVideoDeepLink,

  handleMatchVideoDeepLink,

  restoreVideosScrollAnchor,

  armVideosScrollAnchor,

  clearVideosScrollAnchor,

  onVideoModalClosed

};



let C = null;

let _categoryFilter = 'all';

let _mineFilter = false;

let _clubMemberPick = [];

let _clubCategoryPick = VIDEO_CATEGORY_DATE_SORT[0];

let _editingVideoId = null;

let _matchPlayerFilter = '';



const _FILTER_BTN_IDS = {

  all: 'club-vid-filter-all',

  '대결': 'club-vid-filter-challenge',

  '점심경기': 'club-vid-filter-lunch',

  '저녁경기': 'club-vid-filter-evening',

  '레슨': 'club-vid-filter-lesson',

  '훈련': 'club-vid-filter-training'

};



/** 앱 부트 시 영상 딥링크 — DOM만 먼저 영상 탭으로 전환 */

export function bootVideosDeepLinkSection() {

  document.querySelectorAll('.page').forEach(function(p) {

    p.classList.toggle('on', p.id === 'page-videos');

  });

  document.querySelectorAll('.bni').forEach(function(n) {

    n.classList.toggle('on', n.dataset.p === 'videos');

  });

  document.querySelectorAll('.nav-i').forEach(function(n) {

    n.classList.toggle('on', n.dataset.page === 'videos');

  });

  if (document.body) document.body.classList.remove('has-fab');

}



export function initVideosTab(ctx) {

  C = ctx;

  window.setVideoCategoryFilter = setVideoCategoryFilter;

  window.setVideoMineFilter = setVideoMineFilter;

  window.setVideoSection = setVideoSection;

  window.setLessonFilter = setLessonFilter;

  window.openClubVideoRegister = openClubVideoRegister;

  window.openClubVideoEdit = openClubVideoEdit;

  window.submitClubVideo = submitClubVideo;

  window.deleteClubVideoFromModal = deleteClubVideoFromModal;

  window.toggleClubMemberPick = toggleClubMemberPick;

  window.setClubVideoCategoryPick = setClubVideoCategoryPick;

  window.openLessonVideo = openLessonVideo;

  window.closeLessonVideoMo = closeLessonVideoMo;

  window.openLessonVideoRegister = openClubVideoRegister;

  window.submitLessonVideo = submitClubVideo;

  window.openMatchVideosForMember = openMatchVideosForMember;

  window.clearMatchPlayerFilter = clearMatchPlayerFilter;

  window.armVideosScrollAnchor = armVideosScrollAnchor;

  initLessonShare({

    g: g,

    toast: toast,

    getVideos: videos,

    getMembers: members,

    openMo: openMo,

    openLessonVideo: openLessonVideo,

    nav: C.nav,

    isDeepLinkHandled: C.isDeepLinkHandled,

    setDeepLinkHandled: C.setDeepLinkHandled,

    isDeepLinkInFlight: C.isDeepLinkInFlight,

    setDeepLinkInFlight: C.setDeepLinkInFlight

  });

  initVideoDeepLink({

    g: g,

    getVideos: videos,

    getChal: chal,

    nav: C.nav,

    scrollVideoCardIntoView: scrollVideoCardIntoView,

    scrollToElement: C.scrollToElement,

    openLessonVideo: openLessonVideo,

    isDeepLinkHandled: C.isDeepLinkHandled,

    setDeepLinkHandled: C.setDeepLinkHandled,

    isDeepLinkInFlight: C.isDeepLinkInFlight,

    setDeepLinkInFlight: C.setDeepLinkInFlight

  });

  renderVideoFilterTabs();

}



function g(id) { return C.g(id); }

function toast(msg) { return C.toast(msg); }

function db() { return C.getDb(); }

function chal() { return C.getChal(); }

function videos() { return C.getVideos(); }

function members() { return C.getMembers ? C.getMembers() : []; }

function openMo(id) { return C.openMo(id); }

function closeMo(id) { return C.closeMo(id); }



/** @deprecated appNav 하위호환 */

export function getVideoSection() {

  return _categoryFilter;

}



/** @deprecated */

export function getLessonFilter() {

  return _mineFilter ? 'mine' : 'all';

}



export function getMatchPlayerFilter() {

  return _matchPlayerFilter;

}



export function getVideoCategoryFilter() {

  return _categoryFilter;

}



export function setVideoCategoryFilter(filter) {

  if (filter === 'mine') {

    setVideoMineFilter();

    return;

  }

  if (filter !== 'all' && VIDEO_CATEGORIES.indexOf(filter) < 0) return;

  _categoryFilter = filter;

  _mineFilter = false;

  if (filter !== VIDEO_FILTER_CHALLENGE) _matchPlayerFilter = '';

  _syncCategoryFilterUi();

  renderClubVideos();

}



export function setVideoMineFilter() {

  _mineFilter = !_mineFilter;

  if (_mineFilter) _categoryFilter = 'all';

  _syncCategoryFilterUi();

  renderClubVideos();

}



/** @deprecated appNav — lesson/match → 카테고리 필터 */

export function setVideoSection(section) {

  if (section === 'mine') {

    _mineFilter = true;

    _categoryFilter = 'all';

  } else if (section === 'lesson' || !section) {

    _categoryFilter = 'all';

    _mineFilter = false;

    _matchPlayerFilter = '';

  } else if (section === 'match' || section === VIDEO_FILTER_CHALLENGE) {

    _categoryFilter = VIDEO_FILTER_CHALLENGE;

    _mineFilter = false;

  } else if (VIDEO_CATEGORIES.indexOf(section) >= 0) {

    _categoryFilter = section;

    _mineFilter = false;

  }

  _syncCategoryFilterUi();

  renderClubVideos();

}



/** @deprecated */

export function setLessonFilter(filter) {

  if (filter === 'mine') setVideoMineFilter();

  else {

    _mineFilter = false;

    _syncCategoryFilterUi();

    renderClubVideos();

  }

}



export function clearMatchPlayerFilter() {

  _matchPlayerFilter = '';

  _syncMatchFilterUi();

  if (_categoryFilter === VIDEO_FILTER_CHALLENGE) renderClubVideos();

}



export function openMatchVideosForMember(memberId) {

  var m = members().find(function(x) { return x.id === memberId; });

  _matchPlayerFilter = m && m.name ? m.name : '';

  _categoryFilter = VIDEO_FILTER_CHALLENGE;

  _mineFilter = false;

  if (C.nav) C.nav('videos', VIDEO_FILTER_CHALLENGE);

  else {

    _syncCategoryFilterUi();

    _syncMatchFilterUi();

    renderClubVideos();

  }

}



function _esc(s) {

  return String(s)

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;');

}



function _viewCountBadgeHtml(appCount) {

  if (hasYouTubeViewStats()) {

    return '<span class="vid-view-count vid-view-count--loading">👁 ···</span>';

  }

  if (!appCount || appCount < 1) return '';

  return '<span class="vid-view-count">👁 ' + formatViewCount(appCount) + ' 재생</span>';

}



function _hydrateViewCounts(grid) {

  if (!grid) return;

  var thumbs = grid.querySelectorAll('[data-yt-vid]');

  if (!thumbs.length) return;

  var ids = [];

  thumbs.forEach(function(el) { ids.push(el.getAttribute('data-yt-vid')); });

  var useYoutube = hasYouTubeViewStats();

  fetchYouTubeViewCounts(ids).then(function(ytViews) {

    thumbs.forEach(function(thumb) {

      var ytId = thumb.getAttribute('data-yt-vid');

      var appCount = parseInt(thumb.getAttribute('data-app-views') || '0', 10) || 0;

      var label = resolveViewCountLabel(appCount, ytId, ytViews, { loading: false });

      var badge = thumb.querySelector('.vid-view-count');

      if (!label) {

        if (badge) badge.remove();

        return;

      }

      if (!badge) {

        badge = document.createElement('span');

        badge.className = 'vid-view-count';

        thumb.appendChild(badge);

      }

      badge.classList.remove('vid-view-count--loading');

      badge.textContent = label;

    });

  }).catch(function() {

    if (!useYoutube) return;

    thumbs.forEach(function(thumb) {

      var badge = thumb.querySelector('.vid-view-count');

      if (badge) badge.remove();

    });

  });

}



function _membersSortedForSelect() {

  return members()

    .filter(function(m) { return m && m.name && m.status !== '비활성'; })

    .slice()

    .sort(function(a, b) { return a.name.localeCompare(b.name, 'ko'); });

}



function renderVideoFilterTabs() {

  var box = g('club-video-filter-tabs');

  if (!box) return;

  var html = '<button class="fc" id="club-vid-filter-all" type="button" data-cat="all"'

    + ' onclick="setVideoCategoryFilter(\'all\')">전체</button>';

  VIDEO_FILTER_TABS.forEach(function(cat) {

    var emoji = VIDEO_CATEGORY_EMOJI[cat] || '';

    var id = _FILTER_BTN_IDS[cat];

    html += '<button class="fc" id="' + id + '" type="button" data-cat="' + cat + '"'

      + ' onclick="setVideoCategoryFilter(\'' + cat + '\')">'

      + (emoji ? emoji + ' ' : '') + _esc(cat) + '</button>';

  });

  html += '<button class="fc" id="club-vid-filter-mine" type="button" data-cat="mine"'

    + ' onclick="setVideoMineFilter()">내 영상</button>';

  box.innerHTML = html;

  _syncCategoryFilterUi();

}



function _formatCardDate(isoDate) {

  if (!isoDate) return '';

  var raw = String(isoDate).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';

  var d = new Date(raw + 'T12:00:00');

  if (isNaN(d.getTime())) return '';

  var days = ['일', '월', '화', '수', '목', '금', '토'];

  var m = String(d.getMonth() + 1).padStart(2, '0');

  var day = String(d.getDate()).padStart(2, '0');

  return m + '/' + day + ' (' + days[d.getDay()] + ')';

}



function _categoryBadgeHtml(cat) {

  var cls = VIDEO_CATEGORY_BADGE[cat] || 'vid-cat-lesson';

  return '<span class="vid-card-cat ' + cls + '">' + _esc(cat) + '</span>';

}



function _playerBadgesHtml(names) {

  if (!names || !names.length) return '';

  var shown = names.slice(0, 3);

  var extra = names.length - shown.length;

  var html = '<div class="vid-card-players">';

  shown.forEach(function(name) {

    html += '<span class="vid-player-badge">👤 ' + _esc(name) + '</span>';

  });

  if (extra > 0) {

    html += '<span class="vid-player-badge vid-player-badge--more">+' + extra + '명</span>';

  }

  html += '</div>';

  return html;

}



function _thumbBlockHtml(opts) {

  var catCls = VIDEO_CATEGORY_BADGE[opts.category] || 'vid-cat-lesson';

  return '<div class="vid-video-thumb ' + catCls + '" data-yt-vid="' + opts.vid + '" data-app-views="' + opts.appViews + '">'

    + '<img src="' + opts.thumb + '" alt="" loading="lazy" decoding="async"'

    + ' onerror="this.parentElement.classList.add(\'vid-video-thumb--fail\')">'

    + '<span class="vid-thumb-fallback" aria-hidden="true">📹</span>'

    + '<span class="vid-video-play" aria-hidden="true">▶</span>'

    + _viewCountBadgeHtml(opts.appViews)

    + (opts.shareBtn || '')

    + '</div>';

}



function _buildVideoCardShell(opts) {

  var dateLabel = _formatCardDate(opts.dateIso);

  var metaRow = '<div class="vid-card-meta">'

    + _categoryBadgeHtml(opts.category)

    + (dateLabel ? '<span class="vid-card-date">' + _esc(dateLabel) + '</span>' : '')

    + '</div>';

  var adminBtn = opts.adminEditId && isAdmin()

    ? '<button type="button" class="vid-card-edit admin-only" onclick="event.stopPropagation();openClubVideoEdit(\''

      + opts.adminEditId + '\')" aria-label="영상 수정">✏️</button>'

    : '';

  return '<div class="vid-video-card' + (opts.extraClass ? ' ' + opts.extraClass : '') + '"'

    + opts.dataAttrs

    + ' onclick="' + opts.onClick + '" role="button" tabindex="0" aria-label="영상 재생">'

    + metaRow

    + _thumbBlockHtml(opts)

    + '<div class="vid-video-body">'

    + '<div class="vid-video-title vid-card-title">' + _esc(opts.title) + '</div>'

    + _playerBadgesHtml(opts.playerNames)

    + adminBtn

    + '</div>'

    + '</div>';

}



function _emptyStateHtml(filterKey, extraHtml) {

  var emoji = VIDEO_CATEGORY_EMOJI[filterKey] || VIDEO_CATEGORY_EMOJI.all;

  return '<div style="font-size:48px;margin-bottom:14px">' + emoji + '</div>'

    + '<div style="font-size:16px;font-weight:800;color:var(--t2);margin-bottom:8px">아직 등록된 영상이 없습니다</div>'

    + (extraHtml || '<div style="font-size:13px;color:var(--t3);line-height:1.5">관리자가 영상을 등록하면 여기에서 볼 수 있어요</div>');

}



function _lessonMemberAvatar(name) {

  if (!name || !C.memberAvatarHtml) return '';

  return C.memberAvatarHtml(name, '', 'vid-lesson-member__av');

}



function _shareIconBtn(id) {

  return '<button type="button" class="vid-kakao-share"'

    + ' onclick="event.stopPropagation(); event.preventDefault(); shareLessonKakao(\'' + id + '\'); return false;"'

    + ' title="카카오톡 공유" aria-label="카카오톡 공유">'

    + '<span class="vid-kakao-share__icon" aria-hidden="true">💬</span>'

    + '<span class="vid-kakao-share__label">카톡</span></button>';

}



function _matchShareIconBtn(id) {

  return '<button type="button" class="vid-kakao-share"'

    + ' onclick="event.stopPropagation(); event.preventDefault(); shareKakao(\'' + id + '\'); return false;"'

    + ' title="카카오톡 공유" aria-label="카카오톡 공유">'

    + '<span class="vid-kakao-share__icon" aria-hidden="true">💬</span>'

    + '<span class="vid-kakao-share__label">카톡</span></button>';

}



function _challengeVideoId(c) {

  if (!c || !c.videoUrl) return null;

  return extractYouTubeVideoId(c.videoUrl);

}



function _challengeHasPlayer(c, playerName) {

  if (!playerName) return true;

  return (c.myTeam || []).indexOf(playerName) >= 0

    || (c.oppTeam || []).indexOf(playerName) >= 0;

}



function _chVsTitle(c) {

  var my = (c.myTeam || []).join(' · ') || '—';

  var opp = (c.oppTeam || []).join(' · ') || '—';

  return my + ' VS ' + opp;

}



function _matchPlayerNames(c) {

  var names = [];

  (c.myTeam || []).forEach(function(n) { if (n && names.indexOf(n) < 0) names.push(n); });

  (c.oppTeam || []).forEach(function(n) { if (n && names.indexOf(n) < 0) names.push(n); });

  return names;

}



function buildMatchVideoCard(c) {

  var vid = _challengeVideoId(c);

  if (!vid) return '';

  return _buildVideoCardShell({

    category: VIDEO_FILTER_CHALLENGE,

    dateIso: c.date || '',

    title: _chVsTitle(c),

    playerNames: _matchPlayerNames(c),

    vid: vid,

    thumb: buildYouTubeThumbUrl(vid),

    appViews: getAppViewCount(c),

    shareBtn: _matchShareIconBtn(c.id),

    onClick: 'openMatchVideo(\'' + c.id + '\')',

    extraClass: 'vid-match-card',

    dataAttrs: ' data-cid="' + c.id + '" data-match-id="' + c.id + '"'

  });

}



function buildClubVideoCard(v) {

  var vid = extractYouTubeVideoId(v.youtubeUrl);

  if (!vid) return '';

  var cat = getVideoDisplayTitle(v);

  return _buildVideoCardShell({

    category: cat,

    dateIso: getVideoDisplayDate(v),

    title: v.title || cat,

    playerNames: lessonMemberNames(v, members()),

    vid: vid,

    thumb: buildYouTubeThumbUrl(vid),

    appViews: getAppViewCount(v),

    shareBtn: _shareIconBtn(v.id),

    onClick: 'openLessonVideo(\'' + v.id + '\')',

    adminEditId: v.id,

    extraClass: 'vid-lesson-card',

    dataAttrs: ' data-vid="' + v.id + '"'

  });

}



function _syncMatchFilterUi() {

  var bar = g('match-videos-filter');

  var label = g('match-videos-filter-label');

  if (!bar) return;

  if (!_matchPlayerFilter || _categoryFilter !== VIDEO_FILTER_CHALLENGE) {

    bar.hidden = true;

    return;

  }

  bar.hidden = false;

  if (label) label.textContent = _matchPlayerFilter + ' 선수 대결 영상';

}



function _filteredChallengeVideos() {

  var list = chal().filter(function(c) {

    return c.status === 'completed' && _challengeVideoId(c) && _challengeHasPlayer(c, _matchPlayerFilter);

  });

  list.sort(function(a, b) {

    return (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || '');

  });

  return list;

}



function _challengeVideosForPlayerName(name) {

  if (!name) return [];

  return chal().filter(function(c) {

    return c.status === 'completed' && _challengeVideoId(c) && _challengeHasPlayer(c, name);

  }).sort(function(a, b) {

    return (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || '');

  });

}



function _syncCategoryFilterUi() {

  var activeCat = _mineFilter ? 'mine' : _categoryFilter;

  document.querySelectorAll('#club-video-filter-tabs .fc').forEach(function(btn) {

    var cat = btn.dataset.cat || '';

    var on = cat === activeCat;

    btn.classList.toggle('on', on);

    btn.classList.remove('vid-filter-on--all', 'vid-filter-on--lunch', 'vid-filter-on--evening',

      'vid-filter-on--challenge', 'vid-filter-on--lesson', 'vid-filter-on--training', 'vid-filter-on--mine');

    if (on && cat !== 'all') {

      btn.classList.add('vid-filter-on--' + _filterToneClass(cat));

    }

  });

  _syncMatchFilterUi();

}



function _filterToneClass(cat) {

  if (cat === '점심경기') return 'lunch';

  if (cat === '저녁경기') return 'evening';

  if (cat === '대결') return 'challenge';

  if (cat === '레슨') return 'lesson';

  if (cat === '훈련') return 'training';

  if (cat === 'mine') return 'mine';

  return 'all';

}



function _buildVideosGridHtml() {

  if (_mineFilter) {

    var myId = C.getMyPlayerId ? C.getMyPlayerId() : '';

    if (!myId) return '';

    var clubHtml = _filteredClubVideos().map(buildClubVideoCard).join('');

    var myM = members().find(function(x) { return x.id === myId; });

    var chalHtml = myM && myM.name

      ? _challengeVideosForPlayerName(myM.name).map(buildMatchVideoCard).join('')

      : '';

    return clubHtml + chalHtml;

  }

  if (_categoryFilter === VIDEO_FILTER_CHALLENGE) {

    return _filteredChallengeVideos().map(buildMatchVideoCard).join('');

  }

  return _filteredClubVideos().map(buildClubVideoCard).join('');

}



function _filteredClubVideos() {

  var list = videos().slice();

  if (_mineFilter) {

    var myId = C.getMyPlayerId ? C.getMyPlayerId() : '';

    if (!myId) return [];

    list = list.filter(function(v) { return lessonHasMember(v, myId); });

  } else if (_categoryFilter !== 'all') {

    list = list.filter(function(v) { return getVideoCategory(v) === _categoryFilter; });

  }

  return sortVideosList(list, _mineFilter ? 'mine' : _categoryFilter);

}



function renderClubVideos() {

  var grid = g('club-videos-grid');

  var empty = g('club-videos-empty');

  if (!grid) return;

  _syncCategoryFilterUi();

  var myReady = C.isMyPlayerReady ? C.isMyPlayerReady() : false;

  var list = _filteredClubVideos();

  if (_mineFilter && !myReady) {

    grid.innerHTML = '';

    if (empty) {

      empty.style.display = 'block';

      empty.innerHTML = '<div style="font-size:48px;margin-bottom:14px">' + VIDEO_CATEGORY_EMOJI.mine + '</div>'

        + '<div style="font-size:16px;font-weight:800;color:var(--t2);margin-bottom:8px">내 선수를 설정해주세요</div>'

        + '<div style="font-size:13px;color:var(--t3);line-height:1.5;margin-bottom:16px">설정 후 나에게 태그된 영상을 볼 수 있어요</div>'

        + '<button type="button" class="btn btn-p" onclick="openMyPlayerSetup(true)">내 선수 설정</button>';

    }

    return;

  }

  if (!list.length && !_mineFilter && _categoryFilter !== VIDEO_FILTER_CHALLENGE) {

    grid.innerHTML = '';

    if (empty) {

      empty.style.display = 'block';

      empty.innerHTML = _emptyStateHtml(_categoryFilter === 'all' ? 'all' : _categoryFilter);

    }

    return;

  }

  var html = _mineFilter ? _buildVideosGridHtml() : (

    _categoryFilter === VIDEO_FILTER_CHALLENGE

      ? _filteredChallengeVideos().map(buildMatchVideoCard).join('')

      : list.map(buildClubVideoCard).join('')

  );

  if (!html) {

    grid.innerHTML = '';

    if (empty) {

      empty.style.display = 'block';

      var emptyKey = _mineFilter ? 'mine'

        : (_categoryFilter === VIDEO_FILTER_CHALLENGE ? '대결' : _categoryFilter);

      empty.innerHTML = _emptyStateHtml(emptyKey, _matchPlayerFilter

        ? '<div style="font-size:13px;color:var(--t3);line-height:1.5;margin-bottom:16px">다른 선수 영상을 보려면 전체 보기를 눌러주세요</div>'

          + '<button type="button" class="btn btn-g" onclick="clearMatchPlayerFilter()">전체 보기</button>'

        : undefined);

    }

    return;

  }

  if (empty) empty.style.display = 'none';

  grid.innerHTML = html;

  _hydrateViewCounts(grid);

}



export function renderVideos() {

  renderClubVideos();

}



export function refreshVideosViewBadges() {

  var grid = g('club-videos-grid');

  if (!grid) return;

  grid.querySelectorAll('.vid-video-thumb[data-yt-vid]').forEach(function(thumb) {

    var card = thumb.closest('[data-vid], [data-match-id]');

    if (!card) return;

    var matchId = card.getAttribute('data-match-id');

    var vidId = card.getAttribute('data-vid');

    var appCount = 0;

    if (matchId) {

      var c = chal().find(function(x) { return x.id === matchId; });

      appCount = getAppViewCount(c);

    } else if (vidId) {

      var v = videos().find(function(x) { return x.id === vidId; });

      appCount = getAppViewCount(v);

    }

    thumb.setAttribute('data-app-views', appCount);

  });

  _hydrateViewCounts(grid);

}



function _syncClubDateFieldUi() {

  var wrap = g('club-video-date-wrap');

  if (!wrap) return;

  wrap.hidden = !isDateSortCategory(_clubCategoryPick);

}



function renderClubCategoryPick() {

  var box = g('club-video-category');

  if (!box) return;

  box.innerHTML = VIDEO_CLUB_CATEGORIES.map(function(cat) {

    var on = _clubCategoryPick === cat;

    return '<button type="button" class="club-video-category-chip' + (on ? ' on' : '')

      + '" data-cat="' + cat + '" onclick="setClubVideoCategoryPick(\'' + cat + '\')">'

      + _esc(cat) + '</button>';

  }).join('');

  _syncClubDateFieldUi();

}



function setClubVideoCategoryPick(cat) {

  if (VIDEO_CLUB_CATEGORIES.indexOf(cat) < 0) return;

  _clubCategoryPick = cat;

  renderClubCategoryPick();

}



function renderClubMemberPick() {

  var box = g('club-video-members');

  if (!box) return;

  var list = _membersSortedForSelect();

  if (!_clubMemberPick.length && !_editingVideoId) {

    var myId = C.getMyPlayerId ? C.getMyPlayerId() : '';

    if (myId && list.some(function(m) { return m.id === myId; })) {

      _clubMemberPick = [myId];

    }

  }

  box.innerHTML = list.map(function(m) {

    var on = _clubMemberPick.indexOf(m.id) >= 0;

    return '<button type="button" class="lesson-member-chip' + (on ? ' on' : '')

      + '" data-id="' + m.id + '" onclick="toggleClubMemberPick(\'' + m.id + '\')">'

      + _esc(m.name) + '</button>';

  }).join('');

}



function toggleClubMemberPick(id) {

  var idx = _clubMemberPick.indexOf(id);

  if (idx >= 0) _clubMemberPick.splice(idx, 1);

  else _clubMemberPick.push(id);

  renderClubMemberPick();

}



function _resetClubVideoForm() {

  _editingVideoId = null;

  _clubCategoryPick = VIDEO_CATEGORY_DATE_SORT[0];

  _clubMemberPick = [];

  var url = g('club-video-url');

  var desc = g('club-video-desc');

  var dateEl = g('club-video-date');

  if (url) url.value = '';

  if (desc) desc.value = '';

  if (dateEl) dateEl.value = todayDateInputValue();

  var modalTitle = g('club-video-modal-title');

  if (modalTitle) modalTitle.innerHTML = '🎬 영상 <em>등록</em>';

  var delBtn = g('btn-club-video-delete');

  if (delBtn) delBtn.hidden = true;

  var saveBtn = g('btn-club-video-save');

  if (saveBtn) saveBtn.textContent = '저장';

  renderClubCategoryPick();

  renderClubMemberPick();

}



function _fillClubVideoForm(v) {

  _editingVideoId = v.id;

  _clubCategoryPick = getVideoCategory(v);

  _clubMemberPick = lessonMemberIds(v).slice();

  var url = g('club-video-url');

  var desc = g('club-video-desc');

  var dateEl = g('club-video-date');

  if (url) url.value = v.youtubeUrl || '';

  if (desc) desc.value = v.description || '';

  if (dateEl) dateEl.value = v.date || getVideoDisplayDate(v) || todayDateInputValue();

  var modalTitle = g('club-video-modal-title');

  if (modalTitle) modalTitle.innerHTML = '✏️ 영상 <em>수정</em>';

  var delBtn = g('btn-club-video-delete');

  if (delBtn) delBtn.hidden = false;

  var saveBtn = g('btn-club-video-save');

  if (saveBtn) saveBtn.textContent = '수정 저장';

  renderClubCategoryPick();

  renderClubMemberPick();

}



function openClubVideoRegister() {

  requireAdmin(function() {

    _resetClubVideoForm();

    openMo('mo-club-video');

  });

}



function openClubVideoEdit(id) {

  requireAdmin(function() {

    var v = videos().find(function(x) { return x.id === id; });

    if (!v) {

      toast('⚠️ 영상을 찾을 수 없습니다');

      return;

    }

    _fillClubVideoForm(v);

    openMo('mo-club-video');

  });

}



function _buildClubVideoPayload() {

  var memberIds = _clubMemberPick.slice();

  var memberNames = memberIds.map(function(mid) {

    var m = members().find(function(x) { return x.id === mid; });

    return m ? m.name : '';

  }).filter(Boolean);

  var urlEl = g('club-video-url');

  var descEl = g('club-video-desc');

  var dateEl = g('club-video-date');

  var title = _clubCategoryPick;

  var youtubeUrl = urlEl ? urlEl.value.trim() : '';

  var description = descEl ? descEl.value.trim().slice(0, 200) : '';

  var date = dateEl ? dateEl.value.trim() : '';

  return {

    memberIds: memberIds,

    memberNames: memberNames,

    title: title,

    youtubeUrl: youtubeUrl,

    description: description,

    date: date,

    category: _clubCategoryPick

  };

}



async function submitClubVideo() {

  var payload = _buildClubVideoPayload();

  if (!payload.memberIds.length) {

    toast('⚠️ 선수를 한 명 이상 선택해주세요');

    return;

  }

  if (!extractYouTubeVideoId(payload.youtubeUrl)) {

    toast('⚠️ 유효한 유튜브 URL을 입력해주세요');

    return;

  }

  if (isDateSortCategory(payload.category) && !payload.date) {

    toast('⚠️ 점심·저녁경기는 날짜를 선택해주세요');

    return;

  }

  var data = {

    title: payload.title,

    youtubeUrl: payload.youtubeUrl,

    description: payload.description,

    category: payload.category,

    memberId: payload.memberIds[0],

    memberName: payload.memberNames.join(' · '),

    memberIds: payload.memberIds,

    memberNames: payload.memberNames,

    date: isDateSortCategory(payload.category) ? payload.date : (payload.date || ''),

    viewCount: 0,

    createdAt: new Date().toISOString()

  };

  var editingId = _editingVideoId;

  closeMo('mo-club-video');

  try {

    if (editingId) {
      var prev = videos().find(function(x) { return x.id === editingId; });
      var patch = {
        title: data.title,
        youtubeUrl: data.youtubeUrl,
        description: data.description,
        category: data.category,
        memberId: data.memberId,
        memberName: data.memberName,
        memberIds: data.memberIds,
        memberNames: data.memberNames,
        date: data.date || ''
      };
      if (db()) {
        await updateDoc(doc(db(), COL_VIDEOS, editingId), patch);
      } else if (prev) {
        Object.assign(prev, patch);
        renderClubVideos();
      }
      toast('✅ 영상이 수정됐습니다');

    } else if (db()) {

      await addDoc(collection(db(), COL_VIDEOS), data);

      toast('✅ 영상이 등록됐습니다');

    } else {

      C.unshiftVideoLocal({ id: 'l' + Date.now(), ...data });

      renderClubVideos();

      toast('✅ 영상이 등록됐습니다');

    }

  } catch (e) {

    toast('❌ ' + e.message);

  } finally {

    _editingVideoId = null;

  }

}



function deleteClubVideoFromModal() {

  if (!_editingVideoId) return;

  requireAdmin(function() {

    if (!confirm('이 영상을 삭제할까요?')) return;

    var id = _editingVideoId;

    closeMo('mo-club-video');

    (async function() {

      try {

        if (db()) await deleteDoc(doc(db(), COL_VIDEOS, id));

        else C.removeVideoLocal(id);

        toast('🗑 영상이 삭제됐습니다');

      } catch (e) {

        toast('❌ ' + e.message);

      } finally {

        _editingVideoId = null;

      }

    })();

  });

}



function openLessonVideo(id) {

  armVideosScrollAnchor('lesson', id);

  var v = videos().find(function(x) { return x.id === id; });

  if (!v) return;

  var embed = buildYouTubeEmbedUrl(extractYouTubeVideoId(v.youtubeUrl));

  if (!embed) {

    toast('⚠️ 재생할 수 없는 URL입니다');

    return;

  }

  logVideoView(id);
  trackLessonVideoView(id);

  var meta = g('lesson-video-play-meta');

  var names = lessonMemberNames(v, members());

  if (meta) {

    var cat = getVideoDisplayTitle(v);

    if (names.length || cat) {

      meta.hidden = false;

      var memberBlock = names.length

        ? '<div class="vid-lesson-play-member">' + names.map(function(name) {

          return '<div class="vid-lesson-play-member__item">' + _lessonMemberAvatar(name)

            + '<span>' + _esc(name) + '</span></div>';

        }).join('') + '</div>'

        : '';

      var catCls = VIDEO_CATEGORY_BADGE[cat] || 'vid-cat-lesson';

      meta.innerHTML = memberBlock

        + '<div class="vid-lesson-play-title vid-video-cat-title ' + catCls + '">' + _esc(cat) + '</div>';

    } else {

      meta.hidden = true;

      meta.innerHTML = '';

    }

  }

  var iframe = g('lesson-video-iframe');

  if (iframe) iframe.src = embed + '?autoplay=1&rel=0';

  openMo('mo-lesson-video-play');

}



function closeLessonVideoMo() {

  var iframe = g('lesson-video-iframe');

  if (iframe) iframe.src = '';

  var meta = g('lesson-video-play-meta');

  if (meta) {

    meta.hidden = true;

    meta.innerHTML = '';

  }

  closeMo('mo-lesson-video-play');

}


