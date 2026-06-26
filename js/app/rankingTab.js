/**
 * 랭킹 탭 렌더링·순위 스냅샷
 */
import { RANK_SNAPSHOT_KEY_PREFIX, PT_INIT, COLOR_GRAY } from './constants.js?v=2026.06.26.10';
import { getMyPlayerId } from './wizard.js?v=2026.06.26.10';
import { _memberPt, _calcGrade } from './memberCore.js?v=2026.06.26.10';
import { _memberGrade, avc, gradeAvatarStyle } from './memberUtils.js?v=2026.06.26.10';
import {
  _computeDoublesRecord, _computeSinglesRecord, _computeSeasonPoints, _rankPointsForMember,
  _getCurrentSeason, _seasonFilterFn,
  _getMatchesForMode, _playerWonAnyMatch, _playerWonMatch, _getRecentMatchLines,
  _buildCompetitionRankMap
} from './matchStats.js?v=2026.06.26.10';
import { _updateRkSeasonBar } from './seasons.js?v=2026.06.26.10';

let C = null;
let _rkMode = 'double';
let _rkScope = 'season';
let _rkGradeFilter = 'all';
let _rkLastList = null;
let _rkGradeChipBound = false;
let _previousPointMaps = {};
let _previousPointMapReady = {};

export function initRankingTab(ctx) {
  C = ctx;
  window.setRkScope = setRkScope;
  window.setRk = setRk;
  window.scrollToMyRankAnchor = scrollToMyRankAnchor;
}

function g(id) { return C.g(id); }
function members() { return C.getMembers(); }
function memberAv(name, cls, extra, style) { return C.memberAv(name, cls, extra, style); }
function renderEmptyState(icon, title, sub) { return C.renderEmptyState(icon, title, sub); }
function scrollToElement(el) { return C.scrollToElement(el); }

export function _rankSnapshotStorageKey(){
  return RANK_SNAPSHOT_KEY_PREFIX+'_'+_rkMode+'_'+_rkScope;
}
/**
 * 현재 랭킹 순위를 localStorage에 하루 1회 스냅샷으로 저장한다.
 * @param {Array<{m: object}>} rankList - 랭킹 목록(순위 순)
 */
export function saveRankSnapshot(rankList){
  var today=new Date().toDateString();
  var dateKey=_rankSnapshotStorageKey()+'_date';
  if(localStorage.getItem(dateKey)===today)return;
  var snapshot={};
  var rankMap=_buildCompetitionRankMap(rankList);
  rankList.forEach(function(item){snapshot[item.m.id]=rankMap[item.m.id];});
  try{
    localStorage.setItem(_rankSnapshotStorageKey(),JSON.stringify(snapshot));
    localStorage.setItem(dateKey,today);
  }catch(e){}
}
/**
 * 이전 스냅샷 대비 순위 변동량을 계산한다.
 * @param {string} memberId - 회원 ID
 * @param {number} currentRank - 현재 순위(1부터)
 * @returns {number|null} 양수=순위 상승, 음수=하락, null=비교 불가
 */
export function getRankChange(memberId,currentRank){
  try{
    var snapshot=JSON.parse(localStorage.getItem(_rankSnapshotStorageKey())||'{}');
    var prevRank=snapshot[memberId];
    if(!prevRank)return null;
    return prevRank-currentRank;
  }catch(e){
    return null;
  }
}
/**
 * 순위 변동량에 따른 ▲▼ 배지 HTML을 반환한다.
 * @param {number|null} change - getRankChange 반환값
 * @returns {string}
 */
