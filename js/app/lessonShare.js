/**
 * 레슨 및 훈련 영상 — 카카오 공유
 */
import {
  DEEPLINK_LESSON_PARAM, DEEPLINK_LESSON_PLAY_PARAM, TOAST_DURATION_MS
} from './constants.js?v=2026.07.07.01';
import { SITE_ORIGIN, KAKAO_JS_KEY } from './version.js?v=2026.07.07.01';
import { extractYouTubeVideoId, buildYouTubeThumbUrl } from './youtubeUtils.js?v=2026.07.07.01';
import { isKakaoInApp } from './pwa.js?v=2026.07.07.01';
import { getVideoDisplayTitle } from './videoCategoryUtils.js?v=2026.07.07.01';
import { lessonMemberLabel } from './lessonMemberUtils.js?v=2026.07.07.01';

let C = null;
var _kakaoReady = false;

export function initLessonShare(ctx) {
  C = ctx;
  window.shareLessonKakao = shareLessonKakao;
  window.openLessonShareModal = openLessonShareModal;
  window._doLessonKakaoShare = doLessonKakaoShare;
  window._doLessonNativeShare = doLessonNativeShare;
  window._copyLessonShareMsg = copyLessonShareMsg;
}

function g(id) { return C.g(id); }
function toast(msg, opts) { return C.toast(msg, opts); }
function videos() { return C.getVideos(); }

function _lessonMemberName(v) {
  if (!v) return '';
  return lessonMemberLabel(v, C.getMembers ? C.getMembers() : []);
}

export function buildShareLessonUrl(v) {
  var base = SITE_ORIGIN.replace(/\/$/, '');
  if (!v || !v.id) return base;
  return base + '?' + DEEPLINK_LESSON_PARAM + '=' + encodeURIComponent(v.id)
    + '&' + DEEPLINK_LESSON_PLAY_PARAM + '=1';
}

function _lessonFeedImageUrl(v) {
  var vid = v && extractYouTubeVideoId(v.youtubeUrl);
  if (vid) return buildYouTubeThumbUrl(vid);
  return SITE_ORIGIN.replace(/\/$/, '') + '/assets/share-kakao.jpg';
}

function _lessonFeedMeta(v) {
  var title = getVideoDisplayTitle(v);
  var member = _lessonMemberName(v);
  var descParts = ['📚 이사탁 ' + title];
  if (member) descParts.push('👤 ' + member);
  if (v.description) descParts.push(String(v.description).trim());
  return {
    title: '🎬 ' + title,
    description: descParts.join(' · ')
  };
}

export function buildShareLessonText(v) {
  var url = buildShareLessonUrl(v);
  var member = _lessonMemberName(v);
  var cat = getVideoDisplayTitle(v);
  var lines = [
    '🎬 ' + cat + ' 영상',
    '─────────────────',
    '📂 ' + cat
  ];
  if (member) lines.push('👤 선수: ' + member);
  if (v.description) lines.push('💬 ' + String(v.description).trim());
  lines.push('', '👇 영상 보러 가기', url);
  return lines.join('\n');
}

function _updateLessonSharePreview(v) {
  var txt = buildShareLessonText(v);
  var preview = g('kakao-preview');
  if (preview) preview.textContent = txt;
  window._shareText = txt;
  window._shareUrl = buildShareLessonUrl(v);
}

function _setLessonShareHint() {
  var hint = g('share-hint');
  var originInfo = g('share-origin-info');
  var kakaoBtn = document.querySelector('#mo-kakao .btn-kakao');
  if (originInfo) originInfo.textContent = '접속 주소: ' + window.location.origin;
  if (isKakaoInApp()) {
    if (kakaoBtn) kakaoBtn.innerHTML = '<span class="kt-icon">📋</span> 복사 후 채팅에 붙여넣기';
    if (hint) {
      hint.innerHTML = '💡 카카오톡 안에서는 <b>복사 후 붙여넣기</b>가 가장 안정적입니다.<br>Chrome·Safari에서 열면 채팅방 선택 공유도 가능해요.';
    }
  } else if (kakaoBtn) {
    kakaoBtn.innerHTML = '<span class="kt-icon">💬</span> 카카오톡으로 공유';
    if (hint) {
      hint.innerHTML = '💡 [카카오톡으로 공유] 버튼을 누르면<br>채팅방을 선택해서 바로 전송할 수 있어요!';
    }
  }
}

