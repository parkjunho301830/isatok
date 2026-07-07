/**
 * 경기 기록 기반 통계 (CHAL에서 실시간 계산, 별도 저장 없음)
 */
import {
  PT_INDIVIDUAL_WIN, PT_INDIVIDUAL_LOSS, PT_DOUBLE_WIN, PT_DOUBLE_LOSS, PT_INIT
} from './constants.js?v=2026.07.07.01';
import {
  _isDoublesType, _isDoublesFormatChallenge, _isSinglesFormatChallenge, _memberPt
} from './memberCore.js?v=2026.07.07.01';

const PT = {
  individual: { win: PT_INDIVIDUAL_WIN, loss: PT_INDIVIDUAL_LOSS },
  double: { win: PT_DOUBLE_WIN, loss: PT_DOUBLE_LOSS }
};

let C = null;

export function initMatchStats(ctx) {
  C = ctx;
}

function chal() { return C.getChal(); }
function members() { return C.getMembers(); }
function seasons() { return C.getSeasons(); }
function tournaments() { return C.getTournaments(); }

export function _isSinglesType(t){return t==='ms'||t==='fs';}
export function _matchSortKey(c){
  var d=c.date||'';
  if(!d&&c.createdAt)d=c.createdAt.slice(0,10);
  var t=c.time||'00:00';
  return d+'T'+t;
}
export function _fmtStatDate(c){
  var d=c.date||'';
  if(!d&&c.createdAt)d=c.createdAt.slice(0,10);
  return d||'-';
}
export function _isSinglesMatch(c){
  if(c.status!=='completed')return false;
  return _isSinglesFormatChallenge(c);
}
export function _playerSideInMatch(c,name){
  var my=c.myTeam||[],opp=c.oppTeam||[];
  if(my[0]===name)return'a';
  if(opp[0]===name)return'b';
  return null;
}
export function _playerWonMatch(c,name){
  var side=_playerSideInMatch(c,name);
  return side&&c.winner===side;
}
export function _getSinglesMatchesFor(playerName){
  return chal().filter(function(c){
    if(!_isSinglesMatch(c))return false;
    var my=(c.myTeam||[])[0],opp=(c.oppTeam||[])[0];
    return my===playerName||opp===playerName;
  }).sort(function(a,b){return _matchSortKey(b).localeCompare(_matchSortKey(a));});
}
export function _getDoublesMatchesFor(playerName){
  return chal().filter(function(c){
    if(c.status!=='completed'||!_isDoublesFormatChallenge(c))return false;
    return _playerSideInAnyMatch(c,playerName);
  }).sort(function(a,b){return _matchSortKey(b).localeCompare(_matchSortKey(a));});
}
export function _getMatchesForMode(playerName,isDbl,filterFn){
  var matches=isDbl?_getDoublesMatchesFor(playerName):_getSinglesMatchesFor(playerName);
  if(filterFn)matches=matches.filter(filterFn);
  return matches;
}
export function _computeModeRecord(name,isDbl,filterFn){
  var matches=_getMatchesForMode(name,isDbl,filterFn);
  var wins=0,losses=0;
  matches.forEach(function(c){
    if(isDbl?_playerWonAnyMatch(c,name):_playerWonMatch(c,name))wins++;
    else losses++;
  });
  var streak=_computeStreakFromMatches(matches,name,isDbl);
  var total=wins+losses;
  var winRate=total?Math.round(wins/total*100):0;
  return {wins:wins,losses:losses,total:total,winRate:winRate,currentStreak:streak.currentStreak,maxStreak:streak.maxStreak,matches:matches};
}
export function _computeDoublesRecord(name,filterFn){
  return _computeModeRecord(name,true,filterFn);
}
export function _computeTopPartner(name,filterFn){
  var matches=_getDoublesMatchesFor(name);
  if(filterFn)matches=matches.filter(filterFn);
  var counts={};
  matches.forEach(function(c){
    var side=_playerSideInAnyMatch(c,name);
    var team=side==='a'?(c.myTeam||[]):(c.oppTeam||[]);
    team.filter(function(p){return p!==name;}).forEach(function(p){
      counts[p]=(counts[p]||0)+1;
    });
  });
  var top=null,max=0;
  Object.keys(counts).forEach(function(p){
    if(counts[p]>max){max=counts[p];top=p;}
  });
  return {name:top,count:max};
}
export function _computeBestWinRatePartner(name,minGames,filterFn){
  minGames=minGames||5;
  var matches=_getDoublesMatchesFor(name);
  if(filterFn)matches=matches.filter(filterFn);
  var stats={};
  matches.forEach(function(c){
    var side=_playerSideInAnyMatch(c,name);
    var team=side==='a'?(c.myTeam||[]):(c.oppTeam||[]);
    var won=_playerWonAnyMatch(c,name);
    team.filter(function(p){return p!==name;}).forEach(function(p){
      if(!stats[p])stats[p]={wins:0,total:0};
      stats[p].total++;
      if(won)stats[p].wins++;
    });
  });
  var best=null,bestRate=-1;
  Object.keys(stats).forEach(function(p){
    var s=stats[p];
    if(s.total<minGames)return;
    var rate=Math.round(s.wins/s.total*100);
    if(rate>bestRate||(rate===bestRate&&s.total>(best?best.count:0))){
      bestRate=rate;
      best={name:p,count:s.total,wins:s.wins,winRate:rate};
    }
  });
  return best;
}
export function _computeRatingHistory(name,isDbl){
  var matches=_getMatchesForMode(name,isDbl).slice().sort(function(a,b){
    return _matchSortKey(a).localeCompare(_matchSortKey(b));
  });
  var pts=PT_INIT;
  var ptsCfg=isDbl?PT.double:PT.individual;
  var history=[{date:'',points:pts,label:'시작'}];
  matches.forEach(function(c){
    if(_playerWonAnyMatch(c,name))pts+=ptsCfg.win;
    else pts+=ptsCfg.loss;
    history.push({date:_fmtStatDate(c),points:pts});
  });
  return history;
}
export function _buildRatingChartSvg(history){
  if(!history||history.length<2){
    return '<div class="rating-chart-empty">경기 기록이 부족합니다 (2경기 이상)</div>';
  }
  var pts=history.map(function(h){return h.points;});
  var minPt=Math.min.apply(null,pts);
  var maxPt=Math.max.apply(null,pts);
  var pad=Math.max(20,Math.round((maxPt-minPt)*0.1)||20);
  minPt=Math.max(0,minPt-pad);
  maxPt=maxPt+pad;
  var w=320,h=120,px=8,py=12;
  var plotW=w-px*2,plotH=h-py*2;
  var coords=history.map(function(item,i){
    var x=px+(history.length===1?plotW/2:(i/(history.length-1))*plotW);
    var y=py+plotH-((item.points-minPt)/(maxPt-minPt||1))*plotH;
    return {x:x,y:y,points:item.points,date:item.date};
  });
  var line=coords.map(function(c){return c.x.toFixed(1)+','+c.y.toFixed(1);}).join(' ');
  var last=coords[coords.length-1];
  var labels='';
  if(history.length>=2){
    labels='<text x="'+px+'" y="'+(h-2)+'" class="rating-chart-label">'+ (history[1].date||'시작') +'</text>'
      +'<text x="'+(w-px)+'" y="'+(h-2)+'" text-anchor="end" class="rating-chart-label">'+ (last.date||'') +'</text>';
  }
  return '<svg class="rating-chart-svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="레이팅 변화 추이">'
    +'<line x1="'+px+'" y1="'+py+'" x2="'+px+'" y2="'+(h-py)+'" class="rating-chart-axis"/>'
    +'<line x1="'+px+'" y1="'+(h-py)+'" x2="'+(w-px)+'" y2="'+(h-py)+'" class="rating-chart-axis"/>'
    +'<polyline points="'+line+'" class="rating-chart-line"/>'
    +coords.map(function(c,i){
      if(i===0&&!c.date)return '';
      return '<circle cx="'+c.x+'" cy="'+c.y+'" r="3" class="rating-chart-dot"/>';
    }).join('')
    +'<text x="'+(w-px)+'" y="'+(py+4)+'" text-anchor="end" class="rating-chart-pt">'+last.points+'pt</text>'
    +labels+'</svg>';
}
export function _formatRecentMatchLine(c,playerName,isDbl){
  var won=isDbl?_playerWonAnyMatch(c,playerName):_playerWonMatch(c,playerName);
  var side=_playerSideInAnyMatch(c,playerName);
  var myTeam=c.myTeam||[],oppTeam=c.oppTeam||[];
  var opponents=side==='a'?oppTeam:myTeam;
  var oppLabel=opponents.join('·')||'—';
  var score=c.score||'';
  var icon=won?'✅':'❌';
  var result=won?'승':'패';
  var dateStr=_fmtStatDate(c);
  return {icon:icon,score:score,result:result,opp:oppLabel,date:dateStr,won:won};
}
export function _getRecentMatchLines(playerName,isDbl,limit,seasonFilter){
  var matches=_getMatchesForMode(playerName,isDbl,seasonFilter);
  return matches.slice(0,limit||3).map(function(c){
    return _formatRecentMatchLine(c,playerName,isDbl);
  });
}
/**
 * 동일 포인트는 같은 순위, 다음 순위는 동순 인원만큼 건너뜀 (1, 2, 2, 2, 5).
 * @param {Array<{m: object, pt: number}>} sortedList - pt 내림차순 정렬된 목록
 * @returns {Object<string, number>} memberId → 순위
 */
