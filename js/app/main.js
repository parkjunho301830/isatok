/**
 * 이사탁 탁구 대결 - 메인 애플리케이션
 *
 * 섹션 구성:
 *  1. Firebase 설정 및 상태 변수
 *  2. 유틸리티 (g, avc, ini, $ko)
 *  3. 초기화 (init, finish, setDb)
 *  4. 모달 / 바텀시트
 *  5. 네비게이션
 *  6. 대결 (목록, 신청, 필터)
 *  7. 오픈 챌린지 수락
 *  8. 결과 입력 (드럼롤 피커)
 *  9. 회원 관리
 * 10. 공지사항
 * 11. 게시판
 * 12. 카카오톡 공유
 * 13. 공통 (toast, fmtP)
 * 14. 내기 참여
 */

import{initializeApp}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import{getFirestore,collection,doc,addDoc,updateDoc,deleteDoc,onSnapshot,query,orderBy}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import{APP_VERSION,SITE_ORIGIN,KAKAO_JS_KEY}from'./version.js?v=2026.06.22.12';
import{initPwa,ensureLatestVersion}from'./pwa.js';
import{
  initWizard,checkMyPlayerSetup,initMyPlayerOnLoad,renderMyRecordHome,renderMyPage,
  wizResetFlow,wizRenderStep,wizValidateStep,saveWizRecentCombos,
  wizPrefillEdit,requireMyPlayer,isMyPlayerSetupMandatory,
  buildCreatorFields,formatChallengeCreatorHtml,validateMyPlayer,isMyPlayerReady,getMyPlayerId,getMyPlayer
}from'./wizard.js';

const FB={
  apiKey:"AIzaSyDttEMgDQx3iS2siRzVIizxBBDZ4KjcJEw",
  authDomain:"isatok-ef06a.firebaseapp.com",
  projectId:"isatok-ef06a",
  storageBucket:"isatok-ef06a.firebasestorage.app",
  messagingSenderId:"480704214424",
  appId:"1:480704214424:web:1f02fea9630e395bbb27ed"
};

let db,_fbApp,MEMBERS=[],CHAL=[],NOTICES=[],BOARDS=[];
let _delId=null,_fg='',_cf='all',_rid=null,_rw=null;
// _sets: 결과 입력 모달에서 추가된 세트별 점수 배열 [{a:숫자, b:숫자}, ...]
let _sets=[];
// _gameMode: 경기 방식 (null=미선택, 'bo1'|'bo3'|'bo5'|'bo7')
let _gameMode=null;
const GM={
  bo1:{max:1,wins:1,lb:'단판 승부',short:'1판 1선승'},
  bo3:{max:3,wins:2,lb:'3판 2선승',short:'3판 2선승'},
  bo5:{max:5,wins:3,lb:'5판 3선승',short:'5판 3선승'},
  bo7:{max:7,wins:4,lb:'7판 4선승',short:'7판 4선승'}
};
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
// _resInputMode: 결과 입력 방식 ('winner'|'sets'|'detail')
let _resInputMode='winner';
let _setWinsA=0,_setWinsB=0;
let _setRowCount=3;
let _setWinPick=[]; // 세트 승패 모드: 각 세트 승자 ('a'|'b'|null)
let _scLblA='A팀',_scLblB='B팀';
// _rkMode: 랭킹 탭 ('individual' | 'double')
let _rkMode='double';
// _rkScope: 랭킹 범위 ('all' | 'season')
let _rkScope='season';
// _hallMode: 통계 탭 ('individual' | 'double')
let _hallMode='double';
let SEASONS=[];
let TOURNAMENTS=[];
// _profileMemberId: 회원 상세 모달 대상
let _profileMemberId=null;
// _deepLinkCh: 카카오 공유 링크로 진입 시 강조할 대결 ID
let _deepLinkCh=null;
let _pendingDeepLinkFilter=null;
// 즉시 대결 생성 허용 (권한 체계 없음 → 전체 허용)
const INSTANT_CREATE_ALLOWED=true;
let _instantCreate=false;
let _bsPresetInstant=false;
// 바텀시트 선수 검색: IME 조합·포커스 경쟁 시 DOM 재렌더 방지
let _bsSearchComposing=false;
let _bsGridRefreshPending=false;
let _bsSearchRaf=null;
let _bsSearchInited=false;
let _bsAnimating=false;
let _bsSearchBodyUnlocked=false;
let _bsLockTimer=null;

// ── 스크롤 성능: 렌더 조건 분기 + 스크롤 중 DOM 갱신 디바운스 ──
let _currentPage='challenge';
let _isScrolling=false,_scrollTimer=null,_scrollRaf=null;
let _pendingRender={c:false,m:false,grids:false,sn:false,h:false};
let _bodyScrollLock=0,_scrollLockY=0;

function _lockBodyScroll(){
  if(_bodyScrollLock++>0)return;
  _scrollLockY=window.scrollY||document.documentElement.scrollTop||0;
  document.body.style.position='fixed';
  document.body.style.top=(-_scrollLockY)+'px';
  document.body.style.left='0';
  document.body.style.right='0';
  document.body.style.width='100%';
  document.body.style.overflow='hidden';
}
function _unlockBodyScroll(){
  if(_bodyScrollLock<=0)return;
  if(--_bodyScrollLock>0)return;
  var y=_scrollLockY;
  document.body.style.position='';
  document.body.style.top='';
  document.body.style.left='';
  document.body.style.right='';
  document.body.style.width='';
  document.body.style.overflow='';
  window.scrollTo(0,y);
}
function _bindScrollPerf(){
  if(window._scrollPerfBound)return;
  window._scrollPerfBound=true;
  var handler=_onMainScroll;
  window.addEventListener('scroll',handler,{passive:true,capture:true});
  document.addEventListener('scroll',handler,{passive:true,capture:true});
  var mainEl=document.querySelector('.main');
  if(mainEl)mainEl.addEventListener('scroll',handler,{passive:true});
}

function _isBSOpen(){
  var bs=g('bs-ch');
  return bs&&bs.classList.contains('on');
}
function _isBSFocused(){
  if(!_isBSOpen())return false;
  var focused=document.activeElement;
  return focused&&g('bs-ch').contains(focused);
}
function _isBsPlayerSearchFocused(){
  var ae=document.activeElement;
  return ae&&(ae.id==='bs-search-my'||ae.id==='bs-search-opp');
}
function _isBsPlayerSearchActive(){
  if(_bsSearchComposing)return true;
  return _isBsPlayerSearchFocused();
}
function _unlockBodyForBsSearch(){
  if(_bodyScrollLock>0&&!_bsSearchBodyUnlocked){
    _unlockBodyScroll();
    _bsSearchBodyUnlocked=true;
  }
}
function _relockBodyAfterBsSearch(){
  if(!_bsSearchBodyUnlocked)return;
  _bsSearchBodyUnlocked=false;
  if(_isBSOpen()&&!_isBsPlayerSearchFocused())_lockBodyScroll();
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

function _isBsFormInputFocused(){
  if(!_isBSOpen())return false;
  var ae=document.activeElement;
  if(!ae||!g('bs-ch').contains(ae))return false;
  if(ae.id==='bs-search-my'||ae.id==='bs-search-opp')return false;
  var tag=ae.tagName;
  return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';
}
function _deferBsGridRefresh(){
  _bsGridRefreshPending=true;
}
function _flushBsGridIfPending(){
  if(!_bsGridRefreshPending||!_isBSOpen())return;
  if(_isBsPlayerSearchActive())return;
  _bsGridRefreshPending=false;
  renderGridsBS({force:true});
}
function _flushPendingRenders(){
  if(_pendingRender.m&&_currentPage==='members')renderM();
  if(_pendingRender.m&&_currentPage==='ranking')renderR();
  if(_pendingRender.grids&&_isBSOpen()&&!_isBsPlayerSearchActive()&&!_isBsFormInputFocused())renderGridsBS({force:true});
  if(_pendingRender.c&&_currentPage==='challenge'&&!_isBSFocused())renderC();
  if(_pendingRender.sn)_applySeasonsSnapshotRender();
  if(_pendingRender.h&&_currentPage==='hall')renderHall();
  _pendingRender.c=false;_pendingRender.m=false;_pendingRender.grids=false;
  _pendingRender.sn=false;_pendingRender.h=false;
}
function _applyMembersSnapshotRender(){
  if(MEMBERS.length) checkMyPlayerSetup();
  if(_isScrolling){
    _pendingRender.m=true;
    if(_isBSOpen()){
      if(_isBsPlayerSearchActive()||_isBsFormInputFocused())_deferBsGridRefresh();
      else _pendingRender.grids=true;
    }
    return;
  }
  if(_currentPage==='members')renderM();
  if(_currentPage==='ranking')renderR();
  if(_currentPage==='hall')renderHall();
  if(_isBSOpen()){
    if(_isBsPlayerSearchActive()||_isBsFormInputFocused())_deferBsGridRefresh();
    else renderGridsBS();
  }
}
function _applyChallengesSnapshotRender(){
  if(_isScrolling){_pendingRender.c=true;return;}
  if(_pendingDeepLinkFilter){
    _applyDeepLinkFilter(_pendingDeepLinkFilter);
    _pendingDeepLinkFilter=null;
  }
  if(_currentPage==='challenge'&&!_isBSFocused())renderC();
  if(_currentPage==='ranking')renderR();
  if(_currentPage==='hall')renderHall();
  var profMo=g('mo-profile');
  if(profMo&&profMo.classList.contains('on')&&_profileMemberId)_renderProfileModal();
  if(_deepLinkCh){
    var targetId=_deepLinkCh;
    requestAnimationFrame(function(){
      _scrollToChallenge(targetId);
      _deepLinkCh=null;
    });
  }
}
function _scrollToChallenge(id){
  var el=document.querySelector('[data-cid="'+id+'"]');
  if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'center'});
  el.classList.add('ch-highlight');
  setTimeout(function(){el.classList.remove('ch-highlight');},2800);
}
function _onMainScroll(){
  if(!_scrollRaf){
    _scrollRaf=requestAnimationFrame(function(){
      _scrollRaf=null;
      _isScrolling=true;
      document.documentElement.classList.add('is-scrolling');
    });
  }
  if(_scrollTimer)clearTimeout(_scrollTimer);
  _scrollTimer=setTimeout(function(){
    _isScrolling=false;
    _scrollTimer=null;
    document.documentElement.classList.remove('is-scrolling');
    requestAnimationFrame(_flushPendingRenders);
  },120);
}

// ── selectBet: 내기 제목 칩 버튼 선택 처리
window.selectBet = function(btn){
  var chips = document.querySelectorAll('#bet-chips .msg-chip');
  chips.forEach(function(c){ c.classList.remove('on'); });
  btn.classList.add('on');
  _bet = btn.dataset.bet || '';
}
const DEF_PT=1000;
const PT={individual:{win:10,loss:-5},double:{win:5,loss:-2}};
// 관리자 PIN (운영 시 변경 권장)
const ADMIN_PIN='2580';
const ADMIN_STORAGE_KEY='isatok_admin';
let _adminPinCallback=null;

