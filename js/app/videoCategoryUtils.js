/**
 * 영상(videos) 카테고리·정렬 유틸
 */
import {
  VIDEO_CATEGORIES, VIDEO_CATEGORY_DEFAULT, VIDEO_CATEGORY_DATE_SORT
} from './constants.js?v=2026.07.07.01';

export function getVideoCategory(v) {
  if (!v) return VIDEO_CATEGORY_DEFAULT;
  var c = v.category;
  if (c && VIDEO_CATEGORIES.indexOf(c) >= 0) return c;
  return VIDEO_CATEGORY_DEFAULT;
}

/** 카드·공유·재생 UI — 제목 대신 카테고리 표시 */
export function getVideoDisplayTitle(v) {
  return getVideoCategory(v);
}

export function isDateSortCategory(cat) {
  return VIDEO_CATEGORY_DATE_SORT.indexOf(cat) >= 0;
}

export function getVideoDisplayDate(v) {
  if (!v) return '';
  if (v.date && /^\d{4}-\d{2}-\d{2}$/.test(v.date)) return v.date;
  if (v.createdAt) return String(v.createdAt).slice(0, 10);
  return '';
}

export function getVideoSortKey(v) {
  var cat = getVideoCategory(v);
  if (isDateSortCategory(cat) && v.date) return v.date;
  if (v.date) return v.date;
  return (v.createdAt || '').slice(0, 10);
}

export function sortVideosList(list, activeFilter) {
  return list.slice().sort(function(a, b) {
    if (activeFilter === '점심경기' || activeFilter === '저녁경기') {
      var da = getVideoSortKey(a);
      var db = getVideoSortKey(b);
      if (db !== da) return db.localeCompare(da);
    }
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

export function todayDateInputValue() {
  var d = new Date();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}
