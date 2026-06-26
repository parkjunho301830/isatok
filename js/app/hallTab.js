/**
 * 통계 탭 (명예의 전당) 렌더링
 */
import { PT_INIT } from './constants.js?v=2026.06.26.10';
import { getMyPlayer } from './wizard.js?v=2026.06.26.10';
import {
  _computeDoublesRecord, _computeSinglesRecord, _getMemberRankPosition,
  _computeTopPartner, _computeBestWinRatePartner, _countTournamentWins,
  _computeRatingHistory, _buildRatingChartSvg
} from './matchStats.js?v=2026.06.26.10';
import { _memberPt } from './memberCore.js?v=2026.06.26.10';
import { _computeClubAvgWinRate, _renderMyRecentMatchesHtml } from './hallReportCore.js?v=2026.06.26.10';
import {
  renderMonthlyStoryShellHtml, updateMonthlyStoryCard,
  loadMonthlyStoryCache, saveMonthlyStoryCache, fetchMonthlyClubStory,
  getKstMonthKey, formatMonthLabel, yieldToPaint
} from './aiCoach.js?v=2026.06.26.10';

let C = null;
let _monthlyStoryReqId = 0;
let _monthlyHydrateInflight = null;

export function initHallTab(ctx) {
  C = ctx;
  window.setHallMode = setHallMode;
  window.refreshMonthlyStory = refreshMonthlyStory;
}

function g(id) { return C.g(id); }
function members() { return C.getMembers(); }
function chal() { return C.getChal(); }
function seasons() { return C.getSeasons(); }
function getHallMode() { return C.getHallMode(); }
function setHallModeState(mode) { C.setHallMode(mode); }
function renderEmptyState(icon, title, desc) { return C.renderEmptyState(icon, title, desc); }

