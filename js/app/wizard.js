/**
 * 대결 신청 / 즉시 대결 — 단계형(Wizard) UX
 * LocalStorage 기반 내 선수 · 최근 조합
 */

let C = null;

const LS = {
  myPlayerId: 'isatok_myPlayerId',
  myPlayerName: 'isatok_myPlayerName',
  recentPartners: 'isatok_recentPartners',
  recentMyTeams: 'isatok_recentMyTeams',
  recentOppTeams: 'isatok_recentOppTeams'
};

let _setupMandatory = false;
let _pendingPlayerId = null;
let _category = 'double';
let _partner = null;
let _oppDraft = [];
let _quickWinner = null;
let _quickScore = '';

function g(id) { return C ? C.g(id) : null; }
function members() { return C ? C.getMembers() : []; }
function toast(msg) { C.toast(msg); }

function _isInstantWizard() {
  return !!(C && C.isInstantMode && C.isInstantMode() && !C.getEditId());
}

/** 즉시 등록 + 단식: 내 선수 자동이므로 내팀(2단계) 생략 */
export function shouldSkipInstantMyTeamStep() {
  return _isInstantWizard() && _category === 'single';
}

function _getRecentOppTeamsForCategory() {
  var recent = _getRecentTeams(LS.recentOppTeams);
  if (_category === 'single') {
    return recent.filter(function (item) {
      return item.team && item.team.length === 1;
    });
  }
  return recent.filter(function (item) {
    return item.team && item.team.length >= 2;
  });
}

function _instantModeToggleHtml() {
  return '<div class="wiz-mode-toggle">'
    + '<button type="button" class="wiz-mode-btn' + (_category === 'double' ? ' on' : '') + '" onclick="setWizCategory(\'double\')">👥 복식</button>'
    + '<button type="button" class="wiz-mode-btn' + (_category === 'single' ? ' on' : '') + '" onclick="setWizCategory(\'single\')">🏓 단식</button>'
    + '</div>';
}

function _lsGet(key, fallback) {
  try {
    var v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) { return fallback; }
}
function _lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}

export function getMyPlayerId() {
  return localStorage.getItem(LS.myPlayerId) || '';
}

function _migrateLegacyMyPlayerKeys() {
  if (localStorage.getItem(LS.myPlayerId)) return;
  var legId = localStorage.getItem('myPlayerId');
  var legName = localStorage.getItem('myPlayerName');
  if (legId && legName) {
    localStorage.setItem(LS.myPlayerId, legId);
    localStorage.setItem(LS.myPlayerName, legName);
  }
}

function _clearMyPlayerStorage() {
  localStorage.removeItem(LS.myPlayerId);
  localStorage.removeItem(LS.myPlayerName);
}

/** LocalStorage에 id+name 모두 있는지 (회원 목록 로드 전 판단용) */
export function hasMyPlayerStored() {
  _migrateLegacyMyPlayerKeys();
  var id = localStorage.getItem(LS.myPlayerId);
  var name = localStorage.getItem(LS.myPlayerName);
  return !!(id && name);
}

export function validateMyPlayer() {
  _migrateLegacyMyPlayerKeys();
  var id = localStorage.getItem(LS.myPlayerId);
  var name = localStorage.getItem(LS.myPlayerName);
  if (!id || !name) {
    if (id || name) _clearMyPlayerStorage();
    return null;
  }
  var mems = members();
  if (!mems.length) {
    return { id: id, name: name, grade: '', gender: '', status: '활성' };
  }
  var m = mems.find(function (x) { return x.id === id; });
  if (!m || m.status === '비활성') {
    _clearMyPlayerStorage();
    return null;
  }
  if (name !== m.name) {
    localStorage.setItem(LS.myPlayerName, m.name);
  }
  return m;
}

export function isMyPlayerReady() {
  return !!validateMyPlayer();
}

export function isMyPlayerSetupMandatory() {
  return _setupMandatory;
}

/**
 * 내 선수 미설정 시 토스트·설정 모달을 띄우고 진행을 막는다.
 * @param {string} [message] - 안내 메시지
 * @returns {boolean} 설정 완료 여부
 */
export function requireMyPlayer(message) {
  if (isMyPlayerReady()) return true;
  if (hasMyPlayerStored() && !members().length) return true;
  toast(message || '서비스 이용을 위해 먼저 내 선수 설정을 진행해주세요.');
  openMyPlayerSetup(true);
  return false;
}

/**
 * LocalStorage·회원 목록에서 유효한 내 선수 객체를 반환한다.
 * @returns {object|null}
 */
export function getMyPlayer() {
  return validateMyPlayer();
}

export function getMyPlayerName() {
  var m = getMyPlayer();
  if (m) return m.name;
  return localStorage.getItem(LS.myPlayerName) || '';
}

function _setMyPlayer(id) {
  var m = members().find(function (x) { return x.id === id; });
  if (!m) return false;
  localStorage.setItem(LS.myPlayerId, id);
  localStorage.setItem(LS.myPlayerName, m.name);
  _pendingPlayerId = null;
  _setupMandatory = false;
  C.onMyPlayerChanged();
  return true;
}

export function buildCreatorFields() {
  var m = validateMyPlayer();
  if (!m) return null;
  return {
    createdByPlayerId: m.id,
    createdByPlayerName: m.name
  };
}

function _fmtCreatedAt(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  var y = d.getFullYear();
  var mo = String(d.getMonth() + 1).padStart(2, '0');
  var da = String(d.getDate()).padStart(2, '0');
  var h = String(d.getHours()).padStart(2, '0');
  var mi = String(d.getMinutes()).padStart(2, '0');
  return y + '-' + mo + '-' + da + ' ' + h + ':' + mi;
}

export function formatChallengeCreatorHtml(c) {
  if (!c) return '';
  var creator = c.createdByPlayerName || '';
  var at = _fmtCreatedAt(c.createdAt);
  if (!creator && !at) return '';
  var parts = [];
  if (creator) parts.push('👤 ' + creator);
  if (at) parts.push('🕐 ' + at.replace(/^\d{4}-/, ''));
  return '<div class="cc-meta-row">' + parts.join('<span class="cc-meta-dot">·</span>') + '</div>';
}

