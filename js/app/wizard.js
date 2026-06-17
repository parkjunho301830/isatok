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

function g(id) { return C.g(id); }
function members() { return C.getMembers(); }
function toast(msg) { C.toast(msg); }

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

function _logMyPlayerState(tag) {
  var shouldShow = _setupMandatory;
  console.log('[isatok] myPlayer check (' + (tag || '') + ')');
  console.log('myPlayerId:', localStorage.getItem(LS.myPlayerId));
  console.log('myPlayerName:', localStorage.getItem(LS.myPlayerName));
  console.log('membersLoaded:', members().length);
  console.log('hasMyPlayerStored:', hasMyPlayerStored());
  console.log('validateMyPlayer:', !!validateMyPlayer());
  console.log('showMyPlayerSetupModal:', shouldShow);
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

export function requireMyPlayer(message) {
  if (isMyPlayerReady()) return true;
  if (hasMyPlayerStored() && !members().length) return true;
  toast(message || '서비스 이용을 위해 먼저 내 선수 설정을 진행해주세요.');
  openMyPlayerSetup(true);
  return false;
}

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
  _logMyPlayerState('saved');
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
  var html = '<div class="cc-creator-meta">';
  if (creator) html += '<span>등록자 : ' + creator + '</span>';
  if (at) html += '<span>등록일시 : ' + at + '</span>';
  html += '</div>';
  return html;
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
  var labels = ['경기유형', '내팀', '상대팀', '결과입력'];
  for (var i = 1; i <= 4; i++) {
    var el = g('wiz-bar-' + i);
    if (el) {
      el.classList.toggle('on', i === n);
      el.classList.toggle('done', i < n);
    }
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

function _renderStep2() {
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
  var instant = C.isInstantMode();
  var html = '<div class="wiz-step-title">상대 팀 선택</div>';

  var ocWrap = g('oc-toggle-wrap');
  if (ocWrap) ocWrap.style.display = (instant || C.getEditId()) ? 'none' : '';

  if (!isOpen) {
    var recentOpp = _getRecentTeams(LS.recentOppTeams);
    if (recentOpp.length) {
      html += _sectionLabel('최근 상대팀');
      html += '<div class="wiz-combo-list">';
      recentOpp.forEach(function (item, idx) {
        var team = item.team || [];
        var need = _category === 'double' ? 2 : 1;
        if (team.length < need) return;
        var label = team.join(' + ');
        var sel = _oppDraft.length === team.length && team.every(function (n, i) { return _oppDraft[i] === n; });
        html += '<button type="button" class="wiz-combo' + (sel ? ' on' : '') + '" onclick="wizPickOppTeam(' + idx + ')">' + label + '</button>';
      });
      html += '</div>';
    }

    html += _sectionLabel(_category === 'double' ? '선수 선택 (2명)' : '상대 선수');
    if (_category === 'double' && _oppDraft.length === 1) {
      html += '<div class="wiz-hint">1명 선택됨: <strong>' + _oppDraft[0] + '</strong> — 파트너를 선택하세요</div>';
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
  var myLbl = my.join(' + ') || '—';
  var oppLbl = isOpen ? '오픈 (누구나)' : (opp.join(' + ') || '—');

  var html = '<div class="wiz-vs-banner">'
    + '<div class="wiz-vs-team">' + myLbl + '</div>'
    + '<div class="wiz-vs-sep">VS</div>'
    + '<div class="wiz-vs-team">' + oppLbl + '</div>'
    + '</div>';

  if (instant && !C.getEditId()) {
    var now = C.nowDateTimeFields();
    html += '<input type="date" id="ch-date" value="' + now.date + '" tabindex="-1" aria-hidden="true" style="position:absolute;opacity:0;height:0;width:0;pointer-events:none">';
    html += '<input type="time" id="ch-time" value="' + now.time + '" tabindex="-1" aria-hidden="true" style="position:absolute;opacity:0;height:0;width:0;pointer-events:none">';
    html += '<div class="wiz-result-quick">';
    html += '<div class="fg"><label>승리 팀 <span style="color:var(--t3);font-weight:400">(선택)</span></label>';
    html += '<div class="wiz-win-btns">';
    html += '<button type="button" class="wiz-win' + (_quickWinner === 'a' ? ' on' : '') + '" onclick="wizSetWinner(\'a\')">' + myLbl + ' 승</button>';
    html += '<button type="button" class="wiz-win' + (_quickWinner === 'b' ? ' on' : '') + '" onclick="wizSetWinner(\'b\')">' + oppLbl + ' 승</button>';
    html += '</div></div>';
    html += '<div class="fg"><label>스코어 <span style="color:var(--t3);font-weight:400">(선택)</span></label>';
    html += '<input type="text" class="wiz-score-inp" id="wiz-quick-score" placeholder="예: 3:1" value="' + (_quickScore || '') + '" oninput="wizSetScore(this.value)"></div>';
    html += '</div>';
  }

  if (!instant || C.getEditId()) {
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
  }

  box.innerHTML = html;
  C.updateChSubmitBtn();
}

export function wizRenderStep(n) {
  _updateProgress(n);
  if (n === 1) _renderStep1();
  else if (n === 2) _renderStep2();
  else if (n === 3) _renderStep3();
  else if (n === 4) _renderStep4();
}

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

export function wizValidateStep(from, to) {
  if (to === 2 && from === 1) return true;

  if (to === 3 && from === 2) {
    var me = getMyPlayer();
    if (!me) {
      toast('⚠️ 내 선수를 설정해주세요');
      openMyPlayerSetup();
      return false;
    }
    if (_category === 'double' && !_partner) {
      toast('⚠️ 파트너를 선택해주세요');
      return false;
    }
    _syncToMain();
    return true;
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
    if (C.isInstantMode() && !isOpen) {
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
  _logMyPlayerState('checkMyPlayerSetup');
  if (hasMyPlayerStored()) {
    _setupMandatory = false;
    if (validateMyPlayer()) renderMyRecordHome();
    return;
  }
  if (!members().length) return;
  _setupMandatory = true;
  _pendingPlayerId = null;
  console.log('[isatok] showMyPlayerSetupModal:', true);
  setTimeout(function () { openMyPlayerSetup(true); }, 400);
}

/** 앱 시작 시: LocalStorage만 확인·로그 (팝업은 회원 로드 후 checkMyPlayerSetup) */
export function initMyPlayerOnLoad() {
  _migrateLegacyMyPlayerKeys();
  _logMyPlayerState('init');
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
  console.log('[isatok] showMyPlayerSetupModal:', _setupMandatory, 'manual:', firstVisit === false);
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
  if (compact) {
    return '<div class="my-record-compact">'
      + '<div class="my-record-name">👤 ' + me.name + '</div>'
      + '<div class="my-record-row"><span>🤝 복식</span><strong>' + (dblRank != null ? dblRank + '위' : '—') + '</strong><span>' + dblRec.total + '경기 · ' + dblRec.winRate + '%</span></div>'
      + '<div class="my-record-row"><span>🏓 단식</span><strong>' + (indRank != null ? indRank + '위' : '—') + '</strong><span>' + indRec.total + '경기 · ' + indRec.winRate + '%</span></div>'
      + '</div>';
  }
  return _statBlock('🤝 복식', dblRank, dblRec) + _statBlock('🏓 단식', indRank, indRec);
}

export function renderMyRecordHome() {
  var box = g('my-record-home');
  if (!box) return;
  var me = getMyPlayer();
  box.style.display = me ? '' : 'none';
  if (!me) return;
  box.innerHTML = '<button type="button" class="my-record-card" onclick="nav(\'my\')">'
    + _renderMyStatsHtml(true)
    + '<span class="my-record-more">자세히 →</span></button>';
}

export function renderMyPage() {
  if (!isMyPlayerReady()) {
    var stats = g('my-page-stats');
    var setting = g('my-page-setting');
    if (stats) stats.innerHTML = '';
    if (setting) {
      setting.innerHTML = '<div class="wiz-empty" style="padding:8px 0">내 선수 설정 후 기록을 확인할 수 있습니다.</div>'
        + '<button type="button" class="btn btn-p" style="width:100%;margin-top:12px" onclick="openMyPlayerSetup(true)">🏓 내 선수 설정</button>';
    }
    return;
  }
  var stats = g('my-page-stats');
  var setting = g('my-page-setting');
  if (stats) stats.innerHTML = _renderMyStatsHtml(false);
  if (setting) {
    var me = getMyPlayer();
    setting.innerHTML = '<div class="my-setting-head">설정</div>'
      + '<div class="my-setting-row"><span>내 선수</span><strong>' + me.name + '</strong></div>'
      + '<button type="button" class="btn btn-g" style="width:100%;margin-top:12px" onclick="openMyPlayerSetup(false)">내 선수 변경</button>';
  }
}

export function initWizard(ctx) {
  C = ctx;

  window.setWizCategory = function (cat) {
    _category = cat === 'single' ? 'single' : 'double';
    _partner = null;
    _oppDraft = [];
    _syncToMain();
    _renderStep1();
  };

  window.wizPickPartner = function (name) {
    _partner = name;
    _syncToMain();
    _renderStep2();
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
      _renderStep2();
    }
  };

  window.wizPickOppTeam = function (idx) {
    var teams = _getRecentTeams(LS.recentOppTeams);
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
}

function openMo(id) { C.openMo(id); }
function closeMo(id) { C.closeMo(id); }
