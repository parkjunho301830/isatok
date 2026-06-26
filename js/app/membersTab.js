/**
 * 회원 탭·선수 프로필 모달·회원 CRUD
 */
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { COL_MEMBERS, PT_INIT } from './constants.js?v=2026.06.26.10';
import { buildRecommendReason } from './coaching.js?v=2026.06.26.10';
import { renderOpponentAiShellHtml } from './aiCoach.js?v=2026.06.26.10';
import {
  getMyPlayer, getMyPlayerId, wizApplyOpponentName, requireMyPlayer
} from './wizard.js?v=2026.06.26.10';
import { _memberPt, _calcGrade } from './memberCore.js?v=2026.06.26.10';
import { _memberGrade, avc } from './memberUtils.js?v=2026.06.26.10';
import {
  _getAllMatchesFor, _getMatchesForMode, _computeDoublesRecord, _computeSinglesRecord,
  _getMemberRankPosition, _computeHeadToHead, _computeTopPartner, _computeBestWinRatePartner,
  _getDoublesMatchesFor, _getSinglesMatchesFor, _playerWonAnyMatch, _formatRecentMatchLine,
  _buildMemberBadgesHtml, _rankPointsForMember
} from './matchStats.js?v=2026.06.26.10';
import { getRkScope } from './rankingTab.js?v=2026.06.26.10';

let C = null;
let _mf = 'all';
let _fg = '';
let _mdShowCount = 30;
let _mdPreviewId = null;
let _mdCompareId = null;
let _profileMemberId = null;
let _mSearchTimer = null;

export function initMembersTab(ctx) {
  C = ctx;
  window.openPlayerProfile = openPlayerProfile;
  window.openMemberPreview = openPlayerProfile;
  window.openMemberProfile = openPlayerProfile;
  window.openMyMemberProfile = openMyMemberProfile;
  window.renderProfileH2H = renderProfileH2H;
  window.setMf = setMf;
  window.loadMoreMembers = loadMoreMembers;
  window.startInstantVsFromProfile = startInstantVsFromProfile;
  window.startInstantVsPreview = startInstantVsFromProfile;
  window.startInstantVsMember = startInstantVsMember;
  window.toggleMemberCompare = toggleMemberCompare;
  window.filterM = filterM;
  window.filterG = filterG;
  window.openAddModal = openAddModal;
  window.submitM = submitM;
  window.openEdit = openEdit;
  window.saveEdit = saveEdit;
  window.openDel = openDel;
  window.confirmDel = confirmDel;
  window.exportMembersVcf = exportMembersVcf;
  window.openEditFromProfile = openEditFromProfile;
}

function g(id) { return C.g(id); }
function toast(msg) { C.toast(msg); }
function db() { return C.getDb(); }
function members() { return C.getMembers(); }
function chal() { return C.getChal(); }
function isAdmin() { return C.isAdmin(); }
function requireAdmin(fn) { return C.requireAdmin(fn); }
function openMo(id) { return C.openMo(id); }
function closeMo(id) { return C.closeMo(id); }
function memberAv(name, cls, extra, style) { return C.memberAv(name, cls, extra, style); }
function hydrateOpponentAnalysis(id) { return C.hydrateOpponentAnalysis(id); }
function getDelId() { return C.getDelId(); }
function setDelId(id) { C.setDelId(id); }
function removeMemberLocal(id) { C.removeMemberLocal(id); }