export function getRankBadge(change){
  if(change===null||change===0)return '<span class="rk-change rk-change--flat">-</span>';
  if(change>0)return '<span class="rk-change rk-change--up">▲'+change+'</span>';
  return '<span class="rk-change rk-change--down">▼'+Math.abs(change)+'</span>';
}
export function _rankViewKey(){
  return _rkMode+'_'+_rkScope;
}
export function _getPointChange(memberId,currentPt){
  var key=_rankViewKey();
  if(!_previousPointMapReady[key])return null;
  var prev=_previousPointMaps[key];
  if(!prev||prev[memberId]===undefined)return null;
  var delta=currentPt-prev[memberId];
  if(delta===0)return null;
  return delta;
}
export function getPointBadge(change){
  if(change===null||change===0)return '';
  var cls=change>0?'rk-pt-change--up':'rk-pt-change--down';
  var sign=change>0?'+':'';
  return '<span class="rk-pt-change '+cls+'">'+sign+change+'pt</span>';
}
export function _syncPreviousPointMap(list){
  var key=_rankViewKey();
  var map={};
  list.forEach(function(item){map[item.m.id]=item.pt;});
  _previousPointMaps[key]=map;
  _previousPointMapReady[key]=true;
}
export function _hasRankingData(isDbl,season,isSeason){
  return members().some(function(m){
    if(m.status==='비활성')return false;
    var filterFn=isSeason&&season?_seasonFilterFn(season):null;
    var r=isDbl?_computeDoublesRecord(m.name,filterFn):_computeSinglesRecord(m.name,filterFn);
    return r.total>0;
  });
}
export function setRkScope(scope){
  _rkScope=scope;
  _rkGradeFilter='all';
  var all=g('rk-scope-all'),sn=g('rk-scope-season');
  if(all)all.classList.toggle('on',scope==='all');
  if(sn)sn.classList.toggle('on',scope==='season');
  var ptH=g('rk-pt-h');
  if(ptH)ptH.textContent=scope==='season'?'시즌 포인트':'포인트';
  renderR();
};
export function _renderHallOfFame(){
  var wrap=g('rk-hall-wrap'),box=g('rk-hall');
  if(!wrap||!box)return;
  wrap.style.display='';
  var isDbl=_rkMode==='double';
  var rows=members().filter(function(m){return m.status!=='비활성';}).map(function(m){
    var r=isDbl?_computeDoublesRecord(m.name):_computeSinglesRecord(m.name);
    return {name:m.name,max:r.maxStreak,cur:r.currentStreak};
  }).filter(function(x){return x.max>0;})
    .sort(function(a,b){return b.max-a.max||b.cur-a.cur||a.name.localeCompare(b.name);})
    .slice(0,3);
  if(!rows.length){
    box.innerHTML='<div style="text-align:center;padding:16px;color:var(--t3)">'+(isDbl?'복식':'단식')+' 연승 기록이 없습니다</div>';
    return;
  }
  box.innerHTML=rows.map(function(x,i){
    return '<div class="hall-row"><span class="hall-rank">'+(i+1)+'위</span><span class="hall-name">'+x.name+'</span><span class="hall-streak">'+x.max+'연승'+(x.cur>0?' · 🔥 '+x.cur:'')+'</span></div>';
  }).join('');
}
export function setRk(mode){
  _rkMode=mode;
  _rkGradeFilter='all';
  var ind=g('rk-ind'),dbl=g('rk-dbl');
  if(ind)ind.classList.toggle('on',mode==='individual');
  if(dbl)dbl.classList.toggle('on',mode==='double');
  renderR();
}
export function _rankRowHash(m,rank,pt,gr,streak,recentKey){
  return m.id+'|'+rank+'|'+(m.name||'')+'|'+gr.label+'|'+pt+'|'+streak+'|'+_rkScope+'|'+_rkMode+'|'+recentKey;
}
export function _streakForRankRow(m){
  var isDbl=_rkMode==='double';
  if(_rkScope==='season'){
    var season=_getCurrentSeason();
    if(!season)return 0;
    var rec=isDbl?_computeDoublesRecord(m.name,_seasonFilterFn(season)):_computeSinglesRecord(m.name,_seasonFilterFn(season));
    return rec.currentStreak;
  }
  var rec=isDbl?_computeDoublesRecord(m.name):_computeSinglesRecord(m.name);
  return rec.currentStreak;
}
export function _loadPreviousRankMap(){
  try{
    return JSON.parse(localStorage.getItem(_rankSnapshotStorageKey())||'{}');
  }catch(e){
    return {};
  }
}

var GRADE_CHIPS=[
  {key:'all',label:'전체',cls:'rank-chip--all'},
  {key:'master',label:'마스터',cls:'rank-chip--master'},
  {key:'pro',label:'고수',cls:'rank-chip--pro'},
  {key:'adv',label:'상급',cls:'rank-chip--adv'},
  {key:'mid',label:'중급',cls:'rank-chip--mid'},
  {key:'beg',label:'초급',cls:'rank-chip--beg'},
  {key:'nov',label:'입문',cls:'rank-chip--nov'}
];