export function isChallengeCreatedByMe(c) {
  if (!c || !c.createdByPlayerId) return false;
  return c.createdByPlayerId === getMyPlayerId();
}

function _resolveType(category, member) {
  var gnd = member && member.gender;
  if (category === 'double') return gnd === '여성' ? 'fd' : 'md';
  return gnd === '여성' ? 'fs' : 'ms';
}

function _syncToMain() {
  var me = getMyPlayer();
  if (!me) {
    C.setMy([]);
    return;
  }
  if (_category === 'single') {
    C.setMy([me.name]);
    C.setType(_resolveType('single', me));
    return;
  }
  if (_partner) {
    C.setMy([me.name, _partner]);
    C.setType(_resolveType('double', me));
  } else {
    C.setMy([me.name]);
  }
}

function _getRecentPartners() {
  var stored = _lsGet(LS.recentPartners, []);
  if (stored.length) return stored;
  return _deriveRecentPartners();
}

function _deriveRecentPartners() {
  var myName = getMyPlayerName();
  if (!myName) return [];
  var counts = {};
  C.getChal().forEach(function (c) {
    if (c.status !== 'completed') return;
    var t = c.type || '';
    if (t !== 'md' && t !== 'fd' && t !== 'mx') return;
    var my = c.myTeam || [], opp = c.oppTeam || [];
    var team = null;
    if (my.indexOf(myName) >= 0) team = my;
    else if (opp.indexOf(myName) >= 0) team = opp;
    if (!team) return;
    team.filter(function (p) { return p !== myName; }).forEach(function (p) {
      counts[p] = (counts[p] || 0) + 1;
    });
  });
  return Object.keys(counts)
    .sort(function (a, b) { return counts[b] - counts[a]; })
    .slice(0, 8);
}

function _getPartnerCounts() {
  var myName = getMyPlayerName();
  if (!myName) return [];
  var counts = {};
  C.getChal().forEach(function (c) {
    if (c.status !== 'completed') return;
    var t = c.type || '';
    if (t !== 'md' && t !== 'fd' && t !== 'mx') return;
    var my = c.myTeam || [], opp = c.oppTeam || [];
    var team = null;
    if (my.indexOf(myName) >= 0) team = my;
    else if (opp.indexOf(myName) >= 0) team = opp;
    if (!team) return;
    team.filter(function (p) { return p !== myName; }).forEach(function (p) {
      counts[p] = (counts[p] || 0) + 1;
    });
  });
  return Object.keys(counts).map(function (n) {
    return { name: n, count: counts[n] };
  }).sort(function (a, b) { return b.count - a.count; }).slice(0, 6);
}

function _getRecentTeams(key) {
  return _lsGet(key, []);
}

function _pushRecentPartner(name) {
  if (!name) return;
  var cur = _getRecentPartners().filter(function (x) { return x !== name; });
  cur.unshift(name);
  _lsSet(LS.recentPartners, cur.slice(0, 12));
}

function _pushRecentTeam(key, team) {
  if (!team || !team.length) return;
  var sorted = team.slice().sort().join('|');
  var cur = _getRecentTeams(key).filter(function (x) {
    return (x.team || []).slice().sort().join('|') !== sorted;
  });
  cur.unshift({ team: team.slice(), ts: Date.now() });
  _lsSet(key, cur.slice(0, 8));
}

export function saveWizRecentCombos() {
  var myName = getMyPlayerName();
  var my = C.getState()._my || [];
  var opp = C.getState()._opp || [];
  if (!myName) return;
  if (_category === 'double' && my.length >= 2) {
    var partner = my.find(function (n) { return n !== myName; });
    if (partner) _pushRecentPartner(partner);
    _pushRecentTeam(LS.recentMyTeams, my);
  }
  if (opp.length) _pushRecentTeam(LS.recentOppTeams, opp);
}

function _activeMembers(exclude) {
  exclude = exclude || [];
  return members().filter(function (m) {
    return m.status !== '비활성' && exclude.indexOf(m.name) < 0;
  });
}

