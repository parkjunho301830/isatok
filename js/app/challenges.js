/**
 * 대결 탭·바텀시트·결과 입력·내기·카카오 공유
 */
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SITE_ORIGIN, KAKAO_JS_KEY } from './version.js?v=2026.06.26.10';
import {
  COL_CHALLENGES, COL_MEMBERS,
  PT_INDIVIDUAL_WIN, PT_INDIVIDUAL_LOSS, PT_DOUBLE_WIN, PT_DOUBLE_LOSS,
  OPEN_CHALLENGE_EXPIRE_MS,
  DEEPLINK_PARAM, DEEPLINK_TAB_DELAY_PC, DEEPLINK_TAB_DELAY_MOBILE,
  DEEPLINK_MAX_WAIT_PC, DEEPLINK_MAX_WAIT_MOBILE,
  HIGHLIGHT_REMOVE_MS,
  TOAST_DURATION_MS, BS_ANIM_MS,
  DRUM_ITEM_H,
  CHALLENGES_LIST_DISPLAY_STEP,
  COLOR_DANGER, COLOR_WARNING, COLOR_GRAY
} from './constants.js?v=2026.06.26.10';
import {
  loadMoreChallenges as fetchMoreChallengesPage,
  hasMoreChallenges,
  isChallengesLoadingMore,
  ensureChallengeById
} from './firebaseApp.js?v=2026.06.26.10';
import { isKakaoInApp } from './pwa.js?v=2026.06.26.10';
import {
  renderChHomeShortcuts,
  wizResetFlow, wizRenderStep, wizValidateStep, saveWizRecentCombos, wizPrefillEdit,
  requireMyPlayer, validateMyPlayer, buildCreatorFields, formatChallengeCreatorHtml,
  shouldSkipInstantMyTeamStep
} from './wizard.js?v=2026.06.26.10';
import { _isDoublesType, _memberPt, _calcGrade } from './memberCore.js?v=2026.06.26.10';
import { _memberGrade } from './memberUtils.js?v=2026.06.26.10';
import { _matchMemberSearch, _getRecentPlayers, _saveRecentPlayers } from './membersTab.js?v=2026.06.26.10';
import { registerOverlay, unregisterOverlay } from './backNav.js?v=2026.06.26.10';

let C = null;
const BS_BACK_KEY = 'bs';

export const TM = {
  ms:{lb:'🏓 남단식', badge:'bg', cls:'ms', maxM:1,maxO:1, gM:'남성',gO:'남성'},
  md:{lb:'🏓 남복식', badge:'bb', cls:'md', maxM:2,maxO:2, gM:'남성',gO:'남성'},
  fs:{lb:'🎀 여단식', badge:'br', cls:'fs', maxM:1,maxO:1, gM:'여성',gO:'여성'},
  fd:{lb:'🎀 여복식', badge:'bp', cls:'fd', maxM:2,maxO:2, gM:'여성',gO:'여성'},
  mx:{lb:'🤝 혼합복식',badge:'ba', cls:'mx', maxM:2,maxO:2, mix:true},
  singles:{lb:'🏓 단식', badge:'bg', cls:'singles', maxM:1,maxO:1},
  doubles:{lb:'🤝 복식', badge:'bp', cls:'doubles', maxM:2,maxO:2},
};
export const GM = {
  bo1:{max:1,wins:1,lb:'단판 승부',short:'1판 1선승'},
  bo3:{max:3,wins:2,lb:'3판 2선승',short:'3판 2선승'},
  bo5:{max:5,wins:3,lb:'5판 3선승',short:'5판 3선승'},
  bo7:{max:7,wins:4,lb:'7판 4선승',short:'7판 4선승'}
};
const SL={pending:'⏳ 수락 대기',accepted:'✅ 수락됨',rejected:'❌ 거절됨',completed:'🏆 완료'};
const SB={pending:'ba',accepted:'bg',rejected:'br',completed:'bz'};
const PT = {
  individual:{win:PT_INDIVIDUAL_WIN,loss:PT_INDIVIDUAL_LOSS},
  double:{win:PT_DOUBLE_WIN,loss:PT_DOUBLE_LOSS}
};
const INSTANT_CREATE_ALLOWED = true;


// _sets: 결과 입력 모달에서 추가된 세트별 점수 배열 [{a:숫자, b:숫자}, ...]
let _sets=[];
// _gameMode: 경기 방식 (null=미선택, 'bo1'|'bo3'|'bo5'|'bo7')
let _gameMode=null;
let _bsGameMode='bo1';
let _bsCreateMode='normal';
let _type='md',_my=[],_opp=[];
// _editChId: 대기 중 대결 신청 수정 시 편집 대상 ID (null이면 신규)
let _editChId=null;
// _bet: 내기 제목 선택 ('' = 없음, 'coffee' = 커피 내기, 'jjajang' = 짜장면 내기)
let _bet='';
// _betPickId: 현재 내기 참여 중인 챌린지 ID
// _betPickSide: 예측 선택 ('a' or 'b')
let _betPickId=null,_betPickSide=null;
// _scA, _scB: 드럼롤 피커 점수 변수
let _scA=0,_scB=0;
// _resEditMode: 완료된 경기 결과 수정 여부
let _resEditMode=false;
// 바텀시트 선수 검색: IME 조합·포커스 경쟁 시 DOM 재렌더 방지
let _bsSearchComposing=false;
let _bsGridRefreshPending=false;
let _bsSearchRaf=null;
let _bsSearchInited=false;
let _bsAnimating=false;
let _bsSearchBodyUnlocked=false;
let _bsLockTimer=null;

let _cf='all',_rid=null,_rw=null;
let _chShowCount=CHALLENGES_LIST_DISPLAY_STEP;
let _chLastFilteredTotal=0;
let _chAutoLoadBusy=false;
let _chLoadObserver=null;
let _resInputMode='winner';
let _setWinsA=0,_setWinsB=0;
let _setRowCount=3;
let _setWinPick=[];
let _scLblA='A팀',_scLblB='B팀';
let _instantCreate=false;
let _acceptOpenId=null;
let _acceptTeam=[];
let _resultFormMountedInWizard=false;
var _drumsInited=false;
let _deepLinkTargetId=null;
const LS_DEEPLINK_MATCH='isatok_deeplink_match';

export function isBSOpen(){
  var bs=g('bs-ch');
  return bs&&bs.classList.contains('on');
}
export function handleBsBackPress(){
  if(!isBSOpen())return false;
  var step=_getCurrentBsStep();
  if(step>1){
    if(_isInstantCreateMode()&&!_editChId&&step===3&&shouldSkipInstantMyTeamStep()){
      window.bsStepInstantBack();
    }else if(_editChId&&step===4){
      window.bsStepPrevFrom4();
    }else{
      window.bsStep(step-1);
    }
    return 'step';
  }
  window.closeBS(true);
  return 'close';
}
export function isBSFocused(){
  if(!isBSOpen())return false;
  var focused=document.activeElement;
  return focused&&g('bs-ch').contains(focused);
}
function _isBsPlayerSearchFocused(){
  var ae=document.activeElement;
  return ae&&(ae.id==='bs-search-my'||ae.id==='bs-search-opp');
}
export function isBsPlayerSearchActive(){
  if(_bsSearchComposing)return true;
  return _isBsPlayerSearchFocused();
}
function _unlockBodyForBsSearch(){
  if(C.getBodyScrollLock()>0&&!_bsSearchBodyUnlocked){
    unlockBodyScroll();
    _bsSearchBodyUnlocked=true;
  }
}
function _relockBodyAfterBsSearch(){
  if(!_bsSearchBodyUnlocked)return;
  _bsSearchBodyUnlocked=false;
  if(isBSOpen()&&!_isBsPlayerSearchFocused())lockBodyScroll();
}
function _cancelBsLockTimer(){
  if(_bsLockTimer){
    clearTimeout(_bsLockTimer);
    _bsLockTimer=null;
  }
}
function _resetBsScrollState(){
  _cancelBsLockTimer();
  _bsAnimating=false;
  _bsSearchBodyUnlocked=false;
  var sheet=g('bs-ch');
  if(sheet)sheet.classList.remove('bs-ready');
}

export function isBsFormInputFocused(){
  if(!isBSOpen())return false;
  var ae=document.activeElement;
  if(!ae||!g('bs-ch').contains(ae))return false;
  if(ae.id==='bs-search-my'||ae.id==='bs-search-opp')return false;
  var tag=ae.tagName;
  return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';
}
export function deferBsGridRefresh(){
  _bsGridRefreshPending=true;
}
export function flushBsGridIfPending(){
  if(!_bsGridRefreshPending||!isBSOpen())return;
  if(_isBsPlayerSearchActive())return;
  _bsGridRefreshPending=false;
  renderGridsBS({force:true});
}
export function applyChallengesSnapshotRender(){
  if(isScrolling()){markPendingChallengeRender();markPendingDeepLink();return;}
  if(getPendingDeepLinkFilter()){
    applyDeepLinkFilter(getPendingDeepLinkFilter());
    setPendingDeepLinkFilter(null);
  }
  if(!isDeepLinkHandled()){
    var matchId=peekDeepLinkMatchIdLocal();
    if(matchId){
      var matchCh=chal().find(function(x){return x.id===matchId;});
      if(matchCh)window.setF(shareFilterFor(matchCh));
    }
  }
  if(getCurrentPage()==='challenge'&&!isBSFocused())renderC();
  if(getCurrentPage()==='ranking')renderR();
  if(getCurrentPage()==='hall')renderHall();
  refreshPlayerProfileIfOpen();
  if(getDeepLinkCh()){
    var targetId=getDeepLinkCh();
    requestAnimationFrame(function(){
      scrollToChallenge(targetId);
      setDeepLinkCh(null);
    });
  }
  handleDeepLink();
}
function peekDeepLinkMatchIdLocal(){
  if(_deepLinkTargetId)return _deepLinkTargetId;
  var matchId=null;
  try{
    matchId=new URLSearchParams(window.location.search).get(DEEPLINK_PARAM);
    if(!matchId)matchId=sessionStorage.getItem(LS_DEEPLINK_MATCH);
  }catch(e){}
  if(matchId)_deepLinkTargetId=matchId;
  return matchId;
}
function stashDeepLinkMatchIdLocal(matchId){
  if(!matchId)return;
  _deepLinkTargetId=matchId;
  try{sessionStorage.setItem(LS_DEEPLINK_MATCH,matchId);}catch(e){}
}
function clearDeepLinkMatchIdLocal(){
  _deepLinkTargetId=null;
  try{sessionStorage.removeItem(LS_DEEPLINK_MATCH);}catch(e){}
}
/**
 * 대결 카드로 스크롤하고 하이라이트 효과를 적용한다.
 * @param {string} id - Firestore 대결 문서 ID
 */
export function scrollToChallenge(id){
  var sel="[data-match-id='"+cssEscape(id)+"']";
  var el=document.querySelector(sel)||document.querySelector('[data-cid="'+cssEscape(id)+'"]');
  if(!el)return;
  scrollToElement(el);
  el.classList.add('ch-highlight');
  setTimeout(function(){el.classList.remove('ch-highlight');},2800);
}
export function handleDeepLink(){
  if(isDeepLinkHandled()||isDeepLinkInFlight())return;

  var matchId=peekDeepLinkMatchIdLocal();
  if(!matchId)return;

  setDeepLinkInFlight(true);
  stashDeepLinkMatchIdLocal(matchId);

  function runDeepLinkNav(){
    var c=chal().find(function(x){return x.id===matchId;});
    if(c)window.setF(shareFilterFor(c));

    history.replaceState(null,'','/');

    nav('challenge');
    if(getCurrentPage()==='challenge'&&!isBSFocused())renderC();

    var isMobile=isMobileUa();
    var tabDelay=isMobile?DEEPLINK_TAB_DELAY_MOBILE:DEEPLINK_TAB_DELAY_PC;
    var maxWait=isMobile?DEEPLINK_MAX_WAIT_MOBILE:DEEPLINK_MAX_WAIT_PC;

    setTimeout(function(){
      var selector="[data-match-id='"+CSS.escape(matchId)+"']";

      waitForElement(selector,function(el){
        setDeepLinkHandled(true);
        clearDeepLinkMatchIdLocal();
        scrollToElement(el);
        el.classList.add('deep-link-highlight');
        setTimeout(function(){el.classList.remove('deep-link-highlight');},HIGHLIGHT_REMOVE_MS);
      },maxWait,function(){
        setDeepLinkHandled(true);
        clearDeepLinkMatchIdLocal();
      });
    },tabDelay);
  }

  if(!chal().find(function(x){return x.id===matchId;})){
    ensureChallengeById(matchId).then(function(found){
      if(!found||!chal().find(function(x){return x.id===matchId;})){
        setDeepLinkHandled(true);
        clearDeepLinkMatchIdLocal();
        setDeepLinkInFlight(false);
        return;
      }
      runDeepLinkNav();
    });
    return;
  }
  runDeepLinkNav();
}
// ── selectBet: 내기 제목 칩 버튼 선택 처리
function selectBet(btn){
  var chips = document.querySelectorAll('#bet-chips .msg-chip');
  chips.forEach(function(c){ c.classList.remove('on'); });
  btn.classList.add('on');
  _bet = btn.dataset.bet || '';
}
function _parseExpiresMs(expiresAt){
  if(!expiresAt)return null;
  if(typeof expiresAt.toDate==='function')return expiresAt.toDate().getTime();
  if(typeof expiresAt==='number')return expiresAt;
  var t=new Date(expiresAt).getTime();
  return isNaN(t)?null:t;
}
/**
 * 오픈 챌린지가 아직 유효한지(만료 전·대기 중) 판별한다.
 * @param {object} c - 대결 객체
 * @returns {boolean}
 */
function _isOpenChallengeActive(c){
  if(!c||!c.isOpen||c.status!=='pending')return true;
  if(!c.expiresAt)return true;
  var ms=_parseExpiresMs(c.expiresAt);
  if(ms==null)return true;
  return ms>Date.now();
}
/**
 * 오픈 챌린지 만료까지 남은 시간 문구를 반환한다.
 * @param {*} expiresAt - expiresAt 필드 값
 * @returns {{text: string, urgent: boolean}|null}
 */
