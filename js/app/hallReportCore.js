/**
 * 명예의 전당·마이 리포트 공통 데이터·HTML 헬퍼
 */
import { PT_INIT } from './constants.js?v=2026.07.07.01';
import { _memberPt, _calcGrade, _renderGradeProgressHtml } from './memberCore.js?v=2026.07.07.01';
import {
  _getMatchesForMode, _playerWonAnyMatch, _playerWonMatch,
  _computeDoublesRecord, _computeSinglesRecord, _getMemberRankPosition,
  _computeRatingHistory, _computeBestWinRatePartner, _computeTopPartner,
  _buildRatingChartSvg, _getRecentMatchLines
} from './matchStats.js?v=2026.07.07.01';

let C = null;

export function initHallReportCore(ctx) {
  C = ctx;
}

function chal() { return C.getChal(); }
function members() { return C.getMembers(); }

export function calcRivalStats(myPlayerName){
  var rivalMap={};
  chal().forEach(function(match){
    if(match.status!=='completed')return;
    var myTeam=null;
    var my=match.myTeam||[];
    var opp=match.oppTeam||[];
    if(my.indexOf(myPlayerName)>=0)myTeam='a';
    else if(opp.indexOf(myPlayerName)>=0)myTeam='b';
    if(!myTeam)return;
    var isWin=match.winner===myTeam;
    var rivals=myTeam==='a'?opp:my;
    rivals.forEach(function(rivalName){
      if(!rivalName)return;
      if(!rivalMap[rivalName])rivalMap[rivalName]={win:0,lose:0};
      if(isWin)rivalMap[rivalName].win++;
      else rivalMap[rivalName].lose++;
    });
  });
  var rivalList=Object.keys(rivalMap).map(function(name){
    var s=rivalMap[name];
    return {name:name,win:s.win,lose:s.lose,total:s.win+s.lose};
  }).filter(function(r){return r.total>0;});
  if(!rivalList.length)return {mostWin:null,mostLose:null};
  var mostWin=rivalList.slice().sort(function(a,b){return b.win-a.win||b.total-a.total;})[0];
  var mostLose=rivalList.slice().sort(function(a,b){return b.lose-a.lose||b.total-a.total;})[0];
  return {mostWin:mostWin,mostLose:mostLose};
}
export function _renderRivalStatsHtml(myPlayerName,skipHead){
  var stats=calcRivalStats(myPlayerName);
  if(!stats.mostWin&&!stats.mostLose)return '';
  var lines=[];
  if(stats.mostWin&&stats.mostWin.win>0){
    lines.push('<div class="my-rival-row"><span class="my-rival-label">💪 자주 이긴 상대</span><strong>'+stats.mostWin.name+'</strong><span class="my-rival-rec">'+stats.mostWin.win+'승 '+stats.mostWin.lose+'패</span></div>');
  }
  if(stats.mostLose&&stats.mostLose.lose>0&&( !stats.mostWin||stats.mostLose.name!==stats.mostWin.name||stats.mostLose.lose>stats.mostWin.lose)){
    lines.push('<div class="my-rival-row"><span class="my-rival-label">🔥 라이벌</span><strong>'+stats.mostLose.name+'</strong><span class="my-rival-rec">'+stats.mostLose.win+'승 '+stats.mostLose.lose+'패</span></div>');
  }
  if(!lines.length)return '';
  var head=skipHead?'':'<div class="my-stat-head">주요 상대 전적</div>';
  return '<div class="my-rival-section">'+head+lines.join('')+'</div>';
}
export function _myDashStreak(me,isDbl){
  var matches=_getMatchesForMode(me.name,isDbl);
  if(!matches.length)return {label:'—',type:'none'};
  var wonFn=isDbl?function(c){return _playerWonAnyMatch(c,me.name);}:function(c){return _playerWonMatch(c,me.name);};
  if(wonFn(matches[0])){
    var rec=isDbl?_computeDoublesRecord(me.name):_computeSinglesRecord(me.name);
    return {label:rec.currentStreak+'연승',type:'win'};
  }
  var loseRun=0;
  for(var i=0;i<matches.length;i++){
    if(!wonFn(matches[i]))loseRun++;
    else break;
  }
  if(loseRun>0)return {label:loseRun+'연패',type:'lose'};
  return {label:'—',type:'none'};
}
export function _renderMyRecentMatchesHtml(playerName,isDbl,limit){
  var lines=_getRecentMatchLines(playerName,isDbl,limit||5);
  if(!lines.length){
    return '<div class="my-dash-empty-feed">아직 완료된 경기가 없어요</div>';
  }
  return lines.map(function(m){
    var cls=m.won?'my-dash-match--win':'my-dash-match--lose';
    return '<div class="my-dash-match '+cls+'">'
      +'<span class="my-dash-match__result">'+m.result+'</span>'
      +'<div class="my-dash-match__body"><div class="my-dash-match__opp">vs '+m.opp+'</div>'
      +(m.score?'<div class="my-dash-match__score">'+m.score+'</div>':'')
      +'</div><span class="my-dash-match__date">'+m.date+'</span></div>';
  }).join('');
}
export function _computeRecentForm(name,isDbl,limit){
  var matches=_getMatchesForMode(name,isDbl).slice(0,limit||8);
  var wonFn=isDbl?function(c){return _playerWonAnyMatch(c,name);}:function(c){return _playerWonMatch(c,name);};
  return matches.map(function(c){return wonFn(c)?'W':'L';});
}
export function _computeClubAvgWinRate(isDbl,minGames){
  minGames=minGames||1;
  var rates=members().filter(function(m){return m.status!=='비활성'&&m.name;}).map(function(m){
    var r=isDbl?_computeDoublesRecord(m.name):_computeSinglesRecord(m.name);
    return r.total>=minGames?r.winRate:null;
  }).filter(function(v){return v!=null;});
  if(!rates.length)return 50;
  return Math.round(rates.reduce(function(a,b){return a+b;},0)/rates.length);
}
export function _computePlayerInsights(me,isDbl,rec,clubAvg){
  var strengths=[],weaknesses=[];
  if(rec.total>=3&&rec.winRate>=clubAvg+8){
    strengths.push({icon:'🎯',title:'승률 우위',desc:rec.winRate+'% · 동호회 평균 '+clubAvg+'% 대비 우세'});
  }else if(rec.total>=5&&rec.winRate>=55){
    strengths.push({icon:'🎯',title:'안정적 승률',desc:rec.winRate+'% 승률 유지 중'});
  }
  if(rec.currentStreak>=3){
    strengths.push({icon:'🔥',title:'상승 모멘텀',desc:rec.currentStreak+'연승 · 최근 경기력 상승'});
  }else if(rec.maxStreak>=5){
    strengths.push({icon:'⚡',title:'연승 잠재력',desc:'최고 '+rec.maxStreak+'연승 기록 보유'});
  }
  var rival=calcRivalStats(me.name);
  if(rival.mostWin&&rival.mostWin.win>=2){
    strengths.push({icon:'💪',title:'강한 상대',desc:rival.mostWin.name+' 상대 '+rival.mostWin.win+'승 '+rival.mostWin.lose+'패'});
  }
  if(isDbl){
    var bestP=_computeBestWinRatePartner(me.name,3);
    if(bestP&&bestP.winRate>=55){
      strengths.push({icon:'🤝',title:'시너지 파트너',desc:bestP.name+' · '+bestP.count+'경기 · '+bestP.winRate+'% 승률'});
    }
    var topP=_computeTopPartner(me.name);
    if(topP.name&&topP.count>=3){
      strengths.push({icon:'👥',title:'단골 파트너',desc:topP.name+' · '+topP.count+'경기 함께'});
    }
  }
  var form=_computeRecentForm(me.name,isDbl,5);
  var recentWins=form.filter(function(f){return f==='W';}).length;
  if(form.length>=3&&recentWins<=1){
    weaknesses.push({icon:'📉',title:'최근 부진',desc:'최근 5경기 '+recentWins+'승 · 컨디션 회복 필요'});
  }
  if(rec.total>=5&&rec.winRate<clubAvg-10){
    weaknesses.push({icon:'📊',title:'승률 보완',desc:rec.winRate+'% · 동호회 평균 '+clubAvg+'% 미달'});
  }
  if(rival.mostLose&&rival.mostLose.lose>=2&&(!rival.mostWin||rival.mostLose.name!==rival.mostWin.name)){
    weaknesses.push({icon:'⚔️',title:'라이벌 상대',desc:rival.mostLose.name+' 상대 '+rival.mostLose.win+'승 '+rival.mostLose.lose+'패'});
  }
  if(rec.total>=3&&rec.currentStreak===0&&form.length&&form[0]==='L'){
    var loseRun=0;
    for(var i=0;i<form.length;i++){if(form[i]==='L')loseRun++;else break;}
    if(loseRun>=2)weaknesses.push({icon:'🧊',title:'연패 주의',desc:loseRun+'연패 · 전술·멘탈 점검'});
  }
  if(!strengths.length&&rec.total>0){
    strengths.push({icon:'🏓',title:'꾸준한 활동',desc:rec.total+'경기 출전 · 데이터 축적 중'});
  }
  if(!weaknesses.length&&rec.total>0){
    weaknesses.push({icon:'📌',title:'다음 목표',desc:'승률·연승 기록을 늘려 강점을 확장해보세요'});
  }
  return {strengths:strengths.slice(0,3),weaknesses:weaknesses.slice(0,3)};
}
export function _collectHallReportData(me,isDbl,recOpt){
  var rec=recOpt||(isDbl?_computeDoublesRecord(me.name):_computeSinglesRecord(me.name));
  var rank=_getMemberRankPosition(me,isDbl,true);
  var pt=_memberPt(me,isDbl);
  var gr=_calcGrade(pt);
  var streak=_myDashStreak(me,isDbl);
  var hist=_computeRatingHistory(me.name,isDbl);
  var form=_computeRecentForm(me.name,isDbl,8);
  var clubAvg=_computeClubAvgWinRate(isDbl,3);
  var insights=_computePlayerInsights(me,isDbl,rec,clubAvg);
  var activeCount=members().filter(function(m){return m.status!=='비활성';}).length;
  var topPct=rank&&activeCount>1?Math.max(1,Math.round((1-(rank-1)/activeCount)*100)):null;
  var ptDelta=hist.length>=2?hist[hist.length-1].points-hist[hist.length-2].points:0;
  return {rec:rec,rank:rank,pt:pt,gr:gr,streak:streak,hist:hist,form:form,clubAvg:clubAvg,insights:insights,topPct:topPct,ptDelta:ptDelta};
}
export function _buildFormStripHtml(form){
  if(!form.length)return '<div class="hall-form-empty">최근 경기 없음</div>';
  return '<div class="hall-form-strip">'+form.map(function(f,i){
    var cls=f==='W'?'hall-form-pill--win':'hall-form-pill--lose';
    return '<span class="hall-form-pill '+cls+' hall-form-pill--anim" style="animation-delay:'+(i*0.06)+'s" title="'+(f==='W'?'승':'패')+'">'+f+'</span>';
  }).join('')+'<span class="hall-form-hint">← 최근</span></div>';
}
export function _buildWinLossDonutSvg(wins,losses){
  var total=wins+losses;
  if(!total){
    return '<div class="hall-donut-empty">경기 없음</div>';
  }
  var winPct=wins/total;
  var r=42,cx=50,cy=50,circ=2*Math.PI*r;
  var winLen=circ*winPct;
  var lossLen=circ-winLen;
  var svg='<svg class="hall-donut-svg" viewBox="0 0 100 100" role="img" aria-label="승패 비율">'
    +'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--c3)" stroke-width="12"/>';
  if(losses>0){
    svg+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#FF453A" stroke-width="12" stroke-dasharray="'+lossLen+' '+winLen+'" stroke-dashoffset="0" transform="rotate(-90 '+cx+' '+cy+')" class="hall-donut-loss"/>';
  }
  if(wins>0){
    var offset=losses>0?-lossLen:0;
    svg+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#30D158" stroke-width="12" stroke-dasharray="'+winLen+' '+lossLen+'" stroke-dashoffset="'+offset+'" transform="rotate(-90 '+cx+' '+cy+')" class="hall-donut-win"/>';
  }
  svg+='<text x="'+cx+'" y="'+(cy-4)+'" text-anchor="middle" class="hall-donut-pct">'+Math.round(winPct*100)+'%</text>'
    +'<text x="'+cx+'" y="'+(cy+12)+'" text-anchor="middle" class="hall-donut-lbl">승률</text></svg>';
  return svg;
}
export function _renderHallInsightCardsHtml(insights){
  var str=insights.strengths.map(function(s){
    return '<div class="hall-insight hall-insight--up hall-insight--anim"><span class="hall-insight__icon">'+s.icon+'</span><div><div class="hall-insight__title">'+s.title+'</div><div class="hall-insight__desc">'+s.desc+'</div></div></div>';
  }).join('');
  var weak=insights.weaknesses.map(function(s){
    return '<div class="hall-insight hall-insight--down hall-insight--anim"><span class="hall-insight__icon">'+s.icon+'</span><div><div class="hall-insight__title">'+s.title+'</div><div class="hall-insight__desc">'+s.desc+'</div></div></div>';
  }).join('');
  return '<div class="hall-insight-grid"><div class="hall-insight-col"><div class="hall-insight-head">💪 강점</div>'+str+'</div>'
    +'<div class="hall-insight-col"><div class="hall-insight-head">🎯 보완점</div>'+weak+'</div></div>';
}
export function _renderHallPlayerReportHtml(me,isDbl,recOpt){
  var d=_collectHallReportData(me,isDbl,recOpt);
  var modeLbl=isDbl?'복식':'단식';
  var streakCls=d.streak.type==='win'?'hall-kpi__val--win':d.streak.type==='lose'?'hall-kpi__val--lose':'';
  var accent=d.streak.type==='win'?'#007AFF':d.streak.type==='lose'?'#FF453A':'#2A4A6E';
  var rankDisplay=d.rank!=null?d.rank:'—';
  var ptDeltaStr=d.ptDelta>0?'+'+d.ptDelta:d.ptDelta<0?''+d.ptDelta:'±0';
  var ptDeltaCls=d.ptDelta>0?'hall-kpi__val--win':d.ptDelta<0?'hall-kpi__val--lose':'';
  var topPctLbl=d.topPct?'상위 '+d.topPct+'%':'';
  var formWins=d.form.filter(function(f){return f==='W';}).length;
  var formRate=d.form.length?Math.round(formWins/d.form.length*100):0;
  return '<div class="hall-report">'
    +'<div class="hall-report__section hall-report__section--hero hall-anim" style="animation-delay:0s">'
    +'<div class="hall-hero"><div class="hall-hero__accent" style="background:'+accent+'"></div>'
    +'<div class="hall-hero__ghost">'+rankDisplay+'</div>'
    +'<div class="hall-hero__body">'
    +'<div class="hall-hero__eyebrow">PLAYER REPORT · '+modeLbl.toUpperCase()+'</div>'
    +'<div class="hall-hero__top">'
    +_memberAv(me.name,'','hall-hero__avatar',gradeAvatarStyle(d.gr.label))
    +'<div class="hall-hero__info"><div class="hall-hero__name">'+me.name+'</div>'
    +'<span class="hall-hero__grade">'+d.gr.icon+' '+d.gr.label+'</span>'
    +(topPctLbl?'<span class="hall-hero__pct">'+topPctLbl+'</span>':'')
    +'</div>'
    +'<div class="hall-hero__rank-block"><div class="hall-hero__rank">'+rankDisplay+'<span class="hall-hero__rank-suf">위</span></div>'
    +'<div class="hall-hero__pts">'+d.pt.toLocaleString()+'<span class="hall-hero__pts-unit">pt</span></div></div>'
    +'</div>'
    +'<div class="hall-kpi">'
    +'<div class="hall-kpi__item"><span class="hall-kpi__val">'+d.rec.total+'</span><span class="hall-kpi__lbl">경기</span></div>'
    +'<div class="hall-kpi__item"><span class="hall-kpi__val">'+d.rec.winRate+'%</span><span class="hall-kpi__lbl">승률</span></div>'
    +'<div class="hall-kpi__item"><span class="hall-kpi__val '+streakCls+'">'+d.streak.label+'</span><span class="hall-kpi__lbl">연속</span></div>'
    +'<div class="hall-kpi__item"><span class="hall-kpi__val '+ptDeltaCls+'">'+ptDeltaStr+'</span><span class="hall-kpi__lbl">최근 pt</span></div>'
    +'</div></div></div></div>'
    +'<div class="hall-report__section hall-anim" style="animation-delay:.06s">'
    +'<div class="hall-card"><div class="hall-card__head"><span class="hall-card__title">성장 추이</span><span class="hall-card__sub">레이팅 · '+modeLbl+'</span></div>'
    +'<div class="hall-chart-wrap">'+_buildRatingChartSvg(d.hist)+'</div>'
    +'<div class="rating-chart-note">경기 완료 순 포인트 재계산 (시작 '+PT_INIT+'pt)</div></div></div>'
    +'<div class="hall-report__grid hall-anim" style="animation-delay:.12s">'
    +'<div class="hall-card hall-card--half"><div class="hall-card__head"><span class="hall-card__title">승패 구성</span></div>'
    +'<div class="hall-donut-wrap">'+_buildWinLossDonutSvg(d.rec.wins,d.rec.losses)+'</div>'
    +'<div class="hall-wl-legend"><span class="hall-wl-legend__win">'+d.rec.wins+'승</span><span class="hall-wl-legend__lose">'+d.rec.losses+'패</span></div></div>'
    +'<div class="hall-card hall-card--half"><div class="hall-card__head"><span class="hall-card__title">최근 폼</span><span class="hall-card__sub">'+formRate+'%</span></div>'
    +_buildFormStripHtml(d.form)
    +'<div class="hall-form-meta">동호회 평균 승률 <strong>'+d.clubAvg+'%</strong></div></div></div>'
    +'<div class="hall-report__section hall-anim" style="animation-delay:.18s">'
    +'<div class="hall-card"><div class="hall-card__head"><span class="hall-card__title">강점 · 보완점</span><span class="hall-card__sub">AI 스타일 분석</span></div>'
    +_renderHallInsightCardsHtml(d.insights)+'</div></div>'
    +'<div class="hall-report__section hall-anim" style="animation-delay:.24s">'
    +'<div class="hall-card"><div class="hall-card__head"><span class="hall-card__title">최근 경기</span><span class="hall-card__sub">'+modeLbl+'</span></div>'
    +'<div class="hall-matches">'+_renderMyRecentMatchesHtml(me.name,isDbl,5)+'</div></div></div>'
    +(_renderGradeProgressHtml(_memberPt(me,false))?''
      +'<div class="hall-report__section hall-anim" style="animation-delay:.3s"><div class="hall-card">'
      +'<div class="hall-card__head"><span class="hall-card__title">등급 진행</span><span class="hall-card__sub">단식</span></div>'
      +_renderGradeProgressHtml(_memberPt(me,false))+'</div></div>':'')
    +'</div>';
}