export function gradeToClass(grade){
  var map={'마스터':'master','고수':'pro','상급':'adv','중급':'mid','초급':'beg','입문':'nov'};
  return map[grade]||'nov';
}
export function nameInitial(name){
  return name?name.slice(0,2):'??';
}
export function rankChangeMeta(diff){
  if(diff>0)return {text:'▲ '+diff,cls:'rank-row__chg--up'};
  if(diff<0)return {text:'▼ '+Math.abs(diff),cls:'rank-row__chg--down'};
  return {text:'—',cls:'rank-row__chg--same'};
}
export function _rankEntryToRowMember(entry){
  var gr=entry.gr||_memberGrade(entry.m);
  return {id:entry.m.id,name:entry.m.name,point:entry.pt,grade:gr.label};
}
export function _getMemberRankStats(member){
  var isDbl=_rkMode==='double';
  var filterFn=null;
  if(_rkScope==='season'){
    var season=_getCurrentSeason();
    if(season)filterFn=_seasonFilterFn(season);
  }
  var rec=isDbl?_computeDoublesRecord(member.name,filterFn):_computeSinglesRecord(member.name,filterFn);
  return {wins:rec.wins,total:rec.total};
}
export function _buildRankStreakMap(list){
  var map=new Map();
  var isDbl=_rkMode==='double';
  var filterFn=null;
  if(_rkScope==='season'){
    var season=_getCurrentSeason();
    if(season)filterFn=_seasonFilterFn(season);
  }
  list.forEach(function(item){
    var matches=_getMatchesForMode(item.m.name,isDbl,filterFn);
    var streak=_streakForRankRow(item.m);
    var type='none';
    if(matches.length&&streak>0){
      var wonFn=isDbl?function(c){return _playerWonAnyMatch(c,item.m.name);}:function(c){return _playerWonMatch(c,item.m.name);};
      type=wonFn(matches[0])?'win':'lose';
    }
    map.set(item.m.id,{count:streak,type:type});
  });
  return map;
}
export function renderRankPodium(top3,prevMap,rankMap){
  if(!top3||top3.length<3)return '';
  var myId=getMyPlayerId();
  var order=[top3[1],top3[0],top3[2]];
  var layoutSlots=[2,1,3];
  var itemsHtml=order.map(function(member,idx){
    var layoutSlot=layoutSlots[idx];
    var rank=rankMap[member.id];
    var prevRnk=prevMap[member.id]!=null?prevMap[member.id]:rank;
    var diff=prevRnk-rank;
    var chgMeta=rankChangeMeta(diff);
    var isFirst=rank===1;
    var anchorAttr=myId&&member.id===myId?' id="my-rank-anchor"':'';
    return '<div class="rank-podium__item rank-podium__item--'+layoutSlot+'"'+anchorAttr+'>'
      +(isFirst?'<div class="rank-podium__crown">🏆</div>':'')
      +memberAv(member.name,'','rank-podium__avatar')
      +'<div class="rank-podium__name">'+member.name+'</div>'
      +'<div class="rank-podium__pts">'+member.point.toLocaleString()+'pt</div>'
      +'<div class="rank-podium__chg '+chgMeta.cls+'">'+chgMeta.text+'</div>'
      +'<div class="rank-podium__base">'+rank+'위</div>'
      +'</div>';
  }).join('');
  return '<div class="rank-podium"><div class="rank-podium__row">'+itemsHtml+'</div></div>';
}
export function renderGradeChips(activeKey){
  return GRADE_CHIPS.map(function(c){
    var active=activeKey===c.key?' is-active':'';
    return '<div class="rank-chip '+c.cls+active+'" data-grade="'+c.key+'">'+c.label+'</div>';
  }).join('');
}
export function bindGradeChipEvents(chipsContainerId,onFilterChange){
  var container=g(chipsContainerId);
  if(!container||container.dataset.bound)return;
  container.dataset.bound='1';
  container.addEventListener('click',function(e){
    var chip=e.target.closest('.rank-chip');
    if(!chip)return;
    onFilterChange(chip.dataset.grade||'all');
  });
}
export function renderRankRow(member,rank,prevRank,myId,stats){
  var isMe=member.id===myId;
  var diff=prevRank-rank;
  var chgMeta=rankChangeMeta(diff);
  var gcls=gradeToClass(member.grade);
  var wins=stats?stats.wins:0;
  var total=stats?stats.total:0;
  var winPct=total>0?Math.round(wins/total*100):null;
  var winBar=winPct!==null
    ?'<div class="rank-row__win-line"><div class="rank-row__win-bar-wrap"><div class="rank-row__win-bar" style="width:'+winPct+'%"></div></div><span class="rank-row__win-pct">'+winPct+'%</span></div>'
    :'';
  var meBadge=isMe?'<span class="rank-row__me-badge">나</span>':'';
  var meRowCls=isMe?' rank-row--me':'';
  var mePtsCls=isMe?' rank-row__pts--me':'';
  var meNmCls=isMe?' rank-row__name--me':'';
  var numCls=rank<=3?' rank-row__num--top':'';
  var anchorId=isMe?'id="my-rank-anchor" ':'';
  return '<div class="rank-row'+meRowCls+'" '+anchorId+'data-member-id="'+member.id+'">'
    +'<div class="rank-row__num'+numCls+'">'+rank+'</div>'
    +memberAv(member.name,'','rank-row__avatar',gradeAvatarStyle(member.grade))
    +'<div class="rank-row__info"><div class="rank-row__name-line">'
    +'<span class="rank-row__name'+meNmCls+'">'+member.name+'</span>'+meBadge
    +'<span class="rank-row__grade-tag rank-row__grade-tag--'+gcls+'">'+member.grade+'</span></div>'+winBar+'</div>'
    +'<div class="rank-row__right"><div class="rank-row__pts'+mePtsCls+'">'+member.point.toLocaleString()+'pt</div>'
    +'<div class="rank-row__chg '+chgMeta.cls+'">'+chgMeta.text+'</div></div></div>';
}
export function renderStreakBanner(rankList,streakMap){
  var best=null;
  var bestCount=1;
  rankList.forEach(function(m){
    var s=streakMap.get(m.id);
    if(s&&s.type==='win'&&s.count>bestCount){
      bestCount=s.count;
      best=m;
    }
  });
  if(!best)return '';
  return '<div class="rank-streak-banner"><div class="rank-streak-banner__icon">🔥</div><div>'
    +'<div class="rank-streak-banner__title">'+best.name+' '+bestCount+'연승 달성!</div>'
    +'<div class="rank-streak-banner__sub">이번 시즌 최장 연승 기록</div></div></div>';
}
export function _filterRankListByGrade(list,gradeKey){
  if(gradeKey==='all')return list.length>=3?list.slice(3):list;
  return list.filter(function(item){
    var label=(item.gr||_memberGrade(item.m)).label;
    return gradeToClass(label)===gradeKey;
  });
}
export function _getGlobalRank(rankMap,memberId){
  return rankMap[memberId]||0;
}
export function _renderRankRowsList(displayList,rankMap,prevMap,myId,container){
  if(!container)return;
  if(!displayList.length){
    container.innerHTML='<div style="padding:24px;text-align:center;color:var(--t3)">'+(Object.keys(rankMap).length>=3?'해당 등급 선수가 없습니다':'')+'</div>';
    return;
  }
  container.innerHTML=displayList.map(function(entry){
    var rank=_getGlobalRank(rankMap,entry.m.id);
    var member=_rankEntryToRowMember(entry);
    var prevRank=prevMap[member.id]!=null?prevMap[member.id]:rank;
    var stats=_getMemberRankStats(entry.m);
    return renderRankRow(member,rank,prevRank,myId,stats);
  }).join('');
  if(!container.dataset.rowBound){
    container.dataset.rowBound='1';
    container.addEventListener('click',function(e){
      var row=e.target.closest('.rank-row');
      if(!row)return;
      var id=row.dataset.memberId;
      if(id)window.openPlayerProfile(id);
    });
  }
}
export function _clearRankUxSection(msg){
  var chips=g('rank-grade-chips');
  var podium=g('rank-podium-wrap');
  var banner=g('rank-streak-banner-wrap');
  var rows=g('rank-rows-list');
  var empty=g('rank-empty-msg');
  if(chips)chips.innerHTML='';
  if(podium){podium.innerHTML='';podium.style.display='';}
  if(banner){banner.innerHTML='';banner.style.display='';}
  if(rows)rows.innerHTML='';
  if(empty){
    empty.style.display=msg?'block':'none';
    empty.innerHTML=msg||'';
  }
}
export function _renderRankUxSection(list){
  _rkLastList=list;
  var rankMap=_buildCompetitionRankMap(list);
  var chipsEl=g('rank-grade-chips');
  var podiumEl=g('rank-podium-wrap');
  var bannerEl=g('rank-streak-banner-wrap');
  var rowsEl=g('rank-rows-list');
  var emptyEl=g('rank-empty-msg');
  if(!chipsEl||!rowsEl)return;
  if(emptyEl)emptyEl.style.display='none';
  var prevMap=_loadPreviousRankMap();
  var streakMap=_buildRankStreakMap(list);
  var myId=getMyPlayerId();
  var activeGrade=_rkGradeFilter||'all';
  chipsEl.innerHTML=renderGradeChips(activeGrade);
  var showExtras=activeGrade==='all';
  if(podiumEl){
    if(showExtras&&list.length>=3){
      var top3=list.slice(0,3).map(_rankEntryToRowMember);
      podiumEl.innerHTML=renderRankPodium(top3,prevMap,rankMap);
      podiumEl.style.display='';
    }else{
      podiumEl.innerHTML='';
      podiumEl.style.display='none';
    }
  }
  if(bannerEl){
    if(showExtras){
      var bannerMembers=list.map(_rankEntryToRowMember);
      bannerEl.innerHTML=renderStreakBanner(bannerMembers,streakMap);
      bannerEl.style.display=bannerEl.innerHTML?'':'none';
    }else{
      bannerEl.innerHTML='';
      bannerEl.style.display='none';
    }
  }
  var displayList=_filterRankListByGrade(list,activeGrade);
  _renderRankRowsList(displayList,rankMap,prevMap,myId,rowsEl);
  if(!_rkGradeChipBound){
    bindGradeChipEvents('rank-grade-chips',function(gradeKey){
      _rkGradeFilter=gradeKey;
      if(_rkLastList)_renderRankUxSection(_rkLastList);
    });
    _rkGradeChipBound=true;
  }
}
/**
 * 내 선수 경기 통계 (완료된 challenges 기준).
 * @param {string} myPlayerId - 회원 ID
 * @returns {{total: number, wins: number, currentStreak: number, streakType: string}}
 */