export function _hallTop10(rows,valueFn){
  if(!rows.length){
    return '<div class="hall-lb-empty">기록 없음</div>';
  }
  return '<div class="hall-lb-list">'+rows.slice(0,10).map(function(x,i){
    var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    return '<div class="hall-row hall-row--anim" style="animation-delay:'+(i*0.04)+'s">'
      +'<span class="hall-rank">'+(medal||((i+1)+'위'))+'</span>'
      +'<span class="hall-name">'+x.name+'</span>'
      +'<span class="hall-streak">'+valueFn(x)+'</span></div>';
  }).join('')+'</div>';
}
export function _buildHallMemberRows(mapFn){
  return members().filter(function(m){return m.status!=='비활성'&&m.name;})
    .map(function(m){return mapFn(m);})
    .filter(function(x){return x&&x.value>0;})
    .sort(function(a,b){return b.value-a.value||a.name.localeCompare(b.name);});
}
export function _buildHallLeaderboardCats(isDbl){
  var modeLbl=isDbl?'복식':'단식';
  var winsRows=_buildHallMemberRows(function(m){
    var r=isDbl?_computeDoublesRecord(m.name):_computeSinglesRecord(m.name);
    return {name:m.name,value:r.wins};
  });
  var rateRows=_buildHallMemberRows(function(m){
    var r=isDbl?_computeDoublesRecord(m.name):_computeSinglesRecord(m.name);
    if(r.total<10)return null;
    return {name:m.name,value:r.winRate,extra:r.total+'경기'};
  });
  var streakRows=_buildHallMemberRows(function(m){
    var r=isDbl?_computeDoublesRecord(m.name):_computeSinglesRecord(m.name);
    return {name:m.name,value:r.maxStreak};
  });
  var gamesRows=_buildHallMemberRows(function(m){
    var r=isDbl?_computeDoublesRecord(m.name):_computeSinglesRecord(m.name);
    return {name:m.name,value:r.total};
  });
  var partnerRows=_buildHallMemberRows(function(m){
    if(!isDbl)return null;
    var p=_computeTopPartner(m.name);
    if(!p.name)return null;
    return {name:m.name+' / '+p.name,value:p.count,extra:m.name+' 기준'};
  });
  var bestPartnerRows=_buildHallMemberRows(function(m){
    if(!isDbl)return null;
    var p=_computeBestWinRatePartner(m.name,5);
    if(!p)return null;
    return {name:m.name+' / '+p.name,value:p.winRate,extra:p.count+'경기'};
  });
  var tourRows=_buildHallMemberRows(function(m){
    return {name:m.name,value:_countTournamentWins(m.name)};
  });
  var seasonRows={};
  seasons().filter(function(s){return s.status==='ended'&&s.champion&&s.champion.name;}).forEach(function(s){
    var nm=s.champion.name;
    seasonRows[nm]=(seasonRows[nm]||0)+1;
  });
  var seasonList=Object.keys(seasonRows).map(function(nm){return {name:nm,value:seasonRows[nm]};})
    .sort(function(a,b){return b.value-a.value||a.name.localeCompare(b.name);});
  var cats=[
    {title:'🏆 '+modeLbl+' 최다승',rows:winsRows,fn:function(x){return x.value+'승';}},
    {title:'🏆 '+modeLbl+' 최고승률',rows:rateRows,fn:function(x){return x.value+'%'+(x.extra?' · '+x.extra:'');}},
    {title:'🔥 '+modeLbl+' 최다연승',rows:streakRows,fn:function(x){return x.value+'연승';}},
    {title:'⚔️ '+modeLbl+' 최다경기',rows:gamesRows,fn:function(x){return x.value+'경기';}}
  ];
  if(isDbl){
    cats.push({title:'🤝 최다 파트너',rows:partnerRows,fn:function(x){return x.value+'경기';}});
    cats.push({title:'🤝 최고 승률 파트너',rows:bestPartnerRows,fn:function(x){return x.value+'%'+(x.extra?' · '+x.extra:'');},note:'최소 5경기'});
  }
  cats.push({title:'🏆 토너먼트 우승',rows:tourRows,fn:function(x){return x.value+'회';}});
  cats.push({title:'👑 시즌 우승',rows:seasonList,fn:function(x){return x.value+'회';}});
  return cats;
}
export function _renderHallLeaderboardsHtml(isDbl){
  var cats=_buildHallLeaderboardCats(isDbl);
  if(!cats.some(function(cat){return cat.rows.length>0;})){
    return '';
  }
  return '<details class="hall-lb hall-anim" style="animation-delay:.36s" open>'
    +'<summary class="hall-lb__toggle"><span class="hall-lb__toggle-title">🏛️ 명예의 전당</span><span class="hall-lb__toggle-sub">TOP10 기록</span></summary>'
    +'<div class="hall-lb__body">'+cats.map(function(cat){
      if(!cat.rows.length)return '';
      var noteHtml=cat.note?('<div class="hall-lb-note">'+cat.note+'</div>'):'';
      return '<div class="hall-lb-card"><div class="hall-cat-t">'+cat.title+'</div>'+noteHtml+_hallTop10(cat.rows,cat.fn)+'</div>';
    }).join('')+'</div></details>';
}
export function _renderHallClubOverviewHtml(isDbl){
  var modeLbl=isDbl?'복식':'단식';
  var activeMembers=members().filter(function(m){return m.status!=='비활성';});
  var clubAvg=_computeClubAvgWinRate(isDbl,3);
  var totalGames=0,activePlayers=0;
  activeMembers.forEach(function(m){
    var r=isDbl?_computeDoublesRecord(m.name):_computeSinglesRecord(m.name);
    if(r.total>0){activePlayers++;totalGames+=r.total;}
  });
  var me=getMyPlayer();
  var myRank=null,myRec=null,myWr='—',cmpHtml='';
  if(me){
    myRec=isDbl?_computeDoublesRecord(me.name):_computeSinglesRecord(me.name);
    myRank=_getMemberRankPosition(me,isDbl,true);
    myWr=myRec.total?myRec.winRate+'%':'—';
    if(myRec.total>0){
      var diff=myRec.winRate-clubAvg;
      var cmpLbl=diff>0?'동호회 평균보다 <strong>+'+diff+'%p</strong>':diff<0?'동호회 평균보다 <strong>'+diff+'%p</strong>':'동호회 평균과 <strong>동일</strong>';
      cmpHtml='<div class="hall-club-cmp">내 승률 '+myWr+' · '+cmpLbl+'</div>';
    }
  }
  return '<div class="hall-club-overview hall-anim" style="animation-delay:0s">'
    +'<div class="hall-card"><div class="hall-card__head"><span class="hall-card__title">🏛️ 동호회 현황</span><span class="hall-card__sub">'+modeLbl+' · 시즌</span></div>'
    +'<div class="hall-club-stats">'
    +'<div class="hall-club-stat"><span class="hall-club-stat__val">'+activeMembers.length+'</span><span class="hall-club-stat__lbl">등록 선수</span></div>'
    +'<div class="hall-club-stat"><span class="hall-club-stat__val">'+activePlayers+'</span><span class="hall-club-stat__lbl">활동 선수</span></div>'
    +'<div class="hall-club-stat"><span class="hall-club-stat__val">'+totalGames+'</span><span class="hall-club-stat__lbl">총 경기</span></div>'
    +'<div class="hall-club-stat"><span class="hall-club-stat__val">'+clubAvg+'%</span><span class="hall-club-stat__lbl">평균 승률</span></div>'
    +'</div>'
    +(me?'<div class="hall-club-me"><span>'+me.name+'</span> · '+(myRank!=null?myRank+'위':'—')+' · '+myWr+cmpHtml+'</div>'
      +'<button type="button" class="btn btn-g btn-sm hall-club-me-btn" onclick="nav(\'my\')">📊 내 코칭 리포트 보기</button>':'')
    +'</div></div>';
}
export function _renderHallRatingChartHtml(me,isDbl){
  var modeLbl=isDbl?'복식':'단식';
  if(!me||!me.name){
    return '<div class="hall-report__section hall-anim" style="animation-delay:.02s"><div class="hall-card">'
      +'<div class="hall-card__head"><span class="hall-card__title">📈 레이팅 변화 추이</span></div>'
      +'<div class="rating-chart-empty">마이페이지에서 내 선수를 설정하면 그래프가 표시됩니다.</div></div></div>';
  }
  var hist=_computeRatingHistory(me.name,isDbl);
  return '<div class="hall-report__section hall-anim" style="animation-delay:.02s"><div class="hall-card">'
    +'<div class="hall-card__head"><span class="hall-card__title">📈 '+modeLbl+' 레이팅 변화 추이</span>'
    +'<span class="hall-card__sub">'+me.name+'</span></div>'
    +'<div class="hall-chart-wrap">'+_buildRatingChartSvg(hist)+'</div>'
    +'<div class="rating-chart-note">경기 완료 순 포인트 재계산 (시작 '+PT_INIT+'pt)</div></div></div>';
}
export function renderHall(){
  var box=g('hall-content');
  if(!box)return;
  var isDbl=getHallMode()==='double';
  var me=getMyPlayer();
  var ratingHtml=_renderHallRatingChartHtml(me,isDbl);
  var overviewHtml=_renderHallClubOverviewHtml(isDbl);
  var lbHtml=_renderHallLeaderboardsHtml(isDbl);
  if(!lbHtml&&!overviewHtml){
    box.innerHTML=renderMonthlyStoryShellHtml()+ratingHtml
      +(isDbl
      ?renderEmptyState('📈','복식 통계가 없어요','복식 경기를 완료하면 통계가 생겨요')
      :renderEmptyState('📊','통계 데이터가 없어요','대결 결과가 쌓이면 자동으로 표시돼요'));
    if(typeof requestAnimationFrame==='function'){
      requestAnimationFrame(function(){_hydrateMonthlyClubStory(false);});
    }else{
      _hydrateMonthlyClubStory(false);
    }
    return;
  }
  if(!me){
    box.innerHTML=renderMonthlyStoryShellHtml()+ratingHtml+overviewHtml+lbHtml
      +'<div class="hall-report hall-report--empty hall-anim"><div class="hall-setup-card">'
      +'<div class="hall-setup-icon">👤</div><div class="hall-setup-title">내 선수를 설정하세요</div>'
      +'<p class="hall-setup-desc">설정 후 마이 탭에서 AI 코칭 리포트를 확인할 수 있어요.</p>'
      +'<button type="button" class="btn btn-p" onclick="openMyPlayerSetup(true)">🏓 내 선수 설정</button></div></div>';
    if(typeof requestAnimationFrame==='function'){
      requestAnimationFrame(function(){_hydrateMonthlyClubStory(false);});
    }else{
      _hydrateMonthlyClubStory(false);
    }
    return;
  }
  box.innerHTML=renderMonthlyStoryShellHtml()+ratingHtml+overviewHtml+lbHtml;
  if(typeof requestAnimationFrame==='function'){
    requestAnimationFrame(function(){_hydrateMonthlyClubStory(false);});
  }else{
    _hydrateMonthlyClubStory(false);
  }
}
export function setHallMode(mode){
  setHallModeState(mode);
  var dbl=g('hall-dbl'),ind=g('hall-ind');
  if(dbl)dbl.classList.toggle('on',mode==='double');
  if(ind)ind.classList.toggle('on',mode==='individual');
  renderHall();
};
export function _monthDateFilter(monthKey){
  return function(c){
    var d=c.date||'';
    if(!d&&c.createdAt)d=c.createdAt.slice(0,7);
    else if(d)d=d.slice(0,7);
    return d===monthKey;
  };
}
export function _buildMonthlyClubSummary(monthKey){
  var inMonth=_monthDateFilter(monthKey);
  var completed=chal().filter(function(c){return c.status==='completed'&&inMonth(c);});
  var active=members().filter(function(m){return m.status!=='비활성';});
  var topByPt=active.slice().sort(function(a,b){return _memberPt(b,true)-_memberPt(a,true);}).slice(0,5);
  var topStreak=active.map(function(m){
    var r=_computeDoublesRecord(m.name,inMonth);
    return {name:m.name,max:r.maxStreak,wins:r.wins,total:r.total};
  }).filter(function(x){return x.total>0;}).sort(function(a,b){return b.max-a.max||b.wins-a.wins;}).slice(0,3);
  var lines=[
    '기간: '+formatMonthLabel(monthKey),
    '완료 경기 수: '+completed.length,
    '활동 회원: '+active.length+'명',
    '포인트 TOP5: '+topByPt.map(function(m,i){return (i+1)+'위 '+m.name+' '+_memberPt(m,true)+'pt';}).join(', ')
  ];
  if(topStreak.length)lines.push('이달 연승: '+topStreak.map(function(x){return x.name+' '+x.max+'연승 ('+x.wins+'승/'+x.total+'경기)';}).join(', '));
  return lines.join('\n');
}
async function _hydrateMonthlyClubStory(forceRefresh){
  if(!forceRefresh&&_monthlyHydrateInflight)return _monthlyHydrateInflight;
  var run=_hydrateMonthlyClubStoryCore(forceRefresh).finally(function(){
    if(_monthlyHydrateInflight===run)_monthlyHydrateInflight=null;
  });
  if(!forceRefresh)_monthlyHydrateInflight=run;
  return run;
}
async function _hydrateMonthlyClubStoryCore(forceRefresh){
  if(!g('hall-monthly-story-card'))return;
  var monthKey=getKstMonthKey();
  var monthLbl=formatMonthLabel(monthKey);
  var cached=loadMonthlyStoryCache(monthKey);
  if(!forceRefresh&&cached){
    updateMonthlyStoryCard('ready',{monthLabel:monthLbl,story:cached});
    return;
  }
  var inMonth=_monthDateFilter(monthKey);
  var matchCount=chal().filter(function(c){return c.status==='completed'&&inMonth(c);}).length;
  if(!matchCount){
    updateMonthlyStoryCard('empty',{monthLabel:monthLbl});
    return;
  }
  var reqId=++_monthlyStoryReqId;
  updateMonthlyStoryCard('loading',{
    monthLabel:monthLbl,
    message:forceRefresh?'스토리 새로고침 중…':'이달의 이야기 작성 중…',
    preserveContent:!!(forceRefresh&&cached)
  });
  await yieldToPaint();
  var summary=_buildMonthlyClubSummary(monthKey);
  try{
    var story=await fetchMonthlyClubStory(monthLbl,summary);
    if(reqId!==_monthlyStoryReqId)return;
    saveMonthlyStoryCache(monthKey,story);
    updateMonthlyStoryCard('ready',{monthLabel:monthLbl,story:story});
  }catch(e){
    if(reqId!==_monthlyStoryReqId)return;
    if(cached){
      updateMonthlyStoryCard('ready',{monthLabel:monthLbl,story:cached,stale:true});
      return;
    }
    updateMonthlyStoryCard('error',{monthLabel:monthLbl});
  }
}
export function refreshMonthlyStory(force){_hydrateMonthlyClubStory(!!force);}