/**
 * 영상 재생 시 앱 내 조회수 집계
 */
import {
  doc, updateDoc, increment
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { COL_VIDEOS, COL_CHALLENGES } from './constants.js?v=2026.07.07.01';

let _ctx = null;
const _counted = new Set();

export function initVideoViews(ctx) {
  _ctx = ctx;
}

export function trackLessonVideoView(id) {
  if (!id || _counted.has('l:' + id)) return;
  _counted.add('l:' + id);
  if (_ctx.bumpVideoViewLocal) _ctx.bumpVideoViewLocal(id);
  var db = _ctx.getDb && _ctx.getDb();
  if (db) {
    updateDoc(doc(db, COL_VIDEOS, id), { viewCount: increment(1) }).catch(function() {});
  }
  if (_ctx.onVideoViewsChanged) _ctx.onVideoViewsChanged();
}

export function trackMatchVideoView(id) {
  if (!id || _counted.has('m:' + id)) return;
  _counted.add('m:' + id);
  if (_ctx.bumpChallengeVideoViewLocal) _ctx.bumpChallengeVideoViewLocal(id);
  var db = _ctx.getDb && _ctx.getDb();
  if (db) {
    updateDoc(doc(db, COL_CHALLENGES, id), { videoViewCount: increment(1) }).catch(function() {});
  }
  if (_ctx.onVideoViewsChanged) _ctx.onVideoViewsChanged();
}