function _escAttr(s) {
  return String(s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function _pickCard(name, selected, onclick, sub) {
  var cls = 'wiz-pick' + (selected ? ' wiz-pick-on' : '');
  return '<button type="button" class="' + cls + '" onclick="' + onclick + '">'
    + '<span class="wiz-pick-name">' + name + '</span>'
    + (sub ? '<span class="wiz-pick-sub">' + sub + '</span>' : '')
    + '</button>';
}

function _sectionLabel(text) {
  return '<div class="wiz-sec-label">' + text + '</div>';
}

function _updateProgress(n) {
  var instant = _isInstantWizard();
  var skipMy = instant && _category === 'single';
  var bar = g('wiz-bar');
  if (bar) bar.classList.toggle('wiz-bar--instant', !!instant);
  for (var i = 1; i <= 4; i++) {
    var el = g('wiz-bar-' + i);
    if (!el) continue;
    if (instant) {
      el.style.display = (i === 1 || (i === 2 && skipMy)) ? 'none' : '';
      el.classList.toggle('on', i === n);
      el.classList.toggle('done', i < n);
      if (i === 2) el.querySelector('span').textContent = '내팀';
      else if (i === 3) el.querySelector('span').textContent = '상대팀';
      else if (i === 4) el.querySelector('span').textContent = '결과 저장';
      continue;
    }
    el.style.display = '';
    el.classList.toggle('on', i === n);
    el.classList.toggle('done', i < n);
  }
  document.querySelectorAll('.wiz-bar-sep').forEach(function (s, i) {
    if (instant) {
      var hideSep = skipMy ? i < 2 : i < 1;
      s.style.display = hideSep ? 'none' : '';
    } else {
      s.style.display = '';
    }
  });
  if (!instant) {
    var lb2 = g('wiz-bar-2');
    if (lb2) lb2.querySelector('span').textContent = '내팀';
    var lb4 = g('wiz-bar-4');
    if (lb4) lb4.querySelector('span').textContent = '결과입력';
  }
}

function _renderStep1() {
  var box = g('wiz-panel-1');
  if (!box) return;
  box.innerHTML = '<div class="wiz-step-title">🏓 경기 유형 선택</div>'
    + '<div class="wiz-cat-grid">'
    + '<button type="button" class="wiz-cat' + (_category === 'double' ? ' on' : '') + '" onclick="setWizCategory(\'double\')">'
    + '<span class="wiz-cat-icon">🤝</span><span class="wiz-cat-t">복식</span><span class="wiz-cat-d">2 vs 2 · 기본</span></button>'
    + '<button type="button" class="wiz-cat' + (_category === 'single' ? ' on' : '') + '" onclick="setWizCategory(\'single\')">'
    + '<span class="wiz-cat-icon">🏓</span><span class="wiz-cat-t">단식</span><span class="wiz-cat-d">1 vs 1</span></button>'
    + '</div>';
}

function _renderInstantMyTeamStep() {
  var box = g('wiz-panel-2');
  if (!box) return;
  var me = getMyPlayer();
  var html = '<div class="wiz-step-title">👥 내 팀 선택</div>' + _instantModeToggleHtml();

  if (!me) {
    html += '<div class="wiz-empty">내 선수를 먼저 설정해주세요.</div>'
      + '<button type="button" class="btn btn-p" style="width:100%;margin-top:12px" onclick="openMyPlayerSetup()">🏓 내 선수 설정</button>';
    box.innerHTML = html;
    return;
  }

  if (_category === 'single') {
    _partner = null;
    _syncToMain();
    if (typeof window.bsStep === 'function') window.bsStep(3);
    return;
  }

  var myTeams = _getRecentTeams(LS.recentMyTeams).filter(function (item) {
    return item.team && item.team.indexOf(me.name) >= 0;
  });
  if (myTeams.length) {
    html += _sectionLabel('최근 복식 조합');
    html += '<div class="wiz-quick-list">';
    myTeams.slice(0, 4).forEach(function (item, idx) {
      var team = item.team || [];
      var label = team.join(' + ');
      html += '<button type="button" class="wiz-quick-chip' + (_partner && team.indexOf(_partner) >= 0 ? ' on' : '') + '" onclick="wizPickMyTeam(' + idx + ')">' + label + '<span class="wiz-quick-chip__act">선택</span></button>';
    });
    html += '</div>';
  }

  var partners = _getPartnerCounts();
  if (partners.length) {
    html += _sectionLabel('자주 함께한 파트너');
    html += '<div class="wiz-quick-list">';
    partners.forEach(function (p) {
      html += '<button type="button" class="wiz-quick-chip' + (_partner === p.name ? ' on' : '') + '" onclick="wizPickPartner(\'' + _escAttr(p.name) + '\')">'
        + p.name + ' <span class="wiz-quick-chip__cnt">(' + p.count + '회)</span><span class="wiz-quick-chip__act">선택</span></button>';
    });
    html += '</div>';
  }

  html += '<div class="wiz-team-block"><div class="wiz-team-block__lbl">우리팀</div>';
  html += '<div class="wiz-team-line"><strong>' + me.name + '</strong>';
  html += _partner ? ' + <strong>' + _partner + '</strong>' : ' + <span class="wiz-team-pending">파트너 선택</span>';
  html += '</div></div>';

  html += _sectionLabel('파트너 선택');
  html += '<div class="wiz-pick-grid wiz-pick-grid--compact">';
  _activeMembers([me.name]).forEach(function (m) {
    html += _pickCard(m.name, _partner === m.name, "wizPickPartner('" + _escAttr(m.name) + "')", m.grade || '');
  });
  html += '</div>';

  box.innerHTML = html;
  _syncToMain();
}

function _renderStep2() {
  if (_isInstantWizard()) {
    if (_category === 'single') {
      _partner = null;
      _syncToMain();
      if (typeof window.bsStep === 'function') window.bsStep(3);
      return;
    }
    _renderInstantMyTeamStep();
    return;
  }
  var box = g('wiz-panel-2');
  if (!box) return;
  var me = getMyPlayer();
  var html = '<div class="wiz-step-title">' + (_category === 'double' ? '내 팀 선택' : '내 선수') + '</div>';

  if (!me) {
    html += '<div class="wiz-empty">내 선수를 먼저 설정해주세요.</div>'
      + '<button type="button" class="btn btn-p" style="width:100%;margin-top:12px" onclick="openMyPlayerSetup()">🏓 내 선수 설정</button>';
    box.innerHTML = html;
    return;
  }

  html += '<div class="wiz-auto-card"><span class="wiz-auto-label">내 선수</span><strong>' + me.name + '</strong><span class="wiz-auto-tag">자동 선택</span></div>';

  if (_category === 'single') {
    _partner = null;
    _syncToMain();
    box.innerHTML = html;
    return;
  }

  html += _sectionLabel('파트너 선택');
  var recent = _getRecentPartners().filter(function (n) { return n !== me.name; });
  if (recent.length) {
    html += '<div class="wiz-pick-grid wiz-pick-grid--recent">';
    recent.forEach(function (n) {
      var m = members().find(function (x) { return x.name === n; });
      if (!m || m.status === '비활성') return;
      html += _pickCard(n, _partner === n, "wizPickPartner('" + _escAttr(n) + "')", m.grade || '');
    });
    html += '</div>';
  }

  var myTeams = _getRecentTeams(LS.recentMyTeams);
  if (myTeams.length) {
    html += _sectionLabel('최근 내팀');
    html += '<div class="wiz-combo-list">';
    myTeams.forEach(function (item, idx) {
      var team = item.team || [];
      if (team.indexOf(me.name) < 0) return;
      var label = team.join(' + ');
      html += '<button type="button" class="wiz-combo' + (_partner && team.indexOf(_partner) >= 0 ? ' on' : '') + '" onclick="wizPickMyTeam(' + idx + ')">' + label + '</button>';
    });
    html += '</div>';
  }

  html += _sectionLabel('전체 선수');
  html += '<div class="wiz-pick-grid">';
  _activeMembers([me.name]).forEach(function (m) {
    html += _pickCard(m.name, _partner === m.name, "wizPickPartner('" + _escAttr(m.name) + "')", m.grade || '');
  });
  html += '</div>';

  box.innerHTML = html;
  _syncToMain();
}

function _renderStep3() {
  var box = g('wiz-panel-3');
  if (!box) return;
  var isOpen = g('oc-chk') && g('oc-chk').checked;
  var instant = _isInstantWizard();
  var html = '<div class="wiz-step-title">' + (instant ? '⚔️ 상대 팀 선택' : '상대 팀 선택') + '</div>';

  if (instant) {
    html += _instantModeToggleHtml();
    var meInst = getMyPlayer();
    if (_category === 'single' && meInst) {
      html += '<div class="wiz-auto-card"><span class="wiz-auto-label">내 선수</span><strong>' + meInst.name + '</strong><span class="wiz-auto-tag">자동 선택</span></div>';
    }
  }

  var ocWrap = g('oc-toggle-wrap');
  if (ocWrap) ocWrap.style.display = (instant || C.getEditId()) ? 'none' : '';

  if (!isOpen) {
    var recentOpp = _getRecentOppTeamsForCategory();
    if (recentOpp.length) {
      html += _sectionLabel('최근 상대팀');
      html += '<div class="wiz-combo-list">';
      recentOpp.forEach(function (item, idx) {
        var team = item.team || [];
        var label = team.join(' + ');
        var sel = _oppDraft.length === team.length && team.every(function (n, i) { return _oppDraft[i] === n; });
        html += '<button type="button" class="wiz-combo' + (sel ? ' on' : '') + '" onclick="wizPickOppTeam(' + idx + ')">' + label + '</button>';
      });
      html += '</div>';
    }

    if (instant && _category === 'double') {
      html += '<div class="wiz-team-block wiz-team-block--opp"><div class="wiz-team-block__lbl">상대팀</div>';
      html += '<div class="wiz-team-line">' + (_oppDraft.length ? '<strong>' + _oppDraft.join('</strong> + <strong>') + '</strong>' : '<span class="wiz-team-pending">2명 선택</span>') + '</div></div>';
    }

    html += _sectionLabel(_category === 'double' ? '선수 선택 (2명)' : '상대 선수');
    if (_category === 'double' && _oppDraft.length === 1) {
      html += '<div class="wiz-hint">1명 선택됨: <strong>' + _oppDraft[0] + '</strong> — 2번째 선수를 선택하세요</div>';
    }
    html += '<div class="wiz-pick-grid">';
    var myTeam = C.getState()._my || [];
    _activeMembers(myTeam).forEach(function (m) {
      var sel = _oppDraft.indexOf(m.name) >= 0;
      html += _pickCard(m.name, sel, "wizPickOppPlayer('" + _escAttr(m.name) + "')", m.grade || '');
    });
    html += '</div>';
  } else {
    html += '<div class="wiz-empty">오픈 챌린지 — 상대는 누구나 수락할 수 있습니다.</div>';
    C.setOpp([]);
  }

  box.innerHTML = html;
  if (!isOpen && _oppDraft.length >= (_category === 'double' ? 2 : 1)) {
    C.setOpp(_oppDraft.slice());
  }
}

function _renderStep4() {
  var box = g('wiz-panel-4');
  if (!box) return;
  var st = C.getState();
  var my = st._my || [];
  var opp = st._opp || [];
  var isOpen = g('oc-chk') && g('oc-chk').checked;
  var instant = C.isInstantMode();
  var html = '';

  if (instant && !C.getEditId()) {
    if (C.unmountInstantResultForm) C.unmountInstantResultForm();
    var now = C.nowDateTimeFields();
    var myLbl = my.join('<br>') || '—';
    var oppLbl = opp.join('<br>') || '—';
    var root = g('wiz-instant-res-root');
    var bannerHtml = '<div class="wiz-instant-vs">'
      + '<div class="wiz-instant-vs__team wiz-instant-vs__team--my"><div class="wiz-instant-vs__lbl">우리팀</div><div class="wiz-instant-vs__names">' + myLbl + '</div></div>'
      + '<div class="wiz-instant-vs__sep">VS</div>'
      + '<div class="wiz-instant-vs__team wiz-instant-vs__team--opp"><div class="wiz-instant-vs__lbl">상대팀</div><div class="wiz-instant-vs__names">' + oppLbl + '</div></div>'
      + '</div>'
      + '<div class="wiz-instant-mode-note">● 승패만 입력 (기본) · 세트 스코어는 고급 옵션</div>';
    if (!root || !box.contains(root)) {
      html += '<input type="date" id="ch-date" value="' + now.date + '" tabindex="-1" aria-hidden="true" style="position:absolute;opacity:0;height:0;width:0;pointer-events:none">';
      html += '<input type="time" id="ch-time" value="' + now.time + '" tabindex="-1" aria-hidden="true" style="position:absolute;opacity:0;height:0;width:0;pointer-events:none">';
      html += bannerHtml;
      html += '<div id="wiz-instant-res-root" class="wiz-instant-res"></div>';
      box.innerHTML = html;
    } else {
      var prevBanner = box.querySelector('.wiz-instant-vs');
      if (prevBanner) prevBanner.outerHTML = bannerHtml;
      var dateEl = g('ch-date');
      var timeEl = g('ch-time');
      if (dateEl) dateEl.value = now.date;
      if (timeEl) timeEl.value = now.time;
    }
    if (C.mountInstantResultForm) C.mountInstantResultForm();
    if (C.initResultForm) {
      C.initResultForm({
        myTeam: my,
        oppTeam: isOpen ? [] : opp,
        gameMode: C.getBsGameMode ? C.getBsGameMode() : 'bo1',
        instantWizard: true
      });
    }
    if (C.scrollBsStep) C.scrollBsStep(4);
    C.updateChSubmitBtn();
    return;
  }

  if (C.unmountInstantResultForm) C.unmountInstantResultForm();

  var myLbl = my.join(' + ') || '—';
  var oppLbl = isOpen ? '오픈 (누구나)' : (opp.join(' + ') || '—');
  html += '<div class="wiz-vs-banner">'
    + '<div class="wiz-vs-team">' + myLbl + '</div>'
    + '<div class="wiz-vs-sep">VS</div>'
    + '<div class="wiz-vs-team">' + oppLbl + '</div>'
    + '</div>';

  html += '<div id="wiz-normal-fields">';
  html += '<div class="fr" style="margin-bottom:14px">';
  html += '<div class="fg" style="margin:0"><label>날짜</label><input type="date" id="ch-date"></div>';
  html += '<div class="fg" style="margin:0"><label>시간</label><input type="time" id="ch-time" value="10:00"></div>';
  html += '</div>';
  html += '<div class="fg" style="margin-bottom:0"><label>내기 <span style="color:var(--t3);font-size:12px;font-weight:400">(선택)</span></label>';
  html += '<div class="msg-chips" id="bet-chips">';
  html += '<button class="msg-chip none-chip' + (!st._bet ? ' on' : '') + '" data-bet="" onclick="selectBet(this)">없음</button>';
  html += '<button class="msg-chip' + (st._bet === 'coffee' ? ' on' : '') + '" data-bet="coffee" onclick="selectBet(this)">☕ 커피</button>';
  html += '<button class="msg-chip' + (st._bet === 'jjajang' ? ' on' : '') + '" data-bet="jjajang" onclick="selectBet(this)">🍜 짜장면</button>';
  html += '</div></div></div>';

  box.innerHTML = html;
  C.updateChSubmitBtn();
}

/**
 * 위저드 단계 UI를 렌더한다.
 * @param {number} n - 단계 번호 (1~4)
 */
export function wizRenderStep(n) {
  if (n !== 4 && C.unmountInstantResultForm) C.unmountInstantResultForm();
  _updateProgress(n);
  if (n === 1) _renderStep1();
  else if (n === 2) _renderStep2();
  else if (n === 3) _renderStep3();
  else if (n === 4) _renderStep4();
}

/**
 * 대결 수정 모드에서 위저드 팀·종목 상태를 채운다.
 * @param {string} type - 대결 종목 코드 (ms, md, fs 등)
 * @param {string[]} myTeam - 내 팀 선수명 배열
 * @param {string[]} oppTeam - 상대 팀 선수명 배열
 */
export function wizPrefillEdit(type, myTeam, oppTeam) {
  var isDbl = type === 'md' || type === 'fd' || type === 'mx';
  _category = isDbl ? 'double' : 'single';
  var me = getMyPlayerName();
  _partner = null;
  _oppDraft = oppTeam ? oppTeam.slice() : [];
  if (isDbl && myTeam && myTeam.length) {
    _partner = myTeam.find(function (n) { return n !== me; }) || myTeam[1] || null;
  }
  _quickWinner = null;
  _quickScore = '';
}

/**
 * 위저드 흐름 상태를 초기화한다.
 * @param {boolean} [instant] - 즉시 대결 모드 여부(미사용, 호환용)
 */
export function wizResetFlow(instant) {
  _category = 'double';
  _partner = null;
  _oppDraft = [];
  _quickWinner = null;
  _quickScore = '';
  var me = getMyPlayer();
  if (me && _category === 'single') {
    C.setMy([me.name]);
    C.setType(_resolveType('single', me));
  } else if (me) {
    C.setMy([me.name]);
  } else {
    C.setMy([]);
  }
  C.setOpp([]);
}

/**
 * 위저드 단계 이동 전 필수 입력을 검증한다.
 * @param {number} from - 현재 단계
 * @param {number} to - 이동할 단계
 * @returns {boolean} 이동 허용 여부
 */
export function wizValidateStep(from, to) {
  if (to === 2 && from === 1) return true;

  if (to === 3 && from === 2) {
    var me = getMyPlayer();
    if (!me) {
      toast('⚠️ 내 선수를 설정해주세요');
      openMyPlayerSetup();
      return false;
    }
    if (shouldSkipInstantMyTeamStep()) {
      _partner = null;
      _syncToMain();
      return true;
    }
    if (_category === 'double' && !_partner) {
      toast('⚠️ 파트너를 선택해주세요');
      return false;
    }
    _syncToMain();
    return true;
  }

  if (to === 4 && from === 2 && !C.getEditId()) {
    toast('⚠️ 상대팀 선택 단계를 먼저 진행해주세요');
    return false;
  }

  if (to === 4 && from === 3) {
    var isOpen = g('oc-chk') && g('oc-chk').checked;
    if (!isOpen) {
      var need = _category === 'double' ? 2 : 1;
      if (_oppDraft.length < need) {
        toast('⚠️ 상대' + (_category === 'double' ? ' 팀(2명)' : ' 선수') + '을 선택해주세요');
        return false;
      }
      C.setOpp(_oppDraft.slice());
    }
    if (C.isInstantMode && C.isInstantMode() && !isOpen) {
      var tm = C.TM[C.getState()._type] || C.TM.ms;
      if ((C.getState()._opp || []).length < tm.maxO) {
        toast('⚠️ 즉시 대결은 상대 팀 선택이 필요합니다');
        return false;
      }
    }
    return true;
  }

  return true;
}

export function getWizQuickResult() {
  return { winner: _quickWinner, score: _quickScore.trim() || null };
}

export function checkMyPlayerSetup() {
  if (hasMyPlayerStored()) {
    _setupMandatory = false;
    if (validateMyPlayer()) renderMyRecordHome();
    return;
  }
  if (!members().length) return;
  _setupMandatory = true;
  _pendingPlayerId = null;
  setTimeout(function () { openMyPlayerSetup(true); }, 400);
}

/** 앱 시작 시: LocalStorage만 확인·로그 (팝업은 회원 로드 후 checkMyPlayerSetup) */
export function initMyPlayerOnLoad() {
  _migrateLegacyMyPlayerKeys();
  if (hasMyPlayerStored()) {
    _setupMandatory = false;
    renderMyRecordHome();
  }
}

function _updateMyPlayerModalUI() {
  var mo = g('mo-my-player');
  if (mo) mo.classList.toggle('mo-my-player-mandatory', _setupMandatory);
  var closeBtn = g('my-player-close');
  if (closeBtn) closeBtn.style.display = _setupMandatory ? 'none' : '';
  var confirmBtn = g('my-player-confirm');
  if (confirmBtn) confirmBtn.disabled = !_pendingPlayerId;
}

function _renderMyPlayerList() {
  var box = g('my-player-list');
  if (!box) return;
  var curId = _pendingPlayerId || getMyPlayerId();
  var html = '';
  _activeMembers([]).forEach(function (m) {
    var on = curId === m.id ? ' wiz-pick-on' : '';
    html += '<button type="button" class="wiz-pick' + on + '" onclick="pickMyPlayerPending(\'' + _escAttr(m.id) + '\')">'
      + '<span class="wiz-pick-name">' + m.name + '</span>'
      + '<span class="wiz-pick-sub">' + (m.grade || '') + ' · ' + (m.gender || '') + '</span></button>';
  });
  box.innerHTML = html || '<div class="wiz-empty">등록된 회원이 없습니다.</div>';
  _updateMyPlayerModalUI();
}

/**
 * 내 선수 선택 모달을 연다.
 * @param {boolean} [firstVisit] - false면 변경 모드, 그 외는 최초 설정·필수 모드
 */
export function openMyPlayerSetup(firstVisit) {
  if (firstVisit === false) {
    _setupMandatory = false;
  } else {
    _setupMandatory = !hasMyPlayerStored();
  }
  if (!_pendingPlayerId && hasMyPlayerStored()) {
    _pendingPlayerId = getMyPlayerId();
  }
  var title = g('my-player-title');
  if (title) {
    title.textContent = _setupMandatory
      ? '본인을 선택해주세요.'
      : '내 선수를 선택하세요.';
  }
  _renderMyPlayerList();
  openMo('mo-my-player');
}

function _statBlock(title, rank, rec) {
  var r = rec || { total: 0, wins: 0, losses: 0, winRate: 0 };
  return '<div class="my-stat-block">'
    + '<div class="my-stat-head">' + title + '</div>'
    + '<div class="my-stat-grid">'
    + '<div class="my-stat-item"><span class="my-stat-val">' + (rank != null ? rank + '위' : '—') + '</span><span class="my-stat-lbl">현재 랭킹</span></div>'
    + '<div class="my-stat-item"><span class="my-stat-val">' + r.total + '</span><span class="my-stat-lbl">경기 수</span></div>'
    + '<div class="my-stat-item"><span class="my-stat-val">' + r.wins + '</span><span class="my-stat-lbl">승</span></div>'
    + '<div class="my-stat-item"><span class="my-stat-val">' + r.losses + '</span><span class="my-stat-lbl">패</span></div>'
    + '<div class="my-stat-item my-stat-item--wide"><span class="my-stat-val">' + r.winRate + '%</span><span class="my-stat-lbl">승률</span></div>'
    + '</div></div>';
}

function _renderMyBadgesHtml() {
  var me = getMyPlayer();
  if (!me || !C.computeMemberBadges) return '';
  var badges = C.computeMemberBadges(me.name);
  var grid = badges.length
    ? badges.map(function (b) {
      return '<div class="member-badge" title="' + b.desc + '"><span class="member-badge-icon">' + b.icon + '</span><span class="member-badge-lbl">' + b.label + '</span></div>';
    }).join('')
    : '<div class="wiz-empty" style="padding:12px 0;font-size:13px">아직 획득한 배지가 없습니다</div>';
  return '<div class="my-badges-section"><div class="my-stat-head">내 배지</div><div class="badge-grid">' + grid + '</div></div>';
}

function _renderMyStatsHtml(compact) {
  var me = getMyPlayer();
  if (!me) {
    return compact
      ? '<div class="my-record-empty">내 선수를 설정하면 기록이 표시됩니다.</div>'
      : '<div class="wiz-empty" style="padding:32px 0">내 선수를 설정해주세요.<br><button type="button" class="btn btn-p" style="margin-top:16px" onclick="openMyPlayerSetup()">🏓 내 선수 설정</button></div>';
  }
  var dblRec = C.computeDoublesRecord(me.name);
  var indRec = C.computeSinglesRecord(me.name);
  var dblRank = C.getMemberRankPosition(me, true, true);
  var indRank = C.getMemberRankPosition(me, false, true);
  if (!dblRec.total && !indRec.total) {
    if (C.renderEmptyState) {
      return C.renderEmptyState('🏓', '아직 경기 기록이 없어요', '도전장을 보내거나 받아보세요!');
    }
    return '<div class="my-record-empty">아직 경기 기록이 없어요. 도전장을 보내거나 받아보세요!</div>';
  }
  if (compact) {
    return '<div class="my-record-compact">'
      + '<div class="my-record-name">👤 ' + me.name + '</div>'
      + '<div class="my-record-row"><span>🤝 복식</span><strong>' + (dblRank != null ? dblRank + '위' : '—') + '</strong><span>' + dblRec.total + '경기 · ' + dblRec.winRate + '%</span></div>'
      + '<div class="my-record-row"><span>🏓 단식</span><strong>' + (indRank != null ? indRank + '위' : '—') + '</strong><span>' + indRec.total + '경기 · ' + indRec.winRate + '%</span></div>'
      + '</div>';
  }
  return _statBlock('🤝 복식', dblRank, dblRec) + _statBlock('🏓 단식', indRank, indRec);
}

/**
 * 홈 탭 상단의 내 기록 요약 카드를 렌더한다.
 */
export function renderMyRecordHome() {
  var box = g('my-record-home');
  if (!box) return;
  var me = getMyPlayer();
  box.style.display = me ? '' : 'none';
  if (!me) return;
  var dblRec = C.computeDoublesRecord(me.name);
  var indRec = C.computeSinglesRecord(me.name);
  var dblRank = C.getMemberRankPosition(me, true, true);
  var indRank = C.getMemberRankPosition(me, false, true);
  var primaryRank = dblRec.total >= indRec.total ? dblRank : indRank;
  var primaryLbl = dblRec.total >= indRec.total ? '복식' : '단식';
  var avHtml = C.memberAvatarHtml ? C.memberAvatarHtml(me.name, '', 'my-record-card__avatar') : '';
  box.innerHTML = '<button type="button" class="my-record-card my-record-card--dash" onclick="nav(\'my\')">'
    + '<div class="my-record-card__top"><span class="my-record-card__eyebrow">MY DASHBOARD</span>'
    + '<span class="my-record-more">자세히 →</span></div>'
    + '<div class="my-record-card__main">'
    + '<div class="my-record-card__identity">' + avHtml
    + '<div class="my-record-card__name">' + me.name + '</div></div>'
    + '<div class="my-record-card__rank">' + (primaryRank != null ? primaryRank : '—') + '<span>위</span></div></div>'
    + '<div class="my-record-card__kpis">'
    + '<span>🤝 복식 <strong>' + (dblRank != null ? dblRank + '위' : '—') + '</strong> · ' + dblRec.total + '경기</span>'
    + '<span>🏓 단식 <strong>' + (indRank != null ? indRank + '위' : '—') + '</strong> · ' + indRec.total + '경기</span>'
    + '</div>'
    + '<div class="my-record-card__hint">' + primaryLbl + ' 기준 · 탭하여 전체 대시보드 보기</div>'
    + '</button>';
}

/**
 * MY 탭 전체(대시보드·설정)를 렌더한다.
 */
export function renderMyPage() {
  var dash = g('my-page-dashboard');
  var setting = g('my-page-setting');
  if (!isMyPlayerReady()) {
    if (dash) {
      dash.innerHTML = '<div class="my-dash my-dash--setup">'
        + '<div class="my-dash-setup-card">'
        + '<div class="my-dash-setup-icon">🏓</div>'
        + '<div class="my-dash-setup-title">내 선수를 설정하세요</div>'
        + '<p class="my-dash-setup-desc">설정 후 AI 코칭·추천 상대·성장 분석을 확인할 수 있어요.</p>'
        + '<button type="button" class="btn btn-p my-dash-setup-btn" onclick="openMyPlayerSetup(true)">내 선수 설정</button>'
        + '</div></div>';
    }
    if (setting) setting.innerHTML = '';
    return;
  }
  if (dash && C.renderMyDashboardHtml) {
    dash.innerHTML = C.renderMyDashboardHtml();
    if (C.hydrateMyAiCards) {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () { C.hydrateMyAiCards(); });
      } else {
        C.hydrateMyAiCards();
      }
    }
  } else if (dash) {
    dash.innerHTML = _renderMyStatsHtml(false) + (C.renderMyExtrasHtml ? C.renderMyExtrasHtml() : '');
  }
  if (setting) {
    var me = getMyPlayer();
    setting.innerHTML = '<div class="my-setting-head">설정</div>'
      + '<div class="my-setting-row"><span>내 선수</span><strong>' + me.name + '</strong></div>'
      + '<button type="button" class="btn btn-p" style="width:100%;margin-top:12px" onclick="openMyMemberProfile()">내 프로필 자세히 보기</button>'
      + '<button type="button" class="btn btn-g" style="width:100%;margin-top:8px" onclick="openMyPlayerSetup(false)">내 선수 변경</button>';
  }
}