export function _buildCompetitionRankMap(sortedList){
  var map={};
  var rank=1;
  var i=0;
  while(i<sortedList.length){
    var pt=sortedList[i].pt;
    var j=i;
    while(j<sortedList.length&&sortedList[j].pt===pt)j++;
    for(var k=i;k<j;k++)map[sortedList[k].m.id]=rank;
    rank+=j-i;
    i=j;
  }
  return map;
}
export function _getMemberRankPosition(m,isDbl,isSeason){
  var season=_getCurrentSeason();
  if(isSeason&&!season)return null;
  var list=members().filter(function(x){return x.status!=='비활성';})
    .map(function(x){
      var pt=_rankPointsForMember(x,isDbl,!!(isSeason&&season));
      return {m:x,pt:pt};
    })
    .sort(function(a,b){return b.pt-a.pt||((a.m.name||'').localeCompare(b.m.name||''));});
  var rankMap=_buildCompetitionRankMap(list);
  return rankMap[m.id]!=null?rankMap[m.id]:null;
}
export function _areOpponentsInMatch(c,nameA,nameB){
  var sideA=_playerSideInAnyMatch(c,nameA);
  var sideB=_playerSideInAnyMatch(c,nameB);
  return sideA&&sideB&&sideA!==sideB;
}
export function _getHeadToHeadMatches(nameA,nameB){
  return chal().filter(function(c){
    if(c.status!=='completed')return false;
    if(_isSinglesFormatChallenge(c)||_isDoublesFormatChallenge(c))return _areOpponentsInMatch(c,nameA,nameB);
    return false;
  }).sort(function(a,b){return _matchSortKey(b).localeCompare(_matchSortKey(a));});
}
export function _getAllMatchesFor(playerName,filterFn){
  var seen={},all=[];
  _getSinglesMatchesFor(playerName).concat(_getDoublesMatchesFor(playerName)).forEach(function(c){
    if(seen[c.id])return;
    seen[c.id]=true;
    all.push(c);
  });
  all.sort(function(a,b){return _matchSortKey(b).localeCompare(_matchSortKey(a));});
  if(filterFn)all=all.filter(filterFn);
  return all;
}
export function _computeCombinedRecord(name,filterFn){
  var matches=_getAllMatchesFor(name,filterFn);
  var wins=0,losses=0;
  matches.forEach(function(c){
    if(_playerWonAnyMatch(c,name))wins++;
    else losses++;
  });
  var streak=_computeStreakFromMatches(matches,name,true);
  var total=wins+losses;
  var winRate=total?Math.round(wins/total*100):0;
  return {wins:wins,losses:losses,total:total,winRate:winRate,currentStreak:streak.currentStreak,maxStreak:streak.maxStreak,matches:matches};
}
export function _computeHeadToHead(nameA,nameB){
  var matches=_getHeadToHeadMatches(nameA,nameB);
  var winsA=0,winsB=0;
  matches.forEach(function(c){
    if(_playerWonAnyMatch(c,nameA))winsA++;
    else if(_playerWonAnyMatch(c,nameB))winsB++;
  });
  var total=winsA+winsB;
  var rateA=total?Math.round(winsA/total*100):0;
  var rateB=total?Math.round(winsB/total*100):0;
  var recent=matches.slice(0,8).map(function(c){
    var winnerName=_playerWonAnyMatch(c,nameA)?nameA:nameB;
    var typeLbl=_isSinglesMatch(c)?'단식':'복식';
    var teams=(c.myTeam||[]).join('·')+' vs '+(c.oppTeam||[]).join('·');
    return {date:_fmtStatDate(c),winner:winnerName,type:typeLbl,teams:teams,score:c.score||''};
  });
  return {winsA:winsA,winsB:winsB,lossesA:winsB,lossesB:winsA,rateA:rateA,rateB:rateB,total:total,recent:recent};
}