export function calcMyMatchStats(myPlayerId){
  var me=members().find(function(m){return m.id===myPlayerId;});
  if(!me)return {total:0,wins:0,currentStreak:0,streakType:'none'};
  var isDbl=_rkMode==='double';
  var filterFn=null;
  if(_rkScope==='season'){
    var season=_getCurrentSeason();
    if(season)filterFn=_seasonFilterFn(season);
  }
  var rec=isDbl?_computeDoublesRecord(me.name,filterFn):_computeSinglesRecord(me.name,filterFn);
  var matches=_getMatchesForMode(me.name,isDbl,filterFn);
  var streakType='none';
  var currentStreak=0;
  if(matches.length){
    var wonFn=isDbl?function(c){return _playerWonAnyMatch(c,me.name);}:function(c){return _playerWonMatch(c,me.name);};
    if(wonFn(matches[0])){
      streakType='win';
      currentStreak=rec.currentStreak;
    }else{
      var loseRun=0;
      for(var i=0;i<matches.length;i++){
        if(!wonFn(matches[i]))loseRun++;
        else break;
      }
      if(loseRun>0){
        streakType='lose';
        currentStreak=loseRun;
      }
    }
  }
  return {total:rec.total,wins:rec.wins,currentStreak:currentStreak,streakType:streakType};
}
/**
 * 내 순위 요약 카드 HTML.
 * @param {Array<{m: object, pt: number, gr: object}>} rankList
 * @param {string} myPlayerId
 * @param {object} previousRankMap - localStorage 순위 스냅샷
 * @param {{total: number, wins: number, currentStreak: number, streakType: string}} memberMatchStats
 * @returns {string}
 */