const _KO_CHOSUNG='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
export function _extractChosung(str){
  var r='';
  for(var i=0;i<(str||'').length;i++){
    var c=str.charCodeAt(i);
    if(c>=0xAC00&&c<=0xD7A3)r+=_KO_CHOSUNG[Math.floor((c-0xAC00)/588)];
  }
  return r;
}
export function _matchMemberSearch(name,query){
  if(!query)return true;
  var q=query.trim();
  if(!q)return true;
  var n=name||'';
  if(n.includes(q))return true;
  var cs=_extractChosung(n);
  if(cs.includes(q))return true;
  if(/^[ㄱ-ㅎ]+$/.test(q)&&cs.indexOf(q)>=0)return true;
  return false;
}
export function _matchMemberQuery(m,query){
  if(!query)return true;
  var q=query.trim().toLowerCase();
  if(!q)return true;
  if(_matchMemberSearch(m.name,query))return true;
  if((m.phone||'').includes(q))return true;
  if((m.memo||'').toLowerCase().includes(q))return true;
  return false;
}
export function _memberLastMatchDate(name){
  var matches=_getAllMatchesFor(name);
  if(!matches.length)return null;
  var c=matches[0];
  return c.date||(c.createdAt?c.createdAt.slice(0,10):'');
}
export function _memberActivityMeta(name){
  var d=_memberLastMatchDate(name);
  if(!d)return {cls:'md-act--idle',label:'⚪ 장기 미활동',days:null};
  var diff=Math.floor((Date.now()-new Date(d+'T12:00:00').getTime())/86400000);
  if(diff<=7)return {cls:'md-act--hot',label:'🟢 최근 활동',days:diff};
  if(diff<=30)return {cls:'md-act--warm',label:'🟡 '+diff+'일 전',days:diff};
  return {cls:'md-act--idle',label:'⚪ 장기 미활동',days:diff};
}
export function _getRecentOpponentNames(limit){
  var me=getMyPlayer();
  if(!me)return [];
  var list=[],seen={};
  _getMatchesForMode(me.name,true).forEach(function(c){
    var my=c.myTeam||[],opp=c.oppTeam||[];
    var opps=my.indexOf(me.name)>=0?opp:(opp.indexOf(me.name)>=0?my:[]);
    opps.forEach(function(n){
      if(!n||n===me.name||seen[n])return;
      seen[n]=true;
      list.push(n);
    });
  });
  return list.slice(0,limit||6);
}
export function _buildMemberRankList(isDbl){
  return members().filter(function(m){return m.status!=='비활성';})
    .map(function(m){
      var pt=_rankPointsForMember(m,isDbl,true);
      var gr=_calcGrade(pt);
      var rec=isDbl?_computeDoublesRecord(m.name):_computeSinglesRecord(m.name);
      var rank=_getMemberRankPosition(m,isDbl,true);
      return {m:m,pt:pt,gr:gr,rec:rec,rank:rank};
    })
    .sort(function(a,b){return b.pt-a.pt||((a.m.name||'').localeCompare(b.m.name||''));});
}
export function _getRecommendedOpponents(){
  var me=getMyPlayer();
  if(!me)return [];
  var myRank=_getMemberRankPosition(me,true,true);
  var myRec=_computeDoublesRecord(me.name);
  var recentSet={};
  _getRecentOpponentNames(30).forEach(function(n){recentSet[n]=true;});
  return members().filter(function(m){return m.status!=='비활성'&&m.id!==me.id;})
    .map(function(m){
      var rank=_getMemberRankPosition(m,true,true);
      var rec=_computeDoublesRecord(m.name);
      var score=0;
      if(rank!=null&&myRank!=null)score+=Math.max(0,12-Math.abs(rank-myRank)*2);
      if(!recentSet[m.name])score+=6;
      if(rec.total>=3)score+=Math.max(0,8-Math.abs(rec.winRate-myRec.winRate)/8);
      if(rec.total<1)score-=12;
      var h2h=_computeHeadToHead(me.name,m.name);
      var reason=buildRecommendReason({
        rankDiff:rank!=null&&myRank!=null?Math.abs(rank-myRank):null,
        winRateDiff:Math.abs(rec.winRate-myRec.winRate),
        playedRecently:!!recentSet[m.name],
        h2hWins:h2h.winsA,
        h2hLosses:h2h.lossesA
      });
      return {m:m,rank:rank,rec:rec,score:score,reason:reason};
    })
    .filter(function(x){return x.rec.total>=1&&x.score>0;})
    .sort(function(a,b){return b.score-a.score;})
    .slice(0,4);
}
export function _filterMembersTab(rows,tab){
  if(tab==='top10')return rows.slice(0,10);
  if(tab==='active'){
    return rows.filter(function(x){return x.m.status==='활성';});
  }
  if(tab==='recent'){
    return rows.filter(function(x){
      var act=_memberActivityMeta(x.m.name);
      return act.days!=null&&act.days<=14;
    });
  }
  if(tab==='doubles'){
    return rows.filter(function(x){return x.rec.total>=5;})
      .sort(function(a,b){return b.rec.winRate-a.rec.winRate||b.rec.total-a.rec.total;});
  }
  return rows;
}
export function _escMd(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/'/g,'\\\'');
}
function _phoneTel(phone) {
  return String(phone || '').replace(/[^\d+]/g, '');
}
function _renderMemberPhoneHtml(phone, cls) {
  var base = cls || 'md-card__phone';
  if (!phone) return '<div class="' + base + ' ' + base + '--empty">연락처 미등록</div>';
  var tel = _phoneTel(phone);
  return '<div class="' + base + '"><a href="tel:' + tel + '" onclick="event.stopPropagation()">📞 ' + phone + '</a></div>';
}
export function _renderMemberCard(entry,opts){
  opts=opts||{};
  var m=entry.m,rank=entry.rank,rec=entry.rec,gr=entry.gr;
  var act=_memberActivityMeta(m.name);
  var rankLbl=rank!=null?rank+'위':'—';
  var medal=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':'';
  var compareCls=_mdCompareId===m.id?' md-card--compare':'';
  var adminActs='<button type="button" class="md-card__admin btn btn-g btn-xs" onclick="event.stopPropagation();openEdit(\''+m.id+'\')">✏️</button>'
    +(isAdmin()?' <button type="button" class="md-card__admin btn btn-d btn-xs" onclick="event.stopPropagation();openDel(\''+m.id+'\')">🗑</button>':'');
  return '<article class="md-card'+compareCls+'" data-mid="'+m.id+'" onclick="openPlayerProfile(\''+m.id+'\')">'
    +'<div class="md-card__top">'
    +memberAv(m.name,avc(m.name),'md-card__avatar')
    +'<div class="md-card__info">'
    +'<div class="md-card__name">'+m.name+'</div>'
    +_renderMemberPhoneHtml(m.phone)
    +'<div class="md-card__meta"><span class="badge '+gr.badge+'">'+gr.icon+' '+gr.label+'</span>'
    +'<span class="md-act '+act.cls+'">'+act.label+'</span></div>'
    +'</div>'
    +'<div class="md-card__rank">'+(medal||('<span class="md-card__rank-num">'+rankLbl+'</span>'))+'</div>'
    +'</div>'
    +'<div class="md-card__stats">'
    +'<div class="md-card__stat"><span class="md-card__stat-val">'+rec.winRate+'%</span><span class="md-card__stat-lbl">승률</span></div>'
    +'<div class="md-card__stat"><span class="md-card__stat-val">'+rec.total+'</span><span class="md-card__stat-lbl">경기</span></div>'
    +'<div class="md-card__stat"><span class="md-card__stat-val">'+rec.wins+'승 '+rec.losses+'패</span><span class="md-card__stat-lbl">최근</span></div>'
    +'<div class="md-card__stat"><span class="md-card__stat-val">'+entry.pt.toLocaleString()+'</span><span class="md-card__stat-lbl">pt</span></div>'
    +'</div>'
    +'<div class="md-card__actions" onclick="event.stopPropagation()">'
    +'<button type="button" class="btn btn-g btn-sm md-card__btn" onclick="openPlayerProfile(\''+m.id+'\')">프로필</button>'
    +'<button type="button" class="btn btn-p btn-sm md-card__btn" onclick="startInstantVsMember(\''+m.id+'\')">⚡ 즉시대결</button>'
    +(opts.showCompare?'<button type="button" class="btn btn-g btn-xs md-card__btn" onclick="toggleMemberCompare(\''+m.id+'\')">VS</button>':'')
    +adminActs
    +'</div></article>';
}
export function _renderMemberPodium(top3){
  if(!top3.length)return '';
  var medals=['🥇','🥈','🥉'];
  return '<div class="md-podium">'+top3.map(function(entry,i){
    var m=entry.m;
    return '<button type="button" class="md-podium__item md-podium__item--'+(i+1)+'" onclick="openPlayerProfile(\''+m.id+'\')">'
      +'<span class="md-podium__medal">'+medals[i]+'</span>'
      +memberAv(m.name,avc(m.name),'md-podium__avatar')
      +'<span class="md-podium__name">'+m.name+'</span>'
      +'<span class="md-podium__pts">'+entry.pt.toLocaleString()+'pt</span>'
      +'<span class="md-podium__wr">'+entry.rec.winRate+'%</span>'
      +'</button>';
  }).join('')+'</div>';
}
export function _renderMemberDirectoryHtml(filtered,query){
  var html='';
  var showSections=!query&&_mf==='all';
  if(showSections){
    var recentNames=_getRecentOpponentNames(6);
    if(recentNames.length){
      html+='<section class="md-section"><div class="md-section__head"><span class="md-section__title">최근 상대</span></div><div class="md-chip-scroll">';
      recentNames.forEach(function(n){
        var mem=members().find(function(x){return x.name===n&&x.status!=='비활성';});
        if(!mem)return;
        html+='<button type="button" class="md-recent-chip" onclick="openPlayerProfile(\''+mem.id+'\')">'+n+'</button>';
      });
      html+='</div></section>';
    }
    var rec=_getRecommendedOpponents();
    if(rec.length){
      html+='<section class="md-section"><div class="md-section__head"><span class="md-section__title">추천 상대</span><span class="md-section__sub">랭킹·승률 유사</span></div><div class="md-rec-grid">';
      rec.forEach(function(x){
        html+='<div class="md-rec-card"><div class="md-rec-card__main"><div class="md-rec-card__name">'+x.m.name+'</div>'
          +'<div class="md-rec-card__rank">'+(x.rank!=null?x.rank+'위':'—')+' · '+x.rec.winRate+'%</div>'
          +(x.reason?'<div class="md-rec-card__reason">'+x.reason+'</div>':'')
          +'</div><div class="md-rec-card__acts">'
          +'<button type="button" class="btn btn-g btn-xs" onclick="openPlayerProfile(\''+x.m.id+'\')">프로필</button>'
          +'<button type="button" class="btn btn-p btn-xs" onclick="startInstantVsMember(\''+x.m.id+'\')">즉시대결</button>'
          +'</div></div>';
      });
      html+='</div></section>';
    }
    var allRows=_buildMemberRankList(true);
    html+='<section class="md-section"><div class="md-section__head"><span class="md-section__title">랭킹 TOP</span><span class="md-section__sub">복식 · 시즌</span></div>'
      +_renderMemberPodium(allRows.slice(0,3))+'</section>';
  }
  if(_mdCompareId){
    var cm=members().find(function(x){return x.id===_mdCompareId;});
    if(cm)html+='<div class="md-compare-hint">비교 선택: <strong>'+cm.name+'</strong> · 카드 VS 버튼으로 상대 선택</div>';
  }
  if(!filtered.length){
    return html+'<div class="md-empty"><div class="md-empty__icon">🔍</div>'
      +'<div class="md-empty__title">조건에 맞는 회원이 없습니다</div>'
      +'<p class="md-empty__desc">다른 검색어를 입력해 보세요.</p></div>';
  }
  var visible=filtered.slice(0,_mdShowCount);
  html+='<section class="md-section"><div class="md-section__head"><span class="md-section__title">선수 목록</span><span class="md-section__sub">'+filtered.length+'명</span></div>'
    +'<div class="md-card-grid">'+visible.map(function(e){return _renderMemberCard(e,{showCompare:true});}).join('')+'</div></section>';
  return html;
}
export function _buildProfileModeBlock(title,rec,rank,partner,isDbl,bestPartner){
  var rankHtml=rank?(' · <span class="prof-rank">'+rank+'위</span>'):'';
  var partnerHtml='';
  if(isDbl&&partner&&partner.name){
    partnerHtml='<div class="prof-meta-row"><span>최다 파트너</span><strong>'+partner.name+' ('+partner.count+'경기)</strong></div>';
    if(bestPartner&&bestPartner.name){
      partnerHtml+='<div class="prof-meta-row"><span>최고 승률 파트너</span><strong>'+bestPartner.name+' · '+bestPartner.count+'경기 · '+bestPartner.winRate+'%</strong></div>';
    }
  }
  var recentHtml='';
  if(rec.matches&&rec.matches.length){
    recentHtml='<div class="prof-recent-list">'+rec.matches.slice(0,6).map(function(c){
      var m=members().find(function(x){return x.id===_profileMemberId;});
      var nm=m?m.name:'';
      var line=_formatRecentMatchLine(c,nm,isDbl);
      return '<div class="prof-recent-item'+(line.won?' win':' loss')+'">'+line.icon+' '+line.score+' '+line.result+' · vs '+line.opp+' <span class="prof-recent-date">'+line.date+'</span></div>';
    }).join('')+'</div>';
  }else{
    recentHtml='<div class="prof-empty">완료된 '+title+' 기록이 없습니다</div>';
  }
  return '<div class="stat-box prof-mode-block"><div class="stat-box-t">'+title+rankHtml+'</div>'
    +'<div class="prof-stats-grid">'
    +'<div class="prof-stat"><div class="prof-stat-n">'+rec.total+'</div><div class="prof-stat-l">경기</div></div>'
    +'<div class="prof-stat"><div class="prof-stat-n">'+rec.winRate+'%</div><div class="prof-stat-l">승률</div></div>'
    +'<div class="prof-stat"><div class="prof-stat-n">'+rec.currentStreak+'</div><div class="prof-stat-l">현재 연승</div></div>'
    +'<div class="prof-stat"><div class="prof-stat-n" style="color:var(--amber)">'+rec.maxStreak+'</div><div class="prof-stat-l">최고 연승</div></div>'
    +'</div>'+partnerHtml
    +'<div class="stat-box-t" style="margin-top:14px">최근 경기</div>'+recentHtml
    +'</div>';
}
export function _buildProfileH2hSelectHtml(memberId){
  var m=members().find(function(x){return x.id===memberId;});
  if(!m)return '<option value="">상대 회원 선택</option>';
  var others=members().filter(function(x){return x.status!=='비활성'&&x.id!==m.id&&x.name;})
    .sort(function(a,b){return (a.name||'').localeCompare(b.name||'');});
  return '<option value="">상대 회원 선택</option>'
    +others.map(function(x){return '<option value="'+x.name+'">'+x.name+'</option>';}).join('');
}
export function _renderPlayerProfileHtml(id){
  var m=members().find(function(x){return x.id===id;});
  if(!m)return '';
  var rank=_getMemberRankPosition(m,true,true);
  var rec=_computeDoublesRecord(m.name);
  var recent=_getMatchesForMode(m.name,true).slice(0,10);
  var rw=0,rl=0;
  recent.forEach(function(c){
    if(_playerWonAnyMatch(c,m.name))rw++;else rl++;
  });
  var gr=_memberGrade(m);
  var act=_memberActivityMeta(m.name);
  var isSeason=getRkScope()==='season';
  var pt=_rankPointsForMember(m,true,isSeason);
  var dblGr=_calcGrade(_rankPointsForMember(m,true,isSeason));
  var indGr=_calcGrade(_rankPointsForMember(m,false,isSeason));
  var dblRec=_computeDoublesRecord(m.name);
  var indRec=_computeSinglesRecord(m.name);
  dblRec.matches=_getDoublesMatchesFor(m.name);
  indRec.matches=_getSinglesMatchesFor(m.name);
  var dblRank=_getMemberRankPosition(m,true,isSeason);
  var indRank=_getMemberRankPosition(m,false,isSeason);
  var partner=_computeTopPartner(m.name);
  var bestPartner=_computeBestWinRatePartner(m.name,5);
  var me=getMyPlayer();
  var aiShell=(me&&me.id!==id)?renderOpponentAiShellHtml():'';
  var badgesHtml=_buildMemberBadgesHtml(m.name);
  return '<div class="md-preview-hero">'
    +memberAv(m.name,avc(m.name),'md-preview-avatar')
    +'<div class="md-preview-name">'+m.name+'</div>'
    +_renderMemberPhoneHtml(m.phone,'md-preview-phone')
    +'<div class="md-preview-badges"><span class="badge '+gr.badge+'">'+gr.icon+' '+gr.label+'</span>'
    +'<span class="md-act '+act.cls+'">'+act.label+'</span></div>'
    +'<div class="md-preview-grades">🤝 '+dblGr.icon+' '+dblGr.label+' · 🏓 '+indGr.icon+' '+indGr.label+'</div>'
    +'</div>'
    +'<div class="md-preview-kpis">'
    +'<div class="md-preview-kpi"><span class="md-preview-kpi-val">'+(rank!=null?rank+'위':'—')+'</span><span class="md-preview-kpi-lbl">복식 랭킹</span></div>'
    +'<div class="md-preview-kpi"><span class="md-preview-kpi-val">'+pt.toLocaleString()+'</span><span class="md-preview-kpi-lbl">포인트</span></div>'
    +'<div class="md-preview-kpi"><span class="md-preview-kpi-val">'+rec.winRate+'%</span><span class="md-preview-kpi-lbl">승률</span></div>'
    +'<div class="md-preview-kpi"><span class="md-preview-kpi-val">'+rec.wins+'승 '+rec.losses+'패</span><span class="md-preview-kpi-lbl">복식</span></div>'
    +'</div>'
    +(recent.length?'<div class="md-preview-recent"><div class="md-preview-recent-t">최근 10경기</div><div class="md-preview-recent-v">'+rw+'승 '+rl+'패</div></div>':'')
    +aiShell
    +'<details class="player-prof-fold"><summary class="player-prof-fold__sum">🤝 복식 전적</summary><div class="player-prof-fold__body">'
    +_buildProfileModeBlock('🤝 복식',dblRec,dblRank,partner,true,bestPartner)
    +'</div></details>'
    +'<details class="player-prof-fold"><summary class="player-prof-fold__sum">🏓 단식 전적</summary><div class="player-prof-fold__body">'
    +_buildProfileModeBlock('🏓 단식',indRec,indRank,null,false,null)
    +'</div></details>'
    +'<details class="player-prof-fold"><summary class="player-prof-fold__sum">🏅 보유 배지</summary><div class="player-prof-fold__body">'
    +badgesHtml
    +'</div></details>'
    +'<details class="player-prof-fold"><summary class="player-prof-fold__sum">⚔️ 상대 전적</summary><div class="player-prof-fold__body">'
    +'<div class="fg player-prof-h2h-fg"><label>상대 회원 <span class="player-prof-h2h-hint">(단식·복식 통합)</span></label>'
    +'<select id="prof-opp" class="player-prof-h2h-sel" onchange="renderProfileH2H()">'
    +_buildProfileH2hSelectHtml(id)
    +'</select></div><div id="prof-h2h"></div></div></details>';
}
export function _refreshPlayerProfileIfOpen(){
  var mo=g('mo-player-profile');
  if(!mo||!mo.classList.contains('on')||!_profileMemberId)return;
  var sel=g('prof-opp');
  var savedOpp=sel?sel.value:'';
  var box=g('player-profile-content');
  if(box)box.innerHTML=_renderPlayerProfileHtml(_profileMemberId);
  if(savedOpp){
    var newSel=g('prof-opp');
    if(newSel)newSel.value=savedOpp;
    renderProfileH2H();
  }
  var me=getMyPlayer();
  if(me&&me.id!==_profileMemberId)hydrateOpponentAnalysis(_profileMemberId);
}
export function openPlayerProfile(id){
  var m=members().find(function(x){return x.id===id;});
  if(!m)return;
  _profileMemberId=id;
  _mdPreviewId=id;
  var box=g('player-profile-content');
  var actions=g('mo-player-profile')&&g('mo-player-profile').querySelector('.player-prof-actions');
  var instantBtn=g('player-prof-instant-btn');
  if(box)box.innerHTML=_renderPlayerProfileHtml(id);
  if(actions)actions.style.display='';
  var me=getMyPlayer();
  var isSelf=me&&me.id===id;
  if(instantBtn)instantBtn.style.display=isSelf?'none':'';
  var title=g('mo-player-profile')&&g('mo-player-profile').querySelector('.mt em');
  if(title)title.textContent=m.name;
  openMo('mo-player-profile');
  if(!isSelf)hydrateOpponentAnalysis(id);
};
export function openMyMemberProfile(){
  var id=getMyPlayerId();
  if(!id){toast('⚠️ 내 선수를 먼저 설정해주세요');return;}
  openPlayerProfile(id);
};
export function renderProfileH2H(){
  var m=members().find(function(x){return x.id===_profileMemberId;});
  var box=g('prof-h2h'),sel=g('prof-opp');
  if(!m||!box||!sel)return;
  var opp=sel.value;
  if(!opp){
    box.innerHTML='';
    return;
  }
  var h2h=_computeHeadToHead(m.name,opp);
  if(!h2h.total){
    box.innerHTML='<div class="stat-box" style="text-align:center;color:var(--t3);font-size:13px">두 회원 간 맞대결 기록이 없습니다</div>';
    return;
  }
  var recentHtml=h2h.recent.length?('<div class="stat-box-t" style="margin:12px 0 8px">최근 맞대결</div><div class="h2h-list">'
    +h2h.recent.map(function(r){
      var meta=r.type+(r.score?(' · '+r.score):'');
      return '<div class="h2h-item"><span style="color:var(--t3)">'+r.date+' · '+meta+'</span><span style="font-weight:700;color:var(--t1)">'+r.winner+' 승</span></div>';
    }).join('')+'</div>'):'';
  box.innerHTML='<div class="h2h-summary"><div style="font-size:15px;font-weight:800;margin-bottom:10px">상대전적 · '+m.name+' VS '+opp+'</div>'
    +'<div style="font-size:13px;color:var(--t2);margin-bottom:8px">총 '+h2h.total+'경기 (단식·복식 통합)</div>'
    +'<div class="h2h-scores"><span><span style="color:var(--a)">'+m.name+'</span> '+h2h.winsA+'승 '+h2h.lossesA+'패</span>'
    +'<span style="color:var(--t3)">|</span><span><span style="color:var(--blue)">'+opp+'</span> '+h2h.winsB+'승 '+h2h.lossesB+'패</span></div>'
    +'<div style="font-size:13px;font-weight:700;color:var(--t1);margin-top:10px">승률 '+h2h.rateA+'%</div>'
    +recentHtml;
};
export function _memberRowHash(m){
  var gr=_memberGrade(m);
  return m.id+'|'+(m.name||'')+'|'+(m.phone||'')+'|'+gr.label+'|'+_memberPt(m,false)+'|'+(m.gender||'')+'|'+(m.status||'')+'|'+(isAdmin()?'1':'0');
}
export function _buildMemberRowCells(m){
  var gr=_memberGrade(m);
  var adminActs=`<button class="btn btn-g btn-xs" onclick="openEdit('${m.id}')">✏️ 수정</button>`
    +(isAdmin()?`<button class="btn btn-d btn-xs" onclick="openDel('${m.id}')">🗑</button>`:'');
  return `<td data-label="이름" style="color:var(--t1)"><div style="display:flex;align-items:center;gap:8px">${memberAv(m.name,'av '+avc(m.name),'','width:34px;height:34px;font-size:13px')}<div><div style="font-weight:600">${m.name}</div>${m.phone?`<div style="font-size:11px;color:var(--t3)">${m.phone}</div>`:''}</div></div></td>
    <td data-label="등급"><span class="badge ${gr.badge}">${gr.icon} ${gr.label}</span></td>
    <td data-label="성별">${m.gender||'-'}</td>
    <td data-label="상태"><span class="badge ${m.status==='활성'?'bg':'br'}">${m.status||'활성'}</span></td>
    <td class="ta"><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-g btn-xs" onclick="openPlayerProfile('${m.id}')">📊 프로필</button>${adminActs}</div></td>`;
}