function _isAdmin(){
  try{return localStorage.getItem(ADMIN_STORAGE_KEY)==='1';}catch(e){return false;}
}
function _setAdmin(on){
  try{
    if(on)localStorage.setItem(ADMIN_STORAGE_KEY,'1');
    else localStorage.removeItem(ADMIN_STORAGE_KEY);
  }catch(e){}
  document.documentElement.classList.toggle('is-admin',on);
  _updateAdminBtn();
  if(_currentPage==='challenge')renderC();
  if(_currentPage==='members')renderM();
  if(_currentPage==='ranking')renderR();
  var snMo=g('mo-season');
  if(snMo&&snMo.classList.contains('on'))_renderSeasonList();
  if(_isAdmin())renderAdminHub();
}
function _updateAdminBtn(){
  var lbl=_isAdmin()?'🔓 관리자 종료':'🔐 관리자';
  var btn=g('btn-admin'),btnM=g('btn-admin-m');
  if(btn){
    btn.textContent=lbl;
    btn.classList.toggle('btn-p',_isAdmin());
    btn.classList.toggle('btn-g',!_isAdmin());
  }
  if(btnM){
    btnM.textContent=_isAdmin()?'🔓':'🔐';
    btnM.title=_isAdmin()?'관리자 종료':'관리자';
  }
}
function _applyAdminUI(){
  document.documentElement.classList.toggle('is-admin',_isAdmin());
  _updateAdminBtn();
  if(_isAdmin())renderAdminHub();
  if(_currentPage==='admin'&&!_isAdmin())nav('challenge');
}
function _openAdminPinMo(){
  var inp=g('admin-pin');
  if(inp)inp.value='';
  openMo('mo-admin-pin');
  setTimeout(function(){if(inp)inp.focus();},200);
}
function _requireAdmin(fn){
  if(_isAdmin()){
    if(fn)fn();
    return;
  }
  _adminPinCallback=fn||null;
  _openAdminPinMo();
}
window.toggleAdmin=function(){
  if(_isAdmin()){
    _setAdmin(false);
    toast('관리자 모드 종료');
    return;
  }
  _adminPinCallback=null;
  _openAdminPinMo();
};
window.submitAdminPin=function(){
  var inp=g('admin-pin');
  var pin=(inp&&inp.value||'').trim();
  if(!/^\d{4}$/.test(pin)){toast('⚠️ 4자리 PIN을 입력해주세요');return;}
  if(pin!==ADMIN_PIN){toast('❌ PIN이 올바르지 않습니다');return;}
  _setAdmin(true);
  closeMo('mo-admin-pin');
  if(inp)inp.value='';
  toast('🔓 관리자 모드 활성화');
  var cb=_adminPinCallback;
  _adminPinCallback=null;
  if(cb)cb();
  else nav('admin');
};
window.requireAdminAction=function(fn){
  _requireAdmin(fn);
};
const DOUBLES_TYPES=['md','fd','mx','doubles'];
const GRADE_TIERS=[
  {min:1500,icon:'👑',label:'마스터',badge:'bp'},
  {min:1400,icon:'💎',label:'고수',badge:'bg'},
  {min:1300,icon:'🥇',label:'상급',badge:'bb'},
  {min:1200,icon:'🥈',label:'중급',badge:'ba'},
  {min:1100,icon:'🥉',label:'초급',badge:'bz'},
  {min:0,icon:'🌱',label:'입문',badge:'bz'}
];

function _isDoublesType(t){return DOUBLES_TYPES.indexOf(t)>=0;}
function _memberPt(m,isDouble){return isDouble?(m.doublePoint??DEF_PT):(m.individualPoint??DEF_PT);}
function _calcGrade(pt){
  var p=pt??DEF_PT;
  for(var i=0;i<GRADE_TIERS.length;i++){
    if(p>=GRADE_TIERS[i].min)return GRADE_TIERS[i];
  }
  return GRADE_TIERS[GRADE_TIERS.length-1];
}
function _memberGrade(m){return _calcGrade(_memberPt(m,false));}
function _findMemberByName(name){return MEMBERS.find(function(m){return m.name===name;});}
const AVC=['avG','avB','avA','avR','avP'];
const g=id=>document.getElementById(id);
function avc(n){let h=0;for(const c of(n||''))h+=c.charCodeAt(0);return AVC[h%5];}
function ini(n){return n?n[0]:'?';}
function $ko(d){return new Date(d).toLocaleDateString('ko-KR',{month:'long',day:'numeric'});}

const _KO_CHOSUNG='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function _extractChosung(str){
  var r='';
  for(var i=0;i<(str||'').length;i++){
    var c=str.charCodeAt(i);
    if(c>=0xAC00&&c<=0xD7A3)r+=_KO_CHOSUNG[Math.floor((c-0xAC00)/588)];
  }
  return r;
}
function _matchMemberSearch(name,query){
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
function _getRecentPlayers(){
  try{return JSON.parse(localStorage.getItem('isatok_recent')||'[]');}
  catch(e){return [];}
}
function _saveRecentPlayers(names){
  var cur=_getRecentPlayers();
  (names||[]).forEach(function(n){
    if(!n)return;
    cur=cur.filter(function(x){return x!==n;});
    cur.unshift(n);
  });
  try{localStorage.setItem('isatok_recent',JSON.stringify(cur.slice(0,24)));}
  catch(e){}
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
window.onBsPlayerSearch=function(){
  _scheduleBsPlayerSearchRender();
};
function _focusBsSearchInput(el){
  if(!el||!_isBSOpen())return;
  _unlockBodyForBsSearch();
  var run=function(){
    if(!_isBSOpen())return;
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
      if(_isBSOpen()&&!_isBsPlayerSearchFocused())_lockBodyScroll();
    },BS_ANIM_MS+40);
    return;
  }
  run();
}
function _initBsPlayerSearchInputs(){
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
        if(_isBSOpen())renderGridsBS({force:true});
      },150);
    });
    el.addEventListener('input',function(){
      if(_bsSearchComposing)return;
      _scheduleBsPlayerSearchRender();
    });
  });
}

// ─────────────────────────────────────────
// 회원 그리드 diff-patch 공통 헬퍼
// renderGrid, renderAcceptGrid 에서 공통 사용
// ─────────────────────────────────────────
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

// ── 초기화 ──
async function init(){
  const safe=setTimeout(()=>{finish();toast('⚠️ 연결 지연');},6000);
  try{
    _fbApp=initializeApp(FB);
    db=getFirestore(_fbApp);
    // ★ 모바일은 window/document 스크롤 → window+main 모두 passive 리스너
    _bindScrollPerf();

    // RAF 디바운스: Firestore 연속 이벤트 시 한 프레임에 한 번만 렌더
    let _rafC=null,_rafM=null,_rafN=null,_rafB=null;
    setDb(true);
    onSnapshot(query(collection(db,'members'),orderBy('name')),s=>{
      MEMBERS=s.docs.map(d=>({id:d.id,...d.data()}));
      if(_rafM)cancelAnimationFrame(_rafM);
      _rafM=requestAnimationFrame(()=>{
        _applyMembersSnapshotRender();
        _rafM=null;
      });
    });
    onSnapshot(query(collection(db,'challenges'),orderBy('createdAt','desc')),s=>{
      CHAL=s.docs.map(d=>({id:d.id,...d.data()}));
      if(_rafC)cancelAnimationFrame(_rafC);
      _rafC=requestAnimationFrame(()=>{
        _applyChallengesSnapshotRender();
        _rafC=null;
      });
    });
    let _rafSn=null;
    onSnapshot(query(collection(db,'seasons'),orderBy('startDate','desc')),s=>{
      SEASONS=s.docs.map(d=>({id:d.id,...d.data()}));
      if(_rafSn)cancelAnimationFrame(_rafSn);
      _rafSn=requestAnimationFrame(()=>{
        _applySeasonsSnapshotRender();
        _rafSn=null;
      });
    });
    try{
      onSnapshot(collection(db,'tournaments'),s=>{
        TOURNAMENTS=s.docs.map(d=>({id:d.id,...d.data()}));
        if(_currentPage==='hall')renderHall();
        var profMo=g('mo-profile');
        if(profMo&&profMo.classList.contains('on')&&_profileMemberId)_renderProfileModal();
      });
    }catch(e){}
    // 공지사항·자유게시판은 UI 제거로 구독 불필요 (Firebase 데이터는 보존)
    clearTimeout(safe);finish();
  }catch(e){clearTimeout(safe);setDb(false);toast('❌ '+e.message);finish();}
}
function _parseEntryFromLocation(){
  var pageId=null,params={};
  try{
    var sp=new URLSearchParams(window.location.search);
    if(sp.get('p')){
      pageId=sp.get('p');
      if(sp.get('ch'))params.ch=decodeURIComponent(sp.get('ch'));
      if(sp.get('filter'))params.filter=sp.get('filter');
      return {pageId:pageId,params:params};
    }
  }catch(e){}
  var hash=window.location.hash;
  if(hash&&hash.length>1){
    var hashBody=hash.slice(1);
    var qIdx=hashBody.indexOf('?');
    pageId=qIdx>-1?hashBody.slice(0,qIdx):hashBody;
    if(qIdx>-1){
      hashBody.slice(qIdx+1).split('&').forEach(function(pair){
        var kv=pair.split('=');
        if(kv.length===2)params[kv[0]]=decodeURIComponent(kv[1]);
      });
    }
  }
  return {pageId:pageId,params:params};
}
function _applyEntryNavigation(){
  var entry=_parseEntryFromLocation();
  var validPages=['challenge','ranking','members','hall','admin','my'];
  if(!entry.pageId||validPages.indexOf(entry.pageId)<0)return;
  nav(entry.pageId);
  if(entry.pageId==='challenge'){
    if(entry.params.ch)_deepLinkCh=entry.params.ch;
    if(entry.params.filter){
      window.setF(entry.params.filter);
    }else if(entry.params.ch){
      _pendingDeepLinkFilter=entry.params.ch;
    }
  }
}
function finish(){
  g('ls').style.display='none';
  g('app').style.display='flex';        // app-wrap 표시
  const sb=g('sidebar');
  if(sb) sb.style.display='';           // 사이드바 표시 (CSS가 모바일에서 숨김)

  // 카카오 공유 링크: ?p=challenge&ch=ID (카톡 Feed) 또는 #challenge?… (구버전)
  _applyEntryNavigation();
  _applyAdminUI();
  _initBsPlayerSearchInputs();
  _initVersionUI();
  _initUxDefaults();
  initPwa();
  initWizard({
    g,
    getMembers:function(){return MEMBERS;},
    getChal:function(){return CHAL;},
    TM,GM,
    toast:window.toast,
    openMo,closeMo,
    nav:window.nav,
    getState:function(){return{_my,_opp,_type,_bet};},
    setMy:function(v){_my=v;},
    setOpp:function(v){_opp=v;},
    setType:function(tp){_type=tp;},
    getEditId:function(){return _editChId;},
    isInstantMode:_isInstantCreateMode,
    mountInstantResultForm:_mountInstantResultForm,
    unmountInstantResultForm:_unmountInstantResultForm,
    scrollBsStep:_scrollBsStep,
    initResultForm:_initResultForm,
    getBsGameMode:function(){return _bsGameMode;},
    computeDoublesRecord:_computeDoublesRecord,
    computeSinglesRecord:_computeSinglesRecord,
    computeCombinedRecord:_computeCombinedRecord,
    computeMemberBadges:_computeMemberBadges,
    buildMemberBadgesHtml:_buildMemberBadgesHtml,
    getMemberRankPosition:_getMemberRankPosition,
    nowDateTimeFields:_nowDateTimeFields,
    updateChSubmitBtn:_updateChSubmitBtn,
    onMyPlayerChanged:function(){renderMyRecordHome();renderMyPage();}
  });
  initMyPlayerOnLoad();
  document.body.classList.toggle('has-fab',_currentPage==='challenge');
}
function _initUxDefaults(){
  setRkScope('season');
  setRk('double');
  var hallDbl=g('hall-dbl'),hallInd=g('hall-ind');
  if(hallDbl)hallDbl.classList.toggle('on',_hallMode==='double');
  if(hallInd)hallInd.classList.toggle('on',_hallMode==='individual');
}
function _applyDeepLinkFilter(chId){
  var c=CHAL.find(function(x){return x.id===chId;});
  if(c) window.setF(_shareFilterFor(c));
}
function setDb(ok){
  const h=ok?'<span style="color:var(--a)">● Firebase 연결됨</span>':'<span style="color:var(--amber)">● 연결 실패</span>';
  g('dbs').innerHTML=h;g('dbm').textContent=ok?'🟢':'🟡';
}