export function getRemainingTime(expiresAt){
  if(!expiresAt)return null;
  var expireMs=_parseExpiresMs(expiresAt);
  if(expireMs==null)return null;
  var diff=expireMs-Date.now();
  if(diff<=0)return {text:'⏰ 마감됨',urgent:true};
  var hours=Math.floor(diff/(1000*60*60));
  var days=Math.floor(hours/24);
  if(days>=1)return {text:'⏳ '+days+'일 후 마감',urgent:false};
  if(hours>=1)return {text:'⏳ '+hours+'시간 후 마감',urgent:true};
  return {text:'⏳ 곧 마감',urgent:true};
}
function _formatExpireDateTime(expiresAt){
  var ms=_parseExpiresMs(expiresAt);
  if(ms==null)return null;
  return new Date(ms).toLocaleString('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
function _shareApplicantName(c,v){
  var team=c.myTeam||[];
  return team[0]||v.myT||'미정';
}
function _shareOpponentName(c,v){
  if(v.isOpen)return '누구나';
  var team=c.oppTeam||[];
  return team[0]||v.opT||'미정';
}
function _shareDateTimeStr(c){
  var dtStr=c.date?$ko(c.date+'T00:00'):'';
  return (dtStr||'날짜 미정')+(c.time?' '+c.time:'');
}
function _nowDateTimeFields(){
  var now=new Date();
  return{
    date:now.toISOString().slice(0,10),
    time:String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')
  };
}
function _clearBsPlayerSearch(){
  ['bs-search-my','bs-search-opp'].forEach(function(id){
    var el=g(id);if(el)el.value='';
  });
}
function _scheduleBsPlayerSearchRender(){
  if(_bsSearchComposing)return;
  if(_bsSearchRaf)cancelAnimationFrame(_bsSearchRaf);
  _bsSearchRaf=requestAnimationFrame(function(){
    _bsSearchRaf=null;
    if(_bsSearchComposing)return;
    renderGridsBS({fromSearch:true});
  });
}
function onBsPlayerSearch(){
  _scheduleBsPlayerSearchRender();
};
function _focusBsSearchInput(el){
  if(!el||!isBSOpen())return;
  _unlockBodyForBsSearch();
  var run=function(){
    if(!isBSOpen())return;
    try{el.focus({preventScroll:true});}
    catch(e){el.focus();}
  };
  if(_bsAnimating){
    _cancelBsLockTimer();
    _bsLockTimer=setTimeout(function(){
      _bsLockTimer=null;
      _bsAnimating=false;
      var sheet=g('bs-ch');
      if(sheet)sheet.classList.add('bs-ready');
      run();
      if(isBSOpen()&&!_isBsPlayerSearchFocused())lockBodyScroll();
    },BS_ANIM_MS+40);
    return;
  }
  run();
}
export function initBsPlayerSearchInputs(){
  if(_bsSearchInited)return;
  _bsSearchInited=true;
  ['bs-search-my','bs-search-opp'].forEach(function(id){
    var el=g(id);
    if(!el)return;
    el.addEventListener('compositionstart',function(){
      _bsSearchComposing=true;
    });
    el.addEventListener('compositionupdate',function(){
      _bsSearchComposing=true;
    });
    el.addEventListener('compositionend',function(){
      _bsSearchComposing=false;
      _scheduleBsPlayerSearchRender();
    });
    el.addEventListener('touchstart',function(e){
      _deferBsGridRefresh();
      if(_bsAnimating){
        e.preventDefault();
        _focusBsSearchInput(el);
      }else{
        _unlockBodyForBsSearch();
      }
    },{passive:false});
    el.addEventListener('focus',function(){
      _unlockBodyForBsSearch();
      if(_bsAnimating){
        el.blur();
        _focusBsSearchInput(el);
      }
    });
    el.addEventListener('blur',function(){
      var inp=el;
      setTimeout(function(){
        if(document.activeElement===inp)return;
        _relockBodyAfterBsSearch();
        _flushBsGridIfPending();
        if(isBSOpen())renderGridsBS({force:true});
      },150);
    });
    el.addEventListener('input',function(){
      if(_bsSearchComposing)return;
      _scheduleBsPlayerSearchRender();
    });
  });
}
function patchMc2Grid(gr, items, emptyMsg){
  if(!gr)return;
  var existingMap={};
  Array.from(gr.querySelectorAll('[data-mname]')).forEach(function(el){
    existingMap[el.dataset.mname]=el;
  });
  var needed=items.map(function(x){return x.name;});
  Object.keys(existingMap).forEach(function(nm){
    if(needed.indexOf(nm)<0)gr.removeChild(existingMap[nm]);
  });
  if(!items.length){
    gr.innerHTML='<div style="color:var(--t3);font-size:12px;padding:8px">'+emptyMsg+'</div>';
    return;
  }
  items.forEach(function(x,idx){
    var existing=existingMap[x.name];
    if(existing){
      if(existing.className!==x.cls)existing.className=x.cls;
      if(x.onclick)existing.setAttribute('onclick',x.onclick);
      else existing.removeAttribute('onclick');
      var cur=gr.children[idx];
      if(cur!==existing)gr.insertBefore(existing,cur||null);
    }else{
      var div=document.createElement('div');
      div.className=x.cls;
      div.dataset.mname=x.name;
      if(x.onclick)div.setAttribute('onclick',x.onclick);
      div.innerHTML='<div class="mn">'+x.name+'</div>'
        +'<div class="ms2">'+x.subtext+'</div>';
      gr.insertBefore(div,gr.children[idx]||null);
    }
  });
}
// ════════════════════════════════════════════════════════
// 📱 대결 신청 Bottom Sheet 전용 함수
// ────────────────────────────────────────────────────────
// visualViewport 이벤트 방식 완전 제거:
//   position:fixed;bottom:0 구조이므로 키보드가 올라와도
//   레이아웃 변동이 없어 깜빡임 자체가 발생하지 않음
// ════════════════════════════════════════════════════════

var _bsSwipeInited=false,_bsClosing=false;
var BS_DISMISS_VEL=0.55; // px/ms — 빠른 아래 flick 시 닫기

function _getActiveBSBody(){
  for(var i=4;i>=1;i--){
    var s=g('bs-step'+i);
    if(s&&s.style.display!=='none')return s;
  }
  return g('bs-step1');
}

function _isBSInteractive(target){
  if(!target||!target.closest)return false;
  var tag=target.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||tag==='BUTTON'||tag==='LABEL')return true;
  return!!target.closest('.mc-btn,.msg-chip,.tb,.mc2,.oc-toggle-wrap,.gm-card,.ch-create-mode,.sw,.btn');
}

function _applyBSDragOffset(sheet,overlay,y,sheetH){
  sheet.style.transform='translateY('+y+'px)';
  if(!overlay)return;
  var h=sheetH||sheet._bsDragH||400;
  var p=Math.min(1,y/(h*0.45));
  overlay.style.opacity=String(Math.max(0,1-p));
}

function _resetBSDragStyles(sheet,overlay){
  if(sheet){
    sheet.style.transform='';
    sheet.style.transition='';
    sheet.classList.remove('bs-dragging');
  }
  if(overlay){
    overlay.style.opacity='';
    overlay.style.transition='';
    overlay.classList.remove('bs-dragging');
  }
}

function _initBSSwipe(){
  if(_bsSwipeInited)return;
  var sheet=g('bs-ch'),overlay=g('bs-overlay');
  if(!sheet||!overlay)return;
  _bsSwipeInited=true;

  var drag={
    active:false,mode:null,startY:0,curY:0,
    lastY:0,lastT:0,vel:0,sheetH:400
  };

  function canSheetDrag(target){
    if(target&&target.closest&&target.closest('.bs-drag-zone,.bs-steps,.bs-foot'))return true;
    var body=_getActiveBSBody();
    return!body||body.scrollTop<=0;
  }

  function onStart(clientY,target){
    if(_bsClosing||!sheet.classList.contains('on'))return;
    if(_isBSInteractive(target))return;
    drag.active=true;
    drag.mode=null;
    drag.startY=clientY;
    drag.curY=0;
    drag.lastY=clientY;
    drag.lastT=Date.now();
    drag.vel=0;
  }

  function onMove(clientY,e){
    if(!drag.active)return;
    var now=Date.now();
    var dt=now-drag.lastT;
    if(dt>0)drag.vel=(clientY-drag.lastY)/dt;
    drag.lastY=clientY;
    drag.lastT=now;

    var totalDy=clientY-drag.startY;
    if(drag.mode===null){
      if(Math.abs(totalDy)<8)return;
      if(totalDy>0&&canSheetDrag(e&&e.target)){
        drag.mode='sheet';
        drag.sheetH=sheet.offsetHeight||400;
        sheet._bsDragH=drag.sheetH;
        sheet.classList.add('bs-dragging');
        overlay.classList.add('bs-dragging');
        sheet.style.transition='none';
        overlay.style.transition='none';
      }else{
        drag.mode='scroll';
        drag.active=false;
        return;
      }
    }
    if(drag.mode!=='sheet')return;

    drag.curY=Math.max(0,totalDy);
    _applyBSDragOffset(sheet,overlay,drag.curY,drag.sheetH);
    if(e&&e.cancelable)e.preventDefault();
  }

  function onEnd(){
    if(!drag.active)return;
    var wasSheet=drag.mode==='sheet';
    var y=drag.curY;
    var vel=drag.vel;
    drag.active=false;
    drag.mode=null;
    sheet.classList.remove('bs-dragging');
    overlay.classList.remove('bs-dragging');
    sheet.style.transition='';
    overlay.style.transition='';

    if(!wasSheet)return;

    var threshold=Math.min(120,drag.sheetH*0.22);
    if(y>=threshold||vel>BS_DISMISS_VEL){
      _resetBSDragStyles(sheet,overlay);
      closeBS();
      return;
    }
    sheet.style.transition='transform .28s cubic-bezier(.32,.72,0,1)';
    overlay.style.transition='opacity .28s ease';
    _applyBSDragOffset(sheet,overlay,0,drag.sheetH);
    setTimeout(function(){_resetBSDragStyles(sheet,overlay);},280);
  }

  function _bindBSDismissMove(el){
    if(!el)return;
    el.addEventListener('touchmove',function(e){
      if(_isBSInteractive(e.target))return;
      onMove(e.touches[0].clientY,e);
    },{passive:false});
  }

  sheet.addEventListener('touchstart',function(e){
    onStart(e.touches[0].clientY,e.target);
  },{passive:true});
  sheet.addEventListener('touchend',function(){onEnd();});
  sheet.addEventListener('touchcancel',function(){onEnd();});
  _bindBSDismissMove(g('bs-drag-zone'));
  _bindBSDismissMove(sheet.querySelector('.bs-steps'));
  _bindBSDismissMove(sheet.querySelector('.bs-foot'));
  for(var si=1;si<=4;si++)_bindBSDismissMove(g('bs-step'+si));

  sheet.addEventListener('mousedown',function(e){
    if(e.button!==0||_isBSInteractive(e.target))return;
    onStart(e.clientY,e.target);
    e.preventDefault();
  });
  document.addEventListener('mousemove',function(e){
    if(drag.active)onMove(e.clientY,null);
  });
  document.addEventListener('mouseup',function(){
    if(drag.active)onEnd();
  });
}

function _showBS(){
  _initBSSwipe();
  var sheet=g('bs-ch'),overlay=g('bs-overlay');
  if(!sheet||!overlay)return;
  _bsClosing=false;
  _resetBsScrollState();
  _bsAnimating=true;
  sheet.classList.remove('bs-ready');
  _resetBSDragStyles(sheet,overlay);
  overlay.classList.add('on');
  sheet.classList.remove('on');
  void sheet.offsetHeight;
  requestAnimationFrame(function(){sheet.classList.add('on');});
  registerOverlay(BS_BACK_KEY, function () {
    window.closeBS(true);
  });
  _bsLockTimer=setTimeout(function(){
    _bsLockTimer=null;
    _bsAnimating=false;
    sheet.classList.add('bs-ready');
    if(isBSOpen()&&!_isBsPlayerSearchFocused())lockBodyScroll();
  },BS_ANIM_MS);
}

function _hideBS(done){
  var sheet=g('bs-ch'),overlay=g('bs-overlay');
  if(!sheet||!overlay){if(done)done();return;}
  if(_bsClosing){if(done)done();return;}
  if(!sheet.classList.contains('on')&&!overlay.classList.contains('on')){
    if(done)done();return;
  }
  _cancelBsLockTimer();
  _bsAnimating=false;
  _bsClosing=true;
  _resetBSDragStyles(sheet,overlay);
  sheet.classList.remove('on');
  overlay.classList.remove('on');
  setTimeout(function(){
    _bsClosing=false;
    _resetBSDragStyles(sheet,overlay);
    if(done)done();
  },BS_ANIM_MS);
}

// ── 바텀시트 열기 (신규 신청)
window.openBS = function(){
  if(!requireMyPlayer())return;
  var sheet=g('bs-ch');
  if(sheet)sheet.classList.remove('bs-ch--instant');
  _editChId = null;
  _my = []; _opp = [];
  var chk = g('oc-chk');
  if(chk) chk.checked = false;
  var wrap = g('oc-toggle-wrap');
  if(wrap){ wrap.classList.remove('on'); wrap.style.display = ''; }
  var submitBtn = g('ch-submit-btn');
  if(submitBtn) submitBtn.textContent = '🏓 도전장 보내기';
  var bsTitleEm = g('bs-ch') && g('bs-ch').querySelector('.bs-title em');
  if(bsTitleEm) bsTitleEm.textContent = '신청';
  const d = new Date(); d.setDate(d.getDate() + 1);
  var dateEl=g('ch-date');if(dateEl)dateEl.value=d.toISOString().slice(0,10);
  var timeEl=g('ch-time');if(timeEl)timeEl.value='10:00';
  _bet = '';
  _resetBsCreateUI();
  setChCreateMode('normal');
  setBsGameMode('bo1');
  wizResetFlow(false);
  _syncBsFootNav();
  bsStep(1);
  _showBS();
};

window.openInstantBS=function(opts){
  if(!requireMyPlayer())return;
  opts=opts||{};
  _editChId=null;
  if(!opts.keepTeams){_my=[];_opp=[];}
  var chk=g('oc-chk');
  if(chk)chk.checked=false;
  var wrap=g('oc-toggle-wrap');
  if(wrap){wrap.classList.remove('on');wrap.style.display='none';}
  var submitBtn=g('ch-submit-btn');
  if(submitBtn){
    submitBtn.textContent='🏆 결과 저장';
    submitBtn.classList.add('ch-submit-save');
  }
  var bsTitleEm=g('bs-ch')&&g('bs-ch').querySelector('.bs-title em');
  if(bsTitleEm)bsTitleEm.textContent='등록';
  var sheet=g('bs-ch');
  if(sheet)sheet.classList.add('bs-ch--instant');
  _bet='';
  _resetBsCreateUI();
  setChCreateMode('instant');
  setBsGameMode('bo1');
  var now=_nowDateTimeFields();
  var dateEl=g('ch-date');if(dateEl)dateEl.value=now.date;
  var timeEl=g('ch-time');if(timeEl)timeEl.value=now.time;
  if(!opts.keepTeams)wizResetFlow(true);
  _syncBsFootNav();
  bsStep(shouldSkipInstantMyTeamStep()?3:2);
  _showBS();
};

window.setBsGameMode=function(mode){
  if(!GM[mode])return;
  _bsGameMode=mode;
  _applyBsGameModeUI(mode);
};
function _applyBsGameModeUI(mode){
  ['bo1','bo3','bo5','bo7'].forEach(function(m){
    var btn=g('bs-gm-'+m);
    if(btn)btn.classList.toggle('on',m===mode);
  });
}
window.setChCreateMode=function(mode){
  if(!INSTANT_CREATE_ALLOWED&&mode==='instant')return;
  var isOpen=g('oc-chk')&&g('oc-chk').checked;
  if((isOpen||_editChId)&&mode==='instant')return;
  _bsCreateMode=mode;
  _instantCreate=(mode==='instant');
  if(mode==='instant'){
    var ocChk=g('oc-chk'),ocWrap=g('oc-toggle-wrap'),oppSec=g('opp-section');
    if(ocChk&&ocChk.checked){
      ocChk.checked=false;
      if(ocWrap)ocWrap.classList.remove('on');
      if(oppSec)oppSec.style.display='';
    }
  }
  _applyChCreateModeUI();
  _updateChSubmitBtn();
  _syncBsFootNav();
  renderGridsBS({force:true});
};
function _applyChCreateModeUI(){
  var isOpen=g('oc-chk')&&g('oc-chk').checked;
  if(isOpen||_editChId)_bsCreateMode='normal';
  var normalBtn=g('ch-mode-normal'),instantBtn=g('ch-mode-instant');
  var note=g('ch-mode-open-note');
  if(normalBtn)normalBtn.classList.toggle('on',_bsCreateMode==='normal');
  if(instantBtn){
    instantBtn.classList.toggle('on',_bsCreateMode==='instant');
    instantBtn.classList.toggle('disabled',isOpen||!!_editChId);
  }
  if(note)note.style.display=(isOpen&&!_editChId)?'block':'none';
}
function _renderBsSummary(){
  var box=g('bs-summary');
  if(!box)return;
  var tm=TM[_type]||TM.ms;
  var isOpen=g('oc-chk')&&g('oc-chk').checked;
  var gm=GM[_bsGameMode]||GM.bo1;
  var my=_my.join(' · ')||'—';
  var opp=isOpen?'오픈 (누구나)':(_opp.join(' · ')||'—');
  var modeLbl=_bsCreateMode==='instant'?'⚡ 즉시 대결':'🏓 일반 대결';
  box.innerHTML='<div><strong>'+my+'</strong> VS <strong>'+opp+'</strong></div>'
    +'<div style="margin-top:6px">'+tm.lb+' · '+gm.lb+' · '+modeLbl+'</div>';
}
window.bsStepNextFrom2=function(){
  if(_editChId)bsStep(4);
  else bsStep(3);
};
window.bsStepPrevFrom4=function(){
  if(_editChId)bsStep(1);
  else bsStep(3);
};

window.openResultPicker=function(){
  if(!requireMyPlayer())return;
  nav('challenge');
  var ready=chal().filter(function(c){return _chResultReady(c);});
  if(!ready.length){
    setF('accepted');
    toast('⚠️ 결과 입력 가능한 대결이 없습니다');
    return;
  }
  if(ready.length===1){
    setF('all');
    openRes(ready[0].id);
    return;
  }
  setF('accepted');
  toast('📝 아래 목록에서 「결과 입력」을 눌러주세요');
};

function _chShareBtn(id){
  return '<button type="button" class="btn btn-g btn-sm cc-aux-btn" onclick="shareKakao(\''+id+'\')" title="카톡 공유" aria-label="카톡 공유"><span class="kt-icon">💬</span></button>';
}
function _chDeleteBtn(id){
  return '<button type="button" class="btn btn-d btn-sm cc-aux-btn" onclick="delC(\''+id+'\')" title="삭제" aria-label="삭제">🗑</button>';
}
function _buildChCardActions(c,isOpen,hasBet){
  var primary='',secondary='',utility='';
  utility+=_chShareBtn(c.id);
  if(isAdmin())utility+=_chDeleteBtn(c.id);
  if(isOpen){
    primary='<button class="btn btn-p cc-primary-btn" onclick="openAcceptOpen(\''+c.id+'\')">🔥 수락하기</button>';
    secondary='<button class="btn btn-g btn-sm" onclick="openEditCh(\''+c.id+'\')">✏️ 수정</button>'
      +'<button class="btn btn-d btn-sm" onclick="rejectC(\''+c.id+'\')">거절</button>';
  }else if(_chPendingAccept(c)){
    primary='<button class="btn btn-p cc-primary-btn" onclick="acceptC(\''+c.id+'\')">✅ 수락</button>';
    secondary='<button class="btn btn-d btn-sm" onclick="rejectC(\''+c.id+'\')">거절</button>'
      +'<button class="btn btn-g btn-sm" onclick="openEditCh(\''+c.id+'\')">✏️ 수정</button>';
  }else if(_chResultReady(c)){
    primary='<button class="btn btn-p cc-primary-btn" onclick="openRes(\''+c.id+'\')">🏆 결과 입력</button>';
    if(hasBet)secondary='<button class="btn btn-w btn-sm" onclick="openBetPick(\''+c.id+'\')">🎯 내기</button>';
  }else if(c.status==='completed'&&isAdmin()){
    primary='<button class="btn btn-p cc-primary-btn" onclick="openRes(\''+c.id+'\')">✏️ 결과 수정</button>';
  }
  return {primary:primary,secondary:secondary,utility:utility};
}
function _chVsTitle(c,isOpen){
  var my=(c.myTeam||[]).join(' · ')||'—';
  if(isOpen)return my+' VS ?';
  var opp=(c.oppTeam||[]).join(' · ')||'—';
  return my+' VS '+opp;
}

// ── 대기 중 대결 신청 수정: 기존 바텀시트 재사용 + 값 복원
window.openEditCh = function(id){
  var c = chal().find(function(x){ return x.id === id; });
  if(!c || c.status !== 'pending') return;

  _editChId = id;
  var isOpen = !!c.isOpen;

  // 오픈 챌린지 토글 복원
  var chk = g('oc-chk');
  var wrap = g('oc-toggle-wrap');
  var oppSec = g('opp-section');
  if(chk) chk.checked = isOpen;
  if(wrap) wrap.classList.toggle('on', isOpen);
  if(oppSec) oppSec.style.display = isOpen ? 'none' : '';

  _type = c.type || 'ms';
  _my = [...(c.myTeam || [])];
  _opp = isOpen ? [] : [...(c.oppTeam || [])];
  wizPrefillEdit(c.type || 'ms', _my, _opp);

  var dateEl=g('ch-date');if(dateEl)dateEl.value=c.date||'';
  var timeEl=g('ch-time');if(timeEl)timeEl.value=c.time||'10:00';

  _bet = c.bet || '';
  document.querySelectorAll('#bet-chips .msg-chip').forEach(function(btn){
    btn.classList.toggle('on', (btn.dataset.bet || '') === _bet);
  });

  ['e-my','e-opp'].forEach(function(eid){ g(eid).classList.remove('on'); });

  var submitBtn = g('ch-submit-btn');
  if(submitBtn) submitBtn.textContent = isOpen ? '💾 오픈 챌린지 수정' : '💾 수정 저장';
  var bsTitleEm = g('bs-ch') && g('bs-ch').querySelector('.bs-title em');
  if(bsTitleEm) bsTitleEm.textContent = '수정';

  _bsGameMode=c.gameMode||'bo1';
  _applyBsGameModeUI(_bsGameMode);
  _bsCreateMode='normal';
  _instantCreate=false;

  bsStep(1);
  _showBS();
}

// ── 바텀시트 닫기
window.closeBS = function(fromBack){
  var wasOpen=isBSOpen();
  if(wasOpen&&!fromBack)unregisterOverlay(BS_BACK_KEY);
  _hideBS(function(){
    _unmountInstantResultForm();
    _editChId = null;
    _bsSearchComposing=false;
    _bsGridRefreshPending=false;
    if(_bsSearchRaf){cancelAnimationFrame(_bsSearchRaf);_bsSearchRaf=null;}
    _resetBsScrollState();
    var submitBtn = g('ch-submit-btn');
    if(submitBtn){
      submitBtn.textContent = '🏓 도전장 보내기';
      submitBtn.classList.remove('ch-submit-save');
    }
    var bsTitleEm = g('bs-ch') && g('bs-ch').querySelector('.bs-title em');
    if(bsTitleEm) bsTitleEm.textContent = '신청';
    var sheet=g('bs-ch');
    if(sheet)sheet.classList.remove('bs-ch--instant');
    _resetBsCreateUI();
    if(wasOpen)requestAnimationFrame(unlockBodyScroll);
    setTimeout(function(){ renderGridsBS(); }, 50);
  });
}

function _getCurrentBsStep(){
  for(var i=1;i<=4;i++){
    var s=g('bs-step'+i);
    if(s&&s.style.display!=='none')return i;
  }
  return 1;
}

// ── STEP 전환 (Wizard 4단계: 유형 → 내팀 → 상대팀 → 결과)
function _syncBsFootNav(){
  var instant=_isInstantCreateMode()&&!_editChId;
  var foot2Next=g('bs-foot2-next');
  if(foot2Next){
    foot2Next.setAttribute('onclick',_editChId?'bsStepNextFrom2()':'bsStep(3)');
    foot2Next.textContent='다음 →';
  }
  var foot3Prev=g('bs-foot3')&&g('bs-foot3').querySelector('.btn-g');
  if(foot3Prev){
    foot3Prev.setAttribute('onclick',instant&&shouldSkipInstantMyTeamStep()?'bsStepInstantBack()':'bsStep(2)');
  }
  var foot4Prev=g('bs-foot4')&&g('bs-foot4').querySelector('.btn-g');
  if(foot4Prev){
    foot4Prev.setAttribute('onclick',_editChId?'bsStepPrevFrom4()':'bsStep(3)');
  }
}
window.bsStepInstantBack=function(){
  if(_isInstantCreateMode()&&!_editChId)closeBS();
  else bsStep(1);
};

window.bsStep = function(n){
  if(_isInstantCreateMode()&&!_editChId&&shouldSkipInstantMyTeamStep()&&n===2)n=3;
  var cur=_getCurrentBsStep();
  if(n>cur&&!wizValidateStep(cur,n))return;
  for(var i=1;i<=4;i++){
    var step=g('bs-step'+i),foot=g('bs-foot'+i);
    if(step)step.style.display=(i===n)?'':'none';
    if(foot)foot.style.display=(i===n)?'flex':'none';
  }
  wizRenderStep(n);
  _syncBsFootNav();
  if(n===4){
    if(_isInstantCreateMode()&&!_editChId){
      var ocWrap=g('oc-toggle-wrap');
      if(ocWrap)ocWrap.style.display='none';
    }
    _updateChSubmitBtn();
    _scrollBsStep(4);
  }
}

function _isInstantCreateMode(){
  if(!INSTANT_CREATE_ALLOWED)return false;
  var isOpen=g('oc-chk')&&g('oc-chk').checked;
  if(isOpen)return false;
  return _bsCreateMode==='instant';
}
function _resetBsCreateUI(){
  _instantCreate=false;
  _bsGameMode='bo1';
  _bsCreateMode='normal';
  _applyBsGameModeUI('bo1');
  _applyChCreateModeUI();
  _updateChSubmitBtn();
  var ocWrap=g('oc-toggle-wrap');
  if(ocWrap)ocWrap.style.display='';
}
function _updateChSubmitBtn(){
  var submitBtn=g('ch-submit-btn');
  if(!submitBtn)return;
  if(_editChId){
    var isOpenEdit=g('oc-chk')&&g('oc-chk').checked;
    submitBtn.textContent=isOpenEdit?'💾 오픈 챌린지 수정':'💾 수정 저장';
    return;
  }
  if(_isInstantCreateMode()){
    submitBtn.textContent='🏆 결과 저장';
    submitBtn.classList.add('ch-submit-save');
    return;
  }
  submitBtn.classList.remove('ch-submit-save');
  var isOpen=g('oc-chk')&&g('oc-chk').checked;
  if(isOpen)submitBtn.textContent='🔥 오픈 챌린지 올리기';
  else submitBtn.textContent='🏓 도전장 보내기';
}
window.updateChSubmitBtn=_updateChSubmitBtn;

// ── 바텀시트 전용 신청 저장 (기존 submitCh 로직 재사용, ID 참조만 동일하게 유지)
window.submitChBS = async function(){
  if(!requireMyPlayer())return;
  var creator=buildCreatorFields();
  if(!creator)return;
  var isOpenMode = g('oc-chk') && g('oc-chk').checked;
  var editId = _editChId;
  var instantMode = !editId && _isInstantCreateMode() && !isOpenMode;
  if(instantMode){
    var tm=_type||'ms';
    var m=TM[tm]||TM.ms;
    if(_opp.length<m.maxO){
      toast('⚠️ 즉시 생성은 상대 팀 선택이 필요합니다');
      return;
    }
    if(!_rw){
      toast('⚠️ 승리 팀을 선택해주세요');
      return;
    }
  }
  var pendingResult=instantMode?_collectPendingResult():null;
  var fields = {
    type: _type,
    myTeam: [..._my],
    oppTeam: isOpenMode ? [] : [..._opp],
    date: (g('ch-date')&&g('ch-date').value)||_nowDateTimeFields().date,
    time: (g('ch-time')&&g('ch-time').value)||'10:00',
    place: '',
    bet: _bet,
    isOpen: !!isOpenMode,
    gameMode: pendingResult?pendingResult.gameMode:(_gameMode||_bsGameMode||'bo1')
  };
  closeBS();
  try {
    if(editId){
      if(db()){
        await updateDoc(doc(db(),COL_CHALLENGES,editId), fields);
      } else {
        var target = chal().find(function(c){ return c.id === editId; });
        if(target) Object.assign(target, fields);
        renderC();
      }
      toast(isOpenMode ? '✏️ 오픈 챌린지가 수정됐습니다!' : '✏️ 대결 신청이 수정됐습니다!');
      return;
    }
  const data = {
    ...fields,
    ...creator,
    betPicks: {},
    status: instantMode ? 'accepted' : 'pending',
    createdAt: new Date().toISOString(),
    winner: null,
    score: null
  };
  if(instantMode){
    data.acceptedAt=new Date().toISOString();
    data.instantCreate=true;
  }
  if(isOpenMode&&!editId){
    data.expiresAt=new Date(Date.now()+OPEN_CHALLENGE_EXPIRE_MS);
  }
    let newId = 'l' + Date.now();
    if(db()){ const ref = await addDoc(collection(db(),COL_CHALLENGES), data); newId = ref.id; }
    else { unshiftChallengeLocal({id: newId, ...data}); renderC(); }
    _saveRecentPlayers([..._my,..._opp]);
    saveWizRecentCombos();
    var saved={id:newId,...data};
    if(instantMode&&pendingResult&&pendingResult.winner){
      try{
        if(db()){
          await updateDoc(doc(db(),COL_CHALLENGES,newId),{status:'completed',winner:pendingResult.winner,score:pendingResult.score});
        }
        saved.status='completed';saved.winner=pendingResult.winner;saved.score=pendingResult.score;
        saved.gameMode=pendingResult.gameMode;
        if(!db()){var loc=chal().find(function(c){return c.id===newId;});if(loc)Object.assign(loc,saved);renderC();}
        await _updateMatchPoints(saved,pendingResult.winner,1);
        var ptDelta=myPointDeltaForResult(saved,pendingResult.winner);
        var myTeamWon=pendingResult.winner==='a';
        var coachMsg=buildPostMatchCoachComment(myTeamWon,ptDelta,saved);
        showInstantRegisterSuccess(myTeamWon,ptDelta,coachMsg,saved);
        if(getCurrentPage()==='ranking')renderR();
        renderMyRecordHome();renderMyPage();renderChHomeShortcuts();
        return;
      }catch(e2){toast('⚠️ 결과 저장 실패 — 결과 입력에서 다시 시도해주세요');}
    }
    if(instantMode){
      toast('✅ 대결 생성! 결과를 입력해 주세요.');
      setTimeout(function(){ openRes(newId); }, 450);
    }else{
      toast(isOpenMode ? '🔥 오픈 챌린지가 등록됐습니다!' : '🏓 도전장을 보냈습니다!');
      setTimeout(function(){ openShareModal({id: newId, ...data}); }, 700);
    }
  } catch(e){ toast('❌ ' + e.message); }
}
// ════ 대결 ════
function _chPendingAccept(c){
  return c.status==='pending'&&!c.isOpen&&!c.instantCreate;
}
function _chResultReady(c){
  return c.status==='accepted'||(c.status==='pending'&&!!c.instantCreate);
}
function _chStatusLabel(c,isOpen){
  if(isOpen)return '⏳ 수락 대기';
  if(c.status==='pending'&&c.instantCreate)return '✅ 진행중';
  return SL[c.status]||c.status;
}
function _chStatusBadge(c,isOpen){
  if(isOpen)return 'ba';
  if(c.status==='pending'&&c.instantCreate)return 'bg';
  return SB[c.status]||'bz';
}

window.setF=function(f){
  _cf=f;
  _chShowCount=CHALLENGES_LIST_DISPLAY_STEP;
  // ★ 성능 최적화: querySelectorAll 결과 캐싱 (setF 호출마다 DOM 탐색 방지)
  if(!window._fcEls)window._fcEls=Array.from(document.querySelectorAll('.fc'));
  window._fcEls.forEach(el=>el.classList.toggle('on',el.id==='f-'+f));
  renderC();
};
function _chHasMoreUi(){
  return hasMoreChallenges()||_chLastFilteredTotal>_chShowCount;
}
async function _loadMoreChallengesCore(){
  if(_chAutoLoadBusy||isChallengesLoadingMore())return;
  if(!_chHasMoreUi())return;
  _chAutoLoadBusy=true;
  _updateChLoadMoreUi(_chLastFilteredTotal);
  try{
    if(hasMoreChallenges())await fetchMoreChallengesPage();
    if(_chLastFilteredTotal>_chShowCount){
      _chShowCount+=CHALLENGES_LIST_DISPLAY_STEP;
      renderC();
    }else{
      _updateChLoadMoreUi(_chLastFilteredTotal);
    }
  }finally{
    _chAutoLoadBusy=false;
    _updateChLoadMoreUi(_chLastFilteredTotal);
  }
}
window.loadMoreChallenges=function(){
  return _loadMoreChallengesCore();
};
function _triggerChAutoLoad(){
  if(getCurrentPage()!=='challenge')return;
  var manage=g('ch-manage');
  if(manage&&!manage.open)return;
  _loadMoreChallengesCore();
}
function _initChLoadObserver(){
  if(_chLoadObserver||typeof IntersectionObserver==='undefined')return;
  var sentinel=g('ch-load-more-sentinel');
  if(!sentinel)return;
  _chLoadObserver=new IntersectionObserver(function(entries){
    if(!entries.some(function(e){return e.isIntersecting;}))return;
    _triggerChAutoLoad();
  },{root:null,rootMargin:'160px 0px 0px',threshold:0});
  _chLoadObserver.observe(sentinel);
}
function _maybeChAutoLoadAfterRender(){
  if(!_chHasMoreUi())return;
  requestAnimationFrame(function(){
    var sentinel=g('ch-load-more-sentinel');
    var wrap=g('ch-load-more-wrap');
    if(!sentinel||!wrap||wrap.style.display==='none')return;
    var rect=sentinel.getBoundingClientRect();
    if(rect.top<=window.innerHeight+160)_triggerChAutoLoad();
  });
}
function _updateChLoadMoreUi(filteredTotal){
  var wrap=g('ch-load-more-wrap');
  if(!wrap)return;
  var show=_chHasMoreUi();
  wrap.style.display=show?'block':'none';
  var status=g('ch-load-more-status');
  if(!status)return;
  if(!show){
    status.hidden=true;
    status.textContent='';
    return;
  }
  if(_chAutoLoadBusy||isChallengesLoadingMore()){
    status.hidden=false;
    status.textContent='불러오는 중…';
  }else{
    status.hidden=true;
    status.textContent='';
  }
}
// ── 오픈 챌린지 대기 중 개수 뱃지 업데이트
function updateOpenBadge(){
  const count=chal().filter(c=>c.isOpen&&c.status==='pending'&&_isOpenChallengeActive(c)).length;
  const btn=g('f-open');
  if(!btn)return;
  // 기존 뱃지 제거
  const prev=btn.querySelector('.oc-cnt');
  if(prev)prev.remove();
  // 1개 이상일 때만 뱃지 표시
  if(count>0){
    const span=document.createElement('span');
    span.className='oc-cnt';
    span.textContent=count;
    span.style.cssText='display:inline-flex;align-items:center;justify-content:center;'+
      'background:var(--amber);color:#000;font-size:11px;font-weight:800;'+
      'min-width:18px;height:18px;border-radius:9px;padding:0 5px;margin-left:5px;line-height:1;';
    btn.appendChild(span);
  }
}

export function renderC(){
  renderChHomeShortcuts();
  const list=g('ch-list'),empty=g('ch-empty');
  // ── 스크롤 중 뱃지 DOM 조작 스킵 (Forced Reflow 방지)
  if(!isScrolling())updateOpenBadge();
  let data=[...chal()];
  data=data.filter(function(c){
    if(!c.isOpen||c.status!=='pending')return true;
    if(!c.expiresAt)return true;
    return _isOpenChallengeActive(c);
  });
  // ── 필터 적용 ──
  if(_cf==='pending')        data=data.filter(c=>c.status==='pending'); // 오픈 챌린지 포함하여 대기중 전체 표시
  else if(_cf==='open')      data=data.filter(c=>c.isOpen&&c.status==='pending'); // 오픈 챌린지 필터
  else if(_cf==='accepted')  data=data.filter(c=>_chResultReady(c));
  else if(_cf==='completed') data=data.filter(c=>c.status==='completed');
  else if(_cf==='ms') data=data.filter(c=>c.type==='ms'||c.type==='singles');
  else if(_cf==='md') data=data.filter(c=>c.type==='md'||c.type==='doubles');
  else if(_cf==='fs') data=data.filter(c=>c.type==='fs');
  else if(_cf==='fd') data=data.filter(c=>c.type==='fd');
  else if(_cf==='mx') data=data.filter(c=>c.type==='mx');
  else if(_cf!=='all') data=data.filter(c=>c.type===_cf);
  var filteredTotal=data.length;
  _chLastFilteredTotal=filteredTotal;
  if(filteredTotal>_chShowCount)data=data.slice(0,_chShowCount);
  if(!data.length){
    // 기존 카드 노드 제거 (깜빡임 없이 개별 제거)
    while(list.firstChild)list.removeChild(list.firstChild);
    empty.style.display='block';
    _updateChLoadMoreUi(filteredTotal);
    return;
  }
  empty.style.display='none';

  // ── diff-patch: DOM 노드를 유지하며 innerHTML만 갱신하여 깜빡임 완전 제거 ──
  // outerHTML 교체는 노드 파괴→생성으로 깜빡임 발생 → innerHTML 갱신 방식으로 변경
  const needed=data.map(c=>c.id);

  // ★ 레이아웃 스래싱 방지: READ를 먼저 모두 수행한 후 WRITE를 일괄 처리
  // PHASE 1: READ - 현재 DOM 상태를 한 번에 읽기 (reflow 1회)
  const existingMap={};
  Array.from(list.children).forEach(el=>{
    existingMap[el.dataset.cid]=el;
  });

  // PHASE 2: WRITE - 불필요한 카드 제거
  Array.from(list.children).forEach(el=>{
    if(!needed.includes(el.dataset.cid))list.removeChild(el);
  });

  // PHASE 3: 해시 계산 (READ only, DOM 접근 없음)
  const hashMap={};
  data.forEach(c=>{
    hashMap[c.id]=c.id+'|'+c.status+'|'+(c.isOpen?'1':'0')+'|'+(c.instantCreate?'1':'0')+'|'+(c.winner||'')+'|'+(c.score||'')+'|'+(c.place||'')+'|'+(c.bet||'')+'|'+JSON.stringify(c.betPicks||{})+'|'+(c.date||'')+'|'+(c.time||'')+'|'+(c.type||'')+'|'+JSON.stringify(c.myTeam||[])+'|'+JSON.stringify(c.oppTeam||[])+'|'+(isAdmin()?'1':'0')+'|'+(c.expiresAt?_parseExpiresMs(c.expiresAt)||'':'');
  });

  // PHASE 4: WRITE - 삽입/업데이트 (children 배열 캐싱으로 반복 layout read 제거)
  var childList=Array.from(list.children);
  data.forEach((c,idx)=>{
    const newHash=hashMap[c.id];
    let existing=existingMap[c.id];
    if(existing){
      existing.dataset.cid=c.id;
      existing.dataset.matchId=c.id;
      if(existing.dataset.chash!==newHash){
        const tmp=document.createElement('div');
        tmp.innerHTML=buildCCard(c);
        const newNode=tmp.firstElementChild;
        existing.className=newNode.className;
        existing.dataset.chash=newHash;
        existing.innerHTML=newNode.innerHTML;
      }
      if(childList[idx]!==existing){
        list.insertBefore(existing,childList[idx]||null);
        childList=Array.from(list.children);
      }
    } else {
      const div=document.createElement('div');
      div.innerHTML=buildCCard(c);
      const node=div.firstElementChild;
      node.dataset.chash=newHash;
      list.insertBefore(node,childList[idx]||null);
      childList=Array.from(list.children);
    }
  });
  _updateChLoadMoreUi(filteredTotal);
  _maybeChAutoLoadAfterRender();
}

// ── 대결 카드 HTML 생성 (renderC에서 분리) ──
function buildCCard(c){
    const tm=TM[c.type]||TM.ms;
    const isOpen=!!c.isOpen&&c.status==='pending';
    const dt=c.date?$ko(c.date+'T00:00'):'';
    // 내기 제목 표시용 텍스트
    const betLabel=c.bet==='coffee'?'☕ 커피 내기':c.bet==='jjajang'?'🍜 짜장면 내기':'';
    const pills=[dt?`<span class="pill">📅 ${dt}</span>`:'',c.time?`<span class="pill">🕐 ${c.time}</span>`:''].filter(Boolean).join('');

    // ── 완료 카드 결과 표시 ──
    var resHtml='';
    if(c.status==='completed'&&c.winner){
      var winnerName=c.winner==='a'?(c.myTeam||[]).join('·'):(c.oppTeam||[]).join('·');
      var scoreHtml='';
      if(c.score){
        var setPattern=/^\d+:\d+$/;
        var parts=c.score.split(',').map(function(s){return s.trim();});
        var isStructured=parts.length>0&&parts.every(function(p){return setPattern.test(p);});
        if(isStructured&&parts.length>1){
          var chips=parts.map(function(p,i){
            var scores=p.split(':');
            var sa=parseInt(scores[0]);
            var sb=parseInt(scores[1]);
            var aWin=sa>sb;
            var bWin=sb>sa;
            return '<span class="cc-score-chip">'
              +'<span class="cc-set-num">'+(i+1)+'G</span>'
              +'<span class="cc-set-a'+(aWin?' win':'')+'">'+sa+'</span>'
              +'<span class="cc-set-colon">:</span>'
              +'<span class="cc-set-b'+(bWin?' win':'')+'">'+sb+'</span>'
              +'</span>';
          }).join('');
          var wA=parts.filter(function(p){var s=p.split(':');return parseInt(s[0])>parseInt(s[1]);}).length;
          var wB=parts.filter(function(p){var s=p.split(':');return parseInt(s[1])>parseInt(s[0]);}).length;
          scoreHtml='<div class="cc-score-wrap">'
            +'<span class="cc-score-summary">'+wA+':'+wB+'</span>'
            +chips+'</div>';
        } else {
          scoreHtml='<span style="color:var(--t3);font-size:13px"> · '+c.score+'</span>';
        }
      }
      resHtml='<div class="cc-result"><span class="cc-result-winner">🏆 '+winnerName+' 팀 승리</span>'+scoreHtml+'</div>';
    }
    const res=resHtml;

    // ── 내기 참여자 표시 (수락됨 이후 + 내기가 있는 경우) ──
    var betPicksHtml='';
    var hasBet=c.bet==='coffee'||c.bet==='jjajang';
    if(hasBet&&(_chResultReady(c)||c.status==='completed')){
      var picks=c.betPicks||{};
      var grouped=_collectBetPickSides(picks);
      var aPickNames=grouped.a;
      var bPickNames=grouped.b;

      // 완료된 경우: 적중/실패 표시
      if(c.status==='completed'&&c.winner){
        var hitSide=c.winner;
        var hitNames=hitSide==='a'?aPickNames:bPickNames;
        var failNames=hitSide==='a'?bPickNames:aPickNames;
        betPicksHtml='<div class="cc-bet-picks cc-bet-picks-compact">'
          +(hitNames.length?'<span class="cc-bet-hit">🎯 적중 '+hitNames.length+'명</span> ':'')
          +(failNames.length?'<span class="cc-bet-miss">💔 빗나감 '+failNames.length+'명</span>':'')
          +'</div>';
      } else {
        betPicksHtml='<div class="cc-bet-picks cc-bet-picks-compact">'
          +betLabel
          +' · <span class="cc-bet-team-a">A '+aPickNames.length+'명</span>'
          +' · <span class="cc-bet-team-b">B '+bPickNames.length+'명</span>'
          +'</div>';
      }
    }

    // ── 오픈 챌린지 뱃지 ──
    const openBadge=isOpen?`<span class="badge badge-open">🔥 오픈 챌린지</span>`:'';
    // 내기 뱃지
    const betBadge=hasBet?`<span class="badge badge-bet">${betLabel}</span>`:'';

    // ── 액션 버튼 (주요 행동 우선) ──
    var cardActs=_buildChCardActions(c,isOpen,hasBet);
    var actsParts='';
    if(cardActs.primary)actsParts+='<div class="cc-primary-row">'+cardActs.primary+'</div>';
    if(cardActs.secondary||cardActs.utility){
      actsParts+='<div class="cc-secondary-row">'
        +(cardActs.secondary||'')
        +(cardActs.utility?'<span class="cc-utility-btns">'+cardActs.utility+'</span>':'')
        +'</div>';
    }

    // ── 카드 클래스: 오픈 챌린지면 'open' 추가 ──
    const cardClass='cc '+tm.cls+(isOpen?' open':' '+c.status);
    var vsTitle=_chVsTitle(c,isOpen);
    var vsParts=vsTitle.split(' VS ');
    var vsHtml=vsParts.length===2
      ?vsParts[0]+'<span class="cc-vs-sep">VS</span>'+vsParts[1]
      :vsTitle;
    var statusBadge='<span class="badge '+_chStatusBadge(c,isOpen)+'">'+_chStatusLabel(c,isOpen)+'</span>';
    var expireHtml='';
    if(isOpen&&c.expiresAt){
      var rem=getRemainingTime(c.expiresAt);
      if(rem){
        var remColor=rem.urgent?COLOR_DANGER:COLOR_WARNING;
        expireHtml='<div class="cc-open-expire" style="font-size:12px;color:'+remColor+';margin-top:8px">'+rem.text+'</div>';
      }
    }
    return `<div class="${cardClass}" data-cid="${c.id}" data-match-id="${c.id}">
      <div class="cc-head"><div class="cc-badges"><span class="badge ${tm.badge}">${tm.lb}</span>${statusBadge}${openBadge}${betBadge}${c.instantCreate&&!isOpen?'<span class="badge bg">⚡ 즉시</span>':''}</div></div>
      <div class="cc-vs-title">${vsHtml}</div>
      ${formatChallengeCreatorHtml(c)}
      ${pills?`<div class="cc-pills">${pills}</div>`:''}
      ${res}
      ${betPicksHtml}
      ${expireHtml}
      <div class="cc-acts">${actsParts}</div>
    </div>`;
}

// ── toggleOC: 오픈 챌린지 토글 처리 ──
window.toggleOC=function(){
  var chk=g('oc-chk');
  var wrap=g('oc-toggle-wrap');
  var isOn=chk.checked;
  wrap.classList.toggle('on',isOn);
  if(isOn){
    setChCreateMode('normal');
    _opp=[];
  }
  _updateChSubmitBtn();
  if(isBSOpen())wizRenderStep(3);
  else renderGridsBS({force:true});
}

window.setType=function(tp){
  _type=tp;_my=[];_opp=[];
  _clearBsPlayerSearch();
  const m=TM[tp]||TM.ms;
  // 버튼 스타일
  ['ms','md','fs','fd','mx'].forEach(k=>{
    const el=g('t-'+k);if(!el)return;
    el.className='tb';
    el.querySelector('.tl').style.color='var(--t2)';
  });
  const clsMap={ms:'as',md:'ad',fs:'af',fd:'af',mx:'am'};
  const clrMap={ms:'var(--a)',md:'var(--blue)',fs:'var(--red)',fd:'var(--purple)',mx:'var(--amber)'};
  const el=g('t-'+tp);
  if(el){el.className='tb '+clsMap[tp];el.querySelector('.tl').style.color=clrMap[tp];}
  const sing=m.maxM===1;
  g('lbl-my').textContent=m.mix?'내 팀 (남1+여1)':sing?`나 선택 (${m.gM||''} 1명)`:`내 팀 (${m.gM||''} 2명)`;
  g('lbl-opp').textContent=m.mix?'상대 팀 (남1+여1)':sing?`상대 (${m.gO||''} 1명)`:`상대 팀 (${m.gO||''} 2명)`;
  renderGridsBS({force:true});
}
// ── renderGridsBS: 바텀시트 내부 회원 그리드 렌더
export function renderGridsBS(opts){
  opts=opts||{};
  var fromSearch=!!opts.fromSearch;
  var force=!!opts.force;
  if(!fromSearch&&!force){
    if(_isBsPlayerSearchActive()){
      _deferBsGridRefresh();
      return;
    }
    if(_isBsFormInputFocused())return;
  }
  var bsEl=g('bs-ch');
  if(bsEl&&bsEl.classList.contains('on')&&fromSearch){
    var ae=document.activeElement;
    if(ae&&ae.id==='bs-search-my'){
      renderGrid('gmy',_my,_opp,true);
      return;
    }
    if(ae&&ae.id==='bs-search-opp'){
      renderGrid('gopp',_opp,_my,false);
      return;
    }
  }
  renderGrid('gmy',_my,_opp,true);
  renderGrid('gopp',_opp,_my,false);
}
// 하위 호환: renderGrids도 renderGridsBS를 참조
function renderGrids(){ renderGridsBS(); }
function renderGrid(gid,sel,other,isMy){
  const gr=g(gid);if(!gr)return;
  const m=TM[_type]||TM.ms;
  const max=isMy?m.maxM:m.maxO;
  var searchInp=g(isMy?'bs-search-my':'bs-search-opp');
  var q=searchInp?searchInp.value.trim():'';
  let mems=members().filter(x=>x.status!=='비활성'&&_matchMemberSearch(x.name,q));
  var isDbl=_isDoublesType(_type);
  var recent=_getRecentPlayers();
  mems.sort(function(a,b){
    var ra=recent.indexOf(a.name),rb=recent.indexOf(b.name);
    if(ra>=0||rb>=0){
      if(ra<0)return 1;
      if(rb<0)return -1;
      if(ra!==rb)return ra-rb;
    }
    return _memberPt(b,isDbl)-_memberPt(a,isDbl)||(a.name||'').localeCompare(b.name||'');
  });
  mems=mems.map(x=>{
    let dim=other.includes(x.name);
    if(!dim&&m.mix){
      const myM=_my.filter(n=>members().find(x=>x.name===n)?.gender==='남성').length;
      const myF=_my.filter(n=>members().find(x=>x.name===n)?.gender==='여성').length;
      const opM=_opp.filter(n=>members().find(x=>x.name===n)?.gender==='남성').length;
      const opF=_opp.filter(n=>members().find(x=>x.name===n)?.gender==='여성').length;
      if(!sel.includes(x.name)){
        if(isMy){if((x.gender==='남성'&&myM>=1)||(x.gender==='여성'&&myF>=1)||sel.length>=max)dim=true;}
        else{if((x.gender==='남성'&&opM>=1)||(x.gender==='여성'&&opF>=1)||sel.length>=max)dim=true;}
      }
    } else if(!dim){
      const gf=isMy?m.gM:m.gO;
      if(!sel.includes(x.name)&&(gf&&x.gender&&x.gender!==gf||sel.length>=max))dim=true;
    }
    return{...x,_d:dim,_recent:recent.indexOf(x.name)>=0};
  });
  const items=mems.map(x=>{
    const sSel=sel.includes(x.name);
    return{
      name:x.name,
      cls:'mc2'+(sSel?(isMy?' sel':' selp'):'')+(x._d?' dim':'')+(x._recent?' mc2-recent':''),
      onclick:x._d?'':'tgl(\''+gid+'\',\''+x.name+'\','+isMy+')',
      subtext:(x._recent?'⭐ ':'')+_calcGrade(_memberPt(x,isDbl)).label+(x.gender?' '+(x.gender==='남성'?'♂':'♀'):'')
    };
  });
  patchMc2Grid(gr,items,q?'검색 결과 없음':'해당 회원 없음');
}
window.tgl=function(gid,name,isMy){
  const arr=isMy?_my:_opp;
  const m=TM[_type]||TM.ms,max=isMy?m.maxM:m.maxO;
  const i=arr.indexOf(name);
  if(i>-1)arr.splice(i,1);else if(arr.length<max)arr.push(name);
  if(isMy)_my=[...arr];else _opp=[...arr];
  renderGridsBS({force:true});
}
// ════ 오픈 챌린지 수락 ════

// ── 오픈 챌린지 수락 모달 열기 ──
// 수락자가 자신의 팀원을 선택한 뒤 확정하는 흐름

window.openAcceptOpen=function(id){
  var c=chal().find(function(c){return c.id===id;});
  if(!c)return;
  _acceptOpenId=id;
  _acceptTeam=[];

  // ── 도전자 팀 정보 배너 표시 ──
  var myNames=(c.myTeam||[]).join(' · ')||'알 수 없음';
  var tm=TM[c.type]||TM.ms;
  var dtStr=c.date?$ko(c.date+'T00:00'):'';
  var infoHtml='<strong>'+myNames+'</strong> 님의 '+tm.lb+' 챌린지'
    +(dtStr?' · 📅 '+dtStr:'');
  g('oc-challenger-info').innerHTML=infoHtml;

  // ── 수락팀 선택 라벨 세팅 ──
  var sing=tm.maxO===1;
  g('lbl-accept-team').textContent=tm.mix?'내 팀 (남1+여1)':sing?'나 선택 ('+(tm.gO||'')+' 1명)':'내 팀 ('+(tm.gO||'')+' 2명)';

  // ── 수락팀 그리드 렌더링 ──
  renderAcceptGrid(c);

  // ── 에러 메시지 / 한마디 초기화 ──
  g('e-accept').classList.remove('on');
  g('accept-msg').value='';

  openMo('mo-accept-open');
}

// ── 오픈 챌린지 수락용 회원 그리드 렌더링 ──
// ★ 성능 최적화: innerHTML 전체 교체 → diff-patch 방식으로 변경 (Forced Reflow 방지)
function renderAcceptGrid(c){
  var gr=g('g-accept');if(!gr)return;
  var tm=TM[c.type]||TM.ms;
  var max=tm.maxO;
  var challengerTeam=c.myTeam||[];
  var mems=members().filter(function(x){return x.status!=='비활성';});

  // ── 각 회원 상태 계산 (READ-only, DOM 접근 없음)
  var memStates=mems.map(function(x){
    var isSelected=_acceptTeam.indexOf(x.name)>-1;
    var isDim=challengerTeam.indexOf(x.name)>-1;
    if(!isDim&&tm.mix){
      var mCount=_acceptTeam.filter(function(n){
        var mb=members().find(function(m){return m.name===n;});return mb&&mb.gender==='남성';
      }).length;
      var fCount=_acceptTeam.filter(function(n){
        var mb=members().find(function(m){return m.name===n;});return mb&&mb.gender==='여성';
      }).length;
      if(!isSelected){
        if((x.gender==='남성'&&mCount>=1)||(x.gender==='여성'&&fCount>=1)||_acceptTeam.length>=max)isDim=true;
      }
    } else if(!isDim){
      var gf=tm.gO;
      if(!isSelected&&(gf&&x.gender&&x.gender!==gf||_acceptTeam.length>=max))isDim=true;
    }
    var isChallengerMember=challengerTeam.indexOf(x.name)>-1;
    return{name:x.name,gender:x.gender,isSelected:isSelected,isDim:isDim,isChallengerMember:isChallengerMember};
  });

  var items=memStates.map(function(x){
    var mb=findMemberByName(x.name)||{};
    return{
      name:x.name,
      cls:'mc2'+(x.isSelected?' selp':'')+(x.isDim?' dim':''),
      onclick:x.isDim?'':'tglAccept(\''+x.name+'\')',
      subtext:_memberGrade(mb).label+(x.gender?' '+(x.gender==='남성'?'♂':'♀'):'')+(x.isChallengerMember?' 🏓':'')
    };
  });
  patchMc2Grid(gr,items,'해당 회원 없음');
}

// ── 수락팀 회원 선택 토글 ──
window.tglAccept=function(name){
  var c=chal().find(function(c){return c.id===_acceptOpenId;});
  if(!c)return;
  var tm=TM[c.type]||TM.ms;
  var max=tm.maxO;
  var i=_acceptTeam.indexOf(name);
  if(i>-1){_acceptTeam.splice(i,1);}
  else if(_acceptTeam.length<max){_acceptTeam.push(name);}
  renderAcceptGrid(c);
}

// ── 오픈 챌린지 수락 확정 ──
// Firestore에 oppTeam 업데이트 + status → accepted 변경
window.submitAcceptOpen=async function(){
  var c=chal().find(function(c){return c.id===_acceptOpenId;});
  if(!c)return;
  var tm=TM[c.type]||TM.ms;

  // ── 팀 구성 유효성 검사 ──
  var ok=true;
  if(tm.mix){
    var mCount=_acceptTeam.filter(function(n){
      var mb=members().find(function(m){return m.name===n;});return mb&&mb.gender==='남성';
    }).length;
    var fCount=_acceptTeam.filter(function(n){
      var mb=members().find(function(m){return m.name===n;});return mb&&mb.gender==='여성';
    }).length;
    if(mCount<1||fCount<1){g('e-accept').classList.add('on');ok=false;}
    else g('e-accept').classList.remove('on');
  } else {
    if(_acceptTeam.length<tm.maxO){g('e-accept').classList.add('on');ok=false;}
    else g('e-accept').classList.remove('on');
  }
  if(!ok)return;

  // ── Firestore 업데이트 데이터 ──
  var acceptMsg=g('accept-msg').value.trim();
  var updateData={
    oppTeam:[..._acceptTeam],
    status:'accepted',
    isOpen:false,             // 수락 완료 → 오픈 챌린지 플래그 해제
    acceptedAt:new Date().toISOString(),
    acceptMsg:acceptMsg||null
  };

  closeMo('mo-accept-open');
  try{
    if(db())await updateDoc(doc(db(),COL_CHALLENGES,_acceptOpenId),updateData);
    else{
      var target=chal().find(function(c){return c.id===_acceptOpenId;});
      if(target){
        target.oppTeam=[..._acceptTeam];
        target.status='accepted';
        target.isOpen=false;
      }
      renderC();
    }
    toast('✅ 오픈 챌린지를 수락했습니다!');
  }
  catch(e){toast('❌ '+e.message);}
}

window.acceptC=async function(id){
  try{if(db())await updateDoc(doc(db(),COL_CHALLENGES,id),{status:'accepted'});else{chal().find(c=>c.id===id)&&(chal().find(c=>c.id===id).status='accepted');renderC();}toast('✅ 수락했습니다!');}
  catch(e){toast('❌ '+e.message);}
}
window.rejectC=async function(id){
  if(!confirm('거절하시겠습니까?'))return;
  try{if(db())await updateDoc(doc(db(),COL_CHALLENGES,id),{status:'rejected'});else{chal().find(c=>c.id===id)&&(chal().find(c=>c.id===id).status='rejected');renderC();}toast('거절했습니다');}
  catch(e){toast('❌ '+e.message);}
}
window.delC=async function(id){
  if(!isAdmin()){requireAdmin(function(){delC(id);});return;}
  if(!confirm('삭제하시겠습니까?'))return;
  try{if(db())await deleteDoc(doc(db(),COL_CHALLENGES,id));else{removeChallengeLocal(id);renderC();}toast('🗑 삭제됐습니다');}
  catch(e){toast('❌ '+e.message);}
}
// ── 저장된 score 문자열 → _sets 배열 복원 ("21:18, 15:21" 형식)
function _parseScoreToSets(score){
  if(!score)return[];
  if(_isSetWinsScore(score))return[];
  var setPattern=/^\d+:\d+$/;
  var parts=score.split(',').map(function(s){return s.trim();});
  if(!parts.length||!parts.every(function(p){return setPattern.test(p);}))return[];
  return parts.map(function(p){
    var ab=p.split(':');
    return{a:parseInt(ab[0],10),b:parseInt(ab[1],10)};
  });
}
function _isSetWinsScore(score){
  if(!score||score.indexOf(',')>=0)return false;
  var m=score.trim().match(/^(\d+):(\d+)$/);
  if(!m)return false;
  var a=parseInt(m[1],10),b=parseInt(m[2],10);
  if(a===b)return false;
  return a<=4&&b<=4;
}
function _gmInfo(mode){
  return GM[mode]||GM.bo5;
}
function _maxSetRows(){
  if(!_gameMode)return 3;
  return _gmInfo(_gameMode).max;
}
function _winsNeeded(){
  if(!_gameMode)return 2;
  return _gmInfo(_gameMode).wins;
}
function _syncSetWinsFromPicks(){
  var wA=0,wB=0;
  for(var i=0;i<_setWinPick.length;i++){
    if(_setWinPick[i]==='a')wA++;
    else if(_setWinPick[i]==='b')wB++;
  }
  _setWinsA=wA;_setWinsB=wB;
}
function _applyGameModeUI(mode){
  _gameMode=mode;
  ['bo1','bo3','bo5','bo7'].forEach(function(m){
    var btn=g('gm-'+m);
    if(btn)btn.classList.toggle('on',m===mode);
  });
  var hint=g('gm-hint');
  if(hint){
    if(mode){
      var info=_gmInfo(mode);
      hint.textContent=info.lb+' — '+info.wins+'승 달성 시 자동 승리 (최대 '+info.max+'세트)';
    }else{
      hint.textContent='방식 미선택 — 점수만 기록합니다';
    }
  }
}
function _inferGameModeFromSetWins(wA,wB){
  var maxW=Math.max(wA,wB),total=wA+wB;
  if(maxW>=4)return'bo7';
  if(maxW>=3||total>5)return'bo5';
  if(maxW>=2||total>2)return'bo3';
  if(total>=1)return'bo1';
  return'bo3';
}
function _resizeSetWinPick(maxR){
  if(_setWinPick.length===maxR)return;
  var old=_setWinPick.slice();
  _setWinPick=[];
  for(var i=0;i<maxR;i++)_setWinPick.push(old[i]||null);
}
function _initSetWinPick(len){
  var maxR=_maxSetRows();
  if(len==null)len=maxR;
  _setWinPick=[];
  for(var i=0;i<len;i++)_setWinPick.push(null);
}
function _inferSetWinPickFromAggregate(wA,wB){
  var mode=_inferGameModeFromSetWins(wA,wB);
  _applyGameModeUI(mode);
  var maxR=_maxSetRows();
  _resizeSetWinPick(maxR);
  var idx=0;
  for(var i=0;i<wA&&idx<maxR;i++)_setWinPick[idx++]='a';
  for(var i=0;i<wB&&idx<maxR;i++)_setWinPick[idx++]='b';
}
function renderSetWinPickRows(){
  var box=g('sc-setwin-rows');
  if(!box)return;
  var maxR=_maxSetRows();
  _resizeSetWinPick(maxR);
  var rows='';
  for(var i=0;i<maxR;i++){
    var pick=_setWinPick[i];
    rows+='<div class="res-setwin-row">'
      +'<span class="res-setwin-num">'+(i+1)+'세트</span>'
      +'<button type="button" class="res-setwin-btn'+(pick==='a'?' on-a':'')+'" onclick="pickSetWin('+i+",'a')\">"+_scLblA+'</button>'
      +'<button type="button" class="res-setwin-btn'+(pick==='b'?' on-b':'')+'" onclick="pickSetWin('+i+",'b')\">"+_scLblB+'</button>'
      +'</div>';
  }
  _syncSetWinsFromPicks();
  var summaryHtml='';
  if(_setWinsA>0||_setWinsB>0){
    summaryHtml='<div class="res-setwin-summary">'
      +'<span style="color:var(--a)">'+_scLblA+' '+_setWinsA+'</span>'
      +' <span style="color:var(--t3)">:</span> '
      +'<span style="color:var(--blue)">'+_setWinsB+' '+_scLblB+'</span></div>';
  }
  box.innerHTML=summaryHtml+rows;
  _renderSetWinPresets();
  _autoWinnerFromSetPicks();
  _updateResPreviewVisibility();
}
function _renderSetWinPresets(){
  var box=g('sc-setwin-presets');
  if(!box)return;
  var presets;
  if(_gameMode==='bo1'){
    presets=[[1,0],[0,1]];
  }else if(_gameMode==='bo5'){
    presets=[[3,0],[3,1],[3,2],[2,3],[1,3],[0,3]];
  }else if(_gameMode==='bo7'){
    presets=[[4,0],[4,1],[4,2],[4,3],[0,4],[1,4],[2,4],[3,4]];
  }else{
    presets=[[2,0],[2,1],[1,2],[0,2]];
  }
  box.innerHTML=presets.map(function(p){
    return '<button type="button" class="btn btn-g btn-sm" onclick="setSetWinsPreset('+p[0]+','+p[1]+')">'+p[0]+':'+p[1]+'</button>';
  }).join('');
}
window.pickSetWin=function(idx,team){
  if(idx<0||idx>=_setWinPick.length)return;
  _setWinPick[idx]=_setWinPick[idx]===team?null:team;
  renderSetWinPickRows();
};
window.setSetWinsPreset=function(a,b){
  _inferSetWinPickFromAggregate(a,b);
  renderSetWinPickRows();
};
function _autoWinnerFromSetPicks(){
  if(_resInputMode!=='sets')return;
  _syncSetWinsFromPicks();
  if(_setWinsA===0&&_setWinsB===0)return;
  if(_gameMode){
    var need=_winsNeeded();
    if(_setWinsA>=need){setW('a');return;}
    if(_setWinsB>=need){setW('b');return;}
  }
  if(_setWinsA>_setWinsB)setW('a');
  else if(_setWinsB>_setWinsA)setW('b');
}
function _readSetRowsFromDom(){
  var rows=document.querySelectorAll('#sc-input-rows .res-set-row');
  var out=[];
  for(var i=0;i<rows.length;i++){
    var inpA=rows[i].querySelector('.res-in-a');
    var inpB=rows[i].querySelector('.res-in-b');
    if(!inpA||!inpB)continue;
    if(inpA.value===''||inpB.value==='')continue;
    var a=parseInt(inpA.value,10),b=parseInt(inpB.value,10);
    if(isNaN(a)||isNaN(b)||a<0||b<0)continue;
    out.push({a:a,b:b});
  }
  return out;
}
function syncSetsFromInputs(){
  _sets=_readSetRowsFromDom();
}
function _renderSetSummary(){
  var summary=g('sc-summary');
  if(!summary)return;
  if(_resInputMode!=='detail'||!_sets.length){
    summary.style.display='none';
    _updateResPreviewVisibility();
    return;
  }
  var winsA=_sets.filter(function(x){return x.a>x.b;}).length;
  var winsB=_sets.filter(function(x){return x.b>x.a;}).length;
  var totalA=_sets.reduce(function(s,x){return s+x.a;},0);
  var totalB=_sets.reduce(function(s,x){return s+x.b;},0);
  summary.innerHTML=
    '<span style="color:var(--a);font-weight:800">'+winsA+'세트</span>'
    +' <span style="color:var(--t3)">vs</span> '
    +'<span style="color:var(--blue);font-weight:800">'+winsB+'세트</span>'
    +(_sets.length>=2?('<span style="color:var(--t3);margin:0 8px">|</span>'
      +'총점 <span style="color:var(--a)">'+totalA+'</span>'
      +' : <span style="color:var(--blue)">'+totalB+'</span>'):'');
  summary.style.display='block';
  _updateResPreviewVisibility();
}
function _autoWinnerFromSetScores(){
  if(_resInputMode!=='detail')return;
  syncSetsFromInputs();
  if(!_sets.length)return;
  var wA=_sets.filter(function(x){return x.a>x.b;}).length;
  var wB=_sets.filter(function(x){return x.b>x.a;}).length;
  if(_gameMode){
    var winsNeeded=_winsNeeded();
    if(wA>=winsNeeded){setW('a');return;}
    if(wB>=winsNeeded){setW('b');return;}
  }
  if(wA>wB)setW('a');
  else if(wB>wA)setW('b');
}
window.onSetScoreInput=function(){
  syncSetsFromInputs();
  _autoWinnerFromSetScores();
  _renderSetSummary();
};
function renderSetInputRows(preserved){
  var box=g('sc-input-rows');
  if(!box)return;
  var maxR=_maxSetRows();
  if(!preserved){
    if(_gameMode)_setRowCount=maxR;
    else if(_sets.length>_setRowCount)_setRowCount=_sets.length;
  }else{
    _setRowCount=preserved.length;
  }
  if(_setRowCount<1)_setRowCount=1;
  if(_setRowCount>maxR)_setRowCount=maxR;
  var head='<div class="res-set-input-head">'
    +'<span class="res-set-num-h"></span>'
    +'<span class="res-set-team-h" style="color:var(--a)">'+_scLblA+'</span>'
    +'<span class="res-set-colon-h"></span>'
    +'<span class="res-set-team-h" style="color:var(--blue)">'+_scLblB+'</span>'
    +'<span class="res-set-del-h"></span></div>';
  var rows='';
  for(var i=0;i<_setRowCount;i++){
    var va='',vb='';
    if(preserved&&preserved[i]){va=preserved[i].a;vb=preserved[i].b;}
    else if(_sets[i]){va=String(_sets[i].a);vb=String(_sets[i].b);}
    rows+='<div class="res-set-row">'
      +'<span class="res-set-num">'+(i+1)+'세트</span>'
      +'<input type="number" inputmode="numeric" pattern="[0-9]*" class="res-set-in res-in-a" min="0" max="99" placeholder="0" value="'+va+'" oninput="onSetScoreInput()">'
      +'<span class="res-set-colon">:</span>'
      +'<input type="number" inputmode="numeric" pattern="[0-9]*" class="res-set-in res-in-b" min="0" max="99" placeholder="0" value="'+vb+'" oninput="onSetScoreInput()">'
      +(i>0?'<button type="button" class="res-set-del" onclick="removeSetRow('+i+')" aria-label="세트 삭제">✕</button>':'<span class="res-set-del"></span>')
      +'</div>';
  }
  var addBtn=_setRowCount<maxR
    ?'<button type="button" class="btn btn-g res-set-add" onclick="addSetRow()">＋ 세트 추가</button>'
    :'<div style="font-size:12px;color:var(--t3);text-align:center;margin-top:8px">최대 '+maxR+'세트까지 입력 가능</div>';
  box.innerHTML=head+rows+addBtn;
}
function _readAllSetRowValues(){
  var rows=document.querySelectorAll('#sc-input-rows .res-set-row');
  var vals=[];
  for(var i=0;i<rows.length;i++){
    var inpA=rows[i].querySelector('.res-in-a');
    var inpB=rows[i].querySelector('.res-in-b');
    vals.push({a:inpA?inpA.value:'',b:inpB?inpB.value:''});
  }
  return vals;
}
window.addSetRow=function(){
  if(_setRowCount>=_maxSetRows()){
    toast('⚠️ 최대 '+_maxSetRows()+'세트까지 입력 가능합니다');
    return;
  }
  var vals=_readAllSetRowValues();
  vals.push({a:'',b:''});
  _setRowCount=vals.length;
  renderSetInputRows(vals);
};
window.removeSetRow=function(idx){
  var vals=_readAllSetRowValues();
  vals.splice(idx,1);
  _setRowCount=Math.max(1,vals.length);
  renderSetInputRows(vals);
  onSetScoreInput();
};
function _updateResPreviewVisibility(){
  var wrap=g('res-preview-wrap');
  var swPrev=g('sc-setwins-preview');
  var summary=g('sc-summary');
  if(!wrap)return;
  if(_resInputMode==='sets'){
    if(swPrev)swPrev.style.display='none';
    if(summary)summary.style.display='none';
    wrap.style.display='none';
    return;
  }
  if(swPrev)swPrev.style.display='none';
  if(_resInputMode==='winner'){
    wrap.style.display='none';
    return;
  }
  if(_resInputMode==='detail'){
    wrap.style.display=_sets.length?'':'none';
    return;
  }
  wrap.style.display=_sets.length?'':'none';
}
window.setResMode=function(mode){
  _resInputMode=mode;
  ['winner','sets','detail'].forEach(function(m){
    var btn=g('rm-'+m);
    if(btn)btn.classList.toggle('on',m===mode);
    var panel=g('res-panel-'+m);
    if(panel)panel.style.display=m===mode?'block':'none';
  });
  if(mode==='sets')renderSetWinPickRows();
  if(mode==='detail')renderSetInputRows();
  _updateResPreviewVisibility();
  if(mode==='detail')_renderSetSummary();
};
function _buildResultScore(){
  if(_resInputMode==='winner')return null;
  if(_resInputMode==='sets'){
    _syncSetWinsFromPicks();
    if(_setWinsA===0&&_setWinsB===0)return null;
    return _setWinsA+':'+_setWinsB;
  }
  syncSetsFromInputs();
  if(_sets.length>0)return _sets.map(function(s){return s.a+':'+s.b;}).join(', ');
  return null;
}

function _findResultFormBody(){
  var mo=g('mo-result');
  var mb=mo&&mo.querySelector('.mb');
  if(mb)return mb;
  var slot=g('wiz-instant-res-root');
  return slot?slot.querySelector('.mb'):null;
}

function _mountInstantResultForm(){
  var slot=g('wiz-instant-res-root');
  var mb=_findResultFormBody();
  if(!slot||!mb)return;
  if(mb.parentElement!==slot)slot.appendChild(mb);
  _resultFormMountedInWizard=true;
}

function _unmountInstantResultForm(){
  var mo=g('mo-result');
  var mw=mo&&mo.querySelector('.mw');
  var mf=mw&&mw.querySelector('.mf');
  var mb=_findResultFormBody();
  if(mb&&mw&&mf&&mb.parentElement!==mw)mw.insertBefore(mb,mf);
  _resultFormMountedInWizard=false;
}

function _scrollBsStep(n){
  var step=g('bs-step'+n);
  if(step)step.scrollTop=0;
}

function _applyInstantResultUI(isInstant){
  var mo=g('mo-result');
  var root=g('wiz-instant-res-root');
  if(mo)mo.classList.toggle('res-instant-quick',!!isInstant);
  if(root)root.classList.toggle('res-instant-quick',!!isInstant);
  var fold=g('res-advanced-fold');
  if(fold&&!isInstant)fold.removeAttribute('open');
  if(fold&&isInstant)fold.removeAttribute('open');
}
function _initResultForm(opts){
  opts=opts||{};
  var myTeam=opts.myTeam||[];
  var oppTeam=opts.oppTeam||[];
  _resEditMode=!!opts.editMode;
  _rw=opts.winner||null;
  _resInputMode='winner';
  _setWinsA=0;_setWinsB=0;
  _sets=[];
  var chGm=opts.gameMode&&GM[opts.gameMode]?opts.gameMode:'bo1';
  _applyGameModeUI(chGm);
  _bsGameMode=chGm;
  _setRowCount=_gmInfo(chGm).max;
  _initSetWinPick(_gmInfo(chGm).max);

  var myNames=myTeam.join(' · ')||'A팀';
  var opNames=oppTeam.join(' · ')||'B팀';
  var riEl=g('ri');
  if(riEl)riEl.innerHTML='<strong>'+myNames+'</strong><span style="color:var(--t3);margin:0 10px">VS</span><strong>'+opNames+'</strong>';

  var wanEl=g('wan'),wbnEl=g('wbn');
  if(wanEl)wanEl.textContent='우리팀 승리';
  if(wbnEl)wbnEl.textContent='상대팀 승리';
  ['wa','wb'].forEach(function(x){
    var el=g(x);
    if(el){el.classList.remove('res-win-btn--on');}
  });

  var lblA=myTeam[0]||'A팀';
  var lblB=oppTeam[0]||'B팀';
  _scLblA=lblA;
  _scLblB=lblB;

  var summaryEl=g('sc-summary');
  if(summaryEl)summaryEl.style.display='none';
  var swPrevEl=g('sc-setwins-preview');
  if(swPrevEl)swPrevEl.style.display='none';

  if(_resEditMode&&opts.score&&_isSetWinsScore(opts.score)){
    var ab=opts.score.split(':');
    _setWinsA=parseInt(ab[0],10);_setWinsB=parseInt(ab[1],10);
    _inferSetWinPickFromAggregate(_setWinsA,_setWinsB);
    setResMode('sets');
  }else if(_resEditMode&&opts.score){
    var parsed=_parseScoreToSets(opts.score);
    if(parsed.length){
      _sets=parsed;
      _setRowCount=Math.max(3,parsed.length);
      setResMode('detail');
      renderSetInputRows();
      onSetScoreInput();
    }else if(!opts.score){
      setResMode('winner');
    }
  }else if(opts.instantWizard){
    setResMode('winner');
    _applyInstantResultUI(true);
  }else{
    setResMode('winner');
    _applyInstantResultUI(false);
    renderSetWinPickRows();
    renderSetInputRows();
  }
  if(_rw)setW(_rw);
  _updateResPreviewVisibility();
}

function _collectPendingResult(){
  return {
    winner:_rw,
    score:_buildResultScore(),
    gameMode:_gameMode||_bsGameMode||'bo1'
  };
}

window.openRes=function(id){
  try{
  if(!requireMyPlayer())return;
  const c=chal().find(c=>c.id===id);if(!c)return;
  if(c.status==='completed'&&!isAdmin()){
    requireAdmin(function(){openRes(id);});
    return;
  }
  _unmountInstantResultForm();
  _rid=id;
  var chGm=c.gameMode&&GM[c.gameMode]?c.gameMode:'bo5';
  _initResultForm({
    myTeam:c.myTeam||[],
    oppTeam:c.oppTeam||[],
    gameMode:chGm,
    winner:c.status==='completed'?c.winner:null,
    score:c.score||null,
    editMode:c.status==='completed'
  });

  var mtEm=g('mo-result')&&g('mo-result').querySelector('.mt em');
  if(mtEm)mtEm.textContent=_resEditMode?'수정':'입력';

  openMo('mo-result');
  }catch(e){
    console.error('openRes error:',e);
    toast('❌ 결과 입력을 열 수 없습니다');
  }
}
window.setW=function(t){
  _rw=t;
  ['a','b'].forEach(function(k){
    var el=g('w'+k);
    if(!el)return;
    el.classList.toggle('res-win-btn--on',k===t);
    el.style.borderColor=k===t?'var(--a)':'';
    el.style.background=k===t?'var(--adim)':'';
  });
}

// ── 드럼롤 피커 초기화 및 제어
// 듀스 대응: 0~30 범위, 상한 제한 없음 (tabletTennis deuce rule)
var DRUM_MAX = 30; // 드럼롤 표시 최대 점수
// 드럼롤 목록 렌더링: 0~DRUM_MAX 숫자 아이템 생성
// 위아래 여백(패딩) 2개씩 추가하여 첫/끝 아이템도 가운데 정렬 가능
function _initDrumScroll(scrollEl){
  var html='';
  // 위 여백 2개 (선택 구역이 항상 가운데 오도록)
  html+='<div class="drum-item" style="visibility:hidden"></div>';
  html+='<div class="drum-item" style="visibility:hidden"></div>';
  for(var i=0;i<=DRUM_MAX;i++){
    html+='<div class="drum-item" data-val="'+i+'">'+i+'</div>';
  }
  // 아래 여백 2개
  html+='<div class="drum-item" style="visibility:hidden"></div>';
  html+='<div class="drum-item" style="visibility:hidden"></div>';
  scrollEl.innerHTML=html;
}

// 드럼롤을 특정 값으로 이동 (스냅 포함)
// animate=false: 애니메이션 없이 즉시 이동 (초기화 시 사용)
function _drumSetValue(team, val, animate){
  var scrollEl=g('drum-scroll-'+(team==='a'?'a':'b'));
  if(!scrollEl)return;
  // translateY = -(val+2)*DRUM_ITEM_H + 여백 보정 없음 (패딩 2개 앞에 있으므로 val번째가 3번째 위치)
  // 실제 Y = -(val+2)*h + h (선택 구역은 top:44px이므로 1행 내려야 함)
  // → 결국 -(val+1)*h
  var y=-(val+1)*DRUM_ITEM_H;
  if(!animate){
    // ★ Forced Reflow 제거: getBoundingClientRect() 호출 삭제
    // transition을 none으로 설정 후, 다음 프레임에서 복원 (compositor 스레드 활용)
    scrollEl.style.transition='none';
    scrollEl.style.transform='translateY('+y+'px)';
    // ★ setTimeout(0) 으로 defer: reflow 유발 없이 다음 태스크에서 transition 복원
    setTimeout(function(){ scrollEl.style.transition=''; }, 0);
  } else {
    scrollEl.style.transform='translateY('+y+'px)';
  }
  _drumUpdateSelected(scrollEl, val);
}

// 가운데 선택 아이템 하이라이트 갱신
function _drumUpdateSelected(scrollEl, val){
  var items=scrollEl.querySelectorAll('.drum-item[data-val]');
  items.forEach(function(el){
    var v=parseInt(el.getAttribute('data-val'),10);
    if(v===val)el.classList.add('selected');
    else el.classList.remove('selected');
  });
}

// 드럼롤 피커 터치/마우스 이벤트 바인딩
// 드래그한 거리에 비례해 스크롤, 손 떼면 가장 가까운 정수로 스냅
function _bindDrum(team){
  var pickEl=g('drum-'+(team==='a'?'a':'b'));
  var scrollEl=g('drum-scroll-'+(team==='a'?'a':'b'));
  if(!pickEl||!scrollEl)return;

  var _startY=0;      // 터치/마우스 시작 Y
  var _startVal=0;    // 시작 시 선택 값
  var _curVal=0;      // 현재 드래그 중 값 (실수 가능)
  var _isDrag=false;

  // 현재 값 읽기 (전역 _scA/_scB 연동)
  function getVal(){ return team==='a'?_scA:_scB; }
  function setVal(v){
    v=Math.round(v);
    v=Math.max(0,Math.min(DRUM_MAX,v));
    if(team==='a')_scA=v; else _scB=v;
    // 숨겨진 disp 동기화 (addSet에서 참조)
    var disp=g('sc-'+(team==='a'?'a':'b')+'-disp');
    if(disp)disp.textContent=v;
    return v;
  }

  function onStart(clientY){
    _isDrag=true;
    _startY=clientY;
    _startVal=getVal();
    _curVal=_startVal;
    scrollEl.style.transition='none'; // 드래그 중 애니메이션 OFF
  }
  function onMove(clientY){
    if(!_isDrag)return;
    var dy=_startY-clientY; // 위로 드래그 → 양수 → 값 증가
    var delta=dy/DRUM_ITEM_H; // 1아이템 높이당 1포인트 변화
    _curVal=_startVal+delta;
    _curVal=Math.max(0,Math.min(DRUM_MAX,_curVal));
    // 실수 위치로 스크롤 (스냅 없이 자연스럽게)
    var y=-(_curVal+1)*DRUM_ITEM_H;
    scrollEl.style.transform='translateY('+y+'px)';
    // 가장 가까운 정수로 선택 하이라이트
    _drumUpdateSelected(scrollEl, Math.round(_curVal));
  }
  function onEnd(){
    if(!_isDrag)return;
    _isDrag=false;
    // 스냅: 가장 가까운 정수로 이동
    var snapped=setVal(_curVal);
    _drumSetValue(team, snapped, true);
  }

  // ── 터치 이벤트 ──
  pickEl.addEventListener('touchstart',function(e){
    onStart(e.touches[0].clientY);
    e.preventDefault(); // 부모 스크롤 차단
  },{passive:false});
  pickEl.addEventListener('touchmove',function(e){
    onMove(e.touches[0].clientY);
    e.preventDefault();
  },{passive:false});
  pickEl.addEventListener('touchend',function(e){
    onEnd();
    e.preventDefault();
  },{passive:false});

  // ── 마우스 이벤트 (PC 지원) ──
  pickEl.addEventListener('mousedown',function(e){
    onStart(e.clientY);
    e.preventDefault();
  });
  document.addEventListener('mousemove',function(e){
    if(_isDrag)onMove(e.clientY);
  });
  document.addEventListener('mouseup',function(){
    if(_isDrag)onEnd();
  });

  // ── 휠 이벤트 (PC 마우스 휠) ──
  pickEl.addEventListener('wheel',function(e){
    e.preventDefault();
    var delta=e.deltaY>0?1:-1; // 아래 스크롤=값 증가, 위 스크롤=값 감소
    var newVal=setVal(getVal()+delta);
    _drumSetValue(team, newVal, true);
  },{passive:false});
}

// ── 드럼롤 초기화 (결과 입력 모달 열릴 때 호출)
function initDrums(){
  ['a','b'].forEach(function(team){
    var scrollEl=g('drum-scroll-'+team);
    if(!scrollEl)return;
    _initDrumScroll(scrollEl);
    _bindDrum(team);
  });
}
// ── stepScore: 하위 호환용 (외부에서 호출될 경우 대비 — 현재는 드럼롤로 대체됨)
window.stepScore=function(team,delta){
  if(team==='a'){
    _scA=Math.max(0,_scA+delta);
    _drumSetValue('a',_scA,true);
  } else {
    _scB=Math.max(0,_scB+delta);
    _drumSetValue('b',_scB,true);
  }
}

// ── addSet / removeSet: 하위 호환 (드럼롤 UI 제거 후 addSetRow/removeSetRow로 위임)
window.addSet=function(){addSetRow();};
window.removeSet=function(idx){removeSetRow(idx);};

// ── setGameMode: 경기 방식(bo1/bo3/bo5/bo7) 선택 — 결과 입력 세트 수 연동
window.setGameMode=function(mode){
  if(!GM[mode])return;
  if(_gameMode===mode){
    _gameMode=null;
    _applyGameModeUI(null);
    if(_resInputMode==='detail')renderSetInputRows();
    if(_resInputMode==='sets')renderSetWinPickRows();
    return;
  }
  _applyGameModeUI(mode);
  _setRowCount=_maxSetRows();
  if(_resInputMode==='detail'){
    renderSetInputRows();
    onSetScoreInput();
  }else if(_resInputMode==='sets'){
    renderSetWinPickRows();
  }else if(_sets.length>0){
    var winsNeeded2=_winsNeeded();
    var wA=_sets.filter(function(x){return x.a>x.b;}).length;
    var wB=_sets.filter(function(x){return x.b>x.a;}).length;
    var c=chal().find(function(c){return c.id===_rid;});
    var lblA=c?((c.myTeam||[])[0]||'A팀'):'A팀';
    var lblB=c?((c.oppTeam||[])[0]||'B팀'):'B팀';
    if(wA>=winsNeeded2){setW('a');toast('🏆 '+lblA+' 팀 승리 자동 감지! ('+wA+'승)');}
    else if(wB>=winsNeeded2){setW('b');toast('🏆 '+lblB+' 팀 승리 자동 감지! ('+wB+'승)');}
  }
}

// ── 경기 결과에 따른 회원 포인트 반영 (sign: 1=적용, -1=취소)
async function _updateMatchPoints(challenge,winnerSide,sign){
  if(!challenge||!winnerSide||!sign)return;
  var isDbl=_isDoublesType(challenge.type);
  var pts=isDbl?PT.double:PT.individual;
  var field=isDbl?'doublePoint':'individualPoint';
  var winTeam=winnerSide==='a'?(challenge.myTeam||[]):(challenge.oppTeam||[]);
  var loseTeam=winnerSide==='a'?(challenge.oppTeam||[]):(challenge.myTeam||[]);
  var deltas=[];
  winTeam.forEach(function(nm){
    var m=findMemberByName(nm);
    if(m)deltas.push({id:m.id,field:field,delta:pts.win*sign});
  });
  loseTeam.forEach(function(nm){
    var m=findMemberByName(nm);
    if(m)deltas.push({id:m.id,field:field,delta:pts.loss*sign});
  });
  for(var i=0;i<deltas.length;i++){
    var d=deltas[i];
    var m=members().find(function(x){return x.id===d.id;});
    if(!m)continue;
    var cur=_memberPt(m,isDbl);
    var nv=cur+d.delta;
    if(db()){
      var upd={};upd[d.field]=nv;
      await updateDoc(doc(db(),COL_MEMBERS,d.id),upd);
    }else{
      var idx=members().findIndex(function(x){return x.id===d.id;});
      if(idx>-1){members()[idx][d.field]=nv;}
    }
  }
}

window.submitResult=async function(){
  if(!_rw){toast('⚠️ 승리 팀 선택');return;}
  var c=chal().find(function(x){return x.id===_rid;});
  if(!c)return;
  if(_resEditMode&&!isAdmin()){toast('⚠️ 관리자만 결과를 수정할 수 있습니다');return;}

  // ── 스코어 문자열 조합 (입력 방식별) ──
  var sc=_buildResultScore();

  try{
    // 결과 수정 시 기존 포인트 되돌리기
    if(_resEditMode&&c.status==='completed'&&c.winner){
      await _updateMatchPoints(c,c.winner,-1);
    }
    if(db()){
      await updateDoc(doc(db(),COL_CHALLENGES,_rid),{status:'completed',winner:_rw,score:sc||null});
    } else {
      c.status='completed';c.winner=_rw;c.score=sc||null;
      renderC();
    }
    await _updateMatchPoints(c,_rw,1);
    closeMo('mo-result');
    var wasEdit=_resEditMode;
    _resEditMode=false;
    var mtEm=g('mo-result')&&g('mo-result').querySelector('.mt em');
    if(mtEm)mtEm.textContent='입력';
    if(getCurrentPage()==='ranking')renderR();
    if(getCurrentPage()==='members')renderM();
    renderMyRecordHome();renderMyPage();
    if(!wasEdit){
      var ptDelta=myPointDeltaForResult(c,_rw);
      var coachMsg=buildPostMatchCoachComment(ptDelta>0,ptDelta,c);
      if(ptDelta!=null)showResultFeedback(ptDelta>0,ptDelta,coachMsg,c);
    }
    var hasScore=!!sc;
  }catch(e){toast('❌ '+e.message);}
}
// ════ 카카오톡 공유 ════

function _siteBase(){
  return SITE_ORIGIN.replace(/\/$/,'')+'/';
}
var _SHARE_IMG_VER='6';
function _shareOgImageUrl(){
  return _siteBase()+'assets/share-kakao.jpg?v='+_SHARE_IMG_VER;
}
function _kakaoFeedImageUrl(){
  return _siteBase()+'assets/share-kakao.jpg';
}
function _kakaoClamp(s,max){
  s=String(s||'').trim();
  if(s.length<=max)return s;
  return s.slice(0,max-1)+'…';
}
function _kakaoCallerOrigin(){
  return window.location.origin.replace(/\/$/,'');
}
function _kakaoCallerAllowed(){
  var origin=_kakaoCallerOrigin();
  var canonical=SITE_ORIGIN.replace(/\/$/,'');
  return origin===canonical;
}
function _ensureKakaoCallerDomain(){
  if(_kakaoCallerAllowed())return true;
  var canonical=SITE_ORIGIN.replace(/\/$/,'');
  toast(
    '카카오 공유는 공식 주소에서만 가능합니다.\n'+canonical+' 로 접속해주세요.\n(현재: '+_kakaoCallerOrigin()+')',
    {multiline:true,duration:4500}
  );
  return false;
}
function _sendKakaoFeed(c,meta,url,imageUrl){
  Kakao.Share.sendDefault({
    objectType:'feed',
    content:{
      title:_kakaoClamp(meta.title,200),
      description:_kakaoClamp(meta.description,200),
      imageUrl:imageUrl,
      link:{mobileWebUrl:url,webUrl:url}
    },
    buttons:[{title:'대결 보러 가기',link:{mobileWebUrl:url,webUrl:url}}],
    installTalk:true
  });
}
function _shareLinkUrl(c){
  var url=buildShareUrl(c);
  return url.split('#')[0];
}
export function shareFilterFor(c){
  if(!c)return 'pending';
  if(c.status==='completed')return 'completed';
  if(c.status==='accepted')return 'accepted';
  if(c.isOpen&&c.status==='pending')return 'open';
  return 'pending';
}
/**
 * 카카오 공유·딥링크용 대결 URL을 생성한다.
 * @param {object} c - 대결 객체
 * @returns {string}
 */
function buildShareUrl(c){
  var base=SITE_ORIGIN.replace(/\/$/,'');
  if(!c||!c.id)return base;
  return base+'?match='+encodeURIComponent(c.id);
}
function _shareBetLabel(c){
  return c.bet==='coffee'?'☕ 커피 내기':c.bet==='jjajang'?'🍜 짜장면 내기':'';
}
function _shareVsLine(c){
  var tm=TM[c.type]||TM.ms;
  var myT=(c.myTeam||[]).join(' · ')||'미정';
  var isOpen=!!c.isOpen&&c.status==='pending';
  var opT=isOpen?'🔥 누구나 수락 가능':((c.oppTeam||[]).join(' · ')||'미정');
  return {tm:tm,myT:myT,opT:opT,isOpen:isOpen,vs:myT+' VS '+opT};
}
function _shareFeedMeta(c){
  var v=_shareVsLine(c);
  var dtStr=c.date?$ko(c.date+'T00:00'):'';
  var betLabel=_shareBetLabel(c);
  var title='🏓 '+v.vs+' · '+v.tm.lb;
  var descParts=[];
  if(c.status==='completed'&&c.winner){
    var wn=c.winner==='a'?v.myT:v.opT;
    title='🏆 '+wn+' 승리! · '+v.tm.lb;
    if(c.score)descParts.push('스코어 '+c.score);
  } else if(c.status==='accepted'){
    title='📅 곧 만나요! · '+v.vs;
    descParts.push('경기 후 결과 입력 예정');
  } else if(v.isOpen){
    title='🔥 오픈 챌린지 · '+v.myT;
    descParts.push('누구나 수락 환영!');
  } else if(c.status==='pending'){
    var appName=_shareApplicantName(c,v);
    title='🏓 '+appName+'님의 도전장!';
    descParts.push('받아치시겠습니까? 🔥');
  }
  if(dtStr||c.time)descParts.push('📅 '+(dtStr||'날짜 미정')+(c.time?' '+c.time:''));
  if(betLabel)descParts.push(betLabel);
  if(c.message)descParts.push('💬 '+c.message);
  return {title:title,description:descParts.join(' · ')||'이사탁 탁구 대결'};
}
function buildShareText(c,template){
  template=template||window._shareTemplate||'detail';
  var v=_shareVsLine(c);
  var url=buildShareUrl(c);
  var betLabel=_shareBetLabel(c);
  var dtStr=c.date?$ko(c.date+'T00:00'):'';
  var isOpen=v.isOpen;
  var appName=_shareApplicantName(c,v);
  var oppName=_shareOpponentName(c,v);
  if(template==='short'){
    if(c.status==='pending'&&!isOpen){
      return '🔥 '+appName+'님의 도전장!\n\n수락하시겠습니까? 👊\n'+url;
    }
    var head='🏓 ['+v.tm.lb+'] '+v.vs;
    var sub=[];
    if(c.status==='completed'&&c.winner){
      var wn=c.winner==='a'?v.myT:v.opT;
      head='🏆 '+wn+' 승! · '+v.tm.lb;
      if(c.score)sub.push(c.score);
    } else if(c.status==='accepted'){ head='📅 '+v.vs+' · 곧 만나요!'; }
    else if(isOpen){ head='🔥 오픈 · '+appName+' 도전!'; }
    else { head='🏓 도전장 · '+v.vs; }
    if(dtStr||c.time)sub.push((dtStr||'날짜 미정')+(c.time?' '+c.time:''));
    if(betLabel)sub.push(betLabel);
    var cta=c.status==='completed'?'결과 확인 👀':c.status==='accepted'?'경기 화이팅!':isOpen?'수락 환영 🙌':'수락 부탁 🙏';
    return head+'\n'+(sub.length?sub.join(' · ')+'\n':'')+cta+'\n'+url;
  }
  if(template==='open'&&isOpen){
    var expireStr=_formatExpireDateTime(c.expiresAt);
    var openLines=[
      '🏓 오픈 챌린지 등록!',
      appName+'님이 아무나 도전을 받겠다고 나섰어요!',
      '',
      '자신 있으면 수락해보세요 😤'
    ];
    if(expireStr)openLines.push('⏳ 마감: '+expireStr);
    openLines.push('👇 지금 수락하기',url);
    return openLines.join('\n');
  }
  if(c.status==='pending'&&!isOpen){
    var pendingLines=[
      '🏓 도전장이 날아왔어요!',
      appName+'님이 '+oppName+'에게 도전장을 보냈습니다.',
      '',
      '받아치시겠습니까? 🔥',
      '📌 종목: '+v.tm.lb,
      '',
      '📅 일시: '+_shareDateTimeStr(c)
    ];
    if(betLabel)pendingLines.push('🎰 '+betLabel);
    if(c.message)pendingLines.push('💬 '+c.message);
    pendingLines.push('👇 도전 내용 확인하기',url);
    return pendingLines.join('\n');
  }
  var lines=[];
  if(c.status==='completed'&&c.winner){
    lines=['🏆 이사탁 경기 결과','─────────────────','🏅 '+v.tm.lb,'👑 '+(c.winner==='a'?v.myT:v.opT)+' 팀 승리!',''];
    if(c.score)lines.push('📊 '+c.score);
  } else if(c.status==='accepted'){
    lines=['📅 이사탁 경기 안내','─────────────────','🏅 '+v.tm.lb,'⚔️ '+v.vs,'✨ 곧 코트에서 만나요!',''];
  } else if(isOpen){
    var openDetailExpire=_formatExpireDateTime(c.expiresAt);
    lines=['🏓 오픈 챌린지 등록!',appName+'님이 아무나 도전을 받겠다고 나섰어요!','','자신 있으면 수락해보세요 😤'];
    if(openDetailExpire)lines.push('⏳ 마감: '+openDetailExpire);
    lines.push('👇 지금 수락하기');
  } else {
    lines=['🏓 이사탁 탁구 대결 신청','─────────────────','🏅 '+v.tm.lb,'⚔️ '+v.vs,'💌 도전장이 도착했어요!',''];
  }
  if(dtStr||c.time)lines.push('📅 일시: '+_shareDateTimeStr(c));
  if(isOpen&&c.expiresAt&&!lines.some(function(l){return l.indexOf('⏳ 마감:')===0;})){
    var remDetailExpire=_formatExpireDateTime(c.expiresAt);
    if(remDetailExpire)lines.push('⏳ 마감: '+remDetailExpire);
  }
  if(betLabel)lines.push('🎰 내기: '+betLabel);
  if(c.message)lines.push('💬 '+c.message);
  if(c.status==='completed')lines.push('─────────────────','결과 확인은 아래 링크! 👀');
  else if(c.status==='accepted')lines.push('─────────────────','경기 후 결과 입력 예정! 🏓');
  else if(!isOpen)lines.push('─────────────────','아래 링크에서 수락/거절해주세요! 🙏');
  lines.push(url);
  return lines.join('\n');
}
function _updateSharePreview(){
  var c=window._shareChallenge;
  if(!c)return;
  var txt=buildShareText(c,window._shareTemplate);
  g('kakao-preview').textContent=txt;
  window._shareText=txt;
  window._shareUrl=buildShareUrl(c);
}
function _setShareModalHeader(c){
  var t=g('share-box-t'),p=g('share-box-p'),openBtn=g('st-open');
  var isOpen=!!c.isOpen&&c.status==='pending';
  if(c.status==='completed'){ if(t)t.textContent='🏆 경기 결과 공유'; if(p)p.textContent='결과를 카카오톡으로 알려보세요!'; }
  else if(c.status==='accepted'){ if(t)t.textContent='📅 경기 안내 공유'; if(p)p.textContent='일정·장소를 단톡방에 공유하세요!'; }
  else if(isOpen){ if(t)t.textContent='🔥 오픈 챌린지 공유'; if(p)p.textContent='누구나 수락할 수 있어요. 단톡에 올려보세요!'; }
  else { if(t)t.textContent='📣 도전장이 등록됐어요!'; if(p)p.textContent='카카오톡으로 상대방에게 바로 전달하세요!'; }
  if(openBtn)openBtn.style.display=isOpen?'':'none';
}
window.setShareTemplate=function(mode){
  window._shareTemplate=mode;
  ['st-detail','st-short','st-open'].forEach(function(id){
    var el=g(id);if(el)el.classList.toggle('on',id==='st-'+mode);
  });
  _updateSharePreview();
};

// ── 현재 환경이 모바일인지 판별 (User-Agent 기반)
function _isMobile(){
  return isMobileUa();
}

// ── 환경에 따라 공유 모달 하단 힌트 텍스트를 동적으로 세팅
function _setShareHint(){
  var hint=g('share-hint');
  var originInfo=g('share-origin-info');
  var kakaoBtn=document.querySelector('#mo-kakao .btn-kakao');
  if(originInfo){
    originInfo.textContent='접속 주소: '+_kakaoCallerOrigin();
  }
  if(isKakaoInApp()){
    if(kakaoBtn)kakaoBtn.innerHTML='<span class="kt-icon">📋</span> 복사 후 채팅에 붙여넣기';
    if(hint)hint.innerHTML='💡 카카오톡 안에서는 <b>복사 후 붙여넣기</b>가 가장 안정적입니다.<br>Chrome·Safari에서 열면 채팅방 선택 공유도 가능해요.';
  } else if(kakaoBtn){
    kakaoBtn.innerHTML='<span class="kt-icon">💬</span> 카카오톡으로 공유';
    if(hint){
      if(_isMobile()){
        hint.innerHTML='💡 [카카오톡으로 공유] 버튼을 누르면<br>채팅방을 선택해서 바로 전송할 수 있어요!';
      } else {
        hint.innerHTML='💻 [카카오톡으로 공유] 버튼을 누르면<br>카카오톡 공유 창이 열립니다.<br>또는 📋 복사 후 카카오톡에 붙여넣기 하세요.';
      }
    }
  }
}

// ── 대결 신청 완료 직후 공유 모달 열기 (submitCh 에서 호출)
/**
 * 공유 템플릿 미리보기 모달을 연다.
 * @param {object} c - 공유할 대결 객체
 */
window.openShareModal=function(c){
  window._shareChallenge=c;
  window._shareTemplate=(c.isOpen&&c.status==='pending')?'open':'detail';
  _setShareModalHeader(c);
  ['st-detail','st-short','st-open'].forEach(function(id){
    var el=g(id);
    if(!el)return;
    el.classList.toggle('on',id.slice(3)===window._shareTemplate);
  });
  _updateSharePreview();
  var nativeBtn=g('btn-native-share');
  if(nativeBtn)nativeBtn.style.display=navigator.share?'':'none';
  _setShareHint();
  openMo('mo-kakao');
}

// ── 대결 카드 공유 버튼 클릭 → ID로 찾아서 모달 열기
/**
 * 대결 카드의 카카오 공유 버튼 핸들러.
 * @param {string} id - 대결 문서 ID
 */
window.shareKakao=function(id){
  var c=chal().find(function(c){return c.id===id;});
  if(!c){toast('❌ 대결 정보를 찾을 수 없습니다');return;}
  openShareModal(c);
}

// ── 카카오 SDK 초기화 (앱 JS 키)
// Kakao.Share.sendDefault() 사용 시 채팅방 선택 피커가 뜨고 직접 전송 가능
var _kakaoReady = false;
function _initKakao(){
  if(_kakaoReady) return true;
  if(typeof Kakao === 'undefined'){
    console.warn('카카오 SDK 로드 실패');
    return false;
  }
  // 중복 초기화 방지
  if(!Kakao.isInitialized()){
    Kakao.init(KAKAO_JS_KEY);
  }
  _kakaoReady = true;
  return true;
}

// ── 실제 카카오톡 공유 처리 (2단계 Fallback)
// 1단계: 카카오 SDK sendDefault → 채팅방 선택 피커 → 직접 전송
// 2단계: SDK 미지원(구형 브라우저 등) → 클립보드 복사 후 안내
/**
 * 카카오 SDK 또는 클립보드로 대결 공유를 실행한다.
 */
window.doKakaoShare=function(){
  var c=window._shareChallenge;
  var txt=window._shareText||'';
  var url=_shareLinkUrl(c);
  if(!txt)return;

  if(isKakaoInApp()){
    _copyToClipboard(txt);
    toast('📋 복사됐습니다!\n채팅방 입력창에 붙여넣기 하세요.',{multiline:true,duration:4000});
    return;
  }
  if(!_ensureKakaoCallerDomain())return;

  if(_initKakao()){
    try{
      if(c){
        var meta=_shareFeedMeta(c);
        _sendKakaoFeed(c,meta,url,_kakaoFeedImageUrl());
      }else{
        Kakao.Share.sendDefault({
          objectType:'text',
          text:_kakaoClamp(txt,200),
          link:{mobileWebUrl:url,webUrl:url},
          installTalk:true
        });
      }
      return;
    }catch(e){
      try{
        Kakao.Share.sendDefault({
          objectType:'text',
          text:_kakaoClamp(txt,200),
          link:{mobileWebUrl:url,webUrl:url},
          installTalk:true
        });
        return;
      }catch(e2){
        toast('❌ 카카오 공유 실패 (4019)\n카카오 개발자 콘솔 → 플랫폼 키 → JavaScript SDK 도메인에\nhttps://isatok.web.app 등록을 확인해주세요.',{multiline:true,duration:TOAST_DURATION_MS});
      }
    }
  }

  _copyToClipboard(txt);
  toast('📋 복사됐습니다! 카카오톡에 붙여넣기 하세요');
}

window.doNativeShare=async function(){
  var c=window._shareChallenge;
  var txt=window._shareText||'';
  var url=window._shareUrl||buildShareUrl(c);
  if(!navigator.share)return;
  try{
    await navigator.share({
      title:c?_shareFeedMeta(c).title:'이사탁 탁구 대결',
      text:txt,
      url:url
    });
  }catch(e){
    if(e&&e.name!=='AbortError')toast('❌ 공유를 취소했거나 지원하지 않습니다');
  }
};

// ── 클립보드 복사 버튼
window.copyShareMsg=function(){
  var txt=window._shareText||'';
  _copyToClipboard(txt);
  toast('📋 복사 완료! 카카오톡에 붙여넣기 하세요');
}

// ── 클립보드 복사 내부 헬퍼 (Clipboard API → execCommand fallback)
function _copyToClipboard(txt){
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).catch(function(){_fallbackCopy(txt);});
  } else {
    _fallbackCopy(txt);
  }
}