/**
 * 대결 탭 홈 — 최근 조합·파트너·상대 바로가기 렌더.
 */
export function renderChHomeShortcuts() {
  var box = g('ch-quick-shortcuts');
  if (!box || !C) return;
  if (!isMyPlayerReady()) {
    box.innerHTML = '';
    return;
  }
  var me = getMyPlayer();
  var myTeams = _getRecentTeams(LS.recentMyTeams).filter(function (item) {
    return item.team && item.team.indexOf(me.name) >= 0 && item.team.length >= 2;
  }).slice(0, 3);
  var recentOpp = _getRecentTeams(LS.recentOppTeams).filter(function (item) {
    return item.team && item.team.length >= 2;
  }).slice(0, 2);
  var partners = _getPartnerCounts().slice(0, 3);
  if (!myTeams.length && !recentOpp.length && !partners.length) {
    box.innerHTML = '';
    return;
  }
  var html = '';
  if (myTeams.length) {
    html += '<div class="ch-shortcut-block"><div class="ch-shortcut-head">최근 복식 조합</div><div class="ch-shortcut-list">';
    myTeams.forEach(function (item, idx) {
      var label = item.team.join(' + ');
      html += '<button type="button" class="ch-shortcut-chip" onclick="chQuickMyTeam(' + idx + ')">' + label + '<span>선택</span></button>';
    });
    html += '</div></div>';
  }
  if (partners.length) {
    html += '<div class="ch-shortcut-block"><div class="ch-shortcut-head">자주 함께한 파트너</div><div class="ch-shortcut-list">';
    partners.forEach(function (p) {
      html += '<button type="button" class="ch-shortcut-chip" onclick="chQuickPartner(\'' + _escAttr(p.name) + '\')">' + p.name + ' <em>(' + p.count + '회)</em><span>선택</span></button>';
    });
    html += '</div></div>';
  }
  if (recentOpp.length) {
    html += '<div class="ch-shortcut-block"><div class="ch-shortcut-head">최근 상대팀</div><div class="ch-shortcut-list">';
    recentOpp.forEach(function (item, idx) {
      var label = item.team.join(' + ');
      html += '<button type="button" class="ch-shortcut-chip ch-shortcut-chip--opp" onclick="chQuickOppTeam(' + idx + ')">' + label + '<span>다시 등록</span></button>';
    });
    html += '</div></div>';
  }
  box.innerHTML = html;
}