export function renderMyRankCard(rankList,myPlayerId,previousRankMap,memberMatchStats,rankMap){
  if(!myPlayerId)return '';
  var myRank=rankMap[myPlayerId];
  if(!myRank)return '';
  var meEntry=rankList.find(function(item){return item.m.id===myPlayerId;});
  if(!meEntry)return '';
  var me=meEntry.m;
  var hasSnapshot=previousRankMap&&Object.keys(previousRankMap).length>0&&previousRankMap[myPlayerId]!=null;
  var diff=hasSnapshot?previousRankMap[myPlayerId]-myRank:0;
  var badgeCls='my-rank-card__badge--same';
  var badgeTxt='— 0';
  var changeTxt='지난 주와 동일한 순위예요';
  var accentColor='#2A4A6E';
  var changeHtml='';
  if(hasSnapshot){
    if(diff>0){
      badgeCls='my-rank-card__badge--up';
      badgeTxt='▲ '+diff;
      changeTxt='지난 주보다 '+diff+'계단 올랐어요';
      accentColor='#007AFF';
    }else if(diff<0){
      badgeCls='my-rank-card__badge--down';
      badgeTxt='▼ '+Math.abs(diff);
      changeTxt='지난 주보다 '+Math.abs(diff)+'계단 내려갔어요';
      accentColor='#3A7BD5';
    }
    changeHtml='<div class="my-rank-card__change">'
      +'<span class="my-rank-card__badge '+badgeCls+'">'+badgeTxt+'</span>'
      +'<span class="my-rank-card__change-txt">'+changeTxt+'</span>'
      +'</div>';
  }
  var footerHint;
  if(myRank===1){
    footerHint='<b>🏆 현재 1위!</b> 자리를 지켜요';
  }else{
    var targetRank=null;
    rankList.forEach(function(item){
      var r=rankMap[item.m.id];
      if(r<myRank&&(targetRank===null||r>targetRank))targetRank=r;
    });
    var tierPt=null;
    if(targetRank!=null){
      rankList.forEach(function(item){
        if(rankMap[item.m.id]===targetRank)tierPt=item.pt;
      });
    }
    var gapPts=tierPt!=null?Math.max(0,tierPt-meEntry.pt):0;
    footerHint='위로 <b>'+targetRank+'위</b>까지 <b>'+gapPts.toLocaleString()+'pt</b> 남았어요';
  }
  var winRate=memberMatchStats.total?Math.round(memberMatchStats.wins/memberMatchStats.total*100)+'%':'—';
  var streakLbl=memberMatchStats.streakType==='win'?memberMatchStats.currentStreak+'연승'
    :memberMatchStats.streakType==='lose'?memberMatchStats.currentStreak+'연패'
    :memberMatchStats.currentStreak+'경기';
  var gr=meEntry.gr||_memberGrade(me);
  var avHtml=memberAv(me.name,'','my-rank-card__avatar');
  return '<div class="my-rank-card">'
    +'<div class="my-rank-card__accent" style="background:'+accentColor+'"></div>'
    +'<div class="my-rank-card__body">'
    +'<div class="my-rank-card__ghost">'+myRank+'위</div>'
    +'<div class="my-rank-card__eyebrow">MY RANKING</div>'
    +'<div class="my-rank-card__main">'
    +'<div class="my-rank-card__identity">'+avHtml
    +'<div class="my-rank-card__who"><div class="my-rank-card__name">'+me.name+'</div>'
    +'<span class="my-rank-card__grade">'+gr.icon+' '+gr.label+'</span></div></div>'
    +'<div class="my-rank-card__rank-block"><div class="my-rank-card__rank-num">'+myRank+'<span class="my-rank-card__rank-suf">위</span></div>'
    +'<div class="my-rank-card__pts">'+meEntry.pt.toLocaleString()+'<span class="my-rank-card__pts-unit">pt</span></div></div>'
    +'</div>'
    +changeHtml
    +'<div class="my-rank-card__stats">'
    +'<div class="my-rank-card__stat"><span class="my-rank-card__stat-val">'+memberMatchStats.total+'</span><span class="my-rank-card__stat-lbl">총 경기</span></div>'
    +'<div class="my-rank-card__stat"><span class="my-rank-card__stat-val">'+winRate+'</span><span class="my-rank-card__stat-lbl">승률</span></div>'
    +'<div class="my-rank-card__stat"><span class="my-rank-card__stat-val">'+streakLbl+'</span><span class="my-rank-card__stat-lbl">현재 연속</span></div>'
    +'</div></div>'
    +'<div class="my-rank-card__footer" onclick="scrollToMyRankAnchor()" role="button" tabindex="0">'
    +'<span class="my-rank-card__footer-hint">'+footerHint+'</span>'
    +'<span class="my-rank-card__footer-cta"><span class="my-rank-card__footer-cta-icon">↓</span> 내 순위로</span>'
    +'</div></div>';
}
export function _renderMyRankCardContainer(list){
  var box=g('my-rank-card-container');
  if(!box)return;
  var myId=getMyPlayerId();
  if(!myId||!list||!list.length){
    box.innerHTML='';
    return;
  }
  if(!list.some(function(item){return item.m.id===myId;})){
    box.innerHTML='';
    return;
  }
  box.innerHTML=renderMyRankCard(list,myId,_loadPreviousRankMap(),calcMyMatchStats(myId),_buildCompetitionRankMap(list));
}
export function scrollToMyRankAnchor(){
  var el=g('my-rank-anchor');
  if(el)scrollToElement(el);
};
export function _buildRankRecentHtml(m){
  var isDbl=_rkMode==='double';
  var isSeason=_rkScope==='season';
  var season=_getCurrentSeason();
  var filterFn=isSeason&&season?_seasonFilterFn(season):null;
  var lines=_getRecentMatchLines(m.name,isDbl,3,filterFn);
  if(!lines.length)return '';
  return '<div class="rk-recent">'+lines.map(function(r){
    return '<div class="rk-recent-line'+(r.won?' rk-recent-win':' rk-recent-loss')+'">'
      +'<span class="rk-recent-icon">'+r.icon+'</span>'
      +'<span class="rk-recent-score">'+(r.score||'-')+' '+r.result+'</span>'
      +'<span class="rk-recent-opp">vs '+r.opp+'</span>'
      +'<span class="rk-recent-date">'+r.date+'</span>'
      +'</div>';
  }).join('')+'</div>';
}