// ── execCommand 방식 클립보드 복사 (구형 브라우저 대응)
function _fallbackCopy(txt){
  var ta=document.createElement('textarea');
  ta.value=txt;
  ta.style.position='fixed';
  ta.style.opacity='0';
  ta.style.top='0';
  ta.style.left='0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try{document.execCommand('copy');}catch(e){}
  document.body.removeChild(ta);
}
// ════ 내기 참여 ════

function _betPickEntryData(entry){
  if(entry==null||entry===undefined)return null;
  if(typeof entry==='string')return{side:entry,name:null,id:null,createdAt:null};
  return{
    side:entry.selectedTeam||entry.side||null,
    name:entry.playerName||null,
    id:entry.playerId||null,
    createdAt:entry.createdAt||null
  };
}
function _collectBetPickSides(picks){
  var a=[],b=[];
  Object.keys(picks||{}).forEach(function(key){
    var d=_betPickEntryData(picks[key]);
    if(!d||!d.side)return;
    var name=d.name||key;
    if(d.side==='a')a.push(name);
    else if(d.side==='b')b.push(name);
  });
  return{a:a,b:b};
}
function _getMyBetPick(c,me){
  if(!c||!me)return null;
  var picks=c.betPicks||{};
  var entry=picks[me.id]!=null?picks[me.id]:picks[me.name];
  if(entry==null||entry===undefined)return null;
  var d=_betPickEntryData(entry);
  if(!d||!d.side)return null;
  var myN=(c.myTeam||[]).join(' · ')||'A팀';
  var opN=(c.oppTeam||[]).join(' · ')||'B팀';
  return{
    side:d.side,
    sideLabel:d.side==='a'?myN:opN,
    entry:d
  };
}
function _buildBetPickPayload(me,side){
  return{
    playerId:me.id,
    playerName:me.name,
    selectedTeam:side,
    createdAt:new Date().toISOString()
  };
}
function _betSideLabel(c,side){
  return side==='a'?((c.myTeam||[]).join(' · ')||'A팀'):((c.oppTeam||[]).join(' · ')||'B팀');
}