/**
 * 원클릭 등록용 팀 상태 적용.
 */
export function wizApplyQuickTeams(myTeamItem, oppTeamItem) {
  _category = 'double';
  _partner = null;
  _oppDraft = [];
  var me = getMyPlayer();
  if (myTeamItem && myTeamItem.team && me) {
    _partner = myTeamItem.team.find(function (n) { return n !== me.name; }) || null;
  }
  if (oppTeamItem && oppTeamItem.team) {
    _oppDraft = oppTeamItem.team.slice();
  }
  _syncToMain();
  if (_oppDraft.length >= 2) C.setOpp(_oppDraft.slice());
}

export function wizApplyQuickPartner(partnerName) {
  _category = 'double';
  _partner = partnerName;
  _oppDraft = [];
  _syncToMain();
}

/**
 * 즉시대결 상대 1명 프리필 (복식·단식 공통).
 * @param {string} name - 상대 선수 이름
 * @param {boolean} [asSingle] - 단식 모드
 */
export function wizApplyOpponentName(name, asSingle) {
  _category = asSingle ? 'single' : 'double';
  _partner = null;
  _oppDraft = name ? [name] : [];
  if (_category === 'single' && name) {
    C.setOpp([name]);
    _syncToMain();
    return;
  }
  if (_oppDraft.length) C.setOpp(_oppDraft.slice());
  _syncToMain();
}