function _initVersionUI(){
  var label='v'+APP_VERSION;
  document.querySelectorAll('.header-ver-text').forEach(function(el){el.textContent=label;});
}
window.openVersionInfo=function(){
  toast('버전 : v'+APP_VERSION,{duration:2800});
};

// ── 모달 헬퍼 ──

// ════════════════════════════════════════════════════════
// 📱 대결 신청 Bottom Sheet 전용 함수
// ────────────────────────────────────────────────────────
// visualViewport 이벤트 방식 완전 제거:
//   position:fixed;bottom:0 구조이므로 키보드가 올라와도
//   레이아웃 변동이 없어 깜빡임 자체가 발생하지 않음
// ════════════════════════════════════════════════════════

var _bsSwipeInited=false,_bsClosing=false;
var BS_ANIM_MS=320;
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
  _bsLockTimer=setTimeout(function(){
    _bsLockTimer=null;
    _bsAnimating=false;
    sheet.classList.add('bs-ready');
    if(_isBSOpen()&&!_isBsPlayerSearchFocused())_lockBodyScroll();
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
  _editChId = null;
  _bsPresetInstant = false;
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

window.openInstantBS=function(){
  if(!requireMyPlayer())return;
  _editChId=null;
  _bsPresetInstant=true;
  _my=[];_opp=[];
  var chk=g('oc-chk');
  if(chk)chk.checked=false;
  var wrap=g('oc-toggle-wrap');
  if(wrap){wrap.classList.remove('on');wrap.style.display='none';}
  var submitBtn=g('ch-submit-btn');
  if(submitBtn)submitBtn.textContent='⚡ 즉시 생성 · 결과 입력';
  var bsTitleEm=g('bs-ch')&&g('bs-ch').querySelector('.bs-title em');
  if(bsTitleEm)bsTitleEm.textContent='즉시';
  _bet='';
  _resetBsCreateUI();
  setChCreateMode('instant');
  setBsGameMode('bo1');
  var now=_nowDateTimeFields();
  var dateEl=g('ch-date');if(dateEl)dateEl.value=now.date;
  var timeEl=g('ch-time');if(timeEl)timeEl.value=now.time;
  wizResetFlow(true);
  _syncBsFootNav();
  bsStep(1);
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
  var ready=CHAL.filter(function(c){return _chResultReady(c);});
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

function renderAdminHub(){
  var box=g('admin-hub');
  if(!box||!_isAdmin())return;
  var items=[
    {icon:'✏️',title:'결과 수정',desc:'완료된 경기 결과 변경',fn:"adminGoResultEdit()"},
    {icon:'🗑',title:'결과 삭제',desc:'대결 카드 삭제',fn:"adminGoDelete()"},
    {icon:'👤',title:'회원 관리',desc:'등록 · 수정 · 삭제',fn:"nav('members')"},
    {icon:'📈',title:'통계 새로고침',desc:'명예의 전당 다시 계산',fn:"adminRefreshStats()"},
    {icon:'📅',title:'시즌 관리',desc:'시즌 생성 · 종료',fn:"openSeasonMo()"}
  ];
  box.innerHTML=items.map(function(it){
    return '<button type="button" class="admin-hub-card" onclick="'+it.fn+'">'
      +'<span class="admin-hub-icon">'+it.icon+'</span>'
      +'<div class="admin-hub-text"><div class="admin-hub-t">'+it.title+'</div><div class="admin-hub-d">'+it.desc+'</div></div>'
      +'</button>';
  }).join('');
}
window.adminGoResultEdit=function(){
  nav('challenge');
  setF('completed');
  toast('완료된 대결에서 「결과 수정」을 선택하세요');
};
window.adminGoDelete=function(){
  nav('challenge');
  setF('all');
  toast('삭제할 대결 카드의 🗑 버튼을 눌러주세요');
};
window.adminRefreshStats=function(){
  renderHall();
  if(_currentPage==='ranking')renderR();
  toast('📈 통계를 새로고침했습니다');
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
  if(_isAdmin())utility+=_chDeleteBtn(c.id);
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
  }else if(c.status==='completed'&&_isAdmin()){
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
  var c = CHAL.find(function(x){ return x.id === id; });
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
window.closeBS = function(){
  var wasOpen=_isBSOpen();
  _hideBS(function(){
    _unmountInstantResultForm();
    _editChId = null;
    _bsSearchComposing=false;
    _bsGridRefreshPending=false;
    if(_bsSearchRaf){cancelAnimationFrame(_bsSearchRaf);_bsSearchRaf=null;}
    _resetBsScrollState();
    var submitBtn = g('ch-submit-btn');
    if(submitBtn) submitBtn.textContent = '🏓 도전장 보내기';
    var bsTitleEm = g('bs-ch') && g('bs-ch').querySelector('.bs-title em');
    if(bsTitleEm) bsTitleEm.textContent = '신청';
    _resetBsCreateUI();
    if(wasOpen)requestAnimationFrame(_unlockBodyScroll);
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
  var foot2Next=g('bs-foot2')&&g('bs-foot2').querySelector('.btn-p');
  if(foot2Next){
    foot2Next.setAttribute('onclick',_editChId?'bsStepNextFrom2()':'bsStep(3)');
  }
  var foot4Prev=g('bs-foot4')&&g('bs-foot4').querySelector('.btn-g');
  if(foot4Prev){
    foot4Prev.setAttribute('onclick',_editChId?'bsStepPrevFrom4()':'bsStep(3)');
  }
}

window.bsStep = function(n){
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
    submitBtn.textContent='⚡ 즉시 생성 · 결과 입력';
    return;
  }
  var isOpen=g('oc-chk')&&g('oc-chk').checked;
  if(isOpen)submitBtn.textContent='🔥 오픈 챌린지 올리기';
  else submitBtn.textContent='🏓 도전장 보내기';
}
window.updateChSubmitBtn=_updateChSubmitBtn;

function _debugChallengeCreate(info){
  if(typeof console==='undefined'||!console.log)return;
  console.log('[isatok] challenge create',info);
}
function _debugCardActions(c){
  if(typeof console==='undefined'||!console.log||!c)return;
  var isOpen=!!c.isOpen&&c.status==='pending';
  var actions=[];
  if(isOpen)actions.push('accept-open','edit','reject');
  else if(_chPendingAccept(c))actions.push('accept','edit','reject');
  else if(_chResultReady(c))actions.push('result-input');
  else if(c.status==='completed')actions.push('result-edit');
  console.log('[isatok] card actions',{
    id:c.id,status:c.status,instantCreate:!!c.instantCreate,isOpen:isOpen,actions:actions
  });
}

// ── 바텀시트 전용 신청 저장 (기존 submitCh 로직 재사용, ID 참조만 동일하게 유지)
window.submitChBS = async function(){
  if(!requireMyPlayer())return;
  var creator=buildCreatorFields();
  if(!creator)return;
  var isOpenMode = g('oc-chk') && g('oc-chk').checked;
  var editId = _editChId;
  var instantMode = !editId && _isInstantCreateMode() && !isOpenMode;
  _debugChallengeCreate({
    phase:'submit',
    createMode:instantMode?'instant':(isOpenMode?'open':'normal'),
    instantCreate:instantMode,
    requiresAcceptance:!instantMode&&!isOpenMode,
    isOpenMode:isOpenMode,
    checkboxChecked:_bsCreateMode==='instant',
    stateFlag:_instantCreate,
    type:_type,
    myTeam:[..._my],
    oppTeam:isOpenMode?[]:[..._opp]
  });
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
      if(db){
        await updateDoc(doc(db,'challenges',editId), fields);
      } else {
        var target = CHAL.find(function(c){ return c.id === editId; });
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
    let newId = 'l' + Date.now();
    if(db){ const ref = await addDoc(collection(db,'challenges'), data); newId = ref.id; }
    else { CHAL.unshift({id: newId, ...data}); renderC(); }
    _saveRecentPlayers([..._my,..._opp]);
    saveWizRecentCombos();
    var saved={id:newId,...data};
    _debugChallengeCreate({
      phase:'saved',
      createMode:instantMode?'instant':(isOpenMode?'open':'normal'),
      status:saved.status,
      instantCreate:!!saved.instantCreate,
      requiresAcceptance:saved.status==='pending',
      acceptedAt:saved.acceptedAt||null
    });
    _debugCardActions(saved);
    if(instantMode&&pendingResult&&pendingResult.winner){
      try{
        if(db){
          await updateDoc(doc(db,'challenges',newId),{status:'completed',winner:pendingResult.winner,score:pendingResult.score});
        }
        saved.status='completed';saved.winner=pendingResult.winner;saved.score=pendingResult.score;
        saved.gameMode=pendingResult.gameMode;
        if(!db){var loc=CHAL.find(function(c){return c.id===newId;});if(loc)Object.assign(loc,saved);renderC();}
        await _updateMatchPoints(saved,pendingResult.winner,1);
        toast(pendingResult.score?'🏆 대결 생성 및 결과 저장!':'🏆 대결 생성 · 승자 기록!');
        if(_currentPage==='ranking')renderR();
        renderMyRecordHome();renderMyPage();
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

function openMo(id){
  const el = g(id);
  if(!el){console.error('Modal not found:',id);return;}
  el.classList.add('on');
  // 작성 모달: 첫 번째 입력 필드로 포커스
  if(el.classList.contains('write-mo')){
    setTimeout(()=>{
      const first = el.querySelector('input:not([type=hidden]), textarea');
      if(first) first.focus();
    }, 320);
  }
  requestAnimationFrame(_lockBodyScroll);
}
window.closeMo=function(id){
  if(id==='mo-my-player'&&isMyPlayerSetupMandatory())return;
  var el=g(id);
  if(!el||!el.classList.contains('on'))return;
  el.classList.remove('on');
  if(id==='mo-admin-pin'){
    _adminPinCallback=null;
    var pinEl=g('admin-pin');
    if(pinEl)pinEl.value='';
  }
  requestAnimationFrame(_unlockBodyScroll);
}
document.querySelectorAll('.mo').forEach(m=>m.addEventListener('click',e=>{
  if(e.target===m&&m.classList.contains('on')){
    if(m.id==='mo-my-player'&&isMyPlayerSetupMandatory())return;
    m.classList.remove('on');
    requestAnimationFrame(_unlockBodyScroll);
  }
}));

// ── 네비 ──
// ★ 성능 최적화: querySelectorAll 결과를 모듈 스코프에서 한 번만 캐싱
// nav() 가 탭 전환마다 호출될 때마다 전체 DOM 탐색하는 비용 제거
let _navPages=null,_navItems=null,_navBni=null,_navFab=null,_navMain=null;
function _initNavCache(){
  _navPages=Array.from(document.querySelectorAll('.page'));
  _navItems=Array.from(document.querySelectorAll('.nav-i'));
  _navBni=Array.from(document.querySelectorAll('.bni'));
  _navFab=Array.from(g('app').querySelectorAll('.fab'));
  _navMain=document.querySelector('.main');
}
window.nav=function(id){
  if(id==='my'&&!requireMyPlayer())return;
  // 최초 1회 캐싱 (DOM 로드 후 변하지 않는 노드)
  if(!_navPages)_initNavCache();
  _currentPage=id;
  _navPages.forEach(p=>p.classList.toggle('on',p.id==='page-'+id));
  _navItems.forEach(n=>n.classList.toggle('on',n.dataset.page===id));
  _navBni.forEach(n=>n.classList.toggle('on',n.dataset.p===id));
  if(_navMain)_navMain.scrollTo(0,0);
  const fabDisplay=id==='challenge'?'flex':'none';
  _navFab.forEach(f=>f.style.display=fabDisplay);
  document.body.classList.toggle('has-fab',id==='challenge');
  // 탭 전환 시 스냅샷 중 스킵된 렌더 1회 보정
  if(id==='members')renderM();
  else if(id==='ranking')renderR();
  else if(id==='hall')renderHall();
  else if(id==='my')renderMyPage();
  else if(id==='admin'){if(_isAdmin())renderAdminHub();else nav('challenge');}
  else if(id==='challenge')renderC();
}

// ════ 대결 ════
const TM={
  ms:{lb:'🏓 남단식', badge:'bg', cls:'ms', maxM:1,maxO:1, gM:'남성',gO:'남성'},
  md:{lb:'🏓 남복식', badge:'bb', cls:'md', maxM:2,maxO:2, gM:'남성',gO:'남성'},
  fs:{lb:'🎀 여단식', badge:'br', cls:'fs', maxM:1,maxO:1, gM:'여성',gO:'여성'},
  fd:{lb:'🎀 여복식', badge:'bp', cls:'fd', maxM:2,maxO:2, gM:'여성',gO:'여성'},
  mx:{lb:'🤝 혼합복식',badge:'ba', cls:'mx', maxM:2,maxO:2, mix:true},
  singles:{lb:'🏓 단식', badge:'bg', cls:'singles', maxM:1,maxO:1},
  doubles:{lb:'🤝 복식', badge:'bp', cls:'doubles', maxM:2,maxO:2},
};
const SL={pending:'⏳ 수락 대기',accepted:'✅ 수락됨',rejected:'❌ 거절됨',completed:'🏆 완료'};
const SB={pending:'ba',accepted:'bg',rejected:'br',completed:'bz'};
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
  // ★ 성능 최적화: querySelectorAll 결과 캐싱 (setF 호출마다 DOM 탐색 방지)
  if(!window._fcEls)window._fcEls=Array.from(document.querySelectorAll('.fc'));
  window._fcEls.forEach(el=>el.classList.toggle('on',el.id==='f-'+f));
  renderC();
}
// ── 오픈 챌린지 대기 중 개수 뱃지 업데이트
function updateOpenBadge(){
  const count=CHAL.filter(c=>c.isOpen&&c.status==='pending').length;
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

function renderC(){
  const list=g('ch-list'),empty=g('ch-empty');
  // ── 스크롤 중 뱃지 DOM 조작 스킵 (Forced Reflow 방지)
  if(!_isScrolling)updateOpenBadge();
  let data=[...CHAL];
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
  if(!data.length){
    // 기존 카드 노드 제거 (깜빡임 없이 개별 제거)
    while(list.firstChild)list.removeChild(list.firstChild);
    empty.style.display='block';
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
    hashMap[c.id]=c.id+'|'+c.status+'|'+(c.isOpen?'1':'0')+'|'+(c.instantCreate?'1':'0')+'|'+(c.winner||'')+'|'+(c.score||'')+'|'+(c.place||'')+'|'+(c.bet||'')+'|'+JSON.stringify(c.betPicks||{})+'|'+(c.date||'')+'|'+(c.time||'')+'|'+(c.type||'')+'|'+JSON.stringify(c.myTeam||[])+'|'+JSON.stringify(c.oppTeam||[])+'|'+(_isAdmin()?'1':'0');
  });

  // PHASE 4: WRITE - 삽입/업데이트 (children 배열 캐싱으로 반복 layout read 제거)
  var childList=Array.from(list.children);
  data.forEach((c,idx)=>{
    const newHash=hashMap[c.id];
    let existing=existingMap[c.id];
    if(existing){
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
    return `<div class="${cardClass}" data-cid="${c.id}">
      <div class="cc-head"><div class="cc-badges"><span class="badge ${tm.badge}">${tm.lb}</span>${statusBadge}${openBadge}${betBadge}${c.instantCreate&&!isOpen?'<span class="badge bg">⚡ 즉시</span>':''}</div></div>
      <div class="cc-vs-title">${vsHtml}</div>
      ${formatChallengeCreatorHtml(c)}
      ${pills?`<div class="cc-pills">${pills}</div>`:''}
      ${res}
      ${betPicksHtml}
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
  if(_isBSOpen())wizRenderStep(3);
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
function renderGridsBS(opts){
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
  let mems=MEMBERS.filter(x=>x.status!=='비활성'&&_matchMemberSearch(x.name,q));
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
      const myM=_my.filter(n=>MEMBERS.find(x=>x.name===n)?.gender==='남성').length;
      const myF=_my.filter(n=>MEMBERS.find(x=>x.name===n)?.gender==='여성').length;
      const opM=_opp.filter(n=>MEMBERS.find(x=>x.name===n)?.gender==='남성').length;
      const opF=_opp.filter(n=>MEMBERS.find(x=>x.name===n)?.gender==='여성').length;
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
var _acceptOpenId=null;   // 현재 수락 중인 챌린지 ID
var _acceptTeam=[];       // 수락자 팀 선택 배열

window.openAcceptOpen=function(id){
  var c=CHAL.find(function(c){return c.id===id;});
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
  var mems=MEMBERS.filter(function(x){return x.status!=='비활성';});

  // ── 각 회원 상태 계산 (READ-only, DOM 접근 없음)
  var memStates=mems.map(function(x){
    var isSelected=_acceptTeam.indexOf(x.name)>-1;
    var isDim=challengerTeam.indexOf(x.name)>-1;
    if(!isDim&&tm.mix){
      var mCount=_acceptTeam.filter(function(n){
        var mb=MEMBERS.find(function(m){return m.name===n;});return mb&&mb.gender==='남성';
      }).length;
      var fCount=_acceptTeam.filter(function(n){
        var mb=MEMBERS.find(function(m){return m.name===n;});return mb&&mb.gender==='여성';
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
    var mb=_findMemberByName(x.name)||{};
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
  var c=CHAL.find(function(c){return c.id===_acceptOpenId;});
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
  var c=CHAL.find(function(c){return c.id===_acceptOpenId;});
  if(!c)return;
  var tm=TM[c.type]||TM.ms;

  // ── 팀 구성 유효성 검사 ──
  var ok=true;
  if(tm.mix){
    var mCount=_acceptTeam.filter(function(n){
      var mb=MEMBERS.find(function(m){return m.name===n;});return mb&&mb.gender==='남성';
    }).length;
    var fCount=_acceptTeam.filter(function(n){
      var mb=MEMBERS.find(function(m){return m.name===n;});return mb&&mb.gender==='여성';
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
    if(db)await updateDoc(doc(db,'challenges',_acceptOpenId),updateData);
    else{
      var target=CHAL.find(function(c){return c.id===_acceptOpenId;});
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
  try{if(db)await updateDoc(doc(db,'challenges',id),{status:'accepted'});else{CHAL.find(c=>c.id===id)&&(CHAL.find(c=>c.id===id).status='accepted');renderC();}toast('✅ 수락했습니다!');}
  catch(e){toast('❌ '+e.message);}
}
window.rejectC=async function(id){
  if(!confirm('거절하시겠습니까?'))return;
  try{if(db)await updateDoc(doc(db,'challenges',id),{status:'rejected'});else{CHAL.find(c=>c.id===id)&&(CHAL.find(c=>c.id===id).status='rejected');renderC();}toast('거절했습니다');}
  catch(e){toast('❌ '+e.message);}
}
window.delC=async function(id){
  if(!_isAdmin()){_requireAdmin(function(){delC(id);});return;}
  if(!confirm('삭제하시겠습니까?'))return;
  try{if(db)await deleteDoc(doc(db,'challenges',id));else{CHAL=CHAL.filter(c=>c.id!==id);renderC();}toast('🗑 삭제됐습니다');}
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

let _resultFormMountedInWizard=false;

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
  if(wanEl)wanEl.textContent=myNames+' 팀 승리';
  if(wbnEl)wbnEl.textContent=opNames+' 팀 승리';
  ['wa','wb'].forEach(function(x){
    var el=g(x);
    if(el){el.style.borderColor='var(--b2)';el.style.background='transparent';}
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
    setResMode('detail');
    renderSetWinPickRows();
    renderSetInputRows();
  }else{
    setResMode('winner');
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
  const c=CHAL.find(c=>c.id===id);if(!c)return;
  if(c.status==='completed'&&!_isAdmin()){
    _requireAdmin(function(){openRes(id);});
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
  ['a','b'].forEach(k=>{g('w'+k).style.borderColor=k===t?'var(--a)':'var(--b2)';g('w'+k).style.background=k===t?'var(--adim)':'transparent';});
}

// ── 드럼롤 피커 초기화 및 제어
// 듀스 대응: 0~30 범위, 상한 제한 없음 (tabletTennis deuce rule)
var DRUM_MAX = 30; // 드럼롤 표시 최대 점수
var DRUM_ITEM_H = 44; // 아이템 높이(px) — CSS .drum-item 높이와 일치해야 함

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
var _drumsInited=false; // 중복 바인딩 방지

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

// ── renderSets: 세트 요약 갱신 (하위 호환)
function renderSets(){
  _renderSetSummary();
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
    var c=CHAL.find(function(c){return c.id===_rid;});
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
    var m=_findMemberByName(nm);
    if(m)deltas.push({id:m.id,field:field,delta:pts.win*sign});
  });
  loseTeam.forEach(function(nm){
    var m=_findMemberByName(nm);
    if(m)deltas.push({id:m.id,field:field,delta:pts.loss*sign});
  });
  for(var i=0;i<deltas.length;i++){
    var d=deltas[i];
    var m=MEMBERS.find(function(x){return x.id===d.id;});
    if(!m)continue;
    var cur=_memberPt(m,isDbl);
    var nv=cur+d.delta;
    if(db){
      var upd={};upd[d.field]=nv;
      await updateDoc(doc(db,'members',d.id),upd);
    }else{
      var idx=MEMBERS.findIndex(function(x){return x.id===d.id;});
      if(idx>-1){MEMBERS[idx][d.field]=nv;}
    }
  }
}

window.submitResult=async function(){
  if(!_rw){toast('⚠️ 승리 팀 선택');return;}
  var c=CHAL.find(function(x){return x.id===_rid;});
  if(!c)return;
  if(_resEditMode&&!_isAdmin()){toast('⚠️ 관리자만 결과를 수정할 수 있습니다');return;}

  // ── 스코어 문자열 조합 (입력 방식별) ──
  var sc=_buildResultScore();

  try{
    // 결과 수정 시 기존 포인트 되돌리기
    if(_resEditMode&&c.status==='completed'&&c.winner){
      await _updateMatchPoints(c,c.winner,-1);
    }
    if(db){
      await updateDoc(doc(db,'challenges',_rid),{status:'completed',winner:_rw,score:sc||null});
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
    if(_currentPage==='ranking')renderR();
    if(_currentPage==='members')renderM();
    var hasScore=!!sc;
    var msg=wasEdit
      ?(hasScore?'✏️ 결과 수정 완료!':'✏️ 결과 수정 완료!')
      :(hasScore?'🏆 결과 기록!':'🏆 승자만 기록!');
    toast(msg);
  }
  catch(e){toast('❌ '+e.message);}
}

// ════ 회원 ════

// ════ 랭킹 ════

// ── 개인전(단식) 경기 기록 기반 통계 (CHAL에서 실시간 계산, 별도 저장 없음) ──
function _isSinglesType(t){return t==='ms'||t==='fs';}
function _matchSortKey(c){
  var d=c.date||'';
  if(!d&&c.createdAt)d=c.createdAt.slice(0,10);
  var t=c.time||'00:00';
  return d+'T'+t;
}
function _fmtStatDate(c){
  var d=c.date||'';
  if(!d&&c.createdAt)d=c.createdAt.slice(0,10);
  return d||'-';
}
function _isSinglesMatch(c){
  if(c.status!=='completed'||!_isSinglesType(c.type))return false;
  var my=c.myTeam||[],opp=c.oppTeam||[];
  return my.length===1&&opp.length===1;
}
function _playerSideInMatch(c,name){
  var my=c.myTeam||[],opp=c.oppTeam||[];
  if(my[0]===name)return'a';
  if(opp[0]===name)return'b';
  return null;
}
function _playerWonMatch(c,name){
  var side=_playerSideInMatch(c,name);
  return side&&c.winner===side;
}
function _getSinglesMatchesFor(playerName){
  return CHAL.filter(function(c){
    if(!_isSinglesMatch(c))return false;
    var my=(c.myTeam||[])[0],opp=(c.oppTeam||[])[0];
    return my===playerName||opp===playerName;
  }).sort(function(a,b){return _matchSortKey(b).localeCompare(_matchSortKey(a));});
}
function _getDoublesMatchesFor(playerName){
  return CHAL.filter(function(c){
    if(c.status!=='completed'||!_isDoublesType(c.type))return false;
    return _playerSideInAnyMatch(c,playerName);
  }).sort(function(a,b){return _matchSortKey(b).localeCompare(_matchSortKey(a));});
}
function _getMatchesForMode(playerName,isDbl,filterFn){
  var matches=isDbl?_getDoublesMatchesFor(playerName):_getSinglesMatchesFor(playerName);
  if(filterFn)matches=matches.filter(filterFn);
  return matches;
}
function _computeModeRecord(name,isDbl,filterFn){
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
function _computeDoublesRecord(name,filterFn){
  return _computeModeRecord(name,true,filterFn);
}
function _computeTopPartner(name,filterFn){
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
function _computeBestWinRatePartner(name,minGames,filterFn){
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
function _computeRatingHistory(name,isDbl){
  var matches=_getMatchesForMode(name,isDbl).slice().sort(function(a,b){
    return _matchSortKey(a).localeCompare(_matchSortKey(b));
  });
  var pts=DEF_PT;
  var ptsCfg=isDbl?PT.double:PT.individual;
  var history=[{date:'',points:pts,label:'시작'}];
  matches.forEach(function(c){
    if(_playerWonAnyMatch(c,name))pts+=ptsCfg.win;
    else pts+=ptsCfg.loss;
    history.push({date:_fmtStatDate(c),points:pts});
  });
  return history;
}
function _buildRatingChartSvg(history){
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
function _formatRecentMatchLine(c,playerName,isDbl){
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
function _getRecentMatchLines(playerName,isDbl,limit,seasonFilter){
  var matches=_getMatchesForMode(playerName,isDbl,seasonFilter);
  return matches.slice(0,limit||3).map(function(c){
    return _formatRecentMatchLine(c,playerName,isDbl);
  });
}
function _getMemberRankPosition(m,isDbl,isSeason){
  var season=_getCurrentSeason();
  if(isSeason&&!season)return null;
  var list=MEMBERS.filter(function(x){return x.status!=='비활성';})
    .map(function(x){
      var pt=isSeason&&season?_computeSeasonPoints(x,season,isDbl):_memberPt(x,isDbl);
      return {m:x,pt:pt};
    })
    .sort(function(a,b){return b.pt-a.pt||((a.m.name||'').localeCompare(b.m.name||''));});
  for(var i=0;i<list.length;i++){
    if(list[i].m.id===m.id)return i+1;
  }
  return null;
}
function _areOpponentsInMatch(c,nameA,nameB){
  var sideA=_playerSideInAnyMatch(c,nameA);
  var sideB=_playerSideInAnyMatch(c,nameB);
  return sideA&&sideB&&sideA!==sideB;
}
function _getHeadToHeadMatches(nameA,nameB){
  return CHAL.filter(function(c){
    if(c.status!=='completed')return false;
    if(_isSinglesMatch(c)||_isDoublesType(c.type))return _areOpponentsInMatch(c,nameA,nameB);
    return false;
  }).sort(function(a,b){return _matchSortKey(b).localeCompare(_matchSortKey(a));});
}
function _getAllMatchesFor(playerName,filterFn){
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
function _computeCombinedRecord(name,filterFn){
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
function _computeHeadToHead(nameA,nameB){
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

// ── 시즌 / 배지 / 명예의 전당 (CHAL·seasons 기반 실시간 계산) ──
function _chMatchDate(c){
  var d=c.date||'';
  if(!d&&c.createdAt)d=c.createdAt.slice(0,10);
  return d;
}
function _chInSeason(c,season){
  if(!season||!season.startDate)return false;
  var d=_chMatchDate(c);
  if(!d)return false;
  if(d<season.startDate)return false;
  if(season.endDate&&d>season.endDate)return false;
  return true;
}
function _getCurrentSeason(){
  return SEASONS.find(function(s){return s.isCurrent&&s.status!=='ended';})||null;
}
function _playerSideInAnyMatch(c,name){
  var my=c.myTeam||[],opp=c.oppTeam||[];
  if(my.indexOf(name)>=0)return'a';
  if(opp.indexOf(name)>=0)return'b';
  return null;
}
function _playerWonAnyMatch(c,name){
  var side=_playerSideInAnyMatch(c,name);
  return side&&c.winner===side;
}
function _isMatchForRkMode(c,isDbl){
  if(c.status!=='completed')return false;
  return isDbl?_isDoublesType(c.type):_isSinglesType(c.type);
}
function _computeSeasonPoints(member,season,isDbl){
  var pt=DEF_PT,name=member.name;
  CHAL.forEach(function(c){
    if(!_chInSeason(c,season)||!_isMatchForRkMode(c,isDbl))return;
    if(!_playerSideInAnyMatch(c,name))return;
    var pts=isDbl?PT.double:PT.individual;
    if(_playerWonAnyMatch(c,name))pt+=pts.win;
    else pt+=pts.loss;
  });
  return pt;
}
function _seasonFilterFn(season){
  return function(c){return _chInSeason(c,season);};
}
function _computeStreakFromMatches(matches,playerName,isDbl){
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
function _computeSinglesRecord(name,filterFn){
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
function _countSeasonChampionships(name){
  return SEASONS.filter(function(s){
    return s.status==='ended'&&s.champion&&s.champion.name===name;
  }).length;
}
function _countTournamentWins(name){
  var n=0;
  TOURNAMENTS.forEach(function(t){
    if(t.winner===name||t.champion===name)n++;
  });
  CHAL.forEach(function(c){
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
function _computeMemberBadges(name){
  var rec=_computeCombinedRecord(name);
  var ctx={tournamentWins:_countTournamentWins(name),seasonChampions:_countSeasonChampionships(name)};
  return BADGE_DEFS.filter(function(b){return b.check(rec,ctx);});
}
function _buildMemberBadgesHtml(name){
  var badges=_computeMemberBadges(name);
  if(!badges.length){
    return '<div class="stat-box" style="text-align:center;color:var(--t3);font-size:13px">아직 획득한 배지가 없습니다</div>';
  }
  return '<div class="stat-box"><div class="stat-box-t">🏅 보유 배지 '+badges.length+'개</div>'
    +'<div class="badge-grid">'+badges.map(function(b){
      return '<div class="member-badge" title="'+b.desc+'"><span class="member-badge-icon">'+b.icon+'</span><span class="member-badge-lbl">'+b.label+'</span></div>';
    }).join('')+'</div></div>';
}
function _renderMemberBadges(name){
  var el=g('prof-badges');
  if(!el)return;
  el.innerHTML=_buildMemberBadgesHtml(name);
}
function _applySeasonsSnapshotRender(){
  if(_isScrolling){_pendingRender.sn=true;return;}
  if(_currentPage==='ranking')renderR();
  if(_currentPage==='hall')renderHall();
  var snMo=g('mo-season');
  if(snMo&&snMo.classList.contains('on'))_renderSeasonList();
  var profMo=g('mo-profile');
  if(profMo&&profMo.classList.contains('on')&&_profileMemberId)_renderProfileModal();
}
function _updateRkSeasonBar(isSeason,season){
  var bar=g('rk-season-info');
  if(!bar)return;
  if(!isSeason){bar.style.display='none';return;}
  bar.style.display='';
  if(!season){
    bar.innerHTML='<span style="color:var(--amber);font-weight:700">⚠️ 현재 시즌이 없습니다. 📅 시즌 버튼에서 생성해 주세요.</span>';
    return;
  }
  var range=season.startDate+(season.endDate?' ~ '+season.endDate:' ~ 진행중');
  bar.innerHTML='<span style="font-weight:800;color:var(--t1)">📅 '+season.name+'</span>'
    +'<span style="color:var(--t3);font-size:13px;margin-left:8px">'+range+'</span>'
    +(season.status==='ended'&&season.champion?('<span style="margin-left:auto;font-weight:700;color:var(--amber)">👑 '+season.champion.name+'</span>'):'');
}
function _renderSeasonList(){
  var box=g('sn-list');
  if(!box)return;
  if(!SEASONS.length){
    box.innerHTML='<div style="text-align:center;padding:16px;color:var(--t3);font-size:13px">등록된 시즌이 없습니다</div>';
    return;
  }
  box.innerHTML=SEASONS.map(function(s){
    var statusLbl=s.status==='ended'?'종료':'진행중';
    var curTag=s.isCurrent?' <span class="badge bg" style="font-size:11px">현재</span>':'';
    var champ=s.champion&&s.champion.name?(' · 👑 '+s.champion.name):'';
    var acts='';
    if(_isAdmin()&&s.status!=='ended'){
      if(!s.isCurrent)acts+='<button class="btn btn-g btn-xs" onclick="setCurrentSeason(\''+s.id+'\')">현재 지정</button> ';
      acts+='<button class="btn btn-d btn-xs" onclick="endSeason(\''+s.id+'\')">시즌 종료</button>';
    }
    return '<div class="season-list-item"><div><div style="font-weight:700;color:var(--t1)">'+s.name+curTag+'</div>'
      +'<div style="font-size:12px;color:var(--t3);margin-top:4px">'+s.startDate+(s.endDate?' ~ '+s.endDate:'')+' · '+statusLbl+champ+'</div></div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+acts+'</div></div>';
  }).join('');
}
window.openSeasonMo=function(){
  _requireAdmin(function(){
    var nm=g('sn-name'),st=g('sn-start');
    if(nm&&!nm.value){
      nm.value=new Date().getFullYear()+' 시즌';
    }
    if(st&&!st.value){
      st.value=new Date().toISOString().slice(0,10);
    }
    _renderSeasonList();
    openMo('mo-season');
  });
};
async function _unsetOtherCurrentSeasons(exceptId){
  for(var i=0;i<SEASONS.length;i++){
    var s=SEASONS[i];
    if(s.id!==exceptId&&s.isCurrent){
      if(db)await updateDoc(doc(db,'seasons',s.id),{isCurrent:false});
      else s.isCurrent=false;
    }
  }
}
window.createSeason=async function(){
  if(!_isAdmin()){toast('⚠️ 관리자만 시즌을 생성할 수 있습니다');return;}
  var name=(g('sn-name')&&g('sn-name').value||'').trim();
  var startDate=(g('sn-start')&&g('sn-start').value||'').trim();
  if(!name||!startDate){toast('⚠️ 시즌 이름과 시작일을 입력해주세요');return;}
  try{
    var data={name:name,startDate:startDate,status:'active',isCurrent:true,createdAt:new Date().toISOString()};
    if(db){
      await _unsetOtherCurrentSeasons(null);
      await addDoc(collection(db,'seasons'),data);
    }else{
      await _unsetOtherCurrentSeasons(null);
      SEASONS.unshift({id:'local_'+Date.now(),...data});
      _applySeasonsSnapshotRender();
    }
    toast('✅ '+name+' 시즌 생성!');
    closeMo('mo-season');
  }catch(e){toast('❌ '+e.message);}
};
window.setCurrentSeason=async function(id){
  if(!_isAdmin()){toast('⚠️ 관리자만 시즌을 지정할 수 있습니다');return;}
  try{
    if(db){
      await _unsetOtherCurrentSeasons(id);
      await updateDoc(doc(db,'seasons',id),{isCurrent:true,status:'active'});
    }else{
      await _unsetOtherCurrentSeasons(id);
      var s=SEASONS.find(function(x){return x.id===id;});
      if(s){s.isCurrent=true;s.status='active';}
      _applySeasonsSnapshotRender();
    }
    toast('✅ 현재 시즌으로 지정했습니다');
  }catch(e){toast('❌ '+e.message);}
};
window.endSeason=async function(id){
  if(!_isAdmin()){toast('⚠️ 관리자만 시즌을 종료할 수 있습니다');return;}
  var season=SEASONS.find(function(s){return s.id===id;});
  if(!season||season.status==='ended'){toast('⚠️ 이미 종료된 시즌입니다');return;}
  if(!confirm(season.name+' 시즌을 종료하시겠습니까?\n시즌 1위에게 👑 시즌 챔피언 배지가 지급됩니다.'))return;
  var endDate=new Date().toISOString().slice(0,10);
  var list=MEMBERS.filter(function(m){return m.status!=='비활성';})
    .map(function(m){return {m:m,pt:_computeSeasonPoints(m,season,false)};})
    .sort(function(a,b){return b.pt-a.pt||((a.m.name||'').localeCompare(b.m.name||''));});
  var top=list[0];
  var champion=top?{name:top.m.name,memberId:top.m.id,points:top.pt}:null;
  try{
    var upd={status:'ended',isCurrent:false,endDate:endDate,endedAt:new Date().toISOString(),champion:champion};
    if(db){
      await updateDoc(doc(db,'seasons',id),upd);
    }else{
      Object.assign(season,upd);
      _applySeasonsSnapshotRender();
    }
    toast(champion?'🏆 '+season.name+' 종료! 👑 '+champion.name:'✅ '+season.name+' 시즌 종료');
  }catch(e){toast('❌ '+e.message);}
};
window.setRkScope=function(scope){
  _rkScope=scope;
  var all=g('rk-scope-all'),sn=g('rk-scope-season');
  if(all)all.classList.toggle('on',scope==='all');
  if(sn)sn.classList.toggle('on',scope==='season');
  var ptH=g('rk-pt-h');
  if(ptH)ptH.textContent=scope==='season'?'시즌 포인트':'포인트';
  renderR();
};
function _hallTop10(rows,valueFn){
  if(!rows.length){
    return '<div style="text-align:center;padding:12px;color:var(--t3);font-size:13px">기록 없음</div>';
  }
  return rows.slice(0,10).map(function(x,i){
    return '<div class="hall-row"><span class="hall-rank">'+(i+1)+'위</span><span class="hall-name">'+x.name+'</span><span class="hall-streak">'+valueFn(x)+'</span></div>';
  }).join('');
}
function _buildHallMemberRows(mapFn){
  return MEMBERS.filter(function(m){return m.status!=='비활성'&&m.name;})
    .map(function(m){return mapFn(m);})
    .filter(function(x){return x&&x.value>0;})
    .sort(function(a,b){return b.value-a.value||a.name.localeCompare(b.name);});
}
function renderHall(){
  var box=g('hall-content');
  if(!box)return;
  var isDbl=_hallMode==='double';
  var modeLbl=isDbl?'복식':'단식';
  var ratingHtml='';
  var me=getMyPlayer();
  if(me&&me.name){
    var hist=_computeRatingHistory(me.name,isDbl);
    ratingHtml='<div class="card card-p hall-cat rating-chart-card"><div class="hall-cat-t">📈 '+modeLbl+' 레이팅 변화 추이 · '+me.name+'</div>'
      +'<div class="rating-chart-wrap">'+_buildRatingChartSvg(hist)+'</div>'
      +'<div class="rating-chart-note">경기 완료 순으로 포인트를 재계산한 추정치입니다 (시작 '+DEF_PT+'pt)</div></div>';
  }else{
    ratingHtml='<div class="card card-p hall-cat rating-chart-card"><div class="hall-cat-t">📈 레이팅 변화 추이</div>'
      +'<div class="rating-chart-empty">마이페이지에서 내 선수를 설정하면 그래프가 표시됩니다.</div></div>';
  }
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
    var n=_countTournamentWins(m.name);
    return {name:m.name,value:n};
  });
  var seasonRows={};
  SEASONS.filter(function(s){return s.status==='ended'&&s.champion&&s.champion.name;}).forEach(function(s){
    var nm=s.champion.name;
    seasonRows[nm]=(seasonRows[nm]||0)+1;
  });
  var seasonList=Object.keys(seasonRows).map(function(nm){return {name:nm,value:seasonRows[nm]};})
    .sort(function(a,b){return b.value-a.value||a.name.localeCompare(b.name);});
  var cats=[
    {title:'🏆 '+modeLbl+' 최다승 TOP10',rows:winsRows,fn:function(x){return x.value+'승';}},
    {title:'🏆 '+modeLbl+' 최고승률 TOP10',rows:rateRows,fn:function(x){return x.value+'%'+(x.extra?' · '+x.extra:'');}},
    {title:'🏆 '+modeLbl+' 최다연승 TOP10',rows:streakRows,fn:function(x){return x.value+'연승';}},
    {title:'🏆 '+modeLbl+' 최다경기 TOP10',rows:gamesRows,fn:function(x){return x.value+'경기';}}
  ];
  if(isDbl){
    cats.push({title:'🤝 복식 최다 파트너 TOP10',rows:partnerRows,fn:function(x){return x.value+'경기';}});
    cats.push({title:'🤝 복식 최고 승률 파트너 TOP10',rows:bestPartnerRows,fn:function(x){return x.value+'%'+(x.extra?' · '+x.extra:'');},note:'최소 5경기'});
  }
  cats.push({title:'🏆 토너먼트 우승 TOP10',rows:tourRows,fn:function(x){return x.value+'회';}});
  cats.push({title:'👑 시즌 우승 TOP10',rows:seasonList,fn:function(x){return x.value+'회';}});
  box.innerHTML=ratingHtml+cats.map(function(cat){
    var noteHtml=cat.note?('<div style="font-size:11px;color:var(--t3);margin:-4px 0 8px">'+cat.note+'</div>'):'';
    return '<div class="card card-p hall-cat"><div class="hall-cat-t">'+cat.title+'</div>'+noteHtml
      +_hallTop10(cat.rows,cat.fn)+'</div>';
  }).join('');
}
window.setHallMode=function(mode){
  _hallMode=mode;
  var dbl=g('hall-dbl'),ind=g('hall-ind');
  if(dbl)dbl.classList.toggle('on',mode==='double');
  if(ind)ind.classList.toggle('on',mode==='individual');
  renderHall();
};
function _renderHallOfFame(){
  var wrap=g('rk-hall-wrap'),box=g('rk-hall');
  if(!wrap||!box)return;
  wrap.style.display='';
  var isDbl=_rkMode==='double';
  var rows=MEMBERS.filter(function(m){return m.status!=='비활성';}).map(function(m){
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
function _buildProfileModeBlock(title,rec,rank,partner,isDbl,bestPartner){
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
      var m=MEMBERS.find(function(x){return x.id===_profileMemberId;});
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
function _renderProfileModal(){
  var m=MEMBERS.find(function(x){return x.id===_profileMemberId;});
  if(!m)return;
  var dblRec=_computeDoublesRecord(m.name);
  var indRec=_computeSinglesRecord(m.name);
  var dblRank=_getMemberRankPosition(m,true,_rkScope==='season');
  var indRank=_getMemberRankPosition(m,false,_rkScope==='season');
  var dblGr=_calcGrade(_memberPt(m,true));
  var indGr=_calcGrade(_memberPt(m,false));
  var partner=_computeTopPartner(m.name);
  var bestPartner=_computeBestWinRatePartner(m.name,5);
  var hdr=g('prof-header');
  if(hdr){
    hdr.innerHTML='<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'
      +'<div class="av '+avc(m.name)+'" style="width:48px;height:48px;font-size:18px">'+ini(m.name)+'</div>'
      +'<div><div style="font-size:18px;font-weight:800;color:var(--t1)">'+m.name+'</div>'
      +'<div style="font-size:13px;color:var(--t3);margin-top:2px">🤝 '+dblGr.icon+' '+dblGr.label+' · 🏓 '+indGr.icon+' '+indGr.label+'</div></div></div>';
  }
  var dblEl=g('prof-doubles');
  if(dblEl){
    dblRec.matches=_getDoublesMatchesFor(m.name);
    dblEl.innerHTML=_buildProfileModeBlock('🤝 복식',dblRec,dblRank,partner,true,bestPartner);
  }
  var indEl=g('prof-singles');
  if(indEl){
    indRec.matches=_getSinglesMatchesFor(m.name);
    indEl.innerHTML=_buildProfileModeBlock('🏓 단식',indRec,indRank,null,false,null);
  }
  var streakEl=g('prof-streak');if(streakEl)streakEl.innerHTML='';
  var recentEl=g('prof-recent');if(recentEl)recentEl.innerHTML='';
  var sel=g('prof-opp');
  if(sel){
    var others=MEMBERS.filter(function(x){return x.status!=='비활성'&&x.id!==m.id&&x.name;})
      .sort(function(a,b){return (a.name||'').localeCompare(b.name||'');});
    sel.innerHTML='<option value="">상대 회원 선택</option>'
      +others.map(function(x){return '<option value="'+x.name+'">'+x.name+'</option>';}).join('');
  }
  var h2hBox=g('prof-h2h');
  if(h2hBox)h2hBox.innerHTML='';
  _renderMemberBadges(m.name);
}
window.openMemberProfile=function(id){
  if(!requireMyPlayer())return;
  _profileMemberId=id;
  _renderProfileModal();
  openMo('mo-profile');
};
window.openMyMemberProfile=function(){
  var id=getMyPlayerId();
  if(!id){toast('⚠️ 내 선수를 먼저 설정해주세요');return;}
  openMemberProfile(id);
};
window.renderProfileH2H=function(){
  var m=MEMBERS.find(function(x){return x.id===_profileMemberId;});
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

window.setRk=function(mode){
  _rkMode=mode;
  var ind=g('rk-ind'),dbl=g('rk-dbl');
  if(ind)ind.classList.toggle('on',mode==='individual');
  if(dbl)dbl.classList.toggle('on',mode==='double');
  renderR();
}
function _rankRowHash(m,rank,pt,gr,streak,recentKey){
  return m.id+'|'+rank+'|'+(m.name||'')+'|'+gr.label+'|'+pt+'|'+streak+'|'+_rkScope+'|'+_rkMode+'|'+recentKey;
}
function _streakForRankRow(m){
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
function _buildRankRecentHtml(m){
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
function _buildRankRowCells(m,rank,pt,grOpt){
  var gr=grOpt||_memberGrade(m);
  var streakHtml='';
  var cur=_streakForRankRow(m);
  if(cur>0){
    streakHtml='<div style="font-size:12px;color:var(--amber);font-weight:700;margin-top:2px">🔥 '+cur+'연승</div>';
  }
  var recentHtml=_buildRankRecentHtml(m);
  var rankHtml;
  if(rank===1)rankHtml='<span class="rk-medal rk-medal--1" aria-label="1위">🥇</span>';
  else if(rank===2)rankHtml='<span class="rk-medal rk-medal--2" aria-label="2위">🥈</span>';
  else if(rank===3)rankHtml='<span class="rk-medal rk-medal--3" aria-label="3위">🥉</span>';
  else rankHtml='<span class="rk-rank-num">'+rank+'</span>';
  return '<td data-label="순위">'+rankHtml+'</td>'
    +'<td data-label="이름" style="color:var(--t1)"><div style="display:flex;align-items:flex-start;gap:8px"><div class="av '+avc(m.name)+'" style="width:34px;height:34px;font-size:13px;flex-shrink:0">'+ini(m.name)+'</div><div style="min-width:0;flex:1"><div style="font-weight:600">'+gr.icon+' '+m.name+'</div><div style="font-size:12px;color:var(--t3);margin-top:2px">'+gr.label+'</div>'+streakHtml+recentHtml+'</div></div></td>'
    +'<td data-label="등급"><span class="badge '+gr.badge+'">'+gr.icon+' '+gr.label+'</span></td>'
    +'<td data-label="포인트"><span class="rk-pt">'+pt+'</span><span class="rk-pt-unit">점</span></td>';
}
function _rankRowClass(rank){
  return rank<=3?'rk-row rk-row--top'+rank:'rk-row';
}
function renderR(){
  var tb=g('rtb');
  if(!tb)return;
  var isDbl=_rkMode==='double';
  var isSeason=_rkScope==='season';
  var season=_getCurrentSeason();
  _updateRkSeasonBar(isSeason,season);
  if(isSeason&&!season){
    Array.from(tb.querySelectorAll('tr[data-rid]')).forEach(function(el){tb.removeChild(el);});
    if(!tb.querySelector('tr[data-empty]')){
      var emptyTr=document.createElement('tr');
      emptyTr.dataset.empty='1';
      emptyTr.innerHTML='<td colspan="4" style="text-align:center;padding:24px;color:var(--t3)">현재 시즌이 없습니다. 📅 시즌에서 생성해 주세요.</td>';
      tb.appendChild(emptyTr);
    }
    _renderHallOfFame();
    return;
  }
  var list=MEMBERS.filter(function(m){return m.status!=='비활성';})
    .map(function(m){
      var pt=isSeason&&season?_computeSeasonPoints(m,season,isDbl):_memberPt(m,isDbl);
      var gr=isSeason&&season?_calcGrade(pt):_calcGrade(_memberPt(m,isDbl));
      return {m:m,pt:pt,gr:gr};
    })
    .sort(function(a,b){return b.pt-a.pt||((a.m.name||'').localeCompare(b.m.name||''));});
  if(!list.length){
    Array.from(tb.querySelectorAll('tr[data-rid]')).forEach(function(el){tb.removeChild(el);});
    if(!tb.querySelector('tr[data-empty]')){
      var emptyTr=document.createElement('tr');
      emptyTr.dataset.empty='1';
      emptyTr.innerHTML='<td colspan="4" style="text-align:center;padding:24px;color:var(--t3)">랭킹 데이터가 없습니다</td>';
      tb.appendChild(emptyTr);
    }
    _renderHallOfFame();
    return;
  }
  var emptyRow=tb.querySelector('tr[data-empty]');
  if(emptyRow)tb.removeChild(emptyRow);
  var needed=list.map(function(x){return x.m.id;});
  var existingMap={};
  Array.from(tb.querySelectorAll('tr[data-rid]')).forEach(function(el){
    existingMap[el.dataset.rid]=el;
  });
  Object.keys(existingMap).forEach(function(id){
    if(needed.indexOf(id)<0)tb.removeChild(existingMap[id]);
  });
  var childList=Array.from(tb.children);
  list.forEach(function(item,idx){
    var rank=idx+1;
    var gr=item.gr||_memberGrade(item.m);
    var streak=_streakForRankRow(item.m);
    var recentKey=_getRecentMatchLines(item.m.name,_rkMode==='double',3,_rkScope==='season'&&season?_seasonFilterFn(season):null)
      .map(function(r){return r.date+r.score+r.result;}).join('|');
    var newHash=_rankRowHash(item.m,rank,item.pt,gr,streak,recentKey);
    var existing=existingMap[item.m.id];
    if(existing){
      if(existing.dataset.rhash!==newHash){
        existing.innerHTML=_buildRankRowCells(item.m,rank,item.pt,gr);
        existing.dataset.rhash=newHash;
      }
      existing.className=_rankRowClass(rank)+(item.m.id===getMyPlayerId()?' rk-row--me':'');
      if(childList[idx]!==existing){
        tb.insertBefore(existing,childList[idx]||null);
        childList=Array.from(tb.children);
      }
    }else{
      var tr=document.createElement('tr');
      tr.className=_rankRowClass(rank)+(item.m.id===getMyPlayerId()?' rk-row--me':'');
      tr.dataset.rid=item.m.id;
      tr.dataset.rhash=newHash;
      tr.innerHTML=_buildRankRowCells(item.m,rank,item.pt,gr);
      tb.insertBefore(tr,childList[idx]||null);
      childList=Array.from(tb.children);
    }
  });
  _renderHallOfFame();
}

function _memberRowHash(m){
  var gr=_memberGrade(m);
  return m.id+'|'+(m.name||'')+'|'+(m.phone||'')+'|'+gr.label+'|'+_memberPt(m,false)+'|'+(m.gender||'')+'|'+(m.status||'')+'|'+(_isAdmin()?'1':'0');
}
function _buildMemberRowCells(m){
  var gr=_memberGrade(m);
  var adminActs=_isAdmin()
    ? `<button class="btn btn-g btn-xs" onclick="openEdit('${m.id}')">✏️ 수정</button><button class="btn btn-d btn-xs" onclick="openDel('${m.id}')">🗑</button>`
    : '';
  return `<td data-label="이름" style="color:var(--t1)"><div style="display:flex;align-items:center;gap:8px"><div class="av ${avc(m.name)}" style="width:34px;height:34px;font-size:13px">${ini(m.name)}</div><div><div style="font-weight:600">${m.name}</div>${m.phone?`<div style="font-size:11px;color:var(--t3)">${m.phone}</div>`:''}</div></div></td>
    <td data-label="등급"><span class="badge ${gr.badge}">${gr.icon} ${gr.label}</span></td>
    <td data-label="성별">${m.gender||'-'}</td>
    <td data-label="상태"><span class="badge ${m.status==='활성'?'bg':'br'}">${m.status||'활성'}</span></td>
    <td class="ta"><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-g btn-xs" onclick="openMemberProfile('${m.id}')">📊 상세</button>${adminActs}</div></td>`;
}

function renderM(){
  const q=(g('ms')?.value||'').trim(),gr=_fg;
  const f=MEMBERS.filter(m=>_matchMemberSearch(m.name,q)&&(!gr||_memberGrade(m).label===gr));
  const tb=g('mtb');
  if(!tb)return;

  if(!f.length){
    Array.from(tb.querySelectorAll('tr[data-mid]')).forEach(function(el){tb.removeChild(el);});
    if(!tb.querySelector('tr[data-empty]')){
      var emptyTr=document.createElement('tr');
      emptyTr.dataset.empty='1';
      emptyTr.innerHTML='<td colspan="5" style="text-align:center;padding:24px;color:var(--t3)">회원이 없습니다</td>';
      tb.appendChild(emptyTr);
    }
    return;
  }
  var emptyRow=tb.querySelector('tr[data-empty]');
  if(emptyRow)tb.removeChild(emptyRow);

  const needed=f.map(m=>m.id);
  const existingMap={};
  Array.from(tb.querySelectorAll('tr[data-mid]')).forEach(function(el){
    existingMap[el.dataset.mid]=el;
  });
  Object.keys(existingMap).forEach(function(id){
    if(needed.indexOf(id)<0)tb.removeChild(existingMap[id]);
  });
  var childList=Array.from(tb.children);
  f.forEach(function(m,idx){
    const newHash=_memberRowHash(m);
    var existing=existingMap[m.id];
    if(existing){
      if(existing.dataset.mhash!==newHash){
        existing.innerHTML=_buildMemberRowCells(m);
        existing.dataset.mhash=newHash;
      }
      if(childList[idx]!==existing){
        tb.insertBefore(existing,childList[idx]||null);
        childList=Array.from(tb.children);
      }
    } else {
      var tr=document.createElement('tr');
      tr.dataset.mid=m.id;
      tr.dataset.mhash=newHash;
      tr.innerHTML=_buildMemberRowCells(m);
      tb.insertBefore(tr,childList[idx]||null);
      childList=Array.from(tb.children);
    }
  });
}
window.filterM=function(val){
  var inp=g('ms');
  if(val!==undefined&&inp&&inp.value!==val)inp.value=val;
  renderM();
}
window.filterG=function(gr){_fg=gr;renderM();}
window.openAddModal=function(){
  _requireAdmin(function(){
    ['rn','rp','rmemo'].forEach(id=>g(id).value='');
    g('rg').selectedIndex=0;
    ['e-rn'].forEach(id=>g(id).classList.remove('on'));
    g('af').style.display='';g('as').style.display='none';
    openMo('mo-add');setTimeout(()=>g('rn').focus(),200);
  });
}
window.submitM=async function(){
  if(!_isAdmin()){toast('⚠️ 관리자만 회원을 등록할 수 있습니다');return;}
  const name=g('rn').value.trim();
  if(!name){g('e-rn').classList.add('on');return;}
  g('e-rn').classList.remove('on');
  const now=new Date();
  const m={name,phone:g('rp').value.trim(),gender:g('rg').value,individualPoint:DEF_PT,doublePoint:DEF_PT,status:'활성',memo:g('rmemo').value.trim(),joined:`${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}`,createdAt:now.toISOString()};
  g('af').style.display='none';g('asn').textContent=`${name} 회원님 환영합니다! 🏓`;g('as').style.display='';
  try{if(db)await addDoc(collection(db,'members'),m);else{MEMBERS.push({id:'l'+Date.now(),...m});renderM();}toast('✅ '+name+' 등록 완료');}
  catch(e){toast('❌ '+e.message);}
}
window.openEdit=function(id){
  if(!_isAdmin()){_requireAdmin(function(){openEdit(id);});return;}
  const m=MEMBERS.find(m=>m.id===id);if(!m)return;
  var gr=_memberGrade(m);
  g('eid').value=id;g('en').value=m.name;g('ep').value=m.phone||'';
  g('eg').value=m.gender||'';
  g('egr-disp').textContent=gr.icon+' '+gr.label;
  g('ept-disp').textContent=_memberPt(m,false)+'점';
  g('est').value=m.status||'활성';g('ememo').value=m.memo||'';
  g('e-en').classList.remove('on');openMo('mo-edit');
}
window.saveEdit=async function(){
  if(!_isAdmin()){toast('⚠️ 관리자만 회원을 수정할 수 있습니다');return;}
  const id=g('eid').value,name=g('en').value.trim();
  if(!name){g('e-en').classList.add('on');return;}
  const u={name,phone:g('ep').value.trim(),gender:g('eg').value,status:g('est').value,memo:g('ememo').value.trim()};
  closeMo('mo-edit');
  try{if(db)await updateDoc(doc(db,'members',id),u);else{const i=MEMBERS.findIndex(m=>m.id===id);if(i>-1)MEMBERS[i]={...MEMBERS[i],...u};renderM();}toast('✅ '+name+' 수정 완료');}
  catch(e){toast('❌ '+e.message);}
}
window.openDel=function(id){
  if(!_isAdmin()){_requireAdmin(function(){openDel(id);});return;}
  _delId=id;const m=MEMBERS.find(m=>m.id===id);g('dm').textContent=`"${m?.name}" 회원을 삭제할까요?`;openMo('mo-del');
}
window.confirmDel=async function(){
  if(!_isAdmin()){toast('⚠️ 관리자만 회원을 삭제할 수 있습니다');return;}
  const m=MEMBERS.find(m=>m.id===_delId);closeMo('mo-del');
  try{if(db)await deleteDoc(doc(db,'members',_delId));else{MEMBERS=MEMBERS.filter(m=>m.id!==_delId);renderM();}toast('🗑 '+m?.name+' 삭제 완료');}
  catch(e){toast('❌ '+e.message);}
}

// ════ 공지사항 ════
const NCLS={필독:'br',일정:'ba',안내:'bb',일반:'bz'};
function renderN(){
  const el=g('nl');
  if(!NOTICES.length){el.innerHTML='<div style="text-align:center;padding:40px;color:var(--t3)">공지사항이 없습니다</div>';return;}
  el.innerHTML=NOTICES.map(n=>`<div class="ni">
    <div class="ni-row">
      <span class="badge ${NCLS[n.type]||'bz'}">${n.type||'일반'}</span>
      <span class="ni-title">${n.title}</span>
      <div class="ni-acts">
        <button class="btn btn-g btn-xs" onclick="openNEdit('${n.id}')">✏️</button>
        <button class="btn btn-d btn-xs" onclick="delN('${n.id}')">🗑</button>
      </div>
    </div>
    <div class="ni-meta">${n.createdAt?new Date(n.createdAt).toLocaleDateString('ko-KR'):''}</div>
    ${n.body?`<div class="ni-body">${n.body}</div>`:''}
  </div>`).join('');
}
window.openNoticeModal=function(){
  ['ntitle','nbody'].forEach(id=>g(id).value='');
  g('ntype').selectedIndex=0;
  g('e-nt').classList.remove('on');
  openMo('mo-notice');
}
window.submitNotice=async function(){
  const title=g('ntitle').value.trim();
  if(!title){g('e-nt').classList.add('on');return;}
  const data={type:g('ntype').value,title,body:g('nbody').value.trim(),createdAt:new Date().toISOString()};
  closeMo('mo-notice');
  try{if(db)await addDoc(collection(db,'notices'),data);else{NOTICES.unshift({id:'l'+Date.now(),...data});renderN();}toast('📢 공지 등록!');}
  catch(e){toast('❌ '+e.message);}
}
window.openNEdit=function(id){
  const n=NOTICES.find(n=>n.id===id);if(!n)return;
  g('neid').value=id;g('netype').value=n.type||'일반';g('netitle').value=n.title;g('nebody').value=n.body||'';
  g('e-net').classList.remove('on');openMo('mo-nedit');
}
window.saveNoticeEdit=async function(){
  const id=g('neid').value,title=g('netitle').value.trim();
  if(!title){g('e-net').classList.add('on');return;}
  const u={type:g('netype').value,title,body:g('nebody').value.trim(),updatedAt:new Date().toISOString()};
  closeMo('mo-nedit');
  try{if(db)await updateDoc(doc(db,'notices',id),u);else{const i=NOTICES.findIndex(n=>n.id===id);if(i>-1)NOTICES[i]={...NOTICES[i],...u};renderN();}toast('✅ 공지 수정!');}
  catch(e){toast('❌ '+e.message);}
}
window.delN=async function(id){
  if(!confirm('공지를 삭제할까요?'))return;
  try{if(db)await deleteDoc(doc(db,'notices',id));else{NOTICES=NOTICES.filter(n=>n.id!==id);renderN();}toast('🗑 공지 삭제');}
  catch(e){toast('❌ '+e.message);}
}

// ════ 게시판 ════
function renderB(){
  const el=g('bl');
  if(!BOARDS.length){el.innerHTML='<div style="text-align:center;padding:40px;color:var(--t3)">게시글이 없습니다</div>';return;}
  el.innerHTML=BOARDS.map(b=>`<div class="ni">
    <div class="ni-row">
      <span style="font-size:12px;color:var(--t3);flex-shrink:0">${b.author||'익명'}</span>
      <span class="ni-title" style="font-size:14px">${b.title}</span>
      <div class="ni-acts">
        <button class="btn btn-g btn-xs" onclick="openBEdit('${b.id}')">✏️</button>
        <button class="btn btn-d btn-xs" onclick="delBd('${b.id}')">🗑</button>
      </div>
    </div>
    <div class="ni-meta">${b.createdAt?new Date(b.createdAt).toLocaleDateString('ko-KR'):''}</div>
    ${b.body?`<div class="ni-body">${b.body}</div>`:''}
  </div>`).join('');
}
window.openBoardModal=function(){
  ['bauthor','btitle','bbody'].forEach(id=>g(id).value='');
  ['e-ba','e-bt'].forEach(id=>g(id).classList.remove('on'));
  openMo('mo-board');
}
window.submitBoard=async function(){
  const author=g('bauthor').value.trim(),title=g('btitle').value.trim();
  let ok=true;
  if(!author){g('e-ba').classList.add('on');ok=false;}
  if(!title){g('e-bt').classList.add('on');ok=false;}
  if(!ok)return;
  const data={author,title,body:g('bbody').value.trim(),createdAt:new Date().toISOString()};
  closeMo('mo-board');
  try{if(db)await addDoc(collection(db,'boards'),data);else{BOARDS.unshift({id:'l'+Date.now(),...data});renderB();}toast('✅ 게시글 등록!');}
  catch(e){toast('❌ '+e.message);}
}
window.openBEdit=function(id){
  const b=BOARDS.find(b=>b.id===id);if(!b)return;
  g('beid').value=id;g('beauthor').value=b.author||'';g('betitle').value=b.title;g('bebody').value=b.body||'';
  g('e-bet').classList.remove('on');openMo('mo-bedit');
}
window.saveBoardEdit=async function(){
  const id=g('beid').value,title=g('betitle').value.trim();
  if(!title){g('e-bet').classList.add('on');return;}
  const u={author:g('beauthor').value.trim(),title,body:g('bebody').value.trim(),updatedAt:new Date().toISOString()};
  closeMo('mo-bedit');
  try{if(db)await updateDoc(doc(db,'boards',id),u);else{const i=BOARDS.findIndex(b=>b.id===id);if(i>-1)BOARDS[i]={...BOARDS[i],...u};renderB();}toast('✅ 게시글 수정!');}
  catch(e){toast('❌ '+e.message);}
}
window.delBd=async function(id){
  if(!confirm('게시글을 삭제할까요?'))return;
  try{if(db)await deleteDoc(doc(db,'boards',id));else{BOARDS=BOARDS.filter(b=>b.id!==id);renderB();}toast('🗑 게시글 삭제');}
  catch(e){toast('❌ '+e.message);}
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
  if(origin===canonical)return true;
  if(origin==='https://isatok-ef06a.web.app')return true;
  return false;
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
function _shareFilterFor(c){
  if(!c)return 'pending';
  if(c.status==='completed')return 'completed';
  if(c.status==='accepted')return 'accepted';
  if(c.isOpen&&c.status==='pending')return 'open';
  return 'pending';
}
function buildShareUrl(c){
  // 카카오 Feed는 # 해시 URL을 링크로 인식하지 못함 → 쿼리 파라미터 사용
  if(!c||!c.id)return _siteBase()+'?p=challenge&filter=pending';
  return _siteBase()+'?p=challenge&ch='+encodeURIComponent(c.id)+'&filter='+_shareFilterFor(c);
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
    title='🏆 '+wn+' 승리 · '+v.tm.lb;
    if(c.score)descParts.push('스코어 '+c.score);
  } else if(c.status==='accepted'){
    title='📅 경기 확정 · '+v.vs;
    descParts.push('결과 입력을 기다려요');
  } else if(v.isOpen){
    title='🔥 오픈 챌린지 · '+v.myT;
    descParts.push('누구나 수락 가능');
  } else if(c.status==='pending'){
    descParts.push('수락/거절 부탁드려요');
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
  if(template==='short'){
    var head='🏓 ['+v.tm.lb+'] '+v.vs;
    var sub=[];
    if(c.status==='completed'&&c.winner){
      var wn=c.winner==='a'?v.myT:v.opT;
      head='🏆 '+wn+' 승 · '+v.tm.lb;
      if(c.score)sub.push(c.score);
    } else if(c.status==='accepted'){ head='📅 '+v.vs; }
    else if(isOpen){ head='🔥 오픈 · '+v.myT; }
    if(dtStr||c.time)sub.push((dtStr||'날짜 미정')+(c.time?' '+c.time:''));
    if(betLabel)sub.push(betLabel);
    var cta=c.status==='completed'?'결과 확인':c.status==='accepted'?'경기 예정':isOpen?'수락 환영!':'수락 부탁 🙏';
    return head+'\n'+(sub.length?sub.join(' · ')+'\n':'')+cta+'\n'+url;
  }
  if(template==='open'&&isOpen){
    var openLines=['🔥 이사탁 오픈 챌린지','─────────────────','🏅 '+v.tm.lb,'⚔️ 도전: '+v.myT,'👋 누구나 수락 가능!',''];
    if(dtStr||c.time)openLines.push('📅 '+dtStr+(c.time?' '+c.time:''));
    if(betLabel)openLines.push('🎰 '+betLabel);
    if(c.message)openLines.push('💬 '+c.message);
    openLines.push('─────────────────','단톡에서 수락해 주세요! 🙏',url);
    return openLines.join('\n');
  }
  var lines=[];
  if(c.status==='completed'&&c.winner){
    lines=['🏆 이사탁 경기 결과','─────────────────','🏅 '+v.tm.lb,'👑 '+(c.winner==='a'?v.myT:v.opT)+' 팀 승리',''];
    if(c.score)lines.push('📊 '+c.score);
  } else if(c.status==='accepted'){
    lines=['📅 이사탁 경기 안내','─────────────────','🏅 '+v.tm.lb,'⚔️ '+v.vs,''];
  } else if(isOpen){
    lines=['🔥 이사탁 오픈 챌린지','─────────────────','🏅 '+v.tm.lb,'⚔️ '+v.myT,'👋 누구나 수락 가능!',''];
  } else {
    lines=['🏓 이사탁 탁구 대결 신청','─────────────────','🏅 '+v.tm.lb,'⚔️ '+v.vs,''];
  }
  if(dtStr||c.time)lines.push('📅 일시: '+dtStr+(c.time?' '+c.time:''));
  if(betLabel)lines.push('🎰 내기: '+betLabel);
  if(c.message)lines.push('💬 '+c.message);
  if(c.status==='completed')lines.push('─────────────────','결과 확인은 아래 링크! 🙏');
  else if(c.status==='accepted')lines.push('─────────────────','경기 후 결과 입력 예정! 🏓');
  else lines.push('─────────────────','아래 링크에서 수락/거절해주세요! 🙏');
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
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

// ── 현재 환경이 카카오톡 인앱 브라우저인지 판별
function _isKakaoInApp(){
  return /KAKAOTALK|KakaoTalk/i.test(navigator.userAgent);
}

// ── 환경에 따라 공유 모달 하단 힌트 텍스트를 동적으로 세팅
function _setShareHint(){
  var hint=g('share-hint');
  var originInfo=g('share-origin-info');
  var kakaoBtn=document.querySelector('#mo-kakao .btn-kakao');
  if(originInfo){
    originInfo.textContent='접속 주소: '+_kakaoCallerOrigin();
  }
  if(_isKakaoInApp()){
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
window.shareKakao=function(id){
  var c=CHAL.find(function(c){return c.id===id;});
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
window.doKakaoShare=function(){
  var c=window._shareChallenge;
  var txt=window._shareText||'';
  var url=_shareLinkUrl(c);
  if(!txt)return;

  if(_isKakaoInApp()){
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
        toast('❌ 카카오 공유 실패 (4019)\n카카오 개발자 콘솔 → 플랫폼 키 → JavaScript SDK 도메인에\nhttps://isatok.web.app 등록을 확인해주세요.',{multiline:true,duration:5000});
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

// ════ 공통 ════
window.fmtP=function(el){let v=el.value.replace(/\D/g,'');if(v.length<=3)el.value=v;else if(v.length<=7)el.value=v.slice(0,3)+'-'+v.slice(3);else el.value=v.slice(0,3)+'-'+v.slice(3,7)+'-'+v.slice(7,11);}
window.toast=function(msg,opts){
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t=document.createElement('div');
  t.className='toast'+(opts&&opts.multiline?' toast-multiline':'');
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),(opts&&opts.duration)||2800);
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
  var c=CHAL.find(function(x){return x.id===id;});
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

  var c=CHAL.find(function(x){return x.id===_betPickId;});
  if(!c)return;

  var payload=_buildBetPickPayload(me,_betPickSide);
  var updField='betPicks.'+me.id;
  closeMo('mo-bet');
  try{
    if(db){
      var updateObj={};
      updateObj[updField]=payload;
      await updateDoc(doc(db,'challenges',_betPickId),updateObj);
    }else{
      if(!c.betPicks)c.betPicks={};
      c.betPicks[me.id]=payload;
      renderC();
    }
    toast('🎯 '+me.name+' → '+_betSideLabel(c,_betPickSide)+' 승 예측 완료!');
  }catch(e){toast('❌ '+e.message);}
};

// 시작
window.setF('all');
ensureLatestVersion().then(function(){
  init();
});