// ── openBetPick: 내기 참여 모달 열기
window.openBetPick = function(id){
  if(!requireMyPlayer('내기 참여를 위해 먼저 내 선수 설정을 진행해주세요.'))return;
  var me=validateMyPlayer();
  if(!me)return;
  var c=chal().find(function(x){return x.id===id;});
  if(!c)return;
  var players=(c.myTeam||[]).concat(c.oppTeam||[]);
  if(players.indexOf(me.name)>=0){
    toast('⚠️ 경기 참여 선수는 내기에 참여할 수 없습니다');
    return;
  }

  _betPickId=id;
  _betPickSide=null;

  g('bet-mo-title').innerHTML=(c.bet==='coffee'?'☕ 커피':'🍜 짜장면')+' <em>내기</em>';
  var myN=(c.myTeam||[]).join(' · ')||'A팀';
  var opN=(c.oppTeam||[]).join(' · ')||'B팀';
  g('bet-info').innerHTML='<strong>'+myN+'</strong><span style="color:var(--t3);margin:0 10px">VS</span><strong>'+opN+'</strong>';
  g('bet-pick-a-lbl').textContent=myN;
  g('bet-pick-b-lbl').textContent=opN;

  ['bet-pick-a','bet-pick-b'].forEach(function(eid){
    var el=g(eid);
    el.style.borderColor='var(--b2)';
    el.style.background='transparent';
  });

  var existing=_getMyBetPick(c,me);
  var infoEl=g('bet-my-info');
  if(infoEl){
    if(existing){
      _betPickSide=existing.side;
      setBetPick(existing.side);
      infoEl.innerHTML='<div class="bet-my-info-title">내 참여 정보</div>'
        +'<div class="bet-my-info-row"><span>참여자</span><strong>'+me.name+'</strong></div>'
        +'<div class="bet-my-info-row"><span>선택팀</span><strong>'+existing.sideLabel+'</strong></div>';
    }else{
      infoEl.innerHTML='<div class="bet-my-info-row"><span>참여자</span><strong>'+me.name+'</strong></div>';
    }
  }

  openMo('mo-bet');
};

