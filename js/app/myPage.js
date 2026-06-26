/**
 * 마이 탭 대시보드·AI 코칭 hydrate·경기 결과 피드백
 */
import {
  PT_INDIVIDUAL_WIN, PT_INDIVIDUAL_LOSS, PT_DOUBLE_WIN, PT_DOUBLE_LOSS,
  PT_INIT, COLOR_PRIMARY, COLOR_SUCCESS, COLOR_DANGER, FEEDBACK_AUTO_CLOSE_MS
} from './constants.js?v=2026.06.26.10';
import {
  buildTodayFortune, buildRecommendReason, buildPostMatchComment,
  buildClubCompareLine, getGradeNudge, buildTodayPicks, kstDateKey
} from './coaching.js?v=2026.06.26.10';
import {
  getKstWeekStartKey, formatWeekLabel,
  loadWeeklyReportCache, saveWeeklyReportCache, fetchWeeklyCoachReport,
  updateWeeklyReportCard, renderWeeklyReportShellHtml
} from './weeklyReport.js?v=2026.06.26.10';
import {
  fetchPostMatchComment, fetchDailyBriefing, fetchOpponentAnalysis,
  loadPostMatchCache, savePostMatchCache,
  loadDailyBriefingCache, saveDailyBriefingCache,
  loadOpponentAiCache, saveOpponentAiCache,
  updateDailyBriefingCard, updateOpponentAiCard,
  formatPostMatchComment, renderDailyBriefingShellHtml, yieldToPaint
} from './aiCoach.js?v=2026.06.26.10';
import { getMyPlayer } from './wizard.js?v=2026.06.26.10';
import { registerOverlay, unregisterOverlay } from './backNav.js?v=2026.06.26.10';

const FEEDBACK_BACK_KEY = 'feedback';
import { _isDoublesType, _memberPt, _calcGrade, _renderGradeProgressHtml } from './memberCore.js?v=2026.06.26.10';
import {
  _getMatchesForMode, _playerWonAnyMatch, _playerWonMatch,
  _computeDoublesRecord, _computeSinglesRecord, _computeMemberBadges,
  _computeBestWinRatePartner, _getMemberRankPosition, _computeHeadToHead,
  _buildRatingChartSvg
} from './matchStats.js?v=2026.06.26.10';
import {
  calcRivalStats, _renderRivalStatsHtml, _myDashStreak, _renderMyRecentMatchesHtml,
  _collectHallReportData, _computeClubAvgWinRate, _computeRecentForm,
  _buildWinLossDonutSvg, _buildFormStripHtml, _renderHallInsightCardsHtml
} from './hallReportCore.js?v=2026.06.26.10';

const PT = {
  individual: { win: PT_INDIVIDUAL_WIN, loss: PT_INDIVIDUAL_LOSS },
  double: { win: PT_DOUBLE_WIN, loss: PT_DOUBLE_LOSS }
};

let C = null;
let _weeklyReportReqId = 0;
let _dailyBriefingReqId = 0;
let _opponentAiReqId = 0;
let _dailyHydrateInflight = null;
let _weeklyHydrateInflight = null;
/** @type {Map<string, Promise<void>>} */
var _opponentHydrateInflight = new Map();

export function initMyPage(ctx) {
  C = ctx;
  window.setMyDashMode = setMyDashMode;
  window.refreshWeeklyReport = refreshWeeklyReport;
  window.refreshDailyBriefing = refreshDailyBriefing;
}

function g(id) { return C.g(id); }
function members() { return C.getMembers(); }
function chal() { return C.getChal(); }
function getMyDashMode() { return C.getMyDashMode(); }
function setMyDashModeState(mode) { C.setMyDashMode(mode); }
function memberAv(name, cls, extra, style) { return C.memberAv(name, cls, extra, style); }
function gradeAvatarStyle(label) { return C.gradeAvatarStyle(label); }
function getRecommendedOpponents() { return C.getRecommendedOpponents(); }
function renderMyPage() { return C.renderMyPage(); }