export function renderM(){
  var dir=g('members-directory');
  if(!dir)return;
  var q=(g('ms')&&g('ms').value||'').trim();
  var rows=_buildMemberRankList(true).filter(function(entry){
    var m=entry.m;
    if(m.status==='비활성')return false;
    if(!_matchMemberQuery(m,q))return false;
    if(_fg&&_memberGrade(m).label!==_fg)return false;
    return true;
  });
  rows=_filterMembersTab(rows,_mf);
  dir.innerHTML=_renderMemberDirectoryHtml(rows,q);
  var more=g('md-load-more');
  if(more)more.style.display=rows.length>_mdShowCount?'':'none';
}
export function _renderMemberCompareHtml(idA,idB){
  var ma=members().find(function(x){return x.id===idA;});
  var mb=members().find(function(x){return x.id===idB;});
  if(!ma||!mb)return '';
  var rankA=_getMemberRankPosition(ma,true,true),rankB=_getMemberRankPosition(mb,true,true);
  var ptA=_rankPointsForMember(ma,true,true),ptB=_rankPointsForMember(mb,true,true);
  var recA=_computeDoublesRecord(ma.name),recB=_computeDoublesRecord(mb.name);
  var h2h=_computeHeadToHead(ma.name,mb.name);
  function col(m,rank,pt,rec){
    return '<div class="md-cmp-col">'+memberAv(m.name,avc(m.name),'md-cmp-av')
      +'<div class="md-cmp-name">'+m.name+'</div>'
      +'<div class="md-cmp-stat"><span>랭킹</span><strong>'+(rank!=null?rank+'위':'—')+'</strong></div>'
      +'<div class="md-cmp-stat"><span>포인트</span><strong>'+pt.toLocaleString()+'</strong></div>'
      +'<div class="md-cmp-stat"><span>승률</span><strong>'+rec.winRate+'%</strong></div></div>';
  }
  var h2hHtml=h2h.total
    ?'<div class="md-cmp-h2h"><div class="md-cmp-h2h-t">상대전적</div><div class="md-cmp-h2h-sc">'
      +ma.name+' <strong>'+h2h.winsA+'승 '+h2h.lossesA+'패</strong> · '+mb.name+' <strong>'+h2h.winsB+'승 '+h2h.lossesB+'패</strong></div></div>'
    :'<div class="md-cmp-h2h md-cmp-h2h--empty">맞대결 기록 없음</div>';
  return '<div class="md-cmp">'+col(ma,rankA,ptA,recA)
    +'<div class="md-cmp-vs">VS</div>'+col(mb,rankB,ptB,recB)+'</div>'+h2hHtml;
}
export function setMf(tab){
  _mf=tab||'all';
  _mdShowCount=30;
  ['all','top10','active','recent','doubles'].forEach(function(t){
    var el=g('mf-'+t);
    if(el)el.classList.toggle('on',_mf===t);
  });
  renderM();
};
export function loadMoreMembers(){
  _mdShowCount+=30;
  renderM();
};
export function startInstantVsFromProfile(){
  if(!_profileMemberId&&!_mdPreviewId)return;
  startInstantVsMember(_profileMemberId||_mdPreviewId);
};
export function startInstantVsMember(id){
  if(!requireMyPlayer())return;
  var m=members().find(function(x){return x.id===id;});
  if(!m)return;
  closeMo('mo-player-profile');
  wizApplyOpponentName(m.name,false);
  window.nav('challenge');
  window.openInstantBS({keepTeams:true});
};
export function toggleMemberCompare(id){
  if(_mdCompareId===id){
    _mdCompareId=null;
    toast('비교 선택 해제');
  }else if(!_mdCompareId){
    _mdCompareId=id;
    var m=members().find(function(x){return x.id===id;});
    toast((m?m.name:'')+' 선택 · 다른 선수 VS로 비교');
  }else{
    var box=g('player-profile-content');
    var actions=g('mo-player-profile')&&g('mo-player-profile').querySelector('.player-prof-actions');
    if(box)box.innerHTML=_renderMemberCompareHtml(_mdCompareId,id);
    if(actions)actions.style.display='none';
    var title=g('mo-player-profile')&&g('mo-player-profile').querySelector('.mt em');
    if(title)title.textContent='비교';
    _mdPreviewId=null;
    _mdCompareId=null;
    _profileMemberId=null;
    openMo('mo-player-profile');
    return;
  }
  renderM();
};
export function filterM(val){
  var inp=g('ms');
  if(val!==undefined&&inp&&inp.value!==val)inp.value=val;
  clearTimeout(_mSearchTimer);
  _mSearchTimer=setTimeout(function(){
    _mdShowCount=30;
    renderM();
  },180);
};
export function filterG(gr){_fg=gr;renderM();}

