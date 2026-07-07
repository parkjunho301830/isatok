/**

 * 영상 탭 딥링크 — 경기·레슨 목록 스크롤

 */

import {

  DEEPLINK_PARAM, DEEPLINK_VIDEO_PARAM,

  DEEPLINK_LESSON_PARAM, DEEPLINK_LESSON_PLAY_PARAM,

  DEEPLINK_MATCH_VIDEO_PARAM, HIGHLIGHT_REMOVE_MS

} from './constants.js?v=2026.07.07.01';

import { extractYouTubeVideoId } from './youtubeUtils.js?v=2026.07.07.01';



const LS_DEEPLINK_LESSON = 'isatok_deeplink_lesson';

const LS_DEEPLINK_LESSON_PLAY = 'isatok_deeplink_lesson_play';

const LS_DEEPLINK_MATCH_VIDEO = 'isatok_deeplink_match_video';

const LS_DEEPLINK_MATCH = 'isatok_deeplink_match';

const LS_DEEPLINK_VIDEO = 'isatok_deeplink_video';



let C = null;

/** 영상 탭 스크롤 앵커 — 재렌더·모달 닫기 후에도 카드 위치 유지 */

let _scrollAnchor = null;



export function initVideoDeepLink(ctx) {

  C = ctx;

}



export function armVideosScrollAnchor(kind, id) {

  if (!id || (kind !== 'match' && kind !== 'lesson')) return;

  _scrollAnchor = { kind: kind, id: id };

}



export function clearVideosScrollAnchor() {

  _scrollAnchor = null;

}



function _anchorSelector() {

  if (!_scrollAnchor) return null;

  return _scrollAnchor.kind === 'match'

    ? '[data-match-id="' + _scrollAnchor.id + '"]'

    : '[data-vid="' + _scrollAnchor.id + '"]';

}



function _scrollToAnchor(opts) {

  if (!_scrollAnchor || !C) return false;

  var el = document.querySelector(_anchorSelector());

  if (!el) return false;

  var behavior = (opts && opts.behavior) || 'auto';

  if (C.scrollVideoCardIntoView) {

    C.scrollVideoCardIntoView(el, { behavior: behavior, retry: !!(opts && opts.retry) });

  } else if (C.scrollToElement) {

    C.scrollToElement(el, { align: 'center', behavior: behavior });

  } else {

    el.scrollIntoView({ behavior: behavior, block: 'center' });

  }

  return true;

}



export function restoreVideosScrollAnchor(opts) {

  if (!_scrollAnchor) return;

  _scrollToAnchor(opts);

  var delays = (opts && opts.delays) || [50, 150, 400, 800];

  delays.forEach(function(ms) {

    setTimeout(function() {

      _scrollToAnchor({ behavior: 'auto', retry: false });

    }, ms);

  });

}



/** @deprecated renderVideos 훅 — restoreVideosScrollAnchor 사용 */

export function replayVideoDeepLinkScrollIfNeeded() {

  restoreVideosScrollAnchor({ behavior: 'auto', delays: [50, 200] });

}



export function onVideoModalClosed(id) {

  if (id !== 'mo-match-video' && id !== 'mo-lesson-video-play') return;

  restoreVideosScrollAnchor({ behavior: 'auto', delays: [0, 80, 200, 450, 900] });

}



function videos() { return C.getVideos(); }

function chal() { return C.getChal(); }



export function peekDeepLinkLessonIdLocal() {

  try {

    var id = new URLSearchParams(window.location.search).get(DEEPLINK_LESSON_PARAM);

    if (!id) id = sessionStorage.getItem(LS_DEEPLINK_LESSON);

    return id || null;

  } catch (e) {

    return null;

  }

}



export function peekDeepLinkLessonPlayLocal() {

  try {

    if (new URLSearchParams(window.location.search).get(DEEPLINK_LESSON_PLAY_PARAM) === '1') {

      return true;

    }

    return sessionStorage.getItem(LS_DEEPLINK_LESSON_PLAY) === '1';

  } catch (e) {}

  return false;

}



export function peekMatchVideoDeepLinkId() {

  try {

    var sp = new URLSearchParams(window.location.search);

    var id = sp.get(DEEPLINK_MATCH_VIDEO_PARAM);

    if (id) return id;

    if (sp.get(DEEPLINK_VIDEO_PARAM) === '1' && sp.get(DEEPLINK_PARAM)) {

      return sp.get(DEEPLINK_PARAM);

    }

    id = sessionStorage.getItem(LS_DEEPLINK_MATCH_VIDEO);

    if (id) return id;

    if (sessionStorage.getItem(LS_DEEPLINK_VIDEO) === '1') {

      return sessionStorage.getItem(LS_DEEPLINK_MATCH);

    }

  } catch (e) {}

  return null;

}



export function peekMatchVideoDeepLinkPlayLocal() {

  try {

    var sp = new URLSearchParams(window.location.search);

    if (sp.get(DEEPLINK_MATCH_VIDEO_PARAM)) return true;

    if (sp.get(DEEPLINK_VIDEO_PARAM) === '1') return true;

    if (sessionStorage.getItem(LS_DEEPLINK_MATCH_VIDEO)) return true;

    if (sessionStorage.getItem(LS_DEEPLINK_VIDEO) === '1') return true;

  } catch (e) {}

  return false;

}