// ── setBetPick: 예측 팀 선택 (a=내팀, b=상대팀)
window.setBetPick = function(side){
  _betPickSide=side;
  g('bet-pick-a').style.borderColor=side==='a'?'var(--a)':'var(--b2)';
  g('bet-pick-a').style.background=side==='a'?'var(--adim)':'transparent';
  g('bet-pick-b').style.borderColor=side==='b'?'var(--blue)':'var(--b2)';
  g('bet-pick-b').style.background=side==='b'?'rgba(59,130,246,.12)':'transparent';
};

// ── submitBetPick: 예측 참여 확정 → Firestore betPicks에 저장
window.submitBetPick = async function(){
  if(!_betPickSide){
    toast('⚠️ 어느 팀이 이길지 선택해주세요');
    return;
  }
  if(!requireMyPlayer('내기 참여를 위해 먼저 내 선수 설정을 진행해주세요.'))return;
  var me=validateMyPlayer();
  if(!me)return;

  var c=chal().find(function(x){return x.id===_betPickId;});
  if(!c)return;

  var payload=_buildBetPickPayload(me,_betPickSide);
  var updField='betPicks.'+me.id;
  closeMo('mo-bet');
  try{
    if(db()){
      var updateObj={};
      updateObj[updField]=payload;
      await updateDoc(doc(db(),COL_CHALLENGES,_betPickId),updateObj);
    }else{
      if(!c.betPicks)c.betPicks={};
      c.betPicks[me.id]=payload;
      renderC();
    }
    toast('🎯 '+me.name+' → '+_betSideLabel(c,_betPickSide)+' 승 예측 완료!');
  }catch(e){toast('❌ '+e.message);}
};
function g(id) { return C.g(id); }
function toast(msg, opts) { return C.toast(msg, opts); }
function db() { return C.getDb(); }
function chal() { return C.getChal(); }
function members() { return C.getMembers(); }
function isAdmin() { return C.isAdmin(); }
function requireAdmin(fn) { return C.requireAdmin(fn); }
function openMo(id) { return C.openMo(id); }
function closeMo(id) { return C.closeMo(id); }
function findMemberByName(name) { return C.findMemberByName(name); }
function lockBodyScroll() { return C.lockBodyScroll(); }
function unlockBodyScroll() { return C.unlockBodyScroll(); }
function scrollToElement(el) { return C.scrollToElement(el); }
function waitForElement(sel, cb, max, onTimeout) { return C.waitForElement(sel, cb, max, onTimeout); }
function isMobileUa() { return C.isMobileUa(); }
function cssEscape(value) { return C.cssEscape(value); }
function getCurrentPage() { return C.getCurrentPage(); }
function isScrolling() { return C.isScrolling(); }
function renderR() { return C.renderR(); }
function renderM() { return C.renderM(); }
function renderHall() { return C.renderHall(); }
function renderMyRecordHome() { return C.renderMyRecordHome(); }
function renderMyPage() { return C.renderMyPage(); }
function refreshPlayerProfileIfOpen() { return C.refreshPlayerProfileIfOpen(); }
function nav(id) { return C.nav(id); }
function myPointDeltaForResult(c, w) { return C.myPointDeltaForResult(c, w); }
function buildPostMatchCoachComment(won, d, c) { return C.buildPostMatchCoachComment(won, d, c); }
function showResultFeedback(won, d, msg, c) { return C.showResultFeedback(won, d, msg, c); }
function showInstantRegisterSuccess(won, d, msg, c) { return C.showInstantRegisterSuccess(won, d, msg, c); }
function markPendingChallengeRender() { return C.markPendingChallengeRender(); }
function markPendingDeepLink() { return C.markPendingDeepLink(); }
function getDeepLinkCh() { return C.getDeepLinkCh(); }
function setDeepLinkCh(v) { return C.setDeepLinkCh(v); }
function getPendingDeepLinkFilter() { return C.getPendingDeepLinkFilter(); }
function setPendingDeepLinkFilter(v) { return C.setPendingDeepLinkFilter(v); }
function peekDeepLinkMatchId() { return peekDeepLinkMatchIdLocal(); }
function stashDeepLinkMatchId(id) { return C.stashDeepLinkMatchId(id); }
function clearDeepLinkMatchId() { return C.clearDeepLinkMatchId(); }
function isDeepLinkHandled() { return C.isDeepLinkHandled(); }
function setDeepLinkHandled(v) { return C.setDeepLinkHandled(v); }
function isDeepLinkInFlight() { return C.isDeepLinkInFlight(); }
function setDeepLinkInFlight(v) { return C.setDeepLinkInFlight(v); }
function removeChallengeLocal(id) { return C.removeChallengeLocal(id); }
function unshiftChallengeLocal(c) { return C.unshiftChallengeLocal(c); }
function updateChallengeLocal(id, patch) { return C.updateChallengeLocal(id, patch); }
function $ko(d) { return C.$ko(d); }

export function getChallengeFilter() { return _cf; }
export function getWizardChallengeState() { return { _my, _opp, _type, _bet }; }
export function setMy(v) { _my = v; }
export function setOpp(v) { _opp = v; }
export function setChallengeType(tp) { _type = tp; }
export function getEditChId() { return _editChId; }
export function getBsGameMode() { return _bsGameMode; }
export function isInstantCreateMode() { return _isInstantCreateMode(); }
export function mountInstantResultForm() { return _mountInstantResultForm(); }
export function unmountInstantResultForm() { return _unmountInstantResultForm(); }
export function scrollBsStep(n) { return _scrollBsStep(n); }
export function initResultForm(opts) { return _initResultForm(opts); }
export function updateChSubmitBtn() { return _updateChSubmitBtn(); }
export function nowDateTimeFields() { return _nowDateTimeFields(); }

export function initChallenges(ctx) {
  C = ctx;
  _initChLoadObserver();
}