function _vcfEscape(v) {
  return String(v == null ? '' : v)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** 선수 연락처 vCard(.vcf)보내기 */
export function exportMembersVcf() {
  var list = members().slice()
    .filter(function (m) { return String(m.phone || '').trim(); })
    .sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'ko'); });
  if (!list.length) {
    toast('⚠️보낼 연락처가 없습니다');
    return;
  }
  var blocks = list.map(function (m) {
    var name = _vcfEscape(m.name);
    var lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:' + name,
      'N:' + name + ';;;;',
      'TEL;TYPE=CELL:' + _phoneTel(m.phone),
      'ORG:이사탁'
    ];
    if (m.memo) lines.push('NOTE:' + _vcfEscape(m.memo));
    lines.push('END:VCARD');
    return lines.join('\r\n');
  });
  var vcf = blocks.join('\r\n') + '\r\n';
  var blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8;' });
  var a = document.createElement('a');
  var d = new Date();
  var fname = '이사탁_연락처_'
    + d.getFullYear()
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0')
    + '.vcf';
  a.href = URL.createObjectURL(blob);
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  toast('📇 연락처 ' + list.length + '명보내기 완료');
}

export function openAddModal(){
  requireAdmin(function(){
    ['rn','rp','rmemo'].forEach(id=>g(id).value='');
    g('rg').selectedIndex=0;
    ['e-rn'].forEach(id=>g(id).classList.remove('on'));
    g('af').style.display='';g('as').style.display='none';
    openMo('mo-add');setTimeout(()=>g('rn').focus(),200);
  });
}
export async function submitM(){
  if(!isAdmin()){toast('⚠️ 관리자만 회원을 등록할 수 있습니다');return;}
  const name=g('rn').value.trim();
  if(!name){g('e-rn').classList.add('on');return;}
  g('e-rn').classList.remove('on');
  const now=new Date();
  const m={name,phone:g('rp').value.trim(),gender:g('rg').value,individualPoint:PT_INIT,doublePoint:PT_INIT,status:'활성',memo:g('rmemo').value.trim(),joined:`${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}`,createdAt:now.toISOString()};
  g('af').style.display='none';g('asn').textContent=`${name} 회원님 환영합니다! 🏓`;g('as').style.display='';
  try{if(db())await addDoc(collection(db(),COL_MEMBERS),m);else{members().push({id:'l'+Date.now(),...m});renderM();}toast('✅ '+name+' 등록 완료');}
  catch(e){toast('❌ '+e.message);}
}
export function openEdit(id){
  const m=members().find(m=>m.id===id);if(!m)return;
  var gr=_memberGrade(m);
  g('eid').value=id;g('en').value=m.name;g('ep').value=m.phone||'';
  g('eg').value=m.gender||'';
  g('egr-disp').textContent=gr.icon+' '+gr.label;
  g('ept-disp').textContent=_memberPt(m,false)+'점';
  g('est').value=m.status||'활성';g('ememo').value=m.memo||'';
  g('e-en').classList.remove('on');openMo('mo-edit');
}
export async function saveEdit(){
  const id=g('eid').value,name=g('en').value.trim();
  if(!name){g('e-en').classList.add('on');return;}
  const u={name,phone:g('ep').value.trim(),gender:g('eg').value,status:g('est').value,memo:g('ememo').value.trim()};
  closeMo('mo-edit');
  try{if(db())await updateDoc(doc(db(),COL_MEMBERS,id),u);else{const i=members().findIndex(m=>m.id===id);if(i>-1)members()[i]={...members()[i],...u};renderM();}toast('✅ '+name+' 수정 완료');_refreshPlayerProfileIfOpen();}
  catch(e){toast('❌ '+e.message);}
}
export function openEditFromProfile(){
  if(_profileMemberId)openEdit(_profileMemberId);
}
export function openDel(id){
  if(!isAdmin()){requireAdmin(function(){openDel(id);});return;}
  setDelId(id);const m=members().find(m=>m.id===id);g('dm').textContent=`"${m?.name}" 회원을 삭제할까요?`;openMo('mo-del');
}
export async function confirmDel(){
  if(!isAdmin()){toast('⚠️ 관리자만 회원을 삭제할 수 있습니다');return;}
  const m=members().find(m=>m.id===getDelId());closeMo('mo-del');
  try{if(db())await deleteDoc(doc(db(),COL_MEMBERS,getDelId()));else{removeMemberLocal(getDelId());renderM();}toast('🗑 '+m?.name+' 삭제 완료');}
  catch(e){toast('❌ '+e.message);}
}

export function buildMemberRankList(isDbl) {
  return _buildMemberRankList(isDbl);
}
export function getRecommendedOpponents() {
  return _getRecommendedOpponents();
}

export function _getRecentPlayers() {
  try { return JSON.parse(localStorage.getItem('isatok_recent') || '[]'); }
  catch (e) { return []; }
}

export function _saveRecentPlayers(names) {
  var cur = _getRecentPlayers();
  (names || []).forEach(function (n) {
    if (!n) return;
    cur = cur.filter(function (x) { return x !== n; });
    cur.unshift(n);
  });
  try { localStorage.setItem('isatok_recent', JSON.stringify(cur.slice(0, 24))); }
  catch (e) {}
}