function _clearLessonDeepLink() {

  try {

    sessionStorage.removeItem(LS_DEEPLINK_LESSON);

    sessionStorage.removeItem(LS_DEEPLINK_LESSON_PLAY);

  } catch (e) {}

}



function _clearMatchVideoDeepLink() {

  try {

    sessionStorage.removeItem(LS_DEEPLINK_MATCH_VIDEO);

    sessionStorage.removeItem(LS_DEEPLINK_MATCH);

    sessionStorage.removeItem(LS_DEEPLINK_VIDEO);

  } catch (e) {}

}



function _highlightVideoCard(el, opts) {

  if (!el) return;

  opts = opts || {};

  var behavior = opts.instant ? 'auto' : 'smooth';

  if (C.scrollVideoCardIntoView) {

    C.scrollVideoCardIntoView(el, { behavior: behavior, retry: !opts.instant });

  } else if (C.scrollToElement) {

    C.scrollToElement(el, { align: 'center', behavior: behavior });

  } else {

    el.scrollIntoView({ behavior: behavior, block: 'center' });

  }

  el.classList.add('deep-link-highlight');

  setTimeout(function() {

    el.classList.remove('deep-link-highlight');

  }, HIGHLIGHT_REMOVE_MS);

}



function _waitForVideoCard(selector, cb, attempts) {

  attempts = attempts || 0;

  var el = document.querySelector(selector);

  if (el) {

    cb(el);

    return;

  }

  if (attempts >= 40) {

    cb(null);

    return;

  }

  setTimeout(function() {

    _waitForVideoCard(selector, cb, attempts + 1);

  }, 250);

}



function _finishDeepLink(ok) {

  C.setDeepLinkHandled(true);

  C.setDeepLinkInFlight(false);

  if (ok) {

    _clearLessonDeepLink();

    _clearMatchVideoDeepLink();

  }

}



function _scrollLessonCard(lessonId, shouldPlay) {

  armVideosScrollAnchor('lesson', lessonId);

  _waitForVideoCard('[data-vid="' + lessonId + '"]', function(el) {

    if (el) _highlightVideoCard(el);

    if (shouldPlay) {

      setTimeout(function() {

        C.openLessonVideo(lessonId);

      }, el ? 450 : 0);

    }

    _finishDeepLink(!!el);

    restoreVideosScrollAnchor({ behavior: 'auto', delays: [500, 1000, 1600] });

  });

}



function _scrollMatchCard(matchId, shouldPlay) {
  armVideosScrollAnchor('match', matchId);
  C.nav('videos', '대결');
  _waitForVideoCard('[data-match-id="' + matchId + '"]', function(el) {
    if (el) _highlightVideoCard(el);
    if (shouldPlay) {
      setTimeout(function() {
        window.openMatchVideo(matchId);
      }, el ? 450 : 0);
    }
    _finishDeepLink(!!el);
    restoreVideosScrollAnchor({ behavior: 'auto', delays: [500, 1000, 1600] });
  });
}



export function peekBootVideoDeepLinkSection() {
  if (peekDeepLinkLessonIdLocal()) return 'videos';
  if (peekMatchVideoDeepLinkId()) return 'videos';
  return null;
}

export function handleLessonVideoDeepLink() {
  if (C.isDeepLinkHandled() || C.isDeepLinkInFlight()) return;
  var lessonId = peekDeepLinkLessonIdLocal();
  if (!lessonId) return;

  C.setDeepLinkInFlight(true);
  history.replaceState(null, '', '/');
  C.nav('videos');

  var shouldPlay = peekDeepLinkLessonPlayLocal();

  function tryScroll(n) {
    var v = videos().find(function(x) { return x.id === lessonId; });
    if (v && extractYouTubeVideoId(v.youtubeUrl)) {
      setTimeout(function() {
        _scrollLessonCard(lessonId, shouldPlay);
      }, 300);
      return;
    }
    if (n < 40) setTimeout(function() { tryScroll(n + 1); }, 250);
    else _finishDeepLink(false);
  }
  tryScroll(0);
}

export function handleMatchVideoDeepLink() {
  if (C.isDeepLinkHandled() || C.isDeepLinkInFlight()) return;
  var matchId = peekMatchVideoDeepLinkId();
  if (!matchId) return;

  C.setDeepLinkInFlight(true);
  history.replaceState(null, '', '/');
  C.nav('videos', '대결');

  var shouldPlay = peekMatchVideoDeepLinkPlayLocal();

  function tryScroll(n) {
    var c = chal().find(function(x) { return x.id === matchId; });
    if (c && c.videoUrl && extractYouTubeVideoId(c.videoUrl)) {
      setTimeout(function() {
        _scrollMatchCard(matchId, shouldPlay);
      }, 300);
      return;
    }
    if (n < 40) setTimeout(function() { tryScroll(n + 1); }, 250);
    else _finishDeepLink(false);
  }
  tryScroll(0);
}


