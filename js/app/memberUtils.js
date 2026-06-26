/**
 * 회원 등급·아바타 색상 유틸
 */
import { _memberPt, _calcGrade } from './memberCore.js?v=2026.06.26.10';

export function _memberGrade(m) {
  return _calcGrade(_memberPt(m, false));
}

const AVC = ['avG', 'avB', 'avA', 'avR', 'avP'];

export function avc(n) {
  let h = 0;
  for (const c of (n || '')) h += c.charCodeAt(0);
  return AVC[h % 5];
}

export function ini(n) {
  return n ? n[0] : '?';
}

export function gradeAvatarStyle(grade) {
  var map = {
    '마스터': 'background:#EEEDFE;color:#534AB7;',
    '고수': 'background:#E6F1FB;color:#185FA5;',
    '상급': 'background:#EAF3DE;color:#3B6D11;',
    '중급': 'background:#FAEEDA;color:#854F0B;',
    '초급': 'background:#FAECE7;color:#993C1D;',
    '입문': 'background:#F1EFE8;color:#5F5E5A;'
  };
  return map[grade] || 'background:#eee;color:#666;';
}