export function openLessonShareModal(v) {
  if (!v) return;
  window._shareChallenge = null;
  window._shareLesson = v;
  var titleEl = g('share-box-t');
  var descEl = g('share-box-p');
  var templates = g('share-templates');
  if (titleEl) titleEl.textContent = '🎬 ' + getVideoDisplayTitle(v) + ' 영상';
  if (descEl) descEl.textContent = '카카오톡으로 영상을 공유해보세요!';
  if (templates) templates.style.display = 'none';
  _updateLessonSharePreview(v);
  var nativeBtn = g('btn-native-share');
  if (nativeBtn) nativeBtn.style.display = navigator.share ? '' : 'none';
  _setLessonShareHint();
  C.openMo('mo-kakao');
}

export function shareLessonKakao(id) {
  var v = videos().find(function(x) { return x.id === id; });
  if (!v) {
    toast('❌ 영상 정보를 찾을 수 없습니다');
    return;
  }
  openLessonShareModal(v);
}

function _kakaoClamp(s, max) {
  s = String(s || '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function _initKakao() {
  if (_kakaoReady) return true;
  if (typeof Kakao === 'undefined') {
    console.warn('카카오 SDK 로드 실패');
    return false;
  }
  if (!Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY);
  _kakaoReady = true;
  return true;
}

function _kakaoCallerOrigin() {
  return window.location.origin.replace(/\/$/, '');
}

function _ensureKakaoCallerDomain() {
  var origin = _kakaoCallerOrigin();
  var canonical = SITE_ORIGIN.replace(/\/$/, '');
  if (origin === canonical) return true;
  toast('⚠️ 카카오 공유는 ' + canonical + ' 에서만 지원됩니다.\n현재: ' + origin, { multiline: true });
  return false;
}

function _copyToClipboard(txt) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).catch(function() { _fallbackCopy(txt); });
  } else {
    _fallbackCopy(txt);
  }
}

function _fallbackCopy(txt) {
  var ta = document.createElement('textarea');
  ta.value = txt;
  ta.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  ta.remove();
}

export function doLessonKakaoShare() {
  var v = window._shareLesson;
  var txt = window._shareText || '';
  var url = buildShareLessonUrl(v);
  if (!txt || !v) return;

  if (isKakaoInApp()) {
    _copyToClipboard(txt);
    toast('📋 복사됐습니다!\n채팅방 입력창에 붙여넣기 하세요.', { multiline: true, duration: 4000 });
    return;
  }
  if (!_ensureKakaoCallerDomain()) return;

  if (_initKakao()) {
    try {
      var meta = _lessonFeedMeta(v);
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: _kakaoClamp(meta.title, 200),
          description: _kakaoClamp(meta.description, 200),
          imageUrl: _lessonFeedImageUrl(v),
          link: { mobileWebUrl: url, webUrl: url }
        },
        buttons: [{ title: '영상 보러 가기', link: { mobileWebUrl: url, webUrl: url } }],
        installTalk: true
      });
      return;
    } catch (e) {
      toast('❌ 카카오 공유 실패\n카카오 개발자 콘솔 도메인 설정을 확인해주세요.', { multiline: true, duration: TOAST_DURATION_MS });
    }
  }

  _copyToClipboard(txt);
  toast('📋 복사됐습니다! 카카오톡에 붙여넣기 하세요');
}

export function doLessonNativeShare() {
  var v = window._shareLesson;
  var txt = window._shareText || '';
  var url = window._shareUrl || buildShareLessonUrl(v);
  if (!navigator.share || !v) return;
  navigator.share({
    title: getVideoDisplayTitle(v) + ' · 이사탁',
    text: txt,
    url: url
  }).catch(function(e) {
    if (e && e.name !== 'AbortError') toast('❌ 공유를 취소했거나 지원하지 않습니다');
  });
}

export function copyLessonShareMsg() {
  var txt = window._shareText || '';
  _copyToClipboard(txt);
  toast('📋 복사 완료! 카카오톡에 붙여넣기 하세요');
}