// ── 시즌 / 배지 / 명예의 전당 (chal()·seasons 기반 실시간 계산) ──
export function _chMatchDate(c){
  var d=c.date||'';
  if(!d&&c.createdAt)d=c.createdAt.slice(0,10);
  return d;
}
export function _chInSeason(c,season){
  if(!season||!season.startDate)return false;
  var d=_chMatchDate(c);
  if(!d)return false;
  if(d<season.startDate)return false;
  if(season.endDate&&d>season.endDate)return false;
  return true;
}
export function _getCurrentSeason(){
  return seasons().find(function(s){return s.isCurrent&&s.status!=='ended';})||null;
}
export function _playerSideInAnyMatch(c,name){
  var my=c.myTeam||[],opp=c.oppTeam||[];
  if(my.indexOf(name)>=0)return'a';
  if(opp.indexOf(name)>=0)return'b';
  return null;
}
export function _playerWonAnyMatch(c,name){
  var side=_playerSideInAnyMatch(c,name);
  return side&&c.winner===side;
}
export function _isMatchForRkMode(c,isDbl){
  if(c.status!=='completed')return false;
  return isDbl?_isDoublesFormatChallenge(c):_isSinglesFormatChallenge(c);
}
export function _computeSeasonPoints(member,season,isDbl){
  var pt=PT_INIT,name=member.name;
  chal().forEach(function(c){
    if(!_chInSeason(c,season)||!_isMatchForRkMode(c,isDbl))return;
    if(!_playerSideInAnyMatch(c,name))return;
    var pts=isDbl?PT.double:PT.individual;
    if(_playerWonAnyMatch(c,name))pt+=pts.win;
    else pt+=pts.loss;
  });
  return pt;
}
/** 전체 기간 경기 기준 포인트 (시즌 필터 없음) */
export function _computeAllTimePoints(member,isDbl){
  var pt=PT_INIT,name=member.name;
  chal().forEach(function(c){
    if(!_isMatchForRkMode(c,isDbl))return;
    if(!_playerSideInAnyMatch(c,name))return;
    var pts=isDbl?PT.double:PT.individual;
    if(_playerWonAnyMatch(c,name))pt+=pts.win;
    else pt+=pts.loss;
  });
  return pt;
}
/** 종료된 시즌이 하나라도 있으면 false (첫 시즌만 진행 중) */
export function _isFirstSeasonOnly(){
  return seasons().length>0&&!seasons().some(function(s){return s.status==='ended';});
}
/**
 * 랭킹 탭·순위 표시용 포인트
 * - 시즌: 시즌 내 경기 재계산
 * - 전체: 첫 시즌이면 시즌과 동일, 이후 시즌은 전체 경기 재계산
 */