export function _renderMyExtrasHtml(){
  var me=getMyPlayer();
  if(!me)return '';
  return _renderRivalStatsHtml(me.name)+_renderGradeProgressHtml(_memberPt(me,false));
}
export function _renderMyBadgesScrollHtml(name){
  var badges=_computeMemberBadges(name);
  if(!badges.length){
    return '<div class="my-dash-badge-empty">첫 승리 후 배지를 모아보세요</div>';
  }
  return '<div class="my-dash-badge-scroll">'+badges.map(function(b){
    return '<div class="my-dash-badge" title="'+b.desc+'"><span class="my-dash-badge__icon">'+b.icon+'</span><span class="my-dash-badge__lbl">'+b.label+'</span></div>';
  }).join('')+'</div>';
}
export function _buildAiCoachingLine(d,rival){
  var rec=d.rec,streak=d.streak;
  if(rec.currentStreak>=3){
    return {icon:'🔥',text:rec.currentStreak+'연승 중! 이 흐름을 이어가 보세요.'};
  }
  if(streak.type==='lose'){
    var n=parseInt(streak.label,10);
    if(n>=2)return {icon:'🧊',text:'최근 '+streak.label+' · 안정적인 상대와 경기해 흐름을 바꿔보세요.'};
  }
  if(rival.mostLose&&rival.mostLose.lose>=2){
    return {icon:'⚔️',text:rival.mostLose.name+' 상대 주의 · '+rival.mostLose.win+'승 '+rival.mostLose.lose+'패'};
  }
  if(d.insights.strengths[0]){
    var s=d.insights.strengths[0];
    return {icon:s.icon,text:s.title+' — '+s.desc};
  }
  if(d.insights.weaknesses[0]){
    var w=d.insights.weaknesses[0];
    return {icon:'🎯',text:w.title+' — '+w.desc};
  }
  return {icon:'🏓',text:'경기를 쌓을수록 맞춤 코칭이 정확해집니다.'};
}
export function _renderMyWeeklyMissionHtml(rec,rank){
  var items=[];
  if(rec.total<5){
    items.push({icon:'🎯',title:'5경기 챌린지',desc:(5-rec.total)+'경기 더 참여',pct:Math.round(rec.total/5*100)});
  }
  if(rank&&rank>1){
    items.push({icon:'🏆',title:'랭킹 도전',desc:(rank-1)+'위 추월 목표',pct:null});
  }else if(rec.currentStreak<2&&rec.total>=3){
    items.push({icon:'🔥',title:'연승 목표',desc:'2연승 달성',pct:rec.currentStreak>=1?50:0});
  }
  if(!items.length){
    items.push({icon:'✨',title:'시즌 유지',desc:'현재 '+rec.winRate+'% 승률 유지',pct:rec.winRate});
  }
  return '<div class="my-mission-grid">'+items.slice(0,2).map(function(m){
    var bar=m.pct!=null?'<div class="my-mission__bar"><div class="my-mission__fill" style="width:'+m.pct+'%"></div></div>':'';
    return '<div class="my-mission"><span class="my-mission__icon">'+m.icon+'</span><div class="my-mission__body"><div class="my-mission__title">'+m.title+'</div><div class="my-mission__desc">'+m.desc+'</div>'+bar+'</div></div>';
  }).join('')+'</div>';
}
export function _renderMyRecommendedHtml(){
  var recs=getRecommendedOpponents();
  if(!recs.length)return '';
  return '<div class="my-rec-grid">'+recs.slice(0,3).map(function(x){
    return '<button type="button" class="my-rec-card" onclick="startInstantVsMember(\''+x.m.id+'\')">'
      +'<div class="my-rec-card__body">'
      +'<span class="my-rec-card__name">'+x.m.name+'</span>'
      +'<span class="my-rec-card__meta">'+(x.rank!=null?x.rank+'위':'—')+' · '+x.rec.winRate+'%</span>'
      +(x.reason?'<span class="my-rec-card__reason">'+x.reason+'</span>':'')
      +'</div>'
      +'<span class="my-rec-card__cta">⚡ 대결</span></button>';
  }).join('')+'</div>';
}
export function _membersByNameMap(){
  var map={};
  members().forEach(function(m){if(m.name)map[m.name]=m;});
  return map;
}
export function _renderMyCoachingExtrasHtml(me,isDbl,d){
  var html='';
  var bestPartner=_computeBestWinRatePartner(me.name,3);
  var fortune=buildTodayFortune({
    name:me.name,
    dateKey:kstDateKey(),
    dayIdx:new Date().getDay(),
    rec:d.rec,
    rank:d.rank,
    streak:d.streak,
    rival:calcRivalStats(me.name),
    partner:bestPartner
  });
  html+='<div class="my-fortune hall-anim" style="animation-delay:.03s">'
    +'<span class="my-fortune__icon">'+fortune.icon+'</span>'
    +'<div class="my-fortune__body"><div class="my-fortune__title">'+fortune.title+'</div>'
    +'<div class="my-fortune__text">'+fortune.text+'</div></div></div>';

  var clubLine=buildClubCompareLine(d.rec,d.clubAvg);
  if(clubLine){
    html+='<div class="my-club-compare hall-anim" style="animation-delay:.035s">'+clubLine+'</div>';
  }

  var nudge=getGradeNudge(_memberPt(me,isDbl),isDbl?'복식':'단식');
  if(nudge){
    html+='<div class="my-grade-nudge hall-anim" style="animation-delay:.038s">'
      +'<span class="my-grade-nudge__icon">⬆️</span><span class="my-grade-nudge__text">'+nudge.text+'</span></div>';
  }

  var picks=buildTodayPicks({
    rivalStats:calcRivalStats(me.name),
    partner:bestPartner,
    membersByName:_membersByNameMap()
  });
  if(picks.rival||picks.partner){
    html+='<div class="my-today-picks hall-anim" style="animation-delay:.042s">';
    if(picks.rival){
      html+='<button type="button" class="my-today-pick my-today-pick--rival" onclick="startInstantVsMember(\''+picks.rival.m.id+'\')">'
        +'<span class="my-today-pick__lbl">⚔️ 오늘의 라이벌</span>'
        +'<span class="my-today-pick__name">'+picks.rival.m.name+'</span>'
        +'<span class="my-today-pick__meta">'+picks.rival.win+'승 '+picks.rival.lose+'패 · 리벤지</span></button>';
    }
    if(picks.partner){
      html+='<button type="button" class="my-today-pick my-today-pick--partner" onclick="openInstantBS()">'
        +'<span class="my-today-pick__lbl">🤝 오늘의 파트너</span>'
        +'<span class="my-today-pick__name">'+picks.partner.m.name+'</span>'
        +'<span class="my-today-pick__meta">'+picks.partner.count+'경기 · '+picks.partner.winRate+'% 승률</span></button>';
    }
    html+='</div>';
  }
  return html;
}
export function _weekDateFilter(weekStart,weekEnd){
  return function(c){
    var d=c.date||'';
    if(!d&&c.createdAt)d=c.createdAt.slice(0,10);
    return d&&d>=weekStart&&d<=weekEnd;
  };
}
export function _addDaysToDateKey(startKey,days){
  var p=startKey.split('-').map(Number);
  var dt=new Date(p[0],p[1]-1,p[2]+days);
  return kstDateKey(dt);
}
export function _buildWeeklyStatsSummaryForReport(me){
  var weekStart=getKstWeekStartKey();
  var weekEnd=_addDaysToDateKey(weekStart,6);
  var inWeek=_weekDateFilter(weekStart,weekEnd);
  var singles=_computeSinglesRecord(me.name,inWeek);
  var doubles=_computeDoublesRecord(me.name,inWeek);
  var total=singles.total+doubles.total;
  var isDbl=getMyDashMode()==='double';
  var pt=_memberPt(me,isDbl);
  var gr=_calcGrade(pt);
  var clubSingles=_computeClubAvgWinRate(false,3);
  var clubDoubles=_computeClubAvgWinRate(true,3);
  var form=_computeRecentForm(me.name,isDbl,5);
  var formWins=form.filter(function(f){return f==='W';}).length;
  var formRate=form.length?Math.round(formWins/form.length*100):0;
  var rival=calcRivalStats(me.name);
  var lines=[
    '기간: '+weekStart+' ~ '+weekEnd,
    '등급: '+gr.icon+' '+gr.label+' ('+pt.toLocaleString()+'pt)',
    '단식: '+singles.wins+'승 '+singles.losses+'패 ('+singles.total+'경기, 승률 '+singles.winRate+'%, 동호회 평균 '+clubSingles+'%)',
    '복식: '+doubles.wins+'승 '+doubles.losses+'패 ('+doubles.total+'경기, 승률 '+doubles.winRate+'%, 동호회 평균 '+clubDoubles+'%)'
  ];
  var rankS=_getMemberRankPosition(me,false,true);
  var rankD=_getMemberRankPosition(me,true,true);
  if(rankS)lines.push('단식 랭킹: '+rankS+'위');
  if(rankD)lines.push('복식 랭킹: '+rankD+'위');
  var streak=_myDashStreak(me,isDbl);
  if(streak.label!=='—')lines.push('최근 연속: '+streak.label);
  if(form.length)lines.push('최근 '+form.length+'경기 폼: '+form.join('')+' ('+formRate+'%)');
  if(rival.mostWin)lines.push('라이벌(최다 상대): '+rival.mostWin.name+' '+rival.mostWin.win+'승 '+rival.mostWin.lose+'패');
  if(rival.mostLose)lines.push('주의 상대: '+rival.mostLose.name+' '+rival.mostLose.win+'승 '+rival.mostLose.lose+'패');
  return {
    summary:lines.join('\n'),
    totalMatches:total,
    weekStart:weekStart,
    weekLabel:formatWeekLabel(weekStart)
  };
}
export async function _hydrateMyWeeklyReport(forceRefresh){
  if(!forceRefresh&&_weeklyHydrateInflight)return _weeklyHydrateInflight;
  var run=_hydrateMyWeeklyReportCore(forceRefresh).finally(function(){
    if(_weeklyHydrateInflight===run)_weeklyHydrateInflight=null;
  });
  if(!forceRefresh)_weeklyHydrateInflight=run;
  return run;
}
async function _hydrateMyWeeklyReportCore(forceRefresh){
  var me=getMyPlayer();
  if(!me||!g('my-weekly-report-card'))return;
  var weekKey=getKstWeekStartKey();
  var weekLabel=formatWeekLabel(weekKey);
  var cachedData=loadWeeklyReportCache(me.name,weekKey);
  var cached=cachedData&&cachedData.report;
  if(!forceRefresh&&cached){
    updateWeeklyReportCard('ready',{weekLabel:weekLabel,report:cached});
    return;
  }
  var reqId=++_weeklyReportReqId;
  updateWeeklyReportCard('loading',{
    weekLabel:weekLabel,
    message:forceRefresh?'리포트 새로고침 중…':'Gemini가 이번 주 기록을 분석 중…',
    preserveContent:!!(forceRefresh&&cached)
  });
  await yieldToPaint();
  var built=_buildWeeklyStatsSummaryForReport(me);
  if(!built.totalMatches){
    if(reqId!==_weeklyReportReqId)return;
    updateWeeklyReportCard('empty',{weekLabel:built.weekLabel});
    return;
  }
  try{
    var report=await fetchWeeklyCoachReport(me.name,built.summary);
    if(reqId!==_weeklyReportReqId)return;
    saveWeeklyReportCache(me.name,weekKey,report);
    updateWeeklyReportCard('ready',{weekLabel:built.weekLabel,report:report});
  }catch(e){
    if(reqId!==_weeklyReportReqId)return;
    if(cached){
      updateWeeklyReportCard('ready',{weekLabel:built.weekLabel,report:cached,stale:true});
      return;
    }
    updateWeeklyReportCard('error',{weekLabel:built.weekLabel});
  }
}
export function refreshWeeklyReport(force){_hydrateMyWeeklyReport(!!force);}
export function _buildPostMatchMatchSummary(me,challenge,isWin,ptDelta){
  var isDbl=_isDoublesType(challenge.type);
  var myTeam=challenge.myTeam||[];
  var oppTeam=challenge.oppTeam||[];
  var opps=myTeam.indexOf(me.name)>=0?oppTeam.filter(function(n){return n&&n!==me.name;}):myTeam.filter(function(n){return n&&n!==me.name;});
  var partners=myTeam.indexOf(me.name)>=0?myTeam.filter(function(n){return n&&n!==me.name;}):oppTeam.filter(function(n){return n&&n!==me.name;});
  var lines=[
    '경기 유형: '+(isDbl?'복식':'단식'),
    '결과: '+(isWin?'승리':'패배'),
    '포인트: '+(ptDelta>=0?'+':'')+ptDelta+'pt',
    '상대: '+(opps.join(', ')||'—'),
    '스코어: '+(challenge.score||'—')
  ];
  if(isDbl&&partners.length)lines.push('파트너: '+partners.join(', '));
  var streak=_myDashStreak(me,isDbl);
  if(streak.label!=='—')lines.push('현재 연속: '+streak.label);
  return lines.join('\n');
}
export function _postMatchCacheKey(challenge,meName){
  return (challenge.id||'local')+'|'+meName+'|'+(challenge.score||'')+'|'+(challenge.winner||'');
}
async function _hydratePostMatchAiComment(overlay,challenge,isWin,ptDelta,fallbackText){
  var me=getMyPlayer();
  if(!me||!overlay||!challenge)return;
  var coachEl=overlay.querySelector('.feedback-coach__text,.instant-success-coach__text');
  if(!coachEl)return;
  var cacheKey=_postMatchCacheKey(challenge,me.name);
  var cached=loadPostMatchCache(cacheKey);
  if(cached){
    coachEl.textContent=formatPostMatchComment(cached);
    return;
  }
  try{
    var summary=_buildPostMatchMatchSummary(me,challenge,isWin,ptDelta);
    var comment=await fetchPostMatchComment(me.name,summary);
    if(!document.body.contains(overlay))return;
    coachEl.textContent=formatPostMatchComment(comment);
    savePostMatchCache(cacheKey,comment);
  }catch(e){
    if(fallbackText)coachEl.textContent=fallbackText;
  }
}
export function _buildDailyBriefingSummary(me,isDbl){
  var d=_collectHallReportData(me,isDbl);
  var rival=calcRivalStats(me.name);
  var lines=[
    '날짜: '+kstDateKey(),
    '등급: '+d.gr.icon+' '+d.gr.label+' ('+d.pt.toLocaleString()+'pt)',
    (isDbl?'복식':'단식')+': '+d.rec.wins+'승 '+d.rec.losses+'패, 승률 '+d.rec.winRate+'%',
    '랭킹: '+(d.rank!=null?d.rank+'위':'—'),
    '연속: '+d.streak.label,
    '동호회 평균 승률: '+d.clubAvg+'%',
    '최근 폼: '+d.form.join('')+' ('+d.form.length+'경기)'
  ];
  if(rival.mostLose)lines.push('라이벌: '+rival.mostLose.name+' '+rival.mostLose.win+'승 '+rival.mostLose.lose+'패');
  var picks=buildTodayPicks({rivalStats:rival,partner:_computeBestWinRatePartner(me.name,3),membersByName:_membersByNameMap()});
  if(picks.rival)lines.push('오늘의 라이벌 후보: '+picks.rival.m.name);
  if(picks.partner)lines.push('오늘의 파트너 후보: '+picks.partner.m.name);
  return lines.join('\n');
}
export async function _hydrateMyDailyBriefing(forceRefresh){
  if(!forceRefresh&&_dailyHydrateInflight)return _dailyHydrateInflight;
  var run=_hydrateMyDailyBriefingCore(forceRefresh).finally(function(){
    if(_dailyHydrateInflight===run)_dailyHydrateInflight=null;
  });
  if(!forceRefresh)_dailyHydrateInflight=run;
  return run;
}
async function _hydrateMyDailyBriefingCore(forceRefresh){
  var me=getMyPlayer();
  if(!me||!g('my-daily-briefing-card'))return;
  var dateKey=kstDateKey();
  var isDbl=getMyDashMode()==='double';
  var reqId=++_dailyBriefingReqId;
  var dateLbl=dateKey.slice(5).replace('-','/');
  var cached=loadDailyBriefingCache(me.name,dateKey);
  if(!forceRefresh&&cached){
    updateDailyBriefingCard('ready',{dateLabel:dateLbl,briefing:cached});
    return;
  }
  updateDailyBriefingCard('loading',{
    dateLabel:dateLbl,
    message:forceRefresh?'브리핑 새로고침 중…':'오늘의 코칭 준비 중…',
    preserveContent:!!(forceRefresh&&cached)
  });
  await yieldToPaint();
  try{
    var briefing=await fetchDailyBriefing(me.name,_buildDailyBriefingSummary(me,isDbl));
    if(reqId!==_dailyBriefingReqId)return;
    saveDailyBriefingCache(me.name,dateKey,briefing);
    updateDailyBriefingCard('ready',{dateLabel:dateLbl,briefing:briefing});
  }catch(e){
    if(reqId!==_dailyBriefingReqId)return;
    if(cached){
      updateDailyBriefingCard('ready',{dateLabel:dateLbl,briefing:cached,stale:true});
      return;
    }
    updateDailyBriefingCard('error',{dateLabel:dateLbl});
  }
}
export function refreshDailyBriefing(force){_hydrateMyDailyBriefing(!!force);}
export function _hydrateMyAiCards(){
  _hydrateMyDailyBriefing(false);
  _hydrateMyWeeklyReport(false);
}
export function _buildOpponentAnalysisSummary(me,opponent){
  var h2h=_computeHeadToHead(me.name,opponent.name);
  var recMe=_computeDoublesRecord(me.name);
  var recOpp=_computeDoublesRecord(opponent.name);
  var rankMe=_getMemberRankPosition(me,true,true);
  var rankOpp=_getMemberRankPosition(opponent,true,true);
  var lines=[
    '나: '+me.name+' · '+(rankMe!=null?rankMe+'위':'—')+' · 승률 '+recMe.winRate+'%',
    '상대: '+opponent.name+' · '+(rankOpp!=null?rankOpp+'위':'—')+' · 승률 '+recOpp.winRate+'%',
    '맞대결: '+me.name+' '+h2h.winsA+'승 '+h2h.lossesA+'패 vs '+opponent.name+' '+h2h.winsB+'승 '+h2h.lossesB+'패 (총 '+h2h.total+'경기)'
  ];
  var recent=_getMatchesForMode(me.name,true).slice(0,5);
  if(recent.length)lines.push('내 최근 5경기 폼: '+_computeRecentForm(me.name,true,5).join(''));
  return lines.join('\n');
}
export async function _hydrateOpponentAnalysis(opponentId,forceRefresh){
  var inflightKey=String(opponentId)+'|'+(forceRefresh?'1':'0');
  if(!forceRefresh&&_opponentHydrateInflight.has(inflightKey)){
    return _opponentHydrateInflight.get(inflightKey);
  }
  var run=_hydrateOpponentAnalysisCore(opponentId,forceRefresh).finally(function(){
    if(_opponentHydrateInflight.get(inflightKey)===run)_opponentHydrateInflight.delete(inflightKey);
  });
  if(!forceRefresh)_opponentHydrateInflight.set(inflightKey,run);
  return run;
}
async function _hydrateOpponentAnalysisCore(opponentId,forceRefresh){
  var me=getMyPlayer();
  var opp=members().find(function(x){return x.id===opponentId;});
  if(!me||!opp||me.id===opp.id||!g('md-ai-opponent-card'))return;
  var reqId=++_opponentAiReqId;
  var cached=loadOpponentAiCache(me.name,opp.name);
  if(!forceRefresh&&cached){
    updateOpponentAiCard('ready',{analysis:cached});
    return;
  }
  updateOpponentAiCard('loading',{
    message:forceRefresh?'상대 분석 새로고침 중…':'상대 전적 분석 중…',
    preserveContent:!!(forceRefresh&&cached)
  });
  await yieldToPaint();
  try{
    var analysis=await fetchOpponentAnalysis(me.name,opp.name,_buildOpponentAnalysisSummary(me,opp));
    if(reqId!==_opponentAiReqId)return;
    saveOpponentAiCache(me.name,opp.name,analysis);
    updateOpponentAiCard('ready',{analysis:analysis});
  }catch(e){
    if(reqId!==_opponentAiReqId)return;
    if(cached){
      updateOpponentAiCard('ready',{analysis:cached,stale:true});
      return;
    }
    updateOpponentAiCard('error');
  }
}
export function _buildPostMatchCoachComment(isWin,ptDelta,challenge){
  var me=getMyPlayer();
  if(!me||!challenge)return '';
  var myTeam=challenge.myTeam||[];
  var oppTeam=challenge.oppTeam||[];
  var opps=myTeam.indexOf(me.name)>=0?oppTeam.filter(function(n){return n&&n!==me.name;}):myTeam.filter(function(n){return n&&n!==me.name;});
  var streak=_myDashStreak(me,true);
  var streakWins=streak.type==='win'?parseInt(streak.label,10)||0:0;
  var streakLosses=streak.type==='lose'?parseInt(streak.label,10)||0:0;
  return buildPostMatchComment({
    isWin:isWin,
    pointDelta:ptDelta,
    opponentName:opps[0]||'',
    streakWins:streakWins,
    streakLosses:streakLosses
  });
}
export function _renderMyPartnerSynergyHtml(me,isDbl){
  if(!isDbl)return '';
  var best=_computeBestWinRatePartner(me.name,3);
  if(!best)return '';
  return '<div class="my-synergy">'
    +'<div class="my-synergy__av">🤝</div>'
    +'<div class="my-synergy__body"><div class="my-synergy__name">'+best.name+'</div>'
    +'<div class="my-synergy__meta">'+best.count+'경기 · '+best.winRate+'% 승률 · 최고 시너지 파트너</div></div></div>';
}
export function _renderMyPlayerReportHtml(me,isDbl){
  var d=_collectHallReportData(me,isDbl);
  var modeLbl=isDbl?'복식':'단식';
  var otherLbl=isDbl?'단식':'복식';
  var otherRec=isDbl?_computeSinglesRecord(me.name):_computeDoublesRecord(me.name);
  var otherRank=_getMemberRankPosition(me,!isDbl,true);
  var streakCls=d.streak.type==='win'?'hall-kpi__val--win':d.streak.type==='lose'?'hall-kpi__val--lose':'';
  var accent=d.streak.type==='win'?'#007AFF':d.streak.type==='lose'?'#FF453A':'#2A4A6E';
  var rankDisplay=d.rank!=null?d.rank:'—';
  var ptDeltaStr=d.ptDelta>0?'+'+d.ptDelta:d.ptDelta<0?''+d.ptDelta:'±0';
  var ptDeltaCls=d.ptDelta>0?'hall-kpi__val--win':d.ptDelta<0?'hall-kpi__val--lose':'';
  var topPctLbl=d.topPct?'상위 '+d.topPct+'%':'';
  var formWins=d.form.filter(function(f){return f==='W';}).length;
  var formRate=d.form.length?Math.round(formWins/d.form.length*100):0;
  var rival=calcRivalStats(me.name);
  var coach=_buildAiCoachingLine(d,rival);
  var recHtml=_renderMyRecommendedHtml();
  var partnerHtml=_renderMyPartnerSynergyHtml(me,isDbl);
  var missionHtml=_renderMyWeeklyMissionHtml(d.rec,d.rank);
  var hasRec=d.rec.total>0;
  return '<div class="hall-report my-report">'
    +'<div class="hall-report__section hall-report__section--hero hall-anim" style="animation-delay:0s">'
    +'<div class="hall-hero"><div class="hall-hero__accent" style="background:'+accent+'"></div>'
    +'<div class="hall-hero__ghost">'+rankDisplay+'</div>'
    +'<div class="hall-hero__body">'
    +'<div class="hall-hero__eyebrow">MY COACHING · '+modeLbl.toUpperCase()+'</div>'
    +'<div class="hall-hero__top">'
    +memberAv(me.name,'','hall-hero__avatar',gradeAvatarStyle(d.gr.label))
    +'<div class="hall-hero__info"><div class="hall-hero__name">'+me.name+'</div>'
    +'<span class="hall-hero__grade">'+d.gr.icon+' '+d.gr.label+'</span>'
    +(topPctLbl?'<span class="hall-hero__pct">'+topPctLbl+'</span>':'')
    +'</div>'
    +'<div class="hall-hero__rank-block"><div class="hall-hero__rank">'+rankDisplay+'<span class="hall-hero__rank-suf">위</span></div>'
    +'<div class="hall-hero__pts">'+d.pt.toLocaleString()+'<span class="hall-hero__pts-unit">pt</span></div></div>'
    +'</div>'
    +'<div class="hall-kpi">'
    +'<div class="hall-kpi__item"><span class="hall-kpi__val">'+d.rec.total+'</span><span class="hall-kpi__lbl">'+modeLbl+' 경기</span></div>'
    +'<div class="hall-kpi__item"><span class="hall-kpi__val">'+d.rec.winRate+'%</span><span class="hall-kpi__lbl">승률</span></div>'
    +'<div class="hall-kpi__item"><span class="hall-kpi__val '+streakCls+'">'+d.streak.label+'</span><span class="hall-kpi__lbl">연속</span></div>'
    +'<div class="hall-kpi__item"><span class="hall-kpi__val '+ptDeltaCls+'">'+ptDeltaStr+'</span><span class="hall-kpi__lbl">최근 pt</span></div>'
    +'</div></div></div></div>'
    +_renderMyCoachingExtrasHtml(me,isDbl,d)
    +'<div class="hall-report__section hall-anim" style="animation-delay:.042s">'
    +renderDailyBriefingShellHtml()
    +'</div>'
    +'<div class="hall-report__section hall-anim" style="animation-delay:.045s">'
    +renderWeeklyReportShellHtml()
    +'</div>'
    +'<div class="my-coach-banner hall-anim" style="animation-delay:.05s">'
    +'<span class="my-coach-banner__icon">'+coach.icon+'</span>'
    +'<span class="my-coach-banner__text">'+coach.text+'</span></div>'
    +'<button type="button" class="btn btn-p my-register-cta hall-anim" style="animation-delay:.06s" onclick="openInstantBS()">⚡ 오늘 경기 등록하기</button>'
    +'<div class="my-mode-tabs hall-anim" style="animation-delay:.08s">'
    +'<button type="button" class="my-mode-tab'+(isDbl?' on':'')+'" onclick="setMyDashMode(\'double\')">🤝 복식</button>'
    +'<button type="button" class="my-mode-tab'+(!isDbl?' on':'')+'" onclick="setMyDashMode(\'individual\')">🏓 단식</button>'
    +'</div>'
    +'<div class="my-other-mode hall-anim" style="animation-delay:.1s">'+otherLbl+' · '+(otherRank!=null?otherRank+'위':'—')+' · '+otherRec.total+'경기 · '+otherRec.winRate+'%</div>'
    +(hasRec?''
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
      +'<div class="hall-card"><div class="hall-card__head"><span class="hall-card__title">성장 추이</span><span class="hall-card__sub">레이팅 · '+modeLbl+'</span></div>'
      +'<div class="hall-chart-wrap">'+_buildRatingChartSvg(d.hist)+'</div>'
      +'<div class="rating-chart-note">경기 완료 순 포인트 재계산 (시작 '+PT_INIT+'pt)</div></div></div>'
      +(recHtml?'<div class="hall-report__section hall-anim" style="animation-delay:.28s"><div class="hall-card"><div class="hall-card__head"><span class="hall-card__title">오늘의 추천 상대</span><span class="hall-card__sub">랭킹·승률 유사</span></div>'+recHtml+'</div></div>':'')
      +(partnerHtml?'<div class="hall-report__section hall-anim" style="animation-delay:.32s"><div class="hall-card"><div class="hall-card__head"><span class="hall-card__title">파트너 시너지</span><span class="hall-card__sub">복식</span></div>'+partnerHtml+'</div></div>':'')
      +'<div class="hall-report__section hall-anim" style="animation-delay:.36s"><div class="hall-card"><div class="hall-card__head"><span class="hall-card__title">이번 주 미션</span><span class="hall-card__sub">목표</span></div>'+missionHtml+'</div></div>'
      +'<div class="hall-report__section hall-anim" style="animation-delay:.4s">'
      +'<div class="hall-card"><div class="hall-card__head"><span class="hall-card__title">최근 경기</span><span class="hall-card__sub">'+modeLbl+'</span></div>'
      +'<div class="hall-matches">'+_renderMyRecentMatchesHtml(me.name,isDbl,5)+'</div></div></div>'
      :'<div class="hall-report__section hall-anim" style="animation-delay:.12s"><div class="hall-card my-empty-card"><div class="my-empty-card__icon">📊</div><div class="my-empty-card__title">아직 '+modeLbl+' 기록이 없어요</div><p class="my-empty-card__desc">첫 경기를 등록하면 AI 분석·추천 상대·미션이 활성화됩니다.</p></div></div>')
    +'<div class="hall-report__section hall-anim" style="animation-delay:.44s">'
    +'<div class="hall-card"><div class="hall-card__head"><span class="hall-card__title">내 배지</span><span class="hall-card__sub">'+_computeMemberBadges(me.name).length+'개</span></div>'
    +_renderMyBadgesScrollHtml(me.name)+'</div></div>'
    +(_renderGradeProgressHtml(_memberPt(me,false))?''
      +'<div class="hall-report__section hall-anim" style="animation-delay:.48s"><div class="hall-card">'
      +'<div class="hall-card__head"><span class="hall-card__title">등급 진행</span><span class="hall-card__sub">단식</span></div>'
      +_renderGradeProgressHtml(_memberPt(me,false))+'</div></div>':'')
    +(_renderRivalStatsHtml(me.name,true)?''
      +'<div class="hall-report__section hall-anim" style="animation-delay:.52s"><div class="hall-card">'
      +'<div class="hall-card__head"><span class="hall-card__title">라이벌</span></div>'
      +_renderRivalStatsHtml(me.name,true)+'</div></div>':'')
    +'</div>';
}
/**
 * 마이페이지 스포츠 스타일 대시보드 HTML.
 * @returns {string}
 */