/**
 * 위저드·MY 모듈에 main.js 컨텍스트를 주입하고 전역 핸들러를 등록한다.
 * @param {object} ctx - main.js에서 전달하는 API·상태 접근 객체
 */
export function initWizard(ctx) {
  C = ctx;

  window.setWizCategory = function (cat) {
    _category = cat === 'single' ? 'single' : 'double';
    _partner = null;
    _oppDraft = [];
    _syncToMain();
    if (_isInstantWizard()) {
      if (_category === 'single') {
        if (typeof window.bsStep === 'function') window.bsStep(3);
        else _renderStep3();
      } else {
        if (typeof window.bsStep === 'function') window.bsStep(2);
        _renderInstantMyTeamStep();
      }
    } else {
      _renderStep1();
    }
  };

  window.wizPickPartner = function (name) {
    _partner = name;
    _syncToMain();
    if (C.isInstantMode && C.isInstantMode() && !C.getEditId()) {
      _renderInstantMyTeamStep();
    } else {
      _renderStep2();
    }
  };

  window.wizPickMyTeam = function (idx) {
    var teams = _getRecentTeams(LS.recentMyTeams);
    var item = teams[idx];
    if (!item || !item.team) return;
    var me = getMyPlayerName();
    var partner = item.team.find(function (n) { return n !== me; });
    if (partner) {
      _partner = partner;
      _syncToMain();
      if (C.isInstantMode && C.isInstantMode() && !C.getEditId()) {
        _renderInstantMyTeamStep();
      } else {
        _renderStep2();
      }
    }
  };

  window.wizPickOppTeam = function (idx) {
    var teams = _getRecentOppTeamsForCategory();
    var item = teams[idx];
    if (!item || !item.team) return;
    _oppDraft = item.team.slice();
    C.setOpp(_oppDraft.slice());
    _renderStep3();
  };

  window.wizPickOppPlayer = function (name) {
    var need = _category === 'double' ? 2 : 1;
    if (_category === 'single') {
      _oppDraft = [name];
    } else {
      if (_oppDraft.indexOf(name) >= 0) {
        _oppDraft = _oppDraft.filter(function (n) { return n !== name; });
      } else if (_oppDraft.length >= need) {
        _oppDraft = [name];
      } else {
        _oppDraft.push(name);
      }
    }
    if (_oppDraft.length >= need) C.setOpp(_oppDraft.slice());
    _renderStep3();
  };

  window.wizSetWinner = function (side) {
    _quickWinner = side;
    _renderStep4();
  };

  window.wizSetScore = function (val) {
    _quickScore = val || '';
  };

  window.openMyPlayerSetup = function (firstVisit) {
    openMyPlayerSetup(firstVisit);
  };

  window.pickMyPlayerPending = function (id) {
    _pendingPlayerId = id;
    _renderMyPlayerList();
  };

  window.confirmMyPlayer = function () {
    if (!_pendingPlayerId) return;
    if (!_setMyPlayer(_pendingPlayerId)) {
      toast('⚠️ 선택한 선수를 찾을 수 없습니다. 다시 설정해주세요.');
      _pendingPlayerId = null;
      openMyPlayerSetup(true);
      return;
    }
    closeMo('mo-my-player');
    toast('✅ 내 선수가 설정되었습니다');
    renderMyRecordHome();
    renderMyPage();
    var bs = g('bs-ch');
    if (bs && bs.classList.contains('on')) {
      wizRenderStep(2);
    }
  };

  window.changeMyPlayer = function () {
    openMyPlayerSetup(false);
  };

  window.chQuickMyTeam = function (idx) {
    var teams = _getRecentTeams(LS.recentMyTeams).filter(function (item) {
      var me = getMyPlayer();
      return me && item.team && item.team.indexOf(me.name) >= 0;
    });
    var item = teams[idx];
    if (!item) return;
    wizApplyQuickTeams(item, null);
    if (C.openInstantBS) C.openInstantBS({ keepTeams: true });
  };

  window.chQuickPartner = function (name) {
    wizApplyQuickPartner(name);
    if (C.openInstantBS) C.openInstantBS({ keepTeams: true });
  };

  window.chQuickOppTeam = function (idx) {
    var teams = _getRecentTeams(LS.recentOppTeams);
    var item = teams[idx];
    if (!item) return;
    _category = 'double';
    _oppDraft = item.team.slice();
    if (C.setOpp) C.setOpp(_oppDraft.slice());
    if (C.openInstantBS) C.openInstantBS({ keepTeams: true });
  };

  window.chQuickReplay = function (myIdx, oppIdx) {
    var me = getMyPlayer();
    var myTeams = _getRecentTeams(LS.recentMyTeams).filter(function (item) {
      return me && item.team && item.team.indexOf(me.name) >= 0;
    });
    var oppTeams = _getRecentTeams(LS.recentOppTeams);
    wizApplyQuickTeams(myTeams[myIdx], oppTeams[oppIdx]);
    if (C.openInstantBS) C.openInstantBS({ keepTeams: true });
  };
}

function openMo(id) { C.openMo(id); }
function closeMo(id) { C.closeMo(id); }