/* [BEFORE] legacy table row cells — replaced by renderRankRow()
export function _buildRankRowCells(m,rank,pt,grOpt){ ... }
export function _rankRowClass(rank){ ... }
*/

export function renderR(){
  var isDbl=_rkMode==='double';
  var isSeason=_rkScope==='season';
  var season=_getCurrentSeason();
  _updateRkSeasonBar(isSeason,season);
  if(isSeason&&!season){
    _clearRankUxSection('현재 시즌이 없습니다. 📅 시즌에서 생성해 주세요.');
    _renderMyRankCardContainer(null);
    _renderHallOfFame();
    return;
  }
  var list=members().filter(function(m){return m.status!=='비활성';})
    .map(function(m){
      var pt=_rankPointsForMember(m,isDbl,isSeason&&!!season);
      var gr=_calcGrade(pt);
      return {m:m,pt:pt,gr:gr};
    })
    .sort(function(a,b){return b.pt-a.pt||((a.m.name||'').localeCompare(b.m.name||''));});
  if(!list.length||!_hasRankingData(isDbl,season,isSeason)){
    var emptyMsg=isDbl
      ?renderEmptyState('🤝','복식 기록이 없어요','파트너와 함께 도전해보세요!')
      :renderEmptyState('🏆','아직 랭킹이 없어요','첫 대결을 시작해보세요!');
    _clearRankUxSection(emptyMsg);
    _renderMyRankCardContainer(null);
    _renderHallOfFame();
    return;
  }
  _renderRankUxSection(list);
  _renderMyRankCardContainer(list);
  _syncPreviousPointMap(list);
  saveRankSnapshot(list);
  _renderHallOfFame();
}
export function getRkMode() { return _rkMode; }
export function getRkScope() { return _rkScope; }