export function _renderMyDashboardHtml(){
  var me=getMyPlayer();
  if(!me)return '';
  var isDbl=getMyDashMode()==='double';
  return _renderMyPlayerReportHtml(me,isDbl);
}
export function setMyDashMode(mode){
  setMyDashModeState(mode==='individual'?'individual':'double');
  renderMyPage();
}
export function _myPointDeltaForResult(challenge,winnerSide){
  var me=getMyPlayer();
  if(!me||!challenge||!winnerSide)return null;
  var isDbl=_isDoublesType(challenge.type);
  var pts=isDbl?PT.double:PT.individual;
  var winTeam=winnerSide==='a'?(challenge.myTeam||[]):(challenge.oppTeam||[]);
  var loseTeam=winnerSide==='a'?(challenge.oppTeam||[]):(challenge.myTeam||[]);
  if(winTeam.indexOf(me.name)>=0)return pts.win;
  if(loseTeam.indexOf(me.name)>=0)return pts.loss;
  return null;
}
/**
 * 경기 결과 입력 후 승패·포인트 변동 피드백 모달을 표시한다.
 * @param {boolean} isWin - 승리 여부
 * @param {number|null} pointDelta - 포인트 변동량
 */
export function showResultFeedback(isWin,pointDelta,coachComment,challenge){
  if(pointDelta==null)return;
  var overlay=document.createElement('div');
  overlay.className='app-back-overlay';
  overlay.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center';
  var box=document.createElement('div');
  box.style.cssText='background:#fff;border-radius:24px;padding:40px 32px;text-align:center;width:280px;animation:feedbackPop 0.3s ease';
  var emoji=isWin?'🎉':'💪';
  var title=isWin?'승리!':'아쉽지만 분전했어요!';
  var ptSign=pointDelta>=0?'+':'';
  var ptColor=pointDelta>=0?COLOR_SUCCESS:COLOR_DANGER;
  var ptText=ptSign+pointDelta+'pt';
  var coachHtml=coachComment
    ?'<div class="feedback-coach"><span class="feedback-coach__icon">🎙️</span><span class="feedback-coach__text">'+String(coachComment).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span></div>'
    :'';
  box.innerHTML='<div style="font-size:56px;margin-bottom:12px">'+emoji+'</div>'
    +'<div style="font-size:22px;font-weight:700;margin-bottom:8px">'+title+'</div>'
    +'<div style="font-size:32px;font-weight:800;color:'+ptColor+';margin-bottom:16px">'+ptText+'</div>'
    +coachHtml
    +'<button type="button" id="feedbackClose" style="width:100%;padding:14px;border:none;border-radius:12px;background:'+COLOR_PRIMARY+';color:#fff;font-size:16px;font-weight:600;cursor:pointer">확인</button>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  var closeFn=function(fromBack){
    if(!fromBack)unregisterOverlay(FEEDBACK_BACK_KEY);
    overlay.remove();
  };
  box.querySelector('#feedbackClose').addEventListener('click',function(){closeFn(false);});
  registerOverlay(FEEDBACK_BACK_KEY,function(fromBack){closeFn(fromBack);});
  setTimeout(function(){closeFn(false);},FEEDBACK_AUTO_CLOSE_MS);
  if(challenge&&coachComment)_hydratePostMatchAiComment(overlay,challenge,isWin,pointDelta,coachComment);
}
export function showInstantRegisterSuccess(myTeamWon,pointDelta,coachComment,challenge){
  var overlay=document.createElement('div');
  overlay.className='app-back-overlay instant-success-overlay';
  var coachHtml=coachComment?'<div class="instant-success-coach"><span class="instant-success-coach__icon">🎙️</span><span class="instant-success-coach__text">'+String(coachComment).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span></div>':'';
  overlay.innerHTML='<div class="instant-success-card">'
    +'<div class="instant-success-icon">🏆</div>'
    +'<div class="instant-success-title">결과 등록 완료</div>'
    +'<div class="instant-success-result">'+(myTeamWon?'우리팀 승리':'상대팀 승리')+'</div>'
    +'<div class="instant-success-pt">'+(pointDelta!=null?(pointDelta>=0?'+':'')+pointDelta+'pt · ':'')+'포인트 반영 완료</div>'
    +coachHtml
    +'<button type="button" class="btn btn-p instant-success-btn">확인</button></div>';
  document.body.appendChild(overlay);
  var closeFn=function(fromBack){
    if(!fromBack)unregisterOverlay(FEEDBACK_BACK_KEY);
    overlay.remove();
  };
  overlay.querySelector('.instant-success-btn').addEventListener('click',function(){closeFn(false);});
  registerOverlay(FEEDBACK_BACK_KEY,function(fromBack){closeFn(fromBack);});
  setTimeout(function(){closeFn(false);},FEEDBACK_AUTO_CLOSE_MS);
  if(challenge&&coachComment)_hydratePostMatchAiComment(overlay,challenge,myTeamWon,pointDelta,coachComment);
}