export function _rankPointsForMember(m,isDbl,isSeasonScope){
  var season=_getCurrentSeason();
  if(isSeasonScope&&season)return _computeSeasonPoints(m,season,isDbl);
  if(season&&_isFirstSeasonOnly())return _computeSeasonPoints(m,season,isDbl);
  return _computeAllTimePoints(m,isDbl);
}
export function _seasonFilterFn(season){
  return function(c){return _chInSeason(c,season);};
}
export function _computeStreakFromMatches(matches,playerName,isDbl){
  var won=function(c){
    return isDbl?_playerWonAnyMatch(c,playerName):_playerWonMatch(c,playerName);
  };
  var current=0,max=0,run=0;
  for(var i=0;i<matches.length;i++){
    if(won(matches[i]))current++;
    else break;
  }
  var asc=matches.slice().reverse();
  for(var j=0;j<asc.length;j++){
    if(won(asc[j])){run++;if(run>max)max=run;}
    else run=0;
  }
  return {currentStreak:current,maxStreak:max};
}
export function _computeSinglesRecord(name,filterFn){
  var matches=_getSinglesMatchesFor(name);
  if(filterFn)matches=matches.filter(filterFn);
  var wins=0,losses=0;
  matches.forEach(function(c){
    if(_playerWonMatch(c,name))wins++;
    else losses++;
  });
  var streak=_computeStreakFromMatches(matches,name,false);
  var total=wins+losses;
  var winRate=total?Math.round(wins/total*100):0;
  return {wins:wins,losses:losses,total:total,winRate:winRate,currentStreak:streak.currentStreak,maxStreak:streak.maxStreak};
}
export function _countSeasonChampionships(name){
  return seasons().filter(function(s){
    return s.status==='ended'&&s.champion&&s.champion.name===name;
  }).length;
}
export function _countTournamentWins(name){
  var n=0;
  tournaments().forEach(function(t){
    if(t.winner===name||t.champion===name)n++;
  });
  chal().forEach(function(c){
    if(c.status!=='completed'||(!c.tournamentId&&!c.isTournament))return;
    if(_playerWonAnyMatch(c,name))n++;
  });
  return n;
}
const BADGE_DEFS=[
  {id:'first_win',icon:'🏅',label:'첫 승',desc:'첫 승리 달성',check:function(s,ctx){return s.wins>=1;}},
  {id:'streak5',icon:'🔥',label:'5연승',desc:'5연승 달성',check:function(s){return s.maxStreak>=5;}},
  {id:'streak10',icon:'🔥',label:'10연승',desc:'10연승 달성',check:function(s){return s.maxStreak>=10;}},
  {id:'games50',icon:'⚔️',label:'50경기',desc:'50경기 달성',check:function(s){return s.total>=50;}},
  {id:'games100',icon:'💯',label:'100경기',desc:'100경기 달성',check:function(s){return s.total>=100;}},
  {id:'tournament',icon:'🏆',label:'토너먼트 우승',desc:'토너먼트 우승',check:function(s,ctx){return ctx.tournamentWins>0;}},
  {id:'season_champion',icon:'👑',label:'시즌 챔피언',desc:'시즌 우승',check:function(s,ctx){return ctx.seasonChampions>0;}}
];
export function _computeMemberBadges(name){
  var rec=_computeCombinedRecord(name);
  var ctx={tournamentWins:_countTournamentWins(name),seasonChampions:_countSeasonChampionships(name)};
  return BADGE_DEFS.filter(function(b){return b.check(rec,ctx);});
}
export function _buildMemberBadgesHtml(name){
  var badges=_computeMemberBadges(name);
  if(!badges.length){
    return '<div class="stat-box" style="text-align:center;color:var(--t3);font-size:13px">아직 획득한 배지가 없습니다</div>';
  }
  return '<div class="stat-box"><div class="stat-box-t">🏅 보유 배지 '+badges.length+'개</div>'
    +'<div class="badge-grid">'+badges.map(function(b){
      return '<div class="member-badge" title="'+b.desc+'"><span class="member-badge-icon">'+b.icon+'</span><span class="member-badge-lbl">'+b.label+'</span></div>';
    }).join('')+'</div></div>';
}